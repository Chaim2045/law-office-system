/**
 * UserReplyModal
 * Custom modal for user responses to admin messages
 * Replaces browser's prompt() with a styled modal
 *
 * Created: 2025-12-06
 * Part of Law Office Management System
 */

class UserReplyModal {
  constructor() {
    this.modal = null;
    this.currentMessageId = null;
    this.currentOriginalMessage = null;
    this.onSendCallback = null;
    this.init();
  }

  /**
   * Initialize modal
   */
  init() {
    this.createModal();
    this.attachEventListeners();
    console.log('✅ UserReplyModal initialized');
  }

  /**
   * Create modal DOM structure
   */
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'user-reply-modal';
    modal.id = 'userReplyModal';
    modal.setAttribute('dir', 'rtl');
    modal.innerHTML = `
      <div class="user-reply-overlay"></div>
      <div class="user-reply-container">
        <div class="user-reply-header">
          <h3>
            <i class="fas fa-reply"></i>
            תגובה להודעה מהמנהל
          </h3>
          <button class="user-reply-close" aria-label="סגור">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="user-reply-body">
          <div class="user-reply-original">
            <div class="user-reply-original-label">הודעה מקורית:</div>
            <div class="user-reply-original-text" id="userReplyOriginalText"></div>
          </div>

          <div class="user-reply-form-group">
            <label class="user-reply-label" for="userReplyTextarea">התגובה שלך:</label>
            <textarea
              id="userReplyTextarea"
              class="user-reply-textarea"
              placeholder="כתוב את תגובתך כאן..."
              maxlength="1000"
            ></textarea>
            <div class="user-reply-char-count">
              <span class="current">0</span> / 1000 תווים
            </div>
          </div>
        </div>

        <div class="user-reply-footer">
          <button class="user-reply-btn-cancel">ביטול</button>
          <button class="user-reply-btn-send" disabled>
            <i class="fas fa-paper-plane"></i>
            שלח תגובה
          </button>
        </div>

        <div class="user-reply-loading">
          <div class="user-reply-spinner"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.modal.querySelector('.user-reply-close');
    closeBtn.addEventListener('click', () => this.close());

    // Cancel button
    const cancelBtn = this.modal.querySelector('.user-reply-btn-cancel');
    cancelBtn.addEventListener('click', () => this.close());

    // Send button
    const sendBtn = this.modal.querySelector('.user-reply-btn-send');
    sendBtn.addEventListener('click', () => this.send());

    // Overlay click to close
    const overlay = this.modal.querySelector('.user-reply-overlay');
    overlay.addEventListener('click', () => this.close());

    // Textarea input
    const textarea = this.modal.querySelector('#userReplyTextarea');
    textarea.addEventListener('input', () => this.updateCharCount());

    // Enter key to send (Ctrl+Enter)
    textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        this.send();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('show')) {
        this.close();
      }
    });
  }

  /**
   * Open modal
   * @param {string} messageId - Message ID
   * @param {string} originalMessage - Original message text
   * @param {Function} onSend - Callback when message is sent
   */
  open(messageId, originalMessage, onSend) {
    this.currentMessageId = messageId;
    this.currentOriginalMessage = originalMessage;
    this.onSendCallback = onSend;

    // Set original message text
    const originalTextEl = this.modal.querySelector('#userReplyOriginalText');
    originalTextEl.textContent = originalMessage;

    // Clear textarea
    const textarea = this.modal.querySelector('#userReplyTextarea');
    textarea.value = '';
    this.updateCharCount();

    // Show modal
    this.modal.classList.add('show');

    // Focus textarea
    setTimeout(() => {
      textarea.focus();
    }, 300);

    console.log('📖 UserReplyModal opened for message:', messageId);
  }

  /**
   * Close modal
   */
  close() {
    this.modal.classList.remove('show');
    this.currentMessageId = null;
    this.currentOriginalMessage = null;
    this.onSendCallback = null;

    console.log('🚪 UserReplyModal closed');
  }

  /**
   * Update character count
   */
  updateCharCount() {
    const textarea = this.modal.querySelector('#userReplyTextarea');
    const charCountEl = this.modal.querySelector('.user-reply-char-count');
    const currentEl = charCountEl.querySelector('.current');
    const sendBtn = this.modal.querySelector('.user-reply-btn-send');

    const length = textarea.value.length;
    currentEl.textContent = length;

    // Update color based on length
    charCountEl.classList.remove('warning', 'danger');
    if (length > 900) {
      charCountEl.classList.add('danger');
    } else if (length > 800) {
      charCountEl.classList.add('warning');
    }

    // Enable/disable send button
    sendBtn.disabled = length === 0;
  }

  /**
   * Show loading state
   */
  showLoading() {
    const loading = this.modal.querySelector('.user-reply-loading');
    loading.classList.add('show');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    const loading = this.modal.querySelector('.user-reply-loading');
    loading.classList.remove('show');
  }

  /**
   * Send response
   */
  async send() {
    const textarea = this.modal.querySelector('#userReplyTextarea');
    const response = textarea.value.trim();

    if (!response) {
      return;
    }

    if (!this.currentMessageId) {
      console.error('No message ID set');
      return;
    }

    this.showLoading();

    try {
      if (!window.firebaseDB) {
        throw new Error('Firebase לא זמין');
      }

      // Update Firestore
      await window.firebaseDB.collection('user_messages')
        .doc(this.currentMessageId)
        .update({
          response: response,
          status: 'responded',
          respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      console.log(`✅ Response sent for message ${this.currentMessageId}`);

      // Success notification
      if (window.notify && typeof window.notify.success === 'function') {
        window.notify.success('התגובה נשלחה בהצלחה');
      }

      // Call callback if provided
      if (this.onSendCallback && typeof this.onSendCallback === 'function') {
        this.onSendCallback();
      }

      // Close modal
      this.close();

    } catch (error) {
      console.error('❌ Error sending response:', error);

      this.hideLoading();

      // Error notification
      if (window.notify && typeof window.notify.error === 'function') {
        window.notify.error('שגיאה בשליחת התגובה: ' + error.message);
      } else {
        alert('שגיאה בשליחת התגובה: ' + error.message);
      }
    }
  }

  /**
   * Destroy modal
   */
  destroy() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

// Auto-initialize singleton
if (!window.userReplyModal) {
  window.userReplyModal = new UserReplyModal();
  console.log('✅ UserReplyModal singleton created');
}
