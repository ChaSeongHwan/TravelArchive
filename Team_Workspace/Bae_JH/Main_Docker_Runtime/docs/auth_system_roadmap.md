# 인증 시스템 구축 로드맵

> 작성 기준일: 2026-04-09  
> 대상 독자: 이 프로젝트를 처음 보는 개발자 또는 AI  
> 목적: 로그인·인증·계정 시스템 전체를 처음부터 구축하기 위한 단계별 명세

---

## 1. 프로젝트 현재 상태

### 1-1. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 웹 프레임워크 | FastAPI (Python 3.10) |
| 관계형 DB | PostgreSQL 18 + PostGIS (Docker: `TA_db`) |
| 인메모리 DB | Redis 7 (Docker: `TA_redis`) |
| ORM | SQLAlchemy (동기, `asyncio.to_thread`로 비동기 래핑) |
| 마이그레이션 | Alembic |
| 인증 라이브러리 | PyJWT, passlib[bcrypt] (설치됨, 미구현) |
| 리버스 프록시 | Nginx |
| 컨테이너 | Docker Compose (컴포즈 파일 분리 운영) |

### 1-2. 현재 디렉토리 구조 (핵심 파일만)

```
Main_Docker_Runtime/
├── backend/
│   └── facade.py              ← FastAPI 진입점. 현재 Mock DB 사용 중
├── module/
│   └── node/
│       └── memory/
│           ├── postgres_manager.py   ← PostgreSQL CRUD (완성)
│           ├── postgres_node.py      ← 파이프라인용 노드 (완성)
│           ├── postgre_tables.py     ← SQLAlchemy ORM 모델 (완성)
│           ├── redis_manager.py      ← Redis CRUD (완성)
│           ├── redis_node.py         ← 파이프라인용 노드 (완성)
│           └── redis_tables.py       ← Redis DTO 클래스 (완성)
├── alembic/
│   ├── env.py                 ← DATABASE_URL 주입, Base 감지 설정 (완성)
│   ├── script.py.mako
│   └── versions/              ← 비어 있음. 마이그레이션 파일이 쌓일 곳
├── alembic.ini
├── setting/
│   ├── .env                   ← 실제 환경 변수 (git 제외)
│   ├── .env.sample            ← 환경 변수 템플릿
│   └── config.py              ← LLM 설정 로드
├── db/
│   └── init.sql               ← PostGIS 확장 활성화만 담당
└── requirements.txt           ← PyJWT, passlib[bcrypt], alembic 포함됨
```

### 1-3. 현재 문제점 (구축 전 상태)

- `facade.py`의 모든 auth 엔드포인트가 Mock 응답만 반환함
- `user_id = "default_user"` 하드코딩
- 세션 데이터가 Python 인메모리 dict에만 저장됨 (서버 재시작 시 소멸)
- PostgreSQL 테이블이 실제로 존재하지 않음 (Alembic 미실행)

---

## 2. 사용자 식별 체계

> 이 프로젝트 전체에서 사용자를 구별하는 핵심 규칙. 모든 코드가 이 형식을 따라야 함.

### 2-1. user_id 포맷

```
{타입코드}:{고유값}

MEM:{uuid4}        ← 일반 회원 (Member)
GST:{uuid4}        ← 게스트 (Guest)
KKO:{sha256[:16]}  ← 카카오 SNS
NVR:{sha256[:16]}  ← 네이버 SNS
GGL:{sha256[:16]}  ← 구글 SNS
```

**규칙:**
- 타입코드는 항상 3자리 대문자
- `user_id.split(":")[0]` 으로 타입을 즉시 판별할 수 있어야 함
- GST는 PostgreSQL에 저장하지 않음. Redis에만 존재

### 2-2. JWT 구조

**Access Token** (만료: 15~60분, `.env`의 `ACCESS_TOKEN_EXPIRE_MINUTES`)
```json
{
  "sub": "MEM:a3f2b1c4-...",
  "type": "MEM",
  "jti": "랜덤 UUID",
  "exp": 1712345678
}
```

