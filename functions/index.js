/**
 * Law Office Management System - Firebase Functions
 *
 * מערכת ניהול משרד עורכי דין - פונקציות שרת
 * ארכיטקטורה מאובטחת עם Validation, Authorization, ו-Audit Logging
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { addTimeToTaskWithTransaction } = require('./addTimeToTask_v2');
const { updateBudgetTask, markNotificationAsRead } = require('./task-update-realtime');
const { checkUserPermissions } = require('./shared/auth');
const { logAction } = require('./shared/audit');
const { sanitizeString, isValidIsraeliPhone, isValidEmail } = require('./shared/validators');

// ✨ NEW: Import modular deduction system
const DeductionSystem = require('./src/modules/deduction');

// ✅ NEW: Import case number transaction module
const { generateCaseNumberWithTransaction } = require('./case-number-transaction');

// אתחול Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

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
// Helper Functions - פונקציות עזר
// ===============================

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
 * סימון שירות כהושלם
 * Complete a service — mark as completed + recalculate client aggregates
 *
 * @param {Object} data
 * @param {string} data.clientId - Client document ID
 * @param {string} data.serviceId - Service ID within the client
 * @returns {Object} { success, serviceId, serviceName, serviceType, completedAt, clientAggregates, message }
 */
exports.completeService = functions.https.onCall(async (data, context) => {
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
      // 3a. Read client
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      // 3b. Find service
      const serviceIndex = services.findIndex(s => s.id === data.serviceId);
      if (serviceIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          `שירות ${data.serviceId} לא נמצא`
        );
      }

      const service = services[serviceIndex];

      // 3c. Check not already completed
      if (service.status === 'completed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'השירות כבר מסומן כהושלם'
        );
      }

      // 3d. Immutable update — service
      const now = new Date().toISOString();
      const updatedService = { ...service, status: 'completed', completedAt: now };
      const updatedServices = services.map((s, idx) => idx === serviceIndex ? updatedService : s);

      // 3e. Recalculate client-level aggregates (same logic as addPackageToService)
      const clientTotalHours = updatedServices.reduce((sum, s) => sum + (s.totalHours || 0), 0);
      const clientHoursUsed = updatedServices.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
      const clientHoursRemaining = updatedServices.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
      const clientMinutesRemaining = clientHoursRemaining * 60;
      const clientIsBlocked = (clientHoursRemaining <= 0) && (clientData.type === 'hours');
      const clientIsCritical = (!clientIsBlocked) && (clientHoursRemaining <= 5) && (clientData.type === 'hours');
      const totalServices = updatedServices.length;
      const activeServices = updatedServices.filter(s => s.status === 'active').length;

      // 3f. Write to Firestore (Transaction)
      transaction.update(clientRef, {
        services: updatedServices,
        totalServices: totalServices,
        activeServices: activeServices,
        totalHours: clientTotalHours,
        hoursUsed: clientHoursUsed,
        hoursRemaining: clientHoursRemaining,
        minutesRemaining: clientMinutesRemaining,
        isBlocked: clientIsBlocked,
        isCritical: clientIsCritical,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      // 3g. Return data from transaction
      return {
        serviceName: service.name || service.serviceName,
        serviceType: service.type || service.serviceType,
        completedAt: now,
        aggregates: {
          totalHours: clientTotalHours,
          hoursRemaining: clientHoursRemaining,
          minutesRemaining: clientMinutesRemaining,
          isBlocked: clientIsBlocked,
          isCritical: clientIsCritical,
          totalServices: totalServices,
          activeServices: activeServices
        }
      };
    });

    // 4. Audit log (outside transaction)
    await logAction('COMPLETE_SERVICE', user.uid, user.username, {
      clientId: data.clientId,
      caseNumber: data.clientId,
      serviceId: data.serviceId,
      serviceName: result.serviceName,
      serviceType: result.serviceType
    });

    // 5. Return
    console.log(`✅ Service ${data.serviceId} completed for client ${data.clientId}`);

    return {
      success: true,
      serviceId: data.serviceId,
      serviceName: result.serviceName,
      serviceType: result.serviceType,
      completedAt: result.completedAt,
      clientAggregates: result.aggregates,
      message: `השירות "${result.serviceName}" סומן כהושלם`
    };

  } catch (error) {
    console.error('Error in completeService:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בסימון שירות: ${error.message}`
    );
  }
});

