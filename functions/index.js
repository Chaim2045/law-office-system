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

/**
 * מוצא את החבילה הפעילה בשלב
 * חבילה פעילה = status: 'active' וגם hoursRemaining > 0
 *
 * @param {Object} stage - אובייקט השלב
 * @returns {Object|null} - החבילה הפעילה או null
 */
function getActivePackage(stage) {
  if (!stage.packages || stage.packages.length === 0) {
    return null;
  }

  // מחפש את החבילה הראשונה שפעילה ויש לה שעות
  const activePackage = stage.packages.find(pkg =>
    pkg.status === 'active' && (pkg.hoursRemaining || 0) > 0
  );

  return activePackage || null;
}

/**
 * סוגר חבילה אוטומטית אם היא התרוקנה
 *
 * @param {Object} package - אובייקט החבילה
 * @returns {Object} - החבילה המעודכנת
 */
function closePackageIfDepleted(package) {
  if (package.hoursRemaining <= 0 && package.status === 'active') {
    package.status = 'depleted';
    package.closedDate = new Date().toISOString();
    console.log(`📦 חבילה ${package.id} נסגרה (אזלו השעות)`);
  }
  return package;
}

/**
 * מקזז שעות מחבילה ספציפית
 * מעדכן: hoursUsed, hoursRemaining
 * סוגר את החבילה אם התרוקנה
 *
 * @param {Object} package - החבילה לקזז ממנה
 * @param {number} hoursToDeduct - כמה שעות לקזז
 * @returns {Object} - החבילה המעודכנת
 */
function deductHoursFromPackage(package, hoursToDeduct) {
  package.hoursUsed = (package.hoursUsed || 0) + hoursToDeduct;
  package.hoursRemaining = (package.hoursRemaining || 0) - hoursToDeduct;

  // סגירה אוטומטית אם התרוקנה
  if (package.hoursRemaining <= 0) {
    package.status = 'depleted';
    package.closedDate = new Date().toISOString();
    console.log(`📦 חבילה ${package.id} נסגרה אוטומטית (${package.hoursUsed}/${package.hours} שעות נוצלו)`);
  }

  return package;
}

/**
 * 🎯 יצירת מספר תיק אוטומטי
 * פורמט: שנה + מספר סידורי (2025001, 2025002...)
 *
 * @returns {Promise<string>} - מספר תיק חדש וייחודי
 */
