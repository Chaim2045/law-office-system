const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkMarvaEmployee() {
  try {
    console.log('\n=== בדיקת רשומת העובדת marva ===\n');

    // Check if marva exists in employees collection
    const marvaDoc = await db.collection('employees').doc('marva@ghlawoffice.co.il').get();

    if (!marvaDoc.exists) {
      console.log('❌ marva@ghlawoffice.co.il NOT FOUND in employees collection');

      // Check all employees
      console.log('\n=== כל העובדים במערכת ===\n');
      const employeesSnapshot = await db.collection('employees').get();
      employeesSnapshot.forEach(doc => {
        console.log(`- ${doc.id}`);
      });
    } else {
      const data = marvaDoc.data();
      console.log('✅ marva@ghlawoffice.co.il FOUND in employees collection');
      console.log('\nנתוני העובדת:');
      console.log(JSON.stringify(data, null, 2));

      // Check if authUID exists
      if (data.authUID) {
        console.log(`\n✅ authUID: ${data.authUID}`);
      } else {
        console.log('\n❌ authUID חסר!');
      }

      // Check if isActive
      if (data.isActive !== undefined) {
        console.log(`✅ isActive: ${data.isActive}`);
      } else {
        console.log('❌ isActive חסר!');
      }
    }

  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkMarvaEmployee();
