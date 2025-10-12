/**
 * Employees Manager - API לניהול עובדים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 12/10/2025
 * גרסה: 1.0.0
 *
 * תפקיד:
 * - ניהול עובדים: הוספה/עריכה/מחיקה
 * - קריאת נתונים מ-Firebase
 * - אימות והרשאות
 * - Cache לביצועים
 */

(function() {
  'use strict';

  /* === Configuration === */
  const MANAGER_CONFIG = {
    CACHE_TTL: 300000,        // 5 דקות - cache
    DEBUG: false
  };

  /* === Logger === */
  const logger = {
    log: (...args) => {
      if (MANAGER_CONFIG.DEBUG) {
        console.log('[EmployeesManager]', ...args);
      }
    },
    error: (...args) => {
      console.error('[EmployeesManager ERROR]', ...args);
    }
  };

  /* === Cache === */
  let employeesCache = null;
  let cacheTimestamp = 0;

  /**
   * בדיקה אם ה-cache תקף
   */
  function isCacheValid() {
    return employeesCache && (Date.now() - cacheTimestamp < MANAGER_CONFIG.CACHE_TTL);
  }

  /**
   * ניקוי cache
   */
  function clearCache() {
    employeesCache = null;
    cacheTimestamp = 0;
    logger.log('🗑️ Cache cleared');
  }

  /* === Firebase Operations === */

  /**
   * טעינת כל העובדים מ-Firebase
   */
  async function loadAllEmployees(forceRefresh = false) {
    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    // אם יש cache תקף - השתמש בו
    if (!forceRefresh && isCacheValid()) {
      logger.log('📦 Using cached employees');
      return employeesCache;
    }

    try {
      logger.log('🔄 Loading employees from Firebase...');

      const snapshot = await window.firebaseDB.collection('employees').get();

      const employees = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        employees[doc.id] = {
          username: doc.id,
          password: data.password,
          name: data.name || data.displayName,
          displayName: data.displayName || data.name,
          email: data.email,
          isActive: data.isActive !== false,
          role: data.role || 'employee',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastLogin: data.lastLogin,
          loginCount: data.loginCount || 0
        };
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
  async function getEmployee(username) {
    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    try {
      const doc = await window.firebaseDB.collection('employees').doc(username).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return {
        username: doc.id,
        password: data.password,
        name: data.name || data.displayName,
        displayName: data.displayName || data.name,
        email: data.email,
        isActive: data.isActive !== false,
        role: data.role || 'employee',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastLogin: data.lastLogin,
        loginCount: data.loginCount || 0
      };

    } catch (error) {
      logger.error(`Failed to get employee ${username}:`, error);
      throw error;
    }
  }

  /**
   * הוספת עובד חדש
   */
  async function addEmployee(employeeData) {
    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    // Validation
    if (!employeeData.username || !employeeData.password || !employeeData.name) {
      throw new Error('Missing required fields: username, password, name');
    }

    // בדיקה אם כבר קיים
    const existing = await window.firebaseDB.collection('employees').doc(employeeData.username).get();
    if (existing.exists) {
      throw new Error(`Employee ${employeeData.username} already exists`);
    }

    try {
      const newEmployee = {
        username: employeeData.username,
        password: employeeData.password,  // TODO: encrypt in future
        name: employeeData.name,
        displayName: employeeData.name,
        email: employeeData.email || '',
        isActive: employeeData.isActive !== false,
        role: employeeData.role || 'employee',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: employeeData.createdBy || 'admin',
        lastLogin: null,
        loginCount: 0
      };

      await window.firebaseDB.collection('employees').doc(employeeData.username).set(newEmployee);

      // ניקוי cache
      clearCache();

      logger.log(`✅ Employee ${employeeData.username} added successfully`);
      return { success: true, username: employeeData.username };

    } catch (error) {
      logger.error('Failed to add employee:', error);
      throw error;
    }
  }

  /**
   * עדכון עובד קיים
   */
  async function updateEmployee(username, updates) {
    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    // בדיקה אם קיים
    const doc = await window.firebaseDB.collection('employees').doc(username).get();
    if (!doc.exists) {
      throw new Error(`Employee ${username} not found`);
    }

    try {
      const updateData = {
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
      return { success: true, username };

    } catch (error) {
      logger.error('Failed to update employee:', error);
      throw error;
    }
  }

  /**
   * מחיקת עובד (soft delete)
   */
  async function deleteEmployee(username, hardDelete = false) {
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
        await window.firebaseDB.collection('employees').doc(username).update({
          isActive: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        logger.log(`✅ Employee ${username} deactivated`);
      }

      // ניקוי cache
      clearCache();

      return { success: true, username };

    } catch (error) {
      logger.error('Failed to delete employee:', error);
      throw error;
    }
  }

  /**
   * שחזור עובד (אם נמחק soft delete)
   */
  async function restoreEmployee(username) {
    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    try {
      await window.firebaseDB.collection('employees').doc(username).update({
        isActive: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedAt: firebase.firestore.FieldValue.delete()
      });

      // ניקוי cache
      clearCache();

      logger.log(`✅ Employee ${username} restored`);
      return { success: true, username };

    } catch (error) {
      logger.error('Failed to restore employee:', error);
      throw error;
    }
  }

  /**
   * אימות כניסה
   */
  async function authenticate(username, password) {
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
      await window.firebaseDB.collection('employees').doc(username).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1)
      });

      logger.log(`✅ User ${username} authenticated successfully`);

      return {
        success: true,
        employee: employee
      };

    } catch (error) {
      logger.error('Authentication failed:', error);
      return { success: false, error: 'שגיאה באימות' };
    }
  }

  /**
   * חיפוש עובדים
   */
  async function searchEmployees(query) {
    const employees = await loadAllEmployees();
    const results = [];

    const lowerQuery = query.toLowerCase();

    Object.values(employees).forEach(emp => {
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
  async function getActiveEmployees() {
    const employees = await loadAllEmployees();
    return Object.values(employees).filter(emp => emp.isActive);
  }

  /**
   * קבלת סטטיסטיקות
   */
  async function getStats() {
    const employees = await loadAllEmployees();
    const allEmployees = Object.values(employees);

    return {
      total: allEmployees.length,
      active: allEmployees.filter(e => e.isActive).length,
      inactive: allEmployees.filter(e => !e.isActive).length,
      admins: allEmployees.filter(e => e.role === 'admin').length,
      employees: allEmployees.filter(e => e.role === 'employee').length
    };
  }

  /* === Public API === */
  window.EmployeesManager = {
    /**
     * טעינת כל העובדים
     */
    async loadAll(forceRefresh = false) {
      return await loadAllEmployees(forceRefresh);
    },

    /**
     * טעינת עובד ספציפי
     */
    async get(username) {
      return await getEmployee(username);
    },

    /**
     * הוספת עובד חדש
     */
    async add(employeeData) {
      return await addEmployee(employeeData);
    },

    /**
     * עדכון עובד
     */
    async update(username, updates) {
      return await updateEmployee(username, updates);
    },

    /**
     * מחיקת עובד
     */
    async delete(username, hardDelete = false) {
      return await deleteEmployee(username, hardDelete);
    },

    /**
     * שחזור עובד
     */
    async restore(username) {
      return await restoreEmployee(username);
    },

    /**
     * אימות כניסה
     */
    async authenticate(username, password) {
      return await authenticate(username, password);
    },

    /**
     * חיפוש עובדים
     */
    async search(query) {
      return await searchEmployees(query);
    },

    /**
     * עובדים פעילים בלבד
     */
    async getActive() {
      return await getActiveEmployees();
    },

    /**
     * סטטיסטיקות
     */
    async getStats() {
      return await getStats();
    },

    /**
     * ניקוי cache
     */
    clearCache() {
      clearCache();
    },

    /**
     * הגדרות
     */
    config: MANAGER_CONFIG
  };

  logger.log('📦 Employees Manager module loaded');

})();
