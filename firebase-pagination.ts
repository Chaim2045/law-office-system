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

import type {
  Client,
  BudgetTask,
  TimesheetEntry,
  PaginationResult,
} from './types';

/* ===== Type Declarations ===== */

/**
 * שמות Collections נתמכים
 */
type CollectionName = 'clients' | 'budget_tasks' | 'timesheet_entries';

/**
 * מפה בין שם Collection לטיפוס שלו
 */
interface CollectionTypeMap {
  clients: Client;
  budget_tasks: BudgetTask;
  timesheet_entries: TimesheetEntry;
}

/**
 * תצורת Pagination Module
 */
interface ModuleConfig {
  DEFAULT_PAGE_SIZE: number;
  MAX_PAGE_SIZE: number;
  ENABLE_LOGGING: boolean;
}

/**
 * סטטוס פגינציה
 */
interface PaginationStatus {
  collection: CollectionName;
  cachedItems: number;
  hasMore: boolean;
  hasLastDoc: boolean;
}

/**
 * Last documents storage
 */
type LastDocsMap = {
  [K in CollectionName]: firebase.firestore.QueryDocumentSnapshot | null;
};

/**
 * Cache storage
 */
type CacheMap = {
  [K in CollectionName]: any[];
};

/**
 * HasMore storage
 */
type HasMoreMap = {
  [K in CollectionName]: boolean;
};

/* ===== Global Window Declarations ===== */
declare global {
  interface Window {
    firebaseDB: firebase.firestore.Firestore;
    FirebasePaginationModule: {
      FirebasePaginationManager: typeof FirebasePaginationManager;
      create: () => FirebasePaginationManager;
    };
  }
}

/* ===== Configuration ===== */
const PAGINATION_CONFIG: ModuleConfig = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  ENABLE_LOGGING: false, // מצב פרודקשן - ללא הדפסות
};

/**
 * מחלקת FirebasePagination - ניהול פגינציה מקצועי
 */
class FirebasePaginationManager {
  private lastDocs: LastDocsMap;
  private cache: CacheMap;
  private hasMore: HasMoreMap;

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
  private _log(message: string, data: any = null): void {
    if (PAGINATION_CONFIG.ENABLE_LOGGING) {
      console.log(`🔥📄 Firebase Pagination: ${message}`, data || '');
    }
  }

  /**
   * המרת Firebase Timestamp ל-Date
   */
  private _convertTimestamps<T>(data: any): T {
    const converted = { ...data };

    // שדות תאריך נפוצים
    const dateFields = ['createdAt', 'updatedAt', 'completedAt', 'deadline', 'date'];

    dateFields.forEach((field) => {
      if (converted[field]?.toDate && typeof converted[field].toDate === 'function') {
        converted[field] = converted[field].toDate();
      }
    });

    return converted as T;
  }

  /**
   * איפוס הפגינציה לcollection מסוים
   */
  public reset(collectionName: CollectionName): void {
    this.lastDocs[collectionName] = null;
    this.cache[collectionName] = [];
    this.hasMore[collectionName] = true;
    this._log(`Reset pagination for ${collectionName}`);
  }

