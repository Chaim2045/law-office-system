/**
 * Daily Meter Component
 * GH Law Office System
 *
 * Shows a circular ring in the sidebar footer indicating
 * how many hours the user has reported today vs. their daily target.
 * Click to see per-client breakdown.
 *
 * Dependencies:
 *   - window.manager.timesheetEntries
 *   - window.manager.currentEmployee.dailyHoursTarget
 *   - window.manager.showNotification (for overage alert)
 */

const RADIUS = 21;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DEFAULT_DAILY_TARGET = 8.45;

export class DailyMeter {
  constructor() {
    this._el = null;
    this._ringEl = null;
    this._circleEl = null;
    this._pctEl = null;
    this._hoursEl = null;
    this._popupEl = null;
    this._cssElement = null;

    this._dailyTarget = DEFAULT_DAILY_TARGET;
    this._todayEntries = [];
    this._isPopupOpen = false;
    this._overageAlertedToday = false;

    // Store date string for "today" — recalculated on update
    this._todayStr = this._getTodayStr();

    // Bound handler for outside clicks
    this._onOutsideClick = this._handleOutsideClick.bind(this);
  }

  // ════════════════════════════════════
  // Lifecycle
  // ════════════════════════════════════

  /**
   * Initialize the meter.
   * Call after sidebar is rendered and data is loaded.
   * @param {HTMLElement} container - the .gh-sidebar-footer element
   */
  init(container) {
    if (!container) {
return;
}

    // Prevent duplicate — if already in DOM, just update data
    if (this._el && this._el.isConnected) {
      this.update(window.manager?.timesheetEntries || []);
      return;
    }

    // Clean up stale reference if element was removed from DOM
    if (this._el && !this._el.isConnected) {
      this._el = null;
    }

    this._injectCSS();
    this._render(container);
    this._bindEvents();

    // Read target from employee data
    this._dailyTarget =
      window.manager?.currentEmployee?.dailyHoursTarget || DEFAULT_DAILY_TARGET;

    // Initial update
    this.update(window.manager?.timesheetEntries || []);
  }

  destroy() {
    this._closePopup();
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    this._removeCSS();
  }

  // ════════════════════════════════════
  // Public API
  // ════════════════════════════════════

  /**
   * Update the meter with current entries.
   * Called whenever timesheetEntries change (real-time listener).
   * @param {Array} allEntries - all timesheet entries for current user
   */
  update(allEntries) {
    this._todayStr = this._getTodayStr();
    this._todayEntries = this._filterToday(allEntries);

    const totalMinutes = this._todayEntries.reduce(
      (sum, e) => sum + (e.minutes || 0), 0
    );
    const totalHours = totalMinutes / 60;
    const pct = this._dailyTarget > 0
      ? (totalHours / this._dailyTarget) * 100
      : 0;

    this._updateRing(pct, totalHours);
    this._checkOverage(totalHours);

    // If popup is open, refresh its content
    if (this._isPopupOpen) {
      this._renderPopupContent();
    }
  }

  // ════════════════════════════════════
  // Rendering
  // ════════════════════════════════════

  _render(container) {
    this._el = document.createElement('div');
    this._el.className = 'gh-daily-meter';
    this._el.innerHTML = `
      <div class="gh-daily-meter-ring" title="מד דיווח יומי — לחץ לפירוט">
        ${this._isNewFeature() ? '<span class="gh-daily-meter-badge-new"></span>' : ''}
        <svg width="52" height="52" viewBox="0 0 46 46">
          <circle class="gh-daily-meter-track" cx="23" cy="23" r="${RADIUS}" />
          <circle class="gh-daily-meter-fill state-blue" cx="23" cy="23" r="${RADIUS}"
            stroke-dasharray="${CIRCUMFERENCE}"
            stroke-dashoffset="${CIRCUMFERENCE}" />
        </svg>
        <div class="gh-daily-meter-center">
          <div class="gh-daily-meter-pct">0%</div>
          <div class="gh-daily-meter-hours">0:00</div>
        </div>
        <div class="gh-daily-meter-popup"></div>
      </div>
      <span class="gh-daily-meter-label">דיווח יומי</span>
    `;

    // Insert as first child of footer (above break button)
    container.insertBefore(this._el, container.firstChild);

    // Cache DOM references
    this._ringEl = this._el.querySelector('.gh-daily-meter-ring');
    this._circleEl = this._el.querySelector('.gh-daily-meter-fill');
    this._pctEl = this._el.querySelector('.gh-daily-meter-pct');
    this._hoursEl = this._el.querySelector('.gh-daily-meter-hours');
    this._popupEl = this._el.querySelector('.gh-daily-meter-popup');
  }

