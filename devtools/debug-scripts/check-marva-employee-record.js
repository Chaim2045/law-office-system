/**
 * Check Marva's employee record - verify UID matches Auth
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkMarvaEmployee() {
  console.log('🔍 CHECKING MARVA EMPLOYEE RECORD\n');
  console.log('═══════════════════════════════════════════════════\n');

  const db = admin.firestore();
  const auth = admin.auth();

  const marvaEmail = 'marva@ghlawoffice.co.il';

  // 1. Check Auth UID
  console.log('1️⃣  Checking Auth UID...\n');
  const authUser = await auth.getUserByEmail(marvaEmail);
  console.log(`   Auth UID: ${authUser.uid}`);
  console.log(`   Created: ${authUser.metadata.creationTime}`);

  // 2. Check employees collection (by email as document ID)
  console.log('\n2️⃣  Checking employees collection...\n');
  const employeeDoc = await db.collection('employees').doc(marvaEmail).get();

  if (employeeDoc.exists) {
    const data = employeeDoc.data();
    console.log('   ✅ Employee document exists');
    console.log(`   Document ID: ${employeeDoc.id}`);
    console.log(`   UID in doc: ${data.uid || 'NOT SET'}`);
    console.log(`   Username: ${data.username || 'N/A'}`);
    console.log(`   Role: ${data.role || 'N/A'}`);

    if (data.uid !== authUser.uid) {
      console.log('\n   ⚠️  UID MISMATCH!');
      console.log(`   Auth UID:     ${authUser.uid}`);
      console.log(`   Employee UID: ${data.uid || 'NOT SET'}`);
      console.log('\n   💡 Need to update employee document with correct UID!');
    } else {
      console.log('\n   ✅ UID matches Auth record');
    }
  } else {
    console.log('   ❌ Employee document does NOT exist!');
    console.log('   Need to create employee record');
  }

  process.exit(0);
}

checkMarvaEmployee().catch(console.error);
