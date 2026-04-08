/**
 * calendar.js
 * Manages the interactive calendar component with original styling.
 */

import { renderTemplate } from './utils.js';
import { BackendHooks } from './api.js';

let currentViewDate = new Date(); // The month/year we're looking at
let selectedDate = new Date(); // The actual focused date (Dark Blue)
let previewRangeLength = 1; // Range duration being adjusted (1 to 7 days)
let pinnedStartDate = null; // Locked start date
let pinnedRangeLength = 0; // Locked duration
let isPinned = false; 
let referenceTodayDate = new Date(); // True today from backend

const isSameDay = (d1, d2) => 
  d1 && d2 &&
  d1.getFullYear() === d2.getFullYear() && 
  d1.getMonth() === d2.getMonth() && 
  d1.getDate() === d2.getDate();

export const CalendarManager = {
  // Callback to be set by SidebarManager
  onDateSelect: null,

  init(todayDate) {
    referenceTodayDate = new Date(todayDate);
    currentViewDate = new Date(todayDate);
    selectedDate = new Date(todayDate);
    selectedDate.setHours(0, 0, 0, 0);
  },

  async render(container) {
    if (!container) return;
    this.container = container;
    this.container.innerHTML = renderTemplate('calendar');
    await this.updateUI(true);
  },

  async setSelectedDate(date) {
    selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    currentViewDate = new Date(date);
    await this.updateUI();
    if (this.onDateSelect) this.onDateSelect(selectedDate);
  },

  getSelectedDate() {
    return selectedDate;
  },

  getRange() {
    return isPinned ? pinnedRangeLength : previewRangeLength;
  },

  async refreshDots() {
    await this.updateUI();
  },

  async loadTripRange(sessionId) {
    if (!sessionId || sessionId === 'default') {
        isPinned = false;
        pinnedStartDate = null;
        pinnedRangeLength = 0;
        await this.updateUI();
        return;
    }
    const data = await BackendHooks.fetchTripRange(sessionId);
    if (data && data.start_date) {
        isPinned = true;
        pinnedStartDate = new Date(data.start_date);
        pinnedRangeLength = data.length;
    } else {
        isPinned = false;
        pinnedStartDate = null;
        pinnedRangeLength = 0;
    }
    await this.updateUI();
  },

  async updateUI(forceFullUpdate = false) {
    const titleEl = document.getElementById('calendarTitle');
    const daysContainer = document.getElementById('calendarDays');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');
    const prevBtnHeader = document.getElementById('prevMonthBtnHeader');
    const nextBtnHeader = document.getElementById('nextMonthBtnHeader');
    const pinBtn = document.getElementById('pinRangeBtn');

    if (!titleEl || !daysContainer) {
        if (this.container) {
            this.container.innerHTML = renderTemplate('calendar');
            return this.updateUI(true);
        }
        return;
    }

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    titleEl.textContent = `${year}년 ${month + 1}월`;
    
    const fragment = document.createDocumentFragment();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

    const sessionId = window.location.hash.split('/chat/')[1] || 'default';
    const indicators = await BackendHooks.fetchMonthDataIndicators(sessionId, year, month + 1);
    const hasData = (y, m, d) => indicators.includes(`${y}-${m+1}-${d}`);

    // Ranges for visualization
    const activeStartDate = isPinned ? pinnedStartDate : selectedDate;
    const activeRangeLength = isPinned ? pinnedRangeLength : previewRangeLength;
    const activeEndDate = new Date(activeStartDate);
    activeEndDate.setDate(activeStartDate.getDate() + activeRangeLength - 1);

    const createDaySpan = (date, isCurrentMonth, opacity = '1') => {
        const span = document.createElement('span');
        span.textContent = date;
        span.style.opacity = opacity;
        span.style.position = 'relative';
        span.style.cursor = 'pointer';

        let dYear = year, dMonth = month;
        if (!isCurrentMonth) {
            const d = date > 15 ? new Date(year, month, 0) : new Date(year, month + 1, 1);
            dYear = d.getFullYear(); dMonth = d.getMonth();
        }
        
        const targetDate = new Date(dYear, dMonth, date);
        targetDate.setHours(0, 0, 0, 0);

        const isSelectedFocus = isSameDay(targetDate, selectedDate);
        const isInRange = targetDate >= activeStartDate && targetDate <= activeEndDate;

        if (isSelectedFocus) {
            span.classList.add('active'); // Dark blue square
        } else if (isInRange) {
            span.classList.add('range-mid'); // Light blue rect
        }
        
        if (hasData(dYear, dMonth, date)) {
            const dot = document.createElement('div');
            dot.className = 'calendar-data-dot';
            span.appendChild(dot);
        }

        span.onclick = async () => {
            if (!isPinned) {
                // Not pinned: change the start of preview range
                selectedDate = new Date(targetDate);
            } else {
                // Pinned: just change the focused date for sidebar
                selectedDate = new Date(targetDate);
            }
            await this.updateUI();
            if (this.onDateSelect) this.onDateSelect(selectedDate);
        };
        return span;
    };

    for (let i = firstDayOfMonth; i > 0; i--) fragment.appendChild(createDaySpan(lastDateOfPrevMonth - i + 1, false, '0.3'));
    for (let i = 1; i <= lastDateOfMonth; i++) fragment.appendChild(createDaySpan(i, true));
    const dayCount = firstDayOfMonth + lastDateOfMonth;
    const finalSlots = dayCount > 35 ? 42 : 35;
    for (let i = 1; i <= (finalSlots - dayCount); i++) fragment.appendChild(createDaySpan(i, false, '0.3'));

    daysContainer.innerHTML = '';
    daysContainer.appendChild(fragment);

    const handleMonth = async (offset) => {
        currentViewDate.setMonth(currentViewDate.getMonth() + offset);
        await this.updateUI();
    };
    if (prevBtn) prevBtn.onclick = (e) => (e.stopPropagation(), handleMonth(-1));
    if (nextBtn) nextBtn.onclick = (e) => (e.stopPropagation(), handleMonth(1));

    if (prevBtnHeader) {
        prevBtnHeader.onclick = async (e) => {
            e.stopPropagation();
            if (isPinned) {
                if (pinnedRangeLength > 1) pinnedRangeLength--;
            } else {
                if (previewRangeLength > 1) previewRangeLength--;
            }
            await this.updateUI();
        };
    }
    if (nextBtnHeader) {
        nextBtnHeader.onclick = async (e) => {
            e.stopPropagation();
            if (isPinned) {
                if (pinnedRangeLength < 7) pinnedRangeLength++;
            } else {
                if (previewRangeLength < 7) previewRangeLength++;
            }
            await this.updateUI();
        };
    }

    if (pinBtn) {
        pinBtn.style.background = isPinned ? 'rgba(59, 130, 246, 0.2)' : 'none';
        pinBtn.onclick = async (e) => {
            e.stopPropagation();
            isPinned = !isPinned;
            if (isPinned) {
                pinnedStartDate = new Date(selectedDate);
                pinnedRangeLength = previewRangeLength;
                
                const sessionId = window.location.hash.split('/chat/')[1] || 'default';
                if (sessionId !== 'default') {
                    const dateStr = `${pinnedStartDate.getFullYear()}-${pinnedStartDate.getMonth()+1}-${pinnedStartDate.getDate()}`;
                    await BackendHooks.saveTripRange(sessionId, dateStr, pinnedRangeLength);
                }
            } else {
                pinnedStartDate = null;
                pinnedRangeLength = 0;
                // Optionally clear from backend
            }
            await this.updateUI();
        };
    }

    if (todayBtn) {
        todayBtn.onclick = async (e) => {
          e.stopPropagation();
          isPinned = false; // Reset pin on today click? Or keep? User choice.
          await this.setSelectedDate(new Date(referenceTodayDate));
        };
    }
  }
};
