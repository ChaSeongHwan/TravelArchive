// script.js
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

  const weatherLayer = document.getElementById('weatherLayer');

  let currentSessionId = null;
  let isReceiving = false;
  let currentWeatherEffect = null; 

  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  // =========================================================
  // 2. 외부 API (Backend Hooks) - 실제 FastAPI 연동으로 전면 교체
  // =========================================================
  const BackendHooks = {
    async fetchSessionList() {
      const res = await fetch('/api/sessions');
      return res.json();
    },

    async createSession(firstMessage) {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_message: firstMessage })
      });
      return res.json();
    },

    async fetchChatHistory(sessionId) {
      const res = await fetch(`/api/sessions/${sessionId}/history`);
      return res.json();
    },

    async sendMessage(sessionId, message, onChunkReceived, onCompleted) {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });

        if (!response.body) throw new Error("스트리밍 지원 안됨");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let currentText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          currentText += decoder.decode(value, { stream: true });
          onChunkReceived(currentText);
        }
        onCompleted();
      } catch (error) {
        console.error("메시지 전송 오류:", error);
        onCompleted();
      }
    },

    async fetchSettings() {
      const res = await fetch('/api/settings');
      return res.json();
    },

    async fetchAccountInfo() {
      const res = await fetch('/api/account');
      return res.json();
    },

    async fetchHelpData() {
      const res = await fetch('/api/help');
      return res.json();
    },

    async saveThemePreference(themeName) {
      const res = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeName })
      });
      return res.json();
    },

    async fetchCurrentWeather() {
      try {
        const res = await fetch('/api/weather');
        return await res.json(); 
      } catch (err) {
        console.error("날씨 API 연동 실패:", err);
        return { condition: 'clear', params: {} };
      }
    }
  };

  // =========================================================
  // 3. Weather Manager (지연 로딩 및 컨트롤러)
  // =========================================================
  const WeatherManager = {
    async syncWeather() {
      if (currentWeatherEffect) {
        currentWeatherEffect.unmount();
        currentWeatherEffect = null;
      }
      weatherLayer.innerHTML = '';

      const weatherData = await BackendHooks.fetchCurrentWeather();
      // 백엔드 API가 { condition: 'rain', params: {...} } 형태를 준다고 가정
      // 만약 백엔드가 { type: 'rain' }으로 준다면 condition 대신 type을 쓰도록 백엔드나 여기서 맞춰야 함
      const condition = weatherData.condition || weatherData.type; 
      const params = weatherData.params || {}; 
      
      console.log(`[WeatherManager] 적용할 날씨: ${condition}`, params);

      try {
        const EffectsModule = await import('./effects.js');
        
        // 프론트엔드 이펙트 모듈에는 백엔드 params만 그대로 주입합니다.
        switch(condition) {
          case 'rain': currentWeatherEffect = new EffectsModule.RainEffect(weatherLayer, params); break;
          case 'night': currentWeatherEffect = new EffectsModule.NightEffect(weatherLayer, params); break;
          case 'cloudy': currentWeatherEffect = new EffectsModule.CloudyEffect(weatherLayer, params); break;
          case 'clear': 
          default: currentWeatherEffect = new EffectsModule.ClearEffect(weatherLayer); break;
        }

        currentWeatherEffect.mount();
      } catch (err) {
        console.error("날씨 모듈 로드 실패:", err);
      }
    },

    clear() {
      if (currentWeatherEffect) {
        currentWeatherEffect.unmount();
        currentWeatherEffect = null;
      }
      weatherLayer.innerHTML = '';
    }
  };

  // =========================================================
  // 4. 라우팅 및 뷰 전환
  // =========================================================
  function switchView(viewName) {
    heroSection.style.display = 'none';
    chatHistory.style.display = 'none';
    chatWrap.style.display = 'none';
    pageSection.style.display = 'none';

    if (viewName === 'home') {
      heroSection.style.display = 'flex'; chatWrap.style.display = 'block'; currentSessionId = null;
    } else if (viewName === 'chat') {
      chatHistory.style.display = 'flex'; chatWrap.style.display = 'block';
    } else if (viewName === 'page') {
      pageSection.style.display = 'flex'; currentSessionId = null;
    }
  }

  async function router() {
    const path = window.location.hash;
    if (path === '' || path === '#/') {
      switchView('home'); chatHistory.innerHTML = ''; chatInput.value = ''; adjustTextareaHeight(); chatBox.classList.remove('expanded');
    } else if (path === '#/settings') {
      switchView('page'); pageSection.innerHTML = `<h2>설정</h2><p>데이터를 불러오는 중...</p>`; const res = await BackendHooks.fetchSettings(); pageSection.innerHTML = `<h2>설정</h2><p>${res.data}</p>`;
    } else if (path === '#/account') {
      switchView('page'); pageSection.innerHTML = `<h2>계정</h2><p>데이터를 불러오는 중...</p>`; const res = await BackendHooks.fetchAccountInfo(); pageSection.innerHTML = `<h2>계정</h2><p>${res.data}</p>`;
    } else if (path === '#/help') {
      switchView('page'); pageSection.innerHTML = `<h2>도움말</h2><p>데이터를 불러오는 중...</p>`; const res = await BackendHooks.fetchHelpData(); pageSection.innerHTML = `<h2>도움말</h2><p>${res.data}</p>`;
    } else if (path.startsWith('#/chat/')) {
      const ssid = path.replace('#/chat/', '');
      if (currentSessionId !== ssid) {
        switchView('chat'); chatHistory.innerHTML = '<div class="message-row bot"><div class="message bot">대화 기록을 불러오는 중...</div></div>'; currentSessionId = ssid;
        const historyData = await BackendHooks.fetchChatHistory(ssid);
        chatHistory.innerHTML = ''; historyData.forEach(msg => appendMessage(msg.content, msg.role));
      } else { switchView('chat'); }
    }
  }

  // =========================================================
  // 5. UI 렌더링 및 유틸리티 함수
  // =========================================================
  function adjustTextareaHeight() {
    if(chatBox.classList.contains('expanded')) return;
    chatInput.style.height = '54px'; let scrollHeight = chatInput.scrollHeight;
    if(scrollHeight > 54) { chatInput.style.height = Math.min(scrollHeight, 200) + 'px'; chatInput.style.overflowY = scrollHeight > 200 ? 'auto' : 'hidden'; } else { chatInput.style.overflowY = 'hidden'; }
  }

  function showLoadingIndicator() {
    const loadingId = 'loading-' + Date.now(); const rowDiv = document.createElement('div'); rowDiv.className = `message-row bot`; rowDiv.id = loadingId;
    const msgDiv = document.createElement('div'); msgDiv.classList.add('message', 'bot'); msgDiv.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
    rowDiv.appendChild(msgDiv); chatHistory.appendChild(rowDiv); chatHistory.scrollTop = chatHistory.scrollHeight; return loadingId;
  }

  function removeLoadingIndicator(id) { const loadingEl = document.getElementById(id); if(loadingEl) loadingEl.remove(); }

  function appendMessage(text, sender, isStreaming = false) {
    const rowDiv = document.createElement('div'); rowDiv.className = `message-row ${sender}`;
    const msgDiv = document.createElement('div'); msgDiv.classList.add('message', sender); msgDiv.textContent = text; rowDiv.appendChild(msgDiv);
    const actionsDiv = document.createElement('div'); actionsDiv.className = 'message-actions';
    const copyBtn = document.createElement('button'); copyBtn.className = 'action-btn'; copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
    
    copyBtn.addEventListener('click', async () => {
      const currentText = msgDiv.textContent; 
      try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(currentText); } else {
          const textArea = document.createElement("textarea"); textArea.value = currentText; textArea.style.position = "absolute"; textArea.style.left = "-999999px"; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea);
        }
        const checkIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10B981" stroke-width="2"><path d="M5 13l4 4L19 7"></path></svg>`; const originalIcon = copyBtn.innerHTML; copyBtn.innerHTML = checkIcon; setTimeout(() => copyBtn.innerHTML = originalIcon, 2000);
      } catch (err) { console.error("복사 실패:", err); }
    });
    actionsDiv.appendChild(copyBtn); rowDiv.appendChild(actionsDiv); chatHistory.appendChild(rowDiv); chatHistory.scrollTop = chatHistory.scrollHeight; return rowDiv; 
  }

  function renderSidebarItem(title, sessionId, isPrepend = true) {
    const newBtn = document.createElement('button'); newBtn.classList.add('sidebar-item'); newBtn.setAttribute('data-session-id', sessionId);
    newBtn.innerHTML = `<span class="dot"></span>${title}`;
    newBtn.addEventListener('click', () => { if (isReceiving) return; window.location.hash = `#/chat/${sessionId}`; });
    if (isPrepend) sidebarList.prepend(newBtn); else sidebarList.appendChild(newBtn);
  }

  // =========================================================
  // 6. 채팅 핵심 로직
  // =========================================================
  async function handleSend() {
    const text = chatInput.value.trim(); if (!text || isReceiving) return;
    let isNewSession = false;

    if (!currentSessionId) {
        const session = await BackendHooks.createSession(text);
        currentSessionId = session.id; renderSidebarItem(session.title, session.id, true); isNewSession = true;
    }
    if (isNewSession) { history.pushState(null, '', `#/chat/${currentSessionId}`); switchView('chat'); }

    appendMessage(text, 'user'); chatInput.value = ''; adjustTextareaHeight();
    isReceiving = true; sendBtn.disabled = true; const loadingId = showLoadingIndicator(); let botMsgDiv = null;

    await BackendHooks.sendMessage(currentSessionId, text, (chunk) => {
        if (!botMsgDiv) { removeLoadingIndicator(loadingId); botMsgDiv = appendMessage('', 'bot', true); }
        botMsgDiv.querySelector('.message').textContent = chunk; chatHistory.scrollTop = chatHistory.scrollHeight;
      }, () => { isReceiving = false; sendBtn.disabled = false; }
    );
  }

  // =========================================================
  // 7. 이벤트 바인딩 및 초기화
  // =========================================================
  async function init() {
    sidebarList.innerHTML = '';
    const sessions = await BackendHooks.fetchSessionList();
    sessions.forEach(session => renderSidebarItem(session.title, session.id, false));
  }

  window.addEventListener('hashchange', router); window.addEventListener('load', router);
  menuToggle.addEventListener('click', toggleSidebar);

  function openSidebar() {
    if (isMobile()) { sidebar.classList.add('open'); if (sidebarOverlay) { sidebarOverlay.style.display = 'block'; requestAnimationFrame(() => sidebarOverlay.classList.add('show')); }
    } else { sidebar.classList.remove('collapsed'); }
  }

  function closeSidebar() {
    if (isMobile()) { sidebar.classList.remove('open'); if (sidebarOverlay) { sidebarOverlay.classList.remove('show'); setTimeout(() => { sidebarOverlay.style.display = 'none'; }, 300); }
    } else { sidebar.classList.add('collapsed'); }
  }

  function toggleSidebar() { if (isMobile()) { sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); } else { sidebar.classList.contains('collapsed') ? openSidebar() : closeSidebar(); } }

  window.addEventListener('resize', () => { if (!isMobile()) { sidebar.classList.remove('open'); if (sidebarOverlay) { sidebarOverlay.classList.remove('show'); sidebarOverlay.style.display = 'none'; } } });
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  sidebarList.addEventListener('click', (e) => { if (isMobile()) closeSidebar(); });
  
  homeBtn.addEventListener('click', () => { if (isMobile()) closeSidebar(); if(!isReceiving) window.location.hash = '#/'; });
  newChatBtn.addEventListener('click', () => { if (isMobile()) closeSidebar(); if(isReceiving) return; window.location.hash = '#/'; });
  settingsBtn.addEventListener('click', () => { if (isMobile()) closeSidebar(); window.location.hash = '#/settings'; });
  accountBtn.addEventListener('click', () => { if (isMobile()) closeSidebar(); window.location.hash = '#/account'; });
  helpBtn.addEventListener('click', () => { if (isMobile()) closeSidebar(); window.location.hash = '#/help'; });

  themeBtn.addEventListener('click', (e) => { e.stopPropagation(); themePopup.classList.toggle('show'); });
  document.addEventListener('click', () => themePopup.classList.remove('show'));
  
  themeSwatches.forEach(swatch => {
    swatch.addEventListener('click', async () => {
      const theme = swatch.getAttribute('data-theme');
      if (theme === 'default') document.body.removeAttribute('data-theme');
      else document.body.setAttribute('data-theme', theme);
      
      themePopup.classList.remove('show');
      
      if (theme === 'weather') {
        await WeatherManager.syncWeather();
      } else {
        WeatherManager.clear();
      }

      await BackendHooks.saveThemePreference(theme);
    });
  });

  chatInput.addEventListener('input', adjustTextareaHeight);
  expandBtn.addEventListener('click', () => { chatBox.classList.toggle('expanded'); if(chatBox.classList.contains('expanded')) chatInput.style.height = 'auto'; else adjustTextareaHeight(); });
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); handleSend(); } });
  sendBtn.addEventListener('click', handleSend);

  init();
});