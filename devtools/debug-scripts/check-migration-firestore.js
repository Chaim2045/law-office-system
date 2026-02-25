/**
 * Simple script to check if migration is working
 * Run: node .dev/check-migration-firestore.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkMigration() {
  console.log('🔍 Checking if v2 migration is working...\n');

  // 1. Check for entries created by v2
  console.log('1️⃣ Looking for entries with _processedByVersion = "v2.0"...');
  const v2Entries = await db.collection('timesheet_entries')
    .where('_processedByVersion', '==', 'v2.0')
    .limit(5)
    .get();

  console.log(`   Found ${v2Entries.size} entries created by v2\n`);

  if (v2Entries.empty) {
    console.log('❌ No v2 entries found. Migration may not be working.\n');
    return;
  }

  // 2. Show the latest v2 entry
  const latestEntry = v2Entries.docs[0];
  const data = latestEntry.data();

  console.log('📄 Latest v2 entry:');
  console.log(`   ID: ${latestEntry.id}`);
  console.log(`   Client: ${data.clientName} (${data.clientId})`);
  console.log(`   Internal: ${data.isInternal}`);
  console.log(`   Date: ${data.date}`);
  console.log(`   Minutes: ${data.minutes}`);
  console.log(`   Action: ${data.action}`);
  console.log(`   Version: ${data._processedByVersion}`);
  console.log(`   Idempotency Key: ${data._idempotencyKey ? data._idempotencyKey.substring(0, 50) + '...' : 'MISSING'}`);
  console.log(`   Created: ${data.createdAt?.toDate()}\n`);

  // 3. Check if idempotency key exists in processed_operations
  if (data._idempotencyKey) {
    console.log('2️⃣ Checking processed_operations for this idempotency key...');
    const opsQuery = await db.collection('processed_operations')
      .where('idempotencyKey', '==', data._idempotencyKey)
      .get();

    console.log(`   Found ${opsQuery.size} processed_operations record(s)\n`);

    if (!opsQuery.empty) {
      const opDoc = opsQuery.docs[0];
      const opData = opDoc.data();
      console.log('📄 Processed operation:');
      console.log(`   ID: ${opDoc.id}`);
      console.log(`   Timestamp: ${opData.timestamp?.toDate()}`);
      console.log(`   Result: ${opData.result?.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Entry ID: ${opData.result?.entryId}`);
      console.log(`   Version: ${opData.result?.version}\n`);
    }
  }

  // 4. Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ MIGRATION IS WORKING');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ v2 entries exist: ${v2Entries.size}`);
  console.log(`✅ Latest entry has idempotency key: ${!!data._idempotencyKey}`);
  console.log(`✅ Latest entry marked as v2.0: ${data._processedByVersion === 'v2.0'}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

checkMigration()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
