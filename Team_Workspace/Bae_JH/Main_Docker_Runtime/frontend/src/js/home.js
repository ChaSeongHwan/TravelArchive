/**
 * home.js
 * 로그인 후 홈 화면: 여행 카드 대시보드
 *
 * - 세션 목록을 카드 형태로 딜(deal) 애니메이션으로 표시
 * - 마지막 카드는 새 여행 시작 (+) 버튼
 */

import { BackendHooks, TokenManager } from './api.js';

/* ── 3D 캐러셀 ──────────────────────────────────────────────────
 *  마우스 드래그 / 휠 / 터치 지원
 *  카드를 position:absolute 로 배치하고 perspective + rotateY 로
 *  반원 아크 형태 연출. CSS overflow 클리핑 없이 전체 가시화.
 * ─────────────────────────────────────────────────────────────── */

/**
 * offset(실수): 0 = 첫 카드 중앙, 1 = 둘째 카드 중앙 ...
 * 각 카드에 3D 변환·불투명도·z-index 를 직접 설정.
 */
function _applyCarouselTransforms(track, offset) {
  const cards = [...track.querySelectorAll('.trip-card')];
  if (!cards.length) return;

  const cardW   = cards[0].offsetWidth;
  const halfW   = cardW / 2;
  const SPACING = cardW * 1.05 + 16;   // 카드 중심 간격 (간격 벌림)

  cards.forEach((card, i) => {
    const t      = i - offset;            // 중앙에서의 부호 있는 거리
    const absT   = Math.abs(t);
    const hov    = card.classList.contains('is-hovered');

    const tx      = t * SPACING - halfW;                        // left:50% 기준 X 이동
    const ty      = hov ? -8 : 0;                               // hover 시 위로 들어 올림
    const ry      = Math.sign(t) * Math.min(absT * 27, 55);   // rotateY (중심이 뒤, 원형 아크)
    const tz      = -(absT * absT * 20);                        // translateZ (원근 심화)
    const scale   = Math.max(0.58, 1 - absT * 0.20) * (hov ? 1.04 : 1);
    const opacity = Math.max(0.28, 1 - absT * 0.30);

    card.style.transform = `translateX(${tx}px) translateY(${ty}px) perspective(900px) rotateY(${ry}deg) translateZ(${tz}px) scale(${scale})`;
    card.style.opacity   = String(opacity);
    card.style.zIndex    = String(Math.round(50 - absT * 10));
  });
}

