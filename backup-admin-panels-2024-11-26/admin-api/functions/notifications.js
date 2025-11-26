/**
 * ========================================
 * Admin API - Notifications System
 * ========================================
 * מערכת התראות למנהלים
 *
 * תפקידים:
 * - שליחת התראה למשתמש ספציפי
 * - שליחת הודעת שידור לכולם
 * - שליחת תזכורות על משימות
 *
 * Note: התראות נשמרות ב-Firestore ויופיעו בפעמון ההתראות
 * של המשתמש (notification-bell.js)
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

// ==================== Send Notification to User ====================

/**
 * שליחת התראה למשתמש ספציפי
 * ההתראה תופיע בפעמון ההתראות שלו
 *
 * @param {Object} data
 * @param {string} data.userEmail - email של המשתמש
 * @param {string} data.title - כותרת ההתראה
 * @param {string} data.message - תוכן ההתראה
 * @param {string} [data.type] - סוג (info/success/warning/error) ברירת מחדל: info
 * @param {string} [data.actionUrl] - URL לפעולה (אופציונלי)
 * @param {string} [data.actionText] - טקסט כפתור פעולה (אופציונלי)
 *
 * @returns {Promise<{success: boolean, notificationId: string, message: string}>}
 *
 * @example
 * await adminSendNotification({
 *   userEmail: 'employee@example.com',
 *   title: 'משימה דחופה',
 *   message: 'יש לך משימה חדשה שדורשת טיפול מיידי',
 *   type: 'warning',
 *   actionUrl: '/tasks',
 *   actionText: 'לצפייה במשימה'
 * });
 */
