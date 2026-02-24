/**
 * Core Utilities Module
 * Provides essential utility functions, global state management, and formatting helpers
 *
 * Created: 2025
 * Part of Law Office Management System
 *
 * @module CoreUtilsModule
 * @version 1.2.0
 * @updated 2025-01-23
 *
 * ════════════════════════════════════════════════════════════════════
 * CHANGELOG
 * ════════════════════════════════════════════════════════════════════
 *
 * v1.2.0 - 23/01/2025 (November 23, 2025)
 * ----------------------------------------
 * 🐛 BUG FIX: Progress bar not updating after time logging
 *
 * Problem: Service card progress bars showed 0% even after logging hours
 * Root Cause: calculateTotalHours() and calculateHoursUsed() were not exported to window
 *
 * Changes:
 * - Line 32-36: Added calculateTotalHours and calculateHoursUsed to imports
 * - Line 167-168: Added both functions to window global object
 * - Line 185-186: Added both functions to module exports
 *
 * Impact:
 * - ✅ Progress bars now show correct percentage
 * - ✅ Hours used display correctly in service cards
 * - ✅ Real-time updates work properly
 * - ✅ Fixes js/modules/service-card-renderer.js (lines 70-72, 121-123)
 *
 * Files affected:
 * - js/modules/service-card-renderer.js (uses window.calculateTotalHours/calculateHoursUsed)
 * - js/modules/client-case-selector.js (uses window.calculateTotalHours/calculateHoursUsed)
 *
 * Performance: No impact - functions already existed, just exposed to window
 *
 * v1.1.0 - 19/01/2025
 * -------------------
 * 🔄 Refactoring: Eliminated code duplication across modules
 * ✅ NEW: Exported safeText to global window object (line 141)
 * ✅ REFACTORED: Date functions now re-export from DatesModule (lines 117-127)
 * 📊 Impact: Reduced ~80 lines of duplicate code across 8 files
 * 🎯 Single Source of Truth for HTML escaping and date formatting
 *
 * Benefits:
 * - Consistent XSS protection across entire application
 * - Centralized date formatting logic
 * - Easier maintenance (one place to fix bugs)
 * - Backward compatibility maintained
 */

// Import deduction system calculators (Single Source of Truth)
import {
  calculateRemainingHours,
  calculateTotalHours,
  calculateHoursUsed
} from '../../src/modules/deduction/calculators.js';

// Global state
const currentActiveTab = 'budget';
const isScrolled = false;

/* === Global Listeners Registry === */
const globalListeners = {
  documentClick: null,
  documentKeydown: null,
  windowResize: null,
  notificationClick: null
};

/* === Utility Functions === */

function safeText(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Loading overlay functions - REMOVED
 * ✅ showSimpleLoading & hideSimpleLoading removed (v4.35.0)
 * Use NotificationSystem.showLoading() and NotificationSystem.hideLoading() instead
 * Backward compatibility handled by wrapper in index.html
 */

// Global flag to suppress loading during welcome screen (still needed by new system)
window.isInWelcomeScreen = false;

/**
 * Show subtle progress indicator
 */
// ✅ Legacy notification functions removed (v4.34.0)
// All usages replaced with unified showNotification() system

// Add CSS animations for feedback system
const feedbackStyles = document.createElement('style');
feedbackStyles.textContent = `
  @keyframes slideInUp {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100px);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(feedbackStyles);

/**
 * ✅ REFACTORED: Date formatting functions (v4.36.0)
 *
 * Single Source of Truth: js/modules/dates.js
 * These are re-exported from window.DatesModule for backward compatibility
 *
 * Benefits:
 * - No code duplication
 * - Consistent Firebase Timestamp handling
 * - Better error handling with fallbacks
 * - One place to maintain date formatting logic
 */

// Re-export from DatesModule (loaded globally via dates.js)
const formatDateTime = (date) => {
  return window.DatesModule?.formatDateTime(date) || '-';
};

const formatDate = (dateString) => {
  return window.DatesModule?.formatDate(dateString) || '-';
};

const formatShort = (date) => {
  return window.DatesModule?.formatShort(date) || '-';
};

/**
 * 🎯 SINGLE SOURCE OF TRUTH - חישוב שעות נותרות מחבילות
 *
 * הפונקציה מיובאת מהמודול המודולרי החדש: src/modules/deduction/calculators.js
 *
 * ⚠️ CRITICAL: כל הקבצים במערכת צריכים להשתמש בפונקציה הזו!
 * אל תקרא ישירות מ- entity.hoursRemaining - זה נתון מיושן!
 */

// Make utility functions globally available (for non-ES6 modules)
if (typeof window !== 'undefined') {
  window.calculateRemainingHours = calculateRemainingHours;
  window.calculateTotalHours = calculateTotalHours;
  window.calculateHoursUsed = calculateHoursUsed;
  window.safeText = safeText; // ✅ Make safeText globally available
}

// Exports
export {
  currentActiveTab,
  isScrolled,
  globalListeners,
  safeText,
  delay,
  debounce,
  // ✅ showSimpleLoading, hideSimpleLoading removed - use NotificationSystem instead
  formatDateTime,
  formatDate,
  formatShort,
  calculateRemainingHours,
  calculateTotalHours,
  calculateHoursUsed
};