**Refresh Token** (만료: 7일, `.env`의 `REFRESH_TOKEN_EXPIRE_DAYS`)
- Payload는 Access Token과 동일한 구조
- 발급 즉시 Redis에 저장: `auth:refresh:{jti}` → `user_id` (TTL = 7일)
- 로그아웃 시 Redis에서 삭제하여 무효화

### 2-3. Redis TTL 정책

| 대상 | TTL |
|------|-----|
| Refresh Token | 7일 |
| 회원(MEM/SNS) 세션 데이터 | 48시간 |
| 게스트(GST) 전체 데이터 | 24시간 |

### 2-4. 게스트 생명주기

```
접속
  └→ GST:uuid 생성
       └→ Redis에만 저장 (TTL 24h)
            ├→ 24시간 내 재접속 없음 → TTL 만료 → 자동 소멸
            └→ 회원가입/로그인 → PostgreSQL로 마이그레이션
```

---

## 3. 전체 데이터 흐름

### 3-1. 로그인 흐름

```
[프론트엔드]
    │ POST /api/auth/login  { id, pw }
    ▼
[facade.py] → auth_service.login()
    │
    ├─ PostgresManager로 users + user_security 조회
    ├─ password_utils.verify(pw, hash) 검증
    ├─ jwt_utils.create_access_token(user_id) → access_token
    ├─ jwt_utils.create_refresh_token(user_id) → refresh_token
    └─ RedisManager로 auth:refresh:{jti} 저장 (TTL 7일)
    │
    ▼
[응답] { access_token, refresh_token, user_id, type }
```

### 3-2. 인증된 API 요청 흐름

```
[프론트엔드]
    │ Authorization: Bearer {access_token}
    │ POST /api/sessions/{session_id}/message
    ▼
[FastAPI Dependency: get_current_user()]
    ├─ 헤더에서 token 추출
    ├─ jwt_utils.verify_access_token(token) → payload
    └─ user_id 반환 ("MEM:abc123")
    │
    ▼
[엔드포인트 함수] user_id를 매개변수로 받아 처리
```

### 3-3. 토큰 갱신 흐름

```
[프론트엔드]
    │ POST /api/auth/refresh  { refresh_token }
    ▼
[facade.py] → auth_service.refresh()
    ├─ jwt_utils.verify_refresh_token(token) → payload (jti, user_id)
    ├─ RedisManager로 auth:refresh:{jti} 존재 확인
    │    └─ 없으면 401 반환 (로그아웃된 토큰)
    ├─ 새 access_token 생성
    └─ (선택) 새 refresh_token 생성 후 Redis 갱신
    │
    ▼
[응답] { access_token }
```

### 3-4. 창 닫기(Flush) 흐름

```
[프론트엔드] window.beforeunload
    │ navigator.sendBeacon('/api/session/flush', { session_id })
    │ Authorization: Bearer {access_token}
    ▼
[facade.py] get_current_user() → user_id 추출
    │
    ├─ user_id.startswith("GST")
    │    └→ Redis 키 즉시 삭제 (session:{id}:meta, session:{id}:state)
    │
    └─ MEM / SNS 계열
         ├→ Redis에서 SessionMeta 로드
         ├→ PostgresManager로 sessions 테이블에 upsert
         └→ Redis 키 삭제
```

---

## 4. 구현 단계별 명세

---

### Phase 1 — 유틸리티 구현

**목적:** 이후 모든 단계에서 사용할 JWT·패스워드 도구를 먼저 만든다.

**생성할 파일:**

```
module/
└── auth/
    ├── __init__.py
    ├── jwt_utils.py
    └── password_utils.py
```

---

#### `module/auth/jwt_utils.py`

**구현할 함수:**

