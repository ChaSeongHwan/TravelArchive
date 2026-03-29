import json
from typing import Any, Optional
from module.node.base.base import BaseProcessor # 실제 프로젝트 경로에 맞게 수정
from module.node.memory.db_manager import DBManager

class DBProcessorNode(BaseProcessor):
    def __init__(self, db_manager_instance: DBManager):
        super().__init__()
        self.db = db_manager_instance 

    async def on_start(self) -> None:
        print("[DB Node] 노드가 시작되었습니다. DB 매니저 연결 확인.")

    async def on_stop(self) -> None:
        print("[DB Node] 노드 종료.")

    async def process(self, data: Any) -> Optional[Any]:
        # 1. 입력 데이터 검증 및 파싱
        if isinstance(data, str):
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                self.signal("error", "Invalid JSON string")
                return json.dumps({"status": "error", "reason": "Invalid JSON string"})
        elif isinstance(data, dict):
            payload = data
        else:
            self.signal("error", "Unsupported data type")
            return json.dumps({"status": "error", "reason": "Unsupported data type"})

        # 2. DB 매니저에게 작업 위임
        result = await self.db.execute(payload)

        # 3. 에러 처리
        if result.get("status") == "error":
            self.signal("error", result.get("reason"))
            return json.dumps({"status": "error", "reason": result.get("reason")})

        # 4. 결과를 JSON 문자열로 반환
        return json.dumps(result)