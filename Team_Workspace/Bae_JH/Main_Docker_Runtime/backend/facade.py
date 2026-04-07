import os
import sys
import random
import asyncio
import uuid
from typing import List, Dict, Optional
from dotenv import load_dotenv

# ==========================================
# 기본 경로 및 업로드/다운로드 폴더 설정 (요청 3, 4 반영)
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

# 파일이 저장될 폴더 및 다운로드 기록이 저장될 폴더를 최상단 변수로 뺌
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")

# 폴더가 없으면 자동 생성
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

load_dotenv(os.path.join(BASE_DIR, "setting", ".env"))

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, PlainTextResponse
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .test_agent import TestNode
from .session_container import SessionContainer

app = FastAPI(title="Chatbot Middle-end API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 전역 상태 관리 (인메모리 세션 컨테이너)
# ==========================================
active_sessions: Dict[str, SessionContainer] = {}
current_active_session_id: Optional[str] = None

# ==========================================
# Pydantic 데이터 모델
# ==========================================
class SessionCreateRequest(BaseModel):
    first_message: str
    mode: str = "personal"

class MessageRequest(BaseModel):
    message: str

class ThemeRequest(BaseModel):
    theme: str

class TitleUpdateRequest(BaseModel):
    title: str

class LoginRequest(BaseModel):
    id: str
    pw: str

class SignUpRequest(BaseModel):
    username: str
    email: str
    password: str

class SessionModeUpdateRequest(BaseModel):
    mode: str

class InviteRequest(BaseModel):
    user: str

class MapMarkersRequest(BaseModel):
    markers: List[Dict]

class MemoRequest(BaseModel):
    memo: str

class PlanRequest(BaseModel):
    plan: List[Dict]

# ==========================================
# API 라우터
# ==========================================

# --- 인증 API (Auth) ---
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    return {"status": "success", "user": {"id": req.id, "name": "Test User"}}

@app.post("/api/auth/guest")
async def guest_login():
    return {"status": "success", "user": {"id": "guest", "name": "Guest"}}

@app.post("/api/auth/social/{provider}")
async def social_login(provider: str):
    return {"status": "success", "redirect": f"/auth/{provider}"}

@app.post("/api/auth/signup")
async def signup(req: SignUpRequest):
    return {"status": "success", "message": "Sign up completed"}

@app.post("/api/auth/find")
async def find_account():
    return {"status": "success", "message": "Find account link sent"}

# --- 컨텍스트 및 설정 ---
@app.get("/api/context")
async def get_app_context():
    from datetime import date
    return {
        "today": date.today().isoformat(),
        "settings": {
            "appGlassOpacity": "20",
            "leftSidebarCustomWidth": 300,
            "rightSidebarCustomWidth": 300,
            "theme": "default"
        }
    }

@app.post("/api/settings/update")
async def update_settings(settings: Dict[str, str]):
    print(f"[Backend] 설정 업데이트 수신: {settings}")
    return {"status": "success"}

# --- 세션 관리 ---
@app.get("/api/sessions")
async def get_session_list(mode: str = "personal"):
    """과거 세션 목록 데이터를 요청합니다. (mode 파라미터 지원)"""
    return await mock_db_get_session_list()

@app.post("/api/sessions")
async def create_session(req: SessionCreateRequest):
    """새 세션 생성 요청을 처리합니다. (mode 지원)"""
    global current_active_session_id
    
    if current_active_session_id and current_active_session_id in active_sessions:
        await active_sessions[current_active_session_id].teardown()
        del active_sessions[current_active_session_id]
        
    new_session_data = await mock_db_create_session(req.first_message)
    new_id = new_session_data["id"]
    
    new_container = SessionContainer(
        session_id=new_id, 
        user_id="default_user", 
        db_interface=MockDBInterface()
    )
    await new_container.initialize_session(is_new=True)
    
    active_sessions[new_id] = new_container
    current_active_session_id = new_id
    
    return new_session_data

@app.put("/api/sessions/{session_id}/mode")
async def update_session_mode(session_id: str, req: SessionModeUpdateRequest):
    print(f"[Backend] 세션 {session_id} 모드 변경: {req.mode}")
    return {"success": True, "mode": req.mode}

@app.post("/api/sessions/{session_id}/invite")
async def invite_user(session_id: str, req: InviteRequest):
    print(f"[Backend] 세션 {session_id} 유저 초대: {req.user}")
    return {"success": True, "user": req.user}

@app.post("/api/sessions/{session_id}/share")
async def share_chat(session_id: str):
    return {"success": True, "share_url": f"http://localhost/share/{session_id}"}

# --- 지도 및 캘린더/플래너 ---
@app.post("/api/sessions/{session_id}/map/markers")
async def save_map_markers(session_id: str, req: MapMarkersRequest):
    return {"success": True}

@app.get("/api/sessions/{session_id}/map/markers")
async def get_map_markers(session_id: str):
    return {"markers": []}

@app.put("/api/sessions/{session_id}/memo")
async def save_memo(session_id: str, date: str, req: MemoRequest):
    return {"success": True}

@app.get("/api/sessions/{session_id}/memo")
async def get_memo(session_id: str, date: str):
    return {"memo": ""}

@app.put("/api/sessions/{session_id}/plan")
async def save_plan(session_id: str, date: str, req: PlanRequest):
    return {"success": True}

@app.get("/api/sessions/{session_id}/plan")
async def get_plan(session_id: str, date: str):
    return {"plan": []}

@app.get("/api/sessions/{session_id}/indicators")
async def get_indicators(session_id: str, year: int, month: int):
    return []

@app.get("/api/sessions/{session_id}/history")
async def get_chat_history(session_id: str):
    """지정된 세션의 과거 대화 내역을 조회합니다."""
    if session_id in active_sessions:
        return await active_sessions[session_id].get_full_history()
    
    return await mock_db_get_chat_history(session_id)

@app.post("/api/sessions/{session_id}/message")
async def send_message(session_id: str, req: MessageRequest):
    """메시지를 수신하고 컨테이너 파이프라인을 거쳐 결과를 스트리밍합니다."""
    global current_active_session_id
    
    if current_active_session_id != session_id:
        if current_active_session_id and current_active_session_id in active_sessions:
            await active_sessions[current_active_session_id].teardown()
            del active_sessions[current_active_session_id]
            
        if session_id not in active_sessions:
            new_container = SessionContainer(
                session_id=session_id, 
                user_id="default_user", 
                db_interface=MockDBInterface()
            )
            await new_container.initialize_session(is_new=False)
            active_sessions[session_id] = new_container
            
        current_active_session_id = session_id
        
    container = active_sessions[session_id]

    async def response_generator():
        response_text = await container.process_user_input(req.message)
        for char in response_text:
            yield char
            await asyncio.sleep(0.03)

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

@app.get("/api/weather")
async def get_weather():
    weather_types = ['clear', 'cloudy', 'rain', 'night']
    selected_weather = random.choice(weather_types)
    
    return {
        "type": selected_weather,
        "params": {
            "intensity": round(random.uniform(0.2, 1.5), 2),
            "windDirection": round(random.uniform(-1.0, 1.0), 2),
            "cloudDensity": random.randint(3, 10),
            "starDensity": random.randint(100, 300)
        }
    }

# ==========================================
# 신규 프론트엔드 연동 API (이름 변경, 다운로드, 파일업로드)
# ==========================================

@app.put("/api/sessions/{session_id}/title")
async def update_session_title(session_id: str, req: TitleUpdateRequest):
    """세션 이름 변경 API (요청 1 반영: 수동 변경 플래그 활성화)"""
    print(f"[Backend] 세션 {session_id} 수동 이름 변경: {req.title}")
    
    for s in mock_sessions_db:
        if s["id"] == session_id:
            s["title"] = req.title
            break
            
    if session_id in mock_session_meta_db:
        mock_session_meta_db[session_id]["name"] = req.title
        # 수동 변경 플래그 True로 갱신
        mock_session_meta_db[session_id]["is_manual_title"] = True
        
    # 현재 활성화된 세션 컨테이너가 있다면 내부 상태도 즉시 동기화
    if session_id in active_sessions:
        active_sessions[session_id].session_name = req.title
        active_sessions[session_id].is_manual_title = True
        
    return {"success": True, "title": req.title}

@app.get("/api/sessions/{session_id}/download")
async def download_chat(session_id: str):
    """채팅 내용 다운로드 API (요청 4 반영: 주제와 대화 전체를 txt로)"""
    print(f"[Backend] 세션 {session_id} 다운로드 요청")
    
    topic = "주제 없음"
    history = []
    
    if session_id in active_sessions:
        history = await active_sessions[session_id].get_full_history()
        topic = active_sessions[session_id].session_topic
    else:
        history = await mock_db_get_chat_history(session_id)
        meta = mock_session_meta_db.get(session_id, {})
        topic = meta.get("topic", "주제 없음")
        
    # 다운로드할 텍스트 파일 포맷팅 구성
    content = f"--- 대화 기록 ({session_id}) ---\n"
    content += f"세션 주제: {topic}\n\n"
    for msg in history:
        role = "사용자" if msg["role"] == "user" else "봇"
        content += f"[{role}]\n{msg['content']}\n\n"
        
    # 지정한 EXPORT_DIR 폴더에 파일 저장 복사본 생성 (선택적)
    export_file_path = os.path.join(EXPORT_DIR, f"chat_{session_id}.txt")
    with open(export_file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    headers = {
        "Content-Disposition": f"attachment; filename=chat_{session_id}.txt"
    }
    return PlainTextResponse(content, headers=headers)

@app.post("/api/sessions/{session_id}/files")
async def upload_files(session_id: str, files: List[UploadFile] = File(...)):
    """파일 업로드 API"""
    file_names = []
    for file in files:
        # 실제 서버의 UPLOAD_DIR 폴더에 파일 저장
        file_location = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_location, "wb+") as file_object:
            file_object.write(await file.read())
        file_names.append(file.filename)
        
    print(f"[Backend] 세션 {session_id} 파일 업로드 수신 및 저장 완료:", file_names)
    
    upload_msg = f"파일 첨부 완료: {', '.join(file_names)}"
    
    if session_id in active_sessions:
        # 수정된 부분: db_interface -> db
        await active_sessions[session_id].db.append_messages(
            session_id, [{"role": "user", "content": f"[파일업로드] {upload_msg}"}]
        )
    else:
        if session_id not in mock_chat_history_db:
            mock_chat_history_db[session_id] = []
        mock_chat_history_db[session_id].append({"role": "user", "content": f"[파일업로드] {upload_msg}"})
        
    return {"success": True, "uploaded_files": file_names}

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """대화 세션 삭제 API (Mock DB 및 메모리에서 완전 삭제)"""
    global current_active_session_id
    print(f"[Backend] 세션 {session_id} 삭제 요청 수신")
    
    # 1. 활성화된 세션이 있다면 메모리에서 즉시 해제 (DB 덮어쓰기 방지를 위해 teardown 생략)
    if session_id in active_sessions:
        del active_sessions[session_id]
        # 삭제된 세션이 현재 화면에 띄워져 있던 세션이라면 활성 포인터 초기화
        if current_active_session_id == session_id:
            current_active_session_id = None

    # 2. 사이드바 목록 DB에서 제거
    global mock_sessions_db
    mock_sessions_db = [s for s in mock_sessions_db if s["id"] != session_id]

    # 3. 대화 내역 DB에서 제거
    if session_id in mock_chat_history_db:
        del mock_chat_history_db[session_id]

    # 4. 세션 메타데이터 DB에서 제거
    if session_id in mock_session_meta_db:
        del mock_session_meta_db[session_id]

    return {"success": True, "message": f"세션 {session_id} 삭제 완료"}


# ==========================================
# Static Files & 뷰 라우터
# ==========================================

RESOURCE_DIR = os.path.join(BASE_DIR, "resource")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/resource", StaticFiles(directory=RESOURCE_DIR), name="resource")
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")


# ==========================================
# Mock DB Storage & Interface (데이터베이스 목업)
# ==========================================

mock_sessions_db = [
    {"id": "session_1", "title": "오사카 3박 4일 일정"},
    {"id": "session_2", "title": "제주도 여행 코스"}
]

mock_chat_history_db: Dict[str, List[Dict[str, str]]] = {
    "session_1": [{"role": "user", "content": "오사카 일정 짜줘"}, {"role": "bot", "content": "네, 오사카 3박 4일 일정을 안내해 드릴게요."}],
    "session_2": [{"role": "user", "content": "제주도 여행 코스 추천해줘"}, {"role": "bot", "content": "제주도 여행 코스를 추천해 드립니다."}]
}

# DB 메타데이터에 수동 변경 플래그(is_manual_title) 필드 추가
mock_session_meta_db: Dict[str, Dict[str, any]] = {
    "session_1": {"topic": "오사카 여행", "name": "오사카 3박 4일 일정", "context": "", "is_manual_title": False},
    "session_2": {"topic": "제주도 여행", "name": "제주도 여행 코스", "context": "", "is_manual_title": False}
}

async def mock_db_get_session_list() -> List[dict]:
    return mock_sessions_db

async def mock_db_create_session(first_message: str) -> dict:
    new_id = f"session_{uuid.uuid4().hex[:9]}"
    title = first_message[:20] + "..." if len(first_message) > 20 else first_message
    
    new_session = {"id": new_id, "title": title}
    mock_sessions_db.insert(0, new_session) 
    
    mock_chat_history_db[new_id] = []
    mock_session_meta_db[new_id] = {"topic": "새로운 주제", "name": title, "context": "", "is_manual_title": False}
    
    return new_session

async def mock_db_get_chat_history(session_id: str) -> List[dict]:
    return mock_chat_history_db.get(session_id, [])

class MockDBInterface:
    async def load_personalization(self, user_id: str) -> str:
        await asyncio.sleep(0.05)
        return "사용자는 조용한 장소와 자연 경관을 선호합니다."

    async def load_session_data(self, session_id: str) -> dict:
        await asyncio.sleep(0.05)
        return mock_session_meta_db.get(session_id, {})

    async def append_messages(self, session_id: str, messages: List[dict]):
        await asyncio.sleep(0.05)
        if session_id not in mock_chat_history_db:
            mock_chat_history_db[session_id] = []
        mock_chat_history_db[session_id].extend(messages)

    # 파라미터에 is_manual_title 추가
    async def save_session_state(self, session_id: str, topic: str, name: str, context: str, is_manual_title: bool):
        await asyncio.sleep(0.05)
        if session_id in mock_session_meta_db:
            mock_session_meta_db[session_id]["topic"] = topic
            mock_session_meta_db[session_id]["name"] = name
            mock_session_meta_db[session_id]["context"] = context
            mock_session_meta_db[session_id]["is_manual_title"] = is_manual_title

            for s in mock_sessions_db:
                if s["id"] == session_id:
                    s["title"] = name
                    break

    async def get_chat_history(self, session_id: str) -> List[dict]:
        await asyncio.sleep(0.05)
        return mock_chat_history_db.get(session_id, [])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)