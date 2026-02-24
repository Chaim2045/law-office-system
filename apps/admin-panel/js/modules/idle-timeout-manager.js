/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔒 IDLE TIMEOUT MANAGER - Auto Logout System
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📅 Created: 2025-01-17
 * 🎯 Version: 1.0.0
 * 📦 Purpose: Automatic logout after inactivity (like banks/government sites)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🎯 FEATURES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. ✅ Activity Detection - Monitors user interactions
 * 2. ✅ Idle Timer - Counts time since last activity
 * 3. ✅ Warning System - Shows alert before logout
 * 4. ✅ Auto Logout - Forces logout after timeout
 * 5. ✅ Multi-Tab Sync - Logout affects all tabs
 * 6. ✅ Throttling - Prevents performance issues
 * 7. ✅ Cleanup - Proper resource management
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ⚙️ DEFAULT SETTINGS:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * - Idle Timeout: 10 minutes (600,000ms)
 * - Warning Time: 5 minutes (300,000ms)
 * - Total Time: 15 minutes before forced logout
 * - Check Interval: 60 seconds (efficient)
 * - Activity Throttle: 5 seconds (performance)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 📊 USAGE EXAMPLE:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ```javascript
 * const idleManager = new IdleTimeoutManager({
 *   idleTimeout: 10 * 60 * 1000,      // 10 minutes
 *   warningTimeout: 5 * 60 * 1000,    // 5 minutes
 *   onWarning: (remainingSeconds) => {
 *     showWarningModal(remainingSeconds);
 *   },
 *   onLogout: async () => {
 *     await performLogout();
 *   }
 * });
 *
 * idleManager.start(); // Start monitoring
 * ```
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  /**
   * Activity events to monitor
   * אירועים שמסמנים פעילות משתמש
   */
  const ACTIVITY_EVENTS = [
    'mousedown',   // Mouse click
    'mousemove',   // Mouse movement (throttled)
    'keypress',    // Keyboard input
    'scroll',      // Page scroll (throttled)
    'touchstart',  // Touch screen
    'click',       // Click events
    'wheel'        // Mouse wheel
  ];

  /**
   * IdleTimeoutManager Class
   * מנהל התנתקות אוטומטית
   */
  class IdleTimeoutManager {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {number} options.idleTimeout - Time before warning (ms) - default 10 minutes
     * @param {number} options.warningTimeout - Time from warning to logout (ms) - default 5 minutes
     * @param {number} options.checkInterval - How often to check (ms) - default 60 seconds
     * @param {Function} options.onWarning - Callback when warning shown
     * @param {Function} options.onLogout - Callback when logout triggered
     * @param {boolean} options.enabled - Enable/disable the manager - default true
     */
    constructor(options = {}) {
      // Configuration
      this.idleTimeout = options.idleTimeout || 10 * 60 * 1000;        // 10 minutes
      this.warningTimeout = options.warningTimeout || 5 * 60 * 1000;   // 5 minutes
      this.checkInterval = options.checkInterval || 60 * 1000;         // 1 minute
      this.activityThrottle = options.activityThrottle || 5000;        // 5 seconds
      this.enabled = options.enabled !== false;                        // Default true

      // State
      this.lastActivityTime = Date.now();
      this.warningShown = false;
      this.isActive = false;

      // Timers
      this.timers = {
        check: null,      // Periodic check timer
        warning: null,    // Warning countdown timer
        logout: null      // Logout timer
      };

      // Callbacks
      this.onWarning = options.onWarning || this.defaultWarningHandler.bind(this);
      this.onLogout = options.onLogout || this.defaultLogoutHandler.bind(this);

      // Bound handlers (for proper cleanup)
      this.boundActivityHandler = this.throttle(
        () => this.resetActivity(),
        this.activityThrottle
      );
      this.boundStorageHandler = this.handleStorageEvent.bind(this);
      this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);

      Logger.log('✅ [IdleTimeoutManager] Initialized', {
        idleTimeout: this.idleTimeout / 1000 / 60 + ' minutes',
        warningTimeout: this.warningTimeout / 1000 / 60 + ' minutes',
        totalTimeout: (this.idleTimeout + this.warningTimeout) / 1000 / 60 + ' minutes',
        enabled: this.enabled
      });
    }

    /**
     * Start monitoring user activity
     * התחל לעקוב אחרי פעילות משתמש
     */
    start() {
      if (!this.enabled) {
        Logger.log('[IdleTimeoutManager] Disabled - not starting');
        return;
      }

      if (this.isActive) {
        Logger.log('[IdleTimeoutManager] Already active');
        return;
      }

      this.isActive = true;
      this.lastActivityTime = Date.now();
      this.warningShown = false;

      // Setup activity listeners
      this.setupActivityListeners();

      // Setup multi-tab sync
      this.setupMultiTabSync();

      // Setup visibility change handler
      this.setupVisibilityHandler();

      // Start periodic idle check
      this.startIdleCheck();

      Logger.log('✅ [IdleTimeoutManager] Started monitoring');
    }

    /**
     * Stop monitoring (cleanup)
     * עצור מעקב (ניקוי)
     */
    stop() {
      if (!this.isActive) {
        return;
      }

      this.cleanup();
      this.isActive = false;

      Logger.log('✅ [IdleTimeoutManager] Stopped monitoring');
    }

    /**
     * Reset activity timer
     * אפס טיימר פעילות
     */
    resetActivity() {
      if (!this.isActive) {
        return;
      }

      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActivityTime;

      // Only log if significant time passed (avoid spam)
      if (timeSinceLastActivity > 30000) { // 30 seconds
        Logger.log(`[IdleTimeoutManager] Activity detected (was idle for ${Math.floor(timeSinceLastActivity / 1000)}s)`);
      }

      this.lastActivityTime = now;

      // If warning was shown, hide it
      if (this.warningShown) {
        this.hideWarning();
        this.warningShown = false;
      }
    }

    /**
     * Setup activity event listeners
     * הגדרת מאזיני אירועי פעילות
     */
    setupActivityListeners() {
      ACTIVITY_EVENTS.forEach(event => {
        document.addEventListener(event, this.boundActivityHandler, {
          passive: true,
          capture: false
        });
      });

      Logger.log('[IdleTimeoutManager] Activity listeners setup', {
        events: ACTIVITY_EVENTS
      });
    }

    /**
     * Setup multi-tab synchronization
     * הגדרת סנכרון בין טאבים
     */
    setupMultiTabSync() {
      // Listen for logout events from other tabs
      window.addEventListener('storage', this.boundStorageHandler);

      Logger.log('[IdleTimeoutManager] Multi-tab sync enabled');
    }

    /**
     * Setup page visibility handler
     * הגדרת מעקב אחרי נראות דף
     */
    setupVisibilityHandler() {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);

      Logger.log('[IdleTimeoutManager] Visibility handler enabled');
    }

    /**
     * Handle storage events (multi-tab sync)
     * טיפול באירועי storage (סנכרון בין טאבים)
     */
    handleStorageEvent(event) {
      // If another tab logged out, reload this tab
      if (event.key === 'logoutEvent') {
        Logger.log('[IdleTimeoutManager] Logout detected in another tab - reloading');
        setTimeout(() => location.reload(), 100);
      }

      // If another tab had activity, sync it
      if (event.key === 'lastActivity') {
        const otherTabActivity = parseInt(event.newValue);
        if (otherTabActivity > this.lastActivityTime) {
          Logger.log('[IdleTimeoutManager] Activity detected in another tab - syncing');
          this.lastActivityTime = otherTabActivity;
          if (this.warningShown) {
            this.hideWarning();
            this.warningShown = false;
          }
        }
      }
    }

    /**
     * Handle page visibility changes
     * טיפול בשינויי נראות דף
     */
    handleVisibilityChange() {
      if (!document.hidden) {
        // User returned to tab - consider it activity
        Logger.log('[IdleTimeoutManager] Tab became visible - resetting activity');
        this.resetActivity();
      }
    }

    /**
     * Start periodic idle check
     * התחל בדיקה מחזורית
     */
    startIdleCheck() {
      this.timers.check = setInterval(() => {
        this.checkIdleStatus();
      }, this.checkInterval);

      Logger.log(`[IdleTimeoutManager] Idle check started (every ${this.checkInterval / 1000}s)`);
    }

    /**
     * Check current idle status
     * בדוק מצב idle נוכחי
     */
    checkIdleStatus() {
      if (!this.isActive) {
        return;
      }

      const now = Date.now();
      const idleTime = now - this.lastActivityTime;
      const totalTimeout = this.idleTimeout + this.warningTimeout;

      // Debug log (only every 5 minutes to avoid spam)
      if (Math.floor(idleTime / 60000) % 5 === 0 && idleTime % 60000 < this.checkInterval) {
        Logger.log(`[IdleTimeoutManager] Idle time: ${Math.floor(idleTime / 60000)} minutes`);
      }

      // Time's up - logout!
      if (idleTime >= totalTimeout) {
        Logger.log('⏰ [IdleTimeoutManager] Timeout reached - performing logout');
        this.performLogout();
        return;
      }

      // Show warning
      if (idleTime >= this.idleTimeout && !this.warningShown) {
        const remainingTime = Math.ceil((totalTimeout - idleTime) / 1000);
        Logger.log(`⚠️ [IdleTimeoutManager] Showing warning (${remainingTime}s remaining)`);
        this.showWarning(remainingTime);
        this.warningShown = true;
      }

      // Update warning countdown if shown
      if (this.warningShown) {
        const remainingTime = Math.ceil((totalTimeout - idleTime) / 1000);
        this.updateWarningCountdown(remainingTime);
      }
    }

    /**
     * Show warning modal
     * הצג התראת אזהרה
     */
    showWarning(remainingSeconds) {
      try {
        this.onWarning(remainingSeconds);
      } catch (error) {
        console.error('[IdleTimeoutManager] Error in onWarning callback:', error);
      }
    }

    /**
     * Update warning countdown
     * עדכן ספירה לאחור באזהרה
     */
    updateWarningCountdown(remainingSeconds) {
      // Dispatch event for UI to update countdown
      window.dispatchEvent(new CustomEvent('idle:countdown', {
        detail: { remainingSeconds }
      }));
    }

    /**
     * Hide warning modal
     * הסתר התראת אזהרה
     */
    hideWarning() {
      // Dispatch event for UI to hide warning
      window.dispatchEvent(new CustomEvent('idle:warning-hide'));
    }

    /**
     * Perform logout
     * בצע התנתקות
     */
    async performLogout() {
      Logger.log('🚪 [IdleTimeoutManager] Performing auto-logout');

      // Stop monitoring
      this.cleanup();

      try {
        // Call logout callback
        await this.onLogout();
      } catch (error) {
        console.error('[IdleTimeoutManager] Error during logout:', error);
        // Force logout anyway
        if (window.manager && typeof window.manager.confirmLogout === 'function') {
          await window.manager.confirmLogout();
        } else if (firebase && firebase.auth()) {
          await firebase.auth().signOut();
          location.reload();
        }
      }
    }

    /**
     * Cleanup all timers and listeners
     * נקה את כל הטיימרים והמאזינים
     */
    cleanup() {
      // Clear all timers
      Object.values(this.timers).forEach(timer => {
        if (timer) {
          clearInterval(timer);
        }
      });
      this.timers = { check: null, warning: null, logout: null };

      // Remove activity listeners
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, this.boundActivityHandler);
      });

      // Remove storage listener
      window.removeEventListener('storage', this.boundStorageHandler);

      // Remove visibility listener
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);

      Logger.log('✅ [IdleTimeoutManager] Cleanup complete');
    }

    /**
     * Throttle utility function
     * פונקציית throttle למניעת ביצועים כבדים
     *
     * @param {Function} func - Function to throttle
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, delay) {
      let lastCall = 0;
      return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          func(...args);
        }
      };
    }

    /**
     * Default warning handler
     * מטפל ברירת מחדל להתראה
     */
    defaultWarningHandler(remainingSeconds) {
      console.warn(`⚠️ [IdleTimeoutManager] Warning: ${remainingSeconds}s until logout`);
    }

    /**
     * Default logout handler
     * מטפל ברירת מחדל להתנתקות
     */
    async defaultLogoutHandler() {
      console.warn('🚪 [IdleTimeoutManager] Auto-logout triggered');
      if (firebase && firebase.auth()) {
        await firebase.auth().signOut();
        location.reload();
      }
    }

    /**
     * Get current status
     * קבלת מצב נוכחי
     */
    getStatus() {
      const now = Date.now();
      const idleTime = now - this.lastActivityTime;

      return {
        isActive: this.isActive,
        enabled: this.enabled,
        idleTime: idleTime,
        idleMinutes: Math.floor(idleTime / 60000),
        warningShown: this.warningShown,
        remainingUntilWarning: Math.max(0, this.idleTimeout - idleTime),
        remainingUntilLogout: Math.max(0, (this.idleTimeout + this.warningTimeout) - idleTime)
      };
    }

    /**
     * Broadcast activity to other tabs
     * שידור פעילות לטאבים אחרים
     */
    broadcastActivity() {
      try {
        localStorage.setItem('lastActivity', this.lastActivityTime.toString());
        // Clean up after 1 second
        setTimeout(() => {
          try {
            localStorage.removeItem('lastActivity');
          } catch (e) {
            // Ignore errors
          }
        }, 1000);
      } catch (error) {
        // Ignore localStorage errors (private mode, etc.)
      }
    }
  }

  // Export to window
  window.IdleTimeoutManager = IdleTimeoutManager;

  Logger.log('✅ [IdleTimeoutManager] Module loaded successfully');

})();
