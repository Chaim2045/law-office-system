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
const DELETION_ENABLED = true; // ← Phase 3: ENABLED!

/**
 * 🔒 PHASE 3 LIMIT - מגבלת פריטים למחיקה
 */
const PHASE_3_MAX_ITEMS = 50; // ← Phase 3: מקסימום 50 פריטים

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

  // 🚨 DRY RUN MODE - תצוגה מקדימה בלבד
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

  // 🚀 PHASE 3: REAL DELETION - מחיקה אמיתית
  console.log(`🚀 PHASE 3: Starting real deletion of ${itemIds.length} items from ${collection}`);

  // Phase 3: בדיקת מגבלה
  if (itemIds.length > PHASE_3_MAX_ITEMS) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Phase 3: מקסימום ${PHASE_3_MAX_ITEMS} פריטים למחיקה. נבחרו ${itemIds.length}`
    );
  }

  // Firestore Batch Transaction - rollback safety
  const batch = db.batch();

  itemIds.forEach(id => {
    const docRef = db.collection(collection).doc(id);
    batch.delete(docRef);
  });

  try {
    await batch.commit();
    console.log(`✅ Successfully deleted ${itemIds.length} items from ${collection}`);

    return {
      collection,
      deleted: itemIds.length,
      items: verifiedItems.map(item => ({
        id: item.id,
        deletedAt: new Date().toISOString()
      })),
      dryRun: false
    };
  } catch (error) {
    console.error(`❌ Batch delete failed for ${collection}:`, error);
    throw new functions.https.HttpsError(
      'internal',
      `כישלון במחיקת ${collection}: ${error.message}`
    );
  }
}

/**
 * Delete orphaned approvals for deleted tasks
 * מחיקת אישורים יתומים למשימות שנמחקו
 */
async function deleteOrphanedApprovals(db, deletedTaskIds) {
  if (deletedTaskIds.length === 0) return 0;

  console.log(`🔍 Checking for orphaned approvals for ${deletedTaskIds.length} deleted tasks...`);

  let totalDeleted = 0;

  // בדיקה ב-batches של 10 (Firestore 'in' limit)
  for (let i = 0; i < deletedTaskIds.length; i += 10) {
    const batch = deletedTaskIds.slice(i, i + 10);

    const approvalsSnapshot = await db.collection('pending_task_approvals')
      .where('taskId', 'in', batch)
      .get();

    if (approvalsSnapshot.empty) continue;

    const deleteBatch = db.batch();
    approvalsSnapshot.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });

    await deleteBatch.commit();
    totalDeleted += approvalsSnapshot.size;
  }

  if (totalDeleted > 0) {
    console.log(`🗑️ Deleted ${totalDeleted} orphaned approvals (cascade delete)`);
  }

  return totalDeleted;
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

  // Cascade delete orphaned approvals (רק במחיקה אמיתית)
  let orphanedApprovalsDeleted = 0;
  if (!dryRun && tasksResult.deleted > 0) {
    const deletedTaskIds = tasks.map(t => t.id);
    orphanedApprovalsDeleted = await deleteOrphanedApprovals(db, deletedTaskIds);
  }

  const totalDeleted = tasksResult.deleted + timesheetsResult.deleted + approvalsResult.deleted + orphanedApprovalsDeleted;

  console.log(`✅ Deletion executed: ${totalDeleted} items (dryRun: ${dryRun})`);
  if (orphanedApprovalsDeleted > 0) {
    console.log(`  └─ + ${orphanedApprovalsDeleted} orphaned approvals (cascade)`);
  }

  return {
    success: true,
    dryRun,
    deletedCounts: {
      tasks: tasksResult.deleted,
      timesheets: timesheetsResult.deleted,
      approvals: approvalsResult.deleted,
      orphanedApprovals: orphanedApprovalsDeleted,
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
