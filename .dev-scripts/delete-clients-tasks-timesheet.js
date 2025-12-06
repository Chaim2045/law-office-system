const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionName) {
  console.log(`\n🗑️  מוחק את collection: ${collectionName}...`);

  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log(`   ✅ ${collectionName} כבר ריק`);
    return;
  }

  console.log(`   📊 נמצאו ${snapshot.size} מסמכים`);

  const batchSize = 500;
  let deletedCount = 0;

  // Delete in batches
  while (true) {
    const batch = db.batch();
    const docs = await collectionRef.limit(batchSize).get();

    if (docs.empty) {
break;
}

    docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += docs.size;
    console.log(`   ⏳ נמחקו ${deletedCount} מסמכים...`);

    if (docs.size < batchSize) {
break;
}
  }

  console.log(`   ✅ ${collectionName} נמחק בהצלחה! (${deletedCount} מסמכים)`);
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🧹 מתחיל מחיקה של לקוחות, משימות ושעתונים');
  console.log('=' .repeat(60));

  try {
    // Delete the three collections
    await deleteCollection('clients');
    await deleteCollection('budget_tasks');
    await deleteCollection('timesheet_entries');

    console.log('\n' + '=' .repeat(60));
    console.log('✅ המחיקה הושלמה בהצלחה!');
    console.log('=' .repeat(60));
    console.log('\n📋 סיכום:');
    console.log('   ✅ clients - נמחק');
    console.log('   ✅ budget_tasks - נמחק');
    console.log('   ✅ timesheet_entries - נמחק');
    console.log('\n💾 כל השאר נשמר (משתמשים, עובדים, לוגים וכו\')');

  } catch (error) {
    console.error('\n❌ שגיאה במחיקה:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
