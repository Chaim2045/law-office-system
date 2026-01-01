/**
 * Fix Corrupted Tasks
 * תיקון משימות פגומות (חסרות serviceName/title)
 *
 * One-time fix for corrupted budget_tasks records
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Fix corrupted tasks - adds default serviceName and title
 */
exports.fixCorruptedTasks = functions.https.onCall(async (data, context) => {
  // Security: Admin only
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'רק מנהלים יכולים להריץ פונקציה זו'
    );
  }

  console.log('🔧 Starting corrupted tasks fix...');
  console.log(`👤 Requested by: ${context.auth.token.email}`);

  const db = admin.firestore();
  const tasksRef = db.collection('budget_tasks');

  try {
    // Option 1: Fix specific IDs (if provided)
    if (data && data.taskIds && Array.isArray(data.taskIds)) {
      console.log(`📋 Fixing ${data.taskIds.length} specific tasks`);
      return await fixSpecificTasks(db, data.taskIds);
    }

    // Option 2: Find and fix all corrupted tasks
    console.log('🔍 Scanning all tasks for corruption...');
    const allTasks = await tasksRef.get();

    const corrupted = [];
    const valid = [];

    allTasks.docs.forEach(doc => {
      const data = doc.data();

      if (!data.employee || (!data.serviceName && !data.title)) {
        corrupted.push({
          id: doc.id,
          data: data
        });
      } else {
        valid.push(doc.id);
      }
    });

    console.log(`✅ Valid tasks: ${valid.length}`);
    console.log(`❌ Corrupted tasks: ${corrupted.length}`);

    if (corrupted.length === 0) {
      return {
        success: true,
        message: 'לא נמצאו משימות פגומות',
        fixed: 0,
        total: allTasks.size
      };
    }

    // Fix corrupted tasks
    const fixed = [];
    const errors = [];

    for (const task of corrupted) {
      try {
        const updates = {};

        if (!task.data.serviceName) {
          updates.serviceName = 'משימה (לא צוין)';
        }

        if (!task.data.title) {
          updates.title = `משימה עבור ${task.data.clientName || 'לקוח'}`;
        }

        if (!task.data.employee) {
          // Can't fix - no employee
          console.error(`❌ Task ${task.id} has no employee - cannot fix`);
          errors.push({
            id: task.id,
            reason: 'חסר שדה employee'
          });
          continue;
        }

        await tasksRef.doc(task.id).update(updates);

        console.log(`✅ Fixed task ${task.id}:`, updates);
        fixed.push({
          id: task.id,
          employee: task.data.employee,
          updates: updates
        });

      } catch (error) {
        console.error(`❌ Error fixing task ${task.id}:`, error);
        errors.push({
          id: task.id,
          error: error.message
        });
      }
    }

    console.log(`✅ Successfully fixed ${fixed.length} tasks`);

    if (errors.length > 0) {
      console.warn(`⚠️ Failed to fix ${errors.length} tasks:`, errors);
    }

    return {
      success: true,
      message: `תוקנו ${fixed.length} משימות בהצלחה`,
      fixed: fixed,
      errors: errors,
      total: allTasks.size,
      corruptedFound: corrupted.length
    };

  } catch (error) {
    console.error('❌ Error in fixCorruptedTasks:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Fix specific tasks by IDs
 */
async function fixSpecificTasks(db, taskIds) {
  console.log(`📋 Fixing ${taskIds.length} specific tasks: ${taskIds.join(', ')}`);

  const fixed = [];
  const errors = [];

  for (const taskId of taskIds) {
    try {
      const docRef = db.collection('budget_tasks').doc(taskId);
      const doc = await docRef.get();

      if (!doc.exists) {
        errors.push({
          id: taskId,
          reason: 'משימה לא נמצאה'
        });
        continue;
      }

      const data = doc.data();
      const updates = {};

      if (!data.serviceName) {
        updates.serviceName = 'משימה (לא צוין)';
      }

      if (!data.title) {
        updates.title = `משימה עבור ${data.clientName || 'לקוח'}`;
      }

      if (Object.keys(updates).length > 0) {
        await docRef.update(updates);
        console.log(`✅ Fixed task ${taskId}:`, updates);
        fixed.push({
          id: taskId,
          employee: data.employee,
          updates: updates
        });
      } else {
        console.log(`ℹ️ Task ${taskId} already valid`);
      }

    } catch (error) {
      console.error(`❌ Error fixing task ${taskId}:`, error);
      errors.push({
        id: taskId,
        error: error.message
      });
    }
  }

  return {
    success: true,
    message: `תוקנו ${fixed.length} משימות מתוך ${taskIds.length}`,
    fixed: fixed,
    errors: errors
  };
}