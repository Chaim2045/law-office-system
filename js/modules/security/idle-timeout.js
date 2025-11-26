/**
 * Idle Timeout Security Module
 * ============================
 * מודול אבטחה לזיהוי חוסר פעילות וניתוק אוטומטי
 *
 * @module IdleTimeout
 * @version 1.0.0
 * @created 2025-11-25
 * @author Law Office System
 *
 * תכונות:
 * --------
 * - מעקב אחר פעילות משתמש (עכבר, מקלדת, מגע)
 * - הצגת אזהרה לפני ניתוק
 * - ספירה לאחור ויזואלית
 * - שמירה אוטומטית לפני ניתוק
 * - ניתוק אוטומטי מאובטח
 *
 * אינטגרציה:
 * ----------
 * - עובד באופן עצמאי ללא תלויות
 * - משתמש ב-Event Emitter pattern
 * - תומך ב-callbacks חיצוניים
 * - ללא השפעה על קוד קיים
 */

export class IdleTimeoutManager {
  constructor(config = {}) {
    // ==========================================
    // Configuration - ניתן להגדרה מבחוץ
    // ==========================================
    this.config = {
      // הפעלה/כיבוי
      enabled: config.enabled ?? true,

      // זמנים (במילישניות)
      warningTime: config.warningTime ?? 10 * 60 * 1000,     // 10 דקות עד אזהרה
      logoutTime: config.logoutTime ?? 15 * 60 * 1000,       // 15 דקות עד ניתוק
      countdownTime: config.countdownTime ?? 60,             // 60 שניות ספירה לאחור

      // התנהגות
      showWarning: config.showWarning ?? true,                // להציג אזהרה
      autoSave: config.autoSave ?? true,                     // שמירה אוטומטית
      resetOnWarning: config.resetOnWarning ?? true,         // איפוס בלחיצה על המשך

      // נתיבים להתעלמות
      excludePaths: config.excludePaths ?? ['/login', '/reset-password', '/forgot-password'],

      // אירועים למעקב
      trackedEvents: config.trackedEvents ?? [
        'mousedown', 'mousemove', 'keypress', 'keydown',
        'scroll', 'touchstart', 'click', 'wheel'
      ],

      // Callbacks (Dependency Injection)
      onWarning: config.onWarning ?? null,
      onLogout: config.onLogout ?? null,
      onActivity: config.onActivity ?? null,
      onCountdown: config.onCountdown ?? null,

      // דיבוג
      debug: config.debug ?? false
    };

    // ==========================================
    // State Management
    // ==========================================
    this.state = {
      isActive: false,
      isWarningShown: false,
      isPaused: false,
      lastActivity: Date.now(),
      sessionStartTime: Date.now(),
      warningShownAt: null,
      activityCount: 0
    };

    // ==========================================
    // Timers
    // ==========================================
    this.timers = {
      warning: null,
      logout: null,
      countdown: null,
      debounce: null
    };

    // ==========================================
    // Event Listeners Registry
    // ==========================================
    this.listeners = {
      'warning': [],
      'logout': [],
      'activity': [],
      'countdown': [],
      'resume': [],
      'pause': [],
      'reset': []
    };

    // ==========================================
    // DOM Elements Cache
    // ==========================================
    this.elements = {
      warningModal: null,
      countdownDisplay: null,
      overlay: null
    };

    // Bind methods
    this.handleActivity = this.handleActivity.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  // ==========================================
  // Public API
  // ==========================================

  /**
   * Initialize the idle timeout system
   * @returns {IdleTimeoutManager} For method chaining
   */
  init() {
    if (!this.config.enabled) {
      this.log('Module disabled by configuration');
      return this;
    }

    // Check if we should run on current path
    const currentPath = window.location.pathname;
    if (this.config.excludePaths.some(path => currentPath.includes(path))) {
      this.log(`Excluded path: ${currentPath}`);
      return this;
    }

    this.start();
    return this;
  }

  /**
   * Start monitoring user activity
   */
  start() {
    if (this.state.isActive) {
      this.log('Already active');
      return this;
    }

    this.state.isActive = true;
    this.state.lastActivity = Date.now();
    this.state.sessionStartTime = Date.now();

    // Setup activity tracking
    this.setupActivityListeners();

    // Setup page visibility tracking
    this.setupVisibilityListener();

    // Start timers
    this.resetTimers();

    this.log('✅ Idle timeout monitoring started');
    this.emit('started', {
      warningTime: this.config.warningTime,
      logoutTime: this.config.logoutTime
    });

    return this;
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.state.isActive) return this;

    this.state.isActive = false;

    // Clear all timers
    this.clearAllTimers();

    // Remove activity listeners
    this.removeActivityListeners();

    // Remove visibility listener
    this.removeVisibilityListener();

    // Hide warning if shown
    if (this.state.isWarningShown) {
      this.hideWarning();
    }

    this.log('🛑 Idle timeout monitoring stopped');
    this.emit('stopped');

    return this;
  }

