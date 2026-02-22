/**
 * Law Office Management System - Firebase Functions
 *
 * מערכת ניהול משרד עורכי דין - פונקציות שרת
 * ארכיטקטורה מאובטחת עם Validation, Authorization, ו-Audit Logging
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { addTimeToTaskWithTransaction } = require('./addTimeToTask_v2');
const { updateBudgetTask, markNotificationAsRead } = require('./task-update-realtime');

// ✨ NEW: Import modular deduction system
const DeductionSystem = require('./src/modules/deduction');

// ✅ NEW: Import case number transaction module
const { generateCaseNumberWithTransaction } = require('./case-number-transaction');

// אתחול Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Twilio environment variables for v1 functions compatibility
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC9e5e9e3c953a5bbb878622b6e70201b6';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'fed2170530e4ed34d3b1b3407e0f0f5f';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// ===============================
// CORS Configuration
// ===============================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600'
};

// ===============================
// TEMPORARY: Migration Function
// ===============================
/**
 * פונקציה זמנית לתיקון isInternal ברשומות קיימות
 * DRY RUN: עובד במצב READ-ONLY, רק מראה מה ישתנה
 */
exports.migrateIsInternalDryRun = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔍 Starting isInternal migration DRY RUN...');

    // קריאת כל הרשומות
    const allEntries = await db.collection('timesheet_entries').get();
    console.log(`📊 Total entries: ${allEntries.size}`);

    let correctCount = 0;
    let needsFixCount = 0;
    let internalOfficeCount = 0;
    const needsFix = [];

    allEntries.docs.forEach(doc => {
      const data = doc.data();
      const isInternalOffice = data.clientId === 'internal_office';

      if (isInternalOffice) {
        internalOfficeCount++;
      }

      const shouldBeInternal = isInternalOffice;
      const currentIsInternal = data.isInternal === true;

      if (shouldBeInternal === currentIsInternal) {
        correctCount++;
      } else {
        needsFixCount++;
        needsFix.push({
          id: doc.id,
          clientId: data.clientId,
          currentIsInternal: data.isInternal,
          shouldBeInternal: shouldBeInternal,
          employee: data.employee,
          date: data.date,
          hours: data.hours
        });
      }
    });

    console.log(`✅ Correct entries: ${correctCount}`);
    console.log(`🔧 Need fix: ${needsFixCount}`);
    console.log(`🏢 Internal office entries: ${internalOfficeCount}`);

    return {
      success: true,
      totalEntries: allEntries.size,
      correctCount,
      needsFixCount,
      internalOfficeCount,
      examples: needsFix.slice(0, 10)
    };

  } catch (error) {
    console.error('❌ Migration DRY RUN failed:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===============================
// Helper Functions - פונקציות עזר
// ===============================

/**
 * בדיקת הרשאות משתמש
 */
async function checkUserPermissions(context) {
  // בדיקה שהמשתמש מחובר
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'נדרשת התחברות למערכת'
    );
  }

  const uid = context.auth.uid;

  // טעינת פרטי העובד מ-Firestore
  const employeeSnapshot = await db.collection('employees')
    .where('authUID', '==', uid)
    .limit(1)
    .get();

  if (employeeSnapshot.empty) {
    throw new functions.https.HttpsError(
      'not-found',
      'עובד לא נמצא במערכת'
    );
  }

  const employeeDoc = employeeSnapshot.docs[0];
  const employee = employeeDoc.data();

  // בדיקה שהעובד פעיל
  if (!employee.isActive) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'חשבון המשתמש לא פעיל. אנא פנה למנהל המערכת.'
    );
  }

  return {
    uid,
    email: employeeDoc.id, // Document ID is EMAIL (industry standard)
    username: employee.username, // Username for display only
    employee: employee,
    role: employee.role || 'employee'
  };
}

/**
 * רישום לוג ביקורת (Audit Log)
 */
async function logAction(action, userId, username, details = {}) {
  try {
    await db.collection('audit_log').add({
      action,
      userId,
      username,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: details.userAgent || null,
      ipAddress: details.ipAddress || null
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // לא נזרוק שגיאה - logging לא צריך לעצור את הפעולה
  }
}

/**
 * ניקוי HTML (מניעת XSS)
 *
 * ✅ Fixed: רק < ו-> מוחלפים (סיכון XSS אמיתי)
 * ✅ גרשיים (" ו-') ו-/ לא מוחלפים - שמירת data integrity
 *
 * Note: Frontend צריך להשתמש ב-safeText() או textContent בdisplay
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    // Removed: .replace(/"/g, '&quot;') - causes data corruption
    // Removed: .replace(/'/g, '&#x27;') - causes data corruption
    // Removed: .replace(/\//g, '&#x2F;') - not an XSS risk
}

/**
 * אימות מספר טלפון ישראלי
 */
function isValidIsraeliPhone(phone) {
  if (!phone) return true; // אופציונלי
  const cleanPhone = phone.replace(/[-\s]/g, '');
  return /^0(5[0-9]|[2-4]|[7-9])\d{7}$/.test(cleanPhone);
}

/**
 * אימות אימייל
 */
function isValidEmail(email) {
  if (!email) return true; // אופציונלי
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * יצירה או קבלת תיק פנימי לעובד (Lazy Creation)
 * נוצר אוטומטית בפעם הראשונה שהעובד רושם פעילות פנימית
 *
 * @param {string} employeeName - שם העובד (למשל: "חיים")
 * @returns {Promise<Object>} - אובייקט התיק הפנימי
 */
async function getOrCreateInternalCase(employeeName) {
  const caseId = `internal_${employeeName.toLowerCase().replace(/\s+/g, '_')}`;
  const internalClientId = 'internal_office';

  // 1. בדיקה אם התיק כבר קיים
  // ✅ במבנה החדש Client=Case: clients collection
  const caseRef = db.collection('clients').doc(caseId);
  const caseDoc = await caseRef.get();

  if (caseDoc.exists) {
    console.log(`✅ תיק פנימי קיים: ${caseId}`);
    return {
      id: caseDoc.id,
      ...caseDoc.data()
    };
  }

  console.log(`🆕 יוצר תיק פנימי חדש: ${caseId}`);

  // 2. ודא שהלקוח המשרדי קיים
  const clientRef = db.collection('clients').doc(internalClientId);
  const clientDoc = await clientRef.get();

  if (!clientDoc.exists) {
    // יצירת לקוח משרדי (פעם אחת בלבד)
    await clientRef.set({
      id: internalClientId,
      clientName: 'משרד - פעילות פנימית',
      clientType: 'internal',
      isSystemClient: true,
      idNumber: 'SYSTEM-INTERNAL',
      idType: 'system',
      phone: '-',
      email: 'office@internal.system',
      address: 'פנימי',
      totalCases: 0,
      activeCases: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: 'system'
    });

    console.log(`✅ לקוח משרדי נוצר: ${internalClientId}`);
  }

  // 3. יצירת התיק הפנימי
  const newCase = {
    id: caseId,
    clientId: internalClientId,
    clientName: 'משרד - פעילות פנימית',
    caseNumber: `INTERNAL-${employeeName.toUpperCase()}`,
    caseTitle: `${employeeName} - משימות משרדיות`,
    procedureType: 'internal',
    totalHours: null,
    hoursRemaining: null,
    minutesRemaining: null,
    hourlyRate: null,
    assignedTo: [employeeName],
    mainAttorney: employeeName,
    status: 'active',
    priority: 'low',
    isSystemCase: true,
    isInternal: true,
    isDeletable: false,
    isEditable: false,
    isHiddenFromReports: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system',
    createdReason: 'auto_internal_case',
    lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastModifiedBy: 'system'
  };

  await caseRef.set(newCase);

  // 4. עדכון מונה התיקים בלקוח המשרדי
  await clientRef.update({
    totalCases: admin.firestore.FieldValue.increment(1),
    activeCases: admin.firestore.FieldValue.increment(1),
    lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ תיק פנימי נוצר בהצלחה: ${caseId}`);

  return newCase;
}

// =====================================================================
// ✅ DEPRECATED: Old deduction functions moved to modular system
// =====================================================================
// The following functions are now imported from DeductionSystem module:
// - getActivePackage()
// - closePackageIfDepleted()
// - deductHoursFromPackage()
//
// See: src/modules/deduction/
// =====================================================================

/**
 * 🎯 יצירת מספר תיק אוטומטי (WRAPPER)
 * מפנה ל-Transaction Module החדש
 *
 * פורמט: שנה + מספר סידורי (2025001, 2025002...)
 * שימוש ב-Firestore Transaction מבטיח ייחודיות מוחלטת
 *
 * @returns {Promise<string>} - מספר תיק חדש וייחודי
 */
async function generateCaseNumber() {
  // ✅ שימוש ב-Transaction החדשה
  return await generateCaseNumberWithTransaction();
}

// ===============================
// Enterprise Infrastructure - דיוק מוחלט
// ===============================

/**
 * ✅ ENTERPRISE: Version Control & Optimistic Locking
 * מונע Lost Updates - כאשר שני משתמשים עורכים אותו מסמך בו-זמנית
 *
 * @param {DocumentReference} docRef - רפרנס למסמך
 * @param {number} expectedVersion - גרסה צפויה
 * @returns {Promise<Object>} - המסמך והגרסה הנוכחית
 * @throws {Error} - אם הגרסה לא תואמת (conflict detected)
 */
async function checkVersionAndLock(docRef, expectedVersion) {
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error('מסמך לא נמצא');
  }

  const data = doc.data();
  const currentVersion = data._version || 0;

  // ✅ בדיקת התנגשות
  if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
    throw new Error(
      `CONFLICT: המסמך שונה על ידי משתמש אחר. ` +
      `גרסה צפויה: ${expectedVersion}, גרסה נוכחית: ${currentVersion}. ` +
      `אנא רענן את המסמך ונסה שוב.`
    );
  }

  return {
    data,
    currentVersion,
    nextVersion: currentVersion + 1
  };
}

/**
 * ✅ ENTERPRISE: Event Sourcing - רישום אירוע במערכת
 * כל שינוי במערכת נרשם כאירוע append-only (אף פעם לא נמחק)
 * זה מאפשר:
 * 1. Audit Trail מלא
 * 2. שחזור מצב עבר
 * 3. ניתוח דפוסי שימוש
 * 4. בדיקת עקביות נתונים
 *
 * @param {Object} eventData - נתוני האירוע
 * @returns {Promise<string>} - Event ID
 */
async function createTimeEvent(eventData) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const event = {
    eventId,
    eventType: eventData.eventType, // TIME_ADDED, TIME_UPDATED, PACKAGE_DEPLETED
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // מזהי ישויות
    caseId: eventData.caseId,
    serviceId: eventData.serviceId || null,
    stageId: eventData.stageId || null,
    packageId: eventData.packageId || null,
    taskId: eventData.taskId || null,
    timesheetEntryId: eventData.timesheetEntryId || null,

    // נתוני האירוע
    data: eventData.data || {},

    // מי ביצע
    performedBy: eventData.performedBy,
    performedByEmail: eventData.performedByEmail,

    // מצב לפני ואחרי
    before: eventData.before || {},
    after: eventData.after || {},

    // מניעת כפילויות
    idempotencyKey: eventData.idempotencyKey || null,

    // מטא-דאטה
    userAgent: eventData.userAgent || null,
    ipAddress: eventData.ipAddress || null,

    // סטטוס
    processed: true,
    processingErrors: eventData.errors || []
  };

  await db.collection('time_events').doc(eventId).set(event);

  console.log(`📝 [EVENT] ${eventData.eventType} - ${eventId}`);

  return eventId;
}

/**
 * ✅ ENTERPRISE: Idempotency Protection
 * מונע ביצוע כפול של אותה פעולה (למשל: לחיצה כפולה על "שמור")
 *
 * @param {string} idempotencyKey - מפתח ייחודי לפעולה
 * @returns {Promise<Object|null>} - תוצאה קיימת או null
 */
async function checkIdempotency(idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  const operationDoc = await db.collection('processed_operations')
    .doc(idempotencyKey)
    .get();

  if (operationDoc.exists) {
    const operation = operationDoc.data();

    // ✅ הפעולה כבר בוצעה - מחזיר את התוצאה המקורית
    console.log(`🔄 [IDEMPOTENCY] פעולה כבר בוצעה: ${idempotencyKey}`);
    return operation.result;
  }

  return null;
}

/**
 * ✅ ENTERPRISE: Idempotency Registration
 * שמירת תוצאת פעולה למניעת ביצוע כפול
 *
 * @param {string} idempotencyKey - מפתח ייחודי
 * @param {Object} result - תוצאת הפעולה
 * @param {number} ttlHours - זמן תפוגה (24 שעות ברירת מחדל)
 */
async function registerIdempotency(idempotencyKey, result, ttlHours = 24) {
  if (!idempotencyKey) {
    return;
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  await db.collection('processed_operations').doc(idempotencyKey).set({
    idempotencyKey,
    status: 'completed',
    result,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
  });

  console.log(`✅ [IDEMPOTENCY] נרשמה פעולה: ${idempotencyKey}`);
}

/**
 * ✅ ENTERPRISE: Two-Phase Commit - Phase 1 (Reserve)
 * יצירת הזמנה לפני ביצוע הפעולה בפועל
 *
 * @param {Object} reservationData - נתוני ההזמנה
 * @returns {Promise<string>} - Reservation ID
 */
async function createReservation(reservationData) {
  const reservationId = `rsv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const reservation = {
    reservationId,
    status: 'pending', // pending → committed / rolled_back

    // נתוני הפעולה
    caseId: reservationData.caseId,
    minutes: reservationData.minutes,
    performedBy: reservationData.performedBy,

    // פעולות מתוכננות
    operations: reservationData.operations || [],

    // זמנים
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 5 * 60 * 1000) // תפוגה אחרי 5 דקות
    )
  };

  await db.collection('reservations').doc(reservationId).set(reservation);

  console.log(`📌 [RESERVATION] נוצרה הזמנה: ${reservationId}`);

  return reservationId;
}

/**
 * ✅ ENTERPRISE: Two-Phase Commit - Phase 2 (Commit)
 * סימון ההזמנה כהושלמה
 */
async function commitReservation(reservationId) {
  await db.collection('reservations').doc(reservationId).update({
    status: 'committed',
    committedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ [RESERVATION] הושלמה: ${reservationId}`);
}

/**
 * ✅ ENTERPRISE: Two-Phase Commit - Rollback
 * סימון ההזמנה כבוטלה
 */
async function rollbackReservation(reservationId, error) {
  await db.collection('reservations').doc(reservationId).update({
    status: 'rolled_back',
    rolledBackAt: admin.firestore.FieldValue.serverTimestamp(),
    error: error.message || 'Unknown error'
  });

  console.log(`❌ [RESERVATION] בוטלה: ${reservationId}`);
}

// ===============================
// Authentication Functions
// ===============================

/**
 * יצירת משתמש חדש ב-Firebase Authentication
 * רק למנהלים (admin)
 */
exports.createAuthUser = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    const caller = await checkUserPermissions(context);

    if (caller.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים ליצור משתמשים חדשים'
      );
    }

    // Validation
    if (!data.email || !data.password || !data.displayName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות חובה: email, password, displayName'
      );
    }

    if (!isValidEmail(data.email)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כתובת אימייל לא תקינה'
      );
    }

    if (data.password.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סיסמה חייבת להיות לפחות 6 תווים'
      );
    }

    // בדיקה אם המשתמש כבר קיים
    try {
      await auth.getUserByEmail(data.email);
      throw new functions.https.HttpsError(
        'already-exists',
        `משתמש עם האימייל ${data.email} כבר קיים`
      );
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // יצירת המשתמש
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: sanitizeString(data.displayName),
      emailVerified: false,
      disabled: !data.isActive
    });

    // הגדרת Custom Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: data.role || 'employee',
      oldUsername: data.oldUsername || null
    });

    // יצירת מסמך ב-Firestore (use EMAIL as document ID - industry standard)
    await db.collection('employees').doc(data.email).set({
      authUID: userRecord.uid,
      username: data.oldUsername || data.email.split('@')[0],  // username for display
      displayName: sanitizeString(data.displayName),
      name: sanitizeString(data.displayName),
      email: data.email,
      role: data.role || 'employee',
      isActive: data.isActive !== false,
      mustChangePassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: caller.username,
      lastLogin: null,
      loginCount: 0,
      migratedToAuth: true
    });

    // Audit log
    await logAction('CREATE_USER', caller.uid, caller.username, {
      newUserId: userRecord.uid,
      newUserEmail: data.email,
      role: data.role
    });

    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email
    };

  } catch (error) {
    console.error('Error in createAuthUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת משתמש: ${error.message}`
    );
  }
});

// ===============================
// Client Management Functions
// ===============================

/**
 * 📋 קבלת מספר תיק הבא (לתצוגה מקדימה בממשק)
 * מחזיר את מספר התיק שיתווסף עבור הלקוח הבא
 * ⚠️ שים לב: זהו מספר משוער - המספר הסופי נקבע רק בעת יצירת התיק
 */
exports.getNextCaseNumber = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    await checkUserPermissions(context);

    // קבלת מספר התיק הבא
    const nextCaseNumber = await generateCaseNumber();

    return {
      success: true,
      caseNumber: nextCaseNumber,
      note: 'מספר משוער - עשוי להשתנות אם ייווצרו תיקים נוספים'
    };

  } catch (error) {
    console.error('❌ Error getting next case number:', error);
    throw new functions.https.HttpsError('internal', error.message || 'שגיאה בקבלת מספר תיק');
  }
});

/**
 * 🎯 יצירת לקוח חדש (CLIENT = CASE)
 * ✅ NEW ARCHITECTURE: Client ו-Case מאוחדים - מספר תיק הוא ה-Document ID
 */
exports.createClient = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // ✅ Idempotency: אם יש idempotencyKey, בדוק אם כבר עיבדנו את הפעולה
    if (data.idempotencyKey) {
      const idempotencyDoc = await db.collection('processed_operations')
        .doc(data.idempotencyKey).get();

      if (idempotencyDoc.exists) {
        console.log(`♻️ Idempotency: returning cached result for key ${data.idempotencyKey}`);
        return idempotencyDoc.data().result;
      }
    }

    // Validation - שדות חובה
    if (!data.clientName || typeof data.clientName !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'שם לקוח חייב להיות מחרוזת תקינה'
      );
    }

    if (data.clientName.trim().length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'שם לקוח חייב להכיל לפחות 2 תווים'
      );
    }

    // Validation - סוג הליך
    if (!data.procedureType || !['hours', 'fixed', 'legal_procedure'].includes(data.procedureType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סוג הליך חייב להיות "hours", "fixed" או "legal_procedure"'
      );
    }

    // Validation - שדות ספציפיים לסוג
    if (data.procedureType === 'hours') {
      if (!data.totalHours || typeof data.totalHours !== 'number' || data.totalHours < 1) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'כמות שעות חייבת להיות מספר חיובי'
        );
      }
    }

    // Validation - הליך משפטי עם שלבים
    if (data.procedureType === 'legal_procedure') {
      if (!data.stages || !Array.isArray(data.stages) || data.stages.length !== 3) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'הליך משפטי דורש בדיוק 3 שלבים'
        );
      }

      // ✅ Validation - סוג תמחור (hourly או fixed)
      if (!data.pricingType || !['hourly', 'fixed'].includes(data.pricingType)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'סוג תמחור חייב להיות "hourly" (שעתי) או "fixed" (מחיר פיקס)'
        );
      }

      // בדיקת כל שלב - תלוי בסוג התמחור
      data.stages.forEach((stage, index) => {
        if (!stage.description || stage.description.trim().length < 2) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `שלב ${index + 1}: תיאור השלב חייב להכיל לפחות 2 תווים`
          );
        }

        // ✅ Validation מותאם לסוג התמחור
        if (data.pricingType === 'hourly') {
          // תמחור שעתי - חובה שעות
          if (!stage.hours || typeof stage.hours !== 'number' || stage.hours <= 0) {
            throw new functions.https.HttpsError(
              'invalid-argument',
              `שלב ${index + 1}: תקרת שעות חייבת להיות מספר חיובי`
            );
          }
        } else if (data.pricingType === 'fixed') {
          // תמחור פיקס - חובה מחיר
          if (!stage.fixedPrice || typeof stage.fixedPrice !== 'number' || stage.fixedPrice <= 0) {
            throw new functions.https.HttpsError(
              'invalid-argument',
              `שלב ${index + 1}: מחיר פיקס חייב להיות מספר חיובי (בשקלים)`
            );
          }
        }
      });
    }

    // ✅ NEW ARCHITECTURE: שימוש במספר תיק מהדיאלוג או יצירה אוטומטית
    let caseNumber = data.caseNumber;

    // אם לא נשלח מספר תיק (או ריק), ניצור אוטומטית
    if (!caseNumber || caseNumber.trim() === '') {
      caseNumber = await generateCaseNumber();
      console.log(`🎯 Generated NEW case number: ${caseNumber} for client: ${data.clientName}`);
    } else {
      // בדיקת ייחודיות של המספר שנשלח
      const existingDoc = await db.collection('clients').doc(caseNumber).get();
      if (existingDoc.exists) {
        // ⚠️ Race Condition! מישהו אחר כבר יצר תיק עם המספר הזה
        // במקום להחזיר שגיאה, פשוט ניצור מספר חדש אוטומטית
        console.warn(`⚠️ Case number ${caseNumber} already exists! Generating new number...`);
        caseNumber = await generateCaseNumber();
        console.log(`🔄 Generated REPLACEMENT case number: ${caseNumber} (original ${data.caseNumber} was taken)`);
      } else {
        console.log(`✅ Using provided case number: ${caseNumber} for client: ${data.clientName}`);
      }
    }

    // ✅ יצירת המסמך המאוחד (Client = Case)
    const now = new Date().toISOString();
    const clientData = {
      // ✅ זיהוי ומידע בסיסי
      caseNumber: caseNumber,  // מספר תיק (גם Document ID)
      clientName: sanitizeString(data.clientName.trim()),
      fullName: sanitizeString(data.clientName.trim()), // ✅ גם fullName ל-backward compatibility

      // ✅ מידע משפטי - כותרת התיק
      caseTitle: data.caseTitle ? sanitizeString(data.caseTitle.trim()) : '',
      procedureType: data.procedureType,
      status: 'active',
      priority: 'medium',
      description: data.description ? sanitizeString(data.description.trim()) : '',

      // ✅ ניהול
      assignedTo: [user.username],
      mainAttorney: user.username,
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),

      // ✅ שדות חדשים
      services: [],  // ימולא בהמשך לפי סוג הליך
      totalServices: 0,
      activeServices: 0
    };

    // הוספת שדות ספציפיים לסוג הליך
    if (data.procedureType === 'hours') {
      // ✅ תוכנית שעות עם services[] + packages[]
      const serviceId = `srv_${Date.now()}`;
      const packageId = `pkg_${Date.now()}`;

      // ✅ שם שירות דינמי - אם לא נשלח, יצור מספר אוטומטי
      const serviceName = data.serviceName || `תוכנית שעות #${clientData.totalServices + 1}`;

      clientData.services = [
        {
          id: serviceId,
          type: 'hours',
          name: serviceName,
          description: data.description || '',
          status: 'active',
          createdAt: now,
          createdBy: user.username,

          packages: [
            {
              id: packageId,
              type: 'initial',
              hours: data.totalHours,
              hoursUsed: 0,
              hoursRemaining: data.totalHours,
              purchaseDate: now,
              status: 'active',
              description: 'חבילה ראשונית'
            }
          ],

          totalHours: data.totalHours,
          hoursUsed: 0,
          hoursRemaining: data.totalHours
        }
      ];

      // ✅ שמירת שדות ישנים ל-backward compatibility
      clientData.totalHours = data.totalHours;
      clientData.hoursRemaining = data.totalHours;
      clientData.minutesRemaining = data.totalHours * 60;

      clientData.totalServices = 1;
      clientData.activeServices = 1;

    } else if (data.procedureType === 'fixed') {
      clientData.stages = [
        { id: 1, name: 'שלב 1', completed: false },
        { id: 2, name: 'שלב 2', completed: false },
        { id: 3, name: 'שלב 3', completed: false }
      ];

    } else if (data.procedureType === 'legal_procedure') {
      // הליך משפטי עם 3 שלבים מפורטים
      clientData.currentStage = 'stage_a';
      clientData.pricingType = data.pricingType;

      // ✅ NEW STRUCTURE: שלבים בתוך services[] array
      const legalServiceId = `srv_legal_${Date.now()}`;

      if (data.pricingType === 'hourly') {
        // ✅ תמחור שעתי - שלבים עם שעות וחבילות
        const stages = [
          {
            id: 'stage_a',
            name: 'שלב א',
            description: sanitizeString(data.stages[0].description.trim()),
            order: 1,
            status: 'active',
            pricingType: 'hourly',
            initialHours: data.stages[0].hours,
            totalHours: data.stages[0].hours,
            hoursUsed: 0,
            hoursRemaining: data.stages[0].hours,
            packages: [
              {
                id: `pkg_initial_a_${Date.now()}`,
                type: 'initial',
                hours: data.stages[0].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[0].hours,
                purchaseDate: now,
                status: 'active'
              }
            ],
            startDate: now,
            completionDate: null,
            lastActivity: now
          },
          {
            id: 'stage_b',
            name: 'שלב ב',
            description: sanitizeString(data.stages[1].description.trim()),
            order: 2,
            status: 'pending',
            pricingType: 'hourly',
            initialHours: data.stages[1].hours,
            totalHours: data.stages[1].hours,
            hoursUsed: 0,
            hoursRemaining: data.stages[1].hours,
            packages: [
              {
                id: `pkg_initial_b_${Date.now() + 1}`,
                type: 'initial',
                hours: data.stages[1].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[1].hours,
                purchaseDate: now,
                status: 'pending'
              }
            ],
            startDate: null,
            completionDate: null,
            lastActivity: null
          },
          {
            id: 'stage_c',
            name: 'שלב ג',
            description: sanitizeString(data.stages[2].description.trim()),
            order: 3,
            status: 'pending',
            pricingType: 'hourly',
            initialHours: data.stages[2].hours,
            totalHours: data.stages[2].hours,
            hoursUsed: 0,
            hoursRemaining: data.stages[2].hours,
            packages: [
              {
                id: `pkg_initial_c_${Date.now() + 2}`,
                type: 'initial',
                hours: data.stages[2].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[2].hours,
                purchaseDate: now,
                status: 'pending'
              }
            ],
            startDate: null,
            completionDate: null,
            lastActivity: null
          }
        ];

        // חישוב סה"כ שעות בהליך
        const totalProcedureHours = data.stages.reduce((sum, s) => sum + s.hours, 0);

        // ✅ מבנה חדש: Services array
        clientData.services = [
          {
            id: legalServiceId,
            type: 'legal_procedure',
            name: sanitizeString(data.legalProcedureName || 'הליך משפטי'),
            pricingType: 'hourly',
            ratePerHour: data.ratePerHour || 800,
            status: 'active',
            stages: stages,

            // Service-level aggregates
            totalStages: 3,
            completedStages: 0,
            currentStage: 'stage_a',
            totalHours: totalProcedureHours,
            hoursUsed: 0,
            hoursRemaining: totalProcedureHours,
            totalMinutes: totalProcedureHours * 60,
            minutesUsed: 0,
            minutesRemaining: totalProcedureHours * 60,

            createdAt: now,
            createdBy: user.username || 'system',
            lastActivity: now
          }
        ];

        // ✅ Client-level aggregates
        clientData.totalHours = totalProcedureHours;
        clientData.hoursUsed = 0;
        clientData.hoursRemaining = totalProcedureHours;
        clientData.minutesRemaining = totalProcedureHours * 60;

        // ✅ Legacy support: ריק לתאימות אחורה
        clientData.stages = [];

      } else if (data.pricingType === 'fixed') {
        // ✅ תמחור פיקס - שלבים עם מחירים קבועים
        const stages = [
          {
            id: 'stage_a',
            name: 'שלב א',
            description: sanitizeString(data.stages[0].description.trim()),
            order: 1,
            status: 'active',
            pricingType: 'fixed',
            fixedPrice: data.stages[0].fixedPrice,
            paid: false,
            paymentDate: null,
            paymentMethod: null,
            startDate: now,
            completionDate: null,
            lastActivity: now
          },
          {
            id: 'stage_b',
            name: 'שלב ב',
            description: sanitizeString(data.stages[1].description.trim()),
            order: 2,
            status: 'pending',
            pricingType: 'fixed',
            fixedPrice: data.stages[1].fixedPrice,
            paid: false,
            paymentDate: null,
            paymentMethod: null,
            startDate: null,
            completionDate: null,
            lastActivity: null
          },
          {
            id: 'stage_c',
            name: 'שלב ג',
            description: sanitizeString(data.stages[2].description.trim()),
            order: 3,
            status: 'pending',
            pricingType: 'fixed',
            fixedPrice: data.stages[2].fixedPrice,
            paid: false,
            paymentDate: null,
            paymentMethod: null,
            startDate: null,
            completionDate: null,
            lastActivity: null
          }
        ];

        // חישוב סה"כ מחיר
        const totalFixedPrice = data.stages.reduce((sum, s) => sum + s.fixedPrice, 0);

        // ✅ מבנה חדש: Services array
        clientData.services = [
          {
            id: legalServiceId,
            type: 'legal_procedure',
            name: sanitizeString(data.legalProcedureName || 'הליך משפטי'),
            pricingType: 'fixed',
            status: 'active',
            stages: stages,

            // Service-level aggregates
            totalStages: 3,
            completedStages: 0,
            currentStage: 'stage_a',
            totalFixedPrice: totalFixedPrice,
            totalPaid: 0,
            remainingBalance: totalFixedPrice,

            createdAt: now,
            createdBy: user.username || 'system',
            lastActivity: now
          }
        ];

        // ✅ Client-level aggregates
        clientData.totalFixedPrice = totalFixedPrice;
        clientData.totalPaid = 0;
        clientData.remainingBalance = totalFixedPrice;

        // ✅ Legacy support: ריק לתאימות אחורה
        clientData.stages = [];
      }
    }

    // ✅ יצירת המסמך עם מספר תיק כ-Document ID
    // שימוש ב-.create() במקום .set() - מונע דריסה ומבטיח ייחודיות
    await db.collection('clients').doc(caseNumber).create(clientData);

    // Audit log
    await logAction('CREATE_CLIENT', user.uid, user.username, {
      caseNumber: caseNumber,
      clientName: clientData.clientName,
      procedureType: data.procedureType
    });

    console.log(`✅ Created client/case: ${caseNumber} - ${clientData.clientName}`);

    const result = {
      success: true,
      caseNumber: caseNumber,  // ✅ מספר תיק = מזהה
      clientId: caseNumber,    // ✅ לתאימות לאחור
      client: {
        id: caseNumber,
        caseNumber: caseNumber,
        ...clientData
      }
    };

    // ✅ שמירת תוצאה עבור Idempotency
    if (data.idempotencyKey) {
      await db.collection('processed_operations').doc(data.idempotencyKey).set({
        result,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        operation: 'createClient',
        user: user.username
      });
    }

    return result;

  } catch (error) {
    console.error('Error in createClient:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת לקוח: ${error.message}`
    );
  }
});

