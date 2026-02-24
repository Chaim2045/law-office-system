/**
 * Types & Interfaces - מערכת ניהול משרד עורכי דין
 * קובץ טיפוסים מרכזי לכל הפרויקט
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 */
/**
 * Firebase Timestamp type
 */
export type FirebaseTimestamp = {
    toDate(): Date;
    seconds: number;
    nanoseconds: number;
};
/**
 * תאריך שיכול להיות Date או Firebase Timestamp
 */
export type Timestamp = Date | FirebaseTimestamp;
/**
 * תפקיד עובד במערכת
 */
export type EmployeeRole = 'admin' | 'employee' | 'manager';
/**
 * ממשק עובד מלא
 */
export interface Employee {
    /** שם משתמש ייחודי */
    username: string;
    /** סיסמה (צריך להיות מוצפנת!) */
    password: string;
    /** שם לתצוגה */
    name: string;
    /** שם לתצוגה (אלטרנטיבי) */
    displayName: string;
    /** כתובת אימייל */
    email: string;
    /** האם העובד פעיל */
    isActive: boolean;
    /** תפקיד העובד */
    role: EmployeeRole;
    /** תאריך יצירה */
    createdAt?: Timestamp;
    /** תאריך עדכון אחרון */
    updatedAt?: Timestamp;
    /** תאריך כניסה אחרונה */
    lastLogin?: Timestamp;
    /** מספר כניסות */
    loginCount?: number;
}
/**
 * נתוני עובד חלקיים (להוספה/עדכון)
 */
export type PartialEmployee = Partial<Employee> & {
    username: string;
};
/**
 * סוג לקוח
 */
export type ClientType = 'hours' | 'stages';
/**
 * ממשק לקוח
 */
export interface Client {
    /** מזהה ייחודי */
    id?: string;
    /** שם מלא */
    fullName: string;
    /** מספר תיק */
    fileNumber: string;
    /** סוג לקוח */
    type: ClientType;
    /** כמות שעות (רק אם type = 'hours') */
    hoursAmount?: number;
    /** שלבים (רק אם type = 'stages') */
    stages?: string[];
    /** תאריך יצירה */
    createdAt?: Timestamp;
    /** תאריך עדכון */
    updatedAt?: Timestamp;
}
/**
 * סטטוס משימה
 */
export type TaskStatus = 'active' | 'completed' | 'urgent';
/**
 * ממשק משימת תקצוב
 */
export interface BudgetTask {
    /** מזהה ייחודי */
    id?: string;
    /** שם העובד */
    employee: string;
    /** שם המשימה */
    taskName: string;
    /** שם הלקוח */
    clientName: string;
    /** זמן משוער בדקות */
    estimatedMinutes: number;
    /** זמן בפועל בדקות */
    actualMinutes: number;
    /** תאריך יעד */
    deadline: Timestamp;
    /** סטטוס */
    status: TaskStatus;
    /** תאריך יצירה */
    createdAt?: Timestamp;
    /** תאריך עדכון */
    updatedAt?: Timestamp;
    /** תאריך סיום */
    completedAt?: Timestamp;
}
/**
 * ממשק רשומת שעתון
 */
export interface TimesheetEntry {
    /** מזהה ייחודי */
    id?: string;
    /** שם העובד */
    employee: string;
    /** שם הלקוח */
    clientName: string;
    /** דקות */
    minutes: number;
    /** תיאור */
    description: string;
    /** תאריך */
    date: Timestamp;
    /** תאריך יצירה */
    createdAt?: Timestamp;
}
/**
 * תוצאת פגינציה כללית
 */
export interface PaginationResult<T> {
    /** הפריטים שנטענו */
    items: T[];
    /** האם יש עוד פריטים */
    hasMore: boolean;
    /** Document אחרון (לפגינציה הבאה) */
    lastDoc: any | null;
    /** סה"כ פריטים שנטענו */
    totalLoaded: number;
}
/**
 * תצורת פגינציה
 */
export interface PaginationConfig {
    /** גודל עמוד */
    pageSize: number;
    /** שדה למיון */
    orderByField: string;
    /** כיוון מיון */
    orderDirection: 'asc' | 'desc';
}
/**
 * תוצאת פעולה מוצלחת
 */
export interface SuccessResult<T> {
    success: true;
    data: T;
}
/**
 * תוצאת פעולה כושלת
 */
export interface ErrorResult {
    success: false;
    error: string;
    code?: string;
}
/**
 * תוצאת פעולה כללית
 */
export type Result<T> = SuccessResult<T> | ErrorResult;
/**
 * סוג פעילות
 */
export type ActivityType = 'employee_add' | 'employee_update' | 'employee_delete' | 'client_add' | 'client_update' | 'client_delete' | 'task_add' | 'task_update' | 'task_complete' | 'timesheet_add';
/**
 * ממשק פעילות
 */
export interface Activity {
    /** מזהה ייחודי */
    id?: string;
    /** סוג הפעילות */
    type: ActivityType;
    /** שם המשתמש */
    username: string;
    /** תיאור */
    description: string;
    /** נתונים נוספים */
    metadata?: Record<string, any>;
    /** תאריך */
    timestamp: Timestamp;
}
/**
 * תצורת Features
 */
export interface FeatureConfig {
    /** שימוש בפגינציה מ-Firebase */
    USE_FIREBASE_PAGINATION: boolean;
    /** גודל עמוד בפגינציה */
    PAGINATION_PAGE_SIZE: number;
    /** זמן המתנה ל-skeleton */
    SKELETON_DELAY_MS: number;
    /** שמירת מיקום גלילה */
    ENABLE_SCROLL_PRESERVATION: boolean;
    /** מצב דיבאג */
    DEBUG_MODE: boolean;
}
/**
 * תצורת מנהל
 */
export interface ManagerConfig {
    /** זמן תוקף cache (ms) */
    CACHE_TTL: number;
    /** מצב דיבאג */
    DEBUG: boolean;
}
/**
 * רשומה של עובדים (מפתח = username)
 */
export type EmployeesRecord = Record<string, Employee>;
/**
 * פונקציית callback
 */
export type Callback<T = void> = () => T;
/**
 * פונקציית callback אסינכרונית
 */
export type AsyncCallback<T = void> = () => Promise<T>;
/**
 * Logger interface
 */
export interface Logger {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
}
//# sourceMappingURL=index.d.ts.map