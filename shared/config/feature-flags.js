/**
 * ========================================
 * Unified UI System - Feature Flags
 * ========================================
 *
 * מערכת Feature Flags לאינטגרציה הדרגתית
 * עוקבת אחר הדפוס הקיים בפרויקט (USE_FIREBASE_PAGINATION וכו')
 *
 * @version 1.0.0
 * @date 2025-01-27
 * @module SharedUIConfig
 *
 * ========================================
 * איך להשתמש:
 * ========================================
 *
 * 1. התחלה (safe mode):
 *    USE_SHARED_LOADING: false
 *    → המערכת הישנה ממשיכה לעבוד בדיוק כמו קודם
 *
 * 2. בדיקה:
 *    USE_SHARED_LOADING: true
 *    → המערכת החדשה מופעלת (ניתן לחזור אחורה!)
 *
 * 3. Rollback אם יש בעיה:
 *    ROLLBACK_TO_LEGACY: true
 *    → חזרה מיידית למערכת הישנה
 */

(function() {
  'use strict';

  const SHARED_UI_CONFIG = {
    // ========================================
    // Feature Flags - מתגים לתכונות
    // ========================================

    /**
     * Loading Overlay System
     * מערכת טעינה מאוחדת
     * ברירת מחדל: false (בטוח!)
     */
    USE_SHARED_LOADING: false,

    /**
     * Notifications System
     * מערכת התראות מאוחדת
     * ברירת מחדל: false (בטוח!)
     */
    USE_SHARED_NOTIFICATIONS: false,

    /**
     * Modals System
     * מערכת דיאלוגים מאוחדת
     * ברירת מחדל: false (בטוח!)
     */
    USE_SHARED_MODALS: false,

    // ========================================
    // Emergency Rollback
    // ========================================

    /**
     * Emergency rollback switch
     * כפתור חירום - חזרה למערכת הישנה
     *
     * אם משהו השתבש:
     * 1. שנה ל-true
     * 2. רענן דף (Ctrl+Shift+R)
     * 3. המערכת הישנה חזרה!
     */
    ROLLBACK_TO_LEGACY: false,

    // ========================================
    // Debug Mode
    // ========================================

    /**
     * Debug logging
     * הצגת לוגים מפורטים בקונסול
     */
    DEBUG_SHARED_UI: true,

    /**
     * Show warnings for deprecated APIs
     * הצגת אזהרות על שימוש ב-API ישן
     */
    SHOW_DEPRECATION_WARNINGS: false,

    // ========================================
    // Performance Options
    // ========================================

    /**
     * Animation duration (ms)
     * משך זמן אנימציות
     */
    ANIMATION_DURATION: 300,

    /**
     * Auto-hide loading after timeout (ms)
     * הסתרה אוטומטית של loading אחרי timeout
     * 0 = disabled
     */
    LOADING_TIMEOUT: 30000, // 30 seconds

    // ========================================
    // Lottie Configuration
    // ========================================

    /**
     * Use Lottie animations (if available)
     * שימוש באנימציות Lottie
     */
    USE_LOTTIE: true,

    /**
     * Lottie fallback to CSS
     * אם Lottie לא זמין, השתמש ב-CSS spinner
     */
    LOTTIE_FALLBACK_TO_CSS: true,

    // ========================================
    // Styling Options
    // ========================================

    /**
     * Remove white frame from loading text
     * הסרת מסגרת לבנה סביב טקסט הטעינה
     * (זו הבעיה המקורית שתיקנו!)
     */
    REMOVE_LOADING_FRAME: true,

    /**
     * Overlay background color
     * צבע רקע של ה-overlay
     */
    OVERLAY_BACKGROUND: 'rgba(0, 0, 0, 0.5)',

    /**
     * Overlay backdrop blur
     * טשטוש רקע
     */
    OVERLAY_BLUR: '4px',

    // ========================================
    // Version Info
    // ========================================

    VERSION: '1.0.0',
    BUILD_DATE: '2025-01-27',
    COMPATIBLE_WITH: {
      mainApp: '2.x',
      masterAdminPanel: '3.x'
    }
  };

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * Check if feature is enabled
   * @param {string} featureName - Feature flag name
   * @returns {boolean}
   */
  function isFeatureEnabled(featureName) {
    if (SHARED_UI_CONFIG.ROLLBACK_TO_LEGACY) {
      return false; // Emergency rollback - disable all new features
    }
    return SHARED_UI_CONFIG[featureName] === true;
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   * @param {any} data - Additional data
   */
  function debugLog(message, data) {
    if (SHARED_UI_CONFIG.DEBUG_SHARED_UI) {
      if (data !== undefined) {
        console.log(`[SharedUI] ${message}`, data);
      } else {
        console.log(`[SharedUI] ${message}`);
      }
    }
  }

  /**
   * Show deprecation warning
   * @param {string} oldAPI - Old API name
   * @param {string} newAPI - New API name
   */
  function deprecationWarning(oldAPI, newAPI) {
    if (SHARED_UI_CONFIG.SHOW_DEPRECATION_WARNINGS) {
      console.warn(
        `[SharedUI] ⚠️ Deprecation Warning:\n` +
        `  "${oldAPI}" is deprecated.\n` +
        `  Please use "${newAPI}" instead.`
      );
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Config key
   * @returns {any}
   */
  function getConfig(key) {
    return SHARED_UI_CONFIG[key];
  }

  /**
   * Set configuration value (runtime override)
   * @param {string} key - Config key
   * @param {any} value - New value
   */
  function setConfig(key, value) {
    debugLog(`Config changed: ${key} = ${value}`);
    SHARED_UI_CONFIG[key] = value;
  }

  // ========================================
  // Export to Global Scope
  // ========================================

  window.SHARED_UI_CONFIG = SHARED_UI_CONFIG;

  window.SharedUIHelpers = {
    isFeatureEnabled,
    debugLog,
    deprecationWarning,
    getConfig,
    setConfig
  };

  // ========================================
  // Initialization Log
  // ========================================

  debugLog('✅ Feature Flags loaded', {
    USE_SHARED_LOADING: SHARED_UI_CONFIG.USE_SHARED_LOADING,
    USE_SHARED_NOTIFICATIONS: SHARED_UI_CONFIG.USE_SHARED_NOTIFICATIONS,
    USE_SHARED_MODALS: SHARED_UI_CONFIG.USE_SHARED_MODALS,
    ROLLBACK_TO_LEGACY: SHARED_UI_CONFIG.ROLLBACK_TO_LEGACY,
    VERSION: SHARED_UI_CONFIG.VERSION
  });

  // Show status in console
  if (SHARED_UI_CONFIG.ROLLBACK_TO_LEGACY) {
    console.warn('🚨 [SharedUI] EMERGENCY ROLLBACK MODE - Using legacy systems');
  } else if (!SHARED_UI_CONFIG.USE_SHARED_LOADING &&
             !SHARED_UI_CONFIG.USE_SHARED_NOTIFICATIONS &&
             !SHARED_UI_CONFIG.USE_SHARED_MODALS) {
    console.log('🔵 [SharedUI] All features disabled - Using legacy systems (default)');
  } else {
    console.log('✅ [SharedUI] New features enabled:', {
      loading: SHARED_UI_CONFIG.USE_SHARED_LOADING,
      notifications: SHARED_UI_CONFIG.USE_SHARED_NOTIFICATIONS,
      modals: SHARED_UI_CONFIG.USE_SHARED_MODALS
    });
  }

})();
