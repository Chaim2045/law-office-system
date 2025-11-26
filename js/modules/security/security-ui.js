/**
 * Security UI Components Module
 * ==============================
 * רכיבי ממשק משתמש למודולי האבטחה
 *
 * @module SecurityUI
 * @version 1.0.0
 * @created 2025-11-25
 * @author Law Office System
 *
 * תכונות:
 * --------
 * - Modal אזהרת חוסר פעילות
 * - ספירה לאחור ויזואלית
 * - אנימציות מעבר חלקות
 * - תמיכה מלאה ב-RTL
 * - נגישות מלאה (ARIA)
 */

export class SecurityUI {
  constructor() {
    this.modals = new Map();
    this.activeModal = null;
  }

  // ==========================================
  // Idle Timeout Warning Modal
  // ==========================================

  /**
   * Create and show idle timeout warning modal
   * @param {Object} options - Modal options
   * @returns {Object} Modal control object
   */
  showIdleWarningModal(options = {}) {
    const {
      countdown = 60,
      onContinue = () => {},
      onLogout = () => {},
      onCountdownUpdate = () => {},
      title = 'שמנו לב שהפסקת פעילות',
      message = 'לביטחונך, תנותק מהמערכת בעוד',
      continueText = 'המשך לעבוד',
      logoutText = 'התנתק עכשיו'
    } = options;

    // Remove existing modal if any
    this.removeIdleWarningModal();

    // Create modal structure
    const modalHtml = `
      <div id="idleTimeoutModal" class="security-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="idleModalTitle">
        <div class="security-modal animate-in">
          <!-- Header -->
          <div class="security-modal-header">
            <div class="warning-icon-container">
              <svg class="warning-icon pulse" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 20h20L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
              </svg>
            </div>
          </div>

          <!-- Body -->
          <div class="security-modal-body">
            <h2 id="idleModalTitle" class="security-modal-title">${title}</h2>
            <p class="security-modal-message">${message}</p>

            <!-- Countdown Display -->
            <div class="countdown-container">
              <div class="countdown-number" id="countdownDisplay">${countdown}</div>
              <div class="countdown-text">שניות</div>
            </div>

            <!-- Progress Bar -->
            <div class="countdown-progress-wrapper">
              <div class="countdown-progress-bar" id="progressBar"></div>
            </div>

            <!-- Activity Indicator -->
            <div class="activity-indicator">
              <span class="activity-dot"></span>
              <span class="activity-text">המערכת ממתינה לתגובתך</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="security-modal-footer">
            <button
              id="continueBtn"
              class="security-btn security-btn-primary"
              aria-label="המשך לעבוד במערכת">
              <svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${continueText}
            </button>

            <button
              id="logoutBtn"
              class="security-btn security-btn-secondary"
              aria-label="התנתק מהמערכת">
              <svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${logoutText}
            </button>
          </div>
        </div>
      </div>
    `;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get elements
    const modal = document.getElementById('idleTimeoutModal');
    const continueBtn = document.getElementById('continueBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const countdownDisplay = document.getElementById('countdownDisplay');
    const progressBar = document.getElementById('progressBar');

    // Focus management
    continueBtn.focus();

    // Countdown logic
    let remainingTime = countdown;
    let countdownInterval;

    const updateCountdown = () => {
      remainingTime--;

      // Update display
      countdownDisplay.textContent = remainingTime;

      // Update progress bar
      const percentage = (remainingTime / countdown) * 100;
      progressBar.style.width = `${percentage}%`;

      // Add pulse effect on low time
      if (remainingTime <= 10) {
        countdownDisplay.classList.add('pulse-danger');
        modal.querySelector('.security-modal').classList.add('shake-warning');
      }

      // Callback
      onCountdownUpdate(remainingTime);

      // Auto logout when time's up
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        this.removeIdleWarningModal();
        onLogout();
      }
    };

    // Start countdown
    countdownInterval = setInterval(updateCountdown, 1000);

    // Event handlers
    continueBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.removeIdleWarningModal();
      onContinue();
    });

    logoutBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.removeIdleWarningModal();
      onLogout();
    });

    // Prevent closing on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.stopPropagation();
        // Add shake animation to indicate can't close
        modal.querySelector('.security-modal').classList.add('shake');
        setTimeout(() => {
          modal.querySelector('.security-modal').classList.remove('shake');
        }, 500);
      }
    });

    // Keyboard navigation
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Can't close with ESC - add visual feedback
        modal.querySelector('.security-modal').classList.add('shake');
        setTimeout(() => {
          modal.querySelector('.security-modal').classList.remove('shake');
        }, 500);
      }

      // Tab trap
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll('button');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });

    // Store reference
    this.activeModal = {
      type: 'idle-warning',
      element: modal,
      interval: countdownInterval
    };

    // Return control object
    return {
      updateCountdown: (time) => {
        remainingTime = time;
        countdownDisplay.textContent = time;
      },
      close: () => {
        clearInterval(countdownInterval);
        this.removeIdleWarningModal();
      }
    };
  }

  /**
   * Remove idle warning modal
   */
  removeIdleWarningModal() {
    const modal = document.getElementById('idleTimeoutModal');
    if (modal) {
      // Add fade out animation
      modal.classList.add('animate-out');
      setTimeout(() => {
        modal.remove();
      }, 300);
    }

    if (this.activeModal && this.activeModal.type === 'idle-warning') {
      if (this.activeModal.interval) {
        clearInterval(this.activeModal.interval);
      }
      this.activeModal = null;
    }
  }

  // ==========================================
  // Auto Logout Notification
  // ==========================================

  /**
   * Show auto logout notification
   * @param {Object} options - Notification options
   */
  showAutoLogoutNotification(options = {}) {
    const {
      message = 'נותקת מהמערכת עקב חוסר פעילות',
      subMessage = 'נא להתחבר מחדש כדי להמשיך',
      duration = 5000
    } = options;

    const notificationHtml = `
      <div id="autoLogoutNotification" class="security-notification animate-slide-in">
        <div class="notification-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="notification-content">
          <div class="notification-title">${message}</div>
          <div class="notification-subtitle">${subMessage}</div>
        </div>
        <button class="notification-close" aria-label="סגור התראה">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    // Remove existing notification
    const existing = document.getElementById('autoLogoutNotification');
    if (existing) existing.remove();

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', notificationHtml);

    const notification = document.getElementById('autoLogoutNotification');
    const closeBtn = notification.querySelector('.notification-close');

    // Close handler
    closeBtn.addEventListener('click', () => {
      notification.classList.add('animate-slide-out');
      setTimeout(() => notification.remove(), 300);
    });

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (document.getElementById('autoLogoutNotification')) {
          notification.classList.add('animate-slide-out');
          setTimeout(() => notification.remove(), 300);
        }
      }, duration);
    }
  }

  // ==========================================
  // Activity Resume Notification
  // ==========================================

  /**
   * Show activity resumed notification
   * @param {Object} options - Notification options
   */
  showActivityResumedNotification(options = {}) {
    const {
      message = 'זוהתה פעילות - הטיימר אופס',
      duration = 3000
    } = options;

    const notificationHtml = `
      <div id="activityNotification" class="security-notification security-notification-success animate-slide-in">
        <div class="notification-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="notification-content">
          <div class="notification-title">${message}</div>
        </div>
      </div>
    `;

    // Remove existing
    const existing = document.getElementById('activityNotification');
    if (existing) existing.remove();

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', notificationHtml);

    const notification = document.getElementById('activityNotification');

    // Auto remove
    setTimeout(() => {
      if (document.getElementById('activityNotification')) {
        notification.classList.add('animate-slide-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  // ==========================================
  // Session Conflict Modal
  // ==========================================

  /**
   * Show session conflict modal (for future single session feature)
   * @param {Object} options - Modal options
   */
  showSessionConflictModal(options = {}) {
    const {
      currentDevice = 'מחשב זה',
      otherDevice = 'מכשיר אחר',
      otherLocation = 'מיקום לא ידוע',
      otherTime = 'לפני מספר דקות',
      onForceLogin = () => {},
      onCancel = () => {}
    } = options;

    const modalHtml = `
      <div id="sessionConflictModal" class="security-modal-overlay" role="dialog">
        <div class="security-modal animate-in">
          <div class="security-modal-header">
            <svg class="warning-icon" width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
            </svg>
          </div>

          <div class="security-modal-body">
            <h2 class="security-modal-title">זוהה חיבור פעיל אחר</h2>
            <p class="security-modal-message">
              החשבון שלך כבר מחובר ממכשיר אחר:
            </p>

            <div class="device-info">
              <div class="device-info-item">
                <span class="device-info-label">מכשיר:</span>
                <span class="device-info-value">${otherDevice}</span>
              </div>
              <div class="device-info-item">
                <span class="device-info-label">מיקום:</span>
                <span class="device-info-value">${otherLocation}</span>
              </div>
              <div class="device-info-item">
                <span class="device-info-label">זמן חיבור:</span>
                <span class="device-info-value">${otherTime}</span>
              </div>
            </div>

            <p class="security-modal-submessage">
              האם ברצונך לנתק את החיבור הקודם ולהתחבר כאן?
            </p>
          </div>

          <div class="security-modal-footer">
            <button class="security-btn security-btn-primary" id="forceLoginBtn">
              נתק חיבור קודם והתחבר כאן
            </button>
            <button class="security-btn security-btn-secondary" id="cancelLoginBtn">
              ביטול
            </button>
          </div>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get elements and add handlers
    const modal = document.getElementById('sessionConflictModal');
    const forceBtn = document.getElementById('forceLoginBtn');
    const cancelBtn = document.getElementById('cancelLoginBtn');

    forceBtn.addEventListener('click', () => {
      modal.remove();
      onForceLogin();
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
      onCancel();
    });

    forceBtn.focus();
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Remove all security modals
   */
  removeAllModals() {
    // Remove idle warning
    this.removeIdleWarningModal();

    // Remove other modals
    const modals = document.querySelectorAll('.security-modal-overlay');
    modals.forEach(modal => modal.remove());

    // Remove notifications
    const notifications = document.querySelectorAll('.security-notification');
    notifications.forEach(notif => notif.remove());

    this.activeModal = null;
  }

  /**
   * Check if any security modal is active
   */
  hasActiveModal() {
    return this.activeModal !== null;
  }

  /**
   * Get active modal type
   */
  getActiveModalType() {
    return this.activeModal ? this.activeModal.type : null;
  }
}

// ==========================================
// Singleton Instance
// ==========================================
const securityUI = new SecurityUI();

// ==========================================
// Export
// ==========================================
export default securityUI;

// Named exports
export { securityUI };