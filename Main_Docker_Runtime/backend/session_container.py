"""
세션 컨테이너 모듈
현재 대화 주제, 개인화 정보, 그리고 과거와 현재의 메시지 버퍼를 관리합니다.
각각의 LLM 태스크(대화 생성, 주제 추출, 맥락 요약)를 독립된 노드에서 처리하도록 설계되었습니다.
"""
import sys
import os
import asyncio
import json
from pathlib import Path
from typing import List, Dict, Optional

# 실행 경로(sys.path) 문제 방지: backend의 상위 폴더(프로젝트 루트)를 path에 동적으로 추가하여 setting 모듈을 확실히 찾게 합니다.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

# 중앙 통제 config에서 모델, API 키, 프롬프트 템플릿 임포트
from setting.config import (
    LLM_MODEL_GENERATION, GENERATION_PROMPT, GENERATION_API_KEY,
    LLM_MODEL_TOPIC, TOPIC_PROMPT, TOPIC_API_KEY,
    LLM_MODEL_SUMMARY, SUMMARY_PROMPT, SUMMARY_API_KEY
)

from .test_agent import TestNode

class SessionContainer:
    """
    세션의 생명주기와 상태 전이를 관리하는 컨테이너 클래스입니다.
    DB 통신은 의존성 주입(Dependency Injection)된 db_interface를 통해 수행하며,
    LLM 생성 로직은 역할별로 분리된 TestNode 인스턴스들을 활용합니다.
    """

    def __init__(self, session_id: str, user_id: str, db_interface, max_buffer_size: int = 6, rename_threshold: int = 6):
        self.session_id = session_id
        self.user_id = user_id
        self.db = db_interface
        self.max_buffer_size = max_buffer_size
        
        # 주기적 업데이트 대신 특정 횟수(1번째와 k번째)에서만 업데이트 (요청 2 반영)
        self.rename_threshold = rename_threshold

        # LLM 처리 노드 분리 할당 및 config 주입
        # TestNode가 model_name과 api_key를 받을 수 있도록 파라미터를 넘깁니다.
        self.generation_node = TestNode(model_name=LLM_MODEL_GENERATION, api_key=GENERATION_API_KEY)  
        self.topic_node = TestNode(model_name=LLM_MODEL_TOPIC, api_key=TOPIC_API_KEY)       
        self.summary_node = TestNode(model_name=LLM_MODEL_SUMMARY, api_key=SUMMARY_API_KEY)    

        # 상태 변수 초기화
        self.personalization_topic: str = ""
        self.session_topic: str = "새로운 대화"
        self.session_name: str = "새 세션"
        self.session_context: str = ""
        
        # 수동 이름 변경 여부 플래그 (요청 1 반영)
        self.is_manual_title: bool = False
        
        self.past_messages: List[Dict[str, str]] = []
        self.current_message: Optional[Dict[str, str]] = None
        
        # 상태 플래그
        self.is_initialized: bool = False
        self.is_processing: bool = False

    # ==========================================
    # 게터(Getter) 및 플래그 검사
    # ==========================================
    def get_session_id(self) -> str:
        return self.session_id

    def get_session_name(self) -> str:
        return self.session_name

    def get_is_processing(self) -> bool:
        return self.is_processing

    async def get_full_history(self) -> List[Dict[str, str]]:
        """
        DB에 저장된 과거 대화 내역과 현재 메모리(컨테이너 버퍼)에 있는 대화 내역을 병합합니다.
        프론트엔드에서 대화 내역을 조회할 때 누락이 없도록 보장하는 역할을 수행합니다.
        """
        db_history = await self.db.get_chat_history(self.session_id)
        full_history = list(db_history)
        
        full_history.extend(self.past_messages)
        if self.current_message:
            full_history.append(self.current_message)
            
        return full_history

    # ==========================================
    # 1. 초기화 및 세션 로드 (Init & Load)
    # ==========================================
    async def initialize_session(self, is_new: bool = True):
        """세션 생성 및 불러오기 플로우를 담당합니다."""
        print(f"[{self.session_id}] 세션 초기화 시작 (새 세션 여부: {is_new})")
        
        self.personalization_topic = await self.db.load_personalization(self.user_id)

        if not is_new:
            session_data = await self.db.load_session_data(self.session_id)
            self.session_topic = session_data.get("topic", "새로운 대화")
            self.session_name = session_data.get("name", "새 세션")
            self.session_context = session_data.get("context", "")
            # DB 로드 시 수동 플래그도 복구합니다.
            self.is_manual_title = session_data.get("is_manual_title", False)
            
            self.past_messages = []
        
        self.current_message = None
        self.is_initialized = True
        print(f"[{self.session_id}] 세션 초기화 완료. 세션 이름: {self.session_name}")

    # ==========================================
    # 2. 메인 파이프라인 (Ingest & Process)
    # ==========================================
    async def process_user_input(self, text: str) -> str:
        """사용자의 메시지를 받아 전체 사이클을 돌리는 메인 메서드입니다."""
        self.is_processing = True
        try:
            print(f"[{self.session_id}] 새로운 메시지 파이프라인 가동")
            
            if self.current_message:
                self.past_messages.append(self.current_message)

            user_msg = {"role": "user", "content": text}
            self.current_message = user_msg

            topic_update_result = await self._llm_update_topic(
                self.current_message, self.past_messages
            )
            
            topic_changed = (self.session_topic != topic_update_result["topic"] or self.session_name != topic_update_result["name"])
            self.session_topic = topic_update_result["topic"]
            self.session_name = topic_update_result["name"]

            if topic_changed:
                await self.db.save_session_state(
                    self.session_id, self.session_topic, self.session_name, self.session_context, self.is_manual_title
                )

            bot_response_text = await self._node_network_generate(
                self.personalization_topic,
                self.session_topic,
                self.session_context,
                self.past_messages,
                self.current_message
            )

            self.past_messages.append(self.current_message)
            bot_msg = {"role": "bot", "content": bot_response_text}
            self.current_message = bot_msg

            await self._check_and_flush_buffer()

            return bot_response_text
        finally:
            self.is_processing = False

    # ==========================================
    # 3. 상태 관리 및 플로우 제어 (Flush & Summarize)
    # ==========================================
    async def _check_and_flush_buffer(self):
        """과거 메시지 갯수를 확인하여 임계치 도달 시 요약 및 DB 저장을 실행합니다."""
        if len(self.past_messages) >= self.max_buffer_size:
            print(f"[{self.session_id}] 버퍼 한계 도달 ({len(self.past_messages)}개). 요약 및 Flush 시작.")
            
            await self.db.append_messages(self.session_id, self.past_messages)
            
            new_context = await self._llm_summarize_context(
                self.session_context, self.past_messages
            )
            self.session_context = new_context
            
            self.past_messages.clear()
            
            await self.db.save_session_state(
                self.session_id, self.session_topic, self.session_name, self.session_context, self.is_manual_title
            )
            
            print(f"[{self.session_id}] 요약 및 Flush 작업 완료.")

    async def teardown(self):
        """세션 변경 또는 종료 시 호출되는 컨테이너 해제 로직입니다."""
        print(f"[{self.session_id}] 세션 종료 및 메모리 해제 프로세스 시작")
        
        if self.current_message:
            self.past_messages.append(self.current_message)
            self.current_message = None
            
        await self._check_and_flush_buffer()
        
        if self.past_messages:
            await self.db.append_messages(self.session_id, self.past_messages)
            
        await self.db.save_session_state(
            self.session_id, self.session_topic, self.session_name, self.session_context, self.is_manual_title
        )
        self.past_messages.clear()
        self.is_initialized = False
        
        print(f"[{self.session_id}] 세션 데이터 보존 및 해제 완료.")

    # ==========================================
    # 4. 내부 LLM 연동 로직
    # ==========================================
    async def _llm_update_topic(self, current_msg: dict, past_msgs: List[dict]) -> dict:
        """사용자 메시지 1번째와 지정된 k번째(rename_threshold)에만 세션 주제/이름을 유추합니다."""
        
        user_msg_count = sum(1 for msg in past_msgs if msg.get("role") == "user")
        if current_msg.get("role") == "user":
            user_msg_count += 1

        suggested_name = self.session_name
        suggested_topic = self.session_topic

        if user_msg_count == 1 or user_msg_count == self.rename_threshold:
            print(f"[{self.session_id}] 사용자 입력 {user_msg_count}회 누적. 주제 갱신 LLM 가동.")
            
            history_text = ""
            for msg in past_msgs:
                role_kr = "사용자" if msg["role"] == "user" else "AI"
                history_text += f"{role_kr}: {msg['content']}\n"
            history_text += f"사용자: {current_msg['content']}"

            # config.py에서 불러온 템플릿에 .format()으로 값을 주입합니다.
            prompt = TOPIC_PROMPT.format(history_text=history_text)

            try:
                response = await self.topic_node.ask(prompt)
                response_clean = response.replace("```json", "").replace("```", "").strip()
                result = json.loads(response_clean)
                
                suggested_topic = result.get("topic", suggested_topic)
                
                if not self.is_manual_title:
                    suggested_name = result.get("name", suggested_name)
                    print(f"[{self.session_id}] 주제 및 이름 갱신 완료 - 주제: {suggested_topic}, 이름: {suggested_name}")
                else:
                    print(f"[{self.session_id}] 주제 갱신 완료 - 주제: {suggested_topic} (이름은 수동 지정되어 무시함)")
                    
            except Exception as e:
                print(f"[{self.session_id}] 주제 갱신 노드 에러 (기존 값 유지): {e}")

        return {
            "topic": suggested_topic,
            "name": suggested_name
        }

    async def _node_network_generate(self, p_topic: str, s_topic: str, s_context: str, past_msgs: List[dict], current_msg: dict) -> str:
        past_chat_history = ""
        if past_msgs:
            for msg in past_msgs:
                role_kr = "사용자" if msg["role"] == "user" else "AI"
                past_chat_history += f"{role_kr}: {msg['content']}\n"
        else:
            past_chat_history = "최근 대화 내역 없음"

        # config.py에서 불러온 템플릿에 .format()으로 변수들을 안전하게 주입합니다.
        prompt = GENERATION_PROMPT.format(
            p_topic=p_topic,
            s_topic=s_topic,
            s_context=s_context,
            past_chat_history=past_chat_history,
            current_msg_content=current_msg['content']
        )
        
        response = await self.generation_node.ask(prompt)
        return response

    async def _llm_summarize_context(self, current_context: str, past_msgs: List[dict]) -> str:
        print(f"[{self.session_id}] 과거 버퍼 요약 LLM 가동.")
        
        history_text = ""
        for msg in past_msgs:
            role_kr = "사용자" if msg["role"] == "user" else "AI"
            history_text += f"{role_kr}: {msg['content']}\n"

        # config.py에서 불러온 템플릿에 .format()으로 변수를 주입합니다.
        prompt = SUMMARY_PROMPT.format(
            current_context=current_context if current_context else '없음',
            history_text=history_text
        )

        try:
            response = await self.summary_node.ask(prompt)
            return response.strip()
        except Exception as e:
            print(f"[{self.session_id}] 요약 노드 에러 (기존 값 유지): {e}")
            return current_context