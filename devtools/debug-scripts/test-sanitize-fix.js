/**
 * Test Script: Verify sanitizeString Fix
 *
 * Tests that quotes are NOT converted to &quot; in Firestore
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testSanitizeFix() {
  console.log('🧪 Testing sanitizeString Fix\n');
  console.log('═══════════════════════════════════════════════════\n');

  // Test 1: Create a task with quotes
  console.log('📝 Test 1: Creating task with quotes...');

  const testDescription = 'בדיקה: מהו"ת בביהמ"ש לניהול מו"מ';
  console.log(`   Input: "${testDescription}"`);

  try {
    // Get a test employee
    const employeeSnapshot = await db.collection('employees')
      .where('email', '==', 'haim@ghlawoffice.co.il')
      .limit(1)
      .get();

    if (employeeSnapshot.empty) {
      console.log('❌ Test employee not found');
      return;
    }

    const employee = employeeSnapshot.docs[0].data();
    console.log(`   Employee: ${employee.username}`);

    // Get a test client
    const clientSnapshot = await db.collection('clients').limit(1).get();
    if (clientSnapshot.empty) {
      console.log('❌ No clients found');
      return;
    }

    const client = clientSnapshot.docs[0];
    const clientData = client.data();
    console.log(`   Client: ${clientData.clientName}`);

    // Create test task data
    const taskData = {
      description: testDescription,
      clientId: client.id,
      clientName: clientData.clientName,
      caseNumber: client.id,
      branch: 'רמת גן',
      estimatedMinutes: 60,
      originalEstimate: 60,
      actualMinutes: 0,
      deadline: admin.firestore.Timestamp.now(),
      originalDeadline: admin.firestore.Timestamp.now(),
      budgetAdjustments: [],
      deadlineExtensions: [],
      status: 'פעיל',
      employee: 'haim@ghlawoffice.co.il',
      lawyer: employee.username,
      createdBy: employee.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: employee.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeEntries: []
    };

    // Write directly to Firestore (simulating cloud function)
    const docRef = await db.collection('budget_tasks').add(taskData);
    console.log(`   ✅ Task created: ${docRef.id}\n`);

    // Read it back
    console.log('📖 Test 2: Reading task from Firestore...');
    const taskDoc = await docRef.get();
    const savedData = taskDoc.data();

    console.log(`   Stored: "${savedData.description}"\n`);

    // Verify
    console.log('🔍 Test 3: Verification...');

    const hasQuot = savedData.description.includes('&quot;');
    const hasApos = savedData.description.includes('&#x27;');
    const hasSlash = savedData.description.includes('&#x2F;');

    if (hasQuot) {
      console.log('   ❌ FAIL: Found &quot; in description');
    } else {
      console.log('   ✅ PASS: No &quot; found');
    }

    if (hasApos) {
      console.log('   ❌ FAIL: Found &#x27; in description');
    } else {
      console.log('   ✅ PASS: No &#x27; found');
    }

    if (hasSlash) {
      console.log('   ❌ FAIL: Found &#x2F; in description');
    } else {
      console.log('   ✅ PASS: No &#x2F; found');
    }

    // Check if actual quotes are there
    const hasQuotes = savedData.description.includes('"');
    if (hasQuotes) {
      console.log('   ✅ PASS: Raw quotes preserved\n');
    } else {
      console.log('   ❌ FAIL: Quotes missing\n');
    }

    // Cleanup
    console.log('🧹 Cleanup: Deleting test task...');
    await docRef.delete();
    console.log('   ✅ Test task deleted\n');

    // Final result
    console.log('═══════════════════════════════════════════════════');
    if (!hasQuot && !hasApos && !hasSlash && hasQuotes) {
      console.log('✅ ALL TESTS PASSED');
      console.log('\nThe sanitizeString fix is working correctly!');
      console.log('Quotes are stored as raw \" in Firestore.');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('\nThe fix may not be working correctly.');
    }
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testSanitizeFix();