  /**
   * Pause monitoring (e.g., when modal is open)
   */
  pause() {
    if (!this.state.isActive || this.state.isPaused) return this;

    this.state.isPaused = true;
    this.clearAllTimers();

    this.log('⏸️ Monitoring paused');
    this.emit('pause');

    return this;
  }

  /**
   * Resume monitoring
   */
  resume() {
    if (!this.state.isActive || !this.state.isPaused) return this;

    this.state.isPaused = false;
    this.state.lastActivity = Date.now();
    this.resetTimers();

    this.log('▶️ Monitoring resumed');
    this.emit('resume');

    return this;
  }

  /**
   * Register event listener (Observer pattern)
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {IdleTimeoutManager} For method chaining
   */
  on(event, callback) {
    if (this.listeners[event] && typeof callback === 'function') {
      this.listeners[event].push(callback);
    }
    return this;
  }

  /**
   * Unregister event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   * @returns {IdleTimeoutManager} For method chaining
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      timeUntilWarning: this.getTimeUntilWarning(),
      timeUntilLogout: this.getTimeUntilLogout(),
      idleTime: this.getIdleTime()
    };
  }

  /**
   * Get idle time in milliseconds
   * @returns {number} Idle time
   */
  getIdleTime() {
    return Date.now() - this.state.lastActivity;
  }

  /**
   * Get time until warning in milliseconds
   * @returns {number} Time until warning
   */
  getTimeUntilWarning() {
    const idle = this.getIdleTime();
    return Math.max(0, this.config.warningTime - idle);
  }

  /**
   * Get time until logout in milliseconds
   * @returns {number} Time until logout
   */
  getTimeUntilLogout() {
    const idle = this.getIdleTime();
    return Math.max(0, this.config.logoutTime - idle);
  }

  /**
   * Force reset timers (public API)
   */
  reset() {
    this.state.lastActivity = Date.now();
    this.resetTimers();

    if (this.state.isWarningShown) {
      this.hideWarning();
    }

    this.log('🔄 Timers reset manually');
    this.emit('reset');

    return this;
  }

  // ==========================================
  // Private Methods - Event Handling
  // ==========================================

  /**
   * Setup activity event listeners
   * @private
   */
  setupActivityListeners() {
    // Use capture phase for better performance
    this.config.trackedEvents.forEach(event => {
      document.addEventListener(event, this.handleActivity, {
        passive: true,
        capture: true
      });
    });
  }

  /**
   * Remove activity event listeners
   * @private
   */
  removeActivityListeners() {
    this.config.trackedEvents.forEach(event => {
      document.removeEventListener(event, this.handleActivity, {
        capture: true
      });
    });
  }

  /**
   * Handle user activity
   * @private
   */
  handleActivity(event) {
    // Ignore if not active or paused
    if (!this.state.isActive || this.state.isPaused) return;

    // Debounce to prevent too many updates
    if (this.timers.debounce) return;

    this.timers.debounce = setTimeout(() => {
      this.timers.debounce = null;
    }, 1000); // 1 second debounce

    // Update state
    const now = Date.now();
    const timeSinceLastActivity = now - this.state.lastActivity;

    this.state.lastActivity = now;
    this.state.activityCount++;

    // Reset timers if significant time passed
    if (timeSinceLastActivity > 2000) { // More than 2 seconds
      this.resetTimers();

      // Hide warning if user became active
      if (this.state.isWarningShown) {
        this.hideWarning();
        this.log('User resumed activity - warning hidden');
      }
    }

    // Emit activity event
    this.emit('activity', {
      type: event.type,
      idleTime: timeSinceLastActivity,
      totalActivity: this.state.activityCount
    });

    // Call external callback if provided
    if (this.config.onActivity) {
      this.config.onActivity(event);
    }
  }

