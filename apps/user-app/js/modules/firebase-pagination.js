/**
 * Firebase Pagination Module - מודול פגינציה מקצועי ל-Firebase
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 10/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - טעינת 20 רשומות ראשונות מ-Firebase (לא מהזיכרון!)
 * - כפתור "טען עוד" - 20 נוספים מ-Firebase
 * - תמיכה ב-startAfter של Firebase
 * - תאימות מלאה לאחור - לא דורס פונקציות קיימות!
 * - מוכן לדשבורד ניהול עתידי
 *
 * IMPORTANT:
 * - הפונקציות הישנות (loadClientsFromFirebase וכו') נשארות בדיוק כמו שהן!
 * - זה מודול נוסף, לא מחליף!
 * - אפשר לכבות/להדליק עם feature flags
 */

(function() {
  'use strict';

  // ===== הגדרות תצורה =====
  const PAGINATION_CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    ENABLE_LOGGING: false // מצב פרודקשן - ללא הדפסות
  };

  /**
   * מחלקת FirebasePagination - ניהול פגינציה מקצועי
   */
  class FirebasePaginationManager {
    constructor() {
      // מצביעים ל-last document עבור כל collection
      this.lastDocs = {
        clients: null,
        budget_tasks: null,
        timesheet_entries: null
      };

      // מטמון לנתונים שכבר נטענו
      this.cache = {
        clients: [],
        budget_tasks: [],
        timesheet_entries: []
      };

      // האם יש עוד נתונים לטעון
      this.hasMore = {
        clients: true,
        budget_tasks: true,
        timesheet_entries: true
      };
    }

    /**
     * לוג מותאם
     */
    _log(message, data = null) {
      if (PAGINATION_CONFIG.ENABLE_LOGGING) {
        console.log(`🔥📄 Firebase Pagination: ${message}`, data || '');
      }
    }

    /**
     * המרת Firebase Timestamp ל-Date
     * @private
     */
    _convertTimestamps(data) {
      const converted = { ...data };

      // שדות תאריך נפוצים
      const dateFields = ['createdAt', 'updatedAt', 'completedAt', 'deadline', 'date'];

      dateFields.forEach(field => {
        if (converted[field]?.toDate && typeof converted[field].toDate === 'function') {
          converted[field] = converted[field].toDate();
        }
      });

      return converted;
    }

    /**
     * איפוס הפגינציה לcollection מסוים
     * @param {string} collectionName - שם הקולקשן
     */
    reset(collectionName) {
      if (this.lastDocs[collectionName] !== undefined) {
        this.lastDocs[collectionName] = null;
        this.cache[collectionName] = [];
        this.hasMore[collectionName] = true;
        this._log(`Reset pagination for ${collectionName}`);
      }
    }

    /**
     * איפוס כל הפגינציה
     */
    resetAll() {
      Object.keys(this.lastDocs).forEach(key => this.reset(key));
      this._log('Reset all pagination');
    }

    /**
     * טעינת לקוחות עם פגינציה
     * @param {number} limit - מספר רשומות (ברירת מחדל: 20)
     * @param {boolean} loadMore - האם זה "טען עוד" (ברירת מחדל: false)
     * @returns {Promise<{items: Array, hasMore: boolean, total: number}>}
     *
     * @example
     * // טעינה ראשונית
     * const result = await firebasePagination.loadClientsPaginated();
     * console.log(result.items); // 20 לקוחות ראשונים
     *
     * // טעינת עוד
     * const more = await firebasePagination.loadClientsPaginated(20, true);
     * console.log(more.items); // 20 נוספים
     */
    async loadClientsPaginated(limit = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE, loadMore = false) {
      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase לא מחובר');
        }

        // אם זו לא "טען עוד", איפוס
        if (!loadMore) {
          this.reset('clients');
        }

        // אם אין יותר - החזר ריק
        if (!this.hasMore.clients && loadMore) {
          this._log('No more clients to load');
          return {
            items: [],
            hasMore: false,
            total: this.cache.clients.length
          };
        }

        // בניית השאילתא
        let query = db.collection('clients')
          .orderBy('createdAt', 'desc')
          .limit(limit);

        // אם יש lastDoc - התחל אחריו
        if (this.lastDocs.clients && loadMore) {
          query = query.startAfter(this.lastDocs.clients);
        }

        this._log(`Loading clients (limit: ${limit}, loadMore: ${loadMore})`);

        const snapshot = await query.get();
        const clients = [];

        snapshot.forEach((doc) => {
          const data = this._convertTimestamps(doc.data());
          clients.push({
            id: doc.id,
            ...data
          });
        });

        // עדכון lastDoc
        if (snapshot.docs.length > 0) {
          this.lastDocs.clients = snapshot.docs[snapshot.docs.length - 1];
        }

        // עדכון hasMore
        this.hasMore.clients = snapshot.docs.length === limit;

        // עדכון cache
        if (loadMore) {
          this.cache.clients = [...this.cache.clients, ...clients];
        } else {
          this.cache.clients = clients;
        }

        this._log(`Loaded ${clients.length} clients (hasMore: ${this.hasMore.clients})`);

        return {
          items: clients,
          hasMore: this.hasMore.clients,
          total: this.cache.clients.length
        };
      } catch (error) {
        console.error('Firebase Pagination error (clients):', error);
        throw new Error('שגיאה בטעינת לקוחות: ' + error.message);
      }
    }

    /**
     * טעינת משימות תקצוב עם פגינציה
     * @param {string} employee - שם העובד
     * @param {number} limit - מספר רשומות
     * @param {boolean} loadMore - האם זה "טען עוד"
     * @param {string} statusFilter - סינון לפי סטטוס: 'active', 'completed', 'all'
     * @returns {Promise<{items: Array, hasMore: boolean, total: number}>}
     */
    async loadBudgetTasksPaginated(employee, limit = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE, loadMore = false, statusFilter = 'active') {
      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase לא מחובר');
        }

        // 🔑 Use separate cache key for each statusFilter to prevent mixing
        const cacheKey = `budget_tasks_${statusFilter}`;

        if (!loadMore) {
          this.reset(cacheKey);
        }

        if (!this.hasMore[cacheKey] && loadMore) {
          this._log(`No more budget tasks to load (filter: ${statusFilter})`);
          return {
            items: [],
            hasMore: false,
            total: (this.cache[cacheKey] || []).length
          };
        }

        let query = db.collection('budget_tasks')
          .where('employee', '==', employee);

        if (statusFilter === 'active') {
          query = query.where('status', '==', 'פעיל').orderBy('deadline', 'asc');
        } else if (statusFilter === 'completed') {
          query = query.where('status', '==', 'הושלם').orderBy('completedAt', 'desc');
        } else {
          query = query.orderBy('createdAt', 'desc');
        }

        query = query.limit(limit);

        if (this.lastDocs[cacheKey] && loadMore) {
          query = query.startAfter(this.lastDocs[cacheKey]);
        }

        this._log(`Loading budget tasks for ${employee} (limit: ${limit}, loadMore: ${loadMore}, filter: ${statusFilter})`);

        const snapshot = await query.get();
        const tasks = [];

        snapshot.forEach((doc) => {
          const data = this._convertTimestamps(doc.data());

          const taskWithFirebaseId = {
            ...data,
            firebaseDocId: doc.id
          };

          if (!taskWithFirebaseId.id) {
            taskWithFirebaseId.id = doc.id;
          }

          tasks.push(taskWithFirebaseId);
        });

        // 🛡️ CLIENT-SIDE FILTERING: Always filter by status to ensure consistency
        // This prevents issues with Firebase pagination not respecting status filters
        let filteredTasks = tasks;
        if (statusFilter === 'active') {
          filteredTasks = tasks.filter(task => task.status === 'פעיל');
        } else if (statusFilter === 'completed') {
          filteredTasks = tasks.filter(task => task.status === 'הושלם');
        }
        // 'all' - no filtering

        if (snapshot.docs.length > 0) {
          this.lastDocs[cacheKey] = snapshot.docs[snapshot.docs.length - 1];
        }

        this.hasMore[cacheKey] = snapshot.docs.length === limit;

        if (loadMore) {
          this.cache[cacheKey] = [...(this.cache[cacheKey] || []), ...filteredTasks];
        } else {
          this.cache[cacheKey] = filteredTasks;
        }

        this._log(`Loaded ${filteredTasks.length} budget tasks (hasMore: ${this.hasMore[cacheKey]}, filtered from ${tasks.length}, cacheKey: ${cacheKey})`);

        return {
          items: filteredTasks,
          hasMore: this.hasMore[cacheKey],
          total: (this.cache[cacheKey] || []).length
        };
      } catch (error) {
        console.error('Firebase Pagination error (budget_tasks):', error);
        throw new Error('שגיאה בטעינת משימות: ' + error.message);
      }
    }

    /**
     * טעינת שעתון עם פגינציה
     * @param {string} employee - שם העובד
     * @param {number} limit - מספר רשומות
     * @param {boolean} loadMore - האם זה "טען עוד"
     * @returns {Promise<{items: Array, hasMore: boolean, total: number}>}
     */
    async loadTimesheetPaginated(employee, limit = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE, loadMore = false) {
      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase לא מחובר');
        }

        if (!loadMore) {
          this.reset('timesheet_entries');
        }

        if (!this.hasMore.timesheet_entries && loadMore) {
          this._log('No more timesheet entries to load');
          return {
            items: [],
            hasMore: false,
            total: this.cache.timesheet_entries.length
          };
        }

        let query = db.collection('timesheet_entries')
          .where('employee', '==', employee)
          .orderBy('createdAt', 'desc')
          .limit(limit);

        if (this.lastDocs.timesheet_entries && loadMore) {
          query = query.startAfter(this.lastDocs.timesheet_entries);
        }

        this._log(`Loading timesheet for ${employee} (limit: ${limit}, loadMore: ${loadMore})`);

        const snapshot = await query.get();
        const entries = [];

        snapshot.forEach((doc) => {
          const data = this._convertTimestamps(doc.data());
          entries.push({
            id: doc.id,
            ...data
          });
        });

        if (snapshot.docs.length > 0) {
          this.lastDocs.timesheet_entries = snapshot.docs[snapshot.docs.length - 1];
        }

        this.hasMore.timesheet_entries = snapshot.docs.length === limit;

        if (loadMore) {
          this.cache.timesheet_entries = [...this.cache.timesheet_entries, ...entries];
        } else {
          this.cache.timesheet_entries = entries;
        }

        this._log(`Loaded ${entries.length} timesheet entries (hasMore: ${this.hasMore.timesheet_entries})`);

        return {
          items: entries,
          hasMore: this.hasMore.timesheet_entries,
          total: this.cache.timesheet_entries.length
        };
      } catch (error) {
        console.error('Firebase Pagination error (timesheet):', error);
        throw new Error('שגיאה בטעינת שעתון: ' + error.message);
      }
    }

    /**
     * קבלת כל הנתונים שנטענו עד כה (מה-cache)
     * @param {string} collectionName - שם הקולקשן
     * @returns {Array}
     */
    getCachedData(collectionName) {
      return this.cache[collectionName] || [];
    }

    /**
     * קבלת סטטוס הפגינציה
     * @param {string} collectionName - שם הקולקשן
     * @returns {Object}
     */
    getStatus(collectionName) {
      return {
        collection: collectionName,
        cachedItems: this.cache[collectionName]?.length || 0,
        hasMore: this.hasMore[collectionName],
        hasLastDoc: !!this.lastDocs[collectionName]
      };
    }
  }

  // ===== חשיפה כ-module גלובלי =====
  window.FirebasePaginationModule = {
    FirebasePaginationManager,

    /**
     * יצירת instance חדש
     * @returns {FirebasePaginationManager}
     */
    create() {
      return new FirebasePaginationManager();
    }
  };


})();
