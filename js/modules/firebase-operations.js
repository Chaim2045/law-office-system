/**
 * Firebase Operations Module
 * Handles all Firebase database operations and Cloud Functions calls
 *
 * Created: 2025
 * Part of Law Office Management System
 */

/* ===========================
   IMPORTS
   =========================== */

// ✅ Import budget tasks functions from dedicated module (DRY principle)
import { loadBudgetTasksFromFirebase } from './budget-tasks.js';

/* === Firebase Functions Wrapper === */
// Helper to call Firebase Cloud Functions
const callFunction = async (functionName, data = {}) => {
  try {
    const functions = firebase.functions();
    const callable = functions.httpsCallable(functionName);
    const result = await callable(data);
    return result.data;
  } catch (error) {
    console.error(`Error calling function ${functionName}:`, error);

    // Handle specific error codes
    if (error.code === 'unauthenticated') {
      throw new Error('נדרשת התחברות למערכת');
    } else if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה לבצע פעולה זו');
    } else if (error.code === 'invalid-argument') {
      throw new Error(error.message || 'נתונים לא תקינים');
    } else if (error.code === 'not-found') {
      throw new Error('הפריט לא נמצא');
    }

    throw new Error(error.message || 'שגיאה בביצוע הפעולה');
  }
};

/* === Firebase Core Functions === */

/**
 * Initialize Firebase connection
 */
function initializeFirebase() {
  try {

    if (!window.firebaseDB) {
      console.error('❌ Firebase Database לא זמין');
      throw new Error('Firebase Database לא מחובר');
    }

    // Database ready - silent mode
    return true;
  } catch (error) {
    console.error('❌ שגיאה באתחול Firebase:', error);
    return false;
  }
}

/* === Firebase Data Operations === */

/**
 * Load clients from Firebase
 */
async function loadClientsFromFirebase() {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error('Firebase לא מחובר');
    }

    // ✅ CLIENT = CASE: טעינה ישירה מ-clients collection
    const clientsSnapshot = await db.collection('clients').get();

    const clients = [];

    // טעינת כל הלקוחות/תיקים
    clientsSnapshot.forEach((doc) => {
      const data = doc.data();
      const clientId = doc.id;

      clients.push({
        ...data,
        id: clientId,
        firestoreId: clientId,
        legacyId: data.id,
        source: 'clients',
        // תמיכה בשני פורמטים של שדות
        fullName: data.fullName || data.clientName,
        fileNumber: data.fileNumber || data.caseNumber,
        // CLIENT = CASE: אין תיקים מרובים, רק תיק אחד ללקוח
        casesCount: 1,
        activeCasesCount: data.status === 'active' ? 1 : 0,
        cases: [],
        hasVirtualCase: false,
        type: data.type || data.procedureType || 'hours'
      });
    });

    Logger.log(`✅ טעינה הושלמה: ${clientsSnapshot.size} לקוחות/תיקים | ${clients.length} רשומות סה"כ`);

    return clients;
  } catch (error) {
    console.error('Firebase error:', error);
    throw new Error('שגיאה בטעינת לקוחות: ' + error.message);
  }
}

// ✅ loadBudgetTasksFromFirebase moved to budget-tasks.js (DRY principle)
// ✅ Imported above and re-exported below for backwards compatibility

/**
 * Load timesheet entries from Firebase
 */
async function loadTimesheetFromFirebase(employee) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error('Firebase לא מחובר');
    }

    const snapshot = await db
      .collection('timesheet_entries')
      .where('employee', '==', employee)
      .limit(50) // ✅ Safety net - prevents loading all entries in fallback mode
      .get();

    const entries = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Convert Firebase Timestamps to JavaScript Date objects
      // ✅ Use shared timestamp converter (Single Source of Truth)
      const converted = window.DatesModule.convertTimestampFields(data, ['createdAt', 'updatedAt']);

      entries.push({
        id: doc.id,
        ...converted
      });
    });

    // Sort by date (manual sorting instead of orderBy)
    entries.sort((a, b) => {
      if (!a.date) {
return 1;
}
      if (!b.date) {
return -1;
}
      return new Date(b.date) - new Date(a.date);
    });

    return entries;
  } catch (error) {
    console.error('Firebase error:', error);
    throw new Error('שגיאה בטעינת שעתון: ' + error.message);
  }
}

// ✅ saveClientToFirebase REMOVED
// Client creation is now handled by CasesManager in cases.js via createClient Cloud Function
// Use casesManager.showCreateCaseDialog() instead

