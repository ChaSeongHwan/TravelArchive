"""
facade.py
TravelArchive 백엔드 진입점 — 프론트엔드와의 연결만 담당.

@app 라우트를 모두 정의하되 함수 본문은 두 클래스에 위임합니다.
  Loader  (backend/loader/)  — DB 접근이 필요한 모든 작업
  Router  (backend/router/)  — 세션·채팅·지도·메모·플래너 작업
"""

import os
import sys
import random
from typing import Dict, List, Optional
from datetime import date
from dotenv import load_dotenv

# ── 경로 설정 ────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

load_dotenv(os.path.join(BASE_DIR, "setting", ".env"))

# ── FastAPI / Pydantic ───────────────────────────────────────
from fastapi import FastAPI, Request, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── 내부 모듈 ────────────────────────────────────────────────
from .loader.loader import Loader
from .router.router import Router
from .auth.dependencies import get_current_user, get_optional_user


# ============================================================
# FastAPI 앱
# ============================================================

app = FastAPI(title="TravelArchive API", lifespan=Loader.lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Pydantic 요청 모델 (API 계약 정의 — facade 책임)
# ============================================================

class SignUpRequest(BaseModel):
    email: str
    password: str
    nickname: str = ""

class LoginRequest(BaseModel):
    id: str
    pw: str

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

class SessionCreateRequest(BaseModel):
    first_message: str
    mode: str = "personal"
    plan_id: Optional[str] = None

class SessionModeUpdateRequest(BaseModel):
    mode: str

class InviteRequest(BaseModel):
    user: str

class TitleUpdateRequest(BaseModel):
    title: str

class MessageRequest(BaseModel):
    message: str

class ThemeRequest(BaseModel):
    theme: str

class MapMarkersRequest(BaseModel):
    markers: List[Dict]

class MapMarkerAddRequest(BaseModel):
    marker_id: str
    lat: float
    lng: float
    title: Optional[str] = None

class MemoRequest(BaseModel):
    memo: str

class PlanRequest(BaseModel):
    plan: List[Dict]

class TripRangeRequest(BaseModel):
    ranges: List[Dict]

class UserProfileRequest(BaseModel):
    nickname: Optional[str] = None
    bio: Optional[str] = None
    email1: Optional[str] = None
    extra_contacts: Optional[List[str]] = None

class UserStyleRequest(BaseModel):
    characteristics: Optional[List[str]] = None
    emoji_usage: Optional[str] = None
    header_usage: Optional[str] = None
    custom_instructions: Optional[str] = None
    additional_info: Optional[str] = None

class UserTravelRequest(BaseModel):
    styles: Optional[List[str]] = None
    pace: Optional[str] = None
    accommodations: Optional[List[str]] = None
    food_prefs: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    max_distance: Optional[int] = None
    distance_unit: Optional[str] = None
    weather_crowd: Optional[bool] = None
    pet_friendly: Optional[bool] = None
    disabilities: Optional[List[str]] = None
    disability_other: Optional[str] = None


# ============================================================
# 인증 API  →  Loader
# ============================================================

@app.post("/api/auth/signup")
async def signup(req: SignUpRequest, request: Request):
    return await Loader.signup(request.app.state.postgres,
                               {"email": req.email, "password": req.password, "nickname": req.nickname})

@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request):
    return await Loader.login(request.app.state.postgres, request.app.state.redis, req.id, req.pw)

@app.post("/api/auth/guest")
async def guest_login(request: Request):
    return await Loader.guest_login(request.app.state.redis)

@app.post("/api/auth/refresh")
async def refresh(req: RefreshRequest, request: Request):
    return await Loader.refresh_token(request.app.state.redis, req.refresh_token)

@app.post("/api/auth/logout")
async def logout(req: LogoutRequest, request: Request):
    await Loader.logout(request.app.state.redis, req.refresh_token)
    return {"status": "success", "message": "로그아웃 되었습니다"}

@app.post("/api/auth/logout/all")
async def logout_all_devices(req: LogoutRequest, request: Request,
                              user_id: str = Depends(get_current_user)):
    # TODO: 해당 user_id의 모든 refresh token 무효화
    await Loader.logout(request.app.state.redis, req.refresh_token)
    print(f"[Facade] {user_id} 전체 기기 로그아웃 (mock: 현재 토큰만 삭제)")
    return {"status": "success", "message": "모든 기기에서 로그아웃되었습니다"}

@app.post("/api/auth/social/{provider}")
async def social_login(provider: str):
    return {"status": "not_implemented", "provider": provider}

@app.post("/api/auth/find")
async def find_account():
    return {"status": "not_implemented"}

