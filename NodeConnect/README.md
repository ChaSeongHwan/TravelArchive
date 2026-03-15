# NodeConnect 백엔드 시스템 개발 가이드

본 디렉토리(`NodeConnect`)는 우리 프로젝트의 백엔드를 담당하는 **모듈화된 노드(Node) 기반 코어 시스템**입니다.
이곳의 메인 코어 엔진, 스트림 처리, 라우팅 시스템은 **마스터가 직접 총괄 및 관리**하므로, 팀원들은 내부 코어 파일이나 뼈대 시스템을 절대 임의로 수정해서는 안 됩니다.

## 1. 개발 철학 및 팀원 역할

NodeConnect의 핵심 철학은 **"개발자는 오직 데이터 처리 로직(알맹이)에만 집중한다"**는 것입니다.
메시지 헤더 생성/해제, 스트림 분할/재조립, 다음 노드로의 라우팅 및 내부 큐(Queue) 제어 등 복잡한 시스템적 '껍데기'는 프레임워크가 알아서 전담합니다.

팀원분들은 오직 단 하나의 기반 클래스인 `src/node/base/base.py`, 혹은 바로 앞에 있는 `base.py` (`BaseProcessor`)를 상속받아, 본인이 배정받은 단일 기능(노드)만 구현해 주시면 됩니다.

## 2. BaseProcessor 구조 및 훅(Hook) 상세 안내

모든 커스텀 노드는 반드시 `BaseProcessor`를 상속해야 하며, 아래의 메서드들을 목적에 맞게 오버라이딩(Overriding)하여 구현합니다.

### [필수 구현] 메인 로직 처리

* **`async def process(self, data: Any) -> Optional[Any]:`**
* **(필수)** 프레임워크가 껍데기를 모두 벗긴 '순수 입력 데이터'를 `data`로 전달해 줍니다.
* 내부 로직을 처리한 후, 다음 노드로 넘길 '순수 출력 데이터'를 반환(`return`)하면 됩니다.
* 만약 에러가 발생했거나 다음 노드로 넘길 데이터가 없다면 `None`을 반환합니다.



### [선택 구현] 생명주기(Lifecycle) 및 상태 관리 훅

필요에 따라 아래의 훅들을 오버라이딩하여 노드의 디테일한 상태를 제어할 수 있습니다.

* **`async def on_start(self):` (시작 훅)**
* 노드가 시스템에 등록되고 구동을 시작할 때 딱 1번 호출됩니다.
* **사용처:** API 키 로딩, 무거운 AI 모델 메모리 적재, 데이터베이스 커넥션 풀 생성, 캐시 초기화 등


* **`async def on_stop(self):` (종료 훅)**
* 시스템이 종료되거나 노드가 파기될 때 1번 호출됩니다.
* **사용처:** 열려있는 파일 닫기, DB 연결 정상 종료, 메모리에 남은 버퍼 데이터 최종 저장 및 자원 정리 등


* **`async def on_idle(self):` (유휴 훅)**
* 노드에 들어오는 입력 데이터가 없어 대기 상태일 때 주기적으로 호출됩니다.
* **사용처:** 가벼운 연결 상태(Ping) 체크, 오래된 캐시 비우기 등 (무거운 작업은 시스템 지연을 유발하므로 권장하지 않음)


* **`def signal(self, name: str, data: Any = None):` (상태 신호 전달)**
* `process` 내부에서 예외 상황이나 분기가 발생했을 때, 프레임워크 뼈대에 상태를 알리는 기능입니다.
* **사용처:** 에러 발생 시 `self.signal("error", "API 응답 없음")`, 메시지 무시 시 `self.signal("skip")`, 특정 라우터로 강제 분기 시 `self.signal("branch", "A코스")` 등으로 호출합니다.



---

## 3. AI를 활용한 초고속 노드 개발 프롬프트 (템플릿)

새로운 기능의 노드를 개발할 때 처음부터 코드를 짤 필요가 없습니다. LLM(ChatGPT, Claude 등)에게 아래의 프롬프트 양식을 복사하여 상황에 맞게 괄호 안을 채워 넣으시면, 규칙에 완벽하게 맞는 노드 코드를 즉시 얻을 수 있습니다.

**[AI 프롬프트 작성 템플릿]**

> 나는 파이썬 기반의 노드 시스템을 만들고 있어. 아래 제공하는 `base.py`의 `BaseProcessor` 구조를 엄격하게 참고해서, **[여기에 구현할 기능 상세 설명, 예: 들어온 텍스트를 파파고 API를 통해 영문으로 번역해주는]** 노드 클래스를 만들어줘.
> **[구현 규칙]**
> 1. 메시지 래핑, 라우팅, 큐 제어는 절대 직접 구현하지 마. 오직 핵심 로직만 `BaseProcessor`를 상속해서 구현해.
> 2. `process(self, data)`는 반드시 구현해서 순수 데이터를 반환하거나 `None`을 반환해 줘.
> 3. 무거운 객체 초기화나 API 세팅이 필요하면 `__init__`이 아니라 반드시 `on_start()` 훅을 사용해.
> 4. 자원 정리가 필요하다면 `on_stop()` 훅을 구현해.
> 5. 만약 로직 처리 중 에러가 나거나 특정 분기 처리가 필요하다면, 직접 예외를 던지지 말고 `self.signal("error",  에러내용)` 등을 호출한 뒤 `None`을 반환하는 식으로 처리해 줘.
> 
> 
> (이 아래에 `src/node/base/base.py` 파일의 전체 코드를 복사해서 붙여넣기 하세요)

---

## 4. 모든 훅(Hook)을 활용한 노드 구현 종합 예시

