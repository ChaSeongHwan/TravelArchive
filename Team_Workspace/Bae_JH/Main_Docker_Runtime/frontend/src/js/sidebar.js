/**
 * sidebar.js
 * handles left and right sidebar toggling, resizing, and synchronization.
 */
import { BackendHooks } from './api.js';
import { CalendarManager } from './calendar.js';

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

export const SidebarManager = {
  // Fix Item 9: Increased threshold to 1024px (tablet) for better narrow-screen handling
  isMobile: () => window.innerWidth <= 1024,
  mobileSidebarMode: () => window.innerWidth <= 560 ? 'hide' : 'peek',

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
      const MIN_CONTENT = 600; // 본문 폭 최소 600px 사수
      const MAX_SIDEBAR_PCT = 0.5; // 화면의 50%를 넘지 않음
      let requestedWidth = config[configKey];
      const oppositeSidebar = isLeft ? elements.rightSidebar : elements.sidebar;
      
      // 반대편 사이드바 상태 체크
      const isOppositeOpen = !oppositeSidebar.classList.contains('collapsed');
      const oppositeWidth = isOppositeOpen ? (isLeft ? (elements.rightSidebar.offsetWidth || config.currentRightWidth) : (elements.sidebar.offsetWidth || config.currentLeftWidth)) : 0;
      
      // 1. 화면 50% 제약 적용
      const maxByScreen = window.innerWidth * MAX_SIDEBAR_PCT;
      requestedWidth = Math.min(requestedWidth, maxByScreen);

      // 2. 본문 600px 사수 로직
      if (requestedWidth + oppositeWidth > window.innerWidth - MIN_CONTENT) {
          if (isOppositeOpen) {
              if (isLeft) this.closeRightSidebar(elements, { silent: true });
              else this.closeSidebar(elements, { silent: true });
          }
          
          if (requestedWidth > window.innerWidth - MIN_CONTENT) {
              requestedWidth = Math.max(300, window.innerWidth - MIN_CONTENT);
          }
      }

      sidebar.style.width = `${requestedWidth}px`;
    }

    if (!isLeft) {
      setTimeout(() => {
        if (window.kakaoMap && typeof window.kakaoMap.relayout === 'function') {
          window.kakaoMap.relayout();
        }
      }, 310);
    }

    setTimeout(() => {
      if (window.updatePlaceholder) window.updatePlaceholder();
    }, 310);
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
      sidebar.style.width = '0px'; // Explicitly set to 0 to avoid flex-basis interference
      setTimeout(() => { sidebar.style.width = ''; }, 310); // Clear after transition
    }

    setTimeout(() => {
      if (window.updatePlaceholder) window.updatePlaceholder();
    }, 310);
  },

  openSidebar(elements, config) { this._open('left', elements, config); },
  closeSidebar(elements, options) { this._close('left', elements, options); },
  openRightSidebar(elements, config) { this._open('right', elements, config); },
  closeRightSidebar(elements, options) { this._close('right', elements, options); },

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
        setTimeout(() => {
          this.adjustAllMemoHeights();
          CalendarManager.updateUI(); // Refresh dots
        }, 0);
      }
    };

    tabSessions.addEventListener('click', () => switchTab(tabSessions, tabCalendar, sessionView, calendarView, sessionHeaderControls, calendarHeaderControls));
    tabCalendar.addEventListener('click', () => switchTab(tabCalendar, tabSessions, calendarView, sessionView, calendarHeaderControls, sessionHeaderControls));

    // Initialize calendar callback
    CalendarManager.onDateSelect = (date) => {
        this.initMemoRows(elements);
        this.initScheduleRows(elements);
    };

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
      setTimeout(() => {
          this.adjustAllMemoHeights();
          CalendarManager.updateUI();
      }, 0);
    }
  },

  adjustAllMemoHeights() {
    const textareas = document.querySelectorAll('.memo-input-flat');
    textareas.forEach(textarea => {
      textarea.style.height = '1px';
      textarea.style.height = (textarea.scrollHeight) + 'px';
    });
  },

  initFolding(elements) {
    const isSmallHeight = window.innerHeight < 850;
    const setupFolding = (btn, content, forceCollapse = false) => {
      if (!btn || !content) return;
      const header = btn.closest('.section-header');
      const rowButtons = header ? header.querySelectorAll('.row-action-btn') : [];

      const toggle = (collapse) => {
        content.classList.toggle('section-content-collapsed', collapse);
        btn.classList.toggle('collapsed', collapse);
        btn.title = collapse ? '펴기' : '접기';
        
        if (!collapse) {
          // Fix: Recalculate heights when unfolding to prevent 1px height bug
          if (content.id === 'memoContent' || content.contains(document.getElementById('memoTableBody'))) {
            setTimeout(() => this.adjustAllMemoHeights(), 10);
          }
        }

        rowButtons.forEach(rowBtn => {
          rowBtn.classList.toggle('disabled', collapse);
          rowBtn.style.pointerEvents = collapse ? 'none' : 'auto';
          rowBtn.style.opacity = collapse ? '0.3' : '1'; 
        });
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyCollapsed = content.classList.contains('section-content-collapsed');
        toggle(!currentlyCollapsed);
      });

      if (forceCollapse) toggle(true);
    };

    setupFolding(elements.toggleCalendarBtn, elements.calendarContent, isSmallHeight);
    setupFolding(elements.toggleScheduleBtn, elements.scheduleContent, isSmallHeight);
    setupFolding(elements.toggleMemoBtn, elements.memoContent, isSmallHeight);

    // One-time event binding for row buttons
    this.bindRowActionButtons(elements);

    this.initMemoRows(elements);
    this.initScheduleRows(elements);
    this.initResizableWidgets();
  },

  initResizableWidgets() {
    const MIN_HEIGHT = 200;
    const targets = [
      document.querySelector('.memo-inner-scroll'),
      document.querySelector('.schedule-inner-scroll'),
    ];

    targets.forEach(el => {
      if (!el || el.closest('.widget-resizable')) return; // 중복 초기화 방지

      // wrapper로 감싸기
      const wrapper = document.createElement('div');
      wrapper.className = 'widget-resizable';
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);

      // 핸들 생성
      const handle = document.createElement('div');
      handle.className = 'widget-resize-handle';
      handle.title = '드래그하여 크기 조절';
      wrapper.appendChild(handle);

      let isDragging = false;
      let startY = 0;
      let startHeight = 0;

      handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeight = el.getBoundingClientRect().height;
        handle.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
        e.stopPropagation();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = e.clientY - startY;
        const sidebarView = el.closest('.sidebar-view');
        const maxHeight = sidebarView
          ? Math.max(MIN_HEIGHT, sidebarView.clientHeight - 80)
          : 500;
        const newHeight = Math.max(MIN_HEIGHT, Math.min(startHeight + delta, maxHeight));
        el.style.maxHeight = newHeight + 'px';
      });

      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        handle.classList.remove('dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      });
    });
  },

  bindRowActionButtons(elements) {
    const { addMemoRowBtn, removeMemoRowBtn, addScheduleRowBtn, removeScheduleRowBtn, memoContent, scheduleContent } = elements;
    const memoTableBody = document.getElementById('memoTableBody');
    const scheduleTableBody = document.getElementById('scheduleTableBody');

    const getSessionAndDate = () => {
        const selectedDate = CalendarManager.getSelectedDate();
        const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()+1}-${selectedDate.getDate()}`;
        const hashPart = window.location.hash.split('/chat/')[1] || 'default';
        const sessionId = hashPart.split('?')[0];
        return { sessionId, dateKey };
    };

    if (addMemoRowBtn) {
        addMemoRowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (addMemoRowBtn.classList.contains('disabled') || memoContent.classList.contains('section-content-collapsed')) return;
            const nextIndex = memoTableBody.querySelectorAll('tr').length + 1;
            memoTableBody.appendChild(this.createMemoRow(nextIndex, '', memoTableBody, getSessionAndDate));
        });
    }

    if (removeMemoRowBtn) {
        removeMemoRowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (removeMemoRowBtn.classList.contains('disabled') || memoContent.classList.contains('section-content-collapsed')) return;
            const rows = memoTableBody.querySelectorAll('tr');
            if (rows.length > 0) {
                memoTableBody.removeChild(rows[rows.length - 1]);
                this.saveMemos(memoTableBody, getSessionAndDate);
            }
        });
    }

    if (addScheduleRowBtn) {
        addScheduleRowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (addScheduleRowBtn.classList.contains('disabled') || scheduleContent.classList.contains('section-content-collapsed')) return;
            scheduleTableBody.appendChild(this.createScheduleRow('', '', scheduleTableBody, getSessionAndDate));
        });
    }

    if (removeScheduleRowBtn) {
        removeScheduleRowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (removeScheduleRowBtn.classList.contains('disabled') || scheduleContent.classList.contains('section-content-collapsed')) return;
            const rows = scheduleTableBody.querySelectorAll('tr');
            if (rows.length > 0) {
                scheduleTableBody.removeChild(rows[rows.length - 1]);
                this.saveSchedules(scheduleTableBody, getSessionAndDate);
            }
        });
    }
  },

  createMemoRow(index, content, tableBody, getInfo) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="width: 32px; padding-top: 8px; text-align: center; color: rgba(31, 41, 55, 0.4); font-size: 13px; font-weight: 400; font-family: inherit; line-height: 1.4; border-right: 1px solid rgba(255,255,255,0.05);">${index}</td>
      <td>
        <textarea class="memo-input-flat" placeholder="메모를 입력하세요..." rows="1">${content}</textarea>
      </td>
    `;
    const textarea = tr.querySelector('textarea');
    const adjustHeight = (t) => {
        t.style.height = '1px';
        t.style.height = (t.scrollHeight) + 'px';
    };
    textarea.addEventListener('input', () => {
        adjustHeight(textarea);
        this.saveMemos(tableBody, getInfo);
    });
    setTimeout(() => adjustHeight(textarea), 0);
    return tr;
  },

  saveMemos: debounce(async (tableBody, getInfo) => {
    const { sessionId, dateKey } = getInfo();
    const allMemos = Array.from(tableBody.querySelectorAll('textarea')).map(t => t.value).join('\n');
    await BackendHooks.saveMemo(sessionId, allMemos, dateKey);
    CalendarManager.refreshDots();
  }, 500),

  async initMemoRows(elements) {
    const tableBody = document.getElementById('memoTableBody');
    if (!tableBody) return;

    const selectedDate = CalendarManager.getSelectedDate();
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()+1}-${selectedDate.getDate()}`;
    const hashPart = window.location.hash.split('/chat/')[1] || 'default';
    const sessionId = hashPart.split('?')[0];

    const getInfo = () => ({ sessionId, dateKey });

    try {
        const data = await BackendHooks.fetchMemo(sessionId, dateKey);
        tableBody.innerHTML = '';
        const savedContent = data.memo || '';
        if (savedContent) {
            const lines = savedContent.split('\n');
            lines.forEach((line, i) => tableBody.appendChild(this.createMemoRow(i + 1, line, tableBody, getInfo)));
        } else {
            for (let i = 1; i <= 3; i++) tableBody.appendChild(this.createMemoRow(i, '', tableBody, getInfo));
        }
    } catch (e) {
        console.error("Failed to load memo:", e);
        tableBody.innerHTML = '';
        for (let i = 1; i <= 3; i++) tableBody.appendChild(this.createMemoRow(i, '', tableBody, getInfo));
    }
  },

  createScheduleRow(time, activity, tableBody, getInfo) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="schedule-time-input" value="${time}" placeholder="0900" maxlength="4" style="width:100%; background:transparent; border:none; color:inherit; font:inherit; outline:none;"></td>
      <td><input type="text" value="${activity}" placeholder="활동 입력" style="width:100%; background:transparent; border:none; color:inherit; font:inherit; outline:none;"></td>
    `;
    
    const timeInput = tr.querySelector('.schedule-time-input');
    timeInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 4) val = val.substring(0, 4);
      e.target.value = val;
    });

    tr.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            this.saveSchedules(tableBody, getInfo);
        });
    });
    return tr;
  },

  saveSchedules: debounce(async (tableBody, getInfo) => {
    const { sessionId, dateKey } = getInfo();
    const plan = Array.from(tableBody.querySelectorAll('tr')).map(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length < 2) return null;
        return { time: inputs[0].value, activity: inputs[1].value };
    }).filter(p => p !== null);
    await BackendHooks.updateSchedule(sessionId, plan, dateKey);
    CalendarManager.refreshDots();
  }, 500),

  async initScheduleRows(elements) {
    const tableBody = document.getElementById('scheduleTableBody');
    if (!tableBody) return;

    const selectedDate = CalendarManager.getSelectedDate();
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()+1}-${selectedDate.getDate()}`;
    const hashPart = window.location.hash.split('/chat/')[1] || 'default';
    const sessionId = hashPart.split('?')[0];
    const getInfo = () => ({ sessionId, dateKey });

    try {
        const data = await BackendHooks.fetchSchedule(sessionId, dateKey);
        tableBody.innerHTML = '';
        const savedPlan = data.plan || [];
        if (savedPlan.length > 0) {
            savedPlan.forEach(p => tableBody.appendChild(this.createScheduleRow(p.time, p.activity, tableBody, getInfo)));
        } else {
            tableBody.appendChild(this.createScheduleRow('', '', tableBody, getInfo));
        }
    } catch (e) {
        console.error("Failed to load schedule:", e);
        tableBody.innerHTML = '';
    }
  },

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
        
        // Fix Item 14: Shield iframe to prevent mouse event loss
        const mapFrame = document.getElementById('mapFrame');
        if (mapFrame) {
            mapFrame.style.pointerEvents = 'none';
            mapFrame.classList.add('resizing');
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
        const MIN_CONTENT = 600;
        const MAX_SIDEBAR_PCT = 0.5;
        const oppositeSidebar = side === 'left' ? elements.rightSidebar : elements.sidebar;
        const oppositeWidth = oppositeSidebar.getBoundingClientRect().width;

        // 최대 허용 폭: (전체 화면 - 반대편 - 최소 본문폭) 과 (전체 화면의 50%) 중 더 작은 값
        const maxAllowed = Math.min(
            window.innerWidth - oppositeWidth - MIN_CONTENT,
            window.innerWidth * MAX_SIDEBAR_PCT
        );
        
        let newWidth = Math.max(300, Math.min(startWidth + delta, Math.max(300, maxAllowed)));
        
        target.style.width = newWidth + 'px';
        config[configKey] = newWidth;
        if (window.updatePlaceholder) window.updatePlaceholder();

        // Fix Item 13: Live relayout only
        if (side === 'right') {
            const mapFrame = document.getElementById('mapFrame');
            if (mapFrame && mapFrame.contentWindow) {
                mapFrame.contentWindow.postMessage({ type: 'relayout' }, '*');
            }
        }
      });

      document.addEventListener('mouseup', async () => {
        if (!isDragging) return;
        isDragging = false;
        target.classList.remove('notransition');
        resizer.classList.remove('active'); // 파란색 바 사라짐
        elements.documentBody.style.userSelect = '';
        elements.documentBody.style.cursor = '';

        // Restore iframe pointer events
        const mapFrame = document.getElementById('mapFrame');
        if (mapFrame) {
            mapFrame.style.pointerEvents = 'auto';
            mapFrame.classList.remove('resizing');
            if (side === 'right' && mapFrame.contentWindow) {
                // Fix Item 13: 파란색 바가 사라지는 그 지점에서 최종 중앙 정렬 수행
                mapFrame.contentWindow.postMessage({ type: 'recenter' }, '*');
            }
        }
        
        const key = side === 'left' ? 'leftSidebarCustomWidth' : 'rightSidebarCustomWidth';
        await BackendHooks.saveUserSetting(key, config[configKey]);
        if (window.updatePlaceholder) window.updatePlaceholder();
      });
    };

    setupResizer(elements.leftSidebarResizer, elements.sidebar, 'left');
    setupResizer(elements.rightSidebarResizer, elements.rightSidebar, 'right');
  }
};
