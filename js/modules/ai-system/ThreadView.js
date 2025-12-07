/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ThreadView - Thread-Based Message Conversations
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Displays full conversation thread between user and admin.
 * Shows original message + all replies in chronological order.
 *
 * Features:
 * ✅ Real-time updates (Firestore onSnapshot)
 * ✅ Clean chat-style UI
 * ✅ Reply input at bottom
 * ✅ Automatic scroll to bottom
 * ✅ Loading states
 * ✅ Error handling
 *
 * Created: 2025-12-07
 * Part of Law Office Management System
 */

class ThreadView {
  constructor() {
    this.currentThreadId = null;
    this.currentOriginalMessage = null;
    this.unsubscribeReplies = null;
    this.replies = [];
  }

  /**
   * Open thread view for a specific message
   * @param {string} messageId - Message ID
   * @param {Object} originalMessage - Original message data
   */
  async open(messageId, originalMessage) {
    this.currentThreadId = messageId;
    this.currentOriginalMessage = originalMessage;

    // Render UI
    this.render();

    // Load and listen to replies
    await this.loadAndListenToReplies();

    console.log('📖 ThreadView opened for message:', messageId);
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

    // Return to admin messages view
    if (window.aiChat) {
      window.aiChat.openAdminMessages();
    }

    console.log('🚪 ThreadView closed');
  }

  /**
   * Render thread view UI
   */
  render() {
    const messagesContainer = document.getElementById('aiChatMessages');
    const inputContainer = document.querySelector('.ai-chat-input-container');

    if (!messagesContainer) {
      console.error('Messages container not found');
      return;
    }

    // Hide chat and input
    messagesContainer.style.display = 'none';
    if (inputContainer) {
      inputContainer.style.display = 'none';
    }

    // Create or get thread container
    let threadContainer = document.getElementById('aiThreadContainer');

    if (!threadContainer) {
      threadContainer = document.createElement('div');
      threadContainer.id = 'aiThreadContainer';
      threadContainer.className = 'ai-thread-container';
      messagesContainer.parentElement.insertBefore(threadContainer, inputContainer);
    }

    threadContainer.style.display = 'flex';

    // Build HTML
    threadContainer.innerHTML = `
      <div class="ai-thread-header">
        <button class="ai-thread-back-btn" onclick="window.threadView.close()">
          <i class="fas fa-arrow-right"></i> חזרה
        </button>
        <h2 class="ai-thread-title">💬 שיחה עם המנהל</h2>
      </div>

      <div class="ai-thread-messages" id="aiThreadMessages">
        <!-- Original message -->
        <div class="ai-thread-message ai-thread-message-admin">
          <div class="ai-thread-message-header">
            <strong>${this._escapeHTML(this.currentOriginalMessage.fromName || 'מנהל')}</strong>
            <span class="ai-thread-message-time">${this._escapeHTML(this.currentOriginalMessage.time || '')}</span>
          </div>
          <div class="ai-thread-message-content">
            ${this._escapeHTML(this.currentOriginalMessage.message || this.currentOriginalMessage.description || '')}
          </div>
        </div>

        <!-- Replies will be added here -->
        <div id="aiThreadRepliesList"></div>

        <!-- Loading indicator -->
        <div class="ai-thread-loading" id="aiThreadLoading">
          <div class="ai-thread-spinner"></div>
          <div>טוען תשובות...</div>
        </div>
      </div>

      <div class="ai-thread-input-container">
        <textarea
          id="aiThreadReplyInput"
          class="ai-thread-input"
          placeholder="כתוב תשובה..."
          rows="2"
          maxlength="1000"
        ></textarea>
        <button class="ai-thread-send-btn" id="aiThreadSendBtn" onclick="window.threadView.sendReply()">
          <i class="fas fa-paper-plane"></i>
          שלח
        </button>
      </div>
    `;

    // Auto-resize textarea
    const textarea = threadContainer.querySelector('#aiThreadReplyInput');
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
   * Load and listen to replies
   */
  async loadAndListenToReplies() {
    if (!this.currentThreadId) {
      console.error('No thread ID set');
      return;
    }

    if (!window.notificationBell) {
      console.error('NotificationBell not available');
      return;
    }

    const loadingEl = document.getElementById('aiThreadLoading');
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    try {
      // Set up real-time listener
      this.unsubscribeReplies = window.notificationBell.listenToThreadReplies(
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

    } catch (error) {
      console.error('Error loading thread replies:', error);

      // Hide loading and show error
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="ai-thread-error">
            <i class="fas fa-exclamation-triangle"></i>
            שגיאה בטעינת תשובות
          </div>
        `;
      }
    }
  }

  /**
   * Render replies list
   * @param {Array} replies - Array of reply objects
   */
  renderReplies(replies) {
    const repliesList = document.getElementById('aiThreadRepliesList');
    if (!repliesList) return;

    if (replies.length === 0) {
      repliesList.innerHTML = '';
      return;
    }

    repliesList.innerHTML = replies.map(reply => {
      const isCurrentUser = reply.from === window.currentUser?.email;
      const messageClass = isCurrentUser ? 'ai-thread-message-user' : 'ai-thread-message-admin';

      return `
        <div class="ai-thread-message ${messageClass}">
          <div class="ai-thread-message-header">
            <strong>${this._escapeHTML(reply.fromName || reply.from)}</strong>
            <span class="ai-thread-message-time">${this._formatTime(reply.createdAt)}</span>
          </div>
          <div class="ai-thread-message-content">
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
    const textarea = document.getElementById('aiThreadReplyInput');
    const sendBtn = document.getElementById('aiThreadSendBtn');

    if (!textarea || !sendBtn) return;

    const replyText = textarea.value.trim();

    if (!replyText) {
      return;
    }

    if (!this.currentThreadId) {
      console.error('No thread ID');
      return;
    }

    if (!window.currentUser) {
      console.error('No current user');
      return;
    }

    if (!window.notificationBell) {
      console.error('NotificationBell not available');
      return;
    }

    // Disable button
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

    try {
      // Send reply using NotificationBell API
      await window.notificationBell.sendReplyToAdmin(
        this.currentThreadId,
        replyText,
        window.currentUser
      );

      // Clear textarea
      textarea.value = '';
      textarea.style.height = 'auto';

      // Success notification
      if (window.NotificationSystem) {
        window.NotificationSystem.success('✅ התגובה נשלחה בהצלחה!', 3000);
      }

      // The real-time listener will automatically add the reply to the view

    } catch (error) {
      console.error('Error sending reply:', error);

      // Error notification
      if (window.NotificationSystem) {
        window.NotificationSystem.error('❌ שגיאה בשליחת התגובה: ' + error.message, 5000);
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
      const messagesContainer = document.getElementById('aiThreadMessages');
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
window.ThreadView = ThreadView;
window.threadView = new ThreadView();

console.log('✅ ThreadView initialized');
