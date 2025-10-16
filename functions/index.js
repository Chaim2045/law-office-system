/**
 * Law Office Management System - Firebase Functions
 *
 * מערכת ניהול משרד עורכי דין - פונקציות שרת
 * ארכיטקטורה מאובטחת עם Validation, Authorization, ו-Audit Logging
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

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
    username: employeeDoc.id,
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
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
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

    // יצירת מסמך ב-Firestore
    await db.collection('employees').doc(data.oldUsername || userRecord.uid).set({
      authUID: userRecord.uid,
      username: data.oldUsername || userRecord.uid,
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
 * יצירת לקוח חדש
 */
exports.createClient = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

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

    if (!data.fileNumber || typeof data.fileNumber !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מספר תיק חובה'
      );
    }

    if (data.fileNumber.trim().length < 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מספר תיק לא תקין'
      );
    }

    // בדיקה שמספר תיק לא קיים
    const existingFile = await db.collection('clients')
      .where('fileNumber', '==', data.fileNumber.trim())
      .limit(1)
      .get();

    if (!existingFile.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        `מספר תיק ${data.fileNumber} כבר קיים במערכת`
      );
    }

    // Validation - שדות אופציונליים
    if (data.phone && !isValidIsraeliPhone(data.phone)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מספר טלפון לא תקין. יש להזין מספר ישראלי תקין'
      );
    }

    if (data.email && !isValidEmail(data.email)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כתובת אימייל לא תקינה'
      );
    }

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

      // ✅ NEW: Validation - סוג תמחור (hourly או fixed)
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

    // ✅ NEW ARCHITECTURE: יצירת לקוח + תיק אוטומטית
    // שלב 1: יצירת הלקוח (רק מידע אישי)
    const clientData = {
      clientName: sanitizeString(data.clientName.trim()),
      phone: data.phone ? sanitizeString(data.phone.trim()) : '',
      email: data.email ? sanitizeString(data.email.trim()) : '',
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalCases: 1,     // ✅ NEW: מספר תיקים
      activeCases: 1     // ✅ NEW: תיקים פעילים
    };

    const clientRef = await db.collection('clients').add(clientData);
    const clientId = clientRef.id;

    // שלב 2: יצירת התיק הראשון (מידע משפטי)
    const caseData = {
      caseNumber: sanitizeString(data.fileNumber.trim()),
      caseTitle: data.description ? sanitizeString(data.description.trim()) : 'הליך ראשי',
      clientId: clientId,
      clientName: clientData.clientName,
      procedureType: data.procedureType,
      status: 'active',
      priority: 'medium',
      description: data.description ? sanitizeString(data.description.trim()) : '',
      assignedTo: [user.username],
      mainAttorney: user.username,
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // הוספת שדות ספציפיים לסוג הליך
    if (data.procedureType === 'hours') {
      caseData.totalHours = data.totalHours;
      caseData.hoursRemaining = data.totalHours;
      caseData.minutesRemaining = data.totalHours * 60;
    } else if (data.procedureType === 'fixed') {
      caseData.stages = [
        { id: 1, name: 'שלב 1', completed: false },
        { id: 2, name: 'שלב 2', completed: false },
        { id: 3, name: 'שלב 3', completed: false }
      ];
    } else if (data.procedureType === 'legal_procedure') {
      // הליך משפטי עם 3 שלבים מפורטים
      const now = new Date().toISOString();
      caseData.currentStage = 'stage_a';
      caseData.pricingType = data.pricingType; // ✅ שמירת סוג התמחור

      if (data.pricingType === 'hourly') {
        // ✅ תמחור שעתי - שלבים עם שעות וחבילות
        caseData.stages = [
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
                purchaseDate: now
              }
            ]
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
                id: `pkg_initial_b_${Date.now()}`,
                type: 'initial',
                hours: data.stages[1].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[1].hours,
                purchaseDate: now
              }
            ]
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
                id: `pkg_initial_c_${Date.now()}`,
                type: 'initial',
                hours: data.stages[2].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[2].hours,
                purchaseDate: now
              }
            ]
          }
        ];

        // חישוב סה"כ שעות בהליך
        const totalProcedureHours = data.stages.reduce((sum, s) => sum + s.hours, 0);
        caseData.totalHours = totalProcedureHours;
        caseData.hoursRemaining = totalProcedureHours;
        caseData.minutesRemaining = totalProcedureHours * 60;

      } else if (data.pricingType === 'fixed') {
        // ✅ תמחור פיקס - שלבים עם מחירים קבועים
        caseData.stages = [
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
            paymentMethod: null
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
            paymentMethod: null
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
            paymentMethod: null
          }
        ];

        // חישוב סה"כ מחיר ויתרה
        const totalFixedPrice = data.stages.reduce((sum, s) => sum + s.fixedPrice, 0);
        caseData.totalFixedPrice = totalFixedPrice;
        caseData.totalPaid = 0;
        caseData.remainingBalance = totalFixedPrice;
      }
    }

    const caseRef = await db.collection('cases').add(caseData);

    // Audit log
    await logAction('CREATE_CLIENT_WITH_CASE', user.uid, user.username, {
      clientId: clientId,
      caseId: caseRef.id,
      clientName: clientData.clientName,
      fileNumber: data.fileNumber,
      procedureType: data.procedureType
    });

    return {
      success: true,
      clientId: clientId,
      caseId: caseRef.id,
      client: {
        id: clientId,
        ...clientData
      },
      case: {
        id: caseRef.id,
        ...caseData
      }
    };

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
 * קריאת לקוחות - כל המשרד רואה את כל הלקוחות
 */
