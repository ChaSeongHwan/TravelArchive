/**
 * mapOverlayControls.js
 *
 * 카카오맵 오버레이 컨트롤 패널 모듈.
 *
 * 반응형 전략
 *  CSS 클래스 토글 대신 JS 인라인 스타일을 직접 주입해
 *  브라우저 CSS 우선순위 문제를 완전히 차단합니다.
 *
 *  · 컨테이너 너비 ≥ 480px  →  vertical  (우측 중앙, 세로 배열)
 *  · 컨테이너 너비  < 480px  →  compact   (하단 중앙, 가로 pill)
 *
 * @module mapOverlayControls
 * export { initOverlayControls }
 */

// ─────────────────────────────────────────────────────────────────
//  상수
// ─────────────────────────────────────────────────────────────────
const COMPACT_BREAKPOINT = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 14;

// ─────────────────────────────────────────────────────────────────
//  SVG 아이콘
// ─────────────────────────────────────────────────────────────────
const ICONS = {
  traffic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round">
    <rect x="9" y="1" width="6" height="22" rx="3"/>
    <circle cx="12" cy="6"  r="1.6" fill="#ef4444" stroke="none"/>
    <circle cx="12" cy="12" r="1.6" fill="#f59e0b" stroke="none"/>
    <circle cx="12" cy="18" r="1.6" fill="#22c55e" stroke="none"/>
  </svg>`,

  satellite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 20.5l4-4"/>
    <path d="M7.5 16.5L4 13l3-3 3.5 3.5"/>
    <path d="M13 7.5L9.5 4l3-3 3.5 3.5"/>
    <path d="M20.5 3.5l-4 4"/>
    <path d="M16.5 7.5l3.5 3.5-3 3-3.5-3.5"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="M7.5 7.5l9 9" stroke-dasharray="2 2"/>
  </svg>`,

  bicycle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="5.5"  cy="17.5" r="3.5"/>
    <circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6h-5l-1.5 5.5 5 3 2-8.5z"/>
    <path d="M5.5 17.5l4-5.5"/>
    <path d="M18.5 17.5L15 9l-4.5 3"/>
    <circle cx="15" cy="5" r="1"/>
  </svg>`,

  zoomIn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round">
    <line x1="12" y1="5"  x2="12" y2="19"/>
    <line x1="5"  y1="12" x2="19" y2="12"/>
  </svg>`,

  zoomOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`,
};

// ─────────────────────────────────────────────────────────────────
//  DOM 빌더 헬퍼
// ─────────────────────────────────────────────────────────────────
function el(tag, cls = '', attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

// ─────────────────────────────────────────────────────────────────
//  패널 DOM 생성
// ─────────────────────────────────────────────────────────────────
function buildPanel() {
  const panel = el('div', 'oc-panel', { id: 'overlay-panel' });

  // 레이어 섹션 레이블
  const layerLabel = el('span', 'oc-section-label');
  layerLabel.textContent = '레이어';
  panel.appendChild(layerLabel);

  // 레이어 버튼 – 지역구 제거됨
  const layerButtons = {};
  const LAYER_DEFS = [
    { id: 'traffic',   label: '교통량', icon: ICONS.traffic   },
    { id: 'satellite', label: '위성',   icon: ICONS.satellite },
    { id: 'bicycle',   label: '자전거', icon: ICONS.bicycle   },
  ];

  LAYER_DEFS.forEach(({ id, label, icon }) => {
    const wrap = el('div', 'oc-btn-wrap');
    const btn  = el('button', 'oc-btn', { 'data-layer': id, title: label });
    btn.innerHTML = icon;
    const tip = el('span', 'oc-tooltip');
    tip.textContent = label;
    wrap.appendChild(btn);
    wrap.appendChild(tip);
    panel.appendChild(wrap);
    layerButtons[id] = btn;
  });

  // 구분선
  panel.appendChild(el('div', 'oc-sep'));

  // 줌 섹션 레이블
  const zoomLabel = el('span', 'oc-section-label');
  zoomLabel.textContent = '줌';
  panel.appendChild(zoomLabel);

  // 줌 컨트롤
  const zoomWrap   = el('div', 'oc-zoom-wrap');
  const zoomInBtn  = el('button', 'oc-btn oc-zoom-btn', { title: '확대' });
  const levelDisp  = el('div', 'oc-zoom-level');
  const barTrack   = el('div', 'oc-bar-track');
  const barFill    = el('div', 'oc-bar-fill');
  const zoomOutBtn = el('button', 'oc-btn oc-zoom-btn', { title: '축소' });

  zoomInBtn.innerHTML  = ICONS.zoomIn;
  zoomOutBtn.innerHTML = ICONS.zoomOut;
  levelDisp.textContent = '8';
  barTrack.appendChild(barFill);

  [zoomInBtn, levelDisp, barTrack, zoomOutBtn].forEach(c => zoomWrap.appendChild(c));
  panel.appendChild(zoomWrap);

  return { panel, layerButtons, zoomInBtn, zoomOutBtn, levelDisp, barFill, zoomWrap };
}

// ─────────────────────────────────────────────────────────────────
//  레이어 로직
// ─────────────────────────────────────────────────────────────────
function bindLayerLogic(map, layerButtons) {
  const state          = {};
  const activeOverlays = new Set();

  function reapply() {
    if (activeOverlays.has('traffic')) map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
    if (activeOverlays.has('bicycle')) map.addOverlayMapTypeId(kakao.maps.MapTypeId.BICYCLE);
  }

  const handlers = {
    traffic:   {
      on()  { map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);          activeOverlays.add('traffic');    },
      off() { map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);        activeOverlays.delete('traffic'); },
    },
    satellite: {
      on()  { map.setMapTypeId(kakao.maps.MapTypeId.HYBRID);  reapply(); },
      off() { map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP); reapply(); },
    },
    bicycle:   {
      on()  { map.addOverlayMapTypeId(kakao.maps.MapTypeId.BICYCLE);           activeOverlays.add('bicycle');    },
      off() { map.removeOverlayMapTypeId(kakao.maps.MapTypeId.BICYCLE);        activeOverlays.delete('bicycle'); },
    },
  };

  Object.entries(layerButtons).forEach(([id, btn]) => {
    state[id] = false;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state[id] = !state[id];
      btn.classList.toggle('oc-btn--active', state[id]);
      state[id] ? handlers[id].on() : handlers[id].off();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  줌 로직
// ─────────────────────────────────────────────────────────────────
function bindZoomLogic(map, { zoomInBtn, zoomOutBtn, levelDisp, barFill }) {
  let isCompact = false;

  function updateZoomUI() {
    const lv  = map.getLevel();
    // 카카오맵 줌 레벨에 비례하여 게이지바의 퍼센티지(%) 계산
    const pct = ((MAX_ZOOM - lv) / (MAX_ZOOM - MIN_ZOOM)) * 100;
    levelDisp.textContent = lv;
    
    // 최소/최대 줌 도달 시 버튼 비활성화 처리
    zoomInBtn.disabled    = lv <= MIN_ZOOM;
    zoomOutBtn.disabled   = lv >= MAX_ZOOM;

    // 컴팩트 모드(가로 배열)일 땐 width 조절, 일반 모드(세로 배열)일 땐 height 조절
    if (isCompact) {
      barFill.style.width  = `${pct}%`;
      barFill.style.height = '100%';
    } else {
      barFill.style.height = `${pct}%`;
      barFill.style.width  = '100%';
    }
  }

  // 줌 버튼 클릭 시 애니메이션 적용 ({ animate: true })
  zoomInBtn.addEventListener('click',  e => { e.stopPropagation(); map.setLevel(map.getLevel() - 1, { animate: true }); });
  zoomOutBtn.addEventListener('click', e => { e.stopPropagation(); map.setLevel(map.getLevel() + 1, { animate: true }); });
  
  // 마우스 휠이나 터치로 지도를 확대/축소할 때 UI 게이지바 동기화
  kakao.maps.event.addListener(map, 'zoom_changed', updateZoomUI);

  return {
    update:     updateZoomUI,
    setCompact: (v) => { isCompact = v; updateZoomUI(); },
  };
}

// ─────────────────────────────────────────────────────────────────
//  반응형 – JS 인라인 스타일로 직접 위치 제어
// ─────────────────────────────────────────────────────────────────
function applyLayout(container, panel, zoomWrap, zoomCtrl) {
  const w         = container.getBoundingClientRect().width;
  const isCompact = w < COMPACT_BREAKPOINT;
  // 너비가 480px 미만이면 하단 중앙 가로(Pill) 형태로 변경, 이상이면 우측 중앙 세로 형태로 배치
  if (isCompact) {
    Object.assign(panel.style, {
      flexDirection: 'row',
      flexWrap:      'nowrap',
      top:           'auto',
      right:         'auto',
      bottom:        '14px',
      left:          '50%',
      transform:     'translateX(-50%)',
      borderRadius:  '40px',
      padding:       '6px 10px',
    });
    zoomWrap.style.flexDirection = 'row';
    const track = zoomWrap.querySelector('.oc-bar-track');
    if (track) Object.assign(track.style, { width: '36px', height: '3px' });
    panel.querySelectorAll('.oc-section-label').forEach(l => { l.style.display = 'none'; });
    const sep = panel.querySelector('.oc-sep');
    if (sep) Object.assign(sep.style, { width: '1px', height: '22px', margin: '0 4px' });
    panel.querySelectorAll('.oc-btn').forEach(b => {
      Object.assign(b.style, { width: '34px', height: '34px', borderRadius: '50%' });
    });
  } else {
    Object.assign(panel.style, {
      flexDirection: 'column',
      top:           '50%',
      right:         '14px',
      bottom:        'auto',
      left:          'auto',
      transform:     'translateY(-50%)',
      borderRadius:  '16px',
      padding:       '10px 8px',
    });
    zoomWrap.style.flexDirection = 'column';
    const track = zoomWrap.querySelector('.oc-bar-track');
    if (track) Object.assign(track.style, { width: '3px', height: '36px' });
    panel.querySelectorAll('.oc-section-label').forEach(l => { l.style.display = ''; });
    const sep = panel.querySelector('.oc-sep');
    if (sep) Object.assign(sep.style, { width: '28px', height: '1px', margin: '4px 0' });
    panel.querySelectorAll('.oc-btn').forEach(b => {
      Object.assign(b.style, { width: '38px', height: '38px', borderRadius: '10px' });
    });
  }

  zoomCtrl.setCompact(isCompact);
}

// 부모 컨테이너 크기 변화를 실시간으로 감지
function bindResponsive(container, panel, zoomWrap, zoomCtrl) {
  const run = () => applyLayout(container, panel, zoomWrap, zoomCtrl);
  const ro  = new ResizeObserver(run);
  ro.observe(container);
  run();
  return () => ro.disconnect();
}

// ─────────────────────────────────────────────────────────────────
//  공개 API
// ─────────────────────────────────────────────────────────────────
/**
 * @param {kakao.maps.Map} map
 * @param {HTMLElement}    container  지도 컨테이너 (#map)
 * @returns {{ destroy: Function }}
 */
export function initOverlayControls(map, container) {
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const { panel, layerButtons, zoomInBtn, zoomOutBtn, levelDisp, barFill, zoomWrap } = buildPanel();

  bindLayerLogic(map, layerButtons);
  const zoomCtrl = bindZoomLogic(map, { zoomInBtn, zoomOutBtn, levelDisp, barFill });

  container.appendChild(panel);

  const disconnect = bindResponsive(container, panel, zoomWrap, zoomCtrl);
  zoomCtrl.update();

  return {
    destroy() {
      disconnect();
      panel.remove();
    },
  };
}
