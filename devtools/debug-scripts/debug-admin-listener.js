/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEBUG ADMIN REAL-TIME LISTENER - Check if listener is running
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Verify real-time listener is working in UserDetailsModal
 * Run in: Admin Panel Browser Console (F12) AFTER opening user details
 *
 * Created: 2025-12-08
 *
 * INSTRUCTIONS:
 * 1. Open Admin Panel
 * 2. Click on a user to open UserDetailsModal
 * 3. Open Console (F12)
 * 4. Copy and paste this script
 * 5. Press Enter
 */

(function debugAdminListener() {
    console.clear();
    console.log('%c🔍 ADMIN REAL-TIME LISTENER DEBUG', 'font-size: 20px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 8px 16px; border-radius: 8px;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ═══════════════════════════════════════════════════════════════════════
    // Test 1: Check if UserDetailsModal exists
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 1: UserDetailsModal Instance', 'font-size: 16px; font-weight: bold; color: #059669;');

    if (!window.userDetailsModal) {
        console.log('  ❌ window.userDetailsModal NOT FOUND');
        console.log('  This is a critical error - the modal should be initialized');
        return;
    }

    console.log('  ✅ window.userDetailsModal exists');

    // ═══════════════════════════════════════════════════════════════════════
    // Test 2: Check if modal is open
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 2: Modal Status', 'font-size: 16px; font-weight: bold; color: #059669;');

    const modalId = window.userDetailsModal.modalId;
    const userData = window.userDetailsModal.userData;
    const threadListener = window.userDetailsModal.threadListener;

    console.log(`  Modal ID: ${modalId || '❌ NOT SET'}`);
    console.log(`  User Data: ${userData ? '✅ LOADED' : '❌ NOT LOADED'}`);
    console.log(`  Thread Listener: ${threadListener ? '✅ ACTIVE' : '❌ NOT ACTIVE'}`);

    if (!modalId) {
        console.log('\n  ⚠️ Modal is not open. Please open user details first!');
        return;
    }

    if (!userData) {
        console.log('\n  ⚠️ User data not loaded. This is unexpected.');
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 3: Check current thread info
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 3: Current Thread Info', 'font-size: 16px; font-weight: bold; color: #059669;');

    const threadInfo = userData.threadInfo;

    if (!threadInfo) {
        console.log('  📭 No active thread (user has never received a message)');
    } else {
        console.log('  ✅ Active thread found:');
        console.table({
            'Message ID': threadInfo.messageId,
            'Replies Count': threadInfo.repliesCount,
            'Last Reply At': threadInfo.lastReplyAt?.toLocaleString('he-IL'),
            'Last Reply By': threadInfo.lastReplyBy,
            'Status': threadInfo.status
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 4: Check if listener is running
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 4: Real-Time Listener Status', 'font-size: 16px; font-weight: bold; color: #059669;');

    if (!threadListener) {
        console.log('  ❌ Listener is NOT running');
        console.log('  This means real-time updates will NOT work!');
        console.log('\n  %cRECOMMENDATION:', 'font-weight: bold; color: #ea580c;');
        console.log('  The listener should start automatically in loadFullUserData()');
        console.log('  Check if startThreadListener() was called.');
    } else {
        console.log('  ✅ Listener is RUNNING');
        console.log('  Real-time updates should work correctly!');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 5: Check Firebase connection
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 5: Firebase Connection', 'font-size: 16px; font-weight: bold; color: #059669;');

    if (!window.firebaseDB) {
        console.log('  ❌ Firebase DB NOT AVAILABLE');
        return;
    }

    console.log('  ✅ Firebase DB connected');

    // ═══════════════════════════════════════════════════════════════════════
    // Test 6: Manually query for messages
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 6: Manual Query Test', 'font-size: 16px; font-weight: bold; color: #059669;');

    const userEmail = userData.email;
    console.log(`  Querying messages for: ${userEmail}`);

    window.firebaseDB
        .collection('user_messages')
        .where('to', '==', userEmail)
        .where('type', '==', 'admin_to_user')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.log('  📭 No messages found in Firestore');
            } else {
                const doc = snapshot.docs[0];
                const data = doc.data();
                console.log('  ✅ Found message:');
                console.table({
                    'Message ID': doc.id,
                    'Message': data.message?.substring(0, 50) + '...',
                    'Replies Count': data.repliesCount || 0,
                    'Status': data.status,
                    'Created At': data.createdAt?.toDate().toLocaleString('he-IL')
                });
            }
        })
        .catch(error => {
            console.error('  ❌ Query error:', error);
            console.log('  This might be an index error. Check Firestore Console.');
        });

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2563eb;');
    console.log('%c📋 SUMMARY', 'font-size: 18px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 8px 16px; border-radius: 8px;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('%c✅ Modal is open:', modalId ? 'YES' : 'NO', 'font-weight: bold;');
    console.log('%c✅ User data loaded:', userData ? 'YES' : 'NO', 'font-weight: bold;');
    console.log('%c✅ Thread exists:', threadInfo ? 'YES' : 'NO', 'font-weight: bold;');
    console.log('%c✅ Listener running:', threadListener ? 'YES' : 'NO', 'font-weight: bold;');

    if (!threadListener) {
        console.log('\n%c⚠️ PROBLEM DETECTED!', 'font-size: 16px; font-weight: bold; color: #dc2626;');
        console.log('The real-time listener is NOT running.');
        console.log('This means updates will NOT appear automatically.');
    } else {
        console.log('\n%c✅ EVERYTHING LOOKS GOOD!', 'font-size: 16px; font-weight: bold; color: #059669;');
        console.log('The real-time listener is running.');
        console.log('Updates should appear automatically when user sends a reply.');
    }

    console.log('\n%c✅ Debug Complete!', 'font-size: 16px; font-weight: bold; color: #059669;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

})();
