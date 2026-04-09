/**
 * script.js (Root)
 */

import { BackendHooks } from './js/api.js';
import { adjustTextareaHeight, showToast } from './js/ui.js';
import { SidebarManager } from './js/sidebar.js';
import { ChatManager } from './js/chat.js';
import { SessionManager } from './js/session.js';
import { CalendarManager } from './js/calendar.js';
import { ScheduleManager } from './js/schedule.js';
import { router } from './js/router.js';
import { ThemeManager } from './js/theme.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Elements Collection
  const elements = {
    mainContent: document.getElementById('mainContent'),
    documentBody: document.body,
    heroSection: document.getElementById('heroSection'),
    pageSection: document.getElementById('pageSection'),
    topBarActions: document.getElementById('topBarActions'),
    chatWrap: document.getElementById('chatWrap'),
    chatHistory: document.getElementById('chatHistory'),
    chatInput: document.getElementById('chatInput'),
    chatBox: document.getElementById('chatBox'),
    sendBtn: document.getElementById('sendBtn'),
    expandBtn: document.getElementById('expandBtn'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    downloadChatBtn: document.getElementById('downloadChatBtn'),
    shareChatBtn: document.getElementById('shareChatBtn'),
    sidebar: document.getElementById('sidebar'),
    sidebarList: document.getElementById('sidebarList'),
    menuToggle: document.getElementById('menuToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    leftSidebarResizer: document.getElementById('leftSidebarResizer'),
    resetLeftSidebarBtn: document.getElementById('resetLeftSidebarBtn'),
    tabSessions: document.getElementById('tabSessions'),
    tabCalendar: document.getElementById('tabCalendar'),
    sessionView: document.getElementById('sessionView'),
    calendarView: document.getElementById('calendarView'),
    sessionHeaderControls: document.getElementById('sessionHeaderControls'),
    calendarHeaderControls: document.getElementById('calendarHeaderControls'),
    toggleCalendarBtn: document.getElementById('toggleCalendarBtn'),
    calendarContent: document.getElementById('calendarContent'),
    toggleScheduleBtn: document.getElementById('toggleScheduleBtn'),
    scheduleContent: document.getElementById('scheduleContent'),
    addScheduleRowBtn: document.getElementById('addScheduleRowBtn'),
    removeScheduleRowBtn: document.getElementById('removeScheduleRowBtn'),
    toggleMemoBtn: document.getElementById('toggleMemoBtn'),
    memoContent: document.getElementById('memoContent'),
    addMemoRowBtn: document.getElementById('addMemoRowBtn'),
    removeMemoRowBtn: document.getElementById('removeMemoRowBtn'),
    rightSidebar: document.getElementById('rightSidebar'),
    rightSidebarContent: document.getElementById('rightSidebarContent'),
    mapToggleBtn: document.getElementById('mapToggleBtn'),
    closeRightSidebarBtn: document.getElementById('closeRightSidebarBtn'),
    rightSidebarOverlay: document.getElementById('rightSidebarOverlay'),
    rightSidebarResizer: document.getElementById('rightSidebarResizer'),
    resetRightSidebarBtn: document.getElementById('resetRightSidebarBtn'),
    homeBtn: document.getElementById('homeBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    mainTeamPlannerBtn: document.getElementById('mainTeamPlannerBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    accountBtn: document.getElementById('accountBtn'),
    helpBtn: document.getElementById('helpBtn'),
    themeBtn: document.getElementById('themeBtn'),
    themePopup: document.getElementById('themePopup'),
    themeSwatches: document.querySelectorAll('.theme-swatch'),
    weatherLayer: document.getElementById('weatherLayer'),
    bgPanorama: document.getElementById('bgPanorama')
  };

  const state = { 
    currentSessionId: null, 
    isReceiving: false,
    currentMode: 'personal' // 'personal' or 'team'
  };
  
  // 2. Initialization & Backend Config
  let config = { currentLeftWidth: 300, currentRightWidth: 300 };
  let savedOpacity = '20';
  let savedTheme = 'default';
  let todayDate = new Date();
  
  try {
    const appContext = await BackendHooks.fetchAppContext();
    const settings = appContext.settings || {};
    
    config.currentLeftWidth = parseInt(settings.leftSidebarCustomWidth, 10) || 300;
    config.currentRightWidth = parseInt(settings.rightSidebarCustomWidth, 10) || 300;
    savedOpacity = settings.appGlassOpacity || '20';
    savedTheme = settings.theme || 'default';
    
    if (appContext.today) {
      todayDate = new Date(appContext.today);
    }
  } catch (e) {
    console.error('Failed to load context from backend', e);
  }

  document.documentElement.style.setProperty('--app-glass-opacity', savedOpacity / 100);
  if (savedTheme !== 'default') {
    document.body.setAttribute('data-theme', savedTheme);
  }

  const bgImages = ['1','2','3','4','5'].map(i => `/resource/bg-long-${i}.jpg`);
  if (elements.bgPanorama) {
    elements.bgPanorama.style.backgroundImage = `url('${bgImages[Math.floor(Math.random() * bgImages.length)]}')`;
  }

  // 3. Parallel Async Initialization (Don't block UI event listeners)
  (async () => {
    try {
      await SessionManager.init(elements, state);
      await CalendarManager.init(todayDate);
      await CalendarManager.render(elements.calendarContent);
      await ScheduleManager.render(elements.scheduleContent);
      
      // Fix Item 3: Initialize folding & rows after calendar/schedule is fully ready
      SidebarManager.initTabs(elements);
      SidebarManager.initResizers(elements, config);
      SidebarManager.initFolding(elements);
      ThemeManager.init(elements);
      
      // Initial routing after full init
      router(state, elements);
    } catch (e) {
      console.warn("Some async components failed to load, UI will still function", e);
    }
  })();

  // Initial Routing Listener
  window.addEventListener('hashchange', () => router(state, elements));
  // router(state, elements); // Moved inside async init block to prevent race condition on SSID/Rows

  // 4. Unified Event Handling
  const handleSidebarToggle = (btn, side) => {
    btn.addEventListener('click', () => {
      const isOpen = side === 'left' ? elements.sidebar.classList.contains('open') : elements.rightSidebar.classList.contains('open');
      const isCollapsed = side === 'left' ? elements.sidebar.classList.contains('collapsed') : elements.rightSidebar.classList.contains('collapsed');
      
      if (SidebarManager.isMobile()) {
        (isOpen) ? (side === 'left' ? SidebarManager.closeSidebar(elements) : SidebarManager.closeRightSidebar(elements)) 
                 : (side === 'left' ? SidebarManager.openSidebar(elements, config) : SidebarManager.openRightSidebar(elements, config));
      } else {
        (isCollapsed) ? (side === 'left' ? SidebarManager.openSidebar(elements, config) : SidebarManager.openRightSidebar(elements, config)) 
                       : (side === 'left' ? SidebarManager.closeSidebar(elements) : SidebarManager.closeRightSidebar(elements));
      }
      
      window.updatePlaceholder();
      // Sidebar transition takes ~300ms
      setTimeout(() => {
        SidebarManager.adjustAllMemoHeights();
        window.updatePlaceholder();
      }, 310);
    });
  };

  handleSidebarToggle(elements.menuToggle, 'left');
  if (elements.mapToggleBtn) handleSidebarToggle(elements.mapToggleBtn, 'right');

  [elements.closeRightSidebarBtn, elements.sidebarOverlay, elements.rightSidebarOverlay].forEach(el => {
    el?.addEventListener('click', () => {
      if (el === elements.sidebarOverlay) SidebarManager.closeSidebar(elements);
      else SidebarManager.closeRightSidebar(elements);
      setTimeout(() => SidebarManager.adjustAllMemoHeights(), 310);
    });
  });

  elements.resetLeftSidebarBtn?.addEventListener('click', async () => {
    config.currentLeftWidth = 300;
    elements.sidebar.style.width = '300px';
    await BackendHooks.saveUserSetting('leftSidebarCustomWidth', 300);
    setTimeout(() => SidebarManager.adjustAllMemoHeights(), 310);
  });

  elements.resetRightSidebarBtn?.addEventListener('click', async () => {
    config.currentRightWidth = 300;
    elements.rightSidebar.style.width = '300px';
    await BackendHooks.saveUserSetting('rightSidebarCustomWidth', 300);
    setTimeout(() => {
      window.kakaoMap?.relayout();
      SidebarManager.adjustAllMemoHeights();
    }, 310);
  });

  // Navigation & Chat
  [elements.homeBtn, elements.newChatBtn].forEach(btn => btn.addEventListener('click', () => {
    if (SidebarManager.isMobile()) SidebarManager.closeSidebar(elements);
    if (!state.isReceiving) window.location.hash = '#/';
  }));

  elements.mainTeamPlannerBtn?.addEventListener('click', () => {
    if (SidebarManager.isMobile()) SidebarManager.closeSidebar(elements);
    
    // Toggle Mode
    state.currentMode = state.currentMode === 'personal' ? 'team' : 'personal';
    
    // Update Button UI
    if (state.currentMode === 'team') {
      elements.mainTeamPlannerBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        개인 플래너
      `;
    } else {
      elements.mainTeamPlannerBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
        팀 플래너
      `;
    }

    // Refresh session list
    SessionManager.init(elements, state);
    showToast(`${state.currentMode === 'team' ? '팀' : '개인'} 플래너로 전환되었습니다.`);
    setTimeout(window.updatePlaceholder, 310);
  });

  ['settings', 'account', 'help'].forEach(v => {
    elements[`${v}Btn`].addEventListener('click', () => {
      if (SidebarManager.isMobile()) SidebarManager.closeSidebar(elements);
      window.location.hash = `#/${v}`;
    });
  });

  elements.sendBtn.addEventListener('click', () => ChatManager.handleSend(state, elements));
  elements.chatInput.addEventListener('keydown', (e) => (e.key === 'Enter' && !e.shiftKey && !e.isComposing) && (e.preventDefault(), ChatManager.handleSend(state, elements)));
  elements.chatInput.addEventListener('input', () => adjustTextareaHeight(elements.chatInput, elements.chatBox));
  elements.expandBtn.addEventListener('click', () => {
    elements.chatBox.classList.toggle('expanded');
    adjustTextareaHeight(elements.chatInput, elements.chatBox);
    window.updatePlaceholder();
  });

  elements.attachBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (e) => e.target.files.length > 0 && ChatManager.handleFileUpload(e.target.files, state, elements));

  elements.downloadChatBtn.addEventListener('click', () => state.currentSessionId && confirm("다운로드하시겠습니까?") && BackendHooks.downloadChat(state.currentSessionId));

  // Window utilities
  window.updatePlaceholder = () => {
    if (!elements.chatInput) return;
    const longText = "메시지 또는 파일을 이곳에 드롭하세요 (Shift+Enter로 줄바꿈)";
    const shortText = "메시지를 입력하세요";
    
    const canvas = window.updatePlaceholder.canvas || (window.updatePlaceholder.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    
    // Get exact styles from the textarea to match measurement
    const computedStyle = window.getComputedStyle(elements.chatInput);
    context.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    
    // Precision measurement + buffer to account for scrollbars or slightly different rendering
    const textWidth = context.measureText(longText).width;
    const availableWidth = elements.chatInput.clientWidth - parseFloat(computedStyle.paddingLeft) - parseFloat(computedStyle.paddingRight);
    
    // If available width is less than the actual text width + 40px safety buffer, switch to short.
    if (availableWidth < textWidth + 40) {
      elements.chatInput.placeholder = shortText;
    } else {
      elements.chatInput.placeholder = longText;
    }
  };

  window.addEventListener('resize', () => {
    adjustTextareaHeight(elements.chatInput, elements.chatBox);
    window.updatePlaceholder();
    
    if (!SidebarManager.isMobile()) {
        const MIN_CONTENT = 600; 
        const MAX_SIDEBAR_PCT = 0.5;
        const leftOpen = !elements.sidebar.classList.contains('collapsed');
        const rightOpen = !elements.rightSidebar.classList.contains('collapsed');
        
        // 1. Force 50% constraint on resize
        if (leftOpen && config.currentLeftWidth > window.innerWidth * MAX_SIDEBAR_PCT) {
            elements.sidebar.style.width = (window.innerWidth * MAX_SIDEBAR_PCT) + 'px';
        }
        if (rightOpen && config.currentRightWidth > window.innerWidth * MAX_SIDEBAR_PCT) {
            elements.rightSidebar.style.width = (window.innerWidth * MAX_SIDEBAR_PCT) + 'px';
        }

        const leftWidth = leftOpen ? parseFloat(elements.sidebar.style.width || config.currentLeftWidth) : 0;
        const rightWidth = rightOpen ? parseFloat(elements.rightSidebar.style.width || config.currentRightWidth) : 0;
        
        // 2. Enforce minimum center width
        if (leftWidth + rightWidth > window.innerWidth - MIN_CONTENT) {
            if (leftOpen && rightOpen) {
                SidebarManager.closeRightSidebar(elements, { silent: true });
            } else if (leftOpen && leftWidth > window.innerWidth - MIN_CONTENT) {
                elements.sidebar.style.width = Math.max(300, window.innerWidth - MIN_CONTENT) + 'px';
            }
        }
    }
    SidebarManager.syncContentState(elements);
    SidebarManager.adjustAllMemoHeights();
  });

  // 스크롤바 자동 숨김: 스크롤 중이거나 hover 시에만 표시, 1.5초 후 사라짐
  const scrollbarTimers = new WeakMap();
  const SCROLLBAR_HIDE_DELAY = 1500;
  const SCROLLABLE_SELECTORS = [
    '.sidebar-view', '.chat-history', '.page-section',
    '.memo-inner-scroll', '.schedule-inner-scroll'
  ];

  document.addEventListener('scroll', (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;

    // textarea는 부모(.chat-box)에 클래스를 붙임
    const target = el.matches('textarea') ? el.closest('.chat-box') : el;
    if (!target) return;

    const isScrollable = SCROLLABLE_SELECTORS.some(sel => target.matches(sel)) || target.matches('textarea');
    if (!isScrollable) return;

    target.classList.add('scrollbar-active');
    if (scrollbarTimers.has(target)) clearTimeout(scrollbarTimers.get(target));
    scrollbarTimers.set(target, setTimeout(() => {
      target.classList.remove('scrollbar-active');
    }, SCROLLBAR_HIDE_DELAY));
  }, true); // capture phase로 버블링 없는 scroll도 감지

  window.updatePlaceholder();
  adjustTextareaHeight(elements.chatInput, elements.chatBox);
  SidebarManager.syncContentState(elements);
});
