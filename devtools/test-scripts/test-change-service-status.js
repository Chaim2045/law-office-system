/**
 * Test Script: changeServiceStatus Cloud Function
 * סקריפט בדיקה חד-פעמי — DEV בלבד
 *
 * Usage: node .claude/test-scripts/test-change-service-status.js
 *
 * Steps:
 * 1. Finds a client with an active service
 * 2. Prints BEFORE state (service + client aggregates)
 * 3. Calls changeServiceStatus CF with newStatus: 'on_hold' + note
 * 4. Prints CF result
 * 5. Reads client doc, prints AFTER state + statusChangeHistory
 * 6. Compares BEFORE vs AFTER (activeServices should drop by 1)
 * 7. Checks audit_log for CHANGE_SERVICE_STATUS
 * 8. Calls CF again with same status (on_hold) — expects failed-precondition
 * 9. Reverts to active: calls CF with newStatus: 'active'
 * 10. Prints FINAL state (should match original)
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
const CF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/changeServiceStatus`;

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
// Helpers (same pattern as test-complete-service.js)
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

function printAggregates(data, label) {
  console.log(`\n📊 ${label} — Client Aggregates:`);
  console.log('─'.repeat(60));
  console.log(`  totalHours:      ${data.totalHours ?? 'N/A'}`);
  console.log(`  hoursRemaining:  ${data.hoursRemaining ?? 'N/A'}`);
  console.log(`  minutesRemaining:${data.minutesRemaining ?? 'N/A'}`);
  console.log(`  hoursUsed:       ${data.hoursUsed ?? 'N/A'}`);
  console.log(`  totalServices:   ${data.totalServices ?? 'N/A'}`);
  console.log(`  activeServices:  ${data.activeServices ?? 'N/A'}`);
  console.log(`  isBlocked:       ${data.isBlocked ?? 'N/A'}`);
  console.log(`  isCritical:      ${data.isCritical ?? 'N/A'}`);
  console.log('─'.repeat(60));
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🧪 Test: changeServiceStatus Cloud Function');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────
  // Step 1: Find a suitable client
  // ──────────────────────────────────────────────────────────────
  console.log('🔍 Step 1: Finding client with an active service...\n');

  const clientsSnapshot = await db.collection('clients').get();

  let targetClient = null;
  let targetService = null;

  for (const doc of clientsSnapshot.docs) {
    const data = doc.data();
    const services = data.services || [];

    for (const svc of services) {
      if (svc.status === 'active') {
        targetClient = { id: doc.id, ...data };
        targetService = svc;
        break;
      }
    }

    if (targetClient) {
break;
}
  }

  if (!targetClient) {
    console.log('❌ No client found with an active service');
    process.exit(1);
  }

  console.log(`✅ Found client: ${targetClient.fullName || targetClient.name || targetClient.id}`);
  console.log(`   Client ID: ${targetClient.id}`);
  console.log(`   Service: ${targetService.name || targetService.serviceName} (ID: ${targetService.id})`);
  console.log(`   Type: ${targetService.type || targetService.serviceType}`);
  console.log(`   Status: ${targetService.status}`);

  // Count active services before
  const activeServicesBefore = (targetClient.services || []).filter(s => s.status === 'active').length;
  console.log(`\n   Active services on this client: ${activeServicesBefore}`);

  printAggregates(targetClient, 'BEFORE');

  // ──────────────────────────────────────────────────────────────
  // Step 2: Get auth token
  // ──────────────────────────────────────────────────────────────
  console.log('\n🔑 Step 2: Getting auth token...');

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
  console.log(`   ✅ ID token obtained (${idToken.substring(0, 20)}...)`);

  // ──────────────────────────────────────────────────────────────
  // Step 3: Call CF — active → on_hold
  // ──────────────────────────────────────────────────────────────
  console.log('\n🚀 Step 3: Calling changeServiceStatus CF (active → on_hold)...');
  console.log(`   URL: ${CF_URL}`);
  console.log(`   Data: { clientId: "${targetClient.id}", serviceId: "${targetService.id}", newStatus: "on_hold", note: "בדיקת טומי" }`);

  const cfResponse = await callCF(CF_URL, {
    clientId: targetClient.id,
    serviceId: targetService.id,
    newStatus: 'on_hold',
    note: 'בדיקת טומי'
  }, idToken);

  console.log(`\n📦 CF Response (HTTP ${cfResponse.statusCode}):`);
  console.log(JSON.stringify(cfResponse.body, null, 2));

  if (cfResponse.statusCode !== 200) {
    console.log('\n❌ CF call failed! Aborting.');
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────────
  // Step 4: Read client doc AFTER
  // ──────────────────────────────────────────────────────────────
  console.log('\n📖 Step 4: Reading client doc after update...');

  const afterDoc = await db.collection('clients').doc(targetClient.id).get();
  const afterData = afterDoc.data();
  const afterService = (afterData.services || []).find(s => s.id === targetService.id);

  if (afterService) {
    console.log(`\n   Service status:      ${afterService.status}`);
    console.log(`   statusChangedAt:     ${afterService.statusChangedAt || 'N/A'}`);
    console.log(`   statusChangedBy:     ${afterService.statusChangedBy || 'N/A'}`);
    console.log(`   previousStatus:      ${afterService.previousStatus || 'N/A'}`);

    const history = afterService.statusChangeHistory || [];
    console.log(`   statusChangeHistory: ${history.length} entries`);
    if (history.length > 0) {
      const last = history[history.length - 1];
      console.log(`     Last entry: ${last.from} → ${last.to} by ${last.changedBy} at ${last.changedAt}`);
      console.log(`     Note: ${last.note || '(none)'}`);
    }
  } else {
    console.log('❌ Service not found in updated doc!');
  }

  printAggregates(afterData, 'AFTER');

  // ──────────────────────────────────────────────────────────────
  // Step 5: Compare BEFORE vs AFTER
  // ──────────────────────────────────────────────────────────────
  console.log('\n📊 Step 5: Comparison BEFORE vs AFTER:');
  console.log('─'.repeat(60));

  const fields = [
    'totalHours', 'hoursRemaining', 'minutesRemaining', 'hoursUsed',
    'totalServices', 'activeServices', 'isBlocked', 'isCritical'
  ];

  for (const field of fields) {
    const before = targetClient[field];
    const after = afterData[field];
    const changed = before !== after;
    const marker = changed ? '🔄' : '  ';
    const arrow = changed ? '→' : '=';
    console.log(`  ${marker} ${field}: ${before ?? 'N/A'} ${arrow} ${after ?? 'N/A'}`);
  }

  // Service status
  const statusBefore = targetService.status;
  const statusAfter = afterService ? afterService.status : 'N/A';
  console.log(`  🔄 service.status: ${statusBefore} → ${statusAfter}`);

  // activeServices check
  const activeServicesAfter = afterData.activeServices;
  const expectedDrop = activeServicesBefore - 1;
  const dropOk = activeServicesAfter === expectedDrop;
  console.log(`\n  🎯 activeServices: ${activeServicesBefore} → ${activeServicesAfter} (expected ${expectedDrop}) ${dropOk ? '✅' : '❌ MISMATCH'}`);

  console.log('─'.repeat(60));

  // ──────────────────────────────────────────────────────────────
  // Step 6: Check audit_log
  // ──────────────────────────────────────────────────────────────
  console.log('\n📝 Step 6: Checking audit_log for CHANGE_SERVICE_STATUS...');

  const auditSnapshot = await db.collection('audit_log')
    .where('action', '==', 'CHANGE_SERVICE_STATUS')
    .orderBy('timestamp', 'desc')
    .limit(3)
    .get();

  if (auditSnapshot.empty) {
    console.log('❌ No CHANGE_SERVICE_STATUS entries found in audit_log');
  } else {
    console.log(`✅ Found ${auditSnapshot.size} recent CHANGE_SERVICE_STATUS entries:\n`);
    auditSnapshot.forEach(doc => {
      const entry = doc.data();
      const ts = entry.timestamp?.toDate?.() || entry.timestamp;
      console.log(`  📋 ${doc.id}`);
      console.log(`     Action: ${entry.action}`);
      console.log(`     User: ${entry.username || entry.userId}`);
      console.log(`     Time: ${ts}`);
      console.log(`     Details: ${JSON.stringify(entry.details || entry.metadata, null, 2)}`);
      console.log();
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Step 7: Call CF again with same status — expect failed-precondition
  // ──────────────────────────────────────────────────────────────
  console.log('🔁 Step 7: Calling CF again with same status (on_hold) — expecting failed-precondition...');

  const retryResponse = await callCF(CF_URL, {
    clientId: targetClient.id,
    serviceId: targetService.id,
    newStatus: 'on_hold',
    note: 'should fail'
  }, idToken);

  console.log(`\n📦 Retry Response (HTTP ${retryResponse.statusCode}):`);
  console.log(JSON.stringify(retryResponse.body, null, 2));

  if (retryResponse.statusCode !== 200) {
    const errorMsg = retryResponse.body?.error?.message || retryResponse.body?.error?.status || '';
    const isFP = errorMsg.includes('כבר זהה') || errorMsg.includes('failed-precondition') ||
                 retryResponse.body?.error?.status === 'FAILED_PRECONDITION';
    console.log(`\n${isFP ? '✅ Correctly rejected (failed-precondition)' : '⚠️ Rejected but unexpected error'}: ${errorMsg}`);
  } else {
    console.log('\n❌ ERROR: CF should have rejected — status is already on_hold!');
  }

  // ──────────────────────────────────────────────────────────────
  // Step 8: Revert — on_hold → active
  // ──────────────────────────────────────────────────────────────
  console.log('\n🔄 Step 8: Reverting service back to active...');

  const revertResponse = await callCF(CF_URL, {
    clientId: targetClient.id,
    serviceId: targetService.id,
    newStatus: 'active',
    note: 'החזרה מבדיקה'
  }, idToken);

  console.log(`\n📦 Revert Response (HTTP ${revertResponse.statusCode}):`);
  console.log(JSON.stringify(revertResponse.body, null, 2));

  if (revertResponse.statusCode !== 200) {
    console.log('\n❌ Revert failed! Service is stuck on on_hold — fix manually.');
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────────
  // Step 9: Read FINAL state
  // ──────────────────────────────────────────────────────────────
  console.log('\n📖 Step 9: Reading FINAL state...');

  const finalDoc = await db.collection('clients').doc(targetClient.id).get();
  const finalData = finalDoc.data();
  const finalService = (finalData.services || []).find(s => s.id === targetService.id);

  if (finalService) {
    console.log(`\n   Service status:      ${finalService.status}`);
    console.log(`   statusChangedAt:     ${finalService.statusChangedAt || 'N/A'}`);
    console.log(`   previousStatus:      ${finalService.previousStatus || 'N/A'}`);

    const history = finalService.statusChangeHistory || [];
    console.log(`   statusChangeHistory: ${history.length} entries`);
    history.forEach((h, i) => {
      console.log(`     [${i}] ${h.from} → ${h.to} by ${h.changedBy} (${h.note || 'no note'})`);
    });
  }

  printAggregates(finalData, 'FINAL');

  // ──────────────────────────────────────────────────────────────
  // Step 10: Final comparison — should match original
  // ──────────────────────────────────────────────────────────────
  console.log('\n📊 Step 10: FINAL vs ORIGINAL comparison:');
  console.log('─'.repeat(60));

  const finalActiveServices = finalData.activeServices;
  const restored = finalActiveServices === activeServicesBefore;
  console.log(`  activeServices: ORIGINAL=${activeServicesBefore}  FINAL=${finalActiveServices}  ${restored ? '✅ RESTORED' : '❌ MISMATCH'}`);

  const finalStatus = finalService ? finalService.status : 'N/A';
  const statusRestored = finalStatus === 'active';
  console.log(`  service.status: ORIGINAL=active  FINAL=${finalStatus}  ${statusRestored ? '✅ RESTORED' : '❌ MISMATCH'}`);

  console.log('─'.repeat(60));

  // ──────────────────────────────────────────────────────────────
  // Done
  // ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`✅ Test completed in ${elapsed}s`);
  console.log('════════════════════════════════════════════════════════════════');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