/**
 * Save budget task to Firebase
 */
/**
 * @deprecated Use FirebaseService.call('createBudgetTask') instead
 */
async function saveBudgetTaskToFirebase(taskData) {
  console.warn('⚠️ [DEPRECATED] saveBudgetTaskToFirebase is deprecated. Use FirebaseService.call("createBudgetTask") instead.');

  try {
    // ✅ Check internet connection first
    if (!navigator.onLine) {
      throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.');
    }

    // Call Firebase Function for secure validation and creation
    const result = await callFunction('createBudgetTask', taskData);

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בשמירת משימה');
    }

    return result.taskId;
  } catch (error) {
    console.error('Firebase error:', error);

    // ✅ Provide better error messages
    if (error.message?.includes('אין חיבור לאינטרנט')) {
      throw error; // Pass through our custom message
    }

    if (error.code === 'unavailable' || error.message?.includes('network')) {
      throw new Error('בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב.');
    }

    if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה לבצע פעולה זו.');
    }

    throw error;
  }
}

/**
 * Save timesheet entry to Firebase
 * @deprecated Use FirebaseService.call('createTimesheetEntry') instead
 */
async function saveTimesheetToFirebase(entryData) {
  console.warn('⚠️ [DEPRECATED] saveTimesheetToFirebase is deprecated. Use FirebaseService.call("createTimesheetEntry") instead.');

  try {
    // ✅ Check internet connection first
    if (!navigator.onLine) {
      throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.');
    }

    // Call Firebase Function for secure validation and creation
    const result = await callFunction('createTimesheetEntry', entryData);

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בשמירת שעתון');
    }

    return result.entryId;
  } catch (error) {
    console.error('Firebase error:', error);

    // ✅ Provide better error messages
    if (error.message?.includes('אין חיבור לאינטרנט')) {
      throw error;
    }

    if (error.code === 'unavailable' || error.message?.includes('network')) {
      throw new Error('בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב.');
    }

    if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה לבצע פעולה זו.');
    }

    throw error;
  }
}

/**
 * ✅ ENTERPRISE v2.0: Save timesheet entry with absolute accuracy
 *
 * This version includes:
 * - Optimistic Locking (_version) - prevents Lost Updates
 * - Event Sourcing (time_events) - full Audit Trail
 * - Idempotency Keys - prevents duplicate execution
 * - Automatic Rollback - on errors
 *
 * @param {Object} entryData - Timesheet entry data
 * @param {number} expectedVersion - Expected version of the client document (for optimistic locking)
 * @param {string} idempotencyKey - Unique key to prevent duplicate operations (optional but recommended)
 * @returns {Promise<Object>} Result with entryId and new version
 *
 * @example
 * const client = await getClient(clientId);
 * const idempotencyKey = `${user}_${date}_${taskId}_${minutes}`;
 * const result = await saveTimesheetToFirebase_v2(entryData, client._version, idempotencyKey);
 */
async function saveTimesheetToFirebase_v2(entryData, expectedVersion, idempotencyKey) {
  console.log('✅ [v2.0] Using Enterprise accuracy mode');

  try {
    // ✅ Check internet connection first
    if (!navigator.onLine) {
      throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.');
    }

    // Call Firebase Function v2 for enterprise-grade accuracy
    const result = await callFunction('createTimesheetEntry_v2', {
      ...entryData,
      expectedVersion,      // ✅ For Optimistic Locking
      idempotencyKey        // ✅ For preventing duplicates
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בשמירת שעתון');
    }

    console.log(`✅ [v2.0] Timesheet saved: ${result.entryId}, Version: ${result.version}`);

    return {
      entryId: result.entryId,
      version: result.version,
      entry: result.entry
    };
  } catch (error) {
    console.error('❌ [v2.0] Firebase error:', error);

    // ✅ Handle version conflict
    if (error.code === 'aborted' && error.message?.includes('CONFLICT')) {
      throw new Error(
        'המסמך שונה על ידי משתמש אחר. אנא רענן את הדף ונסה שוב.\n\n' +
        'הסיבה: גרסה לא תואמת - מישהו אחר עדכן את הלקוח בינתיים.'
      );
    }

    // ✅ Provide better error messages
    if (error.message?.includes('אין חיבור לאינטרנט')) {
      throw error;
    }

    if (error.code === 'unavailable' || error.message?.includes('network')) {
      throw new Error('בעיית תקשורת עם השרת. אנא בדוק את החיבור ונסה שוב.');
    }

    if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה לבצע פעולה זו.');
    }

    throw error;
  }
}

