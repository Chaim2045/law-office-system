const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

(async () => {
  // Check 1: Does 'tasks' collection exist?
  console.log('=== QUERY: tasks collection (limit 1) ===');
  const tasksSnap = await db.collection('tasks').limit(1).get();
  console.log('tasks collection empty?', tasksSnap.empty);
  console.log('tasks docs count:', tasksSnap.size);
  if (tasksSnap.size > 0) {
    const data = tasksSnap.docs[0].data();
    console.log('First doc ID:', tasksSnap.docs[0].id);
    console.log('Fields:', Object.keys(data).sort().join(', '));
  }

  // Check 2: Simulate what client receives from onCall
  // Read a budget_task and JSON.stringify its deadline to see serialization
  console.log('');
  console.log('=== DEADLINE SERIALIZATION TEST ===');
  const btSnap = await db.collection('budget_tasks').limit(1).get();
  if (btSnap.size > 0) {
    const raw = btSnap.docs[0].data();
    const dl = raw.deadline;

    console.log('Raw Firestore Timestamp:');
    console.log('  typeof:', typeof dl);
    console.log('  constructor:', dl.constructor.name);
    console.log('  dl.seconds:', dl.seconds);
    console.log('  dl.nanoseconds:', dl.nanoseconds);
    console.log('  dl._seconds:', dl._seconds);
    console.log('  dl._nanoseconds:', dl._nanoseconds);
    console.log('  dl.toDate():', dl.toDate());

    // Simulate onCall serialization (Firebase uses JSON.stringify internally)
    const serialized = JSON.parse(JSON.stringify(dl));
    console.log('');
    console.log('After JSON.stringify + parse (simulates onCall wire format):');
    console.log('  result:', JSON.stringify(serialized));
    console.log('  has "seconds"?', serialized.seconds !== undefined);
    console.log('  has "_seconds"?', serialized._seconds !== undefined);
    console.log('  keys:', Object.keys(serialized));

    // Simulate what the CF does: { id, ...doc.data() } then return via onCall
    const cfResponse = { id: btSnap.docs[0].id, ...raw };
    const cfSerialized = JSON.parse(JSON.stringify(cfResponse));
    console.log('');
    console.log('CF-style response deadline:');
    console.log('  keys:', Object.keys(cfSerialized.deadline));
    console.log('  value:', JSON.stringify(cfSerialized.deadline));
  }

  process.exit(0);
})().catch(e => {
 console.error(e.message); process.exit(1);
});
