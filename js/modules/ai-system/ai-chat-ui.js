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
        <button class="ai-header-btn ai-notifications-btn" id="aiNotificationsBtn" onclick="window.aiChat.openNotifications()" title="התראות">
          <i class="fas fa-bell"></i>
          <span class="ai-notification-badge" id="aiNotificationBadge"></span>
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

<!-- Floating Button -->
<button class="ai-float-btn" id="aiFloatBtn" onclick="window.aiChat.toggle()">
  <i class="fas fa-robot"></i>
  <span class="ai-float-btn-text">שאל את המומחה</span>
  <span class="ai-float-notification-badge" id="aiFloatNotificationBadge"></span>
</button>
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

    if (!input) return;

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

    if (!container) return;

    container.classList.remove('hidden');
    floatBtn?.classList.add('hidden');
    this.isOpen = true;

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

    if (!container) return;

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

      if (!userMessage) return;

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
      if (typing) typing.remove();

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
    if (!messagesContainer) return;

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
    if (!messagesContainer) return;

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
    if (!messagesContainer) return null;

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
    if (!messagesContainer) return;

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
    if (!messagesContainer) return null;

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
    if (!contentEl) return;

    contentEl.textContent += text;
    this._scrollToBottom();
  }

  /**
   * מחיקת הודעה
   * @private
   */
  _removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) message.remove();
  }

  /**
   * ניקוי כל השיחה
   */
  clearConversation() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) return;

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
    if (!messagesContainer) return;

    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  }

  /**
   * עיצוב תשובת AI (markdown בסיסי)
   * @private
   */
  _formatAIResponse(text) {
    if (!text) return '';

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
      if (!messagesContainer) return;

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

      if (!saved) return;

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
   * @private
   */
  _updateNotificationBadge() {
    const headerBadge = document.getElementById('aiNotificationBadge');
    const floatBadge = document.getElementById('aiFloatNotificationBadge');
    const floatBtn = document.getElementById('aiFloatBtn');

    const count = window.notificationBell?.notifications?.length || 0;

    // Update header badge
    if (headerBadge) {
      if (count > 0) {
        headerBadge.textContent = count;
        headerBadge.style.display = 'flex';
      } else {
        headerBadge.textContent = '';
        headerBadge.style.display = 'none';
      }
    }

    // Update floating button badge
    if (floatBadge) {
      if (count > 0) {
        floatBadge.textContent = count;
        floatBadge.style.display = 'flex';
        // Add attention class to button
        if (floatBtn) floatBtn.classList.add('has-notifications');
      } else {
        floatBadge.textContent = '';
        floatBadge.style.display = 'none';
        // Remove attention class
        if (floatBtn) floatBtn.classList.remove('has-notifications');
      }
    }
  }

  /**
   * פתיחת מערכת ההתראות
   */
  openNotifications() {
    this.currentView = 'notifications';
    this._renderNotificationsView();

    if (this.config.debugMode) {
      console.log('[AI Chat] Showing notifications view');
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
    if (messagesContainer) messagesContainer.style.display = 'flex';
    if (inputContainer) inputContainer.style.display = 'flex';

    // הסתר את ההתראות
    if (notifContainer) notifContainer.style.display = 'none';
  }

  /**
   * הצגת view ההתראות
   * @private
   */
  _renderNotificationsView() {
    const messagesContainer = document.getElementById('aiChatMessages');
    const inputContainer = document.querySelector('.ai-chat-input-container');

    if (!messagesContainer) return;

    // הסתר את הצ'אט וה-input
    messagesContainer.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'none';

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

    // Get notifications
    const notifications = window.notificationBell?.notifications || [];

    if (notifications.length === 0) {
      // Empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'ai-notifications-empty';
      emptyState.innerHTML = `
        <div class="ai-notifications-empty-icon">
          <i class="fas fa-bell-slash" style="font-size: 48px; color: var(--ai-gray-400);"></i>
        </div>
        <h3 class="ai-notifications-empty-title">אין התראות</h3>
        <p class="ai-notifications-empty-text">כל ההתראות שלך יופיעו כאן</p>
      `;
      notifContainer.appendChild(emptyState);
      return;
    }

    // Notifications list
    const notificationsList = document.createElement('div');
    notificationsList.className = 'ai-notifications-list';

    notifications.forEach(notification => {
      const notifEl = document.createElement('div');
      notifEl.className = `ai-notification-item ai-notification-${notification.type || 'info'}`;
      if (notification.urgent) notifEl.classList.add('ai-notification-urgent');

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
      this._renderNotificationsView(); // re-render
    }
  }

  /**
   * מחיקת כל ההתראות
   */
  clearAllNotifications() {
    if (window.notificationBell && typeof window.notificationBell.clearAllNotifications === 'function') {
      window.notificationBell.clearAllNotifications();
      this._renderNotificationsView(); // re-render
    }
  }
}

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