/**
 * שינוי סטטוס שירות
 * @param {Object} data
 * @param {string} data.clientId - מזהה לקוח
 * @param {string} data.serviceId - מזהה שירות
 * @param {string} data.newStatus - סטטוס חדש: active | completed | on_hold | archived
 * @param {string} [data.note] - הערה אופציונלית
 */
exports.changeServiceStatus = functions.https.onCall(async (data, context) => {
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

    const VALID_STATUSES = ['active', 'completed', 'on_hold', 'archived'];
    if (!data.newStatus || !VALID_STATUSES.includes(data.newStatus)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `סטטוס לא תקין. ערכים מותרים: ${VALID_STATUSES.join(', ')}`
      );
    }

    const note = (data.note && typeof data.note === 'string')
      ? data.note.trim().substring(0, 500)
      : null;

    // 3. Transaction
    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      // 3a. Read client
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      // 3b. Find service
      const serviceIndex = services.findIndex(s => s.id === data.serviceId);
      if (serviceIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          `שירות ${data.serviceId} לא נמצא`
        );
      }

      const service = services[serviceIndex];
      const currentStatus = service.status || 'active';

      // 3c. Same status guard
      if (currentStatus === data.newStatus) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'הסטטוס כבר זהה'
        );
      }

      // 3d. Immutable update — service
      const now = new Date().toISOString();

      const historyEntry = {
        from: currentStatus,
        to: data.newStatus,
        changedAt: now,
        changedBy: user.username,
        note: note
      };

      const updatedService = {
        ...service,
        status: data.newStatus,
        statusChangedAt: now,
        statusChangedBy: user.username,
        previousStatus: currentStatus,
        statusChangeHistory: [
          ...(service.statusChangeHistory || []),
          historyEntry
        ]
      };

      // If moving to completed — also set completedAt
      if (data.newStatus === 'completed' && !service.completedAt) {
        updatedService.completedAt = now;
      }

      // 3e. Immutable array replacement
      const updatedServices = services.map((s, idx) => idx === serviceIndex ? updatedService : s);

      // 3f. Recalculate client-level aggregates (same logic as completeService / addPackageToService)
      const clientTotalHours = updatedServices.reduce((sum, s) => sum + (s.totalHours || 0), 0);
      const clientHoursUsed = updatedServices.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
      const clientHoursRemaining = updatedServices.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
      const clientMinutesRemaining = clientHoursRemaining * 60;
      const clientIsBlocked = (clientHoursRemaining <= 0) && (clientData.type === 'hours');
      const clientIsCritical = (!clientIsBlocked) && (clientHoursRemaining <= 5) && (clientData.type === 'hours');
      const totalServices = updatedServices.length;
      const activeServices = updatedServices.filter(s => s.status === 'active').length;

      // 3g. Write to Firestore (Transaction)
      transaction.update(clientRef, {
        services: updatedServices,
        totalServices: totalServices,
        activeServices: activeServices,
        totalHours: clientTotalHours,
        hoursUsed: clientHoursUsed,
        hoursRemaining: clientHoursRemaining,
        minutesRemaining: clientMinutesRemaining,
        isBlocked: clientIsBlocked,
        isCritical: clientIsCritical,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      // 3h. Return data from transaction
      const serviceName = service.name || service.serviceName;
      const serviceType = service.type || service.serviceType;

      return {
        serviceName,
        serviceType,
        previousStatus: currentStatus,
        newStatus: data.newStatus,
        statusChangedAt: now,
        aggregates: {
          totalHours: clientTotalHours,
          hoursUsed: clientHoursUsed,
          hoursRemaining: clientHoursRemaining,
          minutesRemaining: clientMinutesRemaining,
          isBlocked: clientIsBlocked,
          isCritical: clientIsCritical,
          totalServices: totalServices,
          activeServices: activeServices
        }
      };
    });

    // 4. Audit log (outside transaction)
    await logAction('CHANGE_SERVICE_STATUS', user.uid, user.username, {
      clientId: data.clientId,
      serviceId: data.serviceId,
      serviceName: result.serviceName,
      serviceType: result.serviceType,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      note: note
    });

    // 5. Return
    console.log(`✅ Service ${data.serviceId} status changed: ${result.previousStatus} → ${result.newStatus} for client ${data.clientId}`);

    return {
      success: true,
      serviceId: data.serviceId,
      serviceName: result.serviceName,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      statusChangedAt: result.statusChangedAt,
      clientAggregates: result.aggregates,
      message: `סטטוס השירות "${result.serviceName}" שונה מ-"${result.previousStatus}" ל-"${result.newStatus}"`
    };

  } catch (error) {
    console.error('Error in changeServiceStatus:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בשינוי סטטוס שירות: ${error.message}`
    );
  }
});