다음은 `process`뿐만 아니라 `on_start`, `on_stop`, `on_idle`, `signal`을 모두 어떻게 유기적으로 사용하는지 보여주는 종합 예시 코드입니다. 이 구조를 참고하여 본인만의 `xxx_node.py`를 작성해 주시기 바랍니다.

```python
import os
import asyncio
from typing import Any, Optional
from src.node.base.base import BaseProcessor

class AdvancedDBQueryProcessor(BaseProcessor):
    """
    모든 훅(Hook)을 활용하여 DB 연결, 쿼리 처리, 자원 정리, 에러 신호 처리를 수행하는 종합 예시 노드.
    """

    def __init__(self, db_url: str):
        super().__init__()
        self.db_url = db_url
        self.db_connection = None
        self.idle_count = 0

    async def on_start(self) -> None:
        """[시작 훅] 노드 가동 시 1회 실행: 무거운 연결 작업 수행"""
        print(f"[{self.__class__.__name__}] DB 커넥션 풀을 초기화합니다: {self.db_url}")
        self.db_connection = "Mock_Connection_Object"

    async def on_stop(self) -> None:
        """[종료 훅] 노드 파기 시 1회 실행: 자원 안전 해제"""
        if self.db_connection:
            print(f"[{self.__class__.__name__}] DB 커넥션을 안전하게 종료합니다.")
            self.db_connection = None

    async def on_idle(self) -> None:
        """[유휴 훅] 입력이 없을 때 대기 중 실행: 가벼운 상태 체크"""
        self.idle_count += 1
        if self.idle_count % 100 == 0:
            print(f"[{self.__class__.__name__}] 현재 유휴 상태입니다. DB 연결 상태 Ping 체크 완료.")

    async def process(self, data: Any) -> Optional[Any]:
        """[메인 로직] 실제 데이터 처리 영역"""
        self.idle_count = 0 

        if not data:
            self.signal("skip", "입력 데이터가 비어있습니다.")
            return None

        try:
            query_result = f"Processed DB Result for: {data}"
            return query_result

        except Exception as e:
            self.signal("error", f"DB 쿼리 중 예외 발생: {str(e)}")
            return None

```

---

## 5. 개발한 커스텀 노드 로컬 테스트 가이드 (필독)

메인 엔진인 `NodeConnect` 내부 파일은 절대 수정하지 마십시오. 본인이 개발한 노드가 정상적으로 작동하는지 확인하려면, 본인의 `Team_Workspace` 작업 폴더 내부에 아래의 테스트 전용 스크립트를 만들고 실행하여 검증해야 합니다.

### [사용 방법]

1. `Team_Workspace/본인폴더` 내부에 `test_my_node.py` 파일을 생성하고 아래 전체 코드를 복사하여 붙여넣습니다.
2. 주석으로 표시된 **[수정 구역 1, 2, 3]**을 본인이 만든 노드 클래스와 테스트 데이터에 맞게 변경합니다.
3. 로컬 터미널을 열고 프로젝트 최상위 경로에서 `python Team_Workspace/본인폴더/test_my_node.py` 명령어를 입력하여 결과를 확인합니다.

```python
import asyncio
import json
from typing import Any

from src.node.base.node import Node
from src.node.base.message import create_message

# ==========================================
# [수정 구역 1] 테스트할 커스텀 프로세서 임포트
# ==========================================
# 본인이 개발한 파일 경로에 맞게 클래스를 임포트하세요.
# 예시: from Team_Workspace.my_folder.my_custom_node import MyCustomProcessor


# ==========================================
# 범용 노드 테스트 헬퍼 함수 (수정 금지)
# ==========================================
async def send_test_request(target_node: Node, test_name: str, payload: Any):
    print(f"\n[TEST: {test_name}] 요청 전송 중...")

    msg = create_message(
        source="test_script",
        kind="data",
        data=payload,
        target=target_node.node_id
    )

    await target_node.iface.from_router_q.put(msg)
    
    # 비동기 처리 타이밍 동기화를 위한 틱 실행
    await target_node.tick()
    await target_node.tick()

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
# 메인 실행 함수
# ==========================================
async def main():
    print("=== 범용 커스텀 노드 로컬 테스트 시작 ===")

    # -----------------------------------------------------------
    # [수정 구역 2] 테스트할 본인의 프로세서 인스턴스를 생성하세요.
    # processor = MyCustomProcessor(api_key="sk-...", verbose=True)
    # -----------------------------------------------------------

    # 임시 더미 객체 (실제 사용 시 지우고 위 코드를 활성화하세요)
    from src.node.base.base import BaseProcessor
    class DummyProcessor(BaseProcessor):
        async def process(self, data: Any):
            return {"status": "success", "processed_data": data}
    processor = DummyProcessor()
    
    # -----------------------------------------------------------

    # 1. 프로세서를 프레임워크 Node에 장착 및 구동
    test_node = Node(node_id="test_node_01", base=processor)
    await test_node.start()
    print(f"[SYSTEM] 노드({test_node.node_id}) 구동 완료. 테스트를 시작합니다.")

    # -----------------------------------------------------------
    # [수정 구역 3] 테스트 케이스 작성 구역
    # 이곳에 본인 노드에 입력될 예상 데이터를 넣고 반응을 테스트하세요.
    # -----------------------------------------------------------
    
    await send_test_request(test_node, "딕셔너리 페이로드 테스트", {
        "query": "안녕하세요",
        "user_id": "test_user_123"
    })

    await send_test_request(test_node, "문자열 페이로드 테스트", "이것은 단순 문자열입니다.")

    # 3. 테스트 종료 및 자원 정리
    await test_node.stop()
    print("\n=== 범용 커스텀 노드 로컬 테스트 완료 ===")

if __name__ == "__main__":
    asyncio.run(main())

```