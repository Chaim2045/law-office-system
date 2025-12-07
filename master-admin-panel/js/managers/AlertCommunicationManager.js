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
        constructor(firebaseDB, dataManager, alertEngine) {
            if (!firebaseDB) {
                throw new Error('AlertCommunicationManager: firebaseDB is required');
            }

            this.db = firebaseDB;
            this.dataManager = dataManager;
            this.alertEngine = alertEngine;
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
                    window.notify.error(`שליחת ההודעות נכשלה`);
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
                if (data.status === 'unread') stats.unread++;
                else if (data.status === 'read') stats.read++;
                else if (data.status === 'responded') stats.responded++;
            });

            stats.responseRate = stats.total > 0
                ? Math.round((stats.responded / stats.total) * 100)
                : 0;

            return stats;
        }

        /**
         * Get unread responses count per user
         * קבלת מספר תגובות שלא נקראו לפי משתמש
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
                const userEmail = data.to;
                counts.set(userEmail, (counts.get(userEmail) || 0) + 1);
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
         * Sync alerts from AlertEngine
         * סנכרון התראות מ-AlertEngine
         *
         * שולח התראות אוטומטיות לעובדים על בסיס AlertEngine
         */
        async syncAlertsToUsers() {
            if (!this.alertEngine) {
                console.warn('AlertEngine not available');
                return;
            }

            if (!this.dataManager) {
                console.warn('DataManager not available');
                return;
            }

            try {
                // Get all users
                const users = await this.dataManager.loadUsers();

                let totalAlertsSent = 0;

                for (const user of users) {
                    // Skip admins
                    if (user.role === 'admin') continue;

                    // Calculate alerts for this user
                    const alerts = this.alertEngine.calculateAlerts(user);

                    // Send each alert as a message
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
                console.error('Error syncing alerts:', error);
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
