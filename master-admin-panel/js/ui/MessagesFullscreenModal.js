/**
 * MessagesFullscreenModal
 * Full-screen timeline modal for viewing user message history
 * Replaces the limited tab view with an expanded, scrollable timeline
 *
 * Created: 2025-12-06
 * Part of Master Admin Panel
 */

(function() {
  'use strict';

  class MessagesFullscreenModal {
    constructor() {
      this.modal = null;
      this.currentUser = null;
      this.messages = [];
      this.init();
    }

    /**
     * Initialize modal
     */
    init() {
      this.createModal();
      this.attachEventListeners();
      console.log('✅ MessagesFullscreenModal initialized');
    }

    /**
     * Create modal DOM structure
     */
    createModal() {
      const modal = document.createElement('div');
      modal.className = 'messages-fullscreen-modal';
      modal.id = 'messagesFullscreenModal';
      modal.innerHTML = `
        <div class="messages-fullscreen-container">
          <div class="messages-fullscreen-header">
            <div class="messages-fullscreen-header-content">
              <h2>
                <i class="fas fa-comments"></i>
                היסטוריית הודעות
              </h2>
              <div class="user-info-badge">
                <i class="fas fa-user"></i>
                <span id="fullscreenUserName"></span>
              </div>
            </div>
            <div class="messages-fullscreen-actions">
              <button class="messages-fullscreen-close" aria-label="סגור">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div class="messages-stats-bar">
            <div class="messages-stat-item">
              <i class="fas fa-envelope"></i>
              <span><strong id="totalMessagesCount">0</strong> הודעות</span>
            </div>
            <div class="messages-stat-item unread">
              <i class="fas fa-circle"></i>
              <span><strong id="unreadMessagesCount">0</strong> לא נקראו</span>
            </div>
            <div class="messages-stat-item responded">
              <i class="fas fa-check-double"></i>
              <span><strong id="respondedMessagesCount">0</strong> נענו</span>
            </div>
          </div>

          <div class="messages-fullscreen-content" id="messagesFullscreenContent">
            <div class="messages-fullscreen-timeline" id="messagesFullscreenTimeline">
              <!-- Timeline items will be inserted here -->
            </div>
          </div>
        </div>

        <button class="scroll-to-top-btn" id="scrollToTopBtn">
          <i class="fas fa-arrow-up"></i>
        </button>
      `;

      document.body.appendChild(modal);
      this.modal = modal;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Close button
      const closeBtn = this.modal.querySelector('.messages-fullscreen-close');
      closeBtn.addEventListener('click', () => this.close());

      // Scroll to top button
      const scrollBtn = this.modal.querySelector('#scrollToTopBtn');
      scrollBtn.addEventListener('click', () => this.scrollToTop());

      // Show/hide scroll button based on scroll position
      const content = this.modal.querySelector('.messages-fullscreen-content');
      content.addEventListener('scroll', () => {
        if (content.scrollTop > 300) {
          scrollBtn.classList.add('show');
        } else {
          scrollBtn.classList.remove('show');
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
     * Open modal with user messages
     * @param {Object} user - User object
     * @param {Array} messages - Array of messages
     */
    open(user, messages) {
      if (!user) {
        console.error('No user provided');
        return;
      }

      this.currentUser = user;
      this.messages = messages || [];

      // Update user name
      const userNameEl = this.modal.querySelector('#fullscreenUserName');
      userNameEl.textContent = user.name || user.email;

      // Update stats
      this.updateStats();

      // Render timeline
      this.renderTimeline();

      // Show modal
      this.modal.classList.add('show');

      // Scroll to top
      setTimeout(() => {
        this.scrollToTop();
      }, 100);

      console.log(`📖 MessagesFullscreenModal opened for ${user.name || user.email}`);
    }

    /**
     * Close modal
     */
    close() {
      this.modal.classList.remove('show');
      this.currentUser = null;
      this.messages = [];

      console.log('🚪 MessagesFullscreenModal closed');
    }

    /**
     * Update statistics
     */
    updateStats() {
      const totalCount = this.messages.length;
      const unreadCount = this.messages.filter(m => m.status === 'unread').length;
      const respondedCount = this.messages.filter(m => m.status === 'responded').length;

      this.modal.querySelector('#totalMessagesCount').textContent = totalCount;
      this.modal.querySelector('#unreadMessagesCount').textContent = unreadCount;
      this.modal.querySelector('#respondedMessagesCount').textContent = respondedCount;
    }

    /**
     * Render timeline
     */
    renderTimeline() {
      const timelineEl = this.modal.querySelector('#messagesFullscreenTimeline');

      if (this.messages.length === 0) {
        timelineEl.innerHTML = this.renderEmptyState();
        return;
      }

      // Sort messages by date (newest first)
      const sortedMessages = [...this.messages].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      // Render each message
      const html = sortedMessages.map(msg => this.renderMessageItem(msg)).join('');
      timelineEl.innerHTML = html;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
      return `
        <div class="messages-fullscreen-empty">
          <div class="messages-fullscreen-empty-icon">
            <i class="fas fa-inbox"></i>
          </div>
          <h3>אין הודעות</h3>
          <p>לא נשלחו הודעות למשתמש זה עדיין</p>
        </div>
      `;
    }

    /**
     * Convert timestamp to Date object (handles Firestore Timestamp, Date, or number)
     * @param {*} timestamp - Timestamp in various formats
     */
    toDate(timestamp) {
      if (!timestamp) return null;

      // Already a Date object
      if (timestamp instanceof Date) return timestamp;

      // Firestore Timestamp object
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }

      // Number (milliseconds)
      if (typeof timestamp === 'number') {
        return new Date(timestamp);
      }

      // Try to parse as date string
      try {
        return new Date(timestamp);
      } catch (e) {
        console.error('Failed to parse timestamp:', timestamp);
        return null;
      }
    }

    /**
     * Render single message item
     * @param {Object} msg - Message object
     */
    renderMessageItem(msg) {
      const dotColor = this.getMessageDotColor(msg);
      const typeClass = `type-${msg.type || 'info'}`;
      const createdDate = this.toDate(msg.createdAt);
      const time = createdDate ? createdDate.toLocaleString('he-IL') : '';

      return `
        <div class="fullscreen-timeline-item">
          <div class="fullscreen-timeline-dot ${dotColor}"></div>
          <div class="fullscreen-message-card">
            <div class="fullscreen-message-header">
              <div class="fullscreen-message-meta">
                <span class="message-type-badge ${typeClass}">
                  ${this.getTypeLabel(msg.type)}
                </span>
                ${msg.priority > 1 ? `
                  <span class="message-priority-badge">
                    <i class="fas fa-star"></i> עדיפות ${msg.priority}
                  </span>
                ` : ''}
                <span class="message-time-badge">
                  <i class="fas fa-clock"></i> ${time}
                </span>
              </div>
            </div>
            <div class="fullscreen-message-body">
              ${this.escapeHTML(msg.message)}
            </div>
            ${this.renderResponse(msg)}
          </div>
        </div>
      `;
    }

    /**
     * Render response section
     * @param {Object} msg - Message object
     */
    renderResponse(msg) {
      if (!msg.response && msg.status === 'unread') {
        return `
          <div class="fullscreen-message-response">
            <div class="fullscreen-response-header">
              <i class="fas fa-circle"></i>
              לא נקרא
            </div>
          </div>
        `;
      }

      if (!msg.response && msg.status === 'read') {
        return `
          <div class="fullscreen-message-response read">
            <div class="fullscreen-response-header">
              <i class="fas fa-eye"></i>
              נקרא ע"י המשתמש
            </div>
          </div>
        `;
      }

      if (msg.response && msg.status === 'responded') {
        const respondedDate = this.toDate(msg.respondedAt);
        const responseTime = respondedDate ? respondedDate.toLocaleString('he-IL') : '';

        return `
          <div class="fullscreen-message-response responded">
            <div class="fullscreen-response-header">
              <i class="fas fa-reply"></i>
              תגובת המשתמש:
            </div>
            <div class="fullscreen-response-body">
              "${this.escapeHTML(msg.response)}"
            </div>
            ${responseTime ? `
              <div class="fullscreen-response-time">
                <i class="fas fa-clock"></i> ${responseTime}
              </div>
            ` : ''}
          </div>
        `;
      }

      if (msg.status === 'dismissed') {
        return `
          <div class="fullscreen-message-response">
            <div class="fullscreen-response-header">
              <i class="fas fa-times-circle"></i>
              נדחה ע"י המשתמש
            </div>
          </div>
        `;
      }

      return '';
    }

    /**
     * Get dot color based on message type/priority
     * @param {Object} msg - Message object
     */
    getMessageDotColor(msg) {
      if (msg.priority >= 5 || msg.type === 'alert') {
        return 'msg-red';
      }
      if (msg.type === 'warning') {
        return 'msg-orange';
      }
      return 'msg-blue';
    }

    /**
     * Get type label in Hebrew
     * @param {string} type - Message type
     */
    getTypeLabel(type) {
      const labels = {
        info: 'מידע',
        warning: 'אזהרה',
        alert: 'דחוף',
        reminder: 'תזכורת',
        urgent: 'דחוף'
      };
      return labels[type] || 'מידע';
    }

    /**
     * Escape HTML
     * @param {string} text - Text to escape
     */
    escapeHTML(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    /**
     * Scroll to top
     */
    scrollToTop() {
      const content = this.modal.querySelector('.messages-fullscreen-content');
      content.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
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
  if (!window.messagesFullscreenModal) {
    window.messagesFullscreenModal = new MessagesFullscreenModal();
    console.log('✅ MessagesFullscreenModal singleton created');
  }

})();