/**
 * מחיקת שירות מלקוח (hard delete)
 * ⚠️ פעולה בלתי הפיכה — audit log שומר full snapshot לשחזור ידני
 * @param {Object} data
 * @param {string} data.clientId - מזהה לקוח
 * @param {string} data.serviceId - מזהה שירות
 * @param {boolean} data.confirmDelete - חובה true (double confirmation)
 */
exports.deleteService = functions.https.onCall(async (data, context) => {
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

    if (data.confirmDelete !== true) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'נדרש אישור מחיקה (confirmDelete: true)'
      );
    }

    // 3. Transaction
    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      // 3a. Read client
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      // 3b. Find service
      const serviceIndex = services.findIndex(s => s.id === data.serviceId);
      if (serviceIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          `שירות ${data.serviceId} לא נמצא`
        );
      }

      const service = services[serviceIndex];

      // 3c. Referential integrity check — timesheet_entries
      const entriesSnapshot = await transaction.get(
        db.collection('timesheet_entries')
          .where('serviceId', '==', data.serviceId)
          .limit(1)
      );

      if (!entriesSnapshot.empty) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'לא ניתן למחוק שירות עם רישומי שעות. השתמש בשינוי סטטוס ל-"ארכיון" במקום.'
        );
      }

      // 3d. Full snapshot for audit log & recovery
      const deletedServiceSnapshot = { ...service };

      // 3e. Immutable removal
      const updatedServices = services.filter((s, idx) => idx !== serviceIndex);

      // 3f. Recalculate client-level aggregates (same logic as completeService / changeServiceStatus)
      const clientTotalHours = updatedServices.reduce((sum, s) => sum + (s.totalHours || 0), 0);
      const clientHoursUsed = updatedServices.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
      const clientHoursRemaining = updatedServices.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
      const clientMinutesRemaining = clientHoursRemaining * 60;
      const clientIsBlocked = (clientHoursRemaining <= 0) && (clientData.type === 'hours');
      const clientIsCritical = (!clientIsBlocked) && (clientHoursRemaining <= 5) && (clientData.type === 'hours');
      const totalServices = updatedServices.length;
      const activeServices = updatedServices.filter(s => s.status === 'active').length;

      // 3g. Write to Firestore (Transaction)
      transaction.update(clientRef, {
        services: updatedServices,
        totalServices: totalServices,
        activeServices: activeServices,
        totalHours: clientTotalHours,
        hoursUsed: clientHoursUsed,
        hoursRemaining: clientHoursRemaining,
        minutesRemaining: clientMinutesRemaining,
        isBlocked: clientIsBlocked,
        isCritical: clientIsCritical,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      // 3h. Return data from transaction
      const serviceName = service.name || service.serviceName;
      const serviceType = service.type || service.serviceType;

      return {
        deletedService: deletedServiceSnapshot,
        serviceName,
        serviceType,
        aggregates: {
          totalHours: clientTotalHours,
          hoursUsed: clientHoursUsed,
          hoursRemaining: clientHoursRemaining,
          minutesRemaining: clientMinutesRemaining,
          isBlocked: clientIsBlocked,
          isCritical: clientIsCritical,
          totalServices: totalServices,
          activeServices: activeServices
        }
      };
    });

    // 4. Audit log (outside transaction) — FULL snapshot for recovery
    await logAction('DELETE_SERVICE', user.uid, user.username, {
      clientId: data.clientId,
      serviceId: data.serviceId,
      serviceName: result.serviceName,
      serviceType: result.serviceType,
      deletedServiceSnapshot: result.deletedService
    });

    // 5. Return
    console.log(`✅ Service ${data.serviceId} (${result.serviceName}) deleted from client ${data.clientId}`);

    return {
      success: true,
      serviceId: data.serviceId,
      serviceName: result.serviceName,
      deletedService: result.deletedService,
      clientAggregates: result.aggregates,
      message: `השירות "${result.serviceName}" נמחק בהצלחה`
    };

  } catch (error) {
    console.error('Error in deleteService:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במחיקת שירות: ${error.message}`
    );
  }
});

