/**
 * UI Components Module
 * Provides DOM management, notification system, and UI interaction helpers
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { safeText , globalListeners } from './core-utils.js';


/* === Utility Classes === */

/**
 * DOM elements cache
 */
class DOMCache {
  constructor() {
    this.elements = new Map();
  }

  getElementById(id) {
    if (this.elements.has(id)) {
      return this.elements.get(id);
    }
    const element = document.getElementById(id);
    if (element) {
      this.elements.set(id, element);
    }
    return element;
  }

  querySelector(selector) {
    if (this.elements.has(selector)) {
      return this.elements.get(selector);
    }
    const element = document.querySelector(selector);
    if (element) {
      this.elements.set(selector, element);
    }
    return element;
  }
}

/**
 * Notification bell system
 */
class NotificationBellSystem {
  constructor() {
    this.notifications = [];
    this.isDropdownOpen = false;
    this.clickHandler = null;
    this.init();
  }

  init() {
    this.clickHandler = (e) => {
      const bell = document.getElementById('notificationBell');
      const dropdown = document.getElementById('notificationsDropdown');
      if (
        bell &&
        dropdown &&
        !bell.contains(e.target) &&
        !dropdown.contains(e.target)
      ) {
        this.hideDropdown();
      }
    };
    globalListeners.notificationClick = this.clickHandler;
    document.addEventListener('click', this.clickHandler);
  }

  cleanup() {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }

