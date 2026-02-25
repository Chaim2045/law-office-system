const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'auth_' + Date.now());

(async () => {
  // Task 1: ori's auth record
  console.log('=== TASK 1: ori@ghlawoffice.co.il Auth Record ===');
  try {
    const oriUser = await app.auth().getUserByEmail('ori@ghlawoffice.co.il');
    console.log('UID:', oriUser.uid);
    console.log('email:', oriUser.email);
    console.log('emailVerified:', oriUser.emailVerified);
    console.log('displayName:', oriUser.displayName);
    console.log('disabled:', oriUser.disabled);
    console.log('providers:', oriUser.providerData.map(p => ({
      providerId: p.providerId,
      email: p.email,
      displayName: p.displayName
    })));
    console.log('customClaims:', JSON.stringify(oriUser.customClaims || {}));
    console.log('metadata.creationTime:', oriUser.metadata.creationTime);
    console.log('metadata.lastSignInTime:', oriUser.metadata.lastSignInTime);
  } catch (err) {
    console.log('ERROR:', err.message);
  }
  console.log('');

  // Task 3: All users in Firebase Auth
  console.log('=== TASK 3: All Firebase Auth Users ===');
  const listResult = await app.auth().listUsers(100);
  console.log('Total users:', listResult.users.length);
  console.log('');

  listResult.users.forEach(user => {
    const providers = user.providerData.map(p => p.providerId);
    const authMethod = providers.includes('google.com') ? 'GOOGLE' :
                       providers.includes('password') ? 'EMAIL/PASS' :
                       providers.join(',');
    console.log('Email:', user.email);
    console.log('  UID:', user.uid);
    console.log('  displayName:', user.displayName || '(none)');
    console.log('  emailVerified:', user.emailVerified);
    console.log('  disabled:', user.disabled);
    console.log('  providers:', JSON.stringify(providers));
    console.log('  authMethod:', authMethod);
    console.log('  customClaims:', JSON.stringify(user.customClaims || {}));
    console.log('  lastSignIn:', user.metadata.lastSignInTime);
    console.log('');
  });

  process.exit(0);
})();
