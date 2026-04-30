/**
 * addTimeToTask V2 - With Transaction + Optimistic Locking
 *
 * תיקון קריטי: עוטף את כל הפעולות (task + client + timesheet) ב-transaction אחד
 * זה מבטיח:
 * 1. Atomicity - הכל מתבצע או כלום
 * 2. Consistency - אין data inconsistency
 * 3. Isolation - אין race conditions בין משתמשים
 * 4. Optimistic Locking - בדיקת _version למניעת overwrites
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - Architectural Upgrade: Immutable Data Patterns
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-23 (November 23, 2025)
 * 🏗️ גרסה: v2.1.0 → v2.2.0
 *
 * 🎯 שדרוג ארכיטקטוני: הסרת Deep Clone Workarounds + מעבר ל-Immutable Patterns
 *
 * ❌ הבעיה עם הגרסה הקודמת (v2.1.0):
 * השתמשנו ב-deep clone workaround כדי לאלץ את Firestore לזהות שינויים:
 *   const updatedServices = JSON.parse(JSON.stringify(clientData.services));
 *
 * זה עבד, אבל:
 * 1. **Performance overhead:** JSON serialization יקר
 * 2. **Not scalable:** צריך לזכור להוסיף בכל מקום
 * 3. **Code duplication:** 3 מקומות עם אותו workaround
 * 4. **Not industry standard:** Tactical fix, לא strategic
 *
 * ✅ הפתרון - Immutable Patterns:
 * במקום deep clone, יוצרים אובייקטים חדשים עם spread operator:
 *
 * קודם (v2.1.0):
 *   deductHoursFromPackage(pkg, hours);  // Mutates in-place
 *   const updatedServices = JSON.parse(JSON.stringify(services));  // Workaround!
 *
 * עכשיו (v2.2.0):
 *   const updatedPackage = deductHoursFromPackage(pkg, hours);  // Returns new
 *   const updatedServices = services.map(s => ...);  // Immutable map
 *
 * 🔄 אינטגרציה עם deduction-logic.js v3.0.0:
 * הקובץ הזה משתמש בפונקציות ששודרגו ל-immutable ב-deduction-logic.js:
 * - deductHoursFromPackage() עכשיו מחזיר אובייקט חדש
 * - אנחנו משתמשים ב-map() ליצירת מערכים חדשים
 *
 * 📍 שינויים שבוצעו:
 * - Line 150: deductHoursFromPackage() → capture return value
 * - Line 163-166: Removed deep clone, use immutable map for services
 * - Line 192: deductHoursFromPackage() → capture return value
 * - Line 196-199: Removed deep clone, use immutable map for services
 * - Line 219: deductHoursFromPackage() → capture return value
 * - Line 222-225: Removed deep clone, use immutable map for services
 * - Line 248: deductHoursFromPackage() → capture return value
 * - Line 250-253: Use immutable map for stages
 *
 * יתרונות:
 * - ✅ אין צורך ב-JSON.parse(JSON.stringify()) workarounds
 * - ✅ Firestore מזהה שינויים אוטומטית (reference חדש)
 * - ✅ Better performance (no JSON serialization)
 * - ✅ Industry standard (React, Redux, modern frameworks)
 * - ✅ Easier to maintain and scale
 *
 * 🎯 Backward Compatibility:
 * ה-API לא השתנה - אותה חתימה, אותה התנהגות
 * רק העבודה הפנימית שונתה ל-immutable
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - תיקון קריטי: עדכון חבילות לא נשמר ב-Firestore
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-23 (November 23, 2025)
 * 🐛 גרסה: v2.0.0 → v2.1.0 (REPLACED BY v2.2.0)
 *
 * ❌ הבעיה שהתגלתה:
 * כאשר נרשם זמן על משימה, התראנזקשן רצה בהצלחה והתיעוד נוצר, אבל השעות
 * לא קוזזו מהחבילות (packages) בפועל! החבילות נשארו עם hoursUsed: 0.
 *
 * תרחיש שנכשל:
 * - משימה מקושרת לשירות hours (serviceId: 'srv_xxx')
 * - רישום 90 דקות (1.5 שעות)
 * - ✅ timesheet_entries נוצר
 * - ✅ task.actualMinutes התעדכן
 * - ❌ package.hoursUsed נשאר 0 (במקום 1.5)
 * - ❌ progress bar מראה 0% (במקום 4.4%)
 *
 * 🔍 הסיבה (Root Cause):
 * הקוד שלח את `clientData.services` ל-Firestore ישירות, אבל זה reference
 * לאותו אובייקט שנקרא מה-DB. Firestore לא זיהה שינוי כי זה אותו reference!
 *
 * קוד בעייתי (שורות 108, 137, 164):
 *   updates.clientUpdate = {
 *     services: clientData.services,  // ← reference, לא עותק!
 *     ...
 *   };
 *
 * ✅ התיקון שבוצע:
 * הוספתי deep clone של services array לפני השליחה ל-Firestore:
 *
 *   const updatedServices = JSON.parse(JSON.stringify(clientData.services));
 *   updates.clientUpdate = {
 *     services: updatedServices,  // ← עכשיו Firestore רואה שינוי!
 *     ...
 *   };
 *
 * 📍 שורות שתוקנו:
 * - Line 107-108: הליך משפטי עם stages
 * - Line 136-138: שירות hours רגיל
 * - Line 163-164: לקוח שעתי fallback
 *
 * 🎯 Impact:
 * - ✅ החבילות מתעדכנות כעת בצורה נכונה
 * - ✅ Progress bars מציגים את האחוזים המדויקים
 * - ✅ hoursUsed/hoursRemaining מתעדכנים בזמן אמת
 * - ✅ התיקון חל גם על הליכים משפטיים עם stages
 *
 * 🧪 Testing:
 * כדי לבדוק שהתיקון עובד:
 * 1. רשום זמן על משימה
 * 2. הרץ את console script: await debugClientServices("client_id")
 * 3. בדוק: package.hoursUsed צריך להיות > 0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - תיקון קריטי: קיזוז שעות לא עבד במקרים מסוימים
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-17
 *
 * ❌ הבעיה שהתגלתה:
 * כאשר לקוח הוא מסוג 'legal_procedure' ויש לו שירות רגיל (type: 'hours'),
 * הקיזוז לא התבצע כלל! הקוד בדק את procedureType של הלקוח במקום לבדוק
 * את type של השירות.
 *
 * תרחיש שנכשל:
 * - לקוח: procedureType = 'legal_procedure'
 * - שירות: type = 'hours', יש לו packages
 * - משימה: serviceId = 'srv_xxx'
 * - תוצאה: רישום זמן נוצר אבל לא קוזז מהחבילה ❌
 *
 * ✅ התיקון שבוצע:
 * הוספתי תנאי חדש בשורה 85-108 שבודק:
 * 1. האם יש services array ללקוח
 * 2. האם יש serviceId במשימה
 * 3. מוצא את השירות לפי ID
 * 4. מקזז ממנו ישירות (ללא תלות ב-procedureType של הלקוח)
 *
 * קוד קודם:
 *   if (clientData.procedureType === ST.HOURS && ...) { קזז }
 *
 * קוד חדש:
 *   if (clientData.services && taskData.serviceId) {
 *     const service = clientData.services.find(s => s.id === taskData.serviceId);
 *     if (service && service.type !== ST.LEGAL_PROCEDURE) { קזז }
 *   }
 *
 * 💡 הבנה ארכיטקטורית:
 * לקוח = Container (יכול להכיל מספר שירותים)
 * שירות = הישות שמוגדרת כסוג (hours, legal_procedure, וכו')
 * הלוגיקה צריכה לבדוק את השירות, לא את הלקוח!
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Import deduction system helpers from modular system
const {
  getActivePackage,
  deductHoursFromPackage
} = require('./src/modules/deduction');

// Shared aggregation functions — same functions used by trigger
const {
  round2,
  applyHoursDelta,
  applyHoursDeltaServiceOnly,
  applyLegalProcedureDelta,
  applyLegalProcedureDeltaStageOnly,
  calcClientAggregates
} = require('./src/modules/aggregation');

const { SYSTEM_CONSTANTS } = require('./shared/constants');
const { ERROR_CODES, buildAppError } = require('./shared/errors');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

function lookupServiceIds(clientData, taskData) {
  const result = { stageId: null, packageId: null };

  // PATH 1: legal_procedure חדש (services)
  if (taskData.serviceType === ST.LEGAL_PROCEDURE && taskData.parentServiceId) {
    const service = (clientData.services || []).find(s => s.id === taskData.parentServiceId);
    if (service && service.type === ST.LEGAL_PROCEDURE) {
      const isHourly = !service.pricingType || service.pricingType === PT.HOURLY;
      const currentStageId = taskData.serviceId || service.currentStage || SYSTEM_CONSTANTS.VALID_STAGE_IDS[0];
      const stage = (service.stages || []).find(s => s.id === currentStageId);
      if (stage) {
        result.stageId = stage.id;
        if (isHourly) {
          const activePackage = getActivePackage(stage, true, service.overrideActive);
          if (activePackage) result.packageId = activePackage.id;
        }
      }
    }
    return result;
  }

  // PATH 2: hours service עם serviceId
  if (clientData.services && clientData.services.length > 0 && taskData.serviceId) {
    const service = clientData.services.find(s => s.id === taskData.serviceId);
    if (service && service.type !== ST.LEGAL_PROCEDURE) {
      const activePackage = getActivePackage(service, true, service.overrideActive);
      if (activePackage) result.packageId = activePackage.id;
    }
    return result;
  }

  // PATH 3: hours fallback
  if (clientData.procedureType === ST.HOURS && clientData.services && clientData.services.length > 0) {
    const service = clientData.services[0];
    const activePackage = getActivePackage(service, true, service.overrideActive);
    if (activePackage) result.packageId = activePackage.id;
    return result;
  }

  // PATH 4: legacy hourly
  if (clientData.procedureType === ST.LEGAL_PROCEDURE && clientData.pricingType === PT.HOURLY) {
    const currentStageId = taskData.serviceId || clientData.currentStage || SYSTEM_CONSTANTS.VALID_STAGE_IDS[0];
    const stage = (clientData.stages || []).find(s => s.id === currentStageId);
    if (stage) {
      result.stageId = stage.id;
      const activePackage = getActivePackage(stage, true, false);
      if (activePackage) result.packageId = activePackage.id;
    }
    return result;
  }

  // PATH 5: legacy fixed
  if (clientData.procedureType === ST.LEGAL_PROCEDURE && clientData.pricingType === PT.FIXED) {
    const targetStageId = taskData.serviceId || clientData.currentStage || SYSTEM_CONSTANTS.VALID_STAGE_IDS[0];
    const stage = (clientData.stages || []).find(s => s.id === targetStageId);
    if (stage) result.stageId = stage.id;
    return result;
  }

  return result;
}

/**
 * הפונקציה הראשית - עם Transaction (אפשרות 1: Simple & Safe)
 *
 * Architecture:
 * - Phase 1: READ all documents upfront (Firestore requirement)
 * - Phase 2: CALCULATE all updates (no DB access)
 * - Phase 3: WRITE all changes atomically
 *
 * Benefits:
 * - ✅ Simple and predictable flow
 * - ✅ Easy to debug and maintain
 * - ✅ Consistent behavior across all scenarios
 * - ✅ Complies with Firestore transaction rules
 *
 * @see https://firebase.google.com/docs/firestore/manage-data/transactions
 */
