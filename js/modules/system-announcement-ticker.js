/**
 * System Announcement Ticker
 * News-style ticker for system announcements
 *
 * @version 1.0.0
 * @created 2025-12-15
 * @description Classic news ticker with carousel, pause on hover, and dots navigation
 */

class SystemAnnouncementTicker {
  constructor() {
    // State
    this.announcements = [];           // Active announcements from Firestore
    this.currentIndex = 0;             // Current announcement index
    this.isPaused = false;             // Is paused (hover)
    this.isVisible = false;            // Is ticker visible

    // Timers
    this.autoplayInterval = null;      // Auto-advance every 10 seconds
    this.scrollAnimationDuration = 120; // 120 seconds (2 minutes) - optimal readable speed

    // DOM elements
    this.container = null;
    this.textElement = null;
    this.dotsContainer = null;

    // Firestore
    this.unsubscribe = null;           // Real-time listener unsubscribe function
    this.db = null;
    this.user = null;
    this.userRole = null;              // User role (admin/employee) - fetched from Firestore

    console.log('📢 SystemAnnouncementTicker initialized');
  }

  /**
   * Initialize the ticker
   * @param {Object} user - Firebase user
   * @param {Object} db - Firestore instance
   */
  async init(user, db) {
    console.log('🚀 Initializing SystemAnnouncementTicker...');

    if (!user || !db) {
      console.error('❌ Missing user or db in ticker init');
      return;
    }

    this.user = user;
    this.db = db;

    // Check if user dismissed the ticker
    if (this.isDismissed()) {
      console.log('ℹ️ Ticker was dismissed by user');
      return;
    }

    // Fetch user role from Firestore
    await this.fetchUserRole();

    // Create DOM
    this.render();

    // Listen to Firestore for active announcements
    this.listenToAnnouncements();

    console.log('✅ SystemAnnouncementTicker ready');
  }

  /**
   * Check if user dismissed the ticker
   * @returns {boolean}
   */
  isDismissed() {
    const dismissed = localStorage.getItem('system_ticker_dismissed');
    if (dismissed !== 'true') {
return false;
}

    // Check if dismissal was within last 24 hours
    const dismissedAt = localStorage.getItem('system_ticker_dismissed_at');
    if (!dismissedAt) {
return false;
}

    const dismissTime = parseInt(dismissedAt);
    const now = Date.now();
    const hoursPassed = (now - dismissTime) / (1000 * 60 * 60);

    // Reset after 24 hours
    if (hoursPassed > 24) {
      localStorage.removeItem('system_ticker_dismissed');
      localStorage.removeItem('system_ticker_dismissed_at');
      return false;
    }

    return true;
  }

  /**
   * Fetch user role from Firestore employees collection
   * Sets this.userRole to 'admin', 'employee', or null
   */
  async fetchUserRole() {
    try {
      console.log('👤 Fetching user role from Firestore...');

      if (!this.user || !this.user.uid) {
        console.warn('⚠️ No user UID available');
        this.userRole = null;
        return;
      }

      const userDoc = await this.db.collection('employees').doc(this.user.uid).get();

      if (!userDoc.exists) {
        console.warn('⚠️ User document not found in employees collection');
        this.userRole = null;
        return;
      }

      const userData = userDoc.data();
      this.userRole = userData.role || 'employee'; // Default to 'employee' if role not set

      console.log(`✅ User role fetched: ${this.userRole}`);
    } catch (error) {
      console.error('❌ Error fetching user role:', error);
      this.userRole = null;
    }
  }

  /**
   * Check if announcement should be shown to current user based on target audience
   * @param {string} targetAudience - 'all', 'employees', or 'admins'
   * @returns {boolean}
   */
  shouldShowToUser(targetAudience) {
    // If no target audience specified, show to everyone (backward compatibility)
    if (!targetAudience || targetAudience === 'all') {
      console.log(`✅ shouldShowToUser: targetAudience='${targetAudience}' → showing to all users`);
      return true;
    }

    // If user role is not fetched, show to be safe (backward compatibility)
    if (!this.userRole) {
      console.warn(`⚠️ shouldShowToUser: userRole not available → showing by default (targetAudience='${targetAudience}')`);
      return true;
    }

    // Check audience match
    if (targetAudience === 'admins' && this.userRole === 'admin') {
      console.log('✅ shouldShowToUser: targetAudience=\'admins\', userRole=\'admin\' → SHOW');
      return true;
    }

    if (targetAudience === 'employees' && this.userRole === 'employee') {
      console.log('✅ shouldShowToUser: targetAudience=\'employees\', userRole=\'employee\' → SHOW');
      return true;
    }

    // Admins should also see employee announcements
    if (targetAudience === 'employees' && this.userRole === 'admin') {
      console.log('✅ shouldShowToUser: targetAudience=\'employees\', userRole=\'admin\' → SHOW (admins see employee announcements)');
      return true;
    }

    console.log(`❌ shouldShowToUser: targetAudience='${targetAudience}', userRole='${this.userRole}' → HIDE`);
    return false;
  }

