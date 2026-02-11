const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'checkbj5m_' + Date.now());
const db = app.firestore();

(async () => {
  // Task 2: Check BJ5M6q0pFPsfA1asNB0m readBy field existence
  console.log('=== TASK 2: Document BJ5M6q0pFPsfA1asNB0m ===');
  const docRef = db.collection('system_announcements').doc('BJ5M6q0pFPsfA1asNB0m');
  const snap = await docRef.get();

  if (!snap.exists) {
    console.log('Document does NOT exist!');
    process.exit(1);
  }

  const data = snap.data();

  // Check if readBy field exists at all
  const hasReadByField = 'readBy' in data;
  console.log('Has readBy field:', hasReadByField);

  if (hasReadByField) {
    const readBy = data.readBy;
    console.log('readBy value:', JSON.stringify(readBy));
    console.log('readBy type:', typeof readBy);
    console.log('readBy is null:', readBy === null);
    console.log('readBy keys:', readBy ? Object.keys(readBy) : 'N/A');
    console.log('readBy keys count:', readBy ? Object.keys(readBy).length : 'N/A');
  } else {
    console.log('readBy field DOES NOT EXIST on this document');
  }

  console.log('');
  console.log('All fields present:');
  Object.keys(data).forEach(key => {
    const val = data[key];
    const type = val === null ? 'null' :
      val && val._seconds !== undefined ? 'Timestamp' :
      Array.isArray(val) ? 'Array' :
      typeof val === 'object' ? 'Object' : typeof val;
    const display = type === 'Timestamp' ? new Date(val._seconds * 1000).toISOString() :
      type === 'Object' ? JSON.stringify(val) :
      type === 'Array' ? JSON.stringify(val) :
      String(val);
    console.log('  ' + key + ' (' + type + '):', display);
  });

  // Task 6: ori custom claims
  console.log('');
  console.log('=== TASK 6: ori custom claims ===');
  const oriUser = await app.auth().getUserByEmail('ori@ghlawoffice.co.il');
  console.log('UID:', oriUser.uid);
  console.log('customClaims:', JSON.stringify(oriUser.customClaims));
  console.log('request.auth.token.role would be:', oriUser.customClaims ? oriUser.customClaims.role : 'undefined');

  process.exit(0);
})();
