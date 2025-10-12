/**
 * Admin Manager - API למנהלים לניהול משתמשים ופעילות
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 12/10/2025
 * גרסה: 1.0.0
 *
 * תפקיד:
 * - טעינת נתונים בזמן אמת מFirestore
 * - ניהול משתמשים (הוספה/עריכה/מחיקה/חסימה)
 * - צפייה בפעילות
 * - שליטה מלאה על המערכת
 */

(function() {
  'use strict';

  /* === Configuration === */
  const ADMIN_CONFIG = {
    REALTIME_REFRESH: 10000,    // 10 שניות - עדכון אוטומטי
    MAX_ACTIVITY_LOGS: 100,     // מקסימום רשומות פעילות
    SESSION_TIMEOUT: 300000,    // 5 דקות - timeout למנהל
    DEBUG: false
  };

  /* === Logger === */
  const logger = {
    log: (...args) => {
      if (ADMIN_CONFIG.DEBUG) {
        console.log('[AdminManager]', ...args);
      }
    },
    error: (...args) => {
      console.error('[AdminManager ERROR]', ...args);
    }
  };

  /* === State === */
  let realtimeListeners = [];
  let refreshTimer = null;

  /**
   * אתחול מערכת הניהול
   */
  async function init() {
    if (!window.firebaseDB) {
      logger.error('Firebase DB not available');
      throw new Error('Firebase not initialized');
    }

    logger.log('Initializing Admin Manager...');

    // התחלת האזנה בזמן אמת
    startRealtimeListeners();

    // טעינה ראשונית
    await refreshAll();

    logger.log('✅ Admin Manager initialized');
  }

  /**
   * התחלת האזנה בזמן אמת
   */
  function startRealtimeListeners() {
    const db = window.firebaseDB;

    // 1. האזנה למשתמשים מחוברים
    const usersListener = db.collection('users')
      .where('isOnline', '==', true)
      .onSnapshot((snapshot) => {
        const onlineUsers = [];
        snapshot.forEach(doc => {
          onlineUsers.push({ id: doc.id, ...doc.data() });
        });

        logger.log(`👥 Online users updated: ${onlineUsers.length}`);
        updateOnlineUsersUI(onlineUsers);
      });

    realtimeListeners.push(usersListener);

    // 2. האזנה לסשנים פעילים
    const sessionsListener = db.collection('sessions')
      .where('isActive', '==', true)
      .orderBy('loginTime', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        const activeSessions = [];
        snapshot.forEach(doc => {
          activeSessions.push({ id: doc.id, ...doc.data() });
        });

        logger.log(`🔐 Active sessions updated: ${activeSessions.length}`);
        updateActiveSessionsUI(activeSessions);
      });

    realtimeListeners.push(sessionsListener);

    // 3. האזנה לפעילות אחרונה
    const activityListener = db.collection('activity_log')
      .orderBy('timestamp', 'desc')
      .limit(ADMIN_CONFIG.MAX_ACTIVITY_LOGS)
      .onSnapshot((snapshot) => {
        const activities = [];
        snapshot.forEach(doc => {
          activities.push({ id: doc.id, ...doc.data() });
        });

        logger.log(`📝 Activity log updated: ${activities.length}`);
        updateActivityLogUI(activities);
      });

    realtimeListeners.push(activityListener);
  }

  /**
   * עצירת האזנה בזמן אמת
   */
  function stopRealtimeListeners() {
    realtimeListeners.forEach(unsubscribe => unsubscribe());
    realtimeListeners = [];
  }

  /**
   * רענון כל הנתונים
   */
  async function refreshAll() {
    try {
      logger.log('🔄 Refreshing all data...');

      await Promise.all([
        loadAllUsers(),
        loadAllSessions(),
        loadActivityLog(),
        loadStatistics()
      ]);

      logger.log('✅ All data refreshed');
    } catch (error) {
      logger.error('Failed to refresh data:', error);
      throw error;
    }
  }

  /* === Data Loading Functions === */

  /**
   * טעינת כל המשתמשים
   */
  async function loadAllUsers() {
    const db = window.firebaseDB;
    const snapshot = await db.collection('users').get();

    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    logger.log(`✅ Loaded ${users.length} users`);
    return users;
  }

  /**
   * טעינת כל הסשנים
   */
  async function loadAllSessions() {
    const db = window.firebaseDB;
    const snapshot = await db.collection('sessions')
      .orderBy('loginTime', 'desc')
      .limit(100)
      .get();

    const sessions = [];
    snapshot.forEach(doc => {
      sessions.push({ id: doc.id, ...doc.data() });
    });

    logger.log(`✅ Loaded ${sessions.length} sessions`);
    return sessions;
  }

  /**
   * טעינת יומן פעילות
   */
  async function loadActivityLog(limit = ADMIN_CONFIG.MAX_ACTIVITY_LOGS) {
    const db = window.firebaseDB;
    const snapshot = await db.collection('activity_log')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const activities = [];
    snapshot.forEach(doc => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    logger.log(`✅ Loaded ${activities.length} activity logs`);
    return activities;
  }

  /**
   * טעינת סטטיסטיקות
   */
  async function loadStatistics() {
    const db = window.firebaseDB;

    const stats = {
      totalUsers: 0,
      onlineUsers: 0,
      activeSessions: 0,
      totalActivities: 0
    };

    // סה"כ משתמשים
    const usersSnapshot = await db.collection('users').get();
    stats.totalUsers = usersSnapshot.size;

    // משתמשים מחוברים
    const onlineSnapshot = await db.collection('users')
      .where('isOnline', '==', true)
      .get();
    stats.onlineUsers = onlineSnapshot.size;

    // סשנים פעילים
    const sessionsSnapshot = await db.collection('sessions')
      .where('isActive', '==', true)
      .get();
    stats.activeSessions = sessionsSnapshot.size;

    // סה"כ פעולות (היום)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activitySnapshot = await db.collection('activity_log')
      .where('timestamp', '>=', today)
      .get();
    stats.totalActivities = activitySnapshot.size;

    logger.log('✅ Statistics loaded:', stats);
    updateStatisticsUI(stats);

    return stats;
  }

  /* === UI Update Functions === */

  /**
   * עדכון משתמשים מחוברים בUI
   */
  function updateOnlineUsersUI(users) {
    const container = document.getElementById('online-users');
    const totalContainer = document.getElementById('total-users');

    if (container) {
      container.textContent = users.length;
    }

    if (totalContainer) {
      // עדכון סה"כ משתמשים (נטען בנפרד)
    }

    // עדכון רשימת משתמשים
    updateEmployeeList(users);
  }

  /**
   * עדכון סשנים פעילים בUI
   */
  function updateActiveSessionsUI(sessions) {
    const container = document.getElementById('active-sessions');

    if (container) {
      container.textContent = sessions.length;
    }

    // ניתן להוסיף טבלת סשנים פעילים
  }

  /**
   * עדכון יומן פעילות בUI
   */
  function updateActivityLogUI(activities) {
    const container = document.getElementById('activity-list');

    if (!container) return;

    container.innerHTML = '';

    activities.forEach(activity => {
      const activityCard = createActivityCard(activity);
      container.appendChild(activityCard);
    });
  }

  /**
   * עדכון סטטיסטיקות בUI
   */
  function updateStatisticsUI(stats) {
    // משתמשים מחוברים
    const onlineUsers = document.getElementById('online-users');
    if (onlineUsers) {
      onlineUsers.textContent = stats.onlineUsers;
    }

    const totalUsers = document.getElementById('total-users');
    if (totalUsers) {
      totalUsers.textContent = stats.totalUsers;
    }

    // סשנים פעילים
    const activeSessions = document.getElementById('active-sessions');
    if (activeSessions) {
      activeSessions.textContent = stats.activeSessions;
    }

    // פעילות היום
    const todayActivity = document.getElementById('today-activity');
    if (todayActivity) {
      todayActivity.textContent = stats.totalActivities;
    }
  }

  /**
   * עדכון רשימת עובדים
   */
  function updateEmployeeList(users) {
    const container = document.getElementById('employee-list');

    if (!container) return;

    container.innerHTML = '';

    users.forEach(user => {
      const userCard = createEmployeeCard(user);
      container.appendChild(userCard);
    });
  }

  /**
   * יצירת כרטיס פעילות
   */
  function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';

    const timestamp = activity.timestamp?.toDate?.() || new Date(activity.created);
    const timeStr = formatTime(timestamp);

    card.innerHTML = `
      <div class="activity-header">
        <span class="activity-user">${activity.userId || 'Unknown'}</span>
        <span class="activity-time">${timeStr}</span>
      </div>
      <div class="activity-action">${activity.action}</div>
      <div class="activity-details">${JSON.stringify(activity.details || {})}</div>
    `;

    return card;
  }

  /**
   * יצירת כרטיס עובד
   */
  function createEmployeeCard(user) {
    const card = document.createElement('div');
    card.className = 'employee-card';

    const lastActivity = user.lastActivity?.toDate?.() || new Date();
    const lastActivityStr = formatTime(lastActivity);

    card.innerHTML = `
      <div class="employee-avatar">${user.username?.[0]?.toUpperCase() || '?'}</div>
      <div class="employee-info">
        <div class="employee-name">${user.username}</div>
        <div class="employee-status ${user.isOnline ? 'online' : 'offline'}">
          ${user.isOnline ? 'מחובר' : 'לא מחובר'}
        </div>
        <div class="employee-last-activity">פעיל לאחרונה: ${lastActivityStr}</div>
      </div>
      <div class="employee-actions">
        <button onclick="AdminManager.viewUserDetails('${user.id}')">פרטים</button>
        <button onclick="AdminManager.kickUser('${user.id}')">נתק</button>
      </div>
    `;

    return card;
  }

  /* === Admin Actions === */

  /**
   * נתק משתמש
   */
  async function kickUser(userId) {
    if (!confirm(`האם אתה בטוח שברצונך לנתק את המשתמש ${userId}?`)) {
      return;
    }

    try {
      const db = window.firebaseDB;

      // עדכון המשתמש ל-offline
      await db.collection('users').doc(userId).update({
        isOnline: false,
        forceLogout: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // סגירת כל הסשנים שלו
      const sessions = await db.collection('sessions')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      const batch = db.batch();
      sessions.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          logoutTime: firebase.firestore.FieldValue.serverTimestamp(),
          logoutReason: 'kicked_by_admin'
        });
      });

      await batch.commit();

      logger.log(`✅ User ${userId} kicked successfully`);
      alert('המשתמש נותק בהצלחה');

    } catch (error) {
      logger.error('Failed to kick user:', error);
      alert('שגיאה בניתוק המשתמש');
    }
  }

  /**
   * צפייה בפרטי משתמש
   */
  async function viewUserDetails(userId) {
    try {
      const db = window.firebaseDB;

      // טען נתוני משתמש
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      // טען סשנים של המשתמש
      const sessionsSnapshot = await db.collection('sessions')
        .where('userId', '==', userId)
        .orderBy('loginTime', 'desc')
        .limit(10)
        .get();

      const sessions = [];
      sessionsSnapshot.forEach(doc => {
        sessions.push(doc.data());
      });

      // טען פעילות של המשתמש
      const activitySnapshot = await db.collection('activity_log')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const activities = [];
      activitySnapshot.forEach(doc => {
        activities.push(doc.data());
      });

      // הצג בממשק
      displayUserDetailsModal({
        user: userData,
        sessions,
        activities
      });

    } catch (error) {
      logger.error('Failed to load user details:', error);
      alert('שגיאה בטעינת פרטי משתמש');
    }
  }

  /**
   * הצגת מודל פרטי משתמש
   */
  function displayUserDetailsModal(data) {
    // כאן תוסיף קוד להצגת מודל עם הפרטים
    console.log('User Details:', data);
    alert(`פרטי משתמש:\n${JSON.stringify(data, null, 2)}`);
  }

  /* === Utility Functions === */

  /**
   * פורמט זמן לתצוגה
   */
  function formatTime(date) {
    if (!date) return 'לא ידוע';

    const now = new Date();
    const diff = now - date;

    // פחות מדקה
    if (diff < 60000) {
      return 'עכשיו';
    }

    // פחות משעה
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `לפני ${minutes} דקות`;
    }

    // פחות מיום
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `לפני ${hours} שעות`;
    }

    // יותר מיום
    return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  /* === Public API === */
  window.AdminManager = {
    /**
     * אתחול
     */
    async init() {
      return await init();
    },

    /**
     * רענון נתונים
     */
    async refresh() {
      return await refreshAll();
    },

    /**
     * נתק משתמש
     */
    async kickUser(userId) {
      return await kickUser(userId);
    },

    /**
     * צפייה בפרטי משתמש
     */
    async viewUserDetails(userId) {
      return await viewUserDetails(userId);
    },

    /**
     * טעינת משתמשים
     */
    async loadUsers() {
      return await loadAllUsers();
    },

    /**
     * טעינת סשנים
     */
    async loadSessions() {
      return await loadAllSessions();
    },

    /**
     * טעינת פעילות
     */
    async loadActivity(limit) {
      return await loadActivityLog(limit);
    },

    /**
     * טעינת סטטיסטיקות
     */
    async loadStats() {
      return await loadStatistics();
    },

    /**
     * עצירת האזנה בזמן אמת
     */
    stop() {
      stopRealtimeListeners();
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    },

    /**
     * הגדרות
     */
    config: ADMIN_CONFIG
  };

  logger.log('📦 Admin Manager module loaded');

})();
