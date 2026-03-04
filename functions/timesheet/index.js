/** Timesheet Module — שעתון ודיווח שעות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString } = require('../shared/validators');

// ✨ Modular deduction system
const DeductionSystem = require('../src/modules/deduction');

// Internal helpers
const {
  checkVersionAndLock,
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

      // ✅ Client hours-based - find active package (deduction handled by Trigger)
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

          updatedPackageId = activePackage.id;
        } else {
          console.warn(`⚠️ [Quick Log] לקוח ${clientData.caseNumber} - אין חבילה פעילה!`);
        }
      }
      // ✅ Legal procedure - hourly pricing (deduction handled by Trigger)
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

            updatedPackageId = activePackage.id;
          }
        }
      }
      // ✅ Legal procedure - fixed price (deduction handled by Trigger)
      else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'fixed') {
        const targetStageId = clientData.currentStage || 'stage_a';
        const stages = clientData.stages || [];
        const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

        if (currentStageIndex !== -1) {
          const currentStage = stages[currentStageIndex];
          updatedStageId = currentStage.id;
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

      // Write #1: Metadata only — deduction handled by Trigger
      transaction.update(clientRef, {
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

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
      // 5.1: (Removed — Trigger handles task updates)
      // ------------------------------------------------

      // ------------------------------------------------
      // 5.2: Lookup + validation (deduction handled by Trigger)
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

              updatedPackageId = activePackage.id;
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

                updatedPackageId = activePackage.id;
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

              updatedPackageId = activePackage.id;
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
          }
        }

        // ── Metadata write (deduction handled by Trigger) ──
        transaction.update(clientRef, {
          _version: clientVersionInfo.nextVersion,
          _lastModified: admin.firestore.FieldValue.serverTimestamp(),
          _modifiedBy: user.username,
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        });
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
