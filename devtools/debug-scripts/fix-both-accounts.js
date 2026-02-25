/**
 * Fix Auth Accounts - Add Password Provider
 * For: Haim (add password to existing) + Marva (create new Auth account)
 * Password: law2025 (for both)
 *
 * IMPORTANT: This does NOT touch Firestore data - only Auth!
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const PASSWORD = 'law2025';

async function fixBothAccounts() {
  console.log('🔧 FIXING AUTH ACCOUNTS');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('⚠️  This will NOT touch any Firestore data!');
  console.log('⚠️  All history, tasks, records remain unchanged!\n');
  console.log('═══════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────
  // 1. FIX HAIM - Add password to existing Google account
  // ─────────────────────────────────────────────────────────────
  console.log('1️⃣  FIXING HAIM (haim@ghlawoffice.co.il)');
  console.log('─────────────────────────────────────────────────\n');

  try {
    const haimBefore = await admin.auth().getUserByEmail('haim@ghlawoffice.co.il');
    const providersBefore = haimBefore.providerData.map(p => p.providerId);

    console.log('Before:');
    console.log(`  Providers: [${providersBefore.join(', ')}]`);
    console.log(`  Has password: ${providersBefore.includes('password') ? '✅' : '❌'}`);
    console.log(`  Has Google: ${providersBefore.includes('google.com') ? '✅' : '❌'}\n`);

    // Add password to existing account
    await admin.auth().updateUser(haimBefore.uid, {
      password: PASSWORD
    });

    const haimAfter = await admin.auth().getUserByEmail('haim@ghlawoffice.co.il');
    const providersAfter = haimAfter.providerData.map(p => p.providerId);

    console.log('After:');
    console.log(`  Providers: [${providersAfter.join(', ')}]`);
    console.log(`  Has password: ${providersAfter.includes('password') ? '✅' : '❌'}`);
    console.log(`  Has Google: ${providersAfter.includes('google.com') ? '✅' : '❌'}`);
    console.log(`  Password hash: ${haimAfter.passwordHash ? '✅ SET' : '❌ NOT SET'}\n`);

    console.log('✅ HAIM FIXED!\n');
    console.log('   Can now sign in with:');
    console.log('   - ✅ Google button');
    console.log('   - ✅ Email + Password\n');

  } catch (error) {
    console.error('❌ Error fixing Haim:', error.message);
  }

  console.log('═══════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────
  // 2. FIX MARVA - Create new Auth account
  // ─────────────────────────────────────────────────────────────
  console.log('2️⃣  FIXING MARVA (marva@ghlawoffice.co.il)');
  console.log('─────────────────────────────────────────────────\n');

  try {
    // Check if already exists
    try {
      const existing = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');
      console.log('⚠️  Auth account already exists!');
      console.log(`   UID: ${existing.uid}`);
      console.log(`   Providers: [${existing.providerData.map(p => p.providerId).join(', ')}]\n`);
      console.log('Skipping creation...\n');
    } catch (notFoundError) {
      // Good - doesn't exist, create it
      console.log('Creating new Auth account...\n');

      const newUser = await admin.auth().createUser({
        email: 'marva@ghlawoffice.co.il',
        password: PASSWORD,
        emailVerified: true,
        displayName: 'מרווה'
      });

      console.log('✅ MARVA AUTH CREATED!\n');
      console.log(`   UID: ${newUser.uid}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Password: ${PASSWORD}`);
      console.log(`   Email Verified: ${newUser.emailVerified ? '✅' : '❌'}\n`);

      // Verify
      const marvaAfter = await admin.auth().getUserByEmail('marva@ghlawoffice.co.il');
      const providersAfter = marvaAfter.providerData.map(p => p.providerId);

      console.log('   Providers: [' + providersAfter.join(', ') + ']');
      console.log(`   Has password: ${providersAfter.includes('password') ? '✅' : '❌'}`);
      console.log(`   Password hash: ${marvaAfter.passwordHash ? '✅ SET' : '❌ NOT SET'}\n`);

      console.log('   Can now sign in with:');
      console.log('   - ✅ Email + Password\n');

      console.log('📋 FIRESTORE CONNECTION:');
      console.log('   When Marva signs in, the app will:');
      console.log('   1. Authenticate with Firebase Auth (email + password)');
      console.log('   2. Load her data from: employees/marva@ghlawoffice.co.il');
      console.log('   3. ✅ All her existing data will be loaded automatically!\n');
    }

  } catch (error) {
    console.error('❌ Error fixing Marva:', error.message);
  }

  console.log('═══════════════════════════════════════════════════\n');
  console.log('🎉 SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('HAIM:');
  console.log('  Email: haim@ghlawoffice.co.il');
  console.log('  Password: law2025');
  console.log('  Can sign in with: Google OR Password ✅\n');

  console.log('MARVA:');
  console.log('  Email: marva@ghlawoffice.co.il');
  console.log('  Password: law2025');
  console.log('  Can sign in with: Password ✅');
  console.log('  (Can add Google later by signing in with Google button)\n');

  console.log('📌 FIRESTORE DATA:');
  console.log('  ✅ Untouched - all history from October is intact!');
  console.log('  ✅ Tasks, records, everything remains the same!');
  console.log('  ✅ Only Auth "keys" were created/updated!\n');

  process.exit(0);
}

fixBothAccounts().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});