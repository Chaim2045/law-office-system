/**
 * ========================================
 * Lottie Manager
 * ========================================
 * מנהל מרכזי לטעינת וניהול אנימציות Lottie
 *
 * ✅ Caching - מטמון לאנימציות שנטענו
 * ✅ Error handling - טיפול בשגיאות וfallback
 * ✅ Preloading - טעינה מוקדמת של אנימציות נפוצות
 * ✅ Performance - מעקב אחר ביצועים
 * ✅ Memory management - ניהול זיכרון וניקוי
 *
 * @version 1.0.0
 * @date 2025-01-13
 * @module LottieManager
 */

/**
 * ========================================
 * LottieManager Class
 * ========================================
 */

class LottieManager {
  constructor() {
    /**
     * Cache של אנימציות שנטענו
     * @type {Map<string, Object>}
     */
    this.cache = new Map();

    /**
     * אנימציות פעילות כרגע
     * @type {Map<string, Object>}
     */
    this.activeAnimations = new Map();

    /**
     * סטטיסטיקות טעינה
     * @type {Object}
     */
    this.stats = {
      totalLoaded: 0,
      totalFailed: 0,
      cacheHits: 0,
      averageLoadTime: 0,
      errors: []
    };

    /**
     * האם Lottie library זמינה
     * @type {boolean}
     */
    this.lottieAvailable = typeof lottie !== 'undefined';

    if (!this.lottieAvailable) {
      console.warn('⚠️ Lottie library not found. Animations will use CSS fallback.');
    }

    // Log initialization
    if (typeof Logger !== 'undefined') {
      Logger.log('✅ LottieManager initialized');
      Logger.log(`📦 Lottie library ${this.lottieAvailable ? 'available' : 'NOT available'}`);
    }
  }

  /**
   * ========================================
   * Main Methods
   * ========================================
   */

