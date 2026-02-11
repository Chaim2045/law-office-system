const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'create_test_' + Date.now());
const db = app.firestore();

(async () => {
  const docRef = db.collection('system_announcements').doc('test_client_sdk_readby');

  await docRef.set({
    title: 'test readby',
    message: 'test',
    active: false,
    type: 'info',
    priority: 1
  });

  console.log('Created document: test_client_sdk_readby');

  // Verify
  const snap = await docRef.get();
  console.log('Verified data:', JSON.stringify(snap.data(), null, 2));

  process.exit(0);
})();
