/**
 * Check Firestore Security Rules
 * This will show us what rules are currently set
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkRulesAndPermissions() {
  console.log('🔐 FIRESTORE SECURITY RULES CHECK\n');
  console.log('═══════════════════════════════════════════════════\n');

  // Get Marva's new UID
  try {
    const marva = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');

    console.log('📧 MARVA AUTH INFO:');
    console.log(`   Email: ${marva.email}`);
    console.log(`   UID: ${marva.uid}`);
    console.log(`   Email Verified: ${marva.emailVerified ? '✅' : '❌'}\n`);

    // Check if Marva has any tasks in Firestore
    console.log('📋 CHECKING TASKS COLLECTION:\n');

    const tasksWithMarvaEmail = await admin.firestore()
      .collection('tasks')
      .where('assignedTo', '==', 'marva@ghlawoffice.co.il')
      .limit(5)
      .get();

    console.log(`Tasks assigned to marva@ghlawoffice.co.il: ${tasksWithMarvaEmail.size}\n`);

    if (tasksWithMarvaEmail.size > 0) {
      console.log('Sample tasks:');
      tasksWithMarvaEmail.forEach(doc => {
        const task = doc.data();
        console.log(`   - ${task.title || 'No title'}`);
        console.log(`     assignedTo: ${task.assignedTo}`);
        console.log(`     completed: ${task.completed ? 'Yes' : 'No'}\n`);
      });
    }

    // Check employees collection
    console.log('👥 CHECKING EMPLOYEES COLLECTION:\n');

    const employeeDoc = await admin.firestore()
      .collection('employees')
      .doc('marva@ghlawoffice.co.il')
      .get();

    if (employeeDoc.exists) {
      const employee = employeeDoc.data();
      console.log('✅ Employee document exists');
      console.log(`   Name: ${employee.name || employee.username}`);
      console.log(`   Email: ${employee.email || employeeDoc.id}`);

      // Check if there's a stored UID
      if (employee.uid) {
        console.log(`   Stored UID: ${employee.uid}`);
        if (employee.uid !== marva.uid) {
          console.log('   ⚠️  MISMATCH: Stored UID differs from Auth UID!');
          console.log(`      Auth UID:   ${marva.uid}`);
          console.log(`      Stored UID: ${employee.uid}`);
        }
      } else {
        console.log('   ⚠️  No UID stored in employee document');
      }
    } else {
      console.log('❌ Employee document does NOT exist');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('🔍 DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('The issue is likely one of these:\n');
    console.log('1. Firestore Security Rules check for UID match');
    console.log('   - Old UID was stored somewhere');
    console.log('   - New UID (after Auth recreation) doesn\'t match\n');

    console.log('2. Security rules might be:');
    console.log('   rule: request.auth.uid == resource.data.assignedToUid');
    console.log('   But tasks have: assignedTo (email), not assignedToUid\n');

    console.log('📌 SOLUTION:');
    console.log('   Need to check Firebase Console → Firestore → Rules');
    console.log('   Or update employee document with new UID');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkRulesAndPermissions().catch(console.error);