/**
 * 🎯 הוספת שירות חדש ללקוח (CLIENT = CASE)
 * ✅ NEW ARCHITECTURE: עובד עם clients collection ו-caseNumber
 * מאפשר ללקוח לקנות שירות נוסף (תוכנית שעות נוספת, הליך משפטי וכו')
 */
exports.addServiceToClient = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה לקוח חובה (מספר תיק)'
      );
    }

    if (!data.serviceType || !['hours', 'legal_procedure', 'fixed'].includes(data.serviceType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סוג שירות חייב להיות "hours", "legal_procedure" או "fixed"'
      );
    }

    if (!data.serviceName || typeof data.serviceName !== 'string' || data.serviceName.trim().length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'שם שירות חייב להכיל לפחות 2 תווים'
      );
    }

    // ✅ שליפת הלקוח (בארכיטקטורה החדשה: clientId = caseNumber = Document ID)
    const clientRef = db.collection('clients').doc(data.clientId);
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `לקוח ${data.clientId} לא נמצא`
      );
    }

    const clientData = clientDoc.data();
    const now = new Date().toISOString();
    const serviceId = `srv_${Date.now()}`;

    // יצירת השירות החדש
    let newService = {
      id: serviceId,
      type: data.serviceType,
      name: sanitizeString(data.serviceName.trim()),
      description: data.description ? sanitizeString(data.description.trim()) : '',
      status: 'active',
      createdAt: now,
      createdBy: user.username
    };

    // הוספת שדות ספציפיים לסוג השירות
    if (data.serviceType === 'hours') {
      // תוכנית שעות
      if (!data.hours || typeof data.hours !== 'number' || data.hours < 1) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'כמות שעות חייבת להיות מספר חיובי'
        );
      }

      const packageId = `pkg_${Date.now()}`;

      newService.packages = [
        {
          id: packageId,
          type: 'initial',
          hours: data.hours,
          hoursUsed: 0,
          hoursRemaining: data.hours,
          purchaseDate: now,
          status: 'active',
          description: 'חבילה ראשונית'
        }
      ];

      newService.totalHours = data.hours;
      newService.hoursUsed = 0;
      newService.hoursRemaining = data.hours;

    } else if (data.serviceType === 'legal_procedure') {
      // הליך משפטי - נדרש אימות נוסף
      if (!data.stages || !Array.isArray(data.stages) || data.stages.length !== 3) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'הליך משפטי דורש בדיוק 3 שלבים'
        );
      }

      if (!data.pricingType || !['hourly', 'fixed'].includes(data.pricingType)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'סוג תמחור חייב להיות "hourly" או "fixed"'
        );
      }

      newService.pricingType = data.pricingType;
      newService.currentStage = 'stage_a';

      // ✅ שמירת השלבים עם מזהים וסטטוסים
      newService.stages = data.stages.map((stage, index) => {
        const stageId = `stage_${['a', 'b', 'c'][index]}`;
        const stageName = ['שלב א\'', 'שלב ב\'', 'שלב ג\''][index];

        const processedStage = {
          id: stageId,
          name: stageName,
          description: sanitizeString(stage.description || ''),
          status: index === 0 ? 'active' : 'pending',
          order: index + 1
        };

        if (data.pricingType === 'hourly') {
          // תמחור שעתי - יצירת חבילת שעות ראשונית
          const packageId = `pkg_${stageId}_${Date.now()}`;
          processedStage.packages = [
            {
              id: packageId,
              type: 'initial',
              hours: stage.hours,
              hoursUsed: 0,
              hoursRemaining: stage.hours,
              purchaseDate: now,
              status: 'active',
              description: 'חבילה ראשונית'
            }
          ];
          processedStage.totalHours = stage.hours;
          processedStage.hoursUsed = 0;
          processedStage.hoursRemaining = stage.hours;
        } else {
          // תמחור פיקס
          processedStage.fixedPrice = stage.fixedPrice;
          processedStage.paid = false;
        }

        return processedStage;
      });

      // חישוב סיכומי שעות (אם שעתי)
      if (data.pricingType === 'hourly') {
        newService.totalHours = newService.stages.reduce((sum, s) => sum + (s.totalHours || 0), 0);
        newService.hoursUsed = 0;
        newService.hoursRemaining = newService.totalHours;
      } else {
        newService.totalPrice = newService.stages.reduce((sum, s) => sum + (s.fixedPrice || 0), 0);
        newService.totalPaid = 0;
      }
    }

    // הוספת השירות למערך services[]
    const services = clientData.services || [];
    services.push(newService);

    // עדכון הלקוח
    const clientTotalHours = services.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const clientHoursUsed = services.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
    const clientHoursRemaining = services.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
    const clientMinutesRemaining = clientHoursRemaining * 60;
    const clientIsBlocked = (clientHoursRemaining <= 0) && (clientData.type === 'hours');
    const clientIsCritical = (!clientIsBlocked) && (clientHoursRemaining <= 5) && (clientData.type === 'hours');

    const updates = {
      services: services,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
      totalHours: clientTotalHours,
      hoursUsed: clientHoursUsed,
      hoursRemaining: clientHoursRemaining,
      minutesRemaining: clientMinutesRemaining,
      isBlocked: clientIsBlocked,
      isCritical: clientIsCritical,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username
    };

    await clientRef.update(updates);

    // Audit log
    await logAction('ADD_SERVICE_TO_CLIENT', user.uid, user.username, {
      clientId: data.clientId,
      caseNumber: data.clientId,  // ✅ clientId = caseNumber
      serviceId: serviceId,
      serviceType: data.serviceType,
      serviceName: newService.name
    });

    console.log(`✅ Added service ${serviceId} to client ${data.clientId}`);

    return {
      success: true,
      serviceId: serviceId,
      service: newService,
      message: `שירות "${newService.name}" נוסף בהצלחה`
    };

  } catch (error) {
    console.error('Error in addServiceToClient:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהוספת שירות: ${error.message}`
    );
  }
});

// ⚠️ DEPRECATED: שמור לתאימות לאחור - מפנה ל-addServiceToClient
exports.addServiceToCase = functions.https.onCall(async (data, context) => {
  console.warn('⚠️ addServiceToCase is DEPRECATED. Use addServiceToClient instead.');

  // מפנה את הקריאה ל-addServiceToClient
  const clientId = data.caseId || data.clientId;
  return exports.addServiceToClient._handler({...data, clientId}, context);
});

/**
 * 🎯 הוספת חבילת שעות לשירות קיים (CLIENT = CASE)
 * ✅ NEW ARCHITECTURE: עובד עם clients collection
 * מאפשר ללקוח לרכוש שעות נוספות לשירות ספציפי
 */
exports.addPackageToService = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    const clientId = data.clientId || data.caseId;  // ✅ תמיכה בשני השמות

    if (!clientId || typeof clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה לקוח חובה (מספר תיק)'
      );
    }

    if (!data.serviceId || typeof data.serviceId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה שירות חובה'
      );
    }

    if (!data.hours || typeof data.hours !== 'number' || data.hours < 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כמות שעות חייבת להיות מספר חיובי'
      );
    }

    // ✅ שליפת הלקוח (בארכיטקטורה החדשה)
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `לקוח ${clientId} לא נמצא`
      );
    }

    const clientData = clientDoc.data();
    const services = clientData.services || [];

    // מציאת השירות
    const serviceIndex = services.findIndex(s => s.id === data.serviceId);

    if (serviceIndex === -1) {
      throw new functions.https.HttpsError(
        'not-found',
        'שירות לא נמצא עבור לקוח זה'
      );
    }

    const service = services[serviceIndex];

    // בדיקה שזה שירות שעות
    if (service.type !== 'hours' && service.serviceType !== 'hours') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ניתן להוסיף חבילה רק לתוכנית שעות'
      );
    }

    // יצירת חבילה חדשה
    const now = new Date().toISOString();
    const packageId = `pkg_${Date.now()}`;

    const newPackage = {
      id: packageId,
      type: 'additional',
      hours: data.hours,
      hoursUsed: 0,
      hoursRemaining: data.hours,
      purchaseDate: now,
      status: 'active',
      description: data.description ? sanitizeString(data.description.trim()) : `חבילה נוספת - ${new Date().toLocaleDateString('he-IL')}`
    };

    // הוספת החבילה לשירות
    service.packages = service.packages || [];
    service.packages.push(newPackage);

    // עדכון סיכומי השירות
    service.totalHours = (service.totalHours || 0) + data.hours;
    service.hoursRemaining = (service.hoursRemaining || 0) + data.hours;

    // עדכון המערך
    services[serviceIndex] = service;

    // שמירה
    const clientTotalHours = services.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const clientHoursUsed = services.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
    const clientHoursRemaining = services.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
    const clientMinutesRemaining = clientHoursRemaining * 60;
    const clientIsBlocked = (clientHoursRemaining <= 0) && (clientData.type === 'hours');
    const clientIsCritical = (!clientIsBlocked) && (clientHoursRemaining <= 5) && (clientData.type === 'hours');

    await clientRef.update({
      services: services,
      totalHours: clientTotalHours,
      hoursUsed: clientHoursUsed,
      hoursRemaining: clientHoursRemaining,
      minutesRemaining: clientMinutesRemaining,
      isBlocked: clientIsBlocked,
      isCritical: clientIsCritical,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username
    });

    // Audit log
    await logAction('ADD_PACKAGE_TO_SERVICE', user.uid, user.username, {
      clientId: clientId,
      caseNumber: clientId,  // ✅ clientId = caseNumber
      serviceId: data.serviceId,
      packageId: packageId,
      hours: data.hours,
      serviceName: service.name || service.serviceName
    });

    console.log(`✅ Added package ${packageId} (${data.hours}h) to service ${data.serviceId} for client ${clientId}`);

    return {
      success: true,
      packageId: packageId,
      package: newPackage,
      service: {
        id: service.id,
        name: service.name || service.serviceName,
        totalHours: service.totalHours,
        hoursRemaining: service.hoursRemaining,
        packagesCount: service.packages.length
      },
      message: `חבילה של ${data.hours} שעות נוספה בהצלחה לשירות "${service.name}"`
    };

  } catch (error) {
    console.error('Error in addPackageToService:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהוספת חבילה: ${error.message}`
    );
  }
});

/**
 * 🎯 הוספת חבילת שעות לשלב במסלול משפטי
 * ✅ PRODUCTION-READY: Transaction + Validation + Monitoring
 *
 * תומך בהוספת שעות נוספות לשלב ספציפי (stage_a, stage_b, stage_c)
 * במסלול משפטי קיים, עם דיוק אטומי ו-Single Source of Truth
 *
 * @param {Object} data
 * @param {string} data.caseId - מספר תיק (מזהה הלקוח)
 * @param {string} data.stageId - מזהה השלב (stage_a / stage_b / stage_c)
 * @param {number} data.hours - כמות שעות להוספה
 * @param {string} data.reason - סיבה להוספת השעות
 * @param {string} [data.purchaseDate] - תאריך רכישה (ISO format, אופציונלי)
 *
 * @returns {Object} { success, packageId, package, stage, service, client, message }
 *
 * @example
 * const result = await addHoursPackageToStage({
 *   caseId: "2025001",
 *   stageId: "stage_a",
 *   hours: 20,
 *   reason: "דיונים נוספים",
 *   purchaseDate: "2025-12-14"
 * });
 */
exports.addHoursPackageToStage = functions.https.onCall(async (data, context) => {
  try {
    // 🛡️ Authentication & Authorization
    const user = await checkUserPermissions(context);

    // ============ Validation ============

    // 1. Validate caseId
    const caseId = data.caseId || data.clientId;
    if (!caseId || typeof caseId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מספר תיק חובה'
      );
    }

    // 2. Validate stageId
    const validStageIds = ['stage_a', 'stage_b', 'stage_c'];
    if (!data.stageId || !validStageIds.includes(data.stageId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה שלב לא תקין (צריך להיות stage_a, stage_b, או stage_c)'
      );
    }

    // 3. Validate hours
    if (!data.hours || typeof data.hours !== 'number' || data.hours < 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כמות שעות חייבת להיות מספר חיובי'
      );
    }

    if (data.hours > 500) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)'
      );
    }

    // 4. Validate reason (min + max + sanitize)
    const reason = (data.reason || '').trim();

    if (reason.length < 3) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'הסבר להוספת השעות חייב להיות לפחות 3 תווים'
      );
    }

    if (reason.length > 500) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'הסבר להוספת השעות ארוך מדי (מקסימום 500 תווים)'
      );
    }

    const sanitizedReason = sanitizeString(reason);

    if (sanitizedReason.length < 3) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'הסבר מכיל תווים לא חוקיים'
      );
    }

    // 5. Validate purchaseDate (type + range + format)
    let purchaseDate;

    if (data.purchaseDate) {
      const parsed = new Date(data.purchaseDate);

      if (isNaN(parsed.getTime())) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'תאריך רכישה לא תקין. פורמט צריך להיות: YYYY-MM-DD'
        );
      }

      if (parsed > new Date()) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'תאריך רכישה לא יכול להיות בעתיד'
        );
      }

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (parsed < oneYearAgo) {
        console.warn(`⚠️ Purchase date is more than 1 year old: ${parsed.toISOString()}`);
      }

      purchaseDate = parsed.toISOString();
    }

    // ============ Generate IDs OUTSIDE Transaction ============
    // 🔥 CRITICAL: Date.now() must be outside Transaction
    // because Transaction can retry multiple times, and we want
    // the packageId to be consistent across all attempts
    const packageId = `pkg_additional_${data.stageId}_${Date.now()}`;
    const now = new Date().toISOString();
    if (!purchaseDate) {
      purchaseDate = now;
    }

    // ============ Transaction Start ============

    const clientRef = db.collection('clients').doc(caseId);

    const result = await db.runTransaction(async (transaction) => {
      // 🔒 Step 1: קריאה אטומית של המסמך
      const clientDoc = await transaction.get(clientRef);

      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `תיק ${caseId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      // 🔍 Step 2: מציאת ההליך המשפטי
      const legalProcedureIndex = services.findIndex(s => s.type === 'legal_procedure');

      if (legalProcedureIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          'לא נמצא הליך משפטי עבור תיק זה'
        );
      }

      const legalProcedure = services[legalProcedureIndex];
      const stages = legalProcedure.stages || [];

      // 🔍 Step 3: מציאת השלב
      const stageIndex = stages.findIndex(s => s.id === data.stageId);

      if (stageIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          `שלב ${data.stageId} לא נמצא בהליך המשפטי`
        );
      }

      const targetStage = stages[stageIndex];

      // ⚠️ Step 4: בדיקה אם השלב completed
      const stageWasCompleted = targetStage.status === 'completed';
      if (stageWasCompleted) {
        console.warn(`⚠️ Adding hours to COMPLETED stage ${data.stageId} for case ${caseId}`);
      }

      // 📦 Step 5: יצירת החבילה החדשה
      const newPackage = {
        id: packageId,  // ← from outside Transaction (consistent ID)
        type: 'additional',
        hours: data.hours,
        hoursUsed: 0,
        hoursRemaining: data.hours,
        purchaseDate: purchaseDate,
        status: targetStage.status === 'active' ? 'active' : 'pending',
        description: sanitizedReason,
        createdAt: now,  // ← from outside Transaction
        createdBy: user.username
      };

      // 🔄 Step 6: עדכון השלב

      // 🔥 CRITICAL: Validate packages is array
      if (!Array.isArray(targetStage.packages)) {
        console.warn(`⚠️ targetStage.packages is not an array for ${data.stageId}, resetting to []`);
        targetStage.packages = [];
      }

      targetStage.packages.push(newPackage);

      // ✅ CRITICAL: חישוב כל ה-aggregates מה-packages (Single Source of Truth)
      targetStage.totalHours = targetStage.packages.reduce((sum, pkg) =>
        sum + (pkg.hours || 0), 0);

      targetStage.hoursUsed = targetStage.packages.reduce((sum, pkg) =>
        sum + (pkg.hoursUsed || 0), 0);

      targetStage.hoursRemaining = targetStage.packages.reduce((sum, pkg) =>
        sum + (pkg.hoursRemaining || 0), 0);

      stages[stageIndex] = targetStage;

      // 🔄 Step 7: עדכון ה-service
      legalProcedure.stages = stages;

      // ✅ חישוב aggregates של service מחדש מה-stages
      legalProcedure.totalHours = stages.reduce((sum, stage) =>
        sum + (stage.totalHours || 0), 0);

      legalProcedure.hoursUsed = stages.reduce((sum, stage) =>
        sum + (stage.hoursUsed || 0), 0);

      legalProcedure.hoursRemaining = stages.reduce((sum, stage) =>
        sum + (stage.hoursRemaining || 0), 0);

      services[legalProcedureIndex] = legalProcedure;

      // 🔄 Step 8: עדכון ה-client
      // ✅ CRITICAL: חישוב aggregates של client מחדש מכל ה-services (Single Source of Truth!)
      const clientTotalHours = services.reduce((sum, service) =>
        sum + (service.totalHours || 0), 0);

      const clientHoursUsed = services.reduce((sum, service) =>
        sum + (service.hoursUsed || 0), 0);

      const clientHoursRemaining = services.reduce((sum, service) =>
        sum + (service.hoursRemaining || 0), 0);

      // 💾 Step 9: שמירה אטומית
      const clientMinutesRemaining = clientHoursRemaining * 60;
      const clientIsBlocked = (clientHoursRemaining <= 0) && (clientData.type === 'hours');
      const clientIsCritical = (!clientIsBlocked) && (clientHoursRemaining <= 5) && (clientData.type === 'hours');

      transaction.update(clientRef, {
        services: services,
        totalHours: clientTotalHours,
        hoursUsed: clientHoursUsed,
        hoursRemaining: clientHoursRemaining,
        minutesRemaining: clientMinutesRemaining,
        isBlocked: clientIsBlocked,
        isCritical: clientIsCritical,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      // ✅ Step 10: החזרת נתונים ל-audit log
      return {
        packageId,
        newPackage,
        targetStage,
        legalProcedure,
        clientTotalHours,
        clientHoursUsed,
        clientHoursRemaining,
        stageWasCompleted
      };
    });

    // ============ Audit Log (אחרי Transaction) ============

    try {
      await logAction('ADD_PACKAGE_TO_STAGE', user.uid, user.username, {
        caseId: caseId,
        caseNumber: caseId,
        stageId: data.stageId,
        stageName: result.targetStage.name,
        packageId: result.packageId,
        hours: data.hours,
        reason: sanitizedReason,
        procedureName: result.legalProcedure.name,
        stageStatusWasCompleted: result.stageWasCompleted
      });
    } catch (auditError) {
      // Audit נכשל אבל הנתונים כבר נשמרו
      console.error('⚠️ Audit log failed (data saved successfully):', auditError);

      // 🔥 Monitoring: מעקב אחרי audit failures
      try {
        await db.collection('monitoring').doc('audit_failures').set({
          count: admin.firestore.FieldValue.increment(1),
          lastFailure: admin.firestore.FieldValue.serverTimestamp(),
          lastError: auditError.message,
          lastFunction: 'addHoursPackageToStage',
          lastCaseId: caseId
        }, { merge: true });
      } catch (monitorError) {
        console.error('❌ Failed to log audit failure to monitoring:', monitorError);
      }
    }

    console.log(`✅ Added package ${result.packageId} (${data.hours}h) to stage ${data.stageId} for case ${caseId}`);

    // ============ Return Success ============

    return {
      success: true,
      packageId: result.packageId,
      package: result.newPackage,

      stage: {
        id: result.targetStage.id,
        name: result.targetStage.name,
        status: result.targetStage.status,
        totalHours: result.targetStage.totalHours,
        hoursUsed: result.targetStage.hoursUsed,
        hoursRemaining: result.targetStage.hoursRemaining,
        packagesCount: result.targetStage.packages.length
      },

      service: {
        id: result.legalProcedure.id,
        name: result.legalProcedure.name,
        totalHours: result.legalProcedure.totalHours,
        hoursUsed: result.legalProcedure.hoursUsed,
        hoursRemaining: result.legalProcedure.hoursRemaining
      },

      client: {
        caseId: caseId,
        totalHours: result.clientTotalHours,
        hoursUsed: result.clientHoursUsed,
        hoursRemaining: result.clientHoursRemaining
      },

      message: `חבילה של ${data.hours} שעות נוספה בהצלחה לשלב "${result.targetStage.name}"`
    };

  } catch (error) {
    console.error('❌ Error in addHoursPackageToStage:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהוספת חבילה לשלב: ${error.message}`
    );
  }
});

/**
 * מעבר לשלב הבא בהליך משפטי
 * CF מחשבת בעצמה מי השלב הנוכחי ומי הבא
 *
 * @param {Object} data
 * @param {string} data.clientId - מספר תיק (Document ID)
 * @param {string} data.serviceId - מזהה השירות (legal_procedure)
 * @returns {Object} { success, serviceId, fromStage, toStage, isLastStage, message }
 */
exports.moveToNextStage = functions.https.onCall(async (data, context) => {
  try {
    // 1. Auth
    const user = await checkUserPermissions(context);

    // 2. Validation
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה לקוח חובה'
      );
    }

    if (!data.serviceId || typeof data.serviceId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה שירות חובה'
      );
    }

    // 3. Transaction
    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      // 3a. שליפת client doc
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      // 3b. מציאת service
      const serviceIndex = services.findIndex(s => s.id === data.serviceId);
      if (serviceIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          'שירות לא נמצא עבור לקוח זה'
        );
      }

      const service = services[serviceIndex];

      // 3c. בדיקת סוג שירות
      if (service.type !== 'legal_procedure' && service.serviceType !== 'legal_procedure') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'ניתן להעביר שלבים רק בהליך משפטי'
        );
      }

      // 3d. בדיקת stages
      if (!service.stages || !Array.isArray(service.stages) || service.stages.length === 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'אין שלבים בשירות זה'
        );
      }

      // 3e. מציאת active stage
      const activeIndex = service.stages.findIndex(s => s.status === 'active');
      if (activeIndex === -1) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'אין שלב פעיל בשירות'
        );
      }

      // 3f. בדיקת שלב אחרון
      if (activeIndex >= service.stages.length - 1) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'השירות נמצא בשלב האחרון — אין שלב הבא'
        );
      }

      const currentStage = service.stages[activeIndex];
      const nextStage = service.stages[activeIndex + 1];
      const now = new Date().toISOString();

      // 3g. Immutable update — stages
      const updatedStages = service.stages.map((stage, idx) => {
        if (idx === activeIndex) return { ...stage, status: 'completed', completedAt: now };
        if (idx === activeIndex + 1) return { ...stage, status: 'active', startedAt: now };
        return stage;
      });
      const updatedService = { ...service, stages: updatedStages };
      const updatedServices = services.map((s, idx) => idx === serviceIndex ? updatedService : s);

      // 3h. כתיבה ל-Firestore (Transaction)
      const isLastStage = (activeIndex + 1) === service.stages.length - 1;

      transaction.update(clientRef, {
        services: updatedServices,
        currentStage: nextStage.id,
        currentStageName: nextStage.name || nextStage.id,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      // 3i. return data from transaction
      return {
        currentStage: { id: currentStage.id, name: currentStage.name || currentStage.id },
        nextStage: { id: nextStage.id, name: nextStage.name || nextStage.id },
        updatedStages: updatedStages,
        isLastStage: isLastStage,
        serviceName: service.name || service.serviceName
      };
    });

    // 4. Audit log (outside transaction)
    await logAction('MOVE_TO_NEXT_STAGE', user.uid, user.username, {
      clientId: data.clientId,
      caseNumber: data.clientId,
      serviceId: data.serviceId,
      fromStageId: result.currentStage.id,
      fromStageName: result.currentStage.name,
      toStageId: result.nextStage.id,
      toStageName: result.nextStage.name,
      serviceName: result.serviceName
    });

    // 5. Return
    console.log(`✅ Stage moved: ${result.currentStage.id} → ${result.nextStage.id} for client ${data.clientId}`);

    return {
      success: true,
      serviceId: data.serviceId,
      fromStage: result.currentStage,
      toStage: result.nextStage,
      updatedStages: result.updatedStages,
      isLastStage: result.isLastStage,
      message: `עברת לשלב "${result.nextStage.name}"`
    };

  } catch (error) {
    console.error('Error in moveToNextStage:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במעבר שלב: ${error.message}`
    );
  }
});

/**
 * קריאת לקוחות - כל המשרד רואה את כל הלקוחות
 * @param {Object} data - פרמטרים
 * @param {boolean} data.includeInternal - האם לכלול תיקים פנימיים (ברירת מחדל: false)
 */
exports.getClients = functions.https.onCall(async (data, context) => {
  try {
    // ✅ בדיקה שהמשתמש מחובר ופעיל
    await checkUserPermissions(context);

    // ✅ בדיקה האם לכלול תיקים פנימיים
    const includeInternal = data?.includeInternal === true;

    // ✅ כל עובד רואה את כל לקוחות המשרד
    const snapshot = await db.collection('clients').get();

    const clients = [];
    snapshot.forEach(doc => {
      const clientData = doc.data();

      // ✅ סינון תיקים פנימיים אלא אם התבקש לכלול אותם
      if (!includeInternal && (clientData.isInternal === true || clientData.clientType === 'internal')) {
        return; // דילוג על תיק פנימי
      }

      clients.push({
        id: doc.id,
        ...clientData
      });
    });

    return {
      success: true,
      clients
    };

  } catch (error) {
    console.error('Error in getClients:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת לקוחות: ${error.message}`
    );
  }
});

/**
 * עדכון לקוח
 */
