/** Timesheet Module — שעתון ודיווח שעות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString } = require('../shared/validators');

// ✨ Modular deduction system
const DeductionSystem = require('../src/modules/deduction');

// Shared aggregation functions — same functions used by trigger
const {
  round2,
  applyHoursDelta,
  applyHoursDeltaServiceOnly,
  applyLegalProcedureDelta,
  applyLegalProcedureDeltaStageOnly,
  calcClientAggregates
} = require('../src/modules/aggregation');

// Internal helpers
const {
  createTimeEvent,
  checkIdempotency,
  registerIdempotency,
  createReservation,
  commitReservation,
  rollbackReservation
} = require('./helpers');

const { getOrCreateInternalCase } = require('./internal-case');

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

    // ✅ IDEMPOTENCY: Check if this operation was already processed
    if (data.idempotencyKey) {
      const existingResult = await checkIdempotency(data.idempotencyKey);
      if (existingResult) {
        console.log(`🔄 [Quick Log] פעולה כבר בוצעה — מחזיר תוצאה קיימת: ${data.idempotencyKey}`);
        return existingResult;
      }
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

    // Parse date - normalize ALL formats to "YYYY-MM-DD" string
    // (matches createTimesheetEntry_v2 and all existing queries)
    let dateString;
    const dateType = typeof data.date;

    if (dateType === 'string') {
      // ISO string format (current format from frontend)
      // e.g. "2026-04-02T00:00:00.000Z" or "2026-04-02"
      const d = new Date(data.date);
      if (isNaN(d.getTime())) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid date string format'
        );
      }
      // Extract YYYY-MM-DD directly from input to avoid timezone shift
      dateString = data.date.substring(0, 10);
      console.log('[Quick Log] Date parsed from string:', data.date, '→', dateString);

    } else if (data.date && dateType === 'object' && typeof data.date.seconds === 'number') {
      // Firestore Timestamp-like map: {seconds, nanoseconds}
      // (legacy format from Callable Function serialization)
      const d = new Date(data.date.seconds * 1000);
      dateString = d.toISOString().substring(0, 10);
      console.log('[Quick Log] Date parsed from {seconds, nanoseconds} map →', dateString);

    } else if (data.date && typeof data.date.toDate === 'function') {
      // Real Firestore Timestamp object (unlikely but supported)
      const d = data.date.toDate();
      dateString = d.toISOString().substring(0, 10);
      console.log('[Quick Log] Date parsed from Timestamp object →', dateString);

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

      // ── Resolve serviceId ──
      const services = clientData.services || [];
      let resolvedServiceId = data.serviceId || null;

      if (!resolvedServiceId && services.length === 1) {
        resolvedServiceId = services[0].id;
        console.log(`🔍 [Quick Log] Auto-selected single service: ${resolvedServiceId}`);
      } else if (!resolvedServiceId && services.length > 1) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'חובה לבחור שירות — ללקוח יש מספר שירותים'
        );
      }

      // ── GATE: serviceId is required ──
      if (!resolvedServiceId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
        );
      }

      // ── GATE: serviceId must exist on client ──
      // For legal_procedure: serviceId = stage ID, actual service is in parentServiceId
      const serviceIdToValidate = (resolvedServiceId && resolvedServiceId.startsWith('stage_'))
        ? (data.parentServiceId || resolvedServiceId)
        : resolvedServiceId;

      if (!services.some(s => s.id === serviceIdToValidate)) {
        throw new functions.https.HttpsError(
          'not-found',
          `שירות ${serviceIdToValidate} לא נמצא אצל הלקוח`
        );
      }

      // ── Blocked service check ──
      if (resolvedServiceId) {
        const lookupId = data.parentServiceId || resolvedServiceId;
        const targetService = services.find(s => s.id === lookupId);
        if (targetService && targetService.type === 'hours' && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `השירות "${targetService.name || lookupId}" חסום — נגמרה יתרת השעות`
          );
        }
      }

      console.log(`✅ [Quick Log Transaction Phase 1] Client read: ${data.clientId}, resolvedServiceId: ${resolvedServiceId}`);

      // ========================================
      // PHASE 2: CALCULATIONS (No DB access)
      // ========================================

      console.log(`🧮 [Quick Log Transaction Phase 2] Calculating updates...`);

      const hoursWorked = data.minutes / 60;
      const minutesDelta = data.minutes;
      let updatedStageId = null;
      let updatedPackageId = null;
      let deductionResult = null;
      let deductedInTransaction = false;

      // ── Resolve service details and find active package ──
      let resolvedServiceName = null;
      let resolvedServiceType = null;
      let resolvedParentServiceId = null;

      if (resolvedServiceId && services.length > 0) {
        const resolvedService = services.find(s => s.id === resolvedServiceId);
        if (resolvedService) {
          resolvedServiceName = resolvedService.name || null;
          resolvedServiceType = resolvedService.type || null;
          resolvedParentServiceId = resolvedService.parentId || null;

          const lookupServiceId = resolvedParentServiceId || resolvedServiceId;
          const targetService = services.find(s => s.id === lookupServiceId);

          if (targetService) {
            const serviceType = targetService.type || clientData.procedureType;

            if (serviceType === 'hours') {
              // Find active package + overdraft check
              const activePackage = DeductionSystem.getActivePackage(targetService);
              if (activePackage) {
                const currentRemaining = activePackage.hoursRemaining || 0;
                const afterDeduction = currentRemaining - hoursWorked;
                if (afterDeduction < -10) {
                  throw new functions.https.HttpsError(
                    'resource-exhausted',
                    'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                    { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction }
                  );
                }
                updatedPackageId = activePackage.id;
              } else {
                // Fallback: find first eligible package
                const fallbackPkg = (targetService.packages || []).find(pkg => {
                  const status = pkg.status || 'active';
                  return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
                    && (pkg.hoursRemaining || 0) > -10;
                });
                if (fallbackPkg) {
                  updatedPackageId = fallbackPkg.id;
                  console.warn(`⚠️ [Quick Log] לקוח ${clientData.caseNumber} - אין חבילה פעילה, fallback → ${updatedPackageId}`);
                } else if (targetService.packages && targetService.packages.length > 0) {
                  const lastPkg = targetService.packages[targetService.packages.length - 1];
                  if (lastPkg && lastPkg.id) {
                    const currentRemaining = lastPkg.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10) {
                      throw new functions.https.HttpsError('resource-exhausted',
                        'הלקוח בחריגה חמורה — כל החבילות מוצו מעבר למגבלה',
                        { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
                    }
                    updatedPackageId = lastPkg.id;
                    console.warn(`⚠️ [Quick Log] לקוח ${clientData.caseNumber} - כל החבילות מוצו, absolute fallback (with -10 guard) → ${updatedPackageId}`);
                  }
                }
              }

              // ── Deduction: apply hours delta ──
              if (updatedPackageId) {
                deductionResult = applyHoursDelta(services, lookupServiceId, updatedPackageId, minutesDelta);
              } else {
                deductionResult = applyHoursDeltaServiceOnly(services, lookupServiceId, minutesDelta);
                console.warn(`⚠️ [Quick Log] No package found — counting at service level`);
              }

            } else if (serviceType === 'legal_procedure') {
              // Resolve stageId
              const targetStageId = resolvedServiceId.startsWith('stage_') ? resolvedServiceId : (targetService.currentStage || 'stage_a');
              const stage = (targetService.stages || []).find(s => s.id === targetStageId);
              if (stage) {
                updatedStageId = stage.id;

                if (stage.pricingType === 'fixed') {
                  // Fixed pricing: track hours, deduct via stage-only
                  deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, null, minutesDelta);
                } else {
                  // Hourly pricing: find package
                  const activePackage = DeductionSystem.getActivePackage(stage);
                  if (activePackage) {
                    const currentRemaining = activePackage.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10) {
                      throw new functions.https.HttpsError(
                        'resource-exhausted',
                        'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                        { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction }
                      );
                    }
                    updatedPackageId = activePackage.id;
                    deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, updatedPackageId, minutesDelta);
                  } else {
                    // Fallback: stage-level only
                    const fallbackStagePkg = (stage.packages || []).find(pkg => {
                      const status = pkg.status || 'active';
                      return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
                        && (pkg.hoursRemaining || 0) > -10;
                    });
                    if (fallbackStagePkg) {
                      updatedPackageId = fallbackStagePkg.id;
                      deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, updatedPackageId, minutesDelta);
                    } else {
                      deductionResult = applyLegalProcedureDeltaStageOnly(services, lookupServiceId, updatedStageId, minutesDelta);
                      console.warn(`⚠️ [Quick Log] No active package for stage ${updatedStageId} — counting at stage level`);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // ── Calculate overage (dual-layer: package + client) ──
      let isOverage = false;
      let overageMinutes = 0;
      let updatedServices = services;
      let clientUpdate = null;

      if (deductionResult) {
        deductedInTransaction = true;
        updatedServices = deductionResult.updatedServices;
        const pkgOverage = deductionResult.isOverage;
        const pkgOverageMinutes = deductionResult.overageMinutes;

        const agg = calcClientAggregates(updatedServices, clientData.totalHours);

        const clientOverage = agg.hoursRemaining < 0;
        const clientOverageMinutes = clientOverage ? round2(Math.abs(agg.hoursRemaining) * 60) : 0;
        isOverage = pkgOverage || clientOverage;
        overageMinutes = Math.max(pkgOverageMinutes, clientOverageMinutes);

        clientUpdate = {
          services: updatedServices,
          hoursUsed: agg.hoursUsed,
          hoursRemaining: agg.hoursRemaining,
          minutesUsed: agg.minutesUsed,
          minutesRemaining: agg.minutesRemaining,
          isBlocked: agg.isBlocked,
          isCritical: agg.isCritical,
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        };

        console.log(`✅ [Quick Log] Deduction calculated: hoursRemaining=${agg.hoursRemaining}, isBlocked=${agg.isBlocked}, isOverage=${isOverage}`);
      } else if (resolvedServiceId) {
        console.warn(`⚠️ [Quick Log] resolvedServiceId=${resolvedServiceId} but deduction returned null — service/stage/package not found`);
      }

      // Build entry data
      const entryData = {
        // Client/Case identifiers
        clientId: data.clientId,
        clientName: finalClientName,
        caseNumber: data.clientId,

        // Service/Stage tracking
        serviceId: resolvedServiceId,
        serviceName: resolvedServiceName,
        serviceType: resolvedServiceType,
        parentServiceId: resolvedParentServiceId,
        stageId: updatedStageId,
        packageId: updatedPackageId,

        // Time tracking
        date: dateString,
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
        isQuickLog: true,
        deductedInTransaction: deductedInTransaction,

        // Overage (informational — source of truth is clients.services[].packages[].hoursRemaining)
        isOverage: isOverage,
        overageMinutes: isOverage ? overageMinutes : 0
      };

      console.log(`✅ [Quick Log Transaction Phase 2] All calculations completed`);

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`✍️ [Quick Log Transaction Phase 3] Writing updates...`);

      // Write #1: Client update — deduction + aggregates (or metadata only if no deduction)
      if (clientUpdate) {
        transaction.update(clientRef, clientUpdate);
        console.log(`✅ Client deduction written: deductedInTransaction=true`);
      } else {
        transaction.update(clientRef, {
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        });
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

    // ✅ IDEMPOTENCY: Register successful operation
    if (data.idempotencyKey) {
      await registerIdempotency(data.idempotencyKey, result);
    }

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
    // STEP 4+5: TRANSACTION — client read + deduction + writes (all atomic)
    // ================================================
    const clientRef = db.collection('clients').doc(finalClientId);
    const hoursWorked = data.minutes / 60;
    const minutesDelta = data.minutes;
    let timesheetEntryId = null;

    const result = await db.runTransaction(async (transaction) => {
      // ── Phase 1: READS ──
      let clientData = null;
      let currentVersion = 0;
      let nextVersion = null;
      let updatedStageId = null;
      let updatedPackageId = null;

      if (data.isInternal !== true) {
        const clientDoc = await transaction.get(clientRef);
        if (!clientDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'לקוח לא נמצא במערכת');
        }
        clientData = clientDoc.data();

        // Optimistic locking — manual, inside transaction
        currentVersion = clientData._version || 0;
        if (data.expectedVersion !== undefined && currentVersion !== data.expectedVersion) {
          throw new functions.https.HttpsError(
            'aborted',
            `CONFLICT: expected version ${data.expectedVersion}, got ${currentVersion}`
          );
        }
        nextVersion = currentVersion + 1;

        if (!finalClientName) {
          finalClientName = clientData.clientName || clientData.fullName;
        }
      }

      // Read task doc for actualMinutes update
      let taskDoc = null;
      const taskRef = (data.isInternal !== true && data.taskId)
        ? db.collection('budget_tasks').doc(data.taskId)
        : null;
      if (taskRef) {
        taskDoc = await transaction.get(taskRef);
      }

      // ── Phase 2: RESOLVE serviceId + DEDUCTION ──
      let resolvedServiceId = data.serviceId || null;
      let deductionResult = null;
      let deductedInTransaction = false;
      let isOverage = false;
      let overageMinutes = 0;

      if (data.isInternal !== true && clientData) {
        const services = clientData.services || [];

        // Resolve serviceId
        if (!resolvedServiceId && services.length === 1) {
          resolvedServiceId = services[0].id;
          console.log(`🔍 [v2.0] Auto-selected single service: ${resolvedServiceId}`);
        } else if (!resolvedServiceId && services.length > 1) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'חובה לבחור שירות — ללקוח יש מספר שירותים'
          );
        }

        // ── GATE: serviceId is required for non-internal entries ──
        if (!resolvedServiceId) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
          );
        }

        // ── GATE: serviceId must exist on client ──
        // For legal_procedure: serviceId = stage ID, actual service is in parentServiceId
        const serviceIdToValidate = (resolvedServiceId && resolvedServiceId.startsWith('stage_'))
          ? (data.parentServiceId || resolvedServiceId)
          : resolvedServiceId;

        if (!services.some(s => s.id === serviceIdToValidate)) {
          throw new functions.https.HttpsError(
            'not-found',
            `שירות ${serviceIdToValidate} לא נמצא אצל הלקוח`
          );
        }

        // Blocked service check
        if (resolvedServiceId) {
          const lookupId = data.parentServiceId || resolvedServiceId;
          const targetService = services.find(s => s.id === lookupId);
          if (targetService && targetService.type === 'hours' && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              `השירות "${targetService.name || lookupId}" חסום — נגמרה יתרת השעות`
            );
          }
        }

        // Perform deduction if we have a serviceId
        if (resolvedServiceId && services.length > 0) {
          const lookupServiceId = data.parentServiceId || resolvedServiceId;
          const targetService = services.find(s => s.id === lookupServiceId);

          if (targetService) {
            const serviceType = targetService.type || clientData.procedureType;

            if (serviceType === 'hours') {
              const activePackage = DeductionSystem.getActivePackage(targetService);
              if (activePackage) {
                const currentRemaining = activePackage.hoursRemaining || 0;
                const afterDeduction = currentRemaining - hoursWorked;
                if (afterDeduction < -10) {
                  throw new functions.https.HttpsError('resource-exhausted', 'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                    { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
                }
                updatedPackageId = activePackage.id;
              } else {
                const fallbackPkg = (targetService.packages || []).find(pkg => {
                  const status = pkg.status || 'active';
                  return ['active', 'pending', 'overdraft', 'depleted'].includes(status) && (pkg.hoursRemaining || 0) > -10;
                });
                if (fallbackPkg) {
                  updatedPackageId = fallbackPkg.id;
                  console.warn(`⚠️ [v2.0] אין חבילה פעילה, fallback → ${updatedPackageId}`);
                } else if (targetService.packages && targetService.packages.length > 0) {
                  const lastPkg = targetService.packages[targetService.packages.length - 1];
                  if (lastPkg && lastPkg.id) {
                    const currentRemaining = lastPkg.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10) {
                      throw new functions.https.HttpsError('resource-exhausted',
                        'הלקוח בחריגה חמורה — כל החבילות מוצו מעבר למגבלה',
                        { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
                    }
                    updatedPackageId = lastPkg.id;
                    console.warn(`⚠️ [v2.0] כל החבילות מוצו, absolute fallback (with -10 guard) → ${updatedPackageId}`);
                  }
                }
              }

              if (updatedPackageId) {
                deductionResult = applyHoursDelta(services, lookupServiceId, updatedPackageId, minutesDelta);
              } else {
                deductionResult = applyHoursDeltaServiceOnly(services, lookupServiceId, minutesDelta);
                console.warn(`⚠️ [v2.0] No package found — counting at service level`);
              }

            } else if (serviceType === 'legal_procedure') {
              // Resolve stageId — from data.serviceId (stage_xxx) or service.currentStage
              const targetStageId = (data.serviceId && data.serviceId.startsWith('stage_'))
                ? data.serviceId
                : (targetService.currentStage || 'stage_a');
              const stage = (targetService.stages || []).find(s => s.id === targetStageId);

              if (stage) {
                updatedStageId = stage.id;
                if (stage.pricingType === 'fixed') {
                  deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, null, minutesDelta);
                } else {
                  const activePackage = DeductionSystem.getActivePackage(stage);
                  if (activePackage) {
                    const currentRemaining = activePackage.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10) {
                      throw new functions.https.HttpsError('resource-exhausted', 'הלקוח בחריגה נא לעדכן בהקדם את גיא',
                        { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
                    }
                    updatedPackageId = activePackage.id;
                    deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, updatedPackageId, minutesDelta);
                  } else {
                    const fallbackStagePkg = (stage.packages || []).find(pkg => {
                      const status = pkg.status || 'active';
                      return ['active', 'pending', 'overdraft', 'depleted'].includes(status) && (pkg.hoursRemaining || 0) > -10;
                    });
                    if (fallbackStagePkg) {
                      updatedPackageId = fallbackStagePkg.id;
                      deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, updatedPackageId, minutesDelta);
                    } else {
                      deductionResult = applyLegalProcedureDeltaStageOnly(services, lookupServiceId, updatedStageId, minutesDelta);
                      console.warn(`⚠️ [v2.0] No active package for stage ${updatedStageId} — counting at stage level`);
                    }
                  }
                }
              }
            }
          }
        }

        // Calculate overage (dual-layer: package + client)
        if (deductionResult) {
          deductedInTransaction = true;
          const agg = calcClientAggregates(deductionResult.updatedServices, clientData.totalHours);
          const clientOverage = agg.hoursRemaining < 0;
          const clientOverageMinutes = clientOverage ? round2(Math.abs(agg.hoursRemaining) * 60) : 0;
          isOverage = deductionResult.isOverage || clientOverage;
          overageMinutes = Math.max(deductionResult.overageMinutes, clientOverageMinutes);

          // Write client: version + deduction + aggregates (single update)
          transaction.update(clientRef, {
            _version: nextVersion,
            _lastModified: admin.firestore.FieldValue.serverTimestamp(),
            _modifiedBy: user.username,
            services: deductionResult.updatedServices,
            hoursUsed: agg.hoursUsed,
            hoursRemaining: agg.hoursRemaining,
            minutesUsed: agg.minutesUsed,
            minutesRemaining: agg.minutesRemaining,
            isBlocked: agg.isBlocked,
            isCritical: agg.isCritical,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ [v2.0] Deduction written: hoursRemaining=${agg.hoursRemaining}, isBlocked=${agg.isBlocked}`);
        } else {
          // No deduction — metadata only
          transaction.update(clientRef, {
            _version: nextVersion,
            _lastModified: admin.firestore.FieldValue.serverTimestamp(),
            _modifiedBy: user.username,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // ── Phase 3: WRITES ──

      // Write: budget_tasks actualMinutes/actualHours (if taskId exists)
      if (taskRef && taskDoc && taskDoc.exists) {
        transaction.update(taskRef, {
          actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
          actualHours: admin.firestore.FieldValue.increment(hoursWorked),
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ [v2.0] Task ${data.taskId} actualMinutes incremented`);
      }

      // Write: timesheet entry
      const entryData = {
        clientId: finalClientId,
        clientName: finalClientName,
        caseNumber: data.caseNumber || finalClientId,
        serviceId: resolvedServiceId,
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
        deductedInTransaction: deductedInTransaction,
        isOverage: isOverage,
        overageMinutes: isOverage ? overageMinutes : 0,
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
        version: data.isInternal !== true ? nextVersion : null
      };
    });

    // ================================================
    // STEP 6: EVENT SOURCING - רישום האירוע
    // ================================================
    await createTimeEvent({
      eventType: 'TIME_ADDED',
      caseId: finalClientId,
      serviceId: result.entry.serviceId || null,
      stageId: result.entry.stageId || null,
      packageId: result.entry.packageId || null,
      taskId: data.taskId || null,
      timesheetEntryId: result.entryId,

      data: {
        minutes: data.minutes,
        hours: hoursWorked,
        action: data.action,
        date: data.date
      },

      performedBy: user.username,
      performedByEmail: user.email,

      before: data.isInternal !== true ? {
        version: result.version ? result.version - 1 : 0
      } : {},

      after: data.isInternal !== true ? {
        version: result.version
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

      // Read client doc for blocked-service enforcement
      const entryClientId = data.clientId || null;
      const clientRef2 = entryClientId ? db.collection('clients').doc(entryClientId) : null;
      const clientDoc2 = clientRef2 ? await transaction.get(clientRef2) : null;

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

      // Backend enforcement: block update on blocked services
      if (clientDoc2 && clientDoc2.exists) {
        const clientData2 = clientDoc2.data();
        const lookupId = data.parentServiceId || data.serviceId || entryData.serviceId;
        if (lookupId) {
          const targetService = (clientData2.services || []).find(s => s.id === lookupId);
          if (targetService && targetService.type === 'hours' && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              `השירות "${targetService.name || lookupId}" חסום — נגמרה יתרת השעות`
            );
          }
        }
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
