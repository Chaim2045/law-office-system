const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'check_readby_' + Date.now());
const db = app.firestore();

const CUTOFF = new Date('2026-02-10T09:00:00Z');

(async () => {
  const snap = await db.collection('system_announcements').get();
  console.log('Total documents:', snap.size);
  console.log('Cutoff (after commit 83530fb):', CUTOFF.toISOString());
  console.log('');

  let found = 0;

  snap.forEach(doc => {
    const data = doc.data();
    const readBy = data.readBy || {};
    const updatedAt = data.updatedAt ? new Date(data.updatedAt._seconds * 1000) : null;
    const createdAt = data.createdAt ? new Date(data.createdAt._seconds * 1000) : null;

    const hasReadBy = Object.keys(readBy).length > 0;
    const isAfterCutoff = (updatedAt && updatedAt > CUTOFF) || (createdAt && createdAt > CUTOFF);

    console.log('--- Document:', doc.id, '---');
    console.log('  title:', data.title || '(none)');
    console.log('  createdAt:', createdAt ? createdAt.toISOString() : 'null');
    console.log('  updatedAt:', updatedAt ? updatedAt.toISOString() : 'null');
    console.log('  active:', data.active);
    console.log('  hasReadBy:', hasReadBy, '| readBy keys count:', Object.keys(readBy).length);
    console.log('  isAfterCutoff:', isAfterCutoff);

    if (hasReadBy) {
      // Analyze structure
      const topKeys = Object.keys(readBy);
      console.log('  readBy top-level keys:', JSON.stringify(topKeys));

      topKeys.forEach(key => {
        const val = readBy[key];
        if (val && typeof val === 'object' && val.displayName !== undefined) {
          console.log('    "' + key + '" → FLAT (has displayName directly)');
        } else if (val && typeof val === 'object') {
          // Check if nested
          const subKeys = Object.keys(val);
          const looksNested = subKeys.some(sk => typeof val[sk] === 'object' && val[sk] !== null && !val[sk]._seconds);
          if (looksNested) {
            console.log('    "' + key + '" → NESTED (broken) - sub-keys:', JSON.stringify(subKeys));
          } else {
            console.log('    "' + key + '" → FLAT (correct) - sub-keys:', JSON.stringify(subKeys));
          }
        }
      });

      if (isAfterCutoff) {
        found++;
        console.log('  >>> THIS DOCUMENT HAS readBy AND IS AFTER CUTOFF <<<');
      }
    }

    console.log('');
  });

  console.log('========================================');
  console.log('Documents with readBy AFTER cutoff:', found);
  if (found === 0) {
    console.log('NO EVIDENCE: No documents created/updated after the fix have readBy data.');
    console.log('Cannot verify if client SDK set+merge produces flat or nested keys.');
  }

  process.exit(0);
})();