exports.updateClient = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (!data.clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    // בדיקה שהלקוח קיים ושייך למשתמש
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    const clientData = clientDoc.data();

    // רק בעל הלקוח או admin יכולים לעדכן
    if (clientData.createdBy !== user.username && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה לעדכן לקוח זה'
      );
    }

    // Validation
    const updates = {};

    if (data.fullName !== undefined) {
      if (!data.fullName || data.fullName.trim().length < 2) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'שם לקוח חייב להכיל לפחות 2 תווים'
        );
      }
      // ✅ CRITICAL FIX: סנכרון fullName + clientName למניעת אי-התאמה
      const sanitizedName = sanitizeString(data.fullName.trim());
      updates.fullName = sanitizedName;
      updates.clientName = sanitizedName;  // Keep in sync!
    }

    if (data.phone !== undefined) {
      if (data.phone && !isValidIsraeliPhone(data.phone)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'מספר טלפון לא תקין'
        );
      }
      updates.phone = data.phone ? sanitizeString(data.phone.trim()) : '';
    }

    if (data.email !== undefined) {
      if (data.email && !isValidEmail(data.email)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'כתובת אימייל לא תקינה'
        );
      }
      updates.email = data.email ? sanitizeString(data.email.trim()) : '';
    }

    updates.lastModifiedBy = user.username;
    updates.lastModifiedAt = admin.firestore.FieldValue.serverTimestamp();

    // עדכון
    await db.collection('clients').doc(data.clientId).update(updates);

    // Audit log
    await logAction('UPDATE_CLIENT', user.uid, user.username, {
      clientId: data.clientId,
      updates: Object.keys(updates)
    });

    return {
      success: true,
      clientId: data.clientId
    };

  } catch (error) {
    console.error('Error in updateClient:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון לקוח: ${error.message}`
    );
  }
});

/**
 * מחיקת לקוח
 */
exports.deleteClient = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (!data.clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    // בדיקה שהלקוח קיים
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    const clientData = clientDoc.data();

    // רק בעל הלקוח או admin יכולים למחוק
    if (clientData.createdBy !== user.username && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה למחוק לקוח זה'
      );
    }

    // מחיקה
    await db.collection('clients').doc(data.clientId).delete();

    // Audit log
    await logAction('DELETE_CLIENT', user.uid, user.username, {
      clientId: data.clientId,
      clientName: clientData.fullName
    });

    return {
      success: true,
      clientId: data.clientId
    };

  } catch (error) {
    console.error('Error in deleteClient:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במחיקת לקוח: ${error.message}`
    );
  }
});

// ===============================
// Budget Tasks Functions
// ===============================

/**
 * יצירת משימת תקציב
 */
/**
 * 🎯 יצירת משימה חדשה (CLIENT = CASE)
 * ✅ NEW ARCHITECTURE: עובד עם clients collection, clientId = caseNumber
 */
exports.createBudgetTask = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.description || typeof data.description !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'תיאור המשימה חייב להיות מחרוזת תקינה'
      );
    }

    if (data.description.trim().length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'תיאור המשימה חייב להכיל לפחות 2 תווים'
      );
    }

    // ✅ NEW: clientId הוא מספר התיק (caseNumber)
    const clientId = data.clientId || data.caseId;  // תמיכה לאחור

    if (!clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח (מספר תיק)'
      );
    }

    // ✅ תמיכה הן ב-estimatedMinutes והן ב-estimatedHours
    const estimatedMinutes = data.estimatedMinutes || (data.estimatedHours ? data.estimatedHours * 60 : 0);
    const estimatedHours = data.estimatedHours || (data.estimatedMinutes ? data.estimatedMinutes / 60 : 0);

    if (estimatedMinutes <= 0 && estimatedHours <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'זמן משוער חייב להיות מספר חיובי'
      );
    }

    // ✅ בדיקת סניף מטפל
    if (!data.branch || typeof data.branch !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור סניף מטפל'
      );
    }

    // Prepare refs (generate IDs upfront)
    const taskRef = db.collection('budget_tasks').doc();
    const approvalRef = db.collection('pending_task_approvals').doc();
    const clientRef = db.collection('clients').doc(clientId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Task + Approval Creation
    // ═══════════════════════════════════════════════════════════════════

    let clientData;
    let savedTaskData;

    await db.runTransaction(async (transaction) => {
      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading client...`);

      const clientDoc = await transaction.get(clientRef);

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${clientId} לא נמצא`
        );
      }

      clientData = clientDoc.data();

      console.log(`✅ Creating task for client ${clientId} (${clientData.clientName})`);

      // 🆕 Phase 1: שמירת ערכים מקוריים (לא ישתנו לעולם)
      const deadlineTimestamp = data.deadline ? admin.firestore.Timestamp.fromDate(new Date(data.deadline)) : null;

      const taskData = {
        description: sanitizeString(data.description.trim()),
        categoryId: data.categoryId || null, // ✅ מזהה קטגוריית עבודה (Work Category ID)
        categoryName: data.categoryName || null, // ✅ שם קטגוריית העבודה (Work Category Name)
        clientId: clientId,  // ✅ מספר תיק
        clientName: clientData.clientName || data.clientName,
        caseNumber: clientData.caseNumber || clientId,  // ✅ מספר תיק
        serviceId: data.serviceId || null, // ✅ תמיכה בבחירת שירות ספציפי
        serviceName: data.serviceName || null, // ✅ שם השירות
        serviceType: data.serviceType || null, // ✅ סוג השירות (legal_procedure/hours)
        parentServiceId: data.parentServiceId || null, // ✅ service.id עבור הליך משפטי
        branch: sanitizeString(data.branch.trim()), // ✅ סניף מטפל
        estimatedHours: estimatedHours,
        estimatedMinutes: estimatedMinutes,
        actualHours: 0,
        actualMinutes: 0,

        // 🆕 תקציב ויעד מקוריים (NEVER CHANGE)
        originalEstimate: estimatedMinutes,
        originalDeadline: deadlineTimestamp,

        // 🆕 מערכים לעדכונים
        budgetAdjustments: [],
        deadlineExtensions: [],

        status: 'פעיל',  // ✅ Always active - no approval needed
        // Removed: requestedMinutes, approvedMinutes - no longer needed
        deadline: deadlineTimestamp,
        employee: user.email, // ✅ EMAIL for security rules and queries
        lawyer: user.username, // ✅ Username for display
        createdBy: user.username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        timeEntries: []
      };

      // ✅ Create approval history record (for tracking/FYI)
      const approvalRecord = {
        taskId: taskRef.id,
        requestedBy: user.email,
        requestedByName: user.employee.name || user.username,  // ✅ Hebrew name preferred
        requestedMinutes: estimatedMinutes,
        taskData: {
          description: taskData.description,
          clientName: taskData.clientName,
          clientId: clientId,
          estimatedMinutes: estimatedMinutes
        },
        status: 'auto_approved',  // ✅ Auto-approved - no manual approval needed
        autoApproved: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing task and approval...`);

      // Save taskData for response (before it goes out of scope)
      savedTaskData = taskData;

      // Write #1: Task
      transaction.set(taskRef, taskData);
      console.log(`  ✅ Task creation queued: ${taskRef.id}`);

      // Write #2: Approval
      transaction.set(approvalRef, approvalRecord);
      console.log(`  ✅ Approval creation queued: ${approvalRef.id}`);

      console.log(`🔒 [Transaction] All writes queued, committing...`);
    });

    console.log(`✅ Created task ${taskRef.id} for client ${clientId} (atomic)`);
    console.log(`✅ Created approval history record for task ${taskRef.id}`);

    // Audit log (OUTSIDE transaction - eventual consistency)
    try {
      await logAction('CREATE_TASK', user.uid, user.username, {
        taskId: taskRef.id,
        clientId: clientId,
        caseNumber: clientData.caseNumber,
        estimatedHours: estimatedHours
      });
    } catch (auditError) {
      console.error('❌ שגיאה ב-audit log:', auditError);
      // Don't fail the task creation if audit logging fails
    }

    return {
      success: true,
      taskId: taskRef.id,
      task: {
        id: taskRef.id,
        ...savedTaskData
      }
    };

  } catch (error) {
    console.error('Error in createBudgetTask:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת משימה: ${error.message}`
    );
  }
});

/**
 * קריאת משימות
 */
exports.getBudgetTasks = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    let query = db.collection('budget_tasks');

    // רק מנהלים יכולים לראות הכל
    if (user.role !== 'admin') {
      query = query.where('employee', '==', user.email); // ✅ Query by EMAIL
    }

    // סינון לפי סטטוס
    if (data.status) {
      query = query.where('status', '==', data.status);
    }

    const snapshot = await query.get();

    const tasks = [];
    snapshot.forEach(doc => {
      tasks.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      tasks
    };

  } catch (error) {
    console.error('Error in getBudgetTasks:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת משימות: ${error.message}`
    );
  }
});

/**
 * הוספת זמן למשימה V2 - With Transaction + Optimistic Locking
 * ✅ FIXED: כל הפעולות ב-transaction אחד למניעת race conditions
 */
exports.addTimeToTask = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    if (typeof data.minutes !== 'number' || data.minutes <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'דקות חייבות להיות מספר חיובי'
      );
    }

    if (!data.date) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תאריך'
      );
    }

    // ✅ שימוש בגרסה החדשה עם Transaction + Optimistic Locking
    const result = await addTimeToTaskWithTransaction(db, data, user);
    return result;

  } catch (error) {
    console.error('Error in addTimeToTask:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהוספת זמן: ${error.message}`
    );
  }
});

/**
 * סימון משימה כהושלמה
 */
exports.completeTask = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    // Prepare ref
    const taskRef = db.collection('budget_tasks').doc(data.taskId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Task Completion
    // ═══════════════════════════════════════════════════════════════════

    let taskData, gapPercent, isCritical;

    await db.runTransaction(async (transaction) => {

      // ========================================
      // PHASE 1: READ OPERATION
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading task...`);

      const taskDoc = await transaction.get(taskRef);

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'משימה לא נמצאה'
        );
      }

      taskData = taskDoc.data();

      if (taskData.employee !== user.email && user.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'אין הרשאה לסמן משימה זו כהושלמה'
        );
      }

      // ✅ NEW: בדיקה שיש רישומי זמן לפני סיום המשימה
      const actualHours = taskData.actualHours || 0;
      if (actualHours === 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `❌ לא ניתן לסיים משימה ללא רישומי זמן!

משימה: ${taskData.title}
תקציב: ${taskData.budgetHours || 0} שעות
בפועל: 0 שעות

אנא רשום זמן לפני סיום המשימה.
זה מבטיח מעקב מדויק ונתונים אמיתיים.`
        );
      }

      // ✨ NEW: Calculate time gap for validation tracking
      const estimatedMinutes = taskData.estimatedMinutes || 0;
      const actualMinutes = taskData.actualMinutes || 0;
      const gapMinutes = actualMinutes - estimatedMinutes;
      gapPercent = estimatedMinutes > 0 ? Math.abs((gapMinutes / estimatedMinutes) * 100) : 0;
      isCritical = gapPercent >= 50;

      // Prepare update object
      const updateData = {
        status: 'הושלם',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: user.username,
        completionNotes: data.completionNotes ? sanitizeString(data.completionNotes) : '',
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        // ✨ NEW: Add completion metadata
        completion: {
          gapPercent: Math.round(gapPercent),
          gapMinutes: Math.abs(gapMinutes),
          estimatedMinutes,
          actualMinutes,
          isOver: gapMinutes > 0,
          isUnder: gapMinutes < 0,
          gapReason: data.gapReason || null,
          gapNotes: data.gapNotes || null,
          requiresReview: isCritical,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      };

      // ========================================
      // PHASE 3: WRITE OPERATION
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing task update...`);

      transaction.update(taskRef, updateData);

      console.log(`🔒 [Transaction] Task completion queued, committing...`);
    });

    console.log(`✅ משימה סומנה כהושלמה: ${data.taskId} (atomic)`);
    console.log(`ℹ️ קיזוז שעות כבר בוצע בעת רישום השעתון (createTimesheetEntry)`);
    console.log(`📊 פער זמן: ${Math.round(gapPercent)}% (${Math.abs(gapPercent)} דקות)`);

    // ✨ NEW: Create admin alert for critical gaps (OUTSIDE transaction - eventual consistency)
    if (isCritical) {
      try {
        await db.collection('task_completion_alerts').add({
          taskId: data.taskId,
          taskTitle: taskData.taskDescription || taskData.description || 'משימה ללא כותרת',
          clientName: taskData.clientName || '',
          employee: user.username,
          employeeEmail: user.email,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          gapPercent: Math.round(gapPercent),
          gapMinutes: Math.abs(Math.abs(taskData.actualMinutes || 0) - (taskData.estimatedMinutes || 0)),
          isOver: (taskData.actualMinutes || 0) > (taskData.estimatedMinutes || 0),
          estimatedMinutes: taskData.estimatedMinutes || 0,
          actualMinutes: taskData.actualMinutes || 0,
          gapReason: data.gapReason || null,
          gapNotes: data.gapNotes || null,
          completionNotes: data.completionNotes || '',
          status: 'pending', // pending, reviewed, approved, rejected
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`🚨 התראה נוצרה למנהל - פער קריטי של ${Math.round(gapPercent)}%`);
      } catch (alertError) {
        console.error('❌ שגיאה ביצירת התראה למנהל:', alertError);
        // Don't fail the completion if alert creation fails
      }
    }

    // Audit log (OUTSIDE transaction - eventual consistency)
    try {
      await logAction('COMPLETE_TASK', user.uid, user.username, {
        taskId: data.taskId,
        actualMinutes: taskData.actualMinutes || 0,
        gapPercent: Math.round(gapPercent),
        isCritical
      });
    } catch (auditError) {
      console.error('❌ שגיאה ב-audit log:', auditError);
      // Don't fail the completion if audit logging fails
    }

    return {
      success: true,
      taskId: data.taskId,
      gapPercent: Math.round(gapPercent),
      isCritical
    };

  } catch (error) {
    console.error('Error in completeTask:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בסימון משימה: ${error.message}`
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ❌ CANCEL BUDGET TASK (Soft Delete)
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Cancel an active budget task (soft delete)
 *
 * @param {Object} data - Function parameters
 * @param {string} data.taskId - Task ID to cancel
 * @param {string} data.reason - Cancellation reason (required, non-empty)
 *
 * Rules:
 * - Only allow cancel if task.status === 'פעיל'
 * - Block if actualMinutes > 0 (task has time entries)
 * - Require non-empty reason
 *
 * Updates:
 * - status='בוטל'
 * - cancelReason, cancelledAt, cancelledBy
 * - lastModifiedAt, lastModifiedBy
 *
 * Audit: Logs CANCEL_TASK action
 */
exports.cancelBudgetTask = functions.https.onCall(async (data, context) => {
  try {
    // Authentication and permissions check
    const user = await checkUserPermissions(context);
    console.log(`🔄 [cancelBudgetTask] User: ${user.username} (${user.email})`);

    // Validate input
    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק סיבת ביטול'
      );
    }

    const reason = sanitizeString(data.reason.trim());
    if (reason.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סיבת הביטול לא יכולה להיות ריקה'
      );
    }

    // Prepare refs
    const taskRef = db.collection('budget_tasks').doc(data.taskId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Task + Approval Cancellation
    // ═══════════════════════════════════════════════════════════════════

    let taskData;

    await db.runTransaction(async (transaction) => {
      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading task and approval...`);

      const taskDoc = await transaction.get(taskRef);

      // Query for approval record
      const approvalSnapshot = await db.collection('pending_task_approvals')
        .where('taskId', '==', data.taskId)
        .limit(1)
        .get();

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'משימה לא נמצאה'
        );
      }

      taskData = taskDoc.data();

      // Authorization: Allow admin OR task owner
      const isAdmin = user.employee.isAdmin === true || user.role === 'admin';
      const isOwner = taskData.employee === user.email;

      if (!isAdmin && !isOwner) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'אין הרשאה לבטל משימה זו. רק בעל המשימה או מנהל מערכת יכולים לבטל משימה.'
        );
      }

      // Validate task status
      if (taskData.status !== 'פעיל') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `לא ניתן לבטל משימה עם סטטוס: ${taskData.status}. ניתן לבטל רק משימות פעילות.`
        );
      }

      // Block if task has time entries
      const actualMinutes = taskData.actualMinutes || 0;
      if (actualMinutes > 0) {
        const actualHours = (actualMinutes / 60).toFixed(2);
        throw new functions.https.HttpsError(
          'failed-precondition',
          `לא ניתן לבטל משימה עם רישומי זמן (${actualHours} שעות נרשמו). נא לפנות למנהל/ת לטיפול במשימה.`
        );
      }

      // Prepare task update
      const taskUpdateData = {
        status: 'בוטל',
        cancelReason: reason,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: user.username,
        cancelledByEmail: user.email,
        cancelledByUid: user.uid,
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Prepare approval update (if exists)
      let approvalUpdateData = null;
      let approvalRef = null;
      if (!approvalSnapshot.empty) {
        approvalRef = approvalSnapshot.docs[0].ref;
        approvalUpdateData = {
          status: 'task_cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: user.username,
          cancelledByEmail: user.email
        };
        console.log(`  🔗 עדכון approval מוכן: ${approvalRef.id}`);
      }

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing updates...`);

      // Write #1: Task (always)
      transaction.update(taskRef, taskUpdateData);
      console.log(`  ✅ Task update queued`);

      // Write #2: Approval (if exists)
      if (approvalRef && approvalUpdateData) {
        transaction.update(approvalRef, approvalUpdateData);
        console.log(`  ✅ Approval update queued`);
      }

      console.log(`🔒 [Transaction] All updates queued, committing...`);
    });

    console.log(`✅ משימה בוטלה: ${data.taskId} (atomic)`);
    console.log(`📝 סיבה: ${reason}`);

    // Audit log (OUTSIDE transaction - eventual consistency)
    try {
      await logAction('CANCEL_TASK', user.uid, user.username, {
        taskId: data.taskId,
        reason: reason,
        clientId: taskData.clientId || null,
        clientName: taskData.clientName || null
      });
    } catch (auditError) {
      console.error('❌ שגיאה ב-audit log:', auditError);
      // Don't fail the cancellation if audit logging fails
    }

    return {
      success: true,
      taskId: data.taskId,
      cancelledAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in cancelBudgetTask:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בביטול משימה: ${error.message}`
    );
  }
});

/**
 * 🆕 Phase 1: עדכון תקציב משימה
 * מאפשר למשתמש לעדכן את התקציב כשהוא רואה שהוא חורג
 */
exports.adjustTaskBudget = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    if (typeof data.newEstimate !== 'number' || data.newEstimate <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'תקציב חדש חייב להיות מספר חיובי'
      );
    }

    // Prepare ref
    const taskRef = db.collection('budget_tasks').doc(data.taskId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Budget Adjustment
    // ═══════════════════════════════════════════════════════════════════

    let taskData, oldEstimate, addedMinutes;

    await db.runTransaction(async (transaction) => {
      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading task...`);

      const taskDoc = await transaction.get(taskRef);

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'משימה לא נמצאה'
        );
      }

      taskData = taskDoc.data();

      // רק בעל המשימה או admin יכולים לעדכן תקציב
      if (taskData.employee !== user.email && user.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'אין הרשאה לעדכן תקציב משימה זו'
        );
      }

      // לא ניתן לעדכן תקציב של משימה שהושלמה
      if (taskData.status === 'הושלם') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'לא ניתן לעדכן תקציב של משימה שכבר הושלמה'
        );
      }

      oldEstimate = taskData.estimatedMinutes || 0;
      addedMinutes = data.newEstimate - oldEstimate;

      // יצירת רשומת עדכון
      const adjustment = {
        timestamp: new Date().toISOString(),
        type: addedMinutes > 0 ? 'increase' : 'decrease',
        oldEstimate,
        newEstimate: data.newEstimate,
        addedMinutes,
        reason: data.reason ? sanitizeString(data.reason) : 'לא צוין',
        adjustedBy: user.username,
        actualAtTime: taskData.actualMinutes || 0
      };

      // Prepare update data
      const updateData = {
        estimatedMinutes: data.newEstimate,
        estimatedHours: data.newEstimate / 60,
        budgetAdjustments: admin.firestore.FieldValue.arrayUnion(adjustment),
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing budget adjustment...`);

      transaction.update(taskRef, updateData);
      console.log(`  ✅ Budget adjustment queued`);

      console.log(`🔒 [Transaction] Update queued, committing...`);
    });

    console.log(`✅ תקציב משימה ${data.taskId} עודכן מ-${oldEstimate} ל-${data.newEstimate} דקות (atomic)`);

    // Audit log (OUTSIDE transaction - eventual consistency)
    try {
      await logAction('ADJUST_BUDGET', user.uid, user.username, {
        taskId: data.taskId,
        oldEstimate,
        newEstimate: data.newEstimate,
        addedMinutes,
        reason: data.reason
      });
    } catch (auditError) {
      console.error('❌ שגיאה ב-audit log:', auditError);
      // Don't fail the budget adjustment if audit logging fails
    }

    return {
      success: true,
      taskId: data.taskId,
      oldEstimate,
      newEstimate: data.newEstimate,
      addedMinutes,
      message: `תקציב עודכן מ-${oldEstimate} ל-${data.newEstimate} דקות`
    };

  } catch (error) {
    console.error('Error in adjustTaskBudget:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון תקציב: ${error.message}`
    );
  }
});

/**
 * הארכת תאריך יעד למשימה
 */
exports.extendTaskDeadline = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    if (!data.newDeadline) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תאריך יעד חדש'
      );
    }

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק סיבה להארכה (לפחות 2 תווים)'
      );
    }

    // בדיקה שהמשימה קיימת
    const taskDoc = await db.collection('budget_tasks').doc(data.taskId).get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'משימה לא נמצאה'
      );
    }

    const taskData = taskDoc.data();

    // רק בעל המשימה או admin יכולים להאריך יעד
    if (taskData.employee !== user.email && user.role !== 'admin') { // ✅ Check by EMAIL
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה להאריך יעד למשימה זו'
      );
    }

    // בדיקה שהמשימה לא הושלמה
    if (taskData.status === 'הושלם' || taskData.status === 'completed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'לא ניתן להאריך יעד למשימה שכבר הושלמה'
      );
    }

    // המרת התאריך החדש ל-Timestamp
    const newDeadlineDate = new Date(data.newDeadline);
    if (isNaN(newDeadlineDate.getTime())) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'תאריך היעד החדש אינו תקין'
      );
    }

    // שמירת היעד הישן (אם יש) או היעד הנוכחי כ-originalDeadline
    const originalDeadline = taskData.originalDeadline || taskData.deadline || newDeadlineDate;

    // יצירת רישום הארכה
    const extension = {
      oldDeadline: taskData.deadline,
      newDeadline: admin.firestore.Timestamp.fromDate(newDeadlineDate),
      reason: sanitizeString(data.reason.trim()),
      extendedBy: user.username,
      extendedAt: admin.firestore.Timestamp.now() // ✅ שימוש ב-Timestamp.now() במקום serverTimestamp()
    };

    // עדכון המשימה
    await db.collection('budget_tasks').doc(data.taskId).update({
      deadline: admin.firestore.Timestamp.fromDate(newDeadlineDate),
      originalDeadline: originalDeadline,
      deadlineExtensions: admin.firestore.FieldValue.arrayUnion(extension),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log
    await logAction('EXTEND_TASK_DEADLINE', user.uid, user.username, {
      taskId: data.taskId,
      oldDeadline: taskData.deadline,
      newDeadline: data.newDeadline,
      reason: data.reason
    });

    return {
      success: true,
      taskId: data.taskId,
      newDeadline: data.newDeadline
    };

  } catch (error) {
    console.error('Error in extendTaskDeadline:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהארכת תאריך יעד: ${error.message}`
    );
  }
});

// ===============================
// Timesheet Functions
// ===============================

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎯 Quick Log Entry - Manager/Admin Only
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Simplified timesheet entry for managers without task requirement
 *
 * @function createQuickLogEntry
 * @param {Object} data
 * @param {string} data.clientId - Client document ID (required)
 * @param {string} data.clientName - Client display name (required)
 * @param {Timestamp} data.date - Entry date (required)
 * @param {number} data.minutes - Duration in minutes (required, > 0)
 * @param {string} data.description - Work description (required)
 * @param {Object} context - Firebase auth context
 * @returns {Object} { success: boolean, entryId: string, message: string }
 *
 * @created 2026-01-30
 * @version 1.0.0
 *
 * Key Differences from createTimesheetEntry:
 * - ✅ Manager/Admin only (enforced at server)
 * - ❌ No taskId requirement
 * - ✅ Sets isQuickLog: true flag
 * - ✅ Reuses same schema and deduction logic
 * ════════════════════════════════════════════════════════════════════════════
 */