  _bindEvents() {
    if (!this._ringEl) {
return;
}

    this._ringEl.addEventListener('click', (e) => {
      e.stopPropagation();

      // Dismiss "new" badge on first click
      this._dismissNewBadge();

      if (this._isPopupOpen) {
        this._closePopup();
      } else {
        this._openPopup();
      }
    });
  }

  // ════════════════════════════════════
  // Ring Update
  // ════════════════════════════════════

  _updateRing(pct, totalHours) {
    if (!this._circleEl) {
return;
}

    const cappedPct = Math.min(pct, 100);
    const offset = CIRCUMFERENCE - (cappedPct / 100) * CIRCUMFERENCE;
    const state = this._getState(pct);

    // Ring fill (SVG elements require setAttribute for class)
    this._circleEl.style.strokeDashoffset = offset;
    this._circleEl.setAttribute('class', `gh-daily-meter-fill state-${state}`);

    // Center text — always white
    this._pctEl.textContent = Math.round(pct) + '%';
    this._hoursEl.textContent = this._fmt(totalHours);

    // Glow & pulse
    this._ringEl.className = 'gh-daily-meter-ring';
    if (totalHours > 0) {
      this._ringEl.classList.add(`glow-${state}`);
      if (state === 'green') {
this._ringEl.classList.add('pulse-green');
}
      if (state === 'red') {
this._ringEl.classList.add('pulse-red');
}
    }
  }

  _getState(pct) {
    if (pct > 100) {
return 'red';
}
    if (pct >= 95) {
return 'green';
}
    if (pct >= 70) {
return 'orange';
}
    return 'blue';
  }

  // ════════════════════════════════════
  // Popup
  // ════════════════════════════════════

  _openPopup() {
    this._isPopupOpen = true;
    this._renderPopupContent();
    this._popupEl.classList.add('open');

    // Listen for outside clicks to close
    setTimeout(() => {
      document.addEventListener('click', this._onOutsideClick);
    }, 0);
  }

  _closePopup() {
    this._isPopupOpen = false;
    if (this._popupEl) {
      this._popupEl.classList.remove('open');
    }
    document.removeEventListener('click', this._onOutsideClick);
  }

  _handleOutsideClick(e) {
    if (this._el && !this._el.contains(e.target)) {
      this._closePopup();
    }
  }

