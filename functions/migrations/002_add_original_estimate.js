/**
 * Migration 002: Add Original Estimate and Budget Tracking
 *
 * Created: 2025-01-26
 * Author: Claude Code
 * Issue: Phase 1 - Budget tracking enhancement
 *
 * PROBLEM:
 * Existing tasks don't have:
 * - originalEstimate (תקציב מקורי)
 * - originalDeadline (יעד מקורי)
 * - budgetAdjustments[] (היסטוריית עדכוני תקציב)
 * - deadlineExtensions[] (might be missing in old tasks)
 *
 * ROOT CAUSE:
 * These fields were added in Phase 1 to support:
 * - Tracking budget changes over time
 * - Showing users when they've exceeded original budget
 * - Displaying double progress bars (original vs current)
 *
 * SOLUTION:
 * For each existing task:
 * 1. Set originalEstimate = currentEstimateMinutes (if not set)
 * 2. Set originalDeadline = current deadline (if not set)
 * 3. Initialize budgetAdjustments = [] (if not set)
 * 4. Initialize deadlineExtensions = [] (if not set)
 *
 * SAFETY:
 * - Dry run mode available
 * - Rollback support
 * - Batch processing (respects Firestore 500 limit)
 * - Detailed logging
 * - Marks migrated tasks for audit trail
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

module.exports = {
  /**
   * Run the migration - Add original estimate fields
   * @returns {Object} Migration statistics
   */
  up: async () => {
    const db = admin.firestore();
    const stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('🔄 MIGRATION 002: Add Original Estimate Fields');
    console.log('='.repeat(70));
    console.log('Mode: EXECUTE (making real changes)');
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      // Get all tasks
      console.log('📥 Fetching all budget tasks...');
      const snapshot = await db.collection('budget_tasks').get();
      stats.total = snapshot.size;
      console.log(`   Found ${stats.total} tasks\n`);

      // Process in batches (Firestore limit = 500 operations per batch)
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;
      let totalBatches = 0;

      for (const doc of snapshot.docs) {
        const task = doc.data();
        const taskId = doc.id;

        // Check if migration needed
        const needsMigration = !task.hasOwnProperty('originalEstimate') ||
                               !task.hasOwnProperty('budgetAdjustments');

        if (needsMigration) {
          const updateData = {};

          // Set originalEstimate if missing
          if (!task.hasOwnProperty('originalEstimate')) {
            updateData.originalEstimate = task.estimatedMinutes || 0;
          }

          // Set originalDeadline if missing
          if (!task.hasOwnProperty('originalDeadline')) {
            updateData.originalDeadline = task.deadline || null;
          }

          // Initialize budgetAdjustments if missing
          if (!task.hasOwnProperty('budgetAdjustments')) {
            updateData.budgetAdjustments = [];
          }

          // Initialize deadlineExtensions if missing
          if (!task.hasOwnProperty('deadlineExtensions')) {
            updateData.deadlineExtensions = [];
          }

          // Add migration metadata
          updateData._migrated_002 = true;
          updateData._migration002Version = 1;
          updateData._migration002At = admin.firestore.FieldValue.serverTimestamp();
          updateData._migration002Name = '002_add_original_estimate';

          batch.update(doc.ref, updateData);
          stats.migrated++;
          batchCount++;

          console.log(`  ✅ Queued migration for task ${taskId}:`);
          console.log(`     originalEstimate: ${updateData.originalEstimate || task.originalEstimate} minutes`);
          console.log(`     currentEstimate: ${task.estimatedMinutes || 0} minutes`);
          console.log(`     actualMinutes: ${task.actualMinutes || 0} minutes`);
          console.log(`     Fields added: ${Object.keys(updateData).filter(k => !k.startsWith('_')).join(', ')}\n`);

          // Commit batch if reached limit
          if (batchCount >= BATCH_SIZE) {
            console.log(`💾 Committing batch #${totalBatches + 1} (${batchCount} operations)...`);
            await batch.commit();
            totalBatches++;
            batch = db.batch(); // Start new batch
            batchCount = 0;
            console.log('   ✅ Batch committed\n');
          }
        } else {
          // Already has fields
          stats.skipped++;
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
      console.log(`Total tasks:     ${stats.total}`);
      console.log(`Migrated:        ${stats.migrated} ✅`);
      console.log(`Skipped:         ${stats.skipped} (already migrated)`);
      console.log(`Errors:          ${stats.errors.length}`);
      console.log(`Batches:         ${totalBatches}`);
      console.log(`Duration:        ${duration}s`);
      console.log('='.repeat(70) + '\n');

      if (stats.errors.length > 0) {
        console.log('⚠️  Errors encountered:');
        stats.errors.forEach((err, i) => {
          console.log(`   ${i + 1}. ${err}`);
        });
      }

      console.log('✅ All tasks now have originalEstimate and tracking fields!');
      console.log('   Users can now see budget adjustments in the UI.\n');

      return stats;

    } catch (error) {
      console.error('\n❌ MIGRATION FAILED:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  },

  /**
   * Rollback the migration - Remove added fields
   * @returns {Object} Rollback statistics
   */
  down: async () => {
    const db = admin.firestore();
    const stats = {
      total: 0,
      rolledBack: 0,
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('⏮️  ROLLBACK MIGRATION 002');
    console.log('='.repeat(70));
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      // Find all migrated tasks
      console.log('📥 Fetching migrated tasks...');
      const snapshot = await db.collection('budget_tasks')
        .where('_migrated_002', '==', true)
        .get();

      stats.total = snapshot.size;
      console.log(`   Found ${stats.total} migrated tasks\n`);

      if (stats.total === 0) {
        console.log('✅ No tasks to rollback');
        return stats;
      }

      // Remove fields in batches
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
          originalEstimate: admin.firestore.FieldValue.delete(),
          originalDeadline: admin.firestore.FieldValue.delete(),
          budgetAdjustments: admin.firestore.FieldValue.delete(),
          // Keep deadlineExtensions if it existed before
          _migrated_002: admin.firestore.FieldValue.delete(),
          _migration002Version: admin.firestore.FieldValue.delete(),
          _migration002At: admin.firestore.FieldValue.delete(),
          _migration002Name: admin.firestore.FieldValue.delete()
        });

        stats.rolledBack++;
        batchCount++;
        console.log(`  ✅ Queued rollback for task ${doc.id}`);

        if (batchCount >= BATCH_SIZE) {
          console.log(`💾 Committing batch...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('✅ ROLLBACK COMPLETED');
      console.log('='.repeat(70));
      console.log(`Rolled back:     ${stats.rolledBack} tasks`);
      console.log(`Duration:        ${duration}s`);
      console.log('='.repeat(70) + '\n');

      return stats;

    } catch (error) {
      console.error('\n❌ ROLLBACK FAILED:', error);
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
      total: 0,
      wouldMigrate: 0,
      wouldSkip: 0,
      tasks: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('🧪 DRY RUN: Migration 002');
    console.log('='.repeat(70));
    console.log('Mode: DRY RUN (no changes will be made)');
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      console.log('📥 Fetching all budget tasks...');
      const snapshot = await db.collection('budget_tasks').get();
      stats.total = snapshot.size;
      console.log(`   Found ${stats.total} tasks\n`);

      console.log('🔍 Analyzing tasks...\n');

      for (const doc of snapshot.docs) {
        const task = doc.data();
        const taskId = doc.id;

        const needsMigration = !task.hasOwnProperty('originalEstimate') ||
                               !task.hasOwnProperty('budgetAdjustments');

        if (needsMigration) {
          stats.wouldMigrate++;
          const taskInfo = {
            taskId,
            clientName: task.clientName || 'Unknown',
            currentEstimate: task.estimatedMinutes || 0,
            actualMinutes: task.actualMinutes || 0,
            hasOriginal: task.hasOwnProperty('originalEstimate'),
            hasAdjustments: task.hasOwnProperty('budgetAdjustments')
          };
          stats.tasks.push(taskInfo);

          console.log(`  📝 WOULD MIGRATE: Task ${taskId}`);
          console.log(`     Client: ${taskInfo.clientName}`);
          console.log(`     Current estimate: ${taskInfo.currentEstimate} minutes`);
          console.log(`     Actual worked: ${taskInfo.actualMinutes} minutes`);
          console.log(`     Has originalEstimate: ${taskInfo.hasOriginal ? 'Yes' : 'No'}`);
          console.log(`     Has budgetAdjustments: ${taskInfo.hasAdjustments ? 'Yes' : 'No'}\n`);
        } else {
          stats.wouldSkip++;
        }
      }

      const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('📊 DRY RUN SUMMARY');
      console.log('='.repeat(70));
      console.log(`Total tasks:         ${stats.total}`);
      console.log(`Would migrate:       ${stats.wouldMigrate} 📝`);
      console.log(`Would skip:          ${stats.wouldSkip} ✅`);
      console.log(`Duration:            ${duration}s`);
      console.log('='.repeat(70) + '\n');

      if (stats.wouldMigrate > 0) {
        console.log('⚠️  NEXT STEPS:');
        console.log('   1. Review the tasks listed above');
        console.log('   2. If everything looks correct, run with mode "up"');
        console.log('   3. Command: node migrations/runner.js 002_add_original_estimate up');
      } else {
        console.log('✅ All tasks already have the required fields - no migration needed!');
      }

      console.log('');

      return stats;

    } catch (error) {
      console.error('\n❌ DRY RUN FAILED:', error);
      throw error;
    }
  }
};
