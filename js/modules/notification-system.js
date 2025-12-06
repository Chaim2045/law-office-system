/**
 * ========================================
 * Notification System Module
 * ========================================
 * מערכת הודעות מודרנית ומודולרית למשרד עורכי דין
 *
 * תכונות:
 * ✅ 4 סוגי הודעות: Success, Error, Warning, Info
 * ✅ אנימציות חלקות (slide + fade)
 * ✅ תמיכה בסמלים (icons)
 * ✅ תמיכה ב-RTL (עברית)
 * ✅ סגירה אוטומטית עם אפשרות להגדיר זמן
 * ✅ סגירה ידנית עם כפתור X
 * ✅ Stack של הודעות (עד 3 בו-זמנית)
 * ✅ Loading overlay עם spinner
 * ✅ דיאלוג אישור (Confirm)
 * ✅ Accessibility תמיכה מלאה
 *
 * @version 1.0.0
 * @date 2025-01-17
 */

/**
 * ========================================
 * Constants & Configuration
 * ========================================
 */

const NotificationTypes = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const NotificationIcons = {
  success: 'fas fa-check-circle',
  error: 'fas fa-exclamation-circle',
  warning: 'fas fa-exclamation-triangle',
  info: 'fas fa-info-circle'
};

const NotificationColors = {
  success: '#10b981', // green-500
  error: '#ef4444',   // red-500
  warning: '#f59e0b', // amber-500
  info: '#3b82f6'     // blue-500
};

const DEFAULT_DURATION = 3000; // 3 seconds
const MAX_NOTIFICATIONS = 3;   // Maximum notifications on screen