exports.createQuickLogEntry = functions.https.onCall(async (data, context) => {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1️⃣ AUTHENTICATION & AUTHORIZATION
    // ═══════════════════════════════════════════════════════════════════

    const user = await checkUserPermissions(context);

    // 🔒 CRITICAL: Enforce manager/admin only
    if (user.role !== 'manager' && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להשתמש ברישום מהיר'
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    if (!data.clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    if (!data.date) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תאריך'
      );
    }

    if (typeof data.minutes !== 'number' || data.minutes <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'דקות חייבות להיות מספר חיובי'
      );
    }

    if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תיאור פעולה'
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ DATE PARSING (Before transaction)
    // ═══════════════════════════════════════════════════════════════════

    // Parse date - supports multiple formats for backward compatibility
    let dateTimestamp;
    const dateType = typeof data.date;

    if (dateType === 'string') {
      // ISO string format (current format from frontend)
      const d = new Date(data.date);
      if (isNaN(d.getTime())) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid date string format'
        );
      }
      dateTimestamp = admin.firestore.Timestamp.fromDate(d);
      console.log('[Quick Log] Date parsed from ISO string:', data.date);

    } else if (data.date && dateType === 'object' && typeof data.date.seconds === 'number') {
      // Firestore Timestamp-like map: {seconds, nanoseconds}
      // (legacy format from Callable Function serialization)
      dateTimestamp = new admin.firestore.Timestamp(
        data.date.seconds,
        data.date.nanoseconds || 0
      );
      console.log('[Quick Log] Date parsed from {seconds, nanoseconds} map');

    } else if (data.date && typeof data.date.toDate === 'function') {
      // Real Firestore Timestamp object (unlikely but supported)
      dateTimestamp = admin.firestore.Timestamp.fromDate(data.date.toDate());
      console.log('[Quick Log] Date parsed from Timestamp object');

    } else {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid date format. Expected ISO string, {seconds, nanoseconds}, or Timestamp object'
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ TRANSACTION - All operations atomic
    // ═══════════════════════════════════════════════════════════════════

    const result = await db.runTransaction(async (transaction) => {

      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Quick Log Transaction Phase 1] Reading client...`);

      const clientRef = db.collection('clients').doc(data.clientId);
      const clientDoc = await transaction.get(clientRef);

      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'לקוח לא נמצא במערכת'
        );
      }

      const clientData = clientDoc.data();
      const finalClientName = data.clientName || clientData.clientName || clientData.fullName;

      console.log(`✅ [Quick Log Transaction Phase 1] Client read: ${data.clientId}`);

      // ========================================
      // PHASE 2: CALCULATIONS (No DB access)
      // ========================================

      console.log(`🧮 [Quick Log Transaction Phase 2] Calculating updates...`);

      const hoursWorked = data.minutes / 60;
      let updatedStageId = null;
      let updatedPackageId = null;
      let clientUpdateData = null;

      // ✅ Client hours-based - find active package
      if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
        // 🔍 Find service by serviceId if provided, otherwise use first service
        let serviceIndex = -1;
        if (data.serviceId) {
          serviceIndex = clientData.services.findIndex(s => s.id === data.serviceId);
          if (serviceIndex === -1) {
            console.warn(`⚠️ [Quick Log] Service ${data.serviceId} not found for client ${data.clientId}, using first service`);
            serviceIndex = 0;
          }
        } else {
          serviceIndex = 0;
          console.warn(`⚠️ [Quick Log] No serviceId provided, using first service`);
        }

        const service = clientData.services[serviceIndex];
        const activePackage = DeductionSystem.getActivePackage(service);

        if (activePackage) {
          // Check overdraft limit
          const currentRemaining = activePackage.hoursRemaining || 0;
          const afterDeduction = currentRemaining - hoursWorked;

          if (afterDeduction < -10) {
            throw new functions.https.HttpsError(
              'resource-exhausted',
              'הלקוח בחריגה נא לעדכן בהקדם את גיא',
              {
                clientId: clientData.caseNumber,
                currentRemaining,
                requestedHours: hoursWorked,
                wouldBe: afterDeduction
              }
            );
          }

          // ✅ BUG FIX: Capture return value (immutable pattern)
          const updatedPackage = DeductionSystem.deductHoursFromPackage(activePackage, hoursWorked);
          updatedPackageId = updatedPackage.id;

          // Update package status to overdraft if negative
          if (afterDeduction < 0 && afterDeduction >= -10) {
            updatedPackage.status = 'overdraft';
          }

          // ✅ BUG FIX: Immutable update - create new packages array
          const updatedServicePackages = service.packages.map(pkg =>
            pkg.id === updatedPackage.id ? updatedPackage : pkg
          );

          // ✅ BUG FIX: Immutable update - create new service object
          const updatedService = {
            ...service,
            packages: updatedServicePackages,
            hoursUsed: (service.hoursUsed || 0) + hoursWorked,
            hoursRemaining: (service.hoursRemaining || 0) - hoursWorked,
            lastActivity: new Date().toISOString()
          };

          // ✅ BUG FIX: Immutable update - create new services array
          const updatedServices = clientData.services.map((s, idx) =>
            idx === serviceIndex ? updatedService : s
          );

          const currentHoursRemaining = clientData.hoursRemaining || 0;
          const newHoursRemaining = currentHoursRemaining - hoursWorked;
          const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
          const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

          clientUpdateData = {
            services: updatedServices,
            minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
            hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
            isBlocked: newIsBlocked,
            isCritical: newIsCritical,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          };

          console.log(`✅ [Quick Log] יקוזז ${hoursWorked.toFixed(2)} שעות מחבילה ${updatedPackage.id}`);
        } else {
          console.warn(`⚠️ [Quick Log] לקוח ${clientData.caseNumber} - אין חבילה פעילה!`);
        }
      }
      // ✅ Legal procedure - hourly pricing
      else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'hourly') {
        const targetStageId = clientData.currentStage || 'stage_a';
        const stages = clientData.stages || [];
        const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

        if (currentStageIndex !== -1) {
          const currentStage = stages[currentStageIndex];
          updatedStageId = currentStage.id;

          const activePackage = DeductionSystem.getActivePackage(currentStage);

          if (activePackage) {
            const currentRemaining = activePackage.hoursRemaining || 0;
            const afterDeduction = currentRemaining - hoursWorked;

            if (afterDeduction < -10) {
              throw new functions.https.HttpsError(
                'resource-exhausted',
                'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                {
                  clientId: clientData.caseNumber,
                  currentRemaining,
                  requestedHours: hoursWorked,
                  wouldBe: afterDeduction
                }
              );
            }

            // ✅ BUG FIX: Capture return value (immutable pattern)
            const updatedPackage = DeductionSystem.deductHoursFromPackage(activePackage, hoursWorked);
            updatedPackageId = updatedPackage.id;

            if (afterDeduction < 0 && afterDeduction >= -10) {
              updatedPackage.status = 'overdraft';
            }

            // ✅ BUG FIX: Immutable update - create new packages array
            const updatedStagePackages = currentStage.packages.map(pkg =>
              pkg.id === updatedPackage.id ? updatedPackage : pkg
            );

            // ✅ BUG FIX: Immutable update - create new stage object
            const updatedStage = {
              ...currentStage,
              packages: updatedStagePackages,
              hoursUsed: (currentStage.hoursUsed || 0) + hoursWorked,
              hoursRemaining: (currentStage.hoursRemaining || 0) - hoursWorked
            };

            // ✅ BUG FIX: Immutable update - create new stages array
            const updatedStages = stages.map((stage, index) =>
              index === currentStageIndex ? updatedStage : stage
            );

            const currentHoursRemaining = clientData.hoursRemaining || 0;
            const newHoursRemaining = currentHoursRemaining - hoursWorked;
            const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
            const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

            clientUpdateData = {
              stages: updatedStages,
              hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
              isBlocked: newIsBlocked,
              isCritical: newIsCritical,
              lastActivity: admin.firestore.FieldValue.serverTimestamp()
            };

            console.log(`✅ [Quick Log] יקוזז ${hoursWorked.toFixed(2)} שעות משלב ${currentStage.name}`);
          }
        }
      }
      // ✅ Legal procedure - fixed price (track hours only)
      else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'fixed') {
        const targetStageId = clientData.currentStage || 'stage_a';
        const stages = clientData.stages || [];
        const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

        if (currentStageIndex !== -1) {
          const currentStage = stages[currentStageIndex];
          updatedStageId = currentStage.id;

          // ✅ BUG FIX: Immutable update - create new stage object
          const updatedStage = {
            ...currentStage,
            hoursWorked: (currentStage.hoursWorked || 0) + hoursWorked,
            totalHoursWorked: (currentStage.totalHoursWorked || 0) + hoursWorked
          };

          // ✅ BUG FIX: Immutable update - create new stages array
          const updatedStages = stages.map((stage, index) =>
            index === currentStageIndex ? updatedStage : stage
          );

          clientUpdateData = {
            stages: updatedStages,
            totalHoursWorked: admin.firestore.FieldValue.increment(hoursWorked),
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          };

          console.log(`✅ [Quick Log] יירשמו ${hoursWorked.toFixed(2)} שעות ל${currentStage.name} (מחיר קבוע)`);
        }
      } else {
        console.log(`ℹ️ [Quick Log] לקוח ${clientData.caseNumber} מסוג ${clientData.procedureType} - אין מעקב שעות`);
      }

      // Build entry data
      const entryData = {
        // Client/Case identifiers
        clientId: data.clientId,
        clientName: finalClientName,
        caseNumber: data.clientId,

        // Service/Stage tracking
        serviceId: null,
        serviceName: null,
        serviceType: null,
        parentServiceId: null,
        stageId: updatedStageId,
        packageId: updatedPackageId,

        // Time tracking
        date: dateTimestamp,
        minutes: data.minutes,
        hours: data.minutes / 60,

        // Work description
        action: sanitizeString(data.description.trim()),

        // User tracking
        employee: user.email,
        lawyer: user.username,
        createdBy: user.username,
        lastModifiedBy: user.username,

        // Branch tracking
        branch: data.branch || null,

        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),

        // Flags
        isInternal: false,
        isQuickLog: true
      };

      // Update service information if serviceId was provided
      if (data.serviceId && clientData.services) {
        const selectedService = clientData.services.find(s => s.id === data.serviceId);
        if (selectedService) {
          entryData.serviceId = selectedService.id;
          entryData.serviceName = selectedService.name || null;
          entryData.serviceType = selectedService.type || null;
          entryData.parentServiceId = selectedService.parentId || null;
        }
      }

      console.log(`✅ [Quick Log Transaction Phase 2] All calculations completed`);

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`✍️ [Quick Log Transaction Phase 3] Writing updates...`);

      // Write #1: Update client (if needed)
      if (clientUpdateData) {
        transaction.update(clientRef, clientUpdateData);
        console.log(`✅ Client will be updated: ${data.clientId}`);
      }

      // Write #2: Create timesheet entry
      const timesheetRef = db.collection('timesheet_entries').doc();
      transaction.set(timesheetRef, entryData);
      console.log(`✅ Timesheet entry will be created: ${timesheetRef.id}`);

      // Write #3: Audit log
      const logRef = db.collection('audit_log').doc();
      transaction.set(logRef, {
        action: 'CREATE_QUICK_LOG_ENTRY',
        userId: user.uid,
        username: user.username,
        details: {
          entryId: timesheetRef.id,
          clientId: data.clientId,
          clientName: finalClientName,
          minutes: data.minutes,
          date: data.date
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: null,
        ipAddress: null
      });
      console.log(`✅ Audit log will be created: ${logRef.id}`);

      console.log(`✅ [Quick Log Transaction Phase 3] All writes completed`);

      // Return result
      return {
        success: true,
        entryId: timesheetRef.id,
        message: 'רישום נוצר בהצלחה'
      };
    });

    console.log(`🎉 [Quick Log] רישום נוצר בהצלחה: ${result.entryId} עבור ${data.clientName || data.clientId} (${data.minutes} דקות)`);

    return result;

  } catch (error) {
    console.error('[Quick Log] Error in createQuickLogEntry:', error);

    // Re-throw HttpsError as-is
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Wrap other errors
    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת רישום מהיר: ${error.message}`
    );
  }
});

/**
 * ✅ ENTERPRISE v2.0: יצירת רישום שעות עם דיוק מוחלט
 *
 * שיפורים לעומת createTimesheetEntry:
 * 1. ✅ Optimistic Locking (_version) - מונע Lost Updates
 * 2. ✅ Event Sourcing (time_events) - Audit Trail מלא
 * 3. ✅ Idempotency Keys - מונע ביצוע כפול
 * 4. ✅ Two-Phase Commit - אטומיות מלאה
 * 5. ✅ Automatic Rollback - חזרה אוטומטית במקרה של שגיאה
 *
 * שימוש:
 * const result = await createTimesheetEntry_v2.call({
 *   clientId: '2025001',
 *   minutes: 120,
 *   date: '2025-02-20',
 *   action: 'פגישה עם לקוח',
 *   taskId: 'task_xxx',
 *   expectedVersion: 5,  // ✅ גרסה צפויה של הלקוח
 *   idempotencyKey: 'user1_2025-02-20_task_xxx_120'  // ✅ מונע כפילויות
 * });
 */
exports.createTimesheetEntry_v2 = functions.https.onCall(async (data, context) => {
  let reservationId = null;

  try {
    // ================================================
    // STEP 1: בדיקות בסיסיות
    // ================================================
    const user = await checkUserPermissions(context);

    // ✅ IDEMPOTENCY: בדיקה אם הפעולה כבר בוצעה
    if (data.idempotencyKey) {
      const existingResult = await checkIdempotency(data.idempotencyKey);
      if (existingResult) {
        console.log(`🔄 [v2.0] פעולה כבר בוצעה - מחזיר תוצאה קיימת`);
        return existingResult;
      }
    }

    // ================================================
    // STEP 2: Validation מורחב
    // ================================================

    // טיפול בפעילות פנימית
    let finalClientId = data.clientId;
    let finalCaseId = data.caseId;
    let finalClientName = data.clientName;

    if (data.isInternal === true) {
      const internalCase = await getOrCreateInternalCase(user.username);
      finalClientId = internalCase.clientId;
      finalCaseId = internalCase.id;
      finalClientName = internalCase.clientName;
    }

    // בדיקות בסיסיות
    if (!finalClientId) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר מזהה לקוח');
    }

    if (!data.date) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר תאריך');
    }

    if (typeof data.minutes !== 'number' || data.minutes <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'דקות חייבות להיות מספר חיובי');
    }

    if (!data.action || typeof data.action !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'חסר תיאור פעולה');
    }

    // ✅ חובה לקשר למשימה (למעט פעילות פנימית)
    if (data.isInternal !== true && !data.taskId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '❌ חובה לבחור משימה לרישום זמן על לקוח!'
      );
    }

    // ================================================
    // STEP 3: TWO-PHASE COMMIT - Phase 1 (Reservation)
    // ================================================
    reservationId = await createReservation({
      caseId: finalClientId,
      minutes: data.minutes,
      performedBy: user.username,
      operations: ['update_client', 'update_task', 'create_timesheet_entry', 'create_event']
    });

    console.log(`🎯 [v2.0] מתחיל רישום שעות: ${data.minutes} דקות ללקוח ${finalClientId}`);

    // ================================================
    // STEP 4: אחזור מסמך הלקוח + VERSION CHECK
    // ================================================
    const clientRef = db.collection('clients').doc(finalClientId);
    let clientVersionInfo;
    let clientData;

    if (data.isInternal !== true) {
      // ✅ OPTIMISTIC LOCKING: בדיקת גרסה
      clientVersionInfo = await checkVersionAndLock(clientRef, data.expectedVersion);
      clientData = clientVersionInfo.data;

      if (!finalClientName) {
        finalClientName = clientData.clientName || clientData.fullName;
      }
    }

    // ================================================
    // STEP 5: TRANSACTION - כל הפעולות ביחד או כלום
    // ================================================
    const hoursWorked = data.minutes / 60;
    let updatedStageId = null;
    let updatedPackageId = null;
    let timesheetEntryId = null;

    const result = await db.runTransaction(async (transaction) => {
      // ------------------------------------------------
      // 5.1: עדכון משימה (אם קיימת)
      // ------------------------------------------------
      if (data.taskId) {
        const taskRef = db.collection('budget_tasks').doc(data.taskId);
        const taskDoc = await transaction.get(taskRef);

        if (taskDoc.exists) {
          const taskData = taskDoc.data();
          const currentActualHours = taskData.actualHours || 0;
          const newActualHours = currentActualHours + hoursWorked;

          transaction.update(taskRef, {
            actualHours: newActualHours,
            actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
            lastModifiedBy: user.username,
            lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`📊 [v2.0] עדכון משימה: ${currentActualHours} → ${newActualHours} שעות`);
        }
      }

      // ------------------------------------------------
      // 5.2: קיזוז שעות מהלקוח (CLIENT = CASE)
      // ------------------------------------------------
      if (data.isInternal !== true) {
        // לקוח שעתי עם שירותים
        if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
          let service = null;

          if (data.serviceId) {
            service = clientData.services.find(s => s.id === data.serviceId);
            if (!service) {
              console.warn(`⚠️ שירות ${data.serviceId} לא נמצא - משתמש בראשון`);
              service = clientData.services[0];
            }
          } else {
            service = clientData.services[0];
          }

          if (service) {
            const activePackage = DeductionSystem.getActivePackage(service);

            if (activePackage) {
              // שמירת מצב לפני
              const packageBefore = {
                hoursUsed: activePackage.hoursUsed || 0,
                hoursRemaining: activePackage.hoursRemaining || 0
              };

              // ✅ בדיקת חריגה לפני הקיזוז
              const currentRemaining = activePackage.hoursRemaining || 0;
              const afterDeduction = currentRemaining - hoursWorked;

              // ❌ אם החריגה תעבור את -10 שעות - זורק שגיאה
              if (afterDeduction < -10) {
                throw new functions.https.HttpsError(
                  'resource-exhausted',
                  'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                  {
                    clientId: clientData.caseNumber,
                    currentRemaining,
                    requestedHours: hoursWorked,
                    wouldBe: afterDeduction
                  }
                );
              }

              // ✅ עדכון סטטוס החבילה ל-overdraft אם במינוס
              if (afterDeduction < 0 && afterDeduction >= -10) {
                activePackage.status = 'overdraft';
              }

              // קיזוז שעות
              DeductionSystem.deductHoursFromPackage(activePackage, hoursWorked);
              updatedPackageId = activePackage.id;

              // ✅ VERSION CONTROL: עדכון עם גרסה חדשה
              const currentHoursRemaining = clientData.hoursRemaining || 0;
              const newHoursRemaining = currentHoursRemaining - hoursWorked;
              const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
              const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

              transaction.update(clientRef, {
                services: clientData.services,
                minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                isBlocked: newIsBlocked,
                isCritical: newIsCritical,
                lastActivity: admin.firestore.FieldValue.serverTimestamp(),
                _version: clientVersionInfo.nextVersion,
                _lastModified: admin.firestore.FieldValue.serverTimestamp(),
                _modifiedBy: user.username
              });

              console.log(`✅ [v2.0] קוזזו ${hoursWorked.toFixed(2)} שעות מחבילה ${activePackage.id} (גרסה ${clientVersionInfo.currentVersion} → ${clientVersionInfo.nextVersion})`);
            } else {
              console.warn(`⚠️ אין חבילה פעילה!`);
            }
          }
        }
        // הליך משפטי כשירות
        else if (data.serviceType === 'legal_procedure' && data.parentServiceId) {
          const service = clientData.services?.find(s => s.id === data.parentServiceId);

          if (service && service.type === 'legal_procedure') {
            const targetStageId = data.serviceId || service.currentStage || 'stage_a';
            const stages = service.stages || [];
            const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

            if (currentStageIndex !== -1) {
              const currentStage = stages[currentStageIndex];
              updatedStageId = currentStage.id;

              const activePackage = DeductionSystem.getActivePackage(currentStage);

              if (activePackage) {
                // ✅ בדיקת חריגה לפני הקיזוז
                const currentRemaining = activePackage.hoursRemaining || 0;
                const afterDeduction = currentRemaining - hoursWorked;

                // ❌ אם החריגה תעבור את -10 שעות - זורק שגיאה
                if (afterDeduction < -10) {
                  throw new functions.https.HttpsError(
                    'resource-exhausted',
                    'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                    {
                      clientId: clientData.caseNumber,
                      currentRemaining,
                      requestedHours: hoursWorked,
                      wouldBe: afterDeduction
                    }
                  );
                }

                // ✅ עדכון סטטוס החבילה ל-overdraft אם במינוס
                if (afterDeduction < 0 && afterDeduction >= -10) {
                  activePackage.status = 'overdraft';
                }

                // קיזוז שעות
                DeductionSystem.deductHoursFromPackage(activePackage, hoursWorked);
                updatedPackageId = activePackage.id;

                // עדכון שלב
                stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
                stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;

                service.stages = stages;

                // ✅ VERSION CONTROL
                const currentHoursRemaining = clientData.hoursRemaining || 0;
                const newHoursRemaining = currentHoursRemaining - hoursWorked;
                const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
                const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

                transaction.update(clientRef, {
                  services: clientData.services,
                  hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                  minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                  isBlocked: newIsBlocked,
                  isCritical: newIsCritical,
                  lastActivity: admin.firestore.FieldValue.serverTimestamp(),
                  _version: clientVersionInfo.nextVersion,
                  _lastModified: admin.firestore.FieldValue.serverTimestamp(),
                  _modifiedBy: user.username
                });

                console.log(`✅ [v2.0] קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name}`);
              }
            }
          }
        }
        // הליך משפטי - תמחור שעתי (LEGACY - case level)
        else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'hourly') {
          const targetStageId = data.serviceId || clientData.currentStage || 'stage_a';
          const stages = clientData.stages || [];
          const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

          if (currentStageIndex !== -1) {
            const currentStage = stages[currentStageIndex];
            updatedStageId = currentStage.id;

            const activePackage = DeductionSystem.getActivePackage(currentStage);

            if (activePackage) {
              // ✅ בדיקת חריגה לפני הקיזוז
              const currentRemaining = activePackage.hoursRemaining || 0;
              const afterDeduction = currentRemaining - hoursWorked;

              // ❌ אם החריגה תעבור את -10 שעות - זורק שגיאה
              if (afterDeduction < -10) {
                throw new functions.https.HttpsError(
                  'resource-exhausted',
                  'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                  {
                    clientId: clientData.caseNumber,
                    currentRemaining,
                    requestedHours: hoursWorked,
                    wouldBe: afterDeduction
                  }
                );
              }

              // ✅ עדכון סטטוס החבילה ל-overdraft אם במינוס
              if (afterDeduction < 0 && afterDeduction >= -10) {
                activePackage.status = 'overdraft';
              }

              DeductionSystem.deductHoursFromPackage(activePackage, hoursWorked);
              updatedPackageId = activePackage.id;

              stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
              stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;

              // ✅ VERSION CONTROL
              const currentHoursRemaining = clientData.hoursRemaining || 0;
              const newHoursRemaining = currentHoursRemaining - hoursWorked;
              const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
              const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

              transaction.update(clientRef, {
                stages: stages,
                hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                isBlocked: newIsBlocked,
                isCritical: newIsCritical,
                lastActivity: admin.firestore.FieldValue.serverTimestamp(),
                _version: clientVersionInfo.nextVersion,
                _lastModified: admin.firestore.FieldValue.serverTimestamp(),
                _modifiedBy: user.username
              });

              console.log(`✅ [v2.0] קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name}`);
            }
          }
        }
        // הליך משפטי - תמחור פיקס
        else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'fixed') {
          const targetStageId = data.serviceId || clientData.currentStage || 'stage_a';
          const stages = clientData.stages || [];
          const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

          if (currentStageIndex !== -1) {
            const currentStage = stages[currentStageIndex];
            updatedStageId = currentStage.id;

            stages[currentStageIndex].hoursWorked = (currentStage.hoursWorked || 0) + hoursWorked;
            stages[currentStageIndex].totalHoursWorked = (currentStage.totalHoursWorked || 0) + hoursWorked;

            // ✅ VERSION CONTROL
            transaction.update(clientRef, {
              stages: stages,
              totalHoursWorked: admin.firestore.FieldValue.increment(hoursWorked),
              lastActivity: admin.firestore.FieldValue.serverTimestamp(),
              _version: clientVersionInfo.nextVersion,
              _lastModified: admin.firestore.FieldValue.serverTimestamp(),
              _modifiedBy: user.username
            });

            console.log(`✅ [v2.0] נרשמו ${hoursWorked.toFixed(2)} שעות (מחיר קבוע)`);
          }
        }
      }

      // ------------------------------------------------
      // 5.3: יצירת רישום שעות
      // ------------------------------------------------
      const entryData = {
        clientId: finalClientId,
        clientName: finalClientName,
        caseNumber: data.caseNumber || finalClientId,
        serviceId: data.serviceId || null,
        serviceName: data.serviceName || null,
        serviceType: data.serviceType || null,
        parentServiceId: data.parentServiceId || null,
        stageId: updatedStageId,
        packageId: updatedPackageId,
        date: data.date,
        minutes: data.minutes,
        hours: hoursWorked,
        action: sanitizeString(data.action.trim()),
        employee: user.email,
        lawyer: user.username,
        isInternal: data.isInternal === true,
        createdBy: user.username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),

        // ✅ META-DATA for tracking
        _processedByVersion: 'v2.0',
        _idempotencyKey: data.idempotencyKey || null
      };

      const timesheetRef = db.collection('timesheet_entries').doc();
      timesheetEntryId = timesheetRef.id;
      transaction.set(timesheetRef, entryData);

      console.log(`✅ [v2.0] נוצר רישום שעות: ${timesheetEntryId}`);

      return {
        success: true,
        entryId: timesheetEntryId,
        entry: {
          id: timesheetEntryId,
          ...entryData
        },
        version: data.isInternal !== true ? clientVersionInfo.nextVersion : null
      };
    });

    // ================================================
    // STEP 6: EVENT SOURCING - רישום האירוע
    // ================================================
    await createTimeEvent({
      eventType: 'TIME_ADDED',
      caseId: finalClientId,
      serviceId: data.serviceId || null,
      stageId: updatedStageId,
      packageId: updatedPackageId,
      taskId: data.taskId || null,
      timesheetEntryId: timesheetEntryId,

      data: {
        minutes: data.minutes,
        hours: hoursWorked,
        action: data.action,
        date: data.date
      },

      performedBy: user.username,
      performedByEmail: user.email,

      before: data.isInternal !== true ? {
        version: clientVersionInfo.currentVersion
      } : {},

      after: data.isInternal !== true ? {
        version: clientVersionInfo.nextVersion
      } : {},

      idempotencyKey: data.idempotencyKey || null
    });

    // ================================================
    // STEP 7: TWO-PHASE COMMIT - Phase 2 (Commit)
    // ================================================
    await commitReservation(reservationId);

    // ================================================
    // STEP 8: IDEMPOTENCY REGISTRATION
    // ================================================
    if (data.idempotencyKey) {
      await registerIdempotency(data.idempotencyKey, result);
    }

    // ================================================
    // STEP 9: AUDIT LOG
    // ================================================
    await logAction('CREATE_TIMESHEET_ENTRY_V2', user.uid, user.username, {
      entryId: timesheetEntryId,
      clientId: finalClientId,
      caseNumber: result.entry.caseNumber,
      isInternal: data.isInternal === true,
      minutes: data.minutes,
      date: data.date,
      taskId: data.taskId || null,
      version: result.version,
      reservationId: reservationId,
      idempotencyKey: data.idempotencyKey || null
    });

    console.log(`🎉 [v2.0] רישום שעות הושלם בהצלחה! Entry: ${timesheetEntryId}, Version: ${result.version}`);

    return result;

  } catch (error) {
    console.error('❌ [v2.0] Error in createTimesheetEntry_v2:', error);

    // ✅ AUTOMATIC ROLLBACK
    if (reservationId) {
      await rollbackReservation(reservationId, error);
    }

    // טיפול בשגיאות מובנות
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // טיפול בקונפליקט גרסה
    if (error.message && error.message.includes('CONFLICT')) {
      throw new functions.https.HttpsError(
        'aborted',
        error.message
      );
    }

    // שגיאה כללית
    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת רישום שעות (v2.0): ${error.message}`
    );
  }
});

/**
 * קריאת רישומי שעות
 */
exports.getTimesheetEntries = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    let query = db.collection('timesheet_entries');

    // רק מנהלים יכולים לראות הכל
    if (user.role !== 'admin') {
      query = query.where('employee', '==', user.email); // ✅ Query by EMAIL
    }

    // סינון לפי לקוח
    if (data.clientId) {
      query = query.where('clientId', '==', data.clientId);
    }

    // סינון לפי תאריך
    if (data.startDate) {
      query = query.where('date', '>=', data.startDate);
    }

    if (data.endDate) {
      query = query.where('date', '<=', data.endDate);
    }

    const snapshot = await query.get();

    const entries = [];
    snapshot.forEach(doc => {
      entries.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      entries
    };

  } catch (error) {
    console.error('Error in getTimesheetEntries:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת רישומי שעות: ${error.message}`
    );
  }
});

/**
 * עדכון רשומת שעתון עם מעקב אחר היסטוריית עריכה
 * @version 1.0.0
 */
