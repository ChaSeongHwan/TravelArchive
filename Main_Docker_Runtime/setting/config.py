import os
from pathlib import Path
from dotenv import load_dotenv

# ==========================================
# 0. 환경 변수 로드 (절대 경로 탐색 보장)
# ==========================================
CURRENT_DIR = Path(__file__).resolve().parent
ENV_PATH = CURRENT_DIR / ".env"
load_dotenv(ENV_PATH)

# 공통 기본 API 키
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ==========================================
# 1. 대화 생성 에이전트 세트 (Generation)
# ==========================================
GENERATION_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL_GENERATION = os.getenv("LLM_MODEL_GENERATION", "gpt-4o-mini")

# {p_topic}, {s_topic}, {s_context}, {past_chat_history}, {current_msg_content} 자리표시자 사용
GENERATION_PROMPT = (
    "[개인화 정보]: {p_topic}\n"
    "[현재 대화 주제]: {s_topic}\n"
    "[이전 대화 요약]: {s_context}\n"
    "[최근 대화 기록 (버퍼)]:\n{past_chat_history}\n"
    "[현재 사용자 메시지]: {current_msg_content}"
)

# ==========================================
# 2. 주제 및 이름 추출 에이전트 세트 (Topic)
# ==========================================
TOPIC_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL_TOPIC = os.getenv("LLM_MODEL_TOPIC", "gpt-4o-mini")

# {history_text} 자리표시자 사용
TOPIC_PROMPT = (
    "너는 대화의 핵심을 파악하여 분류하는 AI야.\n"
    "아래 대화 내역을 분석해서, 현재 대화의 '구체적인 여행 목적(주제)'과 'UI에 표시할 세션 이름(15자 이내)'을 JSON 형식으로만 응답해.\n"
    "반드시 {{\"topic\": \"...\", \"name\": \"...\"}} 형태의 유효한 JSON만 출력해야 해.\n"
    "[대화 내역]:\n{history_text}"
)
# 주의: 중괄호 자체가 문자에 포함되어야 할 때는 {{ }} 처럼 두 번 써야 에러가 안 납니다.

# ==========================================
# 3. 맥락 요약 에이전트 세트 (Summary)
# ==========================================
SUMMARY_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL_SUMMARY = os.getenv("LLM_MODEL_SUMMARY", "gpt-4o-mini")

# {current_context}, {history_text} 자리표시자 사용
SUMMARY_PROMPT = (
    "너는 과거의 대화 내역을 핵심만 압축하여 요약하는 AI야.\n"
    "기존에 요약된 맥락과 새롭게 추가된 대화 내역을 바탕으로, 봇이 앞으로의 대화에서 참고해야 할 핵심 정보를 하나의 문단으로 통합해서 요약해 줘.\n"
    "[기존 대화 요약]: {current_context}\n"
    "[새로 추가된 대화 내역]:\n{history_text}\n"
    "새로운 통합 요약문만 출력해."
)

# ==========================================
# 4. 개인화 정보 처리 에이전트 세트 (Personal)
# ==========================================
PERSONAL_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL_PERSONAL = os.getenv("LLM_MODEL_PERSONAL", "gpt-4o-mini")
PERSONAL_PROMPT = "" # 이 부분은 다음 단계에서 개인화 로직 설계 시 채우겠습니다.





#docker compose -f docker-compose-db.yml up -d && docker compose -f docker-compose-system.yml up -d --build && docker compose -f docker-compose-nginx.yml up -d
#docker rm -f travelarchive_nginx && docker rm -f travelarchive_backend && docker rm -f travelarchive_db