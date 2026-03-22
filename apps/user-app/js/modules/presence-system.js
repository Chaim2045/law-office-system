/**
 * Firebase Presence System - מערכת מעקב משתמשים בזמן אמת
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * גרסה: 2.0.0
 * תאריך: 22/10/2025
 *
 * מחליף את: user-tracker.js (Heartbeat-based)
 *
 * טכנולוגיה: Firebase Realtime Database + onDisconnect()
 *
 * יתרונות:
 * - 98% פחות כתיבות ל-Firebase (60 ליום במקום 2,880)
 * - זיהוי ניתוק אוטומטי ומיידי
 * - אין צורך ב-Heartbeat polling
 * - Realtime updates אמיתיים
 *
 * שימוש:
 * - PresenceSystem.connect(uid, username, email) - בהתחברות
 * - PresenceSystem.disconnect() - בהתנתקות
 * - PresenceSystem.listenToOnlineUsers(callback) - למסך אדמין
 */

(function() {
  'use strict';

  /**
   * מחלקת PresenceSystem - מנהלת מעקב משתמשים בזמן אמת
   */
  class PresenceSystem {
    constructor() {
      this.db = null; // Realtime Database
      this.firestore = null; // Firestore (לעדכון lastLogin)
      this.presenceRef = null;
      this.currentUserId = null;
      this.currentUsername = null;
      this.currentUserEmail = null; // ✅ NEW: Store email for Firestore updates
      this.sessionId = null;
      this.isConnected = false;
      this.heartbeatInterval = null; // ✅ NEW: Heartbeat timer
    }

    /**
     * אתחול המערכת
     */
    initialize() {
      if (!firebase) {
        console.error('[PresenceSystem] Firebase not loaded');
        return false;
      }

      try {
        this.db = firebase.database();
        this.firestore = firebase.firestore();

        // ✅ Validate that Realtime Database is properly configured
        if (!this.db || !firebase.app().options.databaseURL) {
          console.error('[PresenceSystem] Realtime Database URL not configured!');
          console.error('[PresenceSystem] Add databaseURL to firebaseConfig in index.html');
          return false;
        }

        Logger.log('✅ PresenceSystem initialized');
        return true;
      } catch (error) {
        console.error('[PresenceSystem] Failed to initialize:', error);
        return false;
      }
    }

    /**
     * יצירת Session ID ייחודי
     */
    generateSessionId() {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * קבלת מידע על הדפדפן והמכשיר
     */
    getDeviceInfo() {
      const ua = navigator.userAgent;
      let browser = 'Unknown';
      let os = 'Unknown';

      // זיהוי דפדפן
      if (ua.includes('Firefox')) {
browser = 'Firefox';
} else if (ua.includes('Chrome') && !ua.includes('Edge')) {
browser = 'Chrome';
} else if (ua.includes('Safari') && !ua.includes('Chrome')) {
browser = 'Safari';
} else if (ua.includes('Edge')) {
browser = 'Edge';
} else if (ua.includes('MSIE') || ua.includes('Trident/')) {
browser = 'IE';
}

      // זיהוי מערכת הפעלה
      if (ua.includes('Win')) {
os = 'Windows';
} else if (ua.includes('Mac')) {
os = 'MacOS';
} else if (ua.includes('Linux')) {
os = 'Linux';
} else if (ua.includes('Android')) {
os = 'Android';
} else if (ua.includes('iOS')) {
os = 'iOS';
}

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
     * התחברות - סימון משתמש כ-online
     * @param {string} userId - Firebase Auth UID
     * @param {string} username - שם משתמש (לתצוגה)
     * @param {string} email - אימייל המשתמש
     */
    async connect(userId, username, email) {
      if (!this.db || !this.firestore) {
        if (!this.initialize()) {
          console.error('[PresenceSystem] Cannot connect - not initialized');
          return;
        }
      }

      try {
        this.currentUserId = userId;
        this.currentUsername = username;
        this.currentUserEmail = email; // ✅ NEW: Store email for heartbeat
        this.sessionId = this.generateSessionId();
        const deviceInfo = this.getDeviceInfo();

        // Reference ל-Realtime Database
        this.presenceRef = this.db.ref(`presence/${userId}`);

        // ✅ כתיבה 1: סימון משתמש כ-online
        await this.presenceRef.set({
          online: true,
          username: username,
          email: email,
          sessionId: this.sessionId,
          device: deviceInfo,
          connectedAt: firebase.database.ServerValue.TIMESTAMP,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });

        // 🔥 הקסם: Firebase יעדכן אוטומטית כשהמשתמש מתנתק!
        await this.presenceRef.onDisconnect().update({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
          disconnectedAt: firebase.database.ServerValue.TIMESTAMP
        });

        // ✅ עדכון isOnline ב-Firestore (employees collection - לפי EMAIL)
        try {
          await this.firestore.collection('employees').doc(email).update({
            isOnline: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (firestoreError) {
          console.warn('[PresenceSystem] Failed to update Firestore:', firestoreError);
          // לא נכשל בגלל זה - זה רק metadata
        }

        this.isConnected = true;
        Logger.log(`✅ [PresenceSystem] User ${username} is now online (session: ${this.sessionId})`);

        // ✅ NEW: Start heartbeat (updates lastSeen every 5 minutes)
        this.startHeartbeat();

      } catch (error) {
        console.error('[PresenceSystem] Failed to connect:', error);
        throw error;
      }
    }

    /**
     * התנתקות ידנית (logout)
     */
    async disconnect() {
      if (!this.presenceRef || !this.isConnected) {
        return;
      }

      try {
        // עדכון סטטוס ל-offline
        await this.presenceRef.update({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
          disconnectedAt: firebase.database.ServerValue.TIMESTAMP
        });

        // ביטול onDisconnect (כי עשינו disconnect ידנית)
        await this.presenceRef.onDisconnect().cancel();

        Logger.log(`✅ [PresenceSystem] User ${this.currentUsername} disconnected`);

        // ✅ NEW: Stop heartbeat
        this.stopHeartbeat();

        // ניקוי
        this.presenceRef = null;
        this.currentUserId = null;
        this.currentUsername = null;
        this.currentUserEmail = null;
        this.sessionId = null;
        this.isConnected = false;

      } catch (error) {
        console.error('[PresenceSystem] Failed to disconnect:', error);
      }
    }

    /**
     * עדכון lastSeen (אופציונלי - לשימוש בפעולות חשובות)
     */
    async updateActivity() {
      if (this.presenceRef && this.isConnected) {
        try {
          await this.presenceRef.update({
            lastSeen: firebase.database.ServerValue.TIMESTAMP
          });
        } catch (error) {
          console.warn('[PresenceSystem] Failed to update activity:', error);
        }
      }
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * 🆕 NEW: HEARTBEAT SYSTEM
     * ════════════════════════════════════════════════════════════════════
     * Purpose: Keep lastSeen updated even when user is idle
     * Why: Admin can see real-time status (Active Now vs Last Seen 1 week ago)
     * Frequency: Every 5 minutes (300,000ms)
     * Cost: ~288 writes/day per user (vs 2,880 with old 30s polling)
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Start heartbeat - updates lastSeen every 5 minutes
     * התחל דופק - מעדכן lastSeen כל 5 דקות
     */
    startHeartbeat() {
      // Clear existing heartbeat if any
      this.stopHeartbeat();

      // Update immediately
      this.performHeartbeat();

      // Then update every 5 minutes
      this.heartbeatInterval = setInterval(() => {
        this.performHeartbeat();
      }, 5 * 60 * 1000); // 5 minutes

      Logger.log('✅ [PresenceSystem] Heartbeat started (every 5 minutes)');
    }

    /**
     * Stop heartbeat
     * עצור דופק
     */
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        Logger.log('✅ [PresenceSystem] Heartbeat stopped');
      }
    }

    /**
     * Perform heartbeat update
     * בצע עדכון דופק
     */
    async performHeartbeat() {
      if (!this.isConnected || !this.presenceRef) {
        return;
      }

      try {
        // Update Realtime Database
        await this.presenceRef.update({
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
          online: true
        });

        // Update Firestore (employees collection)
        if (this.firestore && this.currentUserEmail) {
          await this.firestore.collection('employees').doc(this.currentUserEmail).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true
          });
        }

        Logger.log('[PresenceSystem] 💓 Heartbeat updated');

      } catch (error) {
        console.warn('[PresenceSystem] Failed to update heartbeat:', error);
        // Don't throw - heartbeat is not critical
      }
    }

    /**
     * האזנה למשתמשים מחוברים (למסך אדמין)
     * @param {Function} callback - פונקציה שתקבל מערך של משתמשים מחוברים
     * @returns {Function} unsubscribe function
     */
    listenToOnlineUsers(callback) {
      if (!this.db) {
        if (!this.initialize()) {
          console.error('[PresenceSystem] Cannot listen - not initialized');
          return () => {};
        }
      }

      const presenceRef = this.db.ref('presence');

      const listener = presenceRef.on('value', (snapshot) => {
        const users = [];
        const now = Date.now();

        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();

          // רק משתמשים שמסומנים כ-online
          if (data && data.online) {
            // בדיקת timeout (אם lastSeen ישן מדי - לא באמת online)
            const lastSeen = data.lastSeen || 0;
            const timeSinceLastSeen = now - lastSeen;
            const isReallyOnline = timeSinceLastSeen < 120000; // 2 דקות

            if (isReallyOnline) {
              users.push({
                userId: childSnapshot.key,
                username: data.username,
                email: data.email,
                sessionId: data.sessionId,
                device: data.device,
                connectedAt: data.connectedAt,
                lastSeen: data.lastSeen
              });
            }
          }
        });

        callback(users);
      });

      // Return unsubscribe function
      return () => {
        presenceRef.off('value', listener);
      };
    }

    /**
     * קבלת מספר המשתמשים המחוברים (פעם אחת)
     */
    async getOnlineUsersCount() {
      if (!this.db) {
        if (!this.initialize()) {
          return 0;
        }
      }

      try {
        const snapshot = await this.db.ref('presence').once('value');
        let count = 0;
        const now = Date.now();

        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data && data.online) {
            const lastSeen = data.lastSeen || 0;
            const timeSinceLastSeen = now - lastSeen;
            if (timeSinceLastSeen < 120000) { // 2 דקות
              count++;
            }
          }
        });

        return count;
      } catch (error) {
        console.error('[PresenceSystem] Failed to get online users count:', error);
        return 0;
      }
    }

    /**
     * ניקוי נתוני presence ישנים (לתחזוקה)
     * מוחק משתמשים שלא התחברו יותר מ-30 יום
     */
    async cleanupOldPresenceData() {
      if (!this.db) {
        if (!this.initialize()) {
          return;
        }
      }

      try {
        const snapshot = await this.db.ref('presence').once('value');
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const toDelete = [];

        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          const lastSeen = data?.lastSeen || 0;

          // אם לא נראה יותר מ-30 יום - למחוק
          if (lastSeen < thirtyDaysAgo) {
            toDelete.push(childSnapshot.key);
          }
        });

        // מחיקה
        for (const userId of toDelete) {
          await this.db.ref(`presence/${userId}`).remove();
        }

        Logger.log(`✅ [PresenceSystem] Cleaned up ${toDelete.length} old presence records`);
      } catch (error) {
        console.error('[PresenceSystem] Failed to cleanup old data:', error);
      }
    }
  }

  // יצירת instance יחיד (Singleton)
  const presenceSystem = new PresenceSystem();

  // חשיפה ל-window
  window.PresenceSystem = {
    connect: (userId, username, email) => presenceSystem.connect(userId, username, email),
    disconnect: () => presenceSystem.disconnect(),
    updateActivity: () => presenceSystem.updateActivity(),
    listenToOnlineUsers: (callback) => presenceSystem.listenToOnlineUsers(callback),
    getOnlineUsersCount: () => presenceSystem.getOnlineUsersCount(),
    cleanupOldPresenceData: () => presenceSystem.cleanupOldPresenceData()
  };

  Logger.log('✅ PresenceSystem loaded successfully');

})();
