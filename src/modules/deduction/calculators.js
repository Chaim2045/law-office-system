/**
 * Deduction System - Calculators Module
 * Pure calculation functions for hours deduction system
 *
 * @module deduction/calculators
 * @description Contains pure functions for calculating hours, remaining time, and progress
 * @created 2025-11-11
 * @version 1.1.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - תיקון: תמיכה בהליכים משפטיים עם שלבים
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-17
 * 📦 גרסה: 1.0.0 → 1.1.0
 *
 * ✅ שינויים:
 * 1. calculateRemainingHours() - הוספתי תמיכה ב-legal_procedure עם stages
 *    - הפונקציה עכשיו סוכמת שעות מכל השלבים הפעילים
 *    - תומכת בחבילות בתוך שלבים (stage.packages)
 *    - Fallback ל-stage.hoursRemaining אם אין packages
 *
 * 2. הפונקציה מטפלת כעת ב-3 מקרים:
 *    a) Legal procedure עם stages → סכום שעות מכל השלבים
 *    b) Service רגיל עם packages → סכום מהחבילות הפעילות
 *    c) Legacy structure → hoursRemaining ישירות
 *
 * למה זה חשוב:
 * ללא התיקון הזה, הליכים משפטיים עם שלבים היו מציגים 0 שעות
 * במקום הסכום האמיתי מכל השלבים.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 🎯 SINGLE SOURCE OF TRUTH - Calculate remaining hours from packages
 *
 * This is the most critical function in the deduction system.
 * All modules must use this function instead of reading entity.hoursRemaining directly.
 *
 * @param {Object} entity - Service, stage, or case with packages
 * @param {Array<Object>} [entity.packages] - Array of hour packages
 * @param {number} [entity.hoursRemaining] - Legacy field (fallback only)
 * @returns {number} Total remaining hours from active packages
 *
 * @example
 * // New structure with packages:
 * const service = {
 *   packages: [
 *     { status: 'active', hoursRemaining: 20 },
 *     { status: 'depleted', hoursRemaining: 0 },
 *     { status: 'active', hoursRemaining: 15 }
 *   ]
 * };
 * const hours = calculateRemainingHours(service); // Returns: 35
 *
 * @example
 * // Legacy structure without packages:
 * const oldCase = { hoursRemaining: 50 };
 * const hours = calculateRemainingHours(oldCase); // Returns: 50
 */
function calculateRemainingHours(entity) {
  // Validation: null/undefined guard
  if (!entity) {
    return 0;
  }

  // ✅ NEW: Support for legal_procedure with stages
  // If this is a legal procedure, sum hours from all active stages
  if (entity.type === 'legal_procedure' && entity.stages && Array.isArray(entity.stages)) {
    return entity.stages
      .filter(stage => stage.status === 'active' || stage.status === 'pending')
      .reduce((sum, stage) => {
        // Each stage can have packages
        if (stage.packages && Array.isArray(stage.packages) && stage.packages.length > 0) {
          const stageHours = stage.packages
            .filter(pkg => pkg.status === 'active' || pkg.status === 'pending' || !pkg.status)
            .reduce((pkgSum, pkg) => pkgSum + (pkg.hoursRemaining || 0), 0);
          return sum + stageHours;
        }
        // Fallback to stage.hoursRemaining
        return sum + (stage.hoursRemaining || 0);
      }, 0);
  }

  // Regular service with packages
  if (entity.packages && Array.isArray(entity.packages) && entity.packages.length > 0) {
    const activePackages = entity.packages
      .filter(pkg => pkg.status === 'active' || !pkg.status);
    if (activePackages.length > 0) {
      return activePackages.reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
    }
    // fallback — no active packages, read from service level
    return entity.hoursRemaining || 0;
  }

  // Fallback to legacy structure
  return entity.hoursRemaining || 0;
}

/**
 * Calculate total hours from all packages
 *
 * @param {Object} entity - Service or stage with packages
 * @returns {number} Total hours purchased
 */
function calculateTotalHours(entity) {
  if (!entity || !entity.packages || entity.packages.length === 0) {
    return entity.totalHours || 0;
  }

  return entity.packages.reduce((sum, pkg) => sum + (pkg.hours || 0), 0);
}

/**
 * Calculate hours used across all packages
 *
 * @param {Object} entity - Service or stage with packages
 * @returns {number} Total hours used
 */
function calculateHoursUsed(entity) {
  if (!entity || !entity.packages || entity.packages.length === 0) {
    return entity.hoursUsed || 0;
  }

  return entity.packages.reduce((sum, pkg) => sum + (pkg.hoursUsed || 0), 0);
}

/**
 * Calculate progress percentage
 *
 * @param {Object} entity - Service or stage
 * @returns {number} Progress percentage (0-100)
 */
function calculateProgress(entity) {
  const total = calculateTotalHours(entity);
  if (total === 0) {
return 0;
}

  const used = calculateHoursUsed(entity);
  return Math.round((used / total) * 100 * 10) / 10;
}

/**
 * Convert minutes to hours
 *
 * @param {number} minutes - Minutes to convert
 * @param {number} [decimals=2] - Decimal places
 * @returns {number} Hours
 */
function minutesToHours(minutes, decimals = 2) {
  return Math.round((minutes / 60) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convert hours to minutes
 *
 * @param {number} hours - Hours to convert
 * @returns {number} Minutes
 */
function hoursToMinutes(hours) {
  return Math.round(hours * 60);
}

/**
 * Format hours for display
 *
 * @param {number} hours - Hours to format
 * @param {boolean} [showMinutes=false] - Show minutes part
 * @returns {string} Formatted string
 */
function formatHours(hours, showMinutes = false) {
  if (!hours || hours === 0) {
return '0 שעות';
}

  if (showMinutes) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) {
return `${h} שעות`;
}
    return `${h}:${m.toString().padStart(2, '0')} שעות`;
  }

  return `${hours.toFixed(1)} שעות`;
}

// Exports - CommonJS (for Node.js / Firebase Functions)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateRemainingHours,
    calculateTotalHours,
    calculateHoursUsed,
    calculateProgress,
    minutesToHours,
    hoursToMinutes,
    formatHours
  };
}

// ES6 Export (for modern browsers)
export {
  calculateRemainingHours,
  calculateTotalHours,
  calculateHoursUsed,
  calculateProgress,
  minutesToHours,
  hoursToMinutes,
  formatHours
};
