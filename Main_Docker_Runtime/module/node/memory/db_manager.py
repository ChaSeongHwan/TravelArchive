import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime
import os

# PostGIS 공간 데이터 타입을 확인하기 위한 임포트 (설치 필요: pip install GeoAlchemy2)
try:
    from geoalchemy2.elements import WKBElement
    from geoalchemy2.shape import to_shape
    import shapely.wkt
    HAS_GEOALCHEMY = True
except ImportError:
    HAS_GEOALCHEMY = False
    print("[DBManager] GeoAlchemy2가 설치되지 않아 공간 데이터 변환 기능을 비활성화합니다.")

class DBManager: # 이름을 범용적으로 변경
    _instances = {}

    def __new__(cls, db_url=None):
        # db_url이 없으면 환경 변수에서 가져오고, 그래도 없으면 기본 SQLite 사용
        if db_url is None:
            db_url = os.getenv("DATABASE_URL", "sqlite:///./default.db")

        if db_url not in cls._instances:
            instance = super(DBManager, cls).__new__(cls)
            instance._init_db(db_url)
            cls._instances[db_url] = instance
        
        return cls._instances[db_url]

    def _init_db(self, db_url):
        print(f"[DBManager] 엔진 가동 (URL: {db_url})")
        
        # SQLite일 경우에만 멀티 스레드 옵션 추가, Postgres일 경우 빈 딕셔너리
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        
        self.engine = create_engine(db_url, connect_args=connect_args)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self._lock = asyncio.Lock()
        
        self._registry = {}

    def register_model(self, model_name: str, model_class):
        self._registry[model_name] = model_class
        print(f"[DBManager] 모델 등록 완료: {model_name}")

    def create_tables(self, base_metadata):
        base_metadata.create_all(bind=self.engine)
        print("[DBManager] 데이터베이스 테이블 물리적 생성 완료")

    async def execute(self, payload: dict) -> dict:
        async with self._lock: # 여러 노드의 동시 요청을 직렬화 (기존 로직 유지)
            return await asyncio.to_thread(self._sync_execute, payload)

    def _sync_execute(self, payload: dict) -> dict:
        # ... (이전의 _sync_execute 내부 CRUD 로직은 완벽하므로 그대로 유지합니다.) ...
        # 주의: 아래 코드는 READ 등의 액션 시 _to_dict를 호출하는 부분을 가정합니다.
        pass

    # ★ 핵심 확장: PostgreSQL(PostGIS)의 공간 데이터를 JSON으로 안전하게 변환하는 로직 추가
    def _to_dict(self, obj):
        if not obj: return None
        result = {}
        for c in obj.__table__.columns:
            value = getattr(obj, c.name)
            
            if isinstance(value, datetime.datetime):
                result[c.name] = value.isoformat()
            # PostGIS 공간 데이터(Geometry/Geography) 처리 로직
            elif HAS_GEOALCHEMY and isinstance(value, WKBElement):
                # DB의 바이너리 공간 데이터를 파이썬 객체로 변환 후 WKT(텍스트) 문자열로 변환
                shapely_geom = to_shape(value)
                result[c.name] = shapely.wkt.dumps(shapely_geom)
            else:
                result[c.name] = value
                
        return result