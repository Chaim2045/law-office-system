const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'cleanup_' + Date.now());
const db = app.firestore();

(async () => {
  // Step 1: Delete test document
  console.log('=== STEP 1: Delete test document ===');
  await db.collection('system_announcements').doc('test_client_sdk_readby').delete();
  console.log('Deleted: test_client_sdk_readby');

  // Step 2: Remove broken readBy from both documents
  console.log('');
  console.log('=== STEP 2: Remove broken readBy ===');

  const doc1 = '3ahDdpMXMCijonsRckRq';
  const doc2 = 'iNuFfC6rcCOfhgLTfjSy';

  await db.collection('system_announcements').doc(doc1).update({
    readBy: admin.firestore.FieldValue.delete()
  });
  console.log('Removed readBy from:', doc1);

  await db.collection('system_announcements').doc(doc2).update({
    readBy: admin.firestore.FieldValue.delete()
  });
  console.log('Removed readBy from:', doc2);

  // Step 3: Verify
  console.log('');
  console.log('=== STEP 3: Verification ===');

  const snap1 = await db.collection('system_announcements').doc(doc1).get();
  const data1 = snap1.data();
  console.log('');
  console.log('Document:', doc1);
  console.log('  title:', data1.title);
  console.log('  active:', data1.active);
  console.log('  hasReadBy:', data1.readBy !== undefined);
  console.log('  readBy value:', data1.readBy === undefined ? 'FIELD DOES NOT EXIST (correct)' : JSON.stringify(data1.readBy));

  const snap2 = await db.collection('system_announcements').doc(doc2).get();
  const data2 = snap2.data();
  console.log('');
  console.log('Document:', doc2);
  console.log('  title:', data2.title);
  console.log('  active:', data2.active);
  console.log('  hasReadBy:', data2.readBy !== undefined);
  console.log('  readBy value:', data2.readBy === undefined ? 'FIELD DOES NOT EXIST (correct)' : JSON.stringify(data2.readBy));

  // Verify test doc is gone
  const snapTest = await db.collection('system_announcements').doc('test_client_sdk_readby').get();
  console.log('');
  console.log('test_client_sdk_readby exists:', snapTest.exists);

  process.exit(0);
})();
