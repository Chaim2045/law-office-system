/**
 * 🧹 Cleanup All Data - מחיקת כל הנתונים מהמערכת
 *
 * מוחק:
 * - clients (לקוחות)
 * - budget_tasks (משימות)
 * - timesheet_entries (רשומות שעות)
 *
 * שימוש: node cleanup-all-data.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionName) {
  console.log(`\n🗑️  מוחק את collection: ${collectionName}...`);

  const snapshot = await db.collection(collectionName).get();
  const totalDocs = snapshot.size;

  if (totalDocs === 0) {
    console.log(`   ✅ ${collectionName} כבר ריק`);
    return;
  }

  console.log(`   📊 נמצאו ${totalDocs} מסמכים`);

  const batchSize = 500;
  let deletedCount = 0;

  while (true) {
    const batch = db.batch();
    const docs = await db.collection(collectionName).limit(batchSize).get();

    if (docs.empty) {
break;
}

    docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();
    console.log(`   🔄 נמחקו ${deletedCount}/${totalDocs} מסמכים...`);
  }

  console.log(`   ✅ ${collectionName} נמחק בהצלחה! (${deletedCount} מסמכים)`);
}

async function cleanupAllData() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧹 מתחיל מחיקת כל הנתונים מהמערכת...');
  console.log('═══════════════════════════════════════════════════════');

  try {
    // מחיקת כל ה-collections
    await deleteCollection('clients');
    await deleteCollection('budget_tasks');
    await deleteCollection('timesheet_entries');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ כל הנתונים נמחקו בהצלחה!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n💡 עכשיו אפשר ליצור לקוח חדש ולבדוק את המערכת מאפס\n');

  } catch (error) {
    console.error('\n❌ שגיאה במחיקת נתונים:', error);
  } finally {
    process.exit(0);
  }
}

cleanupAllData();
