# API Specification (Frontend-Backend Bridge)

본 문서는 `frontend/src/js/api.js`와 `backend/facade.py` 사이의 모든 API 엔드포인트와 데이터 형식을 정의합니다. 모든 통신은 JSON 형식을 기본으로 하며, 스트리밍 응답과 파일 업로드의 경우에만 예외를 둡니다.

---

## 1. 인증 및 계정 (Authentication & Account)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `login` | `POST /api/auth/login` | Body: `{id, pw}` | `{status, user: {id, name}}` | 일반 사용자 로그인 |
| `guestLogin` | `POST /api/auth/guest` | None | `{status, user: {id, name}}` | 익명 게스트 로그인 |
| `socialLogin` | `POST /api/auth/social/{provider}` | Path: `provider` (google 등) | `{status, redirect}` | 소셜 로그인 연동 시작 |
| `signUp` | `POST /api/auth/signup` | Body: `{username, email, password}` | `{status, message}` | 신규 회원 가입 |
| `findAccount` | `POST /api/auth/find` | None | `{status, message}` | 비밀번호/계정 찾기 요청 |
| `fetchAccountInfo`| `GET /api/account` | None | `{status, data}` | 현재 로그인된 계정 정보 조회 |

---

## 2. 초기 설정 및 컨텍스트 (Context & Settings)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `fetchAppContext` | `GET /api/context` | None | `{today, settings: {theme, ...}}`| 앱 구동 시 초기 환경 설정 데이터 |
| `fetchSettings` | `GET /api/settings` | None | `{status, data}` | 사용자 상세 UI 설정 조회 |
| `saveUserSetting` | `POST /api/settings/update` | Body: `{ [key]: value }` | `{status}` | 개별 UI 설정값 저장 |
| `saveThemePreference`| `POST /api/theme` | Body: `{theme: "name"}` | `{status}` | 사용자 테마 선호도 저장 |

---

## 3. 세션 관리 (Session Management)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `fetchSessionList`| `GET /api/sessions` | Query: `mode` (personal/team) | `[{id, title}, ...]` | 채팅 세션 목록 조회 |
| `createSession` | `POST /api/sessions` | Body: `{first_message, mode}` | `{id, title}` | 신규 채팅 세션 생성 |
| `updateSessionTitle`| `PUT /api/sessions/{id}/title`| Path: `id`, Body: `{title}` | `{success, title}` | 세션 이름(제목) 수동 변경 |
| `deleteSession` | `DELETE /api/sessions/{id}` | Path: `id` | `{success, message}` | 특정 세션 완전 삭제 |
| `updateSessionMode` | `PUT /api/sessions/{id}/mode` | Path: `id`, Body: `{mode}` | `{success, mode}` | 세션 모드 변경(개인 <-> 팀) |

---

## 4. 채팅 및 메시지 (Chat & Messaging)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `fetchChatHistory`| `GET /api/sessions/{id}/history`| Path: `id` | `[{role, content}, ...]` | 세션의 과거 대화 내역 전체 조회 |
| `sendMessage` | `POST /api/sessions/{id}/message`| Path: `id`, Body: `{message}` | `Streaming Text` | 메시지 전송 및 봇 응답 스트리밍 |
| `uploadFiles` | `POST /api/sessions/{id}/files` | Path: `id`, Body: `FormData` | `{success, uploaded_files: []}`| 채팅 중 파일 업로드 (첨부) |
| `downloadChat` | `GET /api/sessions/{id}/download`| Path: `id` | `File (chat.txt)` | 대화 내역을 텍스트 파일로 다운로드 |
| `shareChat` | `POST /api/sessions/{id}/share` | Path: `id` | `{success, share_url}` | 현재 대화 공유용 링크 생성 |
| `inviteUserToSession`| `POST /api/sessions/{id}/invite`| Path: `id`, Body: `{user: "id"}` | `{success, user}` | 팀 세션에 다른 사용자 초대 |

---

## 5. 지도 마커 (Map Markers)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `saveMapMarkers` | `POST /api/sessions/{id}/map/markers`| Path: `id`, Body: `{markers: []}`| `{success}` | 해당 세션의 지도 마커 데이터 저장 |
| `fetchMapMarkers`| `GET /api/sessions/{id}/map/markers`| Path: `id` | `{markers: []}` | 해당 세션의 저장된 지도 마커 조회 |

---

## 6. 캘린더 및 플래너 (Calendar & Planner)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `saveMemo` | `PUT /api/sessions/{id}/memo` | Path: `id`, Query: `date`, Body: `{memo}`| `{success}` | 특정 날짜의 메모(일기) 저장 |
| `fetchMemo` | `GET /api/sessions/{id}/memo` | Path: `id`, Query: `date` | `{memo: ""}` | 특정 날짜의 메모 조회 |
| `updateSchedule` | `PUT /api/sessions/{id}/plan` | Path: `id`, Query: `date`, Body: `{plan: []}`| `{success}` | 특정 날짜의 여행 일정(Plan) 저장 |
| `fetchSchedule` | `GET /api/sessions/{id}/plan` | Path: `id`, Query: `date` | `{plan: []}` | 특정 날짜의 여행 일정 조회 |
| `fetchMonthDataIndicators`| `GET /api/sessions/{id}/indicators`| Path: `id`, Query: `year, month`| `["YYYY-MM-DD", ...]` | 데이터가 있는 날짜 목록(점 표시용) |

---

## 7. 기타 유틸리티 (Miscellaneous)

| 기능 명칭 (JS 함수) | 엔드포인트 (Method / URL) | 입력 데이터 (Path/Query/Body) | 출력 데이터 (Response) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `fetchCurrentWeather`| `GET /api/weather` | None | `{type, params: {}}` | 현재 날씨 정보 (애니메이션 테마용) |
| `fetchHelpData` | `GET /api/help` | None | `{status, data}` | 앱 사용 가이드 및 도움말 조회 |