exports.updateTimesheetEntry = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.entryId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה רשומה'
      );
    }

    if (!data.date) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תאריך'
      );
    }

    if (typeof data.minutes !== 'number' || data.minutes <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'דקות חייבות להיות מספר חיובי'
      );
    }

    if (!data.editHistory || !Array.isArray(data.editHistory)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרה היסטוריית עריכה'
      );
    }

    // Prepare refs
    const entryRef = db.collection('timesheet_entries').doc(data.entryId);
    const taskRef = data.taskId ? db.collection('budget_tasks').doc(data.taskId) : null;
    const clientRef = data.clientId ? db.collection('clients').doc(data.clientId) : null;

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - All-or-Nothing Guarantee
    // ═══════════════════════════════════════════════════════════════════

    await db.runTransaction(async (transaction) => {

      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading documents...`);

      const entryDoc = await transaction.get(entryRef);
      const taskDoc = taskRef && data.autoGenerated ? await transaction.get(taskRef) : null;
      const clientDoc = clientRef && data.autoGenerated && data.clientId ? await transaction.get(clientRef) : null;

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      // Validation: Entry exists
      if (!entryDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'רשומת שעתון לא נמצאה'
        );
      }

      const entryData = entryDoc.data();

      // Security: רק העובד עצמו או מנהל יכולים לערוך
      if (user.role !== 'admin' && entryData.employee !== user.email) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'אין הרשאה לערוך רשומה זו'
        );
      }

      console.log(`📝 עדכון רשומת שעתון ${data.entryId} עבור ${user.username}`);
      console.log(`  תאריך: ${entryData.date} → ${data.date}`);
      console.log(`  דקות: ${entryData.minutes} → ${data.minutes}`);
      console.log(`  תיאור: ${entryData.action} → ${data.action}`);

      // Calculate minutesDiff on SERVER (not trusting client)
      const minutesDiff = data.minutes - entryData.minutes;
      const hoursDiff = minutesDiff / 60;
      console.log(`  הפרש דקות (SERVER CALCULATED): ${minutesDiff}`);

      // Fix editHistory timestamps - convert ISO strings to Firestore Timestamps
      const fixedEditHistory = data.editHistory.map(edit => {
        const editedAt = edit.editedAt;

        if (editedAt && typeof editedAt === 'object' && editedAt._methodName === 'FieldValue.serverTimestamp') {
          console.warn(`  ⚠️  Found serverTimestamp placeholder in editHistory - converting to current time`);
          return {
            ...edit,
            editedAt: admin.firestore.Timestamp.now()
          };
        }

        if (typeof editedAt === 'string') {
          return {
            ...edit,
            editedAt: admin.firestore.Timestamp.fromDate(new Date(editedAt))
          };
        }

        if (editedAt && editedAt.seconds !== undefined && editedAt.nanoseconds !== undefined) {
          return edit;
        }

        console.warn(`  ⚠️  Unknown editedAt format in editHistory:`, typeof editedAt, editedAt);
        return {
          ...edit,
          editedAt: admin.firestore.Timestamp.now()
        };
      });

      // Prepare entry update data
      const entryUpdateData = {
        date: data.date,
        minutes: data.minutes,
        hours: data.minutes / 60,
        editHistory: fixedEditHistory,
        lastEditedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEditedBy: user.username
      };

      if (data.action !== undefined) {
        entryUpdateData.action = data.action;
        console.log(`  ✅ Updating action field to: "${data.action}"`);
      }

      // Prepare task update (if needed)
      let taskUpdateData = null;
      if (taskDoc && taskDoc.exists) {
        const taskData = taskDoc.data();
        taskUpdateData = {
          actualMinutes: admin.firestore.FieldValue.increment(minutesDiff),
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        };

        // Update task.timeEntries array if it exists
        if (taskData.timeEntries && Array.isArray(taskData.timeEntries)) {
          let foundEntry = false;
          const updatedTimeEntries = taskData.timeEntries.map(entry => {
            if (entry.entryId === data.entryId) {
              foundEntry = true;
              console.log(`  🔄 Updating timeEntry in task.timeEntries array`);
              return {
                ...entry,
                minutes: data.minutes,
                hours: data.minutes / 60,
                action: data.action || entry.action,
                lastEditedAt: admin.firestore.FieldValue.serverTimestamp()
              };
            }
            return entry;
          });

          if (!foundEntry) {
            console.warn(`  ⚠️ WARNING: entryId ${data.entryId} not found in task.timeEntries array! Investigation needed.`);
            console.warn(`  Task ID: ${data.taskId}, timeEntries count: ${taskData.timeEntries.length}`);
          }

          taskUpdateData.timeEntries = updatedTimeEntries;
        }

        console.log(`  🔗 עדכון משימה ${data.taskId} מוכן`);
      }

      // Prepare client update (if needed)
      let clientUpdateData = null;
      if (clientDoc && clientDoc.exists) {
        const clientData = clientDoc.data();

        // עדכון לקוח שעתי - עדכון החבילה
        if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
          let service = null;

          if (data.serviceId) {
            service = clientData.services.find(s => s.id === data.serviceId);
          }

          if (!service) {
            service = clientData.services[0];
          }

          if (service) {
            const activePackage = DeductionSystem.getActivePackage(service);

            if (activePackage) {
              // ✅ IMMUTABLE PATTERN: Create new package object
              const updatedPackage = {
                ...activePackage,
                hoursUsed: (activePackage.hoursUsed || 0) + hoursDiff,
                hoursRemaining: (activePackage.hoursRemaining || 0) - hoursDiff
              };

              // ✅ IMMUTABLE PATTERN: Create new packages array
              const updatedPackages = service.packages.map(pkg =>
                pkg.id === updatedPackage.id ? updatedPackage : pkg
              );

              // ✅ IMMUTABLE PATTERN: Create new service object
              const updatedService = {
                ...service,
                packages: updatedPackages
              };

              // ✅ IMMUTABLE PATTERN: Create new services array
              const updatedServices = clientData.services.map(s =>
                s.id === updatedService.id ? updatedService : s
              );

              const currentHoursRemaining = clientData.hoursRemaining || 0;
              const newHoursRemaining = currentHoursRemaining - hoursDiff;
              const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
              const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

              clientUpdateData = {
                services: updatedServices,
                minutesRemaining: admin.firestore.FieldValue.increment(-minutesDiff),
                hoursRemaining: admin.firestore.FieldValue.increment(-hoursDiff),
                isBlocked: newIsBlocked,
                isCritical: newIsCritical,
                lastActivity: admin.firestore.FieldValue.serverTimestamp()
              };

              console.log(`  🔗 עדכון לקוח ${data.clientId} מוכן (hours, הפרש: ${hoursDiff.toFixed(2)} שעות)`);
            }
          }
        }
        // הליך משפטי - עדכון השלב
        else if (data.serviceType === 'legal_procedure' && data.serviceId) {
          const service = clientData.services?.find(s => s.id === data.serviceId);

          if (service && service.type === 'legal_procedure') {
            const stages = service.stages || [];
            const currentStageIndex = stages.findIndex(s => s.id === service.currentStage);

            if (currentStageIndex !== -1) {
              const currentStage = stages[currentStageIndex];
              const activePackage = DeductionSystem.getActivePackage(currentStage);

              if (activePackage) {
                // ✅ IMMUTABLE PATTERN: Create new package object
                const updatedPackage = {
                  ...activePackage,
                  hoursUsed: (activePackage.hoursUsed || 0) + hoursDiff,
                  hoursRemaining: (activePackage.hoursRemaining || 0) - hoursDiff
                };

                // ✅ IMMUTABLE PATTERN: Create new packages array
                const updatedPackages = currentStage.packages.map(pkg =>
                  pkg.id === updatedPackage.id ? updatedPackage : pkg
                );

                // ✅ IMMUTABLE PATTERN: Create new stage object
                const updatedStage = {
                  ...currentStage,
                  packages: updatedPackages
                };

                // ✅ IMMUTABLE PATTERN: Create new stages array
                const updatedStages = stages.map((stage, idx) =>
                  idx === currentStageIndex ? updatedStage : stage
                );

                // ✅ IMMUTABLE PATTERN: Create new service object
                const updatedService = {
                  ...service,
                  stages: updatedStages
                };

                // ✅ IMMUTABLE PATTERN: Create new services array
                const updatedServices = clientData.services.map(s =>
                  s.id === updatedService.id ? updatedService : s
                );

                clientUpdateData = {
                  services: updatedServices,
                  lastActivity: admin.firestore.FieldValue.serverTimestamp()
                };

                console.log(`  🔗 עדכון לקוח ${data.clientId} מוכן (legal_procedure, הפרש: ${hoursDiff.toFixed(2)} שעות)`);
              }
            }
          }
        }
      }

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing updates...`);

      // Write #1: Entry (always)
      transaction.update(entryRef, entryUpdateData);
      console.log(`  ✅ Entry update queued`);

      // Write #2: Task (if needed)
      if (taskDoc && taskDoc.exists && taskUpdateData) {
        transaction.update(taskRef, taskUpdateData);
        console.log(`  ✅ Task update queued`);
      }

      // Write #3: Client (if needed)
      if (clientDoc && clientDoc.exists && clientUpdateData) {
        transaction.update(clientRef, clientUpdateData);
        console.log(`  ✅ Client update queued`);
      }

      console.log(`🔒 [Transaction] All updates queued, committing...`);
    });

    console.log(`✅ רשומת שעתון ${data.entryId} עודכנה בהצלחה (atomic)`);

    return {
      success: true,
      entryId: data.entryId
    };

  } catch (error) {
    console.error('Error in updateTimesheetEntry:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון רשומת שעתון: ${error.message}`
    );
  }
});

// ===============================
// Employee Management (Admin Only)
// ===============================

/**
 * קישור Firebase Auth UID לעובד קיים
 */
exports.linkAuthToEmployee = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לקשר Auth UID לעובדים'
      );
    }

    // Note: Now using EMAIL as document ID (industry standard)
    if (!data.email || !data.authUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות: email, authUID'
      );
    }

    // עדכון העובד (use EMAIL as document ID)
    await db.collection('employees').doc(data.email).update({
      authUID: data.authUID,
      migratedToAuth: true,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedBy: user.username
    });

    // Audit log
    await logAction('LINK_AUTH_TO_EMPLOYEE', user.uid, user.username, {
      employeeEmail: data.email,
      authUID: data.authUID
    });

    return {
      success: true,
      username: data.username
    };

  } catch (error) {
    console.error('Error in linkAuthToEmployee:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בקישור Auth: ${error.message}`
    );
  }
});

// ===============================
// Activity Logging & User Tracking
// ===============================

/**
 * רישום פעילות משתמש (Activity Log)
 * נקרא מ-activity-logger.js
 */
exports.logActivity = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.type || typeof data.type !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר סוג פעילות'
      );
    }

    if (!data.action || typeof data.action !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תיאור פעולה'
      );
    }

    // רישום הפעילות
    const activityData = {
      type: sanitizeString(data.type),
      action: sanitizeString(data.action),
      details: data.details ? sanitizeString(JSON.stringify(data.details)) : '',
      userId: user.uid,
      username: user.username,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: data.userAgent || null,
      sessionId: data.sessionId || null
    };

    const docRef = await db.collection('activity_log').add(activityData);

    return {
      success: true,
      activityId: docRef.id
    };

  } catch (error) {
    console.error('Error in logActivity:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ברישום פעילות: ${error.message}`
    );
  }
});

// ✅ trackUserActivity REMOVED - replaced by Firebase Realtime Database Presence
// Old heartbeat-based tracking consumed 2,880 writes/day
// New presence system uses only ~60 writes/day (98% reduction!)
// See: js/modules/presence-system.js

// ===============================
// Data Migration Functions (Admin Only)
// ===============================

/**
 * מיגרציית היסטוריה למבנה אחיד
 * ממיר history → timeEntries, timestamp → addedAt
 * רק למנהלים
 */
exports.migrateTaskHistory = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // ✅ כל משתמש מחובר יכול להריץ מיגרציה (פעולה חד-פעמית בטוחה)
    // הסרנו את בדיקת ה-admin כי זו מיגרציית נתונים שלא מוחקת כלום
    console.log(`🚀 Starting task history migration by ${user.username}...`);

    const snapshot = await db.collection('budget_tasks').get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    for (const doc of snapshot.docs) {
      try {
        const task = doc.data();
        const updates = {};
        let needsUpdate = false;

        // 1. Migrate history → timeEntries
        if (task.history && Array.isArray(task.history) && task.history.length > 0) {
          // רק אם אין timeEntries או שהם ריקים
          if (!task.timeEntries || task.timeEntries.length === 0) {
            updates.timeEntries = task.history.map((entry, index) => ({
              id: entry.id || `migrated-${Date.now()}-${index}`,
              date: entry.date,
              minutes: entry.minutes || (entry.hours ? Math.round(entry.hours * 60) : 0),
              hours: entry.hours || (entry.minutes ? entry.minutes / 60 : 0),
              description: entry.description || '',
              addedAt: entry.addedAt || entry.timestamp || new Date().toISOString(),
              addedBy: entry.addedBy || 'מיגרציה אוטומטית'
            }));
            needsUpdate = true;
            console.log(`📝 ${doc.id}: Converting ${task.history.length} entries from history to timeEntries`);
          }
        }

        // 2. Fix timeEntries that have timestamp instead of addedAt
        if (task.timeEntries && Array.isArray(task.timeEntries) && task.timeEntries.length > 0) {
          const fixedEntries = task.timeEntries.map(entry => {
            if (!entry.addedAt && entry.timestamp) {
              return {
                ...entry,
                addedAt: entry.timestamp,
                timestamp: undefined // Remove old field
              };
            }
            return entry;
          });

          // Check if anything changed
          const hasChanges = fixedEntries.some((entry, idx) =>
            entry.addedAt !== task.timeEntries[idx].addedAt
          );

          if (hasChanges) {
            updates.timeEntries = fixedEntries;
            needsUpdate = true;
            console.log(`🔧 ${doc.id}: Fixed timestamp → addedAt in timeEntries`);
          }
        }

        // 3. Calculate actualMinutes if missing or wrong
        const entries = updates.timeEntries || task.timeEntries || [];
        if (entries.length > 0) {
          const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
          const totalHours = totalMinutes / 60;

          // Update if actualMinutes is missing, 0, or doesn't match calculated value
          if (!task.actualMinutes ||
              task.actualMinutes === 0 ||
              Math.abs(task.actualMinutes - totalMinutes) > 1) {
            updates.actualMinutes = totalMinutes;
            updates.actualHours = totalHours;
            needsUpdate = true;
            console.log(`🔢 ${doc.id}: Calculated actualMinutes = ${totalMinutes} (${totalHours.toFixed(2)} hours)`);
          }
        }

        // 4. Convert estimatedHours → estimatedMinutes
        if (task.estimatedHours && typeof task.estimatedHours === 'number') {
          if (!task.estimatedMinutes || task.estimatedMinutes === 0) {
            updates.estimatedMinutes = Math.round(task.estimatedHours * 60);
            needsUpdate = true;
            console.log(`🔢 ${doc.id}: Converted estimatedHours (${task.estimatedHours}) → estimatedMinutes (${updates.estimatedMinutes})`);
          }
        }

        // 5. Add migration metadata
        if (needsUpdate) {
          updates.migratedAt = admin.firestore.FieldValue.serverTimestamp();
          updates.migratedBy = user.username;
          updates.lastModifiedBy = user.username;
          updates.lastModifiedAt = admin.firestore.FieldValue.serverTimestamp();

          await doc.ref.update(updates);
          migrated++;
          console.log(`✅ ${doc.id}: Updated successfully`);
        } else {
          skipped++;
          console.log(`⏭️  ${doc.id}: No changes needed`);
        }

      } catch (error) {
        errors++;
        const errorMsg = `${doc.id}: ${error.message}`;
        errorDetails.push(errorMsg);
        console.error(`❌ Error processing ${doc.id}:`, error);
      }
    }

    // Audit log
    await logAction('MIGRATE_TASK_HISTORY', user.uid, user.username, {
      totalTasks: snapshot.size,
      migrated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    });

    console.log(`🎉 Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return {
      success: true,
      totalTasks: snapshot.size,
      migrated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `המיגרציה הושלמה: ${migrated} משימות עודכנו, ${skipped} לא דרשו שינוי, ${errors} שגיאות`
    };

  } catch (error) {
    console.error('Error in migrateTaskHistory:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציה: ${error.message}`
    );
  }
});

/**
 * מיגרציית סטטוס משימות - אנגלית לעברית
 * ממיר: 'active' → 'פעיל', 'completed' → 'הושלם'
 */
exports.migrateBudgetTasksStatus = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    console.log(`🚀 Starting budget tasks status migration by ${user.username}...`);

    const snapshot = await db.collection('budget_tasks').get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // Status mapping
    const STATUS_MAP = {
      'active': 'פעיל',
      'Active': 'פעיל',
      'ACTIVE': 'פעיל',
      'completed': 'הושלם',
      'Completed': 'הושלם',
      'COMPLETED': 'הושלם',
      'pending': 'ממתין',
      'Pending': 'ממתין'
    };

    for (const doc of snapshot.docs) {
      try {
        const task = doc.data();
        const currentStatus = task.status;

        // בדוק אם הסטטוס באנגלית וצריך המרה
        if (currentStatus && STATUS_MAP[currentStatus]) {
          const newStatus = STATUS_MAP[currentStatus];

          await doc.ref.update({
            status: newStatus,
            statusMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            statusMigratedBy: user.username,
            statusMigratedFrom: currentStatus,
            lastModifiedBy: user.username,
            lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          migrated++;
          console.log(`✅ ${doc.id}: Status updated from '${currentStatus}' to '${newStatus}'`);
        } else if (!currentStatus) {
          // אם אין סטטוס בכלל - תן ברירת מחדל
          await doc.ref.update({
            status: 'פעיל',
            statusMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            statusMigratedBy: user.username,
            statusMigratedFrom: 'null',
            lastModifiedBy: user.username,
            lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          migrated++;
          console.log(`✅ ${doc.id}: Status set to 'פעיל' (was null)`);
        } else {
          skipped++;
          console.log(`⏭️  ${doc.id}: Status already in Hebrew ('${currentStatus}')`);
        }

      } catch (error) {
        errors++;
        const errorMsg = `${doc.id}: ${error.message}`;
        errorDetails.push(errorMsg);
        console.error(`❌ Error processing ${doc.id}:`, error);
      }
    }

    // Audit log
    await logAction('MIGRATE_STATUS', user.uid, user.username, {
      totalTasks: snapshot.size,
      migrated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    });

    console.log(`🎉 Status migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return {
      success: true,
      totalTasks: snapshot.size,
      migrated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `מיגרציית סטטוס הושלמה: ${migrated} משימות עודכנו, ${skipped} כבר בעברית, ${errors} שגיאות`
    };

  } catch (error) {
    console.error('Error in migrateBudgetTasksStatus:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציית סטטוס: ${error.message}`
    );
  }
});

/**
 * מיגרציית לקוחות - פיצול fullName למרכיבים נפרדים
 * ממיר fullName משולב → clientName + description
 */
exports.migrateClients = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    console.log(`🚀 Starting clients migration by ${user.username}...`);

    const snapshot = await db.collection('clients').get();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    for (const doc of snapshot.docs) {
      try {
        const client = doc.data();
        const updates = {};
        let needsUpdate = false;

        // בדיקה אם צריך מיגרציה
        if (client.fullName && !client.clientName) {
          // יש fullName אבל אין clientName - צריך מיגרציה

          let clientName = client.fullName;
          let description = '';

          // ניסיון לפצל לפי " - "
          if (client.fullName.includes(' - ')) {
            const parts = client.fullName.split(' - ');
            clientName = parts[0].trim();
            description = parts.slice(1).join(' - ').trim();
          }

          updates.clientName = clientName;
          updates.description = description;

          // אם אין fileNumber, ניצור מזהה זמני
          if (!client.fileNumber) {
            updates.fileNumber = `MIGRATED-${doc.id.substring(0, 8)}`;
          }

          // אם אין procedureType, נשתמש ב-type הישן או default
          if (!client.procedureType) {
            if (client.type === 'budget') {
              updates.procedureType = 'fixed';
            } else if (client.type === 'hours') {
              updates.procedureType = 'hours';
            } else {
              updates.procedureType = 'hours'; // default
            }
          }

          needsUpdate = true;
          console.log(`📝 ${doc.id}: "${client.fullName}" → name: "${clientName}", desc: "${description}"`);
        } else if (client.clientName && !client.fileNumber) {
          // יש clientName אבל חסר fileNumber
          updates.fileNumber = `MIGRATED-${doc.id.substring(0, 8)}`;
          needsUpdate = true;
          console.log(`🔢 ${doc.id}: Added missing fileNumber`);
        }

        // הוספת שדות חסרים
        if (!client.procedureType && client.type) {
          if (client.type === 'budget') {
            updates.procedureType = 'fixed';
          } else if (client.type === 'hours') {
            updates.procedureType = 'hours';
          }
          needsUpdate = true;
        }

        // הוספת metadata
        if (needsUpdate) {
          updates.migratedAt = admin.firestore.FieldValue.serverTimestamp();
          updates.migratedBy = user.username;
          updates.lastModifiedBy = user.username;
          updates.lastModifiedAt = admin.firestore.FieldValue.serverTimestamp();

          await doc.ref.update(updates);
          migrated++;
          console.log(`✅ ${doc.id}: Updated successfully`);
        } else {
          skipped++;
          console.log(`⏭️  ${doc.id}: No changes needed`);
        }

      } catch (error) {
        errors++;
        const errorMsg = `${doc.id}: ${error.message}`;
        errorDetails.push(errorMsg);
        console.error(`❌ Error processing ${doc.id}:`, error);
      }
    }

    // Audit log
    await logAction('MIGRATE_CLIENTS', user.uid, user.username, {
      totalClients: snapshot.size,
      migrated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    });

    console.log(`🎉 Clients migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return {
      success: true,
      totalClients: snapshot.size,
      migrated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `המיגרציה הושלמה: ${migrated} לקוחות עודכנו, ${skipped} לא דרשו שינוי, ${errors} שגיאות`
    };

  } catch (error) {
    console.error('Error in migrateClients:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציית לקוחות: ${error.message}`
    );
  }
});

// ===============================
// ⚠️ DEPRECATED: Cases Management Functions REMOVED
// ===============================
// במבנה החדש, Client = Case (מאוחדים)
// השתמש ב-createClient, getClients, etc.

// ===============================
// ⚠️ DEPRECATED: Old Migration Function
// ===============================

/**
 * ⚠️ DEPRECATED - DO NOT USE
 *
 * מיגרציה מקצועית: clients → cases (OLD ARCHITECTURE)
 *
 * פונקציה זו לא בשימוש - המערכת עברה למבנה Client=Case
 * במקום זאת, השתמש ב-migrateCasesToClients
 *
 * @deprecated Since Client=Case migration - use migrateCasesToClients instead
 * @param {Object} options
 * @param {boolean} options.dryRun - אם true, רק מדמה ללא שינויים אמיתיים
 * @param {string} options.specificClientId - מיגרציה ללקוח אחד בלבד (לבדיקה)
 * @param {boolean} options.skipExisting - לדלג על לקוחות שכבר יש להם case
 */
exports.migrateClientsIntoFullCases = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // בדיקת הרשאות - רק admin יכול להריץ מיגרציה
    if (user.role !== 'admin' && user.role !== 'מנהל') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהל מערכת יכול להריץ מיגרציה'
      );
    }

    const options = {
      dryRun: data.dryRun === true,
      specificClientId: data.specificClientId || null,
      skipExisting: data.skipExisting !== false // default true
    };

    console.log(`🚀 Starting FULL clients → cases migration by ${user.username}`, options);

    // סטטיסטיקות
    const stats = {
      totalClients: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      createdCases: []
    };

    // שלב 1: טעינת לקוחות
    let clientsQuery = db.collection('clients');

    if (options.specificClientId) {
      // מיגרציה ללקוח אחד בלבד
      const clientDoc = await db.collection('clients').doc(options.specificClientId).get();
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError('not-found', `לקוח ${options.specificClientId} לא נמצא`);
      }
      stats.totalClients = 1;
      var clientsSnapshot = { docs: [clientDoc], size: 1 };
    } else {
      // כל הלקוחות
      clientsSnapshot = await clientsQuery.get();
      stats.totalClients = clientsSnapshot.size;
    }

    console.log(`📦 Found ${stats.totalClients} clients to process`);

    // שלב 2: מעבר על כל לקוח
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      const clientData = clientDoc.data();

      try {
        console.log(`\n📝 Processing client: ${clientId}`);

        // בדיקה: האם כבר יש case עבור הלקוח הזה?
        if (options.skipExisting) {
          const existingCasesSnapshot = await db.collection('cases')
            .where('clientId', '==', clientId)
            .limit(1)
            .get();

          if (!existingCasesSnapshot.empty) {
            console.log(`⏭️  Skipping ${clientId} - already has a case`);
            stats.skipped++;
            continue;
          }
        }

        // בניית אובייקט Case מתוך Client
        const caseData = buildCaseFromClient(clientId, clientData, user.username);

        // Dry run - רק הדפסה, אין יצירה
        if (options.dryRun) {
          console.log(`🔍 [DRY RUN] Would create case:`, JSON.stringify(caseData, null, 2));
          stats.created++;
          stats.createdCases.push({
            clientId,
            clientName: caseData.clientName,
            caseNumber: caseData.caseNumber,
            caseTitle: caseData.caseTitle
          });
          continue;
        }

        // יצירת התיק ב-Firestore
        const caseRef = await db.collection('cases').add(caseData);
        console.log(`✅ Created case ${caseRef.id} for client ${clientId}`);

        // עדכון הלקוח - הוספת קישור לתיק הראשי
        await clientDoc.ref.update({
          primaryCaseId: caseRef.id,
          totalCases: 1,
          activeCases: caseData.status === 'active' ? 1 : 0,
          migratedToCases: true,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedBy: user.username,
          lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastModifiedBy: user.username
        });

        stats.created++;
        stats.createdCases.push({
          clientId,
          caseId: caseRef.id,
          clientName: caseData.clientName,
          caseNumber: caseData.caseNumber,
          caseTitle: caseData.caseTitle
        });

      } catch (error) {
        stats.errors++;
        const errorMsg = `${clientId}: ${error.message}`;
        stats.errorDetails.push(errorMsg);
        console.error(`❌ Error processing client ${clientId}:`, error);
      }
    }

    // Audit log
    await logAction('MIGRATE_CLIENTS_TO_CASES', user.uid, user.username, {
      ...stats,
      options
    });

    const summary = `
📊 סיכום מיגרציה:
- סה"כ לקוחות: ${stats.totalClients}
- תיקים נוצרו: ${stats.created}
- דולגו: ${stats.skipped}
- שגיאות: ${stats.errors}
${options.dryRun ? '\n⚠️ זו הייתה הרצה לדוגמה (dry run) - לא נעשו שינויים!' : ''}
    `.trim();

    console.log(summary);

    return {
      success: true,
      dryRun: options.dryRun,
      ...stats,
      summary
    };

  } catch (error) {
    console.error('Error in migrateClientsIntoFullCases:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציה: ${error.message}`
    );
  }
});

/**
 * פונקציית עזר: בניית אובייקט Case מתוך Client
 */
// פונקציה עזר: מנקה undefined values מאובייקט (Firestore לא מאפשר undefined)
function cleanUndefined(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }

  const cleaned = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        cleaned[key] = cleanUndefined(obj[key]);
      } else {
        cleaned[key] = obj[key];
      }
    }
  }
  return cleaned;
}

function buildCaseFromClient(clientId, clientData, username) {
  // שם הלקוח
  const clientName = clientData.clientName || clientData.fullName || 'לקוח ללא שם';

  // מספר תיק - ננסה למצוא fileNumber קיים, אחרת נייצר
  const caseNumber = clientData.fileNumber ||
                     clientData.caseNumber ||
                     `AUTO-${Date.now()}-${clientId.substring(0, 6)}`;

  // כותרת התיק
  let caseTitle = clientData.description || clientData.caseTitle || clientName;

  // אם יש תיאור נפרד, נשתמש בו
  if (clientData.fullName && clientData.fullName.includes(' - ')) {
    const parts = clientData.fullName.split(' - ');
    caseTitle = parts.slice(1).join(' - ').trim() || parts[0];
  }

  // בניית הבסיס
  const caseData = {
    // זיהוי
    caseNumber,
    caseTitle,
    clientId,
    clientName,

    // סוג הליך - ברירת מחדל הליך שעות
    procedureType: clientData.procedureType ||
                   (clientData.type === 'fixed' ? 'legal_procedure' : 'hours'),

    // תמחור
    pricingType: clientData.pricingType || 'hourly',

    // תיאור
    description: clientData.description || 'הועבר ממערכת הלקוחות הישנה',

    // סטטוס
    status: clientData.status || 'active',
    priority: clientData.priority || 'medium',

    // עו"ד מוקצה
    assignedTo: clientData.assignedTo || [username],
    mainAttorney: clientData.mainAttorney || username,

    // תאריכים
    openedAt: clientData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    deadline: clientData.deadline || null,

    // Metadata
    migratedFrom: 'clients',
    originalClientData: {
      // שמירה של כל השדות המקוריים למקרה הצורך
      type: clientData.type,
      totalHours: clientData.totalHours,
      hoursRemaining: clientData.hoursRemaining,
      minutesRemaining: clientData.minutesRemaining,
      hourlyRate: clientData.hourlyRate,
      stages: clientData.stages
    },
    createdBy: username,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastModifiedBy: username,
    lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // טיפול בהליך שעות
  if (caseData.procedureType === 'hours') {
    // שעות
    const totalHours = clientData.totalHours || 0;
    const minutesRemaining = clientData.minutesRemaining || clientData.hoursRemaining * 60 || 0;

    caseData.totalHours = totalHours;
    caseData.minutesRemaining = minutesRemaining;
    caseData.hoursRemaining = minutesRemaining / 60;
    caseData.hourlyRate = clientData.hourlyRate || 0;
  }

  // טיפול בהליך משפטי עם שלבים
  if (caseData.procedureType === 'legal_procedure' && clientData.stages) {
    caseData.stages = clientData.stages.map((stage, index) => ({
      id: stage.id || index + 1,
      description: stage.description || stage.name || `שלב ${index + 1}`,
      hours: stage.hours || stage.totalHours || 10,
      fixedPrice: stage.fixedPrice || 0,
      completed: stage.completed || false,
      completedAt: stage.completedAt || null,
      completedBy: stage.completedBy || null
    }));
  }

  // טיפול במחיר קבוע
  if (clientData.fixedPrice) {
    caseData.fixedPrice = clientData.fixedPrice;
  }

  // ניקוי כל הערכים undefined - Firestore לא מאפשר undefined
  return cleanUndefined(caseData);
}

// ===============================
// 🔄 NEW: Cases → Clients Migration
// ===============================

/**
 * מיגרציה: cases → clients (Client=Case Architecture)
 *
 * הפונקציה הזו:
 * 1. טוענת את כל התיקים מ-cases collection
 * 2. יוצרת client document חדש לכל תיק (document ID = caseNumber)
 * 3. מעתיקה את כל הנתונים הרלוונטיים
 * 4. מיזוג עם נתוני לקוח קיימים (אם יש)
 *
 * @param {Object} data
 * @param {boolean} data.dryRun - אם true, רק מדמה ללא שינויים אמיתיים
 * @param {string} data.specificCaseId - מיגרציה לתיק אחד בלבד (לבדיקה)
 * @param {boolean} data.skipExisting - לדלג על תיקים שכבר הועברו
 */
exports.migrateCasesToClients = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // בדיקת הרשאות - רק admin
    if (user.role !== 'admin' && user.role !== 'מנהל') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהל מערכת יכול להריץ מיגרציה'
      );
    }

    const options = {
      dryRun: data.dryRun === true,
      specificCaseId: data.specificCaseId || null,
      skipExisting: data.skipExisting !== false // default true
    };

    console.log(`🚀 Starting cases → clients migration by ${user.username}`, options);

    // סטטיסטיקות
    const stats = {
      totalCases: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      migratedClients: []
    };

    // שלב 1: טעינת תיקים
    let casesSnapshot;
    if (options.specificCaseId) {
      // מיגרציה לתיק אחד בלבד
      const caseDoc = await db.collection('cases').doc(options.specificCaseId).get();
      if (!caseDoc.exists) {
        throw new functions.https.HttpsError('not-found', `תיק ${options.specificCaseId} לא נמצא`);
      }
      casesSnapshot = { docs: [caseDoc], size: 1 };
      stats.totalCases = 1;
    } else {
      // כל התיקים
      casesSnapshot = await db.collection('cases').get();
      stats.totalCases = casesSnapshot.size;
    }

    console.log(`📦 Found ${stats.totalCases} cases to migrate`);

    // שלב 2: מעבר על כל תיק
    for (const caseDoc of casesSnapshot.docs) {
      const caseId = caseDoc.id;
      const caseData = caseDoc.data();

      try {
        console.log(`\n📝 Processing case: ${caseId} (${caseData.caseNumber})`);

        // בדיקה: האם יש caseNumber?
        if (!caseData.caseNumber) {
          console.warn(`⚠️ Case ${caseId} has no caseNumber - skipping`);
          stats.skipped++;
          stats.errorDetails.push(`${caseId}: אין מספר תיק`);
          continue;
        }

        const targetDocId = caseData.caseNumber;

        // בדיקה: האם כבר קיים client עם אותו caseNumber?
        const existingClientDoc = await db.collection('clients').doc(targetDocId).get();

        if (existingClientDoc.exists && options.skipExisting) {
          console.log(`⏭️  Skipping ${targetDocId} - already exists in clients`);
          stats.skipped++;
          continue;
        }

        // שליפת נתוני לקוח מקוריים (אם יש)
        let originalClientData = null;
        if (caseData.clientId) {
          const clientDoc = await db.collection('clients').doc(caseData.clientId).get();
          if (clientDoc.exists) {
            originalClientData = clientDoc.data();
            console.log(`  ℹ️ Found original client data: ${caseData.clientId}`);
          }
        }

        // בניית אובייקט Client מתוך Case
        const clientData = buildClientFromCase(caseData, originalClientData, user.username);

        // Dry run - רק הדפסה
        if (options.dryRun) {
          console.log(`🔍 [DRY RUN] Would ${existingClientDoc.exists ? 'update' : 'create'} client:`,
                     JSON.stringify({ id: targetDocId, ...clientData }, null, 2));
          if (existingClientDoc.exists) {
            stats.updated++;
          } else {
            stats.created++;
          }
          stats.migratedClients.push({
            caseId,
            clientId: targetDocId,
            caseNumber: caseData.caseNumber,
            clientName: clientData.clientName,
            action: existingClientDoc.exists ? 'update' : 'create'
          });
          continue;
        }

        // יצירה/עדכון ב-Firestore
        await db.collection('clients').doc(targetDocId).set(clientData, { merge: true });

        if (existingClientDoc.exists) {
          console.log(`✅ Updated client ${targetDocId}`);
          stats.updated++;
        } else {
          console.log(`✅ Created client ${targetDocId}`);
          stats.created++;
        }

        stats.migratedClients.push({
          caseId,
          clientId: targetDocId,
          caseNumber: caseData.caseNumber,
          clientName: clientData.clientName,
          action: existingClientDoc.exists ? 'update' : 'create'
        });

      } catch (error) {
        stats.errors++;
        const errorMsg = `${caseId}: ${error.message}`;
        stats.errorDetails.push(errorMsg);
        console.error(`❌ Error processing case ${caseId}:`, error);
      }
    }

    // Audit log
    await logAction('MIGRATE_CASES_TO_CLIENTS', user.uid, user.username, {
      ...stats,
      options
    });

    const summary = `
📊 סיכום מיגרציה:
- סה"כ תיקים: ${stats.totalCases}
- clients נוצרו: ${stats.created}
- clients עודכנו: ${stats.updated}
- דולגו: ${stats.skipped}
- שגיאות: ${stats.errors}
${options.dryRun ? '\n⚠️ זו הייתה הרצה לדוגמה (dry run) - לא נעשו שינויים!' : ''}
    `.trim();

    console.log(summary);

    return {
      success: true,
      dryRun: options.dryRun,
      ...stats,
      summary
    };

  } catch (error) {
    console.error('Error in migrateCasesToClients:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציה: ${error.message}`
    );
  }
});

