import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import uuid
from typing import List, Dict

app = FastAPI(title="Chatbot Middle-end API")

# CORS 설정 (프론트엔드와 포트가 다를 경우를 대비)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 실제 운영시에는 프론트엔드 도메인으로 제한하는 것이 좋습니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Pydantic 데이터 모델
# ==========================================
class SessionCreateRequest(BaseModel):
    first_message: str

class MessageRequest(BaseModel):
    message: str

class ThemeRequest(BaseModel):
    theme: str

# ==========================================
# 임시 메모리 DB (실제 구현 시 RDBMS/NoSQL 연동 필요)
# ==========================================
sessions_db = [
    {"id": "session_1", "title": "오사카 3박 4일 일정"},
    {"id": "session_2", "title": "제주도 여행 코스"}
]

chat_history_db: Dict[str, List[Dict[str, str]]] = {
    "session_1": [{"role": "user", "content": "오사카 일정 짜줘"}, {"role": "bot", "content": "네, 오사카 3박 4일 일정을 안내해 드릴게요."}],
    "session_2": [{"role": "user", "content": "제주도 여행 코스 추천해줘"}, {"role": "bot", "content": "제주도 여행 코스를 추천해 드립니다."}]
}

# ==========================================
# API 라우터 (프론트엔드 BackendHooks 매칭)
# ==========================================

@app.get("/api/sessions")
async def get_session_list():
    """과거 세션 목록 데이터 요청"""
    return sessions_db

@app.post("/api/sessions")
async def create_session(req: SessionCreateRequest):
    """새 세션 생성 요청"""
    new_id = f"session_{uuid.uuid4().hex[:9]}"
    title = req.first_message[:20] + "..." if len(req.first_message) > 20 else req.first_message
    
    new_session = {"id": new_id, "title": title}
    sessions_db.insert(0, new_session) # 최신 세션을 맨 앞으로
    chat_history_db[new_id] = []
    
    return new_session

@app.get("/api/sessions/{session_id}/history")
async def get_chat_history(session_id: str):
    """과거 대화 불러오기 요청"""
    return chat_history_db.get(session_id, [])

@app.post("/api/sessions/{session_id}/message")
async def send_message(session_id: str, req: MessageRequest):
    """메시지 전송 및 스트리밍 응답 (Server-Sent Events 또는 Plain Chunk)"""
    
    # 1. 사용자 메시지 DB 저장
    if session_id not in chat_history_db:
        chat_history_db[session_id] = []
    chat_history_db[session_id].append({"role": "user", "content": req.message})

    # 2. 스트리밍 제너레이터 함수
    async def response_generator():
        # 실제 연동 시 이곳에 OpenAI, Gemini 등의 LLM 스트리밍 API를 호출합니다.
        dummy_response = f"FastAPI 서버에서 '{req.message}'에 대한 응답을 스트리밍 중입니다. 프론트엔드와 성공적으로 연결되었습니다."
        
        for char in dummy_response:
            yield char
            await asyncio.sleep(0.03) # 타이핑 효과 시뮬레이션
            
        # 3. 봇 응답 완료 후 DB 저장
        chat_history_db[session_id].append({"role": "bot", "content": dummy_response})

    # 미디어 타입을 text/plain 혹은 text/event-stream으로 설정하여 청크 단위 전송
    return StreamingResponse(response_generator(), media_type="text/plain")

@app.get("/api/settings")
async def get_settings():
    return {"status": "success", "data": "설정 페이지입니다. (FastAPI 연동 완료)"}

@app.get("/api/account")
async def get_account_info():
    return {"status": "success", "data": "계정 관리 페이지입니다. (FastAPI 연동 완료)"}

@app.get("/api/help")
async def get_help_data():
    return {"status": "success", "data": "도움말 가이드라인 페이지입니다. (FastAPI 제공)"}

@app.post("/api/theme")
async def save_theme_preference(req: ThemeRequest):
    print(f"[Backend] 사용자 테마 취향 저장됨: {req.theme}")
    return {"status": "success"}



BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESOURCE_DIR = os.path.join(BASE_DIR, "resource")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/resource", StaticFiles(directory=RESOURCE_DIR), name="resource")
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")

if __name__ == "__main__":
    import uvicorn
    # 도커 내부에서 실행할 때는 0.0.0.0을 수신 대기해야 합니다.
    uvicorn.run(app, host="0.0.0.0", port=8080)