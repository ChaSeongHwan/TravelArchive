/**
 * script.js (Root)
 */

import { BackendHooks } from './js/api.js';
import { adjustTextareaHeight } from './js/ui.js';
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
    settingsBtn: document.getElementById('settingsBtn'),
    accountBtn: document.getElementById('accountBtn'),
    helpBtn: document.getElementById('helpBtn'),
    themeBtn: document.getElementById('themeBtn'),
    themePopup: document.getElementById('themePopup'),
    themeSwatches: document.querySelectorAll('.theme-swatch'),
    weatherLayer: document.getElementById('weatherLayer'),
    bgPanorama: document.getElementById('bgPanorama')
  };

  const state = { currentSessionId: null, isReceiving: false };
  const config = {
    currentLeftWidth: parseInt(localStorage.getItem('leftSidebarCustomWidth'), 10) || 300,
    currentRightWidth: parseInt(localStorage.getItem('rightSidebarCustomWidth'), 10) || 300
  };

  // 2. Initialization
  const savedOpacity = localStorage.getItem('appGlassOpacity') || '20';
  document.documentElement.style.setProperty('--app-glass-opacity', savedOpacity / 100);

  const bgImages = ['1','2','3','4','5'].map(i => `/resource/bg-long-${i}.jpg`);
  if (elements.bgPanorama) {
    elements.bgPanorama.style.backgroundImage = `url('${bgImages[Math.floor(Math.random() * bgImages.length)]}')`;
  }

  await SessionManager.init(elements, state);
  CalendarManager.render(elements.calendarContent);
  ScheduleManager.render(elements.scheduleContent);
  SidebarManager.initTabs(elements);
  SidebarManager.initResizers(elements, config);
  SidebarManager.initFolding(elements);
  ThemeManager.init(elements);

  // Initial Routing
  window.addEventListener('hashchange', () => router(state, elements));
  router(state, elements);

  // Default display
  elements.chatWrap.classList.remove('hidden');

  // 3. Unified Event Handling
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
      
      // Sidebar transition takes ~300ms
      setTimeout(() => SidebarManager.adjustAllMemoHeights(), 310);
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

  elements.resetLeftSidebarBtn?.addEventListener('click', () => {
    config.currentLeftWidth = 300;
    elements.sidebar.style.width = '300px';
    localStorage.setItem('leftSidebarCustomWidth', 300);
    setTimeout(() => SidebarManager.adjustAllMemoHeights(), 310);
  });

  elements.resetRightSidebarBtn?.addEventListener('click', () => {
    config.currentRightWidth = 300;
    elements.rightSidebar.style.width = '300px';
    localStorage.setItem('rightSidebarCustomWidth', 300);
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
  });

  elements.attachBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (e) => e.target.files.length > 0 && ChatManager.handleFileUpload(e.target.files, state, elements));

  elements.downloadChatBtn.addEventListener('click', () => state.currentSessionId && confirm("다운로드하시겠습니까?") && BackendHooks.downloadChat(state.currentSessionId));

  // Window utilities
  const updatePlaceholder = () => {
    elements.chatInput.placeholder = window.innerWidth <= 860 ? "메시지를 입력하세요" : "메시지 또는 파일을 이곳에 드롭하세요 (Shift+Enter로 줄바꿈)";
  };

  window.addEventListener('resize', () => {
    adjustTextareaHeight(elements.chatInput, elements.chatBox);
    updatePlaceholder();
    if (!SidebarManager.isMobile()) {
      SidebarManager.closeSidebar(elements, { silent: true });
      SidebarManager.closeRightSidebar(elements, { silent: true });
    }
    SidebarManager.syncContentState(elements);
    SidebarManager.adjustAllMemoHeights();
  });

  updatePlaceholder();
  adjustTextareaHeight(elements.chatInput, elements.chatBox);
  SidebarManager.syncContentState(elements);
});
