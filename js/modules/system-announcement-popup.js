/**
 * System Announcement Popup
 * Modal popup for unread system announcements on login
 *
 * @version 1.0.0
 * @created 2026-02-09
 */

const TYPE_CONFIG = {
  info:    { icon: 'fa-info-circle',          color: '#0ea5e9' },
  success: { icon: 'fa-check-circle',         color: '#10b981' },
  warning: { icon: 'fa-exclamation-triangle', color: '#f59e0b' },
  error:   { icon: 'fa-times-circle',         color: '#ef4444' }
};

class SystemAnnouncementPopup {
  constructor() {
    this.announcements = [];
    this.currentIndex = 0;
    this.overlay = null;
    this.db = null;
    this.user = null;
    this.userRole = null;
    this.escapeHandler = null;
    this.countdownInterval = null;
    this.overlayClickDisabled = false;
  }

  /**
   * Initialize popup — fetch unread announcements and show if any
   * @param {Object} user - Firebase user
   * @param {Object} db - Firestore instance
   */
  async init(user, db) {
    if (!user || !db) {
      console.error('❌ [AnnouncementPopup] Missing user or db');
      return;
    }

    this.user = user;
    this.db = db;

    await this.fetchUserRole();
    await this.fetchUnreadAnnouncements();

    if (this.announcements.length > 0) {
      this.render();
      this.show();
    }
  }

  /**
   * Fetch user role from employees collection
   */
  async fetchUserRole() {
    try {
      if (!this.user || !this.user.email) {
        this.userRole = null;
        return;
      }

      const userDoc = await this.db.collection('employees').doc(this.user.email).get();

      if (!userDoc.exists) {
        this.userRole = null;
        return;
      }

      const userData = userDoc.data();
      this.userRole = userData.role || 'employee';
    } catch (error) {
      console.error('❌ [AnnouncementPopup] Error fetching user role:', error);
      this.userRole = null;
    }
  }