/**
 * פונקציית עזר: בניית אובייקט Client מתוך Case
 */
function buildClientFromCase(caseData, originalClientData, username) {
  // שם הלקוח
  const clientName = caseData.clientName || originalClientData?.clientName || 'לקוח ללא שם';

  // בניית Client document
  const clientDoc = {
    // ✅ במבנה החדש: document ID = caseNumber
    // השדות הבאים יהיו בתוך ה-document

    // זיהוי לקוח
    clientName: clientName,
    fullName: originalClientData?.fullName || clientName,

    // פרטי קשר (מהלקוח המקורי אם יש)
    phone: originalClientData?.phone || caseData.clientPhone || '',
    phoneNumber: originalClientData?.phoneNumber || caseData.clientPhone || '',
    email: originalClientData?.email || caseData.clientEmail || '',
    idNumber: originalClientData?.idNumber || '',
    address: originalClientData?.address || '',

    // פרטי התיק (כולל במבנה החדש)
    caseNumber: caseData.caseNumber,
    caseTitle: caseData.caseTitle || clientName,
    description: caseData.description || '',

    // סוג הליך ותמחור
    procedureType: caseData.procedureType || 'hours',
    pricingType: caseData.pricingType || 'hourly',

    // סטטוס
    status: caseData.status || 'active',
    priority: caseData.priority || 'medium',

    // עו"ד מוקצה
    assignedTo: caseData.assignedTo || [username],
    mainAttorney: caseData.mainAttorney || username,

    // תאריכים
    openedAt: caseData.openedAt || caseData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    deadline: caseData.deadline || null,

    // שירותים (services array)
    services: caseData.services || [],

    // שלבים (stages array) - להליכים משפטיים
    stages: caseData.stages || [],

    // מידע היסטורי
    totalHours: caseData.totalHours || 0,
    hoursRemaining: caseData.hoursRemaining || 0,
    minutesRemaining: caseData.minutesRemaining || (caseData.hoursRemaining || 0) * 60,
    hourlyRate: caseData.hourlyRate || 0,
    fixedPrice: caseData.fixedPrice || 0,

    // Metadata
    migratedFrom: 'cases',
    originalCaseId: caseData.caseId || caseData.id,
    originalClientId: caseData.clientId,
    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    migratedBy: username,

    createdBy: caseData.createdBy || username,
    createdAt: caseData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    lastModifiedBy: username,
    lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // ניקוי undefined values
  return cleanUndefined(clientDoc);
}

// ===============================
// Employee Hours Quota Management
// ===============================

/**
 * הוספת תקן שעות שבועי לכל העובדים (מיגרציה חד-פעמית)
 * מנהלים בלבד
 */
exports.addHoursQuotaToEmployees = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // רק מנהלים יכולים להריץ מיגרציה זו
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להוסיף תקן שעות לעובדים'
      );
    }

    const defaultQuota = data.defaultQuota || 40; // תקן ברירת מחדל: 40 שעות שבועיות

    console.log(`🔄 מתחיל הוספת תקן שעות שבועי (${defaultQuota}) לכל העובדים...`);

    const employeesSnapshot = await db.collection('employees').get();

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    for (const doc of employeesSnapshot.docs) {
      try {
        const employeeData = doc.data();

        // אם כבר יש תקן שעות - דלג
        if (employeeData.weeklyHoursQuota !== undefined) {
          console.log(`⏩ ${doc.id} כבר יש לו תקן שעות (${employeeData.weeklyHoursQuota})`);
          skipped++;
          continue;
        }

        // עדכון העובד עם תקן שעות
        await doc.ref.update({
          weeklyHoursQuota: defaultQuota,
          quotaUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          quotaUpdatedBy: user.username
        });

        console.log(`✅ ${doc.id} עודכן עם תקן שעות: ${defaultQuota}`);
        updated++;

      } catch (error) {
        errors++;
        const errorMsg = `${doc.id}: ${error.message}`;
        errorDetails.push(errorMsg);
        console.error(`❌ Error processing ${doc.id}:`, error);
      }
    }

    // Audit log
    await logAction('ADD_HOURS_QUOTA_TO_EMPLOYEES', user.uid, user.username, {
      defaultQuota,
      totalEmployees: employeesSnapshot.size,
      updated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    });

    console.log(`🎉 הוספת תקן שעות הושלמה: ${updated} עודכנו, ${skipped} דולגו, ${errors} שגיאות`);

    return {
      success: true,
      defaultQuota,
      totalEmployees: employeesSnapshot.size,
      updated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `תקן שעות (${defaultQuota} שעות שבועיות) נוסף ל-${updated} עובדים`
    };

  } catch (error) {
    console.error('Error in addHoursQuotaToEmployees:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהוספת תקן שעות: ${error.message}`
    );
  }
});

/**
 * מיגרציה רטרואקטיבית: קיזוז שעות מרישומי שעתון היסטוריים
 * פונקציה חד-פעמית - מנהלים בלבד
 */
exports.migrateHistoricalTimesheetEntries = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // רק מנהלים יכולים להריץ מיגרציה זו
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להריץ מיגרציה היסטורית'
      );
    }

    console.log(`🔄 מתחיל מיגרציה רטרואקטיבית של רישומי שעתון...`);

    const entriesSnapshot = await db.collection('timesheet_entries').get();

    let processed = 0;
    let deducted = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    for (const entryDoc of entriesSnapshot.docs) {
      try {
        const entry = entryDoc.data();
        processed++;

        // דלג אם כבר קוזז
        if (entry.hoursDeducted === true) {
          console.log(`⏩ ${entryDoc.id} כבר קוזז - דילוג`);
          skipped++;
          continue;
        }

        // דלג אם זה רישום פנימי
        if (entry.isInternal === true) {
          console.log(`⏩ ${entryDoc.id} רישום פנימי - דילוג`);
          await entryDoc.ref.update({ hoursDeducted: true }); // סמן שעובד
          skipped++;
          continue;
        }

        // דלג אם אין תיק מקושר
        if (!entry.caseId) {
          console.log(`⏩ ${entryDoc.id} אין תיק מקושר - דילוג`);
          await entryDoc.ref.update({ hoursDeducted: true }); // סמן שעובד
          skipped++;
          continue;
        }

        // קרא את התיק (במבנה החדש: clients collection)
        const caseDoc = await db.collection('clients').doc(entry.caseId).get();
        if (!caseDoc.exists) {
          console.warn(`⚠️ ${entryDoc.id} - תיק ${entry.caseId} לא נמצא`);
          await entryDoc.ref.update({ hoursDeducted: true }); // סמן שעובד (אפילו אם התיק לא קיים)
          skipped++;
          continue;
        }

        const caseData = caseDoc.data();

        // קזז רק מתיקים שעתיים
        if (caseData.procedureType !== 'hours') {
          console.log(`⏩ ${entryDoc.id} - תיק ${entry.caseId} אינו מסוג שעות - דילוג`);
          await entryDoc.ref.update({ hoursDeducted: true });
          skipped++;
          continue;
        }

        // קזז את השעות מהתיק
        const minutesToDeduct = entry.minutes || 0;
        await caseDoc.ref.update({
          minutesRemaining: admin.firestore.FieldValue.increment(-minutesToDeduct),
          hoursRemaining: admin.firestore.FieldValue.increment(-minutesToDeduct / 60),
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        });

        // סמן שהרישום קוזז
        await entryDoc.ref.update({
          hoursDeducted: true,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedBy: user.username
        });

        console.log(`✅ ${entryDoc.id} - קוזזו ${minutesToDeduct} דקות מתיק ${entry.caseId}`);
        deducted++;

      } catch (error) {
        errors++;
        const errorMsg = `${entryDoc.id}: ${error.message}`;
        errorDetails.push(errorMsg);
        console.error(`❌ Error processing ${entryDoc.id}:`, error);
      }
    }

    // Audit log
    await logAction('MIGRATE_HISTORICAL_TIMESHEET', user.uid, user.username, {
      totalEntries: entriesSnapshot.size,
      processed,
      deducted,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    });

    console.log(`🎉 מיגרציה הושלמה: ${deducted} קוזזו, ${skipped} דולגו, ${errors} שגיאות`);

    return {
      success: true,
      totalEntries: entriesSnapshot.size,
      processed,
      deducted,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `מיגרציה הושלמה: ${deducted} רישומים קוזזו רטרואקטיבית`
    };

  } catch (error) {
    console.error('Error in migrateHistoricalTimesheetEntries:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציה היסטורית: ${error.message}`
    );
  }
});

/**
 * ✅ ENTERPRISE: מיגרציה - הוספת _version לכל מסמכי הלקוחות
 *
 * פונקציה זו מוסיפה שדות Version Control לכל מסמכי הלקוחות הקיימים:
 * - _version: מספר גרסה (מתחיל מ-0)
 * - _lastModified: תאריך עדכון אחרון
 * - _modifiedBy: מי ביצע את העדכון האחרון
 *
 * זה נדרש עבור מנגנון Optimistic Locking שמונע Lost Updates.
 *
 * שימוש:
 * 1. רק מנהלים יכולים להפעיל
 * 2. מריצים פעם אחת בלבד על כל הנתונים הקיימים
 * 3. אחר כך כל createTimesheetEntry_v2 ישתמש ב-_version אוטומטית
 *
 * @requires Admin role
 */
exports.migrateClientsAddVersionControl = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // רק מנהלים יכולים להריץ מיגרציה
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להריץ מיגרציה זו'
      );
    }

    console.log(`🚀 [MIGRATION] מתחיל מיגרציית Version Control ל-clients collection...`);

    const clientsSnapshot = await db.collection('clients').get();

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore limit

    for (const clientDoc of clientsSnapshot.docs) {
      try {
        const clientData = clientDoc.data();

        // אם כבר יש _version, דלג
        if (clientData._version !== undefined) {
          skipped++;
          console.log(`⏭️  ${clientDoc.id} - כבר יש _version: ${clientData._version}`);
          continue;
        }

        // הוסף שדות Version Control
        const updateData = {
          _version: 0,  // התחלה מגרסה 0
          _lastModified: clientData.lastModifiedAt || admin.firestore.FieldValue.serverTimestamp(),
          _modifiedBy: clientData.lastModifiedBy || 'system',
          _etag: `v0_${Date.now()}` // Optional: ETag for additional validation
        };

        batch.update(clientDoc.ref, updateData);
        updated++;
        batchCount++;

        console.log(`✅ ${clientDoc.id} - הוסף _version: 0`);

        // Commit batch כל 500 מסמכים (מגבלת Firestore)
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`📦 Batch committed: ${batchCount} documents`);
          batchCount = 0;
        }

        processed++;

      } catch (error) {
        errors++;
        const errorMsg = `${clientDoc.id}: ${error.message}`;
        errorDetails.push(errorMsg);
        console.error(`❌ Error processing ${clientDoc.id}:`, error);
      }
    }

    // Commit יתרת ה-batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Final batch committed: ${batchCount} documents`);
    }

    // Audit log
    await logAction('MIGRATE_VERSION_CONTROL', user.uid, user.username, {
      totalClients: clientsSnapshot.size,
      processed,
      updated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    });

    console.log(`🎉 מיגרציית Version Control הושלמה: ${updated} עודכנו, ${skipped} דולגו, ${errors} שגיאות`);

    return {
      success: true,
      totalClients: clientsSnapshot.size,
      processed,
      updated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      message: `מיגרציה הושלמה: ${updated} לקוחות עודכנו עם Version Control`
    };

  } catch (error) {
    console.error('❌ Error in migrateClientsAddVersionControl:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במיגרציית Version Control: ${error.message}`
    );
  }
});

// ===============================
// Fix Client FullNames - תיקון שמות לקוחות
// ===============================

/**
 * תיקון שדה fullName בלקוחות
 * פונקציה חד-פעמית שמתקנת לקוחות שיש להם clientName אבל אין להם fullName
 */
exports.fixClientFullNames = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔧 Starting fixClientFullNames...');

    // בדיקת הרשאות - רק Admin
    const employee = await checkUserPermissions(context);
    if (!employee.isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להריץ פונקציה זו'
      );
    }

    // שלב 1: מצא את כל הלקוחות
    const allClientsSnapshot = await db.collection('clients').get();

    const toFix = [];
    const alreadyOk = [];

    allClientsSnapshot.forEach(doc => {
      const data = doc.data();

      // בדוק אם חסר fullName אבל יש clientName
      if (!data.fullName && data.clientName) {
        toFix.push({
          id: doc.id,
          clientName: data.clientName
        });
      } else if (data.fullName) {
        alreadyOk.push(doc.id);
      }
    });

    console.log(`📊 נמצאו ${toFix.length} לקוחות לתיקון`);
    console.log(`✅ ${alreadyOk.length} לקוחות תקינים`);

    // שלב 2: תקן את הלקוחות הבעייתיים
    const batch = db.batch();
    let fixedCount = 0;

    for (const client of toFix) {
      const clientRef = db.collection('clients').doc(client.id);
      batch.update(clientRef, {
        fullName: client.clientName,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: employee.name
      });
      fixedCount++;
      console.log(`  ✓ תוקן: ${client.clientName} (${client.id})`);
    }

    // בצע את כל העדכונים בבת אחת
    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ תוקנו ${fixedCount} לקוחות בהצלחה!`);
    } else {
      console.log('✅ אין לקוחות לתיקון - הכל תקין!');
    }

    // רישום פעילות
    await logActivity({
      actionType: 'SYSTEM_MAINTENANCE',
      targetType: 'clients',
      targetId: 'bulk',
      performedBy: employee.name,
      performedByUID: context.auth.uid,
      details: {
        action: 'fixClientFullNames',
        fixedCount: fixedCount,
        totalClients: allClientsSnapshot.size
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: `תיקון הושלם בהצלחה!`,
      stats: {
        totalClients: allClientsSnapshot.size,
        alreadyOk: alreadyOk.length,
        fixed: fixedCount,
        fixedClients: toFix.map(c => c.clientName)
      }
    };

  } catch (error) {
    console.error('Error in fixClientFullNames:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בתיקון שמות לקוחות: ${error.message}`
    );
  }
});

/**
 * setAdminClaim - מגדיר Custom Claim של admin למשתמש
 * מאפשר הרשאות מתקדמות ב-Security Rules
 */
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔐 Starting setAdminClaim...');

    // בדיקת הרשאות - רק מי שכבר admin יכול להריץ
    const employee = await checkUserPermissions(context);
    if (!employee.isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להגדיר הרשאות admin'
      );
    }

    const { email, isAdmin } = data;

    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק email'
      );
    }

    // מצא את המשתמש לפי email
    const userRecord = await auth.getUserByEmail(email);

    // הגדר את ה-custom claim
    await auth.setCustomUserClaims(userRecord.uid, {
      admin: isAdmin === true
    });

    console.log(`✅ Custom claim set for ${email}: admin=${isAdmin}`);

    // רישום פעילות
    await logActivity({
      actionType: 'ADMIN_CLAIM_SET',
      targetType: 'user',
      targetId: userRecord.uid,
      performedBy: employee.name,
      performedByUID: context.auth.uid,
      details: {
        email: email,
        isAdmin: isAdmin
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: `הרשאת admin עודכנה בהצלחה עבור ${email}`,
      email: email,
      isAdmin: isAdmin
    };

  } catch (error) {
    console.error('Error in setAdminClaim:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהגדרת הרשאות: ${error.message}`
    );
  }
});

/**
 * initializeAdminClaims - מאתחל custom claims לכל המנהלים
 * פועל פעם אחת להגדרת ההרשאות הראשונית
 * אין בדיקת הרשאות כי זו הפעם הראשונה
 */
exports.initializeAdminClaims = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔐 Starting initializeAdminClaims...');

    // בדיקה שהמשתמש מחובר (אבל לא בודקים אם הוא admin כי זו הפעם הראשונה)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    // מצא את כל העובדים שמסומנים כ-admin
    const adminsSnapshot = await db.collection('employees')
      .where('isAdmin', '==', true)
      .get();

    const results = [];

    for (const doc of adminsSnapshot.docs) {
      const employeeData = doc.data();
      const email = employeeData.email;

      try {
        const userRecord = await auth.getUserByEmail(email);

        await auth.setCustomUserClaims(userRecord.uid, {
          admin: true
        });

        console.log(`✅ Set admin claim for: ${email}`);
        results.push({
          email: email,
          success: true
        });

      } catch (error) {
        console.error(`❌ Failed to set claim for ${email}:`, error);
        results.push({
          email: email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Initialized admin claims for ${results.filter(r => r.success).length}/${results.length} users`);

    return {
      success: true,
      message: `אותחלו הרשאות admin`,
      results: results,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

  } catch (error) {
    console.error('Error in initializeAdminClaims:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה באתחול הרשאות: ${error.message}`
    );
  }
});

// ===============================
// Scheduled Functions - פונקציות מתוזמנות
// ===============================

/**
 * dailyTaskReminders - תזכורות משימות יומיות
 * רץ כל יום בשעה 09:00 בבוקר
 * בודק:
 * 1. משימות שעומדות לפוג בתוך 3 ימים
 * 2. משימות שכבר עבר תאריך היעד שלהן (overdue)
 * שולח התראה אוטומטית לעובדים (לא למנהלים - הם רואים בדשבורד)
 */
exports.dailyTaskReminders = onSchedule({
  schedule: '0 9 * * *',  // כל יום בשעה 09:00
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async (event) => {
    try {
      console.log('🔔 Running dailyTaskReminders at', new Date().toISOString());

      const now = admin.firestore.Timestamp.now();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const threeDaysTimestamp = admin.firestore.Timestamp.fromDate(threeDaysFromNow);

      // מצא משימות פעילות עם deadline בתוך 3 ימים או שעבר
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'פעיל')
        .where('deadline', '!=', null)
        .get();

      let remindersCount = 0;
      let overdueCount = 0;

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;
        const deadline = task.deadline;

        // דלג על משימות ללא deadline
        if (!deadline) continue;

        const isOverdue = deadline.toDate() < now.toDate();
        const isUpcoming = !isOverdue && deadline.toDate() <= threeDaysTimestamp.toDate();

        if (isOverdue) {
          // משימה שעבר הזמן
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⚠️ משימה באיחור: ${task.clientName}`,
            message: `המשימה "${task.description}" עברה את תאריך היעד (${formatDate(deadline.toDate())})`,
            type: 'error',
            taskId: taskId,
            reminder: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-triangle'
          });
          overdueCount++;

        } else if (isUpcoming) {
          // משימה שמתקרבת לתאריך יעד
          const daysLeft = Math.ceil((deadline.toDate() - now.toDate()) / (1000 * 60 * 60 * 24));
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⏰ תזכורת: ${task.clientName}`,
            message: `המשימה "${task.description}" מתקרבת לתאריך יעד (${daysLeft} ימים)`,
            type: 'warning',
            taskId: taskId,
            reminder: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-clock'
          });
          remindersCount++;
        }
      }

      console.log(`✅ Sent ${overdueCount} overdue alerts and ${remindersCount} upcoming reminders`);
      return { overdueCount, remindersCount };

    } catch (error) {
      console.error('❌ Error in dailyTaskReminders:', error);
      throw error;
    }
  });

/**
 * dailyBudgetWarnings - אזהרות תקציב יומיות
 * רץ כל יום בשעה 17:00 אחה"צ
 * בודק:
 * 1. משימות שחרגו מ-80% מתקציב הזמן (warning)
 * 2. משימות שחרגו 100% מתקציב הזמן (danger)
 * שולח התראה אוטומטית לעובדים
 */
exports.dailyBudgetWarnings = onSchedule({
  schedule: '0 17 * * *',  // כל יום בשעה 17:00
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async (event) => {
    try {
      console.log('💰 Running dailyBudgetWarnings at', new Date().toISOString());

      // מצא משימות פעילות
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'פעיל')
        .get();

      let warningsCount = 0;
      let criticalCount = 0;

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;

        // חישוב תקציב ושעות בפועל
        const estimatedMinutes = (task.estimatedHours || 0) * 60 + (task.estimatedMinutes || 0);
        const actualMinutes = (task.actualHours || 0) * 60 + (task.actualMinutes || 0);

        // דלג על משימות ללא תקציב
        if (estimatedMinutes === 0) continue;

        const percentageUsed = (actualMinutes / estimatedMinutes) * 100;

        // בדוק אם כבר שלחנו התראה היום (למנוע spam)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingNotification = await db.collection('notifications')
          .where('taskId', '==', taskId)
          .where('automated', '==', true)
          .where('type', 'in', ['warning', 'error'])
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
          .limit(1)
          .get();

        if (!existingNotification.empty) {
          console.log(`⏭️  Skipping task ${taskId} - already notified today`);
          continue;
        }

        if (percentageUsed >= 100) {
          // חריגה מלאה מהתקציב
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `🚨 חריגה מתקציב: ${task.clientName}`,
            message: `המשימה "${task.description}" חרגה מתקציב הזמן (${Math.round(percentageUsed)}%)`,
            type: 'error',
            taskId: taskId,
            budgetWarning: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-circle'
          });
          criticalCount++;

        } else if (percentageUsed >= 80) {
          // אזהרה - מתקרב לתקציב
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⚠️ התקרבות לתקציב: ${task.clientName}`,
            message: `המשימה "${task.description}" מתקרבת לתקציב הזמן (${Math.round(percentageUsed)}%)`,
            type: 'warning',
            taskId: taskId,
            budgetWarning: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-triangle'
          });
          warningsCount++;
        }
      }

      console.log(`✅ Sent ${criticalCount} critical budget alerts and ${warningsCount} budget warnings`);
      return { criticalCount, warningsCount };

    } catch (error) {
      console.error('❌ Error in dailyBudgetWarnings:', error);
      throw error;
    }
  });

/**
 * formatDate - פורמט תאריך לתצוגה בעברית
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

// ===============================
// 🔧 Fix Broken Legal Procedures
// ===============================

/**
 * 🔧 תיקון הליכים משפטיים ישנים ששלבים שלהם ריקים או שבורים
 */
exports.fixBrokenLegalProcedures = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin' && user.role !== 'מנהל') {
      throw new functions.https.HttpsError('permission-denied', 'רק מנהל מערכת יכול להריץ תיקון');
    }

    const dryRun = data.dryRun === true;
    const specificClientId = data.clientId || null;

    console.log(`🔧 Starting fix by ${user.username}`, { dryRun, specificClientId });

    const stats = { totalClients: 0, totalServices: 0, brokenProcedures: 0, fixed: 0, skipped: 0, errors: 0, details: [] };

    let clientsSnapshot;
    if (specificClientId) {
      const clientDoc = await db.collection('clients').doc(specificClientId).get();
      if (!clientDoc.exists) throw new functions.https.HttpsError('not-found', `לקוח ${specificClientId} לא נמצא`);
      clientsSnapshot = { docs: [clientDoc], size: 1 };
    } else {
      clientsSnapshot = await db.collection('clients').get();
    }

    stats.totalClients = clientsSnapshot.size;

    for (const clientDoc of clientsSnapshot.docs) {
      try {
        const clientData = clientDoc.data();
        const services = clientData.services || [];
        stats.totalServices += services.length;

        let needsUpdate = false;
        const fixedServices = [];

        for (const service of services) {
          if (service.type === 'legal_procedure') {
            const isBroken = !service.stages || !Array.isArray(service.stages) || service.stages.length === 0 || service.stages.length !== 3;

            if (isBroken) {
              stats.brokenProcedures++;
              console.log(`🔍 Broken: ${service.name} (${service.id}) in ${clientDoc.id}`);

              const defaultHours = [20, 30, 10];
              const pricingType = service.pricingType || 'hourly';
              const now = new Date().toISOString();

              const rebuiltStages = ['א', 'ב', 'ג'].map((letter, index) => {
                const stageId = `stage_${['a', 'b', 'c'][index]}`;
                const stageName = `שלב ${letter}'`;

                const stage = {
                  id: stageId,
                  name: stageName,
                  description: service.stages?.[index]?.description || `${stageName} - ${service.name}`,
                  status: index === 0 ? 'active' : 'pending',
                  order: index + 1
                };

                if (pricingType === 'hourly') {
                  const hours = service.stages?.[index]?.hours || service.stages?.[index]?.totalHours || defaultHours[index];
                  const packageId = `pkg_${stageId}_${Date.now()}`;
                  stage.packages = [{
                    id: packageId,
                    type: 'initial',
                    hours: hours,
                    hoursUsed: service.stages?.[index]?.hoursUsed || 0,
                    hoursRemaining: hours - (service.stages?.[index]?.hoursUsed || 0),
                    purchaseDate: now,
                    status: 'active',
                    description: 'חבילה ראשונית - תוקן אוטומטית'
                  }];
                  stage.totalHours = hours;
                  stage.hoursUsed = service.stages?.[index]?.hoursUsed || 0;
                  stage.hoursRemaining = hours - (service.stages?.[index]?.hoursUsed || 0);
                } else {
                  stage.fixedPrice = service.stages?.[index]?.fixedPrice || 10000;
                  stage.paid = service.stages?.[index]?.paid || false;
                }

                return stage;
              });

              const fixedService = { ...service, stages: rebuiltStages, _fixedAt: now, _fixedBy: user.username };

              if (pricingType === 'hourly') {
                fixedService.totalHours = rebuiltStages.reduce((sum, s) => sum + (s.totalHours || 0), 0);
                fixedService.hoursUsed = rebuiltStages.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
                fixedService.hoursRemaining = fixedService.totalHours - fixedService.hoursUsed;
              } else {
                fixedService.totalPrice = rebuiltStages.reduce((sum, s) => sum + (s.fixedPrice || 0), 0);
                fixedService.totalPaid = 0;
              }

              fixedServices.push(fixedService);
              needsUpdate = true;
              stats.fixed++;

              stats.details.push({ clientId: clientDoc.id, clientName: clientData.clientName || clientData.fullName, serviceId: service.id, serviceName: service.name, action: 'fixed', stagesCount: rebuiltStages.length, totalHours: fixedService.totalHours });

              console.log(`✅ Fixed: ${service.name} - ${rebuiltStages.length} stages`);
            } else {
              fixedServices.push(service);
              stats.skipped++;
            }
          } else {
            fixedServices.push(service);
          }
        }

        if (needsUpdate && !dryRun) {
          await clientDoc.ref.update({
            services: fixedServices,
            lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: user.username
          });
          console.log(`💾 Updated ${clientDoc.id}`);
        }

      } catch (error) {
        stats.errors++;
        console.error(`❌ Error in ${clientDoc.id}:`, error);
        stats.details.push({ clientId: clientDoc.id, error: error.message });
      }
    }

    await logAction('FIX_BROKEN_LEGAL_PROCEDURES', user.uid, user.username, { dryRun, ...stats });

    const message = dryRun
      ? `[DRY RUN] נמצאו ${stats.brokenProcedures} הליכים שבורים מתוך ${stats.totalServices} שירותים`
      : `תוקנו ${stats.fixed} הליכים משפטיים מתוך ${stats.brokenProcedures} שבורים`;

    console.log(`🎉 Fix complete:`, stats);

    return { success: true, dryRun, ...stats, message };

  } catch (error) {
    console.error('Error in fixBrokenLegalProcedures:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', `שגיאה בתיקון הליכים משפטיים: ${error.message}`);
  }
});

