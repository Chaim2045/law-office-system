/**
 * Test Script: closeCase Cloud Function
 * סקריפט בדיקה חד-פעמי — DEV בלבד
 *
 * Usage: node .claude/test-scripts/test-close-case.js
 *
 * Steps:
 * 1. SETUP: Creates test client TEST_CLOSE_001 + budget_task
 * 2. Auth: Gets ID token for an active employee
 * 3. TEST A: closeCase — success (services completed, aggregates, budget_tasks warning)
 * 4. TEST B: closeCase again — FAILED_PRECONDITION (already closed)
 * 5. CLEANUP: delete test client + budget_task + audit entries
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ════════════════════════════════════════════════════════════════
// Config
// ════════════════════════════════════════════════════════════════
const PROJECT_ID = 'law-office-system-e4801';
const REGION = 'us-central1';
const CF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/closeCase`;
const TEST_CLIENT_ID = 'TEST_CLOSE_001';

// ════════════════════════════════════════════════════════════════
// Firebase Admin Init
// ════════════════════════════════════════════════════════════════
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../../firebase-admin-key.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ firebase-admin-key.json not found!');
    process.exit(1);
  }

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
  });
}

const db = admin.firestore();

// Track created budget_task ID for cleanup
let createdTaskId = null;

// ════════════════════════════════════════════════════════════════
// Helpers (same pattern as other test scripts)
// ════════════════════════════════════════════════════════════════

async function callCF(url, data, idToken) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ data });
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getIdTokenForUser(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const apiKey = await getWebApiKey();

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      token: customToken,
      returnSecureToken: true
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.idToken) {
            resolve(parsed.idToken);
          } else {
            reject(new Error(`Failed to get ID token: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getWebApiKey() {
  const possiblePaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../functions/.env')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/FIREBASE_API_KEY=(.+)/);
      if (match) {
return match[1].trim();
}
    }
  }

  const htmlPaths = [
    path.join(__dirname, '../../index.html'),
    path.join(__dirname, '../../master-admin-panel/index.html')
  ];

  for (const p of htmlPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/apiKey:\s*["']([^"']+)["']/);
      if (match) {
return match[1].trim();
}
    }
  }

  throw new Error('❌ Cannot find Firebase Web API Key');
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  let testsPassed = 0;
  let testsFailed = 0;

  console.log('════════════════════════════════════════════════════════════════');
  console.log('🧪 Test: closeCase Cloud Function');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // ──────────────────────────────────────────────────────────────
    // Step 1: SETUP — Create test client + budget_task
    // ──────────────────────────────────────────────────────────────
    console.log('🔧 Step 1: SETUP — Creating test client + budget_task...\n');

    const now = new Date().toISOString();

    const testClientData = {
      fullName: 'לקוח בדיקה - סגירת תיק',
      clientName: 'לקוח בדיקה - סגירת תיק',
      type: 'hours',
      status: 'active',
      isArchived: false,
      isBlocked: true,
      isCritical: false,
      services: [
        {
          id: 'svc-active-1',
          serviceName: 'שירות פעיל',
          type: 'hours',
          status: 'active',
          totalHours: 10,
          hoursUsed: 3,
          hoursRemaining: 7
        },
        {
          id: 'svc-completed-1',
          serviceName: 'שירות ישן',
          type: 'hours',
          status: 'completed',
          completedAt: '2025-01-01',
          totalHours: 5,
          hoursUsed: 5,
          hoursRemaining: 0
        }
      ],
      totalServices: 2,
      activeServices: 1,
      totalHours: 15,
      hoursUsed: 8,
      hoursRemaining: 7,
      minutesRemaining: 420,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('clients').doc(TEST_CLIENT_ID).set(testClientData);
    console.log(`   ✅ Created test client: ${TEST_CLIENT_ID}`);
    console.log(`   Status: ${testClientData.status}, isBlocked: ${testClientData.isBlocked}, isArchived: ${testClientData.isArchived}`);
    console.log('   Services: 1 active (svc-active-1), 1 completed (svc-completed-1)');

    // Create a budget_task linked to this client
    const taskRef = await db.collection('budget_tasks').add({
      clientId: TEST_CLIENT_ID,
      clientName: 'לקוח בדיקה - סגירת תיק',
      description: 'משימת בדיקה לסגירת תיק',
      status: 'פעיל',
      employee: 'test@test.com',
      lawyer: 'test',
      estimatedHours: 1,
      estimatedMinutes: 60,
      actualHours: 0,
      actualMinutes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    createdTaskId = taskRef.id;
    console.log(`   ✅ Created budget_task: ${createdTaskId} (status: פעיל)`);
    console.log('   ✅ SETUP complete\n');

    // ──────────────────────────────────────────────────────────────
    // Step 2: Auth
    // ──────────────────────────────────────────────────────────────
    console.log('🔑 Step 2: Getting auth token...');

    const empSnapshot = await db.collection('employees')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (empSnapshot.empty) {
      console.log('❌ No active employee found');
      process.exit(1);
    }

    const employee = empSnapshot.docs[0].data();
    const employeeUid = employee.authUID;
    console.log(`   Using employee: ${employee.username} (UID: ${employeeUid})`);

    const idToken = await getIdTokenForUser(employeeUid);
    console.log(`   ✅ ID token obtained (${idToken.substring(0, 20)}...)\n`);

    // ──────────────────────────────────────────────────────────────
    // Step 3: TEST A — closeCase (success)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST A: closeCase — close active client');
    console.log('   Expected: success, 1 service completed, 1 already completed, 1 active budget_task');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseA = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID
    }, idToken);

    console.log(`📦 Response (HTTP ${responseA.statusCode}):`);
    console.log(JSON.stringify(responseA.body, null, 2));

    if (responseA.statusCode === 200 && responseA.body?.result?.success) {
      const result = responseA.body.result;
      let allOk = true;

      // Check response fields
      const checks = [
        { name: 'servicesCompleted', actual: result.servicesCompleted, expected: 1 },
        { name: 'servicesAlreadyCompleted', actual: result.servicesAlreadyCompleted, expected: 1 },
        { name: 'activeBudgetTasks', actual: result.activeBudgetTasks, expected: 1 },
        { name: 'clientAggregates.activeServices', actual: result.clientAggregates?.activeServices, expected: 0 }
      ];

      console.log('\n   📋 Response checks:');
      for (const check of checks) {
        const ok = check.actual === check.expected;
        console.log(`   ${check.name}: ${check.actual} (expected ${check.expected}): ${ok ? '✅' : '❌'}`);
        if (!ok) {
allOk = false;
}
      }

      // Check message contains budget_tasks warning
      const messageHasWarning = (result.message || '').includes('משימות תקציב');
      console.log(`   message has budget_tasks warning: ${messageHasWarning ? '✅' : '❌'}`);
      if (!messageHasWarning) {
allOk = false;
}

      // Read client doc from Firestore and verify
      const clientDoc = await db.collection('clients').doc(TEST_CLIENT_ID).get();
      const clientData = clientDoc.data();

      console.log('\n   📖 Client doc after closeCase:');

      const docChecks = [
        { name: 'status', actual: clientData.status, expected: 'inactive' },
        { name: 'isArchived', actual: clientData.isArchived, expected: true },
        { name: 'isBlocked', actual: clientData.isBlocked, expected: false },
        { name: 'isCritical', actual: clientData.isCritical, expected: false },
        { name: 'activeServices', actual: clientData.activeServices, expected: 0 }
      ];

      for (const check of docChecks) {
        const ok = check.actual === check.expected;
        console.log(`   ${check.name}: ${check.actual} (expected ${check.expected}): ${ok ? '✅' : '❌'}`);
        if (!ok) {
allOk = false;
}
      }

      // Check all services are completed
      const allServicesCompleted = (clientData.services || []).every(s => s.status === 'completed');
      console.log(`   all services completed: ${allServicesCompleted ? '✅' : '❌'}`);
      if (!allServicesCompleted) {
allOk = false;
}

      // Check svc-active-1 has completedAt
      const svcActive = (clientData.services || []).find(s => s.id === 'svc-active-1');
      const hasCompletedAt = svcActive && svcActive.completedAt;
      console.log(`   svc-active-1 has completedAt: ${hasCompletedAt ? '✅' : '❌'} (${svcActive?.completedAt || 'missing'})`);
      if (!hasCompletedAt) {
allOk = false;
}

      // Check audit_log
      console.log('\n   📝 Checking audit_log for CLOSE_CASE...');
      await new Promise(r => setTimeout(r, 1000));

      try {
        const auditA = await db.collection('audit_log')
          .where('action', '==', 'CLOSE_CASE')
          .where('details.clientId', '==', TEST_CLIENT_ID)
          .limit(3)
          .get();

        if (!auditA.empty) {
          const entry = auditA.docs[0].data();
          console.log(`   ✅ Audit entry found: ${auditA.docs[0].id}`);
          console.log(`   Action: ${entry.action}`);
          console.log(`   User: ${entry.username}`);
          console.log(`   Details: ${JSON.stringify(entry.details, null, 2)}`);
        } else {
          console.log('   ❌ No audit entry found');
          allOk = false;
        }
      } catch (e) {
        console.log(`   ⚠️ Audit query failed (composite index needed): ${e.message.substring(0, 100)}`);
      }

      if (allOk) {
        console.log('\n✅ TEST A PASSED\n');
        testsPassed++;
      } else {
        console.log('\n❌ TEST A FAILED — some checks failed\n');
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST A FAILED — Expected success\n');
      console.log(`   Error: ${responseA.body?.error?.message || 'unknown'}`);
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 4: TEST B — closeCase again (already closed)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST B: closeCase again — already closed');
    console.log('   Expected: FAILED_PRECONDITION');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseB = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID
    }, idToken);

    console.log(`📦 Response (HTTP ${responseB.statusCode}):`);
    console.log(JSON.stringify(responseB.body, null, 2));

    if (responseB.statusCode !== 200) {
      const errorStatus = responseB.body?.error?.status || '';
      const errorMsg = responseB.body?.error?.message || '';
      const isFP = errorStatus === 'FAILED_PRECONDITION' ||
                   errorMsg.includes('כבר סגור') ||
                   errorMsg.includes('already');

      if (isFP) {
        console.log('\n✅ TEST B PASSED — Correctly rejected (already closed)\n');
        testsPassed++;
      } else {
        console.log(`\n❌ TEST B FAILED — Rejected but wrong error: ${errorStatus} / ${errorMsg}\n`);
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST B FAILED — Should have been rejected!\n');
      testsFailed++;
    }

  } finally {
    // ──────────────────────────────────────────────────────────────
    // Step 5: CLEANUP
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧹 Step 5: CLEANUP');
    console.log('════════════════════════════════════════════════════════════════\n');

    // Delete test client
    try {
      await db.collection('clients').doc(TEST_CLIENT_ID).delete();
      console.log(`   ✅ Deleted test client: ${TEST_CLIENT_ID}`);
    } catch (e) {
      console.log(`   ⚠️ Failed to delete test client: ${e.message}`);
    }

    // Delete budget_task
    if (createdTaskId) {
      try {
        await db.collection('budget_tasks').doc(createdTaskId).delete();
        console.log(`   ✅ Deleted budget_task: ${createdTaskId}`);
      } catch (e) {
        console.log(`   ⚠️ Failed to delete budget_task: ${e.message}`);
      }
    }

    // Delete audit entries
    try {
      const auditCleanup = await db.collection('audit_log')
        .where('action', '==', 'CLOSE_CASE')
        .where('details.clientId', '==', TEST_CLIENT_ID)
        .get();

      for (const doc of auditCleanup.docs) {
        await doc.ref.delete();
        console.log(`   ✅ Deleted audit entry: ${doc.id}`);
      }

      if (auditCleanup.empty) {
        console.log('   ℹ️ No audit entries to clean up');
      }
    } catch (e) {
      console.log(`   ⚠️ Failed to clean audit_log: ${e.message}`);
    }

    console.log('\n   ✅ Cleanup completed');
  }

  // ──────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${testsPassed} passed, ${testsFailed} failed (out of 2 tests)`);
  console.log(`⏱️  Completed in ${elapsed}s`);

  if (testsFailed === 0) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log('════════════════════════════════════════════════════════════════');

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
