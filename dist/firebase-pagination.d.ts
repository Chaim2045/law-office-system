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
import type { Client, BudgetTask, TimesheetEntry, PaginationResult } from './types';
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
declare global {
    interface Window {
        firebaseDB: firebase.firestore.Firestore;
        FirebasePaginationModule: {
            FirebasePaginationManager: typeof FirebasePaginationManager;
            create: () => FirebasePaginationManager;
        };
    }
}
declare const PAGINATION_CONFIG: ModuleConfig;
/**
 * מחלקת FirebasePagination - ניהול פגינציה מקצועי
 */
declare class FirebasePaginationManager {
    private lastDocs;
    private cache;
    private hasMore;
    constructor();
    /**
     * לוג מותאם
     */
    private _log;
    /**
     * המרת Firebase Timestamp ל-Date
     */
    private _convertTimestamps;
    /**
     * איפוס הפגינציה לcollection מסוים
     */
    reset(collectionName: CollectionName): void;
    /**
     * איפוס כל הפגינציה
     */
    resetAll(): void;
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
    loadClientsPaginated(limit?: number, loadMore?: boolean): Promise<PaginationResult<Client>>;
    /**
     * טעינת משימות תקצוב עם פגינציה
     *
     * @param employee - שם העובד
     * @param limit - מספר רשומות
     * @param loadMore - האם זה "טען עוד"
     * @returns Promise עם תוצאת הפגינציה
     */
    loadBudgetTasksPaginated(employee: string, limit?: number, loadMore?: boolean): Promise<PaginationResult<BudgetTask>>;
    /**
     * טעינת שעתון עם פגינציה
     *
     * @param employee - שם העובד
     * @param limit - מספר רשומות
     * @param loadMore - האם זה "טען עוד"
     * @returns Promise עם תוצאת הפגינציה
     */
    loadTimesheetPaginated(employee: string, limit?: number, loadMore?: boolean): Promise<PaginationResult<TimesheetEntry>>;
    /**
     * קבלת כל הנתונים שנטענו עד כה (מה-cache)
     */
    getCachedData<K extends CollectionName>(collectionName: K): CollectionTypeMap[K][];
    /**
     * קבלת סטטוס הפגינציה
     */
    getStatus(collectionName: CollectionName): PaginationStatus;
}
export { FirebasePaginationManager, PAGINATION_CONFIG };
export type { CollectionName, PaginationStatus, ModuleConfig };
//# sourceMappingURL=firebase-pagination.d.ts.map