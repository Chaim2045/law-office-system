/** Services Module — ניהול שירותים */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString } = require('../shared/validators');

const db = admin.firestore();

// ===============================
// Service Management Functions
// ===============================

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
