/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AdminThreadView - Admin Thread-Based Message Conversations
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Displays full conversation thread between admin and user.
 * Shows original message + all replies in chronological order.
 *
 * Features:
 * ✅ Real-time updates (Firestore onSnapshot)
 * ✅ Clean chat-style UI
 * ✅ Reply input at bottom
 * ✅ Automatic scroll to bottom
 * ✅ Loading states
 * ✅ Error handling
 * ✅ Admin-specific styling
 *
 * Created: 2025-12-07
 * Part of Law Office Management System - Admin Panel
 */

(function() {
    'use strict';

    class AdminThreadView {
        constructor() {
            this.currentThreadId = null;
            this.currentOriginalMessage = null;
            this.unsubscribeReplies = null;
            this.replies = [];
            this.modalId = null;
        }

        /**
         * Open thread view for a specific message
         * @param {string} messageId - Message ID
         * @param {Object} originalMessage - Original message data
         */
        async open(messageId, originalMessage) {
            this.currentThreadId = messageId;
            this.currentOriginalMessage = originalMessage;

            // Create modal
            this.modalId = window.ModalManager.create({
                title: `💬 שיחה עם ${originalMessage.toName || originalMessage.to}`,
                content: this.renderThreadUI(),
                footer: '',
                size: 'xlarge',
                onOpen: async () => {
                    await this.loadAndListenToReplies();
                },
                onClose: () => {
                    this.close();
                }
            });

            console.log('📖 AdminThreadView opened for message:', messageId);
        }

        /**
         * Close thread view
         */
        close() {
            // Unsubscribe from real-time listener
            if (this.unsubscribeReplies) {
                this.unsubscribeReplies();
                this.unsubscribeReplies = null;
            }

            this.currentThreadId = null;
            this.currentOriginalMessage = null;
            this.replies = [];

            console.log('🚪 AdminThreadView closed');
        }

        /**
         * Render thread UI
         */
        renderThreadUI() {
            return `
                <div class="admin-thread-container">
                    <div class="admin-thread-messages" id="adminThreadMessages">
                        <!-- Original message -->
                        <div class="admin-thread-message admin-thread-message-admin">
                            <div class="admin-thread-message-header">
                                <strong>${this._escapeHTML(this.currentOriginalMessage.fromName || 'מנהל')}</strong>
                                <span class="admin-thread-message-time">${this._escapeHTML(this.currentOriginalMessage.time || this._formatTime(this.currentOriginalMessage.createdAt))}</span>
                            </div>
                            <div class="admin-thread-message-content">
                                ${this._escapeHTML(this.currentOriginalMessage.message || this.currentOriginalMessage.description || '')}
                            </div>
                        </div>

                        <!-- Replies will be added here -->
                        <div id="adminThreadRepliesList"></div>

                        <!-- Loading indicator -->
                        <div class="admin-thread-loading" id="adminThreadLoading">
                            <div class="admin-thread-spinner"></div>
                            <div>טוען תשובות...</div>
                        </div>
                    </div>

                    <div class="admin-thread-input-container">
                        <textarea
                            id="adminThreadReplyInput"
                            class="admin-thread-input"
                            placeholder="כתוב תשובה..."
                            rows="2"
                            maxlength="1000"
                        ></textarea>
                        <button class="admin-thread-send-btn" id="adminThreadSendBtn">
                            <i class="fas fa-paper-plane"></i>
                            שלח
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Load and listen to replies
         */
        async loadAndListenToReplies() {
            if (!this.currentThreadId) {
                console.error('No thread ID set');
                return;
            }

            if (!window.alertCommManager) {
                console.error('AlertCommunicationManager not available');
                return;
            }

            const loadingEl = document.getElementById('adminThreadLoading');
            if (loadingEl) {
                loadingEl.style.display = 'flex';
            }

            try {
                // Set up real-time listener
                this.unsubscribeReplies = window.alertCommManager.listenToThreadReplies(
                    this.currentThreadId,
                    (replies) => {
                        this.replies = replies;
                        this.renderReplies(replies);

                        // Hide loading
                        if (loadingEl) {
                            loadingEl.style.display = 'none';
                        }

                        // Scroll to bottom
                        this.scrollToBottom();
                    }
                );

                // Attach event listeners after UI is rendered
                this.attachEventListeners();

            } catch (error) {
                console.error('Error loading thread replies:', error);

                // Hide loading and show error
                if (loadingEl) {
                    loadingEl.innerHTML = `
                        <div class="admin-thread-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            שגיאה בטעינת תשובות
                        </div>
                    `;
                }
            }
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            // Send button
            const sendBtn = document.getElementById('adminThreadSendBtn');
            if (sendBtn) {
                // Remove existing listener if any
                const newBtn = sendBtn.cloneNode(true);
                sendBtn.parentNode.replaceChild(newBtn, sendBtn);

                newBtn.addEventListener('click', () => this.sendReply());
            }

            // Auto-resize textarea
            const textarea = document.getElementById('adminThreadReplyInput');
            if (textarea) {
                textarea.addEventListener('input', () => {
                    textarea.style.height = 'auto';
                    textarea.style.height = textarea.scrollHeight + 'px';
                });

                // Enter to send (Ctrl+Enter)
                textarea.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key === 'Enter') {
                        this.sendReply();
                    }
                });
            }
        }

        /**
         * Render replies list
         * @param {Array} replies - Array of reply objects
         */
        renderReplies(replies) {
            const repliesList = document.getElementById('adminThreadRepliesList');
            if (!repliesList) return;

            if (replies.length === 0) {
                repliesList.innerHTML = '';
                return;
            }

            repliesList.innerHTML = replies.map(reply => {
                const isAdmin = reply.from === window.currentAdminUser?.email;
                const messageClass = isAdmin ? 'admin-thread-message-admin' : 'admin-thread-message-user';

                return `
                    <div class="admin-thread-message ${messageClass}">
                        <div class="admin-thread-message-header">
                            <strong>${this._escapeHTML(reply.fromName || reply.from)}</strong>
                            <span class="admin-thread-message-time">${this._formatTime(reply.createdAt)}</span>
                        </div>
                        <div class="admin-thread-message-content">
                            ${this._escapeHTML(reply.message)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        /**
         * Send a reply
         */
        async sendReply() {
            const textarea = document.getElementById('adminThreadReplyInput');
            const sendBtn = document.getElementById('adminThreadSendBtn');

            if (!textarea || !sendBtn) return;

            const replyText = textarea.value.trim();

            if (!replyText) {
                return;
            }

            if (!this.currentThreadId) {
                console.error('No thread ID');
                return;
            }

            if (!window.alertCommManager) {
                console.error('AlertCommunicationManager not available');
                return;
            }

            // Disable button
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

            try {
                // Send reply using AlertCommunicationManager API
                await window.alertCommManager.sendAdminReply(
                    this.currentThreadId,
                    replyText
                );

                // Clear textarea
                textarea.value = '';
                textarea.style.height = 'auto';

                // Success notification (already shown by AlertCommunicationManager)
                // The real-time listener will automatically add the reply to the view

            } catch (error) {
                console.error('Error sending reply:', error);

                // Error notification (already shown by AlertCommunicationManager)
                if (window.notify) {
                    window.notify.error('❌ שגיאה בשליחת התגובה: ' + error.message);
                } else {
                    alert('שגיאה בשליחת התגובה: ' + error.message);
                }

            } finally {
                // Re-enable button
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> שלח';
            }
        }

        /**
         * Scroll to bottom of messages
         */
        scrollToBottom() {
            setTimeout(() => {
                const messagesContainer = document.getElementById('adminThreadMessages');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 100);
        }

        /**
         * Format timestamp for display
         * @param {Date|null} date - Date object
         * @returns {string} - Formatted time string
         */
        _formatTime(date) {
            if (!date) return '';

            try {
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins < 1) return 'עכשיו';
                if (diffMins < 60) return `לפני ${diffMins} דקות`;

                const diffHours = Math.floor(diffMins / 60);
                if (diffHours < 24) return `לפני ${diffHours} שעות`;

                const diffDays = Math.floor(diffHours / 24);
                if (diffDays < 7) return `לפני ${diffDays} ימים`;

                // Format as date
                return date.toLocaleDateString('he-IL');

            } catch (error) {
                console.error('Error formatting time:', error);
                return '';
            }
        }

        /**
         * Escape HTML to prevent XSS
         * @param {string} str - String to escape
         * @returns {string} - Escaped string
         */
        _escapeHTML(str) {
            if (!str) return '';

            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    }

    // Export to global scope
    window.AdminThreadView = AdminThreadView;
    window.adminThreadView = new AdminThreadView();

    console.log('✅ AdminThreadView initialized');

})();
