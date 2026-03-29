import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 루트 경로 추가 (module 로드를 위해)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from module.node.llm.gpt_node import GPTProcessor
from module.node.base.node import Node
from module.node.base.message import create_message

# .env 로드
load_dotenv(os.path.join(PROJECT_ROOT, "setting", ".env"))

async def run_node_interaction(target_node, input_data):
    """
    노드에 데이터를 넣고, 결과가 나올 때까지 기다려 데이터를 반환하는 핵심 함수
    """
    msg = create_message(
        source="facade_api",
        kind="data",
        data=input_data,
        target=target_node.node_id
    )

    await target_node.iface.from_router_q.put(msg)

    full_response = ""
    is_done = False

    while not is_done:
        await target_node.tick()

        while not target_node.iface.to_router_q.empty():
            result_msg = await target_node.iface.to_router_q.get()

            # 1. StreamChunk 처리
            if type(result_msg.data).__name__ == "StreamChunk":
                chunk = result_msg.data
                full_response += chunk.data
                if chunk.is_end:
                    is_done = True
            
            # 2. 일반 문자열 처리
            elif isinstance(result_msg.data, str):
                full_response = result_msg.data
                is_done = True
            
            # 3. 에러 처리
            elif result_msg.kind == "error":
                full_response = f"Error: {result_msg.data}"
                is_done = True

        if not is_done:
            await asyncio.sleep(0.05)

    return full_response

class TestNode:
    """
    SessionContainer에서 주입받은 모델명과 API키를 사용하여
    독립적인 GPT 노드를 생성하고 관리합니다.
    """
    def __init__(self, model_name: str = "gpt-4o-mini", api_key: str = None):
        # 1. 전달받은 설정값으로 Processor 생성
        # persona는 기본 정책을 유지하되 필요시 확장이 가능하도록 구성
        processor = GPTProcessor(
            model=model_name,  # 주입받은 모델명 적용
            persona="마크다운, 이모티콘, 이모지를 절대 사용하지 말 것.\n",
            api_key=api_key or os.getenv("OPENAI_API_KEY")
        )

        # 2. 고유한 ID를 가진 Node 인스턴스 생성
        # 노드마다 독립적인 큐(Queue)를 가지게 되어 병렬 처리가 가능해집니다.
        self.node = Node(
            node_id=f"gpt_{model_name}_{id(self)}", 
            base=processor
        )

    async def ask(self, message: str):
        """세션 컨테이너에서 호출하는 메인 인터페이스"""
        result = await run_node_interaction(self.node, message)
        return result