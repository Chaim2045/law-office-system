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

import type {
  Employee,
  EmployeesRecord,
  ManagerConfig,
  Logger,
  Result,
} from './types';

/* ===== Type Declarations for Window ===== */
declare global {
  interface Window {
    firebaseDB: firebase.firestore.Firestore;
    EmployeesManager: EmployeesManagerAPI;
  }
}

/* ===== Configuration ===== */
const MANAGER_CONFIG: ManagerConfig = {
  CACHE_TTL: 300000, // 5 דקות - cache
  DEBUG: false,
};

/* ===== Logger ===== */
const logger: Logger = {
  log: (...args: any[]): void => {
    if (MANAGER_CONFIG.DEBUG) {
      console.log('[EmployeesManager]', ...args);
    }
  },
  error: (...args: any[]): void => {
    console.error('[EmployeesManager ERROR]', ...args);
  },
};

/* ===== Cache ===== */
let employeesCache: EmployeesRecord | null = null;
let cacheTimestamp: number = 0;

/**
 * בדיקה אם ה-cache תקף
 */
function isCacheValid(): boolean {
  return employeesCache !== null && Date.now() - cacheTimestamp < MANAGER_CONFIG.CACHE_TTL;
}

/**
 * ניקוי cache
 */
function clearCache(): void {
  employeesCache = null;
  cacheTimestamp = 0;
  logger.log('🗑️ Cache cleared');
}

/* ===== Firebase Operations ===== */

/**
 * המרת נתוני Firebase לEmployee
 */
function mapFirebaseDataToEmployee(docId: string, data: firebase.firestore.DocumentData): Employee {
  return {
    username: docId,
    password: data.password as string,
    name: (data.name || data.displayName) as string,
    displayName: (data.displayName || data.name) as string,
    email: data.email as string,
    isActive: data.isActive !== false,
    role: (data.role || 'employee') as 'admin' | 'employee' | 'manager',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastLogin: data.lastLogin,
    loginCount: (data.loginCount || 0) as number,
  };
}

/**
 * טעינת כל העובדים מ-Firebase
 */
async function loadAllEmployees(forceRefresh: boolean = false): Promise<EmployeesRecord> {
  if (!window.firebaseDB) {
    throw new Error('Firebase DB not available');
  }

  // אם יש cache תקף - השתמש בו
  if (!forceRefresh && isCacheValid() && employeesCache) {
    logger.log('📦 Using cached employees');
    return employeesCache;
  }

  try {
    logger.log('🔄 Loading employees from Firebase...');

    const snapshot = await window.firebaseDB.collection('employees').get();

    const employees: EmployeesRecord = {};
    snapshot.forEach((doc: firebase.firestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      employees[doc.id] = mapFirebaseDataToEmployee(doc.id, data);
    });

    // שמירה ב-cache
    employeesCache = employees;
    cacheTimestamp = Date.now();

    logger.log(`✅ Loaded ${Object.keys(employees).length} employees`);
    return employees;
  } catch (error) {
    logger.error('Failed to load employees:', error);
    throw error;
  }
}

/**
 * טעינת עובד ספציפי
 */
