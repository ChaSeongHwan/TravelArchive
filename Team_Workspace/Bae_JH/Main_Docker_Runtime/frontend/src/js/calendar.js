/**
 * calendar.js
 * Manages the interactive calendar component with original styling.
 */

import { renderTemplate } from './utils.js';
import { BackendHooks } from './api.js';

let currentViewDate = new Date(); // The month/year we're looking at
let selectedDate = new Date(); // The actual selected date
let referenceTodayDate = new Date(); // True today from backend

export const CalendarManager = {
  // Callback to be set by SidebarManager
  onDateSelect: null,

  init(todayDate) {
    referenceTodayDate = new Date(todayDate);
    currentViewDate = new Date(todayDate);
    selectedDate = new Date(todayDate);
  },

  async render(container) {
    if (!container) return;
    this.container = container;
    await this.updateUI();
  },

  async setSelectedDate(date) {
    selectedDate = new Date(date);
    currentViewDate = new Date(date);
    await this.updateUI();
    if (this.onDateSelect) this.onDateSelect(selectedDate);
  },

  getSelectedDate() {
    return selectedDate;
  },

  // This will be called to refresh dots when data changes
  async refreshDots() {
    await this.updateUI();
  },

  async updateUI() {
    this.container.innerHTML = renderTemplate('calendar');

    const titleEl = document.getElementById('calendarTitle');
    const daysContainer = document.getElementById('calendarDays');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    titleEl.textContent = `${year}년 ${month + 1}월`;
    daysContainer.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

    const sessionId = window.location.hash.split('/chat/')[1] || 'default';
    const indicators = await BackendHooks.fetchMonthDataIndicators(sessionId, year, month + 1);

    const hasData = (y, m, d) => indicators.includes(`${y}-${m+1}-${d}`);

    const createDaySpan = (date, isCurrentMonth, opacity = '1') => {
        const span = document.createElement('span');
        span.textContent = date;
        span.style.opacity = opacity;
        span.style.position = 'relative';
        span.style.cursor = 'pointer';

        const dYear = currentViewDate.getFullYear();
        const dMonth = isCurrentMonth ? currentViewDate.getMonth() : (date > 15 ? currentViewDate.getMonth()-1 : currentViewDate.getMonth()+1);
        
        if (isCurrentMonth) {
            // Check if selected
            if (selectedDate.getFullYear() === dYear && selectedDate.getMonth() === dMonth && selectedDate.getDate() === date) {
                span.className = 'active';
            }
            
            // Check for data dot
            if (hasData(dYear, dMonth, date)) {
                const dot = document.createElement('div');
                dot.className = 'calendar-data-dot';
                span.appendChild(dot);
            }

            span.onclick = async () => {
                selectedDate = new Date(dYear, dMonth, date);
                await this.updateUI();
                if (this.onDateSelect) this.onDateSelect(selectedDate);
            };
        }
        return span;
    };

    // Fill previous month's days
    for (let i = firstDayOfMonth; i > 0; i--) {
      daysContainer.appendChild(createDaySpan(lastDateOfPrevMonth - i + 1, false, '0.3'));
    }

    // Fill current month's days
    for (let i = 1; i <= lastDateOfMonth; i++) {
      daysContainer.appendChild(createDaySpan(i, true));
    }

    // Fill next month's days to maintain grid
    const remainingSlots = 35 - daysContainer.children.length; 
    const finalSlots = remainingSlots < 0 ? 42 - daysContainer.children.length : remainingSlots;
    for (let i = 1; i <= finalSlots; i++) {
      daysContainer.appendChild(createDaySpan(i, false, '0.3'));
    }

    prevBtn.onclick = async (e) => {
      e.stopPropagation();
      currentViewDate.setMonth(currentViewDate.getMonth() - 1);
      await this.updateUI();
    };

    nextBtn.onclick = async (e) => {
      e.stopPropagation();
      currentViewDate.setMonth(currentViewDate.getMonth() + 1);
      await this.updateUI();
    };

    todayBtn.onclick = async (e) => {
      e.stopPropagation();
      await this.setSelectedDate(new Date(referenceTodayDate));
    };
  }
};
