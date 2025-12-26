/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔍 Firebase App Sharing Test
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Test to verify that all parts of the system share the same Firebase App.
 *
 * INSTRUCTIONS:
 * 1. Login via login-v2.html
 * 2. Navigate to master-admin-panel OR index.html
 * 3. Paste this script in the console
 * 4. Send output to developer
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

(async function testFirebaseAppSharing() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       🔍 FIREBASE APP SHARING TEST                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // 1. Check Firebase SDK
    console.log('1️⃣ Firebase SDK Check:');
    if (typeof firebase === 'undefined') {
        console.error('   ❌ Firebase SDK not loaded!');
        return;
    }
    console.log('   ✅ Firebase SDK loaded\n');

    // 2. Check Firebase Apps
    console.log('2️⃣ Firebase Apps:');
    console.log(`   📦 Total apps: ${firebase.apps.length}`);

    firebase.apps.forEach((app, index) => {
        console.log(`   App ${index + 1}:`);
        console.log(`      Name: ${app.name || '[DEFAULT]'}`);
        console.log(`      Project: ${app.options.projectId}`);
    });
    console.log('');

    // 3. Check Current Auth State
    console.log('3️⃣ Authentication State:');

    const auth = firebase.auth();
    const currentUser = auth.currentUser;

    if (currentUser) {
        console.log('   ✅ User authenticated:');
        console.log(`      Email: ${currentUser.email}`);
        console.log(`      UID: ${currentUser.uid}`);
    } else {
        console.log('   ❌ No user authenticated');
    }
    console.log('');

    // 4. Check Persistence Mode
    console.log('4️⃣ Persistence Mode:');

    // Wait for persistence to be set
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to determine persistence (not directly exposed, but we can infer)
    const persistenceIndicator = localStorage.getItem('firebase:authUser:AIzaSyAlVbkAEBklF6lnxI_LsSg8ZXGlp0pgeMw:[DEFAULT]');

    if (persistenceIndicator) {
        console.log('   ⚠️ LOCAL persistence detected (auth saved in localStorage)');
    } else {
        console.log('   ✅ SESSION persistence (no localStorage auth data)');
    }
    console.log('');

    // 5. Check Global Firebase Instances
    console.log('5️⃣ Global Instances:');
    console.log(`   window.firebaseApp: ${window.firebaseApp ? '✅' : '❌'}`);
    console.log(`   window.firebaseAuth: ${window.firebaseAuth ? '✅' : '❌'}`);
    console.log(`   window.firebaseDB: ${window.firebaseDB ? '✅' : '❌'}`);
    console.log(`   window.firebaseFunctions: ${window.firebaseFunctions ? '✅' : '❌'}`);
    console.log('');

    // 6. Test Firestore Access
    console.log('6️⃣ Firestore Access Test:');
    try {
        const db = firebase.firestore();

        if (currentUser) {
            const userDoc = await db.collection('employees').doc(currentUser.email).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('   ✅ Firestore access successful:');
                console.log(`      Name: ${userData.displayName || userData.name}`);
                console.log(`      Role: ${userData.role}`);
            } else {
                console.log('   ⚠️ User authenticated but no Firestore document found');
            }
        } else {
            console.log('   ⏭️ Skipped (no user authenticated)');
        }
    } catch (error) {
        console.error('   ❌ Firestore error:', error.message);
    }
    console.log('');

    // 7. Check IdleTimeoutManager
    console.log('7️⃣ IdleTimeoutManager:');
    if (window.IdleTimeoutManager) {
        console.log('   ✅ IdleTimeoutManager loaded');

        // Check if instance exists (varies by page)
        if (window.manager && window.manager.idleTimeout) {
            const status = window.manager.idleTimeout.getStatus();
            console.log('   ✅ IdleTimeoutManager active:');
            console.log(`      Idle time: ${status.idleMinutes} minutes`);
            console.log(`      Warning shown: ${status.warningShown ? 'Yes' : 'No'}`);
        } else if (window.idleTimeout) {
            const status = window.idleTimeout.getStatus();
            console.log('   ✅ IdleTimeoutManager active:');
            console.log(`      Idle time: ${status.idleMinutes} minutes`);
            console.log(`      Warning shown: ${status.warningShown ? 'Yes' : 'No'}`);
        } else {
            console.log('   ⚠️ IdleTimeoutManager loaded but not initialized');
        }
    } else {
        console.log('   ❌ IdleTimeoutManager not loaded');
    }
    console.log('');

    // 8. Summary
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       📋 SUMMARY                                              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const issues = [];

    if (firebase.apps.length !== 1) {
        issues.push('❌ Multiple Firebase Apps detected - should be only 1 default app');
    }

    if (firebase.apps.length > 0 && firebase.apps[0].name !== '[DEFAULT]') {
        issues.push('❌ Firebase App is not the default app - should be [DEFAULT]');
    }

    if (!currentUser) {
        issues.push('❌ No authenticated user - login may have failed');
    }

    if (persistenceIndicator) {
        issues.push('⚠️ Using LOCAL persistence - should be SESSION for production');
    }

    if (issues.length === 0) {
        console.log('✅ All checks passed! System configured correctly.\n');
        console.log('Expected behavior:');
        console.log('  • Login via login-v2.html works');
        console.log('  • Navigation to admin panel works (no redirect to login)');
        console.log('  • Navigation to employee interface works (no redirect to login)');
        console.log('  • IdleTimeoutManager auto-logout active on both interfaces');
        console.log('  • Logout on browser close (SESSION persistence)');
    } else {
        console.log('⚠️ Issues found:\n');
        issues.forEach(issue => console.log(`   ${issue}`));
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');

    // Return summary object
    return {
        firebaseApps: firebase.apps.length,
        defaultAppName: firebase.apps[0]?.name || null,
        authenticated: !!currentUser,
        userEmail: currentUser?.email || null,
        persistence: persistenceIndicator ? 'LOCAL' : 'SESSION',
        idleTimeoutActive: !!(window.manager?.idleTimeout || window.idleTimeout),
        issues: issues
    };
})();