async function getEmployee(username: string): Promise<Employee | null> {
  if (!window.firebaseDB) {
    throw new Error('Firebase DB not available');
  }

  try {
    const doc = await window.firebaseDB.collection('employees').doc(username).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return mapFirebaseDataToEmployee(doc.id, data);
  } catch (error) {
    logger.error(`Failed to get employee ${username}:`, error);
    throw error;
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
 * הוספת עובד חדש
 */
async function addEmployee(employeeData: NewEmployeeData): Promise<Result<string>> {
  if (!window.firebaseDB) {
    throw new Error('Firebase DB not available');
  }

  // Validation
  if (!employeeData.username || !employeeData.password || !employeeData.name) {
    return {
      success: false,
      error: 'Missing required fields: username, password, name',
    };
  }

  // בדיקה אם כבר קיים
  const existing = await window.firebaseDB
    .collection('employees')
    .doc(employeeData.username)
    .get();

  if (existing.exists) {
    return {
      success: false,
      error: `Employee ${employeeData.username} already exists`,
    };
  }

  try {
    const newEmployee = {
      username: employeeData.username,
      password: employeeData.password, // TODO: encrypt in future
      name: employeeData.name,
      displayName: employeeData.name,
      email: employeeData.email || '',
      isActive: employeeData.isActive !== false,
      role: employeeData.role || 'employee',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: employeeData.createdBy || 'admin',
      lastLogin: null,
      loginCount: 0,
    };

    await window.firebaseDB
      .collection('employees')
      .doc(employeeData.username)
      .set(newEmployee);

    // ניקוי cache
    clearCache();

    logger.log(`✅ Employee ${employeeData.username} added successfully`);
    return { success: true, data: employeeData.username };
  } catch (error) {
    logger.error('Failed to add employee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
 * עדכון עובד קיים
 */
async function updateEmployee(
  username: string,
  updates: EmployeeUpdates
): Promise<Result<string>> {
  if (!window.firebaseDB) {
    throw new Error('Firebase DB not available');
  }

  // בדיקה אם קיים
  const doc = await window.firebaseDB.collection('employees').doc(username).get();
  if (!doc.exists) {
    return {
      success: false,
      error: `Employee ${username} not found`,
    };
  }

  try {
    const updateData: any = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // עדכון רק השדות שנשלחו
    if (updates.password !== undefined) updateData.password = updates.password;
    if (updates.name !== undefined) {
      updateData.name = updates.name;
      updateData.displayName = updates.name;
    }
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.role !== undefined) updateData.role = updates.role;

    await window.firebaseDB.collection('employees').doc(username).update(updateData);

    // ניקוי cache
    clearCache();

    logger.log(`✅ Employee ${username} updated successfully`);
    return { success: true, data: username };
  } catch (error) {
    logger.error('Failed to update employee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * מחיקת עובד (soft delete)
 */
async function deleteEmployee(
  username: string,
  hardDelete: boolean = false
): Promise<Result<string>> {
  if (!window.firebaseDB) {
    throw new Error('Firebase DB not available');
  }

  try {
    if (hardDelete) {
      // מחיקה קשה - מוחק לגמרי
      await window.firebaseDB.collection('employees').doc(username).delete();
      logger.log(`✅ Employee ${username} deleted permanently`);
    } else {
      // מחיקה רכה - רק isActive = false
      await window.firebaseDB
        .collection('employees')
        .doc(username)
        .update({
          isActive: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      logger.log(`✅ Employee ${username} deactivated`);
    }

    // ניקוי cache
    clearCache();

    return { success: true, data: username };
  } catch (error) {
    logger.error('Failed to delete employee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * שחזור עובד (אם נמחק soft delete)
 */
async function restoreEmployee(username: string): Promise<Result<string>> {
  if (!window.firebaseDB) {
    throw new Error('Firebase DB not available');
  }

  try {
    await window.firebaseDB
      .collection('employees')
      .doc(username)
      .update({
        isActive: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedAt: firebase.firestore.FieldValue.delete(),
      });

    // ניקוי cache
    clearCache();

    logger.log(`✅ Employee ${username} restored`);
    return { success: true, data: username };
  } catch (error) {
    logger.error('Failed to restore employee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
 * אימות כניסה
 */
async function authenticate(username: string, password: string): Promise<AuthResult> {
  try {
    const employee = await getEmployee(username);

    if (!employee) {
      return { success: false, error: 'המשתמש לא קיים' };
    }

    if (!employee.isActive) {
      return { success: false, error: 'החשבון מושבת' };
    }

    if (employee.password !== password) {
      return { success: false, error: 'סיסמה שגויה' };
    }

    // עדכון lastLogin
    await window.firebaseDB
      .collection('employees')
      .doc(username)
      .update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1),
      });

    logger.log(`✅ User ${username} authenticated successfully`);

    return {
      success: true,
      employee: employee,
    };
  } catch (error) {
    logger.error('Authentication failed:', error);
    return { success: false, error: 'שגיאה באימות' };
  }
}

/**
 * חיפוש עובדים
 */
async function searchEmployees(query: string): Promise<Employee[]> {
  const employees = await loadAllEmployees();
  const results: Employee[] = [];

  const lowerQuery = query.toLowerCase();

  Object.values(employees).forEach((emp) => {
    if (
      emp.username.toLowerCase().includes(lowerQuery) ||
      emp.name.toLowerCase().includes(lowerQuery) ||
      emp.email.toLowerCase().includes(lowerQuery)
    ) {
      results.push(emp);
    }
  });

  return results;
}

/**
 * קבלת עובדים פעילים בלבד
 */
async function getActiveEmployees(): Promise<Employee[]> {
  const employees = await loadAllEmployees();
  return Object.values(employees).filter((emp) => emp.isActive);
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

/**
 * קבלת סטטיסטיקות
 */
async function getStats(): Promise<EmployeeStats> {
  const employees = await loadAllEmployees();
  const allEmployees = Object.values(employees);

  return {
    total: allEmployees.length,
    active: allEmployees.filter((e) => e.isActive).length,
    inactive: allEmployees.filter((e) => !e.isActive).length,
    admins: allEmployees.filter((e) => e.role === 'admin').length,
    employees: allEmployees.filter((e) => e.role === 'employee').length,
    managers: allEmployees.filter((e) => e.role === 'manager').length,
  };
}

/* ===== Public API Interface ===== */
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

/* ===== IIFE Wrapper for Module ===== */
(function (): void {
  'use strict';

  /* === Public API === */
  window.EmployeesManager = {
    /**
     * טעינת כל העובדים
     */
    async loadAll(forceRefresh: boolean = false): Promise<EmployeesRecord> {
      return await loadAllEmployees(forceRefresh);
    },

    /**
     * טעינת עובד ספציפי
     */
    async get(username: string): Promise<Employee | null> {
      return await getEmployee(username);
    },

    /**
     * הוספת עובד חדש
     */
    async add(employeeData: NewEmployeeData): Promise<Result<string>> {
      return await addEmployee(employeeData);
    },

    /**
     * עדכון עובד
     */
    async update(username: string, updates: EmployeeUpdates): Promise<Result<string>> {
      return await updateEmployee(username, updates);
    },

    /**
     * מחיקת עובד
     */
    async delete(username: string, hardDelete: boolean = false): Promise<Result<string>> {
      return await deleteEmployee(username, hardDelete);
    },

    /**
     * שחזור עובד
     */
    async restore(username: string): Promise<Result<string>> {
      return await restoreEmployee(username);
    },

    /**
     * אימות כניסה
     */
    async authenticate(username: string, password: string): Promise<AuthResult> {
      return await authenticate(username, password);
    },

    /**
     * חיפוש עובדים
     */
    async search(query: string): Promise<Employee[]> {
      return await searchEmployees(query);
    },

    /**
     * עובדים פעילים בלבד
     */
    async getActive(): Promise<Employee[]> {
      return await getActiveEmployees();
    },

    /**
     * סטטיסטיקות
     */
    async getStats(): Promise<EmployeeStats> {
      return await getStats();
    },

    /**
     * ניקוי cache
     */
    clearCache(): void {
      clearCache();
    },

    /**
     * הגדרות
     */
    config: MANAGER_CONFIG,
  };

  logger.log('📦 Employees Manager module loaded (TypeScript Edition)');
})();
