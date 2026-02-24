/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔒 SECURE LOGGER - Production Ready v2.0.0
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📅 Created: Original
 * 📅 Last Update: 2025-01-08
 * 🎯 Version: 2.0.0 (Security Enhanced)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔧 CHANGES IN v2.0.0:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ✅ ADDED: Auto-detection of Production/Development environment
 * ✅ ADDED: Data sanitization (hides sensitive fields)
 * ✅ ADDED: Timestamps on all logs
 * ✅ ENHANCED: Better error handling with stack traces
 * ✅ BACKWARDS COMPATIBLE: All old code still works!
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔒 SECURITY FEATURES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ✅ Auto-hides: passwords, tokens, API keys, phone numbers, ID numbers
 * ✅ Production mode: Minimal console output (performance + security)
 * ✅ Development mode: Full logging with timestamps
 * ✅ Sanitization: Prevents sensitive data leaks in console
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * SecureLogger Class
 * מערכת לוגים מאובטחת עם זיהוי אוטומטי של סביבה
 */
class SecureLogger {
  constructor() {
    // ════════════════════════════════════════════════════════════════
    // AUTO-DETECT ENVIRONMENT (no manual configuration needed!)
    // ════════════════════════════════════════════════════════════════
    const hostname = window.location.hostname;

    this.isProduction = hostname.includes('firebaseapp.com')
                     || hostname.includes('web.app')
                     || hostname.includes('netlify.app');

    this.isDevelopment = hostname === 'localhost'
                      || hostname === '127.0.0.1'
                      || hostname.includes('local');

    // ════════════════════════════════════════════════════════════════
    // SENSITIVE FIELDS - will be hidden in logs
    // ════════════════════════════════════════════════════════════════
    this.sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'phoneNumber',
      'idNumber',
      'email',
      'creditCard',
      'ssn'
    ];

    // Log environment on initialization
    if (!this.isProduction) {
      console.log(`🔧 Logger initialized in ${this.isDevelopment ? 'DEVELOPMENT' : 'STAGING'} mode`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SANITIZATION - Hide sensitive data
  // ════════════════════════════════════════════════════════════════
  sanitize(data) {
    if (!data) {
return data;
}

    // Handle primitives
    if (typeof data !== 'object') {
return data;
}

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    // Handle objects
    const sanitized = {...data};

    this.sensitiveFields.forEach(field => {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '***HIDDEN***';
      }
    });

    return sanitized;
  }

  // ════════════════════════════════════════════════════════════════
  // GET TIMESTAMP
  // ════════════════════════════════════════════════════════════════
  getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  // ════════════════════════════════════════════════════════════════
  // LOG METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * לוג רגיל - מודפס רק במצב פיתוח
   */
  log(message, data = null) {
    if (this.isProduction) {
return;
}

    const timestamp = this.getTimestamp();
    const sanitizedData = this.sanitize(data);

    if (data !== null) {
      console.log(`[${timestamp}] ${message}`, sanitizedData);
    } else {
      console.log(`[${timestamp}] ${message}`);
    }
  }

  /**
   * לוג מידע - מודפס רק במצב פיתוח
   */
  info(message, data = null) {
    if (this.isProduction) {
return;
}

    const timestamp = this.getTimestamp();
    const sanitizedData = this.sanitize(data);

    if (data !== null) {
      console.info(`[${timestamp}] ℹ️ ${message}`, sanitizedData);
    } else {
      console.info(`[${timestamp}] ℹ️ ${message}`);
    }
  }

  /**
   * לוג ניפוי באגים - מודפס רק במצב פיתוח
   */
  debug(message, data = null) {
    if (this.isProduction) {
return;
}

    const timestamp = this.getTimestamp();
    const sanitizedData = this.sanitize(data);

    if (data !== null) {
      console.debug(`[${timestamp}] 🔍 ${message}`, sanitizedData);
    } else {
      console.debug(`[${timestamp}] 🔍 ${message}`);
    }
  }

  /**
   * אזהרה - מודפסת תמיד (גם ב-production)
   */
  warn(message, data = null) {
    const timestamp = this.getTimestamp();
    const sanitizedData = this.sanitize(data);

    if (data !== null) {
      console.warn(`[${timestamp}] ⚠️ ${message}`, sanitizedData);
    } else {
      console.warn(`[${timestamp}] ⚠️ ${message}`);
    }
  }

  /**
   * שגיאה - מודפסת תמיד (גם ב-production)
   */
  error(message, error = null) {
    const timestamp = this.getTimestamp();

    if (error) {
      // If it's an Error object, extract useful info
      if (error instanceof Error) {
        console.error(`[${timestamp}] ❌ ${message}`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      } else {
        // Otherwise sanitize the data
        console.error(`[${timestamp}] ❌ ${message}`, this.sanitize(error));
      }
    } else {
      console.error(`[${timestamp}] ❌ ${message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // MANUAL ENVIRONMENT CONTROL (backwards compatibility)
  // ════════════════════════════════════════════════════════════════

  /**
   * הפעלת מצב פיתוח (ידנית)
   */
  enableDevMode() {
    this.isProduction = false;
    this.isDevelopment = true;
    console.log('🔧 מצב פיתוח הופעל ידנית - לוגים מלאים זמינים');
  }

  /**
   * הפעלת מצב ייצור (ידנית)
   */
  enableProductionMode() {
    this.isProduction = true;
    this.isDevelopment = false;
    console.log('🚀 מצב ייצור הופעל ידנית - לוגים מינימליים בלבד');
  }

  // ════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * קבלת סטטוס הסביבה הנוכחית
   */
  getEnvironment() {
    if (this.isProduction) {
return 'production';
}
    if (this.isDevelopment) {
return 'development';
}
    return 'staging';
  }

  /**
   * בדיקה אם במצב ייצור
   */
  isProductionMode() {
    return this.isProduction;
  }

  /**
   * בדיקה אם במצב פיתוח
   */
  isDevelopmentMode() {
    return this.isDevelopment;
  }
}

// ════════════════════════════════════════════════════════════════
// GLOBAL EXPORTS
// ════════════════════════════════════════════════════════════════

// Create global instance
const loggerInstance = new SecureLogger();

// Main exports (new API)
window.Logger = loggerInstance;
window.logger = loggerInstance;

// Backwards compatibility - old API still works!
window.PRODUCTION_MODE = loggerInstance.isProduction;

// Shortcut functions (backwards compatible)
window.devLog = (message, data) => loggerInstance.log(message, data);
window.devInfo = (message, data) => loggerInstance.info(message, data);
window.devDebug = (message, data) => loggerInstance.debug(message, data);
