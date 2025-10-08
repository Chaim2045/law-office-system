/**
 * Activity Logger Module - מודול רישום פעולות
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 10/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - רישום כל פעולה במערכת
 * - שמירה ב-Firebase: activityLogs collection
 * - מידע מפורט על כל פעולה
 * - תמיכה ב-Dashboard לצפייה
 */

(function() {
  'use strict';

  /**
   * סוגי פעולות במערכת
   */
  const ActionTypes = {
    // כניסה למערכת
    LOGIN: 'login',
    LOGOUT: 'logout',

    // משימות תקצוב
    CREATE_TASK: 'create_task',
    EDIT_TASK: 'edit_task',
    DELETE_TASK: 'delete_task',
    COMPLETE_TASK: 'complete_task',
    EXTEND_DEADLINE: 'extend_deadline',
    UPDATE_PROGRESS: 'update_progress',

    // שעתון
    CREATE_TIMESHEET: 'create_timesheet',
    EDIT_TIMESHEET: 'edit_timesheet',
    DELETE_TIMESHEET: 'delete_timesheet',

    // לקוחות
    CREATE_CLIENT: 'create_client',
    EDIT_CLIENT: 'edit_client',
    DELETE_CLIENT: 'delete_client',
    BLOCK_CLIENT: 'block_client',
    UNBLOCK_CLIENT: 'unblock_client',

    // דוחות
    GENERATE_REPORT: 'generate_report',
    EXPORT_DATA: 'export_data'
  };

  /**
   * סוגי ישויות במערכת
   */
  const EntityTypes = {
    TASK: 'task',
    TIMESHEET: 'timesheet',
    CLIENT: 'client',
    REPORT: 'report',
    SYSTEM: 'system'
  };

  /**
   * מחלקת ActivityLogger - מנהלת רישום פעולות
   */
  class ActivityLogger {
    constructor(firebaseApp) {
      this.db = firebaseApp ? firebase.firestore() : null;
      this.currentUser = null;
      this.collectionName = 'activityLogs';
      this.enabled = true;
      this.offlineQueue = []; // תור לפעולות כש-offline
    }

    /**
     * הגדרת משתמש נוכחי
     * @param {Object} user - אובייקט משתמש
     */
    setCurrentUser(user) {
      this.currentUser = user;
    }

    /**
     * רישום פעולה כללית
     * @param {string} action - סוג הפעולה
     * @param {string} entityType - סוג הישות
     * @param {string} entityId - ID של הישות (אופציונלי)
     * @param {Object} details - פרטים נוספים
     * @returns {Promise}
     */
    async log(action, entityType, entityId = null, details = {}) {
      if (!this.enabled) {
        console.log('[ActivityLogger] Logging disabled');
        return;
      }

      const logEntry = {
        action,
        entityType,
        entityId,
        details,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: this.currentUser?.uid || 'anonymous',
        userEmail: this.currentUser?.email || 'unknown',
        userName: this.currentUser?.displayName || this.currentUser?.email || 'אנונימי',
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };

      try {
        if (!this.db) {
          console.warn('[ActivityLogger] Firebase not initialized, storing offline');
          this.offlineQueue.push(logEntry);
          return;
        }

        await this.db.collection(this.collectionName).add(logEntry);
        console.log('[ActivityLogger] Logged:', action, entityType);
      } catch (error) {
        console.error('[ActivityLogger] Error logging activity:', error);
        // שמירה לתור offline
        this.offlineQueue.push(logEntry);
      }
    }

    /**
     * שטיפת תור offline כשחוזרים online
     */
    async flushOfflineQueue() {
      if (this.offlineQueue.length === 0 || !this.db) return;

      console.log(`[ActivityLogger] Flushing ${this.offlineQueue.length} offline logs`);

      const batch = this.db.batch();
      const collectionRef = this.db.collection(this.collectionName);

      this.offlineQueue.forEach(logEntry => {
        const docRef = collectionRef.doc();
        batch.set(docRef, logEntry);
      });

      try {
        await batch.commit();
        this.offlineQueue = [];
        console.log('[ActivityLogger] Offline queue flushed successfully');
      } catch (error) {
        console.error('[ActivityLogger] Error flushing offline queue:', error);
      }
    }

    // ===== פעולות ספציפיות - כניסה למערכת =====

    /**
     * רישום כניסה למערכת
     */
    async logLogin() {
      return this.log(ActionTypes.LOGIN, EntityTypes.SYSTEM, null, {
        loginTime: new Date().toISOString()
      });
    }

    /**
     * רישום יציאה מהמערכת
     */
    async logLogout() {
      return this.log(ActionTypes.LOGOUT, EntityTypes.SYSTEM, null, {
        logoutTime: new Date().toISOString()
      });
    }

    // ===== פעולות ספציפיות - משימות =====

    /**
     * רישום יצירת משימה
     * @param {string} taskId
     * @param {Object} taskData
     */
    async logCreateTask(taskId, taskData) {
      return this.log(ActionTypes.CREATE_TASK, EntityTypes.TASK, taskId, {
        taskName: taskData.name,
        client: taskData.client,
        deadline: taskData.deadline,
        estimatedMinutes: taskData.estimatedMinutes
      });
    }

    /**
     * רישום עריכת משימה
     * @param {string} taskId
     * @param {Object} changes - השינויים שנעשו
     */
    async logEditTask(taskId, changes) {
      return this.log(ActionTypes.EDIT_TASK, EntityTypes.TASK, taskId, {
        changes
      });
    }

    /**
     * רישום מחיקת משימה
     * @param {string} taskId
     * @param {string} taskName
     */
    async logDeleteTask(taskId, taskName) {
      return this.log(ActionTypes.DELETE_TASK, EntityTypes.TASK, taskId, {
        taskName
      });
    }

    /**
     * רישום השלמת משימה
     * @param {string} taskId
     * @param {string} taskName
     */
    async logCompleteTask(taskId, taskName) {
      return this.log(ActionTypes.COMPLETE_TASK, EntityTypes.TASK, taskId, {
        taskName,
        completedAt: new Date().toISOString()
      });
    }

    /**
     * רישום הארכת תאריך יעד
     * @param {string} taskId
     * @param {string} oldDeadline
     * @param {string} newDeadline
     */
    async logExtendDeadline(taskId, oldDeadline, newDeadline) {
      return this.log(ActionTypes.EXTEND_DEADLINE, EntityTypes.TASK, taskId, {
        oldDeadline,
        newDeadline,
        extensionDays: Math.ceil((new Date(newDeadline) - new Date(oldDeadline)) / (1000 * 60 * 60 * 24))
      });
    }

    /**
     * רישום עדכון התקדמות
     * @param {string} taskId
     * @param {number} oldProgress
     * @param {number} newProgress
     */
    async logUpdateProgress(taskId, oldProgress, newProgress) {
      return this.log(ActionTypes.UPDATE_PROGRESS, EntityTypes.TASK, taskId, {
        oldProgress,
        newProgress,
        progressDelta: newProgress - oldProgress
      });
    }

    // ===== פעולות ספציפיות - שעתון =====

    /**
     * רישום יצירת רשומת שעתון
     * @param {string} entryId
     * @param {Object} entryData
     */
    async logCreateTimesheet(entryId, entryData) {
      return this.log(ActionTypes.CREATE_TIMESHEET, EntityTypes.TIMESHEET, entryId, {
        client: entryData.clientName,
        minutes: entryData.minutes,
        date: entryData.date
      });
    }

    /**
     * רישום עריכת שעתון
     * @param {string} entryId
     * @param {Object} changes
     */
    async logEditTimesheet(entryId, changes) {
      return this.log(ActionTypes.EDIT_TIMESHEET, EntityTypes.TIMESHEET, entryId, {
        changes
      });
    }

    /**
     * רישום מחיקת שעתון
     * @param {string} entryId
     * @param {Object} entryData
     */
    async logDeleteTimesheet(entryId, entryData) {
      return this.log(ActionTypes.DELETE_TIMESHEET, EntityTypes.TIMESHEET, entryId, {
        client: entryData.clientName,
        minutes: entryData.minutes
      });
    }

    // ===== פעולות ספציפיות - לקוחות =====

    /**
     * רישום יצירת לקוח
     * @param {string} clientId
     * @param {string} clientName
     */
    async logCreateClient(clientId, clientName) {
      return this.log(ActionTypes.CREATE_CLIENT, EntityTypes.CLIENT, clientId, {
        clientName
      });
    }

    /**
     * רישום עריכת לקוח
     * @param {string} clientId
     * @param {Object} changes
     */
    async logEditClient(clientId, changes) {
      return this.log(ActionTypes.EDIT_CLIENT, EntityTypes.CLIENT, clientId, {
        changes
      });
    }

    /**
     * רישום מחיקת לקוח
     * @param {string} clientId
     * @param {string} clientName
     */
    async logDeleteClient(clientId, clientName) {
      return this.log(ActionTypes.DELETE_CLIENT, EntityTypes.CLIENT, clientId, {
        clientName
      });
    }

    // ===== שאילתות =====

    /**
     * קבלת פעולות אחרונות
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getRecentActivities(limit = 50) {
      if (!this.db) return [];

      try {
        const snapshot = await this.db
          .collection(this.collectionName)
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('[ActivityLogger] Error fetching activities:', error);
        return [];
      }
    }

    /**
     * קבלת פעולות לפי משתמש
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getUserActivities(userId, limit = 50) {
      if (!this.db) return [];

      try {
        const snapshot = await this.db
          .collection(this.collectionName)
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('[ActivityLogger] Error fetching user activities:', error);
        return [];
      }
    }

    /**
     * השבתה/הפעלה של הרישום
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
      this.enabled = enabled;
      console.log(`[ActivityLogger] Logging ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  // חשיפה כ-module גלובלי
  window.ActivityLoggerModule = {
    ActivityLogger,
    ActionTypes,
    EntityTypes,

    /**
     * יצירת instance חדש
     * @param {Object} firebaseApp
     * @returns {ActivityLogger}
     */
    create(firebaseApp) {
      return new ActivityLogger(firebaseApp);
    }
  };

})();