```python
def create_access_token(user_id: str) -> str:
    """
    Access Token 생성.
    payload: { sub: user_id, type: user_id.split(":")[0], jti: uuid4, exp: now + EXPIRE }
    서명 키: 환경 변수 ACCESS_TOKEN_SECRET_KEY
    알고리즘: HS256
    """

def create_refresh_token(user_id: str) -> str:
    """
    Refresh Token 생성.
    payload 구조는 Access Token과 동일.
    서명 키: 환경 변수 REFRESH_TOKEN_SECRET_KEY
    만료: REFRESH_TOKEN_EXPIRE_DAYS
    """

def verify_access_token(token: str) -> dict:
    """
    Access Token 검증 및 payload 반환.
    만료 또는 서명 오류 시 HTTPException(401) raise.
    """

def verify_refresh_token(token: str) -> dict:
    """
    Refresh Token 검증 및 payload 반환.
    만료 또는 서명 오류 시 HTTPException(401) raise.
    """
```

**참조할 환경 변수:**
- `ACCESS_TOKEN_SECRET_KEY`
- `REFRESH_TOKEN_SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`

---

#### `module/auth/password_utils.py`

**구현할 함수:**

```python
def hash_password(plain: str) -> str:
    """
    평문 패스워드를 bcrypt로 해시하여 반환.
    passlib CryptContext(schemes=["bcrypt"]) 사용.
    """

def verify_password(plain: str, hashed: str) -> bool:
    """
    평문과 해시를 비교하여 일치 여부 반환.
    """
```

---

### Phase 2 — PostgreSQL 테이블 실체화

**목적:** `postgre_tables.py`에 정의된 ORM 모델을 실제 DB에 생성한다.

**실행할 명령 (프로젝트 루트에서):**

```bash
# 1. 마이그레이션 파일 자동 생성
alembic revision --autogenerate -m "initial schema"

# 2. DB에 실제 적용
alembic upgrade head
```

**완료 조건:**
- `alembic/versions/` 안에 파일이 1개 생성됨
- pgAdmin(포트 5050) 또는 psql로 접속 시 아래 테이블이 존재함:
  - `users`, `user_profile`, `user_security`, `user_oauth`, `user_preference`, `sessions`

**주의:**
- `TA_db` 컨테이너가 실행 중이어야 함
- `.env`의 `DATABASE_URL`이 올바르게 설정되어 있어야 함
- Docker 컨테이너 안에서 실행할 경우: `docker exec -it TA_backend alembic upgrade head`

---

### Phase 3 — Auth 서비스 구현

**목적:** 회원가입·로그인·게스트·토큰 갱신·로그아웃 비즈니스 로직을 구현한다.

**생성할 파일:**

```
module/
└── auth/
    └── auth_service.py
```

---

#### `module/auth/auth_service.py`

`PostgresManager`, `RedisManager`, `jwt_utils`, `password_utils`, `redis_tables`, `postgre_tables`를 모두 주입받아 사용.

**구현할 함수:**

```python
async def signup(postgres: PostgresManager, data: dict) -> dict:
    """
    회원가입.
    1. users 테이블에 { user_id: "MEM:{uuid4}", user_type: "MEM", status: "active" } insert
    2. user_profile 테이블에 { user_id, email, name, nickname } insert
    3. user_security 테이블에 { user_id, password_hash: hash_password(pw) } insert
    4. user_preference 테이블에 { user_id } insert (빈 row)
    반환: { user_id }
    이메일 중복 시 HTTPException(409) raise
    """

async def login(postgres: PostgresManager, redis: RedisManager, id: str, pw: str) -> dict:
    """
    로그인.
    1. user_profile에서 email로 user_id 조회
    2. user_security에서 password_hash 조회
    3. verify_password(pw, hash) 검증
       - 실패 시 login_fail_count +1, 5회 이상 시 locked_until 설정
    4. last_login_at 갱신
    5. create_access_token(user_id), create_refresh_token(user_id) 생성
    6. AuthRefreshToken.save(redis, jti, user_id) 저장
    반환: { access_token, refresh_token, user_id, type }
    """

async def guest_login(redis: RedisManager) -> dict:
    """
    게스트 로그인.
    1. user_id = "GST:{uuid4}" 생성
    2. GuestUser(uuid=uuid).save(redis) 저장 (TTL 24h)
    3. create_access_token(user_id), create_refresh_token(user_id) 생성
    4. AuthRefreshToken.save(redis, jti, user_id) 저장 (TTL 24h)
    반환: { access_token, refresh_token, user_id, type: "GST" }
    PostgreSQL에는 아무것도 저장하지 않음
    """

async def refresh_token(redis: RedisManager, refresh_token: str) -> dict:
    """
    토큰 갱신.
    1. verify_refresh_token(token) → payload 추출
    2. AuthRefreshToken.load(redis, jti) → user_id 확인
       - None이면 이미 로그아웃된 토큰 → HTTPException(401)
    3. create_access_token(user_id) 생성
    반환: { access_token }
    """

async def logout(redis: RedisManager, refresh_token: str) -> None:
    """
    로그아웃.
    1. verify_refresh_token(token) → jti 추출
    2. AuthRefreshToken.delete(redis, jti) → Redis에서 토큰 삭제
    """
```