  /**
   * One-time query for unread announcements (no listener)
   */
  async fetchUnreadAnnouncements() {
    try {
      const snapshot = await this.db.collection('system_announcements')
        .where('active', '==', true)
        .get();

      const now = new Date();
      const userEmail = this.user.email;

      this.announcements = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            message: data.message || '',
            type: data.type || 'info',
            priority: data.priority || 3,
            targetAudience: data.targetAudience || 'all',
            startDate: data.startDate?.toDate(),
            endDate: data.endDate?.toDate(),
            displaySettings: data.displaySettings || {},
            readBy: data.readBy || {},
            dismissedBy: data.dismissedBy || [],
            popupSettings: data.popupSettings || { requireReadConfirmation: true, readTimer: 'auto' }
          };
        })
        .filter(a => {
          // Must have showOnLogin enabled
          if (!a.displaySettings.showOnLogin) {
return false;
}

          // Check start date
          if (a.startDate && a.startDate > now) {
return false;
}

          // Check end date
          if (a.endDate && a.endDate < now) {
return false;
}

          // Check target audience
          if (!this.shouldShowToUser(a.targetAudience)) {
return false;
}

          // Check readBy (new) OR dismissedBy (legacy)
          if (a.readBy[userEmail] || a.dismissedBy.includes(userEmail)) {
return false;
}

          // Check localStorage temporary dismiss (4 hours)
          const dismissedAt = localStorage.getItem('announcement_popup_dismissed_' + a.id);
          if (dismissedAt) {
            const hoursPassed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
            if (hoursPassed < 4) {
return false;
}
            localStorage.removeItem('announcement_popup_dismissed_' + a.id);
          }

          return true;
        })
        .sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('❌ [AnnouncementPopup] Error fetching announcements:', error);
      this.announcements = [];
    }
  }

  /**
   * Check if announcement should show to current user
   * @param {string} targetAudience
   * @returns {boolean}
   */
  shouldShowToUser(targetAudience) {
    if (!targetAudience || targetAudience === 'all') {
return true;
}
    if (!this.userRole) {
return true;
}
    if (targetAudience === 'admins' && this.userRole === 'admin') {
return true;
}
    if (targetAudience === 'employees' && this.userRole === 'employee') {
return true;
}
    if (targetAudience === 'employees' && this.userRole === 'admin') {
return true;
}
    return false;
  }

  /**
   * Build DOM structure
   */
  render() {
    // Remove existing if any
    const existing = document.querySelector('.announcement-popup-overlay');
    if (existing) {
existing.remove();
}

    const overlay = document.createElement('div');
    overlay.className = 'announcement-popup-overlay';

    const hasMultiple = this.announcements.length > 1;

    overlay.innerHTML = `
      <div class="announcement-popup-modal">
        <div class="announcement-popup-header">
          <div class="announcement-popup-type-icon" id="apTypeIcon">
            <i class="fas fa-info-circle"></i>
          </div>
          <span class="announcement-popup-counter ${hasMultiple ? '' : 'announcement-popup-counter-hidden'}" id="apCounter"></span>
          <button class="announcement-popup-close-btn" id="apCloseBtn" title="סגור">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="announcement-popup-body">
          <h3 class="announcement-popup-title" id="apTitle"></h3>
          <p class="announcement-popup-message" id="apMessage"></p>
        </div>
        <div class="announcement-popup-footer">
          <div class="announcement-popup-nav ${hasMultiple ? '' : 'announcement-popup-nav-hidden'}" id="apNav">
            <button class="announcement-popup-prev" id="apPrev" title="הקודם">
              <i class="fas fa-chevron-right"></i>
            </button>
            <div class="announcement-popup-dots" id="apDots"></div>
            <button class="announcement-popup-next" id="apNext" title="הבא">
              <i class="fas fa-chevron-left"></i>
            </button>
          </div>
          <div class="announcement-popup-actions">
            <button class="announcement-popup-mark-read" id="apMarkRead">
              <i class="fas fa-check"></i>
              <span>קראתי</span>
            </button>
            <button class="announcement-popup-mark-all-read ${hasMultiple ? '' : 'announcement-popup-mark-all-hidden'}" id="apMarkAllRead">
              קראתי הכל
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.overlay) {
return;
}

    const closeBtn = this.overlay.querySelector('#apCloseBtn');
    const prevBtn = this.overlay.querySelector('#apPrev');
    const nextBtn = this.overlay.querySelector('#apNext');
    const markReadBtn = this.overlay.querySelector('#apMarkRead');
    const markAllBtn = this.overlay.querySelector('#apMarkAllRead');

    // Close button
    closeBtn.addEventListener('click', () => this.dismiss());

    // Overlay click (outside modal)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay && !this.overlayClickDisabled) {
this.dismiss();
}
    });

    // Navigation
    prevBtn.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.showAnnouncement(this.currentIndex - 1);
      }
    });

    nextBtn.addEventListener('click', () => {
      if (this.currentIndex < this.announcements.length - 1) {
        this.showAnnouncement(this.currentIndex + 1);
      }
    });

    // Dots
    const dotsContainer = this.overlay.querySelector('#apDots');
    dotsContainer.addEventListener('click', (e) => {
      const dot = e.target.closest('.announcement-popup-dot');
      if (dot) {
        const index = parseInt(dot.dataset.index);
        this.showAnnouncement(index);
      }
    });

    // Mark as read
    markReadBtn.addEventListener('click', () => {
      const current = this.announcements[this.currentIndex];
      if (current) {
this.markAsRead(current.id);
}
    });

    // Mark all as read
    markAllBtn.addEventListener('click', () => this.markAllAsRead());

    // Escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape' && !this.overlayClickDisabled) {
this.dismiss();
}
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  /**
   * Show specific announcement by index
   * @param {number} index
   */
  showAnnouncement(index) {
    if (index < 0 || index >= this.announcements.length) {
return;
}

    this.currentIndex = index;
    const a = this.announcements[index];
    const typeConf = TYPE_CONFIG[a.type] || TYPE_CONFIG.info;

    // Type icon
    const iconEl = this.overlay.querySelector('#apTypeIcon');
    iconEl.className = 'announcement-popup-type-icon announcement-popup-type-' + a.type;
    iconEl.innerHTML = `<i class="fas ${typeConf.icon}"></i>`;

    // Title
    const titleEl = this.overlay.querySelector('#apTitle');
    if (a.title) {
      titleEl.textContent = a.title;
      titleEl.classList.remove('announcement-popup-title-hidden');
    } else {
      titleEl.classList.add('announcement-popup-title-hidden');
    }

    // Message
    this.overlay.querySelector('#apMessage').textContent = a.message;

    // Counter
    const counterEl = this.overlay.querySelector('#apCounter');
    counterEl.textContent = `${index + 1} / ${this.announcements.length}`;

    // Dots
    const dotsEl = this.overlay.querySelector('#apDots');
    dotsEl.innerHTML = this.announcements.map((_, i) => {
      const active = i === index ? 'announcement-popup-dot-active' : '';
      return `<button class="announcement-popup-dot ${active}" data-index="${i}"></button>`;
    }).join('');

    // Navigation buttons state
    const prevBtn = this.overlay.querySelector('#apPrev');
    const nextBtn = this.overlay.querySelector('#apNext');
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === this.announcements.length - 1;

    // Clear previous timer
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const announcement = this.announcements[index];
    const readBtn = this.overlay.querySelector('.announcement-popup-mark-read');
    const seconds = this.getReadTimer(announcement);

    // Start countdown
    readBtn.disabled = true;
    let remaining = seconds;
    readBtn.innerHTML = `קראתי (${remaining})`;

    this.countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        readBtn.disabled = false;
        readBtn.innerHTML = '✓ קראתי';
      } else {
        readBtn.innerHTML = `קראתי (${remaining})`;
      }
    }, 1000);

    // requireReadConfirmation — control close/escape/overlay
    const requireRead = announcement.popupSettings?.requireReadConfirmation !== false;
    const closeBtn = this.overlay.querySelector('.announcement-popup-close-btn');

    if (requireRead) {
      closeBtn.style.display = 'none';
      this.overlayClickDisabled = true;
    } else {
      closeBtn.style.display = '';
      this.overlayClickDisabled = false;
    }
  }

  /**
   * Calculate read timer seconds based on settings or content length
   * @param {Object} announcement
   * @returns {number}
   */
  getReadTimer(announcement) {
    const settings = announcement.popupSettings || {};
    if (settings.readTimer && settings.readTimer !== 'auto') {
      return parseInt(settings.readTimer);
    }
    // Auto — לפי אורך הודעה
    const len = (announcement.title || '').length + (announcement.message || '').length;
    if (len <= 50) {
return 3;
}
    if (len <= 150) {
return 5;
}
    return 8;
  }

  /**
   * Mark single announcement as read in Firestore
   * @param {string} announcementId
   */
  async markAsRead(announcementId) {
    try {
      await this.db.collection('system_announcements').doc(announcementId).update({
        [`readBy.${this.user.email}`]: {
          readAt: firebase.firestore.FieldValue.serverTimestamp(),
          displayName: this.user.displayName || this.user.email
        }
      });

      // Remove localStorage temp dismiss if exists
      localStorage.removeItem('announcement_popup_dismissed_' + announcementId);

      // Remove from local array
      this.announcements = this.announcements.filter(a => a.id !== announcementId);

      if (this.announcements.length > 0) {
        const newIndex = Math.min(this.currentIndex, this.announcements.length - 1);
        this.updateNavVisibility();
        this.showAnnouncement(newIndex);
      } else {
        this.close();
      }
    } catch (error) {
      console.error('❌ [AnnouncementPopup] Error marking as read:', error);
    }
  }

  /**
   * Mark all announcements as read
   */
  async markAllAsRead() {
    try {
      const promises = this.announcements.map(a =>
        this.db.collection('system_announcements').doc(a.id).update({
          [`readBy.${this.user.email}`]: {
            readAt: firebase.firestore.FieldValue.serverTimestamp(),
            displayName: this.user.displayName || this.user.email
          }
        })
      );

      await Promise.all(promises);

      // Clean up localStorage
      this.announcements.forEach(a => {
        localStorage.removeItem('announcement_popup_dismissed_' + a.id);
      });

      this.announcements = [];
      this.close();
    } catch (error) {
      console.error('❌ [AnnouncementPopup] Error marking all as read:', error);
    }
  }

  /**
   * Dismiss without marking as read — save temp dismiss to localStorage
   */
  dismiss() {
    this.announcements.forEach(a => {
      localStorage.setItem('announcement_popup_dismissed_' + a.id, Date.now().toString());
    });
    this.close();
  }

  /**
   * Update nav visibility after removing an announcement
   */
  updateNavVisibility() {
    if (!this.overlay) {
return;
}

    const hasMultiple = this.announcements.length > 1;

    const nav = this.overlay.querySelector('#apNav');
    const counter = this.overlay.querySelector('#apCounter');
    const markAllBtn = this.overlay.querySelector('#apMarkAllRead');

    if (hasMultiple) {
      nav.classList.remove('announcement-popup-nav-hidden');
      counter.classList.remove('announcement-popup-counter-hidden');
      markAllBtn.classList.remove('announcement-popup-mark-all-hidden');
    } else {
      nav.classList.add('announcement-popup-nav-hidden');
      counter.classList.add('announcement-popup-counter-hidden');
      markAllBtn.classList.add('announcement-popup-mark-all-hidden');
    }
  }

  /**
   * Show the popup
   */
  show() {
    if (!this.overlay) {
return;
}
    this.showAnnouncement(0);
  }

  /**
   * Close and remove from DOM
   */
  close() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.close();
  }
}

export default SystemAnnouncementPopup;
