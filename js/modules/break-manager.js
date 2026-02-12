/**
 * Break Manager — כפתור הפסקה
 * User App — GH Law Office System
 *
 * מנהל מצב הפסקה: כפתור בסרגל צד, overlay, timer, recording,
 * idle timeout pause, multi-tab sync, recovery.
 *
 * @version 1.0.0
 */

import { createTimesheetEntryV2 } from './timesheet-adapter.js';

const STORAGE_KEY = 'breakState';

class BreakManager {
  constructor() {
    this.active = false;
    this.startTime = null;
    this.timerInterval = null;
    this.user = null;
    this.db = null;

    // DOM references
    this.buttonElement = null;
    this.overlayElement = null;
    this.recoveryElement = null;
    this.timerElement = null;
    this.toastElement = null;

    // Multi-tab sync
    this.boundStorageHandler = this._onStorageChange.bind(this);
  }

  // ============================
  // PUBLIC API
  // ============================

  /**
   * init — called from main.js after login
   * @param {Object} user - { email, username }
   * @param {Object} db - Firebase Firestore instance
   */
  async init(user, db) {
    this.user = user;
    this.db = db;
    this._createDOM();
    this._attachEvents();
    this._syncTabs();

    // Recovery check — open break from previous session
    const savedState = this._loadState();
    if (savedState && savedState.active) {
      this._showRecoveryDialog(savedState);
    }
  }

  startBreak() {
    if (this.active) {
return;
}

    this.active = true;
    this.startTime = Date.now();
    this._saveState();
    this._pauseIdleTimeout();
    this._showOverlay();
    this._startTimer();
    this._updateButtonState();
  }

  endBreak() {
    if (!this.active) {
return;
}

    const minutes = Math.max(1, Math.round((Date.now() - this.startTime) / 60000));
    this._stopTimer();
    this._hideOverlay();
    this._resumeIdleTimeout();
    this._recordTimesheet(minutes);
    this._clearState();
    this.active = false;
    this.startTime = null;
    this._updateButtonState();
  }

  endBreakWithCustomTime(endTimestamp) {
    if (!this.startTime) {
return;
}

    const minutes = Math.max(1, Math.round((endTimestamp - this.startTime) / 60000));
    this._stopTimer();
    this._hideOverlay();
    this._hideRecoveryDialog();
    this._resumeIdleTimeout();
    this._recordTimesheet(minutes);
    this._clearState();
    this.active = false;
    this.startTime = null;
    this._updateButtonState();
  }

  cleanup() {
    this._stopTimer();
    window.removeEventListener('storage', this.boundStorageHandler);
  }

  getStatus() {
    return {
      active: this.active,
      startTime: this.startTime,
      elapsedMinutes: this.active
        ? Math.round((Date.now() - this.startTime) / 60000)
        : 0
    };
  }

  // ============================
  // DOM CREATION
  // ============================

  _createDOM() {
    // --- Sidebar button (exists in HTML) ---
    this.buttonElement = document.getElementById('sidebarBreakBtn');

    // --- Overlay ---
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'break-overlay';
    this.overlayElement.innerHTML = `
      <div class="break-overlay-content">
        <div class="break-icon">
          <div class="break-steam">
            <div class="break-steam-line"></div>
            <div class="break-steam-line"></div>
            <div class="break-steam-line"></div>
          </div>
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
          </svg>
        </div>
        <h2 class="break-title">בהפסקה</h2>
        <div class="break-timer">00<span class="break-timer-colon">:</span>00<span class="break-timer-colon">:</span>00</div>
        <button class="break-return-btn">חזרתי מהפסקה</button>
      </div>
    `;
    this.timerElement = this.overlayElement.querySelector('.break-timer');

    // --- Recovery Dialog ---
    this.recoveryElement = document.createElement('div');
    this.recoveryElement.className = 'break-recovery';
    this.recoveryElement.innerHTML = `
      <div class="break-recovery-card">
        <h3 class="break-recovery-title">הפסקה פתוחה</h3>
        <p class="break-recovery-subtitle"></p>
        <p class="break-recovery-question">מתי חזרת?</p>
        <div class="break-recovery-options">
          <label class="break-recovery-option" data-minutes="15">
            <input type="radio" name="breakRecovery" value="15">
            <span class="break-recovery-radio"></span>
            <span>לפני 15 דקות</span>
          </label>
          <label class="break-recovery-option" data-minutes="30">
            <input type="radio" name="breakRecovery" value="30">
            <span class="break-recovery-radio"></span>
            <span>לפני 30 דקות</span>
          </label>
          <label class="break-recovery-option" data-minutes="60">
            <input type="radio" name="breakRecovery" value="60">
            <span class="break-recovery-radio"></span>
            <span>לפני שעה</span>
          </label>
          <label class="break-recovery-option" data-minutes="custom">
            <input type="radio" name="breakRecovery" value="custom">
            <span class="break-recovery-radio"></span>
            <span>בחירה ידנית</span>
          </label>
        </div>
        <div class="break-recovery-custom">
          <input type="time" class="break-recovery-time-input">
        </div>
        <button class="break-recovery-submit" disabled>סגור הפסקה</button>
      </div>
    `;

    // --- Toast ---
    this.toastElement = document.createElement('div');
    this.toastElement.className = 'break-toast';
    this.toastElement.style.display = 'none';

    // Append to body
    document.body.appendChild(this.overlayElement);
    document.body.appendChild(this.recoveryElement);
    document.body.appendChild(this.toastElement);
  }

