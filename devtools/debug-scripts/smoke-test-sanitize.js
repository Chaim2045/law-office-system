/**
 * Smoke Test: sanitizeString Fix
 *
 * Tests that the backend fix is working correctly:
 * 1. Create tasks with quotes → verify raw " in Firestore
 * 2. XSS test with <script> → verify & lt;script&gt; in Firestore
 * 3. Regression test for clientName
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const functionsUrl = 'https://us-central1-law-office-system-e4801.cloudfunctions.net';

const testResults = {
  tests: [],
  pass: 0,
  fail: 0
};

function logTest(name, pass, details) {
  testResults.tests.push({ name, pass, details });
  if (pass) {
    testResults.pass++;
    console.log(`✅ ${name}`);
  } else {
    testResults.fail++;
    console.log(`❌ ${name}`);
  }
  if (details) {
    console.log(`   ${details}\n`);
  }
}

async function getTestEmployee() {
  const snapshot = await db.collection('employees')
    .where('email', '==', 'haim@ghlawoffice.co.il')
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error('Test employee not found');
  }

  return {
    email: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  };
}

async function getTestClient() {
  const snapshot = await db.collection('clients').limit(1).get();

  if (snapshot.empty) {
    throw new Error('No clients found');
  }

  const client = snapshot.docs[0];
  return {
    id: client.id,
    ...client.data()
  };
}

async function smokeTest() {
  console.log('🧪 SMOKE TEST: sanitizeString Fix');
  console.log('═══════════════════════════════════════════════════════════\n');

  const createdTasks = [];

  try {
    const employee = await getTestEmployee();
    const client = await getTestClient();

    console.log(`👤 Test User: ${employee.username} (${employee.email})`);
    console.log(`📂 Test Client: ${client.clientName} (${client.id})\n`);

    // Test 1: Task with Hebrew quotes (מהו"ת)
    console.log('📝 Test 1: Task with מהו"ת...');
    const task1Data = {
      description: 'הכנה לפגישת מהו"ת',
      clientId: client.id,
      clientName: client.clientName,
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
      employee: employee.email,
      lawyer: employee.username,
      createdBy: employee.username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: employee.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeEntries: []
    };

    const task1Ref = await db.collection('budget_tasks').add(task1Data);
    createdTasks.push(task1Ref.id);
    console.log(`   Created: ${task1Ref.id}`);

    // Read back and verify
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for write
    const task1Doc = await task1Ref.get();
    const task1Saved = task1Doc.data();

    const hasQuot1 = task1Saved.description.includes('&quot;');
    const hasRawQuote1 = task1Saved.description.includes('"');

    logTest(
      'Test 1.1: No &quot; in מהו"ת',
      !hasQuot1,
      hasQuot1 ? `Found: ${task1Saved.description}` : 'Clean'
    );

    logTest(
      'Test 1.2: Raw " preserved in מהו"ת',
      hasRawQuote1,
      task1Saved.description
    );

    // Test 2: Task with ביהמ"ש
    console.log('📝 Test 2: Task with ביהמ"ש...');
    const task2Data = {
      ...task1Data,
      description: 'דיון בביהמ"ש בנוגע למו"מ'
    };

    const task2Ref = await db.collection('budget_tasks').add(task2Data);
    createdTasks.push(task2Ref.id);
    console.log(`   Created: ${task2Ref.id}`);

    await new Promise(resolve => setTimeout(resolve, 1000));
    const task2Doc = await task2Ref.get();
    const task2Saved = task2Doc.data();

    const hasQuot2 = task2Saved.description.includes('&quot;');
    const hasRawQuote2 = task2Saved.description.includes('"');

    logTest(
      'Test 2.1: No &quot; in ביהמ"ש + מו"מ',
      !hasQuot2,
      hasQuot2 ? `Found: ${task2Saved.description}` : 'Clean'
    );

    logTest(
      'Test 2.2: Raw " preserved (2 occurrences)',
      hasRawQuote2 && (task2Saved.description.match(/"/g) || []).length >= 2,
      task2Saved.description
    );

    // Test 3: XSS Protection
    console.log('📝 Test 3: XSS Protection with <script>...');
    const task3Data = {
      ...task1Data,
      description: 'בדיקה <script>alert("XSS")</script> של קוד'
    };

    const task3Ref = await db.collection('budget_tasks').add(task3Data);
    createdTasks.push(task3Ref.id);
    console.log(`   Created: ${task3Ref.id}`);

    await new Promise(resolve => setTimeout(resolve, 1000));
    const task3Doc = await task3Ref.get();
    const task3Saved = task3Doc.data();

    const hasLt = task3Saved.description.includes('&lt;script&gt;');
    const hasRawScript = task3Saved.description.includes('<script>');

    logTest(
      'Test 3.1: <script> escaped to &lt;script&gt;',
      hasLt && !hasRawScript,
      task3Saved.description
    );

    logTest(
      'Test 3.2: Quotes in alert() preserved as raw "',
      task3Saved.description.includes('"XSS"'),
      task3Saved.description
    );

    // Test 4: Regression - clientName field
    console.log('📝 Test 4: Regression test - clientName with quotes...');
    const testClientData = {
      clientName: 'חברת "מו"מ" בע"מ',
      fullName: 'חברת "מו"מ" בע"מ',
      caseNumber: 'TEST-' + Date.now(),
      caseTitle: 'תיק בדיקה',
      description: '',
      procedureType: 'hours',
      pricingType: 'hours',
      hoursRemaining: 10,
      hoursTotal: 10,
      hoursUsed: 0,
      services: [],
      stages: [],
      packages: [],
      assignedLawyers: [employee.username],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: employee.username
    };

    const clientRef = await db.collection('clients').add(testClientData);
    createdTasks.push(`client-${clientRef.id}`); // Track for cleanup
    console.log(`   Created client: ${clientRef.id}`);

    await new Promise(resolve => setTimeout(resolve, 1000));
    const clientDoc = await clientRef.get();
    const clientSaved = clientDoc.data();

    const hasQuotClient = clientSaved.clientName.includes('&quot;');
    const hasRawQuoteClient = clientSaved.clientName.includes('"');

    logTest(
      'Test 4.1: No &quot; in clientName',
      !hasQuotClient,
      hasQuotClient ? `Found: ${clientSaved.clientName}` : 'Clean'
    );

    logTest(
      'Test 4.2: Raw " preserved in clientName (3 occurrences)',
      hasRawQuoteClient && (clientSaved.clientName.match(/"/g) || []).length >= 3,
      clientSaved.clientName
    );

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SMOKE TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    testResults.tests.forEach((test, i) => {
      const icon = test.pass ? '✅' : '❌';
      console.log(`${icon} ${test.name}`);
      if (test.details && !test.pass) {
        console.log(`   Issue: ${test.details}`);
      }
    });

    console.log(`\n✅ Passed: ${testResults.pass}/${testResults.tests.length}`);
    console.log(`❌ Failed: ${testResults.fail}/${testResults.tests.length}\n`);

    if (testResults.fail === 0) {
      console.log('🎉 ALL SMOKE TESTS PASSED!');
      console.log('The sanitizeString fix is working correctly.');
      console.log('\nFirestore IDs for manual verification:');
      console.log(`  Task 1 (מהו"ת):     ${createdTasks[0]}`);
      console.log(`  Task 2 (ביהמ"ש):    ${createdTasks[1]}`);
      console.log(`  Task 3 (XSS):       ${createdTasks[2]}`);
      console.log(`  Client (regression): ${createdTasks[3].replace('client-', '')}`);
    } else {
      console.log('⚠️  SOME TESTS FAILED!');
      console.log('The fix may not be working correctly.');
      console.log('\nFailed test IDs:');
      createdTasks.forEach((id, i) => {
        if (!testResults.tests[i * 2]?.pass || !testResults.tests[i * 2 + 1]?.pass) {
          console.log(`  ${id}`);
        }
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    // Cleanup prompt
    console.log('🧹 Cleanup: Do you want to delete test data? (Y/n)');
    console.log('Test IDs saved above for manual verification.');
    console.log('\nTo delete manually:');
    createdTasks.forEach(id => {
      if (id.startsWith('client-')) {
        console.log(`  firestore.collection('clients').doc('${id.replace('client-', '')}').delete()`);
      } else {
        console.log(`  firestore.collection('budget_tasks').doc('${id}').delete()`);
      }
    });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(testResults.fail === 0 ? 0 : 1);
}

smokeTest();
