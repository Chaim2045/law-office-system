/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lazy Loader - Dynamic Script Loading Utility
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description טעינה דינמית של סקריפטים - שיפור ביצועים
 * @version 1.0.0
 * @created 2025-12-11
 *
 * @features
 * - טעינה אסינכרונית של סקריפטים
 * - מניעת טעינה כפולה (caching)
 * - טיפול בשגיאות
 * - תמיכה ב-versioning
 * - Progress tracking
 */

'use strict';

/**
 * @class LazyLoader
 * @description מערכת טעינה דינמית של סקריפטים
 */
class LazyLoader {
  constructor() {
    // Cache של סקריפטים שכבר נטענו
    this.loadedScripts = new Set();
    this.loadingPromises = new Map();
  }

  /**
   * טעינת סקריפט בודד
   * @param {string} src - נתיב הסקריפט
   * @param {Object} options - אפשרויות טעינה
   * @returns {Promise<void>}
   */
  loadScript(src, options = {}) {
    const {
      version = null,
      type = 'text/javascript',
      async = true,
      defer = false
    } = options;

    // בדיקה אם הסקריפט כבר נטען
    const scriptKey = version ? `${src}?v=${version}` : src;

    if (this.loadedScripts.has(scriptKey)) {
      console.log(`[LazyLoader] ✓ Script already loaded: ${scriptKey}`);
      return Promise.resolve();
    }

    // בדיקה אם הסקריפט בתהליך טעינה
    if (this.loadingPromises.has(scriptKey)) {
      console.log(`[LazyLoader] ⏳ Script loading in progress: ${scriptKey}`);
      return this.loadingPromises.get(scriptKey);
    }

    // יצירת Promise לטעינה
    const loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptKey;
      script.type = type;
      script.async = async;
      script.defer = defer;

      script.onload = () => {
        console.log(`[LazyLoader] ✅ Script loaded: ${scriptKey}`);
        this.loadedScripts.add(scriptKey);
        this.loadingPromises.delete(scriptKey);
        resolve();
      };

      script.onerror = (error) => {
        console.error(`[LazyLoader] ❌ Failed to load script: ${scriptKey}`, error);
        this.loadingPromises.delete(scriptKey);
        reject(new Error(`Failed to load script: ${scriptKey}`));
      };

      document.head.appendChild(script);
    });

    this.loadingPromises.set(scriptKey, loadPromise);
    return loadPromise;
  }

  /**
   * טעינת מספר סקריפטים במקביל
   * @param {Array<string|Object>} scripts - רשימת סקריפטים
   * @returns {Promise<void>}
   */
  async loadScripts(scripts) {
    const promises = scripts.map(script => {
      if (typeof script === 'string') {
        return this.loadScript(script);
      } else {
        return this.loadScript(script.src, script.options || {});
      }
    });

    return Promise.all(promises);
  }

  /**
   * טעינת סקריפטים ברצף (אחד אחרי השני)
   * @param {Array<string|Object>} scripts - רשימת סקריפטים
   * @returns {Promise<void>}
   */
  async loadScriptsSequentially(scripts) {
    for (const script of scripts) {
      if (typeof script === 'string') {
        await this.loadScript(script);
      } else {
        await this.loadScript(script.src, script.options || {});
      }
    }
  }

  /**
   * בדיקה אם סקריפט נטען
   * @param {string} src - נתיב הסקריפט
   * @returns {boolean}
   */
  isLoaded(src) {
    return this.loadedScripts.has(src);
  }

  /**
   * איפוס ה-cache (לבדיקות בלבד)
   */
  reset() {
    this.loadedScripts.clear();
    this.loadingPromises.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export to global scope
// ═══════════════════════════════════════════════════════════════════════════
window.LazyLoader = LazyLoader;
window.lazyLoader = new LazyLoader();

console.log('[LazyLoader] ✅ Initialized and ready');
