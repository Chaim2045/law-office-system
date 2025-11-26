/**
 * Security Configuration Module
 * =============================
 * הגדרות אבטחה מרכזיות למערכת
 *
 * @module SecurityConfig
 * @version 1.0.0
 * @created 2025-11-25
 * @author Law Office System
 *
 * תיאור:
 * ------
 * קובץ הגדרות מרכזי לכל מודולי האבטחה במערכת.
 * מאפשר שליטה מרכזית על כל הגדרות האבטחה ללא צורך בשינוי קוד.
 *
 * שימוש:
 * ------
 * import SECURITY_CONFIG from './config/security-config.js';
 * const idleConfig = SECURITY_CONFIG.idleTimeout;
 */

const SECURITY_CONFIG = {
  // ==========================================
  // Idle Timeout Configuration
  // הגדרות ניתוק אוטומטי בחוסר פעילות
  // ==========================================
  idleTimeout: {
    // הפעלה/כיבוי המודול
    enabled: true, // ✅ מופעל כברירת מחדל

    // זמנים (בדקות - מומר למילישניות במודול)
    warningMinutes: 10,    // 10 דקות עד אזהרה
    logoutMinutes: 15,     // 15 דקות עד ניתוק
    countdownSeconds: 60,  // 60 שניות ספירה לאחור

    // התנהגות
    showWarning: true,     // להציג אזהרה לפני ניתוק
    autoSave: true,        // שמירה אוטומטית לפני ניתוק
    resetOnWarning: true,  // איפוס טיימר בלחיצה על "המשך"

    // נתיבים להתעלמות (לא יפעל בדפים אלו)
    excludePaths: [
      '/login',
      '/reset-password',
      '/forgot-password',
      '/admin/login'
    ],

    // אירועים למעקב
    trackedEvents: [
      'mousedown',
      'mousemove',
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel'
    ],

    // דיבוג
    debug: false // הפעל console.log למעקב
  },

  // ==========================================
  // Session Management Configuration
  // ניהול חיבורים מרובים
  // ==========================================
  sessionManagement: {
    // האם לאכוף חיבור יחיד
    singleSession: false, // 🔄 כרגע כבוי - נפעיל בהמשך

    // מספר חיבורים מקסימלי מותר
    maxSessions: 1,

    // אסטרטגיית פתרון קונפליקט
    conflictResolution: 'ask', // 'ask' | 'force-new' | 'keep-old'

    // זמן תפוגה של session (24 שעות)
    sessionTimeout: 24 * 60 * 60 * 1000,

    // האם להציג היכן המשתמש מחובר
    showActiveDevices: true,

    // האם לאפשר ניתוק מרחוק
    allowRemoteDisconnect: true
  },

  // ==========================================
  // Activity Tracking Configuration
  // מעקב אחר פעילות משתמש
  // ==========================================
  activityTracking: {
    // אילו סוגי פעילות לעקוב
    trackMouse: true,
    trackKeyboard: true,
    trackTouch: true,
    trackScroll: false, // כבוי כי scroll יכול להיות אוטומטי

    // debounce למניעת עומס
    debounceMs: 1000, // עדכון לכל היותר פעם בשנייה

    // שמירת היסטוריה
    saveHistory: true,
    historyLimit: 100 // מקסימום 100 פעולות אחרונות
  },

  // ==========================================
  // UI Configuration
  // הגדרות ממשק משתמש
  // ==========================================
  ui: {
    // Modal אזהרה
    warningModal: {
      show: true,
      backdrop: true,           // רקע כהה
      backdropBlur: true,       // טשטוש הרקע
      animation: 'fade',        // 'fade' | 'slide' | 'zoom'
      position: 'center',       // 'center' | 'top' | 'bottom'
      closeOnBackdrop: false,   // לא לסגור בלחיצה על רקע
      closeOnEsc: false,        // לא לסגור ב-ESC
      theme: 'warning'          // 'warning' | 'danger' | 'info'
    },

    // ספירה לאחור
    countdown: {
      show: true,
      format: 'seconds',        // 'seconds' | 'minutes:seconds'
      showProgressBar: true,    // הצג בר התקדמות
      progressColor: 'danger',  // 'danger' | 'warning' | 'info'
      pulseOnLowTime: true,     // הבהוב כשנשאר מעט זמן
      lowTimeThreshold: 10      // שניות - מתי להתחיל הבהוב
    },

    // הודעות
    notifications: {
      showOnWarning: true,
      showOnLogout: true,
      showOnResume: true,
      position: 'top-center',   // 'top-center' | 'top-right' | 'bottom-center'
      duration: 5000            // משך הצגה במילישניות
    },

    // צלילים
    sounds: {
      enabled: false,           // כבוי כברירת מחדל
      warningSound: '/sounds/warning.mp3',
      logoutSound: '/sounds/logout.mp3',
      volume: 0.5              // 0-1
    }
  },

  // ==========================================
  // Storage Configuration
  // הגדרות אחסון
  // ==========================================
  storage: {
    // מפתחות ל-localStorage
    keys: {
      lastActivity: 'law_office_last_activity',
      sessionId: 'law_office_session_id',
      securityPrefs: 'law_office_security_prefs',
      warningShown: 'law_office_warning_shown',
      autoSavedData: 'law_office_auto_saved'
    },

    // האם לנקות בlogout
    clearOnLogout: true,

    // האם לשמור העדפות משתמש
    saveUserPreferences: true
  },

  // ==========================================
  // Advanced Security Features
  // תכונות אבטחה מתקדמות (עתידי)
  // ==========================================
  advanced: {
    // Two-Factor Authentication
    twoFactor: {
      enabled: false,
      method: 'sms', // 'sms' | 'email' | 'app'
      required: false
    },

    // IP Restrictions
    ipRestrictions: {
      enabled: false,
      whitelist: [],
      blacklist: []
    },

    // Device Trust
    deviceTrust: {
      enabled: false,
      requireApproval: false,
      maxTrustedDevices: 5
    },

    // Session Recording
    sessionRecording: {
      enabled: false,
      recordActions: false,
      recordScreen: false
    },

    // Password Policy
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expiryDays: 90,
      preventReuse: 5
    }
  },

  // ==========================================
  // Feature Flags
  // דגלי תכונות להפעלה הדרגתית
  // ==========================================
  features: {
    // Idle Timeout
    ENABLE_IDLE_TIMEOUT: true,         // ✅ מופעל
    IDLE_TIMEOUT_WARNING_ONLY: false,  // false = גם logout, true = רק warning

    // Session Management
    ENABLE_SESSION_MANAGEMENT: false,  // 🔄 כבוי לעת עתה
    ENABLE_SINGLE_SESSION: false,      // 🔄 כבוי לעת עתה

    // Activity Tracking
    ENABLE_ACTIVITY_TRACKING: true,    // ✅ מופעל

    // Advanced Features
    ENABLE_2FA: false,                 // 🔄 עתידי
    ENABLE_IP_RESTRICTIONS: false,     // 🔄 עתידי
    ENABLE_DEVICE_TRUST: false        // 🔄 עתידי
  },

  // ==========================================
  // Environment Configuration
  // הגדרות לפי סביבה
  // ==========================================
  environment: {
    // זיהוי סביבה אוטומטי
    isDevelopment: window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1',
    isStaging: window.location.hostname.includes('staging'),
    isProduction: window.location.hostname.includes('netlify.app') ||
                  window.location.hostname.includes('law-office'),

    // החלת הגדרות לפי סביבה
    applyEnvironmentSettings() {
      if (this.isDevelopment) {
        // בפיתוח - זמנים קצרים יותר לבדיקה
        SECURITY_CONFIG.idleTimeout.warningMinutes = 2;  // 2 דקות
        SECURITY_CONFIG.idleTimeout.logoutMinutes = 3;   // 3 דקות
        SECURITY_CONFIG.idleTimeout.countdownSeconds = 30; // 30 שניות
        SECURITY_CONFIG.idleTimeout.debug = true;
      } else if (this.isStaging) {
        // בstaging - זמנים בינוניים
        SECURITY_CONFIG.idleTimeout.warningMinutes = 5;  // 5 דקות
        SECURITY_CONFIG.idleTimeout.logoutMinutes = 10;  // 10 דקות
      }
      // בproduction - משתמש בערכי ברירת המחדל (10/15 דקות)
    }
  },

  // ==========================================
  // Helper Methods
  // פונקציות עזר
  // ==========================================

  /**
   * Get idle timeout configuration with milliseconds conversion
   */
  getIdleTimeoutConfig() {
    return {
      ...this.idleTimeout,
      warningTime: this.idleTimeout.warningMinutes * 60 * 1000,
      logoutTime: this.idleTimeout.logoutMinutes * 60 * 1000,
      countdownTime: this.idleTimeout.countdownSeconds
    };
  },

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.features[feature] === true;
  },

  /**
   * Update configuration dynamically
   */
  updateConfig(path, value) {
    const keys = path.split('.');
    let current = this;

    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined) {
        console.error(`Invalid config path: ${path}`);
        return false;
      }
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    console.log(`[SecurityConfig] Updated ${path} to:`, value);
    return true;
  },

  /**
   * Get all enabled features
   */
  getEnabledFeatures() {
    return Object.entries(this.features)
      .filter(([key, value]) => value === true)
      .map(([key]) => key);
  },

  /**
   * Initialize configuration
   */
  init() {
    // Apply environment-specific settings
    this.environment.applyEnvironmentSettings();

    // Log configuration
    console.log('[SecurityConfig] Initialized with settings:', {
      environment: this.environment.isDevelopment ? 'development' :
                  this.environment.isStaging ? 'staging' : 'production',
      idleTimeout: this.idleTimeout.enabled ?
                  `${this.idleTimeout.warningMinutes}/${this.idleTimeout.logoutMinutes} min` :
                  'disabled',
      enabledFeatures: this.getEnabledFeatures()
    });

    return this;
  }
};

// ==========================================
// Initialize on load
// ==========================================
SECURITY_CONFIG.init();

// ==========================================
// Export
// ==========================================
export default SECURITY_CONFIG;

// Also export as named for convenience
export { SECURITY_CONFIG };