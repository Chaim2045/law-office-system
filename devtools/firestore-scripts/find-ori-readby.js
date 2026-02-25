const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'findori_' + Date.now());
const db = app.firestore();

(async () => {
  const snap = await db.collection('system_announcements').get();
  console.log('Total documents:', snap.size);
  console.log('');

  let found = false;

  snap.forEach(doc => {
    const data = doc.data();
    const readBy = data.readBy || {};

    // Check flat key
    const hasFlat = readBy['ori@ghlawoffice.co.il'] !== undefined;

    // Check nested key (broken: ori@ghlawoffice → co → il)
    const hasNested = readBy['ori@ghlawoffice'] && readBy['ori@ghlawoffice'].co;

    if (hasFlat || hasNested) {
      found = true;
      console.log('=== FOUND: Document', doc.id, '===');
      console.log('');

      // All fields
      Object.keys(data).forEach(key => {
        const val = data[key];
        if (val && typeof val === 'object' && val._seconds !== undefined) {
          console.log(key + ' (Timestamp):', new Date(val._seconds * 1000).toISOString());
        } else if (typeof val === 'object' && val !== null) {
          console.log(key + ':');
          console.log(JSON.stringify(val, null, 2));
        } else {
          console.log(key + ':', val);
        }
      });

      console.log('');
      console.log('--- readBy analysis ---');
      if (hasFlat) {
        console.log('Structure: FLAT (correct)');
        const entry = readBy['ori@ghlawoffice.co.il'];
        console.log('Key: "ori@ghlawoffice.co.il"');
        console.log('Value:', JSON.stringify(entry, null, 2));
      }
      if (hasNested) {
        console.log('Structure: NESTED (broken)');
        console.log('Key: "ori@ghlawoffice"');
        console.log('Value:', JSON.stringify(readBy['ori@ghlawoffice'], null, 2));
      }

      // Show ALL readBy entries
      console.log('');
      console.log('--- ALL readBy entries ---');
      console.log('Top-level keys:', JSON.stringify(Object.keys(readBy)));
      Object.keys(readBy).forEach(key => {
        const val = readBy[key];
        if (val && typeof val === 'object' && val.displayName !== undefined) {
          const readAt = val.readAt ? (val.readAt._seconds ? new Date(val.readAt._seconds * 1000).toISOString() : val.readAt) : 'null';
          console.log('  "' + key + '" → FLAT | displayName=' + val.displayName + ' | readAt=' + readAt);
        } else if (val && typeof val === 'object') {
          console.log('  "' + key + '" → NESTED | content:', JSON.stringify(val));
        }
      });
      console.log('');
    }
  });

  if (!found) {
    console.log('NO readBy entry found for ori@ghlawoffice.co.il in any document.');
    console.log('');
    console.log('Showing readBy of ALL documents for reference:');
    snap.forEach(doc => {
      const data = doc.data();
      const readBy = data.readBy || {};
      console.log('');
      console.log('Document:', doc.id, '| active:', data.active, '| title:', data.title || '(none)');
      if (Object.keys(readBy).length === 0) {
        console.log('  readBy: EMPTY');
      } else {
        console.log('  readBy keys:', JSON.stringify(Object.keys(readBy)));
        Object.keys(readBy).forEach(key => {
          const val = readBy[key];
          if (val && typeof val === 'object' && val.displayName !== undefined) {
            console.log('    "' + key + '" → FLAT | displayName=' + val.displayName);
          } else {
            console.log('    "' + key + '" → NESTED | content:', JSON.stringify(val));
          }
        });
      }
    });
  }

  process.exit(0);
})();
