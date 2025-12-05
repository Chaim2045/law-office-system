/**
 * Stage Management - Cloud Function
 * ניהול מעבר בין שלבים בהליך משפטי
 *
 * @module stage-management
 * @version 1.0.0
 * @created 2025-01-26
 *
 * ════════════════════════════════════════════════════════════════════
 * 🎯 PURPOSE: Safe Stage Transition with Task Freezing
 * ════════════════════════════════════════════════════════════════════
 *
 * תהליך:
 * 1. בדיקת feature flag - האם הפיצ'ר מופעל?
 * 2. עדכון התיק לשלב הבא (Transaction)
 * 3. סימון משימות ישנות כ"קפואות" (אם הפיצ'ר מופעל)
 * 4. החזרת סטטוס + מספר משימות שהושפעו
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFeatureFlag } = require('./config/feature-flags');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * Update case stage and optionally freeze old tasks
 * עדכון שלב תיק וסימון משימות ישנות
 *
 * @param {Object} data - Request data
 * @param {string} data.caseId - Case ID (client document ID)
 * @param {string} data.currentStageId - Current stage ID
 * @param {string} data.newStageId - New stage ID
 * @param {string} data.newStageName - New stage name (for display)
 * @param {string} data.serviceId - Service ID (legal procedure)
 * @param {Object} context - Firebase context
 *
 * @returns {Promise<Object>} Result with success flag and stats
 */
async function updateCaseStage(data, context) {
  try {
    // ════════════════════════════════════════════════════════════════
    // 1. Validation & Authentication
    // ════════════════════════════════════════════════════════════════

    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    // Validate required fields
    const { caseId, currentStageId, newStageId, newStageName, serviceId } = data;

    if (!caseId || !currentStageId || !newStageId || !newStageName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים פרמטרים נדרשים'
      );
    }

    console.log(`🔄 Stage change requested: ${currentStageId} → ${newStageId} for case ${caseId}`);

    // ════════════════════════════════════════════════════════════════
    // 2. Check Feature Flag
    // ════════════════════════════════════════════════════════════════

    const frozenTasksEnabled = await getFeatureFlag('FROZEN_TASKS_ON_STAGE_CHANGE');
    console.log(`🎛️ Feature flag FROZEN_TASKS_ON_STAGE_CHANGE: ${frozenTasksEnabled}`);

    // ════════════════════════════════════════════════════════════════
    // 3. Update Case (Always happens)
    // ════════════════════════════════════════════════════════════════

    const caseRef = db.collection('clients').doc(caseId);
    const caseDoc = await caseRef.get();

    if (!caseDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `תיק ${caseId} לא נמצא`
      );
    }

    const caseData = caseDoc.data();

    // Update services array - mark stages
    const updatedServices = (caseData.services || []).map(service => {
      if (service.id === serviceId && service.stages) {
        const updatedStages = service.stages.map(stage => {
          if (stage.id === currentStageId) {
            // Mark current stage as completed
            return {
              ...stage,
              status: 'completed',
              completedAt: new Date().toISOString()
            };
          } else if (stage.id === newStageId) {
            // Mark new stage as active
            return {
              ...stage,
              status: 'active',
              startedAt: new Date().toISOString()
            };
          }
          return stage;
        });

        return {
          ...service,
          stages: updatedStages
        };
      }
      return service;
    });

    // Update case document
    await caseRef.update({
      services: updatedServices,
      currentStage: newStageId,
      currentStageName: newStageName,
      stageChangedAt: FieldValue.serverTimestamp(),
      stageChangedBy: context.auth.token.email || context.auth.uid,
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`✅ Case ${caseId} updated to stage ${newStageId}`);

    // ════════════════════════════════════════════════════════════════
    // 4. Freeze Tasks (Only if feature enabled)
    // ════════════════════════════════════════════════════════════════

    let frozenTasksCount = 0;

    if (frozenTasksEnabled) {
      console.log('🧊 Freezing old stage tasks...');

      // Find all active tasks on the old stage
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('caseId', '==', caseId)
        .where('serviceId', '==', currentStageId)
        .where('status', '!=', 'הושלם')
        .get();

      if (!tasksSnapshot.empty) {
        // Batch update (max 500 per batch)
        const batches = [];
        let currentBatch = db.batch();
        let batchCount = 0;

        tasksSnapshot.forEach(taskDoc => {
          const taskData = taskDoc.data();

          // Only freeze if not already frozen
          if (!taskData.isFrozen) {
            currentBatch.update(taskDoc.ref, {
              isFrozen: true,
              frozenReason: 'stage_changed',
              frozenAt: FieldValue.serverTimestamp(),
              originalStage: currentStageId,
              caseMovedToStage: newStageId,
              caseMovedToStageName: newStageName,
              updatedAt: FieldValue.serverTimestamp()
            });

            batchCount++;
            frozenTasksCount++;

            // Firestore batch limit = 500
            if (batchCount === 500) {
              batches.push(currentBatch.commit());
              currentBatch = db.batch();
              batchCount = 0;
            }
          }
        });

        // Commit remaining batch
        if (batchCount > 0) {
          batches.push(currentBatch.commit());
        }

        // Execute all batches
        await Promise.all(batches);

        console.log(`✅ Frozen ${frozenTasksCount} tasks`);
      } else {
        console.log('ℹ️ No active tasks found on old stage');
      }
    } else {
      console.log('⏭️ Skipping task freezing (feature disabled)');
    }

    // ════════════════════════════════════════════════════════════════
    // 5. Return Result
    // ════════════════════════════════════════════════════════════════

    return {
      success: true,
      caseId,
      from: currentStageId,
      to: newStageId,
      toName: newStageName,
      frozenTasks: frozenTasksCount,
      featureEnabled: frozenTasksEnabled,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error in updateCaseStage:', error);

    // Return proper error
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      'שגיאה בעדכון שלב: ' + error.message
    );
  }
}

/**
 * Unfreeze specific task
 * ביטול קיפאון משימה ספציפית
 *
 * @param {Object} data - Request data
 * @param {string} data.taskId - Task ID to unfreeze
 */
async function unfreezeTask(data, context) {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    const { taskId } = data;

    if (!taskId) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר taskId');
    }

    const taskRef = db.collection('budget_tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'משימה לא נמצאה');
    }

    await taskRef.update({
      isFrozen: false,
      frozenReason: null,
      frozenAt: null,
      unfrozenAt: FieldValue.serverTimestamp(),
      unfrozenBy: context.auth.token.email || context.auth.uid
    });

    console.log(`✅ Task ${taskId} unfrozen`);

    return { success: true, taskId };

  } catch (error) {
    console.error('❌ Error unfreezing task:', error);
    throw error;
  }
}

// Export functions
module.exports = {
  updateCaseStage,
  unfreezeTask
};
