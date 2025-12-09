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

    // ✅ Mark message as read (user opened the thread)
    this.markThreadAsRead(messageId);

    console.log('📖 ThreadView opened for message:', messageId);
  }

  /**
   * Mark thread as read by user
   * @param {string} messageId - Message ID
   * @private
   */
  async markThreadAsRead(messageId) {
    if (!messageId || !window.firebaseDB) {
      return;
    }

    try {
      // Update userReadLastReply flag to indicate user has seen the latest replies
      await window.firebaseDB.collection('user_messages')
        .doc(messageId)
        .update({
          userReadLastReply: true,
          userLastReadAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      console.log('✅ ThreadView: Marked thread as read:', messageId);
    } catch (error) {
      console.error('❌ ThreadView: Error marking thread as read:', error);
    }
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

    // ✅ Hide thread container
    const threadContainer = document.getElementById('aiThreadContainer');
    if (threadContainer) {
      threadContainer.classList.remove('active');
    }

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

    // ✅ Add active class to show the container
    threadContainer.classList.add('active');

    // Build HTML
    threadContainer.innerHTML = `
      <div class="ai-thread-header">
        <button class="ai-thread-back-btn" id="aiThreadBackBtn">
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
        <button class="ai-thread-send-btn" id="aiThreadSendBtn">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    `;

    // ✅ Get all interactive elements
    const backBtn = threadContainer.querySelector('#aiThreadBackBtn');
    const textarea = threadContainer.querySelector('#aiThreadReplyInput');
    const sendBtn = threadContainer.querySelector('#aiThreadSendBtn');

    // ✅ Back button event listener
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        console.log('🔙 Back button clicked');
        this.close();
      });
    }

    // Auto-resize textarea
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

    // ✅ Send button event listener
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        console.log('📤 Send button clicked');
        this.sendReply();
      });
    }
  }

  /**
   * Load and listen to replies
   */
  async loadAndListenToReplies() {
    if (!this.currentThreadId) {
      console.error('❌ ThreadView: No thread ID set');
      return;
    }

    // ✅ Wait for notificationBell to be available (with timeout)
    const notificationBell = await this._waitForNotificationBell();

    if (!notificationBell) {
      console.error('❌ ThreadView: NotificationBell not available after timeout');
      const loadingEl = document.getElementById('aiThreadLoading');
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="ai-thread-error">
            <i class="fas fa-exclamation-triangle"></i>
            מערכת ההודעות לא זמינה - נסה לרענן את הדף
          </div>
        `;
      }
      return;
    }

    const loadingEl = document.getElementById('aiThreadLoading');
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    try {
      // Set up real-time listener
      this.unsubscribeReplies = notificationBell.listenToThreadReplies(
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
      console.error('❌ ThreadView: Error loading thread replies:', error);

      // Hide loading and show error
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="ai-thread-error">
            <i class="fas fa-exclamation-triangle"></i>
            שגיאה בטעינת תשובות: ${error.message}
          </div>
        `;
      }
    }
  }

  /**
   * Wait for window.notificationBell to be available
   * @returns {Promise<Object|null>} - NotificationBell instance or null after timeout
   * @private
   */
  async _waitForNotificationBell(timeout = 5000) {
    const startTime = Date.now();

    while (!window.notificationBell) {
      // Check if timeout exceeded
      if (Date.now() - startTime > timeout) {
        console.error('❌ ThreadView: Timeout waiting for notificationBell');
        return null;
      }

      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('✅ ThreadView: notificationBell is available');
    return window.notificationBell;
  }

  /**
   * Render replies list
   * @param {Array} replies - Array of reply objects
   */
  renderReplies(replies) {
    const repliesList = document.getElementById('aiThreadRepliesList');
    if (!repliesList) {
return;
}

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
    console.log('🔵 sendReply() called');
    console.log('🔵 this.currentThreadId:', this.currentThreadId);

    const textarea = document.getElementById('aiThreadReplyInput');
    const sendBtn = document.getElementById('aiThreadSendBtn');

    if (!textarea || !sendBtn) {
      console.error('❌ Textarea or button not found');
      return;
    }

    const replyText = textarea.value.trim();

    if (!replyText) {
      console.log('⚠️ No reply text');
      return;
    }

    if (!this.currentThreadId) {
      console.error('❌ No thread ID - this.currentThreadId:', this.currentThreadId);
      return;
    }

    // ✅ Wait for notificationBell to be available
    const notificationBell = await this._waitForNotificationBell();

    if (!notificationBell) {
      console.error('❌ NotificationBell not available');
      alert('מערכת ההודעות לא זמינה - נסה לרענן את הדף');
      return;
    }

    // ✅ Get current user from notificationBell (single source of truth)
    const currentUser = notificationBell.currentUser;

    if (!currentUser) {
      console.error('❌ No current user');
      alert('משתמש לא מחובר - נסה להתחבר מחדש');
      return;
    }

    console.log('✅ All validations passed, sending reply...');
    console.log('📧 Thread ID:', this.currentThreadId);
    console.log('👤 Current user:', currentUser.email);

    // Disable button
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
      console.log('🚀 Calling sendReplyToAdmin...');

      // Send reply using NotificationBell API
      await notificationBell.sendReplyToAdmin(
        this.currentThreadId,
        replyText,
        currentUser
      );

      console.log('✅ Reply sent successfully!');

      // Clear textarea
      if (textarea) {
        textarea.value = '';
        textarea.style.height = 'auto';
      }

      // Success notification
      if (window.NotificationSystem) {
        window.NotificationSystem.success('✅ התגובה נשלחה בהצלחה!', 3000);
      }

      // The real-time listener will automatically add the reply to the view

    } catch (error) {
      console.error('❌ Error sending reply:', error);

      // Error notification
      if (window.NotificationSystem) {
        window.NotificationSystem.error('❌ שגיאה בשליחת התגובה: ' + error.message, 5000);
      } else {
        alert('שגיאה בשליחת התגובה: ' + error.message);
      }

    } finally {
      // Re-enable button
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      }
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
    if (!date) {
return '';
}

    try {
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
    if (!str) {
return '';
}

    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export to global scope
window.ThreadView = ThreadView;
window.threadView = new ThreadView();

console.log('✅ ThreadView initialized');
