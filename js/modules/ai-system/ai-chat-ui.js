/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AI CHAT UI - User Interface
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description ממשק משתמש לצ'אט עם AI
 * @version 1.0.0
 * @created 2025-10-26
 *
 * @features
 * - צ'אט צף מעוצב
 * - תמיכה בעברית (RTL)
 * - Streaming responses (מילה-אחר-מילה)
 * - היסטוריית שיחה
 * - כפתורי פעולה מהירה
 *
 */

'use strict';

/**
 * @class AIChatUI
 * @description ממשק הצ'אט
 */
class AIChatUI {
  constructor() {
    this.isOpen = false;
    this.isProcessing = false;
    this.messageIdCounter = 0;
    this.currentView = 'chat'; // 'chat' or 'notifications'

    this.config = window.AI_CONFIG;
    this.engine = window.aiEngine;
    this.contextBuilder = window.aiContextBuilder;

    this._init();
  }

  /**
   * אתחול - יצירת HTML
   * @private
   */
  _init() {
    // יצירת ה-HTML
    this._createChatHTML();

    // האזנה לאירועים
    this._attachEventListeners();

    // טעינת היסטוריה
    this._loadHistory();

    // התחלת סינכרון התראות
    this._startNotificationSync();

    if (this.config.debugMode) {
      console.log('[AI Chat UI] Initialized');
    }
  }

