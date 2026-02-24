/**
 * Data Cache Module
 * Advanced caching system with Stale-While-Revalidate pattern
 *
 * Features:
 * - Stale-While-Revalidate: Return cached data immediately, refresh in background
 * - TTL (Time To Live): Configurable expiration time
 * - Multiple storage backends: Memory or localStorage
 * - Statistics tracking: Hits, misses, revalidations
 * - Manual invalidation: Clear specific or all cached data
 * - Error resilient: Graceful degradation on failures
 *
 * @author Claude Code
 * @version 1.0.0
 * @created 2025-01-26
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} data - The cached data
 * @property {number} timestamp - When the data was cached (ms)
 * @property {number} expiresAt - When the data expires (ms)
 * @property {boolean} isStale - Whether the data is stale but still usable
 */

/**
 * @typedef {Object} CacheOptions
 * @property {number} [maxAge=300000] - Maximum age in milliseconds (default: 5 minutes)
 * @property {boolean} [staleWhileRevalidate=true] - Use stale-while-revalidate pattern
 * @property {number} [staleAge=600000] - Maximum stale age (default: 10 minutes)
 * @property {'memory'|'localStorage'} [storage='memory'] - Storage backend
 * @property {Function} [onError] - Error callback function
 * @property {boolean} [debug=false] - Enable debug logging
 * @property {string} [namespace='dataCache'] - Namespace for localStorage keys
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} hits - Number of cache hits
 * @property {number} misses - Number of cache misses
 * @property {number} revalidations - Number of background revalidations
 * @property {number} errors - Number of errors encountered
 * @property {number} size - Current cache size (number of entries)
 * @property {number} hitRate - Cache hit rate percentage (0-100)
 */

class DataCache {
  /**
   * Create a new DataCache instance
   * @param {CacheOptions} options - Configuration options
   */
  constructor(options = {}) {
    // Configuration
    this.maxAge = options.maxAge || 5 * 60 * 1000; // 5 minutes default
    this.staleWhileRevalidate = options.staleWhileRevalidate !== false;
    this.staleAge = options.staleAge || 10 * 60 * 1000; // 10 minutes default
    this.storage = options.storage || 'memory';
    this.onError = options.onError || ((error) => console.error('[DataCache]', error));
    this.debug = options.debug || false;
    this.namespace = options.namespace || 'dataCache';

    // Memory storage
    this.cache = new Map();

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      revalidations: 0,
      errors: 0
    };

    // Pending revalidations (to avoid duplicate fetches)
    this.pendingRevalidations = new Map();

    // Initialize localStorage support
    if (this.storage === 'localStorage' && !this._isLocalStorageAvailable()) {
      this._log('warn', 'localStorage not available, falling back to memory');
      this.storage = 'memory';
    }

