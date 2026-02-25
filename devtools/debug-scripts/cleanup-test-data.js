/**
 * Cleanup Test Data - Production
 *
 * Deletes all test tasks and clients created during smoke tests
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupTestData() {
  console.log('🧹 Cleanup Test Data - PRODUCTION\n' + '='.repeat(50));

  try {
    // Test task IDs from PROD smoke test
    const testTaskIds = [
      'Bs8Btnc45wQ8iTHN4DaW',  // PROD test: בדיקת מהו"ת
      'duHsgw1GT3SdTlhA2lP6',  // DEV test: בדיקה מהו"ת
      'DuVroVx5sC8srLp1Vf3o',  // DEV test: דיון בביהמ"ש בנוגע למו"מ
      'cwWGATBPTLqyp0edWAn7',  // DEV test: XSS test
      'ZtQIiqLMByVnfNf3gZLZ',  // Admin SDK test: מהו"ת
      'TuZters3Jfvpox1GqQav',  // Admin SDK test: ביהמ"ש + מו"מ
      'H3l7Xad97PY0zLEt0zXG'   // Admin SDK test: XSS
    ];

    // Test client IDs
    const testClientIds = [
      '0GjPTSpXRReiJfnKv8J6'   // Regression test client
    ];

    console.log('📝 Deleting test tasks...\n');

    let deletedTasks = 0;
    let notFoundTasks = 0;

    for (const taskId of testTaskIds) {
      try {
        const taskRef = db.collection('budget_tasks').doc(taskId);
        const taskDoc = await taskRef.get();

        if (taskDoc.exists) {
          const taskData = taskDoc.data();
          console.log(`  Deleting task: ${taskId}`);
          console.log(`    Description: ${taskData.description || 'N/A'}`);
          await taskRef.delete();
          console.log('    ✅ Deleted\n');
          deletedTasks++;
        } else {
          console.log(`  ⚠️  Task ${taskId} not found (may have been deleted already)\n`);
          notFoundTasks++;
        }
      } catch (error) {
        console.log(`  ❌ Error deleting task ${taskId}: ${error.message}\n`);
      }
    }

    console.log('📝 Deleting test clients...\n');

    let deletedClients = 0;
    let notFoundClients = 0;

    for (const clientId of testClientIds) {
      try {
        const clientRef = db.collection('clients').doc(clientId);
        const clientDoc = await clientRef.get();

        if (clientDoc.exists) {
          const clientData = clientDoc.data();
          console.log(`  Deleting client: ${clientId}`);
          console.log(`    Name: ${clientData.clientName || 'N/A'}`);
          await clientRef.delete();
          console.log('    ✅ Deleted\n');
          deletedClients++;
        } else {
          console.log(`  ⚠️  Client ${clientId} not found (may have been deleted already)\n`);
          notFoundClients++;
        }
      } catch (error) {
        console.log(`  ❌ Error deleting client ${clientId}: ${error.message}\n`);
      }
    }

    console.log('='.repeat(50));
    console.log('📊 CLEANUP SUMMARY\n');
    console.log('Tasks:');
    console.log(`  ✅ Deleted: ${deletedTasks}`);
    console.log(`  ⚠️  Not found: ${notFoundTasks}`);
    console.log(`  Total: ${testTaskIds.length}\n`);

    console.log('Clients:');
    console.log(`  ✅ Deleted: ${deletedClients}`);
    console.log(`  ⚠️  Not found: ${notFoundClients}`);
    console.log(`  Total: ${testClientIds.length}\n`);

    console.log('='.repeat(50));
    console.log('✅ Cleanup completed!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

cleanupTestData();
