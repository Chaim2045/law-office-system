const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'readdoc_' + Date.now());
const db = app.firestore();

(async () => {
  const docRef = db.collection('system_announcements').doc('OWMhuNBnI97aw15H3jJ0');
  const snap = await docRef.get();

  if (!snap.exists) {
    console.log('Document OWMhuNBnI97aw15H3jJ0 does NOT exist!');
    process.exit(0);
  }

  const data = snap.data();
  console.log('=== Document: OWMhuNBnI97aw15H3jJ0 ===');
  console.log('');

  // Print all fields
  Object.keys(data).forEach(key => {
    const val = data[key];
    if (val && typeof val === 'object' && val._seconds !== undefined) {
      console.log(key + ' (Timestamp):', new Date(val._seconds * 1000).toISOString());
    } else if (typeof val === 'object' && val !== null) {
      console.log(key + ' (Object):');
      console.log(JSON.stringify(val, null, 2));
    } else {
      console.log(key + ':', val);
    }
    console.log('');
  });

  // Specific readBy analysis
  const readBy = data.readBy;
  console.log('=== readBy Analysis ===');
  if (!readBy || Object.keys(readBy).length === 0) {
    console.log('readBy: EMPTY or missing');
  } else {
    console.log('Top-level keys:', JSON.stringify(Object.keys(readBy)));
    console.log('Number of entries:', Object.keys(readBy).length);

    Object.keys(readBy).forEach(key => {
      const val = readBy[key];
      if (val && typeof val === 'object' && val.displayName !== undefined) {
        const readAt = val.readAt ? (val.readAt._seconds ? new Date(val.readAt._seconds * 1000).toISOString() : val.readAt) : 'null';
        console.log('  "' + key + '" → FLAT | displayName=' + val.displayName + ' | readAt=' + readAt);
      } else if (val && typeof val === 'object') {
        console.log('  "' + key + '" → NESTED (broken) | content:', JSON.stringify(val));
      }
    });
  }

  // Check dismissedBy
  console.log('');
  console.log('=== dismissedBy ===');
  console.log('dismissedBy:', JSON.stringify(data.dismissedBy || 'MISSING'));

  process.exit(0);
})();
