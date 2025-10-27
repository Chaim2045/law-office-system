/**
 * Employees Manager - API לניהול עובדים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 12/10/2025
 * גרסה: 2.0.0 - TypeScript Edition
 *
 * תפקיד:
 * - ניהול עובדים: הוספה/עריכה/מחיקה
 * - קריאת נתונים מ-Firebase
 * - אימות והרשאות
 * - Cache לביצועים
 */
import type { Employee, EmployeesRecord, ManagerConfig, Result } from './types';
declare global {
    interface Window {
        firebaseDB: firebase.firestore.Firestore;
        EmployeesManager: EmployeesManagerAPI;
    }
}
/**
 * נתוני עובד חדש להוספה
 */
interface NewEmployeeData {
    username: string;
    password: string;
    name: string;
    email?: string;
    isActive?: boolean;
    role?: 'admin' | 'employee' | 'manager';
    createdBy?: string;
}
/**
 * נתונים לעדכון עובד
 */
interface EmployeeUpdates {
    password?: string;
    name?: string;
    email?: string;
    isActive?: boolean;
    role?: 'admin' | 'employee' | 'manager';
}
/**
 * תוצאת אימות
 */
interface AuthResult {
    success: boolean;
    error?: string;
    employee?: Employee;
}
/**
 * סטטיסטיקות עובדים
 */
interface EmployeeStats {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    employees: number;
    managers: number;
}
interface EmployeesManagerAPI {
    loadAll(forceRefresh?: boolean): Promise<EmployeesRecord>;
    get(username: string): Promise<Employee | null>;
    add(employeeData: NewEmployeeData): Promise<Result<string>>;
    update(username: string, updates: EmployeeUpdates): Promise<Result<string>>;
    delete(username: string, hardDelete?: boolean): Promise<Result<string>>;
    restore(username: string): Promise<Result<string>>;
    authenticate(username: string, password: string): Promise<AuthResult>;
    search(query: string): Promise<Employee[]>;
    getActive(): Promise<Employee[]>;
    getStats(): Promise<EmployeeStats>;
    clearCache(): void;
    config: ManagerConfig;
}
export {};
//# sourceMappingURL=employees-manager.d.ts.map