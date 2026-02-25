const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'test_readby_' + Date.now());
const db = app.firestore();

const DOC_ID = 'test_readby_check';

(async () => {
  try {
    const docRef = db.collection('system_announcements').doc(DOC_ID);

    // Step 1: Create document
    console.log('=== STEP 1: Creating document ===');
    await docRef.set({
      title: 'test',
      message: 'test',
      active: false
    });
    console.log('Created:', DOC_ID);

    // Step 2: set+merge with email key (same pattern as popup code)
    console.log('');
    console.log('=== STEP 2: set+merge with email key ===');
    await docRef.set({
      readBy: {
        'test@ghlawoffice.co.il': {
          readAt: admin.firestore.FieldValue.serverTimestamp(),
          displayName: 'test'
        }
      }
    }, { merge: true });
    console.log('set+merge executed');

    // Step 3: Read and analyze
    console.log('');
    console.log('=== STEP 3: Reading document ===');
    const snap = await docRef.get();
    const data = snap.data();
    const readBy = data.readBy;

    console.log('');
    console.log('Raw readBy object:');
    console.log(JSON.stringify(readBy, null, 2));

    console.log('');
    console.log('Top-level keys:', Object.keys(readBy));
    console.log('Number of top-level keys:', Object.keys(readBy).length);

    // Check if flat or nested
    const firstKey = Object.keys(readBy)[0];
    const firstVal = readBy[firstKey];

    if (firstKey === 'test@ghlawoffice.co.il') {
      console.log('');
      console.log('RESULT: FLAT (correct) - key is "test@ghlawoffice.co.il"');
      console.log('Value type:', typeof firstVal);
      console.log('Has displayName?', firstVal && firstVal.displayName !== undefined);
      console.log('Has readAt?', firstVal && firstVal.readAt !== undefined);
    } else {
      console.log('');
      console.log('RESULT: NESTED (broken) - key is:', JSON.stringify(firstKey));

      // Show full depth
      function showDepth(obj, indent) {
        Object.keys(obj).forEach(k => {
          const v = obj[k];
          if (v && typeof v === 'object' && !v._seconds && !(v instanceof Date)) {
            console.log(indent + k + ' → [nested object]');
            showDepth(v, indent + '  ');
          } else {
            console.log(indent + k + ' = ' + JSON.stringify(v));
          }
        });
      }
      showDepth(readBy, '  ');
    }

    // Step 4: Delete
    console.log('');
    console.log('=== STEP 4: Deleting document ===');
    await docRef.delete();
    console.log('Deleted:', DOC_ID);

  } catch (error) {
    console.error('ERROR:', error.message);

    // Cleanup on error
    try {
      await db.collection('system_announcements').doc(DOC_ID).delete();
      console.log('Cleaned up test document');
    } catch (e) {
      // ignore
    }
  }

  process.exit(0);
})();
