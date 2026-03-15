import aiohttp
from typing import Any, Optional
from src.node.base.base import BaseProcessor  # 실제 환경에서는 주석 해제 후 사용

class APIQueryProcessor(BaseProcessor):
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None

    async def on_start(self) -> None:
        self.session = aiohttp.ClientSession()

    async def on_stop(self) -> None:
        if self.session:
            await self.session.close()

    async def process(self, data: Any) -> Optional[Any]:
        if not self.session:
            self.signal("error", "HTTP session is not initialized.")
            return None

        try:
            # 1. 전달받은 데이터를 복사하여 원본 훼손 방지
            params = data.copy() if isinstance(data, dict) else {}
            
            # 2. 공공데이터포털 serviceKey 인코딩 충돌 우회 로직
            request_url = self.base_url
            if "serviceKey" in params:
                service_key = params.pop("serviceKey")
                # aiohttp가 파라미터를 강제 변환하지 못하게 URL 문자열에 직접 박아 넣습니다.
                separator = "&" if "?" in request_url else "?"
                request_url = f"{request_url}{separator}serviceKey={service_key}"
            
            # 3. serviceKey가 빠진 나머지 파라미터(pageNo, returnType 등)만 params로 넘김
            async with self.session.get(request_url, params=params) as response:
                if response.status == 200:
                    try:
                        return await response.json()
                    except aiohttp.ContentTypeError:
                        # 공공데이터포털은 에러 발생 시 강제로 XML을 뱉으므로 텍스트로 처리
                        return await response.text()
                else:
                    self.signal("error", f"API Request failed with status: {response.status}")
                    return None
                    
        except Exception as e:
            self.signal("error", f"API Connection Error: {str(e)}")
            return None