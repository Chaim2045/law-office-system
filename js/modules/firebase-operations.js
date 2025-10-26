/**
 * Firebase Operations Module
 * Handles all Firebase database operations and Cloud Functions calls
 *
 * Created: 2025
 * Part of Law Office Management System
 */

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
      console.error("❌ Firebase Database לא זמין");
      throw new Error("Firebase Database לא מחובר");
    }

    // Database ready - silent mode
    return true;
  } catch (error) {
    console.error("❌ שגיאה באתחול Firebase:", error);
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
      throw new Error("Firebase לא מחובר");
    }

    // ⚡ טעינה מקבילית של clients + cases (אופטימיזציה)
    const [clientsSnapshot, casesSnapshot] = await Promise.all([
      db.collection("clients").get(),
      db.collection("cases").get()
    ]);

    // 📊 מבנה נתונים: Map לקישור מהיר בין clientId לבין ה-cases שלו
    const clientCasesMap = new Map();

    // שלב 1: מיפוי cases לפי clientId
    casesSnapshot.forEach((doc) => {
      const caseData = doc.data();
      const clientId = caseData.clientId;

      if (clientId) {
        if (!clientCasesMap.has(clientId)) {
          clientCasesMap.set(clientId, []);
        }
        clientCasesMap.get(clientId).push({
          id: doc.id,
          ...caseData
        });
      }
    });

    const clients = [];

    // שלב 2: טעינת לקוחות מהארכיטקטורה הישנה + קישור ל-cases שלהם
    clientsSnapshot.forEach((doc) => {
      const data = doc.data();
      const clientId = doc.id;

      // קבלת התיקים של הלקוח (אם קיימים)
      const clientCases = clientCasesMap.get(clientId) || [];

      // אם ללקוח אין תיקים - יצירת virtual case (backward compatibility)
      const hasRealCases = clientCases.length > 0;

      clients.push({
        ...data,
        id: clientId,
        firestoreId: clientId,
        legacyId: data.id,
        source: 'clients',
        // תמיכה בשני פורמטים
        fullName: data.fullName || data.clientName,
        fileNumber: data.fileNumber || data.caseNumber,
        // מטא-דאטה על תיקים
        casesCount: clientCases.length,
        activeCasesCount: clientCases.filter(c => c.status === 'active').length,
        cases: clientCases, // רשימת התיקים המלאה
        hasVirtualCase: !hasRealCases, // דגל שמסמן שזה לקוח ישן ללא תיקים אמיתיים
        // תמיכה בארכיטקטורה ישנה - שומר את הפורמט המקורי
        type: data.type || 'hours'
      });
    });

    // שלב 3: טעינת תיקים שאין להם clientId (orphan cases)
    // אלו תיקים שנוצרו עם לקוח חדש ולא קיים להם רשומת client נפרדת
    casesSnapshot.forEach((doc) => {
      const data = doc.data();

      // אם אין clientId או שה-client לא קיים ב-clients collection
      if (!data.clientId || !clientCasesMap.has(data.clientId)) {
        clients.push({
          ...data,
          id: doc.id,
          firestoreId: doc.id,
          source: 'cases',
          // ממיר שדות חדשים לפורמט הישן כדי שהתצוגה תעבוד
          fullName: data.caseTitle || data.clientName || data.fullName,
          fileNumber: data.caseNumber || data.fileNumber,
          type: data.procedureType === 'legal_procedure' ? 'legal_procedure' :
                data.procedureType === 'hours' ? 'hours' :
                data.type || 'hours',
          // מטא-דאטה
          casesCount: 0,
          activeCasesCount: 0,
          cases: [],
          hasVirtualCase: false
        });
      }
    });

    Logger.log(`✅ טעינה הושלמה: ${clientsSnapshot.size} לקוחות | ${casesSnapshot.size} תיקים | ${clients.length} רשומות סה"כ`);

    return clients;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת לקוחות: " + error.message);
  }
}

/**
 * Load budget tasks from Firebase
 */
async function loadBudgetTasksFromFirebase(employee) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db
      .collection("budget_tasks")
      .where("employee", "==", employee)
      .get();

    const tasks = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // ⚡ CRITICAL: Convert Firebase Timestamps to JavaScript Date objects
      const taskWithFirebaseId = {
        ...data,
        firebaseDocId: doc.id, // ✅ Always save Firebase document ID
        // Convert Timestamps to Date objects for proper formatting
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : data.completedAt,
        deadline: data.deadline?.toDate ? data.deadline.toDate() : data.deadline,
      };

      // Only set 'id' if it doesn't exist in the data
      if (!taskWithFirebaseId.id) {
        taskWithFirebaseId.id = doc.id;
      }

      tasks.push(taskWithFirebaseId);
    });

    return tasks;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת משימות: " + error.message);
  }
}

/**
 * Load timesheet entries from Firebase
 */
async function loadTimesheetFromFirebase(employee) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db
      .collection("timesheet_entries")
      .where("employee", "==", employee)
      .get();

    const entries = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Convert Firebase Timestamps to JavaScript Date objects
      entries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      });
    });

    // Sort by date (manual sorting instead of orderBy)
    entries.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    return entries;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת שעתון: " + error.message);
  }
}

// ✅ saveClientToFirebase REMOVED
// Client creation is now handled by CasesManager in cases.js via createClient Cloud Function
// Use casesManager.showCreateCaseDialog() instead

/**
 * Save budget task to Firebase
 */
async function saveBudgetTaskToFirebase(taskData) {
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
    console.error("Firebase error:", error);

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
 */
async function saveTimesheetToFirebase(entryData) {
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
    console.error("Firebase error:", error);

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
 */
async function updateTimesheetEntryFirebase(entryId, minutes, reason = "") {
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
    console.error("Firebase error:", error);
    throw error;
  }
}

// הוספת זמן למשימה מתוקצבת (Firebase)
async function addTimeToTaskFirebase(taskId, timeData) {
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
    console.error("❌ שגיאה בהוספת זמן למשימה:", error);
    throw error;
  }
}

// סיום משימה מתוקצבת (Firebase)
async function completeTaskFirebase(taskId, completionNotes = "") {
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
    console.error("❌ שגיאה בהשלמת משימה:", error);
    throw error;
  }
}

// הארכת תאריך יעד למשימה (Firebase)
async function extendTaskDeadlineFirebase(taskId, newDeadline, reason = "") {
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
    console.error("❌ שגיאה בהארכת תאריך יעד:", error);
    throw error;
  }
}

// רישום כניסת משתמש (Firebase)
async function logUserLoginFirebase(employee, userAgent = "", ipAddress = "") {
  try {
    const db = window.firebaseDB;
    if (!db) {
      console.warn("Firebase לא מחובר - דילוג על רישום כניסה");
      return { success: true };
    }

    const loginData = {
      employee: employee,
      action: "login",
      userAgent: userAgent || navigator.userAgent,
      ipAddress: ipAddress || "לא זמין",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sessionId: Date.now().toString(),
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine,
      },
    };

    db.collection("user_logs")
      .add(loginData)
      .then(() => {
      })
      .catch((error) => {
        console.warn("שגיאה ברישום כניסה:", error.message);
      });

    return { success: true, message: "כניסה נרשמה" };
  } catch (error) {
    console.error("שגיאה ברישום כניסת משתמש:", error);
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
  updateTimesheetEntryFirebase,
  addTimeToTaskFirebase,
  completeTaskFirebase,
  extendTaskDeadlineFirebase,
  logUserLoginFirebase
};
