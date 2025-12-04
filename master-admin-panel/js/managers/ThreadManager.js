/**
 * ThreadManager
 * מנהל דיונים - Threads (Conversations)
 *
 * Created: 2025-12-04
 * Purpose: ניהול דיונים באמצעות Cloud Functions
 *
 * Thread = שרשור של הודעות בין משתתפים
 * כל Thread מתחיל מ-Context Message או נוצר באופן ישיר
 */

(function() {
    'use strict';

    class ThreadManager {
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
                console.error('❌ ThreadManager init failed:', error);
                return false;
            }
        }

        /**
         * Create new thread
         * צור דיון חדש
         */
        async createThread(data) {
            try {
                const createThread = this.functions.httpsCallable('messaging_createThread');
                const result = await createThread(data);

                return result.data;
            } catch (error) {
                console.error('❌ Error creating thread:', error);
                throw error;
            }
        }

        /**
         * Get thread by ID
         * קבל דיון לפי ID
         */
        async getThread(threadId) {
            try {
                const doc = await this.db.collection('threads').doc(threadId).get();

                if (!doc.exists) {
                    throw new Error('Thread not found');
                }

                return {
                    id: doc.id,
                    ...doc.data()
                };
            } catch (error) {
                console.error('❌ Error getting thread:', error);
                throw error;
            }
        }

        /**
         * Get my threads
         * קבל את הדיונים שלי
         */
        async getMyThreads(options = {}) {
            try {
                const getUserThreads = this.functions.httpsCallable('messaging_getUserThreads');
                const result = await getUserThreads(options);

                return result.data.threads || [];
            } catch (error) {
                console.error('❌ Error getting threads:', error);
                return [];
            }
        }

        /**
         * Get thread messages
         * קבל הודעות של דיון
         */
        async getMessages(threadId, limit = 50) {
            try {
                const getMessages = this.functions.httpsCallable('messaging_getThreadMessages');
                const result = await getMessages({ threadId, limit });

                return result.data.messages || [];
            } catch (error) {
                console.error('❌ Error getting thread messages:', error);
                return [];
            }
        }

        /**
         * Send message to thread
         * שלח הודעה לדיון
         */
        async sendMessage(threadId, content) {
            try {
                const addMessage = this.functions.httpsCallable('messaging_addMessageToThread');
                const result = await addMessage({
                    threadId,
                    content
                });

                return result.data;
            } catch (error) {
                console.error('❌ Error sending message:', error);
                throw error;
            }
        }

        /**
         * Add participant to thread
         * הוסף משתתף לדיון
         */
        async addParticipant(threadId, userId) {
            try {
                const addParticipant = this.functions.httpsCallable('messaging_addParticipantToThread');
                const result = await addParticipant({
                    threadId,
                    userId
                });

                return result.data;
            } catch (error) {
                console.error('❌ Error adding participant:', error);
                throw error;
            }
        }

        /**
         * Update thread status (close, reopen, archive)
         * עדכן סטטוס דיון
         */
        async updateStatus(threadId, status) {
            try {
                const updateStatus = this.functions.httpsCallable('messaging_updateThreadStatus');
                const result = await updateStatus({
                    threadId,
                    status
                });

                return result.data;
            } catch (error) {
                console.error('❌ Error updating thread status:', error);
                throw error;
            }
        }

        /**
         * Close thread
         * סגור דיון
         */
        async closeThread(threadId) {
            return await this.updateStatus(threadId, 'closed');
        }

        /**
         * Reopen thread
         * פתח מחדש דיון
         */
        async reopenThread(threadId) {
            return await this.updateStatus(threadId, 'open');
        }

        /**
         * Archive thread
         * העבר דיון לארכיון
         */
        async archiveThread(threadId) {
            return await this.updateStatus(threadId, 'archived');
        }

        /**
         * Delete thread
         * מחק דיון
         */
        async deleteThread(threadId) {
            try {
                const deleteThread = this.functions.httpsCallable('messaging_deleteThread');
                const result = await deleteThread({ threadId });

                return result.data;
            } catch (error) {
                console.error('❌ Error deleting thread:', error);
                throw error;
            }
        }

        /**
         * Mark thread as read
         * סמן דיון כנקרא
         */
        async markAsRead(threadId) {
            try {
                const markAsRead = this.functions.httpsCallable('messaging_markThreadAsRead');
                const result = await markAsRead({ threadId });

                return result.data;
            } catch (error) {
                console.error('❌ Error marking thread as read:', error);
                throw error;
            }
        }

        /**
         * Listen to thread messages in real-time
         * האזן להודעות בדיון בזמן אמת
         */
        listenToMessages(threadId, callback) {
            try {
                const unsubscribe = this.db.collection('threads')
                    .doc(threadId)
                    .collection('messages')
                    .orderBy('createdAt', 'asc')
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
                console.error('❌ Error listening to thread messages:', error);
                return () => {}; // Return empty function
            }
        }

        /**
         * Listen to threads list in real-time
         * האזן לרשימת דיונים בזמן אמת
         */
        listenToThreads(callback) {
            try {
                const unsubscribe = this.db.collection('threads')
                    .where('participantIds', 'array-contains', this.currentUser.uid)
                    .orderBy('lastMessageAt', 'desc')
                    .limit(50)
                    .onSnapshot((snapshot) => {
                        const threads = [];
                        snapshot.forEach(doc => {
                            threads.push({
                                id: doc.id,
                                ...doc.data()
                            });
                        });
                        callback(threads);
                    });

                return unsubscribe;
            } catch (error) {
                console.error('❌ Error listening to threads:', error);
                return () => {}; // Return empty function
            }
        }
    }

    // Create global instance
    window.ThreadManager = ThreadManager;

    // Auto-initialize
    if (typeof window !== 'undefined') {
        const manager = new ThreadManager();
        manager.init().then(success => {
            if (success) {
                window.threadManager = manager;
                console.log('✅ ThreadManager ready');
            }
        });
    }

})();
