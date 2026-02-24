/**
 * Test Script: moveToNextStage Cloud Function
 * סקריפט בדיקה חד-פעמי — DEV בלבד
 *
 * Usage: node .claude/test-scripts/test-move-stage.js
 *
 * Steps:
 * 1. Finds a client with legal_procedure service + active stage (not last)
 * 2. Prints BEFORE state
 * 3. Calls moveToNextStage CF via authenticated HTTP
 * 4. Prints CF result
 * 5. Reads client doc again, prints AFTER state
 * 6. Checks audit_log for new entry
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
const CF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/moveToNextStage`;

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
// Helpers
// ════════════════════════════════════════════════════════════════

function printStages(stages, label) {
  console.log(`\n📋 ${label}:`);
  console.log('─'.repeat(60));
  stages.forEach((stage, idx) => {
    const marker =
      stage.status === 'active' ? '🟢' :
      stage.status === 'completed' ? '✅' :
      '⬜';
    console.log(`  ${idx + 1}. ${marker} ${stage.name || stage.id} [${stage.status || 'pending'}]`);
    if (stage.startedAt) {
console.log(`     started: ${stage.startedAt}`);
}
    if (stage.completedAt) {
console.log(`     completed: ${stage.completedAt}`);
}
  });
  console.log('─'.repeat(60));
}

/**
 * Call a Firebase callable function via HTTP with Admin auth
 * Uses ID token from a real Firebase Auth user
 */
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
          if (res.statusCode === 200) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Get an ID token for a real user using the Firebase Auth REST API
 * Requires: a real user's UID + service account with signCustomToken
 */
async function getIdTokenForUser(uid) {
  // Step 1: Create custom token via Admin SDK
  const customToken = await admin.auth().createCustomToken(uid);

  // Step 2: Exchange custom token for ID token via Firebase Auth REST API
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

/**
 * Get Web API Key from firebase config
 */
async function getWebApiKey() {
  // Try reading from .firebaserc or firebase config
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

  // Fallback: read from firebase web config in HTML
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

  throw new Error('❌ Cannot find Firebase Web API Key. Set FIREBASE_API_KEY env var or add to .env');
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🧪 Test: moveToNextStage Cloud Function');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────
  // Step 1: Find a suitable client
  // ──────────────────────────────────────────────────────────────
  console.log('🔍 Step 1: Finding client with legal_procedure + active stage (not last)...\n');

  const clientsSnapshot = await db.collection('clients').get();

  let targetClient = null;
  let targetService = null;
  let activeStageIndex = -1;

  for (const doc of clientsSnapshot.docs) {
    const data = doc.data();
    const services = data.services || [];

    for (const svc of services) {
      const type = svc.type || svc.serviceType;
      if (type !== 'legal_procedure') {
continue;
}
      if (!svc.stages || svc.stages.length < 2) {
continue;
}

      const activeIdx = svc.stages.findIndex(s => s.status === 'active');
      if (activeIdx === -1) {
continue;
}
      if (activeIdx >= svc.stages.length - 1) {
continue;
} // last stage — skip

      targetClient = { id: doc.id, ...data };
      targetService = svc;
      activeStageIndex = activeIdx;
      break;
    }

    if (targetClient) {
break;
}
  }

  if (!targetClient) {
    console.log('❌ No suitable client found (legal_procedure with active non-last stage)');
    process.exit(1);
  }

  console.log(`✅ Found client: ${targetClient.fullName || targetClient.name || targetClient.id}`);
  console.log(`   Client ID: ${targetClient.id}`);
  console.log(`   Service: ${targetService.name || targetService.serviceName} (ID: ${targetService.id})`);
  console.log(`   Type: ${targetService.type || targetService.serviceType}`);
  console.log(`   Active stage index: ${activeStageIndex} / ${targetService.stages.length - 1}`);

  printStages(targetService.stages, 'BEFORE — Stages');

  const currentStage = targetService.stages[activeStageIndex];
  const nextStage = targetService.stages[activeStageIndex + 1];
  console.log(`\n🎯 Will move: "${currentStage.name || currentStage.id}" → "${nextStage.name || nextStage.id}"`);

  // ──────────────────────────────────────────────────────────────
  // Step 2: Get auth token
  // ──────────────────────────────────────────────────────────────
  console.log('\n🔑 Step 2: Getting auth token...');

  // Find an active employee to use as caller
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
  // Step 3: Call CF
  // ──────────────────────────────────────────────────────────────
  console.log('\n🚀 Step 3: Calling moveToNextStage CF...');
  console.log(`   URL: ${CF_URL}`);
  console.log(`   Data: { clientId: "${targetClient.id}", serviceId: "${targetService.id}" }`);

  const cfResult = await callCF(CF_URL, {
    clientId: targetClient.id,
    serviceId: targetService.id
  }, idToken);

  console.log('\n📦 CF Response:');
  console.log(JSON.stringify(cfResult, null, 2));

  // ──────────────────────────────────────────────────────────────
  // Step 4: Read client doc AFTER
  // ──────────────────────────────────────────────────────────────
  console.log('\n📖 Step 4: Reading client doc after update...');

  const afterDoc = await db.collection('clients').doc(targetClient.id).get();
  const afterData = afterDoc.data();
  const afterService = (afterData.services || []).find(s => s.id === targetService.id);

  if (afterService) {
    printStages(afterService.stages, 'AFTER — Stages');
  } else {
    console.log('❌ Service not found in updated doc!');
  }

  // ──────────────────────────────────────────────────────────────
  // Step 5: Compare BEFORE vs AFTER
  // ──────────────────────────────────────────────────────────────
  console.log('\n📊 Step 5: Comparison BEFORE vs AFTER:');
  console.log('─'.repeat(60));

  if (afterService) {
    targetService.stages.forEach((beforeStage, idx) => {
      const afterStage = afterService.stages[idx];
      const changed = beforeStage.status !== afterStage.status;
      const arrow = changed ? '→' : '=';
      const marker = changed ? '🔄' : '  ';
      console.log(`  ${marker} Stage ${idx + 1}: [${beforeStage.status || 'pending'}] ${arrow} [${afterStage.status || 'pending'}] — ${beforeStage.name || beforeStage.id}`);
    });
  }

  console.log('─'.repeat(60));

  // ──────────────────────────────────────────────────────────────
  // Step 6: Check audit_log
  // ──────────────────────────────────────────────────────────────
  console.log('\n📝 Step 6: Checking audit_log...');

  const auditSnapshot = await db.collection('audit_log')
    .where('action', '==', 'MOVE_TO_NEXT_STAGE')
    .orderBy('timestamp', 'desc')
    .limit(3)
    .get();

  if (auditSnapshot.empty) {
    console.log('❌ No MOVE_TO_NEXT_STAGE entries found in audit_log');
  } else {
    console.log(`✅ Found ${auditSnapshot.size} recent MOVE_TO_NEXT_STAGE entries:\n`);
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
  // Done
  // ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`✅ Test completed in ${elapsed}s`);
  console.log('════════════════════════════════════════════════════════════════');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
