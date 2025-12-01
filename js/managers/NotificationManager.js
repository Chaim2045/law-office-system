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

            console.log('🔍 NotificationManager: Starting to listen for userId:', userId);

            if (!this.db || !userId) {
                throw new Error('Firebase או userId לא זמינים');
            }

            // Listen for messages to this specific user
            console.log('📡 Setting up listener for personal messages (to.uid ==', userId + ')');
            this.listener = this.db.collection('messages')
                .where('to.uid', '==', userId)
                .orderBy('metadata.createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    console.log('📬 Personal messages snapshot received. Size:', snapshot.size);

                    snapshot.docChanges().forEach((change) => {
                        console.log('📝 Document change detected:', change.type, 'ID:', change.doc.id);

                        if (change.type === 'added') {
                            const message = { id: change.doc.id, ...change.doc.data() };
                            console.log('✉️ New personal message:', message);
                            this.handleNewMessage(message);
                        }
                    });

                    this.updateMessagesList(snapshot);
                }, (error) => {
                    console.error('❌ Error in personal messages listener:', error);
                });

            // Also listen for broadcast messages
            console.log('📡 Setting up listener for broadcast messages (toAll == true)');
            this.broadcastListener = this.db.collection('messages')
                .where('toAll', '==', true)
                .orderBy('metadata.createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    console.log('📢 Broadcast messages snapshot received. Size:', snapshot.size);

                    snapshot.docChanges().forEach((change) => {
                        console.log('📝 Broadcast change detected:', change.type, 'ID:', change.doc.id);

                        if (change.type === 'added') {
                            const message = { id: change.doc.id, ...change.doc.data() };
                            console.log('📣 New broadcast message:', message);
                            this.handleNewMessage(message);
                        }
                    });

                    this.updateMessagesList(snapshot);
                }, (error) => {
                    console.error('❌ Error in broadcast messages listener:', error);
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
        console.log('📊 Message priority:', message.content?.priority);
        console.log('🎯 Message type:', message.content?.type);

        // Update unread count
        this.updateUnreadCount();

        // Show toast notification for urgent/high priority messages
        const priority = message.content?.priority;
        console.log('🔔 Checking if should show toast. Priority:', priority);

        if (priority === 'urgent' || priority === 'high') {
            console.log('✅ Showing toast notification for priority:', priority);
            this.showToastNotification(message);
        } else {
            console.log('ℹ️ Not showing toast (priority is', priority + ', only showing for urgent/high)');
        }

        // Play notification sound (optional)
        this.playNotificationSound();

        // Update notification bell
        this.updateNotificationBell();

        // Add to notification bell system
        console.log('🔔 Adding to notification bell...');
        this.addToNotificationBell(message);
    }

    /**
     * הוסף להודעות של פעמון ההתראות
     * @param {object} message - ההודעה
     */
    addToNotificationBell(message) {
        if (!window.notificationBell) {
            console.warn('⚠️ notificationBell not available');
            return;
        }

        // Map message types to notification bell types
        const typeMap = {
            info: 'info',
            alert: 'critical',
            warning: 'critical',
            urgent: 'urgent'
        };

        const type = typeMap[message.content?.type] || 'info';
        const isUrgent = message.content?.priority === 'urgent' || message.content?.priority === 'high';

        // Get sender name (from.name instead of generic "מנהל המערכת")
        const senderName = message.from?.name || 'מנהל המערכת';
        const title = `💬 ${senderName}: ${message.content?.title || 'הודעה חדשה'}`;

        window.notificationBell.addNotification(
            type,
            title,
            message.content?.body || '',
            isUrgent
        );

        console.log('✅ הודעה נוספה לפעמון התראות:', title);
    }

    /**
     * הצג Toast Notification (הודעה צפה)
     * @param {object} message - ההודעה
     */
    showToastNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification message-toast';
        toast.id = `toast-${message.id}`;

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

        // Get sender name (e.g., "גיא שלח הודעה")
        const senderName = message.from?.name || 'מנהל המערכת';
        const senderMessage = `${senderName} שלח הודעה`;

        toast.innerHTML = `
            <div class="toast-header" style="background: ${color};">
                <i class="${icon}"></i>
                <strong>${safeText(senderMessage)}</strong>
                <button class="toast-close" onclick="window.notificationManager.dismissToast('${message.id}')">×</button>
            </div>
            <div class="toast-body">
                <div class="toast-message-title">${safeText(message.content?.title || '')}</div>
                <div class="toast-message-body">${safeText(message.content?.body || '')}</div>
            </div>
            <div class="toast-actions">
                <button class="toast-btn toast-btn-primary" onclick="window.notificationManager.openChatReply('${message.id}', '${message.from.uid}', '${senderName.replace(/'/g, "\\'")}')">
                    <i class="fas fa-reply"></i>
                    השב
                </button>
                <button class="toast-btn" onclick="window.notificationManager.markAsReadAndDismiss('${message.id}');">
                    <i class="fas fa-check"></i>
                    קראתי
                </button>
            </div>
        `;

        document.body.appendChild(toast);

        // Animation
        setTimeout(() => toast.classList.add('show'), 10);

        // NO AUTO-REMOVE - stays until user clicks "קראתי - סגור"
        console.log(`📌 Toast notification displayed (stays until read): ${senderMessage}`);
    }

    /**
     * סמן כנקרא וסגור Toast
     * @param {string} messageId - ID של ההודעה
     */
    async markAsReadAndDismiss(messageId) {
        await this.markAsRead(messageId);
        this.dismissToast(messageId);
    }

    /**
     * סגור Toast ללא סימון כנקרא
     * @param {string} messageId - ID של ההודעה
     */
    dismissToast(messageId) {
        const toast = document.getElementById(`toast-${messageId}`);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
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

    /**
     * פתח חלון צ'אט כדי להשיב למנהל
     * @param {string} messageId - ID של ההודעה המקורית
     * @param {string} adminUid - UID של המנהל
     * @param {string} adminName - שם המנהל
     */
    async openChatReply(messageId, adminUid, adminName) {
        console.log('💬 Opening chat to reply to admin:', adminUid, adminName);

        // Mark message as read
        await this.markAsReadAndDismiss(messageId);

        // Check if EmployeeChatUI is available
        if (!window.employeeChatUI) {
            console.error('❌ EmployeeChatUI לא זמין');
            alert('מערכת הצ\'אט לא זמינה כרגע');
            return;
        }

        // Open chat window
        window.employeeChatUI.openChat(adminUid, adminName);
    }
}

