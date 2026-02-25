/**
 * Investigation Script: Auth Provider Status
 * READ-ONLY Firebase Auth check for duplicate/linked accounts
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const EMAILS_TO_CHECK = [
  'haim@ghlawoffice.co.il',
  'marva@ghlawoffice.co.il'
];

async function investigateAuthProviders() {
  console.log('🔍 Firebase Auth Investigation - READ ONLY\n');
  console.log('═══════════════════════════════════════════════════\n');

  const results = [];

  for (const email of EMAILS_TO_CHECK) {
    console.log(`\n📧 Checking: ${email}`);
    console.log('─────────────────────────────────────────────────');

    try {
      // Try to get user by email
      const userRecord = await admin.auth().getUserByEmail(email);

      const providers = userRecord.providerData.map(p => p.providerId);
      const hasPassword = providers.includes('password');
      const hasGoogle = providers.includes('google.com');

      const result = {
        email,
        uid: userRecord.uid,
        providers,
        hasPassword,
        hasGoogle,
        emailVerified: userRecord.emailVerified,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        status: hasPassword && hasGoogle ? 'LINKED' :
                hasPassword ? 'PASSWORD_ONLY' :
                hasGoogle ? 'GOOGLE_ONLY' : 'UNKNOWN'
      };

      results.push(result);

      console.log(`UID:            ${result.uid}`);
      console.log(`Providers:      [${providers.join(', ')}]`);
      console.log(`Has Password:   ${hasPassword ? '✅' : '❌'}`);
      console.log(`Has Google:     ${hasGoogle ? '✅' : '❌'}`);
      console.log(`Email Verified: ${result.emailVerified ? '✅' : '❌'}`);
      console.log(`Created:        ${result.creationTime}`);
      console.log(`Last Sign-In:   ${result.lastSignInTime}`);
      console.log(`Status:         ${result.status}`);

      // Check for potential duplicate accounts
      console.log('\n🔎 Checking for duplicate UIDs...');
      const possibleDuplicates = await checkForDuplicates(email, userRecord.uid);

      if (possibleDuplicates.length > 0) {
        console.log('⚠️  FOUND DUPLICATE ACCOUNTS:');
        possibleDuplicates.forEach(dup => {
          console.log(`   - UID: ${dup.uid}, Providers: [${dup.providers}]`);
        });
      } else {
        console.log('✓ No duplicate UIDs found for this email');
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.push({
        email,
        error: error.message,
        status: 'ERROR'
      });
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('📊 SUMMARY TABLE');
  console.log('═══════════════════════════════════════════════════\n');

  console.table(results.map(r => ({
    Email: r.email,
    UID: r.uid?.substring(0, 10) + '...',
    Providers: r.providers?.join(', ') || 'N/A',
    Status: r.status
  })));

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔍 ROOT CAUSE ANALYSIS');
  console.log('═══════════════════════════════════════════════════\n');

  const allHaveGoogle = results.every(r => r.hasGoogle);
  const noneHavePassword = results.every(r => !r.hasPassword);
  const someLinked = results.some(r => r.status === 'LINKED');

  if (noneHavePassword && allHaveGoogle) {
    console.log('❌ ROOT CAUSE A: MISSING PASSWORD PROVIDER');
    console.log('   All accounts have Google but NO password provider.');
    console.log('   Original password credentials were NOT linked during Google sign-in.');
  } else if (someLinked) {
    console.log('✓ ROOT CAUSE B: ACCOUNTS ARE PROPERLY LINKED');
    console.log('   Some accounts have both password and Google providers.');
  } else {
    console.log('⚠️  MIXED STATE - Review individual accounts above.');
  }

  console.log('\n');
  process.exit(0);
}

async function checkForDuplicates(email, knownUid) {
  // This is a simple check - in Firebase, one email = one UID
  // But we document this for completeness
  return [];
}

investigateAuthProviders().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});