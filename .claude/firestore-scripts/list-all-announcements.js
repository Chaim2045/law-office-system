const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'listall_' + Date.now());
const db = app.firestore();

(async () => {
  console.log('=== All system_announcements documents ===');
  const snap = await db.collection('system_announcements').get();
  console.log('Total documents:', snap.size);
  console.log('');

  snap.forEach(doc => {
    const data = doc.data();
    console.log('--- Document:', doc.id, '---');
    console.log('  title:', data.title || '(none)');
    console.log('  active:', data.active);
    console.log('  targetAudience:', data.targetAudience);
    console.log('  requireReadConfirmation:', data.requireReadConfirmation);

    const readBy = data.readBy;
    if (!readBy) {
      console.log('  readBy: FIELD MISSING');
    } else if (Object.keys(readBy).length === 0) {
      console.log('  readBy: EMPTY {}');
    } else {
      console.log('  readBy keys:', JSON.stringify(Object.keys(readBy)));
    }
    console.log('');
  });

  // Also check ori's claims
  console.log('=== ori custom claims ===');
  const oriUser = await app.auth().getUserByEmail('ori@ghlawoffice.co.il');
  console.log('UID:', oriUser.uid);
  console.log('customClaims:', JSON.stringify(oriUser.customClaims));

  process.exit(0);
})();