---

### Phase 4 — FastAPI 미들웨어 (Dependency)

**목적:** 모든 인증 필요 엔드포인트에서 JWT를 자동으로 검증하고 user_id를 주입한다.

**생성할 파일:**

```
module/
└── auth/
    └── dependencies.py
```

#### `module/auth/dependencies.py`

```python
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from module.auth.jwt_utils import verify_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Authorization: Bearer {token} 헤더에서 user_id를 추출하여 반환.
    토큰이 없거나 만료된 경우 HTTPException(401) raise.
    반환: user_id 문자열 ("MEM:abc123", "GST:uuid" 등)
    """

async def get_current_member(user_id: str = Depends(get_current_user)) -> str:
    """
    게스트(GST)를 허용하지 않는 엔드포인트용.
    user_id가 GST로 시작하면 HTTPException(403) raise.
    """
```

---

### Phase 5 — facade.py 실제 연결

**목적:** 현재 Mock DB로 동작하는 `facade.py`를 실제 PostgreSQL + Redis로 교체한다.

**수정할 파일:** `backend/facade.py`

#### 5-1. 앱 시작 시 초기화 추가

```python
# FastAPI lifespan으로 매니저 인스턴스 생성
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.postgres = PostgresManager()
    app.state.redis    = RedisManager()
    yield
    await app.state.redis.close()
```

#### 5-2. Auth 엔드포인트 교체

| 엔드포인트 | 현재 | 변경 후 |
|-----------|------|---------|
| `POST /api/auth/signup` | Mock 응답 반환 | `auth_service.signup()` 호출 |
| `POST /api/auth/login` | Mock 응답 반환 | `auth_service.login()` 호출 |
| `POST /api/auth/guest` | Mock 응답 반환 | `auth_service.guest_login()` 호출 |
| `POST /api/auth/refresh` | 없음 (신규) | `auth_service.refresh_token()` 호출 |
| `POST /api/auth/logout` | 없음 (신규) | `auth_service.logout()` 호출 |

#### 5-3. 세션 엔드포인트에 user_id 주입

```python
# 모든 세션 관련 엔드포인트에 Dependency 추가
@app.post("/api/sessions")
async def create_session(
    req: SessionCreateRequest,
    user_id: str = Depends(get_current_user)   # ← 추가
):
    # user_id = "MEM:abc123" or "GST:uuid"
```

#### 5-4. Mock DB 제거 대상

아래 전역 변수들을 모두 제거하고 실제 DB 호출로 교체:

```python
# 제거 대상
active_sessions: Dict[str, SessionContainer]   # → Redis SessionMeta/SessionState
mock_sessions_db                               # → PostgreSQL sessions 테이블
mock_chat_history_db                           # → PostgreSQL (별도 테이블 필요)
mock_session_meta_db                           # → PostgreSQL sessions 테이블
mock_trip_ranges                               # → PostgreSQL (별도 테이블 필요)
mock_memos                                     # → PostgreSQL (별도 테이블 필요)
mock_plans                                     # → PostgreSQL (별도 테이블 필요)
```