  /**
   * יצירת ה-HTML של הצ'אט
   * @private
   */
  _createChatHTML() {
    const chatHTML = `
<!-- AI Chat Container -->
<div id="aiChatContainer" class="ai-chat-container hidden">
  <!-- Chat Window -->
  <div class="ai-chat-window">
    <!-- Header -->
    <div class="ai-chat-header">
      <div class="ai-chat-title">
        <i class="fas fa-robot"></i>
        <span>עוזר AI חכם</span>
      </div>
      <div class="ai-chat-actions">
        <button class="ai-header-btn ai-messages-btn" id="aiMessagesBtn" onclick="window.aiChat.openAdminMessages()" title="הודעות מהמנהל" style="position: relative; z-index: 100;">
          <i class="fas fa-envelope" style="position: relative; z-index: 101;"></i>
          <span class="ai-notification-badge" id="aiMessagesBadge" style="z-index: 102;"></span>
        </button>
        <button class="ai-header-btn ai-notifications-btn" id="aiNotificationsBtn" onclick="window.aiChat.openNotifications()" title="התראות מערכת" style="position: relative; z-index: 100;">
          <i class="fas fa-bell" style="position: relative; z-index: 101;"></i>
          <span class="ai-notification-badge" id="aiNotificationBadge" style="z-index: 102;"></span>
        </button>
        <button class="ai-header-btn" onclick="window.aiChat.clearConversation()" title="נקה שיחה">
          <i class="fas fa-trash"></i>
        </button>
        <button class="ai-header-btn" onclick="window.aiChat.hide()" title="סגור">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- Messages Container -->
    <div class="ai-chat-messages" id="aiChatMessages">
      <!-- Welcome message -->
      <div class="ai-message ai-message-welcome">
        <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
        <div class="ai-message-content">
          <p>${this.config.welcomeMessage}</p>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="ai-quick-actions" id="aiQuickActions">
        ${this.config.quickActions.map(action => `
          <button class="ai-quick-action-btn" onclick="window.aiChat.sendQuickAction('${action}')">
            ${action}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Input Container -->
    <div class="ai-chat-input-container">
      <textarea
        id="aiChatInput"
        class="ai-chat-input"
        placeholder="שאל אותי כל שאלה..."
        rows="1"
      ></textarea>
      <button class="ai-send-btn" id="aiSendBtn" onclick="window.aiChat.sendMessage()">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</div>

<!-- Floating Button with Bubble Pop Label -->
<div class="ai-float-wrapper">
  <button class="ai-float-btn" id="aiFloatBtn" onclick="window.aiChat.toggle()">
    <i class="fas fa-robot"></i>
    <span class="ai-float-notification-badge" id="aiFloatNotificationBadge"></span>
  </button>
  <!-- Bubble Pop Label (appears above on hover) -->
  <div class="ai-bubble-label">
    <span class="ai-bubble-text">שאל את המומחה</span>
    <div class="ai-bubble-arrow"></div>
  </div>
</div>
    `;

    // הוספה ל-DOM
    document.body.insertAdjacentHTML('beforeend', chatHTML);
  }

  /**
   * האזנה לאירועים
   * @private
   */
  _attachEventListeners() {
    const input = document.getElementById('aiChatInput');

    if (!input) {
return;
}

    // Enter לשליחה
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }

  /**
   * פתיחת הצ'אט
   */
  show() {
    const container = document.getElementById('aiChatContainer');
    const floatBtn = document.getElementById('aiFloatBtn');

    if (!container) {
return;
}

    container.classList.remove('hidden');
    floatBtn?.classList.add('hidden');
    this.isOpen = true;

    // Update badges with correct counts when chat opens
    if (window.notificationBell && window.notificationBell.updateMessagesIconBadge) {
      window.notificationBell.updateMessagesIconBadge();
    }

    // Focus על ה-input
    setTimeout(() => {
      document.getElementById('aiChatInput')?.focus();
    }, 100);

    if (this.config.debugMode) {
      console.log('[AI Chat] Opened');
    }
  }

  /**
   * סגירת הצ'אט
   */
  hide() {
    const container = document.getElementById('aiChatContainer');
    const floatBtn = document.getElementById('aiFloatBtn');

    if (!container) {
return;
}

    container.classList.add('hidden');
    floatBtn?.classList.remove('hidden');
    this.isOpen = false;

    if (this.config.debugMode) {
      console.log('[AI Chat] Closed');
    }
  }

  /**
   * פתיחה/סגירה
   */
  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * שליחת הודעה
   */
  async sendMessage(message = null) {
    try {
      const input = document.getElementById('aiChatInput');
      const userMessage = message || input?.value?.trim();

      if (!userMessage) {
return;
}

      // בדיקת API Key
      if (!this.config.apiKey || this.config.apiKey === 'YOUR_API_KEY_HERE') {
        this.addErrorMessage(this.config.errorMessages.noApiKey);
        return;
      }

      // נקה את ה-input
      if (input && !message) {
        input.value = '';
        input.style.height = 'auto';
      }

      // הסתר quick actions
      this._hideQuickActions();

      // הצג את הודעת המשתמש
      this.addUserMessage(userMessage);

      // הצג typing indicator
      const typingId = this.addTypingIndicator();

      // בנה הקשר
      const context = await this.contextBuilder.buildFullContext();

      // שלח ל-AI
      if (this.config.streamResponse) {
        // Streaming mode
        const aiMessageId = this._createAIMessagePlaceholder();
        this._removeMessage(typingId);

        await this.engine.sendMessageStreaming(
          userMessage,
          context,
          (chunk) => {
            this._appendToAIMessage(aiMessageId, chunk);
          }
        );

      } else {
        // Regular mode
        const aiResponse = await this.engine.sendMessage(userMessage, context);
        this._removeMessage(typingId);
        this.addAIMessage(aiResponse);
      }

      // שמירת היסטוריה
      this._saveHistory();

    } catch (error) {
      console.error('[AI Chat] Error sending message:', error);

      // הסר typing indicator
      const typing = document.querySelector('.ai-message-typing');
      if (typing) {
typing.remove();
}

      // הצג שגיאה
      this.addErrorMessage(error.message || this.config.errorMessages.unknownError);
    }
  }

  /**
   * שליחת פעולה מהירה
   */
  sendQuickAction(action) {
    this.sendMessage(action);
  }

  /**
   * הוספת הודעת משתמש
   */
  addUserMessage(text) {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return;
}

    const messageId = `msg-${this.messageIdCounter++}`;

    const messageHTML = `
<div class="ai-message ai-message-user" id="${messageId}">
  <div class="ai-message-content">
    <p>${this._escapeHTML(text)}</p>
  </div>
  <div class="ai-message-avatar"><i class="fas fa-user"></i></div>
</div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    this._scrollToBottom();

    return messageId;
  }

  /**
   * הוספת הודעת AI
   */
  addAIMessage(text) {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return;
}

    const messageId = `msg-${this.messageIdCounter++}`;