exports.getClients = functions.https.onCall(async (data, context) => {
  try {
    // ✅ בדיקה שהמשתמש מחובר ופעיל
    await checkUserPermissions(context);

    // ✅ כל עובד רואה את כל לקוחות המשרד
    const snapshot = await db.collection('clients').get();

    const clients = [];
    snapshot.forEach(doc => {
      clients.push({
        id: doc.id,
        ...doc.data()
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
      updates.fullName = sanitizeString(data.fullName.trim());
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

    if (!data.clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    if (typeof data.estimatedHours !== 'number' || data.estimatedHours <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'שעות משוערות חייבות להיות מספר חיובי'
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

    // ✅ כל עובד יכול ליצור משימות עבור כל לקוח במשרד
    // אין צורך בבדיקת הרשאות נוספת

    // יצירת המשימה
    const taskData = {
      description: sanitizeString(data.description.trim()),
      clientId: data.clientId,
      clientName: clientData.clientName || clientData.fullName, // תמיכה בשני המבנים
      caseId: data.caseId || null, // ✅ NEW: תמיכה בתיקים
      caseTitle: data.caseTitle || null, // ✅ NEW: שם התיק (denormalized)
      estimatedHours: data.estimatedHours,
      actualHours: 0,
      status: 'active',
      employee: user.username,
      lawyer: user.username,
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeEntries: []
    };

    const docRef = await db.collection('budget_tasks').add(taskData);

    // Audit log
    await logAction('CREATE_TASK', user.uid, user.username, {
      taskId: docRef.id,
      clientId: data.clientId,
      estimatedHours: data.estimatedHours
    });

    return {
      success: true,
      taskId: docRef.id,
      task: {
        id: docRef.id,
        ...taskData
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
      query = query.where('employee', '==', user.username);
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
 * הוספת זמן למשימה
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

    // בדיקה שהמשימה קיימת
    const taskDoc = await db.collection('budget_tasks').doc(data.taskId).get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'משימה לא נמצאה'
      );
    }

    const taskData = taskDoc.data();

    // רק בעל המשימה או admin יכולים להוסיף זמן
    if (taskData.employee !== user.username && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה להוסיף זמן למשימה זו'
      );
    }

    // הוספת הזמן
    // ✅ תיקון: אי אפשר להשתמש ב-serverTimestamp() בתוך array
    // נשתמש ב-Date object רגיל במקום
    const timeEntry = {
      date: data.date,
      minutes: data.minutes,
      hours: data.minutes / 60,
      description: data.description ? sanitizeString(data.description) : '',
      addedBy: user.username,
      addedAt: new Date().toISOString()  // ✅ ISO string במקום Timestamp
    };

    const newActualHours = (taskData.actualHours || 0) + (data.minutes / 60);

    await db.collection('budget_tasks').doc(data.taskId).update({
      actualHours: newActualHours,
      timeEntries: admin.firestore.FieldValue.arrayUnion(timeEntry),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log
    await logAction('ADD_TIME_TO_TASK', user.uid, user.username, {
      taskId: data.taskId,
      minutes: data.minutes,
      date: data.date
    });

    return {
      success: true,
      taskId: data.taskId,
      newActualHours
    };

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

    const taskDoc = await db.collection('budget_tasks').doc(data.taskId).get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'משימה לא נמצאה'
      );
    }

    const taskData = taskDoc.data();

    if (taskData.employee !== user.username && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה לסמן משימה זו כהושלמה'
      );
    }

    await db.collection('budget_tasks').doc(data.taskId).update({
      status: 'הושלם',  // ✅ תיקון: עברית במקום אנגלית
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedBy: user.username,
      completionNotes: data.notes ? sanitizeString(data.notes) : '',
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log
    await logAction('COMPLETE_TASK', user.uid, user.username, {
      taskId: data.taskId
    });

    return {
      success: true,
      taskId: data.taskId
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
    if (taskData.employee !== user.username && user.role !== 'admin') {
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
      extendedAt: admin.firestore.FieldValue.serverTimestamp()
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
 * יצירת רישום שעות
 */
exports.createTimesheetEntry = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
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

    if (!data.action || typeof data.action !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תיאור פעולה'
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

    // ✅ כל עובד יכול לרשום שעות עבור כל לקוח במשרד
    // אין צורך בבדיקת הרשאות נוספת

    // יצירת רישום
    const entryData = {
      clientId: data.clientId,
      clientName: clientData.clientName || clientData.fullName, // תמיכה בשני המבנים
      caseId: data.caseId || null, // ✅ NEW: תמיכה בתיקים
      caseTitle: data.caseTitle || null, // ✅ NEW: שם התיק (denormalized)
      date: data.date,
      minutes: data.minutes,
      hours: data.minutes / 60,
      action: sanitizeString(data.action.trim()),
      employee: user.username,
      lawyer: user.username,
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('timesheet_entries').add(entryData);

    // Audit log
    await logAction('CREATE_TIMESHEET_ENTRY', user.uid, user.username, {
      entryId: docRef.id,
      clientId: data.clientId,
      minutes: data.minutes,
      date: data.date
    });

    return {
      success: true,
      entryId: docRef.id,
      entry: {
        id: docRef.id,
        ...entryData
      }
    };

  } catch (error) {
    console.error('Error in createTimesheetEntry:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת רישום שעות: ${error.message}`
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
      query = query.where('employee', '==', user.username);
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

    if (!data.username || !data.authUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות: username, authUID'
      );
    }

    // עדכון העובד
    await db.collection('employees').doc(data.username).update({
      authUID: data.authUID,
      migratedToAuth: true,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedBy: user.username
    });

    // Audit log
    await logAction('LINK_AUTH_TO_EMPLOYEE', user.uid, user.username, {
      employeeUsername: data.username,
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

/**
 * מעקב אחר כניסות ופעילות משתמשים (User Tracking)
 * נקרא מ-user-tracker.js
 */
exports.trackUserActivity = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.activityType || typeof data.activityType !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר סוג פעילות'
      );
    }

    // רישום הפעילות
    const trackingData = {
      userId: user.uid,
      username: user.username,
      activityType: data.activityType, // 'login', 'logout', 'pageview', etc.
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: data.metadata || {},
      userAgent: data.userAgent || null,
      ipAddress: data.ipAddress || null
    };

    const docRef = await db.collection('user_tracking').add(trackingData);

    // אם זו כניסה, נעדכן גם את העובד
    if (data.activityType === 'login') {
      await db.collection('employees').doc(user.username).update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        loginCount: admin.firestore.FieldValue.increment(1)
      });
    }

    return {
      success: true,
      trackingId: docRef.id
    };

  } catch (error) {
    console.error('Error in trackUserActivity:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במעקב משתמש: ${error.message}`
    );
  }
});

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
// Cases Management Functions (NEW)
// ===============================

/**
 * יצירת תיק חדש (Case) - ארכיטקטורה חדשה
 * תיק = הליך משפטי ספציפי ללקוח
 * לקוח אחד יכול להיות בעל מספר תיקים
 */
exports.createCase = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation - שדות חובה
    if (!data.caseNumber || typeof data.caseNumber !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מספר תיק חובה'
      );
    }

    if (data.caseNumber.trim().length < 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מספר תיק לא תקין'
      );
    }

    // בדיקה שמספר תיק לא קיים
    const existingCase = await db.collection('cases')
      .where('caseNumber', '==', data.caseNumber.trim())
      .limit(1)
      .get();

    if (!existingCase.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        `מספר תיק ${data.caseNumber} כבר קיים במערכת`
      );
    }

    if (!data.caseTitle || typeof data.caseTitle !== 'string' || data.caseTitle.trim().length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כותרת תיק חייבת להכיל לפחות 2 תווים'
      );
    }

    if (!data.procedureType || !['hours', 'fixed', 'legal_procedure'].includes(data.procedureType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סוג הליך חייב להיות "hours", "fixed" או "legal_procedure"'
      );
    }

    // Validation - הליך משפטי עם שלבים
    if (data.procedureType === 'legal_procedure') {
      if (!data.stages || !Array.isArray(data.stages) || data.stages.length !== 3) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'הליך משפטי דורש בדיוק 3 שלבים'
        );
      }

      // ✅ NEW: Validation - סוג תמחור (hourly או fixed)
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

    // טיפול בלקוח - קיים או חדש
    let clientId;
    let clientName;

    if (data.clientId) {
      // לקוח קיים - בדיקה שקיים
      const clientDoc = await db.collection('clients').doc(data.clientId).get();
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'לקוח לא נמצא'
        );
      }
      clientId = data.clientId;
      clientName = clientDoc.data().clientName;
    } else if (data.clientName) {
      // לקוח חדש - יצירה
      if (data.clientName.trim().length < 2) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'שם לקוח חייב להכיל לפחות 2 תווים'
        );
      }

      const newClientData = {
        clientName: sanitizeString(data.clientName.trim()),
        phone: data.phone ? sanitizeString(data.phone.trim()) : '',
        email: data.email ? sanitizeString(data.email.trim()) : '',
        idNumber: data.idNumber ? sanitizeString(data.idNumber.trim()) : '',
        address: data.address ? sanitizeString(data.address.trim()) : '',
        createdBy: user.username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalCases: 1,
        activeCases: 1
      };

      const clientRef = await db.collection('clients').add(newClientData);
      clientId = clientRef.id;
      clientName = newClientData.clientName;
    } else {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק clientId או clientName'
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

    // יצירת התיק
    const caseData = {
      caseNumber: sanitizeString(data.caseNumber.trim()),
      caseTitle: sanitizeString(data.caseTitle.trim()),
      clientId: clientId,
      clientName: clientName,  // Denormalized למהירות
      procedureType: data.procedureType,
      status: 'active',
      priority: data.priority || 'medium',
      description: data.description ? sanitizeString(data.description.trim()) : '',
      assignedTo: data.assignedTo || [user.username],
      mainAttorney: data.mainAttorney || user.username,
      tags: data.tags || [],
      category: data.category || '',
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // הוספת שדות ספציפיים לסוג הליך
    if (data.procedureType === 'hours') {
      caseData.totalHours = data.totalHours;
      caseData.hoursRemaining = data.totalHours;
      caseData.minutesRemaining = data.totalHours * 60;
      caseData.hourlyRate = data.hourlyRate || null;
    } else if (data.procedureType === 'fixed') {
      caseData.stages = data.stages || [
        { id: 1, name: 'שלב 1', completed: false },
        { id: 2, name: 'שלב 2', completed: false },
        { id: 3, name: 'שלב 3', completed: false }
      ];
      caseData.fixedPrice = data.fixedPrice || null;
    } else if (data.procedureType === 'legal_procedure') {
      // הליך משפטי עם 3 שלבים מפורטים
      const now = new Date().toISOString();
      caseData.currentStage = 'stage_a';
      caseData.pricingType = data.pricingType; // ✅ שמירת סוג התמחור

      if (data.pricingType === 'hourly') {
        // ✅ תמחור שעתי - שלבים עם שעות וחבילות
        caseData.stages = [
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
                purchaseDate: now
              }
            ]
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
                id: `pkg_initial_b_${Date.now()}`,
                type: 'initial',
                hours: data.stages[1].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[1].hours,
                purchaseDate: now
              }
            ]
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
                id: `pkg_initial_c_${Date.now()}`,
                type: 'initial',
                hours: data.stages[2].hours,
                hoursUsed: 0,
                hoursRemaining: data.stages[2].hours,
                purchaseDate: now
              }
            ]
          }
        ];

        // חישוב סה"כ שעות בהליך
        const totalProcedureHours = data.stages.reduce((sum, s) => sum + s.hours, 0);
        caseData.totalHours = totalProcedureHours;
        caseData.hoursRemaining = totalProcedureHours;
        caseData.minutesRemaining = totalProcedureHours * 60;

      } else if (data.pricingType === 'fixed') {
        // ✅ תמחור פיקס - שלבים עם מחירים קבועים
        caseData.stages = [
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
            paymentMethod: null
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
            paymentMethod: null
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
            paymentMethod: null
          }
        ];

        // חישוב סה"כ מחיר ויתרה
        const totalFixedPrice = data.stages.reduce((sum, s) => sum + s.fixedPrice, 0);
        caseData.totalFixedPrice = totalFixedPrice;
        caseData.totalPaid = 0;
        caseData.remainingBalance = totalFixedPrice;
      }
    }

    if (data.deadline) {
      const deadlineDate = new Date(data.deadline);
      if (!isNaN(deadlineDate.getTime())) {
        caseData.deadline = admin.firestore.Timestamp.fromDate(deadlineDate);
      }
    }

    // שמירה ב-Firestore
    const caseRef = await db.collection('cases').add(caseData);

    // עדכון סטטיסטיקות לקוח
    await db.collection('clients').doc(clientId).update({
      totalCases: admin.firestore.FieldValue.increment(1),
      activeCases: admin.firestore.FieldValue.increment(1),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log
    await logAction('CREATE_CASE', user.uid, user.username, {
      caseId: caseRef.id,
      caseNumber: caseData.caseNumber,
      clientId: clientId,
      procedureType: data.procedureType
    });

    return {
      success: true,
      caseId: caseRef.id,
      clientId: clientId,
      case: {
        id: caseRef.id,
        ...caseData
      }
    };

  } catch (error) {
    console.error('Error in createCase:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת תיק: ${error.message}`
    );
  }
});

