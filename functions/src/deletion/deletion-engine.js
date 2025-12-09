/**
 * Deletion Engine Module
 * מנוע מחיקה מאובטח
 *
 * 🔒 Security Layer 4: Transaction Safety
 * כל מחיקה בטוחה עם rollback אוטומטי במקרה של כישלון
 *
 * 🚨 PHASE 1: READ-ONLY MODE
 * בשלב זה - המנוע רק מחזיר מה ימחק, לא מוחק בפועל!
 */

const functions = require('firebase-functions');

/**
 * 🔒 KILL SWITCH - אפשרות לכבות מחיקה בחירום
 */
const DELETION_ENABLED = false; // ← Phase 1: FALSE!

/**
 * Delete items in safe batches
 * מחיקת פריטים ב-batches מאובטחים
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} collection - שם הקולקציה
 * @param {Array} verifiedItems - פריטים מאומתים
 * @param {boolean} dryRun - מצב סימולציה
 * @returns {Promise<Object>}
 */
async function deleteInBatches(db, collection, verifiedItems, dryRun = true) {
  const itemIds = verifiedItems.map(item => item.id);

  if (itemIds.length === 0) {
    return {
      collection,
      deleted: 0,
      items: []
    };
  }

  console.log(`🗑️ Deleting ${itemIds.length} items from ${collection} (dryRun: ${dryRun})`);

  // 🚨 PHASE 1: READ-ONLY - לא מוחקים כלום!
  if (!DELETION_ENABLED || dryRun) {
    console.log(`ℹ️ DRY RUN: Would delete ${itemIds.length} items from ${collection}`);

    return {
      collection,
      deleted: itemIds.length,
      items: verifiedItems.map(item => ({
        id: item.id,
        preview: {
          clientName: item.data.clientName || 'N/A',
          description: item.data.description || item.data.serviceName || 'N/A',
          date: item.data.date || item.data.createdAt || 'N/A'
        }
      })),
      dryRun: true
    };
  }

  // 🚨 כאן יבוא הקוד למחיקה אמיתית ב-Phase 3+
  throw new functions.https.HttpsError(
    'unimplemented',
    '🔒 מחיקה אמיתית עדיין לא זמינה (Phase 1: Read-Only)'
  );
}

/**
 * Execute deletion (or dry run)
 * ביצוע מחיקה (או סימולציה)
 */
async function executeDeletion(db, verifiedOwnership, dryRun = true) {
  console.log(`🚀 Executing deletion (dryRun: ${dryRun})`);

  const { tasks, timesheets, approvals } = verifiedOwnership;

  // מחיקה במקביל
  const [tasksResult, timesheetsResult, approvalsResult] = await Promise.all([
    deleteInBatches(db, 'budget_tasks', tasks, dryRun),
    deleteInBatches(db, 'timesheet_entries', timesheets, dryRun),
    deleteInBatches(db, 'pending_task_approvals', approvals, dryRun)
  ]);

  const totalDeleted = tasksResult.deleted + timesheetsResult.deleted + approvalsResult.deleted;

  console.log(`✅ Deletion executed: ${totalDeleted} items (dryRun: ${dryRun})`);

  return {
    success: true,
    dryRun,
    deletedCounts: {
      tasks: tasksResult.deleted,
      timesheets: timesheetsResult.deleted,
      approvals: approvalsResult.deleted,
      total: totalDeleted
    },
    preview: {
      tasks: tasksResult.items || [],
      timesheets: timesheetsResult.items || [],
      approvals: approvalsResult.items || []
    }
  };
}

/**
 * Get deletion statistics
 * קבלת סטטיסטיקות מחיקה
 */
async function getDeletionStats(db, adminEmail, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const deletionsSnapshot = await db.collection('audit_log')
    .where('action', '==', 'delete_user_data_selective')
    .where('adminEmail', '==', adminEmail)
    .where('timestamp', '>', startDate)
    .get();

  let totalDeletions = 0;
  let totalItems = 0;

  deletionsSnapshot.forEach(doc => {
    const data = doc.data();
    if (!data.dryRun) {
      totalDeletions++;
      totalItems += (data.deletedCounts?.total || 0);
    }
  });

  return {
    last7Days: {
      deletions: totalDeletions,
      itemsDeleted: totalItems
    }
  };
}

module.exports = {
  executeDeletion,
  getDeletionStats,
  DELETION_ENABLED // ← יצוא ה-kill switch למעקב
};