async function generateCaseNumber() {
  const currentYear = new Date().getFullYear();
  const yearPrefix = currentYear.toString();

  try {
    // קריאת כל הלקוחות כדי למצוא את המספר הגבוה ביותר
    const clientsSnapshot = await db.collection('clients')
      .orderBy('caseNumber', 'desc')
      .limit(1)
      .get();

    let nextNumber = 1; // ברירת מחדל

    if (!clientsSnapshot.empty) {
      const lastCaseNumber = clientsSnapshot.docs[0].data().caseNumber;

      if (lastCaseNumber && typeof lastCaseNumber === 'string') {
        // חילוץ המספר הסידורי (3 הספרות האחרונות)
        const lastSequential = parseInt(lastCaseNumber.slice(-3));

        // אם המספר מהשנה הנוכחית, נמשיך את הסדרה
        if (lastCaseNumber.startsWith(yearPrefix)) {
          nextNumber = lastSequential + 1;
        }
        // אחרת (שנה חדשה), נתחיל מ-1
      }
    }

    // יצירת מספר תיק: שנה + 3 ספרות סידוריות
    const caseNumber = `${yearPrefix}${nextNumber.toString().padStart(3, '0')}`;

    // בדיקת ייחודיות (למקרה של race condition)
    const existingDoc = await db.collection('clients').doc(caseNumber).get();
    if (existingDoc.exists) {
      console.warn(`⚠️ מספר תיק ${caseNumber} כבר קיים! מנסה שוב...`);
      // רקורסיה - ננסה שוב (במקרה נדיר של התנגשות)
      return await generateCaseNumber();
    }

    console.log(`✅ נוצר מספר תיק חדש: ${caseNumber}`);
    return caseNumber;

  } catch (error) {
    console.error('❌ שגיאה ביצירת מספר תיק:', error);

    // Fallback: שנה + timestamp (למקרה של שגיאה)
    const fallbackNumber = `${yearPrefix}${Date.now().toString().slice(-3)}`;
    console.warn(`⚠️ שימוש במספר fallback: ${fallbackNumber}`);
    return fallbackNumber;
  }
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
      phone: data.phone ? sanitizeString(data.phone.trim()) : '',
      email: data.email ? sanitizeString(data.email.trim()) : '',

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

      clientData.services = [
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

      if (data.pricingType === 'hourly') {
        // ✅ תמחור שעתי - שלבים עם שעות וחבילות
        clientData.stages = [
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
                purchaseDate: now,
                status: 'active'
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
                purchaseDate: now,
                status: 'active'
              }
            ]
          }
        ];

        // חישוב סה"כ שעות בהליך
        const totalProcedureHours = data.stages.reduce((sum, s) => sum + s.hours, 0);
        clientData.totalHours = totalProcedureHours;
        clientData.hoursRemaining = totalProcedureHours;
        clientData.minutesRemaining = totalProcedureHours * 60;

      } else if (data.pricingType === 'fixed') {
        // ✅ תמחור פיקס - שלבים עם מחירים קבועים
        clientData.stages = [
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
        clientData.totalFixedPrice = totalFixedPrice;
        clientData.totalPaid = 0;
        clientData.remainingBalance = totalFixedPrice;
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

    return {
      success: true,
      caseNumber: caseNumber,  // ✅ מספר תיק = מזהה
      clientId: caseNumber,    // ✅ לתאימות לאחור
      client: {
        id: caseNumber,
        caseNumber: caseNumber,
        ...clientData
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
    const updates = {
      services: services,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
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
    await clientRef.update({
      services: services,
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
      serviceName: service.name
    });

    console.log(`✅ Added package ${packageId} (${data.hours}h) to service ${data.serviceId} for client ${clientId}`);

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

    // ✅ בדיקה שהלקוח קיים (במבנה החדש: clientId = caseNumber = Document ID)
    const clientDoc = await db.collection('clients').doc(clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `לקוח ${clientId} לא נמצא`
      );
    }

    const clientData = clientDoc.data();

    // ✅ כל עובד יכול ליצור משימות עבור כל לקוח במשרד
    // אין צורך בבדיקת הרשאות נוספת

    // ✅ בדיקת סניף מטפל
    if (!data.branch || typeof data.branch !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור סניף מטפל'
      );
    }

    console.log(`✅ Creating task for client ${clientId} (${clientData.clientName})`);

    // 🆕 Phase 1: שמירת ערכים מקוריים (לא ישתנו לעולם)
    const deadlineTimestamp = data.deadline ? admin.firestore.Timestamp.fromDate(new Date(data.deadline)) : null;

    const taskData = {
      description: sanitizeString(data.description.trim()),
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

      status: 'active',
      deadline: deadlineTimestamp,
      employee: user.email, // ✅ EMAIL for security rules and queries
      lawyer: user.username, // ✅ Username for display
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
      clientId: clientId,
      caseNumber: clientData.caseNumber,
      estimatedHours: estimatedHours
    });

    console.log(`✅ Created task ${docRef.id} for client ${clientId}`);

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
    if (taskData.employee !== user.email && user.role !== 'admin') { // ✅ Check by EMAIL
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין הרשאה להוסיף זמן למשימה זו'
      );
    }

    // הוספת הזמן
    // 🆕 Phase 1: חישוב מצב תקציב אחרי ההוספה
    const newActualMinutes = (taskData.actualMinutes || 0) + data.minutes;
    const currentEstimate = taskData.estimatedMinutes || 0;
    const percentOfBudget = currentEstimate > 0 ? Math.round((newActualMinutes / currentEstimate) * 100) : 0;
    const isOverBudget = newActualMinutes > currentEstimate;
    const overageMinutes = Math.max(0, newActualMinutes - currentEstimate);

    // ✅ תיקון: אי אפשר להשתמש ב-serverTimestamp() בתוך array
    // נשתמש ב-Date object רגיל במקום
    const timeEntry = {
      date: data.date,
      minutes: data.minutes,
      hours: data.minutes / 60,
      description: data.description ? sanitizeString(data.description) : '',
      addedBy: user.username,
      addedAt: new Date().toISOString(),  // ✅ ISO string במקום Timestamp

      // 🆕 Phase 1: מידע על מצב התקציב בזמן ההוספה
      budgetStatus: {
        currentEstimate,
        totalMinutesAfter: newActualMinutes,
        percentOfBudget,
        isOverBudget,
        overageMinutes
      }
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

    // ✨ יצירת שעתון אוטומטית (CLIENT = CASE)
    // כשמוסיפים זמן למשימה, זה אוטומטית גם נרשם בשעתון
    const timesheetEntry = {
      clientId: taskData.clientId,  // ✅ מספר תיק (caseNumber)
      clientName: taskData.clientName,
      caseNumber: taskData.caseNumber || taskData.clientId,  // ✅ מספר תיק
      serviceId: taskData.serviceId || null,  // ✅ שירות ספציפי
      serviceName: taskData.serviceName || null,  // ✅ שם השירות
      serviceType: taskData.serviceType || null,  // ✅ סוג השירות (legal_procedure/hours)
      parentServiceId: taskData.parentServiceId || null,  // ✅ service.id עבור הליך משפטי
      taskId: data.taskId,
      taskDescription: taskData.description,
      date: data.date,
      minutes: data.minutes,
      hours: data.minutes / 60,
      action: data.description || taskData.description,
      employee: user.email,
      lawyer: user.username,
      isInternal: false,
      autoGenerated: true,  // ✅ מסומן כאוטומטי
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: user.username
    };

    await db.collection('timesheet_entries').add(timesheetEntry);
    console.log(`✅ רישום זמן נוצר אוטומטית בשעתון עבור משימה ${data.taskId}`);

    // ✅ קיזוז שעות מהלקוח (CLIENT = CASE)
    // במבנה החדש: clientId = caseNumber = Document ID
    if (taskData.clientId) {
      try {
        const clientDoc = await db.collection('clients').doc(taskData.clientId).get();

        if (clientDoc.exists) {
          const clientData = clientDoc.data();
          const hoursWorked = data.minutes / 60;

          // ✅ לקוח שעתי - מציאת החבילה הפעילה
          if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
            // 🎯 מציאת השירות הספציפי לפי serviceId (לא תמיד הראשון!)
            let service = null;

            if (taskData.serviceId) {
              // מציאת השירות שנבחר במשימה
              service = clientData.services.find(s => s.id === taskData.serviceId);

              if (!service) {
                console.warn(`⚠️ שירות ${taskData.serviceId} לא נמצא עבור לקוח ${clientData.caseNumber}! משתמש בשירות הראשון`);
                service = clientData.services[0];
              }
            } else {
              // Fallback למשימות ישנות ללא serviceId
              service = clientData.services[0];
              console.log(`ℹ️ משימה ללא serviceId - משתמש בשירות הראשון`);
            }

            if (!service) {
              console.error(`❌ לא נמצא שירות עבור לקוח ${clientData.caseNumber}`);
              return;
            }

            const activePackage = getActivePackage(service);

            if (activePackage) {
              // קיזוז מהחבילה הפעילה
              deductHoursFromPackage(activePackage, hoursWorked);

              // עדכון הלקוח
              await clientDoc.ref.update({
                services: clientData.services,
                minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                lastActivity: admin.firestore.FieldValue.serverTimestamp()
              });

              console.log(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מחבילה ${activePackage.id} של שירות ${service.name || service.id} (${activePackage.hoursUsed}/${activePackage.hours})`);
            } else {
              console.warn(`⚠️ שירות ${service.name || service.id} עבור לקוח ${clientData.caseNumber} - אין חבילה פעילה!`);
            }
          }
          // ✅ הליך משפטי - תמחור שעתי (עם חבילות!)
          else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'hourly') {
            // מציאת השלב הנוכחי
            // ✅ FIX: Use serviceId from task if provided (the specific stage), otherwise use currentStage
            const currentStageId = taskData.serviceId || clientData.currentStage || 'stage_a';
            const stages = clientData.stages || [];
            const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

            if (currentStageIndex !== -1) {
              const currentStage = stages[currentStageIndex];

              // מציאת החבילה הפעילה בשלב
              const activePackage = getActivePackage(currentStage);

              if (activePackage) {
                // קיזוז מהחבילה הפעילה
                deductHoursFromPackage(activePackage, hoursWorked);

                // עדכון השלב
                stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
                stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;

                // עדכון הלקוח
                await clientDoc.ref.update({
                  stages: stages,
                  hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                  minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                  lastActivity: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name}, חבילה ${activePackage.id}`);
              } else {
                console.warn(`⚠️ ${currentStage.name} אין חבילה פעילה! (אזלו כל החבילות)`);
              }
            } else {
              console.warn(`⚠️ שלב ${targetStageId} לא נמצא עבור לקוח ${clientData.caseNumber}`);
            }
          }
          // ✅ הליך משפטי - תמחור פיקס (מעקב שעות בלבד)
          else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'fixed') {
            // ✅ FIX: Use serviceId from task if provided, otherwise use currentStage
            const targetStageId = data.serviceId || clientData.currentStage || 'stage_a';
            const stages = clientData.stages || [];
            const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

            if (currentStageIndex !== -1) {
              const currentStage = stages[currentStageIndex];

              // עדכון מעקב שעות בלבד (לא קיזוז - זה מחיר קבוע!)
              stages[currentStageIndex].hoursWorked = (currentStage.hoursWorked || 0) + hoursWorked;
              stages[currentStageIndex].totalHoursWorked = (currentStage.totalHoursWorked || 0) + hoursWorked;

              await clientDoc.ref.update({
                stages: stages,
                totalHoursWorked: admin.firestore.FieldValue.increment(hoursWorked),
                lastActivity: admin.firestore.FieldValue.serverTimestamp()
              });

              console.log(`✅ נרשמו ${hoursWorked.toFixed(2)} שעות ל${currentStage.name} (מחיר קבוע)`);
            }
          }
          // ❓ סוג לא מוכר
          else {
            console.log(`ℹ️ לקוח ${clientData.caseNumber} מסוג ${clientData.procedureType} - אין מעקב שעות`);
          }
        }
      } catch (error) {
        console.error(`⚠️ שגיאה בקיזוז שעות מלקוח ${taskData.clientId}:`, error);
        // לא נכשיל את כל הפעולה בגלל זה
      }
    }

    // Audit log
    await logAction('ADD_TIME_TO_TASK', user.uid, user.username, {
      taskId: data.taskId,
      minutes: data.minutes,
      date: data.date,
      autoTimesheetCreated: true,
      clientUpdated: true
    });

    // קריאת הערכים המעודכנים מהשרת
    const updatedTaskDoc = await db.collection('budget_tasks').doc(data.taskId).get();
    const updatedTaskData = updatedTaskDoc.data();

    return {
      success: true,
      taskId: data.taskId,
      newActualHours: updatedTaskData.actualHours,
      newActualMinutes: updatedTaskData.actualMinutes,
      timesheetAutoCreated: true  // ✅ מחזיר למשתמש שנוצר שעתון
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

    if (taskData.employee !== user.email && user.role !== 'admin') { // ✅ Check by EMAIL
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

    // בדיקה שהמשימה קיימת
    const taskDoc = await db.collection('budget_tasks').doc(data.taskId).get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'משימה לא נמצאה'
      );
    }

    const taskData = taskDoc.data();

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

    const oldEstimate = taskData.estimatedMinutes || 0;
    const addedMinutes = data.newEstimate - oldEstimate;

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

    // עדכון המשימה
    await db.collection('budget_tasks').doc(data.taskId).update({
      estimatedMinutes: data.newEstimate,
      estimatedHours: data.newEstimate / 60,
      budgetAdjustments: admin.firestore.FieldValue.arrayUnion(adjustment),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ תקציב משימה ${data.taskId} עודכן מ-${oldEstimate} ל-${data.newEstimate} דקות`);

    // Audit log
    await logAction('ADJUST_BUDGET', user.uid, user.username, {
      taskId: data.taskId,
      oldEstimate,
      newEstimate: data.newEstimate,
      addedMinutes,
      reason: data.reason
    });

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

      // ✅ NEW: חובה לקשר למשימה לרישום זמן על לקוח
      if (!data.taskId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `❌ חובה לבחור משימה לרישום זמן על לקוח!

אם אין משימה קיימת - צור משימה חדשה תחילה.

זה מבטיח מעקב מלא ומדויק אחר כל העבודה.`
        );
      }
    }

    // ✅ כל עובד יכול לרשום שעות עבור כל לקוח במשרד
    // אין צורך בבדיקת הרשאות נוספת

    // יצירת רישום (CLIENT = CASE)
    const entryData = {
      clientId: finalClientId,  // ✅ מספר תיק (caseNumber)
      clientName: finalClientName,
      caseNumber: data.caseNumber || finalClientId,  // ✅ מספר תיק
      serviceId: data.serviceId || null,  // ✅ שירות ספציפי
      serviceName: data.serviceName || null,  // ✅ שם השירות
      serviceType: data.serviceType || null, // ✅ סוג השירות (legal_procedure/hours)
      parentServiceId: data.parentServiceId || null, // ✅ service.id עבור הליך משפטי
      stageId: null,  // ✅ יעודכן אחר כך אם זה הליך משפטי
      packageId: null, // ✅ יעודכן אחר כך אם זה חבילת שעות
      date: data.date,
      minutes: data.minutes,
      hours: data.minutes / 60,
      action: sanitizeString(data.action.trim()),
      employee: user.email, // ✅ EMAIL for security rules and queries
      lawyer: user.username, // ✅ Username for display
      isInternal: data.isInternal === true, // ✅ NEW: סימון רישום פנימי
      createdBy: user.username, // ✅ Username for display
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    };

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

    // ✅ קיזוז שעות מהלקוח (CLIENT = CASE)
    if (finalClientId && data.isInternal !== true) {
      try {
        const clientDoc = await db.collection('clients').doc(finalClientId).get();

        if (clientDoc.exists) {
          const clientData = clientDoc.data();
          const hoursWorked = data.minutes / 60;
          let updatedStageId = null;
          let updatedPackageId = null;

          // ✅ לקוח שעתי - מציאת החבילה הפעילה
          if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
            // 🎯 מציאת השירות הספציפי לפי serviceId (לא תמיד הראשון!)
            let service = null;

            if (data.serviceId) {
              // מציאת השירות שנבחר ברישום הזמן
              service = clientData.services.find(s => s.id === data.serviceId);

              if (!service) {
                console.warn(`⚠️ שירות ${data.serviceId} לא נמצא עבור לקוח ${clientData.caseNumber}! משתמש בשירות הראשון`);
                service = clientData.services[0];
              }
            } else {
              // Fallback לרישומים ישנים ללא serviceId
              service = clientData.services[0];
              console.log(`ℹ️ רישום ללא serviceId - משתמש בשירות הראשון`);
            }

            if (!service) {
              console.error(`❌ לא נמצא שירות עבור לקוח ${clientData.caseNumber}`);
              return;
            }

            const activePackage = getActivePackage(service);

            if (activePackage) {
              // קיזוז מהחבילה הפעילה
              deductHoursFromPackage(activePackage, hoursWorked);
              updatedPackageId = activePackage.id;

              // עדכון הלקוח
              await clientDoc.ref.update({
                services: clientData.services,
                minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                lastActivity: admin.firestore.FieldValue.serverTimestamp()
              });

              console.log(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מחבילה ${activePackage.id} של שירות ${service.name || service.id} (${activePackage.hoursUsed}/${activePackage.hours})`);
            } else {
              console.warn(`⚠️ לקוח ${clientData.caseNumber} - אין חבילה פעילה!`);
            }
          }
          // ✅ NEW: הליך משפטי כשירות (Architecture v2.0)
          else if (data.serviceType === 'legal_procedure' && data.parentServiceId) {
            console.log(`🆕 [v2.0] הליך משפטי כשירות - parentServiceId: ${data.parentServiceId}, stageId: ${data.serviceId}`);

            // מציאת השירות בתוך services array
            const service = clientData.services?.find(s => s.id === data.parentServiceId);

            if (service && service.type === 'legal_procedure') {
              // מציאת השלב בתוך השירות
              const targetStageId = data.serviceId || service.currentStage || 'stage_a';
              const stages = service.stages || [];
              const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

              if (currentStageIndex !== -1) {
                const currentStage = stages[currentStageIndex];
                updatedStageId = currentStage.id;

                // מציאת החבילה הפעילה בשלב
                const activePackage = getActivePackage(currentStage);

                if (activePackage) {
                  // קיזוז מהחבילה הפעילה
                  deductHoursFromPackage(activePackage, hoursWorked);
                  updatedPackageId = activePackage.id;

                  // עדכון השלב
                  stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
                  stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;

                  // עדכון השירות בתוך services array
                  service.stages = stages;

                  // עדכון הלקוח
                  await clientDoc.ref.update({
                    services: clientData.services,
                    hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                    minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                    lastActivity: admin.firestore.FieldValue.serverTimestamp()
                  });

                  console.log(`✅ [v2.0] קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name} של ${service.name}, חבילה ${activePackage.id}`);
                } else {
                  console.warn(`⚠️ ${currentStage.name} אין חבילה פעילה! (אזלו כל החבילות)`);
                }
              } else {
                console.warn(`⚠️ שלב ${targetStageId} לא נמצא בשירות ${service.name}`);
              }
            } else {
              console.warn(`⚠️ שירות ${data.parentServiceId} לא נמצא או אינו הליך משפטי`);
            }
          }
          // ✅ הליך משפטי - תמחור שעתי (עם חבילות!) [LEGACY - case level]
          else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'hourly') {
            // ✅ FIX: Use serviceId from task if provided, otherwise use currentStage
            // This ensures hours are deducted from the correct stage that the task was created for
            const targetStageId = data.serviceId || clientData.currentStage || 'stage_a';
            const stages = clientData.stages || [];
            const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

            if (currentStageIndex !== -1) {
              const currentStage = stages[currentStageIndex];
              updatedStageId = currentStage.id;

              // מציאת החבילה הפעילה בשלב
              const activePackage = getActivePackage(currentStage);

              if (activePackage) {
                // קיזוז מהחבילה הפעילה
                deductHoursFromPackage(activePackage, hoursWorked);
                updatedPackageId = activePackage.id;

                // עדכון השלב
                stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
                stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;

                // עדכון הלקוח
                await clientDoc.ref.update({
                  stages: stages,
                  hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
                  minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
                  lastActivity: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name}, חבילה ${activePackage.id}`);
              } else {
                console.warn(`⚠️ ${currentStage.name} אין חבילה פעילה! (אזלו כל החבילות)`);
              }
            } else {
              console.warn(`⚠️ שלב ${targetStageId} לא נמצא עבור לקוח ${clientData.caseNumber}`);
            }
          }
          // ✅ הליך משפטי - תמחור פיקס (מעקב שעות בלבד)
          else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'fixed') {
            // ✅ FIX: Use serviceId from task if provided, otherwise use currentStage
            const targetStageId = data.serviceId || clientData.currentStage || 'stage_a';
            const stages = clientData.stages || [];
            const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

            if (currentStageIndex !== -1) {
              const currentStage = stages[currentStageIndex];
              updatedStageId = currentStage.id;

              // עדכון מעקב שעות בלבד (לא קיזוז - זה מחיר קבוע!)
              stages[currentStageIndex].hoursWorked = (currentStage.hoursWorked || 0) + hoursWorked;
              stages[currentStageIndex].totalHoursWorked = (currentStage.totalHoursWorked || 0) + hoursWorked;

              await clientDoc.ref.update({
                stages: stages,
                totalHoursWorked: admin.firestore.FieldValue.increment(hoursWorked),
                lastActivity: admin.firestore.FieldValue.serverTimestamp()
              });

              console.log(`✅ נרשמו ${hoursWorked.toFixed(2)} שעות ל${currentStage.name} (מחיר קבוע)`);
            }
          }
          // ❓ סוג לא מוכר
          else {
            console.log(`ℹ️ לקוח ${clientData.caseNumber} מסוג ${clientData.procedureType} - אין מעקב שעות`);
          }

          // ✅ עדכון entryData עם הקישורים
          entryData.stageId = updatedStageId;
          entryData.packageId = updatedPackageId;
        }
      } catch (error) {
        console.error(`⚠️ שגיאה בקיזוז שעות מלקוח ${finalClientId}:`, error);
        // לא נכשיל את כל הפעולה בגלל זה
      }
    } else if (data.isInternal === true) {
      console.log(`ℹ️ רישום פנימי - לא נדרש קיזוז שעות`);
    }

    // ✅ שמירת הרישום (עכשיו עם stageId ו-packageId!)
    const docRef = await db.collection('timesheet_entries').add(entryData);

    // Audit log
    await logAction('CREATE_TIMESHEET_ENTRY', user.uid, user.username, {
      entryId: docRef.id,
      clientId: finalClientId,
      caseNumber: entryData.caseNumber,  // ✅ במבנה החדש: clientId = caseNumber
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
exports.dailyTaskReminders = functions.pubsub
  .schedule('0 9 * * *')  // כל יום בשעה 09:00
  .timeZone('Asia/Jerusalem')
  .onRun(async (context) => {
    try {
      console.log('🔔 Running dailyTaskReminders at', new Date().toISOString());

      const now = admin.firestore.Timestamp.now();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const threeDaysTimestamp = admin.firestore.Timestamp.fromDate(threeDaysFromNow);

      // מצא משימות פעילות עם deadline בתוך 3 ימים או שעבר
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'active')
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
exports.dailyBudgetWarnings = functions.pubsub
  .schedule('0 17 * * *')  // כל יום בשעה 17:00
  .timeZone('Asia/Jerusalem')
  .onRun(async (context) => {
    try {
      console.log('💰 Running dailyBudgetWarnings at', new Date().toISOString());

      // מצא משימות פעילות
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'active')
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
const { adminTransferUserData } = require('./admin/transfer-user-data');
const { adminGetUserFullDetails } = require('./admin/get-user-full-details');
const { adminGenerateClientReport } = require('./admin/generate-client-report');
const { adminUpdateClientFull } = require('./admin/update-client-full');

// Import Master Admin Panel Phase 4 Wrappers (for Phase 3 UI)
const {
  createUser,
  updateUser,
  blockUser,
  deleteUser,
  getUserFullDetails,
  adminUpdateTask
} = require('./admin/master-admin-wrappers');

// Export admin functions
exports.adminTransferUserData = adminTransferUserData;
exports.adminGetUserFullDetails = adminGetUserFullDetails;
exports.adminGenerateClientReport = adminGenerateClientReport;
exports.adminUpdateClientFull = adminUpdateClientFull;

// Export Master Admin Panel Phase 4 Wrappers (Simple names for UI)
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.blockUser = blockUser;
exports.deleteUser = deleteUser;
exports.getUserFullDetails = getUserFullDetails;
exports.adminUpdateTask = adminUpdateTask;

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
// 🚨 NUCLEAR CLEANUP - Admin Only
// ═══════════════════════════════════════════════════════════════════════
const { nuclearCleanup } = require('./admin/nuclear-cleanup');
exports.nuclearCleanup = nuclearCleanup;

console.log('✅ Law Office Functions loaded successfully (including 10 Master Admin functions + Nuclear Cleanup + Data Fixes)');
