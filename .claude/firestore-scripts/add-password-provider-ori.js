const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'addpass_' + Date.now());

(async () => {
  const email = 'ori@ghlawoffice.co.il';

  // Before
  console.log('=== BEFORE ===');
  const before = await app.auth().getUserByEmail(email);
  console.log('UID:', before.uid);
  console.log('providers:', before.providerData.map(p => p.providerId));
  console.log('');

  // Add password provider
  console.log('=== Adding email/password provider ===');
  await app.auth().updateUser(before.uid, {
    password: 'law2025'
  });
  console.log('Password set.');
  console.log('');

  // After
  console.log('=== AFTER ===');
  const after = await app.auth().getUserByEmail(email);
  console.log('UID:', after.uid);
  console.log('email:', after.email);
  console.log('displayName:', after.displayName);
  console.log('emailVerified:', after.emailVerified);
  console.log('disabled:', after.disabled);
  console.log('customClaims:', JSON.stringify(after.customClaims || {}));
  console.log('providers:', after.providerData.map(p => ({
    providerId: p.providerId,
    email: p.email
  })));

  process.exit(0);
})();
