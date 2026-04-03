/**
 * calendar.js
 * Manages the interactive calendar component.
 */

import { renderTemplate } from './utils.js';

let currentCalendarDate = new Date(2026, 3, 4); // Reference: April 4, 2026

export const CalendarManager = {
  render(container) {
    if (!container) return;
    this.container = container;
    this.updateUI();
  },

  updateUI() {
    this.container.innerHTML = renderTemplate('calendar');

    const titleEl = document.getElementById('calendarTitle');
    const daysContainer = document.getElementById('calendarDays');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    titleEl.textContent = `${monthNames[month]} ${year}`;

    daysContainer.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

    // Fill previous month's days
    for (let i = firstDayOfMonth; i > 0; i--) {
      const span = document.createElement('span');
      span.className = 'day-prev';
      span.textContent = lastDateOfPrevMonth - i + 1;
      daysContainer.appendChild(span);
    }

    // Fill current month's days
    for (let i = 1; i <= lastDateOfMonth; i++) {
      const span = document.createElement('span');
      span.textContent = i;
      
      // Mark specific date: April 4, 2026
      if (year === 2026 && month === 3 && i === 4) {
        span.className = 'day-today';
      }
      daysContainer.appendChild(span);
    }

    // Fill next month's days to maintain a 6-row grid
    const totalSlots = 42; 
    const currentSlots = daysContainer.children.length;
    for (let i = 1; i <= (totalSlots - currentSlots); i++) {
      const span = document.createElement('span');
      span.className = 'day-next';
      span.textContent = i;
      daysContainer.appendChild(span);
    }

    // Event Handlers
    prevBtn.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      this.updateUI();
    };

    nextBtn.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      this.updateUI();
    };

    todayBtn.onclick = () => {
      currentCalendarDate = new Date(2026, 3, 4);
      this.updateUI();
    };
  }
};
