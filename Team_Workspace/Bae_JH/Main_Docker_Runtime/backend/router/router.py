"""
router.py
세션과 관련된 모든 로직.

facade.py 의 각 라우트 함수가 직접 구현 대신 이 클래스를 호출합니다.
  Router.*  — 세션 생명주기, 메시지, 지도, 메모, 플래너, 파일 등 모든 세션 작업
"""

import os
import uuid
import asyncio
from datetime import date
from typing import Dict, List, Optional

from fastapi import UploadFile
from fastapi.responses import StreamingResponse, PlainTextResponse

from ..session_container import SessionContainer
from ..loader.loader import MockDBInterface


# ============================================================
# 프로세스 메모리 상태 (향후 Redis/DB 이전 예정)
# ============================================================

_active_sessions:   Dict[str, SessionContainer] = {}
_current_active_id: Optional[str] = None         # TODO: 유저별 Dict[user_id, session_id] 로 전환

# ── Plan 엔티티 (여행 계획) ──────────────────────────────────
# plan_id → { id, title, user_id, created_at }
_plan_registry:    Dict[str, dict] = {}

# session_id → plan_id  (여러 세션이 하나의 Plan을 공유할 수 있음)
_session_plan_map: Dict[str, str]  = {}

# session_id → { id, title, mode, plan_id, user_id, created_at }
_session_metadata: Dict[str, dict] = {}

# ── Plan 귀속 상태 (지도·일정·메모·여행 범위는 plan_id로 관리) ──
_plan_trip_ranges: Dict[str, List[Dict]]      = {}   # plan_id → ranges
_plan_memos:       Dict[str, Dict[str, str]]  = {}   # plan_id → {date: memo}
_plan_schedules:   Dict[str, Dict[str, List]] = {}   # plan_id → {date: items}
_plan_map_markers: Dict[str, Dict[str, Dict]] = {}   # plan_id → {marker_id: marker}


# ============================================================
# Router — 세션 로직 전담
# ============================================================