> **참고:** `mock_trip_ranges`, `mock_memos`, `mock_plans`는 현재 `postgre_tables.py`에 테이블이 없음.
> Phase 5 진행 전에 해당 테이블을 `postgre_tables.py`에 추가하고 Alembic 마이그레이션 필요.

#### 5-5. Flush 엔드포인트 추가 (신규)

```python
@app.post("/api/session/flush")
async def flush_session(
    session_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    프론트엔드 beforeunload 이벤트가 navigator.sendBeacon으로 호출.
    user_id prefix 확인 후:
      - GST: Redis 키 즉시 삭제
      - MEM/SNS: Redis → PostgreSQL 동기화 후 Redis 삭제
    """
```

**프론트엔드 연동 (frontend/src/js/api.js 또는 script.js):**
```javascript
window.addEventListener('beforeunload', () => {
    navigator.sendBeacon('/api/session/flush',
        JSON.stringify({ session_id: currentSessionId })
    );
});
```

---

### Phase 6 — SNS OAuth 연동

**목적:** 카카오·네이버·구글 소셜 로그인을 구현한다.

**주의:** 각 provider의 앱 등록 및 콜백 URL 설정이 선행되어야 함.

**흐름:**

```
[프론트엔드] /api/auth/social/{provider} 클릭
    ↓
[백엔드] provider OAuth 인증 URL로 리다이렉트
    ↓
[provider] 사용자 인증
    ↓
[백엔드] /api/auth/social/{provider}/callback
    ├─ provider로부터 access_token 수령
    ├─ provider API로 사용자 정보(provider_sub) 조회
    ├─ user_oauth 테이블에서 (provider, provider_sub) 검색
    │    ├─ 존재: 기존 user_id 사용
    │    └─ 없음: 신규 user_id 생성 후 users + user_oauth insert
    └─ JWT 발급 후 프론트엔드로 리다이렉트
```

**생성할 파일:**
```
module/
└── auth/
    └── oauth_service.py
```

---

## 5. 파일 구조 최종 목표

```
module/
└── auth/
    ├── __init__.py
    ├── jwt_utils.py          ← Phase 1
    ├── password_utils.py     ← Phase 1
    ├── auth_service.py       ← Phase 3
    ├── dependencies.py       ← Phase 4
    └── oauth_service.py      ← Phase 6
```

---

## 6. 환경 변수 체크리스트

`Phase 1` 시작 전 `.env`에 반드시 설정되어야 할 값:

```
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASS}@TA_db:5432/${POSTGRES_DB}
REDIS_URL=redis://:${REDIS_PASSWORD}@TA_redis:6379/${REDIS_DB_INDEX}

ACCESS_TOKEN_SECRET_KEY=      ← 랜덤 256bit 이상 문자열
REFRESH_TOKEN_SECRET_KEY=     ← ACCESS와 다른 별도 키
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

---

## 7. 단계별 완료 조건 요약

| Phase | 완료 조건 |
|-------|---------|
| 1 | `jwt_utils`, `password_utils` 단위 테스트 통과 |
| 2 | pgAdmin에서 6개 테이블 확인 가능 |
| 3 | Postman 등으로 signup → login → 토큰 수령 확인 |
| 4 | 인증 헤더 없이 세션 API 호출 시 401 반환 확인 |
| 5 | 서버 재시작 후에도 세션 목록이 유지됨 확인 |
| 6 | 소셜 로그인 후 JWT 발급 및 DB 저장 확인 |

---

## 8. 의존성 그래프

```
Phase 1 (유틸리티)
    │
    ├──────────────────────────┐
    ▼                          ▼
Phase 2 (DB 테이블)       Phase 3 (Auth 서비스)
    │                          │
    └──────────┬───────────────┘
               ▼
          Phase 4 (미들웨어)
               │
               ▼
          Phase 5 (facade 연결)
               │
               ▼
          Phase 6 (SNS OAuth)
```

Phase 2와 Phase 3은 병렬 진행 가능.  
Phase 4는 반드시 Phase 1, 3 완료 후 진행.  
Phase 5는 Phase 2, 4 완료 후 진행.
