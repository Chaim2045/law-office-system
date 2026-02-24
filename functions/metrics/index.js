/** Metrics Module — מדדים וסטטיסטיקות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { checkUserPermissions } = require('../shared/auth');

const db = admin.firestore();

/**
 * getUserMetrics - קבלת סטטיסטיקות משתמש מהשרת
 *
 * מחזיר מטריקות מחושבות מראש מ-user_metrics collection
 * אם לא קיים - מחשב בזמן אמת (fallback)
 *
 * @returns {Object} { total, active, completed, urgent, updatedAt }
 */
const getUserMetrics = functions.https.onCall(async (data, context) => {
  try {
    // Security: בדיקת הרשאות
    const user = await checkUserPermissions(context);

    // נסה לקרוא metrics מראש מחושבים
    const metricsDoc = await db.collection('user_metrics').doc(user.email).get();

    if (metricsDoc.exists) {
      const metrics = metricsDoc.data();

      // בדוק שהנתונים לא ישנים מדי (יותר מ-5 דקות)
      const now = Date.now();
      const updatedAt = metrics.updatedAt?.toMillis() || 0;
      const ageMinutes = (now - updatedAt) / (1000 * 60);

      if (ageMinutes < 5) {
        // נתונים טריים - החזר מיידית
        return {
          success: true,
          data: {
            total: metrics.total || 0,
            active: metrics.active || 0,
            completed: metrics.completed || 0,
            urgent: metrics.urgent || 0,
            updatedAt: metrics.updatedAt,
            source: 'cache'
          }
        };
      }
    }

    // Fallback: חישוב בזמן אמת
    console.log(`⚡ Computing real-time metrics for ${user.email}`);

    const tasksSnapshot = await db.collection('budget_tasks')
      .where('employee', '==', user.email)
      .get();

    const now = new Date();
    const urgentThresholdMs = 72 * 60 * 60 * 1000; // 72 hours

    let total = 0;
    let active = 0;
    let completed = 0;
    let urgent = 0;

    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      total++;

      if (task.status === 'הושלם') {
        completed++;
      } else {
        active++;

        // בדוק דחיפות
        if (task.deadline) {
          const deadline = task.deadline.toMillis ? task.deadline.toMillis() : new Date(task.deadline).getTime();
          const timeUntilDeadline = deadline - now.getTime();

          if (timeUntilDeadline <= urgentThresholdMs && timeUntilDeadline >= -24 * 60 * 60 * 1000) {
            urgent++;
          }
        }
      }
    });

    const metrics = {
      total,
      active,
      completed,
      urgent,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // שמור לcache עבור פעם הבאה
    await db.collection('user_metrics').doc(user.email).set(metrics, { merge: true });

    return {
      success: true,
      data: {
        ...metrics,
        source: 'computed'
      }
    };

  } catch (error) {
    console.error('❌ getUserMetrics error:', error);
    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בטעינת מטריקות: ${error.message}`
    );
  }
});

/**
 * updateMetricsOnTaskChange - טריגר עדכון מטריקות על שינוי משימה
 *
 * מתעדכן אוטומטית כאשר:
 * - נוצרת משימה חדשה (onCreate)
 * - משימה משתנה (onUpdate)
 * - משימה נמחקת (onDelete)
 *
 * מעדכן את user_metrics/{email} באופן אטומי
 */
const updateMetricsOnTaskChange = onDocumentWritten({
  document: 'budget_tasks/{taskId}',
  region: 'us-central1'
}, async (event) => {
    try {
      const taskId = event.params.taskId;
      const change = event.data;

      // קבל את המשימה (לפני/אחרי)
      const oldTask = change.before.exists ? change.before.data() : null;
      const newTask = change.after.exists ? change.after.data() : null;

      // אם אין employee - דלג
      const employee = (newTask?.employee || oldTask?.employee);
      if (!employee) {
        console.log(`⏭️  Skipping task ${taskId} - no employee`);
        return null;
      }

      console.log(`📊 Updating metrics for ${employee} (task: ${taskId})`);

      // חשב שינוי במטריקות
      const metricsRef = db.collection('user_metrics').doc(employee);

      const now = new Date();
      const urgentThresholdMs = 72 * 60 * 60 * 1000; // 72 hours

      // פונקציה לבדיקת דחיפות
      const isUrgent = (task) => {
        if (!task?.deadline || task.status === 'הושלם') return false;
        const deadline = task.deadline.toMillis ? task.deadline.toMillis() : new Date(task.deadline).getTime();
        const timeUntilDeadline = deadline - now.getTime();
        return timeUntilDeadline <= urgentThresholdMs && timeUntilDeadline >= -24 * 60 * 60 * 1000;
      };

      // חשב שינויים
      let totalDelta = 0;
      let activeDelta = 0;
      let completedDelta = 0;
      let urgentDelta = 0;

      if (!oldTask && newTask) {
        // משימה חדשה
        totalDelta = 1;
        if (newTask.status === 'הושלם') {
          completedDelta = 1;
        } else {
          activeDelta = 1;
          if (isUrgent(newTask)) urgentDelta = 1;
        }
      } else if (oldTask && !newTask) {
        // משימה נמחקה
        totalDelta = -1;
        if (oldTask.status === 'הושלם') {
          completedDelta = -1;
        } else {
          activeDelta = -1;
          if (isUrgent(oldTask)) urgentDelta = -1;
        }
      } else if (oldTask && newTask) {
        // משימה השתנתה
        const oldCompleted = oldTask.status === 'הושלם';
        const newCompleted = newTask.status === 'הושלם';
        const oldUrgent = isUrgent(oldTask);
        const newUrgent = isUrgent(newTask);

        if (oldCompleted !== newCompleted) {
          if (newCompleted) {
            activeDelta = -1;
            completedDelta = 1;
            if (oldUrgent) urgentDelta = -1;
          } else {
            activeDelta = 1;
            completedDelta = -1;
            if (newUrgent) urgentDelta = 1;
          }
        } else if (!newCompleted && oldUrgent !== newUrgent) {
          // שינוי בדחיפות (בלי שינוי סטטוס)
          urgentDelta = newUrgent ? 1 : -1;
        }
      }

      // עדכון אטומי
      if (totalDelta !== 0 || activeDelta !== 0 || completedDelta !== 0 || urgentDelta !== 0) {
        await metricsRef.set({
          total: admin.firestore.FieldValue.increment(totalDelta),
          active: admin.firestore.FieldValue.increment(activeDelta),
          completed: admin.firestore.FieldValue.increment(completedDelta),
          urgent: admin.firestore.FieldValue.increment(urgentDelta),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`✅ Metrics updated: total(${totalDelta > 0 ? '+' : ''}${totalDelta}) active(${activeDelta > 0 ? '+' : ''}${activeDelta}) completed(${completedDelta > 0 ? '+' : ''}${completedDelta}) urgent(${urgentDelta > 0 ? '+' : ''}${urgentDelta})`);
      } else {
        console.log(`⏭️  No metric changes for task ${taskId}`);
      }

      return null;
    } catch (error) {
      console.error('❌ updateMetricsOnTaskChange error:', error);
      // לא נזרוק שגיאה - טריגר לא צריך לעצור פעולות
      return null;
    }
  });

module.exports = { getUserMetrics, updateMetricsOnTaskChange };
