/**
 * api.js
 * handles all backend API interactions including sessions, messages, and theme preferences.
 */

export const BackendHooks = {
  /**
   * authenticates a user.
   */
  async login(id, pw) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pw })
    });
    return await res.json();
  },

  /**
   * authenticates as a guest.
   */
  async guestLogin() {
    const res = await fetch('/api/auth/guest', { method: 'POST' });
    return await res.json();
  },

  /**
   * initiates social login.
   */
  async socialLogin(provider) {
    const res = await fetch(`/api/auth/social/${provider}`, { method: 'POST' });
    return await res.json();
  },

  /**
   * initiates user sign up.
   */
  async signUp(userData) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return await res.json();
  },

  /**
   * initiates find account process.
   */
  async findAccount() {
    const res = await fetch('/api/auth/find', { method: 'POST' });
    return await res.json();
  },

  /**
   * fetches the list of chat sessions by mode (personal or team).
   */
  async fetchSessionList(mode = 'personal') {
    try {
      const res = await fetch(`/api/sessions?mode=${mode}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchSessionList):", error);
      return [];
    }
  },

  /**
   * creates a new chat session.
   */
  async createSession(firstMessage, mode = 'personal') {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_message: firstMessage, mode })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (createSession):", error);
      throw error;
    }
  },

  /**
   * updates a session's mode (moves it between personal/team).
   */
  async updateSessionMode(sessionId, mode) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (updateSessionMode):", error);
      throw error;
    }
  },

  /**
   * invites a user to a team session.
   */
  async inviteUserToSession(sessionId, searchInput) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: searchInput })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (inviteUserToSession):", error);
      throw error;
    }
  },

  /**
   * fetches initial application context (today's date, global settings).
   */
  async fetchAppContext() {
    try {
      const res = await fetch('/api/context');
      if (!res.ok) throw new Error('Not Found');
      return await res.json(); 
    } catch (err) {
      console.warn("Backend /api/context not ready, using defaults.");
      return {
        today: new Date().toISOString().split('T')[0],
        settings: { 
          appGlassOpacity: '20', 
          leftSidebarCustomWidth: 300, 
          rightSidebarCustomWidth: 300, 
          theme: 'default' 
        }
      };
    }
  },

  /**
   * fetches user UI settings.
   */
  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return {};
      return await res.json();
    } catch (e) { return {}; }
  },

  /**
   * saves a specific UI setting.
   */
  async saveUserSetting(key, value) {
    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (saveUserSetting):", error);
    }
  },

  /**
   * fetches the chat history for a specific session.
   */
  async fetchChatHistory(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/history`);
      if (!res.ok) return [];
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchChatHistory):", error);
      return [];
    }
  },

  /**
   * sends a message and handles the streaming response.
   */
  async sendMessage(sessionId, message, onChunkReceived, onCompleted) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.body) throw new Error("Streaming not supported");

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
   * fetches account information.
   */
  async fetchAccountInfo() {
    try {
      const res = await fetch('/api/account');
      return await res.json();
    } catch (e) { return { name: 'Guest', email: '' }; }
  },

  /**
   * fetches help/documentation data.
   */
  async fetchHelpData() {
    try {
      const res = await fetch('/api/help');
      return await res.json();
    } catch (e) { return { sections: [] }; }
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
   * fetches current weather data.
   */
  async fetchCurrentWeather() {
    try {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error();
      return await res.json(); 
    } catch (err) {
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
   * triggers a share action for the chat session.
   * returns a shareable link or status.
   */
  async shareChat(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method: 'POST'
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (shareChat):", error);
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
   * saves map markers for a specific session.
   */
  async saveMapMarkers(sessionId, markers) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/map/markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markers })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (saveMapMarkers):", error);
    }
  },

  /**
   * fetches map markers for a specific session.
   */
  async fetchMapMarkers(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/map/markers`);
      if (!res.ok) return { markers: [] };
      return await res.json();
    } catch (error) {
      console.error("API Error (fetchMapMarkers):", error);
      return { markers: [] };
    }
  },

  /**
   * adds a single map marker (backend-side call or parent proxy).
   */
  async addMapMarker(sessionId, markerId, lat, lng, title = '') {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/map/markers/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marker_id: markerId, lat, lng, title })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (addMapMarker):", error);
    }
  },

  /**
   * removes a single map marker by id.
   */
  async removeMapMarker(sessionId, markerId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/map/markers/${encodeURIComponent(markerId)}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (removeMapMarker):", error);
    }
  },

  /**
   * saves the trip ranges for a specific session.
   */
  async saveTripRange(sessionId, ranges) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/trip_range`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges })
      });
      return await res.json();
    } catch (error) {
      console.error("API Error (saveTripRange):", error);
    }
  },

  /**
   * fetches the trip ranges for a specific session.
   */
  async fetchTripRange(sessionId) {
    try {
      if (!sessionId || sessionId === 'default') return { ranges: [] };
      const res = await fetch(`/api/sessions/${sessionId}/trip_range`);
      if (!res.ok) return { ranges: [] };
      return await res.json();
    } catch (error) {
      return { ranges: [] };
    }
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
   * saves user's memo for a specific session and date.
   */
  async saveMemo(sessionId, memoContent, dateKey) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/memo?date=${dateKey}`, {
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
   * fetches user's memo for a specific session and date.
   */
  async fetchMemo(sessionId, dateKey) {
    try {
      if (!sessionId || sessionId === 'default') return { memo: '' };
      const res = await fetch(`/api/sessions/${sessionId}/memo?date=${dateKey}`);
      if (!res.ok) return { memo: '' };
      return await res.json();
    } catch (error) {
      return { memo: '' };
    }
  },

  /**
   * updates the current schedule (plan) for a specific session and date.
   */
  async updateSchedule(sessionId, planData, dateKey) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/plan?date=${dateKey}`, {
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
   * fetches the current schedule (plan) for a specific session and date.
   */
  async fetchSchedule(sessionId, dateKey) {
    try {
      if (!sessionId || sessionId === 'default') return { plan: [] };
      const res = await fetch(`/api/sessions/${sessionId}/plan?date=${dateKey}`);
      if (!res.ok) return { plan: [] };
      return await res.json();
    } catch (error) {
      return { plan: [] };
    }
  },

  /**
   * fetches dates that have data (memo/schedule) for the calendar dot indicators.
   */
  async fetchMonthDataIndicators(sessionId, year, month) {
    try {
      if (!sessionId || sessionId === 'default') return [];
      const res = await fetch(`/api/sessions/${sessionId}/indicators?year=${year}&month=${month}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (error) {
      return [];
    }
  }
};