  /**
   * Setup page visibility listener
   * @private
   */
  setupVisibilityListener() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Remove visibility listener
   * @private
   */
  removeVisibilityListener() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle page visibility changes
   * @private
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // Page is hidden - pause monitoring
      this.pause();
    } else {
      // Page is visible - resume monitoring
      this.resume();
    }
  }

  // ==========================================
  // Private Methods - Timer Management
  // ==========================================

  /**
   * Reset all timers
   * @private
   */
  resetTimers() {
    if (!this.state.isActive || this.state.isPaused) return;

    // Clear existing timers
    this.clearAllTimers();

    // Set warning timer
    if (this.config.showWarning) {
      this.timers.warning = setTimeout(() => {
        this.showWarning();
      }, this.config.warningTime);
    }

    // Set logout timer
    this.timers.logout = setTimeout(() => {
      this.performLogout();
    }, this.config.logoutTime);

    this.log(`Timers reset - Warning in ${this.config.warningTime/1000}s, Logout in ${this.config.logoutTime/1000}s`);
  }

  /**
   * Clear all timers
   * @private
   */
  clearAllTimers() {
    Object.keys(this.timers).forEach(timer => {
      if (this.timers[timer]) {
        clearTimeout(this.timers[timer]);
        clearInterval(this.timers[timer]);
        this.timers[timer] = null;
      }
    });
  }

  // ==========================================
  // Private Methods - Warning Management
  // ==========================================

  /**
   * Show warning dialog
   * @private
   */
  showWarning() {
    if (this.state.isWarningShown) return;

    this.state.isWarningShown = true;
    this.state.warningShownAt = Date.now();

    this.log('⚠️ Showing inactivity warning');

    // Emit warning event
    this.emit('warning', {
      countdownTime: this.config.countdownTime,
      canContinue: true
    });

    // Call external callback
    if (this.config.onWarning) {
      this.config.onWarning({
        countdown: this.config.countdownTime,
        onContinue: () => this.handleContinue(),
        onLogout: () => this.performLogout()
      });
    }

    // Start countdown
    this.startCountdown();
  }

  /**
   * Hide warning dialog
   * @private
   */
  hideWarning() {
    if (!this.state.isWarningShown) return;

    this.state.isWarningShown = false;
    this.state.warningShownAt = null;

    // Clear countdown
    if (this.timers.countdown) {
      clearInterval(this.timers.countdown);
      this.timers.countdown = null;
    }

    this.emit('warning-hidden');
  }

  /**
   * Start countdown timer
   * @private
   */
  startCountdown() {
    let remaining = this.config.countdownTime;

    // Update every second
    this.timers.countdown = setInterval(() => {
      remaining--;

      // Emit countdown event
      this.emit('countdown', {
        remaining,
        total: this.config.countdownTime,
        percentage: (remaining / this.config.countdownTime) * 100
      });

      // Call external callback
      if (this.config.onCountdown) {
        this.config.onCountdown(remaining);
      }

      // Check if countdown finished
      if (remaining <= 0) {
        clearInterval(this.timers.countdown);
        this.timers.countdown = null;

        // Perform logout
        if (this.state.isWarningShown) {
          this.performLogout();
        }
      }
    }, 1000);
  }

  /**
   * Handle user choosing to continue
   * @private
   */
  handleContinue() {
    this.log('✅ User chose to continue working');

    // Reset everything
    this.state.lastActivity = Date.now();
    this.hideWarning();
    this.resetTimers();

    this.emit('continued');
  }

  // ==========================================
  // Private Methods - Logout
  // ==========================================

  /**
   * Perform logout
   * @private
   */
  async performLogout() {
    this.log('🚪 Performing auto-logout due to inactivity');

    // Stop monitoring
    this.stop();

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.performAutoSave();
    }

    // Emit logout event
    this.emit('logout', {
      reason: 'inactivity',
      idleTime: this.getIdleTime(),
      sessionDuration: Date.now() - this.state.sessionStartTime
    });

    // Call external logout handler
    if (this.config.onLogout) {
      this.config.onLogout({
        reason: 'inactivity',
        idleTime: this.getIdleTime()
      });
    }
  }

  /**
   * Perform auto-save before logout
   * @private
   */
  async performAutoSave() {
    try {
      this.log('💾 Performing auto-save before logout');

      // Emit auto-save event
      this.emit('auto-save');

      // Wait for save operations to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.log('✅ Auto-save completed');
    } catch (error) {
      console.error('[IdleTimeout] Auto-save failed:', error);
    }
  }

  // ==========================================
  // Private Methods - Utilities
  // ==========================================

  /**
   * Emit event to registered listeners
   * @private
   */
  emit(event, data = {}) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[IdleTimeout] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Log message if debug is enabled
   * @private
   */
  log(message) {
    if (this.config.debug || window.DEBUG_IDLE_TIMEOUT) {
      console.log(`[IdleTimeout] ${message}`);
    }
  }

  // ==========================================
  // Static Methods
  // ==========================================

  /**
   * Create and initialize instance
   * @static
   */
  static create(config) {
    const instance = new IdleTimeoutManager(config);
    return instance.init();
  }

  /**
   * Get default configuration
   * @static
   */
  static getDefaultConfig() {
    return {
      warningTime: 10 * 60 * 1000,  // 10 minutes
      logoutTime: 15 * 60 * 1000,   // 15 minutes
      countdownTime: 60              // 60 seconds
    };
  }

  /**
   * Format time for display
   * @static
   */
  static formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} שעות ו-${minutes % 60} דקות`;
    } else if (minutes > 0) {
      return `${minutes} דקות ו-${seconds % 60} שניות`;
    } else {
      return `${seconds} שניות`;
    }
  }
}

// ==========================================
// Export
// ==========================================

// Default export
export default IdleTimeoutManager;

// Named export for convenience
export { IdleTimeoutManager };