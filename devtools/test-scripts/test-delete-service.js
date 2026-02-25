/**
 * Test Script: deleteService Cloud Function
 * סקריפט בדיקה חד-פעמי — DEV בלבד
 *
 * Usage: node .claude/test-scripts/test-delete-service.js
 *
 * Steps:
 * 1. SETUP: Creates test client TEST_DELETE_001 with 2 services + 1 timesheet entry
 * 2. TEST A: Delete service WITH entries — expects FAILED_PRECONDITION (blocked)
 * 3. TEST B: Delete service WITHOUT entries — expects success
 * 4. TEST C: Delete without confirmDelete — expects INVALID_ARGUMENT
 * 5. CLEANUP: Deletes test client, timesheet entry, audit log entries
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
const CF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/deleteService`;
const TEST_CLIENT_ID = 'TEST_DELETE_001';
const SVC_WITH_ENTRIES = 'test-svc-with-entries';
const SVC_NO_ENTRIES = 'test-svc-no-entries';

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
  let timesheetEntryId = null;
  let testsPassed = 0;
  let testsFailed = 0;

  console.log('════════════════════════════════════════════════════════════════');
  console.log('🧪 Test: deleteService Cloud Function');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // ──────────────────────────────────────────────────────────────
    // Step 1: SETUP — Create test client + timesheet entry
    // ──────────────────────────────────────────────────────────────
    console.log('🔧 Step 1: SETUP — Creating test client and data...\n');

    const now = new Date().toISOString();

    const testClientData = {
      fullName: 'TEST_DELETE_CLIENT',
      clientName: 'TEST_DELETE_CLIENT',
      type: 'hours',
      status: 'active',
      services: [
        {
          id: SVC_WITH_ENTRIES,
          name: 'שירות עם entries',
          serviceName: 'שירות עם entries',
          type: 'hours',
          serviceType: 'hours',
          status: 'active',
          totalHours: 10,
          hoursUsed: 2,
          hoursRemaining: 8,
          minutesUsed: 120,
          packages: [
            { id: 'pkg_test_1', hours: 10, addedAt: now }
          ],
          createdAt: now
        },
        {
          id: SVC_NO_ENTRIES,
          name: 'שירות בלי entries',
          serviceName: 'שירות בלי entries',
          type: 'hours',
          serviceType: 'hours',
          status: 'active',
          totalHours: 5,
          hoursUsed: 0,
          hoursRemaining: 5,
          minutesUsed: 0,
          packages: [
            { id: 'pkg_test_2', hours: 5, addedAt: now }
          ],
          createdAt: now
        }
      ],
      totalServices: 2,
      activeServices: 2,
      totalHours: 15,
      hoursUsed: 2,
      hoursRemaining: 13,
      minutesRemaining: 780,
      isBlocked: false,
      isCritical: false,
      createdAt: now,
      updatedAt: now
    };

    // Create test client
    await db.collection('clients').doc(TEST_CLIENT_ID).set(testClientData);
    console.log(`   ✅ Created test client: ${TEST_CLIENT_ID}`);

    // Create timesheet entry linked to SVC_WITH_ENTRIES
    const entryRef = await db.collection('timesheet_entries').add({
      clientId: TEST_CLIENT_ID,
      clientName: 'TEST_DELETE_CLIENT',
      serviceId: SVC_WITH_ENTRIES,
      serviceName: 'שירות עם entries',
      serviceType: 'hours',
      date: admin.firestore.Timestamp.now(),
      minutes: 120,
      hours: 2,
      action: 'בדיקת מחיקת שירות',
      employee: 'test@test.com',
      lawyer: 'test',
      createdBy: 'test',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isInternal: false,
      isQuickLog: false
    });
    timesheetEntryId = entryRef.id;
    console.log(`   ✅ Created timesheet entry: ${timesheetEntryId} (linked to ${SVC_WITH_ENTRIES})`);

    // Verify setup
    const setupDoc = await db.collection('clients').doc(TEST_CLIENT_ID).get();
    console.log(`   ✅ Client has ${setupDoc.data().services.length} services`);
    console.log('   ✅ SETUP complete\n');

    // ──────────────────────────────────────────────────────────────
    // Get auth token
    // ──────────────────────────────────────────────────────────────
    console.log('🔑 Getting auth token...');

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
    // Step 2: TEST A — Delete service WITH entries (expect block)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST A: Delete service WITH timesheet entries');
    console.log('   Expected: FAILED_PRECONDITION (blocked by referential integrity)');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseA = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      serviceId: SVC_WITH_ENTRIES,
      confirmDelete: true
    }, idToken);

    console.log(`📦 Response (HTTP ${responseA.statusCode}):`);
    console.log(JSON.stringify(responseA.body, null, 2));

    if (responseA.statusCode !== 200) {
      const errorMsg = responseA.body?.error?.message || '';
      const errorStatus = responseA.body?.error?.status || '';
      const isFP = errorStatus === 'FAILED_PRECONDITION' ||
                   errorMsg.includes('רישומי שעות') ||
                   errorMsg.includes('ארכיון');

      if (isFP) {
        console.log('\n✅ TEST A PASSED — Correctly blocked (referential integrity)\n');
        testsPassed++;
      } else {
        console.log(`\n❌ TEST A FAILED — Rejected but wrong error: ${errorStatus} / ${errorMsg}\n`);
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST A FAILED — Should have been blocked! Service with entries was deleted!\n');
      testsFailed++;
    }

    // Verify client still has 2 services
    const afterA = await db.collection('clients').doc(TEST_CLIENT_ID).get();
    const servicesAfterA = afterA.data().services || [];
    console.log(`   Client still has ${servicesAfterA.length} services (expected 2): ${servicesAfterA.length === 2 ? '✅' : '❌'}\n`);

    // ──────────────────────────────────────────────────────────────
    // Step 3: TEST B — Delete service WITHOUT entries (expect success)
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST B: Delete service WITHOUT timesheet entries');
    console.log('   Expected: HTTP 200, success: true');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseB = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      serviceId: SVC_NO_ENTRIES,
      confirmDelete: true
    }, idToken);

    console.log(`📦 Response (HTTP ${responseB.statusCode}):`);
    console.log(JSON.stringify(responseB.body, null, 2));

    if (responseB.statusCode === 200 && responseB.body?.result?.success) {
      console.log('\n✅ TEST B PASSED — Service deleted successfully');
      testsPassed++;

      // Verify client now has 1 service
      const afterB = await db.collection('clients').doc(TEST_CLIENT_ID).get();
      const dataAfterB = afterB.data();
      const servicesAfterB = dataAfterB.services || [];

      console.log('\n   📖 Client state after deletion:');
      console.log(`   Services count: ${servicesAfterB.length} (expected 1): ${servicesAfterB.length === 1 ? '✅' : '❌'}`);
      console.log(`   Remaining service: ${servicesAfterB[0]?.id} (expected ${SVC_WITH_ENTRIES}): ${servicesAfterB[0]?.id === SVC_WITH_ENTRIES ? '✅' : '❌'}`);

      // Verify aggregates
      console.log('\n   📊 Client aggregates after deletion:');
      console.log(`   totalServices:   ${dataAfterB.totalServices} (expected 1): ${dataAfterB.totalServices === 1 ? '✅' : '❌'}`);
      console.log(`   activeServices:  ${dataAfterB.activeServices} (expected 1): ${dataAfterB.activeServices === 1 ? '✅' : '❌'}`);
      console.log(`   totalHours:      ${dataAfterB.totalHours} (expected 10): ${dataAfterB.totalHours === 10 ? '✅' : '❌'}`);
      console.log(`   hoursUsed:       ${dataAfterB.hoursUsed} (expected 2): ${dataAfterB.hoursUsed === 2 ? '✅' : '❌'}`);
      console.log(`   hoursRemaining:  ${dataAfterB.hoursRemaining} (expected 8): ${dataAfterB.hoursRemaining === 8 ? '✅' : '❌'}`);

      // Verify deletedService snapshot in response
      const deletedSvc = responseB.body.result.deletedService;
      if (deletedSvc) {
        console.log('\n   📋 Deleted service snapshot in response:');
        console.log(`   id: ${deletedSvc.id} (expected ${SVC_NO_ENTRIES}): ${deletedSvc.id === SVC_NO_ENTRIES ? '✅' : '❌'}`);
        console.log(`   name: ${deletedSvc.name}`);
        console.log(`   totalHours: ${deletedSvc.totalHours}`);
        console.log(`   packages: ${deletedSvc.packages?.length || 0} package(s)`);
      }

      // Verify audit_log
      console.log('\n   📝 Checking audit_log for DELETE_SERVICE...');

      // Small delay to let audit log write complete
      await new Promise(r => setTimeout(r, 1000));

      const auditSnapshot = await db.collection('audit_log')
        .where('action', '==', 'DELETE_SERVICE')
        .where('details.clientId', '==', TEST_CLIENT_ID)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (auditSnapshot.empty) {
        console.log('   ❌ No DELETE_SERVICE audit entry found');
      } else {
        const auditEntry = auditSnapshot.docs[0].data();
        const hasSnapshot = auditEntry.details?.deletedServiceSnapshot != null;
        const snapshotId = auditEntry.details?.deletedServiceSnapshot?.id;
        console.log(`   ✅ Audit entry found: ${auditSnapshot.docs[0].id}`);
        console.log(`   Action: ${auditEntry.action}`);
        console.log(`   User: ${auditEntry.username}`);
        console.log(`   Has deletedServiceSnapshot: ${hasSnapshot ? '✅' : '❌'}`);
        console.log(`   Snapshot serviceId: ${snapshotId} (expected ${SVC_NO_ENTRIES}): ${snapshotId === SVC_NO_ENTRIES ? '✅' : '❌'}`);
      }

    } else {
      console.log('\n❌ TEST B FAILED — Expected success but got error');
      testsFailed++;
    }

    // ──────────────────────────────────────────────────────────────
    // Step 4: TEST C — Delete without confirmDelete (expect block)
    // ──────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('🧪 TEST C: Delete without confirmDelete: true');
    console.log('   Expected: INVALID_ARGUMENT');
    console.log('════════════════════════════════════════════════════════════════\n');

    const responseC = await callCF(CF_URL, {
      clientId: TEST_CLIENT_ID,
      serviceId: SVC_WITH_ENTRIES,
      confirmDelete: false
    }, idToken);

    console.log(`📦 Response (HTTP ${responseC.statusCode}):`);
    console.log(JSON.stringify(responseC.body, null, 2));

    if (responseC.statusCode !== 200) {
      const errorStatus = responseC.body?.error?.status || '';
      const isIA = errorStatus === 'INVALID_ARGUMENT' ||
                   (responseC.body?.error?.message || '').includes('confirmDelete');

      if (isIA) {
        console.log('\n✅ TEST C PASSED — Correctly rejected (missing confirmDelete)\n');
        testsPassed++;
      } else {
        console.log(`\n❌ TEST C FAILED — Rejected but wrong error: ${errorStatus}\n`);
        testsFailed++;
      }
    } else {
      console.log('\n❌ TEST C FAILED — Should have been rejected!\n');
      testsFailed++;
    }

  } finally {
    // ──────────────────────────────────────────────────────────────
    // Step 5: CLEANUP
    // ──────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🧹 Step 5: CLEANUP');
    console.log('════════════════════════════════════════════════════════════════\n');

    try {
      // Delete test client
      await db.collection('clients').doc(TEST_CLIENT_ID).delete();
      console.log(`   ✅ Deleted test client: ${TEST_CLIENT_ID}`);
    } catch (e) {
      console.log(`   ⚠️ Failed to delete test client: ${e.message}`);
    }

    try {
      // Delete timesheet entry
      if (timesheetEntryId) {
        await db.collection('timesheet_entries').doc(timesheetEntryId).delete();
        console.log(`   ✅ Deleted timesheet entry: ${timesheetEntryId}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Failed to delete timesheet entry: ${e.message}`);
    }

    try {
      // Delete audit_log entries for this test
      const auditCleanup = await db.collection('audit_log')
        .where('action', '==', 'DELETE_SERVICE')
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
  console.log(`📊 Results: ${testsPassed} passed, ${testsFailed} failed (out of 3 tests)`);
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
