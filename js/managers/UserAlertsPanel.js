/**
 * UserAlertsPanel - Employee Alerts System
 * מערכת התראות לעובדים
 *
 * נוצר: 2025-12-04
 * גרסה: 1.0.0
 *
 * תפקיד: הצגת התראות מהמנהל ואפשרות תגובה
 *
 * Features:
 * - Real-time listener להודעות חדשות
 * - Toast notifications על הודעות חדשות
 * - Dropdown panel עם רשימת הודעות
 * - Response modal לתגובות
 * - Badge counter
 */

(function() {
    'use strict';

    class UserAlertsPanel {
        constructor(firebaseDB) {
            if (!firebaseDB) {
                throw new Error('UserAlertsPanel: firebaseDB is required');
            }

            this.db = firebaseDB;
            this.currentUser = null;
            this.unreadCount = 0;
            this.messagesListener = null;
            this.isInitialized = false;
            this.container = null;

            console.log('✅ UserAlertsPanel: Initialized');
        }

        /**
         * Initialize with current user
         * אתחול עם משתמש נוכחי
         */
        async init(user) {
            this.currentUser = user;

            // Create UI elements
            this.createUI();

            // Start listening to messages
            this.listenToMessages();

            console.log('✅ UserAlertsPanel: User set', user.email);
        }

        /**
         * Create UI elements (bell icon, dropdown, etc.)
         * יצירת אלמנטי UI
         */
        createUI() {
            // Check if already exists
            if (document.getElementById('alertsDropdown')) {
                console.log('⚠️ UserAlertsPanel: UI already exists');
                return;
            }

            // Create dropdown and append to body (will be positioned near chat bell button)
            const dropdown = document.createElement('div');
            dropdown.className = 'alerts-dropdown';
            dropdown.id = 'alertsDropdown';
            dropdown.style.display = 'none';
            dropdown.style.position = 'fixed'; // Fixed positioning
            dropdown.style.zIndex = '10001'; // Above chat window

            dropdown.innerHTML = `
                <div class="alerts-dropdown-header">
                    <h3>
                        <i class="fas fa-bell"></i>
                        התראות (<span id="alertsCount">0</span>)
                    </h3>
                    <button class="mark-all-read-btn" id="markAllReadBtn" title="סמן הכל כנקרא">
                        <i class="fas fa-check-double"></i>
                    </button>
                </div>

                <div class="alerts-dropdown-body" id="alertsDropdownBody">
                    <div class="alerts-empty">
                        <i class="fas fa-inbox"></i>
                        <p>אין התראות חדשות</p>
                    </div>
                </div>

                <div class="alerts-dropdown-footer">
                    <a href="#" id="viewAllAlertsLink">
                        <i class="fas fa-history"></i>
                        צפה בכל ההתראות
                    </a>
                </div>
            `;

            document.body.appendChild(dropdown);
            this.container = dropdown;

            // Setup event listeners
            this.setupEventListeners();

            console.log('✅ UserAlertsPanel: UI created (dropdown only)');
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Mark all as read
            const markAllBtn = document.getElementById('markAllReadBtn');
            if (markAllBtn) {
                markAllBtn.addEventListener('click', () => {
                    this.markAllAsRead();
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                const dropdown = document.getElementById('alertsDropdown');
                const bellBtn = document.getElementById('aiNotificationsBtn');

                if (dropdown && bellBtn) {
                    if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
                        dropdown.style.display = 'none';
                    }
                }
            });

            console.log('✅ UserAlertsPanel: Event listeners setup');
        }

        /**
         * Toggle dropdown visibility
         * פתיחה/סגירה של dropdown
         */
        toggleDropdown() {
            const dropdown = document.getElementById('alertsDropdown');
            const bellButton = document.getElementById('aiNotificationsBtn');

            if (!dropdown) {
                console.error('Dropdown not found');
                return;
            }

            const isVisible = dropdown.style.display !== 'none';

            if (isVisible) {
                // Close dropdown
                dropdown.style.display = 'none';
            } else {
                // Open dropdown - position it below the bell button
                if (bellButton) {
                    const rect = bellButton.getBoundingClientRect();
                    dropdown.style.top = (rect.bottom + 8) + 'px';
                    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
                } else {
                    // Fallback: position at top-right
                    dropdown.style.top = '80px';
                    dropdown.style.right = '20px';
                }

                dropdown.style.display = 'block';
            }
        }

        /**
         * Listen to messages in real-time
         * האזנה להודעות בזמן אמת
         */
        listenToMessages() {
            if (!this.currentUser) {
                console.error('UserAlertsPanel: No user set');
                return;
            }

            // Listen to unread messages only
            this.messagesListener = this.db.collection('user_messages')
                .where('to', '==', this.currentUser.email)
                .where('read', '==', false)
                .orderBy('createdAt', 'desc')
                .onSnapshot(
                    snapshot => {
                        console.log(`📨 Received ${snapshot.size} messages`);

                        // Update UI
                        this.renderMessages(snapshot.docs);
                        this.updateBadge(snapshot.size);

                        // Show toast for NEW messages (not initial load)
                        if (this.isInitialized) {
                            snapshot.docChanges().forEach(change => {
                                if (change.type === 'added') {
                                    const msg = change.doc.data();
                                    this.showNewMessageNotification(msg);
                                }
                            });
                        }

                        this.isInitialized = true;
                    },
                    error => {
                        console.error('Error listening to messages:', error);
                        if (window.notify) {
                            window.notify.error('שגיאה בטעינת התראות');
                        }
                    }
                );

            console.log('✅ UserAlertsPanel: Listening to messages');
        }

        /**
         * Render messages in dropdown
         * רינדור הודעות ב-dropdown
         */
        renderMessages(docs) {
            const body = document.getElementById('alertsDropdownBody');
            const countSpan = document.getElementById('alertsCount');

            if (!body) {
return;
}

            if (docs.length === 0) {
                body.innerHTML = `
                    <div class="alerts-empty">
                        <i class="fas fa-inbox"></i>
                        <p>אין התראות חדשות</p>
                    </div>
                `;
                if (countSpan) {
countSpan.textContent = '0';
}
                return;
            }

            // Update count
            if (countSpan) {
countSpan.textContent = docs.length;
}

            // Render messages
            const messagesHTML = docs.map(doc => {
                const data = doc.data();
                const isUnread = data.read === false;
                const fromName = data.fromName || (data.from === 'system' ? 'מערכת' : data.from);
                const messageType = data.type || 'general';

                // Icon based on message type
                let icon = 'fa-bell';
                if (messageType === 'task_approval') {
icon = 'fa-check-circle';
} else if (messageType === 'task_rejection') {
icon = 'fa-times-circle';
}

                return `
                    <div class="alert-item ${isUnread ? 'unread' : ''}" data-message-id="${doc.id}">
                        <div class="alert-header">
                            <div class="alert-sender">
                                <i class="fas ${icon}"></i>
                                <strong>${this.escapeHtml(fromName)}</strong>
                            </div>
                            <div class="alert-time">${this.formatTime(data.createdAt)}</div>
                        </div>

                        <div class="alert-body">
                            <p>${this.escapeHtml(data.message)}</p>
                        </div>

                        <div class="alert-actions">
                            ${data.from !== 'system' ? `
                            <button class="btn-respond" onclick="window.userAlertsPanel.openResponseModal('${doc.id}', '${this.escapeHtml(data.message).replace(/'/g, "\\'")}', '${this.escapeHtml(fromName)}')">
                                <i class="fas fa-reply"></i>
                                השב
                            </button>
                            ` : ''}
                            <button class="btn-dismiss" onclick="window.userAlertsPanel.dismissMessage('${doc.id}')">
                                <i class="fas fa-check"></i>
                                הבנתי
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            body.innerHTML = messagesHTML;
        }

        /**
         * Update badge counter
         * עדכון badge
         */
        updateBadge(count) {
            this.unreadCount = count;

            // Update standalone badge (if exists)
            const badge = document.getElementById('alertsBadge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'block' : 'none';
            }

            // Update AI Chat window badge
            const aiChatBadge = document.getElementById('aiNotificationBadge');
            if (aiChatBadge) {
                aiChatBadge.textContent = count;
                aiChatBadge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        }

        /**
         * Show notification for new message
         * הצגת התראה על הודעה חדשה
         */
        showNewMessageNotification(msg) {
            if (!window.notify) {
return;
}

            window.notify.show({
                type: 'info',
                title: `🔔 הודעה חדשה מ-${msg.fromName}`,
                message: this.truncate(msg.message, 60),
                duration: 8000,
                onClick: () => {
                    this.toggleDropdown();
                }
            });

            // Play sound (optional)
            this.playNotificationSound();
        }

        /**
         * Play notification sound
         * השמעת צליל התראה
         */
        playNotificationSound() {
            try {
                // Simple beep sound (you can replace with custom audio file)
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRQ0PVqnn77BZGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFApGn+DyvmwaBS+F0fLPhDQGIG7A7+OZRA0PVqnn77BaGAhJo+TxwWwhBTWN1fPPfC0GI3fH8N2ePwsRYLnr66hRFA==');
                audio.volume = 0.3;
                audio.play().catch(() => {
                    // Ignore if autoplay blocked
                });
            } catch (error) {
                // Ignore sound errors
            }
        }

        /**
         * Open response modal
         * פתיחת modal לתגובה
         */
        openResponseModal(messageId, messageText, fromName) {
            // Remove existing modal if any
            const existingModal = document.getElementById('responseModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Create modal
            const modal = document.createElement('div');
            modal.id = 'responseModal';
            modal.className = 'response-modal';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>תגובה להודעה</h3>
                        <button class="modal-close" onclick="window.userAlertsPanel.closeResponseModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="modal-body">
                        <div class="original-message">
                            <div class="message-label">הודעה מ-${fromName}:</div>
                            <p>${messageText}</p>
                        </div>

                        <div class="response-form">
                            <label for="responseText">התגובה שלך:</label>
                            <textarea
                                id="responseText"
                                rows="4"
                                placeholder="כתוב את תגובתך כאן..."
                                autofocus
                            ></textarea>

                            <div class="quick-responses">
                                <button class="quick-response" onclick="document.getElementById('responseText').value = 'אדווח היום'">
                                    אדווח היום
                                </button>
                                <button class="quick-response" onclick="document.getElementById('responseText').value = 'טופל'">
                                    טופל
                                </button>
                                <button class="quick-response" onclick="document.getElementById('responseText').value = 'אטפל בזה מחר'">
                                    אטפל בזה מחר
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.userAlertsPanel.closeResponseModal()">
                            ביטול
                        </button>
                        <button class="btn btn-primary" onclick="window.userAlertsPanel.submitResponse('${messageId}')">
                            <i class="fas fa-paper-plane"></i>
                            שלח תשובה
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Show with animation
            requestAnimationFrame(() => {
                modal.classList.add('show');
            });

            // Focus textarea
            setTimeout(() => {
                const textarea = document.getElementById('responseText');
                if (textarea) {
textarea.focus();
}
            }, 100);

            // Close on overlay click
            modal.querySelector('.modal-overlay').addEventListener('click', () => {
                this.closeResponseModal();
            });

            // Close on ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeResponseModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        /**
         * Close response modal
         * סגירת modal
         */
        closeResponseModal() {
            const modal = document.getElementById('responseModal');
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            }
        }

        /**
         * Submit response
         * שליחת תגובה
         */
        async submitResponse(messageId) {
            const textarea = document.getElementById('responseText');
            const responseText = textarea?.value.trim();

            if (!responseText) {
                if (window.notify) {
                    window.notify.warning('אנא כתוב תגובה');
                }
                return;
            }

            // Show loading
            const loadingId = window.notify?.loading('שולח תשובה...');

            try {
                await this.db.collection('user_messages')
                    .doc(messageId)
                    .update({
                        response: responseText,
                        status: 'responded',
                        respondedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                // Success
                if (window.notify) {
                    window.notify.hide(loadingId);
                    window.notify.success('התשובה נשלחה בהצלחה!');
                }

                // Close modal
                this.closeResponseModal();

            } catch (error) {
                console.error('Error submitting response:', error);
                if (window.notify) {
                    window.notify.hide(loadingId);
                    window.notify.error('שגיאה בשליחת התשובה. נסה שוב.');
                }
            }
        }

        /**
         * Dismiss message (mark as dismissed)
         * סגירת הודעה
         */
        async dismissMessage(messageId) {
            try {
                await this.db.collection('user_messages')
                    .doc(messageId)
                    .update({
                        read: true,
                        readAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                if (window.notify) {
                    window.notify.success('ההודעה סומנה כנקראה');
                }

            } catch (error) {
                console.error('Error dismissing message:', error);
                if (window.notify) {
                    window.notify.error('שגיאה בעדכון ההודעה');
                }
            }
        }

        /**
         * Mark all messages as dismissed
         * סימון כל ההודעות כנקראו והסרתן
         */
        async markAllAsRead() {
            if (!this.currentUser) {
return;
}

            try {
                const snapshot = await this.db.collection('user_messages')
                    .where('to', '==', this.currentUser.email)
                    .where('read', '==', false)
                    .get();

                const batch = this.db.batch();
                snapshot.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        read: true,
                        readAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await batch.commit();

                if (window.notify) {
                    window.notify.success('כל ההודעות הוסרו');
                }

            } catch (error) {
                console.error('Error marking all as dismissed:', error);
                if (window.notify) {
                    window.notify.error('שגיאה בעדכון ההודעות');
                }
            }
        }

        /**
         * Utility: Format timestamp
         */
        formatTime(timestamp) {
            if (!timestamp) {
return '';
}

            try {
                const date = timestamp.toDate();
                const now = new Date();
                const diff = now - date;

                // Less than 1 minute
                if (diff < 60000) {
                    return 'עכשיו';
                }

                // Less than 1 hour
                if (diff < 3600000) {
                    const minutes = Math.floor(diff / 60000);
                    return `לפני ${minutes} דקות`;
                }

                // Less than 24 hours
                if (diff < 86400000) {
                    const hours = Math.floor(diff / 3600000);
                    return `לפני ${hours} שעות`;
                }

                // Less than 7 days
                if (diff < 604800000) {
                    const days = Math.floor(diff / 86400000);
                    return `לפני ${days} ימים`;
                }

                // Default: show date
                return date.toLocaleDateString('he-IL');
            } catch (error) {
                return '';
            }
        }

        /**
         * Utility: Truncate text
         */
        truncate(text, maxLength) {
            if (!text) {
return '';
}
            if (text.length <= maxLength) {
return text;
}
            return text.substring(0, maxLength) + '...';
        }

        /**
         * Utility: Escape HTML
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Cleanup - unsubscribe from listeners
         */
        cleanup() {
            if (this.messagesListener) {
                this.messagesListener();
                this.messagesListener = null;
            }

            // Remove UI
            if (this.container) {
                this.container.remove();
                this.container = null;
            }

            console.log('✅ UserAlertsPanel: Cleaned up');
        }
    }

    // Export to window
    window.UserAlertsPanel = UserAlertsPanel;

    console.log('✅ UserAlertsPanel: Class loaded');

})();
