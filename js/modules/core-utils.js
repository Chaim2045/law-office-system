/**
 * Core Utilities Module
 * Provides essential utility functions, global state management, and formatting helpers
 *
 * Created: 2025
 * Part of Law Office Management System
 */

// Import deduction system calculator (Single Source of Truth)
import { calculateRemainingHours } from '../../src/modules/deduction/calculators.js';

// Global state
let currentActiveTab = "budget";
let isScrolled = false;

/* === Global Listeners Registry === */
const globalListeners = {
  documentClick: null,
  documentKeydown: null,
  windowResize: null,
  notificationClick: null,
};

/* === Utility Functions === */

function safeText(text) {
  if (typeof text !== "string") {
    return String(text || "");
  }
  const div = document.createElement("div");
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
const feedbackStyles = document.createElement("style");
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
 * Format date functions
 * Updated to match VanillaCalendarPicker format for consistency
 */
function formatDateTime(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "תאריך לא תקין";
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} בשעה ${hours}:${minutes}`;
  } catch (error) {
    console.warn("formatDateTime failed", { input: date, error });
    return "תאריך לא תקין";
  }
}

function formatDate(dateString) {
  try {
    if (!dateString) return '-';

    // Handle Firebase Timestamp
    let d;
    if (dateString.toDate && typeof dateString.toDate === 'function') {
      d = dateString.toDate();
    } else {
      d = new Date(dateString);
    }

    return d.toLocaleDateString("he-IL");
  } catch (error) {
    console.warn("formatDate failed", { input: dateString, error });
    return "תאריך לא תקין";
  }
}

function formatShort(date) {
  if (!date) return '-';

  // Handle Firebase Timestamp
  let d;
  if (date.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else {
    d = new Date(date);
  }

  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

/**
 * 🎯 SINGLE SOURCE OF TRUTH - חישוב שעות נותרות מחבילות
 *
 * הפונקציה מיובאת מהמודול המודולרי החדש: src/modules/deduction/calculators.js
 *
 * ⚠️ CRITICAL: כל הקבצים במערכת צריכים להשתמש בפונקציה הזו!
 * אל תקרא ישירות מ- entity.hoursRemaining - זה נתון מיושן!
 */

// Make calculateRemainingHours globally available (for non-ES6 modules)
if (typeof window !== 'undefined') {
  window.calculateRemainingHours = calculateRemainingHours;
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
  calculateRemainingHours // ✅ NEW: Global hours calculation function
};
