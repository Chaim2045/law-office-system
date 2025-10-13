/**
 * User Tracker - מערכת מעקב משתמשים בזמן אמת
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 12/10/2025
 * גרסה: 1.0.0
 *
 * תפקיד:
 * - מעקב אחרי כניסת משתמשים למערכת
 * - רישום פעילות בזמן אמת
 * - עדכון סטטוס online/offline
 * - שמירת יומן פעילות מפורט
 */

(function() {
  'use strict';

  /* === Configuration === */
  const TRACKER_CONFIG = {
    HEARTBEAT_INTERVAL: 30000,        // 30 שניות - עדכון "אני חי"
    SESSION_TIMEOUT: 120000,          // 2 דקות - אחרי זה נחשב offline
    ACTIVITY_DEBOUNCE: 5000,          // 5 שניות - זמן המתנה בין רישום פעילויות
    TRACK_MOUSE: false,               // האם לעקוב אחרי תנועת עכבר
    TRACK_KEYBOARD: true,             // האם לעקוב אחרי לחיצות מקלדת
    DEBUG: false                      // מצב פיתוח
  };

  /* === Logger === */
  const logger = {
    log: (...args) => {
      if (TRACKER_CONFIG.DEBUG) {
        console.log('[UserTracker]', ...args);
      }
    },
    error: (...args) => {
      console.error('[UserTracker ERROR]', ...args);
    }
  };

  /* === State === */
  let sessionId = null;
  let heartbeatTimer = null;
  let lastActivityTime = Date.now();
  let currentUser = null;
  let activityDebounceTimer = null;

  /**
   * יצירת Session ID ייחודי
   */
  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * קבלת מידע על הדפדפן והמכשיר
   */
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    // זיהוי דפדפן
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'IE';

    // זיהוי מערכת הפעלה
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'MacOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return {
      browser,
      os,
      userAgent: ua,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * רישום כניסה למערכת
   */
  async function trackLogin(username, fullName = null) {
    if (!window.firebaseDB) {
      logger.error('Firebase DB not available');
      return;
    }

    try {
      currentUser = username;
      sessionId = generateSessionId();
      const deviceInfo = getDeviceInfo();

      // קריאה מ-Firebase employees collection
      let employeeData = null;
      let displayName = fullName || username;
      let email = null;

      try {
        // ניסיון לטעון את העובד מ-Firebase
        if (window.EmployeesManager) {
          employeeData = await window.EmployeesManager.get(username);
          if (employeeData) {
            displayName = fullName || employeeData.name || employeeData.displayName || username;
            email = employeeData.email || null;
          }
        }
      } catch (err) {
        logger.log('Could not load employee from Firebase, trying fallback...');

        // Fallback: נסה מהגלובל EMPLOYEES הישן (backwards compatible)
        if (window.EMPLOYEES && window.EMPLOYEES[username]) {
          const oldData = window.EMPLOYEES[username];
          displayName = fullName || oldData.name || username;
          email = oldData.email || null;
        }
      }

      // קריאה ל-Function לרישום כניסה
      const trackUserActivity = firebase.functions().httpsCallable('trackUserActivity');
      await trackUserActivity({
        activityType: 'login',
        metadata: {
          sessionId: sessionId,
          displayName: displayName,
          email: email,
          device: deviceInfo,
          message: 'התחברות למערכת'
        },
        userAgent: deviceInfo.userAgent
      });

      logger.log(`✅ User ${username} logged in, session: ${sessionId}`);

      // התחלת heartbeat
      startHeartbeat();

      return sessionId;

    } catch (error) {
      logger.error('Failed to track login:', error);
      throw error;
    }
  }

  /**
   * רישום יציאה מהמערכת
   */
  async function trackLogout() {
    if (!sessionId || !firebase || !firebase.functions) return;

    try {
      // עצירת heartbeat
      stopHeartbeat();

      // קריאה ל-Function לרישום יציאה
      const trackUserActivity = firebase.functions().httpsCallable('trackUserActivity');
      await trackUserActivity({
        activityType: 'logout',
        metadata: {
          sessionId: sessionId,
          message: 'התנתקות מהמערכת'
        }
      });

      logger.log(`✅ User ${currentUser} logged out`);

      // ניקוי
      sessionId = null;
      currentUser = null;

    } catch (error) {
      logger.error('Failed to track logout:', error);
    }
  }

  /**
   * רישום פעילות
   */
  async function logActivity(action, details = {}) {
    if (!sessionId || !currentUser || !firebase || !firebase.functions) return;

    try {
      // קריאה ל-Function לרישום פעילות
      const trackUserActivity = firebase.functions().httpsCallable('trackUserActivity');
      await trackUserActivity({
        activityType: action,
        metadata: {
          sessionId: sessionId,
          url: window.location.pathname,
          ...details
        }
      });

      lastActivityTime = Date.now();
      logger.log(`📝 Activity logged: ${action}`);

    } catch (error) {
      logger.error('Failed to log activity:', error);
    }
  }

  /**
   * Heartbeat - עדכון "אני חי" כל 30 שניות
   */
  function startHeartbeat() {
    if (heartbeatTimer) return;

    heartbeatTimer = setInterval(async () => {
      if (!sessionId || !firebase || !firebase.functions) return;

      try {
        // בדיקה אם יש פעילות
        const timeSinceActivity = Date.now() - lastActivityTime;
        const isStillActive = timeSinceActivity < TRACKER_CONFIG.SESSION_TIMEOUT;

        // קריאה ל-Function לעדכון heartbeat
        const trackUserActivity = firebase.functions().httpsCallable('trackUserActivity');
        await trackUserActivity({
          activityType: 'heartbeat',
          metadata: {
            sessionId: sessionId,
            isActive: isStillActive,
            timeSinceActivity: timeSinceActivity
          }
        });

        logger.log(`💓 Heartbeat sent, active: ${isStillActive}`);

      } catch (error) {
        logger.error('Heartbeat failed:', error);
      }
    }, TRACKER_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * עצירת Heartbeat
   */
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /**
   * מעקב אחרי פעילות כללית (עכבר/מקלדת)
   */
  function trackGeneralActivity() {
    lastActivityTime = Date.now();
  }

  /**
   * רישום פעולה ספציפית עם debounce
   */
  function trackActionDebounced(action, details) {
    // ביטול timer קודם
    if (activityDebounceTimer) {
      clearTimeout(activityDebounceTimer);
    }

    // יצירת timer חדש
    activityDebounceTimer = setTimeout(() => {
      logActivity(action, details);
    }, TRACKER_CONFIG.ACTIVITY_DEBOUNCE);
  }

  /**
   * התקנת Event Listeners
   */
  function setupEventListeners() {
    // פעילות כללית
    if (TRACKER_CONFIG.TRACK_MOUSE) {
      document.addEventListener('mousemove', trackGeneralActivity);
      document.addEventListener('click', trackGeneralActivity);
    }

    if (TRACKER_CONFIG.TRACK_KEYBOARD) {
      document.addEventListener('keydown', trackGeneralActivity);
    }

    // יציאה מהדף
    window.addEventListener('beforeunload', () => {
      trackLogout();
    });

    // הדף נעשה לא פעיל (מעבר לטאב אחר)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        logger.log('User switched to another tab');
      } else {
        logger.log('User returned to this tab');
        trackGeneralActivity();
      }
    });
  }

  /* === Public API === */
  window.UserTracker = {
    /**
     * אתחול המערכת
     */
    init() {
      logger.log('Initializing User Tracker...');
      setupEventListeners();
      logger.log('✅ User Tracker initialized');
    },

    /**
     * רישום כניסה
     */
    async trackLogin(username) {
      return await trackLogin(username);
    },

    /**
     * רישום יציאה
     */
    async trackLogout() {
      return await trackLogout();
    },

    /**
     * רישום פעילות
     */
    async logActivity(action, details = {}) {
      return await logActivity(action, details);
    },

    /**
     * רישום פעולה עם debounce
     */
    trackAction(action, details = {}) {
      trackActionDebounced(action, details);
    },

    /**
     * קבלת Session ID נוכחי
     */
    getSessionId() {
      return sessionId;
    },

    /**
     * קבלת משתמש נוכחי
     */
    getCurrentUser() {
      return currentUser;
    },

    /**
     * קבלת מצב
     */
    getStatus() {
      return {
        sessionId,
        currentUser,
        isActive: heartbeatTimer !== null,
        lastActivityTime: new Date(lastActivityTime).toISOString()
      };
    },

    /**
     * הגדרות
     */
    config: TRACKER_CONFIG
  };

  // אתחול אוטומטי
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.UserTracker.init();
    });
  } else {
    window.UserTracker.init();
  }

  logger.log('📦 User Tracker module loaded');

})();
