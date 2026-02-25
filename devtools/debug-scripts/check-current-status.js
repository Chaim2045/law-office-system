/**
 * Current Status Check - Before Any Fix
 * Let's see EXACTLY what the situation is NOW
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkCurrentStatus() {
  console.log('🔍 CURRENT STATUS CHECK - BEFORE ANY FIX\n');
  console.log('═══════════════════════════════════════════════════\n');

  const users = [
    { name: 'HAIM', email: 'haim@ghlawoffice.co.il' },
    { name: 'MARVA', email: 'marva@ghlawoffice.co.il' }
  ];

  for (const user of users) {
    console.log(`\n📧 ${user.name} (${user.email})`);
    console.log('─────────────────────────────────────────────');

    try {
      const userRecord = await admin.auth().getUserByEmail(user.email);
      const providers = userRecord.providerData.map(p => p.providerId);

      console.log('✅ Auth account EXISTS');
      console.log(`UID:           ${userRecord.uid}`);
      console.log(`Providers:     [${providers.join(', ')}]`);
      console.log(`Has password:  ${providers.includes('password') ? '✅ YES' : '❌ NO'}`);
      console.log(`Has Google:    ${providers.includes('google.com') ? '✅ YES' : '❌ NO'}`);
      console.log(`Password Hash: ${userRecord.passwordHash ? '✅ EXISTS' : '❌ NOT SET'}`);
      console.log(`Last Sign-In:  ${userRecord.metadata.lastSignInTime}`);

      console.log('\n💡 Can sign in with:');
      if (providers.includes('google.com')) {
        console.log('   ✅ Google Sign-In button');
      }
      if (providers.includes('password')) {
        console.log('   ✅ Email + Password');
      }
      if (providers.length === 0 || (!providers.includes('google.com') && !providers.includes('password'))) {
        console.log('   ❌ CANNOT SIGN IN - No methods available!');
      }

    } catch (error) {
      console.log('❌ Auth account DOES NOT EXIST');
      console.log(`Error: ${error.message}`);
      console.log('\n💡 Cannot sign in at all - no Auth account');
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');

  // Check Haim
  try {
    const haim = await admin.auth().getUserByEmail('haim@ghlawoffice.co.il');
    const haimProviders = haim.providerData.map(p => p.providerId);

    console.log('HAIM:');
    if (haimProviders.includes('google.com') && !haimProviders.includes('password')) {
      console.log('  ✅ Can sign in with Google');
      console.log('  ❌ Cannot sign in with password');
      console.log('  💡 SOLUTION: Add password via "Forgot Password" or Admin SDK');
    } else if (haimProviders.includes('google.com') && haimProviders.includes('password')) {
      console.log('  ✅ Can sign in with Google');
      console.log('  ✅ Can sign in with password');
      console.log('  💡 All good!');
    }
  } catch (e) {
    console.log('HAIM: ❌ No Auth account');
  }

  console.log('');

  // Check Marva
  try {
    const marva = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');
    const marvaProviders = marva.providerData.map(p => p.providerId);

    console.log('MARVA:');
    if (marvaProviders.includes('google.com') && !marvaProviders.includes('password')) {
      console.log('  ✅ Can sign in with Google');
      console.log('  ❌ Cannot sign in with password');
      console.log('  💡 SOLUTION: Add password via "Forgot Password" or Admin SDK');
    } else if (marvaProviders.includes('google.com') && marvaProviders.includes('password')) {
      console.log('  ✅ Can sign in with Google');
      console.log('  ✅ Can sign in with password');
      console.log('  💡 All good!');
    } else if (!marvaProviders.includes('google.com') && marvaProviders.includes('password')) {
      console.log('  ✅ Can sign in with password');
      console.log('  ❌ Cannot sign in with Google (provider was removed)');
      console.log('  💡 Add Google back or use password');
    } else {
      console.log('  ❌ No sign-in methods available!');
      console.log('  💡 URGENT: Need to add password or Google');
    }
  } catch (e) {
    console.log('MARVA: ❌ No Auth account');
    console.log('  💡 URGENT: Need to create Auth account');
  }

  console.log('\n');
  process.exit(0);
}

checkCurrentStatus().catch(console.error);