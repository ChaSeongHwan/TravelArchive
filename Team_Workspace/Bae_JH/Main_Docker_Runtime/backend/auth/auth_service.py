"""
Auth 서비스: 회원가입, 로그인, 게스트, 토큰 갱신, 로그아웃 비즈니스 로직
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException

from module.node.memory.postgres_manager import PostgresManager
from module.node.memory.redis_manager import RedisManager
from .jwt_utils import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from .password_utils import hash_password, verify_password

# Redis TTL 상수
TTL_GUEST = 24 * 3600  # 게스트: 24시간
TTL_MEMBER = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")) * 24 * 3600  # 회원: 7일


async def signup(postgres: PostgresManager, data: dict) -> dict:
    """
    회원가입 (자체 계정).
    data: { email, password, nickname }
    """
    email = data.get("email")
    password = data.get("password")
    nickname = data.get("nickname", "")

    if not email or not password:
        raise HTTPException(status_code=400, detail="이메일과 비밀번호는 필수입니다")

    # 1. 이메일 중복 확인
    result = await postgres.execute({
        "action": "read",
        "model": "UserProfile",
        "filters": {"email": email}
    })

    if result.get("status") == "success" and result.get("data"):
        raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다")

    # 2. user_id 생성
    user_id = "MEM:" + str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)
    print(f"[Signup] user_id={user_id}, email={email}")

    # 3. users 테이블 insert
    result = await postgres.execute({
        "action": "create",
        "model": "User",
        "data": {
            "user_id": user_id,
            "user_type": "MEM",
            "status": "active",
            "created_at": now
        }
    })
    print(f"[Signup] Step 3 (users): {result}")
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=f"users 테이블 생성 실패: {result.get('reason')}")

    # 4. user_profile 테이블 insert
    result = await postgres.execute({
        "action": "create",
        "model": "UserProfile",
        "data": {
            "user_id": user_id,
            "email": email,
            "nickname": nickname,
            "updated_at": now
        }
    })
    print(f"[Signup] Step 4 (user_profile): {result}")
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=f"user_profile 테이블 생성 실패: {result.get('reason')}")

    # 5. user_security 테이블 insert
    result = await postgres.execute({
        "action": "create",
        "model": "UserSecurity",
        "data": {
            "user_id": user_id,
            "password_hash": hash_password(password),
            "login_fail_count": 0
        }
    })
    print(f"[Signup] Step 5 (user_security): {result}")
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=f"user_security 테이블 생성 실패: {result.get('reason')}")

    # 6. user_preference 테이블 insert
    result = await postgres.execute({
        "action": "create",
        "model": "UserPreference",
        "data": {
            "user_id": user_id,
            "updated_at": now
        }
    })
    print(f"[Signup] Step 6 (user_preference): {result}")
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=f"user_preference 테이블 생성 실패: {result.get('reason')}")

    print(f"[Signup] 회원가입 완료: {user_id}")
    return {"user_id": user_id, "status": "success"}


async def login(postgres: PostgresManager, redis: RedisManager, email: str, pw: str) -> dict:
    """
    자체 계정 로그인.
    """
    # 1. 이메일로 user_id 조회
    result = await postgres.execute({
        "action": "read",
        "model": "UserProfile",
        "filters": {"email": email}
    })

    if result.get("status") != "success" or not result.get("data"):
        raise HTTPException(status_code=401, detail="존재하지 않는 계정입니다")

    profile  = result["data"][0]
    user_id  = profile["user_id"]
    nickname = profile.get("nickname", "")
    email    = profile.get("email", "")

    # 2. 보안 정보 조회
    sec_result = await postgres.execute({
        "action": "read",
        "model": "UserSecurity",
        "filters": {"user_id": user_id}
    })

    if sec_result.get("status") != "success" or not sec_result.get("data"):
        raise HTTPException(status_code=500, detail="보안 정보 조회 실패")

    sec = sec_result["data"][0]

    # 3. 계정 잠금 확인
    now = datetime.now(tz=timezone.utc)
    if sec.get("locked_until"):
        locked_until = sec["locked_until"]
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
        if locked_until > now:
            raise HTTPException(status_code=403, detail="계정이 잠겨 있습니다. 잠시 후 다시 시도하세요")

    # 4. 패스워드 검증
    if not verify_password(pw, sec["password_hash"]):
        fail_count = sec.get("login_fail_count", 0) + 1
        if fail_count >= 5:
            locked_until = now + timedelta(minutes=30)
            await postgres.execute({
                "action": "update",
                "model": "UserSecurity",
                "filters": {"user_id": user_id},
                "data": {
                    "login_fail_count": fail_count,
                    "locked_until": locked_until
                }
            })
            raise HTTPException(status_code=403, detail="로그인 5회 실패. 계정이 30분간 잠겼습니다")
        await postgres.execute({
            "action": "update",
            "model": "UserSecurity",
            "filters": {"user_id": user_id},
            "data": {"login_fail_count": fail_count}
        })
        raise HTTPException(status_code=401, detail="비밀번호가 일치하지 않습니다")

    # 5. 로그인 성공 갱신
    await postgres.execute({
        "action": "update",
        "model": "UserSecurity",
        "filters": {"user_id": user_id},
        "data": {
            "last_login_at": now,
            "login_fail_count": 0
        }
    })

    # 6. 이중키 토큰 발급
    access_token = create_access_token(user_id)
    refresh_token, jti = create_refresh_token(user_id)  # 7일 TTL

    # 7. Redis에 Refresh Token 저장 (auth:refresh:{jti} → user_id, TTL: 7일)
    await redis.execute({
        "action": "set",
        "key": f"auth:refresh:{jti}",
        "value": user_id,
        "ttl": TTL_MEMBER
    })

    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "user_id":       user_id,
        "type":          "MEM",
        "nickname":      nickname,
        "email":         email,
        "status":        "success",
    }


async def guest_login(redis: RedisManager) -> dict:
    """
    게스트 로그인.
    """
    guest_uuid = str(uuid.uuid4())
    user_id = "GST:" + guest_uuid

    # 이중키 토큰 발급 (Refresh TTL = 24h)
    access_token = create_access_token(user_id)
    refresh_token, jti = create_refresh_token(user_id, ttl_seconds=TTL_GUEST)

    # Redis에 게스트 세션 및 Refresh Token 저장 (TTL: 24시간)
    await redis.execute({
        "action": "hset",
        "key": f"user:{user_id}",
        "mapping": {"uuid": guest_uuid, "created_at": datetime.now(tz=timezone.utc).isoformat()},
        "ttl": TTL_GUEST
    })
    await redis.execute({
        "action": "set",
        "key": f"auth:refresh:{jti}",
        "value": user_id,
        "ttl": TTL_GUEST
    })

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": user_id,
        "type": "GST",
        "status": "success",
    }


async def refresh_token_service(redis: RedisManager, refresh_token: str) -> dict:
    """
    토큰 갱신.
    Refresh Token의 JTI가 Redis에 존재하는지 확인 후 새 Access Token 발급.
    """
    payload = verify_refresh_token(refresh_token)
    user_id = payload["sub"]
    jti = payload["jti"]

    # Redis에서 토큰 유효성 확인 (로그아웃된 토큰 차단)
    result = await redis.execute({
        "action": "get",
        "key": f"auth:refresh:{jti}"
    })
    if result.get("status") != "success" or result.get("value") is None:
        raise HTTPException(status_code=401, detail="만료되었거나 로그아웃된 토큰입니다")

    # 새 Access Token 발급
    new_access_token = create_access_token(user_id)

    return {"access_token": new_access_token, "status": "success"}


async def logout(redis: RedisManager, refresh_token: str) -> None:
    """
    로그아웃: Redis에서 Refresh Token JTI 삭제 → 이후 토큰 갱신 차단.
    이미 만료된 토큰이어도 로그아웃은 성공 처리.
    """
    try:
        payload = verify_refresh_token(refresh_token)
        jti = payload.get("jti")
        if jti:
            await redis.execute({
                "action": "delete",
                "key": f"auth:refresh:{jti}"
            })
    except HTTPException:
        # 만료/잘못된 토큰도 로그아웃 성공으로 처리
        pass