  /**
   * Listen to Firestore for active announcements (real-time)
   * Uses simplified query to avoid index requirement
   */
  listenToAnnouncements() {
    console.log('👂 Setting up Firestore listener...');

    // Simplified query - only filter by active status
    // Client-side filtering for dates to avoid complex index
    this.unsubscribe = this.db.collection('system_announcements')
      .where('active', '==', true)
      .onSnapshot(
        (snapshot) => {
          console.log(`📊 Received ${snapshot.size} announcements from Firestore`);

          const now = new Date();

          // Map and filter active announcements (client-side)
          this.announcements = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                title: data.title || '',
                message: data.message || '',
                type: data.type || 'info',
                priority: data.priority || 3,
                targetAudience: data.targetAudience || 'all', // Add target audience
                startDate: data.startDate?.toDate(),
                endDate: data.endDate?.toDate(),
                displaySettings: data.displaySettings || {}
              };
            })
            .filter(announcement => {
              // Filter: must show in header
              if (!announcement.displaySettings.showInHeader) {
                console.log(`🚫 Announcement ${announcement.id} filtered out: showInHeader = false`);
                return false;
              }

              // Filter: check start date
              if (announcement.startDate && announcement.startDate > now) {
                console.log(`🚫 Announcement ${announcement.id} filtered out: not started yet`);
                return false;
              }

              // Filter: check expiry
              if (announcement.endDate && announcement.endDate < now) {
                console.log(`🚫 Announcement ${announcement.id} filtered out: expired`);
                return false;
              }

              // Filter: check target audience
              if (!this.shouldShowToUser(announcement.targetAudience)) {
                console.log(`🚫 Announcement ${announcement.id} filtered out: targetAudience '${announcement.targetAudience}' doesn't match user role '${this.userRole}'`);
                return false;
              }

              return true;
            })
            // Client-side sorting by priority and start date
            .sort((a, b) => {
              if (b.priority !== a.priority) {
                return b.priority - a.priority;
              }
              return (b.startDate || 0) - (a.startDate || 0);
            });

          console.log(`✅ ${this.announcements.length} active announcements to display`);