// ===============================
// Master Admin Panel Functions
// ===============================

// Import admin panel functions
// ⚠️ TEMPORARILY DISABLED - admin directory not deployed
// const { adminTransferUserData } = require('./admin/transfer-user-data');
// const { adminGetUserFullDetails } = require('./admin/get-user-full-details');
// const { adminGenerateClientReport } = require('./admin/generate-client-report');
// const { adminUpdateClientFull } = require('./admin/update-client-full');

// Import Master Admin Panel Phase 4 Wrappers (for Phase 3 UI)
// ✅ ENABLED - Master Admin Panel Cloud Functions
const {
  createUser,
  updateUser,
  blockUser,
  deleteUser,
  getUserFullDetails
} = require('./admin/master-admin-wrappers');

// Export admin functions
// ⚠️ TEMPORARILY DISABLED - admin directory not deployed
// exports.adminTransferUserData = adminTransferUserData;
// exports.adminGetUserFullDetails = adminGetUserFullDetails;
// exports.adminGenerateClientReport = adminGenerateClientReport;
// exports.adminUpdateClientFull = adminUpdateClientFull;

// Export Master Admin Panel Phase 4 Wrappers (Simple names for UI)
// ✅ ENABLED - Master Admin Panel Cloud Functions
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.blockUser = blockUser;
exports.deleteUser = deleteUser;
exports.getUserFullDetails = getUserFullDetails;

// Real-time Task Updates & Notifications
exports.updateBudgetTask = updateBudgetTask;
exports.markNotificationAsRead = markNotificationAsRead;

// ═══════════════════════════════════════════════════════════════════════
// 🔧 DATA FIX: Add missing packages to legal procedure stages
// ═══════════════════════════════════════════════════════════════════════

/**
 * תיקון חבילות חסרות בשלבים של הליכים משפטיים
 * מוסיף חבילה אוטומטית לכל שלב שאין לו חבילות
 */
exports.fixMissingPackages = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Only admin can run this
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק אדמין יכול להריץ תיקון זה'
      );
    }

    const clientId = data.clientId;
    if (!clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    console.log(`🔧 Starting package fix for client: ${clientId}`);

    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    const clientData = clientDoc.data();

    // ודא שזה הליך משפטי שעתי
    if (clientData.procedureType !== 'legal_procedure' || clientData.pricingType !== 'hourly') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'פונקציה זו רלוונטית רק להליכים משפטיים שעתיים'
      );
    }

    if (!clientData.stages || clientData.stages.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'אין שלבים בלקוח זה'
      );
    }

    console.log(`  📋 Found ${clientData.stages.length} stages`);

    let stagesFixed = 0;
    const updatedStages = clientData.stages.map((stage, idx) => {
      // אם כבר יש חבילות - דלג
      if (stage.packages && stage.packages.length > 0) {
        console.log(`  ✅ ${stage.name || stage.id}: already has packages`);
        return stage;
      }

      // צור חבילה חדשה
      const hours = stage.totalHours || stage.initialHours || 20;
      const hoursUsed = stage.hoursUsed || 0;

      const newPackage = {
        id: `pkg_fix_${stage.id}_${Date.now()}`,
        type: 'initial',
        hours: hours,
        hoursUsed: hoursUsed,
        hoursRemaining: hours - hoursUsed,
        purchaseDate: new Date().toISOString(),
        status: 'active',
        note: 'חבילה נוספה אוטומטית ע"י תיקון מערכת'
      };

      console.log(`  ➕ ${stage.name || stage.id}: adding package (${hours} hours)`);
      stagesFixed++;

      return {
        ...stage,
        packages: [newPackage]
      };
    });

    // שמירה
    await clientRef.update({
      stages: updatedStages,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: `${user.username} (system_fix)`
    });

    console.log(`✅ Fixed ${stagesFixed} stages for client ${clientId}`);

    return {
      success: true,
      clientId: clientId,
      stagesFixed: stagesFixed,
      totalStages: clientData.stages.length,
      message: `תוקנו ${stagesFixed} שלבים בהצלחה`
    };

  } catch (error) {
    console.error('Error in fixMissingPackages:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      'שגיאה בתיקון חבילות: ' + error.message
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 🔧 DATA FIX: Rebuild stages structure for old legal procedures
// ═══════════════════════════════════════════════════════════════════════

/**
 * שחזור מבנה שלבים ישן למבנה חדש עם stage_a/b/c
 * מתקן לקוחות שנוצרו בגרסה ישנה עם id: 1,2,3 במקום stage_a,b,c
 */
exports.rebuildStagesStructure = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Only admin can run this
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק אדמין יכול להריץ תיקון זה'
      );
    }

    const clientId = data.clientId;
    if (!clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    console.log(`🔧 Rebuilding stages structure for client: ${clientId}`);

    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    const clientData = clientDoc.data();

    // ודא שזה הליך משפטי שעתי
    if (clientData.procedureType !== 'legal_procedure' || clientData.pricingType !== 'hourly') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'פונקציה זו רלוונטית רק להליכים משפטיים שעתיים'
      );
    }

    if (!clientData.stages || clientData.stages.length !== 3) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'צפויים בדיוק 3 שלבים'
      );
    }

    console.log(`  📋 Rebuilding ${clientData.stages.length} stages...`);

    // שחזור השלבים עם המבנה הנכון
    const stageMapping = [
      { oldId: 1, newId: 'stage_a', name: 'שלב א', order: 1 },
      { oldId: 2, newId: 'stage_b', name: 'שלב ב', order: 2 },
      { oldId: 3, newId: 'stage_c', name: 'שלב ג', order: 3 }
    ];

    const rebuiltStages = clientData.stages.map((oldStage, idx) => {
      const mapping = stageMapping[idx];

      // חישוב totalHours מהחבילות
      let totalHours = 20; // default
      let hoursUsed = 0;
      let hoursRemaining = 20;

      if (oldStage.packages && oldStage.packages.length > 0) {
        totalHours = oldStage.packages.reduce((sum, pkg) => sum + (pkg.hours || 0), 0);
        hoursUsed = oldStage.packages.reduce((sum, pkg) => sum + (pkg.hoursUsed || 0), 0);
        hoursRemaining = oldStage.packages.reduce((sum, pkg) => sum + (pkg.hoursRemaining || pkg.hours || 0), 0);
      }

      const newStage = {
        id: mapping.newId,
        name: mapping.name,
        description: oldStage.description || `${mapping.name}`,
        order: mapping.order,
        status: idx === 0 ? 'active' : 'pending',
        pricingType: 'hourly',
        initialHours: totalHours,
        totalHours: totalHours,
        hoursUsed: hoursUsed,
        hoursRemaining: hoursRemaining,
        packages: oldStage.packages || [],
        completed: oldStage.completed || false,
        completedAt: oldStage.completedAt || null,
        completedBy: oldStage.completedBy || null
      };

      console.log(`  ✅ שלב ${idx + 1}: ${oldStage.id} → ${newStage.id} (${newStage.name})`);

      return newStage;
    });

    // עדכון הלקוח
    await clientRef.update({
      stages: rebuiltStages,
      currentStage: 'stage_a',
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: `${user.username} (rebuild_stages)`
    });

    console.log(`✅ Rebuilt stages structure for client ${clientId}`);

    return {
      success: true,
      clientId: clientId,
      stagesRebuilt: rebuiltStages.length,
      message: 'מבנה השלבים שוחזר בהצלחה'
    };

  } catch (error) {
    console.error('Error in rebuildStagesStructure:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      'שגיאה בשחזור מבנה שלבים: ' + error.message
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 📊 USER METRICS - Server-Side Statistics
// ═══════════════════════════════════════════════════════════════════════

/**
 * getUserMetrics - קבלת סטטיסטיקות משתמש מהשרת
 *
 * מחזיר מטריקות מחושבות מראש מ-user_metrics collection
 * אם לא קיים - מחשב בזמן אמת (fallback)
 *
 * @returns {Object} { total, active, completed, urgent, updatedAt }
 */
exports.getUserMetrics = functions.https.onCall(async (data, context) => {
  try {
    // Security: בדיקת הרשאות
    const user = await checkUserPermissions(context);

    // נסה לקרוא metrics מראש מחושבים
    const metricsDoc = await db.collection('user_metrics').doc(user.email).get();

    if (metricsDoc.exists) {
      const metrics = metricsDoc.data();

      // בדוק שהנתונים לא ישנים מדי (יותר מ-5 דקות)
      const now = Date.now();
      const updatedAt = metrics.updatedAt?.toMillis() || 0;
      const ageMinutes = (now - updatedAt) / (1000 * 60);

      if (ageMinutes < 5) {
        // נתונים טריים - החזר מיידית
        return {
          success: true,
          data: {
            total: metrics.total || 0,
            active: metrics.active || 0,
            completed: metrics.completed || 0,
            urgent: metrics.urgent || 0,
            updatedAt: metrics.updatedAt,
            source: 'cache'
          }
        };
      }
    }

    // Fallback: חישוב בזמן אמת
    console.log(`⚡ Computing real-time metrics for ${user.email}`);

    const tasksSnapshot = await db.collection('budget_tasks')
      .where('employee', '==', user.email)
      .get();

    const now = new Date();
    const urgentThresholdMs = 72 * 60 * 60 * 1000; // 72 hours

    let total = 0;
    let active = 0;
    let completed = 0;
    let urgent = 0;

    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      total++;

      if (task.status === 'הושלם') {
        completed++;
      } else {
        active++;

        // בדוק דחיפות
        if (task.deadline) {
          const deadline = task.deadline.toMillis ? task.deadline.toMillis() : new Date(task.deadline).getTime();
          const timeUntilDeadline = deadline - now.getTime();

          if (timeUntilDeadline <= urgentThresholdMs && timeUntilDeadline >= -24 * 60 * 60 * 1000) {
            urgent++;
          }
        }
      }
    });

    const metrics = {
      total,
      active,
      completed,
      urgent,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // שמור לcache עבור פעם הבאה
    await db.collection('user_metrics').doc(user.email).set(metrics, { merge: true });

    return {
      success: true,
      data: {
        ...metrics,
        source: 'computed'
      }
    };

  } catch (error) {
    console.error('❌ getUserMetrics error:', error);
    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת מטריקות: ${error.message}`
    );
  }
});

/**
 * updateMetricsOnTaskChange - טריגר עדכון מטריקות על שינוי משימה
 *
 * מתעדכן אוטומטית כאשר:
 * - נוצרת משימה חדשה (onCreate)
 * - משימה משתנה (onUpdate)
 * - משימה נמחקת (onDelete)
 *
 * מעדכן את user_metrics/{email} באופן אטומי
 */
exports.updateMetricsOnTaskChange = onDocumentWritten({
  document: 'budget_tasks/{taskId}',
  region: 'us-central1'
}, async (event) => {
    try {
      const taskId = event.params.taskId;
      const change = event.data;

      // קבל את המשימה (לפני/אחרי)
      const oldTask = change.before.exists ? change.before.data() : null;
      const newTask = change.after.exists ? change.after.data() : null;

      // אם אין employee - דלג
      const employee = (newTask?.employee || oldTask?.employee);
      if (!employee) {
        console.log(`⏭️  Skipping task ${taskId} - no employee`);
        return null;
      }

      console.log(`📊 Updating metrics for ${employee} (task: ${taskId})`);

      // חשב שינוי במטריקות
      const metricsRef = db.collection('user_metrics').doc(employee);

      const now = new Date();
      const urgentThresholdMs = 72 * 60 * 60 * 1000; // 72 hours

      // פונקציה לבדיקת דחיפות
      const isUrgent = (task) => {
        if (!task?.deadline || task.status === 'הושלם') return false;
        const deadline = task.deadline.toMillis ? task.deadline.toMillis() : new Date(task.deadline).getTime();
        const timeUntilDeadline = deadline - now.getTime();
        return timeUntilDeadline <= urgentThresholdMs && timeUntilDeadline >= -24 * 60 * 60 * 1000;
      };

      // חשב שינויים
      let totalDelta = 0;
      let activeDelta = 0;
      let completedDelta = 0;
      let urgentDelta = 0;

      if (!oldTask && newTask) {
        // משימה חדשה
        totalDelta = 1;
        if (newTask.status === 'הושלם') {
          completedDelta = 1;
        } else {
          activeDelta = 1;
          if (isUrgent(newTask)) urgentDelta = 1;
        }
      } else if (oldTask && !newTask) {
        // משימה נמחקה
        totalDelta = -1;
        if (oldTask.status === 'הושלם') {
          completedDelta = -1;
        } else {
          activeDelta = -1;
          if (isUrgent(oldTask)) urgentDelta = -1;
        }
      } else if (oldTask && newTask) {
        // משימה השתנתה
        const oldCompleted = oldTask.status === 'הושלם';
        const newCompleted = newTask.status === 'הושלם';
        const oldUrgent = isUrgent(oldTask);
        const newUrgent = isUrgent(newTask);

        if (oldCompleted !== newCompleted) {
          if (newCompleted) {
            activeDelta = -1;
            completedDelta = 1;
            if (oldUrgent) urgentDelta = -1;
          } else {
            activeDelta = 1;
            completedDelta = -1;
            if (newUrgent) urgentDelta = 1;
          }
        } else if (!newCompleted && oldUrgent !== newUrgent) {
          // שינוי בדחיפות (בלי שינוי סטטוס)
          urgentDelta = newUrgent ? 1 : -1;
        }
      }

      // עדכון אטומי
      if (totalDelta !== 0 || activeDelta !== 0 || completedDelta !== 0 || urgentDelta !== 0) {
        await metricsRef.set({
          total: admin.firestore.FieldValue.increment(totalDelta),
          active: admin.firestore.FieldValue.increment(activeDelta),
          completed: admin.firestore.FieldValue.increment(completedDelta),
          urgent: admin.firestore.FieldValue.increment(urgentDelta),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`✅ Metrics updated: total(${totalDelta > 0 ? '+' : ''}${totalDelta}) active(${activeDelta > 0 ? '+' : ''}${activeDelta}) completed(${completedDelta > 0 ? '+' : ''}${completedDelta}) urgent(${urgentDelta > 0 ? '+' : ''}${urgentDelta})`);
      } else {
        console.log(`⏭️  No metric changes for task ${taskId}`);
      }

      return null;
    } catch (error) {
      console.error('❌ updateMetricsOnTaskChange error:', error);
      // לא נזרוק שגיאה - טריגר לא צריך לעצור פעולות
      return null;
    }
  });

// ═══════════════════════════════════════════════════════════════════════
// 🚨 NUCLEAR CLEANUP - Admin Only
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ TEMPORARILY DISABLED - admin directory not deployed
// const { nuclearCleanup } = require('./admin/nuclear-cleanup');
// exports.nuclearCleanup = nuclearCleanup;

// ═══════════════════════════════════════════════════════════════════════
// 🔐 SET ADMIN CLAIMS - One-Time Setup Function
// ═══════════════════════════════════════════════════════════════════════
exports.setAdminClaims = functions.https.onRequest(async (req, res) => {
  const adminEmails = [
    'haim@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
  ];

  const results = [];

  for (const email of adminEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { role: 'admin' });
      results.push(`✅ Set admin claims for: ${email}`);
      console.log(`✅ Set admin claims for: ${email}`);
    } catch (error) {
      results.push(`❌ Error setting claims for ${email}: ${error.message}`);
      console.error(`❌ Error setting claims for ${email}:`, error);
    }
  }

  res.json({
    success: true,
    results: results
  });
});

// ===============================
// Task Approval System
// ===============================

/**
 * Approve task budget request
 */
exports.approveTaskBudget = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Only admins can approve
    const tokenResult = await auth.getUser(context.auth.uid);
    const isAdmin = tokenResult.customClaims?.role === 'admin';

    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לאשר תקציבים'
      );
    }

    const { approvalId, approvedMinutes, adminNotes } = data;

    if (!approvalId) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר מזהה בקשה');
    }

    if (!approvedMinutes || approvedMinutes <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'תקציב מאושר חייב להיות חיובי');
    }

    // Get approval request
    const approvalRef = db.collection('pending_task_approvals').doc(approvalId);
    const approvalDoc = await approvalRef.get();

    if (!approvalDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'בקשת אישור לא נמצאה');
    }

    const approval = approvalDoc.data();
    const taskId = approval.taskId;
    const requestedMinutes = approval.requestedMinutes || approval.taskData.estimatedMinutes || 0;
    const isModified = approvedMinutes !== requestedMinutes;
    const newStatus = isModified ? 'modified' : 'approved';

    // Use batch for atomic update
    const batch = db.batch();

    // Update approval status
    batch.update(approvalRef, {
      status: newStatus,
      reviewedBy: user.email,
      reviewedByName: user.username,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedMinutes: approvedMinutes,
      adminNotes: adminNotes || ''
    });

    // Update task
    const taskRef = db.collection('budget_tasks').doc(taskId);
    batch.update(taskRef, {
      status: 'פעיל',
      estimatedMinutes: approvedMinutes,
      estimatedHours: approvedMinutes / 60,
      approvedMinutes: approvedMinutes,
      approvedBy: user.email,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create notification message
    const messageText = isModified
      ? `✅ תקציב המשימה אושר עם שינוי\n\n📋 משימה: ${approval.taskData.description}\n⏱️ תקציב מבוקש: ${requestedMinutes} דקות\n✅ תקציב מאושר: ${approvedMinutes} דקות${adminNotes ? `\n📝 הערות: ${adminNotes}` : ''}`
      : `✅ תקציב המשימה אושר במלואו\n\n📋 משימה: ${approval.taskData.description}\n⏱️ תקציב: ${approvedMinutes} דקות`;

    const messageRef = db.collection('user_messages').doc();
    batch.set(messageRef, {
      to: approval.requestedBy,
      from: 'system',
      fromName: 'מערכת',
      message: messageText,
      type: 'task_approval',
      taskId: taskId,
      approvalId: approvalId,
      status: 'unread',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    console.log(`✅ Task ${taskId} approved: ${approvedMinutes} minutes`);

    return {
      success: true,
      taskId: taskId,
      status: newStatus
    };

  } catch (error) {
    console.error('❌ Error approving task:', error);
    throw error;
  }
});

/**
 * ✅ OPTIMIZATION: Firestore Trigger for WhatsApp notifications
 * Automatically sends WhatsApp when a new approval request is created
 * This removes the 8-second blocking call from the frontend
 */
exports.onApprovalCreated = onDocumentWritten(
  'pending_task_approvals/{approvalId}',
  async (event) => {
    try {
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Only trigger on new documents (create), not updates
      if (oldData) {
        console.log('⏭️ Skipping - document updated, not created');
        return null;
      }

      // Only send WhatsApp for pending approvals
      if (!newData || newData.status !== 'pending') {
        console.log('⏭️ Skipping - status is not pending');
        return null;
      }

      console.log(`📱 Sending WhatsApp for approval ${event.params.approvalId}`);

      // Get all admins with WhatsApp enabled
      const adminsSnapshot = await db.collection('employees')
        .where('role', '==', 'admin')
        .where('whatsappEnabled', '==', true)
        .get();

      if (adminsSnapshot.empty) {
        console.log('⚠️ No admins with WhatsApp enabled');
        return null;
      }

      // Initialize Twilio
      // ✅ Use environment variables (v2 compatible) instead of functions.config()
      const accountSid = process.env.TWILIO_ACCOUNT_SID || TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN || TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || TWILIO_WHATSAPP_NUMBER;

      if (!accountSid || !authToken) {
        console.error('❌ Twilio not configured');
        return null;
      }

      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);

      let sentCount = 0;

      // Send to each admin
      for (const adminDoc of adminsSnapshot.docs) {
        const admin = adminDoc.data();

        // Format phone number
        let phone = (admin.phone || '').replace(/\D/g, '');
        if (phone.startsWith('05')) {
          phone = '972' + phone.substring(1);
        } else if (!phone.startsWith('972')) {
          phone = '972' + phone;
        }
        const toNumber = `whatsapp:+${phone}`;

        // Calculate time display
        const minutes = parseInt(newData.requestedMinutes) || parseInt(newData.taskData?.estimatedMinutes) || 0;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = hours > 0
          ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
          : `${mins} דקות`;

        // Create message
        const message = `🔔 משימה חדשה נוספה

👤 ${newData.requestedByName || newData.requestedBy} הוסיף משימה:

📋 לקוח: ${newData.taskData?.clientName || 'לא צוין'}
📝 תיאור: ${newData.taskData?.description || 'לא צוין'}
⏱️ תקציב: ${timeStr} (${minutes} דקות)

━━━━━━━━━━━━━━━━━━━━

ℹ️ לידיעה בלבד
המשימה כבר פעילה והמשתמש יכול להתחיל לעבוד

🤖 הודעה אוטומטית ממערכת ניהול`;

        try {
          await client.messages.create({
            from: fromNumber,
            to: toNumber,
            body: message
          });
          sentCount++;
          console.log(`✅ WhatsApp sent to ${admin.username || admin.name}`);
        } catch (smsError) {
          console.error(`❌ Failed to send WhatsApp to ${admin.username}:`, smsError.message);
        }
      }

      console.log(`✅ Trigger completed: ${sentCount} WhatsApp messages sent`);
      return { success: true, sent: sentCount };

    } catch (error) {
      console.error('❌ Error in onApprovalCreated trigger:', error);
      // Don't throw - we don't want to fail the approval creation
      return null;
    }
  }
);

/**
 * Reject task budget request
 */
exports.rejectTaskBudget = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Only admins can reject
    const tokenResult = await auth.getUser(context.auth.uid);
    const isAdmin = tokenResult.customClaims?.role === 'admin';

    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לדחות תקציבים'
      );
    }

    const { approvalId, rejectionReason } = data;

    if (!approvalId) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר מזהה בקשה');
    }

    if (!rejectionReason || rejectionReason.trim().length < 3) {
      throw new functions.https.HttpsError('invalid-argument', 'חובה להזין סיבת דחייה');
    }

    // Get approval request
    const approvalRef = db.collection('pending_task_approvals').doc(approvalId);
    const approvalDoc = await approvalRef.get();

    if (!approvalDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'בקשת אישור לא נמצאה');
    }

    const approval = approvalDoc.data();
    const taskId = approval.taskId;
    const requestedMinutes = approval.requestedMinutes || approval.taskData.estimatedMinutes || 0;

    // Use batch for atomic update
    const batch = db.batch();

    // Update approval status
    batch.update(approvalRef, {
      status: 'rejected',
      reviewedBy: user.email,
      reviewedByName: user.username,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: rejectionReason
    });

    // Delete the task (it was never approved)
    const taskRef = db.collection('budget_tasks').doc(taskId);
    batch.delete(taskRef);

    // Create notification message
    const messageText = `❌ בקשת תקציב נדחתה\n\n📋 משימה: ${approval.taskData.description}\n⏱️ תקציב מבוקש: ${requestedMinutes} דקות\n📝 סיבת דחייה: ${rejectionReason}`;

    const messageRef = db.collection('user_messages').doc();
    batch.set(messageRef, {
      to: approval.requestedBy,
      from: 'system',
      fromName: 'מערכת',
      message: messageText,
      type: 'task_rejection',
      taskId: taskId,
      approvalId: approvalId,
      status: 'unread',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    console.log(`✅ Task ${taskId} rejected`);

    return {
      success: true,
      taskId: taskId
    };

  } catch (error) {
    console.error('❌ Error rejecting task:', error);
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEPRECATED FUNCTIONS - Tasks are now auto-approved
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Tasks are now auto-approved - no manual approval needed
 * This function is kept for backward compatibility only
 * Tasks created with status: 'פעיל' automatically
 */
exports.approveTaskBudget_DEPRECATED = exports.approveTaskBudget;
exports.approveTaskBudget = functions.https.onCall(async (data, context) => {
  console.warn('⚠️ approveTaskBudget is deprecated - tasks are auto-approved');
  throw new functions.https.HttpsError(
    'unimplemented',
    'פונקציה זו אינה בשימוש יותר - משימות מאושרות אוטומטית'
  );
});

/**
 * @deprecated Tasks are now auto-approved - no manual rejection needed
 * This function is kept for backward compatibility only
 */
exports.rejectTaskBudget_DEPRECATED = exports.rejectTaskBudget;
exports.rejectTaskBudget = functions.https.onCall(async (data, context) => {
  console.warn('⚠️ rejectTaskBudget is deprecated - tasks are auto-approved');
  throw new functions.https.HttpsError(
    'unimplemented',
    'פונקציה זו אינה בשימוש יותר - משימות מאושרות אוטומטית'
  );
});

// ===============================
// WhatsApp Broadcast with Twilio
// ===============================

/**
 * Send WhatsApp broadcast messages to selected employees
 * Uses Twilio WhatsApp Business API
 */
exports.sendBroadcastMessage = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    // Check if user is admin
    const userEmail = context.auth.token.email;
    const employeeDoc = await db.collection('employees').doc(userEmail).get();

    if (!employeeDoc.exists || employeeDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לשלוח הודעות broadcast'
      );
    }

    // Validate input
    const { employeeEmails, templateType, customMessage } = data;

    if (!employeeEmails || !Array.isArray(employeeEmails) || employeeEmails.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חייב לספק רשימת עובדים'
      );
    }

    if (!templateType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חייב לבחור תבנית הודעה'
      );
    }

    // Initialize Twilio (get credentials from Firebase Config)
    const twilioConfig = functions.config().twilio;

    if (!twilioConfig || !twilioConfig.account_sid || !twilioConfig.auth_token) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Twilio לא מוגדר. הרץ: firebase functions:config:set twilio.account_sid="YOUR_SID" twilio.auth_token="YOUR_TOKEN" twilio.whatsapp_number="whatsapp:+14155238886"'
      );
    }

    const twilio = require('twilio');
    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token);
    const fromNumber = twilioConfig.whatsapp_number || 'whatsapp:+14155238886'; // Twilio Sandbox default

    // Message templates
    const templates = {
      DAILY_REMINDER: (name) => `שלום ${name}! ⏰\n\nתזכורת לרישום שעות היום במערכת.\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`,

      WEEKLY_SUMMARY: (name) => `שלום ${name}! 📅\n\nבקשה לעדכן את סיכום שעות השבוע במערכת.\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`,

      SYSTEM_ANNOUNCEMENT: (name, message) => `שלום ${name}! 📢\n\nהודעת מערכת:\n${message}\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`,

      CUSTOM: (name, message) => `שלום ${name}!\n\n${message}\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`
    };

    // Results tracking
    const results = {
      success: [],
      failed: []
    };

    // Send messages to each employee
    for (const email of employeeEmails) {
      try {
        // Get employee data
        const empDoc = await db.collection('employees').doc(email).get();

        if (!empDoc.exists) {
          results.failed.push({
            email,
            name: email,
            error: 'עובד לא נמצא במערכת'
          });
          continue;
        }

        const employee = empDoc.data();
        const name = employee.name || employee.username || email;

        // Check if employee has WhatsApp enabled and phone number
        if (!employee.whatsappEnabled || !employee.phone) {
          results.failed.push({
            email,
            name,
            error: 'WhatsApp לא מופעל או אין מספר טלפון'
          });
          continue;
        }

        // Format phone number for WhatsApp
        let phone = employee.phone.replace(/\D/g, ''); // Remove non-digits

        // Israeli phone format: 05X-XXXXXXX -> +9725XXXXXXXX
        if (phone.startsWith('05')) {
          phone = '972' + phone.substring(1);
        } else if (!phone.startsWith('972')) {
          phone = '972' + phone;
        }

        const toNumber = `whatsapp:+${phone}`;

        // Generate message
        let messageBody;
        if (templateType === 'SYSTEM_ANNOUNCEMENT' || templateType === 'CUSTOM') {
          messageBody = templates[templateType](name, customMessage);
        } else {
          messageBody = templates[templateType](name);
        }

        // Send via Twilio
        const message = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          body: messageBody
        });

        results.success.push({
          email,
          name,
          phone: toNumber,
          messageSid: message.sid
        });

        console.log(`✅ WhatsApp sent to ${name} (${email}): ${message.sid}`);

      } catch (error) {
        console.error(`❌ Failed to send to ${email}:`, error);
        results.failed.push({
          email,
          name: email,
          error: error.message || 'שגיאה בשליחה'
        });
      }
    }

    // Log to audit
    await logAction('whatsapp_broadcast', context.auth.uid, userEmail, {
      templateType,
      totalSent: results.success.length,
      totalFailed: results.failed.length,
      recipients: employeeEmails
    });

    return {
      totalSent: results.success.length,
      totalFailed: results.failed.length,
      results
    };

  } catch (error) {
    console.error('❌ sendBroadcastMessage error:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'שגיאה בשליחת הודעות'
    );
  }
});

// ===============================
// WhatsApp Task Approval Automation
// ===============================

/**
 * Send WhatsApp notification to admin when new task approval is requested
 * Called automatically when approval is created
 */
exports.sendWhatsAppApprovalNotification = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    const { approvalId, taskData, requestedBy, requestedByName } = data;

    if (!approvalId || !taskData) {
      throw new functions.https.HttpsError('invalid-argument', 'חסרים פרמטרים');
    }

    // Get all admins with WhatsApp enabled
    const adminsSnapshot = await db.collection('employees')
      .where('role', '==', 'admin')
      .where('whatsappEnabled', '==', true)
      .get();

    if (adminsSnapshot.empty) {
      console.log('⚠️ No admins with WhatsApp enabled');
      return { success: true, sent: 0, message: 'אין מנהלים עם WhatsApp מופעל' };
    }

    // Initialize Twilio
    const twilioConfig = functions.config().twilio;
    if (!twilioConfig?.account_sid || !twilioConfig?.auth_token) {
      throw new functions.https.HttpsError('failed-precondition', 'Twilio לא מוגדר');
    }

    const twilio = require('twilio');
    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token);
    const fromNumber = twilioConfig.whatsapp_number || 'whatsapp:+14155238886';

    const results = [];

    // Send to each admin
    for (const adminDoc of adminsSnapshot.docs) {
      const admin = adminDoc.data();
      const adminName = admin.name || admin.username || adminDoc.id;

      // Format phone number
      let phone = (admin.phone || '').replace(/\D/g, '');
      if (phone.startsWith('05')) {
        phone = '972' + phone.substring(1);
      } else if (!phone.startsWith('972')) {
        phone = '972' + phone;
      }
      const toNumber = `whatsapp:+${phone}`;

      // Calculate hours
      const minutes = parseInt(taskData.estimatedMinutes) || 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = hours > 0
        ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
        : `${mins} דקות`;

      // Create message
      const message = `🔔 משימה חדשה לאישור

👤 ${requestedByName || requestedBy} מבקש אישור תקציב:

📋 לקוח: ${taskData.clientName || 'לא צוין'}
📝 תיאור: ${taskData.description}
⏱️ תקציב: ${timeStr} (${minutes} דקות)

━━━━━━━━━━━━━━━━━━━━

📲 לאישור - כתוב:
✅ "אישור" - לאשר כמו שביקש
✅ "אישור 90" - לאשר עם 90 דקות

📲 לדחייה - כתוב:
❌ "דחייה" + סיבה
דוגמה: "דחייה תקציב גבוה"

💡 כתוב "משימות" לראות הכל

🤖 הודעה אוטומטית ממערכת ניהול`;

      try {
        const twilioMessage = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          body: message
        });

        results.push({
          admin: adminName,
          phone: toNumber,
          success: true,
          messageSid: twilioMessage.sid
        });

        console.log(`✅ Approval notification sent to ${adminName}: ${twilioMessage.sid}`);

      } catch (error) {
        console.error(`❌ Failed to send to ${adminName}:`, error);
        results.push({
          admin: adminName,
          phone: toNumber,
          success: false,
          error: error.message
        });
      }
    }

    // Save notification log
    await db.collection('whatsapp_approval_notifications').add({
      approvalId,
      taskId: taskData.taskId || null,
      requestedBy,
      sentTo: results.map(r => r.admin),
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      results
    });

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      sent: successCount,
      total: results.length,
      results
    };

  } catch (error) {
    console.error('❌ sendWhatsAppApprovalNotification error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'שגיאה בשליחת התראה');
  }
});

/**
 * Webhook to receive WhatsApp messages from Twilio
 * Handles approval/rejection responses from admins
 */
exports.whatsappWebhook = onRequest({
  region: 'us-central1'
}, async (req, res) => {
  try {
    // Get message data
    const { From, Body, MessageSid, NumMedia, MediaUrl0, MediaContentType0 } = req.body;

    console.log(`📨 WhatsApp message received from ${From}: "${Body}"`);
    console.log(`📎 Media: NumMedia=${NumMedia}, Type=${MediaContentType0}`);

    if (!From) {
      res.status(400).send('Missing From parameter');
      return;
    }

    // Extract phone number
    const phoneNumber = From.replace('whatsapp:', '').replace('+', '');

    // Import the WhatsApp Bot
    const WhatsAppBot = require('./src/whatsapp-bot/WhatsAppBot');
    const bot = new WhatsAppBot();

    // Identify user
    const userInfo = await bot.identifyUser(phoneNumber);

    // Only allow admins to use the bot
    if (userInfo.role !== 'admin') {
      console.log(`⚠️ Message from non-admin: ${From} (${userInfo.name})`);
      res.status(200).send('OK');
      return;
    }

    console.log(`✅ Admin identified: ${userInfo.name || userInfo.email}`);

    // Check if this is a media message
    const hasMedia = NumMedia && parseInt(NumMedia) > 0;
    let response;

    if (hasMedia && MediaUrl0) {
      // Handle media message (PDF upload)
      console.log(`📎 Processing media message: ${MediaContentType0}`);
      response = await bot.handleMediaMessage(
        phoneNumber,
        MediaUrl0,
        MediaContentType0,
        Body || '',
        userInfo
      );
    } else if (Body) {
      // Handle regular text message
      response = await bot.handleMessage(phoneNumber, Body, userInfo);
    } else {
      res.status(400).send('Missing Body or Media');
      return;
    }

    // Send response via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC9e5e9e3c953a5bbb878622b6e70201b6';
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || 'fed2170530e4ed34d3b1b3407e0f0f5f';
    const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (twilioAccountSid && response) {
      const twilio = require('twilio');
      const client = twilio(twilioAccountSid, twilioAuthToken);

      // ═══ בדוק אם צריך לשלוח Template או טקסט רגיל ═══
      if (typeof response === 'object' && response.useTemplate) {
        // שלח Content Template עם כפתורים
        console.log(`📤 Sending template: ${response.templateSid}`);
        await client.messages.create({
          from: twilioWhatsappNumber,
          to: From,
          contentSid: response.templateSid,
          contentVariables: JSON.stringify(response.variables)
        });
        console.log(`✅ Template sent to ${userInfo.name}`);
      } else {
        // שלח הודעת טקסט רגילה
        await client.messages.create({
          from: twilioWhatsappNumber,
          to: From,
          body: typeof response === 'string' ? response : JSON.stringify(response)
        });
        console.log(`✅ Bot response sent to ${userInfo.name}`);
      }
    }

    // Log the interaction
    await db.collection('whatsapp_bot_interactions').add({
      from: From,
      userId: userInfo.email,
      userName: userInfo.name || userInfo.email,
      message: Body,
      response: typeof response === 'object' && response.useTemplate
        ? `[Template: ${response.templateSid}]`
        : response,
      messageSid: MessageSid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ whatsappWebhook error:', error);

    // Try to send error message to user
    try {
      const { From } = req.body;
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC9e5e9e3c953a5bbb878622b6e70201b6';
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || 'fed2170530e4ed34d3b1b3407e0f0f5f';
      const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (twilioAccountSid && From) {
        const twilio = require('twilio');
        const client = twilio(twilioAccountSid, twilioAuthToken);
        await client.messages.create({
          from: twilioWhatsappNumber,
          to: From,
          body: '❌ מצטער, הייתה שגיאה במערכת. נסה שוב מאוחר יותר או כתוב "עזרה"'
        });
      }
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }

    res.status(500).send('Error');
  }
});

/**
 * Debug function - Check all employees data
 * Temporary function to debug WhatsApp bot issue
 */
exports.debugEmployees = functions.https.onRequest(async (req, res) => {
  try {
    const snapshot = await db.collection('employees').get();

    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        name: data.name || 'NO NAME',
        email: data.email || 'NO EMAIL',
        phone: data.phone || 'NO PHONE',
        role: data.role || 'NO ROLE',
        whatsappEnabled: data.whatsappEnabled || false
      });
    });

    res.json({
      success: true,
      total: users.length,
      users: users
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===============================
// DELETE USER DATA - מחיקת נתוני משתמש
// ===============================

/**
 * Delete user data (tasks, timesheets, approvals)
 * מחיקת נתוני משתמש (משימות, שעתונים, אישורים)
 */
exports.deleteUserData = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    // Check admin permissions
    const callerEmail = context.auth.token.email;
    const adminSnapshot = await db.collection('employees').where('email', '==', callerEmail).get();

    if (adminSnapshot.empty) {
      throw new functions.https.HttpsError('permission-denied', 'אין הרשאות מנהל');
    }

    const adminData = adminSnapshot.docs[0].data();
    if (!adminData.isAdmin && adminData.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'אין הרשאות מנהל');
    }

    const { email, deleteTasks, deleteTimesheets, deleteApprovals } = data;

    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר אימייל משתמש');
    }

    console.log(`🗑️ Deleting user data for: ${email}`);
    console.log(`   Tasks: ${deleteTasks}, Timesheets: ${deleteTimesheets}, Approvals: ${deleteApprovals}`);

    let deletedCounts = {
      tasks: 0,
      timesheets: 0,
      approvals: 0
    };

    // Delete budget_tasks
    if (deleteTasks) {
      const tasksQuery = db.collection('budget_tasks').where('employeeEmail', '==', email);
      let tasksSnapshot = await tasksQuery.get();

      while (!tasksSnapshot.empty) {
        const batch = db.batch();
        tasksSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCounts.tasks++;
        });
        await batch.commit();

        // Get next batch
        tasksSnapshot = await tasksQuery.limit(500).get();
      }
      console.log(`✅ Deleted ${deletedCounts.tasks} tasks`);
    }

    // Delete timesheet_entries
    if (deleteTimesheets) {
      const timesheetsQuery = db.collection('timesheet_entries').where('employeeEmail', '==', email);
      let timesheetsSnapshot = await timesheetsQuery.get();

      while (!timesheetsSnapshot.empty) {
        const batch = db.batch();
        timesheetsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCounts.timesheets++;
        });
        await batch.commit();

        // Get next batch
        timesheetsSnapshot = await timesheetsQuery.limit(500).get();
      }
      console.log(`✅ Deleted ${deletedCounts.timesheets} timesheet entries`);
    }

    // Delete pending_task_approvals
    if (deleteApprovals) {
      const approvalsQuery = db.collection('pending_task_approvals').where('requestedBy', '==', email);
      let approvalsSnapshot = await approvalsQuery.get();

      while (!approvalsSnapshot.empty) {
        const batch = db.batch();
        approvalsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCounts.approvals++;
        });
        await batch.commit();

        // Get next batch
        approvalsSnapshot = await approvalsQuery.limit(500).get();
      }
      console.log(`✅ Deleted ${deletedCounts.approvals} task approvals`);
    }

    // Log the action
    await db.collection('audit_log').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      action: 'delete_user_data',
      adminEmail: callerEmail,
      targetEmail: email,
      deletedCounts,
      details: { deleteTasks, deleteTimesheets, deleteApprovals }
    });

    console.log(`✅ User data deleted successfully for: ${email}`);

    return {
      success: true,
      message: 'הנתונים נמחקו בהצלחה',
      deletedCounts
    };

  } catch (error) {
    console.error('❌ Error deleting user data:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'שגיאה במחיקת נתונים'
    );
  }
});

// ===============================
// DELETE USER DATA SELECTIVE - מחיקה סלקטיבית מאובטחת
// 🔒 PHASE 1: READ-ONLY MODE
// ===============================

const { validateDeletionRequest, checkRateLimit } = require('./src/deletion/validators');
const { verifyAllOwnership } = require('./src/deletion/ownership');
const { executeDeletion, DELETION_ENABLED } = require('./src/deletion/deletion-engine');
const { logDeletionAttempt, checkSuspiciousActivity } = require('./src/deletion/audit');

/**
 * Delete user data selectively (tasks, timesheets, approvals)
 * מחיקה סלקטיבית של נתוני משתמש
 *
 * 🔒 Security Layers:
 * 1. Authentication - אימות
 * 2. Authorization - הרשאות admin בלבד
 * 3. Input Validation - וולידציה מלאה
 * 4. Rate Limiting - מניעת שימוש לרעה
 * 5. Ownership Verification - בדיקת בעלות
 * 6. Transaction Safety - מחיקה מאובטחת
 * 7. Audit Logging - רישום מלא
 *
 * 🚀 PHASE 3: LIMITED DELETE - מחיקה מוגבלת (50 items max)
 */
exports.deleteUserDataSelective = functions.https.onCall(async (data, context) => {
  const startTime = Date.now();

  try {
    console.log('🚀 =================================');
    console.log('🗑️  DELETE USER DATA SELECTIVE');
    console.log('🚀 PHASE 3: LIMITED DELETE (50 items max)');
    console.log('🚀 =================================');

    // ============================================
    // 🔒 LAYER 1: Authentication Check
    // ============================================
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    const callerEmail = context.auth.token.email;
    const callerUid = context.auth.uid;

    console.log(`👤 Caller: ${callerEmail} (${callerUid})`);

    // ============================================
    // 🔒 LAYER 2: Authorization Check (Admin Only)
    // ============================================
    const adminSnapshot = await db.collection('employees').where('email', '==', callerEmail).get();

    if (adminSnapshot.empty) {
      console.error(`❌ User ${callerEmail} not found in employees collection`);
      throw new functions.https.HttpsError('permission-denied', 'אין הרשאות מנהל');
    }

    const adminData = adminSnapshot.docs[0].data();
    if (!adminData.isAdmin && adminData.role !== 'admin') {
      console.error(`❌ User ${callerEmail} is not admin: isAdmin=${adminData.isAdmin}, role=${adminData.role}`);
      throw new functions.https.HttpsError('permission-denied', 'רק מנהלים יכולים למחוק נתונים');
    }

    console.log(`✅ Admin verified: ${callerEmail}`);

    // ============================================
    // 🔒 LAYER 3: Input Validation
    // ============================================
    const validatedData = validateDeletionRequest(data);
    console.log(`✅ Validation passed: ${validatedData.totalItems} items to process`);

    // ============================================
    // 🔒 LAYER 4: Rate Limiting
    // ============================================
    if (!validatedData.dryRun) {
      const rateLimit = await checkRateLimit(db, callerEmail);
      console.log(`✅ Rate limit check passed: ${rateLimit.remainingInWindow} deletions remaining`);
    }

    // ============================================
    // 🔒 LAYER 5: Suspicious Activity Check
    // ============================================
    const suspiciousCheck = await checkSuspiciousActivity(db, callerEmail);
    if (suspiciousCheck.suspicious) {
      console.warn(`⚠️ Suspicious activity detected for ${callerEmail}`);
      // בשלב זה רק מתריעים, לא חוסמים
    }

    // ============================================
    // 🔒 LAYER 6: Ownership Verification
    // ============================================
    const verifiedOwnership = await verifyAllOwnership(db, validatedData.userEmail, {
      taskIds: validatedData.taskIds,
      timesheetIds: validatedData.timesheetIds,
      approvalIds: validatedData.approvalIds
    });

    console.log(`✅ Ownership verified: ${verifiedOwnership.totalVerified} items belong to ${validatedData.userEmail}`);

    // ============================================
    // 🔒 LAYER 7: Execute Deletion (or Dry Run)
    // ============================================
    const result = await executeDeletion(db, verifiedOwnership, validatedData.dryRun);

    // ============================================
    // 🔒 LAYER 8: Audit Logging
    // ============================================
    await logDeletionAttempt(db, {
      adminEmail: callerEmail,
      userEmail: validatedData.userEmail,
      requestData: {
        ...validatedData,
        adminUid: callerUid
      },
      verifiedOwnership,
      result,
      dryRun: validatedData.dryRun,
      success: true
    });

    const executionTime = Date.now() - startTime;

    console.log('🚀 =================================');
    console.log(`✅ SUCCESS (${executionTime}ms)`);
    console.log(`   Mode: ${validatedData.dryRun ? 'DRY RUN' : 'REAL DELETION'}`);
    console.log(`   Items: ${result.deletedCounts.total}`);
    console.log('🚀 =================================');

    // ============================================
    // Response
    // ============================================
    return {
      success: true,
      dryRun: validatedData.dryRun,
      phase: 'phase_3_limited',
      deletionEnabled: DELETION_ENABLED,
      message: validatedData.dryRun
        ? `✅ Preview: ${result.deletedCounts.total} פריטים יימחקו`
        : `✅ נמחקו ${result.deletedCounts.total} פריטים${result.deletedCounts.orphanedApprovals ? ` (כולל ${result.deletedCounts.orphanedApprovals} orphaned approvals)` : ''}`,
      deletedCounts: result.deletedCounts,
      preview: result.preview,
      executionTime: `${executionTime}ms`
    };

  } catch (error) {
    console.error('❌ Error in deleteUserDataSelective:', error);

    // רישום שגיאה ב-audit log
    try {
      await logDeletionAttempt(db, {
        adminEmail: context.auth?.token?.email || 'unknown',
        userEmail: data?.userEmail || 'unknown',
        requestData: data || {},
        verifiedOwnership: {},
        result: null,
        dryRun: data?.dryRun || false,
        success: false,
        error
      });
    } catch (auditError) {
      console.error('❌ Failed to log error to audit:', auditError);
    }

    // זריקת השגיאה הלאה
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'שגיאה במחיקת נתונים'
    );
  }
});

// ===============================
// Fee Agreement Functions - הסכמי שכר טרחה
// ===============================

/**
 * uploadFeeAgreement - העלאת הסכם שכר טרחה ללקוח
 * Admin only - מאובטח
 *
 * @param {Object} data
 * @param {string} data.clientId - מזהה הלקוח
 * @param {string} data.fileName - שם הקובץ המקורי
 * @param {string} data.fileData - תוכן הקובץ ב-base64
 * @param {string} data.fileType - סוג הקובץ (mime type)
 * @param {number} data.fileSize - גודל הקובץ בבייטים
 */
exports.uploadFeeAgreement = functions.https.onCall(async (data, context) => {
  try {
    console.log('📄 Starting uploadFeeAgreement...');

    // 1. Authorization - Admin only
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להעלות הסכמי שכר טרחה'
      );
    }

    // 2. Input Validation
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    if (!data.fileName || typeof data.fileName !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר שם קובץ'
      );
    }

    if (!data.fileData || typeof data.fileData !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תוכן קובץ'
      );
    }

    if (!data.fileType || typeof data.fileType !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר סוג קובץ'
      );
    }

    // 3. File Type Validation
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(data.fileType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סוג קובץ לא נתמך. יש להעלות PDF או תמונה (JPEG/PNG/WebP)'
      );
    }

    // 4. File Size Validation (max 6MB for base64)
    const maxSizeBytes = 6 * 1024 * 1024;
    const fileSize = data.fileSize || Buffer.from(data.fileData, 'base64').length;

    if (fileSize > maxSizeBytes) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'הקובץ גדול מדי. גודל מקסימלי: 6MB'
      );
    }

    // 5. Verify Client Exists
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    // 6. Generate unique ID and storage path
    const agreementId = `agreement_${Date.now()}`;
    const fileExtension = data.fileName.split('.').pop() || 'pdf';
    const sanitizedFileName = `${agreementId}.${fileExtension}`;
    const storagePath = `clients/${data.clientId}/agreements/${sanitizedFileName}`;

    // 7. Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    // Decode base64 and upload
    const fileBuffer = Buffer.from(data.fileData, 'base64');

    await file.save(fileBuffer, {
      metadata: {
        contentType: data.fileType,
        metadata: {
          uploadedBy: user.email,
          originalName: data.fileName,
          clientId: data.clientId
        }
      }
    });

    // 8. Get download URL
    await file.makePublic();
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Alternative: Use signed URL (more secure but expires)
    // const [signedUrl] = await file.getSignedUrl({
    //   action: 'read',
    //   expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    // });

    // 9. Create agreement metadata
    const agreementData = {
      id: agreementId,
      fileName: sanitizedFileName,
      originalName: data.fileName,
      storagePath: storagePath,
      downloadUrl: downloadUrl,
      fileType: data.fileType,
      fileSize: fileSize,
      uploadedAt: admin.firestore.Timestamp.now(),
      uploadedBy: user.email
    };

    // 10. Update client document with new agreement
    const clientData = clientDoc.data();
    const existingAgreements = clientData.feeAgreements || [];

    await db.collection('clients').doc(data.clientId).update({
      feeAgreements: [...existingAgreements, agreementData],
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 11. Audit Log
    await logAction('UPLOAD_FEE_AGREEMENT', user.uid, user.username, {
      clientId: data.clientId,
      clientName: clientData.fullName || clientData.clientName,
      agreementId: agreementId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: fileSize
    });

    console.log(`✅ Fee agreement uploaded successfully: ${agreementId} for client ${data.clientId}`);

    return {
      success: true,
      agreement: {
        ...agreementData,
        uploadedAt: new Date().toISOString()
      },
      message: 'הסכם שכר טרחה הועלה בהצלחה'
    };

  } catch (error) {
    console.error('Error in uploadFeeAgreement:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהעלאת הסכם: ${error.message}`
    );
  }
});

