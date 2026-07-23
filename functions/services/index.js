/** Services Module — ניהול שירותים */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { SYSTEM_CONSTANTS, isValidServiceType, isValidPricingType } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;
const { logAction } = require('../shared/audit');
const { sanitizeString } = require('../shared/validators');

const { round2, isFixedService } = require('../shared/aggregates');
// PR-STAGE-OWN (2026-07-23): canonical pricing-aware stage→service hoursUsed
// rule, single-sourced in src/modules/aggregation (see calcStageEffectiveHoursUsed
// there for why a FIXED stage/service reads totalHoursWorked instead of hoursUsed).
// Reused here instead of hand-copying the ternary — see addHoursPackageToStage.
const { calcServiceHoursUsedFromStages } = require('../src/modules/aggregation');
const { writeClientWithCanonicalAggregates } = require('../shared/client-writer');
// PR-B-2 (2026-07-21): audit-FIRST-in-txn for the budget_tasks re-point that
// happens inside moveToNextStage. Compiled TS output — see functions/src-ts/
// audit-critical.ts + functions/lib/audit-critical.js (committed per
// PR-META-6 convention; already required this way by reconciliation/index.js,
// scheduled/reconcile-package-drift.js, scripts/repair-package-aggregates.js).
const { logCriticalActionInTxn } = require('../lib/audit-critical');

// PR-B-2: the literal open-task status used at task creation
// (functions/budget-tasks/index.js:193 `status: 'פעיל'`). No shared enum
// constant exists for budget_tasks statuses (createBudgetTask/cancelTask/
// completeTask all use the raw Hebrew literals directly — see
// budget-tasks/index.js:193,545,767). Introducing one would mean editing the
// canonical shared/system-constants.js PLUS both frontend adapters (see
// tests/sync-constants.test.js) to keep them in sync — a cross-app change
// out of scope for this backend-only PR. Mirrors the existing repo
// convention of using the literal directly.
const OPEN_TASK_STATUS = 'פעיל';

