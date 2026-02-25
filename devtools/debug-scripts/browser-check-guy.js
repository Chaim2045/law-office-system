/**
 * Browser Console Script - Check Guy's Admin Status
 * העתק והדבק את כל הסקריפט הזה לקונסול של הדפדפן
 * כשאתה באתר: https://admin-gh-law-office-system.netlify.app/
 */

(async function checkGuyAdminStatus() {
    console.log('🔍 Starting Guy Admin Status Check...\n');
    console.log('══════════════════════════════════════════════════════════\n');

    const guyEmail = 'guy@ghlawoffice.co.il';

    try {
        // Check if Firebase is available
        if (!window.firebaseAuth || !window.firebaseDB) {
            console.error('❌ Firebase not initialized!');
            console.log('   Make sure you are on the admin panel page.');
            return;
        }

        console.log('✅ Firebase initialized\n');

        // 1. Check Firebase Auth
        console.log('📋 STEP 1: Checking Firebase Auth');
        console.log('─────────────────────────────────────────────────────────');

        try {
            const userRecord = await window.firebaseAuth.getUserByEmail?.(guyEmail);
            if (userRecord) {
                console.log('✅ Guy found in Firebase Auth:');
                console.log('   Email:', userRecord.email);
                console.log('   UID:', userRecord.uid);
                console.log('   Email Verified:', userRecord.emailVerified);
                console.log('   Disabled:', userRecord.disabled);
            }
        } catch (e) {
            console.log('ℹ️  Cannot check Firebase Auth from browser (requires server-side)');
            console.log('   This is normal - will check Firestore instead.\n');
        }

        // 2. Check Firestore employees collection
        console.log('\n📋 STEP 2: Checking Firestore employees collection');
        console.log('─────────────────────────────────────────────────────────');

        const employeeDoc = await window.firebaseDB.collection('employees').doc(guyEmail).get();

        if (employeeDoc.exists) {
            const data = employeeDoc.data();
            console.log('✅ Guy found in Firestore employees:');
            console.log('   Email:', guyEmail);
            console.log('   Display Name:', data.displayName);
            console.log('   Role:', data.role);
            console.log('   Auth UID:', data.authUID);
            console.log('   Is Active:', data.isActive);
            console.log('   Username:', data.username);
            console.log('   Created At:', data.createdAt?.toDate());

            // 3. Try to get token and check custom claims
            console.log('\n📋 STEP 3: Checking Custom Claims (if Guy is logged in)');
            console.log('─────────────────────────────────────────────────────────');

            const currentUser = window.firebaseAuth.currentUser;
            if (currentUser && currentUser.email === guyEmail) {
                console.log('✅ Guy is currently logged in!');
                const tokenResult = await currentUser.getIdTokenResult();
                console.log('   Custom Claims:', JSON.stringify(tokenResult.claims, null, 2));

                const isAdminRole = tokenResult.claims.role === 'admin';
                const isAdminClaim = tokenResult.claims.admin === true;

                console.log('   ✓ Has role="admin":', isAdminRole);
                console.log('   ✓ Has admin=true:', isAdminClaim);
            } else {
                console.log('ℹ️  Guy is not currently logged in');
                console.log('   Cannot check Custom Claims without login');
                console.log('   But Firestore role will still work as fallback.');
            }

            // 4. Analysis
            console.log('\n📊 ANALYSIS');
            console.log('═════════════════════════════════════════════════════════');

            const hasFirestoreRole = data.role === 'admin';
            const isActive = data.isActive !== false;
            const hasAuthUID = !!data.authUID;

            console.log('✓ Firestore role === "admin":', hasFirestoreRole);
            console.log('✓ Is Active:', isActive);
            console.log('✓ Has Auth UID:', hasAuthUID);

            console.log('\n🎯 CONCLUSION:');
            if (hasFirestoreRole && isActive && hasAuthUID) {
                console.log('✅ Guy SHOULD be able to login as admin!');
                console.log('\nIf Guy still cannot login, possible causes:');
                console.log('1. Browser cache - try hard refresh (Ctrl+Shift+R)');
                console.log('2. Wrong password');
                console.log('3. Account disabled in Firebase Auth (check console)');
                console.log('4. Custom Claims not set (will use Firestore fallback, works but slower)');
            } else {
                console.log('❌ Guy CANNOT login as admin!');
                console.log('\nProblems found:');
                if (!hasFirestoreRole) {
console.log('  - Role is not "admin" in Firestore');
}
                if (!isActive) {
console.log('  - Account is not active');
}
                if (!hasAuthUID) {
console.log('  - No Auth UID (user not created in Firebase Auth)');
}
            }

        } else {
            console.log('❌ Guy NOT found in Firestore employees collection!');
            console.log('\n🔧 FIX REQUIRED:');
            console.log('Guy needs to be created as a user first.');
            console.log('Go to Admin Panel → Add User → Create Guy with role="admin"');
        }

        console.log('\n══════════════════════════════════════════════════════════');
        console.log('✅ Check complete!');
        console.log('══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error during check:', error);
        console.log('\nError details:', error.message);
        console.log('\nMake sure you are:');
        console.log('1. On the admin panel page');
        console.log('2. Logged in as an admin');
        console.log('3. Have network connection');
    }
})();