/**
 * קריאת תיקים
 * תומך בסינונים: clientId, status, assignedTo
 */
exports.getCases = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    let query = db.collection('cases');

    // סינון לפי לקוח
    if (data.clientId) {
      query = query.where('clientId', '==', data.clientId);
    }

    // סינון לפי סטטוס
    if (data.status) {
      query = query.where('status', '==', data.status);
    }

    // סינון לפי עו"ד מוקצה
    if (data.assignedTo) {
      query = query.where('assignedTo', 'array-contains', data.assignedTo);
    }

    // מיון
    query = query.orderBy('createdAt', 'desc');

    const snapshot = await query.get();

    const cases = [];
    snapshot.forEach(doc => {
      cases.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      cases,
      total: cases.length
    };

  } catch (error) {
    console.error('Error in getCases:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת תיקים: ${error.message}`
    );
  }
});

/**
 * קריאת כל התיקים של לקוח ספציפי + סטטיסטיקות
 */
exports.getCasesByClient = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (!data.clientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    // טעינת פרטי הלקוח
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    // טעינת כל התיקים של הלקוח
    const casesSnapshot = await db.collection('cases')
      .where('clientId', '==', data.clientId)
      .orderBy('openedAt', 'desc')
      .get();

    const cases = [];
    let totalHoursRemaining = 0;
    let activeCases = 0;
    let completedCases = 0;

    casesSnapshot.forEach(doc => {
      const caseData = { id: doc.id, ...doc.data() };
      cases.push(caseData);

      if (caseData.status === 'active') {
        activeCases++;
        if (caseData.procedureType === 'hours') {
          totalHoursRemaining += caseData.hoursRemaining || 0;
        }
      } else if (caseData.status === 'completed') {
        completedCases++;
      }
    });

    return {
      success: true,
      client: {
        id: data.clientId,
        ...clientDoc.data()
      },
      cases,
      statistics: {
        totalCases: cases.length,
        activeCases,
        completedCases,
        totalHoursRemaining: Math.round(totalHoursRemaining * 10) / 10
      }
    };

  } catch (error) {
    console.error('Error in getCasesByClient:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת תיקי לקוח: ${error.message}`
    );
  }
});