/**
 * ========================================
 * NotificationSystem Class
 * ========================================
 */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.loadingOverlay = null;
    this.currentAnimationType = null; // Track current loading animation type
    this.notifications = []; // Track active notifications
    this.init();
  }

  /**
   * Initialize the notification system
   * Creates the container element
   */
  init() {
    // ✅ תיקון: וודא ש-DOM נטען לפני יצירת הקונטיינר
    const createContainer = () => {
      if (!this.container && document.body) {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'התראות מערכת');
        document.body.appendChild(this.container);
      }
    };

    // אם ה-DOM כבר נטען - צור מיד, אחרת חכה
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createContainer);
    } else {
      createContainer();
    }
  }

  /**
   * Show a notification
   * @param {string} message - The message to display
   * @param {string} type - Type of notification (success, error, warning, info)
   * @param {number} duration - Duration in ms (0 = no auto-close)
   * @returns {HTMLElement} The notification element
   */
  show(message, type = NotificationTypes.INFO, duration = DEFAULT_DURATION) {
    // Validate type
    if (!Object.values(NotificationTypes).includes(type)) {
      console.warn(`Invalid notification type: ${type}, using INFO instead`);
      type = NotificationTypes.INFO;
    }

    // Limit number of notifications
    if (this.notifications.length >= MAX_NOTIFICATIONS) {
      this.removeOldestNotification();
    }

    // Create notification element
    const notification = this.createNotificationElement(message, type);

    // Add to container
    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Auto-close if duration is set
    if (duration > 0) {
      setTimeout(() => {
        this.close(notification);
      }, duration);
    }

    return notification;
  }

  /**
   * Create notification element with all components
   * @private
   */
  createNotificationElement(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', type === NotificationTypes.ERROR ? 'assertive' : 'polite');

    const icon = NotificationIcons[type];
    const color = NotificationColors[type];

    notification.innerHTML = `
      <div class="notification-icon" style="color: ${color}">
        <i class="${icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="notification-close" aria-label="סגור התראה" type="button">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add close button handler
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.close(notification));

    return notification;
  }

  /**
   * Close a specific notification
   * @param {HTMLElement} notification - The notification element to close
   */
  close(notification) {
    if (!notification || !notification.parentElement) {
return;
}

    // Remove from array
    const index = this.notifications.indexOf(notification);
    if (index > -1) {
      this.notifications.splice(index, 1);
    }

    // Trigger exit animation
    notification.classList.remove('show');
    notification.classList.add('hide');

    // Remove from DOM after animation
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }

  /**
   * Remove the oldest notification when limit is reached
   * @private
   */
  removeOldestNotification() {
    if (this.notifications.length > 0) {
      this.close(this.notifications[0]);
    }
  }

  /**
   * Close all notifications
   */
  closeAll() {
    [...this.notifications].forEach(notification => {
      this.close(notification);
    });
  }

  /**
   * Shorthand methods for different types
   */
  success(message, duration = DEFAULT_DURATION) {
    return this.show(message, NotificationTypes.SUCCESS, duration);
  }

  error(message, duration = DEFAULT_DURATION) {
    return this.show(message, NotificationTypes.ERROR, duration);
  }

  warning(message, duration = DEFAULT_DURATION) {
    return this.show(message, NotificationTypes.WARNING, duration);
  }

  info(message, duration = DEFAULT_DURATION) {
    return this.show(message, NotificationTypes.INFO, duration);
  }

  /**
   * ========================================
   * Loading Overlay Methods
   * ========================================
   */

  /**
   * Show loading overlay with Lottie animation
   * @param {string} message - Loading message
   * @param {Object} options - Loading options
   * @param {string} options.animationType - Type of Lottie animation (loading, saving, uploading, etc.)
   */
  showLoading(message = 'מעבד...', options = {}) {
    // Don't show during welcome screen
    if (window.isInWelcomeScreen) {
return;
}

    // Default to 'loading' animation if not specified (backward compatibility)
    const animationType = options.animationType || 'loading';
    this.currentAnimationType = animationType; // Store for cleanup

    // Remove existing loading if any
    this.hideLoading();

    // Create loading overlay
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'loading-overlay';
    this.loadingOverlay.setAttribute('role', 'alert');
    this.loadingOverlay.setAttribute('aria-live', 'assertive');
    this.loadingOverlay.setAttribute('aria-busy', 'true');

    this.loadingOverlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner" id="loading-spinner-container">
          <div id="lottie-loader"></div>
        </div>
        <div class="loading-message">${this.escapeHtml(message)}</div>
      </div>
    `;

    document.body.appendChild(this.loadingOverlay);
    document.body.style.overflow = 'hidden';

    // Trigger animation
    setTimeout(() => {
      this.loadingOverlay.classList.add('show');
    }, 10);

    // Load Lottie animation with specified type
    this.loadLottieAnimation(animationType);
  }

  /**
   * Load Lottie animation for loading spinner
   * @private
   * @param {string} animationType - Type of animation to load (loading, saving, uploading, etc.)
   */
  async loadLottieAnimation(animationType = 'loading') {
    const container = document.getElementById('lottie-loader');
    if (!container) {
return;
}

    // Check if LottieManager is available
    if (!window.LottieManager) {
      console.warn('⚠️ LottieManager not available, using CSS fallback');
      // Add fallback class to the actual spinner element
      container.classList.add('fallback');
      return;
    }

    try {
      // Use LottieManager to load animation
      // LottieManager handles all fallback and error handling automatically
      const animation = await window.LottieManager.load(
        animationType,
        container,
        {
          loop: true,
          autoplay: true,
          renderer: 'svg',
          speed: 1
        }
      );

      if (animation) {
        Logger.log(`✅ Lottie animation loaded: ${animationType}`);
      } else {
        // LottieManager already handled fallback
        Logger.log(`⚠️ LottieManager used fallback for: ${animationType}`);
      }

    } catch (error) {
      console.error(`❌ Error loading Lottie animation (${animationType}):`, error);
      // LottieManager already showed fallback, but add class for extra safety
      container.classList.add('fallback');
    }
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    if (this.loadingOverlay && this.loadingOverlay.parentElement) {
      // ✅ Destroy specific Lottie animation to free memory (granular cleanup)
      const lottieContainer = this.loadingOverlay.querySelector('#lottie-loader');
      if (lottieContainer && window.LottieManager && this.currentAnimationType) {
        // Destroy only this specific animation (industry standard approach)
        window.LottieManager.destroy(this.currentAnimationType, lottieContainer);
        this.currentAnimationType = null; // Reset after cleanup
      }

      this.loadingOverlay.classList.remove('show');

      setTimeout(() => {
        if (this.loadingOverlay && this.loadingOverlay.parentElement) {
          this.loadingOverlay.remove();
          this.loadingOverlay = null;
        }
        document.body.style.overflow = '';
      }, 300);
    }
  }

  /**
   * Show loading with custom animation type
   * Convenience wrapper for showLoading with animationType
   * @param {string} message - Loading message
   * @param {string} animationType - Type of Lottie animation
   */
  showLoadingWithAnimation(message, animationType) {
    this.showLoading(message, { animationType });
  }

  /**
   * ========================================
   * Confirm Dialog Methods
   * ========================================
   */

  /**
   * Show confirmation dialog
   * @param {string} message - Message to display
   * @param {Function} onConfirm - Callback when user confirms
   * @param {Function} onCancel - Callback when user cancels (optional)
   * @param {Object} options - Additional options
   */
  confirm(message, onConfirm, onCancel = null, options = {}) {
    const {
      title = 'אישור פעולה',
      confirmText = 'אישור',
      cancelText = 'ביטול',
      type = 'warning'
    } = options;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); animation: fadeIn 0.2s ease;';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-title');

    const icon = NotificationIcons[type];
    const color = NotificationColors[type];

    overlay.innerHTML = `
      <div class="confirm-dialog" style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease; direction: rtl; text-align: right;">
        <div class="confirm-header" style="text-align: center; margin-bottom: 24px;">
          <div class="confirm-icon" style="color: ${color}; font-size: 48px; margin-bottom: 16px;">
            <i class="${icon}"></i>
          </div>
          <h3 id="confirm-title" class="confirm-title" style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0;">${this.escapeHtml(title)}</h3>
        </div>

        <div class="confirm-body" style="margin-bottom: 32px; text-align: center;">
          <p class="confirm-message" style="font-size: 16px; color: #6b7280; line-height: 1.5; margin: 0;">${this.escapeHtml(message)}</p>
        </div>

        <div class="confirm-footer" style="display: flex; gap: 12px; justify-content: center;">
          <button class="confirm-btn confirm-btn-cancel" type="button" style="padding: 12px 24px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #6b7280; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-times"></i>
            ${this.escapeHtml(cancelText)}
          </button>
          <button class="confirm-btn confirm-btn-confirm" type="button" style="padding: 12px 24px; border: none; border-radius: 8px; background: #ef4444; color: white; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-check"></i>
            ${this.escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Focus on confirm button
    setTimeout(() => {
      overlay.querySelector('.confirm-btn-confirm').focus();
    }, 100);

    // Handle confirm
    const confirmBtn = overlay.querySelector('.confirm-btn-confirm');
    confirmBtn.addEventListener('click', () => {
      this.closeConfirm(overlay);
      if (onConfirm) {
onConfirm();
}
    });

    // Handle cancel
    const cancelBtn = overlay.querySelector('.confirm-btn-cancel');
    cancelBtn.addEventListener('click', () => {
      this.closeConfirm(overlay);
      if (onCancel) {
onCancel();
}
    });

    // Handle ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.closeConfirm(overlay);
        if (onCancel) {
onCancel();
}
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Trigger animation
    setTimeout(() => {
      overlay.classList.add('show');
    }, 10);
  }

  /**
   * Close confirm dialog
   * @private
   */
  closeConfirm(overlay) {
    if (!overlay || !overlay.parentElement) {
return;
}

    overlay.classList.remove('show');

    setTimeout(() => {
      if (overlay.parentElement) {
        overlay.remove();
      }
      document.body.style.overflow = '';
    }, 300);
  }

  /**
   * ========================================
   * Utility Methods
   * ========================================
   */

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * ========================================
 * Create Global Instance
 * ========================================
 */

const notificationSystem = new NotificationSystem();

/**
 * ========================================
 * Export & Global Initialization
 * ========================================
 */

// Export to global scope IMMEDIATELY (not ES6 module)
if (typeof window !== 'undefined') {
  window.NotificationSystem = notificationSystem;
  window.NotificationTypes = NotificationTypes;

  // Create backward compatibility wrapper functions
  window.showNotification = function(message, type = 'success') {
    const typeMap = {
      'success': 'success',
      'error': 'error',
      'warning': 'warning',
      'info': 'info'
    };
    const mappedType = typeMap[type] || 'info';
    notificationSystem.show(message, mappedType, 3000);
  };

  window.showSimpleLoading = function(message = 'מעבד...') {
    notificationSystem.showLoading(message);
  };

  window.hideSimpleLoading = function() {
    notificationSystem.hideLoading();
  };

  Logger.log('✅ Notification System loaded and ready');

  // ===== EventBus Listeners (Architecture v2.0) =====
  // מאזין לאירועים ומציג הודעות אוטומטיות

  /**
   * Initialize EventBus listeners for automatic notifications
   * ✅ הודעות אוטומטיות לפי אירועים
   */
  function initializeNotificationListeners() {
    if (!window.EventBus) {
      console.warn('⚠️ EventBus not available - skipping notification listeners');
      return;
    }

    // 👂 Listen to task:completed - הודעת הצלחה
    window.EventBus.on('task:completed', (data) => {
      notificationSystem.show(
        `✅ משימה הושלמה: ${data.clientName}`,
        'success',
        3000
      );
      Logger.log(`👂 [Notifications] Showed completion notification for task ${data.taskId}`);
    });

    // 👂 Listen to task:budget-adjusted - הודעת עדכון תקציב
    window.EventBus.on('task:budget-adjusted', (data) => {
      const diff = data.newEstimate - data.oldEstimate;
      const message = diff > 0
        ? `📈 תקציב הוגדל: +${diff} דקות`
        : `📉 תקציב הוקטן: ${diff} דקות`;

      notificationSystem.show(message, 'info', 3000);
      Logger.log('👂 [Notifications] Showed budget adjustment notification');
    });

    // 👂 Listen to system:error - הודעת שגיאה
    window.EventBus.on('system:error', (data) => {
      notificationSystem.show(
        `❌ שגיאה: ${data.message}`,
        'error',
        5000
      );
      Logger.log('👂 [Notifications] Showed error notification');
    });

    Logger.log('✅ Notification EventBus listeners initialized (v2.0)');
  }

  // Initialize listeners when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationListeners);
  } else {
    // DOM already ready, initialize immediately
    initializeNotificationListeners();
  }
}
