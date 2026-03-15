document.addEventListener('DOMContentLoaded', () => {

  // =========================================================
  // 1. DOM 요소 및 전역 상태
  // =========================================================
  const mainContent = document.getElementById('mainContent');
  const heroSection = document.getElementById('heroSection');
  const pageSection = document.getElementById('pageSection');
  const chatWrap = document.getElementById('chatWrap');
  
  const chatHistory = document.getElementById('chatHistory');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatBox = document.getElementById('chatBox');
  const expandBtn = document.getElementById('expandBtn');
  
  const sidebar = document.getElementById('sidebar');
  const sidebarList = document.getElementById('sidebarList');
  const menuToggle = document.getElementById('menuToggle');
  
  const homeBtn = document.getElementById('homeBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const accountBtn = document.getElementById('accountBtn');
  const helpBtn = document.getElementById('helpBtn');
  
  const themeBtn = document.getElementById('themeBtn');
  const themePopup = document.getElementById('themePopup');
  const themeSwatches = document.querySelectorAll('.theme-swatch');

  let currentSessionId = null;
  let isReceiving = false;

  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  // =========================================================
  // 2. 외부 API (Backend Hooks) - 함수 순서 재배치
  // =========================================================
  const BackendHooks = {
    async fetchSessionList() {
      console.log("[Backend] 과거 세션 목록 데이터 요청");
      return new Promise(resolve => setTimeout(() => resolve([
        { id: 'session_1', title: '오사카 3박 4일 일정' },
        { id: 'session_2', title: '제주도 여행 코스' }
      ]), 300));
    },

    async createSession(firstMessage) {
      console.log("[Backend] 새 세션 생성 요청:", firstMessage);
      const newSessionId = 'session_' + Math.random().toString(36).substr(2, 9);
      const generatedTitle = firstMessage.length > 20
        ? firstMessage.substring(0, 20) + "..."
        : firstMessage;

      return new Promise(resolve => setTimeout(() => resolve({
        id: newSessionId,
        title: generatedTitle
      }), 200));
    },

    async fetchChatHistory(sessionId) {
      console.log("[Backend] 과거 대화 불러오기 요청 ID:", sessionId);
      return new Promise(resolve => setTimeout(() => resolve([
        { role: 'user', content: `이곳은 고유 세션 ID [${sessionId}]의 대화 내역입니다.` },
        { role: 'bot', content: '네, 백엔드에서 과거 기록을 성공적으로 불러왔습니다.' }
      ]), 400));
    },

    async sendMessage(sessionId, message, onChunkReceived, onCompleted) {
      console.log(`[Backend] 메시지 전송 (${sessionId}):`, message);
      setTimeout(() => {
        const dummyResponse = "모든 버튼과 라우팅이 정상적으로 연결되었습니다. 백엔드 구현 시 해당 세션에 메시지가 저장됩니다.";
        let currentText = "";
        let index = 0;
        
        const interval = setInterval(() => {
          currentText += dummyResponse[index];
          onChunkReceived(currentText);
          index++;
          
          if (index >= dummyResponse.length) {
            clearInterval(interval);
            onCompleted();
          }
        }, 30);
      }, 1000);
    },

    async fetchSettings() {
      console.log("[Backend] 사용자 설정 데이터 요청");
      return new Promise(resolve => setTimeout(() => resolve({ status: 'success', data: '설정 페이지입니다. (DB 연동 대기 중)' }), 200));
    },

    async fetchAccountInfo() {
      console.log("[Backend] 사용자 계정 정보 요청");
      return new Promise(resolve => setTimeout(() => resolve({ status: 'success', data: '계정 관리 페이지입니다. (DB 연동 대기 중)' }), 200));
    },

    async fetchHelpData() {
      console.log("[Backend] 도움말 및 가이드 데이터 요청");
      return new Promise(resolve => setTimeout(() => resolve({ status: 'success', data: '도움말 가이드라인 페이지입니다.' }), 200));
    },

    async saveThemePreference(themeName) {
      console.log(`[Backend] 사용자 테마 취향 저장: ${themeName}`);
      return new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 100));
    }
  };


  // =========================================================
  // 3. 라우팅 및 뷰 전환
  // =========================================================
  function switchView(viewName) {
    heroSection.style.display = 'none';
    chatHistory.style.display = 'none';
    chatWrap.style.display = 'none';
    pageSection.style.display = 'none';

    if (viewName === 'home') {
      heroSection.style.display = 'flex';
      chatWrap.style.display = 'block';
      currentSessionId = null;
    } else if (viewName === 'chat') {
      chatHistory.style.display = 'flex';
      chatWrap.style.display = 'block';
    } else if (viewName === 'page') {
      pageSection.style.display = 'flex';
      currentSessionId = null;
    }
  }

  async function router() {
    const path = window.location.hash;

    if (path === '' || path === '#/') {
      switchView('home');
      chatHistory.innerHTML = '';
      chatInput.value = '';
      adjustTextareaHeight();
      chatBox.classList.remove('expanded');
    } else if (path === '#/settings') {
      switchView('page');
      pageSection.innerHTML = `<h2>설정</h2><p>데이터를 불러오는 중...</p>`;
      const res = await BackendHooks.fetchSettings();
      pageSection.innerHTML = `<h2>설정</h2><p>${res.data}</p>`;
    } else if (path === '#/account') {
      switchView('page');
      pageSection.innerHTML = `<h2>계정</h2><p>데이터를 불러오는 중...</p>`;
      const res = await BackendHooks.fetchAccountInfo();
      pageSection.innerHTML = `<h2>계정</h2><p>${res.data}</p>`;
    } else if (path === '#/help') {
      switchView('page');
      pageSection.innerHTML = `<h2>도움말</h2><p>데이터를 불러오는 중...</p>`;
      const res = await BackendHooks.fetchHelpData();
      pageSection.innerHTML = `<h2>도움말</h2><p>${res.data}</p>`;
    } else if (path.startsWith('#/chat/')) {
      const ssid = path.replace('#/chat/', '');
      
      if (currentSessionId !== ssid) {
        switchView('chat');
        chatHistory.innerHTML = '<div class="message-row bot"><div class="message bot">대화 기록을 불러오는 중...</div></div>';
        currentSessionId = ssid;
        const historyData = await BackendHooks.fetchChatHistory(ssid);
        
        chatHistory.innerHTML = ''; 
        historyData.forEach(msg => appendMessage(msg.content, msg.role));
      } else {
        switchView('chat');
      }
    }
  }


  // =========================================================
  // 4. UI 렌더링 및 유틸리티 함수
  // =========================================================
  function adjustTextareaHeight() {
    if(chatBox.classList.contains('expanded')) return;
    chatInput.style.height = '54px';
    let scrollHeight = chatInput.scrollHeight;
    if(scrollHeight > 54) {
      chatInput.style.height = Math.min(scrollHeight, 200) + 'px';
      chatInput.style.overflowY = scrollHeight > 200 ? 'auto' : 'hidden';
    } else {
      chatInput.style.overflowY = 'hidden';
    }
  }

  function showLoadingIndicator() {
    const loadingId = 'loading-' + Date.now();
    const rowDiv = document.createElement('div');
    rowDiv.className = `message-row bot`;
    rowDiv.id = loadingId;
    
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'bot');
    msgDiv.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
    
    rowDiv.appendChild(msgDiv);
    chatHistory.appendChild(rowDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    return loadingId;
  }

  function removeLoadingIndicator(id) {
    const loadingEl = document.getElementById(id);
    if(loadingEl) loadingEl.remove();
  }

  function appendMessage(text, sender, isStreaming = false) {
    const rowDiv = document.createElement('div');
    rowDiv.className = `message-row ${sender}`;

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = text;
    rowDiv.appendChild(msgDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
    
    copyBtn.addEventListener('click', async () => {
      const currentText = msgDiv.textContent; 
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(currentText);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = currentText;
          textArea.style.position = "absolute";
          textArea.style.left = "-999999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        const checkIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10B981" stroke-width="2"><path d="M5 13l4 4L19 7"></path></svg>`;
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = checkIcon; 
        setTimeout(() => copyBtn.innerHTML = originalIcon, 2000);
      } catch (err) {
        console.error("복사 실패:", err);
      }
    });

    actionsDiv.appendChild(copyBtn);
    rowDiv.appendChild(actionsDiv);
    
    chatHistory.appendChild(rowDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    return rowDiv; 
  }

  function renderSidebarItem(title, sessionId, isPrepend = true) {
    const newBtn = document.createElement('button');
    newBtn.classList.add('sidebar-item');
    newBtn.setAttribute('data-session-id', sessionId);

    newBtn.innerHTML = `
      <span class="dot" style="background: rgba(59, 130, 246, 0.8);"></span>
      ${title}
    `;

    newBtn.addEventListener('click', () => {
      if (isReceiving) return;
      window.location.hash = `#/chat/${sessionId}`;
    });

    if (isPrepend) sidebarList.prepend(newBtn);
    else sidebarList.appendChild(newBtn);
  }


  // =========================================================
  // 5. 채팅 핵심 로직
  // =========================================================
  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || isReceiving) return;

    let isNewSession = false;

    if (!currentSessionId) {
        const session = await BackendHooks.createSession(text);
        currentSessionId = session.id;
        renderSidebarItem(session.title, session.id, true);
      isNewSession = true;
    }

    if (isNewSession) {
      history.pushState(null, '', `#/chat/${currentSessionId}`);
      switchView('chat'); 
    }

    appendMessage(text, 'user');
    chatInput.value = '';
    adjustTextareaHeight();

    isReceiving = true;
    sendBtn.disabled = true;
    const loadingId = showLoadingIndicator();
    
    let botMsgDiv = null;

    await BackendHooks.sendMessage(
      currentSessionId, 
      text, 
      (chunk) => {
        if (!botMsgDiv) {
          removeLoadingIndicator(loadingId);
          botMsgDiv = appendMessage('', 'bot', true);
        }
        botMsgDiv.querySelector('.message').textContent = chunk;
        chatHistory.scrollTop = chatHistory.scrollHeight;
      },
      () => {
        isReceiving = false;
        sendBtn.disabled = false;
      }
    );
  }


  // =========================================================
  // 6. 이벤트 바인딩 및 초기화
  // =========================================================
  async function init() {
    sidebarList.innerHTML = '';
    const sessions = await BackendHooks.fetchSessionList();
    sessions.forEach(session => {
      renderSidebarItem(session.title, session.id, false); 
    });
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('load', router);
  menuToggle.addEventListener('click', toggleSidebar);

  function openSidebar() {
    if (isMobile()) {
      sidebar.classList.add('open');
      if (sidebarOverlay) {
        sidebarOverlay.style.display = 'block';
        requestAnimationFrame(() => sidebarOverlay.classList.add('show'));
      }
    } else {
      sidebar.classList.remove('collapsed');
    }
  }

  function closeSidebar() {
    if (isMobile()) {
      sidebar.classList.remove('open');
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove('show');
        setTimeout(() => { sidebarOverlay.style.display = 'none'; }, 300);
      }
    } else {
      sidebar.classList.add('collapsed');
    }
  }

  function toggleSidebar() {
    if (isMobile()) {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    } else {
      sidebar.classList.contains('collapsed') ? openSidebar() : closeSidebar();
    }
  }

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebar.classList.remove('open');
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove('show');
        sidebarOverlay.style.display = 'none';
      }
    }
  });

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }
  
  // [수정됨] isMobile() 로 올바르게 함수 호출
  sidebarList.addEventListener('click', (e) => {
    if (isMobile()) closeSidebar();
  });
  
  homeBtn.addEventListener('click', () => {
    if (isMobile()) closeSidebar(); // [수정됨]
    if(!isReceiving) window.location.hash = '#/';
  });

  newChatBtn.addEventListener('click', () => {
    if (isMobile()) closeSidebar(); // [수정됨]
    if(isReceiving) return;
    window.location.hash = '#/';
  });

  settingsBtn.addEventListener('click', () => {
    if (isMobile()) closeSidebar(); // [수정됨]
    window.location.hash = '#/settings';
  });
  
  accountBtn.addEventListener('click', () => {
    if (isMobile()) closeSidebar(); // [수정됨]
    window.location.hash = '#/account';
  });
  
  helpBtn.addEventListener('click', () => {
    if (isMobile()) closeSidebar(); // [수정됨]
    window.location.hash = '#/help';
  });

  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themePopup.classList.toggle('show');
  });
  
  document.addEventListener('click', () => themePopup.classList.remove('show'));
  
  themeSwatches.forEach(swatch => {
    swatch.addEventListener('click', async () => {
      const theme = swatch.getAttribute('data-theme');
      
      if (theme === 'default') document.body.removeAttribute('data-theme');
      else document.body.setAttribute('data-theme', theme);
      
      themePopup.classList.remove('show');
      await BackendHooks.saveThemePreference(theme);
    });
  });

  chatInput.addEventListener('input', adjustTextareaHeight);
  
  expandBtn.addEventListener('click', () => {
    chatBox.classList.toggle('expanded');
    if(chatBox.classList.contains('expanded')) chatInput.style.height = 'auto';
    else adjustTextareaHeight();
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
    }
  });
  
  sendBtn.addEventListener('click', handleSend);

  init();
});