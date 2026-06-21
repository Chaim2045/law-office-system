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
            this.isNewThread = false;  // Flag for new thread mode
            this.targetUser = null;    // Target user for new thread
        }

        /**
         * Open a new thread (first message to user)
         * פתיחת שיחה חדשה (הודעה ראשונה למשתמש)
         * @param {Object} userData - User data { to, toName }
         */
        async openNewThread(userData) {
            this.currentThreadId = null;  // אין עדיין message ID
            this.isNewThread = true;       // סימון שזו שיחה חדשה
            this.targetUser = userData;    // שמירת פרטי המשתמש
            this.currentOriginalMessage = null;

            console.log('📝 Opening new thread for user:', userData);

            // Create modal
            this.modalId = window.ModalManager.create({
                title: `✉️ הודעה חדשה ל-${userData.toName}`,
                content: this.renderNewThreadUI(),
                footer: '',
                size: 'large',
                onOpen: () => {
                    this.attachEventListeners();
                },
                onClose: () => {
                    this.close();
                }
            });

            console.log('📝 AdminThreadView opened in NEW THREAD mode');
        }

        /**
         * Render UI for new thread
         * רינדור ממשק למשתמש חדש
         */
        renderNewThreadUI() {
            // Get categories for dropdown
            const categories = window.MessageCategories ? window.MessageCategories.getAllCategories() : [];

            return `
                <div class="admin-thread-container">
                    <div class="admin-thread-messages" id="adminThreadMessages">
                        <!-- Empty state for new thread -->
                        <div class="admin-thread-no-replies">
                            <i class="fas fa-envelope-open-text" style="font-size: 48px; margin-bottom: 16px; opacity: 0.4;"></i>
                            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: rgba(0, 0, 0, 0.6);">שיחה חדשה</h3>
                            <p style="margin: 0; font-size: 14px;">בחר קטגוריה וכתוב את ההודעה למשתמש</p>
                        </div>

                        <!-- ✅ Category and Subject Selection -->
                        <div class="admin-message-metadata">
                            <div class="admin-message-field">
                                <label for="adminMessageCategory">קטגוריה *</label>
                                <select id="adminMessageCategory" class="admin-message-select" required>
                                    <option value="">בחר קטגוריה...</option>
                                    ${categories.map(cat => `
                                        <option value="${cat.id}" style="color: ${cat.color};">
                                            ${cat.icon} ${cat.name} - ${cat.description}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="admin-message-field">
                                <label for="adminMessageSubject">נושא (אופציונלי)</label>
                                <input
                                    type="text"
                                    id="adminMessageSubject"
                                    class="admin-message-input"
                                    placeholder="לדוגמה: דוח שעות חודש דצמבר"
                                    maxlength="100"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="admin-thread-input-container">
                        <textarea
                            id="adminThreadReplyInput"
                            class="admin-thread-input"
                            placeholder="כתוב הודעה ראשונה..."
                            rows="3"
                            maxlength="1000"
                        ></textarea>
                        <button class="admin-thread-send-btn" id="adminThreadSendBtn">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Open thread view for a specific message
         * @param {string} messageId - Message ID
         * @param {Object} originalMessage - Original message data (can be {to, toName} for new thread)
         */
        async open(messageId, originalMessage) {
            this.currentThreadId = messageId;
            this.currentOriginalMessage = originalMessage;

            // ✅ Check if this is a NEW thread or EXISTING thread
            const isNewThread = (messageId === null);
            this.isNewThread = isNewThread;
            this.targetUser = isNewThread ? originalMessage : null;

            // Create modal
            this.modalId = window.ModalManager.create({
                title: `💬 שיחה עם ${originalMessage.toName || originalMessage.to}`,
                content: isNewThread ? this.renderNewThreadUI() : this.renderThreadUI(),
                footer: '',
                size: 'large',
                onOpen: async () => {
                    if (!isNewThread) {
                        await this.loadAndListenToReplies();
                    }
                    this.attachEventListeners();
                },
                onClose: () => {
                    this.close();
                }
            });

            console.log('📖 AdminThreadView opened for message:', messageId, isNewThread ? '(NEW THREAD)' : '(EXISTING)');
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
            this.isNewThread = false;
            this.targetUser = null;

            console.log('🚪 AdminThreadView closed');
        }

        /**
         * Render thread UI
         */
        renderThreadUI() {
            return `
                <div class="admin-thread-container">
                    <div class="admin-thread-messages" id="adminThreadMessages">
                        <!-- Original message - WhatsApp bubble style -->
                        <div class="admin-thread-message admin-thread-message-admin">
                            <div class="admin-thread-message-bubble">
                                <div class="admin-thread-message-header">
                                    <strong>${this._escapeHTML(this.currentOriginalMessage.fromName || 'מנהל')}</strong>
                                    <span class="admin-thread-message-time">${this._escapeHTML(this.currentOriginalMessage.time || this._formatTime(this.currentOriginalMessage.createdAt))}</span>
                                </div>
                                <div class="admin-thread-message-content">
                                    ${this._escapeHTML(this.currentOriginalMessage.message || this.currentOriginalMessage.description || '')}
                                </div>
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
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Load and listen to replies
         */
        async loadAndListenToReplies() {
            console.log('🔍 Starting loadAndListenToReplies for thread:', this.currentThreadId);

            if (!this.currentThreadId) {
                console.error('❌ No thread ID set');
                return;
            }

            if (!window.alertCommManager) {
                console.error('❌ AlertCommunicationManager not available');
                return;
            }

            const loadingEl = document.getElementById('adminThreadLoading');
            console.log('📍 Loading element found:', !!loadingEl);

            if (loadingEl) {
                loadingEl.style.display = 'flex';
            }

            try {
                console.log('👂 Setting up real-time listener...');

                // Set up real-time listener
                this.unsubscribeReplies = window.alertCommManager.listenToThreadReplies(
                    this.currentThreadId,
                    (replies) => {
                        console.log(`📨 Received ${replies.length} replies from Firestore`);
                        console.log('Reply data:', replies);

                        this.replies = replies;
                        this.renderReplies(replies);

                        // Hide loading
                        const currentLoadingEl = document.getElementById('adminThreadLoading');
                        if (currentLoadingEl) {
                            console.log('✅ Hiding loading indicator');
                            currentLoadingEl.style.display = 'none';
                        }

                        // Scroll to bottom
                        this.scrollToBottom();
                    }
                );

                console.log('✅ Listener attached successfully');

                // Attach event listeners after UI is rendered
                this.attachEventListeners();

            } catch (error) {
                console.error('❌ Error loading thread replies:', error);

                // Hide loading and show error
                if (loadingEl) {
                    loadingEl.innerHTML = `
                        <div class="admin-thread-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            שגיאה בטעינת תשובות: ${error.message}
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

            if (!repliesList) {
                console.error('❌ adminThreadRepliesList element not found in DOM');
                console.log('Available elements:', {
                    modal: document.querySelector('.modal'),
                    modalContent: document.querySelector('.modal-content'),
                    allDivs: document.querySelectorAll('div[id*="Thread"]').length
                });
                return;
            }

            console.log(`📝 Rendering ${replies.length} replies...`);

            if (replies.length === 0) {
                repliesList.innerHTML = '<div class="admin-thread-no-replies">אין עדיין תגובות לשיחה זו</div>';
                return;
            }

            repliesList.innerHTML = replies.map(reply => {
                const isAdmin = reply.from === window.currentAdminUser?.email;
                const messageClass = isAdmin ? 'admin-thread-message-admin' : 'admin-thread-message-user';

                console.log(`  - Reply from: ${reply.from}, isAdmin: ${isAdmin}`);

                return `
                    <div class="admin-thread-message ${messageClass}">
                        <div class="admin-thread-message-bubble">
                            <div class="admin-thread-message-header">
                                <strong>${this._escapeHTML(reply.fromName || reply.from)}</strong>
                                <span class="admin-thread-message-time">${this._formatTime(reply.createdAt)}</span>
                            </div>
                            <div class="admin-thread-message-content">
                                ${this._escapeHTML(reply.message)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            console.log('✅ Replies rendered successfully');
        }

        /**
         * Send a reply (handles both new threads and existing threads)
         */
        async sendReply() {
            const textarea = document.getElementById('adminThreadReplyInput');
            const sendBtn = document.getElementById('adminThreadSendBtn');

            if (!textarea || !sendBtn) {
return;
}

            const replyText = textarea.value.trim();

            if (!replyText) {
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
                if (this.isNewThread) {
                    // ✅ שליחת הודעה ראשונה (יצירת document חדש)
                    console.log('📤 Sending first message to user:', this.targetUser);

                    // ✅ Get category and subject
                    const categorySelect = document.getElementById('adminMessageCategory');
                    const subjectInput = document.getElementById('adminMessageSubject');

                    const category = categorySelect ? categorySelect.value : null;
                    const subject = subjectInput ? subjectInput.value.trim() : null;

                    // Validate category
                    if (!category) {
                        if (window.notify) {
                            window.notify.error('נא לבחור קטגוריה');
                        } else {
                            alert('נא לבחור קטגוריה');
                        }
                        return;
                    }

                    const messageId = await window.alertCommManager.sendNewMessage(
                        this.targetUser.to,
                        this.targetUser.toName,
                        replyText,
                        category,      // ✅ Pass category
                        subject        // ✅ Pass subject
                    );

                    console.log(`✅ New thread created: ${messageId}`);

                    // סגירת המודל והצגת הודעת הצלחה
                    window.ModalManager.close(this.modalId);

                } else {
                    // ✅ תשובה להודעה קיימת
                    if (!this.currentThreadId) {
                        console.error('No thread ID');
                        return;
                    }

                    await window.alertCommManager.sendAdminReply(
                        this.currentThreadId,
                        replyText
                    );

                    // Clear textarea
                    textarea.value = '';
                    textarea.style.height = 'auto';

                    // Success notification (already shown by AlertCommunicationManager)
                    // The real-time listener will automatically add the reply to the view
                }

            } catch (error) {
                console.error('Error sending message:', error);

                // Error notification (already shown by AlertCommunicationManager)
                if (window.notify) {
                    window.notify.error('❌ שגיאה בשליחת ההודעה: ' + error.message);
                } else {
                    alert('שגיאה בשליחת ההודעה: ' + error.message);
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
            if (!date) {
return '';
}

            try {
                // Convert Firestore Timestamp to Date if needed
                let dateObj = date;
                if (date && typeof date.toDate === 'function') {
                    dateObj = date.toDate();
                } else if (!(date instanceof Date)) {
                    dateObj = new Date(date);
                }

                const now = new Date();
                const diffMs = now - dateObj;
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

                // Format as date
                return dateObj.toLocaleDateString('he-IL');

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
            // Routed to the shared SSOT escaper (js/core/escape-html.js).
            // Behavior change: now also escapes " and ' (the temp-div escaped only & < >);
            // null-guard narrows to null/undefined only — safe in HTML text/attribute contexts.
            return window.escapeHtml(str);
        }
    }

    // Export to global scope
    window.AdminThreadView = AdminThreadView;
    window.adminThreadView = new AdminThreadView();

    console.log('✅ AdminThreadView initialized');

})();
