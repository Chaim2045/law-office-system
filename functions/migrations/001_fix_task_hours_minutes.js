/**
 * Migration 001: Fix actualHours/actualMinutes Inconsistency
 *
 * Created: 2025-10-23
 * Author: Claude Code
 * Issue: CRITICAL - Data integrity issue in budget_tasks
 *
 * PROBLEM:
 * Old tasks have mismatched actualHours and actualMinutes fields.
 * Some tasks have:
 * - actualHours defined but actualMinutes is different
 * - actualMinutes defined but actualHours is undefined
 * - Both defined but don't match (e.g., 2.97h but 88 minutes)
 *
 * ROOT CAUSE:
 * Before Cloud Functions were implemented, tasks were updated directly
 * from the client, leading to race conditions and inconsistent updates.
 *
 * SOLUTION:
 * Make actualMinutes the source of truth and recalculate actualHours.
 * actualHours = actualMinutes / 60
 *
 * AFFECTED TASKS:
 * Based on testing, approximately 7 tasks have inconsistent data.
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
   * Run the migration - Fix actualHours based on actualMinutes
   * @returns {Object} Migration statistics
   */
  up: async () => {
    const db = admin.firestore();
    const stats = {
      total: 0,
      fixed: 0,
      skipped: 0,
      errors: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('🔄 MIGRATION 001: Fix actualHours/actualMinutes');
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
        const actualMinutes = task.actualMinutes || 0;
        const currentActualHours = task.actualHours || 0;
        const correctActualHours = actualMinutes / 60;

        // Check if needs fixing (tolerance: 1 minute = 0.0167 hours)
        const hoursDiff = Math.abs(currentActualHours * 60 - actualMinutes);

        if (hoursDiff > 1) {
          // Needs fixing
          batch.update(doc.ref, {
            actualHours: correctActualHours,
            // Audit trail
            _migrated: true,
            _migrationVersion: 1,
            _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            _migrationName: '001_fix_task_hours_minutes',
            // Store old value for potential rollback investigation
            _oldActualHours: currentActualHours
          });

          stats.fixed++;
          batchCount++;

          console.log(`  ✅ Queued fix for task ${taskId}:`);
          console.log(`     Old: actualHours=${currentActualHours}, actualMinutes=${actualMinutes}`);
          console.log(`     New: actualHours=${correctActualHours}, actualMinutes=${actualMinutes}`);
          console.log(`     Diff: ${hoursDiff.toFixed(2)} minutes\n`);

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
          // Already correct
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
      console.log(`Fixed:           ${stats.fixed} ✅`);
      console.log(`Skipped:         ${stats.skipped} (already correct)`);
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

      return stats;

    } catch (error) {
      console.error('\n❌ MIGRATION FAILED:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  },

  /**
   * Rollback the migration - Remove migration markers
   * Note: We DON'T restore old incorrect values, just remove audit markers
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
    console.log('⏮️  ROLLBACK MIGRATION 001');
    console.log('='.repeat(70));
    console.log('Started:', new Date().toISOString());
    console.log('='.repeat(70) + '\n');

    try {
      // Find all migrated tasks
      console.log('📥 Fetching migrated tasks...');
      const snapshot = await db.collection('budget_tasks')
        .where('_migrationVersion', '==', 1)
        .get();

      stats.total = snapshot.size;
      console.log(`   Found ${stats.total} migrated tasks\n`);

      if (stats.total === 0) {
        console.log('✅ No tasks to rollback');
        return stats;
      }

      // Remove migration markers in batches
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
          _migrated: admin.firestore.FieldValue.delete(),
          _migrationVersion: admin.firestore.FieldValue.delete(),
          _migratedAt: admin.firestore.FieldValue.delete(),
          _migrationName: admin.firestore.FieldValue.delete(),
          _oldActualHours: admin.firestore.FieldValue.delete()
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

      console.log('⚠️  NOTE: Migration markers removed, but actualHours values');
      console.log('   remain as they are now correct. Old incorrect values');
      console.log('   are not restored.');

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
      wouldFix: 0,
      wouldSkip: 0,
      issues: [],
      startTime: Date.now()
    };

    console.log('\n' + '='.repeat(70));
    console.log('🧪 DRY RUN: Migration 001');
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
        const actualMinutes = task.actualMinutes || 0;
        const currentActualHours = task.actualHours || 0;
        const correctActualHours = actualMinutes / 60;
        const hoursDiff = Math.abs(currentActualHours * 60 - actualMinutes);

        if (hoursDiff > 1) {
          stats.wouldFix++;
          const issue = {
            taskId,
            clientName: task.clientName || 'Unknown',
            currentActualHours,
            actualMinutes,
            correctActualHours,
            diffMinutes: hoursDiff.toFixed(2)
          };
          stats.issues.push(issue);

          console.log(`  ❌ WOULD FIX: Task ${taskId}`);
          console.log(`     Client: ${issue.clientName}`);
          console.log(`     Current: actualHours=${currentActualHours}, actualMinutes=${actualMinutes}`);
          console.log(`     Would change to: actualHours=${correctActualHours}`);
          console.log(`     Difference: ${hoursDiff.toFixed(2)} minutes\n`);
        } else {
          stats.wouldSkip++;
        }
      }

      const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

      console.log('\n' + '='.repeat(70));
      console.log('📊 DRY RUN SUMMARY');
      console.log('='.repeat(70));
      console.log(`Total tasks:         ${stats.total}`);
      console.log(`Would fix:           ${stats.wouldFix} ❌`);
      console.log(`Would skip:          ${stats.wouldSkip} ✅`);
      console.log(`Duration:            ${duration}s`);
      console.log('='.repeat(70) + '\n');

      if (stats.wouldFix > 0) {
        console.log('⚠️  NEXT STEPS:');
        console.log('   1. Review the issues listed above');
        console.log('   2. If everything looks correct, run with mode "up"');
        console.log('   3. Command: node migrations/runner.js 001_fix_task_hours_minutes up');
      } else {
        console.log('✅ All tasks are already correct - no migration needed!');
      }

      console.log('');

      return stats;

    } catch (error) {
      console.error('\n❌ DRY RUN FAILED:', error);
      throw error;
    }
  }
};
