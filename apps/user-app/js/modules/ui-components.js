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
  // Per-operation lock: tracks which operations are currently executing
  static _activeOperations = new Set();

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
      closeDelay = 150,
      minLoadingDuration = 0, // No artificial delay — progressive loading pattern
      operationKey = null // Per-operation double-click guard key
    } = options;

    // Double-click guard: per-operation granularity
    const lockKey = operationKey || '__global__';
    if (ActionFlowManager._activeOperations.has(lockKey)) {
      console.warn(`⚠️ ActionFlowManager: blocked duplicate [${lockKey}]`);
      if (window.NotificationSystem) {
        window.NotificationSystem.warning('הפעולה כבר מתבצעת, אנא המתן', 2000);
      }
      return { success: false, error: new Error('Action already in progress') };
    }
    ActionFlowManager._activeOperations.add(lockKey);

    // ✅ Support both 'message' and 'loadingMessage' for backward compatibility
    const finalLoadingMessage = loadingMessage || message || 'מעבד...';

    // Validation
    if (typeof action !== 'function') {
      ActionFlowManager._activeOperations.delete(lockKey);
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

      // 5. Show success message
      if (successMessage) {
        if (window.NotificationSystem) {
          window.NotificationSystem.success(successMessage, 2500);
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

      // Show error message
      // Backend errors built via buildAppError carry { code, userMessage } in error.details
      const errDetails = error?.details || {};
      const errCode = errDetails.code || null;
      const userMessage = errDetails.userMessage || error.message || 'שגיאה לא ידועה';

      // errorMessage may be:
      //   - function (new contract) → invoked with userMessage
      //   - string (legacy prefix) → "<prefix>: <userMessage>"
      let fullErrorMessage;
      if (typeof errorMessage === 'function') {
        fullErrorMessage = errorMessage(userMessage);
      } else {
        fullErrorMessage = `${errorMessage}: ${userMessage}`;
      }

      if (window.NotificationSystem) {
        window.NotificationSystem.error(fullErrorMessage, 5000, { code: errCode });
      } else {
        window.showNotification?.(fullErrorMessage, 'error');
      }

      // Execute error callback
      if (onError && typeof onError === 'function') {
        await onError(error);
      }

      return { success: false, error };

    } finally {
      // Order matters: onFinally first (resets internal guards like _timesheetSubmitting),
      // then delete lockKey (releases AFM lock). Prevents race window.
      try {
        if (onFinally && typeof onFinally === 'function') {
          await onFinally();
        }
      } catch (e) {
        console.error('❌ ActionFlowManager onFinally error:', e);
      }
      ActionFlowManager._activeOperations.delete(lockKey);
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
  ActionFlowManager,
  updateUserDisplay,
  updateSidebarUser
  // ✅ Client form functions removed
  // ✅ showNotification removed - use NotificationSystem instead
};
