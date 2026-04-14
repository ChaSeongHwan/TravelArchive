"""
loader.py
DB와 관련된 모든 로직.

facade.py 의 각 라우트 함수가 직접 구현 대신 이 클래스를 호출합니다.
  Loader.lifespan   — FastAPI lifespan (DB 초기화/정리)
  Loader.*          — 인증·계정·설정 등 DB 접근이 필요한 모든 작업
  MockDBInterface   — SessionContainer 용 임시 DB (향후 실제 구현으로 교체)
"""

import asyncio
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException


# ============================================================
# MockDBInterface — SessionContainer 주입용 (Router 에서 사용)
# ============================================================

class MockDBInterface:
    async def load_personalization(self, user_id: str) -> str:
        await asyncio.sleep(0.05)
        return "사용자는 조용한 장소와 자연 경관을 선호합니다."

    async def load_session_data(self, session_id: str) -> dict:
        await asyncio.sleep(0.05)
        return {}

    async def append_messages(self, session_id: str, messages: List[dict]):
        await asyncio.sleep(0.05)

    async def save_session_state(
        self, session_id: str, topic: str, name: str,
        context: str, is_manual_title: bool
    ):
        await asyncio.sleep(0.05)

    async def get_chat_history(self, session_id: str) -> List[dict]:
        await asyncio.sleep(0.05)
        return []


# ============================================================
# Loader — DB 로직 전담
# ============================================================

class Loader:

    # ── 앱 수명 주기 ────────────────────────────────────────

    @staticmethod
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """PostgreSQL + Redis 초기화 → app.state 주입 → 종료 시 정리."""
        from module.node.memory.postgres_manager import PostgresManager
        from module.node.memory.redis_manager import RedisManager
        from module.node.memory.postgres_tables import (
            User, UserProfile, UserSecurity,
            UserOAuth, UserPreference, Base,
        )

        postgres = PostgresManager()
        redis    = RedisManager()

        for name, model in [
            ("User",           User),
            ("UserProfile",    UserProfile),
            ("UserSecurity",   UserSecurity),
            ("UserOAuth",      UserOAuth),
            ("UserPreference", UserPreference),
        ]:
            postgres.register_model(name, model)

        postgres.create_tables(Base.metadata)

        app.state.postgres = postgres
        app.state.redis    = redis
        print("[Loader] PostgreSQL & Redis 초기화 완료")
        yield
        print("[Loader] 앱 종료 중...")

    # ── 인증 ────────────────────────────────────────────────

    @staticmethod
    async def signup(postgres, data: dict):
        from ..auth import auth_service
        return await auth_service.signup(postgres, data)

    @staticmethod
    async def login(postgres, redis, user_id: str, password: str):
        from ..auth import auth_service
        return await auth_service.login(postgres, redis, user_id, password)

    @staticmethod
    async def guest_login(redis):
        from ..auth import auth_service
        return await auth_service.guest_login(redis)

    @staticmethod
    async def refresh_token(redis, refresh_token: str):
        from ..auth import auth_service
        return await auth_service.refresh_token_service(redis, refresh_token)

    @staticmethod
    async def logout(redis, refresh_token: str):
        from ..auth import auth_service
        await auth_service.logout(redis, refresh_token)

    # ── 사용자 정보 ─────────────────────────────────────────

    @staticmethod
    async def get_my_info(postgres, user_id: str) -> dict:
        user_type = user_id.split(":")[0]

        if user_type == "GST":
            return {"status": "success", "user_id": user_id,
                    "user_type": "GST", "nickname": "게스트", "email": None}

        result = await postgres.execute({
            "action": "read", "model": "UserProfile",
            "filters": {"user_id": user_id},
        })
        if result.get("status") == "success" and result.get("data"):
            p = result["data"][0]
            return {"status": "success", "user_id": user_id, "user_type": user_type,
                    "nickname": p.get("nickname", ""), "email": p.get("email", "")}

        raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다")

    @staticmethod
    async def get_account_info(postgres, user_id: str | None) -> dict:
        if not user_id:
            return {"status": "guest", "user_id": None, "user_type": None}

        user_type = user_id.split(":")[0]

        if user_type == "GST":
            return {"status": "success", "user_id": user_id,
                    "user_type": "GST", "nickname": "게스트", "email": None}

        result = await postgres.execute({
            "action": "read", "model": "UserProfile",
            "filters": {"user_id": user_id},
        })
        if result.get("status") == "success" and result.get("data"):
            p = result["data"][0]
            return {"status": "success", "user_id": user_id, "user_type": user_type,
                    "nickname": p.get("nickname", ""), "email": p.get("email", "")}

        return {"status": "success", "user_id": user_id, "user_type": user_type}

    # ── 설정 ────────────────────────────────────────────────

    @staticmethod
    async def get_settings(user_id: str | None) -> dict:
        # TODO: DB에서 사용자 설정 조회
        return {"status": "success", "data": "설정 페이지입니다."}

    @staticmethod
    async def update_settings(user_id: str | None, settings: dict) -> dict:
        print(f"[Loader] {user_id} 설정 업데이트: {settings}")
        # TODO: DB에 저장
        return {"status": "success"}
