/** Budget Tasks Module — משימות מתוקצבות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString, getDescriptionLimit } = require('../shared/validators');
const { addTimeToTaskWithTransaction } = require('../addTimeToTask_v2');
// PR-3a (idempotency SSOT): the same atomic, transaction-scoped exactly-once
// primitive used by functions/addTimeToTask_v2.js (PR-1) and both
// functions/timesheet/index.js create paths (PR-2). A weak-network client
// timeout makes FirebaseService retry a write whose server-side effect already
// succeeded → a duplicate. These two budget-task write paths (createBudgetTask,
// adjustTaskBudget) now short-circuit that duplicate atomically inside the same
// transaction that does the write. See functions/shared/idempotency.js.
const {
  readProcessedOperation,
  writeProcessedOperation,
  replayAlreadyExists
} = require('../shared/idempotency');

const db = admin.firestore();

// PR-3a: mirror the canonical retry budget from createQuickLogEntry /
// createTimesheetEntry_v2 / addTimeToTask — 3 attempts on a genuine
// already-exists before surfacing a clean Hebrew "already recorded" signal.
const MAX_IDEMPOTENCY_RETRIES = 3;

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

    const taskDescLimit = await getDescriptionLimit('taskDescription');
    if (data.description.trim().length > taskDescLimit) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `תיאור המשימה ארוך מדי (מקסימום ${taskDescLimit} תווים)`
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

    // ✅ בדיקת סניף מטפל
    if (!data.branch || typeof data.branch !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור סניף מטפל'
      );
    }

    // ✅ בדיקת שירות
    if (!data.serviceId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור שירות למשימה'
      );
    }

    // Prepare refs (generate IDs upfront)
    const taskRef = db.collection('budget_tasks').doc();
    const approvalRef = db.collection('pending_task_approvals').doc();
    const clientRef = db.collection('clients').doc(clientId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Task + Approval Creation
    // ═══════════════════════════════════════════════════════════════════

    let clientData;
    let result = null;
    // PR-3a: true only when THIS call's transaction actually performed the
    // writes (fresh key, or key not yet processed). False on any replay path
    // (Phase-1 short-circuit OR concurrent already-exists) — the post-transaction
    // audit log below is side-effect logging for the ACTUAL mutation and must
    // NOT re-run on a replayed duplicate (that would create a duplicate
    // CREATE_TASK audit entry even though no task was double-created).
    let didWrite = false;

    for (let attempt = 1; attempt <= MAX_IDEMPOTENCY_RETRIES; attempt++) {
      try {
        let txnDidWrite = true;
        result = await db.runTransaction(async (transaction) => {
      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading client...`);

      const clientDoc = await transaction.get(clientRef);

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!clientDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `לקוח ${clientId} לא נמצא`
        );
      }

      clientData = clientDoc.data();

      // PR-3a (idempotency): read the processed-operations record LAST in
      // Phase 1 (after the client read, before ANY write — Firestore
      // reads-before-writes). If this key was already committed, short-circuit:
      // return the stored result verbatim, performing NO task write, NO
      // approval write, NO audit log — the duplicate retry is blocked and no
      // duplicate task/approval is created.
      let idemRef = null;
      if (data.idempotencyKey) {
        const idemLookup = await readProcessedOperation(transaction, db, data.idempotencyKey);
        idemRef = idemLookup.ref;
        if (idemLookup.existingResult !== null) {
          console.log(`🔄 [createBudgetTask] Idempotent replay — returning stored result for key ${data.idempotencyKey}`);
          txnDidWrite = false;
          return idemLookup.existingResult;
        }
      }

      console.log(`✅ Creating task for client ${clientId} (${clientData.clientName})`);

      // 🆕 Phase 1: שמירת ערכים מקוריים (לא ישתנו לעולם)
      const deadlineTimestamp = data.deadline ? admin.firestore.Timestamp.fromDate(new Date(data.deadline)) : null;

      const taskData = {
        description: sanitizeString(data.description.trim()),
        categoryId: data.categoryId || null, // ✅ מזהה קטגוריית עבודה (Work Category ID)
        categoryName: data.categoryName || null, // ✅ שם קטגוריית העבודה (Work Category Name)
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

        status: 'פעיל',  // ✅ Always active - no approval needed
        // Removed: requestedMinutes, approvedMinutes - no longer needed
        deadline: deadlineTimestamp,
        employee: user.email, // ✅ EMAIL for security rules and queries
        lawyer: user.username, // ✅ Username for display
        createdBy: user.username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        timeEntries: []
      };

      // ✅ Create approval history record (for tracking/FYI)
      const approvalRecord = {
        taskId: taskRef.id,
        requestedBy: user.email,
        requestedByName: user.employee.name || user.username,  // ✅ Hebrew name preferred
        requestedMinutes: estimatedMinutes,
        taskData: {
          description: taskData.description,
          clientName: taskData.clientName,
          clientId: clientId,
          estimatedMinutes: estimatedMinutes
        },
        status: 'auto_approved',  // ✅ Auto-approved - no manual approval needed
        autoApproved: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing task and approval...`);

      // Write #1: Task
      transaction.set(taskRef, taskData);
      console.log(`  ✅ Task creation queued: ${taskRef.id}`);

      // Write #2: Approval
      transaction.set(approvalRef, approvalRecord);
      console.log(`  ✅ Approval creation queued: ${approvalRef.id}`);

      // PR-3a: build the JSON-SAFE result BEFORE persisting/returning. The
      // external success shape stays `{ success, taskId, task }`, but the
      // stored+returned `task` here is a TRIMMED object of primitives only —
      // it deliberately OMITS the createdAt/lastModifiedAt/originalDeadline/
      // deadline serverTimestamp+Timestamp sentinels that live in `taskData`,
      // because `transaction.create` rejects sentinel values inside the stored
      // processed_operations record. Callers use taskId; the full live task doc
      // is re-read by the client, so dropping the sentinels from the echoed
      // task is backward-compatible.
      const txnResult = {
        success: true,
        taskId: taskRef.id,
        task: {
          id: taskRef.id,
          description: taskData.description,
          categoryId: taskData.categoryId,
          categoryName: taskData.categoryName,
          clientId: taskData.clientId,
          clientName: taskData.clientName,
          caseNumber: taskData.caseNumber,
          serviceId: taskData.serviceId,
          serviceName: taskData.serviceName,
          serviceType: taskData.serviceType,
          parentServiceId: taskData.parentServiceId,
          branch: taskData.branch,
          estimatedHours: taskData.estimatedHours,
          estimatedMinutes: taskData.estimatedMinutes,
          actualHours: taskData.actualHours,
          actualMinutes: taskData.actualMinutes,
          originalEstimate: taskData.originalEstimate,
          status: taskData.status,
          employee: taskData.employee,
          lawyer: taskData.lawyer,
          createdBy: taskData.createdBy,
          lastModifiedBy: taskData.lastModifiedBy
        }
      };

      // PR-3a (idempotency): record the completed operation LAST, with
      // .create() (NOT .set()) so a truly concurrent second transaction fails
      // atomically with ALREADY_EXISTS — the desired serialization. The stored
      // record is JSON-safe (no serverTimestamp sentinels inside txnResult).
      if (idemRef) {
        writeProcessedOperation(transaction, idemRef, data.idempotencyKey, txnResult);
        console.log(`  ✅ Idempotency record queued: ${data.idempotencyKey}`);
      }

      console.log(`🔒 [Transaction] All writes queued, committing...`);

      return txnResult;
        });

        didWrite = txnDidWrite;
        break; // transaction succeeded (or replayed) — exit retry loop

      } catch (txnError) {
        // PR-3a (idempotency): concurrent idempotent double. A sibling call with
        // the SAME key won the transaction.create() race, so our create threw
        // ALREADY_EXISTS. The operation SUCCEEDED under this key → return the
        // stored result, NOT a failure (surfacing a false failure would push
        // the user to re-submit with a fresh key — the exact duplicate this
        // fix prevents). If the winner's doc isn't visible yet, fall through
        // and retry — the next attempt's Phase-1 read finds it.
        if (data.idempotencyKey && txnError.code === 'already-exists') {
          const replayedResult = await replayAlreadyExists(db, data.idempotencyKey);
          if (replayedResult !== null) {
            console.log(`🔄 [createBudgetTask] Concurrent idempotent replay for key ${data.idempotencyKey}`);
            result = replayedResult;
            didWrite = false;
            break;
          }
          if (attempt < MAX_IDEMPOTENCY_RETRIES) {
            console.log(`⚠️ [createBudgetTask] already-exists (winner not visible yet) on attempt ${attempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            continue;
          }
          // Retries exhausted on a genuine already-exists: a sibling committed
          // this key but its record never became visible in the backoff window.
          // The write SUCCEEDED under this key — do NOT surface the raw SDK
          // 'already exists' string (that would leak English into the Hebrew UI
          // (G1) AND train the user to re-submit with a fresh key = the exact
          // duplicate this fix prevents). Throw a clean Hebrew "already recorded"
          // signal instead.
          throw new functions.https.HttpsError(
            'aborted',
            'הרישום כבר נקלט במערכת. רענן את המסך ובדוק לפני רישום מחדש.'
          );
        }

        throw txnError;
      }
    }

    console.log(`✅ Created task ${result.taskId} for client ${clientId} (atomic)`);

    // Audit log (OUTSIDE transaction - eventual consistency)
    // PR-3a: guarded by didWrite — on a replay no task was created, so writing
    // a second CREATE_TASK audit entry would be a duplicate of the log trail.
    if (didWrite) {
      try {
        await logAction('CREATE_TASK', user.uid, user.username, {
          taskId: result.taskId,
          clientId: clientId,
          caseNumber: clientData ? clientData.caseNumber : null,
          estimatedHours: estimatedHours
        });
      } catch (auditError) {
        console.error('❌ שגיאה ב-audit log:', auditError);
        // Don't fail the task creation if audit logging fails
      }
    } else {
      console.log(`🔄 [createBudgetTask] Replay — skipping audit log (no new mutation)`);
    }

    return result;

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
 * הוספת זמן למשימה V2 - With Transaction + Optimistic Locking
 * ✅ FIXED: כל הפעולות ב-transaction אחד למניעת race conditions
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

    // ✅ שימוש בגרסה החדשה עם Transaction + Optimistic Locking
    const result = await addTimeToTaskWithTransaction(db, data, user);
    return result;

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

    // Prepare ref
    const taskRef = db.collection('budget_tasks').doc(data.taskId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Task Completion
    // ═══════════════════════════════════════════════════════════════════

    let taskData, gapPercent, isCritical;

    await db.runTransaction(async (transaction) => {

      // ========================================
      // PHASE 1: READ OPERATION
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading task...`);

      const taskDoc = await transaction.get(taskRef);

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'משימה לא נמצאה'
        );
      }

      taskData = taskDoc.data();

      if (taskData.employee !== user.email && user.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'אין הרשאה לסמן משימה זו כהושלמה'
        );
      }

      // ✅ בדיקה שיש רישומי זמן לפני סיום המשימה
      // משתמש ב-actualMinutes (מקור-אמת אמין) במקום actualHours שעלול להיות שגוי
      // במשימות ישנות (drift היסטורי לפני commit 0626a47, 2026-03-29)
      const actualMinutesForValidation = taskData.actualMinutes || 0;
      if (actualMinutesForValidation === 0) {
        const taskTitle = taskData.taskDescription || taskData.description || 'משימה ללא כותרת';
        throw new functions.https.HttpsError(
          'failed-precondition',
          `❌ לא ניתן לסיים משימה ללא רישומי זמן!

משימה: ${taskTitle}
תקציב: ${taskData.budgetHours || 0} שעות
בפועל: 0 שעות

אנא רשום זמן לפני סיום המשימה.
זה מבטיח מעקב מדויק ונתונים אמיתיים.`
        );
      }

      // ✨ NEW: Calculate time gap for validation tracking
      const estimatedMinutes = taskData.estimatedMinutes || 0;
      const actualMinutes = taskData.actualMinutes || 0;
      const gapMinutes = actualMinutes - estimatedMinutes;
      gapPercent = estimatedMinutes > 0 ? Math.abs((gapMinutes / estimatedMinutes) * 100) : 0;
      isCritical = gapPercent >= 50;

      // Prepare update object
      const updateData = {
        status: 'הושלם',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: user.username,
        completionNotes: data.completionNotes ? sanitizeString(data.completionNotes) : '',
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        // ✨ NEW: Add completion metadata
        completion: {
          gapPercent: Math.round(gapPercent),
          gapMinutes: Math.abs(gapMinutes),
          estimatedMinutes,
          actualMinutes,
          isOver: gapMinutes > 0,
          isUnder: gapMinutes < 0,
          gapReason: data.gapReason || null,
          gapNotes: data.gapNotes || null,
          requiresReview: isCritical,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      };

      // ========================================
      // PHASE 3: WRITE OPERATION
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing task update...`);

      transaction.update(taskRef, updateData);

      console.log(`🔒 [Transaction] Task completion queued, committing...`);
    });

    console.log(`✅ משימה סומנה כהושלמה: ${data.taskId} (atomic)`);
    console.log(`ℹ️ קיזוז שעות כבר בוצע בעת רישום השעתון (createTimesheetEntry)`);
    console.log(`📊 פער זמן: ${Math.round(gapPercent)}% (${Math.abs(gapPercent)} דקות)`);

    // ✨ NEW: Create admin alert for critical gaps (OUTSIDE transaction - eventual consistency)
    if (isCritical) {
      try {
        await db.collection('task_completion_alerts').add({
          taskId: data.taskId,
          taskTitle: taskData.taskDescription || taskData.description || 'משימה ללא כותרת',
          clientName: taskData.clientName || '',
          employee: user.username,
          employeeEmail: user.email,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          gapPercent: Math.round(gapPercent),
          gapMinutes: Math.abs(Math.abs(taskData.actualMinutes || 0) - (taskData.estimatedMinutes || 0)),
          isOver: (taskData.actualMinutes || 0) > (taskData.estimatedMinutes || 0),
          estimatedMinutes: taskData.estimatedMinutes || 0,
          actualMinutes: taskData.actualMinutes || 0,
          gapReason: data.gapReason || null,
          gapNotes: data.gapNotes || null,
          completionNotes: data.completionNotes || '',
          status: 'pending', // pending, reviewed, approved, rejected
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`🚨 התראה נוצרה למנהל - פער קריטי של ${Math.round(gapPercent)}%`);
      } catch (alertError) {
        console.error('❌ שגיאה ביצירת התראה למנהל:', alertError);
        // Don't fail the completion if alert creation fails
      }
    }

    // Audit log (OUTSIDE transaction - eventual consistency)
    try {
      await logAction('COMPLETE_TASK', user.uid, user.username, {
        taskId: data.taskId,
        actualMinutes: taskData.actualMinutes || 0,
        gapPercent: Math.round(gapPercent),
        isCritical
      });
    } catch (auditError) {
      console.error('❌ שגיאה ב-audit log:', auditError);
      // Don't fail the completion if audit logging fails
    }

    return {
      success: true,
      taskId: data.taskId,
      gapPercent: Math.round(gapPercent),
      isCritical
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

// ═════════════════════════════════════════════════════════════════════════════
// ❌ CANCEL BUDGET TASK (Soft Delete)
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Cancel an active budget task (soft delete)
 *
 * @param {Object} data - Function parameters
 * @param {string} data.taskId - Task ID to cancel
 * @param {string} data.reason - Cancellation reason (required, non-empty)
 *
 * Rules:
 * - Only allow cancel if task.status === 'פעיל'
 * - Block if actualMinutes > 0 (task has time entries)
 * - Require non-empty reason
 *
 * Updates:
 * - status='בוטל'
 * - cancelReason, cancelledAt, cancelledBy
 * - lastModifiedAt, lastModifiedBy
 *
 * Audit: Logs CANCEL_TASK action
 */