/**
 * שינוי סטטוס לקוח
 * @param {Object} data
 * @param {string} data.clientId - מזהה לקוח
 * @param {string} data.newStatus - סטטוס חדש: active | inactive
 * @param {boolean} [data.isBlocked] - האם חסום (ברירת מחדל: false)
 * @param {boolean} [data.isCritical] - האם קריטי (ברירת מחדל: false)
 * @param {string} [data.note] - הערה אופציונלית
 */
exports.changeClientStatus = functions.https.onCall(async (data, context) => {
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

    const VALID_STATUSES = ['active', 'inactive'];
    if (!data.newStatus || !VALID_STATUSES.includes(data.newStatus)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `סטטוס לא תקין. ערכים מותרים: ${VALID_STATUSES.join(', ')}`
      );
    }

    const newIsBlocked = data.isBlocked === true;
    const newIsCritical = data.isCritical === true;

    // Can't be both blocked AND critical
    if (newIsBlocked && newIsCritical) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'לא ניתן להיות חסום וקריטי בו-זמנית'
      );
    }

    // Blocked/Critical only valid with 'active' status
    if (data.newStatus === 'inactive' && (newIsBlocked || newIsCritical)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'לא ניתן לסמן לקוח לא-פעיל כחסום או קריטי'
      );
    }

    const note = (data.note && typeof data.note === 'string')
      ? data.note.trim().substring(0, 500)
      : null;

    // 3. Transaction
    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      // 3a. Read client
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const currentStatus = clientData.status || 'active';
      const currentIsBlocked = clientData.isBlocked || false;
      const currentIsCritical = clientData.isCritical || false;

      // 3b. Same state guard
      if (currentStatus === data.newStatus &&
          currentIsBlocked === newIsBlocked &&
          currentIsCritical === newIsCritical) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'הסטטוס כבר זהה'
        );
      }

      const now = new Date().toISOString();

      // 3c. Write
      transaction.update(clientRef, {
        status: data.newStatus,
        isBlocked: newIsBlocked,
        isCritical: newIsCritical,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      return {
        clientName: clientData.fullName || clientData.clientName,
        previousStatus: currentStatus,
        previousIsBlocked: currentIsBlocked,
        previousIsCritical: currentIsCritical,
        statusChangedAt: now
      };
    });

    // 4. Audit log (outside transaction)
    await logAction('CHANGE_CLIENT_STATUS', user.uid, user.username, {
      clientId: data.clientId,
      clientName: result.clientName,
      previousStatus: result.previousStatus,
      newStatus: data.newStatus,
      previousIsBlocked: result.previousIsBlocked,
      previousIsCritical: result.previousIsCritical,
      newIsBlocked: newIsBlocked,
      newIsCritical: newIsCritical,
      note: note
    });

    // 5. Build display text
    let statusText = data.newStatus === 'active' ? 'פעיל' : 'לא פעיל';
    if (newIsBlocked) statusText = 'חסום';
    if (newIsCritical) statusText = 'קריטי';

    console.log(`✅ Client ${data.clientId} status changed to ${statusText}`);

    return {
      success: true,
      previousStatus: result.previousStatus,
      newStatus: data.newStatus,
      previousIsBlocked: result.previousIsBlocked,
      previousIsCritical: result.previousIsCritical,
      isBlocked: newIsBlocked,
      isCritical: newIsCritical,
      statusChangedAt: result.statusChangedAt,
      message: `סטטוס הלקוח "${result.clientName}" שונה ל-"${statusText}"`
    };

  } catch (error) {
    console.error('Error in changeClientStatus:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בשינוי סטטוס לקוח: ${error.message}`
    );
  }
});

/**
 * סגירת תיק — העברה לארכיון + השלמת כל השירותים
 * closeCase — archive client + complete all services
 * @param {Object} data
 * @param {string} data.clientId — מזהה לקוח (חובה)
 * @param {string} [data.note] — הערת סגירה (אופציונלי, עד 500 תווים)
 */