  addNotification(type, title, description, urgent = false) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      description,
      time: new Date().toLocaleString('he-IL'),
      urgent
    };
    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }

  removeNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.updateBell();
    this.renderNotifications();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.updateBell();
    this.renderNotifications();
  }

  updateBell() {
    const bell = document.getElementById('notificationBell');
    const count = document.getElementById('notificationCount');
    if (bell && count) {
      if (this.notifications.length > 0) {
        bell.classList.add('has-notifications');
        count.classList.remove('hidden');
        count.textContent = this.notifications.length;
      } else {
        bell.classList.remove('has-notifications');
        count.classList.add('hidden');
      }
    }
  }

  showDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
      dropdown.classList.add('show');
      this.isDropdownOpen = true;
    }
  }

  hideDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
      this.isDropdownOpen = false;
    }
  }

  toggleDropdown() {
    this.isDropdownOpen ? this.hideDropdown() : this.showDropdown();
  }

  renderNotifications() {
    const container = document.getElementById('notificationsContent');
    if (!container) {
return;
}

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="no-notifications">
          <div class="no-notifications-icon"><i class="fas fa-bell-slash"></i></div>
          <h4>אין התראות</h4>
          <p>כל ההתראות יופיעו כאן</p>
        </div>
      `;
      return;
    }

    const iconMap = {
      blocked: 'fas fa-ban',
      critical: 'fas fa-exclamation-triangle',
      urgent: 'fas fa-clock'
    };

    const notificationsHtml = this.notifications
      .map((notification) => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `notification-item ${notification.type} ${
          notification.urgent ? 'urgent' : ''
        }`;
        notificationDiv.id = `notification-${notification.id}`;

        notificationDiv.innerHTML = `
          <button class="notification-close" onclick="notificationBell.removeNotification(${
            notification.id
          })">
            <i class="fas fa-times"></i>
          </button>
          <div class="notification-content">
            <div class="notification-icon ${notification.type}">
              <i class="${
                iconMap[notification.type] || 'fas fa-info-circle'
              }"></i>
            </div>
            <div class="notification-text">
              <div class="notification-title">${safeText(
                notification.title
              )}</div>
              <div class="notification-description">${safeText(
                notification.description
              )}</div>
              <div class="notification-time">${safeText(
                notification.time
              )}</div>
            </div>
          </div>
        `;
        return notificationDiv.outerHTML;
      })
      .join('');

    container.innerHTML = notificationsHtml;
  }

  updateFromSystem(blockedClients, criticalClients, urgentTasks) {
    this.notifications = this.notifications.filter((n) => !n.isSystemGenerated);

    if (blockedClients.size > 0) {
      this.addSystemNotification(
        'blocked',
        `${blockedClients.size} לקוחות חסומים`,
        `לקוחות ללא שעות: ${Array.from(blockedClients).join(', ')}`,
        true
      );
    }

    if (criticalClients.size > 0) {
      this.addSystemNotification(
        'critical',
        `${criticalClients.size} לקוחות קריטיים`,
        `לקוחות עם מעט שעות: ${Array.from(criticalClients).join(', ')}`,
        false
      );
    }

    if (urgentTasks.length > 0) {
      const overdueCount = urgentTasks.filter(
        (task) => new Date(task.deadline) <= new Date()
      ).length;
      if (overdueCount > 0) {
        this.addSystemNotification(
          'urgent',
          `${overdueCount} משימות באיחור`,
          'משימות שעבר תאריך היעד שלהן',
          true
        );
      }
    }
  }

  addSystemNotification(type, title, description, urgent) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      description,
      time: new Date().toLocaleString('he-IL'),
      urgent,
      isSystemGenerated: true
    };
    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }
}

/**
 * Action Flow Manager
 * ניהול אחיד של זרימת פעולות עם משובים ויזואליים
 *
 * @example
 * await ActionFlowManager.execute({
 *   loadingMessage: 'שומר משימה...',
 *   animationType: 'saving', // Optional: loading, saving, uploading, syncing, etc.
 *   action: async () => await saveTask(data),
 *   successMessage: 'המשימה נשמרה בהצלחה',
 *   errorMessage: 'שגיאה בשמירת משימה',
 *   onSuccess: () => closeForm(),
 *   closePopupOnSuccess: true
 * });
 */
class ActionFlowManager {
  /**
   * Execute an action with consistent UX flow
   * @param {Object} options Configuration options
   * @param {string} options.loadingMessage - Loading message to display
   * @param {string} options.animationType - Type of Lottie animation (loading, saving, uploading, etc.)
   * @param {Function} options.action - Async function to execute
   * @param {string} options.successMessage - Success message
   * @param {string} options.errorMessage - Error message prefix
   * @param {Function} options.onSuccess - Callback on success (optional)
   * @param {Function} options.onError - Callback on error (optional)
   * @param {Function} options.onFinally - Callback always runs (optional)
   * @param {boolean} options.closePopupOnSuccess - Auto-close popup on success (default: false)
   * @param {string} options.popupSelector - Popup selector to close (default: '.popup-overlay')
   * @param {number} options.closeDelay - Delay before closing popup in ms (default: 500)
   * @param {number} options.minLoadingDuration - Minimum loading duration in ms (default: 200)
   * @returns {Promise<{success: boolean, data?: any, error?: Error}>}
   */
  static async execute(options) {
    const {
      loadingMessage,
      message, // ✅ Support both 'message' and 'loadingMessage' for NotificationMessages compatibility
      animationType = 'loading', // ✅ NEW: Animation type for Lottie
      action,
      successMessage,
      errorMessage = 'שגיאה בביצוע הפעולה',
      onSuccess = null,
      onError = null,
      onFinally = null,
      closePopupOnSuccess = false,
      popupSelector = '.popup-overlay',
      closeDelay = 500,
      minLoadingDuration = 200 // Reduced from 1000ms - fast UX without minimum wait
    } = options;

    // ✅ Support both 'message' and 'loadingMessage' for backward compatibility
    const finalLoadingMessage = loadingMessage || message || 'מעבד...';

    // Validation
    if (typeof action !== 'function') {
      console.error('❌ ActionFlowManager: action must be a function');
      return { success: false, error: new Error('Invalid action parameter') };
    }

    let result = null;
    let actionError = null;
    let startTime = null; // ✅ Define outside try block

    try {
      // 1. Show loading and track start time
      startTime = Date.now();

      if (window.NotificationSystem) {
        window.NotificationSystem.showLoading(finalLoadingMessage, { animationType });
      } else {
        window.showSimpleLoading?.(finalLoadingMessage);
      }

      // 2. Execute action
      result = await action();

      // 3. ✅ Calculate elapsed time and wait if needed
      const elapsedTime = Date.now() - startTime;
      const remainingTime = minLoadingDuration - elapsedTime;

      if (remainingTime > 0) {
        Logger.log(`⏱️ Waiting ${remainingTime}ms to reach minimum loading duration...`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // 4. Hide loading
      if (window.NotificationSystem) {
        window.NotificationSystem.hideLoading();
      } else {
        window.hideSimpleLoading?.();
      }

      // Small delay to ensure loading is hidden before showing success
      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. Show success message
      if (successMessage) {
        if (window.NotificationSystem) {
          // ✅ 5 seconds for important messages like task approval
          window.NotificationSystem.success(successMessage, 5000);
        } else {
          window.showNotification?.(successMessage, 'success');
        }
      }

      // 5. Execute success callback
      if (onSuccess && typeof onSuccess === 'function') {
        await onSuccess(result);
      }

      // 6. Close popup if needed
      if (closePopupOnSuccess) {
        setTimeout(() => {
          const popup = document.querySelector(popupSelector);
          if (popup) {
            popup.remove();
          }
        }, closeDelay);
      }

      return { success: true, data: result };

    } catch (error) {
      actionError = error;
      console.error('❌ ActionFlowManager error:', error);

      // ✅ Wait for minimum duration even on error (so user sees the animation)
      const elapsedTime = Date.now() - startTime;
      const remainingTime = minLoadingDuration - elapsedTime;

      if (remainingTime > 0) {
        Logger.log(`⏱️ Waiting ${remainingTime}ms even on error...`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Hide loading on error
      if (window.NotificationSystem) {
        window.NotificationSystem.hideLoading();
      } else {
        window.hideSimpleLoading?.();
      }

      // Small delay before showing error
      await new Promise(resolve => setTimeout(resolve, 100));

      // Show error message
      const fullErrorMessage = `${errorMessage}: ${error.message || 'שגיאה לא ידועה'}`;
      if (window.NotificationSystem) {
        window.NotificationSystem.error(fullErrorMessage, 5000);
      } else {
        window.showNotification?.(fullErrorMessage, 'error');
      }

      // Execute error callback
      if (onError && typeof onError === 'function') {
        await onError(error);
      }

      return { success: false, error };

    } finally {
      // Execute finally callback
      if (onFinally && typeof onFinally === 'function') {
        await onFinally();
      }
    }
  }

  /**
   * Execute action with form reset on success
   * @param {Object} options - Same as execute() + formId
   */
  static async executeWithFormReset(options) {
    const { formId, formContainerId, ...restOptions } = options;

    const originalOnSuccess = restOptions.onSuccess;

    return this.execute({
      ...restOptions,
      onSuccess: async (result) => {
        // Reset form
        if (formId) {
          const form = document.getElementById(formId);
          if (form) {
form.reset();
}
        }

        // Hide form container
        if (formContainerId) {
          const container = document.getElementById(formContainerId);
          if (container) {
container.classList.add('hidden');
}

          // Remove active state from plus button
          const plusButton = document.getElementById('smartPlusBtn');
          if (plusButton) {
plusButton.classList.remove('active');
}
        }

        // Call original callback
        if (originalOnSuccess) {
          await originalOnSuccess(result);
        }
      }
    });
  }
}

/* === Public API Functions === */

function updateUserDisplay(userName) {
  const userDisplay = document.getElementById('currentUserDisplay');
  if (userDisplay && userName) {
    userDisplay.textContent = `${userName} - משרד עו"ד גיא הרשקוביץ`;
  }
}

function updateSidebarUser(userName) {
  const userAvatar = document.querySelector('.user-avatar');
  if (!userAvatar) {
return;
}

  if (userName) {
    userAvatar.setAttribute('title', `מחובר: ${userName}`);
    userAvatar.setAttribute('data-user', userName);

    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)'
    ];

    const colorIndex = userName.charCodeAt(0) % colors.length;
    userAvatar.style.background = colors[colorIndex];
    userAvatar.style.transform = 'scale(1.05)';
    setTimeout(() => {
      userAvatar.style.transform = '';
    }, 300);
  }
}

// ✅ Client form functions removed - use casesManager.showCreateCaseDialog() instead
// Removed: showClientForm, showPasswordDialog, checkAdminPassword, openClientForm, hideClientForm

// ✅ showNotification removed (v4.35.0) - use NotificationSystem.show() instead
// Backward compatibility handled by wrapper in index.html

// Exports
export {
  DOMCache,
  NotificationBellSystem,
  ActionFlowManager,
  updateUserDisplay,
  updateSidebarUser
  // ✅ Client form functions removed
  // ✅ showNotification removed - use NotificationSystem instead
};