exports.cancelBudgetTask = functions.https.onCall(async (data, context) => {
  try {
    // Authentication and permissions check
    const user = await checkUserPermissions(context);
    console.log(`🔄 [cancelBudgetTask] User: ${user.username} (${user.email})`);

    // Validate input
    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק סיבת ביטול'
      );
    }

    const reason = sanitizeString(data.reason.trim());
    if (reason.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סיבת הביטול לא יכולה להיות ריקה'
      );
    }

    // Prepare refs
    const taskRef = db.collection('budget_tasks').doc(data.taskId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Task + Approval Cancellation
    // ═══════════════════════════════════════════════════════════════════

    let taskData;

    await db.runTransaction(async (transaction) => {
      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading task and approval...`);

      const taskDoc = await transaction.get(taskRef);

      // Query for approval record
      const approvalSnapshot = await db.collection('pending_task_approvals')
        .where('taskId', '==', data.taskId)
        .limit(1)
        .get();

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'משימה לא נמצאה'
        );
      }

      taskData = taskDoc.data();

      // Authorization: Allow admin OR task owner
      const isAdmin = user.employee.isAdmin === true || user.role === 'admin';
      const isOwner = taskData.employee === user.email;

      if (!isAdmin && !isOwner) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'אין הרשאה לבטל משימה זו. רק בעל המשימה או מנהל מערכת יכולים לבטל משימה.'
        );
      }

      // Validate task status
      if (taskData.status !== 'פעיל') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `לא ניתן לבטל משימה עם סטטוס: ${taskData.status}. ניתן לבטל רק משימות פעילות.`
        );
      }

      // Block if task has time entries
      const actualMinutes = taskData.actualMinutes || 0;
      if (actualMinutes > 0) {
        const actualHours = (actualMinutes / 60).toFixed(2);
        throw new functions.https.HttpsError(
          'failed-precondition',
          `לא ניתן לבטל משימה עם רישומי זמן (${actualHours} שעות נרשמו). נא לפנות למנהל/ת לטיפול במשימה.`
        );
      }

      // Prepare task update
      const taskUpdateData = {
        status: 'בוטל',
        cancelReason: reason,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: user.username,
        cancelledByEmail: user.email,
        cancelledByUid: user.uid,
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Prepare approval update (if exists)
      let approvalUpdateData = null;
      let approvalRef = null;
      if (!approvalSnapshot.empty) {
        approvalRef = approvalSnapshot.docs[0].ref;
        approvalUpdateData = {
          status: 'task_cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: user.username,
          cancelledByEmail: user.email
        };
        console.log(`  🔗 עדכון approval מוכן: ${approvalRef.id}`);
      }

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing updates...`);

      // Write #1: Task (always)
      transaction.update(taskRef, taskUpdateData);
      console.log(`  ✅ Task update queued`);

      // Write #2: Approval (if exists)
      if (approvalRef && approvalUpdateData) {
        transaction.update(approvalRef, approvalUpdateData);
        console.log(`  ✅ Approval update queued`);
      }

      console.log(`🔒 [Transaction] All updates queued, committing...`);
    });

    console.log(`✅ משימה בוטלה: ${data.taskId} (atomic)`);
    console.log(`📝 סיבה: ${reason}`);

    // Audit log (OUTSIDE transaction - eventual consistency)
    try {
      await logAction('CANCEL_TASK', user.uid, user.username, {
        taskId: data.taskId,
        reason: reason,
        clientId: taskData.clientId || null,
        clientName: taskData.clientName || null
      });
    } catch (auditError) {
      console.error('❌ שגיאה ב-audit log:', auditError);
      // Don't fail the cancellation if audit logging fails
    }

    return {
      success: true,
      taskId: data.taskId,
      cancelledAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in cancelBudgetTask:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בביטול משימה: ${error.message}`
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

    // Prepare ref
    const taskRef = db.collection('budget_tasks').doc(data.taskId);

    // ═══════════════════════════════════════════════════════════════════
    // 🔒 ATOMIC TRANSACTION - Budget Adjustment
    // ═══════════════════════════════════════════════════════════════════

    let taskData;
    let result = null;
    // PR-3a: true only when THIS call's transaction actually performed the
    // update (fresh key, or key not yet processed). False on any replay path —
    // the post-transaction audit log must NOT re-run on a replayed duplicate.
    let didWrite = false;

    for (let attempt = 1; attempt <= MAX_IDEMPOTENCY_RETRIES; attempt++) {
      try {
        let txnDidWrite = true;
        result = await db.runTransaction(async (transaction) => {
      // ========================================
      // PHASE 1: READ OPERATIONS
      // ========================================

      console.log(`📖 [Transaction Phase 1] Reading task...`);

      const taskDoc = await transaction.get(taskRef);

      // ========================================
      // PHASE 2: VALIDATIONS + CALCULATIONS
      // ========================================

      console.log(`🧮 [Transaction Phase 2] Validations and calculations...`);

      if (!taskDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'משימה לא נמצאה'
        );
      }

      taskData = taskDoc.data();

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

      // PR-3a (idempotency): read the processed-operations record LAST in
      // Phase 1 (after the task read, before the update — Firestore
      // reads-before-writes). If this key was already committed, short-circuit:
      // return the stored result verbatim, performing NO task update (no
      // duplicate budgetAdjustments arrayUnion) and NO audit log.
      let idemRef = null;
      if (data.idempotencyKey) {
        const idemLookup = await readProcessedOperation(transaction, db, data.idempotencyKey);
        idemRef = idemLookup.ref;
        if (idemLookup.existingResult !== null) {
          console.log(`🔄 [adjustTaskBudget] Idempotent replay — returning stored result for key ${data.idempotencyKey}`);
          txnDidWrite = false;
          return idemLookup.existingResult;
        }
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

      // Prepare update data
      const updateData = {
        estimatedMinutes: data.newEstimate,
        estimatedHours: data.newEstimate / 60,
        budgetAdjustments: admin.firestore.FieldValue.arrayUnion(adjustment),
        lastModifiedBy: user.username,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // ========================================
      // PHASE 3: WRITE OPERATIONS
      // ========================================

      console.log(`💾 [Transaction Phase 3] Writing budget adjustment...`);

      transaction.update(taskRef, updateData);
      console.log(`  ✅ Budget adjustment queued`);

      // PR-3a: JSON-safe result — plain primitives only (oldEstimate,
      // newEstimate, addedMinutes, message). No serverTimestamp sentinels, so
      // it stores + replays verbatim via transaction.create. Same external
      // success shape as before.
      const txnResult = {
        success: true,
        taskId: data.taskId,
        oldEstimate,
        newEstimate: data.newEstimate,
        addedMinutes,
        message: `תקציב עודכן מ-${oldEstimate} ל-${data.newEstimate} דקות`
      };

      // PR-3a (idempotency): record the completed operation LAST, with
      // .create() (NOT .set()) so a truly concurrent second transaction fails
      // atomically with ALREADY_EXISTS — the desired serialization.
      if (idemRef) {
        writeProcessedOperation(transaction, idemRef, data.idempotencyKey, txnResult);
        console.log(`  ✅ Idempotency record queued: ${data.idempotencyKey}`);
      }

      console.log(`🔒 [Transaction] Update queued, committing...`);

      return txnResult;
        });

        didWrite = txnDidWrite;
        break; // transaction succeeded (or replayed) — exit retry loop

      } catch (txnError) {
        // PR-3a (idempotency): concurrent idempotent double — see createBudgetTask
        // for the full rationale. Replay the winner's stored result; if not yet
        // visible, retry; on exhaustion surface a clean Hebrew "already recorded".
        if (data.idempotencyKey && txnError.code === 'already-exists') {
          const replayedResult = await replayAlreadyExists(db, data.idempotencyKey);
          if (replayedResult !== null) {
            console.log(`🔄 [adjustTaskBudget] Concurrent idempotent replay for key ${data.idempotencyKey}`);
            result = replayedResult;
            didWrite = false;
            break;
          }
          if (attempt < MAX_IDEMPOTENCY_RETRIES) {
            console.log(`⚠️ [adjustTaskBudget] already-exists (winner not visible yet) on attempt ${attempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            continue;
          }
          throw new functions.https.HttpsError(
            'aborted',
            'הרישום כבר נקלט במערכת. רענן את המסך ובדוק לפני רישום מחדש.'
          );
        }

        throw txnError;
      }
    }

    console.log(`✅ תקציב משימה ${data.taskId} עודכן ל-${data.newEstimate} דקות (atomic)`);

    // Audit log (OUTSIDE transaction - eventual consistency)
    // PR-3a: guarded by didWrite — a replay performed no update, so a second
    // ADJUST_BUDGET audit entry would duplicate the log trail.
    if (didWrite) {
      try {
        await logAction('ADJUST_BUDGET', user.uid, user.username, {
          taskId: data.taskId,
          oldEstimate: result.oldEstimate,
          newEstimate: data.newEstimate,
          addedMinutes: result.addedMinutes,
          reason: data.reason
        });
      } catch (auditError) {
        console.error('❌ שגיאה ב-audit log:', auditError);
        // Don't fail the budget adjustment if audit logging fails
      }
    } else {
      console.log(`🔄 [adjustTaskBudget] Replay — skipping audit log (no new mutation)`);
    }

    return result;

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
