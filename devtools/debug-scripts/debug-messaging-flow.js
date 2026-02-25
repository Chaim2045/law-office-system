/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEBUG MESSAGING FLOW - Complete Diagnostic Tool
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Debug why messages aren't showing up for users
 * Run in: Browser Console (User Interface)
 *
 * Created: 2025-12-08
 */

(async function debugMessagingFlow() {
    console.log('🔍 MESSAGING FLOW DEBUG');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!window.firebase || !window.firebaseDB) {
        console.error('❌ Firebase not available');
        return;
    }

    const db = window.firebaseDB;
    const currentUser = window.notificationBell?.currentUser;

    if (!currentUser) {
        console.error('❌ No current user. Please login first.');
        return;
    }

    console.log('✅ Current user:', currentUser.email);

    try {
        // ═══════════════════════════════════════════════════════════════
        // Test 1: Check if NotificationBell listener is running
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Test 1: NotificationBell Status');
        console.log('   Has messagesListener:', !!window.notificationBell?.messagesListener);
        console.log('   Notifications count:', window.notificationBell?.notifications?.length || 0);

        // ═══════════════════════════════════════════════════════════════
        // Test 2: Query messages with NEW model (what the listener uses)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Test 2: Messages with NEW MODEL Query');
        console.log('   Query: type == "admin_to_user" AND to == user.email');

        try {
            const newModelSnapshot = await db.collection('user_messages')
                .where('to', '==', currentUser.email)
                .where('type', '==', 'admin_to_user')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            console.log(`   ✅ Found ${newModelSnapshot.size} messages`);

            if (newModelSnapshot.size > 0) {
                const messages = newModelSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate().toLocaleString('he-IL')
                }));
                console.table(messages);
            }
        } catch (error) {
            console.error('   ❌ Query failed:', error.message);
            if (error.message.includes('index')) {
                console.error('\n   🔥 FIRESTORE INDEX MISSING!');
                console.error('   You need to create a composite index:');
                console.error('   Collection: user_messages');
                console.error('   Fields: to (Ascending), type (Ascending), createdAt (Descending)');
                console.error('\n   Index URL will appear in console...');
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // Test 3: Query messages WITHOUT type filter (fallback check)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Test 3: All Messages for User (no type filter)');
        const allMessagesSnapshot = await db.collection('user_messages')
            .where('to', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        console.log(`   Found ${allMessagesSnapshot.size} total messages`);

        if (allMessagesSnapshot.size > 0) {
            const allMessages = allMessagesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: data.type || 'NO TYPE',
                    status: data.status,
                    message: data.message?.substring(0, 30) + '...',
                    createdAt: data.createdAt?.toDate().toLocaleString('he-IL')
                };
            });
            console.table(allMessages);

            // Count by type
            const typeCount = {};
            allMessagesSnapshot.docs.forEach(doc => {
                const type = doc.data().type || 'NO TYPE';
                typeCount[type] = (typeCount[type] || 0) + 1;
            });
            console.log('\n   By Type:');
            console.table(typeCount);
        }

        // ═══════════════════════════════════════════════════════════════
        // Test 4: Check the EXACT query the listener uses
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Test 4: Exact Listener Query (with filter)');
        try {
            const listenerSnapshot = await db.collection('user_messages')
                .where('to', '==', currentUser.email)
                .where('type', '==', 'admin_to_user')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            const activeMessages = listenerSnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.status === 'sent' || data.status === 'responded';
            });

            console.log(`   Query returned: ${listenerSnapshot.size} messages`);
            console.log(`   After filter: ${activeMessages.length} active messages`);

            if (activeMessages.length > 0) {
                console.table(activeMessages.map(doc => ({
                    id: doc.id,
                    status: doc.data().status,
                    message: doc.data().message?.substring(0, 40),
                    repliesCount: doc.data().repliesCount || 0
                })));
            }
        } catch (error) {
            console.error('   ❌ Listener query failed:', error.message);
        }

        // ═══════════════════════════════════════════════════════════════
        // Summary & Recommendations
        // ═══════════════════════════════════════════════════════════════
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 SUMMARY & NEXT STEPS:');
        console.log('\n1. If you see "FIRESTORE INDEX MISSING" error above:');
        console.log('   → Click the index creation link in the error');
        console.log('   → Wait for index to build (1-5 minutes)');
        console.log('   → Refresh the page and test again');
        console.log('\n2. If messages exist but listener not working:');
        console.log('   → Check that notificationBell.startListeningToAdminMessages() was called');
        console.log('   → Refresh the page to restart listener');
        console.log('\n3. If no messages found at all:');
        console.log('   → Send a test message from admin panel');
        console.log('   → Run this script again');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Stack:', error.stack);
    }
})();
