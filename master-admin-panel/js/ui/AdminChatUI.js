/**
 * Admin Chat UI
 * ממשק צ'אט למנהל - ניהול שיחות עם כל העובדים
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Phase: Messaging System - Two-Way Chat
 *
 * תפקיד: פאנל צ'אט למנהל - רשימת שיחות וחלון צ'אט
 */

(function() {
    'use strict';

    /**
     * AdminChatUI Class
     * מנהל את ממשק הצ'אט באדמין פאנל
     */
    class AdminChatUI {
        constructor() {
            this.chatManager = null;
            this.conversations = [];
            this.activeConversation = null; // השיחה הפעילה כרגע
            this.messageListener = null;
            this.conversationsListener = null;
            this.employees = []; // רשימת כל העובדים
        }

        /**
         * Initialize
         */
        async init() {
            this.chatManager = window.chatManager;
            if (!this.chatManager) {
                console.warn('⚠️ ChatManager לא זמין');
            }

            // Load employees list
            await this.loadEmployees();
        }

        /**
         * טען רשימת עובדים
         */
        async loadEmployees() {
            try {
                const db = window.firebaseDB || firebase.firestore();
                const snapshot = await db.collection('employees').get();

                this.employees = [];
                snapshot.forEach(doc => {
                    const employee = doc.data();
                    const authUID = employee.authUID || employee.uid || doc.id;

                    this.employees.push({
                        uid: authUID,
                        email: employee.email || doc.id,
                        name: employee.name || employee.username || 'לא ידוע',
                        role: employee.role || 'employee'
                    });
                });

                console.log(`✅ Loaded ${this.employees.length} employees for chat`);

            } catch (error) {
                console.error('❌ שגיאה בטעינת עובדים:', error);
                this.employees = [];
            }
        }

        /**
         * הצג פאנל צ'אט באדמין
         */
        showChatPanel() {
            // Check if already exists
            if (document.querySelector('.admin-chat-overlay')) {
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'chat-window-overlay admin-chat-overlay';

            overlay.innerHTML = `
                <div class="chat-window" style="max-width: 1000px; width: 95%;">
                    <div style="display: flex; height: 100%;">
                        <!-- Conversations Sidebar -->
                        <div class="admin-chat-sidebar" style="width: 320px; border-left: 1px solid #ddd; background: white;">
                            <div class="admin-chat-header">
                                <i class="fas fa-comments"></i>
                                צ'אט עם עובדים
                            </div>
                            <div class="admin-chat-search" style="padding: 0.75rem 1rem; border-bottom: 1px solid #f0f2f5;">
                                <input
                                    type="text"
                                    id="chatSearch"
                                    class="form-control"
                                    placeholder="חפש שיחה..."
                                    style="width: 100%; padding: 0.5rem; border-radius: 8px;"
                                />
                            </div>
                            <div class="admin-chat-list" id="chatConversationsList">
                                <div style="padding: 2rem; text-align: center; color: #667781;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                                    <div>טוען שיחות...</div>
                                </div>
                            </div>
                        </div>

                        <!-- Chat Area -->
                        <div style="flex: 1; display: flex; flex-direction: column;">
                            <div id="chatMainArea">
                                <!-- Empty state or active chat will be shown here -->
                                <div class="chat-empty-state" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #e5ddd5;">
                                    <div class="chat-empty-icon" style="font-size: 5rem; color: rgba(0,0,0,0.1); margin-bottom: 1rem;">
                                        <i class="fas fa-comments"></i>
                                    </div>
                                    <div class="chat-empty-text" style="font-size: 1.2rem; color: #667781;">
                                        בחר שיחה כדי להתחיל
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Close button (top right corner) -->
                    <button class="chat-header-btn" id="closeAdminChatBtn" style="position: absolute; top: 1rem; left: 1rem; z-index: 10;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);

            // Attach event listeners
            this.attachEventListeners(overlay);

            // Show overlay
            setTimeout(() => overlay.classList.add('show'), 10);

            // Load conversations
            this.loadConversations();
        }

        /**
         * צרף event listeners
         */
        attachEventListeners(overlay) {
            const closeBtn = overlay.querySelector('#closeAdminChatBtn');
            const searchInput = overlay.querySelector('#chatSearch');

            // Close button
            closeBtn.addEventListener('click', () => this.closeChatPanel());

            // Search
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterConversations(e.target.value);
                });
            }

            // Close on background click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeChatPanel();
                }
            });

            // ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeChatPanel();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        /**
         * טען רשימת שיחות
         */
        async loadConversations() {
            try {
                if (!this.chatManager) {
                    throw new Error('ChatManager לא זמין');
                }

                // Get all conversations
                const conversations = await this.chatManager.getMyConversations(100);

                this.conversations = conversations;

                // Display conversations
                this.displayConversationsList();

                // Start listening for updates
                this.startListeningToConversations();

            } catch (error) {
                console.error('❌ שגיאה בטעינת שיחות:', error);

                const listContainer = document.querySelector('#chatConversationsList');
                if (listContainer) {
                    listContainer.innerHTML = `
                        <div style="padding: 2rem; text-align: center; color: #667781;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; color: #f44336;"></i>
                            <div>שגיאה בטעינת שיחות</div>
                        </div>
                    `;
                }
            }
        }

        /**
         * הצג רשימת שיחות
         */
        displayConversationsList() {
            const listContainer = document.querySelector('#chatConversationsList');
            if (!listContainer) return;

            if (this.conversations.length === 0) {
                listContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: #667781;">
                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                        <div style="margin-bottom: 1rem;">אין שיחות</div>
                        <button class="btn btn-primary btn-sm" id="startNewChatBtn">
                            <i class="fas fa-plus"></i> התחל שיחה חדשה
                        </button>
                    </div>
                `;

                // Attach event to start new chat button
                const startBtn = listContainer.querySelector('#startNewChatBtn');
                if (startBtn) {
                    startBtn.addEventListener('click', () => this.showNewChatDialog());
                }
                return;
            }

            // Sort by last message time
            this.conversations.sort((a, b) => {
                const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
                const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
                return timeB - timeA;
            });

            // Display conversations
            listContainer.innerHTML = this.conversations.map(conv => {
                return this.renderConversationItem(conv);
            }).join('');

            // Attach click events
            listContainer.querySelectorAll('.admin-chat-item').forEach(item => {
                item.addEventListener('click', () => {
                    const convId = item.getAttribute('data-conv-id');
                    const conv = this.conversations.find(c => c.id === convId);
                    if (conv) {
                        this.openConversation(conv);
                    }
                });
            });
        }

        /**
         * רנדר פריט שיחה בודד
         */
        renderConversationItem(conversation) {
            const currentUserUid = window.firebaseAuth?.currentUser?.uid;

            // Get other participant (not me)
            const otherUid = conversation.participants.find(uid => uid !== currentUserUid);
            const otherName = conversation.participantNames?.[otherUid] || 'משתמש';
            const initials = otherName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // Unread count
            const unreadCount = conversation.unreadCount?.[currentUserUid] || 0;

            // Last message time
            const lastMessageTime = conversation.lastMessageAt?.toDate ? conversation.lastMessageAt.toDate() : null;
            const timeStr = lastMessageTime ? this.formatTime(lastMessageTime) : '';

            // Last message preview
            const lastMessage = conversation.lastMessage || 'לא נשלחו הודעות';

            // Active class
            const isActive = this.activeConversation && this.activeConversation.id === conversation.id;

            return `
                <div class="admin-chat-item ${isActive ? 'active' : ''}" data-conv-id="${conversation.id}" data-user-uid="${otherUid}">
                    <div class="admin-chat-avatar">${initials}</div>
                    <div class="admin-chat-info">
                        <div class="admin-chat-top">
                            <span class="admin-chat-name">${otherName}</span>
                            <span class="admin-chat-time">${timeStr}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="admin-chat-preview">${lastMessage}</div>
                            ${unreadCount > 0 ? `<span class="admin-chat-badge">${unreadCount}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * פתח שיחה
         */
        async openConversation(conversation) {
            console.log('💬 Opening conversation:', conversation.id);

            const currentUserUid = window.firebaseAuth?.currentUser?.uid;
            const otherUid = conversation.participants.find(uid => uid !== currentUserUid);
            const otherName = conversation.participantNames?.[otherUid] || 'משתמש';

            this.activeConversation = conversation;

            // Update sidebar selection
            document.querySelectorAll('.admin-chat-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-conv-id="${conversation.id}"]`)?.classList.add('active');

            // Display chat window
            this.displayChatWindow(otherUid, otherName);

            // Load messages
            await this.loadConversationMessages(otherUid);

            // Start listening
            this.startListeningToMessages(otherUid);
        }

        /**
         * הצג חלון צ'אט
         */
        displayChatWindow(otherUid, otherName) {
            const mainArea = document.querySelector('#chatMainArea');
            if (!mainArea) return;

            const initials = otherName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            mainArea.innerHTML = `
                <div style="display: flex; flex-direction: column; height: 100%;">
                    <!-- Chat Header -->
                    <div class="chat-header">
                        <div class="chat-header-left">
                            <div class="chat-user-avatar">${initials}</div>
                            <div class="chat-user-info">
                                <div class="chat-user-name">${otherName}</div>
                                <div class="chat-user-status">עובד</div>
                            </div>
                        </div>
                    </div>

                    <!-- Messages Container -->
                    <div class="chat-messages-container" id="chatMessages" style="flex: 1;">
                        <div style="padding: 2rem; text-align: center; color: #667781;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                            <div>טוען הודעות...</div>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="chat-input-area">
                        <div class="chat-input-wrapper">
                            <button class="chat-emoji-btn" type="button">😊</button>
                            <textarea
                                id="chatInput"
                                class="chat-input"
                                placeholder="כתוב הודעה..."
                                rows="1"
                            ></textarea>
                        </div>
                        <button class="chat-send-btn" id="sendMessageBtn" data-recipient-uid="${otherUid}" data-recipient-name="${otherName}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;

            // Attach event listeners for this chat
            const sendBtn = mainArea.querySelector('#sendMessageBtn');
            const input = mainArea.querySelector('#chatInput');

            sendBtn.addEventListener('click', () => this.sendMessage(otherUid, otherName));

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage(otherUid, otherName);
                }
            });

            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 100) + 'px';
            });
        }

        /**
         * טען הודעות לשיחה
         */
        async loadConversationMessages(otherUid) {
            try {
                const messages = await this.chatManager.getConversationHistory(otherUid, 50);

                const container = document.querySelector('#chatMessages');
                if (!container) return;

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

                messages.forEach(msg => this.displayMessage(msg, false));
                this.scrollToBottom();

            } catch (error) {
                console.error('❌ שגיאה בטעינת הודעות:', error);
            }
        }

        /**
         * התחל להאזין להודעות בשיחה
         */
        startListeningToMessages(otherUid) {
            if (!this.chatManager) return;

            // Stop existing listener
            if (this.messageListener) {
                this.messageListener();
            }

            // Start new listener
            this.messageListener = this.chatManager.listenToConversation(
                otherUid,
                (message) => {
                    console.log('📨 New message in admin chat:', message.id);
                    this.displayMessage(message, true);
                }
            );
        }

        /**
         * הצג הודעה
         */
        displayMessage(message, isNew = false) {
            const container = document.querySelector('#chatMessages');
            if (!container) return;

            const emptyState = container.querySelector('.chat-empty-state');
            if (emptyState) emptyState.remove();

            if (document.querySelector(`[data-message-id="${message.id}"]`)) {
                return;
            }

            const currentUserUid = window.firebaseAuth?.currentUser?.uid;
            const isOutgoing = message.from.uid === currentUserUid;
            const direction = isOutgoing ? 'outgoing' : 'incoming';

            const timestamp = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();
            const timeStr = this.formatTime(timestamp);

            // Add date divider if needed
            this.addDateDividerIfNeeded(container, timestamp);

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
            this.scrollToBottom(isNew);
        }

        /**
         * הוסף מפריד תאריך אם צריך
         */
        addDateDividerIfNeeded(container, messageDate) {
            const lastMessage = container.querySelector('.chat-message:last-of-type');

            let shouldAddDivider = false;

            if (!lastMessage) {
                shouldAddDivider = true;
            } else {
                const lastMessageTimestamp = parseInt(lastMessage.getAttribute('data-timestamp'));
                const lastMessageDate = new Date(lastMessageTimestamp);

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
        async sendMessage(recipientUid, recipientName) {
            const input = document.querySelector('#chatInput');
            const sendBtn = document.querySelector('#sendMessageBtn');

            if (!input || !sendBtn) return;

            const text = input.value.trim();
            if (!text) return;

            try {
                sendBtn.disabled = true;
                input.disabled = true;

                await this.chatManager.sendChatMessage(
                    recipientUid,
                    text,
                    {
                        recipientName: recipientName,
                        recipientRole: 'employee',
                        fromRole: 'admin'
                    }
                );

                input.value = '';
                input.style.height = 'auto';
                input.focus();

            } catch (error) {
                console.error('❌ שגיאה בשליחת הודעה:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                alert('שגיאה בשליחת הודעה: ' + (error.message || 'שגיאה לא ידועה'));
            } finally {
                sendBtn.disabled = false;
                input.disabled = false;
            }
        }

        /**
         * גלילה לתחתית
         */
        scrollToBottom(smooth = true) {
            const container = document.querySelector('#chatMessages');
            if (!container) return;

            if (smooth) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            } else {
                container.scrollTop = container.scrollHeight;
            }
        }

        /**
         * התחל האזנה לעדכוני שיחות
         */
        startListeningToConversations() {
            // TODO: Implement real-time listener for conversations list
            // This would listen to changes in conversations metadata
        }

        /**
         * סנן שיחות לפי חיפוש
         */
        filterConversations(query) {
            const items = document.querySelectorAll('.admin-chat-item');
            const lowerQuery = query.toLowerCase();

            items.forEach(item => {
                const name = item.querySelector('.admin-chat-name').textContent.toLowerCase();
                const preview = item.querySelector('.admin-chat-preview').textContent.toLowerCase();

                if (name.includes(lowerQuery) || preview.includes(lowerQuery)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }

        /**
         * הצג דיאלוג להתחלת שיחה חדשה
         */
        showNewChatDialog() {
            // TODO: Show dialog to select employee and start new chat
            console.log('Show new chat dialog - to be implemented');
        }

        /**
         * סגור פאנל צ'אט
         */
        closeChatPanel() {
            const overlay = document.querySelector('.admin-chat-overlay');
            if (!overlay) return;

            // Stop listeners
            if (this.messageListener) {
                this.messageListener();
                this.messageListener = null;
            }
            if (this.conversationsListener) {
                this.conversationsListener();
                this.conversationsListener = null;
            }

            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);

            this.activeConversation = null;
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
                return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
            }
        }

        /**
         * פתח רשימת שיחות (כמו WhatsApp)
         */
        async openConversationsList() {
            console.log('📋 Opening conversations list');

            if (!this.chatManager) {
                alert('מערכת הצ\'אט לא זמינה כרגע');
                return;
            }

            try {
                // Get all conversations for current admin
                const currentUser = window.firebaseAuth?.currentUser;
                if (!currentUser) {
                    alert('משתמש לא מחובר');
                    return;
                }

                // Fetch conversations
                const conversations = await this.chatManager.getConversations();
                console.log(`📊 Found ${conversations.length} conversations`);

                // Show conversations list UI
                this.renderConversationsList(conversations);

            } catch (error) {
                console.error('❌ שגיאה בטעינת שיחות:', error);
                alert('שגיאה בטעינת רשימת השיחות');
            }
        }

        /**
         * הצג רשימת שיחות
         */
        renderConversationsList(conversations) {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'chat-window-overlay conversations-list-overlay';
            overlay.innerHTML = `
                <div class="admin-chat-panel">
                    <div class="admin-chat-header">
                        <i class="fas fa-comments"></i>
                        <span>צ'אטים עם עובדים</span>
                        <button class="chat-header-btn" id="closeConversationsBtn" title="סגור">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="admin-chat-list" id="conversationsList">
                        ${conversations.length === 0 ? `
                            <div class="chat-empty-state">
                                <div class="chat-empty-icon">
                                    <i class="fas fa-comments"></i>
                                </div>
                                <div class="chat-empty-text">אין שיחות פעילות</div>
                            </div>
                        ` : conversations.map(conv => this.renderConversationItem(conv)).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Close button
            overlay.querySelector('#closeConversationsBtn').addEventListener('click', () => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
            });

            // Show with animation
            setTimeout(() => overlay.classList.add('show'), 10);
        }

        /**
         * רנדר פריט שיחה בודד
         */
        renderConversationItem(conversation) {
            const otherParticipant = conversation.participants.find(
                uid => uid !== window.firebaseAuth?.currentUser?.uid
            );

            // Find employee name
            const employee = this.employees.find(emp => emp.uid === otherParticipant);
            const employeeName = employee?.name || 'עובד';
            const initials = employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // Format time
            const lastMessageTime = conversation.lastMessageAt?.toDate?.() || new Date();
            const timeStr = this.formatTimeShort(lastMessageTime);

            // Unread count
            const unreadCount = conversation.unreadCount || 0;

            return `
                <div class="admin-chat-item" data-employee-uid="${otherParticipant}" data-employee-name="${employeeName}">
                    <div class="admin-chat-avatar">${initials}</div>
                    <div class="admin-chat-info">
                        <div class="admin-chat-top">
                            <div class="admin-chat-name">${employeeName}</div>
                            <div class="admin-chat-time">${timeStr}</div>
                        </div>
                        <div class="admin-chat-preview">${this.escapeHtml(conversation.lastMessage || 'לחץ לפתיחת השיחה')}</div>
                    </div>
                    ${unreadCount > 0 ? `<div class="admin-chat-badge">${unreadCount}</div>` : ''}
                </div>
            `;
        }

        /**
         * עיצוב זמן קצר (לרשימת שיחות)
         */
        formatTimeShort(date) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            if (messageDate.getTime() === today.getTime()) {
                // היום - הצג שעה
                return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            } else {
                // יום אחר - הצג תאריך
                return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
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
    }

    // Make available globally
    window.AdminChatUI = AdminChatUI;
    window.adminChatUI = new AdminChatUI();

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.adminChatUI.init();
        });
    } else {
        window.adminChatUI.init();
    }

})();
