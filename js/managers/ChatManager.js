/**
 * Chat Manager
 * מנהל צ'אט דו-כיווני בין מנהל לעובדים
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Phase: Messaging System - Two-Way Chat
 *
 * תפקיד: ניהול שיחות צ'אט בסגנון WhatsApp/Telegram
 * מבנה: Firestore conversations/{conversationId}/messages/{messageId}
 */

(function() {
    'use strict';

    /**
     * ChatManager Class
     * מנהל את כל פעולות הצ'אט הדו-כיווני
     */
    class ChatManager {
        constructor() {
            this.db = null;
            this.auth = null;
            this.currentUser = null;
            this.activeListeners = new Map(); // Track active conversation listeners

            // Feature flag
            this.CHAT_ENABLED = true;
        }

        /**
         * Initialize chat system
         */
        async init() {
            try {
                if (!this.CHAT_ENABLED) {
                    console.log('⚠️ Chat system is disabled');
                    return false;
                }

                this.db = window.firebaseDB || firebase.firestore();
                this.auth = window.firebaseAuth || firebase.auth();

                if (!this.db || !this.auth) {
                    throw new Error('Firebase לא מאותחל');
                }

                this.currentUser = this.auth.currentUser;
                if (!this.currentUser) {
                    throw new Error('משתמש לא מחובר');
                }

                console.log('✅ ChatManager initialized for user:', this.currentUser.uid);
                return true;

            } catch (error) {
                console.error('❌ שגיאה באתחול ChatManager:', error);
                return false;
            }
        }

        /**
         * יצירת ID ייחודי לשיחה בין שני משתמשים
         * השיחה תמיד תהיה באותו ID ללא קשר למי שולח למי
         * @param {string} userId1 - UID של משתמש ראשון
         * @param {string} userId2 - UID של משתמש שני
         * @returns {string} conversationId
         */
        getConversationId(userId1, userId2) {
            // Sort UIDs to ensure same conversation ID regardless of order
            const sorted = [userId1, userId2].sort();
            return `conv_${sorted[0]}_${sorted[1]}`;
        }

        /**
         * שלח הודעת צ'אט
         * @param {string} recipientUid - UID של הנמען
         * @param {string} text - תוכן ההודעה
         * @param {object} additionalData - נתונים נוספים (אופציונלי)
         */
        async sendChatMessage(recipientUid, text, additionalData = {}) {
            try {
                console.log('📤 ChatManager: Sending chat message...');
                console.log('👤 From:', this.currentUser.uid);
                console.log('👤 To:', recipientUid);
                console.log('💬 Text:', text);

                if (!this.CHAT_ENABLED) {
                    throw new Error('מערכת הצ\'אט כבויה');
                }

                // Validate inputs
                if (!recipientUid || !text || text.trim() === '') {
                    throw new Error('נתונים חסרים - נדרש recipientUid ותוכן הודעה');
                }

                // Get conversation ID
                const conversationId = this.getConversationId(this.currentUser.uid, recipientUid);
                console.log('🔑 Conversation ID:', conversationId);

                // Prepare message
                const message = {
                    from: {
                        uid: this.currentUser.uid,
                        name: this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'משתמש',
                        email: this.currentUser.email,
                        role: additionalData.fromRole || 'user'
                    },
                    to: {
                        uid: recipientUid,
                        name: additionalData.recipientName || 'משתמש',
                        email: additionalData.recipientEmail || '',
                        role: additionalData.recipientRole || 'user'
                    },
                    text: text.trim(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    readAt: null
                };

                // Add message to conversation's messages subcollection
                const messageRef = await this.db
                    .collection('conversations')
                    .doc(conversationId)
                    .collection('messages')
                    .add(message);

                console.log('✅ Message sent:', messageRef.id);

                // Update conversation metadata
                await this.updateConversationMetadata(
                    conversationId,
                    this.currentUser.uid,
                    recipientUid,
                    text.trim(),
                    additionalData
                );

                return {
                    success: true,
                    messageId: messageRef.id,
                    conversationId: conversationId,
                    message: 'הודעה נשלחה בהצלחה'
                };

            } catch (error) {
                console.error('❌ שגיאה בשליחת הודעת צ\'אט:', error);
                throw new Error('שגיאה בשליחת הודעה: ' + error.message);
            }
        }

        /**
         * עדכון metadata של השיחה (הודעה אחרונה, מונה הודעות שלא נקראו)
         */
        async updateConversationMetadata(conversationId, fromUid, toUid, lastMessageText, additionalData = {}) {
            try {
                const conversationRef = this.db.collection('conversations').doc(conversationId);
                const conversationDoc = await conversationRef.get();

                // Get current unread counts
                let unreadCount = {};
                if (conversationDoc.exists) {
                    unreadCount = conversationDoc.data().unreadCount || {};
                }

                // Increment unread count for recipient
                unreadCount[toUid] = (unreadCount[toUid] || 0) + 1;

                // Build metadata
                const metadata = {
                    participants: [fromUid, toUid],
                    participantNames: {
                        [fromUid]: this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'משתמש',
                        [toUid]: additionalData.recipientName || 'משתמש'
                    },
                    participantRoles: {
                        [fromUid]: additionalData.fromRole || 'user',
                        [toUid]: additionalData.recipientRole || 'user'
                    },
                    lastMessage: lastMessageText,
                    lastMessageFrom: fromUid,
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    unreadCount: unreadCount,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // Create or update conversation metadata
                await conversationRef.set(metadata, { merge: true });

                console.log('✅ Conversation metadata updated:', conversationId);

            } catch (error) {
                console.error('❌ שגיאה בעדכון metadata:', error);
                // Don't throw - this is not critical for message delivery
            }
        }

        /**
         * האזנה בזמן אמת להודעות בשיחה
         * @param {string} recipientUid - UID של הצד השני בשיחה
         * @param {function} onMessageReceived - callback לקבלת הודעה חדשה
         * @returns {function} unsubscribe function
         */
        listenToConversation(recipientUid, onMessageReceived) {
            try {
                const conversationId = this.getConversationId(this.currentUser.uid, recipientUid);
                console.log('👂 Setting up real-time listener for conversation:', conversationId);

                // Stop existing listener if any
                this.stopListeningToConversation(recipientUid);

                // Create new listener
                const unsubscribe = this.db
                    .collection('conversations')
                    .doc(conversationId)
                    .collection('messages')
                    .orderBy('createdAt', 'asc')
                    .onSnapshot((snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            if (change.type === 'added') {
                                const message = {
                                    id: change.doc.id,
                                    ...change.doc.data()
                                };

                                console.log('📨 New chat message received:', message.id);

                                if (onMessageReceived) {
                                    onMessageReceived(message);
                                }

                                // Mark as read if it's for me
                                if (message.to.uid === this.currentUser.uid && !message.isRead) {
                                    this.markMessageAsRead(conversationId, message.id);
                                }
                            }
                        });
                    }, (error) => {
                        console.error('❌ שגיאה במאזין צ\'אט:', error);
                    });

                // Store listener
                this.activeListeners.set(recipientUid, unsubscribe);

                return unsubscribe;

            } catch (error) {
                console.error('❌ שגיאה בהפעלת מאזין:', error);
                return null;
            }
        }

        /**
         * הפסק האזנה לשיחה מסוימת
         */
        stopListeningToConversation(recipientUid) {
            const unsubscribe = this.activeListeners.get(recipientUid);
            if (unsubscribe) {
                unsubscribe();
                this.activeListeners.delete(recipientUid);
                console.log('🛑 Stopped listening to conversation with:', recipientUid);
            }
        }

        /**
         * הפסק את כל המאזינים הפעילים
         */
        stopAllListeners() {
            this.activeListeners.forEach((unsubscribe, recipientUid) => {
                unsubscribe();
                console.log('🛑 Stopped listening to:', recipientUid);
            });
            this.activeListeners.clear();
        }

        /**
         * סמן הודעה כנקראה
         */
        async markMessageAsRead(conversationId, messageId) {
            try {
                await this.db
                    .collection('conversations')
                    .doc(conversationId)
                    .collection('messages')
                    .doc(messageId)
                    .update({
                        isRead: true,
                        readAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                // Decrement unread count in conversation metadata
                await this.decrementUnreadCount(conversationId, this.currentUser.uid);

                console.log('✅ Message marked as read:', messageId);

            } catch (error) {
                console.error('❌ שגיאה בסימון הודעה כנקראה:', error);
            }
        }

        /**
         * הקטנת מונה הודעות שלא נקראו
         */
        async decrementUnreadCount(conversationId, userUid) {
            try {
                const conversationRef = this.db.collection('conversations').doc(conversationId);
                const conversationDoc = await conversationRef.get();

                if (conversationDoc.exists) {
                    const data = conversationDoc.data();
                    let unreadCount = data.unreadCount || {};

                    if (unreadCount[userUid] && unreadCount[userUid] > 0) {
                        unreadCount[userUid] = Math.max(0, unreadCount[userUid] - 1);
                        await conversationRef.update({ unreadCount });
                    }
                }
            } catch (error) {
                console.error('❌ שגיאה בהקטנת מונה:', error);
            }
        }

        /**
         * טען היסטוריית הודעות מהשיחה
         * @param {string} recipientUid - UID של הצד השני
         * @param {number} limit - מספר הודעות מקסימלי
         * @returns {Array} messages
         */
        async getConversationHistory(recipientUid, limit = 50) {
            try {
                const conversationId = this.getConversationId(this.currentUser.uid, recipientUid);

                const snapshot = await this.db
                    .collection('conversations')
                    .doc(conversationId)
                    .collection('messages')
                    .orderBy('createdAt', 'asc')
                    .limit(limit)
                    .get();

                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                console.log(`📜 Loaded ${messages.length} messages from conversation:`, conversationId);
                return messages;

            } catch (error) {
                console.error('❌ שגיאה בטעינת היסטוריה:', error);
                return [];
            }
        }

        /**
         * קבל את כל השיחות של המשתמש הנוכחי
         * @param {number} limit - מספר שיחות מקסימלי
         * @returns {Array} conversations
         */
        async getMyConversations(limit = 50) {
            try {
                const snapshot = await this.db
                    .collection('conversations')
                    .where('participants', 'array-contains', this.currentUser.uid)
                    .orderBy('lastMessageAt', 'desc')
                    .limit(limit)
                    .get();

                const conversations = [];
                snapshot.forEach(doc => {
                    conversations.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                console.log(`💬 Found ${conversations.length} conversations`);
                return conversations;

            } catch (error) {
                console.error('❌ שגיאה בשליפת שיחות:', error);
                return [];
            }
        }

        /**
         * מחק שיחה שלמה (admin only)
         */
        async deleteConversation(conversationId) {
            try {
                // Delete all messages in subcollection
                const messagesSnapshot = await this.db
                    .collection('conversations')
                    .doc(conversationId)
                    .collection('messages')
                    .get();

                const batch = this.db.batch();
                messagesSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                // Delete conversation document
                batch.delete(this.db.collection('conversations').doc(conversationId));

                await batch.commit();
                console.log('🗑️ Conversation deleted:', conversationId);

                return { success: true, message: 'השיחה נמחקה בהצלחה' };

            } catch (error) {
                console.error('❌ שגיאה במחיקת שיחה:', error);
                throw new Error('שגיאה במחיקת שיחה: ' + error.message);
            }
        }

        /**
         * קבל מספר הודעות שלא נקראו עבור משתמש
         */
        getTotalUnreadCount(conversations) {
            let total = 0;
            conversations.forEach(conv => {
                const unreadCount = conv.unreadCount || {};
                total += (unreadCount[this.currentUser.uid] || 0);
            });
            return total;
        }

        /**
         * קבל את כל השיחות של המשתמש הנוכחי
         */
        async getConversations() {
            try {
                if (!this.currentUser) {
                    throw new Error('משתמש לא מחובר');
                }

                console.log('📋 Fetching conversations for user:', this.currentUser.uid);

                const snapshot = await this.db
                    .collection('conversations')
                    .where('participants', 'array-contains', this.currentUser.uid)
                    .orderBy('lastMessageAt', 'desc')
                    .get();

                const conversations = [];
                snapshot.forEach(doc => {
                    conversations.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                console.log(`✅ Found ${conversations.length} conversations`);
                return conversations;

            } catch (error) {
                console.error('❌ Error fetching conversations:', error);
                throw error;
            }
        }
    }

    // Make available globally
    window.ChatManager = ChatManager;

    // Auto-initialize when user is authenticated
    function initializeChatSystem() {
        if (!window.chatManager) {
            window.chatManager = new ChatManager();
            window.chatManager.init().then(success => {
                if (success) {
                    console.log('✅ Chat system ready');
                }
            });
        }
    }

    // Try to initialize immediately if already authenticated
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        initializeChatSystem();
    }

    // Listen for auth state changes
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                initializeChatSystem();
            }
        });
    }

})();