exports.adminSendNotification = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔔 Sending notification to: ${data.userEmail}`);

    // Validation
    if (!data.userEmail) {
      throw createError('invalid-argument', 'יש לציין כתובת מייל של משתמש');
    }

    if (!data.title || !data.message) {
      throw createError('invalid-argument', 'יש לציין כותרת ותוכן להתראה');
    }

    const validTypes = ['info', 'success', 'warning', 'error'];
    const notificationType = data.type || 'info';

    if (!validTypes.includes(notificationType)) {
      throw createError('invalid-argument', `סוג התראה לא תקין. אפשרויות: ${validTypes.join(', ')}`);
    }

    // וידוא שהמשתמש קיים
    const employeeSnapshot = await admin.firestore()
      .collection('employees')
      .where('email', '==', data.userEmail)
      .limit(1)
      .get();

    if (employeeSnapshot.empty) {
      throw createError('not-found', 'המשתמש לא נמצא');
    }

    const employee = employeeSnapshot.docs[0].data();
    const employeeUsername = employee.username || employee.name;

    // יצירת ההתראה
    const notificationData = {
      userId: employeeUsername,
      userEmail: data.userEmail,
      title: data.title,
      message: data.message,
      type: notificationType,
      actionUrl: data.actionUrl || null,
      actionText: data.actionText || null,
      read: false,
      sentBy: 'admin',
      sentByEmail: adminEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // אייקון לפי סוג
      icon: getIconForType(notificationType)
    };

    const notificationRef = await admin.firestore()
      .collection('notifications')
      .add(notificationData);

    // Audit logging
    await logAudit({
      action: 'ADMIN_SEND_NOTIFICATION',
      performedBy: adminEmail,
      targetUser: data.userEmail,
      data: {
        title: data.title,
        type: notificationType,
        notificationId: notificationRef.id
      },
      success: true
    });

    return {
      success: true,
      notificationId: notificationRef.id,
      message: `ההתראה נשלחה בהצלחה ל-${employeeUsername}`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_SEND_NOTIFICATION',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.userEmail,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminSendNotification');
  }
});

// ==================== Broadcast Notification ====================

/**
 * שליחת הודעת שידור לכל המשתמשים במערכת
 *
 * @param {Object} data
 * @param {string} data.title - כותרת ההודעה
 * @param {string} data.message - תוכן ההודעה
 * @param {string} [data.type] - סוג (info/success/warning/error) ברירת מחדל: info
 * @param {boolean} [data.excludeBlocked=true] - האם לא לשלוח לחסומים?
 * @param {string[]} [data.roleFilter] - שליחה רק לתפקידים ספציפיים (אופציונלי)
 *
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 *
 * @example
 * await adminBroadcastNotification({
 *   title: 'עדכון מערכת',
 *   message: 'המערכת תהיה בתחזוקה ביום ראשון 10:00-12:00',
 *   type: 'warning',
 *   excludeBlocked: true,
 *   roleFilter: ['lawyer', 'employee'] // לא לשלוח ל-interns
 * });
 */
exports.adminBroadcastNotification = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`📢 Broadcasting notification: ${data.title}`);

    // Validation
    if (!data.title || !data.message) {
      throw createError('invalid-argument', 'יש לציין כותרת ותוכן להודעה');
    }

    const validTypes = ['info', 'success', 'warning', 'error'];
    const notificationType = data.type || 'info';

    if (!validTypes.includes(notificationType)) {
      throw createError('invalid-argument', `סוג התראה לא תקין. אפשרויות: ${validTypes.join(', ')}`);
    }

    // קבלת כל העובדים
    let employeesQuery = admin.firestore().collection('employees');

    // סינון לפי חסימה
    if (data.excludeBlocked !== false) {
      employeesQuery = employeesQuery.where('blocked', '==', false);
    }

    const employeesSnapshot = await employeesQuery.get();

    if (employeesSnapshot.empty) {
      return {
        success: true,
        count: 0,
        message: 'לא נמצאו משתמשים לשליחה'
      };
    }

    // הכנת ההתראות (ב-batch ליעילות)
    const batch = admin.firestore().batch();
    let count = 0;

    employeesSnapshot.forEach((doc) => {
      const employee = doc.data();

      // סינון לפי תפקיד (אם צוין)
      if (data.roleFilter && Array.isArray(data.roleFilter)) {
        if (!data.roleFilter.includes(employee.role)) {
          return; // דלג על עובד זה
        }
      }

      const notificationRef = admin.firestore().collection('notifications').doc();
      batch.set(notificationRef, {
        userId: employee.username || employee.name,
        userEmail: employee.email,
        title: data.title,
        message: data.message,
        type: notificationType,
        read: false,
        broadcast: true,
        sentBy: 'admin',
        sentByEmail: adminEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        icon: getIconForType(notificationType)
      });

      count++;
    });

    await batch.commit();

    // Audit logging
    await logAudit({
      action: 'ADMIN_BROADCAST_NOTIFICATION',
      performedBy: adminEmail,
      data: {
        title: data.title,
        type: notificationType,
        count: count,
        roleFilter: data.roleFilter,
        excludeBlocked: data.excludeBlocked !== false
      },
      success: true
    });

    return {
      success: true,
      count: count,
      message: `ההודעה נשלחה ל-${count} משתמשים`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_BROADCAST_NOTIFICATION',
      performedBy: context.auth?.token?.email || 'unknown',
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminBroadcastNotification');
  }
});

// ==================== Send Task Reminder ====================

/**
 * שליחת תזכורת למשתמש על משימה ספציפית
 *
 * @param {Object} data
 * @param {string} data.taskId - מזהה המשימה
 * @param {string} [data.customMessage] - הודעה מותאמת (אופציונלי)
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminSendTaskReminder = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`⏰ Sending task reminder for: ${data.taskId}`);

    if (!data.taskId) {
      throw createError('invalid-argument', 'יש לציין מזהה משימה');
    }

    // קבלת המשימה
    const taskDoc = await admin.firestore()
      .collection('budget_tasks')
      .doc(data.taskId)
      .get();

    if (!taskDoc.exists) {
      throw createError('not-found', 'המשימה לא נמצאה');
    }

    const taskData = taskDoc.data();

    // וידוא שיש עובד משוייך
    if (!taskData.employee) {
      throw createError('invalid-argument', 'המשימה לא משויכת לעובד');
    }

    // יצירת הודעת תזכורת
    const defaultMessage = data.customMessage ||
      `יש לך משימה ממתינה: ${taskData.taskDescription || taskData.description}`;

    const notificationData = {
      userId: taskData.lawyer,
      userEmail: taskData.employee,
      title: `תזכורת: ${taskData.clientName}`,
      message: defaultMessage,
      type: 'warning',
      actionUrl: `/tasks?taskId=${data.taskId}`,
      actionText: 'לצפייה במשימה',
      read: false,
      taskId: data.taskId,
      reminder: true,
      sentBy: 'admin',
      sentByEmail: adminEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      icon: '⏰'
    };

    await admin.firestore()
      .collection('notifications')
      .add(notificationData);

    // Audit logging
    await logAudit({
      action: 'ADMIN_SEND_TASK_REMINDER',
      performedBy: adminEmail,
      targetUser: taskData.employee,
      data: {
        taskId: data.taskId,
        taskDescription: taskData.taskDescription || taskData.description
      },
      success: true
    });

    return {
      success: true,
      message: `תזכורת נשלחה ל-${taskData.lawyer}`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_SEND_TASK_REMINDER',
      performedBy: context.auth?.token?.email || 'unknown',
      data: { taskId: data.taskId },
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminSendTaskReminder');
  }
});

// ==================== Helper Functions ====================

/**
 * קבלת אייקון לפי סוג התראה
 */
function getIconForType(type) {
  const icons = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  };
  return icons[type] || 'ℹ️';
}
