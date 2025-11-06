/**
 * Real-time Task Update System
 * מערכת עדכון משימות בזמן אמת עם התראות אוטומטיות
 *
 * Created: 6/11/2025
 * Version: 1.0.0
 *
 * תכונות:
 * ✅ עדכון משימות עם diff detection
 * ✅ התראות אוטומטיות למשתמשים
 * ✅ תמיכה בעדכונים מנהל → משתמש
 * ✅ רישום audit log מלא
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Helper: יצירת התראה למשתמש
 * @param {Object} db - Firestore instance
 * @param {string} userId - Email של המשתמש
 * @param {Object} notification - נתוני ההתראה
 */
async function createUserNotification(db, userId, notification) {
  try {
    const notificationData = {
      userId: userId,
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      details: notification.details || null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      urgent: notification.urgent || false,
      actionUrl: notification.actionUrl || null
    };

    await db.collection('notifications').add(notificationData);
    console.log(`✅ Notification created for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    // Don't throw - notification failure shouldn't break the update
  }
}

/**
 * Helper: זיהוי שינויים במשימה (diff detection)
 * @param {Object} oldData - נתונים ישנים
 * @param {Object} newData - נתונים חדשים
 * @returns {Array} רשימת שינויים
 */
function detectTaskChanges(oldData, newData) {
  const changes = [];

  // שדות שאנחנו רוצים לעקוב אחריהם
  const fieldsToTrack = {
    description: 'תיאור המשימה',
    status: 'סטטוס',
    deadline: 'תאריך יעד',
    estimatedHours: 'שעות משוערות',
    estimatedMinutes: 'דקות משוערות',
    branch: 'סניף מטפל',
    categoryName: 'קטגוריה',
    clientName: 'לקוח'
  };

  for (const [field, label] of Object.entries(fieldsToTrack)) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    // Special handling for Timestamp fields
    if (field === 'deadline') {
      const oldDate = oldValue?.toDate ? oldValue.toDate() : (oldValue ? new Date(oldValue) : null);
      const newDate = newValue?.toDate ? newValue.toDate() : (newValue ? new Date(newValue) : null);

      if (oldDate?.getTime() !== newDate?.getTime()) {
        changes.push({
          field: label,
          oldValue: oldDate ? oldDate.toLocaleDateString('he-IL') : 'לא הוגדר',
          newValue: newDate ? newDate.toLocaleDateString('he-IL') : 'לא הוגדר'
        });
      }
    } else if (oldValue !== newValue) {
      changes.push({
        field: label,
        oldValue: oldValue || 'לא הוגדר',
        newValue: newValue || 'לא הוגדר'
      });
    }
  }

  return changes;
}

/**
 * Cloud Function: עדכון משימה עם התראות
 */
exports.updateBudgetTask = functions.https.onCall(async (data, context) => {
  try {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    const uid = context.auth.uid;

    // Get user details
    const employeeSnapshot = await admin.firestore().collection('employees')
      .where('authUID', '==', uid)
      .limit(1)
      .get();

    if (employeeSnapshot.empty) {
      throw new functions.https.HttpsError(
        'not-found',
        'עובד לא נמצא במערכת'
      );
    }

    const employeeDoc = employeeSnapshot.docs[0];
    const employee = employeeDoc.data();

    if (!employee.isActive) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'חשבון המשתמש לא פעיל'
      );
    }

    const user = {
      uid,
      email: employeeDoc.id,
      username: employee.username,
      role: employee.role || 'employee'
    };

    // Validation
    if (!data.taskId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה משימה'
      );
    }

    if (!data.updates || typeof data.updates !== 'object') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים נתונים לעדכון'
      );
    }

    const db = admin.firestore();
    const taskRef = db.collection('budget_tasks').doc(data.taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'משימה לא נמצאה'
      );
    }

    const oldTaskData = taskDoc.data();

    // Permission check: Only admin or task owner can update
    if (user.role !== 'admin' && oldTaskData.employee !== user.email) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'אין לך הרשאה לערוך משימה זו'
      );
    }

    // Prepare update data
    const updateData = {
      ...data.updates,
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Handle deadline conversion
    if (updateData.deadline && typeof updateData.deadline === 'string') {
      updateData.deadline = admin.firestore.Timestamp.fromDate(new Date(updateData.deadline));
    }

    // Detect changes
    const changes = detectTaskChanges(oldTaskData, updateData);

    console.log(`📝 Updating task ${data.taskId}:`, changes);

    // Update task
    await taskRef.update(updateData);

    // 🔔 Send notification to task owner (if updated by someone else)
    if (user.email !== oldTaskData.employee && changes.length > 0) {
      const changesText = changes
        .map(c => `• ${c.field}: ${c.oldValue} → ${c.newValue}`)
        .join('\n');

      await createUserNotification(db, oldTaskData.employee, {
        type: user.role === 'admin' ? 'critical' : 'urgent',
        title: `עדכון משימה: ${oldTaskData.description}`,
        message: `${user.username} עדכן את המשימה שלך`,
        details: {
          taskId: data.taskId,
          taskDescription: oldTaskData.description,
          updatedBy: user.username,
          updatedByRole: user.role,
          changes: changes,
          changesText: changesText,
          clientName: oldTaskData.clientName
        },
        urgent: true,
        actionUrl: `/task/${data.taskId}` // For future navigation
      });

      console.log(`📨 Notification sent to ${oldTaskData.employee}`);
    }

    // Audit log
    await db.collection('audit_log').add({
      action: 'UPDATE_TASK',
      userId: user.uid,
      username: user.username,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        taskId: data.taskId,
        changes: changes,
        updatedFields: Object.keys(data.updates)
      }
    });

    console.log(`✅ Task ${data.taskId} updated successfully`);

    return {
      success: true,
      taskId: data.taskId,
      changes: changes
    };

  } catch (error) {
    console.error('❌ Error in updateBudgetTask:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון משימה: ${error.message}`
    );
  }
});

/**
 * Cloud Function: סימון התראה כנקראה
 */
exports.markNotificationAsRead = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    if (!data.notificationId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה התראה'
      );
    }

    const db = admin.firestore();
    await db.collection('notifications').doc(data.notificationId).update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון התראה: ${error.message}`
    );
  }
});