class Router:

    # ── 계획 목록 ────────────────────────────────────────────

    @staticmethod
    async def get_plan_list(user_id: str) -> list:
        return [p for p in _plan_registry.values() if p["user_id"] == user_id]

    # ── 세션 목록 / 생성 / 삭제 ─────────────────────────────

    @staticmethod
    async def get_session_list(mode: str, plan_id: Optional[str], user_id: str) -> dict:
        sessions = [
            s for s in _session_metadata.values()
            if s["user_id"] == user_id
            and s["mode"] == mode
            and (plan_id is None or s.get("plan_id") == plan_id)
        ]
        return {"sessions": sessions, "mode": mode, "user_id": user_id}

    @staticmethod
    async def create_session(first_message: str, mode: str, user_id: str,
                              plan_id: Optional[str] = None) -> dict:
        global _current_active_id

        session_id = "session_" + str(uuid.uuid4())[:8]
        title = first_message[:20] + "..." if len(first_message) > 20 else first_message
        today  = date.today().isoformat()

        # plan_id 미지정 시 새 Plan 자동 생성 (1세션:1플랜 기본값)
        if not plan_id:
            plan_id = "plan_" + str(uuid.uuid4())[:8]
            _plan_registry[plan_id] = {
                "id":         plan_id,
                "title":      title,
                "user_id":    user_id,
                "created_at": today,
            }

        _session_plan_map[session_id] = plan_id
        _session_metadata[session_id] = {
            "id":         session_id,
            "title":      title,
            "mode":       mode,
            "plan_id":    plan_id,
            "user_id":    user_id,
            "created_at": today,
        }

        container = SessionContainer(
            session_id=session_id,
            user_id=user_id,
            db_interface=MockDBInterface(),
        )
        await container.initialize_session(is_new=True)
        _active_sessions[session_id] = container
        _current_active_id = session_id

        return {
            "id":         session_id,
            "title":      title,
            "mode":       mode,
            "plan_id":    plan_id,
            "user_id":    user_id,
            "created_at": today,
        }

    @staticmethod
    async def delete_session(session_id: str, user_id: str) -> dict:
        global _current_active_id

        if session_id in _active_sessions:
            del _active_sessions[session_id]
            if _current_active_id == session_id:
                _current_active_id = None

        _session_metadata.pop(session_id, None)
        _session_plan_map.pop(session_id, None)

        print(f"[Router] {user_id}: 세션 {session_id} 삭제")
        return {"success": True, "message": f"세션 {session_id} 삭제 완료"}

    @staticmethod
    async def update_session_mode(session_id: str, mode: str, user_id: str) -> dict:
        print(f"[Router] {user_id}: 세션 {session_id} 모드 변경 → {mode}")
        return {"success": True, "mode": mode}

    @staticmethod
    async def invite_user(session_id: str, user: str, user_id: str) -> dict:
        print(f"[Router] {user_id}: 세션 {session_id} 초대 → {user}")
        return {"success": True, "user": user}

    @staticmethod
    async def share_chat(session_id: str, user_id: str) -> dict:
        return {"success": True, "share_url": f"http://localhost/share/{session_id}"}

    @staticmethod
    async def update_session_title(session_id: str, title: str, user_id: str) -> dict:
        print(f"[Router] {user_id}: 세션 {session_id} 제목 변경 → {title}")
        return {"success": True, "title": title}

    # ── 메시지 / 히스토리 / 다운로드 ────────────────────────

    @staticmethod
    async def get_chat_history(session_id: str) -> dict | list:
        if session_id in _active_sessions:
            return await _active_sessions[session_id].get_full_history()
        return {"messages": []}

    @staticmethod
    async def send_message(session_id: str, message: str, user_id: str) -> StreamingResponse:
        global _current_active_id

        if _current_active_id != session_id:
            if _current_active_id and _current_active_id in _active_sessions:
                await _active_sessions[_current_active_id].teardown()
                del _active_sessions[_current_active_id]
            _current_active_id = session_id

        if session_id not in _active_sessions:
            container = SessionContainer(
                session_id=session_id,
                user_id=user_id,
                db_interface=MockDBInterface(),
            )
            await container.initialize_session(is_new=False)
            _active_sessions[session_id] = container

        container = _active_sessions[session_id]

        async def _stream():
            response_text = await container.process_user_input(message)
            for char in response_text:
                yield char
                await asyncio.sleep(0.03)

        return StreamingResponse(_stream(), media_type="text/plain")

    @staticmethod
    async def download_chat(session_id: str) -> PlainTextResponse:
        history = []
        if session_id in _active_sessions:
            history = await _active_sessions[session_id].get_full_history()

        content = f"--- 대화 기록 ({session_id}) ---\n"
        for msg in history:
            role = "사용자" if msg.get("role") == "user" else "봇"
            content += f"[{role}]\n{msg.get('content', '')}\n\n"

        headers = {"Content-Disposition": f"attachment; filename=chat_{session_id}.txt"}
        return PlainTextResponse(content, headers=headers)

    # ── 파일 업로드 ─────────────────────────────────────────

    @staticmethod
    async def upload_files(session_id: str, files: List[UploadFile], user_id: str) -> dict:
        base    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        up_dir  = os.path.join(base, "uploads")
        os.makedirs(up_dir, exist_ok=True)

        names = []
        for file in files:
            dest = os.path.join(up_dir, file.filename)
            with open(dest, "wb+") as f:
                f.write(await file.read())
            names.append(file.filename)

        print(f"[Router] {user_id}: 세션 {session_id} 파일 업로드 {names}")
        return {"success": True, "uploaded_files": names}

    # ── 지도 마커 (plan_id 기반) ─────────────────────────────

    @staticmethod
    def _plan_id_of(session_id: str) -> str:
        """session_id → plan_id 변환. plan 없으면 session_id 그대로 fallback."""
        return _session_plan_map.get(session_id, session_id)

    @staticmethod
    async def add_map_marker(session_id: str, marker_id: str,
                              lat: float, lng: float, title: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        _plan_map_markers.setdefault(pid, {})[marker_id] = {
            "marker_id": marker_id, "lat": lat, "lng": lng, "title": title,
        }
        return {"success": True, "marker_id": marker_id}

    @staticmethod
    async def delete_map_marker(session_id: str, marker_id: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        removed = False
        if pid in _plan_map_markers and marker_id in _plan_map_markers[pid]:
            del _plan_map_markers[pid][marker_id]
            removed = True
        return {"success": True, "removed": removed}

    @staticmethod
    async def save_map_markers(session_id: str, markers: List[dict], user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        bucket = _plan_map_markers.setdefault(pid, {})
        for m in markers:
            mid = m.get("marker_id") or m.get("id")
            if mid:
                bucket[mid] = {"marker_id": mid, "lat": m.get("lat", 0),
                                "lng": m.get("lng", 0), "title": m.get("title", "")}
        return {"success": True}

    @staticmethod
    async def get_map_markers(session_id: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        return {"markers": list(_plan_map_markers.get(pid, {}).values())}

    # ── 여행 일정 (plan_id 기반) ─────────────────────────────

    @staticmethod
    async def save_trip_range(session_id: str, ranges: List[dict], user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        _plan_trip_ranges[pid] = ranges
        return {"success": True}

    @staticmethod
    async def get_trip_range(session_id: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        return {"ranges": _plan_trip_ranges.get(pid, [])}

    # ── 메모 (plan_id 기반) ──────────────────────────────────

    @staticmethod
    async def save_memo(session_id: str, date_key: str, memo: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        _plan_memos.setdefault(pid, {})[date_key] = memo
        return {"success": True}

    @staticmethod
    async def get_memo(session_id: str, date_key: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        return {"memo": _plan_memos.get(pid, {}).get(date_key, "")}

    # ── 플래너 (plan_id 기반) ────────────────────────────────

    @staticmethod
    async def save_plan(session_id: str, date_key: str, plan: List[dict], user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        _plan_schedules.setdefault(pid, {})[date_key] = plan
        return {"success": True}

    @staticmethod
    async def get_plan(session_id: str, date_key: str, user_id: str) -> dict:
        pid = Router._plan_id_of(session_id)
        return {"plan": _plan_schedules.get(pid, {}).get(date_key, [])}

    # ── 캘린더 인디케이터 (plan_id 기반) ────────────────────

    @staticmethod
    async def get_indicators(session_id: str, year: int, month: int, user_id: str) -> list:
        pid = Router._plan_id_of(session_id)
        memo_dates = _plan_memos.get(pid, {}).keys()
        plan_dates = _plan_schedules.get(pid, {}).keys()
        prefix = f"{year}-{month:02d}-"
        return [d for d in set(list(memo_dates) + list(plan_dates)) if d.startswith(prefix)]