/** track 에 3D 캐러셀 이벤트를 붙이고 초기 배치·등장 애니메이션 실행 */
function _initCarousel(track) {
  const cards = [...track.querySelectorAll('.trip-card')];
  if (!cards.length) return;

  const N = cards.length;
  let offset      = 0;   // 시작: 항상 첫 번째(왼쪽) 카드 중앙
  let targetOff   = offset;
  let raf         = null;
  let pointerActive = false;
  let isDragging  = false;
  let wasDragging = false;
  let dragX0      = 0;
  let dragOff0    = offset;
  let velX        = 0;
  let prevX       = 0;
  let prevT       = 0;

  // ── 스냅·애니메이션 ─────────────────────────────────────────
  function snapNearest() {
    targetOff = Math.round(offset);
    targetOff = Math.max(0, Math.min(N - 1, targetOff));
    animate();
  }

  function animate() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function tick() {
      const diff = targetOff - offset;
      if (Math.abs(diff) < 0.003) {
        offset = targetOff;
        _applyCarouselTransforms(track, offset);
        return;
      }
      offset += diff * 0.18;
      _applyCarouselTransforms(track, offset);
      raf = requestAnimationFrame(tick);
    });
  }

  // ── 초기 배치 + 등장 애니메이션 ────────────────────────────
  // 먼저 투명하게 올바른 위치에 배치
  cards.forEach(card => { card.style.opacity = '0'; });
  _applyCarouselTransforms(track, offset);

  // stagger fade-in (딜 느낌)
  cards.forEach((card, i) => {
    setTimeout(() => {
      card.style.transition = 'opacity 0.32s ease';
      const t       = i - offset;
      const absT    = Math.abs(t);
      card.style.opacity = String(Math.max(0.28, 1 - absT * 0.30));
      setTimeout(() => { card.style.transition = ''; }, 360);
    }, 60 + i * 75);
  });

  // ── 마우스 드래그 ───────────────────────────────────────────
  track.addEventListener('pointerdown', e => {
    if (raf) cancelAnimationFrame(raf);
    pointerActive = true;
    isDragging    = false;
    wasDragging   = false;
    dragX0        = e.clientX;
    dragOff0      = offset;
    prevX         = e.clientX;
    prevT         = Date.now();
    velX          = 0;
    // setPointerCapture는 드래그 임계값 이후에만 → click 이벤트 카드에 정상 전달
  });

  track.addEventListener('pointermove', e => {
    if (!pointerActive) return;
    const dx = e.clientX - dragX0;
    if (!isDragging) {
      const threshold = e.pointerType === 'touch' ? 10 : 6;  // 터치는 더 관대하게
      if (Math.abs(dx) <= threshold) return;
      isDragging = true;
      track.setPointerCapture(e.pointerId);   // 드래그 확정 시점에만 캡처
      track.classList.add('dragging');
    }

    const now = Date.now();
    const dt  = now - prevT;
    if (dt > 0) velX = (prevX - e.clientX) / dt;
    prevX = e.clientX;
    prevT = now;

    const SPACING = cards[0].offsetWidth * 1.05 + 16;
    offset = dragOff0 - dx / SPACING;
    offset = Math.max(-0.45, Math.min(N - 0.55, offset));
    _applyCarouselTransforms(track, offset);
  });

  track.addEventListener('pointerup', () => {
    pointerActive = false;
    track.classList.remove('dragging');
    wasDragging = isDragging;
    isDragging  = false;
    if (!wasDragging) return;

    // 관성: 손가락 속도 반영
    const SPACING = cards[0].offsetWidth * 1.05 + 16;
    targetOff = Math.round(offset + (velX * 200) / SPACING);
    targetOff = Math.max(0, Math.min(N - 1, targetOff));
    animate();
  });

  track.addEventListener('pointercancel', () => {
    pointerActive = false;
    track.classList.remove('dragging');
    isDragging = wasDragging = false;
    snapNearest();
  });

  // 드래그 후 click 차단 (capture phase)
  track.addEventListener('click', e => {
    if (wasDragging) {
      e.stopPropagation();
      e.preventDefault();
      wasDragging = false;
    }
  }, true);

  // ── 마우스 휠 ───────────────────────────────────────────────
  track.addEventListener('wheel', e => {
    e.preventDefault();
    if (raf) cancelAnimationFrame(raf);
    const SPACING = cards[0].offsetWidth * 1.05 + 16;
    const delta   = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    offset += (delta / SPACING) * 0.85;
    offset  = Math.max(0, Math.min(N - 1, offset));
    _applyCarouselTransforms(track, offset);

    clearTimeout(track._wt);
    track._wt = setTimeout(snapNearest, 180);
  }, { passive: false });

  // ── hover: is-hovered 클래스로 JS 재계산 트리거 ─────────────
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.classList.add('is-hovered');
      _applyCarouselTransforms(track, offset);
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-hovered');
      _applyCarouselTransforms(track, offset);
    });
  });
}

const CARD_PALETTE = [
  { bg: 'rgba(219,234,254,0.72)', accent: '#2563eb', icon: '#3b82f6' },  // 블루
  { bg: 'rgba(220,252,231,0.72)', accent: '#16a34a', icon: '#22c55e' },  // 그린
  { bg: 'rgba(254,243,199,0.72)', accent: '#d97706', icon: '#f59e0b' },  // 앰버
  { bg: 'rgba(243,232,255,0.72)', accent: '#7c3aed', icon: '#a78bfa' },  // 퍼플
  { bg: 'rgba(255,228,230,0.72)', accent: '#e11d48', icon: '#fb7185' },  // 로즈
  { bg: 'rgba(224,242,254,0.72)', accent: '#0284c7', icon: '#38bdf8' },  // 스카이
];