    this._log('info', 'DataCache initialized', {
      maxAge: this.maxAge,
      staleAge: this.staleAge,
      storage: this.storage,
      staleWhileRevalidate: this.staleWhileRevalidate
    });
  }

  /**
   * Get data from cache or fetch it
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if not cached (must return Promise)
   * @param {Object} [options] - Override options for this specific request
   * @param {number} [options.maxAge] - Override maxAge for this request
   * @param {boolean} [options.force] - Force fresh fetch, bypass cache
   * @returns {Promise<*>} The cached or fetched data
   */
  async get(key, fetchFunction, options = {}) {
    if (!key || typeof key !== 'string') {
      throw new Error('[DataCache] Key must be a non-empty string');
    }

    if (typeof fetchFunction !== 'function') {
      throw new Error('[DataCache] fetchFunction must be a function');
    }

    // Force fresh fetch?
    if (options.force) {
      this._log('info', `Force fetch for key: ${key}`);
      return await this._fetchAndCache(key, fetchFunction);
    }

    const now = Date.now();
    const entry = this._getEntry(key);

    // Cache miss - no data at all
    if (!entry) {
      this.stats.misses++;
      this._log('info', `Cache MISS for key: ${key}`);
      return await this._fetchAndCache(key, fetchFunction);
    }

    const maxAge = options.maxAge || this.maxAge;
    const age = now - entry.timestamp;
    const isFresh = age < maxAge;
    const isStale = age >= maxAge && age < (maxAge + this.staleAge);
    const isExpired = age >= (maxAge + this.staleAge);

    // Completely expired - fetch fresh
    if (isExpired) {
      this.stats.misses++;
      this._log('info', `Cache EXPIRED for key: ${key} (age: ${age}ms)`);
      return await this._fetchAndCache(key, fetchFunction);
    }

    // Fresh data - return immediately
    if (isFresh) {
      this.stats.hits++;
      this._log('info', `Cache HIT (fresh) for key: ${key} (age: ${age}ms)`);
      return entry.data;
    }

    // Stale data - use Stale-While-Revalidate
    if (isStale && this.staleWhileRevalidate) {
      this.stats.hits++;
      this._log('info', `Cache HIT (stale) for key: ${key} (age: ${age}ms) - revalidating in background`);

      // Return stale data immediately
      const staleData = entry.data;

      // Revalidate in background (non-blocking)
      this._revalidateInBackground(key, fetchFunction);

      return staleData;
    }

    // Fallback: fetch fresh
    this.stats.misses++;
    return await this._fetchAndCache(key, fetchFunction);
  }

  /**
   * Fetch data and cache it
   * @private
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data
   * @returns {Promise<*>} The fetched data
   */
  async _fetchAndCache(key, fetchFunction) {
    try {
      const data = await fetchFunction();
      this._setEntry(key, data);
      return data;
    } catch (error) {
      this.stats.errors++;
      this._log('error', `Error fetching data for key: ${key}`, error);
      this.onError(error);
      throw error;
    }
  }

  /**
   * Revalidate data in background
   * @private
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data
   */
  _revalidateInBackground(key, fetchFunction) {
    // Avoid duplicate revalidations
    if (this.pendingRevalidations.has(key)) {
      this._log('debug', `Revalidation already in progress for key: ${key}`);
      return;
    }

    this.stats.revalidations++;

    const revalidationPromise = (async () => {
      try {
        this._log('debug', `Starting background revalidation for key: ${key}`);
        const freshData = await fetchFunction();
        this._setEntry(key, freshData);
        this._log('debug', `Background revalidation complete for key: ${key}`);
      } catch (error) {
        this.stats.errors++;
        this._log('error', `Background revalidation failed for key: ${key}`, error);
        this.onError(error);
      } finally {
        this.pendingRevalidations.delete(key);
      }
    })();

    this.pendingRevalidations.set(key, revalidationPromise);
  }

  /**
   * Get cache entry
   * @private
   * @param {string} key - Cache key
   * @returns {CacheEntry|null} Cache entry or null
   */
  _getEntry(key) {
    if (this.storage === 'memory') {
      return this.cache.get(key) || null;
    }

    if (this.storage === 'localStorage') {
      try {
        const item = localStorage.getItem(this._getStorageKey(key));
        return item ? JSON.parse(item) : null;
      } catch (error) {
        this._log('error', 'Error reading from localStorage', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Set cache entry
   * @private
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   */
  _setEntry(key, data) {
    const now = Date.now();
    const entry = {
      data,
      timestamp: now,
      expiresAt: now + this.maxAge
    };

    if (this.storage === 'memory') {
      this.cache.set(key, entry);
    }

    if (this.storage === 'localStorage') {
      try {
        localStorage.setItem(this._getStorageKey(key), JSON.stringify(entry));
      } catch (error) {
        this._log('error', 'Error writing to localStorage', error);
        this.stats.errors++;
        // Fallback to memory
        this.cache.set(key, entry);
      }
    }

    this._log('debug', `Cached data for key: ${key}`);
  }

  /**
   * Invalidate (remove) a specific cache entry
   * @param {string} key - Cache key to invalidate
   * @returns {boolean} True if entry was found and removed
   */
  invalidate(key) {
    this._log('info', `Invalidating cache for key: ${key}`);

    let found = false;

    if (this.storage === 'memory') {
      found = this.cache.delete(key);
    }

    if (this.storage === 'localStorage') {
      const storageKey = this._getStorageKey(key);
      found = localStorage.getItem(storageKey) !== null;
      localStorage.removeItem(storageKey);
    }

    // Cancel pending revalidation
    if (this.pendingRevalidations.has(key)) {
      this.pendingRevalidations.delete(key);
    }

    return found;
  }

  /**
   * Clear all cache entries
   * @returns {number} Number of entries cleared
   */
  clear() {
    this._log('info', 'Clearing all cache entries');

    let count = 0;

    if (this.storage === 'memory') {
      count = this.cache.size;
      this.cache.clear();
    }

    if (this.storage === 'localStorage') {
      const keys = Object.keys(localStorage);
      const prefix = this._getStorageKey('');

      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
          count++;
        }
      });
    }

    // Clear pending revalidations
    this.pendingRevalidations.clear();

    return count;
  }

  /**
   * Get cache statistics
   * @returns {CacheStats} Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? Math.round((this.stats.hits / totalRequests) * 100)
      : 0;

    return {
      ...this.stats,
      size: this.storage === 'memory' ? this.cache.size : this._getLocalStorageSize(),
      hitRate
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      revalidations: 0,
      errors: 0
    };
    this._log('info', 'Statistics reset');
  }

  /**
   * Get localStorage key with namespace
   * @private
   * @param {string} key - Original key
   * @returns {string} Namespaced key
   */
  _getStorageKey(key) {
    return `${this.namespace}:${key}`;
  }

  /**
   * Get number of cache entries in localStorage
   * @private
   * @returns {number} Number of entries
   */
  _getLocalStorageSize() {
    const keys = Object.keys(localStorage);
    const prefix = this._getStorageKey('');
    return keys.filter(key => key.startsWith(prefix)).length;
  }

  /**
   * Check if localStorage is available
   * @private
   * @returns {boolean} True if available
   */
  _isLocalStorageAvailable() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Log message (respects debug mode)
   * @private
   * @param {'info'|'warn'|'error'|'debug'} level - Log level
   * @param {string} message - Log message
   * @param {*} [data] - Optional data to log
   */
  _log(level, message, data) {
    if (!this.debug && level === 'debug') {
return;
}

    const prefix = '[DataCache]';
    const timestamp = new Date().toISOString();

    if (data) {
      console[level === 'debug' ? 'log' : level](`${prefix} ${timestamp} ${message}`, data);
    } else {
      console[level === 'debug' ? 'log' : level](`${prefix} ${timestamp} ${message}`);
    }
  }
}

// Export for ES6 modules
export default DataCache;

// Export for CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataCache;
}

// Global export for browser
if (typeof window !== 'undefined') {
  window.DataCache = DataCache;
}
