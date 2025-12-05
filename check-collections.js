const admin = require('firebase-admin');

// Initialize without service account (uses application default credentials)
admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

async function checkCollections() {
  console.log('🔍 בודק Collections ב-Firestore...\n');

  try {
    const collections = ['clients', 'tasks', 'users', 'settings', 'userAlerts', 'systemAlerts'];

    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).limit(1).get();
        const count = await db.collection(collectionName).count().get();

        console.log(`📁 ${collectionName}: ${count.data().count} מסמכים`);
      } catch (error) {
        console.log(`📁 ${collectionName}: לא קיים או ריק`);
      }
    }

    console.log('\n✅ סיימתי');

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  }

  process.exit(0);
}

checkCollections();