          if (this.announcements.length > 0) {
            // Render if not already rendered
            if (!this.container) {
              this.render();
            }
            this.show();
            this.currentIndex = 0;
            this.updateDisplay();
            this.startAutoplay();
          } else {
            this.hide();
          }
        },
        (error) => {
          console.error('❌ Error listening to announcements:', error);
        }
      );
  }

  /**
   * Create DOM structure
   */
  render() {
    // Remove existing ticker if any
    const existing = document.getElementById('systemAnnouncementTicker');
    if (existing) {
      existing.remove();
    }

    const html = `
      <div id="systemAnnouncementTicker" class="ticker-container" style="display: none;">
        <div class="ticker-icon" id="tickerIcon">📢</div>
        <div class="ticker-label">עדכוני מערכת</div>
        <div class="ticker-separator">|</div>
        <div class="ticker-content" id="tickerContent">
          <div class="ticker-text" id="tickerText"></div>
        </div>
        <div class="ticker-dots" id="tickerDots"></div>
        <button class="ticker-close" id="tickerClose" title="סגור הודעות" aria-label="סגור הודעות">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Insert at top of body
    document.body.insertAdjacentHTML('afterbegin', html);

    // Cache DOM elements
    this.container = document.getElementById('systemAnnouncementTicker');
    this.textElement = document.getElementById('tickerText');
    this.dotsContainer = document.getElementById('tickerDots');

    // Setup event listeners
    this.setupEventListeners();

    console.log('✅ Ticker DOM created');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.container) {
return;
}

    // Pause on hover
    this.container.addEventListener('mouseenter', () => {
      this.isPaused = true;
      this.pauseAnimation();
      console.log('⏸️ Ticker paused (hover)');
    });

    this.container.addEventListener('mouseleave', () => {
      this.isPaused = false;
      this.resumeAnimation();
      console.log('▶️ Ticker resumed');
    });

    // Close button
    const closeBtn = document.getElementById('tickerClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.dismiss();
      });
    }

    // Dots navigation
    if (this.dotsContainer) {
      this.dotsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('ticker-dot')) {
          const index = parseInt(e.target.dataset.index);
          this.goToAnnouncement(index);
        }
      });
    }
  }

  /**
   * Update display with current announcement
   * News-style continuous ticker - creates duplicate content for seamless loop
   */
  updateDisplay() {
    if (this.announcements.length === 0) {
return;
}

    const announcement = this.announcements[this.currentIndex];

    // Update text - Create continuous loop like news ticker
    if (this.textElement) {
      // יצירת תוכן כפול לטיקר רציף
      const message = announcement.message;

      // בניית HTML עם כפילות - 8 עותקים לגלילה חלקה מושלמת
      const tickerHTML = `
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
        <span class="ticker-item">${message}</span>
      `;

      this.textElement.innerHTML = tickerHTML;
    }

    // Update icon based on type
    this.updateIcon(announcement.type);

    // Update background color based on type
    this.updateColor(announcement.type);

    // Update dots
    this.updateDots();

    // Restart scroll animation
    this.restartScrollAnimation();
  }

  /**
   * Update icon based on announcement type
   * @param {string} type - info/success/warning/error
   */
  updateIcon(type) {
    const iconEl = document.getElementById('tickerIcon');
    if (!iconEl) {
return;
}

    const icons = {
      'info': 'ℹ️',
      'success': '✓',
      'warning': '⚠',
      'error': '✕'
    };

    iconEl.textContent = icons[type] || icons['info'];
  }

  /**
   * Update background color based on type
   * @param {string} type - info/success/warning/error
   */
  updateColor(type) {
    if (!this.container) {
return;
}

    // Remove existing color classes
    this.container.classList.remove('ticker-info', 'ticker-success', 'ticker-warning', 'ticker-error');

    // Add new color class
    this.container.classList.add(`ticker-${type}`);
  }

  /**
   * Update dots (carousel indicators)
   */
  updateDots() {
    if (!this.dotsContainer) {
return;
}

    // Only show dots if more than 1 announcement
    if (this.announcements.length <= 1) {
      this.dotsContainer.style.display = 'none';
      return;
    }

    this.dotsContainer.style.display = 'flex';

    // Create dots
    this.dotsContainer.innerHTML = this.announcements.map((_, index) => {
      const isActive = index === this.currentIndex;
      return `<span class="ticker-dot ${isActive ? 'active' : ''}" data-index="${index}"></span>`;
    }).join('');
  }

  /**
   * Restart scroll animation
   * Continuous news-style ticker animation
   */
  restartScrollAnimation() {
    if (!this.textElement) {
return;
}

    // Remove animation
    this.textElement.style.animation = 'none';

    // Trigger reflow
    void this.textElement.offsetWidth;

    // Re-add animation - continuous loop
    this.textElement.style.animation = `ticker-scroll-continuous ${this.scrollAnimationDuration}s linear infinite`;
  }

  /**
   * Pause animation
   */
  pauseAnimation() {
    if (!this.textElement) {
return;
}
    this.textElement.style.animationPlayState = 'paused';
  }

  /**
   * Resume animation
   */
  resumeAnimation() {
    if (!this.textElement) {
return;
}
    this.textElement.style.animationPlayState = 'running';
  }

  /**
   * Start autoplay (advance to next announcement every 10 seconds)
   */
  startAutoplay() {
    // Clear existing interval
    this.stopAutoplay();

    // Only autoplay if more than 1 announcement
    if (this.announcements.length <= 1) {
return;
}

    this.autoplayInterval = setInterval(() => {
      if (!this.isPaused) {
        this.nextAnnouncement();
      }
    }, 10000); // 10 seconds

    console.log('🔄 Autoplay started (10s interval)');
  }

  /**
   * Stop autoplay
   */
  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  /**
   * Go to next announcement
   */
  nextAnnouncement() {
    if (this.announcements.length === 0) {
return;
}

    this.currentIndex = (this.currentIndex + 1) % this.announcements.length;
    this.updateDisplay();

    console.log(`➡️ Next announcement (${this.currentIndex + 1}/${this.announcements.length})`);
  }

  /**
   * Go to specific announcement
   * @param {number} index
   */
  goToAnnouncement(index) {
    if (index < 0 || index >= this.announcements.length) {
return;
}

    this.currentIndex = index;
    this.updateDisplay();

    // Restart autoplay timer
    this.startAutoplay();

    console.log(`🎯 Jumped to announcement ${index + 1}`);
  }

  /**
   * Show ticker
   */
  show() {
    if (this.isVisible) {
return;
}

    if (this.container) {
      this.container.style.display = 'flex';
      document.body.classList.add('ticker-active');
      this.isVisible = true;

      console.log('✅ Ticker shown');
    }
  }

  /**
   * Hide ticker
   */
  hide() {
    if (!this.isVisible) {
return;
}

    if (this.container) {
      this.container.style.display = 'none';
      document.body.classList.remove('ticker-active');
      this.isVisible = false;

      console.log('ℹ️ Ticker hidden');
    }

    this.stopAutoplay();
  }

  /**
   * Dismiss ticker (user clicked close button)
   */
  dismiss() {
    console.log('👋 User dismissed ticker');

    // Save to localStorage (24 hour expiry)
    localStorage.setItem('system_ticker_dismissed', 'true');
    localStorage.setItem('system_ticker_dismissed_at', Date.now().toString());

    // Hide ticker
    this.hide();
  }

  /**
   * Cleanup (called on logout or page unload)
   */
  cleanup() {
    console.log('🧹 Cleaning up ticker...');

    // Stop autoplay
    this.stopAutoplay();

    // Unsubscribe from Firestore
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Remove DOM
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    // Remove body class
    document.body.classList.remove('ticker-active');

    console.log('✅ Ticker cleaned up');
  }
}

// Export as ES6 module
export default SystemAnnouncementTicker;
