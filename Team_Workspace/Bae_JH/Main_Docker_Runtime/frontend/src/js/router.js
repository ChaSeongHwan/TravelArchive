/**
 * router.js
 */

import { renderSettingsPage } from './settings.js';
import { renderAccountPage } from './account.js';
import { renderHelpPage } from './help.js';
import { BackendHooks } from './api.js';
import { SidebarManager } from './sidebar.js';
import { CalendarManager } from './calendar.js';
import { showLoadingIndicator, removeLoadingIndicator, appendMessage, adjustTextareaHeight } from './ui.js';

const PAGES = {
  '#/settings': { type: 'page', renderer: renderSettingsPage },
  '#/account': { type: 'page', renderer: renderAccountPage },
  '#/help': { type: 'page', renderer: renderHelpPage },
  '#/': { type: 'home' }
};

export function switchView(viewName, elements) {
  const { 
    heroSection, 
    chatHistory, 
    chatWrap, 
    pageSection, 
    topBarActions,
    downloadChatBtn,
    shareChatBtn,
    mapToggleBtn
  } = elements;
  
  // Reset all to none
  heroSection.style.display = 'none';
  chatHistory.style.display = 'none';
  chatWrap.style.display = 'none';
  pageSection.style.display = 'none';
  
  topBarActions.style.display = 'flex';

  switch (viewName) {
    case 'home':
      heroSection.style.display = 'flex';
      chatWrap.style.display = 'block';
      if (downloadChatBtn) downloadChatBtn.style.display = 'none';
      if (shareChatBtn) shareChatBtn.style.display = 'none';
      if (mapToggleBtn) mapToggleBtn.style.display = 'none'; // Fix Item 12: Ensure hidden on home
      break;
    case 'chat':
      chatHistory.style.display = 'flex';
      chatWrap.style.display = 'block';
      if (downloadChatBtn) downloadChatBtn.style.display = 'flex';
      if (shareChatBtn) shareChatBtn.style.display = 'flex';
      if (mapToggleBtn) mapToggleBtn.style.display = 'flex'; // Fix Item 12: Only show on chat
      break;
    case 'page':
      pageSection.style.display = 'flex';
      chatWrap.style.display = 'none'; // Fix Item 6: Ensure hidden on pages
      if (downloadChatBtn) downloadChatBtn.style.display = 'none';
      if (shareChatBtn) shareChatBtn.style.display = 'none';
      if (mapToggleBtn) mapToggleBtn.style.display = 'none'; // Fix Item 12: Ensure hidden on pages
      break;
  }
}

export async function router(state, elements) {
  const path = window.location.hash || '#/';
  const { chatHistory, chatInput, chatBox, pageSection } = elements;

  if (path.startsWith('#/chat/')) {
    const ssid = path.replace('#/chat/', '');
    if (state.currentSessionId !== ssid) {
      switchView('chat', elements);
      chatHistory.innerHTML = '';
      const loadingId = showLoadingIndicator(chatHistory);
      state.currentSessionId = ssid;
      
      // Refresh date-specific data
      CalendarManager.loadTripRange(ssid);
      SidebarManager.initMemoRows(elements);
      SidebarManager.initScheduleRows(elements);

      try {
        const historyData = await BackendHooks.fetchChatHistory(ssid);
        removeLoadingIndicator(loadingId);
        for (const msg of historyData) {
          appendMessage(chatHistory, msg.content, msg.role);
        }
      } catch (e) {
        console.error(e);
        removeLoadingIndicator(loadingId);
      }
    } else {
      switchView('chat', elements);
    }
    return;
  }

  const page = PAGES[path] || PAGES['#/'];
  state.currentSessionId = null;

  // Refresh date-specific data
  CalendarManager.loadTripRange(null);
  SidebarManager.initMemoRows(elements);
  SidebarManager.initScheduleRows(elements);

  if (page.type === 'home') {
    switchView('home', elements);
    chatHistory.innerHTML = '';
    chatInput.value = '';
    adjustTextareaHeight(chatInput, chatBox);
  } else if (page.type === 'page') {
    switchView('page', elements);
    pageSection.innerHTML = '';
    page.renderer(pageSection);
  }
}
