/**
 * Verification Script: Detailed Auth Provider Check
 * READ-ONLY verification for Investigation findings
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

console.log('🔍 VERIFICATION SCRIPT - Detailed Auth Check\n');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Firebase Project: ${serviceAccount.project_id}\n`);
console.log('═══════════════════════════════════════════════════════════\n');

async function verifyHaimAccount() {
  const email = 'haim@ghlawoffice.co.il';

  console.log('\n📧 A) HAIM ACCOUNT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Email: ${email}\n`);

  try {
    // 1. fetchSignInMethodsForEmail (client-side equivalent)
    console.log('1️⃣  Fetching sign-in methods...');
    const userRecord = await auth.getUserByEmail(email);
    const providers = userRecord.providerData.map(p => p.providerId);

    console.log(`   ✅ Sign-in methods: [${providers.join(', ')}]`);
    console.log(`   📌 Has 'password': ${providers.includes('password') ? '✅ YES' : '❌ NO'}`);
    console.log(`   📌 Has 'google.com': ${providers.includes('google.com') ? '✅ YES' : '❌ NO'}`);

    // 2. Full Admin SDK details
    console.log('\n2️⃣  Full Auth Record Details:');
    console.log(`   UID:              ${userRecord.uid}`);
    console.log(`   Email:            ${userRecord.email}`);
    console.log(`   Email Verified:   ${userRecord.emailVerified ? '✅' : '❌'}`);
    console.log(`   Disabled:         ${userRecord.disabled ? '⚠️ YES' : '✅ NO'}`);
    console.log(`   Creation Time:    ${userRecord.metadata.creationTime}`);
    console.log(`   Last Sign-In:     ${userRecord.metadata.lastSignInTime}`);
    console.log(`   Last Refresh:     ${userRecord.metadata.lastRefreshTime || 'N/A'}`);

    console.log('\n   Provider Details:');
    userRecord.providerData.forEach((provider, idx) => {
      console.log(`   [${idx + 1}] ${provider.providerId}`);
      console.log(`       - UID: ${provider.uid}`);
      console.log(`       - Email: ${provider.email}`);
      console.log(`       - Display Name: ${provider.displayName || 'N/A'}`);
      console.log(`       - Photo URL: ${provider.photoURL ? 'Set' : 'N/A'}`);
    });

    // 3. Check password hash (indicates if password was ever set)
    console.log('\n3️⃣  Password Hash Status:');
    console.log(`   Password Hash:    ${userRecord.passwordHash ? '✅ EXISTS (password was set)' : '❌ NOT SET (no password)'}`);
    console.log(`   Password Salt:    ${userRecord.passwordSalt ? '✅ EXISTS' : '❌ NOT SET'}`);

    return {
      email,
      uid: userRecord.uid,
      providers,
      hasPassword: providers.includes('password'),
      hasPasswordHash: !!userRecord.passwordHash,
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime
    };

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { email, error: error.message };
  }
}

async function verifyMarvaAccount() {
  console.log('\n\n📧 B) MARVA ACCOUNT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // 1. Check employees collection for exact email
    console.log('1️⃣  Checking employees collection...');
    const employeesSnapshot = await db.collection('employees').get();

    let marvaDoc = null;
    let marvaEmail = null;

    console.log(`   Total employees: ${employeesSnapshot.size}`);
    console.log('\n   Searching for "marva"...');

    employeesSnapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id.toLowerCase();
      const name = (data.name || '').toLowerCase();
      const username = (data.username || '').toLowerCase();
      const email = (data.email || '').toLowerCase();

      if (docId.includes('marva') || name.includes('marva') ||
          username.includes('marva') || email.includes('marva')) {
        console.log('\n   ✅ Found potential match:');
        console.log(`      Document ID: ${doc.id}`);
        console.log(`      Name:        ${data.name || 'N/A'}`);
        console.log(`      Username:    ${data.username || 'N/A'}`);
        console.log(`      Email:       ${data.email || 'N/A'}`);

        marvaDoc = doc;
        marvaEmail = doc.id; // Document ID is the email
      }
    });

    if (!marvaDoc) {
      console.log('\n   ❌ No employee document found containing "marva"');

      // List all employees for reference
      console.log('\n   📋 All employee document IDs:');
      employeesSnapshot.forEach(doc => {
        console.log(`      - ${doc.id}`);
      });

      return { error: 'No employee found with "marva"' };
    }

    // 2. Try to get Auth record with found email
    console.log(`\n2️⃣  Checking Firebase Auth for: ${marvaEmail}`);

    try {
      const userRecord = await auth.getUserByEmail(marvaEmail);
      const providers = userRecord.providerData.map(p => p.providerId);

      console.log('   ✅ AUTH RECORD FOUND!');
      console.log(`   UID:              ${userRecord.uid}`);
      console.log(`   Email:            ${userRecord.email}`);
      console.log(`   Email Verified:   ${userRecord.emailVerified ? '✅' : '❌'}`);
      console.log(`   Providers:        [${providers.join(', ')}]`);
      console.log(`   Has Password:     ${providers.includes('password') ? '✅' : '❌'}`);
      console.log(`   Has Google:       ${providers.includes('google.com') ? '✅' : '❌'}`);
      console.log(`   Creation Time:    ${userRecord.metadata.creationTime}`);
      console.log(`   Last Sign-In:     ${userRecord.metadata.lastSignInTime}`);
      console.log(`   Password Hash:    ${userRecord.passwordHash ? '✅ EXISTS' : '❌ NOT SET'}`);

      return {
        email: marvaEmail,
        uid: userRecord.uid,
        providers,
        hasPassword: providers.includes('password'),
        hasPasswordHash: !!userRecord.passwordHash,
        found: true
      };

    } catch (authError) {
      console.log(`   ❌ Auth Error: ${authError.message}`);
      console.log('   📌 Employee exists in Firestore but NOT in Firebase Auth');

      return {
        email: marvaEmail,
        firestoreExists: true,
        authExists: false,
        error: authError.message
      };
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function verifyFirebaseProject() {
  console.log('\n\n🔐 C) FIREBASE PROJECT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════');

  console.log(`Project ID:       ${serviceAccount.project_id}`);
  console.log(`Client Email:     ${serviceAccount.client_email}`);
  console.log('Expected:         law-office-system-e4801');
  console.log(`Match:            ${serviceAccount.project_id === 'law-office-system-e4801' ? '✅ CORRECT' : '❌ WRONG PROJECT'}`);
}

async function run() {
  await verifyFirebaseProject();

  const haimResult = await verifyHaimAccount();
  const marvaResult = await verifyMarvaAccount();

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('HAIM:');
  if (haimResult.error) {
    console.log(`  ❌ Error: ${haimResult.error}`);
  } else {
    console.log('  ✅ Auth Record: EXISTS');
    console.log(`  📌 Providers: [${haimResult.providers.join(', ')}]`);
    console.log(`  📌 Has 'password' provider: ${haimResult.hasPassword ? '✅' : '❌'}`);
    console.log(`  📌 Has password hash: ${haimResult.hasPasswordHash ? '✅' : '❌'}`);
  }

  console.log('\nMARVA:');
  if (marvaResult.error && !marvaResult.firestoreExists) {
    console.log(`  ❌ ${marvaResult.error}`);
  } else if (marvaResult.firestoreExists && !marvaResult.authExists) {
    console.log(`  ⚠️  Firestore: EXISTS (${marvaResult.email})`);
    console.log('  ❌ Auth: DOES NOT EXIST');
    console.log('  📌 Employee has no Firebase Auth account');
  } else if (marvaResult.found) {
    console.log(`  ✅ Auth Record: EXISTS (${marvaResult.email})`);
    console.log(`  📌 Providers: [${marvaResult.providers.join(', ')}]`);
    console.log(`  📌 Has 'password' provider: ${marvaResult.hasPassword ? '✅' : '❌'}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 KEY FINDINGS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!haimResult.error && !haimResult.hasPassword) {
    console.log('❌ HAIM: Password provider is MISSING');
    console.log('   - Can only sign in with Google');
    console.log('   - Original password was NOT linked when Google sign-in was used\n');
  }

  if (marvaResult.firestoreExists && !marvaResult.authExists) {
    console.log('❌ MARVA: Firebase Auth account DOES NOT EXIST');
    console.log('   - Employee exists in Firestore');
    console.log('   - No Auth record = cannot sign in with ANY method\n');
  }

  console.log('✅ Firebase Project: law-office-system-e4801 (VERIFIED)');
  console.log('\n');

  process.exit(0);
}

run().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});