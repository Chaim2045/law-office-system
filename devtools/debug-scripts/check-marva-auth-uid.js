const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkMarvaAuthUID() {
  try {
    console.log('\n=== בדיקת התאמה בין Auth ל-Firestore ===\n');

    // 1. Get Marva's Auth UID
    const authRecord = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');
    console.log('1️⃣ Firebase Authentication:');
    console.log('   Email:   marva@ghlawoffice.co.il');
    console.log(`   UID:     ${authRecord.uid}`);

    // 2. Get Marva's Firestore employee record
    const employeeDoc = await db.collection('employees').doc('marva@ghlawoffice.co.il').get();
    const employeeData = employeeDoc.data();

    console.log('\n2️⃣ Firestore employees collection:');
    console.log('   Document ID:  marva@ghlawoffice.co.il');
    console.log(`   authUID:      ${employeeData.authUID}`);
    console.log(`   uid (old):    ${employeeData.uid}`);
    console.log(`   isActive:     ${employeeData.isActive}`);

    // 3. Check if they match
    console.log('\n3️⃣ התאמה:');
    if (authRecord.uid === employeeData.authUID) {
      console.log('   ✅ authUID תואם ל-Auth UID');
    } else {
      console.log('   ❌ authUID לא תואם!');
      console.log(`      Auth UID:        ${authRecord.uid}`);
      console.log(`      Firestore UID:   ${employeeData.authUID}`);
    }

    // 4. Test the query that checkUserPermissions uses
    console.log('\n4️⃣ בדיקת Query של checkUserPermissions:');
    const querySnapshot = await db.collection('employees')
      .where('authUID', '==', authRecord.uid)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.log('   ❌ Query לא מצא עובד! (זו הבעיה!)');
      console.log(`      מחפש authUID: ${authRecord.uid}`);
    } else {
      console.log('   ✅ Query מצא עובד:');
      const doc = querySnapshot.docs[0];
      console.log(`      Document ID: ${doc.id}`);
      console.log(`      Username:    ${doc.data().username}`);
    }

  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkMarvaAuthUID();