// PR-B-2 R2 FIX 3 (2026-07-22): Firestore caps a single transaction at 500
// writes. Each re-pointed task costs TWO writes in this transaction (the
// task's own transaction.update + its logCriticalActionInTxn audit doc
// transaction.set). 200 tasks * 2 writes/task = 400 writes, leaving headroom
// under the 500 cap for the client-doc write performed by
// writeClientWithCanonicalAggregates (+1) and any other incidental writes,
// without cutting so close that a slightly larger cohort silently trips the
// real Firestore ceiling instead of this named guard.
const MAX_REPOINT_TASKS = 200;

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

    if (!data.serviceType || !isValidServiceType(data.serviceType)) {
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

    // ── Validate type-specific fields before transaction ──
    if (data.serviceType === ST.HOURS) {
      if (!data.hours || typeof data.hours !== 'number' || data.hours < 1) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'כמות שעות חייבת להיות מספר חיובי'
        );
      }
    } else if (data.serviceType === ST.LEGAL_PROCEDURE) {
      if (!data.stages || !Array.isArray(data.stages) || data.stages.length !== 3) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'הליך משפטי דורש בדיוק 3 שלבים'
        );
      }
      if (!data.pricingType || !isValidPricingType(data.pricingType)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'סוג תמחור חייב להיות "hourly" או "fixed"'
        );
      }
      // H.3 D-B (2026-06-11): תעריף שעתי אופציונלי נבחר (legal-hourly בלבד).
      // Validate-if-present; כשאינו מסופק — אין ברירת מחדל (השירות נשמר ללא
      // ratePerHour → ה-Plan מדווח pricing_missing). מסונכרן עם createClient.
      if (
        data.pricingType === PT.HOURLY &&
        data.ratePerHour !== undefined &&
        data.ratePerHour !== null &&
        (typeof data.ratePerHour !== 'number' || !Number.isFinite(data.ratePerHour) || data.ratePerHour <= 0)
      ) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'תעריף שעתי חייב להיות מספר חיובי'
        );
      }
    } else if (data.serviceType === ST.FIXED) {
      if (data.fixedPrice == null || typeof data.fixedPrice !== 'number' || data.fixedPrice < 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'מחיר קבוע חייב להיות מספר חיובי או 0'
        );
      }
    }

    // ── Transaction: read client → build service → write atomically ──
    const clientRef = db.collection('clients').doc(data.clientId);
    const now = new Date().toISOString();
    const serviceId = `srv_${Date.now()}`;

    const result = await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);

      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();

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
      if (data.serviceType === ST.HOURS) {
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

      } else if (data.serviceType === ST.LEGAL_PROCEDURE) {
        newService.pricingType = data.pricingType;
        newService.currentStage = SYSTEM_CONSTANTS.VALID_STAGE_IDS[0];

        newService.stages = data.stages.map((stage, index) => {
          const stageId = SYSTEM_CONSTANTS.VALID_STAGE_IDS[index];
          const stageName = SYSTEM_CONSTANTS.STAGE_NAMES[stageId];

          const processedStage = {
            id: stageId,
            name: stageName,
            description: sanitizeString(stage.description || ''),
            pricingType: data.pricingType,
            status: index === 0 ? 'active' : 'pending',
            order: index + 1
          };

          if (data.pricingType === PT.HOURLY) {
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
            processedStage.fixedPrice = stage.fixedPrice;
            processedStage.paid = false;
          }

          return processedStage;
        });

        if (data.pricingType === PT.HOURLY) {
          newService.totalHours = newService.stages.reduce((sum, s) => sum + (s.totalHours || 0), 0);
          newService.hoursUsed = 0;
          newService.hoursRemaining = newService.totalHours;
          // H.3 D-B (2026-06-11): store an elected hourly rate when supplied (validated
          // above). No silent 800 default — absent rate → Plan reports pricing_missing
          // (mirrors createClient; real rate from tofes amountBeforeVat at H.6).
          if (typeof data.ratePerHour === 'number' && data.ratePerHour > 0) {
            newService.ratePerHour = data.ratePerHour;
          }
        } else {
          newService.totalPrice = newService.stages.reduce((sum, s) => sum + (s.fixedPrice || 0), 0);
          newService.totalPaid = 0;
        }
      } else if (data.serviceType === ST.FIXED) {
        // שירות קבוע — מחיר פיקס, ללא חבילות/שלבים, מעקב שעות בלבד ללא חסימה
        newService.fixedPrice = data.fixedPrice;
        newService.work = {
          totalMinutesWorked: 0,
          entriesCount: 0
        };
        newService.completedAt = null;
      }

      // הוספת השירות למערך services[]
      const services = [...(clientData.services || []), newService];

      // Compute non-aggregate derived counts (helper does NOT manage these)
      const totalServices = services.length;
      const activeServices = services.filter(s => s.status === 'active').length;

      // PR-B.6 (2026-05-17): migrate to canonical helper.
      // Pattern from PR-B.1-B.5 (#283-#287). First CF in PR-B that ADDS
      // a service (vs mutating). Helper handles append-at-end the same
      // way as wholesale-replace — services[] passed in full to the
      // helper which recomputes totalHours + aggregates from the
      // (now N+1)-element array.
      await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        {
          services,
          totalServices,
          activeServices
        },
        {
          caller: 'addServiceToClient',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      return { newService };
    });

    // Audit log — outside transaction (same pattern as other functions in this file)
    await logAction('ADD_SERVICE_TO_CLIENT', user.uid, user.username, {
      clientId: data.clientId,
      caseNumber: data.clientId,
      serviceId: serviceId,
      serviceType: data.serviceType,
      serviceName: result.newService.name
    });

    console.log(`✅ Added service ${serviceId} to client ${data.clientId}`);

    return {
      success: true,
      serviceId: serviceId,
      service: result.newService,
      message: `שירות "${result.newService.name}" נוסף בהצלחה`
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

    // Validate purchaseDate (type + range + format) — mirrors addHoursPackageToStage
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

    // ── Generate IDs OUTSIDE Transaction (retry-safe) ──
    const now = new Date().toISOString();
    if (!purchaseDate) {
      purchaseDate = now;
    }
    const packageId = `pkg_${Date.now()}`;
    const clientRef = db.collection('clients').doc(clientId);

    // ── OWN-0(c) (2026-06-24): orphan-reseed REMOVED. ──
    // Historically this function scanned `packageId:null` entries on the service
    // and seeded the new package's hoursUsed from them (+ backfilled their
    // packageId). That re-counted "package-counted-null" orphans — entries whose
    // hours were ALREADY counted into a fallback package by the trigger/create
    // paths — into the new package = the +874h double-count detonator
    // (see project_package_hours_drift / DRIFT-2). A new package now starts EMPTY
    // (hoursUsed=0) and existing `service.hoursUsed` is PRESERVED (NOT recomputed
    // from Σpackages, which would drop legitimately service-level hours = the
    // PR #174 under-count). Re-attribution of LEGACY orphans is the supervised
    // forward-replay repair's job (package-repair-core), not this hot write path.

    // ── Transaction: read client → build package → write atomically ──
    const result = await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);

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
      if (service.type !== ST.HOURS && service.serviceType !== ST.HOURS) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'ניתן להוסיף חבילה רק לתוכנית שעות'
        );
      }

      // יצירת חבילה חדשה — מתחילה ריקה (OWN-0(c): אין reseed מ-יתומים)
      const newPackage = {
        id: packageId,
        type: 'additional',
        hours: data.hours,
        hoursUsed: 0,
        hoursRemaining: round2(data.hours),
        purchaseDate: purchaseDate,
        status: 'active',
        description: data.description ? sanitizeString(data.description.trim()) : `חבילה נוספת - ${new Date().toLocaleDateString('he-IL')}`
      };

      // הוספת החבילה לשירות
      service.packages = service.packages || [];
      service.packages.push(newPackage);

      // עדכון סיכומי השירות — מוסיפים קיבולת בלבד.
      // OWN-0(c): service.hoursUsed נשמר כפי שהוא (NOT recomputed = Σpackages),
      // אחרת שעות שנמנו רק ברמת-השירות (service-only orphans) היו נמחקות = ה-under-count
      // של PR #174. החבילה החדשה ריקה ⇒ אינה משנה את הצריכה הקיימת.
      //
      // ⚠️ השימור הוא point-in-time. service-only orphans (שעות ב-svc.hoursUsed שאינן
      // באף package) נשארים שבירים — ה-recompute הבא ב-applyHoursDelta (svc.hoursUsed =
      // Σpackages) ישמיט אותם. התיקון העמיד הוא ה-forward-replay repair שחותם את אותן
      // רשומות לתוך package (כך Σpackages "מתעדכן" וה-recompute הבא הוא no-op). #174 עשה
      // זאת אד-הוק כאן תוך ספירה-כפולה של package-counted-null orphans — OWN-0(c) מסיר
      // את הגרסה הבאגית ונשען על ה-repair (+ ה-single-owner ב-OWN-1) כמנגנון העמיד.
      service.totalHours = (service.totalHours || 0) + data.hours;
      const preservedHoursUsed = round2(service.hoursUsed || 0);
      service.hoursUsed = preservedHoursUsed;
      service.hoursRemaining = round2(service.totalHours - preservedHoursUsed);

      // ── Invariant guard: prevent drift between service.totalHours and Σ(packages.hours) ──
      // Drift happened historically (pre-2026-02-19) when renewServiceHours updated totalHours
      // but skipped pushing the new package. This guard catches any future regression.
      const sumPkgHours = round2(
        service.packages.reduce((sum, pkg) => sum + (pkg.hours || 0), 0)
      );
      const drift = round2(service.totalHours - sumPkgHours);
      if (Math.abs(drift) > 0.05) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Invariant violation: service.totalHours (${service.totalHours}) ≠ Σ(packages.hours) (${sumPkgHours}). Drift=${drift}h. Refusing to write inconsistent state.`,
          { serviceId: service.id, totalHours: service.totalHours, sumPkgHours, drift }
        );
      }

      // עדכון המערך
      services[serviceIndex] = service;

      // PR-B.7 (2026-05-17): migrate to canonical helper.
      // Pattern from PR-B.1-B.6 (#283-#288). Adds a package (sub-document
      // mutation), NOT a service — so totalServices/activeServices are
      // NOT passed (count unchanged when adding a package to existing service).
      // The drift guard above (service.totalHours vs Σ(packages.hours))
      // runs BEFORE this helper call — service-level invariant complements
      // the client-level invariants (I1-I4) checked by the helper.
      await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        { services },
        {
          caller: 'addPackageToService',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      return {
        newPackage,
        service: {
          id: service.id,
          name: service.name || service.serviceName,
          totalHours: service.totalHours,
          hoursRemaining: service.hoursRemaining,
          packagesCount: service.packages.length
        }
      };
    });

    // ── OWN-0(c): orphan packageId-backfill REMOVED (rationale at top of function). ──
    // The old best-effort batch re-stamped `packageId:null` entries onto the new
    // package — both the double-count vector and a packageId-only entry UPDATE that
    // re-fired the trigger. Gone.

    // Audit log (מחוץ ל-Transaction — מסמך נפרד)
    await logAction('ADD_PACKAGE_TO_SERVICE', user.uid, user.username, {
      clientId: clientId,
      caseNumber: clientId,
      serviceId: data.serviceId,
      packageId: packageId,
      hours: data.hours,
      serviceName: result.service.name
    });

    console.log(`✅ Added package ${packageId} (${data.hours}h) to service ${data.serviceId} for client ${clientId}`);

    return {
      success: true,
      packageId: packageId,
      package: result.newPackage,
      service: result.service,
      message: `חבילה של ${data.hours} שעות נוספה בהצלחה לשירות "${result.service.name}"`
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
    const validStageIds = SYSTEM_CONSTANTS.VALID_STAGE_IDS;
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
      const legalProcedureIndex = services.findIndex(s => s.type === ST.LEGAL_PROCEDURE);

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

      // ✅ Capacity (totalHours) is always recomputed from packages — packages
      // define capacity, this is safe for both pricing types.
      targetStage.totalHours = targetStage.packages.reduce((sum, pkg) =>
        sum + (pkg.hours || 0), 0);

      const isFixedStage = targetStage.pricingType === PT.FIXED;

      if (isFixedStage) {
        // PR-STAGE-OWN fix 1b (2026-07-23): a FIXED-pricing stage tracks worked
        // hours in totalHoursWorked (canonical rule — src/modules/aggregation
        // calcStageEffectiveHoursUsed), NOT in hoursUsed recomputed from
        // packages, and hoursRemaining is DELIBERATELY null for fixed pricing
        // (87 of 150 stages in prod are fixed). This function only adds
        // capacity (a package) to the stage — it never adds worked hours —
        // so totalHoursWorked and hoursUsed are intentionally left untouched
        // here. Never write hoursRemaining: 0 in place of null, and never
        // zero totalHoursWorked.
        targetStage.hoursRemaining = null;
      } else {
        // PR-STAGE-OWN fix 1a (2026-07-23): hoursUsed must NEVER be recomputed
        // as a pure Σ(packages.hoursUsed). applyLegalProcedureDeltaStageOnly
        // (src/modules/aggregation) increments stage.hoursUsed DIRECTLY
        // whenever a deduction finds no active package for this stage
        // (addTimeToTask_v2.js "No active package for stage" fallback, also
        // timesheet/index.js + triggers/timesheet-trigger.js). That
        // stage-only-counted work has no package backing at all. Recomputing
        // hoursUsed = Σpackages here would silently ERASE it the instant any
        // package is added to the stage — measured live case: client 2025366
        // / stage_a, stage.hoursUsed=67.58h vs Σpackages=65.58h (2h would be
        // destroyed by the unpatched version of this exact code path).
        //
        // Rule chosen (of the two considered): hoursUsed = max(Σpackages,
        // current stage.hoursUsed) — i.e. this function can only ever GROW
        // hoursUsed, never shrink it. Mirrors the OWN-0(c) precedent at line
        // ~449 above (service-level "preserve as-is" for the identical
        // hazard). Package REMOVAL/correction is out of scope for this
        // function (it only ever ADDS a package) — so the cost of "never
        // shrink" is not paid here; a genuine downward correction requires a
        // dedicated repair path (same posture as OWN-0(c) relying on the
        // forward-replay repair rather than an in-place decrease).
        const sumPackagesHoursUsed = round2(
          targetStage.packages.reduce((sum, pkg) => sum + (pkg.hoursUsed || 0), 0)
        );
        const currentStageHoursUsed = round2(targetStage.hoursUsed || 0);

        if (sumPackagesHoursUsed < currentStageHoursUsed) {
          // Observability: the guard actually engaged — Σpackages would have
          // lowered hoursUsed. Ids/counts only, no PII.
          console.warn(
            `[OWN-STAGE-GUARD] preserved stage-level hoursUsed — case=${caseId} ` +
            `stage=${data.stageId} sumPackagesHoursUsed=${sumPackagesHoursUsed} ` +
            `currentStageHoursUsed=${currentStageHoursUsed} ` +
            `preventedLossHours=${round2(currentStageHoursUsed - sumPackagesHoursUsed)}`
          );
        }

        targetStage.hoursUsed = Math.max(sumPackagesHoursUsed, currentStageHoursUsed);
        targetStage.hoursRemaining = round2(targetStage.totalHours - targetStage.hoursUsed);
      }

      stages[stageIndex] = targetStage;

      // 🔄 Step 7: עדכון ה-service
      legalProcedure.stages = stages;

      // ✅ קיבולת (totalHours) — Σ מה-stages, ללא תלות ב-pricing type.
      legalProcedure.totalHours = stages.reduce((sum, stage) =>
        sum + (stage.totalHours || 0), 0);

      // PR-STAGE-OWN fix 2 (2026-07-23): pricing-aware Σ via the canonical
      // helper (src/modules/aggregation.calcServiceHoursUsedFromStages) —
      // replaces the old plain Σ(stage.hoursUsed), which silently ignored
      // FIXED stages' totalHoursWorked and could disagree with
      // aggregation/index.js's own service-level recompute (a second,
      // independent drift door on top of collision #1 above).
      legalProcedure.hoursUsed = calcServiceHoursUsedFromStages(stages);

      legalProcedure.hoursRemaining = legalProcedure.pricingType === PT.FIXED
        ? null
        : round2(legalProcedure.totalHours - legalProcedure.hoursUsed);

      services[legalProcedureIndex] = legalProcedure;

      // 🔄 Step 8: עדכון ה-client via canonical helper
      // PR-B.13 (2026-05-18): replaces manual aggregate write. Helper
      // recomputes totalHours/hoursUsed/hoursRemaining/minutesUsed/
      // minutesRemaining/isBlocked/isCritical canonically from services
      // array. Stage- and service-level aggregates above (lines 673-695)
      // are nested inside services[] — NOT in RESTRICTED_KEYS — and pass
      // through unchanged. lastModifiedAt + lastModifiedBy added by helper
      // via auditMeta.
      // Pattern source: PR-B.12 (no per-call mode — uses global config).
      const helperResult = await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        { services },
        {
          caller: 'addHoursPackageToStage',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      // ✅ Step 10: החזרת נתונים ל-audit log
      return {
        packageId,
        newPackage,
        targetStage,
        legalProcedure,
        clientTotalHours: helperResult.aggregates.totalHours ?? helperResult.written.totalHours,
        clientHoursUsed: helperResult.aggregates.hoursUsed,
        clientHoursRemaining: helperResult.aggregates.hoursRemaining,
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
      if (service.type !== ST.LEGAL_PROCEDURE && service.serviceType !== ST.LEGAL_PROCEDURE) {
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

      // 3f2. PR-B-2 (2026-07-21, R3): find OPEN budget_tasks still pointing at
      // the stage being closed RIGHT NOW, so they can be re-pointed to the
      // newly-active stage in this same transaction — the ROOT-CAUSE fix for
      // hours logged against a task landing on an already-completed stage's
      // package (measured in PROD 2026-07-21: 75 entries / 101.60h across 6
      // clients).
      //
      // R2 FIX 1 (2026-07-22) WIDENED this to ANY completed stage of the
      // service. REVERTED R3 (2026-07-22, same day) after an independent
      // product-owner review: for client 2025006, the owner ruled the STAGE
      // CLOSURE itself was the error and the tasks pointing at the closed
      // stage are CORRECT where they are — the widened filter would have
      // forcibly (and irreversibly — no write path exists anywhere for a
      // task's `serviceId` outside this callable) moved exactly those tasks.
      // Client 2026057 (fixed-price, ~₪90,000 turning on stage attribution)
      // is the one client the owner is handling supervised/human-decided —
      // its stage_a is closed, and the widened filter would have auto-moved
      // its tasks on the next advance, pre-empting that reserved decision on
      // the highest-stakes client in the dataset. The widened set was also
      // built from `status === 'completed'` with NO positional constraint —
      // a later stage marked completed (as a future `reopenStage` feature
      // will deliberately do) could move a task BACKWARD. The narrow filter
      // below is correct for WRITES; CHANGE 2 below adds detect-only
      // observability for what the narrow filter deliberately leaves behind.
      //
      // Re-point, NEVER close: completing a task is irreversible (no reopen
      // callable exists) and completeTask refuses when actualMinutes===0
      // (budget-tasks/index.js:521-534) — auto-closing would destroy
      // in-flight work AND fail outright on untouched tasks.
      //
      // FIRESTORE TRANSACTION ORDERING (hard constraint): this read MUST
      // happen here — after the client-doc read above, BEFORE
      // writeClientWithCanonicalAggregates is called below. That helper
      // performs its OWN internal transaction.get(clientRef) followed by
      // transaction.update (shared/client-writer.js "2. Transactional read" +
      // "9. Write") — so the ordering across this whole callback is: read
      // client (3a) → read budget_tasks (here) → [call the helper: internal
      // re-read of client, then client write] → THEN the repoint task writes
      // (placed after the helper call, see below — NOT before it, or a task
      // write would land between the outer reads and the helper's internal
      // read, violating "all reads before all writes"). All reads precede
      // all writes; Firestore requires this or the transaction throws at
      // runtime. The QUERY itself (this read) stays exactly here; only the
      // IN-MEMORY filtering below moves to after `updatedStages` exists.
      //
      // Query scoped to `clientId` ONLY (a single equality filter — no
      // composite index risk); the precise match is filtered in-memory below.
      const clientBudgetTasksSnap = await transaction.get(
        db.collection('budget_tasks').where('clientId', '==', data.clientId)
      );

      // 3g. Immutable update — stages
      const updatedStages = service.stages.map((stage, idx) => {
        if (idx === activeIndex) return { ...stage, status: 'completed', completedAt: now };
        if (idx === activeIndex + 1) return { ...stage, status: 'active', startedAt: now };
        return stage;
      });
      const updatedService = { ...service, stages: updatedStages };
      const updatedServices = services.map((s, idx) => idx === serviceIndex ? updatedService : s);

      // 3g2. CHANGE 2 (2026-07-22, R3): `completedStageIds` — the set of THIS
      // service's completed stage ids (both the stage just closed above AND
      // any earlier stage already `completed` before this advance). This
      // set exists ONLY to power the detect-only counter below
      // (`strandedOnEarlierStageCount`). IT MUST NEVER AGAIN BE USED TO
      // SELECT WHAT GETS WRITTEN — that was R2 FIX 1's mistake, reverted
      // above. A task on a `pending` (future) stage is never in this set.
      const completedStageIds = new Set(
        updatedStages.filter((s) => s.status === 'completed').map((s) => s.id)
      );

      // 3g3. PR-B-2 R2 FIX 5: observability-only counter. createBudgetTask
      // writes `parentServiceId: data.parentServiceId || null`
      // (budget-tasks/index.js:178) — the anchor field is known-incomplete in
      // production. A task that matches on stage + status but has no
      // parentServiceId is excluded from re-pointing (we cannot safely infer
      // which service it belongs to), but that exclusion is otherwise
      // indistinguishable from "no task existed". This counter surfaces it.
      // Does NOT change behaviour — count only, never re-point on this basis.
      let skippedForMissingParentServiceIdCount = 0;

      // 3g4. CHANGE 2 (2026-07-22, R3): detect-only counter for OPEN tasks
      // that belong to THIS service and are stranded on an EARLIER completed
      // stage of this service (not the one closing right now). These tasks
      // are real, still open, and are DELIBERATELY not re-pointed by the
      // narrow write filter below — see the 2025006 ruling and the 2026057
      // pre-emption risk in the comment above. Their disposition belongs to
      // a human (the future reopen/modal flow), not to this code. This
      // counter — plus the console.warn emitted per matching task, below —
      // is the measurable residual the narrow filter leaves behind.
      // ZERO writes ever result from this branch.
      let strandedOnEarlierStageCount = 0;

      // FIX E (2026-07-22, PR-B-2 R4 — outcomes-grader "blind spot" finding):
      // a third detect-only bucket. `strandedOnEarlierStageCount` only fires
      // when `t.parentServiceId === service.id` — but an OPEN task with a
      // FALSY parentServiceId whose `serviceId` doesn't correspond to ANY
      // stage of THIS service (not the closing stage, not an earlier
      // completed stage, not a future pending stage) previously fell through
      // every branch uncounted: it fails the stranded check (requires
      // parentServiceId===service.id), then fails the second block's
      // `t.serviceId !== currentStage.id` return before ever reaching the
      // `!t.parentServiceId` counter (that counter only increments when
      // serviceId DOES equal currentStage.id). This counter closes that gap
      // for the UNAMBIGUOUS case only: `parentServiceId === service.id`
      // (the task explicitly names this service) but `serviceId` matches no
      // stage on it at all — data corruption / a stale-stage bug, not the
      // drift class either existing counter targets. ZERO writes, ever.
      //
      // Deliberately NOT counted (would require guessing): an OPEN task with
      // a FALSY parentServiceId whose serviceId happens to equal an earlier
      // completed stage id (e.g. 'stage_a') of THIS service. Stage ids
      // ('stage_a'/'stage_b'/'stage_c') are literal constants reused across
      // EVERY legal_procedure service on a client (SYSTEM_CONSTANTS.
      // VALID_STAGE_IDS) — so without parentServiceId there is no way to
      // tell whether that task belongs to THIS service or a sibling
      // legal_procedure service on the same client with the same stage ids.
      // Counting it here would be an attribution guess dressed up as a
      // measurement — per instruction, a wrong counter is worse than a
      // missing one, so this case is left uncounted (already partially
      // visible via `skippedForMissingParentServiceIdCount` in the one
      // sub-case where serviceId also happens to equal currentStage.id).
      let unresolvedStageForServiceCount = 0;
      const stageIdsOfThisService = new Set(
        Array.isArray(service.stages) ? service.stages.map((s) => s.id) : []
      );

      const tasksToRepoint = clientBudgetTasksSnap.docs.filter((taskDoc) => {
        const t = taskDoc.data();
        if (t.status !== OPEN_TASK_STATUS) return false;

        // Detect-only: an open task of THIS service, stranded on an earlier
        // completed stage (not the one closing now). Never selected for
        // write. Identifiers only in the log — no client name, employee
        // email, task description, or hours (PUBLIC repo, world-readable
        // CI logs).
        if (
          t.parentServiceId === service.id &&
          t.serviceId !== currentStage.id &&
          completedStageIds.has(t.serviceId)
        ) {
          strandedOnEarlierStageCount++;
          console.warn('STRANDED_BUDGET_TASK_EARLIER_STAGE', {
            taskId: taskDoc.id,
            stageId: t.serviceId,
            serviceId: service.id,
            clientId: data.clientId
          });
          return false;
        }

        // Detect-only (FIX E): an open task explicitly owned by THIS service
        // (parentServiceId matches) whose serviceId is not any stage of this
        // service at all — unresolvable, not covered by the stranded branch
        // above (which requires completedStageIds.has(serviceId)). Never
        // selected for write.
        if (
          t.parentServiceId === service.id &&
          t.serviceId !== currentStage.id &&
          !completedStageIds.has(t.serviceId) &&
          !stageIdsOfThisService.has(t.serviceId)
        ) {
          unresolvedStageForServiceCount++;
          console.warn('BUDGET_TASK_UNRESOLVED_STAGE_FOR_SERVICE', {
            taskId: taskDoc.id,
            stageId: t.serviceId,
            serviceId: service.id,
            clientId: data.clientId
          });
          return false;
        }

        // WRITE-SELECTION predicate (narrow — reverted to the pre-R2-FIX-1
        // shape): only a task pointing at the EXACT stage being closed now.
        if (t.serviceId !== currentStage.id) return false;
        if (t.parentServiceId === service.id) return true;
        if (!t.parentServiceId) skippedForMissingParentServiceIdCount++;
        return false;
      });

      // 3g4. PR-B-2 R2 FIX 3: hard ceiling BEFORE any write happens. Each
      // re-pointed task costs 2 writes (task update + audit doc) — see
      // MAX_REPOINT_TASKS comment at module scope for the 500-write/2-per-
      // task arithmetic. Thrown here, before writeClientWithCanonicalAggregates
      // is even called, so no partial write attempt is made and the admin
      // gets a named, actionable Hebrew error instead of a raw Firestore
      // "too many writes" failure at commit time.
      if (tasksToRepoint.length > MAX_REPOINT_TASKS) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `נמצאו ${tasksToRepoint.length} משימות פתוחות לעדכון שלב — חורג מהמגבלה הבטוחה (${MAX_REPOINT_TASKS}). ` +
          'לא ניתן לבצע את מעבר השלב באופן אוטומטי. פנה לתמיכה טכנית.'
        );
      }

      // 3h. PR-B.8 (2026-05-17): migrate to canonical helper.
      // Pattern from PR-B.1-B.7 (#283-#289). Equivalence verified upfront:
      // the prior `clientTotalHours` formula (filter !isFixedService, sum
      // totalHours) is identical to the helper's recomputeTotalHours. Both
      // use the canonical isFixedService classification.
      // currentStage + currentStageName are client-level metadata (NOT in
      // RESTRICTED_KEYS) — pass through to helper.
      const isLastStage = (activeIndex + 1) === service.stages.length - 1;

      await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        {
          services: updatedServices,
          currentStage: nextStage.id,
          currentStageName: nextStage.name || nextStage.id
        },
        {
          caller: 'moveToNextStage',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      // 3h2. PR-B-2: write the re-point for every matched OPEN task, with an
      // audit entry committed ATOMICALLY in this same transaction (audit-FIRST
      // discipline, functions/CLAUDE.md "Audit-FIRST"; logCriticalActionInTxn
      // from functions/src-ts/audit-critical.ts). Update ONLY the stage
      // pointer (serviceId) — NEVER actualMinutes/estimatedMinutes/status/
      // timeEntries/any budget or completion field. `serviceName` on the task
      // stores the PARENT SERVICE's display name (verified: apps/user-app/js/
      // modules/client-case-selector.js:1246-1249 — `parentService.name`, set
      // once at creation and never the stage name), which does not change
      // when the stage advances — so it is intentionally left untouched here.
      //
      // MUST run AFTER writeClientWithCanonicalAggregates, not before: that
      // helper does its OWN internal transaction.get(clientRef) (a READ)
      // before its transaction.update(clientRef, ...) (a WRITE) — see
      // shared/client-writer.js "2. Transactional read" / "9. Write". If the
      // task-repoint writes below ran BEFORE calling the helper, the sequence
      // would be read→read→WRITE(task)→READ(helper's internal re-read)→
      // WRITE(client) — a write sandwiched before a later read, which
      // Firestore's real transaction API rejects at runtime ("all reads must
      // execute before all writes"). Running the repoint writes here instead
      // keeps every read (outer client, budget_tasks query, helper's internal
      // re-read) before every write (helper's client write, then these task
      // writes) — verified by a dedicated ordering test
      // (tests/move-to-next-stage-repoint.test.js, "H. Reads precede writes")
      // that failed exactly this way before this ordering fix.
      //
      // Zero matched tasks (the common case today — measured PROD blast
      // radius is 2-4 open tasks on a closed stage) → this loop performs ZERO
      // writes, so the transaction is byte-identical to pre-PR-B-2 behavior.
      //
      // Failure semantics: no try/catch here by design. Any error re-pointing
      // a task (or writing its audit entry) throws inside this same
      // transaction callback and aborts the WHOLE stage advance — a stage
      // that advances while its in-flight tasks are left behind on the
      // closed stage is exactly the defect this PR fixes, and a partial
      // success would be invisible (no compensating signal exists downstream
      // to catch it). This is free — no extra code needed — because the
      // repoint writes already live inside the single db.runTransaction that
      // wraps the entire stage-advance.
      for (const taskDoc of tasksToRepoint) {
        // CHANGE 5 (2026-07-22, R3): capture the task's OWN prior serviceId
        // before the update, rather than assuming it equals `currentStage.id`.
        // Under the narrow write filter above the two are always equal by
        // construction (only tasks with serviceId === currentStage.id are
        // ever selected here) — but reading it off the task keeps the audit
        // field truthful even if the filter is ever changed again, at zero
        // cost.
        const priorStageId = taskDoc.data().serviceId;

        // PR-B-2 R2 FIX 2: mirror shared/client-writer.js:238's guard —
        // `user.username` (functions/shared/auth.js:48 `employee.username`)
        // has no default and is written verbatim from caller input
        // (functions/auth/index.js:167). The Node Firestore SDK throws
        // SYNCHRONOUSLY on `undefined` in transaction.update() (no
        // `ignoreUndefinedProperties` is set anywhere in functions/), which
        // would abort the entire stage advance. Omit the key rather than
        // write `undefined` or fabricate a value.
        const taskUpdatePayload = {
          serviceId: nextStage.id,
          lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (user.username) {
          taskUpdatePayload.lastModifiedBy = user.username;
        }

        // PR-B-2 R2 FIX 4 (comment corrected 2026-07-22 R3 — CHANGE 4): this
        // try/catch does NOT protect against a concurrently-deleted task
        // (NOT_FOUND at commit), despite the original comment's claim.
        // `transaction.update` and `logCriticalActionInTxn`'s `transaction.set`
        // both BUFFER their write — a missing-document failure surfaces at
        // COMMIT time, which is OUTSIDE this callback and OUTSIDE this
        // try/catch entirely. What this guard genuinely catches is the
        // SYNCHRONOUS-throw class only: undefined-value validation inside
        // `transaction.update`/`transaction.set`, or `validateActorUid`
        // throwing synchronously inside `logCriticalActionInTxn`. On any of
        // those, catch, enrich with the failing taskId, and RE-THROW — abort
        // semantics are UNCHANGED by design (do not swallow, do not
        // continue); there is no UI anywhere that lets an admin fix a
        // budget_task's stage (the admin task editor renders it read-only),
        // so a named error is the only diagnostic path available for this
        // synchronous class. A commit-time failure (e.g. concurrent delete)
        // is NOT caught here — it propagates as the transaction's own
        // rejection, unnamed by taskId, same as before this guard existed.
        try {
          // FIX B (2026-07-22, PR-B-2 R4 — Mechanical bar item, MASTER_PLAN
          // §2.0.2 "Audit-FIRST, mutation-SECOND ordering"): audit call
          // MUST precede the mutation (mirrors reconciliation/index.js's
          // set-mode transaction). Both calls buffer into the same
          // transaction and commit together — this swap changes ordering
          // only, not atomicity or outcome. `priorStageId` was captured
          // above from the pre-update task snapshot, so it is unaffected by
          // this reordering.
          logCriticalActionInTxn(transaction, 'REPOINT_BUDGET_TASK_STAGE', user.uid, {
            clientId: data.clientId,
            taskId: taskDoc.id,
            parentServiceId: service.id,
            fromStageId: priorStageId,
            toStageId: nextStage.id
          });

          transaction.update(taskDoc.ref, taskUpdatePayload);
        } catch (repointErr) {
          console.error('Error re-pointing budget_task during moveToNextStage:', taskDoc.id, repointErr);
          throw new functions.https.HttpsError(
            'internal',
            `שגיאה בעדכון שלב עבור משימה ${taskDoc.id} — מעבר השלב בוטל. פנה לתמיכה טכנית.`
          );
        }
      }

      // 3i. return data from transaction
      return {
        currentStage: { id: currentStage.id, name: currentStage.name || currentStage.id },
        nextStage: { id: nextStage.id, name: nextStage.name || nextStage.id },
        updatedStages: updatedStages,
        isLastStage: isLastStage,
        serviceName: service.name || service.serviceName,
        // PR-B-2: observability (G3) — how many open budget_tasks were
        // re-pointed to the new stage as part of this stage advance.
        repointedTaskCount: tasksToRepoint.length,
        // PR-B-2 R2 FIX 5: observability-only — see the comment at 3g3.
        skippedForMissingParentServiceIdCount: skippedForMissingParentServiceIdCount,
        // CHANGE 2 (2026-07-22, R3): observability-only — see the comment
        // at 3g4. Never repaired by this code; surfaced so the future
        // reopen/modal flow has a measurable target.
        strandedOnEarlierStageCount: strandedOnEarlierStageCount,
        // FIX E (2026-07-22, R4): observability-only — see the comment at
        // the counter's declaration above. Never repaired by this code.
        unresolvedStageForServiceCount: unresolvedStageForServiceCount
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
      serviceName: result.serviceName,
      repointedTaskCount: result.repointedTaskCount,
      skippedForMissingParentServiceIdCount: result.skippedForMissingParentServiceIdCount,
      strandedOnEarlierStageCount: result.strandedOnEarlierStageCount,
      unresolvedStageForServiceCount: result.unresolvedStageForServiceCount
    });

    // 5. Return
    console.log(`✅ Stage moved: ${result.currentStage.id} → ${result.nextStage.id} for client ${data.clientId} (repointed ${result.repointedTaskCount} open task(s), skipped ${result.skippedForMissingParentServiceIdCount} for missing parentServiceId, ${result.strandedOnEarlierStageCount} stranded on an earlier closed stage, ${result.unresolvedStageForServiceCount} with an unresolved stage for this service)`);

    return {
      success: true,
      serviceId: data.serviceId,
      fromStage: result.currentStage,
      toStage: result.nextStage,
      updatedStages: result.updatedStages,
      isLastStage: result.isLastStage,
      repointedTaskCount: result.repointedTaskCount,
      skippedForMissingParentServiceIdCount: result.skippedForMissingParentServiceIdCount,
      strandedOnEarlierStageCount: result.strandedOnEarlierStageCount,
      unresolvedStageForServiceCount: result.unresolvedStageForServiceCount,
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

      // 3e. Compute non-aggregate derived counts (helper does NOT manage these)
      // NOTE: activeServices decreases by 1 because the just-completed service
      // drops out of the `status === 'active'` filter.
      const totalServices = updatedServices.length;
      const activeServices = updatedServices.filter(s => s.status === 'active').length;

      // 3f. PR-B.4 (2026-05-17): migrate to canonical helper.
      // Pattern from PR-B.1/B.2/B.3 (#283/#284/#285). The helper:
      //   - strips RESTRICTED_KEYS (defense-in-depth)
      //   - recomputes totalHours + all aggregates from services
      //   - asserts invariants I1/I2/I4
      //   - emits violation record + Cloud Logging entry on failure
      //   - honors global kill-switch
      // I1 relevant: completing the last billable service while a fixed-only
      // remains → helper derives isBlocked=false even if hours depleted.
      const helperResult = await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        {
          services: updatedServices,
          totalServices,
          activeServices
        },
        {
          caller: 'completeService',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      // 3g. Return data from transaction (aggregates sourced from helper)
      return {
        serviceName: service.name || service.serviceName,
        serviceType: service.type || service.serviceType,
        completedAt: now,
        aggregates: {
          totalHours: helperResult.aggregates.totalHours ?? helperResult.written.totalHours,
          hoursRemaining: helperResult.aggregates.hoursRemaining,
          minutesRemaining: helperResult.aggregates.minutesRemaining,
          isBlocked: helperResult.aggregates.isBlocked,
          isCritical: helperResult.aggregates.isCritical,
          totalServices,
          activeServices
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

      // 3f. Compute non-aggregate derived counts (helper does NOT manage these)
      // NOTE: activeServices changes when transitioning to/from 'active'.
      const totalServices = updatedServices.length;
      const activeServices = updatedServices.filter(s => s.status === 'active').length;

      // 3g. PR-B.5 (2026-05-17): migrate to canonical helper.
      // Pattern from PR-B.1/B.2/B.3/B.4 (#283/#284/#285/#286). The helper:
      //   - strips RESTRICTED_KEYS (defense-in-depth)
      //   - recomputes totalHours + all aggregates from services
      //   - asserts invariants I1/I2/I4
      //   - emits violation record + Cloud Logging entry on failure
      //   - honors global kill-switch
      // statusChangeHistory append survives the wholesale services[] replace
      // because services[serviceIndex] is the new updatedService object
      // which carries the appended history array.
      const helperResult = await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        {
          services: updatedServices,
          totalServices,
          activeServices
        },
        {
          caller: 'changeServiceStatus',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      // 3h. Return data from transaction (aggregates sourced from helper)
      const serviceName = service.name || service.serviceName;
      const serviceType = service.type || service.serviceType;

      return {
        serviceName,
        serviceType,
        previousStatus: currentStatus,
        newStatus: data.newStatus,
        statusChangedAt: now,
        aggregates: {
          totalHours: helperResult.aggregates.totalHours ?? helperResult.written.totalHours,
          hoursUsed: helperResult.aggregates.hoursUsed,
          hoursRemaining: helperResult.aggregates.hoursRemaining,
          minutesRemaining: helperResult.aggregates.minutesRemaining,
          isBlocked: helperResult.aggregates.isBlocked,
          isCritical: helperResult.aggregates.isCritical,
          totalServices,
          activeServices
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

      // 3f. Compute non-aggregate derived counts (helper does NOT manage these)
      const totalServices = updatedServices.length;
      const activeServices = updatedServices.filter(s => s.status === 'active').length;

      // 3g. PR-B.3 (2026-05-17): migrate to canonical helper.
      // Pattern from PR-B.1/.B.2 (#283/#284). The helper:
      //   - strips RESTRICTED_KEYS (defense-in-depth)
      //   - recomputes totalHours + all aggregates from services
      //   - asserts invariants I1/I2/I4
      //   - emits violation record + Cloud Logging entry on failure
      //   - honors global kill-switch
      // totalServices / activeServices pass through (NOT in RESTRICTED_KEYS).
      // I1 case is relevant here: removing the last billable service from
      // a mixed client leaves only fixed services → helper derives
      // isBlocked=false even if hoursRemaining drops to 0.
      const helperResult = await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        {
          services: updatedServices,
          totalServices,
          activeServices
        },
        {
          caller: 'deleteService',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      // 3h. Return data from transaction (sourced from helper's canonical aggregates)
      const serviceName = service.name || service.serviceName;
      const serviceType = service.type || service.serviceType;

      return {
        deletedService: deletedServiceSnapshot,
        serviceName,
        serviceType,
        aggregates: {
          totalHours: helperResult.aggregates.totalHours ?? helperResult.written.totalHours,
          hoursUsed: helperResult.aggregates.hoursUsed,
          hoursRemaining: helperResult.aggregates.hoursRemaining,
          minutesRemaining: helperResult.aggregates.minutesRemaining,
          isBlocked: helperResult.aggregates.isBlocked,
          isCritical: helperResult.aggregates.isCritical,
          totalServices,
          activeServices
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
 * עדכון תאריך רכישה של חבילת שעות קיימת
 * @param {Object} data
 * @param {string} data.clientId - מזהה לקוח
 * @param {string} data.serviceId - מזהה שירות
 * @param {string} data.packageId - מזהה חבילה
 * @param {string} data.purchaseDate - תאריך רכישה חדש (YYYY-MM-DD)
 */
exports.updatePackagePurchaseDate = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

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

    if (!data.packageId || typeof data.packageId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה חבילה חובה'
      );
    }

    if (!data.purchaseDate || typeof data.purchaseDate !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'תאריך רכישה חובה'
      );
    }

    // Validate purchaseDate — mirrors addPackageToService
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

    const newPurchaseDate = parsed.toISOString();

    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${data.clientId} לא נמצא`
        );
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      const serviceIndex = services.findIndex(s => s.id === data.serviceId);
      if (serviceIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          'שירות לא נמצא עבור לקוח זה'
        );
      }

      const service = services[serviceIndex];
      const packages = service.packages || [];

      const packageIndex = packages.findIndex(p => p.id === data.packageId);
      if (packageIndex === -1) {
        throw new functions.https.HttpsError(
          'not-found',
          'חבילה לא נמצאה בשירות זה'
        );
      }

      const oldPurchaseDate = packages[packageIndex].purchaseDate;

      const updatedPackages = packages.map((pkg, idx) =>
        idx === packageIndex
          ? { ...pkg, purchaseDate: newPurchaseDate }
          : pkg
      );

      const updatedService = { ...service, packages: updatedPackages };
      const updatedServices = services.map((s, idx) =>
        idx === serviceIndex ? updatedService : s
      );

      await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        { services: updatedServices },
        {
          caller: 'updatePackagePurchaseDate',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      return {
        serviceName: service.name || service.serviceName,
        packageId: data.packageId,
        oldPurchaseDate,
        newPurchaseDate
      };
    });

    await logAction('UPDATE_PACKAGE_PURCHASE_DATE', user.uid, user.username, {
      clientId: data.clientId,
      serviceId: data.serviceId,
      packageId: result.packageId,
      oldPurchaseDate: result.oldPurchaseDate,
      newPurchaseDate: result.newPurchaseDate
    });

    console.log(`✅ Package ${data.packageId} purchaseDate updated: ${result.oldPurchaseDate} → ${result.newPurchaseDate}`);

    return {
      success: true,
      packageId: result.packageId,
      purchaseDate: result.newPurchaseDate,
      message: `תאריך רכישה עודכן בהצלחה`
    };

  } catch (error) {
    console.error('Error in updatePackagePurchaseDate:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון תאריך רכישה: ${error.message}`
    );
  }
});
