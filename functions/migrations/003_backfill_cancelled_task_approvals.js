/**
 * Migration 003: Backfill Legacy Cancelled Task Approvals
 *
 * Created: 2026-01-13
 * Author: Claude Code (via feature/task-cancel-approval-sync)
 * Issue: Legacy cancelled tasks still show as 'auto_approved' in admin panel
 *
 * PROBLEM:
 * Before commit fd574e8 (2026-01-12), when tasks were cancelled:
 * - budget_tasks.status → 'בוטל' ✅
 * - pending_task_approvals.status → stayed 'auto_approved' ❌
 *
 * This causes:
 * - Admin approval panel shows cancelled tasks (wrong)
 * - Badge counts cancelled tasks (wrong)
 * - Confusing UX for admins
 *
 * ROOT CAUSE:
 * cancelBudgetTask function didn't sync approval records before fd574e8.
 * Only new cancellations (after fd574e8) are synced correctly.
 *
 * SOLUTION:
 * Find all legacy cancelled tasks and sync their approval records:
 * 1. Query budget_tasks where status == 'בוטל'
 * 2. For each, find matching pending_task_approvals by taskId
 * 3. Update approval.status → 'task_cancelled'
 * 4. Copy cancellation metadata from task (if exists)
 * 5. Add backfill audit trail
 *
 * AFFECTED DATA:
 * Unknown count - all tasks cancelled before 2026-01-12 17:47.
 *
 * SAFETY:
 * - Dry run mode available (default)
 * - Rollback support (restore status='auto_approved')
 * - Batch processing (500 operations/batch)
 * - Detailed logging
 * - Marks backfilled approvals for audit trail
 * - Safe: only updates approvals for ACTUALLY cancelled tasks
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

module.exports = {
  /**
   * Run the migration - Backfill cancelled task approvals
   * @returns {Object} Migration statistics
   */
  up: async () => {
    const db = admin.firestore();
    const stats = {
      totalCancelledTasks: 0,
      approvalMatches: 0,
      approvalUpdated: 0,
      approvalNotFound: 0,
      approvalAlreadySynced: 0,
      errors: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('🔄 MIGRATION 003: Backfill Cancelled Task Approvals');
    console.log('='.repeat(70));
    console.log('Mode: EXECUTE (making real changes)');
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      // Step 1: Get all cancelled tasks
      console.log('📥 Fetching cancelled tasks (status=בוטל)...');
      const cancelledTasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'בוטל')
        .get();

      stats.totalCancelledTasks = cancelledTasksSnapshot.size;
      console.log(`   Found ${stats.totalCancelledTasks} cancelled tasks\n`);

      if (stats.totalCancelledTasks === 0) {
        console.log('✅ No cancelled tasks found - nothing to backfill');
        return stats;
      }

      // Process in batches
      const BATCH_SIZE = 500; // Firestore limit
      let batch = db.batch();
      let batchCount = 0;
      let totalBatches = 0;

      console.log('🔍 Processing cancelled tasks...\n');

      for (const taskDoc of cancelledTasksSnapshot.docs) {
        const taskId = taskDoc.id;
        const taskData = taskDoc.data();

        try {
          // Step 2: Find matching approval record
          const approvalSnapshot = await db.collection('pending_task_approvals')
            .where('taskId', '==', taskId)
            .limit(1)
            .get();

          if (approvalSnapshot.empty) {
            // No approval record found (task might be from before approval system)
            stats.approvalNotFound++;
            console.log(`  ⚠️  No approval found for task ${taskId} (${taskData.clientName || 'N/A'})`);
            continue;
          }

          const approvalDoc = approvalSnapshot.docs[0];
          const approvalData = approvalDoc.data();
          stats.approvalMatches++;

          // Step 3: Check if already synced (skip if status is already 'task_cancelled')
          if (approvalData.status === 'task_cancelled') {
            stats.approvalAlreadySynced++;
            console.log(`  ⏭️  Already synced: ${taskId} (approval status already 'task_cancelled')`);
            continue;
          }

          // Step 4: Prepare update data
          const updateData = {
            status: 'task_cancelled',
            // Copy cancellation metadata from task if exists
            cancelledAt: taskData.cancelledAt || admin.firestore.FieldValue.serverTimestamp(),
            cancelledByUid: taskData.cancelledByUid || null,
            cancelledByEmail: taskData.cancelledByEmail || null,
            cancelledBy: taskData.cancelledBy || 'system_backfill',
            // Backfill audit trail
            backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
            backfillVersion: 1,
            backfillMigration: '003_backfill_cancelled_task_approvals'
          };

          // Add to batch
          batch.update(approvalDoc.ref, updateData);
          stats.approvalUpdated++;
          batchCount++;

          console.log(`  ✅ Queued update for approval ${approvalDoc.id} (task: ${taskId})`);
          console.log(`     Task: ${taskData.description || 'N/A'}`);
          console.log(`     Client: ${taskData.clientName || 'N/A'}`);
          console.log(`     Old approval status: ${approvalData.status}`);
          console.log(`     New approval status: task_cancelled`);
          console.log(`     Cancelled by: ${updateData.cancelledBy}\n`);

          // Commit batch if reached limit
          if (batchCount >= BATCH_SIZE) {
            console.log(`💾 Committing batch #${totalBatches + 1} (${batchCount} operations)...`);
            await batch.commit();
            totalBatches++;
            batch = db.batch(); // Start new batch
            batchCount = 0;
            console.log('   ✅ Batch committed\n');
          }

        } catch (error) {
          stats.errors.push(`Task ${taskId}: ${error.message}`);
          console.error(`  ❌ Error processing task ${taskId}:`, error.message);
          // Continue with next task (don't fail entire migration)
        }
      }

      // Commit remaining operations
      if (batchCount > 0) {
        console.log(`💾 Committing final batch #${totalBatches + 1} (${batchCount} operations)...`);
        await batch.commit();
        totalBatches++;
        console.log('   ✅ Final batch committed\n');
      }

      // Final summary
      const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(70));
      console.log(`Cancelled tasks scanned:       ${stats.totalCancelledTasks}`);
      console.log(`Approval records matched:      ${stats.approvalMatches}`);
      console.log(`Approvals updated:             ${stats.approvalUpdated} ✅`);
      console.log(`Already synced (skipped):      ${stats.approvalAlreadySynced}`);
      console.log(`Approvals not found:           ${stats.approvalNotFound}`);
      console.log(`Errors:                        ${stats.errors.length}`);
      console.log(`Batches committed:             ${totalBatches}`);
      console.log(`Duration:                      ${duration}s`);
      console.log('='.repeat(70) + '\n');

      if (stats.errors.length > 0) {
        console.log('⚠️  Errors encountered:');
        stats.errors.forEach((err, i) => {
          console.log(`   ${i + 1}. ${err}`);
        });
        console.log('');
      }

      return stats;

    } catch (error) {
      console.error('\n❌ MIGRATION FAILED:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  },

  /**
   * Rollback the migration - Restore approval status to 'auto_approved'
   * @returns {Object} Rollback statistics
   */
  down: async () => {
    const db = admin.firestore();
    const stats = {
      total: 0,
      rolledBack: 0,
      errors: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('⏮️  ROLLBACK MIGRATION 003');
    console.log('='.repeat(70));
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      // Find all backfilled approvals
      console.log('📥 Fetching backfilled approval records...');
      const snapshot = await db.collection('pending_task_approvals')
        .where('backfillVersion', '==', 1)
        .get();

      stats.total = snapshot.size;
      console.log(`   Found ${stats.total} backfilled approvals\n`);

      if (stats.total === 0) {
        console.log('✅ No backfilled approvals to rollback');
        return stats;
      }

      // Rollback in batches
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;
      let totalBatches = 0;

      for (const doc of snapshot.docs) {
        const approvalData = doc.data();

        // Restore to auto_approved
        batch.update(doc.ref, {
          status: 'auto_approved', // Restore original status
          // Remove cancellation metadata added by backfill
          cancelledAt: admin.firestore.FieldValue.delete(),
          cancelledByUid: admin.firestore.FieldValue.delete(),
          cancelledByEmail: admin.firestore.FieldValue.delete(),
          cancelledBy: admin.firestore.FieldValue.delete(),
          // Remove backfill markers
          backfilledAt: admin.firestore.FieldValue.delete(),
          backfillVersion: admin.firestore.FieldValue.delete(),
          backfillMigration: admin.firestore.FieldValue.delete()
        });

        stats.rolledBack++;
        batchCount++;

        console.log(`  ✅ Queued rollback for approval ${doc.id} (task: ${approvalData.taskId})`);

        if (batchCount >= BATCH_SIZE) {
          console.log(`💾 Committing batch #${totalBatches + 1}...`);
          await batch.commit();
          totalBatches++;
          batch = db.batch();
          batchCount = 0;
          console.log('   ✅ Batch committed\n');
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        console.log(`💾 Committing final batch #${totalBatches + 1}...`);
        await batch.commit();
        totalBatches++;
        console.log('   ✅ Final batch committed\n');
      }

      const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('✅ ROLLBACK COMPLETED');
      console.log('='.repeat(70));
      console.log(`Rolled back:     ${stats.rolledBack} approvals`);
      console.log(`Batches:         ${totalBatches}`);
      console.log(`Duration:        ${duration}s`);
      console.log('='.repeat(70) + '\n');

      console.log('⚠️  NOTE: Approvals restored to status=\'auto_approved\'.');
      console.log('   Cancelled tasks will now appear in admin panel again.');
      console.log('   Re-run migration (up) if this was unintended.\n');

      return stats;

    } catch (error) {
      console.error('\n❌ ROLLBACK FAILED:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  },

  /**
   * Dry run - Show what WOULD happen without making any changes
   * @returns {Object} Dry run statistics
   */
  dryRun: async () => {
    const db = admin.firestore();
    const stats = {
      totalCancelledTasks: 0,
      approvalMatches: 0,
      wouldUpdate: 0,
      approvalNotFound: 0,
      approvalAlreadySynced: 0,
      examples: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('🧪 DRY RUN: Migration 003');
    console.log('='.repeat(70));
    console.log('Mode: DRY RUN (no changes will be made)');
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      console.log('📥 Fetching cancelled tasks (status=בוטל)...');
      const cancelledTasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'בוטל')
        .get();

      stats.totalCancelledTasks = cancelledTasksSnapshot.size;
      console.log(`   Found ${stats.totalCancelledTasks} cancelled tasks\n`);

      if (stats.totalCancelledTasks === 0) {
        console.log('✅ No cancelled tasks found - nothing to backfill');
        return stats;
      }

      console.log('🔍 Analyzing approvals (first 5 shown as examples)...\n');
      let examplesShown = 0;
      const MAX_EXAMPLES = 5;

      for (const taskDoc of cancelledTasksSnapshot.docs) {
        const taskId = taskDoc.id;
        const taskData = taskDoc.data();

        try {
          // Find matching approval
          const approvalSnapshot = await db.collection('pending_task_approvals')
            .where('taskId', '==', taskId)
            .limit(1)
            .get();

          if (approvalSnapshot.empty) {
            stats.approvalNotFound++;
            if (examplesShown < MAX_EXAMPLES) {
              console.log(`  ⚠️  No approval for task ${taskId}`);
              console.log(`     Client: ${taskData.clientName || 'N/A'}\n`);
              examplesShown++;
            }
            continue;
          }

          const approvalDoc = approvalSnapshot.docs[0];
          const approvalData = approvalDoc.data();
          stats.approvalMatches++;

          if (approvalData.status === 'task_cancelled') {
            stats.approvalAlreadySynced++;
            if (examplesShown < MAX_EXAMPLES) {
              console.log(`  ⏭️  Already synced: ${taskId}`);
              console.log(`     Status: ${approvalData.status}\n`);
              examplesShown++;
            }
            continue;
          }

          // Would update this approval
          stats.wouldUpdate++;

          const example = {
            taskId,
            approvalId: approvalDoc.id,
            clientName: taskData.clientName || 'N/A',
            description: taskData.description || 'N/A',
            currentApprovalStatus: approvalData.status,
            cancelledBy: taskData.cancelledBy || 'system_backfill',
            cancelledAt: taskData.cancelledAt ? taskData.cancelledAt.toDate().toISOString() : 'N/A'
          };
          stats.examples.push(example);

          if (examplesShown < MAX_EXAMPLES) {
            console.log(`  ✅ WOULD UPDATE: Approval ${approvalDoc.id}`);
            console.log(`     Task ID: ${taskId}`);
            console.log(`     Client: ${example.clientName}`);
            console.log(`     Description: ${example.description}`);
            console.log(`     Current status: ${example.currentApprovalStatus}`);
            console.log(`     Would change to: task_cancelled`);
            console.log(`     Cancelled by: ${example.cancelledBy}`);
            console.log(`     Cancelled at: ${example.cancelledAt}\n`);
            examplesShown++;
          }

        } catch (error) {
          console.error(`  ❌ Error analyzing task ${taskId}:`, error.message);
        }
      }

      const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('📊 DRY RUN SUMMARY');
      console.log('='.repeat(70));
      console.log(`Cancelled tasks scanned:       ${stats.totalCancelledTasks}`);
      console.log(`Approval records matched:      ${stats.approvalMatches}`);
      console.log(`Would update:                  ${stats.wouldUpdate} ✅`);
      console.log(`Already synced (skip):         ${stats.approvalAlreadySynced}`);
      console.log(`Approvals not found:           ${stats.approvalNotFound}`);
      console.log(`Duration:                      ${duration}s`);
      console.log('='.repeat(70) + '\n');

      if (stats.wouldUpdate > 0) {
        console.log('⚠️  NEXT STEPS:');
        console.log('   1. Review the examples above');
        console.log('   2. Create database backup (IMPORTANT!)');
        console.log('      firebase firestore:export gs://your-bucket/backup-$(date +%s)');
        console.log('   3. If everything looks correct, run:');
        console.log('      node runner.js 003_backfill_cancelled_task_approvals up');
        console.log('');
      } else {
        console.log('✅ All approvals are already synced - no migration needed!');
        console.log('');
      }

      return stats;

    } catch (error) {
      console.error('\n❌ DRY RUN FAILED:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  }
};