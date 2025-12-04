/**
 * ContextMessageManager
 * מנהל הודעות קונטקסט - Context Messages (Inbox)
 *
 * Created: 2025-12-04
 * Purpose: ניהול הודעות קונטקסט באמצעות Cloud Functions
 *
 * Context Messages = הודעות שנשלחות מהמנהל לעובדים (broadcast/individual)
 * כל הודעה יכולה להפוך לדיון (Thread) אם מישהו עונה
 */

(function() {
    'use strict';

    class ContextMessageManager {
        constructor() {
            this.functions = null;
            this.db = null;
            this.auth = null;
            this.currentUser = null;
        }

        /**
         * Initialize
         * אתחול
         */
        async init() {
            try {
                this.functions = firebase.functions();
                this.db = firebase.firestore();
                this.auth = firebase.auth();
                this.currentUser = this.auth.currentUser;

                if (!this.currentUser) {
                    throw new Error('User not authenticated');
                }

                return true;
            } catch (error) {
                console.error('❌ ContextMessageManager init failed:', error);
                return false;
            }
        }

        /**
         * Send context message to specific user
         * שלח הודעת קונטקסט למשתמש ספציפי
         */
        async sendToUser(userId, messageData) {
            try {
                const sendMessage = this.functions.httpsCallable('messaging_sendContextMessage');
                const result = await sendMessage({
                    targetType: 'user',
                    targetId: userId,
                    ...messageData
                });

                return result.data;
            } catch (error) {
                console.error('❌ Error sending message to user:', error);
                throw error;
            }
        }

        /**
         * Send broadcast message to all users
         * שלח הודעה לכל המשתמשים
         */
        async sendBroadcast(messageData) {
            try {
                const sendBroadcast = this.functions.httpsCallable('messaging_sendBroadcastMessage');
                const result = await sendBroadcast(messageData);

                return result.data;
            } catch (error) {
                console.error('❌ Error sending broadcast:', error);
                throw error;
            }
        }

        /**
         * Send message to role (e.g., lawyers, secretaries)
         * שלח הודעה לפי תפקיד
         */
        async sendToRole(role, messageData) {
            try {
                const sendToRole = this.functions.httpsCallable('messaging_sendMessageToRole');
                const result = await sendToRole({
                    role,
                    ...messageData
                });

                return result.data;
            } catch (error) {
                console.error('❌ Error sending message to role:', error);
                throw error;
            }
        }

        /**
         * Get unread messages (for inbox)
         * קבל הודעות שלא נקראו
         */
        async getUnreadMessages(limit = 50) {
            try {
                // Query Firestore directly for unread messages
                const snapshot = await this.db.collection('contextMessages')
                    .where('recipientId', '==', this.currentUser.uid)
                    .where('status.isRead', '==', false)
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();

                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                return messages;
            } catch (error) {
                console.error('❌ Error getting unread messages:', error);
                // Return empty array instead of throwing
                return [];
            }
        }

        /**
         * Mark message as read
         * סמן הודעה כנקראה
         */
        async markAsRead(messageId) {
            try {
                const markAsRead = this.functions.httpsCallable('messaging_markMessageAsRead');
                const result = await markAsRead({ messageId });

                return result.data;
            } catch (error) {
                console.error('❌ Error marking message as read:', error);
                throw error;
            }
        }

        /**
         * Delete message
         * מחק הודעה
         */
        async deleteMessage(messageId) {
            try {
                const deleteMessage = this.functions.httpsCallable('messaging_deleteMessage');
                const result = await deleteMessage({ messageId });

                return result.data;
            } catch (error) {
                console.error('❌ Error deleting message:', error);
                throw error;
            }
        }

        /**
         * Create thread from context message
         * צור דיון מהודעת קונטקסט
         */
        async createThread(contextMessageId, initialMessage = null) {
            try {
                const createThread = this.functions.httpsCallable('messaging_createThread');
                const result = await createThread({
                    contextMessageId,
                    initialMessage
                });

                return result.data;
            } catch (error) {
                console.error('❌ Error creating thread:', error);
                throw error;
            }
        }

        /**
         * Get unread count
         * קבל מספר הודעות שלא נקראו
         */
        async getUnreadCount() {
            try {
                const getCount = this.functions.httpsCallable('messaging_getUnreadCount');
                const result = await getCount();

                return result.data.count || 0;
            } catch (error) {
                console.error('❌ Error getting unread count:', error);
                return 0;
            }
        }

        /**
         * Listen to new messages in real-time
         * האזן להודעות חדשות בזמן אמת
         */
        listenToMessages(callback) {
            try {
                const unsubscribe = this.db.collection('contextMessages')
                    .where('recipientId', '==', this.currentUser.uid)
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .onSnapshot((snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            if (change.type === 'added') {
                                const message = {
                                    id: change.doc.id,
                                    ...change.doc.data()
                                };
                                callback(message);
                            }
                        });
                    });

                return unsubscribe;
            } catch (error) {
                console.error('❌ Error listening to messages:', error);
                return () => {}; // Return empty function
            }
        }
    }

    // Create global instance
    window.ContextMessageManager = ContextMessageManager;

    // Auto-initialize when auth is ready
    if (typeof window !== 'undefined' && window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user && !window.contextMessageManager) {
                const manager = new ContextMessageManager();
                manager.init().then(success => {
                    if (success) {
                        window.contextMessageManager = manager;
                        console.log('✅ ContextMessageManager ready');
                    }
                });
            }
        });
    }

})();
