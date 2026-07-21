/** Timesheet Module — שעתון ודיווח שעות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString, getDescriptionLimit } = require('../shared/validators');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const { ERROR_CODES, buildAppError } = require('../shared/errors');
const { writeClientWithCanonicalAggregates } = require('../shared/client-writer');
// PR-NOW-1: detect-only stage observability. Logs, never blocks. See shared/stage-detect.js.
const { reportStageResolution, RESOLUTION_SOURCE } = require('../shared/stage-detect');
// H.2 cost foundation — resolve the employee cost-per-hour + stamp a CF-only
// timesheet_entry_costs/{entryId} doc atomically with each entry (Option A).
const {
  resolveEmployeeCost,
  buildEntryCostDoc,
  TIMESHEET_ENTRY_COSTS_COLLECTION
} = require('../lib/employee-costs/resolve-employee-cost');
// PR-2 (idempotency SSOT): the same atomic, txn-scoped exactly-once primitive
// used by functions/addTimeToTask_v2.js (PR-1). Replaces the non-atomic
// checkIdempotency (read BEFORE the txn) / registerIdempotency (write AFTER
// commit) pair from ./helpers — that gap allowed a lost-ack retry to slip
// between the check and the register on a weak network, producing a
// duplicate write. See functions/shared/idempotency.js for the full contract.
const {
  readProcessedOperation,
  writeProcessedOperation,
  replayAlreadyExists
} = require('../shared/idempotency');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

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
  createReservation,
  commitReservation,
  rollbackReservation
} = require('./helpers');

const { getOrCreateInternalCase } = require('./internal-case');

// PR-G.3.9: TZ-safe `data.date` normalization for all write paths.
// DO NOT use `.toISOString().substring(0,10)` on a caller-supplied Date —
// it converts to UTC and shifts the day by -1 for Asia/Jerusalem local-midnight.
const { normalizeDateToYMD } = require('../shared/calendar');

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

    // PR-2: idempotency is now checked ATOMICALLY inside the transaction below
    // (Phase 1, reads-before-writes) instead of here — see the transaction body.
    // The old non-atomic checkIdempotency()-before / registerIdempotency()-after
    // pair left a gap where a lost-ack retry could slip between the two calls
    // on a weak network and re-run the write (the exact bug this PR fixes).

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

    const tsDescLimit = await getDescriptionLimit('timesheetDescription');
    if (data.description.trim().length > tsDescLimit) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `תיאור הפעולה ארוך מדי (מקסימום ${tsDescLimit} תווים)`
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ DATE PARSING (Before transaction)
    // ═══════════════════════════════════════════════════════════════════

    // PR-G.3.9: normalize ALL formats to `YYYY-MM-DD` string via shared
    // TZ-safe helper. Replaces ad-hoc parsing that used
    // `.toISOString().substring(0,10)` on the {seconds} / Timestamp paths —
    // which converted local-midnight to UTC and shifted by -1 day.
    let dateString;
    try {
      dateString = normalizeDateToYMD(data.date);
    } catch (e) {
      throw new functions.https.HttpsError('invalid-argument', e.message);
    }
    console.log('[Quick Log] Date normalized:', data.date, '→', dateString);

    // H.2: resolve the employee cost-per-hour BEFORE the transaction — a plain
    // read of employee_costs (independent of the txn docs), and it NEVER throws,
    // so a missing/failed cost never blocks hour-logging. Stamped atomically into
    // a CF-only timesheet_entry_costs doc inside the txn (Write #2b below).
    const resolvedCost = await resolveEmployeeCost(user.email);

    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ TRANSACTION - All operations atomic
    // ═══════════════════════════════════════════════════════════════════

    const MAX_IDEMPOTENCY_RETRIES = 3;
    let result = null;

    for (let attempt = 1; attempt <= MAX_IDEMPOTENCY_RETRIES; attempt++) {
      try {
        result = await db.runTransaction(async (transaction) => {

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

          // PR-2 (idempotency): read the processed-operations record LAST in
          // Phase 1 (after the client read, before ANY write — Firestore
          // reads-before-writes). If this key was already committed,
          // short-circuit: return the stored result verbatim, performing NO
          // client write, NO timesheet entry, NO cost write, NO audit log —
          // the duplicate retry is blocked and hours are not double-counted.
          let idemRef = null;
          if (data.idempotencyKey) {
            const idemLookup = await readProcessedOperation(transaction, db, data.idempotencyKey);
            idemRef = idemLookup.ref;
            if (idemLookup.existingResult !== null) {
              console.log(`🔄 [Quick Log] Idempotent replay — returning stored result for key ${data.idempotencyKey}`);
              return idemLookup.existingResult;
            }
          }

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
        if (targetService && targetService.type === ST.HOURS && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
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

            if (serviceType === ST.HOURS) {
              // Find active package + overdraft check
              const hasOverride = !!targetService.overrideActive;
              const activePackage = DeductionSystem.getActivePackage(targetService, true, hasOverride);
              if (activePackage) {
                const currentRemaining = activePackage.hoursRemaining || 0;
                const afterDeduction = currentRemaining - hoursWorked;
                if (afterDeduction < -10 && !hasOverride) {
                  throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SOFT,
                    { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
                }
                updatedPackageId = activePackage.id;
              } else {
                // Fallback: find first eligible package
                const fallbackPkg = (targetService.packages || []).find(pkg => {
                  const status = pkg.status || 'active';
                  return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
                    && (hasOverride || (pkg.hoursRemaining || 0) > -10);
                });
                if (fallbackPkg) {
                  updatedPackageId = fallbackPkg.id;
                  console.warn(`⚠️ [Quick Log] לקוח ${clientData.caseNumber} - אין חבילה פעילה, fallback → ${updatedPackageId}`);
                } else if (targetService.packages && targetService.packages.length > 0) {
                  const lastPkg = targetService.packages[targetService.packages.length - 1];
                  if (lastPkg && lastPkg.id) {
                    const currentRemaining = lastPkg.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10 && !hasOverride) {
                      throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SEVERE,
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

            } else if (serviceType === ST.FIXED) {
              // שירות קבוע — מעקב שעות בלבד, ללא חסימה, ללא packages/stages
              const svcIndex = services.findIndex(s => s.id === lookupServiceId);
              if (svcIndex !== -1) {
                const updatedSvc = { ...services[svcIndex] };
                const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
                work.totalMinutesWorked = round2((work.totalMinutesWorked || 0) + minutesDelta);
                work.entriesCount = (work.entriesCount || 0) + 1;
                updatedSvc.work = work;
                const updatedArr = [...services];
                updatedArr[svcIndex] = updatedSvc;
                deductionResult = { updatedServices: updatedArr, isOverage: false, overageMinutes: 0 };
              }

            } else if (serviceType === ST.LEGAL_PROCEDURE) {
              // Resolve stageId
              const targetStageId = resolvedServiceId.startsWith('stage_') ? resolvedServiceId : (targetService.currentStage || 'stage_a');
              const stage = (targetService.stages || []).find(s => s.id === targetStageId);

              // PR-NOW-1 (detect-only): logs only — deduction unchanged.
              reportStageResolution({
                stage,
                resolvedStageId: targetStageId,
                resolutionSource: resolvedServiceId.startsWith('stage_')
                  ? RESOLUTION_SOURCE.EXPLICIT
                  : (targetService.currentStage ? RESOLUTION_SOURCE.SERVICE_CURRENT_STAGE : RESOLUTION_SOURCE.HARDCODED_FALLBACK),
                path: 'createQuickLogEntry',
                caseNumber: clientData.caseNumber,
                serviceId: targetService.id,
              });

              if (stage) {
                updatedStageId = stage.id;

                if (stage.pricingType === PT.FIXED) {
                  // Fixed pricing: track hours, deduct via stage-only
                  deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, null, minutesDelta);
                } else {
                  // Hourly pricing: find package
                  const activePackage = DeductionSystem.getActivePackage(stage);
                  if (activePackage) {
                    const currentRemaining = activePackage.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10) {
                      throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SOFT,
                        { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
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

        // PR-B.10 (2026-05-18): trimmed payload — only fields the helper does
        // NOT manage. Helper computes services aggregates + writes them
        // (RESTRICTED_KEYS stripped if accidentally included).
        clientUpdate = {
          services: updatedServices,
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

      // PR-B.10 (2026-05-18): Write #1 — CLIENT FIRST via canonical helper.
      // Pattern from PR-B.9 (#291). MUST precede the timesheet + audit writes
      // because the helper does its own `transaction.get(clientRef)` internally,
      // and Firestore enforces "all reads before all writes" within a transaction.
      // Phase 1 already read clientRef — helper's get hits the transaction cache.
      //
      // BOTH branches route through helper (consistency + drift cleanup-on-touch):
      //   - With deduction: pass { services: updatedServices, lastActivity }
      //   - Without deduction: pass { lastActivity } only — helper uses current
      //     services to recompute aggregates (no change in steady state).
      const helperPayload = clientUpdate || {
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };
      await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        helperPayload,
        {
          caller: 'createQuickLogEntry',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );
      console.log(`✅ Client written via canonical helper: deductedInTransaction=${deductedInTransaction}`);

      // Write #2: Create timesheet entry
      const timesheetRef = db.collection('timesheet_entries').doc();
      transaction.set(timesheetRef, entryData);
      console.log(`✅ Timesheet entry will be created: ${timesheetRef.id}`);

      // Write #2b (H.2): cost snapshot in a SEPARATE CF-only collection keyed by
      // the entry id — atomic with the entry (no entry can exist without its cost
      // doc). Stored OFF the entry doc so the employee, who can read their own
      // entry, never sees their confidential cost rate (§7.6 / Option A).
      transaction.set(
        db.collection(TIMESHEET_ENTRY_COSTS_COLLECTION).doc(timesheetRef.id),
        buildEntryCostDoc(timesheetRef.id, user.email, resolvedCost)
      );

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
          // PR-G.3.9: use normalized YYYY-MM-DD (not raw input) for audit consistency
          date: dateString
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: null,
        ipAddress: null
      });
      console.log(`✅ Audit log will be created: ${logRef.id}`);

      // PR-2 (idempotency): record the completed operation LAST, with
      // .create() (NOT .set()) so a truly concurrent second transaction
      // fails atomically with ALREADY_EXISTS — the desired serialization.
      if (idemRef) {
        writeProcessedOperation(transaction, idemRef, data.idempotencyKey, {
          success: true,
          entryId: timesheetRef.id,
          message: 'רישום נוצר בהצלחה'
        });
        console.log(`✅ [Quick Log] Idempotency record created: ${data.idempotencyKey}`);
      }

      console.log(`✅ [Quick Log Transaction Phase 3] All writes completed`);

      // Return result
      return {
        success: true,
        entryId: timesheetRef.id,
        message: 'רישום נוצר בהצלחה'
      };
      });

        break; // transaction succeeded (or replayed) — exit retry loop

      } catch (txnError) {
        // PR-2 (idempotency): concurrent idempotent double. A sibling call with
        // the SAME key won the transaction.create() race, so our create threw
        // ALREADY_EXISTS. The operation SUCCEEDED under this key → return the
        // stored result, NOT a failure (surfacing a false failure would push
        // the user to re-submit with a fresh key — the exact duplicate this
        // fix prevents). If the winner's doc isn't visible yet, fall through
        // and retry — the next attempt's Phase-1 read finds it.
        if (data.idempotencyKey && txnError.code === 'already-exists') {
          const replayedResult = await replayAlreadyExists(db, data.idempotencyKey);
          if (replayedResult !== null) {
            console.log(`🔄 [Quick Log] Concurrent idempotent replay for key ${data.idempotencyKey}`);
            result = replayedResult;
            break;
          }
          if (attempt < MAX_IDEMPOTENCY_RETRIES) {
            console.log(`⚠️ [Quick Log] already-exists (winner not visible yet) on attempt ${attempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            continue;
          }
          // Retries exhausted on a genuine already-exists: a sibling committed
          // this key but its record never became visible in the backoff window.
          // The write SUCCEEDED under this key — do NOT surface the raw SDK
          // 'already exists' string. It would leak English into the Hebrew UI
          // (G1) AND train the user to re-submit with a fresh key = the exact
          // duplicate this fix prevents. Return a clean Hebrew "already recorded"
          // signal instead.
          throw new functions.https.HttpsError(
            'aborted',
            'הרישום כבר נקלט במערכת. רענן את המסך ובדוק לפני רישום מחדש.'
          );
        }

        throw txnError;
      }
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

    // PR-2: idempotency is now checked ATOMICALLY inside the transaction below
    // (Phase 1, reads-before-writes) instead of here — see the transaction body.
    // The old non-atomic checkIdempotency()-before / registerIdempotency()-after
    // pair left a gap where a lost-ack retry could slip between the two calls
    // on a weak network and re-run the write (the exact bug this PR fixes).

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

    // PR-G.3.9: normalize date input (string / {seconds} / Timestamp) to
    // 'YYYY-MM-DD' in Asia/Jerusalem. Previously this function wrote
    // `data.date` raw — inconsistent schema if any caller sent a Timestamp.
    try {
      data.date = normalizeDateToYMD(data.date);
    } catch (e) {
      throw new functions.https.HttpsError('invalid-argument', e.message);
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

    // H.2: resolve the employee cost-per-hour BEFORE the transaction — a plain
    // employee_costs read; never throws (a missing/failed cost → null, stamped into
    // a CF-only timesheet_entry_costs doc atomically with the entry below).
    const resolvedCost = await resolveEmployeeCost(user.email);

    const MAX_IDEMPOTENCY_RETRIES = 3;
    let result = null;
    // PR-2: true only when THIS call's transaction actually performed the
    // write (fresh key, or key not yet processed). False on any replay path
    // (Phase-1 short-circuit OR concurrent already-exists) — the post-transaction
    // steps below (event sourcing, reservation commit, audit log) are
    // side-effect logging for the ACTUAL mutation and must not re-run on a
    // replayed duplicate call (that would create a duplicate time_event +
    // duplicate audit_log entry even though no hours were double-counted).
    let didWrite = false;

    idempotencyRetryLoop:
    for (let idemAttempt = 1; idemAttempt <= MAX_IDEMPOTENCY_RETRIES; idemAttempt++) {
      try {
        let txnDidWrite = true;
        result = await db.runTransaction(async (transaction) => {
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

      // PR-2 (idempotency): read the processed-operations record LAST in
      // Phase 1 (after the client + task reads, before ANY write — Firestore
      // reads-before-writes). If this key was already committed, short-circuit:
      // return the stored result verbatim, performing NO client write, NO task
      // update, NO timesheet entry, NO cost write — the duplicate retry is
      // blocked and hours are not double-counted.
      let idemRef = null;
      if (data.idempotencyKey) {
        const idemLookup = await readProcessedOperation(transaction, db, data.idempotencyKey);
        idemRef = idemLookup.ref;
        if (idemLookup.existingResult !== null) {
          console.log(`🔄 [v2.0] Idempotent replay — returning stored result for key ${data.idempotencyKey}`);
          txnDidWrite = false;
          return idemLookup.existingResult;
        }
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
          if (targetService && targetService.type === ST.HOURS && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
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

            if (serviceType === ST.HOURS) {
              const hasOverride = !!targetService.overrideActive;
              const activePackage = DeductionSystem.getActivePackage(targetService, true, hasOverride);
              if (activePackage) {
                const currentRemaining = activePackage.hoursRemaining || 0;
                const afterDeduction = currentRemaining - hoursWorked;
                if (afterDeduction < -10 && !hasOverride) {
                  throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SOFT,
                    { clientId: clientData.caseNumber, currentRemaining, requestedHours: hoursWorked, wouldBe: afterDeduction });
                }
                updatedPackageId = activePackage.id;
              } else {
                const fallbackPkg = (targetService.packages || []).find(pkg => {
                  const status = pkg.status || 'active';
                  return ['active', 'pending', 'overdraft', 'depleted'].includes(status) && (hasOverride || (pkg.hoursRemaining || 0) > -10);
                });
                if (fallbackPkg) {
                  updatedPackageId = fallbackPkg.id;
                  console.warn(`⚠️ [v2.0] אין חבילה פעילה, fallback → ${updatedPackageId}`);
                } else if (targetService.packages && targetService.packages.length > 0) {
                  const lastPkg = targetService.packages[targetService.packages.length - 1];
                  if (lastPkg && lastPkg.id) {
                    const currentRemaining = lastPkg.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10 && !hasOverride) {
                      throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SEVERE,
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

            } else if (serviceType === ST.FIXED) {
              // שירות קבוע — מעקב שעות בלבד, ללא חסימה, ללא packages/stages
              const svcIndex = services.findIndex(s => s.id === lookupServiceId);
              if (svcIndex !== -1) {
                const updatedSvc = { ...services[svcIndex] };
                const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
                work.totalMinutesWorked = round2((work.totalMinutesWorked || 0) + minutesDelta);
                work.entriesCount = (work.entriesCount || 0) + 1;
                updatedSvc.work = work;
                const updatedArr = [...services];
                updatedArr[svcIndex] = updatedSvc;
                deductionResult = { updatedServices: updatedArr, isOverage: false, overageMinutes: 0 };
              }

            } else if (serviceType === ST.LEGAL_PROCEDURE) {
              // Resolve stageId — from data.serviceId (stage_xxx) or service.currentStage
              const targetStageId = (data.serviceId && data.serviceId.startsWith('stage_'))
                ? data.serviceId
                : (targetService.currentStage || 'stage_a');
              const stage = (targetService.stages || []).find(s => s.id === targetStageId);

              // PR-NOW-1 (detect-only): logs only — deduction unchanged.
              reportStageResolution({
                stage,
                resolvedStageId: targetStageId,
                resolutionSource: (data.serviceId && data.serviceId.startsWith('stage_'))
                  ? RESOLUTION_SOURCE.EXPLICIT
                  : (targetService.currentStage ? RESOLUTION_SOURCE.SERVICE_CURRENT_STAGE : RESOLUTION_SOURCE.HARDCODED_FALLBACK),
                path: 'createTimesheetEntry_v2',
                caseNumber: clientData.caseNumber,
                serviceId: targetService.id,
              });

              if (stage) {
                updatedStageId = stage.id;
                if (stage.pricingType === PT.FIXED) {
                  deductionResult = applyLegalProcedureDelta(services, lookupServiceId, updatedStageId, null, minutesDelta);
                } else {
                  const activePackage = DeductionSystem.getActivePackage(stage);
                  if (activePackage) {
                    const currentRemaining = activePackage.hoursRemaining || 0;
                    const afterDeduction = currentRemaining - hoursWorked;
                    if (afterDeduction < -10) {
                      throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_SOFT,
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
        }

        // PR-B.11 (2026-05-18): both branches (with-deduction + no-deduction)
        // route through canonical helper. Pattern from PR-B.9/B.10 (#291/#292).
        //
        // `_version`, `_lastModified`, `_modifiedBy`, `lastActivity` are NOT
        // in RESTRICTED_KEYS — helper passes them through. Optimistic-locking
        // guarantee (`_version` increment) preserved.
        //
        // No-deduction branch: services omitted from partialUpdate → helper
        // uses current services to recompute aggregates (no change in steady
        // state; drift cleanup-on-touch as side effect).
        const helperPayload = deductionResult
          ? {
            services: deductionResult.updatedServices,
            _version: nextVersion,
            _lastModified: admin.firestore.FieldValue.serverTimestamp(),
            _modifiedBy: user.username,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          }
          : {
            _version: nextVersion,
            _lastModified: admin.firestore.FieldValue.serverTimestamp(),
            _modifiedBy: user.username,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          };
        await writeClientWithCanonicalAggregates(
          transaction,
          clientRef,
          helperPayload,
          {
            caller: 'createTimesheetEntry_v2',
            auditMeta: { uid: user.uid, username: user.username }
          }
        );
        console.log(`✅ [v2.0] Client written via canonical helper: deductedInTransaction=${deductedInTransaction}, version=${nextVersion}`);
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

      // Write (H.2): cost snapshot in the CF-only timesheet_entry_costs collection,
      // keyed by the entry id — atomic with the entry; stored OFF the entry so the
      // employee never sees their own confidential cost rate (§7.6 / Option A).
      transaction.set(
        db.collection(TIMESHEET_ENTRY_COSTS_COLLECTION).doc(timesheetRef.id),
        buildEntryCostDoc(timesheetRef.id, user.email, resolvedCost)
      );

      console.log(`✅ [v2.0] נוצר רישום שעות: ${timesheetEntryId}`);

      const txnResult = {
        success: true,
        entryId: timesheetEntryId,
        entry: {
          id: timesheetEntryId,
          ...entryData
        },
        version: data.isInternal !== true ? nextVersion : null
      };

      // PR-2 (idempotency): record the completed operation LAST, with
      // .create() (NOT .set()) so a truly concurrent second transaction fails
      // atomically with ALREADY_EXISTS — the desired serialization.
      if (idemRef) {
        writeProcessedOperation(transaction, idemRef, data.idempotencyKey, txnResult);
        console.log(`✅ [v2.0] Idempotency record created: ${data.idempotencyKey}`);
      }

      return txnResult;
        });

        didWrite = txnDidWrite;
        break idempotencyRetryLoop; // transaction succeeded (or replayed)

      } catch (txnError) {
        // PR-2 (idempotency): concurrent idempotent double. A sibling call with
        // the SAME key won the transaction.create() race, so our create threw
        // ALREADY_EXISTS. The operation SUCCEEDED under this key → return the
        // stored result, NOT a failure (surfacing a false failure would push
        // the user to re-submit with a fresh key — the exact duplicate this
        // fix prevents). If the winner's doc isn't visible yet, fall through
        // and retry — the next attempt's Phase-1 read finds it.
        if (data.idempotencyKey && txnError.code === 'already-exists') {
          const replayedResult = await replayAlreadyExists(db, data.idempotencyKey);
          if (replayedResult !== null) {
            console.log(`🔄 [v2.0] Concurrent idempotent replay for key ${data.idempotencyKey}`);
            result = replayedResult;
            didWrite = false;
            break idempotencyRetryLoop;
          }
          if (idemAttempt < MAX_IDEMPOTENCY_RETRIES) {
            console.log(`⚠️ [v2.0] already-exists (winner not visible yet) on attempt ${idemAttempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 100 * idemAttempt));
            continue;
          }
          // Retries exhausted on a genuine already-exists: a sibling committed
          // this key but its record never became visible in the backoff window.
          // The write SUCCEEDED under this key — do NOT surface the raw SDK
          // 'already exists' string. It would leak English into the Hebrew UI
          // (G1) AND train the user to re-submit with a fresh key = the exact
          // duplicate this fix prevents. Throw a clean Hebrew "already recorded"
          // signal (the outer catch rolls back the reservation on this HttpsError).
          throw new functions.https.HttpsError(
            'aborted',
            'הרישום כבר נקלט במערכת. רענן את המסך ובדוק לפני רישום מחדש.'
          );
        }

        throw txnError;
      }
    }

    // PR-2: STEP 6 (event sourcing), STEP 7 (reservation commit) and STEP 9
    // (audit log) are side-effect logging for the ACTUAL mutation performed
    // by THIS call's transaction. On a replay (didWrite === false) no client/
    // task/entry/cost write happened — the caller already gets the correct
    // stored `result` back, but logging a SECOND time_event / audit_log entry
    // for a mutation that did not recur here would itself be a duplicate
    // (of the logging trail, not of the hours). So these steps are skipped
    // on replay; they still run exactly once, on the call that actually wrote.
    if (didWrite) {
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

      // PR-2: idempotency registration now happens ATOMICALLY inside the
      // transaction above (Phase 3, via writeProcessedOperation) — no separate
      // post-transaction step needed.

      // ================================================
      // STEP 9: AUDIT LOG
      // ================================================
      await logAction('CREATE_TIMESHEET_ENTRY_V2', user.uid, user.username, {
        entryId: result.entryId,
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
    } else {
      console.log(`🔄 [v2.0] Replay — skipping event sourcing / reservation commit / audit log (no new mutation)`);
      // The reservation created in STEP 3 was never committed (a replay performed
      // no mutation). Roll it back so it doesn't dangle until its 5-min TTL —
      // the caller already has the correct stored result.
      if (reservationId) {
        await rollbackReservation(reservationId, { message: 'idempotent replay — no mutation performed' });
      }
    }

    console.log(`🎉 [v2.0] רישום שעות הושלם בהצלחה! Entry: ${result.entryId}, Version: ${result.version}`);

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

    // PR-G.3.9: normalize date input to 'YYYY-MM-DD' in Asia/Jerusalem.
    // Mirrors createQuickLogEntry + addTimeEntry; ensures consistent schema
    // on UPDATE path regardless of caller-supplied format.
    try {
      data.date = normalizeDateToYMD(data.date);
    } catch (e) {
      throw new functions.https.HttpsError('invalid-argument', e.message);
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
          if (targetService && targetService.type === ST.HOURS && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
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

      // ═══════════════════════════════════════════════════════════════════
      // 🛡️ GUARD: -10h overdraft protection on UPDATE (mirrors CREATE guard)
      // Only check when minutes INCREASED (positive delta)
      // ═══════════════════════════════════════════════════════════════════
      if (minutesDiff > 0 && clientDoc2 && clientDoc2.exists) {
        const clientData2 = clientDoc2.data();
        const services = clientData2.services || [];
        const lookupId = data.parentServiceId || data.serviceId || entryData.parentServiceId || entryData.serviceId;

        if (lookupId) {
          const targetService = services.find(s => s.id === lookupId);

          if (targetService) {
            const serviceType = targetService.type || clientData2.procedureType;

            if (serviceType === ST.HOURS) {
              // Find the package — prefer entry's packageId, fallback to active package
              const hasOverride = !!targetService.overrideActive;
              const entryPackageId = entryData.packageId;
              const targetPackage = entryPackageId
                ? (targetService.packages || []).find(p => p.id === entryPackageId)
                : DeductionSystem.getActivePackage(targetService, true, hasOverride);

              if (targetPackage) {
                const currentRemaining = targetPackage.hoursRemaining || 0;
                const afterDeduction = currentRemaining - hoursDiff;
                if (afterDeduction < -10 && !hasOverride) {
                  console.error(`🛡️ [UPDATE GUARD] Blocked: package ${targetPackage.id} would drop to ${afterDeduction}h (limit: -10h)`);
                  throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_EDIT,
                    { clientId: entryClientId, currentRemaining, requestedHoursDelta: hoursDiff, wouldBe: afterDeduction });
                }
              }
            } else if (serviceType === ST.FIXED) {
              // שירות קבוע — ללא חסימה, ללא guard
            } else if (serviceType === ST.LEGAL_PROCEDURE) {
              // Find the stage
              const targetStageId = entryData.stageId || entryData.serviceId;
              const stage = (targetService.stages || []).find(s => s.id === targetStageId);

              if (stage && stage.pricingType !== PT.FIXED) {
                const entryPackageId = entryData.packageId;
                const targetPackage = entryPackageId
                  ? (stage.packages || []).find(p => p.id === entryPackageId)
                  : DeductionSystem.getActivePackage(stage);

                if (targetPackage) {
                  const currentRemaining = targetPackage.hoursRemaining || 0;
                  const afterDeduction = currentRemaining - hoursDiff;
                  if (afterDeduction < -10) {
                    console.error(`🛡️ [UPDATE GUARD] Blocked: stage package ${targetPackage.id} would drop to ${afterDeduction}h (limit: -10h)`);
                    throw buildAppError(ERROR_CODES.CLIENT_OVERDRAFT_EDIT,
                      { clientId: entryClientId, currentRemaining, requestedHoursDelta: hoursDiff, wouldBe: afterDeduction });
                  }
                }
              }
            }
          }
        }
      }

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
