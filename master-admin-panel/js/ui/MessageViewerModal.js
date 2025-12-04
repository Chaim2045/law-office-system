/**
 * MessageViewerModal
 * מודאל לצפייה מלאה בהודעה
 *
 * Created: 2025-12-03
 * Features:
 * - הצגה מלאה של הודעת הקשר
 * - סימון כנקראה
 * - תשובה (יצירת דיון)
 * - מעבר לדיון קיים
 * - מחיקה
 */

(function() {
    'use strict';

    class MessageViewerModal {
        constructor() {
            this.isOpen = false;
            this.modalElement = null;
            this.currentMessage = null;
            this.onClose = null;

            // References
            this.contextMessageManager = window.contextMessageManager;

            // Create modal element
            this.createModal();
        }

        /**
         * Create modal element
         */
        createModal() {
            const modal = document.createElement('div');
            modal.className = 'message-viewer-modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-envelope"></i>
                            <span id="messageTitle"></span>
                        </h3>
                        <button class="modal-close-btn" aria-label="סגור">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="modal-body">
                        <!-- Message Info -->
                        <div class="message-info">
                            <div class="info-row">
                                <span class="info-label">מאת:</span>
                                <span id="messageFrom" class="info-value"></span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">אל:</span>
                                <span id="messageTo" class="info-value"></span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">תאריך:</span>
                                <span id="messageDate" class="info-value"></span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">סוג:</span>
                                <span id="messageType" class="info-value"></span>
                            </div>
                            <div class="info-row" id="contextRow" style="display: none;">
                                <span class="info-label">הקשר:</span>
                                <span id="messageContext" class="info-value"></span>
                            </div>
                        </div>

                        <!-- Message Body -->
                        <div class="message-body-content">
                            <h4>תוכן ההודעה:</h4>
                            <div id="messageBody" class="message-text"></div>
                        </div>

                        <!-- Thread Info (if exists) -->
                        <div id="threadInfo" class="thread-info" style="display: none;">
                            <i class="fas fa-comments"></i>
                            <span>הודעה זו היא חלק מדיון קיים</span>
                            <button id="goToThreadBtn" class="btn btn-sm btn-secondary">
                                <i class="fas fa-arrow-left"></i>
                                עבור לדיון
                            </button>
                        </div>

                        <!-- Reply Box -->
                        <div id="replyBox" class="reply-box" style="display: none;">
                            <h4>תשובה:</h4>
                            <textarea id="replyText" class="form-control" rows="4" placeholder="כתוב את תשובתך..."></textarea>
                            <div class="reply-actions">
                                <button id="cancelReplyBtn" class="btn btn-secondary">
                                    <i class="fas fa-times"></i>
                                    ביטול
                                </button>
                                <button id="sendReplyBtn" class="btn btn-primary">
                                    <i class="fas fa-paper-plane"></i>
                                    שלח תשובה
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button id="markAsReadBtn" class="btn btn-secondary" style="display: none;">
                            <i class="fas fa-check"></i>
                            סמן כנקרא
                        </button>
                        <button id="replyBtn" class="btn btn-primary">
                            <i class="fas fa-reply"></i>
                            השב
                        </button>
                        <button id="createThreadBtn" class="btn btn-primary">
                            <i class="fas fa-comments"></i>
                            צור דיון
                        </button>
                        <button id="deleteMessageBtn" class="btn btn-danger">
                            <i class="fas fa-trash"></i>
                            מחק
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            this.modalElement = modal;

            // Setup events
            this.setupEvents();
        }

        /**
         * Setup event listeners
         */
        setupEvents() {
            // Close button
            this.modalElement.querySelector('.modal-close-btn').addEventListener('click', () => {
                this.close();
            });

            // Overlay click
            this.modalElement.querySelector('.modal-overlay').addEventListener('click', () => {
                this.close();
            });

            // Mark as read
            const markAsReadBtn = this.modalElement.querySelector('#markAsReadBtn');
            markAsReadBtn.addEventListener('click', async () => {
                await this.markAsRead();
            });

            // Reply button
            const replyBtn = this.modalElement.querySelector('#replyBtn');
            replyBtn.addEventListener('click', () => {
                this.showReplyBox();
            });

            // Cancel reply
            const cancelReplyBtn = this.modalElement.querySelector('#cancelReplyBtn');
            cancelReplyBtn.addEventListener('click', () => {
                this.hideReplyBox();
            });

            // Send reply
            const sendReplyBtn = this.modalElement.querySelector('#sendReplyBtn');
            sendReplyBtn.addEventListener('click', async () => {
                await this.sendReply();
            });

            // Create thread
            const createThreadBtn = this.modalElement.querySelector('#createThreadBtn');
            createThreadBtn.addEventListener('click', async () => {
                await this.createThread();
            });

            // Go to thread
            const goToThreadBtn = this.modalElement.querySelector('#goToThreadBtn');
            goToThreadBtn.addEventListener('click', () => {
                this.goToThread();
            });

            // Delete message
            const deleteMessageBtn = this.modalElement.querySelector('#deleteMessageBtn');
            deleteMessageBtn.addEventListener('click', async () => {
                await this.deleteMessage();
            });
        }

        /**
         * Open modal with message
         * @param {ContextMessage} message
         * @param {Function} onCloseCallback
         */
        open(message, onCloseCallback = null) {
            this.currentMessage = message;
            this.onClose = onCloseCallback;

            // Populate data
            this.populateData();

            // Show modal
            this.modalElement.style.display = 'flex';
            this.isOpen = true;

            // Auto-mark as read if unread
            if (!message.isRead) {
                setTimeout(() => {
                    this.markAsRead();
                }, 2000);
            }
        }

        /**
         * Populate modal with message data
         */
        populateData() {
            const msg = this.currentMessage;

            // Title
            this.modalElement.querySelector('#messageTitle').textContent = msg.title;

            // From
            const fromEl = this.modalElement.querySelector('#messageFrom');
            fromEl.textContent = msg.from.name;
            fromEl.innerHTML += ` <span class="role-badge role-${msg.from.role}">${this.getRoleLabel(msg.from.role)}</span>`;

            // To
            const toEl = this.modalElement.querySelector('#messageTo');
            toEl.textContent = msg.to.name;
            toEl.innerHTML += ` <span class="role-badge role-${msg.to.role}">${this.getRoleLabel(msg.to.role)}</span>`;

            // Date
            this.modalElement.querySelector('#messageDate').textContent = this.formatDate(msg.createdAt);

            // Type
            const typeEl = this.modalElement.querySelector('#messageType');
            typeEl.innerHTML = this.getTypeHTML(msg.messageType);

            // Context
            if (msg.context && msg.context.type) {
                const contextRow = this.modalElement.querySelector('#contextRow');
                contextRow.style.display = 'flex';
                const contextEl = this.modalElement.querySelector('#messageContext');
                contextEl.textContent = this.getContextLabel(msg.context.type);
            }

            // Body
            this.modalElement.querySelector('#messageBody').textContent = msg.body;

            // Thread info
            if (msg.threadCreated && msg.threadId) {
                this.modalElement.querySelector('#threadInfo').style.display = 'flex';
                this.modalElement.querySelector('#createThreadBtn').style.display = 'none';
                this.modalElement.querySelector('#replyBtn').style.display = 'none';
            } else {
                this.modalElement.querySelector('#threadInfo').style.display = 'none';
                this.modalElement.querySelector('#createThreadBtn').style.display = 'inline-flex';
                this.modalElement.querySelector('#replyBtn').style.display = 'inline-flex';
            }

            // Mark as read button
            const markAsReadBtn = this.modalElement.querySelector('#markAsReadBtn');
            if (!msg.isRead) {
                markAsReadBtn.style.display = 'inline-flex';
            } else {
                markAsReadBtn.style.display = 'none';
            }
        }

        /**
         * Show reply box
         */
        showReplyBox() {
            this.modalElement.querySelector('#replyBox').style.display = 'block';
            this.modalElement.querySelector('#replyText').focus();
        }

        /**
         * Hide reply box
         */
        hideReplyBox() {
            this.modalElement.querySelector('#replyBox').style.display = 'none';
            this.modalElement.querySelector('#replyText').value = '';
        }

        /**
         * Mark message as read
         */
        async markAsRead() {
            try {
                await this.contextMessageManager.markAsRead(this.currentMessage.id);

                // Update UI
                this.currentMessage.isRead = true;
                this.modalElement.querySelector('#markAsReadBtn').style.display = 'none';

                this.showToast('ההודעה סומנה כנקראה', 'success');

            } catch (error) {
                console.warn('Error marking as read:', error);
                this.showToast(error.message || 'שגיאה בסימון כנקראה', 'error');
            }
        }

        /**
         * Send reply (creates thread)
         */
        async sendReply() {
            const replyText = this.modalElement.querySelector('#replyText').value.trim();

            if (!replyText) {
                this.showToast('אנא כתוב תשובה', 'warning');
                return;
            }

            try {
                this.showLoading('שולח תשובה ויוצר דיון...');

                const threadId = await this.contextMessageManager.replyToMessage(
                    this.currentMessage.id,
                    replyText
                );

                this.hideLoading();
                this.showToast('תשובה נשלחה ודיון נוצר בהצלחה!', 'success');

                // Update message
                this.currentMessage.threadCreated = true;
                this.currentMessage.threadId = threadId;

                // Hide reply box
                this.hideReplyBox();

                // Update UI
                this.populateData();

                // Close and go to thread
                setTimeout(() => {
                    this.close();
                    this.goToThread(threadId);
                }, 1500);

            } catch (error) {
                this.hideLoading();
                console.warn('Error sending reply:', error);
                this.showToast(error.message || 'שגיאה בשליחת התשובה', 'error');
            }
        }

        /**
         * Create thread without replying
         */
        async createThread() {
            try {
                this.showLoading('יוצר דיון...');

                const threadId = await this.contextMessageManager.createThreadFromMessage(
                    this.currentMessage.id
                );

                this.hideLoading();
                this.showToast('דיון נוצר בהצלחה!', 'success');

                // Update message
                this.currentMessage.threadCreated = true;
                this.currentMessage.threadId = threadId;

                // Update UI
                this.populateData();

                // Close and go to thread
                setTimeout(() => {
                    this.close();
                    this.goToThread(threadId);
                }, 1500);

            } catch (error) {
                this.hideLoading();
                console.warn('Error creating thread:', error);
                this.showToast(error.message || 'שגיאה ביצירת הדיון', 'error');
            }
        }

        /**
         * Go to existing thread
         */
        goToThread(threadId = null) {
            const id = threadId || this.currentMessage.threadId;

            if (!id) {
                this.showToast('לא נמצא דיון', 'error');
                return;
            }

            // Open thread viewer modal
            if (window.threadViewerModal) {
                this.close();
                window.threadViewerModal.open(id);
            } else {
                this.showToast('מודול הדיונים לא נטען', 'error');
            }
        }

        /**
         * Delete message
         */
        async deleteMessage() {
            // Use toast confirmation instead of browser confirm
            this.showToast('לחץ שוב למחיקה סופית', 'warning');

            if (!this._deleteConfirmed) {
                this._deleteConfirmed = true;
                setTimeout(() => {
 this._deleteConfirmed = false;
}, 3000);
                return;
            }

            try {
                this.showLoading('מוחק הודעה...');

                await this.contextMessageManager.deleteMessage(this.currentMessage.id);

                this.hideLoading();
                this.showToast('ההודעה נמחקה בהצלחה', 'success');

                // Close modal
                setTimeout(() => {
                    this.close();
                }, 1000);

            } catch (error) {
                this.hideLoading();
                console.warn('Error deleting message:', error);
                this.showToast(error.message || 'שגיאה במחיקת ההודעה', 'error');
            }
        }

        /**
         * Close modal
         */
        close() {
            this.modalElement.style.display = 'none';
            this.isOpen = false;
            this.currentMessage = null;

            // Hide reply box
            this.hideReplyBox();

            // Call callback
            if (this.onClose) {
                this.onClose();
            }
        }

        /**
         * Helper: Get role label
         */
        getRoleLabel(role) {
            const labels = {
                'admin': 'מנהל',
                'lawyer': 'עורך דין',
                'secretary': 'מזכירה',
                'employee': 'עובד'
            };
            return labels[role] || role;
        }

        /**
         * Helper: Get type HTML
         */
        getTypeHTML(type) {
            const types = {
                'info': '<span class="badge badge-info"><i class="fas fa-info-circle"></i> מידע</span>',
                'reminder': '<span class="badge badge-warning"><i class="fas fa-clock"></i> תזכורת</span>',
                'warning': '<span class="badge badge-danger"><i class="fas fa-exclamation-triangle"></i> אזהרה</span>',
                'urgent': '<span class="badge badge-critical"><i class="fas fa-exclamation-circle"></i> דחוף</span>'
            };
            return types[type] || type;
        }

        /**
         * Helper: Get context label
         */
        getContextLabel(contextType) {
            const labels = {
                'missing_hours': 'חוסר דיווח שעות',
                'overdue_tasks': 'משימות באיחור',
                'inactive_user': 'משתמש לא פעיל',
                'incomplete_profile': 'פרופיל לא מלא'
            };
            return labels[contextType] || contextType;
        }

        /**
         * Helper: Format date
         */
        formatDate(timestamp) {
            if (!timestamp) {
return '';
}

            let date;
            if (timestamp.toDate) {
                date = timestamp.toDate();
            } else if (timestamp instanceof Date) {
                date = timestamp;
            } else {
                date = new Date(timestamp);
            }

            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) {
return 'עכשיו';
}
            if (diffMins < 60) {
return `לפני ${diffMins} דקות`;
}

            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) {
return `לפני ${diffHours} שעות`;
}

            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7) {
return `לפני ${diffDays} ימים`;
}

            return date.toLocaleDateString('he-IL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        /**
         * Show toast message
         */
        showToast(message, type = 'info') {
            if (window.Notifications) {
                window.Notifications.show(message, type);
            } else {
                // Fallback: console message instead of alert
                console.warn(`[${type.toUpperCase()}] ${message}`);
            }
        }

        /**
         * Show loading
         */
        showLoading(message) {
            // Simple implementation - can be improved
            const footer = this.modalElement.querySelector('.modal-footer');
            footer.innerHTML = `<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> ${message}</div>`;
        }

        /**
         * Hide loading
         */
        hideLoading() {
            // Re-setup events after hiding loading
            this.populateData();
        }
    }

    // Make available globally
    window.MessageViewerModal = MessageViewerModal;

    // Auto-create instance
    if (typeof window !== 'undefined') {
        window.messageViewerModal = new MessageViewerModal();
    }

})();
