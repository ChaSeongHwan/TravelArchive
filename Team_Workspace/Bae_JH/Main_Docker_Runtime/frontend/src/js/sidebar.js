/**
 * sidebar.js
 * handles left and right sidebar toggling, resizing, and synchronization.
 */

export const SidebarManager = {
  isMobile: () => window.matchMedia('(max-width: 768px)').matches,
  mobileSidebarMode: () => window.matchMedia('(max-width: 560px)').matches ? 'hide' : 'peek',

  /**
   * syncs main content class based on mobile sidebar state.
   */
  syncContentState(elements) {
    const { mainContent, sidebar, rightSidebar } = elements;
    if (!this.isMobile()) {
      mainContent.classList.remove('content-obscured', 'content-glass-peek');
      return;
    }

    const leftOpen = sidebar.classList.contains('open');
    const rightOpen = rightSidebar.classList.contains('open');

    mainContent.classList.remove('content-obscured', 'content-glass-peek');
    if (leftOpen || rightOpen) {
      mainContent.classList.add(this.mobileSidebarMode() === 'hide' ? 'content-obscured' : 'content-glass-peek');
    }
  },

  /**
   * Generic open sidebar logic
   */
  _open(type, elements, config) {
    const isLeft = type === 'left';
    const sidebar = isLeft ? elements.sidebar : elements.rightSidebar;
    const overlay = isLeft ? elements.sidebarOverlay : elements.rightSidebarOverlay;
    const configKey = isLeft ? 'currentLeftWidth' : 'currentRightWidth';
    const bodyClass = isLeft ? 'left-open' : 'right-open';

    sidebar.classList.remove('collapsed');
    
    if (this.isMobile()) {
      // Close opposite sidebar on mobile
      if (isLeft) this.closeRightSidebar(elements, { silent: true });
      else this.closeSidebar(elements, { silent: true });

      sidebar.classList.add('open');
      elements.documentBody.classList.add(bodyClass);
      if (overlay) {
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => overlay.classList.add('show'));
      }
      this.syncContentState(elements);
    } else {
      sidebar.style.width = `${config[configKey]}px`;
    }

    if (!isLeft) {
      // Relayout map if exists
      setTimeout(() => {
        if (window.kakaoMap && typeof window.kakaoMap.relayout === 'function') {
          window.kakaoMap.relayout();
        }
      }, 310);
    }
  },

  /**
   * Generic close sidebar logic
   */
  _close(type, elements, options = {}) {
    const isLeft = type === 'left';
    const sidebar = isLeft ? elements.sidebar : elements.rightSidebar;
    const overlay = isLeft ? elements.sidebarOverlay : elements.rightSidebarOverlay;
    const bodyClass = isLeft ? 'left-open' : 'right-open';
    const { silent = false } = options;

    sidebar.classList.add('collapsed');
    if (this.isMobile()) {
      sidebar.classList.remove('open');
      elements.documentBody.classList.remove(bodyClass);
      if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => { overlay.classList.add('hidden'); }, 300);
      }
      if (!silent) this.syncContentState(elements);
    } else {
      sidebar.style.width = '';
    }
  },

  openSidebar(elements, config) { this._open('left', elements, config); },
  closeSidebar(elements, options) { this._close('left', elements, options); },
  openRightSidebar(elements, config) { this._open('right', elements, config); },
  closeRightSidebar(elements, options) { this._close('right', elements, options); },

  /**
   * initializes sidebar tabs.
   */
  initTabs(elements) {
    const { tabSessions, tabCalendar, sessionView, calendarView, sessionHeaderControls, calendarHeaderControls } = elements;
    if (!tabSessions || !tabCalendar) return;

    const switchTab = (activeTab, inactiveTab, showView, hideView, showHeader, hideHeader) => {
      activeTab.classList.add('active');
      inactiveTab.classList.remove('active');
      showView.style.display = 'flex';
      hideView.style.display = 'none';
      showHeader.style.display = 'block';
      hideHeader.style.display = 'none';
      
      if (activeTab === tabCalendar) {
        // Recalculate all memo heights when showing calendar tab
        setTimeout(() => this.adjustAllMemoHeights(), 0);
      }
    };

    tabSessions.addEventListener('click', () => switchTab(tabSessions, tabCalendar, sessionView, calendarView, sessionHeaderControls, calendarHeaderControls));
    tabCalendar.addEventListener('click', () => switchTab(tabCalendar, tabSessions, calendarView, sessionView, calendarHeaderControls, sessionHeaderControls));

    if (tabSessions.classList.contains('active')) {
      sessionView.style.display = 'flex';
      calendarView.style.display = 'none';
      sessionHeaderControls.style.display = 'block';
      calendarHeaderControls.style.display = 'none';
    } else {
      calendarView.style.display = 'flex';
      sessionView.style.display = 'none';
      calendarHeaderControls.style.display = 'block';
      sessionHeaderControls.style.display = 'none';
      setTimeout(() => this.adjustAllMemoHeights(), 0);
    }
  },

  adjustAllMemoHeights() {
    const textareas = document.querySelectorAll('.memo-input-flat');
    textareas.forEach(textarea => {
      textarea.style.height = '1px';
      textarea.style.height = (textarea.scrollHeight) + 'px';
    });
  },

  /**
   * initializes folding and row management.
   */
  initFolding(elements) {
    const isSmallHeight = window.innerHeight < 850;

    const setupFolding = (btn, content, forceCollapse = false) => {
      if (!btn || !content) return;
      
      // 해당 섹션 내의 +/- 버튼들 찾기
      const header = btn.parentElement;
      const rowButtons = header ? header.querySelectorAll('.row-action-btn') : [];

      const toggle = (collapse) => {
        content.classList.toggle('section-content-collapsed', collapse);
        btn.classList.toggle('collapsed', collapse);
        btn.title = collapse ? '펴기' : '접기';
        content.style.display = collapse ? 'none' : 'block';
        
        // +/- 버튼들의 활성/비활성 상태 시각적 동기화
        rowButtons.forEach(rowBtn => {
          rowBtn.classList.toggle('disabled', collapse);
        });
      };

      btn.addEventListener('click', () => {
        const currentlyCollapsed = content.classList.contains('section-content-collapsed');
        toggle(!currentlyCollapsed);
      });

      // 초기 상태 설정
      if (forceCollapse) {
        toggle(true);
      }
    };

    setupFolding(elements.toggleCalendarBtn, elements.calendarContent, isSmallHeight);
    setupFolding(elements.toggleScheduleBtn, elements.scheduleContent, isSmallHeight);
    setupFolding(elements.toggleMemoBtn, elements.memoContent, isSmallHeight);

    // Row management for Memo
    this.initMemoRows(elements);
    // Row management for Schedule (assuming it's a table or list)
    this.initScheduleRows(elements);
  },

  initMemoRows(elements) {
    const tableBody = document.getElementById('memoTableBody');
    if (!tableBody) return;

    const adjustHeight = (textarea) => {
      textarea.style.height = '1px'; // 강제 리셋 후 높이 계산
      textarea.style.height = (textarea.scrollHeight) + 'px';
    };

    const createRow = (index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width: 32px; padding-top: 10px; text-align: center; color: rgba(31, 41, 55, 0.4); font-size: 11px; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.05);">${index}</td>
        <td>
          <textarea class="memo-input-flat" placeholder="메모를 입력하세요..." rows="1"></textarea>
        </td>
      `;
      const textarea = tr.querySelector('textarea');
      // 글을 쓸 때 높이 조절
      textarea.addEventListener('input', () => adjustHeight(textarea));
      // 시프트+엔터 등 줄바꿈 시 즉시 조절
      textarea.addEventListener('keydown', () => setTimeout(() => adjustHeight(textarea), 0));
      
      // 초기 높이 설정 - CSS의 34px에 맞춤
      setTimeout(() => {
        textarea.style.height = '34px';
        adjustHeight(textarea);
      }, 0);
      return tr;
    };

    // 초기 5줄 생성
    tableBody.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      tableBody.appendChild(createRow(i));
    }

    // 줄 추가/삭제 버튼 직접 연결 (elements가 늦게 로드될 경우 대비)
    const addBtn = document.getElementById('addMemoRowBtn');
    const removeBtn = document.getElementById('removeMemoRowBtn');

    addBtn?.addEventListener('click', () => {
      // 접힌 상태라면 무시
      if (elements.memoContent?.classList.contains('section-content-collapsed')) return;
      
      const nextIndex = tableBody.querySelectorAll('tr').length + 1;
      tableBody.appendChild(createRow(nextIndex));
    });

    removeBtn?.addEventListener('click', () => {
      // 접힌 상태라면 무시
      if (elements.memoContent?.classList.contains('section-content-collapsed')) return;
      
      const rows = tableBody.querySelectorAll('tr');
      if (rows.length > 5) {
        tableBody.removeChild(rows[rows.length - 1]);
      }
    });
  },

  initScheduleRows(elements) {
    const addBtn = document.getElementById('addScheduleRowBtn');
    const removeBtn = document.getElementById('removeScheduleRowBtn');
    const container = elements.scheduleContent;

    addBtn?.addEventListener('click', () => {
      // 접힌 상태라면 무시
      if (container?.classList.contains('section-content-collapsed')) return;
      
      const list = container.querySelector('tbody') || container;
      if (list && list.children.length > 0) {
        const lastRow = list.lastElementChild;
        const newRow = lastRow.cloneNode(true);
        newRow.querySelectorAll('input, td:not(:first-child)').forEach(el => {
          if (el.tagName === 'INPUT') el.value = '';
          else if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) el.textContent = '';
        });
        list.appendChild(newRow);
      }
    });

    removeBtn?.addEventListener('click', () => {
      // 접힌 상태라면 무시
      if (container?.classList.contains('section-content-collapsed')) return;
      
      const list = container.querySelector('tbody') || container;
      if (list && list.children.length > 1) {
        list.removeChild(list.lastElementChild);
      }
    });
  },

  /**
   * Generic Resizer Logic
   */
  initResizers(elements, config) {
    const setupResizer = (resizer, target, side) => {
      if (!resizer) return;
      
      let isDragging = false;
      let startX = 0;
      let startWidth = 0;
      const configKey = side === 'left' ? 'currentLeftWidth' : 'currentRightWidth';

      resizer.addEventListener('mousedown', (e) => {
        if (this.isMobile()) return;
        isDragging = true;
        startX = e.clientX;
        startWidth = target.getBoundingClientRect().width;
        target.classList.add('notransition');
        resizer.classList.add('active');
        elements.documentBody.style.userSelect = 'none';
        elements.documentBody.style.cursor = 'col-resize';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
        let newWidth = startWidth + delta;

        // Constraint logic
        const minMiddleWidth = Math.max(400, window.innerWidth * 0.3);
        const oppositeWidth = (side === 'left' ? elements.rightSidebar : elements.sidebar).getBoundingClientRect().width;
        
        // Use 1/3 only as a preference on wide screens, but always allow at least 300px
        const maxAllowedByMiddle = window.innerWidth - oppositeWidth - minMiddleWidth;
        const maxAllowedByThird = window.innerWidth / 3;
        
        // On very narrow screens, we must allow the sidebar to reach its minimum usable width (300px)
        const maxAllowed = Math.max(300, Math.min(maxAllowedByMiddle, maxAllowedByThird));

        newWidth = Math.max(300, Math.min(newWidth, maxAllowed));
        
        target.style.width = `${newWidth}px`;
        config[configKey] = newWidth;
      });

      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        target.classList.remove('notransition');
        resizer.classList.remove('active');
        elements.documentBody.style.userSelect = '';
        elements.documentBody.style.cursor = '';
        localStorage.setItem(side === 'left' ? 'leftSidebarCustomWidth' : 'rightSidebarCustomWidth', config[configKey]);
        if (side === 'right' && window.kakaoMap) window.kakaoMap.relayout();
      });
    };

    setupResizer(elements.leftSidebarResizer, elements.sidebar, 'left');
    setupResizer(elements.rightSidebarResizer, elements.rightSidebar, 'right');
  }
};
