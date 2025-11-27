/**
 * ========================================
 * Unified Loading Overlay System
 * ========================================
 *
 * מערכת טעינה מאוחדת עבור כל האפליקציה
 * תואמת לשתי המערכות: Main App + Master Admin Panel
 *
 * @version 1.0.0
 * @date 2025-01-27
 * @module UnifiedLoadingOverlay
 *
 * ========================================
 * תכונות:
 * ========================================
 *
 * ✅ תמיכה ב-Lottie (אוטומטי אם זמין)
 * ✅ Fallback ל-CSS spinner
 * ✅ ללא מסגרת לבנה סביב הטקסט! (פתרון הבעיה המקורית)
 * ✅ תואם לשתי האפליקציות
 * ✅ Type-safe API
 * ✅ Performance monitoring
 * ✅ Auto-timeout protection
 *
 * ========================================
 * איך להשתמש:
 * ========================================
 *
 * const loader = new UnifiedLoadingOverlay();
 *
 * // הצגת loading
 * loader.show('שומר נתונים...', {
 *   animationType: 'saving',
 *   timeout: 5000
 * });
 *
 * // הסתרת loading
 * loader.hide();
 *
 * // עדכון הודעה
 * loader.updateMessage('כמעט סיימתי...');
 */

(function() {
  'use strict';

  /**
   * UnifiedLoadingOverlay Class
   * מחלקה מרכזית לניהול overlay טעינה
   */
  class UnifiedLoadingOverlay {
    constructor(options = {}) {
      // Configuration
      this.options = {
        useLottie: options.useLottie !== false, // Default: true
        container: options.container || document.body,
        defaultAnimation: options.defaultAnimation || 'loading',
        defaultTimeout: options.defaultTimeout || 30000, // 30 seconds
        removeFrame: options.removeFrame !== false, // Default: true (no white frame!)
        zIndex: options.zIndex || 99999
      };

      // State
      this.overlay = null;
      this.lottieInstance = null;
      this.currentTimeout = null;
      this.isVisible = false;
      this.startTime = null;

      // Helpers
      this.debugLog = window.SharedUIHelpers?.debugLog || console.log.bind(console);

      // Initialize
      this.init();
    }

    /**
     * Initialize loading overlay
     * אתחול מערכת הטעינה
     */
    init() {
      this.debugLog('🔄 Initializing UnifiedLoadingOverlay...');

      // Check if already exists
      if (document.getElementById('unified-loading-overlay')) {
        this.overlay = document.getElementById('unified-loading-overlay');
        this.debugLog('♻️ Using existing overlay element');
        return;
      }

      // Create overlay element
      this.overlay = document.createElement('div');
      this.overlay.id = 'unified-loading-overlay';
      this.overlay.className = 'unified-loading-overlay';
      this.overlay.style.display = 'none';
      this.overlay.style.zIndex = this.options.zIndex;

      // Add to container
      this.options.container.appendChild(this.overlay);

      this.debugLog('✅ UnifiedLoadingOverlay initialized', {
        useLottie: this.options.useLottie,
        removeFrame: this.options.removeFrame,
        defaultTimeout: this.options.defaultTimeout
      });
    }

    /**
     * Show loading overlay
     * הצגת overlay טעינה
     *
     * @param {string} message - הודעה להציג
     * @param {Object} options - אפשרויות
     * @param {string} options.animationType - סוג אנימציה ('loading', 'saving', 'syncing', 'uploading')
     * @param {number} options.timeout - זמן מקסימלי (ms), 0 = ללא timeout
     * @param {Function} options.onTimeout - callback כאשר מגיע ל-timeout
     * @returns {void}
     */
    show(message = 'טוען...', options = {}) {
      this.debugLog('📤 Showing loading overlay', { message, options });

      // Mark start time
      this.startTime = Date.now();

      // Configuration
      const animationType = options.animationType || this.options.defaultAnimation;
      const timeout = options.timeout !== undefined ? options.timeout : this.options.defaultTimeout;
      const onTimeout = options.onTimeout || null;

      // Check if Lottie is available
      const hasLottie = typeof window.lottie !== 'undefined' && this.options.useLottie;

      // Build HTML
      this.overlay.innerHTML = this.buildHTML(message, hasLottie);

      // Show overlay
      this.overlay.style.display = 'flex';
      this.isVisible = true;

      // Load Lottie animation (if available)
      if (hasLottie) {
        this.loadLottie(animationType);
      }

      // Setup auto-hide timeout (if specified)
      if (timeout > 0) {
        this.currentTimeout = setTimeout(() => {
          this.debugLog('⏰ Loading timeout reached', { duration: timeout });

          // Trigger callback
          if (onTimeout) {
            onTimeout();
          }

          // Auto-hide
          this.hide();

          // Show warning in console
          console.warn(
            `[UnifiedLoadingOverlay] ⚠️ Loading exceeded timeout (${timeout}ms).\n` +
            `Message: "${message}"`
          );
        }, timeout);
      }

      this.debugLog('✅ Loading overlay shown', {
        message,
        animationType,
        usesLottie: hasLottie,
        timeout: timeout || 'none'
      });
    }

    /**
     * Build HTML for loading overlay
     * בניית HTML
     *
     * @param {string} message - Message text
     * @param {boolean} hasLottie - Whether Lottie is available
     * @returns {string} HTML string
     */
    buildHTML(message, hasLottie) {
      return `
        <div class="unified-loading-content">
          <div class="unified-loading-spinner" id="unified-loading-spinner">
            ${hasLottie
              ? '<div id="unified-lottie-container"></div>'
              : '<div class="unified-css-spinner"></div>'
            }
          </div>
          <div class="unified-loading-message">${this.escapeHTML(message)}</div>
        </div>
      `;
    }

    /**
     * Load Lottie animation
     * טעינת אנימציית Lottie
     *
     * @param {string} animationType - Animation type
     */
    loadLottie(animationType) {
      // Get animation URL from LottieAnimations (if available)
      const animations = window.LottieAnimations || {};
      const animationUrl = animations[animationType] || animations.loading;

      if (!animationUrl) {
        this.debugLog('⚠️ Lottie animation not found, using CSS fallback', { animationType });
        return;
      }

      const container = document.getElementById('unified-lottie-container');

      if (!container) {
        this.debugLog('⚠️ Lottie container not found');
        return;
      }

      // Destroy previous instance
      if (this.lottieInstance) {
        this.lottieInstance.destroy();
        this.lottieInstance = null;
      }

      try {
        // Load animation
        this.lottieInstance = window.lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: animationUrl
        });

        this.debugLog('✅ Lottie animation loaded', {
          type: animationType,
          url: animationUrl
        });
      } catch (error) {
        console.error('[UnifiedLoadingOverlay] Failed to load Lottie animation:', error);
        this.debugLog('❌ Lottie failed, showing CSS fallback');

        // Show CSS fallback
        container.innerHTML = '<div class="unified-css-spinner"></div>';
      }
    }

    /**
     * Hide loading overlay
     * הסתרת overlay
     */
    hide() {
      if (!this.isVisible) {
        this.debugLog('ℹ️ Loading already hidden');
        return;
      }

      // Calculate duration
      const duration = this.startTime ? Date.now() - this.startTime : 0;

      this.debugLog('📥 Hiding loading overlay', {
        duration: `${duration}ms`
      });

      // Hide overlay
      this.overlay.style.display = 'none';
      this.isVisible = false;

      // Clear timeout
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
        this.currentTimeout = null;
      }

      // Destroy Lottie instance
      if (this.lottieInstance) {
        try {
          this.lottieInstance.destroy();
        } catch (error) {
          console.error('[UnifiedLoadingOverlay] Error destroying Lottie:', error);
        }
        this.lottieInstance = null;
      }

      // Clear content (prevent memory leaks)
      this.overlay.innerHTML = '';

      this.debugLog('✅ Loading overlay hidden', {
        totalDuration: `${duration}ms`
      });
    }

    /**
     * Update loading message
     * עדכון הודעת הטעינה
     *
     * @param {string} message - New message
     */
    updateMessage(message) {
      if (!this.isVisible) {
        this.debugLog('⚠️ Cannot update message - overlay not visible');
        return;
      }

      const messageElement = this.overlay.querySelector('.unified-loading-message');

      if (messageElement) {
        messageElement.textContent = message;
        this.debugLog('✅ Message updated', { message });
      } else {
        this.debugLog('⚠️ Message element not found');
      }
    }

    /**
     * Check if loading is visible
     * בדיקה אם ה-loading מוצג
     *
     * @returns {boolean}
     */
    isShown() {
      return this.isVisible;
    }

    /**
     * Get loading duration
     * קבלת משך זמן התצוגה
     *
     * @returns {number} Duration in milliseconds
     */
    getDuration() {
      if (!this.startTime) {
        return 0;
      }
      return Date.now() - this.startTime;
    }

    /**
     * Escape HTML to prevent XSS
     * מניעת XSS
     *
     * @param {string} text - Text to escape
     * @returns {string}
     */
    escapeHTML(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Destroy the overlay completely
     * הרס מוחלט של ה-overlay
     */
    destroy() {
      this.debugLog('🗑️ Destroying UnifiedLoadingOverlay');

      this.hide();

      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }

      this.overlay = null;
      this.lottieInstance = null;
      this.currentTimeout = null;

      this.debugLog('✅ UnifiedLoadingOverlay destroyed');
    }
  }

  // ========================================
  // Export to Global Scope
  // ========================================

  window.UnifiedLoadingOverlay = UnifiedLoadingOverlay;

  // ========================================
  // Auto-initialization (if config says so)
  // ========================================

  if (window.SHARED_UI_CONFIG?.USE_SHARED_LOADING) {
    const debugLog = window.SharedUIHelpers?.debugLog || console.log.bind(console);
    debugLog('✅ UnifiedLoadingOverlay module loaded and ready');
  }

})();