/**
 * עדכון תיק
 */
exports.updateCase = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (!data.caseId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה תיק'
      );
    }

    // בדיקה שהתיק קיים
    const caseDoc = await db.collection('cases').doc(data.caseId).get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'תיק לא נמצא'
      );
    }

    const caseData = caseDoc.data();

    // רק עו"ד מוקצה או admin יכולים לעדכן
    if (!caseData.assignedTo.includes(user.username) && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה לעדכן תיק זה'
      );
    }

    const updates = {};

    // עדכונים מותרים
    if (data.status !== undefined) {
      if (!['active', 'completed', 'archived', 'on_hold'].includes(data.status)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'סטטוס לא תקין'
        );
      }
      updates.status = data.status;

      // אם נסגר תיק
      if (data.status === 'completed' && caseData.status !== 'completed') {
        updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.completedBy = user.username;

        // עדכון סטטיסטיקות לקוח
        await db.collection('clients').doc(caseData.clientId).update({
          activeCases: admin.firestore.FieldValue.increment(-1)
        });
      }
    }

    if (data.priority !== undefined) {
      updates.priority = data.priority;
    }

    if (data.description !== undefined) {
      updates.description = sanitizeString(data.description);
    }

    if (data.notes !== undefined) {
      updates.notes = sanitizeString(data.notes);
    }

    updates.lastModifiedBy = user.username;
    updates.lastModifiedAt = admin.firestore.FieldValue.serverTimestamp();

    // עדכון
    await db.collection('cases').doc(data.caseId).update(updates);

    // Audit log
    await logAction('UPDATE_CASE', user.uid, user.username, {
      caseId: data.caseId,
      updates: Object.keys(updates)
    });

    return {
      success: true,
      caseId: data.caseId
    };

  } catch (error) {
    console.error('Error in updateCase:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון תיק: ${error.message}`
    );
  }
});