  // ============================
  // EVENTS
  // ============================

  _attachEvents() {
    // Sidebar break button click
    this.buttonElement.addEventListener('click', () => {
      if (this.active) {
        this.endBreak();
      } else {
        this.startBreak();
      }
    });

    // Return button
    this.overlayElement.querySelector('.break-return-btn').addEventListener('click', () => {
      this.endBreak();
    });

    // Recovery radio options
    const options = this.recoveryElement.querySelectorAll('.break-recovery-option');
    const submitBtn = this.recoveryElement.querySelector('.break-recovery-submit');
    const customDiv = this.recoveryElement.querySelector('.break-recovery-custom');

    options.forEach(option => {
      option.addEventListener('click', () => {
        // Remove selected from all
        options.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        option.querySelector('input').checked = true;

        const val = option.dataset.minutes;
        if (val === 'custom') {
          customDiv.classList.add('visible');
        } else {
          customDiv.classList.remove('visible');
        }

        submitBtn.disabled = false;
      });
    });

    // Recovery submit
    submitBtn.addEventListener('click', () => {
      const selected = this.recoveryElement.querySelector('input[name="breakRecovery"]:checked');
      if (!selected) {
return;
}

      let endTimestamp;

      if (selected.value === 'custom') {
        const timeInput = this.recoveryElement.querySelector('.break-recovery-time-input');
        if (!timeInput.value) {
return;
}

        const [hours, mins] = timeInput.value.split(':').map(Number);
        const now = new Date();
        endTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins).getTime();

        // If time is in the future, assume yesterday
        if (endTimestamp > Date.now()) {
          endTimestamp -= 24 * 60 * 60 * 1000;
        }
      } else {
        endTimestamp = Date.now() - (parseInt(selected.value) * 60 * 1000);
      }

      // Validate: endTimestamp must be after startTime
      if (endTimestamp <= this.startTime) {
        endTimestamp = this.startTime + 60000; // minimum 1 minute
      }

      this.endBreakWithCustomTime(endTimestamp);
    });
  }

  // ============================
  // OVERLAY & UI
  // ============================

  _showOverlay() {
    this.overlayElement.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlayElement.classList.add('visible');
    });
  }

  _hideOverlay() {
    this.overlayElement.classList.remove('visible');
    const handler = () => {
      if (!this.overlayElement.classList.contains('visible')) {
        this.overlayElement.style.display = '';
      }
      this.overlayElement.removeEventListener('transitionend', handler);
    };
    this.overlayElement.addEventListener('transitionend', handler);
  }

  _updateButtonState() {
    if (this.active) {
      this.buttonElement.classList.add('active');
    } else {
      this.buttonElement.classList.remove('active');
    }
  }

  // ============================
  // TIMER
  // ============================

  _startTimer() {
    this._updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this._updateTimerDisplay();
    }, 1000);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  _updateTimerDisplay() {
    if (!this.startTime || !this.timerElement) {
return;
}
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');

    this.timerElement.innerHTML =
      `${h}<span class="break-timer-colon">:</span>${m}<span class="break-timer-colon">:</span>${s}`;
  }

  // ============================
  // IDLE TIMEOUT
  // ============================

  _pauseIdleTimeout() {
    try {
      if (window.manager && window.manager.idleTimeout) {
        window.manager.idleTimeout.stop();
      }
    } catch (e) {
      console.warn('BreakManager: Could not pause idle timeout', e);
    }
  }

  _resumeIdleTimeout() {
    try {
      if (window.manager && window.manager.idleTimeout) {
        window.manager.idleTimeout.start();
      }
    } catch (e) {
      console.warn('BreakManager: Could not resume idle timeout', e);
    }
  }

  // ============================
  // PERSISTENCE (localStorage)
  // ============================

  _saveState() {
    const state = {
      active: true,
      startTime: this.startTime,
      employee: this.user.email,
      employeeName: this.user.username || ''
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
return null;
}
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  _clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ============================
  // MULTI-TAB SYNC
  // ============================

  _syncTabs() {
    window.addEventListener('storage', this.boundStorageHandler);
  }

  _onStorageChange(e) {
    if (e.key !== STORAGE_KEY) {
return;
}

    if (e.newValue) {
      // Another tab started break
      const state = JSON.parse(e.newValue);
      this.active = true;
      this.startTime = state.startTime;
      this._pauseIdleTimeout();
      this._showOverlay();
      this._startTimer();
      this._updateButtonState();
    } else {
      // Another tab ended break
      this._stopTimer();
      this._hideOverlay();
      this._hideRecoveryDialog();
      this._resumeIdleTimeout();
      this.active = false;
      this.startTime = null;
      this._updateButtonState();
    }
  }

  // ============================
  // RECOVERY DIALOG
  // ============================

  _showRecoveryDialog(savedState) {
    this.active = true;
    this.startTime = savedState.startTime;
    this._pauseIdleTimeout();

    // Calculate elapsed time
    const startDate = new Date(savedState.startTime);
    const elapsed = Date.now() - savedState.startTime;
    const elapsedHours = Math.floor(elapsed / 3600000);
    const elapsedMinutes = Math.floor((elapsed % 3600000) / 60000);

    // Format start time
    const startTimeStr = startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    // Build subtitle
    let elapsedStr;
    if (elapsedHours > 0) {
      elapsedStr = `לפני ${elapsedHours} שעות ו-${elapsedMinutes} דקות`;
    } else {
      elapsedStr = `לפני ${elapsedMinutes} דקות`;
    }

    const subtitle = this.recoveryElement.querySelector('.break-recovery-subtitle');
    subtitle.textContent = `התחילה ב-${startTimeStr} (${elapsedStr})`;

    // Reset state
    this.recoveryElement.querySelectorAll('.break-recovery-option').forEach(o => o.classList.remove('selected'));
    this.recoveryElement.querySelector('.break-recovery-custom').classList.remove('visible');
    this.recoveryElement.querySelector('.break-recovery-submit').disabled = true;
    const timeInput = this.recoveryElement.querySelector('.break-recovery-time-input');
    if (timeInput) {
timeInput.value = '';
}

    // Show
    this.recoveryElement.style.display = 'flex';
    requestAnimationFrame(() => {
      this.recoveryElement.classList.add('visible');
    });

    this._updateButtonState();
  }

  _hideRecoveryDialog() {
    this.recoveryElement.classList.remove('visible');
    const handler = () => {
      if (!this.recoveryElement.classList.contains('visible')) {
        this.recoveryElement.style.display = '';
      }
      this.recoveryElement.removeEventListener('transitionend', handler);
    };
    this.recoveryElement.addEventListener('transitionend', handler);
  }

  // ============================
  // TIMESHEET RECORDING
  // ============================

  async _recordTimesheet(minutes) {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      await createTimesheetEntryV2({
        isInternal: true,
        date: dateStr,
        minutes: minutes,
        action: 'הפסקה',
        employee: this.user.email
      });

      this._showSuccessToast(minutes);
    } catch (error) {
      console.error('BreakManager: Failed to record timesheet', error);
      this._showErrorToast();
    }
  }

  // ============================
  // TOASTS
  // ============================

  _showSuccessToast(minutes) {
    this.toastElement.textContent = `✓ הפסקה נרשמה — ${minutes} דקות`;
    this.toastElement.className = 'break-toast';
    this.toastElement.style.display = '';
    // Remove after animation
    setTimeout(() => {
      this.toastElement.style.display = 'none';
    }, 3000);
  }

  _showErrorToast() {
    this.toastElement.textContent = '✗ שגיאה ברישום ההפסקה';
    this.toastElement.className = 'break-toast error';
    this.toastElement.style.display = '';
    setTimeout(() => {
      this.toastElement.style.display = 'none';
    }, 5000);
  }
}

export default BreakManager;
