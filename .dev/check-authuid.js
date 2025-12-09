const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAuthUID() {
  console.log('🔍 Checking all employees for authUID field...\n');

  const snapshot = await db.collection('employees').get();

  let totalCount = 0;
  let withAuthUID = 0;
  const withoutAuthUID = [];

  snapshot.forEach(doc => {
    totalCount++;
    const data = doc.data();

    if (data.authUID) {
      withAuthUID++;
      const shortUID = data.authUID.substring(0, 10);
      console.log(`✅ ${doc.id} - authUID: ${shortUID}...`);
    } else {
      withoutAuthUID.push(doc.id);
      console.log(`❌ ${doc.id} - NO authUID!`);
    }
  });

  console.log('\n📊 Summary:');
  console.log(`Total employees: ${totalCount}`);
  console.log(`With authUID: ${withAuthUID}`);
  console.log(`Without authUID: ${withoutAuthUID.length}`);

  if (withoutAuthUID.length > 0) {
    console.log('\n⚠️  WARNING: These employees are missing authUID:');
    withoutAuthUID.forEach(email => console.log(`   - ${email}`));
  } else {
    console.log('\n✅ All employees have authUID field!');
  }

  process.exit(0);
}

checkAuthUID().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
