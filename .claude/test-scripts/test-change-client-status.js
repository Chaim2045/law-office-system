/**
 * Test Script: changeClientStatus Cloud Function
 * סקריפט בדיקה חד-פעמי — DEV בלבד
 *
 * Usage: node .claude/test-scripts/test-change-client-status.js
 *
 * Steps:
 * 1. SETUP: Creates test client TEST_STATUS_001 (active, not blocked, not critical)
 * 2. Auth: Gets ID token for an active employee
 * 3. TEST A: active → inactive (success)
 * 4. TEST B: inactive → inactive — same status (FAILED_PRECONDITION)
 * 5. TEST C: inactive → active + blocked (success)
 * 6. TEST D: inactive + blocked — invalid combo (INVALID_ARGUMENT)
 * 7. TEST E: blocked + critical together — invalid combo (INVALID_ARGUMENT)
 * 8. REVERT: back to active (no flags)
 * 9. CLEANUP: delete test client + audit entries
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
const CF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/changeClientStatus`;
const TEST_CLIENT_ID = 'TEST_STATUS_001';

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
    path.join(__dirname, '../../apps/admin-panel/index.html')
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
  console.log('🧪 Test: changeClientStatus Cloud Function');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // ──────────────────────────────────────────────────────────────
    // Step 1: SETUP — Create test client
    // ──────────────────────────────────────────────────────────────
    console.log('🔧 Step 1: SETUP — Creating test client...\n');

    const now = new Date().toISOString();

    const testClientData = {
      fullName: 'לקוח בדיקה - סטטוס',
      clientName: 'לקוח בדיקה - סטטוס',
      type: 'hours',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      services: [],
      totalServices: 0,
      activeServices: 0,
      totalHours: 0,
      hoursUsed: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('clients').doc(TEST_CLIENT_ID).set(testClientData);
    console.log(`   ✅ Created test client: ${TEST_CLIENT_ID}`);
    console.log(`   Status: ${testClientData.status}, isBlocked: ${testClientData.isBlocked}, isCritical: ${testClientData.isCritical}`);
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
    // Step 3: TEST A — active → inactive
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST A: active → inactive');
    console.log('   Expected: success, previousStatus: active, newStatus: inactive');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseA = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      newStatus: 'inactive'
    }, idToken);

    console.log(`📦 Response (HTTP ${responseA.statusCode}):`);
    console.log(JSON.stringify(responseA.body, null, 2));

    if (responseA.statusCode === 200 && responseA.body?.result?.success) {
      const result = responseA.body.result;
      const prevOk = result.previousStatus === 'active';
      const newOk = result.newStatus === 'inactive';

      console.log(`\n   previousStatus: ${result.previousStatus} (expected active): ${prevOk ? '✅' : '❌'}`);
      console.log(`   newStatus: ${result.newStatus} (expected inactive): ${newOk ? '✅' : '❌'}`);

      // Read client doc and verify
      const afterA = await db.collection('clients').doc(TEST_CLIENT_ID).get();
      const dataA = afterA.data();

      console.log('\n   📖 Client doc after change:');
      console.log(`   status: ${dataA.status} (expected inactive): ${dataA.status === 'inactive' ? '✅' : '❌'}`);
      console.log(`   isBlocked: ${dataA.isBlocked} (expected false): ${dataA.isBlocked === false ? '✅' : '❌'}`);
      console.log(`   isCritical: ${dataA.isCritical} (expected false): ${dataA.isCritical === false ? '✅' : '❌'}`);

      // Check audit_log
      console.log('\n   📝 Checking audit_log for CHANGE_CLIENT_STATUS...');
      await new Promise(r => setTimeout(r, 1000));

      try {
        const auditA = await db.collection('audit_log')
          .where('action', '==', 'CHANGE_CLIENT_STATUS')
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
        }
      } catch (e) {
        console.log(`   ⚠️ Audit query failed (composite index needed): ${e.message.substring(0, 100)}`);
      }

      if (prevOk && newOk && dataA.status === 'inactive') {
        console.log('\n✅ TEST A PASSED\n');
        testsPassed++;
      } else {
        console.log('\n❌ TEST A FAILED — unexpected values\n');
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST A FAILED — Expected success\n');
      console.log(`   Error: ${responseA.body?.error?.message || 'unknown'}`);
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 4: TEST B — same status (inactive → inactive)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST B: inactive → inactive (same status)');
    console.log('   Expected: FAILED_PRECONDITION');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseB = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      newStatus: 'inactive'
    }, idToken);

    console.log(`📦 Response (HTTP ${responseB.statusCode}):`);
    console.log(JSON.stringify(responseB.body, null, 2));

    if (responseB.statusCode !== 200) {
      const errorStatus = responseB.body?.error?.status || '';
      const errorMsg = responseB.body?.error?.message || '';
      const isFP = errorStatus === 'FAILED_PRECONDITION' ||
                   errorMsg.includes('כבר') ||
                   errorMsg.includes('same');

      if (isFP) {
        console.log('\n✅ TEST B PASSED — Correctly rejected (same status)\n');
        testsPassed++;
      } else {
        console.log(`\n❌ TEST B FAILED — Rejected but wrong error: ${errorStatus} / ${errorMsg}\n`);
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST B FAILED — Should have been rejected!\n');
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 5: TEST C — inactive → active + blocked
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST C: inactive → active + blocked');
    console.log('   Expected: success, isBlocked: true');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseC = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      newStatus: 'active',
      isBlocked: true
    }, idToken);

    console.log(`📦 Response (HTTP ${responseC.statusCode}):`);
    console.log(JSON.stringify(responseC.body, null, 2));

    if (responseC.statusCode === 200 && responseC.body?.result?.success) {
      const result = responseC.body.result;

      // Read client doc and verify
      const afterC = await db.collection('clients').doc(TEST_CLIENT_ID).get();
      const dataC = afterC.data();

      console.log('\n   📖 Client doc after change:');
      console.log(`   status: ${dataC.status} (expected active): ${dataC.status === 'active' ? '✅' : '❌'}`);
      console.log(`   isBlocked: ${dataC.isBlocked} (expected true): ${dataC.isBlocked === true ? '✅' : '❌'}`);
      console.log(`   isCritical: ${dataC.isCritical} (expected false): ${dataC.isCritical === false ? '✅' : '❌'}`);

      if (dataC.status === 'active' && dataC.isBlocked === true && dataC.isCritical === false) {
        console.log('\n✅ TEST C PASSED\n');
        testsPassed++;
      } else {
        console.log('\n❌ TEST C FAILED — unexpected values\n');
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST C FAILED — Expected success\n');
      console.log(`   Error: ${responseC.body?.error?.message || 'unknown'}`);
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 6: TEST D — inactive + blocked (invalid combo)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST D: inactive + blocked (invalid combo)');
    console.log('   Expected: INVALID_ARGUMENT');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseD = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      newStatus: 'inactive',
      isBlocked: true
    }, idToken);

    console.log(`📦 Response (HTTP ${responseD.statusCode}):`);
    console.log(JSON.stringify(responseD.body, null, 2));

    if (responseD.statusCode !== 200) {
      const errorStatus = responseD.body?.error?.status || '';
      const errorMsg = responseD.body?.error?.message || '';
      const isIA = errorStatus === 'INVALID_ARGUMENT' ||
                   errorMsg.includes('לא ניתן') ||
                   errorMsg.includes('invalid');

      if (isIA) {
        console.log('\n✅ TEST D PASSED — Correctly rejected (inactive + blocked)\n');
        testsPassed++;
      } else {
        console.log(`\n❌ TEST D FAILED — Rejected but wrong error: ${errorStatus} / ${errorMsg}\n`);
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST D FAILED — Should have been rejected!\n');
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 7: TEST E — blocked + critical together (invalid combo)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST E: blocked + critical together (invalid combo)');
    console.log('   Expected: INVALID_ARGUMENT');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseE = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      newStatus: 'active',
      isBlocked: true,
      isCritical: true
    }, idToken);

    console.log(`📦 Response (HTTP ${responseE.statusCode}):`);
    console.log(JSON.stringify(responseE.body, null, 2));

    if (responseE.statusCode !== 200) {
      const errorStatus = responseE.body?.error?.status || '';
      const errorMsg = responseE.body?.error?.message || '';
      const isIA = errorStatus === 'INVALID_ARGUMENT' ||
                   errorMsg.includes('לא ניתן') ||
                   errorMsg.includes('invalid');

      if (isIA) {
        console.log('\n✅ TEST E PASSED — Correctly rejected (blocked + critical)\n');
        testsPassed++;
      } else {
        console.log(`\n❌ TEST E FAILED — Rejected but wrong error: ${errorStatus} / ${errorMsg}\n`);
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST E FAILED — Should have been rejected!\n');
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 8: REVERT — back to active (no flags)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🔄 Step 8: REVERT — back to active (no flags)');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseRevert = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      newStatus: 'active',
      isBlocked: false,
      isCritical: false
    }, idToken);

    console.log(`📦 Response (HTTP ${responseRevert.statusCode}):`);
    console.log(JSON.stringify(responseRevert.body, null, 2));

    if (responseRevert.statusCode === 200 && responseRevert.body?.result?.success) {
      const afterRevert = await db.collection('clients').doc(TEST_CLIENT_ID).get();
      const dataRevert = afterRevert.data();

      console.log('\n   📖 Client doc after revert:');
      console.log(`   status: ${dataRevert.status} (expected active): ${dataRevert.status === 'active' ? '✅' : '❌'}`);
      console.log(`   isBlocked: ${dataRevert.isBlocked} (expected false): ${dataRevert.isBlocked === false ? '✅' : '❌'}`);
      console.log(`   isCritical: ${dataRevert.isCritical} (expected false): ${dataRevert.isCritical === false ? '✅' : '❌'}`);
      console.log('\n   ✅ Revert successful\n');
    } else {
      console.log('\n   ❌ Revert failed!\n');
      console.log(`   Error: ${responseRevert.body?.error?.message || 'unknown'}`);
    }

  } finally {
    // ──────────────────────────────────────────────────────────────
    // Step 9: CLEANUP
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧹 Step 9: CLEANUP');
    console.log('════════════════════════════════════════════════════════════════\n');

    try {
      await db.collection('clients').doc(TEST_CLIENT_ID).delete();
      console.log(`   ✅ Deleted test client: ${TEST_CLIENT_ID}`);
    } catch (e) {
      console.log(`   ⚠️ Failed to delete test client: ${e.message}`);
    }

    try {
      const auditCleanup = await db.collection('audit_log')
        .where('action', '==', 'CHANGE_CLIENT_STATUS')
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
  console.log(`📊 Results: ${testsPassed} passed, ${testsFailed} failed (out of 5 tests)`);
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
