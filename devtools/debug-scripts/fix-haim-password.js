/**
 * Emergency Fix: Add password provider back to Haim's account
 * READ THIS: This will give you a TEMPORARY password
 * You MUST change it immediately after logging in!
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function fixHaimAccount() {
  const email = 'haim@ghlawoffice.co.il';
  const tempPassword = 'TempPass123!'; // ⚠️ CHANGE THIS AFTER LOGIN!

  console.log('🔧 Emergency Fix: Adding password provider to Haim\n');

  try {
    // Get current user
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${userRecord.email}`);
    console.log(`UID: ${userRecord.uid}\n`);

    // Add password provider
    console.log('⚙️  Adding password provider...');
    await admin.auth().updateUser(userRecord.uid, {
      password: tempPassword
    });

    console.log('✅ PASSWORD ADDED!\n');

    // Verify
    const updated = await admin.auth().getUserByEmail(email);
    const providers = updated.providerData.map(p => p.providerId);
    console.log(`Updated providers: [${providers.join(', ')}]`);
    console.log(`Has password: ${providers.includes('password') ? '✅' : '❌'}`);
    console.log(`Password hash: ${updated.passwordHash ? '✅ SET' : '❌ NOT SET'}\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 SUCCESS!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${tempPassword}`);
    console.log('\n⚠️  IMPORTANT: Change this password IMMEDIATELY after login!');
    console.log('   Go to: Profile → Change Password\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

fixHaimAccount().catch(console.error);