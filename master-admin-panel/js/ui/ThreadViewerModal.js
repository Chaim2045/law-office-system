/**
 * ThreadViewerModal
 * מודאל לצפייה מלאה בדיון (Thread)
 *
 * Created: 2025-12-03
 * Features:
 * - הצגת כל הודעות הדיון בזמן אמת
 * - שליחת הודעות חדשות
 * - הוספת משתתפים
 * - סגירת/פתיחת דיון
 * - מחיקת דיון (admin only)
 */

(function() {
    'use strict';

    class ThreadViewerModal {
        constructor() {
            this.isOpen = false;
            this.modalElement = null;
            this.currentThread = null;
            this.currentThreadId = null;
            this.messages = [];
            this.unsubscribeMessages = null;
            this.onClose = null;

            // References
            this.threadManager = window.threadManager;

            // Create modal element
            this.createModal();
        }

        /**
         * Create modal element
         */
        createModal() {
            const modal = document.createElement('div');
            modal.className = 'thread-viewer-modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-container">
                    <!-- Header -->
                    <div class="modal-header">
                        <div class="thread-header-info">
                            <h3 class="modal-title">
                                <i class="fas fa-comments"></i>
                                <span id="threadTitle"></span>
                            </h3>
                            <div class="thread-meta">
                                <span id="threadCategory" class="thread-badge"></span>
                                <span id="threadPriority" class="thread-badge"></span>
                                <span id="threadStatus" class="thread-badge"></span>
                                <span id="threadParticipants" class="thread-badge">
                                    <i class="fas fa-users"></i>
                                    <span id="participantCount">0</span>
                                </span>
                            </div>
                        </div>
                        <button class="modal-close-btn" aria-label="סגור">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <!-- Messages Area -->
                    <div class="modal-body">
                        <div id="messagesContainer" class="messages-container">
                            <!-- Messages will be rendered here -->
                        </div>
                    </div>

                    <!-- Message Input -->
                    <div class="modal-footer">
                        <div class="message-input-area">
                            <textarea
                                id="messageInput"
                                class="message-input"
                                placeholder="כתוב הודעה..."
                                rows="2"
                            ></textarea>
                            <div class="input-actions">
                                <button id="addParticipantBtn" class="btn-icon" title="הוסף משתתף">
                                    <i class="fas fa-user-plus"></i>
                                </button>
                                <button id="threadOptionsBtn" class="btn-icon" title="אפשרויות">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <button id="sendMessageBtn" class="btn btn-primary">
                                    <i class="fas fa-paper-plane"></i>
                                    שלח
                                </button>
                            </div>
                        </div>

                        <!-- Thread Options Menu -->
                        <div id="threadOptionsMenu" class="options-menu" style="display: none;">
                            <button id="closeThreadBtn" class="menu-item">
                                <i class="fas fa-lock"></i>
                                <span>סגור דיון</span>
                            </button>
                            <button id="reopenThreadBtn" class="menu-item" style="display: none;">
                                <i class="fas fa-unlock"></i>
                                <span>פתח מחדש</span>
                            </button>
                            <button id="archiveThreadBtn" class="menu-item">
                                <i class="fas fa-archive"></i>
                                <span>העבר לארכיון</span>
                            </button>
                            <button id="deleteThreadBtn" class="menu-item danger">
                                <i class="fas fa-trash"></i>
                                <span>מחק דיון</span>
                            </button>
                        </div>
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

            // Send message
            const sendBtn = this.modalElement.querySelector('#sendMessageBtn');
            sendBtn.addEventListener('click', async () => {
                await this.sendMessage();
            });

            // Enter to send (Shift+Enter for new line)
            const input = this.modalElement.querySelector('#messageInput');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Options button
            const optionsBtn = this.modalElement.querySelector('#threadOptionsBtn');
            const optionsMenu = this.modalElement.querySelector('#threadOptionsMenu');

            optionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsMenu.style.display = optionsMenu.style.display === 'none' ? 'block' : 'none';
            });

            // Close menu when clicking outside
            document.addEventListener('click', () => {
                optionsMenu.style.display = 'none';
            });

            // Add participant
            const addParticipantBtn = this.modalElement.querySelector('#addParticipantBtn');
            addParticipantBtn.addEventListener('click', async () => {
                await this.addParticipant();
            });

            // Close thread
            const closeThreadBtn = this.modalElement.querySelector('#closeThreadBtn');
            closeThreadBtn.addEventListener('click', async () => {
                await this.closeThread();
            });

            // Reopen thread
            const reopenThreadBtn = this.modalElement.querySelector('#reopenThreadBtn');
            reopenThreadBtn.addEventListener('click', async () => {
                await this.reopenThread();
            });

            // Archive thread
            const archiveThreadBtn = this.modalElement.querySelector('#archiveThreadBtn');
            archiveThreadBtn.addEventListener('click', async () => {
                await this.archiveThread();
            });

            // Delete thread
            const deleteThreadBtn = this.modalElement.querySelector('#deleteThreadBtn');
            deleteThreadBtn.addEventListener('click', async () => {
                await this.deleteThread();
            });
        }

        /**
         * Open modal with thread
         * @param {string} threadId
         * @param {Function} onCloseCallback
         */
        async open(threadId, onCloseCallback = null) {
            this.currentThreadId = threadId;
            this.onClose = onCloseCallback;

            try {
                // Show loading
                this.showLoading();

                // Load thread data
                this.currentThread = await this.threadManager.getThread(threadId);

                // Load messages
                this.messages = await this.threadManager.getMessages(threadId, 100);

                // Populate data
                this.populateThreadData();
                this.renderMessages();

                // Setup real-time listener
                this.setupMessageListener();

                // Auto mark as read
                setTimeout(() => {
                    this.threadManager.markThreadAsRead(threadId);
                }, 1000);

                // Show modal
                this.modalElement.style.display = 'flex';
                this.isOpen = true;

                this.hideLoading();

            } catch (error) {
                console.warn('Error opening thread:', error);
                this.showError(error.message || 'שגיאה בטעינת הדיון');
                this.hideLoading();
            }
        }

        /**
         * Populate thread data in header
         */
        populateThreadData() {
            const thread = this.currentThread;

            // Title
            this.modalElement.querySelector('#threadTitle').textContent = thread.title;

            // Category
            const categoryEl = this.modalElement.querySelector('#threadCategory');
            categoryEl.textContent = this.getCategoryLabel(thread.category);
            categoryEl.className = `thread-badge badge-category-${thread.category}`;

            // Priority
            const priorityEl = this.modalElement.querySelector('#threadPriority');
            priorityEl.innerHTML = this.getPriorityHTML(thread.priority);
            priorityEl.className = `thread-badge badge-priority-${thread.priority}`;

            // Status
            const statusEl = this.modalElement.querySelector('#threadStatus');
            statusEl.textContent = this.getStatusLabel(thread.status);
            statusEl.className = `thread-badge badge-status-${thread.status}`;

            // Participants
            this.modalElement.querySelector('#participantCount').textContent = thread.participants.length;

            // Show/hide reopen button
            const closeBtn = this.modalElement.querySelector('#closeThreadBtn');
            const reopenBtn = this.modalElement.querySelector('#reopenThreadBtn');

            if (thread.status === 'closed') {
                closeBtn.style.display = 'none';
                reopenBtn.style.display = 'flex';
            } else {
                closeBtn.style.display = 'flex';
                reopenBtn.style.display = 'none';
            }

            // Disable input if closed
            const input = this.modalElement.querySelector('#messageInput');
            const sendBtn = this.modalElement.querySelector('#sendMessageBtn');

            if (thread.status === 'closed') {
                input.disabled = true;
                input.placeholder = 'הדיון סגור - לא ניתן לשלוח הודעות';
                sendBtn.disabled = true;
            } else {
                input.disabled = false;
                input.placeholder = 'כתוב הודעה...';
                sendBtn.disabled = false;
            }
        }

        /**
         * Render all messages
         */
        renderMessages() {
            const container = this.modalElement.querySelector('#messagesContainer');

            if (this.messages.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-comments"></i>
                        <p>אין הודעות בדיון זה</p>
                        <p class="text-sm">היה הראשון לכתוב הודעה!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = this.messages.map(msg => this.renderMessageBubble(msg)).join('');

            // Scroll to bottom
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }

        /**
         * Render single message bubble
         */
        renderMessageBubble(message) {
            const currentUserId = this.threadManager.currentUser.uid;
            const isMyMessage = message.from.uid === currentUserId;
            const bubbleClass = isMyMessage ? 'message-bubble my-message' : 'message-bubble other-message';

            return `
                <div class="${bubbleClass}">
                    <div class="message-header">
                        <span class="sender-name">${message.from.name}</span>
                        <span class="message-time">${this.formatTime(message.createdAt)}</span>
                    </div>
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                </div>
            `;
        }

        /**
         * Setup real-time message listener
         */
        setupMessageListener() {
            if (this.unsubscribeMessages) {
                this.unsubscribeMessages();
            }

            this.unsubscribeMessages = this.threadManager.listenToMessages(
                this.currentThreadId,
                (newMessage) => {
                    // Add to messages array
                    this.messages.push(newMessage);

                    // Render new message
                    const container = this.modalElement.querySelector('#messagesContainer');

                    // Remove empty state if exists
                    const emptyState = container.querySelector('.empty-state');
                    if (emptyState) {
                        container.innerHTML = '';
                    }

                    // Add new message
                    container.innerHTML += this.renderMessageBubble(newMessage);

                    // Scroll to bottom
                    container.scrollTop = container.scrollHeight;
                }
            );
        }

        /**
         * Send message
         */
        async sendMessage() {
            const input = this.modalElement.querySelector('#messageInput');
            const text = input.value.trim();

            if (!text) {
                return;
            }

            if (this.currentThread.status === 'closed') {
                this.showToast('הדיון סגור - לא ניתן לשלוח הודעות', 'warning');
                return;
            }

            try {
                // Disable input while sending
                input.disabled = true;
                const sendBtn = this.modalElement.querySelector('#sendMessageBtn');
                sendBtn.disabled = true;

                // Send message via Cloud Function
                await this.threadManager.addMessage(this.currentThreadId, text);

                // Clear input
                input.value = '';

                // Re-enable
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();

            } catch (error) {
                console.warn('Error sending message:', error);
                this.showToast(error.message || 'שגיאה בשליחת ההודעה', 'error');

                // Re-enable
                input.disabled = false;
                sendBtn.disabled = false;
            }
        }

        /**
         * Add participant to thread
         */
        async addParticipant() {
            // TODO: Replace with proper modal dialog
            this.showToast('הוספת משתתף - בפיתוח', 'info');
            return;

            /* Disabled prompt - to be replaced with modal
            const userId = prompt('הכנס UID של המשתמש להוספה:');

            if (!userId || !userId.trim()) {
                return;
            }

            try {
                await this.threadManager.addParticipant(this.currentThreadId, userId.trim());

                this.showToast('משתתף נוסף בהצלחה!', 'success');

                // Reload thread data
                this.currentThread = await this.threadManager.getThread(this.currentThreadId);
                this.populateThreadData();

            } catch (error) {
                console.warn('Error adding participant:', error);
                this.showToast(error.message || 'שגיאה בהוספת משתתף', 'error');
            }
            */
        }

        /**
         * Close thread
         */
        async closeThread() {
            // Use toast confirmation instead of browser confirm
            this.showToast('לחץ שוב לסגירת הדיון', 'warning');

            if (!this._closeConfirmed) {
                this._closeConfirmed = true;
                setTimeout(() => {
 this._closeConfirmed = false;
}, 3000);
                return;
            }

            try {
                await this.threadManager.closeThread(this.currentThreadId);

                this.showToast('הדיון נסגר בהצלחה', 'success');

                // Update UI
                this.currentThread.status = 'closed';
                this.populateThreadData();

            } catch (error) {
                console.warn('Error closing thread:', error);
                this.showToast(error.message || 'שגיאה בסגירת הדיון', 'error');
            }
        }

        /**
         * Reopen thread
         */
        async reopenThread() {
            try {
                await this.threadManager.reopenThread(this.currentThreadId);

                this.showToast('הדיון נפתח מחדש', 'success');

                // Update UI
                this.currentThread.status = 'open';
                this.populateThreadData();

            } catch (error) {
                console.warn('Error reopening thread:', error);
                this.showToast(error.message || 'שגיאה בפתיחת הדיון', 'error');
            }
        }

        /**
         * Archive thread
         */
        async archiveThread() {
            // Use toast confirmation instead of browser confirm
            this.showToast('לחץ שוב להעברה לארכיון', 'warning');

            if (!this._archiveConfirmed) {
                this._archiveConfirmed = true;
                setTimeout(() => {
 this._archiveConfirmed = false;
}, 3000);
                return;
            }

            try {
                await this.threadManager.archiveThread(this.currentThreadId);

                this.showToast('הדיון הועבר לארכיון', 'success');

                // Close modal
                setTimeout(() => {
                    this.close();
                }, 1000);

            } catch (error) {
                console.warn('Error archiving thread:', error);
                this.showToast(error.message || 'שגיאה בהעברה לארכיון', 'error');
            }
        }

        /**
         * Delete thread
         */
        async deleteThread() {
            // Use double-confirmation with toast
            this.showToast('⚠️ לחץ שוב למחיקה סופית!', 'error');

            if (!this._deleteConfirmed) {
                this._deleteConfirmed = true;
                setTimeout(() => {
 this._deleteConfirmed = false;
}, 3000);
                return;
            }

            try {
                await this.threadManager.deleteThread(this.currentThreadId);

                this.showToast('הדיון נמחק בהצלחה', 'success');

                // Close modal
                setTimeout(() => {
                    this.close();
                }, 1000);

            } catch (error) {
                console.warn('Error deleting thread:', error);
                this.showToast(error.message || 'שגיאה במחיקת הדיון', 'error');
            }
        }

        /**
         * Close modal
         */
        close() {
            // Stop listening to messages
            if (this.unsubscribeMessages) {
                this.unsubscribeMessages();
                this.unsubscribeMessages = null;
            }

            // Hide modal
            this.modalElement.style.display = 'none';
            this.isOpen = false;

            // Clear data
            this.currentThread = null;
            this.currentThreadId = null;
            this.messages = [];

            // Clear input
            this.modalElement.querySelector('#messageInput').value = '';

            // Call callback
            if (this.onClose) {
                this.onClose();
            }
        }

        /**
         * Helper methods
         */
        getCategoryLabel(category) {
            const labels = {
                'general': 'כללי',
                'case_work': 'עבודת תיקים',
                'admin': 'מנהלה',
                'technical': 'טכני'
            };
            return labels[category] || category;
        }

        getPriorityHTML(priority) {
            const icons = {
                'low': '<i class="fas fa-arrow-down"></i> נמוך',
                'normal': '<i class="fas fa-minus"></i> רגיל',
                'high': '<i class="fas fa-arrow-up"></i> גבוה',
                'urgent': '<i class="fas fa-exclamation"></i> דחוף'
            };
            return icons[priority] || priority;
        }

        getStatusLabel(status) {
            const labels = {
                'open': 'פתוח',
                'closed': 'סגור',
                'archived': 'בארכיון'
            };
            return labels[status] || status;
        }

        formatTime(timestamp) {
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

            return date.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML.replace(/\n/g, '<br>');
        }

        showToast(message, type = 'info') {
            if (window.Notifications) {
                window.Notifications.show(message, type);
            } else {
                // Fallback: console message instead of alert
                console.warn(`[${type.toUpperCase()}] ${message}`);
            }
        }

        showLoading() {
            const container = this.modalElement.querySelector('#messagesContainer');
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>טוען דיון...</p>
                </div>
            `;
        }

        hideLoading() {
            // Loading will be replaced by actual content
        }

        showError(message) {
            const container = this.modalElement.querySelector('#messagesContainer');
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    // Make available globally
    window.ThreadViewerModal = ThreadViewerModal;

    // Auto-create instance
    if (typeof window !== 'undefined') {
        window.threadViewerModal = new ThreadViewerModal();
    }

})();