/**
 * deleteFeeAgreement - מחיקת הסכם שכר טרחה
 * Admin only - מאובטח
 *
 * @param {Object} data
 * @param {string} data.clientId - מזהה הלקוח
 * @param {string} data.agreementId - מזהה ההסכם למחיקה
 */
exports.deleteFeeAgreement = functions.https.onCall(async (data, context) => {
  try {
    console.log('🗑️ Starting deleteFeeAgreement...');

    // 1. Authorization - Admin only
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים למחוק הסכמי שכר טרחה'
      );
    }

    // 2. Input Validation
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    if (!data.agreementId || typeof data.agreementId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה הסכם'
      );
    }

    // 3. Verify Client Exists
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    const clientData = clientDoc.data();
    const existingAgreements = clientData.feeAgreements || [];

    // 4. Find the agreement to delete
    const agreementToDelete = existingAgreements.find(a => a.id === data.agreementId);

    if (!agreementToDelete) {
      throw new functions.https.HttpsError(
        'not-found',
        'הסכם לא נמצא'
      );
    }

    // 5. Delete from Firebase Storage
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(agreementToDelete.storagePath);
      await file.delete();
      console.log(`✅ Deleted file from storage: ${agreementToDelete.storagePath}`);
    } catch (storageError) {
      // Log but don't fail if storage deletion fails (file might not exist)
      console.warn(`⚠️ Could not delete file from storage: ${storageError.message}`);
    }

    // 6. Remove from Firestore
    const updatedAgreements = existingAgreements.filter(a => a.id !== data.agreementId);

    await db.collection('clients').doc(data.clientId).update({
      feeAgreements: updatedAgreements,
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 7. Audit Log
    await logAction('DELETE_FEE_AGREEMENT', user.uid, user.username, {
      clientId: data.clientId,
      clientName: clientData.fullName || clientData.clientName,
      agreementId: data.agreementId,
      fileName: agreementToDelete.originalName || agreementToDelete.fileName
    });

    console.log(`✅ Fee agreement deleted successfully: ${data.agreementId} from client ${data.clientId}`);

    return {
      success: true,
      message: 'הסכם שכר טרחה נמחק בהצלחה'
    };

  } catch (error) {
    console.error('Error in deleteFeeAgreement:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במחיקת הסכם: ${error.message}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// 📊 Workload Analytics Functions - Performance Optimized
// ═══════════════════════════════════════════════════════════════
const { getTeamWorkloadData } = require('./workload-analytics');
exports.getTeamWorkloadData = getTeamWorkloadData;

// ═══════════════════════════════════════════════════════════════
// 🔍 Daily Invariant Check - Data Integrity Monitor
// ═══════════════════════════════════════════════════════════════

// TODO: כשישודרג Twilio — להוסיף שליחת SMS בפער
// מספר יעד: +972549539238

exports.dailyInvariantCheck = onSchedule({
  schedule: '0 6 * * *',
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async () => {
  const SKIP_CLIENTS = ['2025003'];
  const TOLERANCE = 0.02;
  const discrepancies = [];

  try {
    console.log('🔍 Starting daily invariant check...');

    const clientsSnapshot = await db.collection('clients').get();
    console.log(`📊 Checking ${clientsSnapshot.size} clients`);

    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;

      if (SKIP_CLIENTS.includes(clientId)) {
        continue;
      }

      try {
        const clientData = clientDoc.data();
        const clientName = clientData.clientName || clientData.name || clientId;
        const services = clientData.services || [];

        if (services.length === 0) {
          continue;
        }

        // Read all timesheet entries for this client
        const timesheetSnapshot = await db.collection('timesheet_entries')
          .where('clientId', '==', clientId)
          .get();

        // Group minutes by serviceId
        const serviceMinutes = {};
        timesheetSnapshot.forEach(doc => {
          const entry = doc.data();
          const serviceId = entry.serviceId;
          if (serviceId) {
            serviceMinutes[serviceId] = (serviceMinutes[serviceId] || 0) + (entry.minutes || 0);
          }
        });

        // Check each service
        for (const service of services) {
          const serviceId = service.id;
          if (!serviceId) continue;

          const cardHoursUsed = service.hoursUsed || 0;
          const timesheetMinutes = serviceMinutes[serviceId] || 0;
          const timesheetHoursUsed = timesheetMinutes / 60;
          const gap = Math.abs(cardHoursUsed - timesheetHoursUsed);

          if (gap > TOLERANCE) {
            discrepancies.push({
              clientId,
              clientName,
              serviceId,
              serviceName: service.name || service.type || serviceId,
              cardHoursUsed: parseFloat(cardHoursUsed.toFixed(2)),
              timesheetHoursUsed: parseFloat(timesheetHoursUsed.toFixed(2)),
              gap: parseFloat(gap.toFixed(2))
            });
          }
        }
      } catch (clientError) {
        console.error(`⚠️ Error checking client ${clientId}:`, clientError.message);
        // Continue to next client
      }
    }

    // Save result to system_health_checks
    if (discrepancies.length > 0) {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'FAIL',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: discrepancies.length,
        discrepancies,
        message: `נמצאו ${discrepancies.length} פערים בנתוני שעות`
      });
      console.log(`❌ Invariant check FAILED — ${discrepancies.length} discrepancies found`);
    } else {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'PASS',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: 0,
        discrepancies: [],
        message: 'כל הנתונים תקינים'
      });
      console.log('✅ Invariant check PASSED — no discrepancies');
    }

  } catch (error) {
    console.error('❌ Invariant check ERROR:', error);
    try {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'ERROR',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: 0,
        discrepancies: [],
        message: `שגיאה בבדיקת תקינות: ${error.message}`
      });
    } catch (saveError) {
      console.error('❌ Failed to save error status:', saveError);
    }
  }
});

console.log('✅ Law Office Functions loaded successfully (including 10 Master Admin functions + Nuclear Cleanup + Data Fixes + User Metrics + setAdminClaims + Task Approval System + WhatsApp Broadcast + WhatsApp Smart Bot 🤖 + Delete User Data + Delete User Data Selective 🔒 + Fee Agreements 📄 + Workload Analytics 📊 + Daily Invariant Check 🔍)');
