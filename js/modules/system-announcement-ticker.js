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
    this.scrollAnimationDuration = 50; // 50 seconds for full scroll

    // DOM elements
    this.container = null;
    this.textElement = null;
    this.dotsContainer = null;

    // Firestore
    this.unsubscribe = null;           // Real-time listener unsubscribe function
    this.db = null;
    this.user = null;

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
   * Listen to Firestore for active announcements (real-time)
   */
  listenToAnnouncements() {
    console.log('👂 Setting up Firestore listener...');

    const now = firebase.firestore.Timestamp.now();

    this.unsubscribe = this.db.collection('system_announcements')
      .where('active', '==', true)
      .where('startDate', '<=', now)
      .orderBy('startDate', 'desc')
      .orderBy('priority', 'desc')
      .onSnapshot(
        (snapshot) => {
          console.log(`📊 Received ${snapshot.size} announcements from Firestore`);

          // Map and filter active announcements
          this.announcements = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                title: data.title || '',
                message: data.message || '',
                type: data.type || 'info',
                priority: data.priority || 3,
                startDate: data.startDate?.toDate(),
                endDate: data.endDate?.toDate(),
                displaySettings: data.displaySettings || {}
              };
            })
            .filter(announcement => {
              // Filter: must show in header
              if (!announcement.displaySettings.showInHeader) {
                return false;
              }

              // Filter: check expiry
              if (announcement.endDate) {
                const now = new Date();
                if (now > announcement.endDate) {
                  return false;
                }
              }

              return true;
            });

          console.log(`✅ ${this.announcements.length} active announcements to display`);

          if (this.announcements.length > 0) {
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
   */
  updateDisplay() {
    if (this.announcements.length === 0) {
return;
}

    const announcement = this.announcements[this.currentIndex];

    // Update text
    if (this.textElement) {
      this.textElement.textContent = announcement.message;
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
      'info': '📢',
      'success': '✅',
      'warning': '⚠️',
      'error': '🚨'
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
   */
  restartScrollAnimation() {
    if (!this.textElement) {
return;
}

    // Remove animation
    this.textElement.style.animation = 'none';

    // Trigger reflow
    void this.textElement.offsetWidth;

    // Re-add animation
    this.textElement.style.animation = `ticker-scroll ${this.scrollAnimationDuration}s linear infinite`;
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
