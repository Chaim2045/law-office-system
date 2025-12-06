const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

async function checkUserRole() {
  try {
    const userDoc = await db.collection('users').doc('haim@ghlawoffice.co.il').get();

    if (userDoc.exists) {
      const data = userDoc.data();
      console.log('✅ User found!');
      console.log('Email:', 'haim@ghlawoffice.co.il');
      console.log('Role:', data.role);
      console.log('Display Name:', data.displayName);
      console.log('\nFull data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ User NOT found in users collection');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUserRole();
