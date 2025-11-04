/**
אז * API Client v2 - Modern Firebase Functions Wrapper
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 12/10/2025
 * גרסה: 2.0.0
 *
 * תכונות:
 * - TypeScript-friendly עם JSDoc מלא
 * - Error handling מתקדם
 * - Retry mechanism עם exponential backoff
 * - Loading states אוטומטיים
 * - Cache אופציונלי
 * - Rate limiting detection
 */

(function() {
  'use strict';

  /* === Configuration === */
  const API_CONFIG = {
    // URL של Firebase Functions (מ-deployment)
    BASE_URL: 'https://legacyrouter-ypsyjaboga-uc.a.run.app',

    // Timeouts
    TIMEOUT_MS: 30000,

    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    RETRY_BACKOFF_MULTIPLIER: 2,

    // Cache settings
    ENABLE_CACHE: false,
    CACHE_TTL_MS: 60000, // 1 minute

    // Debug
    DEBUG: false // כבוי למצב פרודקשן
  };

  /* === Helper: Logger === */
  const logger = {
    log: (...args) => {
      if (API_CONFIG.DEBUG) {
        console.log('[API Client v2]', ...args);
      }
    },
    error: (...args) => {
      console.error('[API Client v2 ERROR]', ...args);
    },
    warn: (...args) => {
      console.warn('[API Client v2 WARN]', ...args);
    }
  };

  /* === Helper: Cache Manager === */
  class CacheManager {
    constructor() {
      this.cache = new Map();
    }

    set(key, value, ttl = API_CONFIG.CACHE_TTL_MS) {
      const expiresAt = Date.now() + ttl;
      this.cache.set(key, { value, expiresAt });
    }

    get(key) {
      const cached = this.cache.get(key);
      if (!cached) return null;

      if (Date.now() > cached.expiresAt) {
        this.cache.delete(key);
        return null;
      }

      return cached.value;
    }

    clear() {
      this.cache.clear();
    }

    invalidate(pattern) {
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    }
  }

  /* === Main: FirebaseFunctionsClient === */
  /**
   * @class FirebaseFunctionsClient
   * @description Wrapper מודרני ל-Firebase Functions
   */
  class FirebaseFunctionsClient {
    constructor(config = {}) {
      this.config = { ...API_CONFIG, ...config };
      this.cache = new CacheManager();
      this.activeRequests = 0;
    }

    /**
     * קריאה כללית ל-Firebase Function
     * @param {string} action - שם הפעולה (testConnection, getClients, וכו')
     * @param {Object} data - נתונים לשליחה
     * @param {Object} options - אופציות נוספות
     * @returns {Promise<Object>}
     */
    async call(action, data = null, options = {}) {
      const {
        useCache = false,
        cacheTTL = this.config.CACHE_TTL_MS,
        showLoading = true,
        retries = this.config.MAX_RETRIES
      } = options;

      // בדיקת cache
      if (useCache && this.config.ENABLE_CACHE) {
        const cacheKey = this._getCacheKey(action, data);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // הצגת loading
      if (showLoading) {
        this._showLoading();
      }

      try {
        this.activeRequests++;

        const result = await this._fetchWithRetry(action, data, retries);

        // שמירה ב-cache
        if (useCache && this.config.ENABLE_CACHE) {
          const cacheKey = this._getCacheKey(action, data);
          this.cache.set(cacheKey, result, cacheTTL);
        }

        return result;

      } catch (error) {
        logger.error(`Action ${action} failed:`, error);
        this._handleError(error, action);
        throw error;
      } finally {
        this.activeRequests--;
        if (showLoading && this.activeRequests === 0) {
          this._hideLoading();
        }
      }
    }

    /**
     * Fetch עם retry mechanism
     * @private
     */
    async _fetchWithRetry(action, data, maxRetries) {
      let lastError;
      let delay = this.config.RETRY_DELAY_MS;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await this._fetch(action, data);
        } catch (error) {
          lastError = error;

          // אל תעשה retry על שגיאות קבועות
          if (this._isNonRetryableError(error)) {
            throw error;
          }

          // אם זה הניסיון האחרון - זרוק שגיאה
          if (attempt === maxRetries) {
            throw error;
          }

          // חכה לפני ניסיון נוסף (exponential backoff)
          await this._sleep(delay);
          delay *= this.config.RETRY_BACKOFF_MULTIPLIER;
        }
      }

      throw lastError;
    }

    /**
     * Fetch בסיסי
     * @private
     */
    async _fetch(action, data) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.TIMEOUT_MS);

      try {
        const response = await fetch(this.config.BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action, data }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // בדיקת status code
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        // בדיקת תוצאה
        if (!result.success) {
          throw new Error(result.error || 'Unknown error from server');
        }

        return result.data;

      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.TIMEOUT_MS}ms`);
        }

        throw error;
      }
    }

    /**
     * בדיקה האם שגיאה לא ראויה ל-retry
     * @private
     */
    _isNonRetryableError(error) {
      const message = error.message || '';

      // שגיאות validation, authentication - לא לעשות retry
      if (message.includes('400') || message.includes('401') || message.includes('403')) {
        return true;
      }

      // Rate limiting - לא לעשות retry
      if (message.includes('429') || message.includes('rate limit')) {
        return true;
      }

      return false;
    }

    /**
     * Cache key generation
     * @private
     */
    _getCacheKey(action, data) {
      return `${action}:${JSON.stringify(data || {})}`;
    }

    /**
     * Sleep helper
     * @private
     */
    _sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * הצגת loading
     * @private
     */
    _showLoading() {
      if (typeof showLoadingMessage === 'function') {
        showLoadingMessage('טוען מהשרת...');
      }
    }

    /**
     * הסתרת loading
     * @private
     */
    _hideLoading() {
      if (typeof hideLoadingMessage === 'function') {
        hideLoadingMessage();
      }
    }

    /**
     * טיפול בשגיאות
     * @private
     */
    _handleError(error, action) {
      let userMessage = 'שגיאה בחיבור לשרת';

      if (error.message.includes('timeout')) {
        userMessage = 'החיבור לשרת התארך מדי - נסה שוב';
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        userMessage = 'יותר מדי בקשות - המתן מספר שניות ונסה שוב';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        userMessage = 'אין הרשאה לבצע פעולה זו';
      } else if (error.message.includes('400')) {
        userMessage = 'נתונים לא תקינים';
      }

      if (typeof showMessage === 'function') {
        showMessage(userMessage, 'error');
      }
    }

    /* === Specific API Methods === */

    /**
     * בדיקת חיבור לשרת
     * @returns {Promise<Object>}
     */
    async testConnection() {
      return await this.call('testConnection', null, { showLoading: false });
    }

    /**
     * טעינת לקוחות
     * @param {boolean} useCache - להשתמש ב-cache?
     * @returns {Promise<Array>}
     */
    async getClients(useCache = true) {
      return await this.call('getClients', null, {
        useCache,
        cacheTTL: 5 * 60 * 1000 // 5 דקות
      });
    }

    /**
     * יצירת לקוח חדש
     * @param {Object} clientData - נתוני לקוח
     * @returns {Promise<Object>}
     */
    async createClient(clientData) {
      const result = await this.call('createClientComplete', clientData);

      // אחרי יצירה - נקה cache של לקוחות
      this.cache.invalidate('getClients');

      return result;
    }

    /**
     * שמירת שעתון ועדכון שעות לקוח
     * @param {Object} entryData - נתוני רשומת שעתון
     * @returns {Promise<Object>}
     */
    async saveTimesheetAndUpdateClient(entryData) {
      const result = await this.call('saveTimesheetAndUpdateClient', entryData);

      // נקה cache רלוונטי
      this.cache.invalidate('getClients');
      this.cache.invalidate('getTimesheetEntries');

      return result;
    }

    /**
     * טעינת משימות תקצוב
     * @param {string} employee - שם העובד
     * @param {boolean} useCache - להשתמש ב-cache?
     * @returns {Promise<Array>}
     */
    async getBudgetTasks(employee, useCache = false) {
      return await this.call('getBudgetTasks', { employee }, { useCache });
    }

    /**
     * שמירת משימת תקצוב
     * @param {Object} taskData - נתוני משימה
     * @returns {Promise<Object>}
     */
    async saveBudgetTask(taskData) {
      const result = await this.call('saveBudgetTask', taskData);

      // נקה cache של משימות
      this.cache.invalidate('getBudgetTasks');

      return result;
    }

    /**
     * טעינת רשומות שעתון
     * @param {string} employee - שם העובד
     * @returns {Promise<Array>}
     */
    async getTimesheetEntries(employee) {
      return await this.call('getTimesheetEntries', { employee });
    }

    /**
     * עדכון רשומת שעתון
     * @param {string} entryId - מזהה רשומה
     * @param {Object} updates - עדכונים
     * @returns {Promise<Object>}
     */
    async updateTimesheetEntry(entryId, updates) {
      const result = await this.call('updateTimesheetEntry', { entryId, updates });

      // נקה cache רלוונטי
      this.cache.invalidate('getTimesheetEntries');
      this.cache.invalidate('getClients');

      return result;
    }

    /**
     * הוספת זמן למשימה
     * @param {string} taskId - מזהה משימה
     * @param {number} hours - מספר שעות
     * @returns {Promise<Object>}
     */
    async addTimeToTask(taskId, hours) {
      return await this.call('addTimeToTask', { taskId, hours });
    }

    /**
     * סיום משימה
     * @param {string} taskId - מזהה משימה
     * @returns {Promise<Object>}
     */
    async completeTask(taskId) {
      const result = await this.call('completeTask', { taskId });

      // נקה cache של משימות
      this.cache.invalidate('getBudgetTasks');

      return result;
    }

    /**
     * עדכון שעות לקוח
     * @param {string} clientName - שם לקוח
     * @param {number} usedHours - שעות מנוצלות
     * @returns {Promise<Object>}
     */
    async updateClientHours(clientName, usedHours) {
      const result = await this.call('updateClientHours', { clientName, usedHours });

      // נקה cache של לקוחות
      this.cache.invalidate('getClients');

      return result;
    }

    /**
     * חישוב שעות לקוח
     * @param {string} clientName - שם לקוח
     * @returns {Promise<number>}
     */
    async calculateClientHours(clientName) {
      return await this.call('calculateClientHours', { clientName });
    }

    /**
     * טעינת רשומות שעתון עם pagination (Server-side)
     * @param {string} employee - שם העובד
     * @param {number} limit - מספר רשומות לעמוד (1-100, default: 20)
     * @param {string|null} startAfter - ID של המסמך האחרון מהעמוד הקודם
     * @returns {Promise<{data: Array, count: number, hasMore: boolean, lastDocId: string|null}>}
     */
    async getTimesheetPaginated(employee, limit = 20, startAfter = null) {
      const result = await this.call('getTimesheetPaginated', {
        employee,
        limit,
        startAfter
      });

      return {
        data: result.data || [],
        count: result.count || 0,
        hasMore: result.hasMore || false,
        lastDocId: result.lastDocId || null
      };
    }

    /**
     * טעינת משימות תקצוב עם pagination (Server-side)
     * @param {string} employee - שם העובד
     * @param {number} limit - מספר משימות לעמוד (1-100, default: 20)
     * @param {string|null} startAfter - ID של המסמך האחרון מהעמוד הקודם
     * @param {string} filter - פילטר: 'active', 'completed', 'all' (default: 'active')
     * @returns {Promise<{data: Array, count: number, hasMore: boolean, lastDocId: string|null, filter: string}>}
     */
    async getBudgetTasksPaginated(employee, limit = 20, startAfter = null, filter = 'active') {
      const result = await this.call('getBudgetTasksPaginated', {
        employee,
        limit,
        startAfter,
        filter
      });

      return {
        data: result.data || [],
        count: result.count || 0,
        hasMore: result.hasMore || false,
        lastDocId: result.lastDocId || null,
        filter: result.filter || 'active'
      };
    }

    /* === Utility Methods === */

    /**
     * ניקוי כל ה-cache
     */
    clearCache() {
      this.cache.clear();
    }

    /**
     * ניקוי cache ספציפי
     * @param {string} pattern - דפוס לחיפוש
     */
    invalidateCache(pattern) {
      this.cache.invalidate(pattern);
    }

    /**
     * קבלת מצב ה-client
     * @returns {Object}
     */
    getStatus() {
      return {
        baseURL: this.config.BASE_URL,
        activeRequests: this.activeRequests,
        cacheSize: this.cache.cache.size,
        config: this.config
      };
    }
  }

  /* === Global Export === */
  window.FirebaseFunctionsClientV2 = {
    FirebaseFunctionsClient,
    CacheManager,
    API_CONFIG,

    /**
     * יצירת instance חדש
     * @param {Object} config - תצורה מותאמת אישית
     * @returns {FirebaseFunctionsClient}
     */
    create(config = {}) {
      return new FirebaseFunctionsClient(config);
    }
  };


})();
