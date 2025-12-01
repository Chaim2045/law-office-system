/**
 * Messaging Manager
 * מנהל הודעות - שליחה, קבלה, ומעקב
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Phase: Messaging System
 *
 * תפקיד: ניהול מערכת הודעות מהמנהל לעובדים
 */

(function() {
    'use strict';

    /**
     * MessagingManager Class
     * מנהל את כל פעולות ההודעות
     */
    class MessagingManager {
        constructor() {
            this.db = null;
            this.auth = null;
            this.currentUser = null;

            // Feature flag - ניתן לכבות את המערכת
            this.MESSAGING_ENABLED = true;
        }

        /**
         * Initialize messaging system
         */
        async init() {
            try {
                if (!this.MESSAGING_ENABLED) {
                    console.log('⚠️ Messaging system is disabled');
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

                console.log('✅ MessagingManager initialized');
                return true;

            } catch (error) {
                console.error('❌ שגיאה באתחול MessagingManager:', error);
                return false;
            }
        }

        /**
         * שלח הודעה למשתמש ספציפי
         * @param {string} userId - UID של המשתמש
         * @param {object} messageData - נתוני ההודעה
         */
        async sendMessageToUser(userId, messageData) {
            try {
                if (!this.MESSAGING_ENABLED) {
                    throw new Error('מערכת ההודעות כבויה');
                }

                // Validate inputs
                if (!userId || !messageData.title || !messageData.body) {
                    throw new Error('נתונים חסרים - נדרש userId, title, body');
                }

                const message = {
                    from: {
                        uid: this.currentUser.uid,
                        email: this.currentUser.email,
                        name: messageData.fromName || 'מנהל המערכת',
                        role: 'admin'
                    },
                    to: {
                        uid: userId,
                        name: messageData.recipientName || 'משתמש',
                        email: messageData.recipientEmail || '',
                        role: messageData.recipientRole || 'employee'
                    },
                    content: {
                        title: messageData.title,
                        body: messageData.body,
                        type: messageData.type || 'info', // info, alert, warning, urgent
                        priority: messageData.priority || 'medium' // low, medium, high, urgent
                    },
                    metadata: {
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isRead: false,
                        readAt: null
                    },
                    action: messageData.action || null // אופציונלי - כפתור פעולה
                };

                const docRef = await this.db.collection('messages').add(message);

                console.log('✅ הודעה נשלחה בהצלחה:', docRef.id);

                return {
                    success: true,
                    messageId: docRef.id,
                    message: 'ההודעה נשלחה בהצלחה'
                };

            } catch (error) {
                console.error('❌ שגיאה בשליחת הודעה:', error);
                throw new Error('שגיאה בשליחת הודעה: ' + error.message);
            }
        }

        /**
         * שלח הודעה לכל המשתמשים (Broadcast)
         * @param {object} messageData - נתוני ההודעה
         */
        async broadcastMessage(messageData) {
            try {
                if (!this.MESSAGING_ENABLED) {
                    throw new Error('מערכת ההודעות כבויה');
                }

                // Validate inputs
                if (!messageData.title || !messageData.body) {
                    throw new Error('נתונים חסרים - נדרש title, body');
                }

                const message = {
                    from: {
                        uid: this.currentUser.uid,
                        email: this.currentUser.email,
                        name: messageData.fromName || 'מנהל המערכת',
                        role: 'admin'
                    },
                    toAll: true, // הודעה לכולם
                    content: {
                        title: messageData.title,
                        body: messageData.body,
                        type: messageData.type || 'info',
                        priority: messageData.priority || 'medium'
                    },
                    metadata: {
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        readBy: [] // רשימת UIDs שקראו
                    },
                    action: messageData.action || null
                };

                const docRef = await this.db.collection('messages').add(message);

                console.log('📢 הודעה שודרה לכולם:', docRef.id);

                return {
                    success: true,
                    messageId: docRef.id,
                    message: 'ההודעה שודרה לכל המשתמשים'
                };

            } catch (error) {
                console.error('❌ שגיאה בשידור הודעה:', error);
                throw new Error('שגיאה בשידור הודעה: ' + error.message);
            }
        }

        /**
         * שלח הודעה לפי תפקיד (עורכי דין, מזכירות וכו')
         * @param {string|array} roles - תפקיד או רשימת תפקידים
         * @param {object} messageData - נתוני ההודעה
         */
        async sendMessageToRole(roles, messageData) {
            try {
                if (!this.MESSAGING_ENABLED) {
                    throw new Error('מערכת ההודעות כבויה');
                }

                // Validate inputs
                if (!roles || !messageData.title || !messageData.body) {
                    throw new Error('נתונים חסרים - נדרש roles, title, body');
                }

                // Convert single role to array
                const rolesArray = Array.isArray(roles) ? roles : [roles];

                const message = {
                    from: {
                        uid: this.currentUser.uid,
                        email: this.currentUser.email,
                        name: messageData.fromName || 'מנהל המערכת',
                        role: 'admin'
                    },
                    toRoles: rolesArray,
                    content: {
                        title: messageData.title,
                        body: messageData.body,
                        type: messageData.type || 'info',
                        priority: messageData.priority || 'medium'
                    },
                    metadata: {
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        readBy: []
                    },
                    action: messageData.action || null
                };

                const docRef = await this.db.collection('messages').add(message);

                console.log(`👥 הודעה נשלחה לתפקידים: ${rolesArray.join(', ')}`, docRef.id);

                return {
                    success: true,
                    messageId: docRef.id,
                    message: `ההודעה נשלחה לתפקידים: ${rolesArray.join(', ')}`
                };

            } catch (error) {
                console.error('❌ שגיאה בשליחת הודעה לתפקיד:', error);
                throw new Error('שגיאה בשליחת הודעה: ' + error.message);
            }
        }

        /**
         * שלח הודעה מהירה (shortcut)
         * @param {string} type - 'user', 'all', או 'role'
         * @param {string} target - userId או role
         * @param {string} title - כותרת
         * @param {string} body - תוכן
         */
        async sendQuickMessage(type, target, title, body, priority = 'medium') {
            const messageData = { title, body, priority };

            switch (type) {
                case 'user':
                    return await this.sendMessageToUser(target, messageData);
                case 'all':
                    return await this.broadcastMessage(messageData);
                case 'role':
                    return await this.sendMessageToRole(target, messageData);
                default:
                    throw new Error('סוג הודעה לא חוקי');
            }
        }

        /**
         * מחק הודעה
         * @param {string} messageId - ID של ההודעה
         */
        async deleteMessage(messageId) {
            try {
                await this.db.collection('messages').doc(messageId).delete();
                console.log('🗑️ הודעה נמחקה:', messageId);
                return { success: true, message: 'ההודעה נמחקה בהצלחה' };
            } catch (error) {
                console.error('❌ שגיאה במחיקת הודעה:', error);
                throw new Error('שגיאה במחיקת הודעה: ' + error.message);
            }
        }

        /**
         * שלוף את כל ההודעות ששלחתי (למעקב מנהל)
         * @param {number} limit - מספר הודעות מקסימלי
         */
        async getSentMessages(limit = 50) {
            try {
                const snapshot = await this.db.collection('messages')
                    .where('from.uid', '==', this.currentUser.uid)
                    .orderBy('metadata.createdAt', 'desc')
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
                console.error('❌ שגיאה בשליפת הודעות:', error);
                throw error;
            }
        }

        /**
         * קבל סטטיסטיקות הודעות
         */
        async getMessagingStats() {
            try {
                const messages = await this.getSentMessages(1000);

                const stats = {
                    total: messages.length,
                    byType: {},
                    byPriority: {},
                    unread: 0,
                    broadcast: 0,
                    individual: 0
                };

                messages.forEach(msg => {
                    // Count by type
                    const type = msg.content?.type || 'info';
                    stats.byType[type] = (stats.byType[type] || 0) + 1;

                    // Count by priority
                    const priority = msg.content?.priority || 'medium';
                    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

                    // Count broadcast vs individual
                    if (msg.toAll) {
                        stats.broadcast++;
                    } else {
                        stats.individual++;
                    }

                    // Count unread (for individual messages)
                    if (msg.to && !msg.metadata?.isRead) {
                        stats.unread++;
                    }
                });

                return stats;
            } catch (error) {
                console.error('❌ שגיאה בסטטיסטיקות:', error);
                return null;
            }
        }
    }

    // Make available globally
    window.MessagingManager = MessagingManager;

    // Auto-initialize when user is authenticated
    function initializeMessagingSystem() {
        if (!window.messagingManager) {
            window.messagingManager = new MessagingManager();
            window.messagingManager.init().then(success => {
                if (success) {
                    console.log('✅ Messaging system ready');
                }
            });
        }
    }

    // Try to initialize immediately if already authenticated
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        initializeMessagingSystem();
    }

    // Listen for auth state changes
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                initializeMessagingSystem();
            }
        });
    }

})();
