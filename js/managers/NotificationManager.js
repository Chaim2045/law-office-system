/**
 * Notification Manager
 * מנהל התראות והודעות בזמן אמת
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Part of Law Office Management System
 *
 * תפקיד: קבלת והצגת הודעות מהמנהל בזמן אמת
 */

import { safeText } from '../modules/core-utils.js';

/**
 * NotificationManager Class
 * מנהל את כל הודעות ההתראות מהמנהל
 */
export class NotificationManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.messages = [];
        this.unreadCount = 0;
        this.listener = null;
        this.broadcastListener = null;

        // Feature flag
        this.MESSAGING_ENABLED = true;
    }

    /**
     * התחל האזנה להודעות בזמן אמת
     * @param {string} userId - UID של המשתמש המחובר
     */
    async startListening(userId) {
        try {
            if (!this.MESSAGING_ENABLED) {
                console.log('⚠️ Messaging system is disabled');
                return false;
            }

            this.db = window.firebaseDB || firebase.firestore();
            this.auth = window.firebaseAuth || firebase.auth();
            this.currentUser = userId;

            if (!this.db || !userId) {
                throw new Error('Firebase או userId לא זמינים');
            }

            // Listen for messages to this specific user
            this.listener = this.db.collection('messages')
                .where('to.uid', '==', userId)
                .orderBy('metadata.createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const message = { id: change.doc.id, ...change.doc.data() };
                            this.handleNewMessage(message);
                        }
                    });

                    this.updateMessagesList(snapshot);
                });

            // Also listen for broadcast messages
            this.broadcastListener = this.db.collection('messages')
                .where('toAll', '==', true)
                .orderBy('metadata.createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    this.updateMessagesList(snapshot);
                });

            console.log('✅ NotificationManager: Started listening for messages');
            return true;

        } catch (error) {
            console.error('❌ שגיאה בהאזנה להודעות:', error);
            return false;
        }
    }

    /**
     * עצור האזנה להודעות
     */
    stopListening() {
        if (this.listener) {
            this.listener();
            this.listener = null;
        }

        if (this.broadcastListener) {
            this.broadcastListener();
            this.broadcastListener = null;
        }

        console.log('🛑 NotificationManager: Stopped listening');
    }

    /**
     * טפל בהודעה חדשה שהגיעה
     * @param {object} message - ההודעה
     */
    handleNewMessage(message) {
        console.log('📨 הודעה חדשה התקבלה:', message);

        // Update unread count
        this.updateUnreadCount();

        // Show toast notification for urgent/high priority messages
        if (message.content?.priority === 'urgent' || message.content?.priority === 'high') {
            this.showToastNotification(message);
        }

        // Play notification sound (optional)
        this.playNotificationSound();

        // Update notification bell
        this.updateNotificationBell();

        // Add to notification bell system
        this.addToNotificationBell(message);
    }

    /**
     * הוסף להודעות של פעמון ההתראות
     * @param {object} message - ההודעה
     */
    addToNotificationBell(message) {
        if (!window.notificationBell) {
            return;
        }

        const iconMap = {
            info: 'fas fa-info-circle',
            alert: 'fas fa-bell',
            warning: 'fas fa-exclamation-triangle',
            urgent: 'fas fa-exclamation-circle'
        };

        const type = message.content?.type || 'info';
        const isUrgent = message.content?.priority === 'urgent' || message.content?.priority === 'high';

        window.notificationBell.addNotification(
            type,
            message.content?.title || 'הודעה חדשה',
            message.content?.body || '',
            isUrgent
        );
    }

    /**
     * הצג Toast Notification (הודעה צפה)
     * @param {object} message - ההודעה
     */
    showToastNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification message-toast';

        const priorityIcons = {
            low: 'fas fa-info-circle',
            medium: 'fas fa-bell',
            high: 'fas fa-exclamation-triangle',
            urgent: 'fas fa-exclamation-circle'
        };

        const priorityColors = {
            low: '#3b82f6',
            medium: '#f59e0b',
            high: '#ef4444',
            urgent: '#dc2626'
        };

        const priority = message.content?.priority || 'medium';
        const icon = priorityIcons[priority];
        const color = priorityColors[priority];

        toast.innerHTML = `
            <div class="toast-header" style="background: ${color};">
                <i class="${icon}"></i>
                <strong>${safeText(message.content?.title || 'הודעה חדשה')}</strong>
                <button class="toast-close" onclick="this.closest('.toast-notification').remove()">×</button>
            </div>
            <div class="toast-body">
                ${safeText(message.content?.body || '')}
            </div>
            ${message.from?.name ? `<div class="toast-from">מאת: ${safeText(message.from.name)}</div>` : ''}
            <div class="toast-actions">
                <button class="toast-btn" onclick="window.notificationManager.markAsRead('${message.id}'); this.closest('.toast-notification').remove();">
                    <i class="fas fa-check"></i>
                    סמן כנקרא
                </button>
            </div>
        `;

        document.body.appendChild(toast);

        // Animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, 10000);
    }

    /**
     * עדכן את רשימת ההודעות
     * @param {object} snapshot - Firestore snapshot
     */
    updateMessagesList(snapshot) {
        const newMessages = [];

        snapshot.forEach(doc => {
            newMessages.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Merge with existing messages (avoid duplicates)
        const existingIds = new Set(this.messages.map(m => m.id));
        newMessages.forEach(msg => {
            if (!existingIds.has(msg.id)) {
                this.messages.push(msg);
            }
        });

        // Sort by date (newest first)
        this.messages.sort((a, b) => {
            const dateA = a.metadata?.createdAt?.toDate?.() || new Date(0);
            const dateB = b.metadata?.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        this.updateUnreadCount();
    }

    /**
     * עדכן מספר הודעות שלא נקראו
     */
    async updateUnreadCount() {
        try {
            const unreadMessages = this.messages.filter(msg => {
                // Personal message
                if (msg.to?.uid === this.currentUser) {
                    return !msg.metadata?.isRead;
                }
                // Broadcast message
                if (msg.toAll) {
                    const readBy = msg.metadata?.readBy || [];
                    return !readBy.includes(this.currentUser);
                }
                return false;
            });

            this.unreadCount = unreadMessages.length;
            this.updateNotificationBell();

        } catch (error) {
            console.error('❌ שגיאה בעדכון מספר הודעות:', error);
        }
    }

    /**
     * עדכן את פעמון ההתראות
     */
    updateNotificationBell() {
        const bell = document.getElementById('notificationBell');
        if (!bell) return;

        const badge = bell.querySelector('.notification-badge') || bell.querySelector('#notificationCount');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
                badge.classList.remove('hidden');
                badge.style.display = 'block';
            } else {
                badge.classList.add('hidden');
                badge.style.display = 'none';
            }
        }
    }

    /**
     * סמן הודעה כנקראה
     * @param {string} messageId - ID של ההודעה
     */
    async markAsRead(messageId) {
        try {
            const message = this.messages.find(m => m.id === messageId);
            if (!message) return;

            // Personal message
            if (message.to?.uid === this.currentUser) {
                await this.db.collection('messages').doc(messageId).update({
                    'metadata.isRead': true,
                    'metadata.readAt': firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            // Broadcast message - add to readBy array
            else if (message.toAll) {
                await this.db.collection('messages').doc(messageId).update({
                    'metadata.readBy': firebase.firestore.FieldValue.arrayUnion(this.currentUser)
                });
            }

            // Update local
            const localMsg = this.messages.find(m => m.id === messageId);
            if (localMsg) {
                if (localMsg.metadata) {
                    localMsg.metadata.isRead = true;
                    localMsg.metadata.readAt = new Date();
                }
            }

            this.updateUnreadCount();
            console.log('✅ הודעה סומנה כנקראה:', messageId);

        } catch (error) {
            console.error('❌ שגיאה בסימון הודעה:', error);
        }
    }

    /**
     * סמן את כל ההודעות כנקראו
     */
    async markAllAsRead() {
        try {
            const batch = this.db.batch();
            let count = 0;

            for (const message of this.messages) {
                if (message.to?.uid === this.currentUser && !message.metadata?.isRead) {
                    const docRef = this.db.collection('messages').doc(message.id);
                    batch.update(docRef, {
                        'metadata.isRead': true,
                        'metadata.readAt': firebase.firestore.FieldValue.serverTimestamp()
                    });
                    count++;
                }
                else if (message.toAll) {
                    const readBy = message.metadata?.readBy || [];
                    if (!readBy.includes(this.currentUser)) {
                        const docRef = this.db.collection('messages').doc(message.id);
                        batch.update(docRef, {
                            'metadata.readBy': firebase.firestore.FieldValue.arrayUnion(this.currentUser)
                        });
                        count++;
                    }
                }
            }

            if (count > 0) {
                await batch.commit();
                console.log(`✅ ${count} הודעות סומנו כנקראו`);
            }

            this.updateUnreadCount();

        } catch (error) {
            console.error('❌ שגיאה בסימון כל ההודעות:', error);
        }
    }

    /**
     * קבל הודעות (עם פילטר)
     * @param {object} options - אופציות פילטור
     */
    getMessages(options = {}) {
        let filtered = [...this.messages];

        // Filter by read status
        if (options.unreadOnly) {
            filtered = filtered.filter(msg => {
                if (msg.to?.uid === this.currentUser) {
                    return !msg.metadata?.isRead;
                }
                if (msg.toAll) {
                    const readBy = msg.metadata?.readBy || [];
                    return !readBy.includes(this.currentUser);
                }
                return false;
            });
        }

        // Filter by priority
        if (options.priority) {
            filtered = filtered.filter(msg => msg.content?.priority === options.priority);
        }

        // Limit
        if (options.limit) {
            filtered = filtered.slice(0, options.limit);
        }

        return filtered;
    }

    /**
     * נגן צליל התראה
     */
    playNotificationSound() {
        // אופציונלי - ניתן להוסיף קובץ אודיו
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Ignore if sound fails (no permission or file missing)
            });
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * נקה את כל ההודעות (מקומית בלבד)
     */
    clearAllMessages() {
        this.messages = [];
        this.unreadCount = 0;
        this.updateNotificationBell();
    }
}

// Make available globally
window.NotificationManager = NotificationManager;

// Auto-initialize when user logs in
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
        if (user && !window.notificationManager) {
            window.notificationManager = new NotificationManager();
            window.notificationManager.startListening(user.uid);
        } else if (!user && window.notificationManager) {
            window.notificationManager.stopListening();
            window.notificationManager = null;
        }
    });
}

export default NotificationManager;
