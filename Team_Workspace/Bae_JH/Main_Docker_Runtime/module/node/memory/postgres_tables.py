from sqlalchemy import (
    Boolean, Column, ForeignKey, Integer,
    String, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class User(Base):
    """루트 식별자. 모든 사용자 테이블의 기준점."""
    __tablename__ = "users"

    user_id    = Column(String(40), primary_key=True)          # MEM:uuid, GST:uuid, KKO:hash 등
    user_type  = Column(String(3),  nullable=False)            # MEM / KKO / NVR / GGL
    status     = Column(String(10), nullable=False, default="active")  # active / inactive / banned
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class UserProfile(Base):
    """개인정보 — 이메일, 이름, 닉네임 등."""
    __tablename__ = "user_profile"

    user_id         = Column(String(40), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    email           = Column(String(255), unique=True, nullable=True)
    phone           = Column(String(20),  nullable=True)
    name            = Column(String(50),  nullable=True)
    nickname        = Column(String(50),  nullable=True)
    profile_img_url = Column(Text,        nullable=True)
    updated_at      = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class UserSecurity(Base):
    """보안정보 — 패스워드 해시, 로그인 이력, 잠금 상태."""
    __tablename__ = "user_security"

    user_id           = Column(String(40), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    password_hash     = Column(Text,    nullable=True)   # MEM만 사용, SNS는 NULL
    last_login_at     = Column(TIMESTAMP(timezone=True), nullable=True)
    login_fail_count  = Column(Integer, nullable=False, default=0)
    locked_until      = Column(TIMESTAMP(timezone=True), nullable=True)


class UserOAuth(Base):
    """SNS 연동 — 1:N, 한 계정에 복수 SNS 연동 가능."""
    __tablename__ = "user_oauth"

    id           = Column(Integer,     primary_key=True, autoincrement=True)
    user_id      = Column(String(40),  ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    provider     = Column(String(5),   nullable=False)   # KKO / NVR / GGL
    provider_sub = Column(String(255), nullable=False)   # provider 측 고유 ID
    linked_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("provider", "provider_sub", name="uq_oauth_provider_sub"),
    )


class UserPreference(Base):
    """맞춤정보 — 여행 성향, UI 설정 등."""
    __tablename__ = "user_preference"

    user_id     = Column(String(40), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    tendency    = Column(JSONB, nullable=True)   # {"prefers_nature": true, "budget": "mid", ...}
    ui_settings = Column(JSONB, nullable=True)   # {"theme": "dark", "sidebar_width": 300, ...}
    updated_at  = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class Session(Base):
    """세션 목록 — 사용자별 여행 플래닝 세션."""
    __tablename__ = "sessions"

    session_id      = Column(String(50), primary_key=True)
    user_id         = Column(String(40), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    title           = Column(String(255), nullable=True)
    topic           = Column(Text,        nullable=True)
    context         = Column(Text,        nullable=True)   # LLM 요약 맥락
    mode            = Column(String(10),  nullable=False, default="personal")  # personal / team
    is_manual_title = Column(Boolean,     nullable=False, default=False)
    created_at      = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