  /**
   * Load and play Lottie animation
   * @param {string} type - Animation type (from LottieAnimations)
   * @param {HTMLElement} container - Container element for animation
   * @param {Object} options - Animation options
   * @param {boolean} options.loop - Loop animation (default: true)
   * @param {boolean} options.autoplay - Auto-play animation (default: true)
   * @param {string} options.renderer - Renderer type ('svg', 'canvas', 'html') (default: 'svg')
   * @param {number} options.speed - Animation speed (default: 1)
   * @returns {Promise<Object|null>} Animation instance or null if failed
   */
  async load(type, container, options = {}) {
    // Validate inputs
    if (!type) {
      console.error('❌ LottieManager.load: type is required');
      return null;
    }

    if (!container) {
      console.error('❌ LottieManager.load: container is required');
      return null;
    }

    // Check if Lottie library is available
    if (!this.lottieAvailable) {
      this._showFallback(container);
      return null;
    }

    // Get animation URL
    const animationUrl = window.LottieHelpers?.getAnimationUrl(type);
    if (!animationUrl) {
      console.error(`❌ LottieManager.load: Unknown animation type: ${type}`);
      this._showFallback(container);
      return null;
    }

    // Check cache - but destroy old animation if container changed
    const cacheKey = `${type}_${container.id || 'default'}`;
    if (this.cache.has(cacheKey)) {
      const cachedAnimation = this.cache.get(cacheKey);

      // ✅ Check if cached animation's container is still in DOM
      // If not, destroy it and create a new one
      if (cachedAnimation && cachedAnimation.wrapper && cachedAnimation.wrapper.parentNode) {
        this.stats.cacheHits++;
        if (typeof Logger !== 'undefined') {
          Logger.log(`📦 [LottieManager] Cache hit: ${type}`);
        }
        return cachedAnimation;
      } else {
        // Container was removed - clean up cache
        if (typeof Logger !== 'undefined') {
          Logger.log(`🔄 [LottieManager] Cache invalid (container removed), reloading: ${type}`);
        }
        this.cache.delete(cacheKey);
        this.activeAnimations.delete(cacheKey);
        // Continue to load new animation below
      }
    }

    // Default options
    const defaultOptions = {
      loop: true,
      autoplay: true,
      renderer: 'svg',
      speed: 1
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Track load time
    const startTime = performance.now();

    try {
      // Load animation
      const animation = lottie.loadAnimation({
        container: container,
        renderer: finalOptions.renderer,
        loop: finalOptions.loop,
        autoplay: finalOptions.autoplay,
        path: animationUrl
      });

      // Set speed if specified
      if (finalOptions.speed !== 1) {
        animation.setSpeed(finalOptions.speed);
      }

      // Handle errors
      animation.addEventListener('data_failed', () => {
        this._handleLoadError(type, container, 'Failed to load animation data');
      });

      // Cache animation
      this.cache.set(cacheKey, animation);
      this.activeAnimations.set(cacheKey, animation);

      // Update stats
      const loadTime = performance.now() - startTime;
      this._updateStats(true, loadTime);

      if (typeof Logger !== 'undefined') {
        Logger.log(`✅ [LottieManager] Loaded: ${type} (${loadTime.toFixed(1)}ms)`);
      }

      return animation;

    } catch (error) {
      this._handleLoadError(type, container, error.message);
      this._updateStats(false);
      return null;
    }
  }

  /**
   * ========================================
   * Animation Control Methods
   * ========================================
   */

  /**
   * Stop and destroy animation
   * @param {string} type - Animation type
   * @param {HTMLElement} container - Container element
   */
  destroy(type, container) {
    const cacheKey = `${type}_${container.id || 'default'}`;
    const animation = this.activeAnimations.get(cacheKey);

    if (animation) {
      animation.destroy();
      this.activeAnimations.delete(cacheKey);
      this.cache.delete(cacheKey);

      if (typeof Logger !== 'undefined') {
        Logger.log(`🗑️ [LottieManager] Destroyed: ${type}`);
      }
    }
  }

  /**
   * Pause animation
   * @param {string} type - Animation type
   * @param {HTMLElement} container - Container element
   */
  pause(type, container) {
    const cacheKey = `${type}_${container.id || 'default'}`;
    const animation = this.activeAnimations.get(cacheKey);

    if (animation) {
      animation.pause();
    }
  }

  /**
   * Play animation
   * @param {string} type - Animation type
   * @param {HTMLElement} container - Container element
   */
  play(type, container) {
    const cacheKey = `${type}_${container.id || 'default'}`;
    const animation = this.activeAnimations.get(cacheKey);

    if (animation) {
      animation.play();
    }
  }

  /**
   * Stop animation
   * @param {string} type - Animation type
   * @param {HTMLElement} container - Container element
   */
  stop(type, container) {
    const cacheKey = `${type}_${container.id || 'default'}`;
    const animation = this.activeAnimations.get(cacheKey);

    if (animation) {
      animation.stop();
    }
  }

  /**
   * Set animation speed
   * @param {string} type - Animation type
   * @param {HTMLElement} container - Container element
   * @param {number} speed - Speed multiplier (1 = normal, 2 = 2x, 0.5 = half)
   */
  setSpeed(type, container, speed) {
    const cacheKey = `${type}_${container.id || 'default'}`;
    const animation = this.activeAnimations.get(cacheKey);

    if (animation && typeof speed === 'number') {
      animation.setSpeed(speed);
    }
  }

  /**
   * ========================================
   * Preloading Methods
   * ========================================
   */

  /**
   * Preload animations for faster display
   * @param {Array<string>} types - Animation types to preload (default: common ones)
   * @returns {Promise<void>}
   */
  async preload(types = ['loading', 'saving', 'successSimple']) {
    if (!this.lottieAvailable) {
      console.warn('⚠️ Lottie not available, skipping preload');
      return;
    }

    if (typeof Logger !== 'undefined') {
      Logger.log(`📦 [LottieManager] Preloading ${types.length} animations...`);
    }

    const preloadPromises = types.map(type => {
      // Create hidden container
      const tempContainer = document.createElement('div');
      tempContainer.style.display = 'none';
      tempContainer.id = `preload-${type}-${Date.now()}`;
      document.body.appendChild(tempContainer);

      // Load animation
      return this.load(type, tempContainer, { autoplay: false })
        .then(() => {
          // Clean up
          document.body.removeChild(tempContainer);
        })
        .catch(error => {
          console.error(`Failed to preload ${type}:`, error);
          if (tempContainer.parentElement) {
            document.body.removeChild(tempContainer);
          }
        });
    });

    await Promise.all(preloadPromises);

    if (typeof Logger !== 'undefined') {
      Logger.log(`✅ [LottieManager] Preload completed (${this.cache.size} cached)`);
    }
  }

  /**
   * ========================================
   * Cleanup Methods
   * ========================================
   */

  /**
   * Destroy all active animations
   */
  destroyAll() {
    this.activeAnimations.forEach((animation, key) => {
      animation.destroy();
    });

    this.activeAnimations.clear();
    this.cache.clear();

    if (typeof Logger !== 'undefined') {
      Logger.log('🗑️ [LottieManager] All animations destroyed');
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.stats.cacheHits = 0;

    if (typeof Logger !== 'undefined') {
      Logger.log('🗑️ [LottieManager] Cache cleared');
    }
  }

  /**
   * ========================================
   * Statistics & Debugging Methods
   * ========================================
   */

  /**
   * Get performance statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      activeAnimations: this.activeAnimations.size,
      lottieAvailable: this.lottieAvailable
    };
  }

  /**
   * Print statistics to console
   */
  printStats() {
    console.log('📊 [LottieManager] Statistics:');
    console.table(this.getStats());
  }

  /**
   * ========================================
   * Private Methods
   * ========================================
   */

  /**
   * Update statistics
   * @private
   * @param {boolean} success - Whether load was successful
   * @param {number} loadTime - Load time in ms
   */
  _updateStats(success, loadTime = 0) {
    if (success) {
      this.stats.totalLoaded++;

      // Update average load time
      const total = this.stats.totalLoaded;
      const currentAvg = this.stats.averageLoadTime;
      this.stats.averageLoadTime = (currentAvg * (total - 1) + loadTime) / total;

    } else {
      this.stats.totalFailed++;
    }
  }

  /**
   * Handle load error
   * @private
   * @param {string} type - Animation type
   * @param {HTMLElement} container - Container element
   * @param {string} errorMessage - Error message
   */
  _handleLoadError(type, container, errorMessage) {
    console.error(`❌ [LottieManager] Failed to load animation: ${type}`, errorMessage);

    // Store error
    this.stats.errors.push({
      type,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });

    // Show fallback
    this._showFallback(container);
  }

  /**
   * Show CSS fallback spinner
   * @private
   * @param {HTMLElement} container - Container element
   */
  _showFallback(container) {
    if (!container) {
return;
}

    // Add fallback class
    container.classList.add('lottie-fallback');

    // Insert CSS spinner
    if (window.LottieFallback) {
      container.innerHTML = window.LottieFallback.cssSpinner;

      // Inject CSS if not already injected
      if (!document.getElementById('lottie-fallback-styles')) {
        const style = document.createElement('style');
        style.id = 'lottie-fallback-styles';
        style.textContent = window.LottieFallback.cssStyles;
        document.head.appendChild(style);
      }
    }

    if (typeof Logger !== 'undefined') {
      Logger.log('⚠️ [LottieManager] Using CSS fallback');
    }
  }
}

/**
 * ========================================
 * Create Global Instance
 * ========================================
 */

const lottieManager = new LottieManager();

/**
 * ========================================
 * Export to Global Scope
 * ========================================
 */

if (typeof window !== 'undefined') {
  window.LottieManager = lottieManager;

  // Log success
  if (typeof Logger !== 'undefined') {
    Logger.log('✅ LottieManager ready');
  }
}

// ✅ Global access via window.LottieManager (defined above)