  _renderPopupContent() {
    if (!this._popupEl) {
return;
}

    const grouped = this._groupByClient(this._todayEntries);
    const totalMinutes = this._todayEntries.reduce(
      (sum, e) => sum + (e.minutes || 0), 0
    );
    const totalHours = totalMinutes / 60;
    const remaining = Math.max(this._dailyTarget - totalHours, 0);
    const isOver = totalHours > this._dailyTarget;

    // Build client rows
    let listHtml = '';
    if (grouped.length === 0) {
      listHtml = '<div class="gh-daily-meter-popup-empty">אין דיווחים להיום</div>';
    } else {
      listHtml = '<div class="gh-daily-meter-popup-list">';
      for (const item of grouped) {
        const isInternal = item.isInternal;
        const dotColor = isInternal ? '#f59e0b' : '#3b82f6';
        const rowClass = isInternal ? ' internal' : '';
        listHtml += `
          <div class="gh-daily-meter-popup-row${rowClass}">
            <span class="gh-daily-meter-popup-row-name">
              <span class="dot" style="background:${dotColor}"></span>
              ${this._escapeHtml(item.name)}
            </span>
            <span class="gh-daily-meter-popup-row-hours">${this._fmt(item.hours)}</span>
          </div>
        `;
      }
      listHtml += '</div>';
    }

    // Status line
    let statusHtml = '';
    let statusClass = '';
    if (isOver) {
      const overBy = totalHours - this._dailyTarget;
      statusHtml = `<i class="fas fa-exclamation-triangle" style="margin-left:4px"></i> חריגה של ${this._fmt(overBy)}`;
      statusClass = 'status-over';
    } else if (remaining <= 1 && remaining > 0) {
      statusHtml = `<i class="fas fa-flag-checkered" style="margin-left:4px"></i> נותרו ${this._fmt(remaining)} — כמעט שם!`;
      statusClass = 'status-almost';
    } else if (remaining === 0) {
      statusHtml = '<i class="fas fa-check-circle" style="margin-left:4px"></i> הגעת לתקן היומי!';
      statusClass = 'status-done';
    } else {
      statusHtml = `<i class="fas fa-clock" style="margin-left:4px"></i> נותרו ${this._fmt(remaining)} שעות`;
      statusClass = 'status-normal';
    }

    this._popupEl.innerHTML = `
      <div class="gh-daily-meter-popup-header">
        <span class="gh-daily-meter-popup-title">
          <i class="fas fa-chart-pie"></i>
          דיווח יומי
        </span>
        <button class="gh-daily-meter-popup-close" title="סגור">
          <i class="fas fa-times"></i>
        </button>
      </div>
      ${listHtml}
      <div class="gh-daily-meter-popup-divider"></div>
      <div class="gh-daily-meter-popup-total">
        <span>סה"כ</span>
        <span>${this._fmt(totalHours)} / ${this._fmt(this._dailyTarget)}</span>
      </div>
      <div class="gh-daily-meter-popup-status ${statusClass}">
        ${statusHtml}
      </div>
    `;

    // Close button handler
    const closeBtn = this._popupEl.querySelector('.gh-daily-meter-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closePopup();
      });
    }
  }

  // ════════════════════════════════════
  // Data Processing
  // ════════════════════════════════════

  _filterToday(entries) {
    if (!entries || !entries.length) {
return [];
}
    const todayStr = this._todayStr;

    return entries.filter(e => {
      if (!e.date) {
return false;
}
      // entries store date as YYYY-MM-DD string
      const entryDate = typeof e.date === 'string'
        ? e.date.slice(0, 10)
        : new Date(e.date).toISOString().slice(0, 10);
      return entryDate === todayStr;
    });
  }

  _groupByClient(entries) {
    const map = new Map();

    for (const entry of entries) {
      const isInternal = !!entry.isInternal;
      const key = isInternal ? '__internal__' : (entry.clientName || entry.caseNumber || 'לא ידוע');
      const name = isInternal ? 'זמן פנימי' : key;

      if (!map.has(key)) {
        map.set(key, { name, isInternal, minutes: 0 });
      }
      map.get(key).minutes += (entry.minutes || 0);
    }

    // Convert to array with hours, sort: clients first, then internal
    const result = [];
    for (const item of map.values()) {
      result.push({
        name: item.name,
        isInternal: item.isInternal,
        hours: item.minutes / 60
      });
    }

    result.sort((a, b) => {
      if (a.isInternal !== b.isInternal) {
return a.isInternal ? 1 : -1;
}
      return b.hours - a.hours;
    });

    return result;
  }

  // ════════════════════════════════════
  // Overage Check
  // ════════════════════════════════════

  _checkOverage(totalHours) {
    if (totalHours > this._dailyTarget && !this._overageAlertedToday) {
      this._overageAlertedToday = true;
      const msg = `עברת את התקן היומי! דווחו ${this._fmt(totalHours)} מתוך ${this._fmt(this._dailyTarget)} שעות`;
      if (window.manager?.showNotification) {
        window.manager.showNotification(msg, 'warning');
      }
    }
  }

  // ════════════════════════════════════
  // Helpers
  // ════════════════════════════════════

  _fmt(h) {
    const hrs = Math.floor(Math.abs(h));
    const mins = Math.round((Math.abs(h) - hrs) * 60);
    return `${hrs}:${String(mins).padStart(2, '0')}`;
  }

  _getTodayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // "New" badge — shows for 14 days after launch, dismissed on first click
  _isNewFeature() {
    const LAUNCH_DATE = '2026-04-12';
    const SHOW_DAYS = 14;
    const dismissed = localStorage.getItem('gh-daily-meter-seen');
    if (dismissed) {
return false;
}
    const daysSinceLaunch = (Date.now() - new Date(LAUNCH_DATE).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLaunch <= SHOW_DAYS;
  }

  _dismissNewBadge() {
    const badge = this._el?.querySelector('.gh-daily-meter-badge-new');
    if (badge) {
      badge.remove();
      localStorage.setItem('gh-daily-meter-seen', '1');
    }
  }

  // ════════════════════════════════════
  // CSS Injection (same pattern as sidebar)
  // ════════════════════════════════════

  _injectCSS() {
    if (document.getElementById('gh-daily-meter-css')) {
return;
}

    const link = document.createElement('link');
    link.id = 'gh-daily-meter-css';
    link.rel = 'stylesheet';
    link.href = 'js/modules/components/sidebar/daily-meter.css';
    document.head.appendChild(link);
    this._cssElement = link;
  }

  _removeCSS() {
    if (this._cssElement) {
      this._cssElement.remove();
      this._cssElement = null;
    }
  }
}
