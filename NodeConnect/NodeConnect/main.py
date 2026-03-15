import asyncio
import json
from typing import Any

from src.node.base.node import Node
from src.node.base.message import create_message
from src.node.base.base import BaseProcessor

# ==========================================
# 1. 테스트할 커스텀 프로세서 임포트
# ==========================================
# 실제 테스트할 팀원의 프로세서 클래스를 이곳에 임포트하세요.
# 예시: from Team_Workspace.frontend.my_node import MyCustomProcessor


# ==========================================
# 2. 범용 노드 테스트 헬퍼 함수
# ==========================================
async def send_test_request(target_node: Node, test_name: str, payload: Any):
    """
    대상 노드에 페이로드를 전송하고 결과를 출력하는 범용 헬퍼 함수
    """
    print(f"\n[TEST: {test_name}] 요청 전송 중...")

    # 프레임워크 규격에 맞게 메시지 래핑 (데이터 타입 무관)
    msg = create_message(
        source="test_script",
        kind="data",
        data=payload,
        target=target_node.node_id
    )

    # 노드의 입력 큐에 메시지 삽입
    await target_node.iface.from_router_q.put(msg)

    # 노드 틱 실행 (입력 큐 확인 -> process 실행 -> 출력 큐 적재)
    # 비동기 처리 타이밍을 맞추기 위해 2회 이상 호출
    await target_node.tick()
    await target_node.tick()

    # 결과 확인 및 출력 포맷팅
    if not target_node.iface.to_router_q.empty():
        result_msg = await target_node.iface.to_router_q.get()
        result_data = result_msg.data

        if isinstance(result_data, dict):
            formatted_result = json.dumps(result_data, indent=2, ensure_ascii=False)
        elif isinstance(result_data, str):
            try:
                parsed = json.loads(result_data)
                formatted_result = json.dumps(parsed, indent=2, ensure_ascii=False)
            except json.JSONDecodeError:
                formatted_result = result_data
        else:
            formatted_result = str(result_data)

        print(f"[결과 반환 완료]\n{formatted_result}")
    else:
        print("[결과] 응답이 없습니다. (반환값이 None이거나 에러 발생 가능성)")


# ==========================================
# 3. 메인 실행 함수
# ==========================================
async def main():
    print("=== 범용 커스텀 노드 로컬 테스트 시작 ===")

    # -----------------------------------------------------------
    # [수정 구역] 테스트할 프로세서의 인스턴스를 생성하세요.
    # processor = MyCustomProcessor(api_key="...", verbose=True)
    
    # (아래는 스크립트가 바로 실행되도록 만든 임시 더미입니다. 실제 사용 시 지워주세요.)
    class DummyProcessor(BaseProcessor):
        async def process(self, data: Any):
            return {"status": "success", "processed_data": data}
    
    processor = DummyProcessor()
    # -----------------------------------------------------------

    # 1. 프로세서를 프레임워크 Node에 장착 및 구동
    test_node = Node(node_id="test_node_01", base=processor)
    await test_node.start()
    print(f"[SYSTEM] 노드({test_node.node_id}) 구동 완료. 테스트를 시작합니다.")

    # 2. 테스트 케이스 작성 구역
    # 이곳에 다양한 형태의 입력값을 넣어 노드의 반응을 테스트하세요.
    
    # 케이스 1: 딕셔너리 입력 테스트
    await send_test_request(test_node, "딕셔너리 페이로드 테스트", {
        "query": "안녕하세요",
        "user_id": "test_user_123"
    })

    # 케이스 2: 단순 문자열 입력 테스트
    await send_test_request(test_node, "문자열 페이로드 테스트", "이것은 단순 문자열입니다.")

    # 케이스 3: 빈 값(None) 입력 테스트
    await send_test_request(test_node, "None 페이로드 테스트", None)

    # 추가 테스트 케이스를 계속 작성할 수 있습니다.
    # await send_test_request(test_node, "테스트명", 데이터)

    # 3. 테스트 종료 및 자원 정리
    await test_node.stop()
    print("\n=== 범용 커스텀 노드 로컬 테스트 완료 ===")

if __name__ == "__main__":
    asyncio.run(main())