    const messageHTML = `
<div class="ai-message ai-message-ai" id="${messageId}">
  <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
  <div class="ai-message-content">
    ${this._formatAIResponse(text)}
  </div>
</div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    this._scrollToBottom();

    return messageId;
  }

  /**
   * הוספת typing indicator
   */
  addTypingIndicator() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return null;
}

    const messageId = `msg-typing-${this.messageIdCounter++}`;

    const messageHTML = `
<div class="ai-message ai-message-ai ai-message-typing" id="${messageId}">
  <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
  <div class="ai-message-content">
    <div class="ai-typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
</div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    this._scrollToBottom();

    return messageId;
  }

  /**
   * הוספת הודעת שגיאה
   */
  addErrorMessage(text) {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return;
}

    const messageId = `msg-${this.messageIdCounter++}`;

    const messageHTML = `
<div class="ai-message ai-message-error" id="${messageId}">
  <div class="ai-message-avatar"><i class="fas fa-exclamation-triangle"></i></div>
  <div class="ai-message-content">
    <p>${this._escapeHTML(text)}</p>
  </div>
</div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    this._scrollToBottom();

    return messageId;
  }

  /**
   * יצירת placeholder להודעת AI (לstreaming)
   * @private
   */
  _createAIMessagePlaceholder() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return null;
}

    const messageId = `msg-${this.messageIdCounter++}`;

    const messageHTML = `
<div class="ai-message ai-message-ai" id="${messageId}">
  <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
  <div class="ai-message-content" id="${messageId}-content"></div>
</div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    return messageId;
  }

  /**
   * הוספת טקסט להודעת AI (streaming)
   * @private
   */
  _appendToAIMessage(messageId, text) {
    const contentEl = document.getElementById(`${messageId}-content`);
    if (!contentEl) {
return;
}

    contentEl.textContent += text;
    this._scrollToBottom();
  }

  /**
   * מחיקת הודעה
   * @private
   */
  _removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
