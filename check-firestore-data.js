const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkFirestoreData() {
  console.log('🔍 בודק נתונים ב-Firestore...\n');

  try {
    // Get all collections
    const collections = await db.listCollections();

    console.log('📚 Collections שנמצאו:');
    console.log('=' .repeat(50));

    for (const collection of collections) {
      const snapshot = await collection.get();
      console.log(`\n📁 ${collection.id}: ${snapshot.size} מסמכים`);

      if (snapshot.size > 0 && snapshot.size <= 10) {
        // Show document IDs for small collections
        const docIds = snapshot.docs.map(doc => `  - ${doc.id}`).join('\n');
        console.log(docIds);
      } else if (snapshot.size > 10) {
        // Show first 5 document IDs for large collections
        const first5 = snapshot.docs.slice(0, 5).map(doc => `  - ${doc.id}`).join('\n');
        console.log(first5);
        console.log(`  ... ועוד ${snapshot.size - 5} מסמכים`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ סיימתי לבדוק את הנתונים');

  } catch (error) {
    console.error('❌ שגיאה:', error);
  }

  process.exit(0);
}

checkFirestoreData();
