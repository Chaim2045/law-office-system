/**
 * Quick check: Marva's current Auth status
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkMarva() {
  console.log('🔍 Checking Marva NOW (after Google sign-in)\n');

  try {
    const userRecord = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');
    const providers = userRecord.providerData.map(p => p.providerId);

    console.log('✅ MARVA AUTH FOUND!');
    console.log(`UID:           ${userRecord.uid}`);
    console.log(`Email:         ${userRecord.email}`);
    console.log(`Providers:     [${providers.join(', ')}]`);
    console.log(`Has password:  ${providers.includes('password') ? '✅' : '❌'}`);
    console.log(`Has Google:    ${providers.includes('google.com') ? '✅' : '❌'}`);
    console.log(`Password Hash: ${userRecord.passwordHash ? '✅ EXISTS' : '❌ NOT SET'}`);
    console.log(`Created:       ${userRecord.metadata.creationTime}`);
    console.log(`Last Sign-In:  ${userRecord.metadata.lastSignInTime}`);

    console.log('\n📌 CONCLUSION:');
    if (!providers.includes('password') && providers.includes('google.com')) {
      console.log('❌ SAME PROBLEM AS HAIM!');
      console.log('   - Marva clicked Google button');
      console.log('   - Password provider was REMOVED');
      console.log('   - Now can ONLY sign in with Google');
    }

  } catch (error) {
    console.log('❌ Still no Auth record for marva@ghlawoffice.co.il');
    console.log(`Error: ${error.message}`);
    console.log('\n💡 Maybe she used a DIFFERENT email for Google?');
    console.log('   Ask her: What email did you use for Google sign-in?');
  }

  process.exit(0);
}

checkMarva().catch(console.error);