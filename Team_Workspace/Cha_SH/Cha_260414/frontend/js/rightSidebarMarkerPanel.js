/**
 * rightSidebarMarkerPanel.js  (부모 페이지 실행)
 *
 * iframe(map.html) 의 mapMarkerInfo.js 가 postMessage 로 보내는
 * MI_LOADING / MI_DATA / MI_ERROR / MI_HIDE 이벤트를 수신해
 * right-sidebar 하단에 장소 정보 카드를 열고 닫습니다.
 *
 * 사용법
 *   import { initRightSidebarMarkerPanel } from './rightSidebarMarkerPanel.js';
 *
 *   // right-sidebar 가 열릴 때 한 번만 호출
 *   const panel = initRightSidebarMarkerPanel({
 *     mapContainerEl: document.getElementById('kakaoMapContainer'),
 *   });
 *
 *   // 사이드바 닫을 때 정리
 *   panel.destroy();
 *
 * @module rightSidebarMarkerPanel
 */

// ─────────────────────────────────────────────────────────────────
//  헬퍼
// ─────────────────────────────────────────────────────────────────
function el(tag, cls = '', attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

// ─────────────────────────────────────────────────────────────────
//  패널 HTML 빌드
// ─────────────────────────────────────────────────────────────────
function buildPanel() {
  /*
   * 구조
   * #rs-mi-panel               ← grid 높이 트릭 래퍼 (접힘/펼침)
   *   .rs-mi-inner
   *     .rs-mi-card
   *       .rs-mi-header
   *       .rs-mi-body
   *       .rs-mi-footer
   */
  const panel = el('div', '', { id: 'rs-mi-panel', role: 'region', 'aria-label': '마커 위치 정보' });
  panel.innerHTML = `
    <div class="rs-mi-inner">
      <div class="rs-mi-card">

        <!-- 헤더 -->
        <div class="rs-mi-header">
          <div class="rs-mi-title-group">
            <span class="rs-mi-badge">📍 마커 위치</span>
            <h3 class="rs-mi-title" id="rs-mi-title">—</h3>
          </div>
          <button class="rs-mi-close" title="닫기" aria-label="닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- 바디 -->
        <div class="rs-mi-body">

          <!-- 스켈레톤 로딩 -->
          <div class="rs-mi-skeleton" id="rs-mi-skeleton">
            <div class="rs-mi-sk rs-mi-sk-80"></div>
            <div class="rs-mi-sk rs-mi-sk-60"></div>
            <div class="rs-mi-sk rs-mi-sk-70"></div>
          </div>

          <!-- 데이터 -->
          <ul class="rs-mi-list" id="rs-mi-list" hidden>
            <li class="rs-mi-item">
              <span class="rs-mi-icon">🛣</span>
              <div class="rs-mi-text">
                <span class="rs-mi-label">도로명 주소</span>
                <span class="rs-mi-value" id="rs-mi-road">—</span>
              </div>
            </li>
            <li class="rs-mi-item">
              <span class="rs-mi-icon">🏠</span>
              <div class="rs-mi-text">
                <span class="rs-mi-label">지번 주소</span>
                <span class="rs-mi-value" id="rs-mi-jibun">—</span>
              </div>
            </li>
            <li class="rs-mi-item">
              <span class="rs-mi-icon">🗺</span>
              <div class="rs-mi-text">
                <span class="rs-mi-label">행정구역</span>
                <span class="rs-mi-value" id="rs-mi-region">—</span>
              </div>
            </li>
            <li class="rs-mi-item">
              <span class="rs-mi-icon">📐</span>
              <div class="rs-mi-text">
                <span class="rs-mi-label">좌표</span>
                <span class="rs-mi-value rs-mi-mono" id="rs-mi-coord">—</span>
              </div>
            </li>
          </ul>

          <!-- 오류 -->
          <p class="rs-mi-error" id="rs-mi-error" hidden>
            주소 정보를 가져올 수 없습니다.
          </p>
        </div>

        <!-- 푸터 액션 -->
        <div class="rs-mi-footer">
          <button class="rs-mi-action" id="rs-mi-copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            좌표 복사
          </button>
          <button class="rs-mi-action rs-mi-action--primary" id="rs-mi-naver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            지도로 열기
          </button>
        </div>

      </div>
    </div>
  `;

  return panel;
}

// ─────────────────────────────────────────────────────────────────
//  패널 상태 컨트롤러
// ─────────────────────────────────────────────────────────────────
function createCtrl(panel) {
  const titleEl  = panel.querySelector('#rs-mi-title');
  const skeleton = panel.querySelector('#rs-mi-skeleton');
  const list     = panel.querySelector('#rs-mi-list');
  const errorEl  = panel.querySelector('#rs-mi-error');
  const roadEl   = panel.querySelector('#rs-mi-road');
  const jibunEl  = panel.querySelector('#rs-mi-jibun');
  const regionEl = panel.querySelector('#rs-mi-region');
  const coordEl  = panel.querySelector('#rs-mi-coord');
  const copyBtn  = panel.querySelector('#rs-mi-copy');
  const naverBtn = panel.querySelector('#rs-mi-naver');

  let lat = null;
  let lng = null;

  // 좌표 복사
  copyBtn.addEventListener('click', () => {
    if (lat == null) return;
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    
    const origHTML = copyBtn.innerHTML;
    copyBtn.textContent = '✓ 복사됨';
    setTimeout(() => { copyBtn.innerHTML = origHTML; }, 1800);
  });

  // 네이버 지도로 열기
  naverBtn.addEventListener('click', () => {
    if (lat == null) return;
    window.open(`https://map.naver.com/v5/?c=${lng},${lat},15,0,0,0,dh`, '_blank');
  });

  return {
    // 1. API 요청 시작: 기존 데이터를 숨기고 스켈레톤 애니메이션 노출
    loading() {
      titleEl.textContent = '조회 중…';
      skeleton.hidden = false;
      list.hidden     = true;
      errorEl.hidden  = true;
    },
    // 2. API 요청 성공: 스켈레톤을 숨기고 실제 데이터를 매핑
    data(payload) {
      lat = payload.lat;
      lng = payload.lng;
      skeleton.hidden = true;
      errorEl.hidden  = true;
      list.hidden     = false;

      // 도로명 > 지번 > 행정구역 순으로 폴백(Fallback)을 적용하여 메인 타이틀 결정
      titleEl.textContent  = payload.roadAddr || payload.jibunAddr || payload.regionText || '알 수 없는 위치';
      roadEl.textContent   = payload.roadAddr   || '정보 없음';
      jibunEl.textContent  = payload.jibunAddr  || '정보 없음';
      regionEl.textContent = payload.regionText || '정보 없음';
      coordEl.textContent  = `${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)}`;
    },
    // 3. API 에러 발생 시 처리
    error() {
      skeleton.hidden = true;
      list.hidden     = true;
      errorEl.hidden  = false;
      titleEl.textContent = '오류';
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  공개 API
// ─────────────────────────────────────────────────────────────────
/**
 * right-sidebar 의 지도 컨테이너 아래에 마커 정보 패널을 초기화합니다.
 *
 * @param {{ mapContainerEl: HTMLElement }} options
 *   mapContainerEl – #kakaoMapContainer 엘리먼트
 * @returns {{ destroy: Function }}
 */
export function initRightSidebarMarkerPanel({ mapContainerEl }) {
  const panel = buildPanel();
  const ctrl  = createCtrl(panel);

  // #kakaoMapContainer 바로 아래에 삽입
  mapContainerEl.insertAdjacentElement('afterend', panel);

  // ── 열기 / 닫기 ────────────────────────────────────────────────
  function open()  { panel.classList.add('rs-mi-open'); }
  function close() { panel.classList.remove('rs-mi-open'); }

  // ── 닫기 버튼 ──────────────────────────────────────────────────
  // () => close() 로 래핑 → Event 객체가 인자로 들어오지 않음
  panel.querySelector('.rs-mi-close').addEventListener('click', () => close());

  // ── postMessage 수신 ────────────────────────────────────────────
  function onMessage(e) {
    const { type, payload } = e.data ?? {};
    if (!type?.startsWith('MI_')) return;

    if      (type === 'MI_LOADING') { open();  ctrl.loading(); }
    else if (type === 'MI_DATA')    { open();  ctrl.data(payload); }
    else if (type === 'MI_ERROR')   { open();  ctrl.error(); }
    else if (type === 'MI_HIDE')    { close(); }
  }

  window.addEventListener('message', onMessage);

  return {
    destroy() {
      window.removeEventListener('message', onMessage);
      panel.remove();
    },
  };
}
