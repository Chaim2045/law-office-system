/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔐 SET ADMIN CUSTOM CLAIMS - Firebase Auth Security Enhancement
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📅 Created: 2025-01-17
 * 🎯 Purpose: Set Firebase Auth Custom Claims for admin users
 * 🔧 Usage: node set-admin-claims.js
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔧 WHAT THIS SCRIPT DOES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. Connects to Firebase Admin SDK (requires service account JSON)
 * 2. Iterates through predefined admin emails
 * 3. Sets custom claims { admin: true, role: 'admin' } for each user
 * 4. Verifies and reports success/failure for each user
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🎯 WHY THIS IS NEEDED:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🚨 Security Problem:
 * - Hardcoded emails in Firestore rules are NOT secure or scalable
 * - Firestore rules check happens on every read/write (performance impact)
 * - Email changes require manual rule updates (error-prone)
 *
 * ✅ Custom Claims Solution:
 * - Stored in Firebase Auth ID token (verified by Firebase)
 * - Automatically available in Firestore rules as request.auth.token.role
 * - Industry standard for role-based access control (RBAC)
 * - Scalable and maintainable
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 📊 IMPACT ON SYSTEM:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Security Benefits:
 * ✅ Centralized role management (add/remove admins without code changes)
 * ✅ Token-based verification (cannot be spoofed by client)
 * ✅ Works seamlessly with Firestore security rules
 * ✅ Supports Firebase Auth best practices
 *
 * User Impact:
 * ⚠️  Users MUST sign out and sign in again after running this script
 * ⚠️  Custom claims are cached in the ID token (refreshes on re-auth)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 📋 PREREQUISITES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. Firebase Admin SDK service account JSON file:
 *    - Download from Firebase Console > Project Settings > Service Accounts
 *    - Save as: law-office-system-e4801-firebase-adminsdk-xxxxx.json
 *    - Place in project root
 *
 * 2. Node.js packages:
 *    npm install firebase-admin
 *
 * 3. Admin privileges on Firebase project
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔒 SECURITY NOTES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️  CRITICAL: Service account JSON contains admin credentials
 *    - NEVER commit to Git
 *    - Add to .gitignore
 *    - Store securely (encrypted storage, secrets manager)
 *    - Rotate keys periodically
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

// Try to load service account (with error handling)
let serviceAccount;
try {
    // Try primary service account name
    serviceAccount = require('./law-office-system-e4801-firebase-adminsdk-service-account.json');
} catch (error) {
    console.error('❌ ERROR: Could not find service account JSON file!');
    console.error('');
    console.error('📝 To fix this:');
    console.error('   1. Go to Firebase Console > Project Settings > Service Accounts');
    console.error('   2. Click "Generate New Private Key"');
    console.error('   3. Save the file in the project root directory');
    console.error('   4. Rename to: law-office-system-e4801-firebase-adminsdk-service-account.json');
    console.error('');
    console.error('⚠️  SECURITY WARNING:');
    console.error('   - Do NOT commit this file to Git');
    console.error('   - Add *-firebase-adminsdk-*.json to .gitignore');
    console.error('');
    process.exit(1);
}

// Initialize Firebase Admin SDK
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://law-office-system-e4801-default-rtdb.firebaseio.com'
    });
    console.log('✅ Firebase Admin SDK initialized successfully\n');
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    process.exit(1);
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN USERS CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════
// Add/remove admin emails here as needed

const adminEmails = [
    'haim@ghlawoffice.co.il',
    'uri@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
];

// ════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ════════════════════════════════════════════════════════════════════════════

async function setAdminClaims() {
    console.log('🔐 Setting Admin Custom Claims...');
    console.log('═'.repeat(70));
    console.log(`📧 Processing ${adminEmails.length} admin email(s)\n`);

    let successCount = 0;
    let failCount = 0;

    for (const email of adminEmails) {
        try {
            // Get user by email
            const user = await admin.auth().getUserByEmail(email);

            // Get current custom claims (if any)
            const currentClaims = user.customClaims || {};

            // Set custom claims
            await admin.auth().setCustomUserClaims(user.uid, {
                ...currentClaims, // Preserve existing claims
                admin: true,
                role: 'admin'
            });

            console.log(`✅ ${email}`);
            console.log(`   UID: ${user.uid}`);
            console.log('   Previous Claims:', JSON.stringify(currentClaims, null, 2) || 'None');
            console.log('   New Claims: { admin: true, role: \'admin\' }\n');

            successCount++;

        } catch (error) {
            console.error(`❌ ${email}`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Code: ${error.code}\n`);
            failCount++;
        }
    }

    // Summary
    console.log('═'.repeat(70));
    console.log('📊 SUMMARY:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('═'.repeat(70));

    if (successCount > 0) {
        console.log('\n✨ Done!');
        console.log('\n⚠️  IMPORTANT - Next Steps:');
        console.log('   1. Users MUST sign out and sign in again');
        console.log('   2. Custom claims are cached in the ID token');
        console.log('   3. Token refreshes automatically on re-authentication');
        console.log('\n📝 Verify claims:');
        console.log('   Run in browser console after re-login:');
        console.log('   > (await firebase.auth().currentUser.getIdTokenResult()).claims');
    }

    if (failCount > 0) {
        console.log('\n⚠️  Some users failed. Common reasons:');
        console.log('   - User does not exist (create account first)');
        console.log('   - Insufficient permissions (check service account role)');
        console.log('   - Network issues (check internet connection)');
    }

    process.exit(failCount > 0 ? 1 : 0);
}

// ════════════════════════════════════════════════════════════════════════════
// RUN
// ════════════════════════════════════════════════════════════════════════════

setAdminClaims().catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});