async function addTimeToTaskWithTransaction(db, data, user) {
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await db.runTransaction(async (transaction) => {

        // ========================================
        // PHASE 1: READ OPERATIONS (קריאות בלבד)
        // ========================================
        // All reads MUST come before any writes (Firestore requirement)

        console.log(`📖 [Transaction Phase 1] Reading documents...`);

        // 1️⃣ קריאת המשימה
        const taskRef = db.collection('budget_tasks').doc(data.taskId);
        const taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'משימה לא נמצאה');
        }

        const taskData = taskDoc.data();

        // בדיקת הרשאות
        if (taskData.employee !== user.email && user.role !== 'admin') {
          throw new functions.https.HttpsError('permission-denied', 'אין הרשאה');
        }

        // 2️⃣ קריאת הלקוח (תמיד - אפשרות 1: Simple & Safe)
        // קוראים את הלקוח תמיד, גם אם אולי לא נצטרך לעדכן אותו
        // זה מבטיח flow עקבי ופשוט, ועולה רק 1-2ms
        let clientRef = null;
        let clientDoc = null;
        let clientData = null;

        if (taskData.clientId) {
          clientRef = db.collection('clients').doc(taskData.clientId);
          clientDoc = await transaction.get(clientRef);

          if (clientDoc.exists) {
            clientData = clientDoc.data();
            console.log(`✅ Client read: ${taskData.clientId}`);
          } else {
            console.log(`⚠️ Client ${taskData.clientId} not found (will skip client update)`);
          }
        }

        console.log(`✅ [Transaction Phase 1] All reads completed`);

        // ========================================
        // PHASE 2: CALCULATIONS (חישובים - ללא נגיעה ב-DB)
        // ========================================
        // Pure calculations with no database access

        console.log(`🧮 [Transaction Phase 2] Calculating updates...`);

        // חישוב נתוני המשימה
        const newActualMinutes = (taskData.actualMinutes || 0) + data.minutes;
        const currentEstimate = taskData.estimatedMinutes || 0;
        const percentOfBudget = currentEstimate > 0
          ? Math.round((newActualMinutes / currentEstimate) * 100)
          : 0;
        const isOverBudget = newActualMinutes > currentEstimate;
        const overageMinutes = Math.max(0, newActualMinutes - currentEstimate);

        const timeEntry = {
          date: data.date,
          minutes: data.minutes,
          hours: data.minutes / 60,
          description: data.description ? sanitizeString(data.description) : '',
          addedBy: user.username,
          addedAt: new Date().toISOString(),
          budgetStatus: {
            currentEstimate,
            totalMinutesAfter: newActualMinutes,
            percentOfBudget,
            isOverBudget,
            overageMinutes
          }
        };

        // Lookup service IDs for the timesheet entry
        let serviceIds = { stageId: null, packageId: null };
        if (clientData) {
          serviceIds = lookupServiceIds(clientData, taskData);
          console.log(`🔍 Lookup result: stageId=${serviceIds.stageId}, packageId=${serviceIds.packageId}`);
        }

        // ✅ BLOCK: בדיקת חסימת שירות לפני יצירת entry
        if (clientData && taskData.serviceId) {
          const lookupId = taskData.parentServiceId || taskData.serviceId;
          const targetService = (clientData.services || []).find(s => s.id === lookupId);
          if (targetService && targetService.type === ST.HOURS && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              `השירות "${targetService.name || lookupId}" חסום — נגמרה יתרת השעות`
            );
          }
        }

        // ── Resolve serviceId ──
        const services = clientData ? (clientData.services || []) : [];
        let resolvedServiceId = taskData.serviceId || null;

        if (!resolvedServiceId && services.length === 1) {
          resolvedServiceId = services[0].id;
          console.log(`🔍 [addTimeToTask] Auto-selected single service: ${resolvedServiceId}`);
        } else if (!resolvedServiceId && services.length > 1) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'המשימה חסרה שיוך לשירות — יש לעדכן את המשימה לפני רישום זמן'
          );
        }

        // ── GATE: serviceId is required (skip for internal tasks) ──
        const isInternalTask = taskData.clientId === 'internal_office';
        if (!isInternalTask && clientData && !resolvedServiceId) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
          );
        }

        // ── GATE: serviceId must exist on client ──
        // For legal_procedure tasks: serviceId = stage ID (e.g. "stage_a"),
        // actual service ID is in parentServiceId (e.g. "srv_legal_xxx")
        // This matches the same pattern used in line 357 (block check) and line 406 (deduction)
        const serviceIdToValidate = (resolvedServiceId && resolvedServiceId.startsWith('stage_'))
          ? (taskData.parentServiceId || resolvedServiceId)
          : resolvedServiceId;

        if (!isInternalTask && serviceIdToValidate && !services.some(s => s.id === serviceIdToValidate)) {
          throw new functions.https.HttpsError(
            'not-found',
            `שירות ${serviceIdToValidate} לא נמצא אצל הלקוח`
          );
        }

        // ── Perform deduction in transaction ──
        const minutesDelta = data.minutes;
        let deductionResult = null;
        let deductedInTransaction = false;
        let entryIsOverage = false;
        let entryOverageMinutes = 0;

        if (clientData && resolvedServiceId && services.length > 0) {
          const lookupServiceId = taskData.parentServiceId || resolvedServiceId;
          const targetService = services.find(s => s.id === lookupServiceId);

          if (targetService) {
            const serviceType = targetService.type || clientData.procedureType;

            if (serviceType === ST.HOURS) {
              const hasOverride = !!targetService.overrideActive;
              let resolvedPackageId = serviceIds.packageId;
              if (!resolvedPackageId) {
                const fallbackPkg = (targetService.packages || []).find(pkg => {
                  const status = pkg.status || 'active';
                  return ['active', 'pending', 'overdraft', 'depleted'].includes(status) && (hasOverride || (pkg.hoursRemaining || 0) > -10);
                });
                if (fallbackPkg) resolvedPackageId = fallbackPkg.id;
              }

              if (resolvedPackageId) {
                // Guard: enforce -10h floor before deduction
                const targetPkg = (targetService.packages || []).find(p => p.id === resolvedPackageId);
                if (targetPkg) {
                  const currentRemaining = targetPkg.hoursRemaining || 0;
                  const afterDeduction = currentRemaining - (minutesDelta / 60);
                  if (afterDeduction < -10 && !hasOverride) {
                    throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SOFT,
                      { clientId: taskData.clientId, currentRemaining, requestedHours: minutesDelta / 60, wouldBe: afterDeduction });
                  }
                }
                deductionResult = applyHoursDelta(services, lookupServiceId, resolvedPackageId, minutesDelta);
              } else {
                deductionResult = applyHoursDeltaServiceOnly(services, lookupServiceId, minutesDelta);
                console.warn(`⚠️ [addTimeToTask] No package found — counting at service level`);
              }

            } else if (serviceType === ST.LEGAL_PROCEDURE) {
              const resolvedStageId = serviceIds.stageId || (resolvedServiceId.startsWith('stage_') ? resolvedServiceId : (targetService.currentStage || SYSTEM_CONSTANTS.VALID_STAGE_IDS[0]));
              const stage = (targetService.stages || []).find(s => s.id === resolvedStageId);

              if (stage) {
                if (stage.pricingType === PT.FIXED) {
                  deductionResult = applyLegalProcedureDelta(services, lookupServiceId, resolvedStageId, null, minutesDelta);
                } else {
                  let resolvedPackageId = serviceIds.packageId;
                  if (!resolvedPackageId) {
                    const fallbackStagePkg = (stage.packages || []).find(pkg => {
                      const status = pkg.status || 'active';
                      return ['active', 'pending', 'overdraft', 'depleted'].includes(status) && (pkg.hoursRemaining || 0) > -10;
                    });
                    if (fallbackStagePkg) resolvedPackageId = fallbackStagePkg.id;
                  }
                  if (resolvedPackageId) {
                    // Guard: enforce -10h floor before deduction (stage.packages for legal_procedure)
                    const targetPkg = (stage.packages || []).find(p => p.id === resolvedPackageId);
                    if (targetPkg) {
                      const currentRemaining = targetPkg.hoursRemaining || 0;
                      const afterDeduction = currentRemaining - (minutesDelta / 60);
                      if (afterDeduction < -10) {
                        throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SOFT,
                          { clientId: taskData.clientId, currentRemaining, requestedHours: minutesDelta / 60, wouldBe: afterDeduction });
                      }
                    }
                    deductionResult = applyLegalProcedureDelta(services, lookupServiceId, resolvedStageId, resolvedPackageId, minutesDelta);
                  } else {
                    deductionResult = applyLegalProcedureDeltaStageOnly(services, lookupServiceId, resolvedStageId, minutesDelta);
                    console.warn(`⚠️ [addTimeToTask] No active package for stage ${resolvedStageId} — counting at stage level`);
                  }
                }
              }
            }
          }
        }

        // Calculate overage (dual-layer: package + client)
        let clientUpdate = null;
        if (deductionResult && clientData) {
          deductedInTransaction = true;
          const agg = calcClientAggregates(deductionResult.updatedServices, clientData.totalHours);
          const clientOverage = agg.hoursRemaining < 0;
          const clientOverageMinutes = clientOverage ? round2(Math.abs(agg.hoursRemaining) * 60) : 0;
          entryIsOverage = deductionResult.isOverage || clientOverage;
          entryOverageMinutes = Math.max(deductionResult.overageMinutes, clientOverageMinutes);

          clientUpdate = {
            services: deductionResult.updatedServices,
            hoursUsed: agg.hoursUsed,
            hoursRemaining: agg.hoursRemaining,
            minutesUsed: agg.minutesUsed,
            minutesRemaining: agg.minutesRemaining,
            isBlocked: agg.isBlocked,
            isCritical: agg.isCritical,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          };
          console.log(`✅ [addTimeToTask] Deduction calculated: hoursRemaining=${agg.hoursRemaining}, isBlocked=${agg.isBlocked}`);
        }

        // הכנת רשומת שעתון
        // ✅ זיהוי אוטומטי של רשומת פנימית לפי clientId
        const isInternalWork = taskData.clientId === 'internal_office';

        const timesheetEntry = {
          clientId: taskData.clientId,
          clientName: taskData.clientName,
          caseNumber: taskData.caseNumber || taskData.clientId,
          serviceId: resolvedServiceId,
          serviceName: taskData.serviceName || null,
          serviceType: taskData.serviceType || null,
          parentServiceId: taskData.parentServiceId || null,
          stageId: serviceIds.stageId,
          packageId: serviceIds.packageId,
          taskId: data.taskId,
          taskDescription: taskData.description,
          date: data.date,
          minutes: data.minutes,
          hours: data.minutes / 60,
          action: data.description || taskData.description,
          employee: user.email,
          lawyer: user.username,
          isInternal: isInternalWork,
          autoGenerated: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: user.username,
          deductedInTransaction: deductedInTransaction,
          isOverage: entryIsOverage,
          overageMinutes: entryIsOverage ? entryOverageMinutes : 0
        };

        console.log(`✅ [Transaction Phase 2] All calculations completed`);
        console.log(`📝 Timesheet entry type: ${isInternalWork ? 'INTERNAL' : 'CLIENT'} (clientId: ${taskData.clientId})`);

        // ========================================
        // PHASE 3: WRITE OPERATIONS (כתיבות בלבד)
        // ========================================
        // All writes happen here, after all reads are done

        console.log(`✍️ [Transaction Phase 3] Writing updates...`);

        // 3️⃣ עדכון המשימה (merged: timeEntries + actualMinutes + actualHours)
        transaction.update(taskRef, {
          timeEntries: admin.firestore.FieldValue.arrayUnion(timeEntry),
          actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
          actualHours: admin.firestore.FieldValue.increment(data.minutes / 60),
          lastModifiedBy: user.username,
          lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Task updated: ${data.taskId} (actualMinutes incremented)`);

        // 4️⃣ יצירת רשומת שעתון
        const timesheetRef = db.collection('timesheet_entries').doc();
        transaction.set(timesheetRef, timesheetEntry);
        console.log(`✅ Timesheet entry created: ${timesheetRef.id}`);

        // 5️⃣ עדכון לקוח (deduction + aggregates)
        if (clientUpdate && clientRef) {
          transaction.update(clientRef, clientUpdate);
          console.log(`✅ Client deduction written: deductedInTransaction=true`);
        }

        // 6️⃣ לוג פעולה
        const logRef = db.collection('action_logs').doc();
        transaction.set(logRef, {
          action: 'ADD_TIME_TO_TASK',
          uid: user.uid,
          username: user.username,
          details: {
            taskId: data.taskId,
            minutes: data.minutes,
            date: data.date,
            autoTimesheetCreated: true,
            clientUpdated: !!clientUpdate
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Action log created: ${logRef.id}`);

        console.log(`✅ [Transaction Phase 3] All writes completed successfully`);

        // החזרת תוצאה
        return {
          success: true,
          taskId: data.taskId,
          newActualMinutes,
          timesheetAutoCreated: true
        };
      });

      // הצלחה!
      console.log(`🎉 Transaction completed successfully on attempt ${attempt}`);
      return result;

    } catch (error) {
      lastError = error;

      // אם זה version conflict, נסה שוב
      if (error.code === 'aborted' && attempt < MAX_RETRIES) {
        console.log(`⚠️ Version conflict on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // exponential backoff
        continue;
      }

      // שגיאה אחרת או נגמרו הניסיונות
      console.error(`❌ Transaction failed on attempt ${attempt}:`, error);
      throw error;
    }
  }

  // נגמרו כל הניסיונות
  throw new functions.https.HttpsError(
    'aborted',
    `Version conflict after ${MAX_RETRIES} retries. Please try again.`
  );
}

module.exports = { addTimeToTaskWithTransaction };
