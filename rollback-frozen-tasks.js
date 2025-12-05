/**
 * ROLLBACK SCRIPT - Frozen Tasks Feature
 * ═══════════════════════════════════════════════════════════════════
 *
 * Purpose: Complete rollback of the frozen tasks feature
 *
 * What this does:
 * 1. Turns OFF the feature flag
 * 2. Removes frozen status from all tasks
 * 3. Cleans up frozen-related fields
 *
 * Safe to run: Yes - only removes new fields, doesn't touch original data
 *
 * Usage:
 *   node rollback-frozen-tasks.js
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Main rollback function
 */
async function rollbackFrozenTasks() {
  console.log('\n🔄 ═══════════════════════════════════════════════════════════');
  console.log('   ROLLBACK: Frozen Tasks Feature');
  console.log('   ═══════════════════════════════════════════════════════════\n');

  try {
    // ════════════════════════════════════════════════════════════════
    // Step 1: Turn OFF Feature Flag
    // ════════════════════════════════════════════════════════════════

    console.log('📍 Step 1/3: Turning OFF feature flag...');

    const flagRef = db.collection('system_settings').doc('feature_flags');
    const flagDoc = await flagRef.get();

    if (flagDoc.exists) {
      await flagRef.update({
        'flags.FROZEN_TASKS_ON_STAGE_CHANGE': false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastChangedBy: 'rollback-script',
        'history.FROZEN_TASKS_ON_STAGE_CHANGE': admin.firestore.FieldValue.arrayUnion({
          value: false,
          changedBy: 'rollback-script',
          changedAt: new Date().toISOString(),
          reason: 'Rollback via script'
        })
      });
      console.log('   ✅ Feature flag turned OFF');
    } else {
      console.log('   ⏭️  No feature flags found - skipping');
    }

    // ════════════════════════════════════════════════════════════════
    // Step 2: Find All Frozen Tasks
    // ════════════════════════════════════════════════════════════════

    console.log('\n📍 Step 2/3: Finding frozen tasks...');

    const frozenTasksSnapshot = await db.collection('budget_tasks')
      .where('isFrozen', '==', true)
      .get();

    console.log(`   Found ${frozenTasksSnapshot.size} frozen tasks`);

    if (frozenTasksSnapshot.empty) {
      console.log('   ⏭️  No frozen tasks - nothing to clean');
    } else {

      // ════════════════════════════════════════════════════════════════
      // Step 3: Remove Frozen Status
      // ════════════════════════════════════════════════════════════════

      console.log('\n📍 Step 3/3: Cleaning up frozen tasks...');

      // Batch updates (500 max per batch)
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      let totalCleaned = 0;

      frozenTasksSnapshot.forEach(taskDoc => {
        currentBatch.update(taskDoc.ref, {
          isFrozen: admin.firestore.FieldValue.delete(),
          frozenReason: admin.firestore.FieldValue.delete(),
          frozenAt: admin.firestore.FieldValue.delete(),
          originalStage: admin.firestore.FieldValue.delete(),
          caseMovedToStage: admin.firestore.FieldValue.delete(),
          caseMovedToStageName: admin.firestore.FieldValue.delete(),
          unfrozenAt: admin.firestore.FieldValue.delete(),
          unfrozenBy: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;
        totalCleaned++;

        // Firestore batch limit
        if (batchCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = db.batch();
          batchCount = 0;
        }
      });

      // Commit remaining batch
      if (batchCount > 0) {
        batches.push(currentBatch.commit());
      }

      // Execute all batches
      await Promise.all(batches);

      console.log(`   ✅ Cleaned ${totalCleaned} tasks`);
    }

    // ════════════════════════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════════════════════════

    console.log('\n✅ ═══════════════════════════════════════════════════════════');
    console.log('   ROLLBACK COMPLETED SUCCESSFULLY!');
    console.log('   ═══════════════════════════════════════════════════════════');
    console.log('\n   Summary:');
    console.log('   • Feature flag: OFF');
    console.log(`   • Tasks cleaned: ${frozenTasksSnapshot.size}`);
    console.log('\n   🎉 System returned to original state!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ═══════════════════════════════════════════════════════════');
    console.error('   ROLLBACK FAILED!');
    console.error('   ═══════════════════════════════════════════════════════════\n');
    console.error('   Error:', error);
    console.error('\n   ⚠️  System may be in inconsistent state.');
    console.error('   Please check manually or contact support.\n');

    process.exit(1);
  }
}

// Confirm before running
console.log('\n⚠️  WARNING: You are about to rollback the Frozen Tasks feature!');
console.log('\nThis will:');
console.log('  1. Turn OFF the feature flag');
console.log('  2. Remove frozen status from ALL tasks');
console.log('  3. Clean up all frozen-related fields\n');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Type "ROLLBACK" to continue: ', (answer) => {
  readline.close();

  if (answer === 'ROLLBACK') {
    rollbackFrozenTasks();
  } else {
    console.log('\n❌ Rollback cancelled.\n');
    process.exit(0);
  }
});
