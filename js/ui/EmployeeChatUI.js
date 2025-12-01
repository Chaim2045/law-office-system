/**
 * Employee Chat UI
 * ממשק צ'אט לעובדים - תגובה למנהל
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Phase: Messaging System - Two-Way Chat
 *
 * תפקיד: חלון צ'אט לעובדים להשיב למנהל
 */

(function() {
    'use strict';

    /**
     * EmployeeChatUI Class
     * מנהל את ממשק הצ'אט לעובדים
     */
    class EmployeeChatUI {
        constructor() {
            this.chatManager = null;
            this.currentAdminUid = null; // UID של המנהל שאיתו מדברים
            this.adminName = 'מנהל המערכת';
            this.isOpen = false;
            this.messageListener = null;
        }

        /**
         * Initialize
         */
        async init() {
            // Wait for chatManager to be ready
            await this.waitForChatManager();
        }

        /**
         * חכה ל-ChatManager להיות מוכן
         */
        async waitForChatManager(maxAttempts = 20) {
            for (let i = 0; i < maxAttempts; i++) {
                if (window.chatManager) {
                    this.chatManager = window.chatManager;
                    console.log('✅ ChatManager זמין ומוכן לשימוש');
                    return true;
                }
                console.log(`⏳ ממתין ל-ChatManager... ניסיון ${i + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.error('❌ ChatManager לא זמין אחרי המתנה');
            return false;
        }

        /**
         * פתח חלון צ'אט עם המנהל
         * @param {string} adminUid - UID של המנהל
         * @param {string} adminName - שם המנהל
         */
        async openChat(adminUid, adminName = 'מנהל המערכת') {
            try {
                console.log('💬 Opening chat with admin:', adminUid);

                this.currentAdminUid = adminUid;
                this.adminName = adminName;
                this.isOpen = true;

                // Create chat window
                this.createChatWindow();

                // Load conversation history
                await this.loadConversationHistory();

                // Start listening for new messages
                this.startListeningToMessages();

            } catch (error) {
                console.error('❌ שגיאה בפתיחת צ\'אט:', error);
                this.showError('שגיאה בפתיחת חלון הצ\'אט');
            }
        }

        /**
         * צור את חלון הצ'אט
         */
        createChatWindow() {
            // Check if already exists
            if (document.querySelector('.chat-window-overlay.employee-chat')) {
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'chat-window-overlay employee-chat';

            // Get initials for avatar
            const initials = this.adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            overlay.innerHTML = `
                <div class="chat-window">
                    <!-- Chat Header -->
                    <div class="chat-header">
                        <div class="chat-header-left">
                            <div class="chat-user-avatar">${initials}</div>
                            <div class="chat-user-info">
                                <div class="chat-user-name">${this.adminName}</div>
                                <div class="chat-user-status">מחובר</div>
                            </div>
                        </div>
                        <div class="chat-header-actions">
                            <button class="chat-header-btn" id="closeChatBtn" title="סגור">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Messages Container -->
                    <div class="chat-messages-container" id="chatMessages">
                        <div class="chat-empty-state">
                            <div class="chat-empty-icon">
                                <i class="fas fa-comments"></i>
                            </div>
                            <div class="chat-empty-text">טוען הודעות...</div>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="chat-input-area">
                        <div class="chat-input-wrapper">
                            <button class="chat-emoji-btn" type="button">
                                😊
                            </button>
                            <textarea
                                id="chatInput"
                                class="chat-input"
                                placeholder="כתוב הודעה..."
                                rows="1"
                            ></textarea>
                        </div>
                        <button class="chat-send-btn" id="sendMessageBtn">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Attach event listeners
            this.attachEventListeners(overlay);

            // Show overlay
            setTimeout(() => overlay.classList.add('show'), 10);
        }

        /**
         * צרף event listeners
         */
        attachEventListeners(overlay) {
            const closeBtn = overlay.querySelector('#closeChatBtn');
            const sendBtn = overlay.querySelector('#sendMessageBtn');
            const input = overlay.querySelector('#chatInput');

            // Close button
            closeBtn.addEventListener('click', () => this.closeChat());

            // Send button
            sendBtn.addEventListener('click', () => this.sendMessage());

            // Enter to send (Shift+Enter for new line)
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize textarea
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 100) + 'px';
            });

            // Close on background click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeChat();
                }
            });

            // ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeChat();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        /**
         * טען היסטוריית שיחה
         */
        async loadConversationHistory() {
            try {
                if (!this.chatManager) {
                    throw new Error('ChatManager לא זמין');
                }

                const messages = await this.chatManager.getConversationHistory(this.currentAdminUid, 50);

                const container = document.querySelector('#chatMessages');
                if (!container) return;

                // Clear loading state
                container.innerHTML = '';

                if (messages.length === 0) {
                    container.innerHTML = `
                        <div class="chat-empty-state">
                            <div class="chat-empty-icon">
                                <i class="fas fa-comments"></i>
                            </div>
                            <div class="chat-empty-text">התחל שיחה חדשה</div>
                        </div>
                    `;
                    return;
                }

                // Display messages
                messages.forEach(msg => this.displayMessage(msg, false));

                // Scroll to bottom
                this.scrollToBottom();

            } catch (error) {
                console.error('❌ שגיאה בטעינת היסטוריה:', error);
            }
        }

        /**
         * התחל להאזין להודעות חדשות
         */
        startListeningToMessages() {
            if (!this.chatManager || !this.currentAdminUid) return;

            // Stop existing listener
            if (this.messageListener) {
                this.messageListener();
            }

            // Start new listener
            this.messageListener = this.chatManager.listenToConversation(
                this.currentAdminUid,
                (message) => {
                    console.log('📨 New message received in chat UI:', message.id);
                    this.displayMessage(message, true);
                }
            );
        }

        /**
         * הצג הודעה בצ'אט
         * @param {object} message - נתוני ההודעה
         * @param {boolean} isNew - האם זו הודעה חדשה שהגיעה עכשיו
         */
        displayMessage(message, isNew = false) {
            const container = document.querySelector('#chatMessages');
            if (!container) return;

            // Remove empty state if exists
            const emptyState = container.querySelector('.chat-empty-state');
            if (emptyState) {
                emptyState.remove();
            }

            // Check if message already exists (prevent duplicates)
            if (document.querySelector(`[data-message-id="${message.id}"]`)) {
                return;
            }

            // Determine if incoming or outgoing
            const currentUserUid = window.firebaseAuth?.currentUser?.uid;
            const isOutgoing = message.from.uid === currentUserUid;
            const direction = isOutgoing ? 'outgoing' : 'incoming';

            // Format time
            const timestamp = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();
            const timeStr = this.formatTime(timestamp);

            // Check if we need a date divider
            this.addDateDividerIfNeeded(container, timestamp);

            // Create message element
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${direction}`;
            messageEl.setAttribute('data-message-id', message.id);
            messageEl.setAttribute('data-timestamp', timestamp.getTime());

            messageEl.innerHTML = `
                <div class="chat-bubble">
                    <div class="chat-bubble-text">${this.escapeHtml(message.text)}</div>
                    <div class="chat-bubble-meta">
                        <span class="chat-bubble-time">${timeStr}</span>
                        ${isOutgoing ? `
                            <span class="chat-bubble-status">
                                <i class="fas fa-check-double ${message.isRead ? 'read' : ''}"></i>
                            </span>
                        ` : ''}
                    </div>
                </div>
            `;

            container.appendChild(messageEl);

            // Scroll to bottom (smooth for new messages)
            this.scrollToBottom(isNew);
        }

        /**
         * הוסף מפריד תאריך אם צריך
         */
        addDateDividerIfNeeded(container, messageDate) {
            const lastDivider = container.querySelector('.chat-date-divider:last-of-type');
            const lastMessage = container.querySelector('.chat-message:last-of-type');

            let shouldAddDivider = false;

            if (!lastDivider && !lastMessage) {
                // First message ever
                shouldAddDivider = true;
            } else if (lastMessage) {
                const lastMessageTimestamp = parseInt(lastMessage.getAttribute('data-timestamp'));
                const lastMessageDate = new Date(lastMessageTimestamp);

                // Check if dates are different
                if (lastMessageDate.toDateString() !== messageDate.toDateString()) {
                    shouldAddDivider = true;
                }
            }

            if (shouldAddDivider) {
                const divider = document.createElement('div');
                divider.className = 'chat-date-divider';
                divider.innerHTML = `
                    <div class="chat-date-label">${this.formatDate(messageDate)}</div>
                `;
                container.appendChild(divider);
            }
        }

        /**
         * עיצוב תאריך מלא
         */
        formatDate(date) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return 'היום';
            } else if (date.toDateString() === yesterday.toDateString()) {
                return 'אתמול';
            } else {
                return date.toLocaleDateString('he-IL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        }

        /**
         * שלח הודעה
         */
        async sendMessage() {
            const input = document.querySelector('#chatInput');
            const sendBtn = document.querySelector('#sendMessageBtn');

            if (!input || !sendBtn) return;

            const text = input.value.trim();
            if (!text) return;

            try {
                // Disable input
                sendBtn.disabled = true;
                input.disabled = true;

                // Send via ChatManager
                const result = await this.chatManager.sendChatMessage(
                    this.currentAdminUid,
                    text,
                    {
                        recipientName: this.adminName,
                        recipientRole: 'admin',
                        fromRole: 'employee'
                    }
                );

                console.log('✅ Message sent:', result.messageId);

                // Clear input
                input.value = '';
                input.style.height = 'auto';

                // Focus input
                input.focus();

            } catch (error) {
                console.error('❌ שגיאה בשליחת הודעה:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                this.showError('שגיאה בשליחת ההודעה: ' + (error.message || 'שגיאה לא ידועה'));
            } finally {
                // Re-enable input
                sendBtn.disabled = false;
                input.disabled = false;
            }
        }

        /**
         * גלילה לתחתית הצ'אט
         */
        scrollToBottom(smooth = true) {
            const container = document.querySelector('#chatMessages');
            if (!container) return;

            if (smooth) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            } else {
                container.scrollTop = container.scrollHeight;
            }
        }

        /**
         * סגור את חלון הצ'אט
         */
        closeChat() {
            const overlay = document.querySelector('.chat-window-overlay.employee-chat');
            if (!overlay) return;

            // Stop listening
            if (this.messageListener) {
                this.messageListener();
                this.messageListener = null;
            }

            // Close with animation
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);

            this.isOpen = false;
            this.currentAdminUid = null;
        }

        /**
         * עיצוב זמן
         */
        formatTime(date) {
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();

            if (isToday) {
                return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            } else {
                return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' +
                       date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            }
        }

        /**
         * Escape HTML
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * הצג הודעת שגיאה
         */
        showError(message) {
            if (window.notificationsUI) {
                window.notificationsUI.show(message, 'error');
            } else {
                alert(message);
            }
        }

        /**
         * הצג הודעת הצלחה
         */
        showSuccess(message) {
            if (window.notificationsUI) {
                window.notificationsUI.show(message, 'success');
            } else {
                alert(message);
            }
        }
    }

    // Make available globally
    window.EmployeeChatUI = EmployeeChatUI;
    window.employeeChatUI = new EmployeeChatUI();

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.employeeChatUI.init();
        });
    } else {
        window.employeeChatUI.init();
    }

})();
