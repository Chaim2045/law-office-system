/**
 * ========================================
 * Notification System Bridge
 * ========================================
 * גשר בין מערכת ההודעות הישנה לחדשה
 * מאפשר לקוד הישן לעבוד עם המערכת החדשה ללא שינויים
 *
 * תאריך: 2025-01-17
 * @version 1.0.0
 */

import NotificationSystem from './notification-system.js';

/**
 * ========================================
 * Legacy showNotification Support
 * ========================================
 * תמיכה במערכת ההודעות הישנה
 */

function showNotification(message, type = 'success') {
  // Map old notification types to new system
  const typeMap = {
    'success': 'success',
    'error': 'error',
    'warning': 'warning',
    'info': 'info'
  };

  const mappedType = typeMap[type] || 'info';
  NotificationSystem.show(message, mappedType, 3000);
}

/**
 * ========================================
 * Legacy showSimpleLoading Support
 * ========================================
 */

function showSimpleLoading(message = 'מעבד...') {
  NotificationSystem.showLoading(message);
}

function hideSimpleLoading() {
  NotificationSystem.hideLoading();
}

/**
 * ========================================
 * Enhanced Manager Integration
 * ========================================
 * הוספת מתודות למחלקת Manager
 */

if (typeof window !== 'undefined') {
  // Wait for Manager to be defined
  const waitForManager = setInterval(() => {
    if (window.LawOfficeManager && window.LawOfficeManager.prototype) {
      clearInterval(waitForManager);

      // Add notification methods to Manager prototype
      if (!window.LawOfficeManager.prototype.showNotification) {
        window.LawOfficeManager.prototype.showNotification = function(message, type = 'success') {
          showNotification(message, type);
        };
      }

      if (!window.LawOfficeManager.prototype.showLoading) {
        window.LawOfficeManager.prototype.showLoading = function(message) {
          showSimpleLoading(message);
        };
      }

      if (!window.LawOfficeManager.prototype.hideLoading) {
        window.LawOfficeManager.prototype.hideLoading = function() {
          hideSimpleLoading();
        };
      }

      if (!window.LawOfficeManager.prototype.confirm) {
        window.LawOfficeManager.prototype.confirm = function(message, onConfirm, onCancel, options) {
          NotificationSystem.confirm(message, onConfirm, onCancel, options);
        };
      }

      console.log('✅ Notification Bridge: Manager methods added');
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => {
    clearInterval(waitForManager);
  }, 5000);
}

/**
 * ========================================
 * Global Exports
 * ========================================
 */

// Export to window for global access
if (typeof window !== 'undefined') {
  window.showNotification = showNotification;
  window.showSimpleLoading = showSimpleLoading;
  window.hideSimpleLoading = hideSimpleLoading;

  // Also export the new system
  window.NotificationSystem = NotificationSystem;
}

// Export for ES6 modules
export {
  showNotification,
  showSimpleLoading,
  hideSimpleLoading,
  NotificationSystem
};

export default {
  showNotification,
  showSimpleLoading,
  hideSimpleLoading,
  NotificationSystem
};
