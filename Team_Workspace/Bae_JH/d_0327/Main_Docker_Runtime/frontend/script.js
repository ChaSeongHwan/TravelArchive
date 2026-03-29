// script.js (루트 폴더 위치)
import { BackendHooks } from './js/api.js';
import { 
  updateSidebarSessionTitle, 
  showToast, 
  adjustTextareaHeight, 
  showLoadingIndicator, 
  removeLoadingIndicator, 
  appendMessage 
} from './js/ui.js';
import { WeatherManager } from './js/weatherManager.js';

document.addEventListener('DOMContentLoaded', () => {

  // 1. DOM 요소 및 전역 상태
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
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  
  const rightSidebar = document.getElementById('rightSidebar');
  const mapToggleBtn = document.getElementById('mapToggleBtn');
  const closeRightSidebarBtn = document.getElementById('closeRightSidebarBtn');
  const rightSidebarOverlay = document.getElementById('rightSidebarOverlay');

  const rightSidebarResizer = document.getElementById('rightSidebarResizer');
  const resetRightSidebarBtn = document.getElementById('resetRightSidebarBtn');

  let isRightSidebarDragging = false;
  let rsStartX = 0;
  let rsStartWidth = 0;
  
  const savedRightWidth = localStorage.getItem('rightSidebarCustomWidth');
  let currentRightWidth = savedRightWidth ? parseInt(savedRightWidth, 10) : 320;

  const homeBtn = document.getElementById('homeBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const accountBtn = document.getElementById('accountBtn');
  const helpBtn = document.getElementById('helpBtn');
  
  const themeBtn = document.getElementById('themeBtn');
  const themePopup = document.getElementById('themePopup');
  const themeSwatches = document.querySelectorAll('.theme-swatch');

  const weatherLayer = document.getElementById('weatherLayer');

  const topBarActions = document.getElementById('topBarActions');
  const downloadChatBtn = document.getElementById('downloadChatBtn');
  const shareChatBtn = document.getElementById('shareChatBtn');
  
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');

  let currentSessionId = null;
  let isReceiving = false;

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  // =========================================================================
  // [추가된 부분] 새로고침 시 무작위 파노라마 배경 이미지 선택 및 적용
  // =========================================================================
  const bgImages = [
    './resource/bg-long-1.jpg',
    './resource/bg-long-2.jpg',
    './resource/bg-long-3.jpg',
    './resource/bg-long-4.jpg',
    './resource/bg-long-5.jpg'
  ];
  
  const randomIndex = Math.floor(Math.random() * bgImages.length);
  const selectedImage = bgImages[randomIndex];
  
  const bgPanoramaElement = document.getElementById('bgPanorama');
  if (bgPanoramaElement) {
    bgPanoramaElement.style.backgroundImage = `url('${selectedImage}')`;
  }
  // =========================================================================

  // 2. 라우팅 및 뷰 전환
  function switchView(viewName) {
    heroSection.style.display = 'none';
    chatHistory.style.display = 'none';
    chatWrap.style.display = 'none';
    pageSection.style.display = 'none';
    // fork 버전의 변경사항: 지도를 제어하는 topBarActions 영역이 전역에서 항상 보이도록 flex로 유지
    topBarActions.style.display = 'flex';

    if (viewName === 'home') {
      heroSection.style.display = 'flex'; chatWrap.style.display = 'block'; currentSessionId = null;
    } else if (viewName === 'chat') {
      chatHistory.style.display = 'flex'; chatWrap.style.display = 'block'; topBarActions.style.display = 'flex';
    } else if (viewName === 'page') {
      pageSection.style.display = 'flex'; currentSessionId = null;
    }
  }

  async function router() {
    const path = window.location.hash;
    if (path === '' || path === '#/') {
      switchView('home'); 
      chatHistory.innerHTML = ''; 
      chatInput.value = ''; 
      adjustTextareaHeight(chatInput, chatBox); 
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
        chatHistory.innerHTML = '';
        const loadingId = showLoadingIndicator(chatHistory);
        currentSessionId = ssid;
        
        const historyData = await BackendHooks.fetchChatHistory(ssid);
        removeLoadingIndicator(loadingId);
        historyData.forEach(msg => appendMessage(chatHistory, msg.content, msg.role));
      } else { 
        switchView('chat'); 
      }
    }
  }

  // 3. 사이드바 아이템 렌더링
  function renderSidebarItem(title, sessionId, isPrepend = true) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sidebar-item-wrapper';

    const newBtn = document.createElement('button'); 
    newBtn.classList.add('sidebar-item'); 
    newBtn.setAttribute('data-session-id', sessionId);
    newBtn.innerHTML = `<span class="dot"></span>${title}`;
    
    const editInput = document.createElement('input');
    editInput.className = 'sidebar-item-edit-input';
    editInput.type = 'text';
    editInput.value = title;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'session-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'session-action-btn';
    editBtn.innerHTML = '✎';
    editBtn.title = "이름 변경";

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'session-action-btn';
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    deleteBtn.title = "대화 삭제";

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    newBtn.addEventListener('click', () => { if (isReceiving) return; window.location.hash = `#/chat/${sessionId}`; });

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      newBtn.style.display = 'none';
      actionsDiv.style.display = 'none';
      editInput.style.display = 'block';
      editInput.focus();
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if(confirm("이 대화를 정말로 삭제하시겠습니까?")) {
        try {
          const response = await BackendHooks.deleteSession(sessionId);
          if (response.success) {
            console.log(response.message);
            wrapper.remove(); 
            const currentTitle = editInput.value;
            showToast(`세션 '${currentTitle}'이(가) 삭제되었습니다.`);
            
            if (currentSessionId === sessionId) {
              window.location.hash = '#/';
            }
          } else {
            alert("삭제에 실패했습니다.");
          }
        } catch (error) {
          console.error("삭제 통신 오류:", error);
          alert("서버와의 연결에 문제가 발생했습니다.");
        }
      }
    });

    const saveTitle = async () => {
      const newTitle = editInput.value.trim();
      if (newTitle && newTitle !== title) {
        await BackendHooks.updateSessionTitle(sessionId, newTitle);
        updateSidebarSessionTitle(sessionId, newTitle);
        title = newTitle; 
      } else {
        editInput.value = title; 
      }
      editInput.style.display = 'none';
      newBtn.style.display = 'flex';
      actionsDiv.style.display = ''; 
    };

    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveTitle();
      else if (e.key === 'Escape') {
        editInput.value = title; 
        editInput.style.display = 'none';
        newBtn.style.display = 'flex';
        actionsDiv.style.display = ''; 
      }
    });
    editInput.addEventListener('blur', saveTitle);

    wrapper.appendChild(newBtn);
    wrapper.appendChild(editInput);
    wrapper.appendChild(actionsDiv);

    if (isPrepend) sidebarList.prepend(wrapper); 
    else sidebarList.appendChild(wrapper);
  }

  // 4. 채팅 핵심 로직
  async function handleSend() {
    const text = chatInput.value.trim(); if (!text || isReceiving) return;
    let isNewSession = false;

    if (!currentSessionId) {
        const session = await BackendHooks.createSession(text);
        currentSessionId = session.id; renderSidebarItem(session.title, session.id, true); isNewSession = true;
    }
    if (isNewSession) { history.pushState(null, '', `#/chat/${currentSessionId}`); switchView('chat'); }

    appendMessage(chatHistory, text, 'user'); 
    chatInput.value = ''; 
    adjustTextareaHeight(chatInput, chatBox);
    isReceiving = true; 
    sendBtn.disabled = true; 
    const loadingId = showLoadingIndicator(chatHistory); 
    let botMsgDiv = null;

    await BackendHooks.sendMessage(currentSessionId, text, (chunk) => {
        if (!botMsgDiv) { 
          removeLoadingIndicator(loadingId); 
          botMsgDiv = appendMessage(chatHistory, '', 'bot'); 
        }
        if (typeof marked !== 'undefined') {
          botMsgDiv.querySelector('.message').innerHTML = marked.parse(chunk); 
        } else {
          botMsgDiv.querySelector('.message').textContent = chunk;
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }, async () => { 
        isReceiving = false; 
        sendBtn.disabled = false; 
        
        try {
          const sessions = await BackendHooks.fetchSessionList();
          const updatedSession = sessions.find(s => s.id === currentSessionId);
          if (updatedSession) {
            updateSidebarSessionTitle(currentSessionId, updatedSession.title);
          }
        } catch (e) {
          console.error("세션 이름 동기화 실패:", e);
        }
      }
    );
  }

  // 5. 이벤트 바인딩 및 초기화
  async function init() {
    sidebarList.innerHTML = '';
    const sessions = await BackendHooks.fetchSessionList();
    sessions.forEach(session => renderSidebarItem(session.title, session.id, false));
  }

  window.addEventListener('hashchange', router); 
  window.addEventListener('load', router);
  
  // 왼쪽 사이드바 제어 로직
  menuToggle.addEventListener('click', toggleSidebar);

  function openSidebar() {
    if (isMobile()) { 
      sidebar.classList.add('open'); 
      if (sidebarOverlay) { 
        sidebarOverlay.style.display = 'block'; 
        requestAnimationFrame(() => sidebarOverlay.classList.add('show')); 
      }
    } else { sidebar.classList.remove('collapsed'); }
  }

  function closeSidebar() {
    if (isMobile()) { 
      sidebar.classList.remove('open'); 
      if (sidebarOverlay) { 
        sidebarOverlay.classList.remove('show'); 
        setTimeout(() => { sidebarOverlay.style.display = 'none'; }, 300); 
      }
    } else { sidebar.classList.add('collapsed'); }
  }

  function toggleSidebar() { 
    if (isMobile()) { sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); } 
    else { sidebar.classList.contains('collapsed') ? openSidebar() : closeSidebar(); } 
  }