exports.closeCase = functions.https.onCall(async (data, context) => {
  try {
    // ═══════════════════════════════════════
    // 1. AUTH — only admin
    // ═══════════════════════════════════════
    const user = await checkUserPermissions(context);

    // ═══════════════════════════════════════
    // 2. VALIDATION
    // ═══════════════════════════════════════
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה לקוח חובה'
      );
    }

    const note = (data.note && typeof data.note === 'string')
      ? data.note.trim().substring(0, 500)
      : null;

    // ═══════════════════════════════════════
    // 3. TRANSACTION
    // ═══════════════════════════════════════
    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      // ── Phase 1: READ ──
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      // ── Phase 2: VALIDATIONS + CALCULATIONS ──

      // Same-state guard
      if (clientData.status === 'inactive' && clientData.isArchived === true) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'התיק כבר סגור ומועבר לארכיון'
        );
      }

      const now = new Date().toISOString();
      let servicesCompleted = 0;
      let servicesAlreadyCompleted = 0;

      // Immutable map — complete all non-completed services
      const updatedServices = services.map(service => {
        if (service.status === 'completed') {
          servicesAlreadyCompleted++;
          return service;
        }
        servicesCompleted++;
        return {
          ...service,
          status: 'completed',
          completedAt: now
        };
      });

      // Recalculate client-level aggregates
      const clientTotalHours = updatedServices.reduce((sum, s) => sum + (s.totalHours || 0), 0);
      const clientHoursUsed = updatedServices.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
      const clientHoursRemaining = updatedServices.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
      const clientMinutesRemaining = clientHoursRemaining * 60;
      const totalServices = updatedServices.length;
      const activeServices = 0;

      // ── Phase 3: WRITE ──
      transaction.update(clientRef, {
        status: 'inactive',
        isArchived: true,
        isBlocked: false,
        isCritical: false,
        archivedAt: now,
        services: updatedServices,
        totalServices: totalServices,
        activeServices: activeServices,
        totalHours: clientTotalHours,
        hoursUsed: clientHoursUsed,
        hoursRemaining: clientHoursRemaining,
        minutesRemaining: clientMinutesRemaining,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      return {
        clientName: clientData.fullName || clientData.clientName,
        previousStatus: clientData.status || 'active',
        servicesCompleted,
        servicesAlreadyCompleted,
        closedAt: now,
        aggregates: {
          totalHours: clientTotalHours,
          hoursUsed: clientHoursUsed,
          hoursRemaining: clientHoursRemaining,
          minutesRemaining: clientMinutesRemaining,
          isBlocked: false,
          isCritical: false,
          totalServices: totalServices,
          activeServices: activeServices
        }
      };
    });

    // ═══════════════════════════════════════
    // 4. INFORMATIONAL — count active budget_tasks (outside transaction)
    // ═══════════════════════════════════════
    let activeBudgetTasks = 0;
    try {
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('clientId', '==', data.clientId)
        .where('status', '==', 'פעיל')
        .get();
      activeBudgetTasks = tasksSnapshot.size;
    } catch (e) {
      console.error('Warning: failed to count active budget_tasks:', e);
    }

    // ═══════════════════════════════════════
    // 5. AUDIT LOG (outside transaction)
    // ═══════════════════════════════════════
    try {
      await logAction('CLOSE_CASE', user.uid, user.username, {
        clientId: data.clientId,
        clientName: result.clientName,
        previousStatus: result.previousStatus,
        servicesCompleted: result.servicesCompleted,
        servicesAlreadyCompleted: result.servicesAlreadyCompleted,
        activeBudgetTasksRemaining: activeBudgetTasks,
        note: note
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    // ═══════════════════════════════════════
    // 6. RETURN
    // ═══════════════════════════════════════
    console.log(`✅ Case closed: ${data.clientId} (${result.clientName})`);

    return {
      success: true,
      clientId: data.clientId,
      clientName: result.clientName,
      closedAt: result.closedAt,
      servicesCompleted: result.servicesCompleted,
      servicesAlreadyCompleted: result.servicesAlreadyCompleted,
      clientAggregates: result.aggregates,
      activeBudgetTasks: activeBudgetTasks,
      message: `התיק "${result.clientName}" נסגר. ${result.servicesCompleted} שירותים הושלמו.${activeBudgetTasks > 0 ? ` שים לב: ${activeBudgetTasks} משימות תקציב עדיין פעילות.` : ''}`
    };

  } catch (error) {
    console.error('Error in closeCase:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בסגירת תיק: ${error.message}`
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
            hoursUsed: admin.firestore.FieldValue.increment(hoursWorked),
            minutesUsed: admin.firestore.FieldValue.increment(data.minutes),
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
          let serviceIndex = -1;

          if (data.serviceId) {
            serviceIndex = clientData.services.findIndex(s => s.id === data.serviceId);
            service = serviceIndex >= 0 ? clientData.services[serviceIndex] : null;
            if (!service) {
              console.warn(`⚠️ שירות ${data.serviceId} לא נמצא - משתמש בראשון`);
              serviceIndex = 0;
              service = clientData.services[0];
            }
          } else {
            serviceIndex = 0;
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
              const updatedPackage = DeductionSystem.deductHoursFromPackage(activePackage, hoursWorked);
              updatedPackageId = updatedPackage.id;

              const updatedServicePackages = service.packages.map(pkg =>
                pkg.id === updatedPackage.id ? updatedPackage : pkg
              );

              const updatedService = {
                ...service,
                packages: updatedServicePackages,
                hoursUsed: (service.hoursUsed || 0) + hoursWorked,
                hoursRemaining: (service.hoursRemaining || 0) - hoursWorked,
                lastActivity: new Date().toISOString()
              };

              const updatedServices = clientData.services.map((s, idx) =>
                idx === serviceIndex ? updatedService : s
              );

              // ✅ VERSION CONTROL: עדכון עם גרסה חדשה
              const currentHoursRemaining = clientData.hoursRemaining || 0;
              const newHoursRemaining = currentHoursRemaining - hoursWorked;
              const newIsBlocked = (newHoursRemaining <= 0) && (clientData.type === 'hours');
              const newIsCritical = (!newIsBlocked) && (newHoursRemaining <= 5) && (clientData.type === 'hours');

              transaction.update(clientRef, {
                services: updatedServices,
                hoursUsed: admin.firestore.FieldValue.increment(hoursWorked),
                minutesUsed: admin.firestore.FieldValue.increment(data.minutes),
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

// Real-time Task Updates & Notifications
exports.updateBudgetTask = updateBudgetTask;
exports.markNotificationAsRead = markNotificationAsRead;

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



// ═══════════════════════════════════════════════════════════════
// 📊 Workload Analytics Functions - Performance Optimized
// ═══════════════════════════════════════════════════════════════
const { getTeamWorkloadData } = require('./workload-analytics');
exports.getTeamWorkloadData = getTeamWorkloadData;

// Fee Agreements Functions (imported from ./fee-agreements)
const feeAgreements = require('./fee-agreements');
exports.uploadFeeAgreement = feeAgreements.uploadFeeAgreement;
exports.deleteFeeAgreement = feeAgreements.deleteFeeAgreement;

// Scheduled Functions (imported from ./scheduled)
const scheduled = require('./scheduled');
exports.dailyTaskReminders = scheduled.dailyTaskReminders;
exports.dailyBudgetWarnings = scheduled.dailyBudgetWarnings;
exports.dailyInvariantCheck = scheduled.dailyInvariantCheck;

// WhatsApp Functions (imported from ./whatsapp)
const whatsapp = require('./whatsapp');
exports.sendBroadcastMessage = whatsapp.sendBroadcastMessage;
exports.sendWhatsAppApprovalNotification = whatsapp.sendWhatsAppApprovalNotification;
exports.whatsappWebhook = whatsapp.whatsappWebhook;
exports.onApprovalCreated = whatsapp.onApprovalCreated;

// Metrics Functions (imported from ./metrics)
const metrics = require('./metrics');
exports.getUserMetrics = metrics.getUserMetrics;
exports.updateMetricsOnTaskChange = metrics.updateMetricsOnTaskChange;

// Admin Functions (imported from ./admin)
const adminOps = require('./admin');
exports.createUser = adminOps.createUser;
exports.updateUser = adminOps.updateUser;
exports.blockUser = adminOps.blockUser;
exports.deleteUser = adminOps.deleteUser;
exports.getUserFullDetails = adminOps.getUserFullDetails;
exports.logActivity = adminOps.logActivity;
exports.deleteUserData = adminOps.deleteUserData;
exports.deleteUserDataSelective = adminOps.deleteUserDataSelective;

console.log('✅ Law Office Functions loaded successfully');