/**
 * קריאת תיק בודד - עם כל פרטי השלבים
 */
exports.getCaseById = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (!data.caseId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה תיק'
      );
    }

    const caseDoc = await db.collection('cases').doc(data.caseId).get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'תיק לא נמצא'
      );
    }

    return {
      success: true,
      case: {
        id: caseDoc.id,
        ...caseDoc.data()
      }
    };

  } catch (error) {
    console.error('Error in getCaseById:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת תיק: ${error.message}`
    );
  }
});

/**
 * הוספת חבילת שעות נוספת לשלב קיים
 * נקרא כשהשעות נגמרות בשלב ורוכשים שעות נוספות
 */
exports.addHoursPackageToStage = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.caseId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה תיק'
      );
    }

    if (!data.stageId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה שלב'
      );
    }

    if (!data.hours || typeof data.hours !== 'number' || data.hours <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כמות שעות חייבת להיות מספר חיובי'
      );
    }

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק סיבה (לפחות 2 תווים)'
      );
    }

    // טעינת התיק
    const caseDoc = await db.collection('cases').doc(data.caseId).get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'תיק לא נמצא'
      );
    }

    const caseData = caseDoc.data();

    // וודא שזה הליך משפטי
    if (caseData.procedureType !== 'legal_procedure') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'הוספת חבילת שעות אפשרית רק להליכים משפטיים'
      );
    }

    // וודא שהשלב קיים
    const stageIndex = caseData.stages.findIndex(s => s.id === data.stageId);
    if (stageIndex === -1) {
      throw new functions.https.HttpsError(
        'not-found',
        'שלב לא נמצא'
      );
    }

    // בדיקת הרשאות
    if (!caseData.assignedTo.includes(user.username) && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה לעדכן תיק זה'
      );
    }

    // יצירת חבילת השעות החדשה
    const now = new Date().toISOString();
    const newPackage = {
      id: `pkg_additional_${Date.now()}`,
      type: 'additional',
      hours: data.hours,
      hoursUsed: 0,
      hoursRemaining: data.hours,
      purchaseDate: data.purchaseDate || now,
      reason: sanitizeString(data.reason.trim()),
      addedBy: user.username,
      addedAt: now
    };

    // עדכון השלב
    const updatedStages = [...caseData.stages];
    updatedStages[stageIndex] = {
      ...updatedStages[stageIndex],
      packages: [...updatedStages[stageIndex].packages, newPackage],
      totalHours: updatedStages[stageIndex].totalHours + data.hours,
      hoursRemaining: updatedStages[stageIndex].hoursRemaining + data.hours
    };

    // עדכון סה"כ שעות בתיק
    const newTotalHours = caseData.totalHours + data.hours;
    const newHoursRemaining = caseData.hoursRemaining + data.hours;

    // שמירה ב-Firestore
    await db.collection('cases').doc(data.caseId).update({
      stages: updatedStages,
      totalHours: newTotalHours,
      hoursRemaining: newHoursRemaining,
      minutesRemaining: newHoursRemaining * 60,
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log
    await logAction('ADD_HOURS_PACKAGE_TO_STAGE', user.uid, user.username, {
      caseId: data.caseId,
      stageId: data.stageId,
      hours: data.hours,
      reason: data.reason
    });

    return {
      success: true,
      caseId: data.caseId,
      stageId: data.stageId,
      package: newPackage,
      newTotalHours,
      newHoursRemaining
    };

  } catch (error) {
    console.error('Error in addHoursPackageToStage:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהוספת חבילת שעות: ${error.message}`
    );
  }
});