const MAP_ICON = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>`;

function _cardHTML(session, idx) {
  const p = CARD_PALETTE[idx % CARD_PALETTE.length];
  const dateLabel = session.created_at
    ? session.created_at.replace(/-/g, '.').slice(0, 7)   // "YYYY.MM"
    : '';
  const modeLabel = session.mode === 'team' ? '팀 플래너' : '개인';

  return `
    <div class="trip-card" data-session-id="${session.id}" style="--i:${idx}; --card-bg:${p.bg}; --card-accent:${p.accent}; --card-icon:${p.icon}">
      <div class="trip-card-map-icon">${MAP_ICON}</div>
      <div class="trip-card-title">${session.title || '이름 없는 여행'}</div>
      <div class="trip-card-footer">
        <span class="trip-card-mode-badge">${modeLabel}</span>
        ${dateLabel ? `<span class="trip-card-date">${dateLabel}</span>` : ''}
      </div>
    </div>
  `;
}

export const HomeManager = {

  /**
   * @param {HTMLElement}  container    #homeDashboard
   * @param {Function}     onNewSession 새 세션 생성 콜백 (script.js에서 주입)
   */
  async render(container, onNewSession) {
    const nickname = TokenManager.getNickname();
    const sessions = await BackendHooks.fetchSessionList('personal');

    const cardsHTML = sessions.map((s, i) => _cardHTML(s, i)).join('');
    const newCardIdx = sessions.length;

    container.innerHTML = `
      <div class="home-dash">
        <div class="home-greeting">
          <span class="home-greeting-name">${nickname}</span>님의 여행 아카이브
        </div>

        <div class="trip-card-track">
          ${cardsHTML}

          <div class="trip-card trip-card-new" style="--i:${newCardIdx}">
            <div class="trip-card-new-plus">+</div>
            <div class="trip-card-new-label">새 여행 계획</div>
          </div>
        </div>
      </div>

      <div class="new-trip-overlay" id="newTripOverlay">
        <div class="new-trip-modal">
          <p class="new-trip-modal-title">어디로 떠나시고 싶으신가요?</p>
          <input class="new-trip-modal-input" id="newTripInput"
                 placeholder="목적지를 입력하세요" autocomplete="off" />
          <button class="new-trip-modal-submit" id="newTripSubmit" type="button">시작하기</button>
          <p class="new-trip-modal-hint">Enter로 시작 · Esc로 닫기</p>
        </div>
      </div>
    `;

    // 기존 세션 카드 클릭
    container.querySelectorAll('.trip-card[data-session-id]').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `#/chat/${card.dataset.sessionId}`;
      });
    });

    // 새 여행 (+) 카드 클릭 → 모달 열기
    const overlay    = container.querySelector('#newTripOverlay');
    const tripInput  = container.querySelector('#newTripInput');
    const submitBtn  = container.querySelector('#newTripSubmit');

    function openModal() {
      overlay.classList.add('visible');
      tripInput.value = '';
      setTimeout(() => tripInput.focus(), 60);
    }

    function closeModal() {
      overlay.classList.remove('visible');
    }

    function submitModal() {
      const dest = tripInput.value.trim();
      closeModal();
      onNewSession(dest || null);
    }

    container.querySelector('.trip-card-new').addEventListener('click', openModal);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });

    submitBtn.addEventListener('click', submitModal);

    tripInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        submitModal();
      }
    });

    // 캐러셀 초기화 (DOM 삽입 후 레이아웃 계산을 위해 한 프레임 대기)
    const track = container.querySelector('.trip-card-track');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => _initCarousel(track)); // 2-frame: 렌더 완료 보장
    });
  },

  clear(container) {
    container.innerHTML = '';
  },
};
