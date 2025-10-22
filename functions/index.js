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
  const caseRef = db.collection('cases').doc(caseId);
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
      // ✅ NEW ARCHITECTURE: תוכנית שעות עם services[] + packages[]
      const now = new Date().toISOString();
      const serviceId = `srv_${Date.now()}`;
      const packageId = `pkg_${Date.now()}`;

      caseData.services = [
        {
          id: serviceId,
          type: 'hours',
          name: data.serviceName || 'תוכנית שעות ראשית',
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
      caseData.totalHours = data.totalHours;
      caseData.hoursRemaining = data.totalHours;
      caseData.minutesRemaining = data.totalHours * 60;

      caseData.totalServices = 1;
      caseData.activeServices = 1;
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
 * ✅ NEW: הוספת שירות חדש לתיק קיים
 * מאפשר ללקוח לקנות שירות נוסף (תוכנית שעות נוספת, הליך משפטי וכו')
 */
exports.addServiceToCase = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.caseId || typeof data.caseId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה תיק חובה'
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

    // שליפת התיק
    const caseRef = db.collection('cases').doc(data.caseId);
    const caseDoc = await caseRef.get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'תיק לא נמצא'
      );
    }

    const caseData = caseDoc.data();
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
      newService.stages = []; // יש להוסיף לוגיקה מלאה לשלבים
    }

    // הוספת השירות למערך services[]
    const services = caseData.services || [];
    services.push(newService);

    // עדכון התיק
    const updates = {
      services: services,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username
    };

    await caseRef.update(updates);

    // Audit log
    await logAction('ADD_SERVICE_TO_CASE', user.uid, user.username, {
      caseId: data.caseId,
      serviceId: serviceId,
      serviceType: data.serviceType,
      serviceName: newService.name
    });

    return {
      success: true,
      serviceId: serviceId,
      service: newService,
      message: `שירות "${newService.name}" נוסף בהצלחה`
    };

  } catch (error) {
    console.error('Error in addServiceToCase:', error);

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
 * ✅ NEW: הוספת חבילת שעות לשירות קיים
 * מאפשר ללקוח לרכוש שעות נוספות לשירות ספציפי
 */
exports.addPackageToService = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.caseId || typeof data.caseId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה תיק חובה'
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

    // שליפת התיק
    const caseRef = db.collection('cases').doc(data.caseId);
    const caseDoc = await caseRef.get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'תיק לא נמצא'
      );
    }

    const caseData = caseDoc.data();
    const services = caseData.services || [];

    // מציאת השירות
    const serviceIndex = services.findIndex(s => s.id === data.serviceId);

    if (serviceIndex === -1) {
      throw new functions.https.HttpsError(
        'not-found',
        'שירות לא נמצא בתיק זה'
      );
    }

    const service = services[serviceIndex];

    // בדיקה שזה שירות שעות
    if (service.type !== 'hours') {
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
    await caseRef.update({
      services: services,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username
    });

    // Audit log
    await logAction('ADD_PACKAGE_TO_SERVICE', user.uid, user.username, {
      caseId: data.caseId,
      serviceId: data.serviceId,
      packageId: packageId,
      hours: data.hours,
      serviceName: service.name
    });

    return {
      success: true,
      packageId: packageId,
      package: newPackage,
      service: {
        id: service.id,
        name: service.name,
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

    // ✅ צריך לקבל לפחות clientId או caseId
    if (!data.clientId && !data.caseId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח או תיק'
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

    // בדיקה שהלקוח קיים (או שיש caseId)
    let clientDoc, clientData, caseData = null;

    if (data.caseId) {
      // אם יש תיק, טען אותו במקום הלקוח
      const caseDoc = await db.collection('cases').doc(data.caseId).get();
      if (!caseDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'תיק לא נמצא'
        );
      }
      caseData = caseDoc.data();

      // טען את הלקוח מהתיק
      clientDoc = await db.collection('clients').doc(caseData.clientId).get();
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'לקוח לא נמצא'
        );
      }
      clientData = clientDoc.data();
    } else if (data.clientId) {
      // אם אין תיק, זה המבנה הישן - טען לקוח רגיל
      clientDoc = await db.collection('clients').doc(data.clientId).get();
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'לקוח לא נמצא'
        );
      }
      clientData = clientDoc.data();
    } else {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח או תיק'
      );
    }

    // ✅ כל עובד יכול ליצור משימות עבור כל לקוח במשרד
    // אין צורך בבדיקת הרשאות נוספת

    // יצירת המשימה
    const finalClientId = caseData ? caseData.clientId : data.clientId;

    // DEBUG: בדיקה מה יש ב-caseData
    console.log('🔍 DEBUG createBudgetTask:', {
      hasCaseData: !!caseData,
      caseDataClientId: caseData?.clientId,
      dataClientId: data.clientId,
      finalClientId: finalClientId
    });

    if (!finalClientId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `לא ניתן לזהות את הלקוח. caseData.clientId=${caseData?.clientId}, data.clientId=${data.clientId}`
      );
    }

    const taskData = {
      description: sanitizeString(data.description.trim()),
      clientId: finalClientId,
      clientName: clientData.clientName || clientData.fullName || data.clientName, // תמיכה בשני המבנים
      caseId: data.caseId || null, // ✅ תמיכה בתיקים
      caseTitle: data.caseTitle || data.caseNumber || null, // ✅ שם התיק או מספר תיק
      caseNumber: data.caseNumber || null, // ✅ מספר תיק
      serviceId: data.serviceId || null, // ✅ תמיכה בבחירת שירות ספציפי
      estimatedHours: estimatedHours, // ✅ ממוHours
      estimatedMinutes: estimatedMinutes, // ✅ נשמור גם דקות
      actualHours: 0,
      actualMinutes: 0,
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

    // ✅ שימוש ב-increment() למניעת race conditions
    // זה מבטיח שהעדכון אטומי גם בעומס גבוה של משתמשים
    await db.collection('budget_tasks').doc(data.taskId).update({
      actualHours: admin.firestore.FieldValue.increment(data.minutes / 60),
      actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
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

    // קריאת הערכים המעודכנים מהשרת
    const updatedTaskDoc = await db.collection('budget_tasks').doc(data.taskId).get();
    const updatedTaskData = updatedTaskDoc.data();

    return {
      success: true,
      taskId: data.taskId,
      newActualHours: updatedTaskData.actualHours,
      newActualMinutes: updatedTaskData.actualMinutes
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
      status: 'הושלם',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedBy: user.username,
      completionNotes: data.completionNotes ? sanitizeString(data.completionNotes) : '',
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ משימה סומנה כהושלמה: ${data.taskId}`);
    console.log(`ℹ️ קיזוז שעות כבר בוצע בעת רישום השעתון (createTimesheetEntry)`);

    // Audit log
    await logAction('COMPLETE_TASK', user.uid, user.username, {
      taskId: data.taskId,
      actualMinutes: taskData.actualMinutes || 0
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

    // ✅ NEW: טיפול בפעילות פנימית
    let finalClientId = data.clientId;
    let finalCaseId = data.caseId;
    let finalClientName = data.clientName;

    if (data.isInternal === true) {
      // יצירה/קבלת תיק פנימי אוטומטית
      const internalCase = await getOrCreateInternalCase(user.username);

      finalClientId = internalCase.clientId;
      finalCaseId = internalCase.id;
      finalClientName = internalCase.clientName;

      console.log(`📝 רישום פנימי עבור ${user.username} → תיק ${finalCaseId}`);
    }

    // Validation
    if (!finalClientId) {
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

    // בדיקה שהלקוח קיים (רק אם לא פנימי)
    if (data.isInternal !== true) {
      const clientDoc = await db.collection('clients').doc(finalClientId).get();

      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'לקוח לא נמצא'
        );
      }

      const clientData = clientDoc.data();
      if (!finalClientName) {
        finalClientName = clientData.clientName || clientData.fullName;
      }
    }

    // ✅ כל עובד יכול לרשום שעות עבור כל לקוח במשרד
    // אין צורך בבדיקת הרשאות נוספת

    // יצירת רישום
    const entryData = {
      clientId: finalClientId,
      clientName: finalClientName,
      caseId: finalCaseId || null,
      caseTitle: data.caseTitle || null,
      date: data.date,
      minutes: data.minutes,
      hours: data.minutes / 60,
      action: sanitizeString(data.action.trim()),
      employee: user.username,
      lawyer: user.username,
      isInternal: data.isInternal === true, // ✅ NEW: סימון רישום פנימי
      createdBy: user.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('timesheet_entries').add(entryData);

    // ✅ NEW: אם הרישום קשור למשימת תקציב, עדכן את הזמן בפועל
    if (data.taskId) {
      try {
        const taskRef = db.collection('budget_tasks').doc(data.taskId);
        const taskDoc = await taskRef.get();

        if (taskDoc.exists) {
          const taskData = taskDoc.data();
          const currentActualHours = taskData.actualHours || 0;
          const newActualHours = currentActualHours + (data.minutes / 60);

          await taskRef.update({
            actualHours: newActualHours,
            actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
            lastModifiedBy: user.username,
            lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ עודכן actualHours של משימה ${data.taskId}: ${currentActualHours} → ${newActualHours}`);
        }
      } catch (error) {
        console.error(`⚠️ שגיאה בעדכון משימה ${data.taskId}:`, error);
        // לא נכשיל את כל הפעולה בגלל זה
      }
    }

    // ✅ NEW: קיזוז שעות מהתיק (רק תיקים שעתיים, לא פנימיים)
    if (finalCaseId && data.isInternal !== true) {
      try {
        const caseDoc = await db.collection('cases').doc(finalCaseId).get();

        if (caseDoc.exists) {
          const caseData = caseDoc.data();

          // קיזוז רק מתיקים שעתיים
          if (caseData.procedureType === 'hours') {
            await caseDoc.ref.update({
              minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
              hoursRemaining: admin.firestore.FieldValue.increment(-data.minutes / 60),
              lastActivity: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ קוזזו ${data.minutes} דקות מתיק ${finalCaseId} (${caseData.caseNumber})`);
          } else {
            console.log(`ℹ️ תיק ${caseData.caseNumber} מסוג ${caseData.procedureType} - אין קיזוז`);
          }
        }
      } catch (error) {
        console.error(`⚠️ שגיאה בקיזוז שעות מתיק ${finalCaseId}:`, error);
        // לא נכשיל את כל הפעולה בגלל זה
      }
    } else if (data.isInternal === true) {
      console.log(`ℹ️ רישום פנימי - לא נדרש קיזוז שעות`);
    }

    // Audit log
    await logAction('CREATE_TIMESHEET_ENTRY', user.uid, user.username, {
      entryId: docRef.id,
      clientId: finalClientId,
      caseId: finalCaseId,
      isInternal: data.isInternal === true,
      minutes: data.minutes,
      date: data.date,
      taskId: data.taskId || null
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

// ===============================
// Advanced Migration Function
// ===============================

/**
 * מיגרציה מקצועית: clients → cases
 *
 * הפונקציה הזו:
 * 1. טוענת את כל הלקוחות מ-clients collection
 * 2. יוצרת תיק (case) חדש לכל לקוח
 * 3. מעתיקה את כל הנתונים הרלוונטיים
 * 4. עושה קישור אחורה (מהתיק ללקוח)
 * 5. עוקבת אחרי כפילויות ושגיאות
 *
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

console.log('✅ Law Office Functions loaded successfully');
