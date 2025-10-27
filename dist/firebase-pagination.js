/**
 * Firebase Pagination Module - מודול פגינציה מקצועי ל-Firebase
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 10/10/2025
 * גרסה: 2.0.0 - TypeScript Edition
 *
 * תכונות:
 * - טעינת רשומות עם פגינציה אמיתית מ-Firebase
 * - כפתור "טען עוד" - טעינה נוספת מהשרת
 * - תמיכה ב-startAfter של Firebase
 * - Generic types לגמישות מלאה
 * - Type-safe API
 */
/* ===== Configuration ===== */
const PAGINATION_CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    ENABLE_LOGGING: false, // מצב פרודקשן - ללא הדפסות
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
            timesheet_entries: null,
        };
        // מטמון לנתונים שכבר נטענו
        this.cache = {
            clients: [],
            budget_tasks: [],
            timesheet_entries: [],
        };
        // האם יש עוד נתונים לטעון
        this.hasMore = {
            clients: true,
            budget_tasks: true,
            timesheet_entries: true,
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
     */
    _convertTimestamps(data) {
        const converted = { ...data };
        // שדות תאריך נפוצים
        const dateFields = ['createdAt', 'updatedAt', 'completedAt', 'deadline', 'date'];
        dateFields.forEach((field) => {
            if (converted[field]?.toDate && typeof converted[field].toDate === 'function') {
                converted[field] = converted[field].toDate();
            }
        });
        return converted;
    }
    /**
     * איפוס הפגינציה לcollection מסוים
     */
    reset(collectionName) {
        this.lastDocs[collectionName] = null;
        this.cache[collectionName] = [];
        this.hasMore[collectionName] = true;
        this._log(`Reset pagination for ${collectionName}`);
    }
    /**
     * איפוס כל הפגינציה
     */
    resetAll() {
        const collections = ['clients', 'budget_tasks', 'timesheet_entries'];
        collections.forEach((key) => this.reset(key));
        this._log('Reset all pagination');
    }
    /**
     * טעינת לקוחות עם פגינציה
     *
     * @param limit - מספר רשומות (ברירת מחדל: 20)
     * @param loadMore - האם זה "טען עוד" (ברירת מחדל: false)
     * @returns Promise עם תוצאת הפגינציה
     *
     * @example
     * ```typescript
     * // טעינה ראשונית
     * const result = await firebasePagination.loadClientsPaginated();
     * console.log(result.items); // 20 לקוחות ראשונים
     *
     * // טעינת עוד
     * const more = await firebasePagination.loadClientsPaginated(20, true);
     * console.log(more.items); // 20 נוספים
     * ```
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
                    lastDoc: null,
                    totalLoaded: this.cache.clients.length,
                };
            }
            // בניית השאילתא
            let query = db
                .collection('clients')
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
                    ...data,
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
            }
            else {
                this.cache.clients = clients;
            }
            this._log(`Loaded ${clients.length} clients (hasMore: ${this.hasMore.clients})`);
            return {
                items: clients,
                hasMore: this.hasMore.clients,
                lastDoc: this.lastDocs.clients,
                totalLoaded: this.cache.clients.length,
            };
        }
        catch (error) {
            console.error('Firebase Pagination error (clients):', error);
            throw new Error(`שגיאה בטעינת לקוחות: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * טעינת משימות תקצוב עם פגינציה
     *
     * @param employee - שם העובד
     * @param limit - מספר רשומות
     * @param loadMore - האם זה "טען עוד"
     * @returns Promise עם תוצאת הפגינציה
     */
    async loadBudgetTasksPaginated(employee, limit = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE, loadMore = false) {
        try {
            const db = window.firebaseDB;
            if (!db) {
                throw new Error('Firebase לא מחובר');
            }
            if (!loadMore) {
                this.reset('budget_tasks');
            }
            if (!this.hasMore.budget_tasks && loadMore) {
                this._log('No more budget tasks to load');
                return {
                    items: [],
                    hasMore: false,
                    lastDoc: null,
                    totalLoaded: this.cache.budget_tasks.length,
                };
            }
            let query = db
                .collection('budget_tasks')
                .where('employee', '==', employee)
                .orderBy('createdAt', 'desc')
                .limit(limit);
            if (this.lastDocs.budget_tasks && loadMore) {
                query = query.startAfter(this.lastDocs.budget_tasks);
            }
            this._log(`Loading budget tasks for ${employee} (limit: ${limit}, loadMore: ${loadMore})`);
            const snapshot = await query.get();
            const tasks = [];
            snapshot.forEach((doc) => {
                const data = this._convertTimestamps(doc.data());
                const taskWithFirebaseId = {
                    ...data,
                    firebaseDocId: doc.id,
                };
                if (!taskWithFirebaseId.id) {
                    taskWithFirebaseId.id = doc.id;
                }
                tasks.push(taskWithFirebaseId);
            });
            if (snapshot.docs.length > 0) {
                this.lastDocs.budget_tasks = snapshot.docs[snapshot.docs.length - 1];
            }
            this.hasMore.budget_tasks = snapshot.docs.length === limit;
            if (loadMore) {
                this.cache.budget_tasks = [...this.cache.budget_tasks, ...tasks];
            }
            else {
                this.cache.budget_tasks = tasks;
            }
            this._log(`Loaded ${tasks.length} budget tasks (hasMore: ${this.hasMore.budget_tasks})`);
            return {
                items: tasks,
                hasMore: this.hasMore.budget_tasks,
                lastDoc: this.lastDocs.budget_tasks,
                totalLoaded: this.cache.budget_tasks.length,
            };
        }
        catch (error) {
            console.error('Firebase Pagination error (budget_tasks):', error);
            throw new Error(`שגיאה בטעינת משימות: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * טעינת שעתון עם פגינציה
     *
     * @param employee - שם העובד
     * @param limit - מספר רשומות
     * @param loadMore - האם זה "טען עוד"
     * @returns Promise עם תוצאת הפגינציה
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
                    lastDoc: null,
                    totalLoaded: this.cache.timesheet_entries.length,
                };
            }
            let query = db
                .collection('timesheet_entries')
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
                    ...data,
                });
            });
            if (snapshot.docs.length > 0) {
                this.lastDocs.timesheet_entries = snapshot.docs[snapshot.docs.length - 1];
            }
            this.hasMore.timesheet_entries = snapshot.docs.length === limit;
            if (loadMore) {
                this.cache.timesheet_entries = [...this.cache.timesheet_entries, ...entries];
            }
            else {
                this.cache.timesheet_entries = entries;
            }
            this._log(`Loaded ${entries.length} timesheet entries (hasMore: ${this.hasMore.timesheet_entries})`);
            return {
                items: entries,
                hasMore: this.hasMore.timesheet_entries,
                lastDoc: this.lastDocs.timesheet_entries,
                totalLoaded: this.cache.timesheet_entries.length,
            };
        }
        catch (error) {
            console.error('Firebase Pagination error (timesheet):', error);
            throw new Error(`שגיאה בטעינת שעתון: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * קבלת כל הנתונים שנטענו עד כה (מה-cache)
     */
    getCachedData(collectionName) {
        return (this.cache[collectionName] || []);
    }
    /**
     * קבלת סטטוס הפגינציה
     */
    getStatus(collectionName) {
        return {
            collection: collectionName,
            cachedItems: this.cache[collectionName]?.length || 0,
            hasMore: this.hasMore[collectionName],
            hasLastDoc: !!this.lastDocs[collectionName],
        };
    }
}
/* ===== IIFE Wrapper for Module ===== */
(function () {
    'use strict';
    // חשיפה כ-module גלובלי
    window.FirebasePaginationModule = {
        FirebasePaginationManager,
        /**
         * יצירת instance חדש
         */
        create() {
            return new FirebasePaginationManager();
        },
    };
})();
export { FirebasePaginationManager, PAGINATION_CONFIG };
//# sourceMappingURL=firebase-pagination.js.map