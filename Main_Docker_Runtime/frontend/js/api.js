// js/api.js

export const BackendHooks = {
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
  },

  async updateSessionTitle(sessionId, newTitle) {
    console.log(`[API 호출] 세션 ${sessionId}의 이름을 '${newTitle}'로 업데이트`);
    const res = await fetch(`/api/sessions/${sessionId}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
    return res.json();
  },

  async deleteSession(sessionId) {
    console.log(`[API 호출] 세션 ${sessionId} 삭제 요청`);
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  downloadChat(sessionId) {
    console.log(`[API 호출] 세션 ${sessionId} 다운로드 요청`);
    window.location.href = `/api/sessions/${sessionId}/download`;
  },

  async uploadFiles(sessionId, files) {
    console.log(`[API 호출] 세션 ${sessionId}에 파일 업로드 시작`, files);
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    
    const res = await fetch(`/api/sessions/${sessionId}/files`, {
      method: 'POST',
      body: formData 
    });
    return res.json();
  }
};