  /**
   * איפוס כל הפגינציה
   */
  public resetAll(): void {
    const collections: CollectionName[] = ['clients', 'budget_tasks', 'timesheet_entries'];
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
  public async loadClientsPaginated(
    limit: number = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
    loadMore: boolean = false
  ): Promise<PaginationResult<Client>> {
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
      let query: firebase.firestore.Query = db
        .collection('clients')
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // אם יש lastDoc - התחל אחריו
      if (this.lastDocs.clients && loadMore) {
        query = query.startAfter(this.lastDocs.clients);
      }

      this._log(`Loading clients (limit: ${limit}, loadMore: ${loadMore})`);

      const snapshot = await query.get();
      const clients: Client[] = [];

      snapshot.forEach((doc: firebase.firestore.QueryDocumentSnapshot) => {
        const data = this._convertTimestamps<Client>(doc.data());
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
      } else {
        this.cache.clients = clients;
      }

      this._log(`Loaded ${clients.length} clients (hasMore: ${this.hasMore.clients})`);

      return {
        items: clients,
        hasMore: this.hasMore.clients,
        lastDoc: this.lastDocs.clients,
        totalLoaded: this.cache.clients.length,
      };
    } catch (error) {
      console.error('Firebase Pagination error (clients):', error);
      throw new Error(
        `שגיאה בטעינת לקוחות: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
  public async loadBudgetTasksPaginated(
    employee: string,
    limit: number = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
    loadMore: boolean = false
  ): Promise<PaginationResult<BudgetTask>> {
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

      let query: firebase.firestore.Query = db
        .collection('budget_tasks')
        .where('employee', '==', employee)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (this.lastDocs.budget_tasks && loadMore) {
        query = query.startAfter(this.lastDocs.budget_tasks);
      }

      this._log(`Loading budget tasks for ${employee} (limit: ${limit}, loadMore: ${loadMore})`);

      const snapshot = await query.get();
      const tasks: BudgetTask[] = [];

      snapshot.forEach((doc: firebase.firestore.QueryDocumentSnapshot) => {
        const data = this._convertTimestamps<BudgetTask>(doc.data());

        const taskWithFirebaseId: BudgetTask & { firebaseDocId?: string } = {
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
      } else {
        this.cache.budget_tasks = tasks;
      }

      this._log(`Loaded ${tasks.length} budget tasks (hasMore: ${this.hasMore.budget_tasks})`);

      return {
        items: tasks,
        hasMore: this.hasMore.budget_tasks,
        lastDoc: this.lastDocs.budget_tasks,
        totalLoaded: this.cache.budget_tasks.length,
      };
    } catch (error) {
      console.error('Firebase Pagination error (budget_tasks):', error);
      throw new Error(
        `שגיאה בטעינת משימות: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
  public async loadTimesheetPaginated(
    employee: string,
    limit: number = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
    loadMore: boolean = false
  ): Promise<PaginationResult<TimesheetEntry>> {
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

      let query: firebase.firestore.Query = db
        .collection('timesheet_entries')
        .where('employee', '==', employee)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (this.lastDocs.timesheet_entries && loadMore) {
        query = query.startAfter(this.lastDocs.timesheet_entries);
      }

      this._log(`Loading timesheet for ${employee} (limit: ${limit}, loadMore: ${loadMore})`);

      const snapshot = await query.get();
      const entries: TimesheetEntry[] = [];

      snapshot.forEach((doc: firebase.firestore.QueryDocumentSnapshot) => {
        const data = this._convertTimestamps<TimesheetEntry>(doc.data());
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
      } else {
        this.cache.timesheet_entries = entries;
      }

      this._log(
        `Loaded ${entries.length} timesheet entries (hasMore: ${this.hasMore.timesheet_entries})`
      );

      return {
        items: entries,
        hasMore: this.hasMore.timesheet_entries,
        lastDoc: this.lastDocs.timesheet_entries,
        totalLoaded: this.cache.timesheet_entries.length,
      };
    } catch (error) {
      console.error('Firebase Pagination error (timesheet):', error);
      throw new Error(
        `שגיאה בטעינת שעתון: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * קבלת כל הנתונים שנטענו עד כה (מה-cache)
   */
  public getCachedData<K extends CollectionName>(collectionName: K): CollectionTypeMap[K][] {
    return (this.cache[collectionName] || []) as CollectionTypeMap[K][];
  }

  /**
   * קבלת סטטוס הפגינציה
   */
  public getStatus(collectionName: CollectionName): PaginationStatus {
    return {
      collection: collectionName,
      cachedItems: this.cache[collectionName]?.length || 0,
      hasMore: this.hasMore[collectionName],
      hasLastDoc: !!this.lastDocs[collectionName],
    };
  }
}

/* ===== IIFE Wrapper for Module ===== */
(function (): void {
  'use strict';

  // חשיפה כ-module גלובלי
  window.FirebasePaginationModule = {
    FirebasePaginationManager,

    /**
     * יצירת instance חדש
     */
    create(): FirebasePaginationManager {
      return new FirebasePaginationManager();
    },
  };
})();

export { FirebasePaginationManager, PAGINATION_CONFIG };
export type { CollectionName, PaginationStatus, ModuleConfig };
