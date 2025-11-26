/**
 * ========================================
 * Admin API - Tasks Management
 * ========================================
 * פונקציות ניהול משימות (Tasks & Timesheet Entries)
 *
 * תפקידים:
 * - העברת משימות בין עובדים
 * - מחיקת משימות
 * - השלמת משימות
 * - עדכון דדליינים
 *
 * @version 1.0.0
 * @date 2025-10-23
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  checkAdminAuth,
  logAudit,
  createError,
  handleError
} = require('./utils');

// ==================== Transfer Single Task ====================

/**
 * העברת משימה בודדת מעובד אחד לאחר
 *
 * @param {Object} data
 * @param {string} data.taskId - מזהה המשימה
 * @param {string} data.fromEmployeeEmail - email של העובד הנוכחי
 * @param {string} data.toEmployeeEmail - email של העובד החדש
 * @param {string} [data.reason] - סיבת ההעברה (אופציונלי)
 *
 * @returns {Promise<{success: boolean, message: string}>}
 *
 * @example
 * await adminTransferTask({
 *   taskId: '12345',
 *   fromEmployeeEmail: 'haim@example.com',
 *   toEmployeeEmail: 'danny@example.com',
 *   reason: 'העובד בחופש'
 * });
 */
exports.adminTransferTask = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔄 Transferring task ${data.taskId} from ${data.fromEmployeeEmail} to ${data.toEmployeeEmail}`);

    // Validation
    if (!data.taskId) {
      throw createError('invalid-argument', 'יש לציין מזהה משימה');
    }

    if (!data.toEmployeeEmail) {
      throw createError('invalid-argument', 'יש לציין עובד יעד');
    }

    // וידוא שהעובד היעד קיים
    const toEmployeeSnapshot = await admin.firestore()
      .collection('employees')
      .where('email', '==', data.toEmployeeEmail)
      .limit(1)
      .get();

    if (toEmployeeSnapshot.empty) {
      throw createError('not-found', 'העובד היעד לא נמצא');
    }

    const toEmployee = toEmployeeSnapshot.docs[0].data();
    const toEmployeeUsername = toEmployee.username || toEmployee.name;

    // עדכון המשימה ב-budget_tasks
    const taskRef = admin.firestore().collection('budget_tasks').doc(data.taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw createError('not-found', 'המשימה לא נמצאה');
    }

    const taskData = taskDoc.data();
    const oldEmployee = taskData.employee;
    const oldLawyer = taskData.lawyer;

    await taskRef.update({
      employee: data.toEmployeeEmail,  // ✅ Email for security rules
      lawyer: toEmployeeUsername,      // Username for display
      transferredBy: adminEmail,
      transferredAt: admin.firestore.FieldValue.serverTimestamp(),
      transferReason: data.reason || 'לא צוין',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit logging
    await logAudit({
      action: 'ADMIN_TRANSFER_TASK',
      performedBy: adminEmail,
      data: {
        taskId: data.taskId,
        fromEmployee: oldEmployee,
        toEmployee: data.toEmployeeEmail,
        taskDescription: taskData.taskDescription || taskData.description,
        reason: data.reason
      },
      success: true
    });

    return {
      success: true,
      message: `המשימה הועברה בהצלחה מ-${oldLawyer} ל-${toEmployeeUsername}`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_TRANSFER_TASK',
      performedBy: context.auth?.token?.email || 'unknown',
      data: { taskId: data.taskId },
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminTransferTask');
  }
});

// ==================== Bulk Transfer Tasks ====================

/**
 * העברת כל המשימות של עובד לעובד אחר
 * שימושי כאשר עובד עוזב או בחופשה ארוכה
 *
 * @param {Object} data
 * @param {string} data.fromEmployeeEmail - email של העובד המקור
 * @param {string} data.toEmployeeEmail - email של העובד היעד
 * @param {boolean} [data.includeCompleted=false] - האם להעביר גם משימות שהושלמו?
 * @param {string} [data.reason] - סיבת ההעברה
 *
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
exports.adminBulkTransferTasks = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔄 Bulk transferring tasks from ${data.fromEmployeeEmail} to ${data.toEmployeeEmail}`);

    // Validation
    if (!data.fromEmployeeEmail) {
      throw createError('invalid-argument', 'יש לציין עובד מקור');
    }

    if (!data.toEmployeeEmail) {
      throw createError('invalid-argument', 'יש לציין עובד יעד');
    }

    if (data.fromEmployeeEmail === data.toEmployeeEmail) {
      throw createError('invalid-argument', 'לא ניתן להעביר משימות לאותו עובד');
    }

    // קבלת העובד היעד
    const toEmployeeSnapshot = await admin.firestore()
      .collection('employees')
      .where('email', '==', data.toEmployeeEmail)
      .limit(1)
      .get();

    if (toEmployeeSnapshot.empty) {
      throw createError('not-found', 'העובד היעד לא נמצא');
    }

    const toEmployee = toEmployeeSnapshot.docs[0].data();
    const toEmployeeUsername = toEmployee.username || toEmployee.name;

    // קבלת כל המשימות של העובד המקור
    let tasksQuery = admin.firestore()
      .collection('budget_tasks')
      .where('employee', '==', data.fromEmployeeEmail);

    // אם לא רוצים להעביר משימות שהושלמו
    if (!data.includeCompleted) {
      tasksQuery = tasksQuery.where('status', '!=', 'הושלם');
    }

    const tasksSnapshot = await tasksQuery.get();

    if (tasksSnapshot.empty) {
      return {
        success: true,
        count: 0,
        message: 'לא נמצאו משימות להעברה'
      };
    }

    // העברת המשימות ב-batch (יעיל יותר)
    const batch = admin.firestore().batch();
    let count = 0;

    tasksSnapshot.forEach((doc) => {
      batch.update(doc.ref, {
        employee: data.toEmployeeEmail,
        lawyer: toEmployeeUsername,
        transferredBy: adminEmail,
        transferredAt: admin.firestore.FieldValue.serverTimestamp(),
        transferReason: data.reason || 'העברה קבוצתית',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });

    await batch.commit();

    // Audit logging
    await logAudit({
      action: 'ADMIN_BULK_TRANSFER_TASKS',
      performedBy: adminEmail,
      data: {
        fromEmployee: data.fromEmployeeEmail,
        toEmployee: data.toEmployeeEmail,
        count: count,
        includeCompleted: data.includeCompleted,
        reason: data.reason
      },
      success: true
    });

    return {
      success: true,
      count: count,
      message: `${count} משימות הועברו בהצלחה ל-${toEmployeeUsername}`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_BULK_TRANSFER_TASKS',
      performedBy: context.auth?.token?.email || 'unknown',
      data: {
        fromEmployee: data.fromEmployeeEmail,
        toEmployee: data.toEmployeeEmail
      },
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminBulkTransferTasks');
  }
});

