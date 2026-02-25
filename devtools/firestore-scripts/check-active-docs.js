const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'checkactive_' + Date.now());
const db = app.firestore();

(async () => {
  console.log('=== All system_announcements documents ===');
  const allSnap = await db.collection('system_announcements').get();
  console.log('Total documents:', allSnap.size);
  console.log('');

  allSnap.forEach(doc => {
    const data = doc.data();
    console.log('--- Document:', doc.id, '---');
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val && typeof val === 'object' && val._seconds !== undefined) {
        console.log('  ' + key + ' (Timestamp):', new Date(val._seconds * 1000).toISOString());
      } else if (typeof val === 'object' && val !== null) {
        console.log('  ' + key + ':', JSON.stringify(val));
      } else {
        console.log('  ' + key + ':', val);
      }
    });
    console.log('');
  });

  console.log('=== Active documents only ===');
  const activeSnap = await db.collection('system_announcements').where('active', '==', true).get();
  console.log('Active documents:', activeSnap.size);
  activeSnap.forEach(doc => {
    const data = doc.data();
    console.log('  ID:', doc.id, '| title:', data.title);
  });

  process.exit(0);
})();
