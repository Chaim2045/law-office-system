const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminClaims() {
  const adminEmails = [
    'haim@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
  ];

  for (const email of adminEmails) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, {
        role: 'admin',
        email: email  // ✅ Add email to Custom Claims for Cloud Functions
      });
      console.log(`✅ Set admin claims for: ${email}`);
    } catch (error) {
      console.error(`❌ Error setting claims for ${email}:`, error.message);
    }
  }

  console.log('\n🎉 Done! Admin claims set successfully.');
  process.exit(0);
}

setAdminClaims();