@app.post("/api/auth/social/link/{provider}")
async def link_social_account(provider: str, user_id: str = Depends(get_current_user)):
    # TODO: OAuth 플로우 연동
    print(f"[Facade] {user_id} SNS 연동 요청: {provider}")
    return {"status": "not_implemented", "message": f"{provider} 연동은 준비 중입니다."}

@app.get("/api/auth/me")
async def get_my_info(request: Request, user_id: str = Depends(get_current_user)):
    return await Loader.get_my_info(request.app.state.postgres, user_id)


# ============================================================
# 계정 / 설정 / 컨텍스트 / 날씨 / 도움말  →  Loader (또는 정적)
# ============================================================

@app.get("/api/account")
async def get_account_info(request: Request, user_id: str = Depends(get_optional_user)):
    return await Loader.get_account_info(request.app.state.postgres, user_id)

@app.put("/api/user/profile")
async def save_user_profile(req: UserProfileRequest,
                             user_id: str = Depends(get_current_user)):
    # TODO: DB에 프로필 저장
    print(f"[Facade] {user_id} 프로필 저장: {req.model_dump(exclude_none=True)}")
    return {"status": "success"}

@app.put("/api/user/style")
async def save_user_style(req: UserStyleRequest,
                           user_id: str = Depends(get_current_user)):
    # TODO: DB에 AI 스타일 저장
    print(f"[Facade] {user_id} AI 스타일 저장: {req.model_dump(exclude_none=True)}")
    return {"status": "success"}

@app.put("/api/user/travel")
async def save_travel_preferences(req: UserTravelRequest,
                                   user_id: str = Depends(get_current_user)):
    # TODO: DB에 여행 스타일 저장
    print(f"[Facade] {user_id} 여행 스타일 저장: {req.model_dump(exclude_none=True)}")
    return {"status": "success"}

@app.delete("/api/user/account")
async def delete_account(request: Request, user_id: str = Depends(get_current_user)):
    # TODO: DB에서 계정 및 관련 데이터 전체 삭제
    print(f"[Facade] {user_id} 계정 삭제 요청 (mock)")
    return {"status": "success", "message": "계정이 삭제되었습니다"}


@app.get("/api/context")
async def get_app_context():
    return {
        "today": date.today().isoformat(),
        "settings": {
            "appGlassOpacity":         "20",
            "leftSidebarCustomWidth":   300,
            "rightSidebarCustomWidth":  300,
            "theme":                   "default",
        },
    }

@app.get("/api/settings")
async def get_settings(user_id: str = Depends(get_optional_user)):
    return await Loader.get_settings(user_id)

@app.post("/api/settings/update")
async def update_settings(settings: Dict[str, str], user_id: str = Depends(get_optional_user)):
    return await Loader.update_settings(user_id, settings)

@app.get("/api/help")
async def get_help_data():
    return {"status": "success", "data": "도움말 가이드라인 페이지입니다."}

@app.post("/api/theme")
async def save_theme_preference(req: ThemeRequest, user_id: str = Depends(get_optional_user)):
    print(f"[Facade] {user_id} 테마 저장: {req.theme}")
    return {"status": "success"}

@app.get("/api/weather")
async def get_weather():
    selected = random.choice(["clear", "cloudy", "rain", "night"])
    return {
        "type": selected,
        "params": {
            "intensity":     round(random.uniform(0.2, 1.5), 2),
            "windDirection": round(random.uniform(-1.0, 1.0), 2),
            "cloudDensity":  random.randint(3, 10),
            "starDensity":   random.randint(100, 300),
        },
    }


# ============================================================
# 계획 API  →  Router
# ============================================================

@app.get("/api/plans")
async def get_plan_list(user_id: str = Depends(get_current_user)):
    return await Router.get_plan_list(user_id)


# ============================================================
# 세션 관리 API  →  Router
# ============================================================

@app.get("/api/sessions")
async def get_session_list(mode: str = "personal", plan_id: Optional[str] = None,
                            user_id: str = Depends(get_current_user)):
    return await Router.get_session_list(mode, plan_id, user_id)

@app.post("/api/sessions")
async def create_session(req: SessionCreateRequest, user_id: str = Depends(get_current_user)):
    return await Router.create_session(req.first_message, req.mode, user_id, req.plan_id)

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
    return await Router.delete_session(session_id, user_id)

@app.put("/api/sessions/{session_id}/mode")
async def update_session_mode(session_id: str, req: SessionModeUpdateRequest,
                               user_id: str = Depends(get_current_user)):
    return await Router.update_session_mode(session_id, req.mode, user_id)

