/**
 * List All Firestore Collections
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function listCollections() {
  console.log('📚 LISTING ALL FIRESTORE COLLECTIONS\n');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`Project: ${serviceAccount.project_id}\n`);

  const db = admin.firestore();

  try {
    const collections = await db.listCollections();

    console.log(`Found ${collections.length} root collections:\n`);

    for (const collection of collections) {
      console.log(`\n📁 ${collection.id}`);
      console.log('─────────────────────────────────────────────────');

      try {
        const snapshot = await collection.limit(3).get();
        console.log(`   Documents: ${snapshot.size} (showing first 3)\n`);

        if (snapshot.size > 0) {
          snapshot.forEach(doc => {
            console.log(`   📄 ${doc.id}`);
            const data = doc.data();
            const keys = Object.keys(data);
            console.log(`      Fields: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
          });
        } else {
          console.log('   (empty)');
        }

      } catch (error) {
        console.log(`   ❌ Error reading: ${error.message}`);
      }
    }

    // Check specific collections we expect
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('🔍 CHECKING EXPECTED COLLECTIONS');
    console.log('═══════════════════════════════════════════════════\n');

    const expectedCollections = ['tasks', 'employees', 'clients', 'cases', 'activityLog'];

    for (const collName of expectedCollections) {
      try {
        const coll = db.collection(collName);
        const snapshot = await coll.limit(1).get();
        const exists = snapshot.size > 0;

        console.log(`${collName.padEnd(20)} ${exists ? '✅ EXISTS' : '❌ EMPTY'} (${snapshot.size > 0 ? 'has data' : 'no documents'})`);
      } catch (error) {
        console.log(`${collName.padEnd(20)} ❌ ERROR: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error listing collections:', error.message);
  }

  process.exit(0);
}

listCollections().catch(console.error);