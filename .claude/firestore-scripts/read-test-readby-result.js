const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'read_test_' + Date.now());
const db = app.firestore();

(async () => {
  const docRef = db.collection('system_announcements').doc('test_client_sdk_readby');
  const snap = await docRef.get();

  if (!snap.exists) {
    console.log('Document not found!');
    process.exit(1);
  }

  const data = snap.data();
  const readBy = data.readBy;

  console.log('=== Document: test_client_sdk_readby ===');
  console.log('');
  console.log('Full document data:');
  console.log(JSON.stringify(data, null, 2));
  console.log('');

  if (!readBy || Object.keys(readBy).length === 0) {
    console.log('readBy: EMPTY — the console command did not write anything');
    process.exit(0);
  }

  console.log('readBy top-level keys:', JSON.stringify(Object.keys(readBy)));
  console.log('');

  // Analyze each key
  Object.keys(readBy).forEach(key => {
    const val = readBy[key];
    console.log('Key:', JSON.stringify(key));

    if (val && typeof val === 'object' && val.displayName !== undefined) {
      console.log('  Structure: FLAT (correct)');
      console.log('  displayName:', val.displayName);
      console.log('  readAt:', val.readAt ? new Date(val.readAt._seconds * 1000).toISOString() : 'null');
    } else if (val && typeof val === 'object') {
      console.log('  Structure: NESTED (broken)');
      console.log('  Content:', JSON.stringify(val, null, 4));

      // Walk depth
      function walkDepth(obj, depth) {
        let maxD = depth;
        Object.keys(obj).forEach(k => {
          const v = obj[k];
          if (v && typeof v === 'object' && !v._seconds) {
            const d = walkDepth(v, depth + 1);
            if (d > maxD) {
maxD = d;
}
          }
        });
        return maxD;
      }
      console.log('  Nesting depth:', walkDepth(val, 1));
    }
  });

  console.log('');
  console.log('========================================');
  const firstKey = Object.keys(readBy)[0];
  const isFlat = readBy[firstKey] && readBy[firstKey].displayName !== undefined;
  console.log('VERDICT:', isFlat ? 'FLAT (set+merge works correctly on Client SDK)' : 'NESTED (set+merge is BROKEN on Client SDK — dots in keys create nested paths)');

  process.exit(0);
})();
