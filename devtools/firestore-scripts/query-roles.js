const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'roles_' + Date.now());
const db = app.firestore();

(async () => {
  const snap = await db.collection('employees').get();
  const roles = {};
  snap.forEach(doc => {
    const r = doc.data().role || '(undefined)';
    if (!roles[r]) {
roles[r] = [];
}
    roles[r].push(doc.id);
  });
  console.log('Unique roles found:', Object.keys(roles).length);
  Object.keys(roles).forEach(r => {
    console.log('');
    console.log('Role:', JSON.stringify(r));
    console.log('  Count:', roles[r].length);
    console.log('  Employees:', roles[r].join(', '));
  });
  process.exit(0);
})();