@app.post("/api/sessions/{session_id}/invite")
async def invite_user(session_id: str, req: InviteRequest,
                      user_id: str = Depends(get_current_user)):
    return await Router.invite_user(session_id, req.user, user_id)

@app.post("/api/sessions/{session_id}/share")
async def share_chat(session_id: str, user_id: str = Depends(get_current_user)):
    return await Router.share_chat(session_id, user_id)

@app.put("/api/sessions/{session_id}/title")
async def update_session_title(session_id: str, req: TitleUpdateRequest,
                                user_id: str = Depends(get_current_user)):
    return await Router.update_session_title(session_id, req.title, user_id)


# ============================================================
# 메시지 API  →  Router
# ============================================================

@app.get("/api/sessions/{session_id}/history")
async def get_chat_history(session_id: str, user_id: str = Depends(get_current_user)):
    return await Router.get_chat_history(session_id)

@app.post("/api/sessions/{session_id}/message")
async def send_message(session_id: str, req: MessageRequest,
                       user_id: str = Depends(get_current_user)):
    return await Router.send_message(session_id, req.message, user_id)

@app.get("/api/sessions/{session_id}/download")
async def download_chat(session_id: str, user_id: str = Depends(get_current_user)):
    return await Router.download_chat(session_id)


# ============================================================
# 파일 업로드  →  Router
# ============================================================

@app.post("/api/sessions/{session_id}/files")
async def upload_files(session_id: str, files: List[UploadFile] = File(...),
                       user_id: str = Depends(get_current_user)):
    return await Router.upload_files(session_id, files, user_id)


# ============================================================
# 지도 API  →  Router
# ============================================================

@app.post("/api/sessions/{session_id}/map/markers/add")
async def add_map_marker(session_id: str, req: MapMarkerAddRequest,
                          user_id: str = Depends(get_current_user)):
    return await Router.add_map_marker(session_id, req.marker_id, req.lat, req.lng,
                                        req.title or "", user_id)

@app.delete("/api/sessions/{session_id}/map/markers/{marker_id}")
async def delete_map_marker(session_id: str, marker_id: str,
                             user_id: str = Depends(get_current_user)):
    return await Router.delete_map_marker(session_id, marker_id, user_id)

@app.post("/api/sessions/{session_id}/map/markers")
async def save_map_markers(session_id: str, req: MapMarkersRequest,
                            user_id: str = Depends(get_current_user)):
    return await Router.save_map_markers(session_id, req.markers, user_id)

@app.get("/api/sessions/{session_id}/map/markers")
async def get_map_markers(session_id: str, user_id: str = Depends(get_current_user)):
    return await Router.get_map_markers(session_id, user_id)


# ============================================================
# 여행 일정 API  →  Router
# ============================================================

@app.put("/api/sessions/{session_id}/trip_range")
async def save_trip_range(session_id: str, req: TripRangeRequest,
                           user_id: str = Depends(get_current_user)):
    return await Router.save_trip_range(session_id, req.ranges, user_id)

@app.get("/api/sessions/{session_id}/trip_range")
async def get_trip_range(session_id: str, user_id: str = Depends(get_current_user)):
    return await Router.get_trip_range(session_id, user_id)


# ============================================================
# 메모 / 플래너 API  →  Router
# ============================================================

@app.put("/api/sessions/{session_id}/memo")
async def save_memo(session_id: str, date: str, req: MemoRequest,
                    user_id: str = Depends(get_current_user)):
    return await Router.save_memo(session_id, date, req.memo, user_id)

@app.get("/api/sessions/{session_id}/memo")
async def get_memo(session_id: str, date: str, user_id: str = Depends(get_current_user)):
    return await Router.get_memo(session_id, date, user_id)

@app.put("/api/sessions/{session_id}/plan")
async def save_plan(session_id: str, date: str, req: PlanRequest,
                    user_id: str = Depends(get_current_user)):
    return await Router.save_plan(session_id, date, req.plan, user_id)

@app.get("/api/sessions/{session_id}/plan")
async def get_plan(session_id: str, date: str, user_id: str = Depends(get_current_user)):
    return await Router.get_plan(session_id, date, user_id)

@app.get("/api/sessions/{session_id}/indicators")
async def get_indicators(session_id: str, year: int, month: int,
                          user_id: str = Depends(get_current_user)):
    return await Router.get_indicators(session_id, year, month, user_id)


# ============================================================
# 정적 파일 / 뷰 라우터
# ============================================================

RESOURCE_DIR = os.path.join(BASE_DIR, "resource")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/resource", StaticFiles(directory=RESOURCE_DIR), name="resource")
app.mount("/",         StaticFiles(directory=FRONTEND_DIR), name="frontend")