// Make available globally
window.NotificationManager = NotificationManager;

// Auto-initialize when user logs in
async function initializeNotificationManager() {
    try {
        console.log('🔍 Attempting to initialize NotificationManager...');

        // Wait for Firebase to be available
        if (typeof firebase === 'undefined') {
            console.warn('⚠️ Firebase not loaded yet, waiting...');
            setTimeout(initializeNotificationManager, 500);
            return;
        }

        if (!firebase.auth) {
            console.warn('⚠️ Firebase Auth not available yet, waiting...');
            setTimeout(initializeNotificationManager, 500);
            return;
        }

        const auth = firebase.auth();

        // Check if already authenticated
        const currentUser = auth.currentUser;
        if (currentUser && !window.notificationManager) {
            console.log('✅ User already authenticated, initializing NotificationManager...');
            window.notificationManager = new NotificationManager();
            await window.notificationManager.startListening(currentUser.uid);
        }

        // Listen for future auth changes
        auth.onAuthStateChanged(async (user) => {
            console.log('🔐 Auth state changed:', user ? `User: ${user.uid}` : 'No user');

            if (user && !window.notificationManager) {
                console.log('✅ User logged in, initializing NotificationManager...');
                window.notificationManager = new NotificationManager();
                await window.notificationManager.startListening(user.uid);
            } else if (!user && window.notificationManager) {
                console.log('🚪 User logged out, stopping NotificationManager...');
                window.notificationManager.stopListening();
                window.notificationManager = null;
            }
        });

        console.log('✅ NotificationManager auto-initialization setup complete');

    } catch (error) {
        console.error('❌ Error initializing NotificationManager:', error);
    }
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationManager);
} else {
    initializeNotificationManager();
}

export default NotificationManager;
