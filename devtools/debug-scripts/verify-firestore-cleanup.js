/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VERIFY FIRESTORE CLEANUP - Check Messages Status
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Verify old messages were deleted and check current state
 * Run in: Browser Console (Admin Panel or User Interface)
 *
 * Created: 2025-12-08
 */

(async function verifyFirestoreCleanup() {
    console.log('🔍 FIRESTORE MESSAGES VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!window.firebase || !window.firebaseDB) {
        console.error('❌ Firebase not available');
        return;
    }

    const db = window.firebaseDB;

    try {
        // ═══════════════════════════════════════════════════════════════
        // Check 1: Old messages (should be 0)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Check 1: Old Messages (status="unread")');
        const oldMessages = await db.collection('user_messages')
            .where('status', '==', 'unread')
            .get();

        console.log(`   Result: ${oldMessages.size} old messages found`);
        if (oldMessages.size > 0) {
            console.warn('⚠️ Warning: Old messages still exist!');
            console.table(oldMessages.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })));
        } else {
            console.log('   ✅ All old messages cleaned!');
        }

        // ═══════════════════════════════════════════════════════════════
        // Check 2: New messages (status="sent" or "responded")
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Check 2: New Messages (status="sent" or "responded")');
        const newMessages = await db.collection('user_messages')
            .where('type', '==', 'admin_to_user')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        console.log(`   Result: ${newMessages.size} new messages found`);
        if (newMessages.size > 0) {
            const messages = newMessages.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    from: data.from,
                    to: data.to,
                    message: data.message?.substring(0, 30) + '...',
                    status: data.status,
                    type: data.type,
                    repliesCount: data.repliesCount || 0,
                    createdAt: data.createdAt?.toDate().toLocaleString('he-IL')
                };
            });
            console.table(messages);
        } else {
            console.log('   ℹ️ No new messages found');
        }

        // ═══════════════════════════════════════════════════════════════
        // Check 3: All messages (any status)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Check 3: All Messages Summary');
        const allMessages = await db.collection('user_messages')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const statusBreakdown = {};
        const typeBreakdown = {};

        allMessages.docs.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'unknown';
            const type = data.type || 'unknown';

            statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
            typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
        });

        console.log(`   Total messages: ${allMessages.size}`);
        console.log('\n   By Status:');
        console.table(statusBreakdown);
        console.log('\n   By Type:');
        console.table(typeBreakdown);

        // ═══════════════════════════════════════════════════════════════
        // Summary
        // ═══════════════════════════════════════════════════════════════
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 SUMMARY:');
        console.log(`   Old messages (unread): ${oldMessages.size}`);
        console.log(`   New messages (admin_to_user): ${newMessages.size}`);
        console.log(`   Total messages in DB: ${allMessages.size}`);

        if (oldMessages.size === 0) {
            console.log('\n✅ SUCCESS: All old messages cleaned!');
        } else {
            console.log('\n⚠️ WARNING: Old messages still exist. Run delete script again.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
