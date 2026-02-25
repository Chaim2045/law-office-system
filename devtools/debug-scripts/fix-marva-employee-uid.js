/**
 * Fix Marva's employee record - update UID to match Auth
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function fixMarvaEmployeeUID() {
  console.log('🔧 FIXING MARVA EMPLOYEE UID\n');
  console.log('═══════════════════════════════════════════════════\n');

  const db = admin.firestore();
  const auth = admin.auth();

  const marvaEmail = 'marva@ghlawoffice.co.il';

  // 1. Get Auth UID
  const authUser = await auth.getUserByEmail(marvaEmail);
  console.log('✅ Auth UID:', authUser.uid);

  // 2. Update employee document
  console.log('\n🔄 Updating employee document...\n');

  const employeeRef = db.collection('employees').doc(marvaEmail);

  await employeeRef.update({
    uid: authUser.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('✅ Employee document updated successfully!');

  // 3. Verify
  console.log('\n🔍 Verifying...\n');
  const updatedDoc = await employeeRef.get();
  const data = updatedDoc.data();

  console.log('   Auth UID:     ', authUser.uid);
  console.log('   Employee UID: ', data.uid);
  console.log('   Match:', authUser.uid === data.uid ? '✅ YES' : '❌ NO');

  if (authUser.uid === data.uid) {
    console.log('\n✅ SUCCESS - Marva can now edit timesheet entries!');
  }

  process.exit(0);
}

fixMarvaEmployeeUID().catch(console.error);
