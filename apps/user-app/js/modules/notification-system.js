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
   * @param {Object} [options] - Additional options
   * @param {string|null} [options.code] - Error code badge (e.g. ERR-1001) — shown in footer
   * @returns {HTMLElement} The notification element
   */
  show(message, type = NotificationTypes.INFO, duration = DEFAULT_DURATION, options = {}) {
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
    const notification = this.createNotificationElement(message, type, options);

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
   * @param {string} message
   * @param {string} type
   * @param {Object} [options]
   * @param {string|null} [options.code] - Optional error code badge
   */
  createNotificationElement(message, type, options = {}) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', type === NotificationTypes.ERROR ? 'assertive' : 'polite');

    const icon = NotificationIcons[type];
    const color = NotificationColors[type];

    const codeBadge = options && options.code
      ? `<div class="notification-code" aria-label="קוד שגיאה">קוד: ${this.escapeHtml(String(options.code))}</div>`
      : '';

    notification.innerHTML = `
      <div class="notification-icon" style="color: ${color}">
        <i class="${icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-message">${this.escapeHtml(message)}</div>
        ${codeBadge}
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

  error(message, duration = DEFAULT_DURATION, options = {}) {
    return this.show(message, NotificationTypes.ERROR, duration, options);
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
   * Show loading overlay via UnifiedLoadingOverlay
   * @param {string} message - Loading message
   * @param {Object} options - Loading options
   * @param {string} options.animationType - Type of animation (loading, saving, uploading, etc.)
   * @param {number} options.timeout - Auto-hide timeout (ms), 0 = disabled
   * @param {Function} options.onTimeout - Callback when timeout is reached
   */
  showLoading(message = 'טוען...', options = {}) {
    if (window.isInWelcomeScreen) {
      return;
    }

    const loader = this._getUnifiedLoader();
    if (loader) {
      loader.show(message, options);
      return;
    }
    // Fallback — should not happen, LoadingOverlay.js is blocking
    console.warn('[NotificationSystem] UnifiedLoadingOverlay not available, loading skipped');
  }

  /**
   * Get or create UnifiedLoadingOverlay singleton instance
   * @private
   * @returns {UnifiedLoadingOverlay|null}
   */
  _getUnifiedLoader() {
    if (this._unifiedLoader) {
      return this._unifiedLoader;
    }
    if (typeof window.UnifiedLoadingOverlay === 'function') {
      this._unifiedLoader = new window.UnifiedLoadingOverlay();
      return this._unifiedLoader;
    }
    return null;
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
   * Hide loading overlay via UnifiedLoadingOverlay
   */
  hideLoading() {
    const loader = this._getUnifiedLoader();
    if (loader) {
      loader.hide();
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
   * Show alert dialog with OK button
   * דיאלוג הודעה עם כפתור אישור בלבד
   * @param {string} message - Message to display
   * @param {Function} onOk - Callback when OK is clicked (optional)
   * @param {Object} options - Alert options
   * @param {string} options.title - Dialog title
   * @param {string} options.okText - OK button text
   * @param {string} options.type - Type (success, info, warning, error)
   */
  alert(message, onOk = null, options = {}) {
    const {
      title = 'הודעה',
      okText = 'הבנתי',
      type = 'success'
    } = options;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); animation: fadeIn 0.15s ease;';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'alert-title');

    const icon = NotificationIcons[type];
    // Use blue color for success instead of green
    const color = type === 'success' ? '#3b82f6' : NotificationColors[type];

    // Parse structured message (detect lines with specific patterns)
    const messageHtml = this.parseStructuredAlertMessage(message);

    overlay.innerHTML = `
      <div class="alert-dialog" style="background: white; border-radius: 10px; padding: 0; max-width: 420px; width: 90%; box-shadow: 0 8px 24px rgba(0,0,0,0.12); animation: slideUp 0.2s ease; direction: rtl; text-align: right; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <div class="alert-header" style="background: white; color: #0f172a; padding: 16px 20px; border-bottom: 1px solid #f1f5f9; border-radius: 10px 10px 0 0;">
          <div style="display: flex; align-items: center; gap: 10px; justify-content: flex-end;">
            <i class="${icon}" style="color: ${color}; font-size: 18px;"></i>
            <h2 id="alert-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #0f172a;">${this.escapeHtml(title)}</h2>
          </div>
        </div>

        <!-- Content -->
        <div class="alert-body" style="padding: 20px;">
          ${messageHtml}
        </div>

        <!-- Footer -->
        <div class="alert-footer" style="padding: 0 20px 16px 20px; display: flex; gap: 8px; justify-content: flex-end;">
          <button class="alert-btn alert-btn-ok" type="button" style="padding: 10px 24px; background: ${color}; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='${type === 'success' ? '#2563eb' : color}'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='${color}'; this.style.transform='translateY(0)'">
            <i class="fas fa-check"></i>
            ${this.escapeHtml(okText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Focus on OK button
    setTimeout(() => {
      overlay.querySelector('.alert-btn-ok')?.focus();
    }, 100);

    // Handle OK click
    const okBtn = overlay.querySelector('.alert-btn-ok');
    okBtn.addEventListener('click', () => {
      this.closeConfirm(overlay);
      if (onOk) {
        onOk();
      }
    });

    // Handle Enter key
    const handleEnter = (e) => {
      if (e.key === 'Enter') {
        this.closeConfirm(overlay);
        if (onOk) {
          onOk();
        }
        document.removeEventListener('keydown', handleEnter);
      }
    };
    document.addEventListener('keydown', handleEnter);

    // Trigger animation
    setTimeout(() => {
      overlay.classList.add('show');
    }, 10);
  }

  /**
   * Parse structured alert message into organized HTML
   * Converts multiline text with emojis into clean sections
   * @private
   */
  parseStructuredAlertMessage(message) {
    // If message contains specific patterns, structure it nicely
    const lines = message.split('\n').filter(line => line.trim());

    // Check if this is a task creation message (contains ✅ and 📋)
    if (message.includes('✅') && message.includes('📋')) {
      let html = '<div>';

      // Collect task details for horizontal grid
      const taskDetails = [];
      let mainMessage = '';
      let notificationMessage = '';
      let infoMessage = '';

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
return;
}

        if (trimmed.startsWith('✅')) {
          mainMessage = trimmed.replace('✅', '').trim();
        } else if (trimmed.startsWith('📋')) {
          taskDetails.push({
            icon: 'fa-tasks',
            label: 'תיאור',
            text: trimmed.replace('📋', '').trim()
          });
        } else if (trimmed.startsWith('👤')) {
          taskDetails.push({
            icon: 'fa-user',
            label: 'לקוח',
            text: trimmed.replace('👤', '').trim()
          });
        } else if (trimmed.startsWith('⏱️')) {
          taskDetails.push({
            icon: 'fa-clock',
            label: 'תקציב',
            text: trimmed.replace('⏱️', '').trim()
          });
        } else if (trimmed.startsWith('🔔')) {
          notificationMessage = trimmed.replace('🔔', '').trim();
        } else if (trimmed.startsWith('💡')) {
          infoMessage = trimmed.replace('💡', '').trim();
        }
      });

      // Main success message - Clean professional style
      if (mainMessage) {
        html += `<div style="background: white; padding: 12px 14px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-check-circle" style="color: #3b82f6; font-size: 14px;"></i>
            <span style="font-size: 14px; font-weight: 500; color: #1f2937;">
              ${this.escapeHtml(mainMessage)}
            </span>
          </div>
        </div>`;
      }

      // Task details in compact grid (3 columns) - Clean professional style
      if (taskDetails.length > 0) {
        html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">';
        taskDetails.forEach(detail => {
          html += `<div style="background: white; padding: 12px; border-radius: 10px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <i class="fas ${detail.icon}" style="color: #3b82f6; font-size: 12px;"></i>
              <span style="font-size: 11px; color: #6b7280; font-weight: 500;">${detail.label}</span>
            </div>
            <div style="font-size: 13px; color: #111827; font-weight: 600; line-height: 1.3;">
              ${this.escapeHtml(detail.text)}
            </div>
          </div>`;
        });
        html += '</div>';
      }

      // Notification message - Clean professional style
      if (notificationMessage) {
        html += `<div style="background: white; padding: 10px 12px; margin-bottom: 10px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-bell" style="color: #3b82f6; font-size: 13px;"></i>
            <span style="font-size: 13px; color: #374151; font-weight: 500; line-height: 1.4;">
              ${this.escapeHtml(notificationMessage)}
            </span>
          </div>
        </div>`;
      }

      // Info message - Clean professional style
      if (infoMessage) {
        html += `<div style="background: white; padding: 10px 12px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-info-circle" style="color: #3b82f6; font-size: 13px;"></i>
            <span style="font-size: 12px; color: #4b5563; line-height: 1.4;">
              ${this.escapeHtml(infoMessage)}
            </span>
          </div>
        </div>`;
      }

      html += '</div>';
      return html;
    }

    // Fallback: simple formatted message
    return `<p style="font-size: 16px; color: #4b5563; line-height: 1.8; margin: 0; text-align: center;">${this.escapeHtml(message).replace(/\n/g, '<br>')}</p>`;
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