// ============== [우측 사이드바 로직] ==============
  function openRightSidebar() {
    if (isMobile()) { 
      rightSidebar.classList.add('open'); 
      if (rightSidebarOverlay) { 
        rightSidebarOverlay.style.display = 'block'; 
        requestAnimationFrame(() => rightSidebarOverlay.classList.add('show')); 
      }
    } else { 
      rightSidebar.classList.remove('collapsed'); 
      // PC 환경에서 열릴 때, 사용자가 지정했던 크기를 적용
      rightSidebar.style.width = `${currentRightWidth}px`; 
    }
    
    // [중요] 카카오 맵 API 방어 로직: 사이드바 애니메이션(0.3s)이 끝난 후 지도 레이아웃 재계산
    setTimeout(() => {
      // 카카오 맵 객체가 window.kakaoMap 이라는 이름으로 전역에 선언되었다고 가정할 때의 예시입니다.
      // 실제 지도 객체 변수명에 맞게 변경하세요.
      if (window.kakaoMap && typeof window.kakaoMap.relayout === 'function') {
        window.kakaoMap.relayout();
      }
    }, 310);
  }

  function closeRightSidebar() {
    if (isMobile()) { 
      rightSidebar.classList.remove('open'); 
      if (rightSidebarOverlay) { 
        rightSidebarOverlay.classList.remove('show'); 
        setTimeout(() => { rightSidebarOverlay.style.display = 'none'; }, 300); 
      }
    } else { 
      rightSidebar.classList.add('collapsed'); 
      // 닫힐 때는 인라인 width를 빈 문자열로 초기화하여 css의 !important가 먹히도록 함
      rightSidebar.style.width = '';
    }
  }

  function toggleRightSidebar() { 
    if (isMobile()) { 
      rightSidebar.classList.contains('open') ? closeRightSidebar() : openRightSidebar(); 
    } else { 
      rightSidebar.classList.contains('collapsed') ? openRightSidebar() : closeRightSidebar(); 
    } 
  }
  
