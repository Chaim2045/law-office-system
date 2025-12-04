/**
 * MessagingCenterUI
 * מערכת הודעות מרכזית - Inbox + Threads
 *
 * Created: 2025-12-01
 * Phase: UI Layer - Central Messaging
 *
 * זה המסך המרכזי של כל ההודעות
 */

(function() {
    'use strict';

    class MessagingCenterUI {
        constructor() {
            this.container = null;
            this.currentView = 'inbox'; // 'inbox' | 'threads' | 'sent'
            this.contextMessages = [];
            this.threads = [];
            this.selectedMessage = null;

            // References to managers
            this.contextMessageManager = window.contextMessageManager;
            this.threadManager = window.threadManager;
        }

        /**
         * Initialize Messaging Center
         * @param {string} initialView - 'inbox' or 'threads'
         */
        async init(initialView = 'inbox') {
            try {
                // Initialization started

                this.container = document.getElementById('messagingCenter');
                if (!this.container) {
                    console.error('❌ Messaging center container not found');
                    return;
                }

                // Set initial view
                this.currentView = initialView;

                // Load data
                await this.loadData();

                // Render
                this.render();

                // Setup events
                this.setupEvents();

                // Initialization complete

            } catch (error) {
                console.error('❌ MessagingCenterUI: Init failed:', error);
                this.renderError('שגיאה באתחול מערכת ההודעות');
            }
        }

        /**
         * Load data
         */
        async loadData() {
            try {
                // Load context messages (inbox) - ONLY UNREAD
                this.contextMessages = await this.contextMessageManager.getUnreadMessages(50);

                // Load threads
                this.threads = await this.threadManager.getMyThreads({ limit: 50 });

            } catch (error) {
                console.error('❌ Failed to load data:', error);
            }
        }

        /**
         * Render main UI
         */
        render() {
            const html = `
                <div class="messaging-center">
                    <!-- Tabs -->
                    <div class="messaging-tabs">
                        ${this.renderTab('inbox', 'fas fa-inbox', 'דואר נכנס', this.contextMessages.length)}
                        ${this.renderTab('threads', 'fas fa-comments', 'דיונים', this.threads.length)}
                        ${this.renderTab('sent', 'fas fa-paper-plane', 'נשלחו', 0)}
                    </div>

                    <!-- Content -->
                    <div class="messaging-content">
                        ${this.renderContent()}
                    </div>
                </div>
            `;

            this.container.innerHTML = html;
        }

        /**
         * Render tab button
         */
        renderTab(view, icon, label, count) {
            const active = this.currentView === view ? 'active' : '';
            const badge = count > 0 ? `<span class="tab-badge">${count}</span>` : '';

            return `
                <button class="messaging-tab ${active}" data-view="${view}">
                    <i class="${icon}"></i>
                    <span>${label}</span>
                    ${badge}
                </button>
            `;
        }

        /**
         * Render content based on current view
         */
        renderContent() {
            switch (this.currentView) {
                case 'inbox':
                    return this.renderInbox();
                case 'threads':
                    return this.renderThreads();
                case 'sent':
                    return this.renderSent();
                default:
                    return '<p>תצוגה לא נמצאה</p>';
            }
        }

        /**
         * Render inbox (context messages)
         */
        renderInbox() {
            if (this.contextMessages.length === 0) {
                return this.renderEmptyState('fas fa-inbox', 'אין הודעות', 'לא קיבלת הודעות עדיין');
            }

            return `
                <div class="messages-list">
                    ${this.contextMessages.map(msg => this.renderContextMessageCard(msg)).join('')}
                </div>
            `;
        }

        /**
         * Render single context message card
         */
        renderContextMessageCard(message) {
            const unreadClass = message.isRead ? '' : 'unread';
            const typeClass = `message-type-${message.messageType}`;
            const typeIcon = this.getMessageTypeIcon(message.messageType);
            const typeLabel = this.getMessageTypeLabel(message.messageType);

            return `
                <div class="message-card ${unreadClass} ${typeClass}" data-message-id="${message.id}">
                    <div class="message-icon">
                        <i class="fas ${typeIcon}"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-type-badge">${typeLabel}</span>
                            <span class="message-date">${DateUtils.formatDate(message.createdAt)}</span>
                        </div>
                        <h4 class="message-title">${this.escapeHTML(message.title)}</h4>
                        <p class="message-preview">${this.escapeHTML(this.truncate(message.body, 100))}</p>
                        <div class="message-from">
                            <i class="fas fa-user"></i>
                            <span>מאת: ${this.escapeHTML(message.from.name)}</span>
                        </div>
                    </div>
                    <div class="message-actions">
                        <button class="btn-icon" data-action="view" data-message-id="${message.id}" title="צפה בהודעה">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" data-action="reply" data-message-id="${message.id}" title="השב">
                            <i class="fas fa-reply"></i>
                        </button>
                        ${message.threadCreated ? `
                            <button class="btn-icon" data-action="goto-thread" data-thread-id="${message.threadId}" title="עבור לדיון">
                                <i class="fas fa-comments"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        /**
         * Render threads
         */
        renderThreads() {
            if (this.threads.length === 0) {
                return this.renderEmptyState('fas fa-comments', 'אין דיונים', 'לא נוצרו דיונים עדיין');
            }

            return `
                <div class="threads-list">
                    ${this.threads.map(thread => this.renderThreadCard(thread)).join('')}
                </div>
            `;
        }

        /**
         * Render single thread card
         */
        renderThreadCard(thread) {
            const unreadCount = thread.unreadCount[window.firebaseAuth.currentUser.uid] || 0;
            const unreadClass = unreadCount > 0 ? 'unread' : '';
            const priorityClass = `priority-${thread.priority}`;
            const statusClass = `status-${thread.status}`;

            return `
                <div class="thread-card ${unreadClass} ${priorityClass} ${statusClass}" data-thread-id="${thread.id}">
                    <div class="thread-icon">
                        <i class="fas fa-comments"></i>
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                    <div class="thread-content">
                        <div class="thread-header">
                            <span class="thread-category">${THREAD_CATEGORIES_LABELS[thread.category]}</span>
                            <span class="thread-priority">${THREAD_PRIORITY_LABELS[thread.priority]}</span>
                            <span class="thread-date">${DateUtils.formatDate(thread.lastMessageAt || thread.createdAt)}</span>
                        </div>
                        <h4 class="thread-title">${this.escapeHTML(thread.title)}</h4>
                        ${thread.lastMessagePreview ? `
                            <p class="thread-preview">${this.escapeHTML(thread.lastMessagePreview)}</p>
                        ` : ''}
                        <div class="thread-meta">
                            <span><i class="fas fa-users"></i> ${thread.participants.length} משתתפים</span>
                            <span class="thread-status-badge status-${thread.status}">${THREAD_STATUS_LABELS[thread.status]}</span>
                        </div>
                    </div>
                    <div class="thread-actions">
                        <button class="btn-icon" data-action="open-thread" data-thread-id="${thread.id}" title="פתח דיון">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Render sent messages
         */
        renderSent() {
            return `
                <div class="empty-state">
                    <i class="fas fa-paper-plane"></i>
                    <h3>הודעות שנשלחו</h3>
                    <p>בקרוב תוכל לראות כאן את כל ההודעות ששלחת</p>
                </div>
            `;
        }

        /**
         * Render empty state
         */
        renderEmptyState(icon, title, description) {
            return `
                <div class="empty-state">
                    <i class="${icon}"></i>
                    <h3>${title}</h3>
                    <p>${description}</p>
                </div>
            `;
        }

        /**
         * Render error state
         */
        renderError(message) {
            const html = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>${message}</h3>
                    <button class="btn btn-primary" onclick="window.MessagingCenterUI?.init()">
                        נסה שוב
                    </button>
                </div>
            `;

            this.container.innerHTML = html;
        }

        /**
         * Setup events
         */
        setupEvents() {
            // Tab switching
            const tabs = this.container.querySelectorAll('.messaging-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const view = tab.getAttribute('data-view');
                    this.switchView(view);
                });
            });

            // Message actions
            const messageActions = this.container.querySelectorAll('.message-card .btn-icon');
            messageActions.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.getAttribute('data-action');
                    const messageId = btn.getAttribute('data-message-id');
                    const threadId = btn.getAttribute('data-thread-id');

                    this.handleMessageAction(action, messageId, threadId);
                });
            });

            // Thread actions
            const threadActions = this.container.querySelectorAll('.thread-card .btn-icon');
            threadActions.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.getAttribute('data-action');
                    const threadId = btn.getAttribute('data-thread-id');

                    this.handleThreadAction(action, threadId);
                });
            });

            // Compose message button
            const composeBtn = document.getElementById('composeMessageBtn');
            if (composeBtn) {
                composeBtn.addEventListener('click', () => {
                    this.composeNewMessage();
                });
            }
        }

        /**
         * Switch view
         */
        async switchView(view) {
            this.currentView = view;
            await this.loadData();
            this.render();
            this.setupEvents();
        }

        /**
         * Handle message action
         */
        async handleMessageAction(action, messageId, threadId) {
            switch (action) {
                case 'view':
                    await this.viewMessage(messageId);
                    break;
                case 'reply':
                    await this.replyToMessage(messageId);
                    break;
                case 'goto-thread':
                    this.openThread(threadId);
                    break;
            }
        }

        /**
         * Handle thread action
         */
        handleThreadAction(action, threadId) {
            if (action === 'open-thread') {
                this.openThread(threadId);
            }
        }

        /**
         * View message
         */
        async viewMessage(messageId) {
            const message = this.contextMessages.find(m => m.id === messageId);
            if (!message) {
                console.error('Message not found');
                return;
            }

            // ✅ Open MessageViewerModal
            if (window.messageViewerModal) {
                window.messageViewerModal.open(message, async () => {
                    // Callback when modal closes - refresh data
                    await this.loadData();
                    this.render();
                    this.setupEvents();
                });
            } else {
                console.error('❌ MessageViewerModal not loaded');
            }
        }

        /**
         * Reply to message
         */
        async replyToMessage(messageId) {
            // TODO: Replace with proper modal dialog
            console.warn('Reply functionality disabled - use MessageViewerModal instead');

            // For now, just open the message viewer which has reply button
            await this.viewMessage(messageId);
        }

        /**
         * Open thread
         * ✅ עודכן להשתמש ב-ThreadViewerModal
         */
        openThread(threadId) {
            // ✅ Open ThreadViewerModal
            if (window.threadViewerModal) {
                window.threadViewerModal.open(threadId, async () => {
                    // Callback when modal closes - refresh data
                    await this.loadData();
                    this.render();
                    this.setupEvents();
                });
            } else {
                console.error('❌ ThreadViewerModal not loaded');
            }
        }

        /**
         * Compose new message
         */
        composeNewMessage() {
            if (window.quickMessageDialog) {
                window.quickMessageDialog.show({
                    userId: '',
                    userName: 'בחר משתמש',
                    alertTitle: '',
                    messageBody: ''
                });
            } else {
                console.warn('QuickMessageDialog not available');
            }
        }

        // =====================
        // UTILITY METHODS
        // =====================

        getMessageTypeIcon(type) {
            const icons = {
                [MESSAGE_TYPES.REMINDER]: 'fa-bell',
                [MESSAGE_TYPES.WARNING]: 'fa-exclamation-triangle',
                [MESSAGE_TYPES.URGENT]: 'fa-exclamation-circle',
                [MESSAGE_TYPES.INFO]: 'fa-info-circle'
            };
            return icons[type] || 'fa-envelope';
        }

        getMessageTypeLabel(type) {
            const labels = {
                [MESSAGE_TYPES.REMINDER]: 'תזכורת',
                [MESSAGE_TYPES.WARNING]: 'אזהרה',
                [MESSAGE_TYPES.URGENT]: 'דחוף',
                [MESSAGE_TYPES.INFO]: 'מידע'
            };
            return labels[type] || 'הודעה';
        }

        escapeHTML(str) {
            if (!str) {
return '';
}
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        truncate(str, maxLength) {
            if (!str) {
return '';
}
            if (str.length <= maxLength) {
return str;
}
            return str.substring(0, maxLength) + '...';
        }
    }

    // Create singleton instance
    const messagingCenterUI = new MessagingCenterUI();
    window.MessagingCenterUI = messagingCenterUI;

})();
