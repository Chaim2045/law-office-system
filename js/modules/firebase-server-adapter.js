/**
 * Firebase Server Adapter - Bridge Between Old and New
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 12/10/2025
 * גרסה: 1.0.0
 *
 * תפקיד:
 * - גשר בין הקוד הישן (Firebase Client ישיר) לחדש (Firebase Functions)
 * - מאפשר מעבר הדרגתי עם feature flags
 * - תואם לחלוטין ל-API הקיים (backwards compatible)
 * - מאפשר rollback מיידי במקרה בעיה
 *
 * שימוש:
 * 1. טוען את הקובץ אחרי script.js
 * 2. משנה feature flags לפי הצורך
 * 3. הקוד הקיים עובד בלי שינויים!
 */

(function() {
  'use strict';

  /* === Feature Flags - זה המפסק הראשי! === */
  const FEATURE_FLAGS = {
    // לקוחות
    USE_FUNCTIONS_FOR_CLIENTS: true, // true = דרך Functions (חדש)

    // שעתון
    USE_FUNCTIONS_FOR_TIMESHEET: true,

    // משימות תקצוב
    USE_FUNCTIONS_FOR_BUDGET: true,

    // Debug mode
    DEBUG: false // מצב פרודקשן - ללא הדפסות
  };

  /* === Logger === */
  const logger = {
    log: (...args) => {
      if (FEATURE_FLAGS.DEBUG) {
        console.log('[Server Adapter]', ...args);
      }
    },
    warn: (...args) => {
      console.warn('[Server Adapter]', ...args);
    },
    error: (...args) => {
      console.error('[Server Adapter ERROR]', ...args);
    }
  };

  /* === Client Instance === */
  let apiClientV2 = null;

  /**
   * אתחול API Client V2
   */
  function initializeClientV2() {
    if (!window.FirebaseFunctionsClientV2) {
      logger.error('FirebaseFunctionsClientV2 not loaded! Make sure api-client-v2.js is loaded first.');
      return false;
    }

    if (!apiClientV2) {
      apiClientV2 = window.FirebaseFunctionsClientV2.create();
    }

    return true;
  }

  /* === 1. לקוחות - Clients === */

  /**
   * שמירת הפונקציה המקורית (הישנה)
   */
  const loadClientsFromFirebase_ORIGINAL = window.loadClientsFromFirebase;

  /**
   * גרסה חדשה - דרך Functions
   */
  async function loadClientsFromFirebase_NEW() {
    logger.log('🔥 loadClientsFromFirebase_NEW called - using Firebase Functions!');

    if (!initializeClientV2()) {
      return await loadClientsFromFirebase_ORIGINAL();
    }

    try {
      const clients = await apiClientV2.getClients(true); // עם cache
      logger.log(`✅ Loaded ${clients.length} clients via Firebase Functions`);
      return clients;
    } catch (error) {
      logger.error('Failed to load clients from Functions, falling back:', error);
      return await loadClientsFromFirebase_ORIGINAL();
    }
  }

  /**
   * החלפת הפונקציה הגלובלית - עם feature flag
   */
  window.loadClientsFromFirebase = async function() {
    if (FEATURE_FLAGS.USE_FUNCTIONS_FOR_CLIENTS) {
      return await loadClientsFromFirebase_NEW();
    } else {
      return await loadClientsFromFirebase_ORIGINAL();
    }
  };

  /* === 2. שעתון - Timesheet === */

  /**
   * שמירת הפונקציות המקוריות
   */
  const loadTimesheetFromFirebase_ORIGINAL = window.loadTimesheetFromFirebase;
  const updateTimesheetEntryFirebase_ORIGINAL = window.updateTimesheetEntryFirebase;

  /**
   * גרסה חדשה - טעינת שעתון דרך Functions
   */
  async function loadTimesheetFromFirebase_NEW(employee) {
    logger.log(`🔥 loadTimesheetFromFirebase_NEW called for ${employee} - using Firebase Functions!`);

    if (!initializeClientV2()) {
      return await loadTimesheetFromFirebase_ORIGINAL(employee);
    }

    try {
      const entries = await apiClientV2.getTimesheetEntries(employee);
      logger.log(`✅ Loaded ${entries.length} timesheet entries via Firebase Functions`);
      return entries;
    } catch (error) {
      logger.error('❌ Failed to load timesheet from Functions:', error);
      throw error;  // לא נופלים ל-v1
    }
  }

  /**
   * גרסה חדשה - שמירת שעתון דרך Functions
   */
  async function saveTimesheetToFirebase_NEW(entry) {
    if (!initializeClientV2()) {
      throw new Error('apiClientV2 not initialized - v1 fallback removed');
    }

    try {
      const result = await apiClientV2.saveTimesheetAndUpdateClient(entry);
      return result;
    } catch (error) {
      logger.error('❌ Failed to save timesheet via Functions:', error);
      throw error;
    }
  }

  /**
   * גרסה חדשה - עדכון רשומה דרך Functions
   */
  async function updateTimesheetEntryFirebase_NEW(entryId, updates) {
    if (!initializeClientV2()) {
      return await updateTimesheetEntryFirebase_ORIGINAL(entryId, updates);
    }

    try {
      const result = await apiClientV2.updateTimesheetEntry(entryId, updates);
      return result;
    } catch (error) {
      logger.error('❌ Failed to update timesheet via Functions:', error);
      throw error;  // לא נופלים ל-v1, מעדיפים שגיאה על פני נתונים שבורים
    }
  }

  /**
   * החלפת הפונקציות הגלובליות - עם feature flag
   */
  window.loadTimesheetFromFirebase = async function(employee) {
    if (FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET) {
      return await loadTimesheetFromFirebase_NEW(employee);
    } else {
      return await loadTimesheetFromFirebase_ORIGINAL(employee);
    }
  };

  window.saveTimesheetToFirebase = async function(entry) {
    if (!FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET) {
      throw new Error('USE_FUNCTIONS_FOR_TIMESHEET must be true - v1 removed');
    }
    return await saveTimesheetToFirebase_NEW(entry);
  };

  window.updateTimesheetEntryFirebase = async function(entryId, updates) {
    if (FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET) {
      return await updateTimesheetEntryFirebase_NEW(entryId, updates);
    } else {
      return await updateTimesheetEntryFirebase_ORIGINAL(entryId, updates);
    }
  };

  /* === 3. משימות תקצוב - Budget Tasks === */

  /**
   * שמירת הפונקציות המקוריות
   */
  const loadBudgetTasksFromFirebase_ORIGINAL = window.loadBudgetTasksFromFirebase;
  const saveBudgetTaskToFirebase_ORIGINAL = window.saveBudgetTaskToFirebase;

  /**
   * גרסה חדשה - טעינת משימות דרך Functions
   */
  async function loadBudgetTasksFromFirebase_NEW(employee) {
    logger.log(`🔥 loadBudgetTasksFromFirebase_NEW called for ${employee} - using Firebase Functions!`);

    if (!initializeClientV2()) {
      return await loadBudgetTasksFromFirebase_ORIGINAL(employee);
    }

    try {
      const tasks = await apiClientV2.getBudgetTasks(employee);
      logger.log(`✅ Loaded ${tasks.length} budget tasks via Firebase Functions`);
      return tasks;
    } catch (error) {
      logger.error('Failed to load budget tasks from Functions, falling back:', error);
      return await loadBudgetTasksFromFirebase_ORIGINAL(employee);
    }
  }

  /**
   * גרסה חדשה - שמירת משימה דרך Functions
   */
  async function saveBudgetTaskToFirebase_NEW(task) {
    if (!initializeClientV2()) {
      return await saveBudgetTaskToFirebase_ORIGINAL(task);
    }

    try {
      const result = await apiClientV2.saveBudgetTask(task);
      return result;
    } catch (error) {
      logger.error('Failed to save budget task via Functions, falling back:', error);
      return await saveBudgetTaskToFirebase_ORIGINAL(task);
    }
  }

  /**
   * החלפת הפונקציות הגלובליות - עם feature flag
   */
  window.loadBudgetTasksFromFirebase = async function(employee) {
    if (FEATURE_FLAGS.USE_FUNCTIONS_FOR_BUDGET) {
      return await loadBudgetTasksFromFirebase_NEW(employee);
    } else {
      return await loadBudgetTasksFromFirebase_ORIGINAL(employee);
    }
  };

  window.saveBudgetTaskToFirebase = async function(task) {
    if (FEATURE_FLAGS.USE_FUNCTIONS_FOR_BUDGET) {
      return await saveBudgetTaskToFirebase_NEW(task);
    } else {
      return await saveBudgetTaskToFirebase_ORIGINAL(task);
    }
  };

  /**
   * הוספת זמן למשימה דרך Cloud Function
   * @param {string} taskId - מזהה משימה
   * @param {number} minutes - דקות לזמן
   * @param {string} description - תיאור הפעולה
   * @param {string} date - תאריך העבודה
   * @returns {Promise<Object>} תוצאה עם actualHours/actualMinutes מעודכנים
   */
  window.addTimeToTaskFirebase = async function(taskId, minutes, description, date) {
    logger.log(`🔥 addTimeToTaskFirebase called for task ${taskId}, minutes: ${minutes}`);

    if (!firebase || !firebase.functions) {
      throw new Error('Firebase Functions not initialized');
    }

    try {
      const addTimeToTask = firebase.functions().httpsCallable('addTimeToTask');
      const result = await addTimeToTask({
        taskId,
        minutes,
        description,
        date
      });

      logger.log('✅ addTimeToTask completed:', result.data);
      return result.data;
    } catch (error) {
      logger.error('Error calling addTimeToTask:', error);
      throw error;
    }
  };

  /* === Admin & Control === */

  /**
   * חשיפת API לבקרה ובדיקות
   */
  window.FirebaseServerAdapter = {
    // Feature flags control
    flags: FEATURE_FLAGS,

    /**
     * הפעלת feature flag ספציפי
     */
    enable(flag) {
      if (flag in FEATURE_FLAGS) {
        FEATURE_FLAGS[flag] = true;
      } else {
        logger.error(`Unknown flag: ${flag}`);
      }
    },

    /**
     * כיבוי feature flag ספציפי
     */
    disable(flag) {
      if (flag in FEATURE_FLAGS) {
        FEATURE_FLAGS[flag] = false;
      } else {
        logger.error(`Unknown flag: ${flag}`);
      }
    },

    /**
     * הפעלת הכל
     */
    enableAll() {
      FEATURE_FLAGS.USE_FUNCTIONS_FOR_CLIENTS = true;
      FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET = true;
      FEATURE_FLAGS.USE_FUNCTIONS_FOR_BUDGET = true;
    },

    /**
     * כיבוי הכל (rollback)
     */
    disableAll() {
      FEATURE_FLAGS.USE_FUNCTIONS_FOR_CLIENTS = false;
      FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET = false;
      FEATURE_FLAGS.USE_FUNCTIONS_FOR_BUDGET = false;
    },

    /**
     * מצב נוכחי
     */
    getStatus() {
      return {
        flags: { ...FEATURE_FLAGS },
        clientV2Ready: apiClientV2 !== null,
        clientV2Status: apiClientV2 ? apiClientV2.getStatus() : null
      };
    },

    /**
     * בדיקת חיבור לשרת
     */
    async testConnection() {
      if (!initializeClientV2()) {
        throw new Error('API Client V2 not initialized');
      }

      try {
        const result = await apiClientV2.testConnection();
        return result;
      } catch (error) {
        logger.error('Server connection test failed:', error);
        throw error;
      }
    },

    /**
     * מחיקת cache
     */
    clearCache() {
      if (apiClientV2) {
        apiClientV2.clearCache();
      }
    },

    // גישה ל-client V2
    getClientV2() {
      return apiClientV2;
    },

    // Original functions (לבדיקות ישירות)
    _original: {
      loadClientsFromFirebase: loadClientsFromFirebase_ORIGINAL,
      loadTimesheetFromFirebase: loadTimesheetFromFirebase_ORIGINAL,
      updateTimesheetEntryFirebase: updateTimesheetEntryFirebase_ORIGINAL,
      loadBudgetTasksFromFirebase: loadBudgetTasksFromFirebase_ORIGINAL,
      saveBudgetTaskToFirebase: saveBudgetTaskToFirebase_ORIGINAL
    }
  };

  /* === Initialization === */
  if (FEATURE_FLAGS.DEBUG) {
    logger.log('✅ Firebase Server Adapter loaded');
  }

})();
