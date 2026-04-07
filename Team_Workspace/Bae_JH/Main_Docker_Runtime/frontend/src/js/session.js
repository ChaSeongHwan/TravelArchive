/**
 * session.js
 */

import { BackendHooks } from './api.js';
import { Icons } from './assets.js';
import { renderTemplate, createElementFromHTML } from './utils.js';
import { updateSidebarSessionTitle, showToast } from './ui.js';

export const SessionManager = {
  renderSidebarItem(title, sessionId, elements, state, isPrepend = true) {
    const html = renderTemplate('session_item', { title, sessionId }, Icons);
    const wrapper = createElementFromHTML(html);

    const newBtn = wrapper.querySelector('.sidebar-item');
    const editInput = wrapper.querySelector('.sidebar-item-edit-input');
    const actionsDiv = wrapper.querySelector('.session-actions');
    const moreBtn = wrapper.querySelector('.more-btn');
    const dropdownMenu = wrapper.querySelector('.session-dropdown-menu');
    const editBtn = wrapper.querySelector('.edit-btn');
    const deleteBtn = wrapper.querySelector('.delete-btn');
    const teamPlannerBtn = wrapper.querySelector('.team-planner-btn');
    const inviteBtn = wrapper.querySelector('.invite-btn');

    // Configure the 'Move' button based on current mode
    const moveBtnText = teamPlannerBtn.querySelector('span:last-child');
    const moveBtnIcon = teamPlannerBtn.querySelector('.icon');
    
    if (state.currentMode === 'team') {
      inviteBtn.style.display = 'flex';
      moveBtnText.textContent = '개인 플래너 이동';
      moveBtnIcon.innerHTML = Icons.Home;
    } else {
      moveBtnText.textContent = '팀 플래너 이동';
      moveBtnIcon.innerHTML = Icons.Map;
    }
    
    newBtn.addEventListener('click', () => {
      if (state.isReceiving) return;
      window.location.hash = `#/chat/${sessionId}`;
    });
    
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other open menus
      document.querySelectorAll('.session-dropdown-menu.show').forEach(menu => {
        if (menu !== dropdownMenu) menu.classList.remove('show');
      });
      dropdownMenu.classList.toggle('show');
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('show');
      newBtn.style.display = 'none';
      actionsDiv.style.display = 'none';
      editInput.style.display = 'block';
      editInput.focus();
    });
    
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('show');
      if(confirm("삭제하시겠습니까?")) {
        try {
          const response = await BackendHooks.deleteSession(sessionId);
          if (response.success) {
            wrapper.remove();
            showToast(`삭제됨`);
            if (state.currentSessionId === sessionId) window.location.hash = '#/';
          }
        } catch (error) { console.error(error); }
      }
    });

    teamPlannerBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('show');
      
      const targetMode = state.currentMode === 'personal' ? 'team' : 'personal';

      try {
        await BackendHooks.updateSessionMode(sessionId, targetMode);
        wrapper.remove();
        showToast(`${targetMode === 'team' ? '팀' : '개인'} 플래너로 이동되었습니다.`);
      } catch (error) {
        console.error("Failed to move session mode:", error);
      }
    });

    inviteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('show');
      
      // 1. Render Modal from template
      const modalHtml = renderTemplate('user_search', {}, Icons);
      const modal = createElementFromHTML(modalHtml);
      document.body.appendChild(modal);

      // 2. Show modal (trigger animation)
      setTimeout(() => modal.classList.add('show'), 10);

      // 3. Close logic
      const closeBtn = modal.querySelector('.modal-close-btn');
      const close = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      };
      
      closeBtn.addEventListener('click', close);
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) close();
      });

      // 4. Input focus & Invite action
      const input = modal.querySelector('#userSearchInput');
      const actionBtn = modal.querySelector('.modal-action-btn');

      actionBtn.addEventListener('click', async () => {
        const searchVal = input.value.trim();
        if (!searchVal) return;

        try {
          await BackendHooks.inviteUserToSession(sessionId, searchVal);
          showToast(`${searchVal}님이 초대되었습니다.`);
          close();
        } catch (err) {
          console.error("Failed to invite user:", err);
          showToast(`초대에 실패했습니다.`);
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') actionBtn.click();
      });

      input.focus();
    });

    const saveTitle = async () => {
      const newTitle = editInput.value.trim();
      if (newTitle && newTitle !== title) {
        try {
          await BackendHooks.updateSessionTitle(sessionId, newTitle);
          updateSidebarSessionTitle(sessionId, newTitle);
          title = newTitle;
        } catch (error) { console.error(error); }
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

    if (isPrepend) elements.sidebarList.prepend(wrapper);
    else elements.sidebarList.appendChild(wrapper);
  },

  async init(elements, state) {
    elements.sidebarList.innerHTML = '';
    const mode = state.currentMode || 'personal';

    try {
      const filteredSessions = await BackendHooks.fetchSessionList(mode);
      for (const session of filteredSessions) {
        this.renderSidebarItem(session.title, session.id, elements, state, false);
      }
    } catch (error) { console.error(error); }
  }
};
