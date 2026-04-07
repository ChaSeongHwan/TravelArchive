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
      sidebar.style.width = '';
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
      const header = btn.parentElement;
      const rowButtons = header ? header.querySelectorAll('.row-action-btn') : [];

      const toggle = (collapse) => {
        content.classList.toggle('section-content-collapsed', collapse);
        btn.classList.toggle('collapsed', collapse);
        btn.title = collapse ? '펴기' : '접기';
        content.style.display = collapse ? 'none' : 'block';
        rowButtons.forEach(rowBtn => rowBtn.classList.toggle('disabled', collapse));
      };

      btn.addEventListener('click', () => {
        const currentlyCollapsed = content.classList.contains('section-content-collapsed');
        toggle(!currentlyCollapsed);
      });

      if (forceCollapse) toggle(true);
    };

    setupFolding(elements.toggleCalendarBtn, elements.calendarContent, isSmallHeight);
    setupFolding(elements.toggleScheduleBtn, elements.scheduleContent, isSmallHeight);
    setupFolding(elements.toggleMemoBtn, elements.memoContent, isSmallHeight);

    this.initMemoRows(elements);
    this.initScheduleRows(elements);
  },

  async initMemoRows(elements) {
    const tableBody = document.getElementById('memoTableBody');
    if (!tableBody) return;

    const selectedDate = CalendarManager.getSelectedDate();
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()+1}-${selectedDate.getDate()}`;
    const hashPart = window.location.hash.split('/chat/')[1] || 'default';
    const sessionId = hashPart.split('?')[0];

    const adjustHeight = (textarea) => {
      textarea.style.height = '1px';
      textarea.style.height = (textarea.scrollHeight) + 'px';
    };

    const handleMemoSave = debounce(async (content) => {
        await BackendHooks.saveMemo(sessionId, content, dateKey);
        CalendarManager.refreshDots();
    }, 500);

    const createRow = (index, content = '') => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width: 32px; padding-top: 10px; text-align: center; color: rgba(31, 41, 55, 0.4); font-size: 11px; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.05);">${index}</td>
        <td>
          <textarea class="memo-input-flat" placeholder="메모를 입력하세요..." rows="1">${content}</textarea>
        </td>
      `;
      const textarea = tr.querySelector('textarea');
      textarea.addEventListener('input', () => {
          adjustHeight(textarea);
          const allMemos = Array.from(tableBody.querySelectorAll('textarea')).map(t => t.value).join('\n');
          handleMemoSave(allMemos);
      });
      setTimeout(() => adjustHeight(textarea), 0);
      return tr;
    };

    const addBtn = document.getElementById('addMemoRowBtn');
    const removeBtn = document.getElementById('removeMemoRowBtn');

    if (addBtn) {
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        newAddBtn.addEventListener('click', () => {
            const nextIndex = tableBody.querySelectorAll('tr').length + 1;
            tableBody.appendChild(createRow(nextIndex));
        });
    }

    if (removeBtn) {
        const newRemoveBtn = removeBtn.cloneNode(true);
        removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
        newRemoveBtn.addEventListener('click', () => {
            const rows = tableBody.querySelectorAll('tr');
            if (rows.length > 0) {
                tableBody.removeChild(rows[rows.length - 1]);
                const allMemos = Array.from(tableBody.querySelectorAll('textarea')).map(t => t.value).join('\n');
                handleMemoSave(allMemos);
            }
        });
    }

    tableBody.innerHTML = '';
    try {
        const data = await BackendHooks.fetchMemo(sessionId, dateKey);
        const savedContent = data.memo || '';
        if (savedContent) {
            const lines = savedContent.split('\n');
            lines.forEach((line, i) => tableBody.appendChild(createRow(i + 1, line)));
        } else {
            for (let i = 1; i <= 3; i++) tableBody.appendChild(createRow(i));
        }
    } catch (e) {
        console.error("Failed to load memo:", e);
        for (let i = 1; i <= 3; i++) tableBody.appendChild(createRow(i));
    }
  },

  async initScheduleRows(elements) {
    const tableBody = document.getElementById('scheduleTableBody');
    const container = document.querySelector('.schedule-list-container');
    if (!tableBody) return;

    const selectedDate = CalendarManager.getSelectedDate();
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()+1}-${selectedDate.getDate()}`;
    const hashPart = window.location.hash.split('/chat/')[1] || 'default';
    const sessionId = hashPart.split('?')[0];

    const handleScheduleSave = debounce(async (plan) => {
        await BackendHooks.updateSchedule(sessionId, plan, dateKey);
        CalendarManager.refreshDots();
    }, 500);

    const createRow = (time = '09:00', activity = '') => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" value="${time}" style="width:100%; background:transparent; border:none; color:inherit; font:inherit; outline:none;"></td>
        <td><input type="text" value="${activity}" placeholder="활동 입력" style="width:100%; background:transparent; border:none; color:inherit; font:inherit; outline:none;"></td>
      `;
      tr.querySelectorAll('input').forEach(input => {
          input.addEventListener('input', () => {
              const plan = Array.from(tableBody.querySelectorAll('tr')).map(row => {
                  const inputs = row.querySelectorAll('input');
                  return { time: inputs[0].value, activity: inputs[1].value };
              });
              handleScheduleSave(plan);
          });
      });
      return tr;
    };

    const addBtn = document.getElementById('addScheduleRowBtn');
    const removeBtn = document.getElementById('removeScheduleRowBtn');

    if (addBtn) {
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        newAddBtn.addEventListener('click', () => {
            tableBody.appendChild(createRow('09:00', ''));
            updateDynamicHeight();
        });
    }

    if (removeBtn) {
        const newRemoveBtn = removeBtn.cloneNode(true);
        removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
        newRemoveBtn.addEventListener('click', () => {
            const rows = tableBody.querySelectorAll('tr');
            if (rows.length > 0) {
                tableBody.removeChild(rows[rows.length - 1]);
                const plan = Array.from(tableBody.querySelectorAll('tr')).map(row => {
                    const inputs = row.querySelectorAll('input');
                    return { time: inputs[0].value, activity: inputs[1].value };
                });
                handleScheduleSave(plan);
                updateDynamicHeight();
            }
        });
    }

    const updateDynamicHeight = () => {
        const rows = tableBody.querySelectorAll('tr').length;
        if (rows === 0) {
            container.style.flex = '0 0 auto';
            container.style.height = '0px';
            container.style.minHeight = '0px';
            container.style.marginBottom = '0px';
            container.style.overflow = 'hidden';
        } else {
            container.style.flex = ''; // Restore flex
            container.style.height = ''; 
            container.style.minHeight = '100px';
            container.style.marginBottom = '12px';
            container.style.overflow = 'auto';
        }
    };

    tableBody.innerHTML = '';
    try {
        const data = await BackendHooks.fetchSchedule(sessionId, dateKey);
        const savedPlan = data.plan || [];
        if (savedPlan.length > 0) {
            savedPlan.forEach(p => tableBody.appendChild(createRow(p.time, p.activity)));
        }
        updateDynamicHeight();
    } catch (e) {
        console.error("Failed to load schedule:", e);
        updateDynamicHeight();
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
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
        let newWidth = startWidth + delta;
        const minMiddleWidth = Math.max(400, window.innerWidth * 0.3);
        const oppositeWidth = (side === 'left' ? elements.rightSidebar : elements.sidebar).getBoundingClientRect().width;
        const maxAllowed = Math.max(300, Math.min(window.innerWidth - oppositeWidth - minMiddleWidth, window.innerWidth / 3));
        newWidth = Math.max(300, Math.min(newWidth, maxAllowed));
        target.style.width = `${newWidth}px`;
        config[configKey] = newWidth;
      });

      document.addEventListener('mouseup', async () => {
        if (!isDragging) return;
        isDragging = false;
        target.classList.remove('notransition');
        resizer.classList.remove('active');
        elements.documentBody.style.userSelect = '';
        elements.documentBody.style.cursor = '';
        
        const key = side === 'left' ? 'leftSidebarCustomWidth' : 'rightSidebarCustomWidth';
        await BackendHooks.saveUserSetting(key, config[configKey]);
        
        if (side === 'right' && window.kakaoMap) window.kakaoMap.relayout();
      });
    };

    setupResizer(elements.leftSidebarResizer, elements.sidebar, 'left');
    setupResizer(elements.rightSidebarResizer, elements.rightSidebar, 'right');
  }
};
