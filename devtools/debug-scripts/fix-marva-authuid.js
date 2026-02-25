const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixMarvaAuthUID() {
  try {
    console.log('\n=== תיקון authUID עבור marva ===\n');

    const email = 'marva@ghlawoffice.co.il';
    const correctAuthUID = 'Chh0wGc6EZZyOytdISQEq29Yo7v2';

    // Get current data
    console.log('1️⃣ קריאת נתונים נוכחיים...');
    const docRef = db.collection('employees').doc(email);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      console.error('❌ המסמך לא קיים!');
      process.exit(1);
    }

    const currentData = docSnapshot.data();
    console.log(`   authUID נוכחי: ${currentData.authUID}`);
    console.log(`   uid נוכחי: ${currentData.uid}`);

    // Update authUID
    console.log('\n2️⃣ עדכון authUID...');
    await docRef.update({
      authUID: correctAuthUID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'admin_fix_script',
      authUIDFixedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('   ✅ העדכון בוצע בהצלחה!');

    // Verify the update
    console.log('\n3️⃣ אימות העדכון...');
    const verifySnapshot = await docRef.get();
    const verifyData = verifySnapshot.data();

    console.log(`   authUID חדש: ${verifyData.authUID}`);

    if (verifyData.authUID === correctAuthUID) {
      console.log('\n✅ ✅ ✅ התיקון הושלם בהצלחה! ✅ ✅ ✅');
      console.log('\n   marva@ghlawoffice.co.il יכולה עכשיו ליצור משימות.');
    } else {
      console.log('\n❌ שגיאה: authUID לא עודכן כראוי');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ שגיאה בעת ביצוע התיקון:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixMarvaAuthUID();
