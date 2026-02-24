/** Clients Module — ניהול לקוחות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString, isValidIsraeliPhone, isValidEmail } = require('../shared/validators');
const { generateCaseNumberWithTransaction } = require('../case-number-transaction');

const db = admin.firestore();

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
