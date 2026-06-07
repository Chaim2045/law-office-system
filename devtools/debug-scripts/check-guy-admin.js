/**
 * Check Guy's admin status in Firestore
 * בדיקת סטטוס מנהל של גיא ב-Firestore
 *
 * Run from functions directory:
 * cd functions && node ../.scripts/check-guy-admin.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (will use Application Default Credentials)
try {
  admin.initializeApp();
} catch (e) {
  // Already initialized
  console.log('Firebase already initialized');
}

const db = admin.firestore();
const auth = admin.auth();

async function checkGuyAdminStatus() {
  try {
    console.log('🔍 Checking Guy\'s admin status...\n');

    const guyEmail = 'guy@ghlawoffice.co.il';

    // 1. Check Firestore employees collection
    console.log('📊 Checking Firestore employees collection:');
    const employeeDoc = await db.collection('employees').doc(guyEmail).get();

    if (employeeDoc.exists) {
      const data = employeeDoc.data();
      console.log('✅ Found in employees collection:');
      console.log('   Email:', guyEmail);
      console.log('   Role:', data.role);
      console.log('   Display Name:', data.displayName);
      console.log('   Auth UID:', data.authUID);
      console.log('   Is Active:', data.isActive);
      console.log('   Username:', data.username);

      // 2. Check Firebase Auth Custom Claims
      if (data.authUID) {
        console.log('\n🔐 Checking Firebase Auth Custom Claims:');
        try {
          const userRecord = await auth.getUser(data.authUID);
          console.log('✅ Found in Firebase Auth:');
          console.log('   Email:', userRecord.email);
          console.log('   Email Verified:', userRecord.emailVerified);
          console.log('   Disabled:', userRecord.disabled);
          console.log('   Custom Claims:', JSON.stringify(userRecord.customClaims, null, 2));

          // 3. Analysis
          console.log('\n📋 Analysis:');
          // Pre-H.0.0.E follow-up: admin acceptance is role-only (custom-claim
          // role === 'admin') OR the admin-panel Firestore fallback (Layer 3).
          // The legacy `claims.admin === true` acceptance was retired everywhere.
          const hasCustomClaimRole = userRecord.customClaims?.role === 'admin';
          const hasFirestoreRole = data.role === 'admin';

          console.log('   ✓ Custom Claims role === "admin":', hasCustomClaimRole);
          console.log('   ✓ Firestore role === "admin":', hasFirestoreRole);

          if (hasCustomClaimRole || hasFirestoreRole) {
            console.log('\n✅ Guy SHOULD be able to login as admin!');

            if (!hasCustomClaimRole) {
              console.log('\n⚠️  WARNING: Custom Claims not set!');
              console.log('   Guy can login via Firestore fallback, but it\'s slower.');
              console.log('   Run this to fix:');
              console.log('   node .scripts/set-guy-custom-claims.js');
            }
          } else {
            console.log('\n❌ Guy CANNOT login as admin!');
            console.log('   Fix needed: Update role to "admin" in Firestore or Custom Claims');
          }
        } catch (authError) {
          console.log('❌ Error fetching from Firebase Auth:', authError.message);
        }
      } else {
        console.log('\n⚠️  No authUID found in Firestore!');
        console.log('   This user might not have a Firebase Auth account.');
      }
    } else {
      console.log('❌ Guy not found in employees collection!');
      console.log('   Email searched:', guyEmail);
      console.log('\n   Guy needs to be created as a user first.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkGuyAdminStatus();