message.remove();
}
  }

  /**
   * ניקוי כל השיחה
   */
  clearConversation() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return;
}

    // מחיקת כל ההודעות מלבד ה-welcome
    const messages = messagesContainer.querySelectorAll('.ai-message:not(.ai-message-welcome)');
    messages.forEach(msg => msg.remove());

    // הצגת quick actions
    this._showQuickActions();

    // ניקוי היסטוריה
    this.engine.clearHistory();
    this._saveHistory();

    if (this.config.debugMode) {
      console.log('[AI Chat] Conversation cleared');
    }
  }

  /**
   * הסתרת כפתורי פעולה מהירה
   * @private
   */
  _hideQuickActions() {
    const quickActions = document.getElementById('aiQuickActions');
    if (quickActions) {
      quickActions.style.display = 'none';
    }
  }

  /**
   * הצגת כפתורי פעולה מהירה
   * @private
   */
  _showQuickActions() {
    const quickActions = document.getElementById('aiQuickActions');
    if (quickActions) {
      quickActions.style.display = 'flex';
    }
  }

  /**
   * גלילה לתחתית
   * @private
   */
  _scrollToBottom() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) {
return;
}

    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  }

  /**
   * עיצוב תשובת AI (markdown בסיסי)
   * @private
   */
  _formatAIResponse(text) {
    if (!text) {
return '';
}

    // Escape HTML
    text = this._escapeHTML(text);

    // Bold (**text**)
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    text = text.replace(/\n/g, '<br>');

    return `<p>${text}</p>`;
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * שמירת היסטוריה
   * @private
   */
  _saveHistory() {
    try {
      const messagesContainer = document.getElementById('aiChatMessages');
      if (!messagesContainer) {
return;
}

      const messages = [];
      const messageElements = messagesContainer.querySelectorAll('.ai-message:not(.ai-message-welcome):not(.ai-message-typing)');

      messageElements.forEach(el => {
        const isUser = el.classList.contains('ai-message-user');
        const isError = el.classList.contains('ai-message-error');
        const content = el.querySelector('.ai-message-content')?.textContent || '';

        if (content) {
          messages.push({
            role: isUser ? 'user' : (isError ? 'error' : 'ai'),
            content: content.trim()
          });
        }
      });

      const userId = window.currentUser?.uid || 'anonymous';
      const key = `ai_ui_history_${userId}`;
      localStorage.setItem(key, JSON.stringify(messages));

    } catch (e) {
      console.warn('[AI Chat] Failed to save UI history:', e);
    }
  }

  /**
   * טעינת היסטוריה
   * @private
   */
  _loadHistory() {
    try {
      const userId = window.currentUser?.uid || 'anonymous';
      const key = `ai_ui_history_${userId}`;
      const saved = localStorage.getItem(key);

      if (!saved) {
return;
}

      const messages = JSON.parse(saved);

      if (messages.length > 0) {
        this._hideQuickActions();
      }

      messages.forEach(msg => {
        if (msg.role === 'user') {
          this.addUserMessage(msg.content);
        } else if (msg.role === 'ai') {
          this.addAIMessage(msg.content);
        } else if (msg.role === 'error') {
          this.addErrorMessage(msg.content);
        }
      });

    } catch (e) {
      console.warn('[AI Chat] Failed to load UI history:', e);
    }
  }

  /**
   * התחלת סינכרון התראות
   * @private
   */
  _startNotificationSync() {
    // עדכון ראשוני
    this._updateNotificationBadge();

    // עדכון כל 2 שניות לסינכרון עם מערכת ההתראות החיצונית
    this.notificationSyncInterval = setInterval(() => {
      this._updateNotificationBadge();
    }, 2000);

    if (this.config.debugMode) {
      console.log('[AI Chat] Notification sync started');
    }
  }

  /**
   * עדכון badge ההתראות
   * משתמש במתודה updateMessagesIconBadge() של notification-bell
   * לעקביות ו-Single Source of Truth
   * @private
   */
  _updateNotificationBadge() {
    // Use the notification bell's method for consistent badge updates
    // This updates aiNotificationBadge (header bell) and aiMessagesBadge (envelope)
    if (window.notificationBell?.updateMessagesIconBadge) {
      window.notificationBell.updateMessagesIconBadge();
    }

    // Update floating button badge separately (not handled by notification-bell)
    this._updateFloatingBadge();
  }

  /**
   * עדכון תג הכפתור הצף בלבד
   * מציג את סך כל ההתראות (מערכת + מנהל)
   * @private
   */
  _updateFloatingBadge() {
    const floatBadge = document.getElementById('aiFloatNotificationBadge');
    const floatBtn = document.getElementById('aiFloatBtn');

    // Get total count of ALL notifications (system + admin messages)
    const totalCount = window.notificationBell?.notifications?.length || 0;

    if (floatBadge) {
      if (totalCount > 0) {
        floatBadge.textContent = totalCount;
        floatBadge.style.display = 'flex';
        // Add attention class to button
        if (floatBtn) {
          floatBtn.classList.add('has-notifications');
        }
      } else {
        floatBadge.textContent = '';
        floatBadge.style.display = 'none';
        // Remove attention class
        if (floatBtn) {
          floatBtn.classList.remove('has-notifications');
        }
      }
    }
  }

  /**
   * פתיחת הודעות מהמנהל (מעטפה כחולה)
   */
  openAdminMessages() {
    this.currentView = 'admin-messages';
    this._renderAdminMessagesView();

    if (this.config.debugMode) {
      console.log('[AI Chat] Showing admin messages view');
    }
  }

  /**
   * פתיחת מערכת ההתראות (פעמון)
   */
  openNotifications() {
    this.currentView = 'notifications';
    this._renderSystemNotificationsView();

    if (this.config.debugMode) {
      console.log('[AI Chat] Showing system notifications view');
    }
  }

  /**
   * חזרה לצ'אט
   */
  backToChat() {
    this.currentView = 'chat';
    this._showChatView();

    if (this.config.debugMode) {
      console.log('[AI Chat] Back to chat view');
    }
  }

  /**
   * הצגת view הצ'אט
   * @private
   */
  _showChatView() {
    const messagesContainer = document.getElementById('aiChatMessages');
    const inputContainer = document.querySelector('.ai-chat-input-container');
    const notifContainer = document.getElementById('aiNotificationsContainer');

    // הצג את הצ'אט
    if (messagesContainer) {
messagesContainer.style.display = 'flex';
}
    if (inputContainer) {
inputContainer.style.display = 'flex';
}

    // הסתר את ההתראות
    if (notifContainer) {
notifContainer.style.display = 'none';
}
  }

  /**
   * הצגת view הודעות מהמנהל (מעטפה)
   * @private
   */
  _renderAdminMessagesView() {
    const messagesContainer = document.getElementById('aiChatMessages');
    const inputContainer = document.querySelector('.ai-chat-input-container');

    if (!messagesContainer) {
return;
}

    // הסתר את הצ'אט וה-input
    messagesContainer.style.display = 'none';
    if (inputContainer) {
inputContainer.style.display = 'none';
}

    // בדוק אם כבר יש notifications container
    let notifContainer = document.getElementById('aiNotificationsContainer');

    if (!notifContainer) {
      // צור container חדש
      notifContainer = document.createElement('div');
      notifContainer.id = 'aiNotificationsContainer';
      notifContainer.className = 'ai-notifications-container';
      messagesContainer.parentElement.insertBefore(notifContainer, inputContainer);
    }

    // וודא שהוא מוצג
    notifContainer.style.display = 'flex';

    // נקה ובנה מחדש
    notifContainer.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'ai-notifications-header';
    header.innerHTML = `
      <button class="ai-notifications-back-btn" onclick="window.aiChat.backToChat()">
        <i class="fas fa-arrow-right"></i> חזרה
      </button>
      <h2 class="ai-notifications-title">התראות</h2>
      <button class="ai-notifications-clear-btn" onclick="window.aiChat.clearAllNotifications()">
        נקה הכל
      </button>
    `;
    notifContainer.appendChild(header);

    // Get ONLY admin messages (not system notifications)
    const allNotifications = window.notificationBell?.notifications || [];
    const adminMessages = allNotifications.filter(n => n.isAdminMessage === true);

    if (adminMessages.length === 0) {
      // Empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'ai-notifications-empty';
      emptyState.innerHTML = `
        <div class="ai-notifications-empty-icon">
          <i class="fas fa-envelope-open" style="font-size: 48px; color: var(--ai-gray-400);"></i>
        </div>
        <h3 class="ai-notifications-empty-title">אין הודעות מהמנהל</h3>
        <p class="ai-notifications-empty-text">כל ההודעות מהמנהל יופיעו כאן</p>
      `;
      notifContainer.appendChild(emptyState);
      return;
    }

    // Notifications list
    const notificationsList = document.createElement('div');
    notificationsList.className = 'ai-notifications-list';

    adminMessages.forEach(message => {
      const notifEl = document.createElement('div');
      notifEl.className = `ai-notification-item ai-notification-${message.type || 'info'}`;
      if (message.status === 'unread') {
        notifEl.classList.add('ai-notification-unread');
      }

      // Icon for admin messages
      const iconName = 'envelope';

      notifEl.innerHTML = `
        <div class="ai-notification-content">
          <div class="ai-notification-icon">
            <i class="fas fa-${iconName}"></i>
          </div>
          <div class="ai-notification-text">
            <div class="ai-notification-title">הודעה מהמנהל</div>
            <div class="ai-notification-description">${this._escapeHTML(message.message || message.description || '')}</div>
            <div class="ai-notification-time">${this._escapeHTML(message.time || '')}</div>
            ${message.status !== 'responded' ? `
              <button class="ai-notification-reply-btn" data-message-id="${message.messageId}" data-message-text="${this._escapeHTML(message.description || message.message || '').replace(/"/g, '&quot;')}">
                <i class="fas fa-reply"></i> השב
              </button>
            ` : '<span class="ai-notification-responded">✓ נענה</span>'}
          </div>
        </div>
      `;

      notificationsList.appendChild(notifEl);
    });

    notifContainer.appendChild(notificationsList);

    // Add event listener delegation for reply buttons
    notificationsList.addEventListener('click', (e) => {
      const replyBtn = e.target.closest('.ai-notification-reply-btn');
      if (replyBtn) {
        const messageId = replyBtn.getAttribute('data-message-id');
        const messageText = replyBtn.getAttribute('data-message-text');
        if (messageId && messageText) {
          this.replyToAdmin(messageId, messageText);
        }
      }
    });
  }

  /**
   * הצגת view התראות מערכת (פעמון)
   * @private
   */
  _renderSystemNotificationsView() {
    const messagesContainer = document.getElementById('aiChatMessages');
    const inputContainer = document.querySelector('.ai-chat-input-container');

    if (!messagesContainer) {
      return;
    }

    // הסתר את הצ'אט וה-input
    messagesContainer.style.display = 'none';
    if (inputContainer) {
      inputContainer.style.display = 'none';
    }

    // בדוק אם כבר יש notifications container
    let notifContainer = document.getElementById('aiNotificationsContainer');

    if (!notifContainer) {
      // צור container חדש
      notifContainer = document.createElement('div');
      notifContainer.id = 'aiNotificationsContainer';
      notifContainer.className = 'ai-notifications-container';
      messagesContainer.parentElement.insertBefore(notifContainer, inputContainer);
    }

    // וודא שהוא מוצג
    notifContainer.style.display = 'flex';

    // נקה ובנה מחדש
    notifContainer.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'ai-notifications-header';
    header.innerHTML = `
      <button class="ai-notifications-back-btn" onclick="window.aiChat.backToChat()">
        <i class="fas fa-arrow-right"></i> חזרה
      </button>
      <h2 class="ai-notifications-title">התראות מערכת</h2>
      <button class="ai-notifications-clear-btn" onclick="window.aiChat.clearAllNotifications()">
        נקה הכל
      </button>
    `;
    notifContainer.appendChild(header);

    // Get ONLY system notifications (not admin messages)
    const allNotifications = window.notificationBell?.notifications || [];
    const systemNotifications = allNotifications.filter(n => n.isAdminMessage !== true);

    if (systemNotifications.length === 0) {
      // Empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'ai-notifications-empty';
      emptyState.innerHTML = `
        <div class="ai-notifications-empty-icon">
          <i class="fas fa-bell-slash" style="font-size: 48px; color: var(--ai-gray-400);"></i>
        </div>
        <h3 class="ai-notifications-empty-title">אין התראות מערכת</h3>
        <p class="ai-notifications-empty-text">כל התראות המערכת יופיעו כאן</p>
      `;
      notifContainer.appendChild(emptyState);
      return;
    }

    // Notifications list
    const notificationsList = document.createElement('div');
    notificationsList.className = 'ai-notifications-list';

    systemNotifications.forEach(notification => {
      const notifEl = document.createElement('div');
      notifEl.className = `ai-notification-item ai-notification-${notification.type || 'info'}`;
      if (notification.urgent) {
        notifEl.classList.add('ai-notification-urgent');
      }

      // Icon mapping
      const iconMap = {
        'blocked': 'ban',
        'critical': 'exclamation-circle',
        'urgent': 'clock',
        'warning': 'exclamation-triangle',
        'info': 'info-circle',
        'success': 'check-circle'
      };
      const iconName = iconMap[notification.type] || 'bell';

      notifEl.innerHTML = `
        <button class="ai-notification-close" onclick="window.aiChat.removeNotification(${notification.id})">
          <i class="fas fa-times"></i>
        </button>
        <div class="ai-notification-content">
          <div class="ai-notification-icon">
            <i class="fas fa-${iconName}"></i>
          </div>
          <div class="ai-notification-text">
            <div class="ai-notification-title">${this._escapeHTML(notification.title || 'התראה')}</div>
            <div class="ai-notification-description">${this._escapeHTML(notification.description || '')}</div>
            <div class="ai-notification-time">${this._escapeHTML(notification.time || '')}</div>
            <button class="ai-notification-read-btn" onclick="window.aiChat.markNotificationAsRead(${notification.id})">
              <i class="fas fa-check"></i> קראתי
            </button>
          </div>
        </div>
      `;

      notificationsList.appendChild(notifEl);
    });

    notifContainer.appendChild(notificationsList);
  }

  /**
   * מחיקת התראה בודדת
   */
  removeNotification(notifId) {
    if (window.notificationBell && typeof window.notificationBell.removeNotification === 'function') {
      window.notificationBell.removeNotification(notifId);
      // Re-render the current view
      if (this.currentView === 'notifications') {
        this._renderSystemNotificationsView();
      } else if (this.currentView === 'admin-messages') {
        this._renderAdminMessagesView();
      }
    }
  }

  /**
   * סימון התראה כנקראה (קראתי)
   */
  markNotificationAsRead(notifId) {
    if (window.notificationBell && typeof window.notificationBell.removeNotification === 'function') {
      window.notificationBell.removeNotification(notifId);
      // Re-render the current view
      if (this.currentView === 'notifications') {
        this._renderSystemNotificationsView();
      }
    }
  }

  /**
   * מחיקת כל ההתראות
   */
  clearAllNotifications() {
    if (window.notificationBell && typeof window.notificationBell.clearAllNotifications === 'function') {
      window.notificationBell.clearAllNotifications();
      // Re-render the current view
      if (this.currentView === 'notifications') {
        this._renderSystemNotificationsView();
      } else if (this.currentView === 'admin-messages') {
        this._renderAdminMessagesView();
      }
    }
  }

  /**
   * תשובה למנהל - פותח מודל תגובה ושולח ל-Firestore
   */
  async replyToAdmin(messageId, originalMessage) {
    // Use custom UserReplyModal
    if (window.userReplyModal) {
      // Open modal with callback to refresh view
      window.userReplyModal.open(messageId, originalMessage, () => {
        // Re-render the admin messages view to update UI
        if (this.currentView === 'admin-messages') {
          setTimeout(() => {
            this._renderAdminMessagesView();
          }, 300);
        }
      });

      if (this.config.debugMode) {
        console.log(`[AI Chat] Opening UserReplyModal for message ${messageId}`);
      }
    } else {
      // Fallback: Simple prompt with Firestore update
      console.warn('[AI Chat] UserReplyModal not available, using fallback prompt');
      const response = prompt(`תגובה להודעה מהמנהל:\n\n"${originalMessage}"\n\nהתגובה שלך:`);

      if (response && response.trim()) {
        try {
          if (!window.firebaseDB) {
            throw new Error('Firebase לא זמין');
          }

          // Update Firestore with response
          await window.firebaseDB.collection('user_messages')
            .doc(messageId)
            .update({
              response: response.trim(),
              status: 'responded',
              respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

          if (this.config.debugMode) {
            console.log(`[AI Chat] Response sent successfully for message ${messageId}`);
          }

          // Success notification
          if (window.notify && typeof window.notify.success === 'function') {
            window.notify.success('התגובה נשלחה בהצלחה');
          } else {
            // Fallback: simple alert
            this.addAIMessage('✅ התגובה נשלחה בהצלחה למנהל');
          }

          // Re-render the admin messages view to update UI
          if (this.currentView === 'admin-messages') {
            setTimeout(() => {
              this._renderAdminMessagesView();
            }, 500);
          }

        } catch (error) {
          console.error('[AI Chat] Error sending response:', error);

          // Error notification
          if (window.notify && typeof window.notify.error === 'function') {
            window.notify.error('שגיאה בשליחת התגובה: ' + error.message);
          } else {
            // Fallback: simple alert
            this.addErrorMessage('שגיאה בשליחת התגובה: ' + error.message);
          }
        }
      } else {
        if (this.config.debugMode) {
          console.log(`[AI Chat] Reply cancelled by user`);
        }
      }
    }
  }
}

/**
 * פונקציה גלובלית לפתיחת הודעות מהמנהל
 */
window.openAdminMessages = function() {
  if (window.aiChat) {
    // פתח את הצ'אט
    window.aiChat.show();
    // עבור לתצוגת התראות
    setTimeout(() => {
      window.aiChat.openNotifications();
    }, 100);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Export to global scope & Auto-init
// ═══════════════════════════════════════════════════════════════════════════
window.AIChatUI = AIChatUI;

// אתחול אוטומטי כשהדף נטען
window.addEventListener('DOMContentLoaded', () => {
  window.aiChat = new AIChatUI();

  if (window.AI_CONFIG?.debugMode) {
    console.log('[AI Chat UI] Ready');
  }
});
