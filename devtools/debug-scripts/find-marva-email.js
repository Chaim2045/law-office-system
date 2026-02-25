/**
 * Find Marva - Check all Auth accounts to find her Google email
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function findMarva() {
  console.log('🔍 Searching for Marva in Firebase Auth\n');
  console.log('Looking for: marva, מרווה, or similar names\n');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // List all users
    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users;

    console.log(`Total Auth users found: ${users.length}\n`);

    let marvaFound = false;

    // Search for marva
    users.forEach((user, index) => {
      const email = user.email?.toLowerCase() || '';
      const displayName = user.displayName?.toLowerCase() || '';
      const uid = user.uid;

      // Check if this could be Marva
      if (email.includes('marva') || email.includes('marwa') ||
          displayName.includes('marva') || displayName.includes('marwa') ||
          displayName.includes('מרווה')) {

        marvaFound = true;
        const providers = user.providerData.map(p => p.providerId);

        console.log('🎯 POTENTIAL MATCH FOUND!');
        console.log('─────────────────────────────────────────────');
        console.log(`Email:         ${user.email}`);
        console.log(`Display Name:  ${user.displayName || 'N/A'}`);
        console.log(`UID:           ${uid}`);
        console.log(`Providers:     [${providers.join(', ')}]`);
        console.log(`Has password:  ${providers.includes('password') ? '✅' : '❌'}`);
        console.log(`Has Google:    ${providers.includes('google.com') ? '✅' : '❌'}`);
        console.log(`Created:       ${user.metadata.creationTime}`);
        console.log(`Last Sign-In:  ${user.metadata.lastSignInTime}`);
        console.log('─────────────────────────────────────────────\n');
      }
    });

    if (!marvaFound) {
      console.log('❌ No user found with "marva" in email or name\n');
      console.log('📋 Let\'s check all ghlawoffice.co.il users:\n');

      users.forEach(user => {
        const email = user.email?.toLowerCase() || '';
        if (email.includes('ghlawoffice.co.il')) {
          const providers = user.providerData.map(p => p.providerId);
          console.log(`📧 ${user.email}`);
          console.log(`   Display Name: ${user.displayName || 'N/A'}`);
          console.log(`   Providers: [${providers.join(', ')}]`);
          console.log(`   Last Sign-In: ${user.metadata.lastSignInTime}\n`);
        }
      });
    }

    // Also check recent sign-ins (last 24 hours)
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📅 Recent Sign-Ins (Last 24 hours)');
    console.log('═══════════════════════════════════════════════════\n');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    users.forEach(user => {
      const lastSignIn = new Date(user.metadata.lastSignInTime);
      if (lastSignIn > yesterday) {
        const providers = user.providerData.map(p => p.providerId);
        console.log(`✅ ${user.email || 'No email'}`);
        console.log(`   Display Name: ${user.displayName || 'N/A'}`);
        console.log(`   Last Sign-In: ${user.metadata.lastSignInTime}`);
        console.log(`   Providers: [${providers.join(', ')}]\n`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

findMarva().catch(console.error);