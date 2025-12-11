/**
 * ═════════════════════════════════════════════════════════════════
 * System Announcement Banner
 * ═════════════════════════════════════════════════════════════════
 *
 * Displays system-wide announcements to all users at the top of the page
 * Users can dismiss announcements by clicking "הבנתי"
 *
 * Features:
 * - Real-time Firestore listener for active announcements
 * - Severity levels: info (blue), warning (yellow), critical (red)
 * - User-specific dismissal tracking
 * - Smooth animations (slide-in/slide-out)
 * - Automatic expiry handling
 *
 * Created: 2025-12-11
 * Version: 1.0.0
 */

(function() {
  'use strict';

  /**
   * SystemAnnouncementBanner Class
   */
  class SystemAnnouncementBanner {
    constructor() {
      this.currentUser = null;
      this.listener = null;
      this.bannerElement = null;
      this.currentAnnouncementId = null;
    }

    /**
     * Initialize the banner system
     * @param {Object} user - Firebase user object with email
     * @param {Object} db - Firestore database instance
     */
    init(user, db) {
      if (!user || !db) {
        console.warn('⚠️ SystemAnnouncementBanner: Missing user or db');
        return;
      }

      this.currentUser = user;
      this.db = db;

      // Create banner element in DOM
      this.createBannerElement();

      // Start listening to announcements
      this.startListening();

      console.log('✅ SystemAnnouncementBanner initialized for', user.email);
    }

    /**
     * Create the banner HTML element and inject into DOM
     */
    createBannerElement() {
      // Check if banner already exists
      if (document.getElementById('systemAnnouncementBanner')) {
        this.bannerElement = document.getElementById('systemAnnouncementBanner');
        return;
      }

      // Create banner container
      const banner = document.createElement('div');
      banner.id = 'systemAnnouncementBanner';
      banner.className = 'system-announcement-banner hidden';
      banner.innerHTML = `
        <div class="announcement-content">
          <div class="announcement-icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <div class="announcement-message"></div>
          <button class="announcement-dismiss-btn" id="dismissAnnouncementBtn">
            <i class="fas fa-times"></i>
            <span>הבנתי</span>
          </button>
        </div>
      `;

      // Insert at the top of body (before all other content)
      document.body.insertBefore(banner, document.body.firstChild);

      this.bannerElement = banner;

      // Add dismiss button event listener
      const dismissBtn = document.getElementById('dismissAnnouncementBtn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => this.dismissAnnouncement());
      }
    }

    /**
     * Start listening to active system announcements
     */
    startListening() {
      if (!this.db || !this.currentUser) {
        console.error('❌ Cannot start listening - missing db or user');
        return;
      }

      // Listen to active announcements
      this.listener = this.db.collection('system_announcements')
        .where('isActive', '==', true)
        .limit(1) // Only show one announcement at a time
        .onSnapshot(
          snapshot => {
            if (snapshot.empty) {
              console.log('📢 No active announcements');
              this.hideBanner();
              return;
            }

            // Get the first active announcement
            const doc = snapshot.docs[0];
            const announcement = {
              id: doc.id,
              ...doc.data()
            };

            // Check if expired
            if (announcement.expiresAt && announcement.expiresAt.toMillis() < Date.now()) {
              console.log('⏰ Announcement expired:', announcement.id);
              this.hideBanner();
              return;
            }

            // Check if user already dismissed this announcement
            const dismissedBy = announcement.dismissedBy || [];
            if (dismissedBy.includes(this.currentUser.email)) {
              console.log('✓ User already dismissed this announcement');
              this.hideBanner();
              return;
            }

            // Show the announcement
            this.showAnnouncement(announcement);
          },
          error => {
            console.error('❌ Error listening to announcements:', error);
          }
        );

      console.log('👂 Listening to system announcements...');
    }

    /**
     * Display an announcement in the banner
     * @param {Object} announcement - Announcement data
     */
    showAnnouncement(announcement) {
      if (!this.bannerElement) {
        console.error('❌ Banner element not found');
        return;
      }

      this.currentAnnouncementId = announcement.id;

      // Set severity class (info, warning, critical)
      const severity = announcement.severity || 'info';
      this.bannerElement.className = `system-announcement-banner ${severity}`;

      // Update icon based on severity
      const iconElement = this.bannerElement.querySelector('.announcement-icon i');
      if (iconElement) {
        const icons = {
          info: 'fa-info-circle',
          warning: 'fa-exclamation-triangle',
          critical: 'fa-exclamation-circle'
        };
        iconElement.className = `fas ${icons[severity] || icons.info}`;
      }

      // Update message
      const messageElement = this.bannerElement.querySelector('.announcement-message');
      if (messageElement) {
        messageElement.textContent = announcement.message || '';
      }

      // Show banner with animation
      setTimeout(() => {
        this.bannerElement.classList.add('show');
      }, 100);

      console.log('📢 Showing announcement:', announcement.message);
    }

    /**
     * Hide the banner
     */
    hideBanner() {
      if (!this.bannerElement) return;

      this.bannerElement.classList.remove('show');
      this.currentAnnouncementId = null;
    }

    /**
     * Dismiss current announcement
     * Updates Firestore to add current user to dismissedBy array
     */
    async dismissAnnouncement() {
      if (!this.currentAnnouncementId) {
        console.warn('⚠️ No announcement to dismiss');
        return;
      }

      if (!this.db || !this.currentUser) {
        console.error('❌ Cannot dismiss - missing db or user');
        return;
      }

      try {
        // Add user email to dismissedBy array
        await this.db.collection('system_announcements')
          .doc(this.currentAnnouncementId)
          .update({
            dismissedBy: window.firebase.firestore.FieldValue.arrayUnion(this.currentUser.email)
          });

        console.log('✅ Announcement dismissed by', this.currentUser.email);

        // Hide banner immediately
        this.hideBanner();

      } catch (error) {
        console.error('❌ Error dismissing announcement:', error);

        // Still hide banner even if update fails
        this.hideBanner();
      }
    }

    /**
     * Cleanup: Stop listening and remove elements
     */
    cleanup() {
      if (this.listener) {
        this.listener();
        this.listener = null;
      }

      if (this.bannerElement) {
        this.bannerElement.remove();
        this.bannerElement = null;
      }

      console.log('🧹 SystemAnnouncementBanner cleaned up');
    }
  }

  // Export to window for global access
  window.SystemAnnouncementBanner = SystemAnnouncementBanner;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.systemAnnouncementBanner = new SystemAnnouncementBanner();
      console.log('✅ SystemAnnouncementBanner instance created');
    });
  } else {
    window.systemAnnouncementBanner = new SystemAnnouncementBanner();
    console.log('✅ SystemAnnouncementBanner instance created');
  }

})();