// ============== [드래그 앤 드롭 이벤트 리스너] ==============
  if (rightSidebarResizer) {
    // 1. 드래그 시작 (마우스 누름)
    rightSidebarResizer.addEventListener('mousedown', (e) => {
      // 모바일 화면에서는 드래그 동작 비활성화
      if (isMobile()) return; 

      isRightSidebarDragging = true;
      rsStartX = e.clientX;
      rsStartWidth = rightSidebar.getBoundingClientRect().width;
      
      // 트랜지션 효과를 끄고, 리사이저 디자인을 활성화
      rightSidebar.classList.add('notransition');
      rightSidebarResizer.classList.add('active');
      
      // 드래그 중 텍스트가 블록 지정되는 현상 방지 및 마우스 커서 전역 유지
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    });
  }

  // 2. 마우스 이동 (크기 동적 계산)
  document.addEventListener('mousemove', (e) => {
    if (!isRightSidebarDragging) return;

    // 우측 사이드바는 화면 오른쪽 끝에 붙어있으므로, 마우스가 왼쪽(X축 감소)으로 갈수록 너비가 커져야 함
    const mouseDelta = rsStartX - e.clientX;
    let newWidth = rsStartWidth + mouseDelta;

    // 최소/최대 너비 방어 로직 (최소 260px, 최대 브라우저 창 너비의 60%)
    const minWidth = 260;
    const maxWidth = window.innerWidth * 0.6;
    
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    // 계산된 너비를 사이드바에 실시간 적용
    rightSidebar.style.width = `${newWidth}px`;
    currentRightWidth = newWidth; // 전역 상태 업데이트
  });

  // 3. 마우스 떼기 (드래그 종료 및 로컬 스토리지 저장)
  document.addEventListener('mouseup', () => {
    if (isRightSidebarDragging) {
      isRightSidebarDragging = false;
      
      // 상태 및 스타일 원상 복구
      rightSidebar.classList.remove('notransition');
      rightSidebarResizer.classList.remove('active');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      // 브라우저 로컬 스토리지에 사용자가 지정한 크기 영구 저장
      localStorage.setItem('rightSidebarCustomWidth', currentRightWidth);

      // [중요] 사용자가 사이드바 크기를 변경했으므로, 찌그러진 카카오 맵을 다시 렌더링하도록 강제 신호 발송
      if (window.kakaoMap && typeof window.kakaoMap.relayout === 'function') {
        window.kakaoMap.relayout();
      }
    }
  });

  if (resetRightSidebarBtn) {
    resetRightSidebarBtn.addEventListener('click', () => {
      // 1. 기본 너비값 상수 정의 (right_sidebar.css에 정의된 기본 너비 320px)
      const defaultWidth = 320;
      
      // 2. 현재 상태를 기본값으로 즉각 변경
      currentRightWidth = defaultWidth;
      
      // 3. 우측 사이드바에 인라인 스타일로 너비 적용
      // (css의 transition: width 0.3s ease; 덕분에 0.3초 동안 부드럽게 줄어들거나 늘어납니다)
      rightSidebar.style.width = `${defaultWidth}px`;
      
      // 4. 로컬 스토리지에 저장된 커스텀 너비 데이터를 기본값으로 덮어씌워 브라우저가 기억하게 함
      // (또는 localStorage.removeItem('rightSidebarCustomWidth'); 로 키 자체를 삭제해도 무방합니다)
      localStorage.setItem('rightSidebarCustomWidth', defaultWidth);
      
      // 5. [극도로 중요] 지도 API 리레이아웃 방어 로직
      // 사이드바의 크기가 변하는 트랜지션 애니메이션이 0.3초(300ms) 동안 진행됩니다.
      // 애니메이션이 완전히 끝난 직후에 지도의 판(Container) 크기를 재계산해야 지도가 깨지지 않습니다.
      setTimeout(() => {
        // 실제 카카오 맵 객체 변수명(예: window.kakaoMap, map 등)에 맞게 호출해야 합니다.
        if (window.kakaoMap && typeof window.kakaoMap.relayout === 'function') {
          window.kakaoMap.relayout();
        }
      }, 310); // 300ms 애니메이션 종료 후 10ms 여유를 두어 310ms에 실행
      
      // 6. UI 피드백 (선택 사항) - 사용자에게 초기화되었음을 알려주는 토스트 메시지 출력
      if (typeof showToast === 'function') {
        showToast("사이드바 크기가 기본값으로 초기화되었습니다.");
      }
    });
  }
  // ==============================================================================

  if (mapToggleBtn) mapToggleBtn.addEventListener('click', toggleRightSidebar);
  if (closeRightSidebarBtn) closeRightSidebarBtn.addEventListener('click', closeRightSidebar);

  // 창 크기 변경 시 오버레이 초기화
  window.addEventListener('resize', () => { 
    if (!isMobile()) { 
      sidebar.classList.remove('open'); 
      if (sidebarOverlay) { sidebarOverlay.classList.remove('show'); sidebarOverlay.style.display = 'none'; } 
      
      rightSidebar.classList.remove('open'); 
      if (rightSidebarOverlay) { rightSidebarOverlay.classList.remove('show'); rightSidebarOverlay.style.display = 'none'; } 
    } 
  });
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  if (rightSidebarOverlay) rightSidebarOverlay.addEventListener('click', closeRightSidebar);
  
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
        await WeatherManager.syncWeather(weatherLayer);
      } else {
        WeatherManager.clear(weatherLayer);
      }

      await BackendHooks.saveThemePreference(theme);
    });
  });

  chatInput.addEventListener('input', () => adjustTextareaHeight(chatInput, chatBox));
  
  expandBtn.addEventListener('click', () => { 
    chatBox.classList.toggle('expanded'); 
    if(chatBox.classList.contains('expanded')) chatInput.style.height = 'auto'; 
    else adjustTextareaHeight(chatInput, chatBox); 
  });
  
  chatInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { 
      e.preventDefault(); handleSend(); 
    } 
  });
  
  sendBtn.addEventListener('click', handleSend);

  downloadChatBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    if(confirm("전체 대화 기록을 다운로드하시겠습니까?")) {
      BackendHooks.downloadChat(currentSessionId);
    }
  });

  shareChatBtn.addEventListener('click', () => {
    alert("공유하기 기능이 호출되었습니다."); 
  });

  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
  });

  chatBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatBox.classList.add('drag-over');
  });

  chatBox.addEventListener('dragleave', () => {
    chatBox.classList.remove('drag-over');
  });

  chatBox.addEventListener('drop', (e) => {
    e.preventDefault();
    chatBox.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  });

  function handleFileUpload(files) {
    if (!currentSessionId) {
      alert("먼저 대화를 시작해주세요.");
      return;
    }
    const fileNames = Array.from(files).map(f => f.name).join(', ');
    appendMessage(chatHistory, `[파일 첨부] ${fileNames}`, 'user'); 
    BackendHooks.uploadFiles(currentSessionId, files); 
    fileInput.value = ""; 
  }

  init();
});