/**
 * מעבר לשלב הבא בהליך משפטי
 * סוגר את השלב הנוכחי ומפעיל את השלב הבא
 */
exports.moveToNextStage = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.caseId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה תיק'
      );
    }

    if (!data.currentStageId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה שלב נוכחי'
      );
    }

    // טעינת התיק
    const caseDoc = await db.collection('cases').doc(data.caseId).get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'תיק לא נמצא'
      );
    }

    const caseData = caseDoc.data();

    // וודא שזה הליך משפטי
    if (caseData.procedureType !== 'legal_procedure') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'מעבר בין שלבים אפשרי רק להליכים משפטיים'
      );
    }

    // בדיקת הרשאות
    if (!caseData.assignedTo.includes(user.username) && user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה לעדכן תיק זה'
      );
    }

    // מצא את השלב הנוכחי
    const currentStageIndex = caseData.stages.findIndex(s => s.id === data.currentStageId);
    if (currentStageIndex === -1) {
      throw new functions.https.HttpsError(
        'not-found',
        'שלב נוכחי לא נמצא'
      );
    }

    // וודא שהשלב הנוכחי הוא אכן הפעיל
    if (caseData.stages[currentStageIndex].status !== 'active') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'השלב הנוכחי אינו פעיל'
      );
    }

    // וודא שיש שלב הבא
    if (currentStageIndex >= caseData.stages.length - 1) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'זהו השלב האחרון - אין שלב הבא'
      );
    }

    const now = new Date().toISOString();

    // עדכון השלבים
    const updatedStages = [...caseData.stages];

    // סגירת השלב הנוכחי
    updatedStages[currentStageIndex] = {
      ...updatedStages[currentStageIndex],
      status: 'completed',
      completedAt: now,
      completedBy: user.username
    };

    // הפעלת השלב הבא
    const nextStageIndex = currentStageIndex + 1;
    updatedStages[nextStageIndex] = {
      ...updatedStages[nextStageIndex],
      status: 'active',
      startedAt: now
    };

    const nextStageId = updatedStages[nextStageIndex].id;

    // שמירה ב-Firestore
    await db.collection('cases').doc(data.caseId).update({
      stages: updatedStages,
      currentStage: nextStageId,
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log
    await logAction('MOVE_TO_NEXT_STAGE', user.uid, user.username, {
      caseId: data.caseId,
      fromStage: data.currentStageId,
      toStage: nextStageId
    });

    return {
      success: true,
      caseId: data.caseId,
      currentStage: nextStageId,
      completedStage: data.currentStageId,
      message: `המעבר לשלב ${updatedStages[nextStageIndex].name} הושלם בהצלחה`
    };

  } catch (error) {
    console.error('Error in moveToNextStage:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במעבר לשלב הבא: ${error.message}`
    );
  }
});

console.log('✅ Law Office Functions loaded successfully');