// ==================== Delete Task ====================

/**
 * מחיקת משימה (⚠️ פעולה בלתי הפיכה!)
 *
 * @param {Object} data
 * @param {string} data.taskId - מזהה המשימה
 * @param {boolean} data.confirm - חובה לשלוח true
 * @param {string} [data.reason] - סיבת המחיקה
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminDeleteTask = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🗑️  Deleting task: ${data.taskId}`);

    if (!data.taskId) {
      throw createError('invalid-argument', 'יש לציין מזהה משימה');
    }

    if (!data.confirm) {
      throw createError('invalid-argument', 'יש לאשר את המחיקה (confirm: true)');
    }

    // קבלת פרטי המשימה
    const taskRef = admin.firestore().collection('budget_tasks').doc(data.taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw createError('not-found', 'המשימה לא נמצאה');
    }

    const taskData = taskDoc.data();

    // מחיקה
    await taskRef.delete();

    // Audit logging
    await logAudit({
      action: 'ADMIN_DELETE_TASK',
      performedBy: adminEmail,
      data: {
        taskId: data.taskId,
        taskDescription: taskData.taskDescription || taskData.description,
        clientName: taskData.clientName,
        employee: taskData.employee,
        reason: data.reason
      },
      success: true
    });

    return {
      success: true,
      message: 'המשימה נמחקה לצמיתות'
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_DELETE_TASK',
      performedBy: context.auth?.token?.email || 'unknown',
      data: { taskId: data.taskId },
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminDeleteTask');
  }
});

// ==================== Complete Task ====================

/**
 * סימון משימה כהושלמה (בשביל עובד)
 *
 * @param {Object} data
 * @param {string} data.taskId - מזהה המשימה
 * @param {string} [data.completionNotes] - הערות השלמה
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminCompleteTask = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`✅ Completing task: ${data.taskId}`);

    if (!data.taskId) {
      throw createError('invalid-argument', 'יש לציין מזהה משימה');
    }

    // קבלת המשימה
    const taskRef = admin.firestore().collection('budget_tasks').doc(data.taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw createError('not-found', 'המשימה לא נמצאה');
    }

    const taskData = taskDoc.data();

    if (taskData.status === 'הושלם') {
      return {
        success: true,
        message: 'המשימה כבר מסומנת כהושלמה'
      };
    }

    // עדכון סטטוס
    await taskRef.update({
      status: 'הושלם',
      completedBy: 'admin',
      completedByAdmin: adminEmail,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completionNotes: data.completionNotes || '',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit logging
    await logAudit({
      action: 'ADMIN_COMPLETE_TASK',
      performedBy: adminEmail,
      data: {
        taskId: data.taskId,
        taskDescription: taskData.taskDescription || taskData.description,
        employee: taskData.employee,
        completionNotes: data.completionNotes
      },
      success: true
    });

    return {
      success: true,
      message: 'המשימה סומנה כהושלמה'
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_COMPLETE_TASK',
      performedBy: context.auth?.token?.email || 'unknown',
      data: { taskId: data.taskId },
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminCompleteTask');
  }
});

// ==================== Update Task Deadline ====================

/**
 * עדכון דדליין של משימה
 *
 * @param {Object} data
 * @param {string} data.taskId - מזהה המשימה
 * @param {string} data.newDeadline - תאריך חדש (format: YYYY-MM-DD)
 * @param {string} [data.reason] - סיבת השינוי
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminUpdateTaskDeadline = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`📅 Updating deadline for task: ${data.taskId} to ${data.newDeadline}`);

    if (!data.taskId) {
      throw createError('invalid-argument', 'יש לציין מזהה משימה');
    }

    if (!data.newDeadline) {
      throw createError('invalid-argument', 'יש לציין תאריך חדש');
    }

    // בדיקת תקינות תאריך
    const deadlineDate = new Date(data.newDeadline);
    if (isNaN(deadlineDate.getTime())) {
      throw createError('invalid-argument', 'תאריך לא תקין');
    }

    // קבלת המשימה
    const taskRef = admin.firestore().collection('budget_tasks').doc(data.taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw createError('not-found', 'המשימה לא נמצאה');
    }

    const taskData = taskDoc.data();
    const oldDeadline = taskData.deadline;

    // עדכון דדליין
    await taskRef.update({
      deadline: data.newDeadline,
      deadlineChangedBy: adminEmail,
      deadlineChangedAt: admin.firestore.FieldValue.serverTimestamp(),
      deadlineChangeReason: data.reason || 'לא צוין',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit logging
    await logAudit({
      action: 'ADMIN_UPDATE_TASK_DEADLINE',
      performedBy: adminEmail,
      data: {
        taskId: data.taskId,
        taskDescription: taskData.taskDescription || taskData.description,
        oldDeadline: oldDeadline,
        newDeadline: data.newDeadline,
        reason: data.reason
      },
      success: true
    });

    return {
      success: true,
      message: `הדדליין עודכן ל-${data.newDeadline}`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_UPDATE_TASK_DEADLINE',
      performedBy: context.auth?.token?.email || 'unknown',
      data: { taskId: data.taskId },
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminUpdateTaskDeadline');
  }
});
