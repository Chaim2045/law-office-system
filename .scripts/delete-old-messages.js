/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DELETE OLD MESSAGES - Safe Cleanup Script
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Delete old messages from legacy system (status: 'unread')
 * Safety: Only deletes messages that are NOT from the new model
 *
 * Created: 2025-12-08
 * Run in: Browser Console (Admin Panel or User Interface)
 *
 * IMPORTANT: This script ONLY deletes messages with:
 * ✅ status === 'unread' (old model)
 * ✅ type !== 'admin_to_user' (not new model)
 *
 * Will NOT delete:
 * ❌ status === 'sent' (new model)
 * ❌ status === 'responded' (new model)
 * ❌ type === 'admin_to_user' (new model)
 * ❌ Any subcollections (replies)
 */

(async function deleteOldMessages() {
    console.log('🧹 Starting OLD Messages Cleanup...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ═══════════════════════════════════════════════════════════════
    // Step 1: Verify Firebase is available
    // ═══════════════════════════════════════════════════════════════
    if (!window.firebase || !window.firebaseDB) {
        console.error('❌ Firebase not available. Please run this script from the admin panel or user interface.');
        return;
    }

    const db = window.firebaseDB;
    console.log('✅ Firebase connected');

    try {
        // ═══════════════════════════════════════════════════════════════
        // Step 2: Query for old messages ONLY
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📊 Step 1: Fetching old messages...');
        const snapshot = await db.collection('user_messages')
            .where('status', '==', 'unread')  // Only old model messages
            .get();

        console.log(`📝 Found ${snapshot.size} messages with status='unread'`);

        if (snapshot.empty) {
            console.log('✅ No old messages found! Everything is clean.');
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // Step 3: Filter out new model messages (safety check)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n🔍 Step 2: Filtering messages (safety check)...');

        const oldMessages = [];
        const protectedMessages = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();

            // SAFETY CHECK: Don't delete new model messages
            if (data.type === 'admin_to_user') {
                protectedMessages.push({
                    id: doc.id,
                    to: data.to,
                    from: data.from,
                    message: data.message?.substring(0, 50) + '...',
                    status: data.status,
                    type: data.type
                });
            } else {
                oldMessages.push({
                    id: doc.id,
                    to: data.to,
                    from: data.from,
                    message: data.message?.substring(0, 50) + '...',
                    status: data.status,
                    type: data.type || 'unknown',
                    createdAt: data.createdAt?.toDate()
                });
            }
        });

        console.log(`\n📦 Analysis Results:`);
        console.log(`  ✅ Safe to delete: ${oldMessages.length} messages`);
        console.log(`  🛡️ Protected (new model): ${protectedMessages.length} messages`);

        if (protectedMessages.length > 0) {
            console.log('\n🛡️ Protected Messages (will NOT be deleted):');
            console.table(protectedMessages);
        }

        if (oldMessages.length === 0) {
            console.log('\n✅ No old messages to delete! Everything is clean.');
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // Step 4: Show what will be deleted
        // ═══════════════════════════════════════════════════════════════
        console.log('\n🗑️ Messages to be DELETED:');
        console.table(oldMessages);

        // ═══════════════════════════════════════════════════════════════
        // Step 5: Ask for confirmation
        // ═══════════════════════════════════════════════════════════════
        console.log('\n⚠️ CONFIRMATION REQUIRED');
        console.log(`You are about to DELETE ${oldMessages.length} old messages.`);
        console.log('This action cannot be undone.');
        console.log('\nTo proceed, run:');
        console.log('%cwindow.confirmDeleteOldMessages()', 'color: red; font-weight: bold; font-size: 14px;');

        // Store data for confirmation
        window._oldMessagesToDelete = oldMessages;

    } catch (error) {
        console.error('❌ Error analyzing messages:', error);
        console.error('Stack trace:', error.stack);
    }
})();

/**
 * Confirmation function - must be called manually
 */
window.confirmDeleteOldMessages = async function() {
    if (!window._oldMessagesToDelete || window._oldMessagesToDelete.length === 0) {
        console.error('❌ No messages to delete. Please run the main script first.');
        return;
    }

    const oldMessages = window._oldMessagesToDelete;
    const db = window.firebaseDB;

    console.log('\n🔥 DELETING OLD MESSAGES...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        // Use batched writes for efficiency (max 500 per batch)
        const batches = [];
        let currentBatch = db.batch();
        let batchCount = 0;

        for (let i = 0; i < oldMessages.length; i++) {
            const messageId = oldMessages[i].id;
            const messageRef = db.collection('user_messages').doc(messageId);

            currentBatch.delete(messageRef);
            batchCount++;

            // Firestore limit: 500 operations per batch
            if (batchCount === 500 || i === oldMessages.length - 1) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                batchCount = 0;
            }
        }

        console.log(`📦 Created ${batches.length} batch(es) for deletion`);

        // Execute all batches
        for (let i = 0; i < batches.length; i++) {
            await batches[i].commit();
            console.log(`✅ Batch ${i + 1}/${batches.length} completed`);
        }

        console.log('\n✅ SUCCESS! All old messages deleted.');
        console.log(`📊 Total deleted: ${oldMessages.length} messages`);
        console.log('\n🔄 Refresh the page to see the changes.');

        // Cleanup
        delete window._oldMessagesToDelete;
        delete window.confirmDeleteOldMessages;

    } catch (error) {
        console.error('❌ Error deleting messages:', error);
        console.error('Stack trace:', error.stack);
        console.log('\n⚠️ Some messages may have been deleted before the error occurred.');
        console.log('Please check Firestore Console to verify.');
    }
};