/**
 * Update timesheet entry in Firebase
 * @deprecated Use FirebaseService.call('updateTimesheetEntry') instead
 */
async function updateTimesheetEntryFirebase(entryId, minutes, reason = '') {
  console.warn('⚠️ [DEPRECATED] updateTimesheetEntryFirebase is deprecated. Use FirebaseService.call("updateTimesheetEntry") instead.');

  try {
    // Call Firebase Function for secure validation and update
    const result = await callFunction('updateTimesheetEntry', {
      entryId: String(entryId),
      minutes,
      reason
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בעדכון שעתון');
    }

    return result;
  } catch (error) {
    console.error('Firebase error:', error);
    throw error;
  }
}

// הוספת זמן למשימה מתוקצבת (Firebase)
/**
 * @deprecated Use FirebaseService.call('addTimeToTask') instead
 */
async function addTimeToTaskFirebase(taskId, timeData) {
  console.warn('⚠️ [DEPRECATED] addTimeToTaskFirebase is deprecated. Use FirebaseService.call("addTimeToTask") instead.');

  try {
    // ✅ תיקון: שליחת הנתונים ישירות (לא עטופים ב-timeEntry)
    const result = await callFunction('addTimeToTask', {
      taskId: String(taskId),
      minutes: parseInt(timeData.minutes),  // ✅ ודא שזה מספר
      date: timeData.date,
      description: timeData.description
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בהוספת זמן למשימה');
    }

    return result;
  } catch (error) {
    console.error('❌ שגיאה בהוספת זמן למשימה:', error);
    throw error;
  }
}

// סיום משימה מתוקצבת (Firebase)
/**
 * @deprecated Use FirebaseService.call('completeTask') instead
 */
async function completeTaskFirebase(taskId, completionNotes = '') {
  console.warn('⚠️ [DEPRECATED] completeTaskFirebase is deprecated. Use FirebaseService.call("completeTask") instead.');

  try {
    // Call Firebase Function for secure validation and update
    const result = await callFunction('completeTask', {
      taskId: String(taskId),
      completionNotes
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בהשלמת משימה');
    }

    return result;
  } catch (error) {
    console.error('❌ שגיאה בהשלמת משימה:', error);
    throw error;
  }
}

// הארכת תאריך יעד למשימה (Firebase)
/**
 * @deprecated Use FirebaseService.call('extendTaskDeadline') instead
 */
async function extendTaskDeadlineFirebase(taskId, newDeadline, reason = '') {
  console.warn('⚠️ [DEPRECATED] extendTaskDeadlineFirebase is deprecated. Use FirebaseService.call("extendTaskDeadline") instead.');

  try {
    // Call Firebase Function for secure validation and update
    const result = await callFunction('extendTaskDeadline', {
      taskId: String(taskId),
      newDeadline,
      reason
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בהארכת תאריך יעד');
    }

    return result;
  } catch (error) {
    console.error('❌ שגיאה בהארכת תאריך יעד:', error);
    throw error;
  }
}

// רישום כניסת משתמש (Firebase)
async function logUserLoginFirebase(employee, userAgent = '', ipAddress = '') {
  try {
    const db = window.firebaseDB;
    if (!db) {
      console.warn('Firebase לא מחובר - דילוג על רישום כניסה');
      return { success: true };
    }

    const loginData = {
      employee: employee,
      action: 'login',
      userAgent: userAgent || navigator.userAgent,
      ipAddress: ipAddress || 'לא זמין',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sessionId: Date.now().toString(),
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine
      }
    };

    db.collection('user_logs')
      .add(loginData)
      .then(() => {
      })
      .catch((error) => {
        console.warn('שגיאה ברישום כניסה:', error.message);
      });

    return { success: true, message: 'כניסה נרשמה' };
  } catch (error) {
    console.error('שגיאה ברישום כניסת משתמש:', error);
    return { success: true };
  }
}

// Exports
export {
  callFunction,
  initializeFirebase,
  loadClientsFromFirebase,
  loadBudgetTasksFromFirebase,
  loadTimesheetFromFirebase,
  // ✅ saveClientToFirebase removed
  saveBudgetTaskToFirebase,
  saveTimesheetToFirebase,
  saveTimesheetToFirebase_v2,  // ✅ NEW: Enterprise v2.0 with absolute accuracy
  updateTimesheetEntryFirebase,
  addTimeToTaskFirebase,
  completeTaskFirebase,
  extendTaskDeadlineFirebase,
  logUserLoginFirebase
};
