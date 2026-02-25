const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkMarvaProviders() {
  try {
    console.log('\n=== בדיקת Providers של marva ===\n');

    const userRecord = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');

    console.log('📧 Email: marva@ghlawoffice.co.il');
    console.log(`🆔 UID: ${userRecord.uid}`);
    console.log('\n🔐 Providers:');

    userRecord.providerData.forEach((provider, index) => {
      console.log(`   ${index + 1}. ${provider.providerId}`);
      console.log(`      - UID: ${provider.uid}`);
      console.log(`      - Email: ${provider.email}`);
    });

    console.log(`\n✅ Password Hash: ${userRecord.passwordHash ? 'EXISTS' : 'NOT SET'}`);
    console.log(`✅ Email Verified: ${userRecord.emailVerified}`);
    console.log(`✅ Disabled: ${userRecord.disabled}`);

    console.log(`\n📅 Created: ${userRecord.metadata.creationTime}`);
    console.log(`📅 Last Sign-In: ${userRecord.metadata.lastSignInTime}`);
    console.log(`📅 Last Refresh: ${userRecord.metadata.lastRefreshTime || 'N/A'}`);

    // Check if this is the CURRENT UID or an OLD one
    const providers = userRecord.providerData.map(p => p.providerId);
    console.log('\n🎯 סיכום:');
    console.log(`   Password provider: ${providers.includes('password') ? '✅ YES' : '❌ NO'}`);
    console.log(`   Google provider: ${providers.includes('google.com') ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkMarvaProviders();
