/**
 * AlertCommunicationManager - Admin-to-User Communication System
 * מערכת תקשורת מנהל-עובד
 *
 * נוצר: 2025-12-04
 * גרסה: 1.0.0
 *
 * תפקיד: ניהול שליחת הודעות/התראות לעובדים ומעקב אחר תגובות
 *
 * Features:
 * - שליחת הודעות מותאמות אישית לעובדים
 * - אינטגרציה עם AlertEngine (שליחת התראות אוטומטיות)
 * - האזנה real-time לתגובות עובדים
 * - סטטיסטיקות תגובות
 */

(function() {
    'use strict';

    class AlertCommunicationManager {
        constructor(firebaseDB, dataManager, alertEngine, alertsAnalyticsService) {
            if (!firebaseDB) {
                throw new Error('AlertCommunicationManager: firebaseDB is required');
            }

            this.db = firebaseDB;
            this.dataManager = dataManager;
            this.alertEngine = alertEngine;
            this.alertsAnalyticsService = alertsAnalyticsService || window.alertsAnalyticsService;
            this.currentAdmin = null;
            this.responsesListener = null;

            console.log('✅ AlertCommunicationManager: Initialized');
        }

        /**
         * Initialize with current admin user
         * אתחול עם משתמש מנהל נוכחי
         */
        async init(adminUser) {
            this.currentAdmin = adminUser;
            console.log('✅ AlertCommunicationManager: Admin user set', adminUser.email);
        }

        /**
         * Send message to user
         * שליחת הודעה לעובד
         *
         * @param {string} userEmail - Email of recipient
         * @param {string} message - Message text
         * @param {Object} options - Additional options (type, priority, etc.)
         * @returns {Promise<string>} - Message ID
         */
        async sendMessage(userEmail, message, options = {}) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized. Call init() first.');
            }

            if (!userEmail || !message) {
                throw new Error('userEmail and message are required');
            }

            // Get user details
            let userName = userEmail;
            try {
                const user = await this.dataManager.getUserByEmail(userEmail);
                userName = user?.name || userEmail;
            } catch (error) {
                console.warn('Could not fetch user details:', error);
            }

            // Create message document
            const messageData = {
                from: this.currentAdmin.email,
                fromName: this.currentAdmin.displayName || this.currentAdmin.email,
                to: userEmail,
                toName: userName,
                message: message,
                type: options.type || 'info', // info, warning, alert
                priority: options.priority || 1,
                response: null,
                status: 'unread', // unread | read | responded
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                respondedAt: null
            };

            // Add to Firestore
            const docRef = await this.db.collection('user_messages').add(messageData);

            console.log(`✅ Message sent to ${userName}:`, docRef.id);

            // Show success notification
            if (window.notify) {
                window.notify.success(`ההודעה נשלחה ל-${userName}`);
            }

            return docRef.id;
        }

        /**
         * Send alert message (from AlertEngine)
         * שליחת הודעת התראה אוטומטית
         *
         * @param {string} userEmail - Email of recipient
         * @param {Object} alert - Alert object from AlertEngine
         * @returns {Promise<string>} - Message ID
         */
        async sendAlertMessage(userEmail, alert) {
            return this.sendMessage(userEmail, alert.description, {
                type: alert.severity || 'warning',
                priority: alert.priority || 5
            });
        }

        /**
         * Send bulk messages to multiple users
         * שליחת הודעות לכמה עובדים
         *
         * @param {Array<string>} userEmails - Array of user emails
         * @param {string} message - Message text
         * @param {Object} options - Additional options
         * @returns {Promise<Array>} - Array of message IDs
         */
        async sendBulkMessages(userEmails, message, options = {}) {
            const results = [];
            let successCount = 0;
            let failCount = 0;

            // Show loading notification
            const loadingId = window.notify?.loading(`שולח הודעות ל-${userEmails.length} עובדים...`);

            for (const email of userEmails) {
                try {
                    const messageId = await this.sendMessage(email, message, options);
                    results.push({ email, messageId, success: true });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to send message to ${email}:`, error);
                    results.push({ email, error: error.message, success: false });
                    failCount++;
                }
            }

            // Hide loading, show result
            if (window.notify) {
                window.notify.hide(loadingId);

                if (failCount === 0) {
                    window.notify.success(`כל ההודעות נשלחו בהצלחה (${successCount})`);
                } else if (successCount === 0) {
                    window.notify.error('שליחת ההודעות נכשלה');
                } else {
                    window.notify.warning(`${successCount} הודעות נשלחו, ${failCount} נכשלו`);
                }
            }

            return results;
        }

        /**
         * Listen to responses in real-time
         * האזנה לתגובות בזמן אמת
         *
         * @param {Function} callback - Callback function (responses) => {}
         * @returns {Function} - Unsubscribe function
         */
        listenToResponses(callback) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized');
            }

            // Track first load to avoid toast spam
            let isFirstLoad = true;

            // Listen to messages where admin is sender and status is 'responded'
            this.responsesListener = this.db.collection('user_messages')
                .where('from', '==', this.currentAdmin.email)
                .where('status', '==', 'responded')
                .orderBy('respondedAt', 'desc')
                .limit(50)
                .onSnapshot(
                    snapshot => {
                        const responses = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        console.log(`📨 Received ${responses.length} responses`);

                        // 🔇 DISABLED: Toast notifications on initial load
                        // Only show toast for truly new responses after initial load
                        if (!isFirstLoad) {
                            snapshot.docChanges().forEach(change => {
                                if (change.type === 'added' && window.notify) {
                                    const data = change.doc.data();
                                    window.notify.info(
                                        `${data.toName} הגיב/ה להודעה`,
                                        'תגובה חדשה'
                                    );
                                }
                            });
                        }

                        // Mark first load as complete
                        if (isFirstLoad) {
                            isFirstLoad = false;
                            console.log('✅ First load complete - toast notifications enabled for new responses');
                        }

                        callback(responses);
                    },
                    error => {
                        console.error('Error listening to responses:', error);
                    }
                );

            return () => {
                if (this.responsesListener) {
                    this.responsesListener();
                    this.responsesListener = null;
                }
            };
        }

        /**
         * Listen to all messages (sent by admin)
         * האזנה לכל ההודעות ששלח המנהל
         *
         * @param {Function} callback - Callback function
         * @returns {Function} - Unsubscribe function
         */
        listenToAllMessages(callback) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized');
            }

            return this.db.collection('user_messages')
                .where('from', '==', this.currentAdmin.email)
                .orderBy('createdAt', 'desc')
                .limit(100)
                .onSnapshot(
                    snapshot => {
                        const messages = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        callback(messages);
                    },
                    error => {
                        console.error('Error listening to messages:', error);
                    }
                );
        }

        /**
         * Get message statistics
         * קבלת סטטיסטיקות הודעות
         *
         * @returns {Promise<Object>} - Statistics object
         */
        async getStatistics() {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized');
            }

            const snapshot = await this.db.collection('user_messages')
                .where('from', '==', this.currentAdmin.email)
                .get();

            const stats = {
                total: snapshot.size,
                unread: 0,
                read: 0,
                responded: 0,
                responseRate: 0
            };

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.status === 'unread') {
stats.unread++;
} else if (data.status === 'read') {
stats.read++;
} else if (data.status === 'responded') {
stats.responded++;
}
            });

            stats.responseRate = stats.total > 0
                ? Math.round((stats.responded / stats.total) * 100)
                : 0;

            return stats;
        }

        /**
         * Get unread responses count per user (only responses admin hasn't seen)
         * קבלת מספר תגובות שהמנהל לא ראה לפי משתמש
         *
         * @returns {Promise<Map>} - Map of userEmail -> count
         */
        async getUserResponseCounts() {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized');
            }

            const snapshot = await this.db.collection('user_messages')
                .where('from', '==', this.currentAdmin.email)
                .where('status', '==', 'responded')
                .get();

            const counts = new Map();

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Only count if admin hasn't read it yet
                if (data.adminRead !== true) {
                    const userEmail = data.to;
                    counts.set(userEmail, (counts.get(userEmail) || 0) + 1);
                }
            });

            return counts;
        }

        /**
         * Mark message as read by admin
         * סימון הודעה כנקראה על ידי מנהל
         */
        async markAsRead(messageId) {
            await this.db.collection('user_messages')
                .doc(messageId)
                .update({
                    status: 'read'
                });
        }

        /**
         * Mark user's responded messages as read by admin
         * סימון כל התגובות של משתמש כנקראו על ידי מנהל
         *
         * @param {string} userEmail - User email
         * @returns {Promise<number>} - Number of messages marked
         */
        async markUserResponsesAsReadByAdmin(userEmail) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized');
            }

            console.log(`📖 Marking responses from ${userEmail} as read by admin...`);

            // Get all responded messages from this user that admin hasn't read yet
            const snapshot = await this.db.collection('user_messages')
                .where('from', '==', this.currentAdmin.email)
                .where('to', '==', userEmail)
                .where('status', '==', 'responded')
                .get();

            // Batch update for performance
            const batch = this.db.batch();
            let count = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Only update if not already marked as read by admin
                if (data.adminRead !== true) {
                    batch.update(doc.ref, {
                        adminRead: true,
                        adminReadAt: firebase.firestore.FieldValue.serverTimestamp(),
                        adminReadBy: this.currentAdmin.email
                    });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                console.log(`✅ Marked ${count} responses as read by admin`);
            } else {
                console.log('ℹ️ No new responses to mark');
            }

            return count;
        }

        /**
         * Archive message
         * העברת הודעה לארכיון
         *
         * @param {string} messageId - Message ID
         * @returns {Promise<void>}
         */
        async archiveMessage(messageId) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized');
            }

            await this.db.collection('user_messages')
                .doc(messageId)
                .update({
                    archived: true,
                    archivedBy: this.currentAdmin.email,
                    archivedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log(`✅ Message ${messageId} archived`);

            if (window.notify) {
                window.notify.success('ההודעה הועברה לארכיון');
            }
        }

        /**
         * Restore message from archive
         * שחזור הודעה מארכיון
         *
         * @param {string} messageId - Message ID
         * @returns {Promise<void>}
         */
        async restoreMessage(messageId) {
            await this.db.collection('user_messages')
                .doc(messageId)
                .update({
                    archived: false,
                    archivedBy: null,
                    archivedAt: null
                });

            console.log(`✅ Message ${messageId} restored from archive`);

            if (window.notify) {
                window.notify.success('ההודעה שוחזרה מהארכיון');
            }
        }

        /**
         * Delete message
         * מחיקת הודעה
         */
        async deleteMessage(messageId) {
            await this.db.collection('user_messages')
                .doc(messageId)
                .delete();

            if (window.notify) {
                window.notify.success('ההודעה נמחקה');
            }
        }

        /**
         * ═══════════════════════════════════════════════════════════════════════════
         * THREAD-BASED MESSAGING API (New)
         * ═══════════════════════════════════════════════════════════════════════════
         * Added: 2025-12-07
         * Part of thread-based messaging system
         */

        /**
         * Load thread replies for a message
         * טעינת תשובות לשרשור
         *
         * @param {string} messageId - Message ID
         * @returns {Promise<Array>} - Array of reply objects
         */
        async loadThreadReplies(messageId) {
            if (!messageId) {
                throw new Error('messageId is required');
            }

            try {
                const snapshot = await this.db.collection('user_messages')
                    .doc(messageId)
                    .collection('replies')
                    .orderBy('createdAt', 'asc')
                    .get();

                const replies = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate()
                }));

                console.log(`✅ Loaded ${replies.length} replies for message ${messageId}`);
                return replies;

            } catch (error) {
                console.error('Error loading thread replies:', error);
                throw error;
            }
        }

        /**
         * Listen to thread replies in real-time
         * האזנה לתשובות בזמן אמת
         *
         * @param {string} messageId - Message ID
         * @param {Function} callback - Callback function (replies) => {}
         * @returns {Function} - Unsubscribe function
         */
        listenToThreadReplies(messageId, callback) {
            if (!messageId) {
                throw new Error('messageId is required');
            }

            if (!callback || typeof callback !== 'function') {
                throw new Error('callback function is required');
            }

            console.log(`👂 Listening to replies for message ${messageId}`);

            return this.db.collection('user_messages')
                .doc(messageId)
                .collection('replies')
                .orderBy('createdAt', 'asc')
                .onSnapshot(
                    snapshot => {
                        const replies = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            createdAt: doc.data().createdAt?.toDate()
                        }));

                        console.log(`📨 Received ${replies.length} replies`);
                        callback(replies);
                    },
                    error => {
                        console.error('Error listening to thread replies:', error);
                    }
                );
        }

        /**
         * Send admin reply to thread
         * שליחת תשובת מנהל לשרשור
         *
         * @param {string} messageId - Message ID
         * @param {string} replyText - Reply text
         * @returns {Promise<string>} - Reply ID
         */
        async sendAdminReply(messageId, replyText) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized. Call init() first.');
            }

            if (!messageId || !replyText) {
                throw new Error('messageId and replyText are required');
            }

            const trimmedReply = replyText.trim();
            if (!trimmedReply) {
                throw new Error('Reply text cannot be empty');
            }

            try {
                // Add reply to subcollection
                const replyRef = await this.db.collection('user_messages')
                    .doc(messageId)
                    .collection('replies')
                    .add({
                        from: this.currentAdmin.email,
                        fromName: this.currentAdmin.displayName || this.currentAdmin.email,
                        message: trimmedReply,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        readBy: [] // Track who read this reply
                    });

                // Update parent document with metadata
                await this.db.collection('user_messages')
                    .doc(messageId)
                    .update({
                        repliesCount: firebase.firestore.FieldValue.increment(1),
                        lastReplyAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastReplyBy: this.currentAdmin.email,
                        status: 'responded', // Mark as responded
                        userReadLastReply: false // ✅ Mark as unread for user (new reply from admin)
                    });

                console.log(`✅ Admin reply sent: ${replyRef.id}`);

                // Show success notification
                if (window.notify) {
                    window.notify.success('התגובה נשלחה בהצלחה!');
                }

                return replyRef.id;

            } catch (error) {
                console.error('Error sending admin reply:', error);

                if (window.notify) {
                    window.notify.error('שגיאה בשליחת התגובה: ' + error.message);
                }

                throw error;
            }
        }

        /**
         * Get thread metadata
         * קבלת מטא-דאטה של שרשור
         *
         * @param {string} messageId - Message ID
         * @returns {Promise<Object>} - Thread metadata
         */
        async getThreadMetadata(messageId) {
            if (!messageId) {
                throw new Error('messageId is required');
            }

            try {
                const doc = await this.db.collection('user_messages')
                    .doc(messageId)
                    .get();

                if (!doc.exists) {
                    throw new Error('Message not found');
                }

                const data = doc.data();
                return {
                    repliesCount: data.repliesCount || 0,
                    lastReplyAt: data.lastReplyAt?.toDate(),
                    lastReplyBy: data.lastReplyBy,
                    status: data.status
                };

            } catch (error) {
                console.error('Error getting thread metadata:', error);
                throw error;
            }
        }

        /**
         * Send new message to user (create new thread)
         * שליחת הודעה חדשה למשתמש (יצירת שיחה חדשה)
         *
         * @param {string} toEmail - Recipient email
         * @param {string} toName - Recipient name
         * @param {string} messageText - Message text
         * @param {string} category - Message category (critical, urgent, task, etc.)
         * @param {string|null} subject - Optional subject line
         * @returns {Promise<string>} - Message ID
         */
        async sendNewMessage(toEmail, toName, messageText, category = 'info', subject = null) {
            if (!this.currentAdmin) {
                throw new Error('Admin user not initialized. Call init() first.');
            }

            if (!toEmail || !messageText) {
                throw new Error('toEmail and messageText are required');
            }

            const trimmedMessage = messageText.trim();
            if (!trimmedMessage) {
                throw new Error('Message text cannot be empty');
            }

            if (!category) {
                throw new Error('Category is required');
            }

            try {
                console.log(`📤 Sending new message to ${toEmail} (category: ${category})`);

                // יצירת document חדש ב-user_messages
                const messageRef = await this.db.collection('user_messages').add({
                    from: this.currentAdmin.email,
                    fromName: this.currentAdmin.displayName || this.currentAdmin.email,
                    to: toEmail,
                    toName: toName || toEmail,
                    message: trimmedMessage,
                    category: category,           // ✅ Category
                    subject: subject || null,     // ✅ Subject (optional)
                    type: 'admin_to_user',
                    status: 'unread',             // ✅ Changed from 'sent' to 'unread'
                    read: false,
                    repliesCount: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✅ New message sent: ${messageRef.id}`);

                // Show success notification
                if (window.notify) {
                    window.notify.success('ההודעה נשלחה בהצלחה!');
                }

                return messageRef.id;

            } catch (error) {
                console.error('❌ Error sending new message:', error);

                if (window.notify) {
                    window.notify.error('שגיאה בשליחת ההודעה: ' + error.message);
                }

                throw error;
            }
        }

        /**
         * Sync alerts from AlertEngine
         * סנכרון התראות מ-AlertEngine
         *
         * שולח התראות אוטומטיות לעובדים על בסיס AlertEngine
         */
        async syncAlertsToUsers() {
            if (!this.alertsAnalyticsService) {
                console.warn('⚠️ AlertsAnalyticsService not available');
                if (window.notify) {
                    window.notify.error('שירות אנליטיקס לא זמין');
                }
                return;
            }

            if (!this.dataManager) {
                console.warn('⚠️ DataManager not available');
                return;
            }

            try {
                // Get all users
                const users = await this.dataManager.loadUsers();

                let totalAlertsSent = 0;

                for (const user of users) {
                    // Skip admins
                    if (user.role === 'admin') {
continue;
}

                    // Calculate alerts via central analytics service
                    const result = this.alertsAnalyticsService.computeAlertsAnalytics(user);

                    // CRITICAL: If analytics unavailable (system-level issue), stop entire sync
                    if (!result.ok) {
                        console.error('❌ AlertCommunicationManager: Analytics unavailable - stopping sync');
                        console.error('   Error:', result.error.code, '-', result.error.message);

                        if (window.notify) {
                            window.notify.error(`סנכרון התראות הופסק: ${result.error.message}`);
                        }

                        return 0; // Stop sync - system-level issue, not user-specific
                    }

                    // Send each alert as a message
                    const alerts = result.data;
                    for (const alert of alerts) {
                        try {
                            await this.sendAlertMessage(user.email, alert);
                            totalAlertsSent++;
                        } catch (error) {
                            console.error(`Failed to send alert to ${user.email}:`, error);
                        }
                    }
                }

                if (window.notify) {
                    window.notify.success(`נשלחו ${totalAlertsSent} התראות אוטומטיות`);
                }

                return totalAlertsSent;

            } catch (error) {
                console.error('❌ Error syncing alerts:', error);
                if (window.notify) {
                    window.notify.error('שגיאה בשליחת התראות אוטומטיות');
                }
                throw error;
            }
        }

        /**
         * Cleanup - unsubscribe from listeners
         */
        cleanup() {
            if (this.responsesListener) {
                this.responsesListener();
                this.responsesListener = null;
            }
            console.log('✅ AlertCommunicationManager: Cleaned up');
        }
    }

    // Export to window
    window.AlertCommunicationManager = AlertCommunicationManager;

    console.log('✅ AlertCommunicationManager: Class loaded');

})();
