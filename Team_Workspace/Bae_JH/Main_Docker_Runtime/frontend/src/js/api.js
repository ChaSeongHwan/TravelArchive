/**
 * api.js
 * handles all backend API interactions including sessions, messages, and theme preferences.
 */

export const BackendHooks = {
  /**
   * fetches the list of all chat sessions.
   * @returns {Promise<Array>}
   */
  async fetchSessionList() {
    try {
      const res = await fetch('/api/sessions');
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchSessionList):", error);
      throw error;
    }
  },

  /**
   * creates a new chat session with an initial message.
   * @param {string} firstMessage 
   * @returns {Promise<Object>}
   */
  async createSession(firstMessage) {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_message: firstMessage })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (createSession):", error);
      throw error;
    }
  },

  /**
   * fetches the chat history for a specific session.
   * @param {string} sessionId 
   * @returns {Promise<Array>}
   */
  async fetchChatHistory(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/history`);
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchChatHistory):", error);
      throw error;
    }
  },

  /**
   * sends a message and handles the streaming response.
   * @param {string} sessionId 
   * @param {string} message 
   * @param {Function} onChunkReceived 
   * @param {Function} onCompleted 
   */
  async sendMessage(sessionId, message, onChunkReceived, onCompleted) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.body) throw new Error("Streaming not supported by the browser.");

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
      console.error("API Error (sendMessage):", error);
      onCompleted();
    }
  },

  /**
   * fetches application settings.
   */
  async fetchSettings() {
    const res = await fetch('/api/settings');
    return res.json();
  },

  /**
   * fetches account information.
   */
  async fetchAccountInfo() {
    const res = await fetch('/api/account');
    return res.json();
  },

  /**
   * fetches help/documentation data.
   */
  async fetchHelpData() {
    const res = await fetch('/api/help');
    return res.json();
  },

  /**
   * saves the user's theme preference.
   */
  async saveThemePreference(themeName) {
    try {
      const res = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeName })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (saveThemePreference):", error);
    }
  },

  /**
   * fetches current weather data for the weather theme.
   */
  async fetchCurrentWeather() {
    try {
      const res = await fetch('/api/weather');
      return await res.json(); 
    } catch (err) {
      console.error("API Error (fetchCurrentWeather):", err);
      return { condition: 'clear', params: {} };
    }
  },

  /**
   * updates the title of a session.
   */
  async updateSessionTitle(sessionId, newTitle) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (updateSessionTitle):", error);
      throw error;
    }
  },

  /**
   * deletes a chat session.
   */
  async deleteSession(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (deleteSession):", error);
      throw error;
    }
  },

  /**
   * triggers a download for the chat history.
   */
  downloadChat(sessionId) {
    window.location.href = `/api/sessions/${sessionId}/download`;
  },

  /**
   * uploads files to a specific session.
   */
  async uploadFiles(sessionId, files) {
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
      
      const res = await fetch(`/api/sessions/${sessionId}/files`, {
        method: 'POST',
        body: formData 
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (uploadFiles):", error);
      throw error;
    }
  },

  /**
   * saves user's memo for a specific session.
   */
  async saveMemo(sessionId, memoContent) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/memo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: memoContent })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (saveMemo):", error);
      throw error;
    }
  },

  /**
   * fetches user's memo for a specific session.
   */
  async fetchMemo(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/memo`);
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchMemo):", error);
      throw error;
    }
  },

  /**
   * updates the current schedule (plan) for a specific session.
   * @param {string} sessionId 
   * @param {Array|Object} planData - JSON representing the trip plan.
   */
  async updateSchedule(sessionId, planData) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planData })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (updateSchedule):", error);
      throw error;
    }
  },

  /**
   * fetches the current schedule (plan) for a specific session.
   */
  async fetchSchedule(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/plan`);
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchSchedule):", error);
      throw error;
    }
  }
};
