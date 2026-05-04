/**
 * Law Office Management System - Main Entry Point
 * Unified module system that combines all functionality
 *
 * @version 5.1.7
 * @created 2025-10-15
 * @description Central orchestration of all system modules
 */

/* ========================================
   FEATURE FLAGS - Production Configuration
   ======================================== */

window.CONFIG = {
  // Apple OAuth is disabled by default until production testing is complete
  enableAppleOAuth: false
};

/* ========================================
   MODULE IMPORTS - Core System Components
   ======================================== */

// Core Utilities & State Management
import * as CoreUtils from './modules/core-utils.js';
import { DOMCache } from './modules/dom-cache.js';
import DataCache from './modules/data-cache.js';
import STATE_CONFIG from './config/state-config.js';

// ✅ NEW v2.0: Add Task System - Organized Component
import { initAddTaskSystem } from '../components/add-task/index.js';

// ✅ Migration v1→v2: Timesheet adapter for enterprise features
import { createTimesheetEntryV2 } from './modules/timesheet-adapter.js';
import { buildErrorFromResult } from './modules/error-utils.js';

// System Announcement Ticker - News-style ticker for system announcements
import SystemAnnouncementTicker from './modules/system-announcement-ticker.js';

// System Announcement Popup - Modal popup for unread announcements on login
import SystemAnnouncementPopup from './modules/system-announcement-popup.js';

// Break Manager - Floating break button with timer and timesheet recording
import BreakManager from './modules/break-manager.js';

// Notification System
// NotificationBellSystem is loaded via script tag and available on window.notificationBell
// No import needed here - it's initialized globally

// Firebase Operations
import * as FirebaseOps from './modules/firebase-operations.js';

// Authentication & User Management
import * as Auth from './modules/authentication.js';

// Navigation & UI Controls
import * as Navigation from './modules/navigation.js';

// Client Management
import { ClientValidation } from './modules/client-validation.js';

// Client Hours Management
import * as ClientHours from './modules/client-hours.js';

// Forms Management
import * as Forms from './modules/forms.js';

// Budget Tasks Module (v5.2.4 - rings fix with 100%+ support)
import * as BudgetTasks from './modules/budget-tasks.js?v=esc5fix';
import { BUDGET_TASKS_LOAD_LIMIT } from './modules/budget-tasks.js?v=esc5fix';

// Timesheet Module
import * as Timesheet from './modules/timesheet.js';

// Search & Filtering
import * as Search from './modules/search.js';

// UI Components
import * as UIComponents from './modules/ui-components.js';
import { ActionFlowManager } from './modules/ui-components.js';

// Debug Tools (Development Only)
import * as DebugTools from './modules/debug-tools.js';

// Sidebar Component
import { Sidebar } from './modules/components/sidebar/sidebar.js';

// Daily Meter Component (sidebar ring — daily reporting progress)
import { DailyMeter } from './modules/components/sidebar/daily-meter.js';

// Beit Midrash Component
import { BeitMidrash } from './modules/components/beit-midrash/beit-midrash.js';


/* ========================================
   MAIN APPLICATION CLASS
   ======================================== */

/**
 * LawOfficeManager - Main Application Controller
 * Orchestrates all modules and manages application state
 */
class LawOfficeManager {
  constructor() {
    // Core State
    this.currentUser = null; // Email for queries
    this.currentUsername = null; // Username for display
    this.currentEmployee = null; // Full employee data from Firestore
    this.clients = [];
    this.budgetTasks = [];
    this.timesheetEntries = [];
    this.connectionStatus = 'unknown';

    // ✅ NEW v2.0: Add Task Dialog System
    this.addTaskDialog = null;

    // View State - ✅ Managed by STATE_CONFIG (config/state-config.js)
    // Session-only (resets on page load): taskFilter, timesheetFilter
    // Persisted (saved): budgetView, timesheetView, budgetSort, timesheetSort
    this.currentTaskFilter = STATE_CONFIG.getStateValue('taskFilter'); // ✅ Always 'active'
    this.currentTimesheetFilter = STATE_CONFIG.getStateValue('timesheetFilter'); // ✅ Always 'month'
    this.currentBudgetView = STATE_CONFIG.getStateValue('budgetView'); // ✅ Persisted
    this.currentTimesheetView = STATE_CONFIG.getStateValue('timesheetView'); // ✅ Persisted
    this.currentDeadlineFormat = STATE_CONFIG.getStateValue('deadlineFormat'); // ✅ Persisted ('date'|'days')

    // Filtered Data
    this.filteredBudgetTasks = [];
    this.filteredTimesheetEntries = [];

    // Sorting State - ✅ Managed by STATE_CONFIG
    this.budgetSortField = null;
    this.budgetSortDirection = 'asc';
    this.timesheetSortField = null;
    this.timesheetSortDirection = 'asc';
    this.currentBudgetSort = STATE_CONFIG.getStateValue('budgetSort'); // ✅ Persisted
    this.currentTimesheetSort = STATE_CONFIG.getStateValue('timesheetSort'); // ✅ Persisted

    // Pagination State
    this.currentBudgetPage = 1;
    this.currentTimesheetPage = 1;
    this.budgetPagination = window.PaginationModule?.create({ pageSize: 20 });
    this.timesheetPagination = window.PaginationModule?.create({ pageSize: 20 });

    // Welcome Screen Timing
    this.welcomeScreenStartTime = null;

    // ✅ Operation Locks - prevent race conditions
    this.isTaskOperationInProgress = false;
    this.isTimesheetOperationInProgress = false;
    this._isCancelling = false;

    // ✅ Data Cache - Smart caching with Stale-While-Revalidate
    this.dataCache = new DataCache({
      maxAge: 5 * 60 * 1000,           // 5 minutes fresh
      staleAge: 10 * 60 * 1000,        // 10 minutes stale (15 min total)
      staleWhileRevalidate: true,      // Return stale + refresh in background
      storage: 'memory',               // Use memory (faster than localStorage)
      debug: false,                    // Set to true for debugging
      onError: (error) => {
        Logger.log('❌ [DataCache] Error:', error);
      }
    });

    // Module Instances
    this.domCache = new DOMCache();
    this.notificationBell = window.notificationBell; // Use globally initialized instance
    this.clientValidation = new ClientValidation(this); // Pass 'this' as manager
    this.announcementTicker = new SystemAnnouncementTicker(); // System Announcement Ticker
    this.announcementPopup = new SystemAnnouncementPopup(); // System Announcement Popup
    this.breakManager = new BreakManager(); // Break Button
    this.dailyMeter = new DailyMeter(); // Daily reporting meter (sidebar ring)

    // Activity Logger & Task Actions (initialized after Firebase)
    this.activityLogger = null;
    this.taskActionsManager = null;

    // Integration Manager
    this.integrationManager = window.IntegrationManagerModule
      ? window.IntegrationManagerModule.create()
      : null;

    // Security Modules (initialized after login)
    this.idleTimeout = null;
    this.sessionManager = null; // Future implementation

    Logger.log('✅ LawOfficeManager initialized');
  }

  /* ========================================
     INITIALIZATION & LIFECYCLE
     ======================================== */

  /**
   * המתן עד שה-Firebase Auth יהיה מוכן
   * 🎯 מונע race conditions עם מודולים שדורשים authentication
   * @returns {Promise<firebase.User|null>}
   */
  waitForAuthReady() {
    return new Promise((resolve) => {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * Initialize the application
   * 🎯 אתחול נכון: Auth קודם, אז מודולים
   */
  async init() {
    const initStartTime = Date.now();
    Logger.log('🚀 Initializing Law Office System...', { timestamp: initStartTime });

    // Setup event listeners (UI only)
    this.setupEventListeners();

    // 🛡️ המתן ל-Firebase Auth להיות מוכן
    Logger.log('⏳ Waiting for Firebase Auth...');
    const authStartTime = Date.now();
    const user = await this.waitForAuthReady();
    const authEndTime = Date.now();
    Logger.log('✅ Firebase Auth ready', {
      timeTaken: `${authEndTime - authStartTime}ms`,
      user: user ? user.email : 'none'
    });

    // ═══════════════════════════════════════════════════════════
    // 🔒 Classic Login Flow - Show login screen for all users
    // ═══════════════════════════════════════════════════════════

    // 🔒 SECURITY FIX: Always show login screen, even if user has saved session
    // This matches banking systems behavior - browser can fill password but user must click login
    if (user) {
      // Found saved Firebase session, but don't auto-login
      Logger.log('✅ Found saved session for:', user.email);
      Logger.log('🔐 Showing login screen - manual login required (like banks)');

      // Optional: Pre-fill email field for convenience
      const emailInput = document.getElementById('email');
      if (emailInput && user.email) {
        emailInput.value = user.email;
      }
    }

    // Always show login screen - login only happens on manual button click
    this.showLogin();

    // ✅ CRITICAL: Setup permanent auth state listener for NotificationBell
    // This ensures NotificationBell starts even if page loads after login
    this.setupNotificationBellListener();

    Logger.log('✅ System initialized');
  }

  /**
   * Handle authenticated user
   */
  async handleAuthenticatedUser(user) {
    try {
      // ✅ Don't interfere if handleLogin() is managing the welcome screen
      if (window.isInWelcomeScreen) {
        return;
      }

      // ✅ OPTIMIZATION: Direct get instead of query (faster, cheaper)
      // user.email is available immediately after Firebase Auth sign-in
      const doc = await window.firebaseDB
        .collection('employees')
        .doc(user.email)  // Direct document access
        .get();

      if (doc.exists) {
        const { password: _pw, ...employee } = doc.data();
        this.currentUser = employee.email; // ✅ EMAIL for queries
        this.currentUsername = employee.username || employee.name; // Username for display
        this.currentEmployee = employee; // ✅ Full employee data (without password)

        UIComponents.updateUserDisplay(this.currentUsername);

        // ✅ CRITICAL: Start listening to admin messages in notification bell
        console.log('🔍 [DEBUG] About to start NotificationBell listener...');
        console.log('🔍 [DEBUG] this.notificationBell:', !!this.notificationBell);
        console.log('🔍 [DEBUG] window.firebaseDB:', !!window.firebaseDB);
        console.log('🔍 [DEBUG] user:', user);

        if (this.notificationBell && window.firebaseDB) {
          console.log('🔔 Starting NotificationBell listener for', user.email);
          try {
            this.notificationBell.startListeningToAdminMessages(user, window.firebaseDB);
            console.log('✅ NotificationBell listener started successfully');
            console.log('✅ [DEBUG] Listener confirmed active:', !!this.notificationBell.messagesListener);
          } catch (error) {
            console.error('❌ Failed to start NotificationBell listener:', error);
          }
        } else {
          console.error('⚠️ CRITICAL: Cannot start NotificationBell listener!', {
            hasNotificationBell: !!this.notificationBell,
            hasFirebaseDB: !!window.firebaseDB,
            notificationBell: this.notificationBell,
            firebaseDB: window.firebaseDB
          });
        }

        // Load data and show app
        await this.loadData();
        this.showApp();

        // ✅ NEW v2.0: Initialize Add Task System after login
        this.initializeAddTaskSystem();
      } else {
        // User not found in employees - sign out
        await firebase.auth().signOut();
        this.showLogin();
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      this.showLogin();
    }
  }

  /**
   * Setup permanent NotificationBell auth listener
   * ✅ CRITICAL: This runs ALWAYS, even after page refresh
   */
  setupNotificationBellListener() {
    console.log('🔔 Setting up permanent NotificationBell listener...');

    firebase.auth().onAuthStateChanged((user) => {
      if (user && window.firebaseDB) {
        console.log('🔔 Auth state changed - User logged in:', user.email);

        // ✅ Start NotificationBell if available
        if (this.notificationBell) {
          console.log('🔔 Starting NotificationBell listener...');
          try {
            // Start listening (safe to call multiple times - it checks internally)
            this.notificationBell.startListeningToAdminMessages(user, window.firebaseDB);
            console.log('✅ NotificationBell listener started successfully');
            console.log('✅ Listener active:', !!this.notificationBell.messagesListener);
          } catch (error) {
            console.error('❌ Failed to start NotificationBell listener:', error);
          }
        } else {
          console.log('ℹ️ NotificationBell not yet loaded - will auto-init when ready');
        }

        // ✅ Start System Announcement Ticker - ONLY if user is inside the app (not on login screen)
        const interfaceElements = document.getElementById('interfaceElements');
        const isInApp = interfaceElements && !interfaceElements.classList.contains('hidden');

        if (isInApp && this.announcementTicker) {
          console.log('📢 Starting System Announcement Ticker...');
          try {
            this.announcementTicker.init(user, window.firebaseDB);
            console.log('✅ System Announcement Ticker initialized successfully');
          } catch (error) {
            console.error('❌ Failed to initialize System Announcement Ticker:', error);
          }

          if (this.announcementPopup) {
            this.announcementPopup.init(user, window.firebaseDB);
          }
        } else if (!isInApp) {
          console.log('ℹ️ User on login screen - ticker will init after login');
        }
      } else if (!user) {
        console.log('🔔 Auth state changed - User logged out, cleaning up...');
        if (this.notificationBell) {
          this.notificationBell.cleanup();
        }
        // ✅ Cleanup System Announcement Ticker
        if (this.announcementTicker) {
          this.announcementTicker.cleanup();
        }
        // ✅ Cleanup System Announcement Popup
        if (this.announcementPopup) {
          this.announcementPopup.cleanup();
        }
      } else {
        console.warn('⚠️ Cannot start services - missing dependencies:', {
          hasUser: !!user,
          hasFirebaseDB: !!window.firebaseDB
        });
      }
    });
  }

  /**
   * Initialize Ticker - Called from showApp() in authentication.js
   */
  initTicker() {
    const user = firebase.auth().currentUser;
    if (user && window.firebaseDB && this.announcementTicker) {
      console.log('📢 Initializing System Announcement Ticker from showApp()...');
      try {
        this.announcementTicker.init(user, window.firebaseDB);
        console.log('✅ System Announcement Ticker initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize System Announcement Ticker:', error);
      }
    }
  }

  /**
   * Initialize Popup - Called from showApp() in authentication.js
   */
  initPopup() {
    const user = firebase.auth().currentUser;
    if (user && window.firebaseDB && this.announcementPopup) {
      console.log('📢 Initializing System Announcement Popup from showApp()...');
      try {
        this.announcementPopup.init(user, window.firebaseDB);
        console.log('✅ System Announcement Popup initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize System Announcement Popup:', error);
      }
    }

    // Initialize Break Manager after popup
    this.initBreakManager();
  }

  /**
   * Initialize Break Manager - Called from initPopup() after login
   */
  initBreakManager() {
    if (this.breakManager && this.currentUser) {
      try {
        this.breakManager.init(
          { email: this.currentUser, username: this.currentUsername },
          window.firebaseDB
        );
        console.log('✅ Break Manager initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Break Manager:', error);
      }
    }
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await Auth.handleLogin.call(this);
      });
    }

    // Forgot Password form
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', async (e) => {
        await Auth.handleForgotPassword.call(this, e);
      });
    }

    // Budget form
    const budgetForm = document.getElementById('budgetForm');
    if (budgetForm) {
      budgetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addBudgetTask();
      });
    }

    // Timesheet form
    const timesheetForm = document.getElementById('timesheetForm');
    if (timesheetForm) {
      timesheetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addTimesheetEntry();
      });
    }

    // ✅ Client form removed - now handled by CasesManager

    // ✅ Budget search box - live text search with debouncing
    const budgetSearchBox = document.getElementById('budgetSearchBox');
    if (budgetSearchBox) {
      // Debounce search to avoid excessive filtering (300ms delay)
      const debouncedSearch = CoreUtils.debounce((searchTerm) => {
        this.searchBudgetTasks(searchTerm);
      }, 300);

      budgetSearchBox.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
      });
    }

    Logger.log('✅ Event listeners configured');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    if (this.notificationBell?.cleanup) {
      this.notificationBell.cleanup();
    }

    // ✅ Stop real-time listeners
    this.stopRealTimeListeners();

    if (this.breakManager?.cleanup) {
      this.breakManager.cleanup();
    }

    Logger.log('✅ Manager cleanup completed');
  }

  /**
   * Stop real-time listeners
   * עצירת מאזינים בזמן אמת
   */
  stopRealTimeListeners() {
    try {
      // Stop all listeners using the centralized listener manager
      import('./modules/real-time-listeners.js').then(({ stopAllListeners }) => {
        stopAllListeners();
        Logger.log('✅ Real-time listeners stopped');
      }).catch((error) => {
        console.error('❌ Error stopping listeners:', error);
      });
    } catch (error) {
      console.error('❌ Error stopping real-time listeners:', error);
    }
  }

  /* ========================================
     AUTHENTICATION & USER MANAGEMENT
     ======================================== */

  showLogin() {
    Auth.showLogin.call(this);
  }

  async handleLogin() {
    await Auth.handleLogin.call(this);
  }

  showWelcomeScreen() {
    Auth.showWelcomeScreen.call(this);
  }

  async waitForWelcomeMinimumTime() {
    await Auth.waitForWelcomeMinimumTime.call(this);
  }

  updateLoaderText(text, progress = null) {
    Auth.updateLoaderText.call(this, text, progress);
  }

  showApp() {
    Auth.showApp.call(this);
  }

  logout() {
    // Stop idle timeout monitoring before logout
    if (this.idleTimeout) {
      this.idleTimeout.stop();
    }
    Auth.logout();
  }

  // SMS Authentication methods
  switchAuthMethod(method) {
    Auth.switchAuthMethod.call(this, method);
  }

  async handleSMSLogin() {
    await Auth.handleSMSLogin.call(this);
  }

  async verifyOTP() {
    await Auth.verifyOTP.call(this);
  }

  // OAuth Authentication methods
  async loginWithGoogle() {
    await Auth.loginWithGoogle.call(this);
  }

  async loginWithApple() {
    await Auth.loginWithApple.call(this);
  }

  // ⚡ Lazy Loading - AI Chat System
  async initAIChatSystem() {
    await Auth.initAIChatSystem.call(this);
  }

  /* ========================================
     SECURITY MODULES INTEGRATION
     ======================================== */

  /**
   * Initialize security modules after successful login
   * אתחול מודולי אבטחה אחרי התחברות מוצלחת
   *
   * ✅ NEW v1.0.0: Auto Logout System
   * - Idle Timeout: 10 minutes (600,000ms)
   * - Warning: 5 minutes before logout (300,000ms)
   * - Total: 15 minutes until forced logout
   *
   * @private
   */
  initSecurityModules() {
    // ✅ Initialize Idle Timeout Manager
    if (window.IdleTimeoutManager && !this.idleTimeout) {
      this.idleTimeout = new window.IdleTimeoutManager({
        idleTimeout: 10 * 60 * 1000,      // 10 minutes idle
        warningTimeout: 5 * 60 * 1000,    // 5 minutes warning
        enabled: true,                     // Enable auto-logout
        onWarning: (remainingSeconds) => {
          this.showIdleWarning(remainingSeconds);
        },
        onLogout: async () => {
          Logger.log('🚪 [Security] Auto-logout triggered by idle timeout');
          await this.confirmLogout();
        }
      });

      this.idleTimeout.start();
      Logger.log('✅ [Security] Idle Timeout Manager initialized (15 min total)');
    } else if (!window.IdleTimeoutManager) {
      console.warn('⚠️ [Security] IdleTimeoutManager not loaded - auto-logout disabled');
    } else {
      Logger.log('ℹ️ [Security] Idle Timeout Manager already initialized');
    }
  }

  /**
   * Show idle warning modal - Linear-inspired Design
   * הצגת התראת אזהרה לפני התנתקות
   *
   * @param {number} remainingSeconds - Seconds until auto-logout
   * @private
   */
  showIdleWarning(remainingSeconds) {
    // Get username for personalization
    const userName = this.currentUsername ||
                     localStorage.getItem('userName') ||
                     'משתמש';

    // Calculate time display
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'idle-overlay';
    overlay.id = 'idleWarningOverlay';

    overlay.innerHTML = `
      <div class="idle-dialog">
        <!-- Header -->
        <div class="idle-header">
          <div class="idle-title">
            <i class="fas fa-clock"></i>
            <span>התנתקות אוטומטית</span>
          </div>
        </div>

        <!-- Message -->
        <p class="idle-message">
          היי <strong>${userName}</strong>, המערכת זיהתה שאין פעילות
        </p>

        <!-- Countdown -->
        <div class="idle-countdown" id="idleCountdownTimer">
          ${timeText}
        </div>

        <!-- Buttons -->
        <div class="idle-buttons">
          <button class="idle-btn idle-btn-secondary" onclick="window.manager.handleIdleLogout()">
            התנתק
          </button>
          <button class="idle-btn idle-btn-primary" onclick="window.manager.handleIdleStayLoggedIn()">
            המשך
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Setup countdown update listener
    this.setupIdleCountdownListener();
  }

  /**
   * Setup countdown update listener
   * @private
   */
  setupIdleCountdownListener() {
    // Remove existing listener if any
    if (this.idleCountdownListener) {
      window.removeEventListener('idle:countdown', this.idleCountdownListener);
    }

    // Add new listener
    this.idleCountdownListener = (event) => {
      const remainingSeconds = event.detail.remainingSeconds;
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      const timeText = minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
        : `${seconds} שניות`;

      // Update countdown in modal
      const countdownElement = document.getElementById('idleCountdownTimer');
      if (countdownElement) {
        countdownElement.textContent = timeText;
      }
    };

    window.addEventListener('idle:countdown', this.idleCountdownListener);

    // Listen for warning hide event
    const hideListener = () => {
      const overlay = document.getElementById('idleWarningOverlay');
      if (overlay) {
        overlay.remove();
      }
      window.removeEventListener('idle:warning-hide', hideListener);
    };
    window.addEventListener('idle:warning-hide', hideListener);
  }

  /**
   * Handle "Stay Logged In" button click
   * @public
   */
  handleIdleStayLoggedIn() {
    if (this.idleTimeout) {
      this.idleTimeout.resetActivity();
    }
    const overlay = document.getElementById('idleWarningOverlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Handle "Logout Now" button click
   * @public
   */
  async handleIdleLogout() {
    const overlay = document.getElementById('idleWarningOverlay');
    if (overlay) {
      overlay.remove();
    }
    if (this.idleTimeout) {
      this.idleTimeout.stop();
    }
    await this.confirmLogout();
  }

  /**
   * Confirm logout (used by both manual and auto-logout)
   * @public
   */
  async confirmLogout() {
    await Auth.confirmLogout.call(this);
  }

  /**
   * Handle user activity detection
   * @private
   */
  handleUserActivity() {
    // Optional: Update UI to show activity detected
    // This is called frequently, so keep it lightweight
  }

  /**
   * Handle countdown update
   * @private
   */
  handleCountdownUpdate(remaining) {
    // Optional: Update countdown in UI
    // The modal handles this internally
  }

  /* ========================================
     DATA LOADING & MANAGEMENT
     ======================================== */

  /**
   * Load all data from Firebase
   * 🎯 מתבצע רק אחרי Authentication מוצלח
   */
  async loadData() {
    try {
      this.updateLoaderText('מתחבר...', 10);

      // Load system config from Firestore (description limits, etc.)
      if (window.SystemConfigLoader && !window.SystemConfigLoader.loaded) {
        try {
          await window.SystemConfigLoader.load();
        } catch (_) { /* fallback to SYSTEM_CONSTANTS */ }
      }

      // Initialize Firebase
      FirebaseOps.initializeFirebase();
      this.updateLoaderText('מתחבר ל-Firebase...', 20);

      this.updateLoaderText('טוען לקוחות...', 30);

      // ✅ Load all data in parallel with smart caching
      // First load: Fetch from Firebase and cache
      // Second load (< 5 min): Return from cache immediately (fast!)
      // Third load (5-15 min): Return stale cache + refresh in background
      const dataLoadingPromise = Promise.all([
        this.dataCache.get('clients', () => FirebaseOps.loadClientsFromFirebase()),
        this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`, () =>
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, BUDGET_TASKS_LOAD_LIMIT)
        ),
        this.dataCache.get(`timesheetEntries:${this.currentUser}`, () =>
          this.integrationManager?.loadTimesheet(this.currentUser)
            || FirebaseOps.loadTimesheetFromFirebase(this.currentUser)
        )
      ]);

      // ✅ Simulate progress updates during loading (for better UX)
      const progressUpdates = [
        { delay: 300, text: 'טוען משימות...', progress: 55 },
        { delay: 300, text: 'טוען נתוני זמן...', progress: 65 }
      ];

      let progressIndex = 0;
      const progressInterval = setInterval(() => {
        if (progressIndex < progressUpdates.length) {
          const update = progressUpdates[progressIndex];
          this.updateLoaderText(update.text, update.progress);
          progressIndex++;
        }
      }, 300);

      const [clients, budgetTasks, timesheetEntries] = await dataLoadingPromise;
      clearInterval(progressInterval);

      this.updateLoaderText('עיבוד נתונים...', 70);

      this.clients = clients;
      this.budgetTasks = budgetTasks;
      this.timesheetEntries = timesheetEntries;
      this.loadMonthlyTimesheetStats();

      // ✅ Expose to window for backward compatibility with old code
      window.clients = clients;
      window.cases = window.cases || []; // Use existing cases if already loaded by CasesModule
      window.budgetTasks = budgetTasks;
      window.timesheetEntries = timesheetEntries;
      window.lawOfficeManager = this;
      window.CoreUtils = CoreUtils; // Expose CoreUtils for date formatting, etc.

      this.updateLoaderText('מכין ממשק...', 85);

      // Initialize TaskActionsManager if available
      if (window.TaskActionsModule && !this.taskActionsManager) {
        this.taskActionsManager = window.TaskActionsModule.create();
        this.taskActionsManager.setManager(this);
        Logger.log('✅ TaskActionsManager initialized');
      }

      // Initialize ActivityLogger if available
      if (window.ActivityLoggerModule && !this.activityLogger) {
        this.activityLogger = window.ActivityLoggerModule.create();
        Logger.log('✅ ActivityLogger initialized');
      }

      // Apply filters and render
      this.filterBudgetTasks();
      this.filterTimesheetEntries();

      // ✅ סנכרון מצב הטוגל עם currentTaskFilter (מה-localStorage)
      this.syncToggleState();

      // ✅ עדכון המונים בטעינה ראשונית
      this.updateTaskCountBadges();

      // 🔄 Update client validation and selectors (for old system)
      if (this.clientValidation) {
        this.clientValidation.updateBlockedClients();
      }

      // Update notifications bell with urgent tasks and critical clients
      if (this.notificationBell) {
        const urgentTasks = budgetTasks.filter(task => {
          if (task.status === 'הושלם') {
return false;
}
          const deadline = new Date(task.deadline);
          const now = new Date();
          const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          return daysUntilDeadline <= 3 && daysUntilDeadline >= 0;
        });

        // Get blocked/critical clients from validation
        const blockedClients = this.clientValidation?.blockedClients || [];
        const criticalClients = this.clientValidation?.criticalClients || [];

        this.notificationBell.updateFromSystem(blockedClients, criticalClients, urgentTasks);
      }

      // ✅ Initialize Daily Meter (sidebar ring)
      this.initDailyMeter();

      // ✅ הפעלת Real-time listeners למשימות ושעות (once only)
      if (!this._realTimeListenersStarted) {
        this.startRealTimeListeners();
        this._realTimeListenersStarted = true;
      }

      Logger.log(`✅ Data loaded: ${clients.length} clients, ${budgetTasks.length} tasks, ${timesheetEntries.length} entries`);
      this.updateLoaderText('הכל מוכן!', 100);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      this.showNotification('שגיאה בטעינת נתונים', 'error');
      throw error;
    }
  }

  /**
   * Initialize Daily Meter in sidebar footer
   */
  initDailyMeter() {
    try {
      const footer = document.querySelector('.gh-sidebar-footer');
      if (!footer) {
        Logger.log('⚠️ Daily meter: sidebar footer not found');
        return;
      }
      this.dailyMeter.init(footer);
      Logger.log('✅ Daily Meter initialized');
    } catch (error) {
      console.error('❌ Daily meter init error:', error);
    }
  }

  /**
   * Start real-time listeners for tasks and timesheet
   * הפעלת מאזינים בזמן אמת למשימות ושעות
   */
  startRealTimeListeners() {
    try {
      Logger.log('🔊 Starting real-time listeners...');

      // ✅ Real-time listener for tasks
      BudgetTasks.startRealTimeTasks(
        this.currentUser,
        (tasks) => {
          Logger.log(`📡 Tasks updated: ${tasks.length} tasks`);

          // Invalidate cache
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`);

          // Update local data
          this.budgetTasks = tasks;
          window.budgetTasks = tasks;

          // Re-filter and render
          this.filterBudgetTasks();

          // Update task count badges
          this.updateTaskCountBadges();

          // ✅ Update expanded card if open (makes cancel button reactive)
          this.updateExpandedCard();
        },
        (error) => {
          console.error('❌ Tasks listener error:', error);
        }
      );

      // ✅ Real-time listener for timesheet (conditionally)
      if (this.integrationManager?.config?.USE_REAL_TIME_TIMESHEET !== false) {
        Timesheet.startRealTimeTimesheet(
          this.currentUser,
          (entries) => {
            Logger.log(`📡 Timesheet updated: ${entries.length} entries`);

            // Invalidate cache
            this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`);

            // Update local data
            this.timesheetEntries = entries;
            window.timesheetEntries = entries;

            // Re-filter and render
            this.filterTimesheetEntries();
            this.renderTimesheetView(); // ✅ Fixed: was renderTimesheet()

            // ✅ Update Daily Meter with new entries
            if (this.dailyMeter) {
              this.dailyMeter.update(entries);
            }
          },
          (error) => {
            console.error('❌ Timesheet listener error:', error);
          }
        );
      } else {
        Logger.log('⚠️ Real-Time timesheet listener disabled (pagination mode)');
      }

      Logger.log('✅ Real-time listeners started');
    } catch (error) {
      console.error('❌ Error starting real-time listeners:', error);
      // Don't throw - allow app to continue without real-time
    }
  }

  /**
   * Refresh all client-case selector instances with fresh data
   */
  async refreshAllClientCaseSelectors() {
    const instances = window.clientCaseSelectorInstances || {};
    const instanceKeys = Object.keys(instances);

    if (instanceKeys.length === 0) {
      return; // אין selectors פעילים
    }

    Logger.log(`🔄 Refreshing ${instanceKeys.length} client-case selector(s)...`);

    const refreshPromises = instanceKeys.map(key => {
      const instance = instances[key];
      if (instance && typeof instance.refreshSelectedCase === 'function') {
        return instance.refreshSelectedCase();
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(refreshPromises);
      Logger.log('✅ All client-case selectors refreshed');
    } catch (error) {
      console.error('❌ Error refreshing client-case selectors:', error);
    }
  }

  /**
   * Reload data from Firebase
   */
  async loadDataFromFirebase() {
    window.showSimpleLoading('טוען נתונים מחדש...');

    try {
      // ✅ Clear cache to force fresh data (manual refresh = bypass cache)
      this.dataCache.clear();
      Logger.log('🔄 Cache cleared - forcing fresh data from Firebase');

      // loadData() already refreshes all selectors
      await this.loadData();

      // ✅ Log cache statistics
      const stats = this.dataCache.getStats();
      Logger.log('📊 Cache stats:', stats);

      this.showNotification('הנתונים עודכנו בהצלחה', 'success');
    } catch (error) {
      this.showNotification('שגיאה בטעינת נתונים', 'error');
    } finally {
      window.hideSimpleLoading();
    }
  }

  /* ========================================
     CLIENT MANAGEMENT
     ======================================== */

  // ✅ Client creation is now handled by CasesManager in cases.js
  // Old createClient() function removed - use casesManager.showCreateCaseDialog() instead

  /* ========================================
     BUDGET TASKS MANAGEMENT
     ======================================== */

  /**
   * Initialize Add Task System v2.0
   * אתחול מערכת הוספת משימות המאורגנת
   */
  initializeAddTaskSystem() {
    try {
      console.log('🚀 Initializing Add Task System v2.0...');

      this.addTaskDialog = initAddTaskSystem(this, {
        onSuccess: (taskData) => {
          console.log('✅ Task created successfully:', taskData);
          // Refresh budget tasks list
          this.filterBudgetTasks();
        },
        onError: (error) => {
          console.error('❌ Error creating task:', error);
          this.showNotification('שגיאה בשמירת המשימה: ' + error.message, 'error');
        },
        onCancel: () => {
          console.log('ℹ️ User cancelled task creation');
        },
        enableDrafts: true
      });

      console.log('✅ Add Task System v2.0 initialized');
    } catch (error) {
      console.error('❌ Error initializing Add Task System:', error);
      // System will fallback to old method automatically
    }
  }

  async addBudgetTask() {
    // ✅ Prevent race conditions - block if operation already in progress
    if (this.isTaskOperationInProgress) {
      this.showNotification('אנא המתן לסיום הפעולה הקודמת', 'warning');
      return;
    }

    this.isTaskOperationInProgress = true;

    try {
      // ✅ NEW: Get values from ClientCaseSelector
      const selectorValues = window.ClientCaseSelectorsManager?.getBudgetValues();

      if (!selectorValues) {
        this.showNotification('חובה לבחור לקוח ותיק', 'error');
        return;
      }

    // Validate other form fields
    const estimatedMinutes = parseInt(document.getElementById('estimatedTime')?.value);
    const deadline = document.getElementById('budgetDeadline')?.value;

    // ✅ NEW: Get description from GuidedTextInput
    let description = '';
    const guidedInput = window._currentBudgetDescriptionInput;

    if (guidedInput) {
      // Validate using GuidedTextInput
      const validation = guidedInput.validate();
      if (!validation.valid) {
        this.showNotification(validation.error, 'error');
        return;
      }
      description = guidedInput.getValue();
    } else {
      // Fallback to old method
      description = document.getElementById('budgetDescription')?.value?.trim();
      if (!description || description.length < 3) {
        this.showNotification('חובה להזין תיאור משימה (לפחות 3 תווים)', 'error');
        return;
      }
    }

    // No category with GuidedTextInput
    const descriptionCategory = null;
    const categoryName = null;

    if (!estimatedMinutes || estimatedMinutes < 1) {
      this.showNotification('חובה להזין זמן משוער', 'error');
      return;
    }

    if (!deadline) {
      this.showNotification('חובה לבחור תאריך יעד', 'error');
      return;
    }

    // ✅ Get branch value
    const branch = document.getElementById('budgetBranch')?.value;
    if (!branch) {
      this.showNotification('חובה לבחור סניף מטפל', 'error');
      return;
    }

      // ✅ NEW: Use ActionFlowManager for consistent UX with NotificationMessages
      const msgs = window.NotificationMessages.tasks;

      await ActionFlowManager.execute({
        operationKey: 'addBudgetTask',
        ...msgs.loading.create(selectorValues.clientName),
        action: async () => {
          const taskData = {
            description: description,
            categoryId: descriptionCategory,  // ✅ NEW: Work category ID for context-aware filtering
            categoryName: categoryName,       // ✅ NEW: Work category name for display
            clientName: selectorValues.clientName,
            clientId: selectorValues.clientId,
            caseId: selectorValues.caseId,
            caseNumber: selectorValues.caseNumber,
            caseTitle: selectorValues.caseTitle,
            serviceId: selectorValues.serviceId,  // ✅ שירות/שלב נבחר (stage.id עבור הליך משפטי)
            serviceName: selectorValues.serviceName,  // ✅ שם השירות
            serviceType: selectorValues.serviceType,  // ✅ סוג השירות (legal_procedure/hours)
            parentServiceId: selectorValues.parentServiceId,  // ✅ service.id עבור הליך משפטי
            branch: branch,  // ✅ סניף מטפל
            estimatedMinutes: estimatedMinutes,
            originalEstimate: estimatedMinutes, // ✅ NEW: originalEstimate for v2.0
            deadline: deadline,
            employee: this.currentUser,
            status: 'pending_approval',  // ✅ CHANGED: Requires manager approval
            requestedMinutes: estimatedMinutes,  // ✅ Original requested budget
            approvedMinutes: null,  // ✅ Will be set after approval
            timeSpent: 0,
            timeEntries: [],
            createdAt: new Date()
          };

          Logger.log('📝 Creating budget task with data:', taskData);
          console.log('🔍 FULL taskData:', JSON.stringify(taskData, null, 2));
          console.log('🔍 serviceType:', taskData.serviceType);
          console.log('🔍 parentServiceId:', taskData.parentServiceId);
          console.log('🔍 serviceId:', taskData.serviceId);

          // Architecture v2.0 - FirebaseService with retry
          Logger.log('  🚀 [v2.0] Using FirebaseService.call');

          const result = await window.FirebaseService.call('createBudgetTask', taskData, {
            retries: 3,
            timeout: 15000
          });

          if (!result.success) {
            throw buildErrorFromResult(result, 'Failed to create budget task');
          }

          const taskId = result.data?.taskId;
          Logger.log('✅ Task created:', taskId);

          // Emit EventBus event
          window.EventBus.emit('task:created', {
            taskId: taskId || 'unknown',
            clientId: taskData.clientId,
            clientName: taskData.clientName,
            employee: taskData.employee,
            originalEstimate: taskData.estimatedMinutes,
            status: 'פעיל'
          });
          Logger.log('  🚀 [v2.0] EventBus: task:created emitted');

          // ✅ Invalidate cache to force fresh data on next load (all filters)
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:active`);
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:completed`);
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:all`);

          // Reload tasks with cache (will fetch fresh because invalidated)
          this.budgetTasks = await this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`, () =>
            this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
              || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, BUDGET_TASKS_LOAD_LIMIT)
          );
          this.filterBudgetTasks();
        },
        successMessage: null,  // ✅ לא להציג toast - נציג alert dialog במקום
        errorMessage: msgs.error.createFailed,
        onSuccess: () => {
          // ✅ הצג דיאלוג אישור עם כפתור "הבנתי"
          if (window.NotificationSystem && window.NotificationSystem.alert) {
            const alertMessage = msgs.success.created(selectorValues.clientName, description, estimatedMinutes);
            window.NotificationSystem.alert(
              alertMessage,
              () => {
                // Callback אחרי לחיצה על "הבנתי"
                console.log('✅ User acknowledged task creation');
              },
              {
                title: '✅ המשימה נשלחה בהצלחה',
                okText: 'הבנתי',
                type: 'success'
              }
            );
          }

          // ✅ NEW: Save description to recent items
          if (guidedInput && guidedInput.saveToRecent) {
            guidedInput.saveToRecent();
          }

          // Clear form and hide
          Forms.clearBudgetForm(this);
          document.getElementById('budgetFormContainer')?.classList.add('hidden');

          // Remove active class from plus button
          const plusButton = document.getElementById('smartPlusBtn');
          if (plusButton) {
            plusButton.classList.remove('active');
          }

          // Clear selector
          window.ClientCaseSelectorsManager?.clearBudget();
        }
      });
    } finally {
      // ✅ Always release the lock
      this.isTaskOperationInProgress = false;
    }
  }

  /**
   * Search budget tasks by text
   * חיפוש משימות לפי טקסט חופשי
   * @param {string} searchTerm - מונח החיפוש
   */
  searchBudgetTasks(searchTerm) {
    const trimmed = searchTerm.toLowerCase().trim();

    // אם ריק - הצג הכל לפי הפילטר הנוכחי
    if (!trimmed) {
      this.filterBudgetTasks();
      return;
    }

    // ✅ FIX: Filter by status first (respect currentTaskFilter), then search
    this.filteredBudgetTasks = this.budgetTasks.filter(task => {
      // סנן קודם לפי סטטוס בהתאם ל-currentTaskFilter
      const matchesStatus =
        this.currentTaskFilter === 'completed' ? task.status === 'הושלם' :
        this.currentTaskFilter === 'active' ? task.status === 'פעיל' :
        true; // 'all' - הצג הכל

      // בדוק אם תואם את החיפוש
      const matchesSearch = (
        // חיפוש בתיאור המשימה
        task.description?.toLowerCase().includes(trimmed) ||
        task.taskDescription?.toLowerCase().includes(trimmed) ||
        // חיפוש בשם הלקוח
        task.clientName?.toLowerCase().includes(trimmed) ||
        // חיפוש במספר תיק
        task.caseNumber?.toLowerCase().includes(trimmed) ||
        task.fileNumber?.toLowerCase().includes(trimmed) ||
        // חיפוש בשם השירות
        task.serviceName?.toLowerCase().includes(trimmed) ||
        // חיפוש בכותרת התיק
        task.caseTitle?.toLowerCase().includes(trimmed)
      );

      // ✅ תוצאה: גם תואם סטטוס וגם תואם חיפוש
      return matchesStatus && matchesSearch;
    });

    this.renderBudgetView();
  }

  /**
   * ✅ Handle iOS toggle switch change
   * @param {HTMLInputElement} checkbox - The checkbox element
   */
  async handleToggleSwitch(checkbox) {
    const viewMode = checkbox.checked ? 'completed' : 'active';
    await this.toggleTaskView(viewMode);
  }

  /**
   * ✅ Toggle between active and completed tasks view
   * @param {string} viewMode - 'active' or 'completed'
   */
  async toggleTaskView(viewMode) {
    // אם כבר בתצוגה הזו - לא עושים כלום
    if (viewMode === this.currentTaskFilter) {
return;
}

    // ✅ RACE CONDITION GUARD: Prevent concurrent toggle operations
    if (this.isTogglingView) {
      console.warn('⚠️ Toggle already in progress, ignoring duplicate call');
      return;
    }

    try {
      // ✅ Set loading flag
      this.isTogglingView = true;

      // ✅ עדכון ה-state
      this.currentTaskFilter = viewMode;
      STATE_CONFIG.setStateValue('taskFilter', viewMode); // ⚠️ Won't persist - session-only

      // ✅ עדכון כפתורי הסינון
      const activeBtn = document.getElementById('activeFilterBtn');
      const completedBtn = document.getElementById('completedFilterBtn');

      if (activeBtn && completedBtn) {
        if (viewMode === 'active') {
          activeBtn.classList.add('active');
          completedBtn.classList.remove('active');
        } else {
          activeBtn.classList.remove('active');
          completedBtn.classList.add('active');
        }
      }

      // ✅ טעינה מהשרת עם הסינון הנכון + cache update
      // Invalidate old cache first
      this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${viewMode}`);

      // Load with cache (will fetch fresh because invalidated)
      const loadedTasks = await this.dataCache.get(
        `budgetTasks:${this.currentUser}:${viewMode}`,
        () => BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, viewMode, BUDGET_TASKS_LOAD_LIMIT)
      );

      // ✅ RACE CONDITION GUARD: Verify state hasn't changed during async operation
      // If user clicked toggle again while loading, ignore stale results
      if (this.currentTaskFilter !== viewMode) {
        console.warn('⚠️ View mode changed during load, discarding stale results');
        return;
      }

      // המשימות כבר מסוננות מהשרת
      this.budgetTasks = loadedTasks;
      this.filteredBudgetTasks = [...this.budgetTasks];

      // ✅ עדכון המונים
      this.updateTaskCountBadges();

      this.renderBudgetView();

      // ✅ EventBus notification
      window.EventBus.emit('tasks:view-changed', {
        view: viewMode,
        count: this.budgetTasks.length
      });

    } catch (error) {
      console.error('Error toggling task view:', error);
      this.showNotification('שגיאה בטעינת משימות', 'error');
    } finally {
      // ✅ Always clear loading flag
      this.isTogglingView = false;
    }
  }

  /**
   * ✅ Sync toggle UI state with currentTaskFilter
   * Called during initialization to ensure UI matches localStorage state
   */
  syncToggleState() {
    const activeBtn = document.getElementById('activeFilterBtn');
    const completedBtn = document.getElementById('completedFilterBtn');

    if (!activeBtn || !completedBtn) {
      return; // Elements not ready yet
    }

    // ✅ Update UI to match currentTaskFilter
    if (this.currentTaskFilter === 'completed') {
      activeBtn.classList.remove('active');
      completedBtn.classList.add('active');
    } else {
      activeBtn.classList.add('active');
      completedBtn.classList.remove('active');
    }

    Logger.log(`✅ Toggle state synced: ${this.currentTaskFilter}`);
  }

  /**
   * ✅ Filter budget tasks - applies currentTaskFilter to budgetTasks
   * CRITICAL: Must always filter to prevent mixing of active/completed tasks
   */
  async filterBudgetTasks() {
    // ✅ Apply actual filtering based on currentTaskFilter
    if (this.currentTaskFilter === 'completed') {
      this.filteredBudgetTasks = this.budgetTasks.filter(task => task.status === 'הושלם');
    } else if (this.currentTaskFilter === 'active') {
      // ✅ הצג רק משימות פעילות (לא כולל בוטלו)
      this.filteredBudgetTasks = this.budgetTasks.filter(task => task.status === 'פעיל');
    } else {
      // 'all' - show everything (including pending_approval)
      this.filteredBudgetTasks = [...this.budgetTasks];
    }

    // Apply current sort preference — prevents real-time listener updates
    // from rendering tasks in arbitrary Firestore order.
    // Default differs by tab: active uses deadline (closest first),
    // completed uses recent (most recently updated/completed first).
    const defaultSort = this.currentTaskFilter === 'completed' ? 'recent' : 'deadline';
    this.filteredBudgetTasks = Search.sortBudgetTasks(
      this.filteredBudgetTasks,
      this.currentBudgetSort || defaultSort
    );

    this.renderBudgetView();
  }

  sortBudgetTasks(event) {
    // Get value from event or direct value (backward compatibility)
    const sortValue = event?.target?.value || event;
    this.currentBudgetSort = sortValue;

    // ✅ Save user preference (persisted)
    STATE_CONFIG.setStateValue('budgetSort', sortValue);

    this.filteredBudgetTasks = Search.sortBudgetTasks(this.filteredBudgetTasks, sortValue);
    this.renderBudgetView();
  }

  /**
   * ✅ Update task count badges for both active and completed
   * 🚀 OPTIMIZED: Uses Firestore count() for accurate counts without loading all documents
   */
  updateTaskCountBadges() {
    const allTasks = this.budgetTasks || [];
    const activeCount = allTasks.filter(t => t.status === 'פעיל').length;
    const completedCount = allTasks.filter(t => t.status === 'הושלם').length;

    const activeBadge = document.getElementById('activeCountBadge');
    if (activeBadge) {
      activeBadge.textContent = activeCount;
      activeBadge.style.display = activeCount > 0 ? 'inline-flex' : 'none';
    }

    const completedBadge = document.getElementById('completedCountBadge');
    if (completedBadge) {
      completedBadge.textContent = completedCount;
      completedBadge.style.display = completedCount > 0 ? 'inline-flex' : 'none';
    }

    Logger.log(`✅ Count badges updated: ${activeCount} active, ${completedCount} completed`);
  }

  /**
   * Hide all budget view containers.
   * Each renderer is responsible only for showing its own container;
   * this centralized helper guarantees exactly one view is visible at a time
   * and prevents cross-view leakage when switching. Adding a new view
   * requires only updating this list.
   */
  hideAllBudgetViews() {
    const containerIds = [
      'budgetContainer',        // cards
      'budgetTableContainer',   // table
      'budgetListContainer'     // list
    ];
    containerIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
      }
    });
  }

  /**
   * Attach scroll listener that toggles .is-scrolled on the sticky table
   * <thead> — gives it a subtle shadow + firmer border when the page is
   * scrolled past the header's resting position. Pure CSS isn't enough
   * because the scroll container is body.logged-in, not the table itself.
   *
   * Idempotent: flag prevents double-binding across re-renders. `passive`
   * avoids scroll-jank.
   */
  setupTableScrollShadow() {
    if (this._tableScrollShadowBound) {
      return;
    }
    this._tableScrollShadowBound = true;

    const threshold = 8;

    // Single listener on window — scroll events bubble there regardless of
    // which element actually owns the scroll (body vs documentElement). We
    // read scrollTop from both because `body.logged-in` uses overflow:auto
    // on this app, which puts the scroll on body in some engines and on
    // documentElement in others.
    const onScroll = () => {
      const thead = document.querySelector('.modern-budget-table thead, .modern-timesheet-table thead');
      if (!thead) {
        return;
      }
      const y = document.body.scrollTop || document.documentElement.scrollTop || 0;
      thead.classList.toggle('is-scrolled', y > threshold);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /**
   * Delegate clicks on the new Ultra-Minimal stats bar buttons to the
   * existing toggleTaskView() handler. The stats bar HTML is re-rendered
   * on every renderBudgetView(), so per-element listeners would leak —
   * delegation on document.body attaches once, then forwards filter clicks
   * from any current stats bar (budget tab, list view, card view).
   *
   * Idempotent via flag.
   */
  setupStatsFilterDelegation() {
    if (this._statsFilterDelegated) {
      return;
    }
    this._statsFilterDelegated = true;

    document.body.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.stat-clickable[data-filter]');
      if (!btn) {
        return;
      }
      const filter = btn.dataset.filter;
      if (filter === 'active' || filter === 'completed') {
        this.toggleTaskView(filter);
      }
      // 'all' is intentionally a no-op for now: currentTaskFilter is
      // binary (active/completed). Clicking it gives visual feedback
      // via :active scale but doesn't change state.
    });
  }

  async renderBudgetView() {
    // ✅ Calculate statistics on ALL tasks (not filtered) to show total counts
    // Server-first approach with fallback to client calculation
    const stats = window.StatisticsModule
      ? await window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks)
      : null;

    const options = {
      manager: this,
      stats: stats,
      safeText: CoreUtils.safeText,
      formatDate: CoreUtils.formatDate,
      formatShort: CoreUtils.formatShort,
      currentBudgetSort: this.currentBudgetSort,
      currentTaskFilter: this.currentTaskFilter,
      currentDeadlineFormat: this.currentDeadlineFormat, // 'date' | 'days'
      paginationStatus: null, // Will be added when pagination is implemented
      taskActionsManager: this.taskActionsManager
    };

    // Single Responsibility: hide all views here, renderers only show themselves.
    this.hideAllBudgetViews();

    // Wire stats-bar filter clicks (idempotent — attaches listener once).
    this.setupStatsFilterDelegation();

    // Sync the deadline-format toggle's active state with the current
    // preference so the correct button is highlighted after initial
    // render (HTML markup defaults to 'date' active; if the user's
    // persisted preference is 'days' we need to flip it here).
    const toggle = document.querySelector('.deadline-format-toggle');
    if (toggle) {
      toggle.querySelectorAll('.deadline-format-btn').forEach(btn => {
        if (btn.dataset.format === this.currentDeadlineFormat) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    if (this.currentBudgetView === 'cards') {
      BudgetTasks.renderBudgetCards(this.filteredBudgetTasks, options);
    } else if (this.currentBudgetView === 'list') {
      BudgetTasks.renderBudgetList(this.filteredBudgetTasks, options);
    } else {
      BudgetTasks.renderBudgetTable(this.filteredBudgetTasks, options);
      // Sticky thead needs a scroll listener to know when to render its
      // "scrolled" state (shadow + firmer border). Only meaningful in table view.
      this.setupTableScrollShadow();
      // Hydrate Lucide placeholders (<i data-lucide="...">) into inline SVGs.
      // Must run after innerHTML is set; guarded for when the library hasn't
      // loaded yet (slow network) — harmless no-op in that case.
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }

  switchBudgetView(view) {
    // ✅ Save user preference (persisted)
    STATE_CONFIG.setStateValue('budgetView', view);
    this.currentBudgetView = view;

    // Update view tabs — only the budget view tabs, not timesheet's
    const budgetTabsContainer = document.querySelector('#budgetTab .view-tabs');
    if (budgetTabsContainer) {
      budgetTabsContainer.querySelectorAll('.view-tab').forEach(tab => {
        if (tab.dataset.view === view) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    this.renderBudgetView();

    // Scroll to top — each view has its own structure and context;
    // keeping scroll across views causes a jarring jump.
    // NB: on this app body.logged-in is the scrolling element (overflow: auto),
    // not window itself. Cover both to be safe.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.body) {
        document.body.scrollTop = 0;
      }
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
    });
  }

  /**
   * Switch how deadlines are rendered across the budget views.
   * Persisted via STATE_CONFIG so the user's choice sticks across sessions.
   *
   * @param {'date'|'days'} format - 'date' shows dd.mm.yy, 'days' shows
   *   relative "5 ימים" / "איחור 6 ימים".
   *
   * Affected surfaces: cards view (progress-row-value), table deadline
   * cell, and the compact deadline ring's center label.
   *
   * We re-render the current view rather than patching the DOM in place
   * so the transition is atomic — no half-date / half-days state ever
   * reaches the user.
   */
  switchDeadlineFormat(format) {
    if (format !== 'date' && format !== 'days') {
      return;
    }
    if (this.currentDeadlineFormat === format) {
      return;
    }
    STATE_CONFIG.setStateValue('deadlineFormat', format);
    this.currentDeadlineFormat = format;

    const toggle = document.querySelector('.deadline-format-toggle');
    if (toggle) {
      toggle.querySelectorAll('.deadline-format-btn').forEach(btn => {
        if (btn.dataset.format === format) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    this.renderBudgetView();
  }

  /**
   * Toggle expand/collapse of a list-view group (Phase 0).
   * @param {string} groupKey - 'overdue' | 'this-week' | 'this-month' | 'later'
   */
  toggleListGroup(groupKey) {
    const group = document.querySelector(`.list-group[data-group="${groupKey}"]`);
    if (!group) {
      return;
    }

    const header = group.querySelector('.list-group-header');
    const isExpanded = group.classList.toggle('is-expanded');

    if (header) {
      header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    }
  }

  /* ========================================
     TIMESHEET MANAGEMENT
     ======================================== */

  async addTimesheetEntry() {
    // ✅ This form is now ONLY for internal activities
    // Time tracking on clients is done automatically through tasks

    // Guard against concurrent double-submissions
    if (this._timesheetSubmitting) {
return;
}
    this._timesheetSubmitting = true;

    // Validate form fields
    const date = document.getElementById('actionDate')?.value;

    const minutes = parseInt(document.getElementById('actionMinutes')?.value);
    const action = document.getElementById('actionDescription')?.value?.trim();
    const notes = document.getElementById('actionNotes')?.value?.trim();

    if (!date) {
      this.showNotification('חובה לבחור תאריך', 'error');
      this._timesheetSubmitting = false;
      return;
    }

    if (!minutes || minutes < 1) {
      this.showNotification('חובה להזין זמן בדקות', 'error');
      this._timesheetSubmitting = false;
      return;
    }

    if (!action || action.length < 3) {
      this.showNotification('חובה להזין תיאור פעולה (לפחות 3 תווים)', 'error');
      this._timesheetSubmitting = false;
      return;
    }

    // Use ActionFlowManager for consistent UX with NotificationMessages
    const msgs = window.NotificationMessages.timesheet;

    await ActionFlowManager.execute({
      operationKey: 'addTimesheetEntry',
      ...msgs.loading.createInternal(),
      action: async () => {
        const entryData = {
          date: date,
          minutes: minutes,
          clientName: null,  // Internal activity - no client
          clientId: null,
          fileNumber: null,
          caseId: null,
          caseTitle: null,
          action: action,
          notes: notes,
          employee: this.currentUser,
          isInternal: true,  // Always internal activity
          createdAt: new Date()
        };

        Logger.log('📝 Creating internal timesheet entry:', entryData);

        // ✅ Migration v1→v2: Use adapter for enterprise features (idempotency, event sourcing)
        Logger.log('  🚀 [Migration v1→v2] Using createTimesheetEntry_v2 via adapter');

        const result = await createTimesheetEntryV2(entryData);

        if (!result.success) {
          throw buildErrorFromResult(result, 'שגיאה ברישום פעילות');
        }

        // Invalidate cache to force fresh data on next load
        this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`);
        this.dataCache.invalidate('clients');

        // Reload entries with cache (will fetch fresh because invalidated)
        this.timesheetEntries = await this.dataCache.get(`timesheetEntries:${this.currentUser}`, () =>
          this.integrationManager?.loadTimesheet(this.currentUser)
            || FirebaseOps.loadTimesheetFromFirebase(this.currentUser)
        );
        this.filterTimesheetEntries();
        this.loadMonthlyTimesheetStats();

        // Emit EventBus event
        window.EventBus.emit('timesheet:entry-created', {
          entryId: result.entryId || 'unknown',
          date,
          minutes,
          action,
          notes,
          employee: this.currentUser,
          isInternal: true
        });
        Logger.log('  🚀 [v2.0] EventBus: timesheet:entry-created emitted');
      },
      successMessage: msgs.success.internalCreated(minutes),
      errorMessage: msgs.error.createFailed,
      onSuccess: () => {
        // Clear form and hide
        Forms.clearTimesheetForm(this);
        document.getElementById('timesheetFormContainer')?.classList.add('hidden');

        // Remove active class from plus button
        const plusButton = document.getElementById('smartPlusBtn');
        if (plusButton) {
plusButton.classList.remove('active');
}
      },
      onFinally: () => {
        this._timesheetSubmitting = false;
      }
    });
  }

  filterTimesheetEntries() {
    // Get current filter value from the select element
    const filterSelect = document.getElementById('timesheetFilter');
    if (filterSelect) {
      this.currentTimesheetFilter = filterSelect.value;
    }

    const filterValue = this.currentTimesheetFilter;
    this.filteredTimesheetEntries = Search.filterTimesheetEntries(this.timesheetEntries, filterValue);
    this.renderTimesheetView();
  }

  sortTimesheetEntries(event) {
    // Get value from event or direct value (backward compatibility)
    const sortValue = event?.target?.value || event;
    this.currentTimesheetSort = sortValue;
    this.filteredTimesheetEntries = Search.sortTimesheetEntries(this.filteredTimesheetEntries, sortValue);
    this.renderTimesheetView();
  }

  loadMonthlyTimesheetStats() {
    try {
      const getDateString = (date) => {
        if (!date) {
return '';
}
        if (typeof date === 'string') {
return date;
}
        if (date.toDate) {
return date.toDate().toISOString().substring(0, 10);
}
        if (date instanceof Date) {
return date.toISOString().substring(0, 10);
}
        return String(date);
      };

      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfWeekStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth()+1).padStart(2,'0')}-${String(startOfWeek.getDate()).padStart(2,'0')}`;

      const entries = this.timesheetEntries || [];
      const monthEntries = entries.filter(e => getDateString(e.date) >= startOfMonth);

      let monthMinutes = 0;
      let weekMinutes = 0;
      monthEntries.forEach(entry => {
        monthMinutes += entry.minutes || 0;
        if (getDateString(entry.date) >= startOfWeekStr) {
          weekMinutes += entry.minutes || 0;
        }
      });

      this.monthlyEntries = monthEntries;
      this.monthlyStats = {
        monthMinutes, monthHours: Math.round((monthMinutes / 60) * 10) / 10,
        weekMinutes, weekHours: Math.round((weekMinutes / 60) * 10) / 10,
        monthEntries: monthEntries.length
      };
    } catch (error) {
      console.error('Failed to load monthly stats:', error);
      this.monthlyStats = null;
    }
  }

  renderTimesheetView() {
    // Use full monthly entries if available, fallback to pagination
    const statsEntries = this.monthlyEntries || this.timesheetEntries;

    const stats = window.StatisticsModule
      ? window.StatisticsModule.calculateTimesheetStatistics(statsEntries)
      : {
          totalMinutes: Timesheet.getTotalMinutes(statsEntries),
          totalHours: Math.round((Timesheet.getTotalMinutes(statsEntries) / 60) * 10) / 10,
          totalEntries: statsEntries.length
        };

    const paginationStatus = {
      currentPage: this.currentTimesheetPage,
      totalPages: Math.ceil(this.filteredTimesheetEntries.length / 20),
      hasMore: this.integrationManager?.firebasePagination?.hasMore?.timesheet_entries || false,
      displayedItems: this.filteredTimesheetEntries.length,
      filteredItems: this.filteredTimesheetEntries.length,
      pageSize: this.integrationManager?.config?.PAGINATION_PAGE_SIZE || 20
    };

    // Find the parent div that contains timesheetContainer and timesheetTableContainer
    const parentContainer = document.querySelector('#timesheetTab > div:last-child');
    if (!parentContainer) {
      console.error('❌ Timesheet parent container not found');
      return;
    }

    let html;
    if (this.currentTimesheetView === 'cards') {
      html = Timesheet.renderTimesheetCards(
        this.filteredTimesheetEntries,
        stats,
        paginationStatus,
        this.currentTimesheetSort
      );
    } else {
      html = Timesheet.renderTimesheetTable(
        this.filteredTimesheetEntries,
        stats,
        paginationStatus,
        this.currentTimesheetSort
      );
    }

    // Replace only the content area (not the form or controls)
    parentContainer.innerHTML = html;

    // ✅ Initialize description tooltips after rendering
    if (window.DescriptionTooltips) {
      window.DescriptionTooltips.refresh(parentContainer);
    }
  }

  switchTimesheetView(view) {
    this.currentTimesheetView = view;

    // Update view tabs
    document.querySelectorAll('#timesheetTab .view-tab').forEach(tab => {
      if (tab.dataset.view === view) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.renderTimesheetView();
  }

  showEditTimesheetDialog(entryId) {
    Forms.showEditTimesheetDialog(this, entryId);
  }

  searchClientsForEdit(searchTerm) {
    Forms.searchClientsForEdit(this, searchTerm);
  }

  selectClientForEdit(clientName, fileNumber) {
    Forms.selectClientForEdit(this, clientName, fileNumber);
  }

  /**
   * Submit Advanced Timesheet Edit
   * עדכון רשומת שעתון עם מעקב אחר היסטוריית עריכה
   * @param {string} entryId - מזהה רשומת שעתון
   */
  async submitAdvancedTimesheetEdit(entryId) {
    // Find the entry
    const entry = this.timesheetEntries.find(
      (e) =>
        (e.id && e.id.toString() === entryId.toString()) ||
        (e.entryId && e.entryId.toString() === entryId.toString())
    );

    if (!entry) {
      this.showNotification('רשומת שעתון לא נמצאה', 'error');
      return;
    }

    // Get form values
    const newDate = document.getElementById('editDate')?.value;
    const newMinutes = parseInt(document.getElementById('editMinutes')?.value);
    const editReason = document.getElementById('editReason')?.value?.trim();

    // ✅ Helper function to show field error with visual feedback
    const showFieldError = (fieldId, message) => {
      const field = document.getElementById(fieldId);
      if (!field) {
return;
}

      // Add error styling
      field.classList.add('error');
      field.style.borderColor = '#ef4444';
      field.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';

      // Remove existing error message if any
      const existingError = field.parentElement?.querySelector('.error-message');
      if (existingError) {
existingError.remove();
}

      // Add error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.style.color = '#ef4444';
      errorMsg.style.fontSize = '13px';
      errorMsg.style.marginTop = '6px';
      errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;

      // ✅ FIX: Add null safety check before appendChild
      if (field.parentElement) {
        field.parentElement.appendChild(errorMsg);
      }

      // Focus on the field
      field.focus();

      // Also show notification
      this.showNotification(message, 'error');
    };

    // ✅ Use NotificationMessages for validation (Single Source of Truth)
    const validationMsgs = window.NotificationMessages.timesheet.validation;

    // Validation with visual feedback
    if (!newDate) {
      showFieldError('editDate', validationMsgs.noDate());
      return;
    }

    if (!newMinutes || newMinutes < 1) {
      showFieldError('editMinutes', validationMsgs.noMinutes());
      return;
    }

    if (!editReason || editReason.length < 5) {
      showFieldError('editReason', validationMsgs.noEditReason());
      return;
    }

    // Calculate changes
    const oldMinutes = entry.minutes;
    const minutesDiff = newMinutes - oldMinutes;

    // Use ActionFlowManager for consistent UX
    const msgs = window.NotificationMessages.timesheet;

    await ActionFlowManager.execute({
      operationKey: `submitAdvancedTimesheetEdit_${entryId}`,
      ...msgs.loading.updating(),
      action: async () => {
        // Prepare edit history entry
        const editHistoryEntry = {
          editedAt: new Date().toISOString(),
          editedBy: this.currentUsername || this.currentUser,
          reason: editReason,
          changes: {
            oldDate: entry.date,
            newDate: newDate,
            oldMinutes: oldMinutes,
            newMinutes: newMinutes
          }
        };

        // Prepare update data
        const updateData = {
          entryId: entry.id || entry.entryId,
          date: newDate,
          minutes: newMinutes,
          editHistory: entry.editHistory ? [...entry.editHistory, editHistoryEntry] : [editHistoryEntry],
          isInternal: entry.isInternal || false,
          autoGenerated: entry.autoGenerated || false,
          taskId: entry.taskId || null,
          clientId: entry.clientId || null,
          serviceId: entry.serviceId || null,
          minutesDiff: minutesDiff
        };

        Logger.log('📝 Updating timesheet entry:', updateData);

        // Call Firebase Function to update entry
        const result = await window.FirebaseService.call('updateTimesheetEntry', updateData, {
          retries: 3,
          timeout: 15000
        });

        if (!result.success) {
          throw buildErrorFromResult(result, 'שגיאה בעדכון רשומת שעתון');
        }

        // Invalidate cache to force fresh data on next load
        this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`);
        this.dataCache.invalidate('clients');

        // Reload entries with cache (will fetch fresh because invalidated)
        this.timesheetEntries = await this.dataCache.get(`timesheetEntries:${this.currentUser}`, () =>
          this.integrationManager?.loadTimesheet(this.currentUser)
            || FirebaseOps.loadTimesheetFromFirebase(this.currentUser)
        );
        this.filterTimesheetEntries();
        this.loadMonthlyTimesheetStats();

        // Emit EventBus event
        window.EventBus.emit('timesheet:entry-updated', {
          entryId: updateData.entryId,
          oldDate: entry.date,
          newDate: newDate,
          oldMinutes: oldMinutes,
          newMinutes: newMinutes,
          minutesDiff: minutesDiff,
          employee: this.currentUser,
          editReason: editReason
        });
        Logger.log('  🚀 [v2.0] EventBus: timesheet:entry-updated emitted');
      },
      successMessage: msgs.success.updated(newMinutes),
      errorMessage: msgs.error.updateFailed,
      onSuccess: () => {
        // Close dialog
        const overlay = document.querySelector('.popup-overlay');
        if (overlay) {
          overlay.remove();
        }
      }
    });
  }

  /**
   * טעינת רשומות שעתון נוספות (פגינציה)
   * Load more timesheet entries from Firebase
   */
  async loadMoreTimesheetEntries() {
    if (!this.integrationManager) {
      this.showNotification('מנהל אינטגרציה לא זמין', 'error');
      return;
    }

    try {
      // Show loading state
      this.showNotification('טוען רשומות נוספות...', 'info');

      // Store old count BEFORE loading new entries
      const oldCount = this.timesheetEntries.length;

      // ✅ Load 20 MORE from Firebase (not all!)
      const newEntries = await this.integrationManager.loadMoreTimesheet(
        this.currentUser,
        this.timesheetEntries
      );

      // Update local data
      this.timesheetEntries = newEntries;
      this.filterTimesheetEntries();

      // Calculate how many were actually added
      const addedCount = newEntries.length - oldCount;
      this.showNotification(
        addedCount > 0
          ? `נטענו ${addedCount} רשומות נוספות`
          : 'אין רשומות נוספות',
        addedCount > 0 ? 'success' : 'info'
      );
    } catch (error) {
      console.error('❌ Error loading more timesheet:', error);
      this.showNotification('שגיאה בטעינת רשומות נוספות', 'error');
    }
  }

  /* ========================================
     CARD EXPANSION & DIALOGS
     ======================================== */

  expandTaskCard(taskId, event) {
    event.stopPropagation();
    const task = this.filteredBudgetTasks.find((t) => t.id === taskId);
    if (!task) {
return;
}

    this.showExpandedCard(task);
  }

  showExpandedCard(task) {
    // Calculate simple progress
    let progress = 0;
    if (task.estimatedMinutes && task.estimatedMinutes > 0) {
      progress = Math.round(((task.actualMinutes || 0) / task.estimatedMinutes) * 100);
      // ✅ No 100% cap - shows 150%+ for overage in expanded card
    }
    const isCompleted = task.status === 'הושלם';

    const expandedContent = `
      <div class="linear-expanded-overlay" data-task-id="${task.id}" onclick="manager.closeExpandedCard(event)">
        <div class="linear-expanded-card" onclick="event.stopPropagation()">
          <div class="linear-expanded-header">
            <h2 class="linear-expanded-title">${CoreUtils.safeText(task.description || task.taskDescription)}</h2>
            <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="linear-expanded-body">
            <div class="linear-info-grid">
              <div class="linear-info-item">
                <label>לקוח:</label>
                <span>${CoreUtils.safeText(task.clientName)}</span>
              </div>
              <div class="linear-info-item">
                <label>סטטוס:</label>
                <span>${CoreUtils.safeText(task.status)}</span>
              </div>
              <div class="linear-info-item">
                <label>התקדמות:</label>
                <span>${progress}%</span>
              </div>
              <div class="linear-info-item">
                <label>תאריך יעד:</label>
                <span>${CoreUtils.formatDateTime(new Date(task.deadline))}</span>
              </div>
            </div>
            ${this.taskActionsManager ? this.taskActionsManager.createCardActionButtons(task, isCompleted) : ''}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', expandedContent);

    setTimeout(() => {
      const overlay = document.querySelector('.linear-expanded-overlay');
      if (overlay) {
        overlay.classList.add('active');
      }
    }, 10);
  }

  closeExpandedCard() {
    const overlay = document.querySelector('.linear-expanded-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  /**
   * Update expanded card if currently open
   * מעדכן את הכרטיס המורחב אם פתוח כרגע
   * @param {string} [taskId] - Optional task ID. If not provided, uses data-task-id from overlay
   */
  updateExpandedCard(taskId) {
    // Check if expanded card is currently open
    const overlay = document.querySelector('.linear-expanded-overlay.active');
    if (!overlay) {
      return; // No expanded card open
    }

    // Get taskId from data attribute if not provided
    if (!taskId) {
      taskId = overlay.dataset.taskId;
    }

    if (!taskId) {
      return; // No task ID available
    }

    // Get updated task data
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      // Task deleted or not found - close the card
      this.closeExpandedCard();
      return;
    }

    // Find the actions container in the expanded card
    const actionsContainer = overlay.querySelector('.linear-actions');
    if (!actionsContainer) {
      return; // No actions container found
    }

    // Calculate progress
    let progress = 0;
    if (task.estimatedMinutes && task.estimatedMinutes > 0) {
      progress = Math.round(((task.actualMinutes || 0) / task.estimatedMinutes) * 100);
    }
    const isCompleted = task.status === 'הושלם';

    // Update progress and status displays in the info grid
    const infoItems = overlay.querySelectorAll('.linear-info-item');
    infoItems.forEach((item) => {
      const label = item.querySelector('label');
      const span = item.querySelector('span');

      if (!label || !span) {
return;
}

      if (label.textContent === 'התקדמות:') {
        span.textContent = `${progress}%`;
      } else if (label.textContent === 'סטטוס:') {
        span.textContent = CoreUtils.safeText(task.status);
      }
    });

    // Regenerate action buttons with updated task data
    if (this.taskActionsManager) {
      const newButtons = this.taskActionsManager.createCardActionButtons(task, isCompleted);
      actionsContainer.outerHTML = newButtons;
    }
  }

  /* ========================================
     TASK ACTIONS - Dialog Functions
     ======================================== */

  showAdvancedTimeDialog(taskId) {
    if (!window.DialogsModule) {
      this.showNotification('מודול דיאלוגים לא נטען', 'error');
      return;
    }
    window.DialogsModule.showAdvancedTimeDialog(taskId, this);
  }

  showTaskHistory(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification('המשימה לא נמצאה', 'error');
      return;
    }

    // ✅ Use new TaskTimeline component
    if (window.TaskTimelineInstance) {
      window.TaskTimelineInstance.show(task);
    } else {
      console.error('TaskTimeline component not loaded');
      this.showNotification('שגיאה בטעינת ציר הזמן', 'error');
    }
  }

  showExtendDeadlineDialog(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification('המשימה לא נמצאה', 'error');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.id = 'extendDeadlineOverlay'; // ✅ NEW: ID for optimistic updates

    // תיקון: המרת Firebase Timestamp לDate נכון
    let currentDeadline = window.DatesModule
      ? window.DatesModule.convertFirebaseTimestamp(task.deadline)
      : new Date(task.deadline);

    if (!currentDeadline || isNaN(currentDeadline.getTime())) {
      // אם התאריך לא תקין, השתמש בתאריך נוכחי
      currentDeadline = new Date();
      console.warn('⚠️ task.deadline is invalid, using current date', task.deadline);
    }

    const defaultNewDate = new Date(currentDeadline);
    defaultNewDate.setDate(defaultNewDate.getDate() + 7);
    const defaultDateValue = defaultNewDate.toISOString().split('T')[0];

    // ✅ NEW: Set min date to current deadline (prevent past dates)
    const minDateValue = currentDeadline.toISOString().split('T')[0];

    // ✅ NEW: Build extensions history HTML
    const extensionsHistory = this._buildExtensionsHistoryHTML(task);

    overlay.innerHTML = `
      <div class="popup" style="max-width: 580px;">
        <div class="popup-header">
          <i class="fas fa-calendar-plus"></i>
          הארכת תאריך יעד
        </div>
        <div class="popup-content">
          <div class="form-group">
            <label>משימה:</label>
            <div style="font-weight: bold; color: #333;">${
              task.description || task.taskDescription
            }</div>
          </div>
          <div class="form-group">
            <label>תאריך יעד נוכחי:</label>
            <div style="color: #dc2626; font-weight: bold;">${CoreUtils.formatDateTime(
              currentDeadline
            )}</div>
          </div>

          ${extensionsHistory}

          <div class="form-group">
            <label for="newDeadlineDate">תאריך יעד חדש:</label>

            <!-- ✅ NEW: Quick Actions -->
            <div class="quick-actions-row">
              <button type="button" class="quick-action-btn" data-days="3">
                <i class="fas fa-clock"></i> +3 ימים
              </button>
              <button type="button" class="quick-action-btn" data-days="7">
                <i class="fas fa-calendar-week"></i> +7 ימים
              </button>
              <button type="button" class="quick-action-btn" data-days="14">
                <i class="fas fa-calendar-alt"></i> +14 ימים
              </button>
              <button type="button" class="quick-action-btn" data-days="30">
                <i class="fas fa-calendar"></i> +30 ימים
              </button>
            </div>

            <input
              type="date"
              id="newDeadlineDate"
              value="${defaultDateValue}"
              min="${minDateValue}"
              required
            >

            <!-- ✅ NEW: Days difference display -->
            <div id="daysDifferenceDisplay" style="display: none; margin-top: 8px; padding: 10px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-right: 3px solid #3b82f6; border-radius: 6px; font-size: 13px; color: #1e40af;">
              <i class="fas fa-calendar-check" style="color: #3b82f6;"></i>
              <strong>הארכה של: <span id="daysCount">0</span> ימים</strong>
              <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                מ-<span id="oldDateDisplay">${CoreUtils.formatDate(currentDeadline)}</span>
                →
                <span id="newDateDisplay" style="color: #10b981; font-weight: 600;"></span>
              </div>
            </div>

            <small id="dateValidationError" style="color: #dc2626; display: none; margin-top: 4px; font-size: 12px;">
              <i class="fas fa-exclamation-triangle"></i> התאריך החדש חייב להיות מאוחר מהיעד הנוכחי
            </small>
          </div>
          <div class="form-group">
            <label for="extensionReason">סיבת ההארכה:</label>
            <textarea id="extensionReason" rows="3" placeholder="מדוע נדרשת הארכה?" required></textarea>
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> ביטול
          </button>
          <button class="popup-btn popup-btn-confirm" onclick="manager.submitDeadlineExtension('${taskId}')">
            <i class="fas fa-calendar-check"></i> אשר הארכה
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // ✅ NEW: Add real-time date validation
    const dateInput = document.getElementById('newDeadlineDate');
    const dateError = document.getElementById('dateValidationError');
    const confirmBtn = overlay.querySelector('.popup-btn-confirm');
    const daysDifferenceDisplay = document.getElementById('daysDifferenceDisplay');
    const daysCountSpan = document.getElementById('daysCount');
    const newDateDisplaySpan = document.getElementById('newDateDisplay');

    // ✅ NEW: Function to update days difference display
    const updateDaysDifference = (newDateValue) => {
      if (!newDateValue) {
        daysDifferenceDisplay.style.display = 'none';
        return;
      }

      const selectedDate = new Date(newDateValue);
      const currentDate = new Date(minDateValue);
      const diffTime = selectedDate - currentDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        daysCountSpan.textContent = diffDays;
        newDateDisplaySpan.textContent = CoreUtils.formatDate(selectedDate);
        daysDifferenceDisplay.style.display = 'block';
      } else {
        daysDifferenceDisplay.style.display = 'none';
      }
    };

    // ✅ NEW: Quick Actions buttons
    const quickActionBtns = overlay.querySelectorAll('.quick-action-btn');
    quickActionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const days = parseInt(btn.dataset.days);
        const newDate = new Date(currentDeadline);
        newDate.setDate(newDate.getDate() + days);
        const newDateValue = newDate.toISOString().split('T')[0];

        dateInput.value = newDateValue;
        dateInput.dispatchEvent(new Event('change'));

        // Visual feedback - highlight selected button
        quickActionBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // ✅ Date validation + days difference
    dateInput.addEventListener('change', () => {
      const selectedDate = new Date(dateInput.value);
      const minDate = new Date(minDateValue);

      // Remove selected state from quick actions
      quickActionBtns.forEach(b => b.classList.remove('selected'));

      if (selectedDate <= minDate) {
        dateError.style.display = 'block';
        dateInput.style.borderColor = '#dc2626';
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
        daysDifferenceDisplay.style.display = 'none';
      } else {
        dateError.style.display = 'none';
        dateInput.style.borderColor = '';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
        updateDaysDifference(dateInput.value);
      }
    });

    // ✅ Initial display of days difference
    updateDaysDifference(dateInput.value);

    // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  /**
   * ✅ NEW: Build extensions history HTML section
   * @private
   */
  _buildExtensionsHistoryHTML(task) {
    if (!task.deadlineExtensions || task.deadlineExtensions.length === 0) {
      return ''; // No history to show
    }

    const extensions = task.deadlineExtensions
      .map(ext => {
        const oldDate = window.DatesModule
          ? window.DatesModule.convertFirebaseTimestamp(ext.oldDeadline)
          : new Date(ext.oldDeadline);
        const newDate = window.DatesModule
          ? window.DatesModule.convertFirebaseTimestamp(ext.newDeadline)
          : new Date(ext.newDeadline);
        const extendedAt = window.DatesModule
          ? window.DatesModule.convertFirebaseTimestamp(ext.extendedAt)
          : new Date(ext.extendedAt);

        return `
          <div class="extension-history-item">
            <div class="extension-header">
              <span class="extension-date">
                <i class="fas fa-calendar-alt"></i>
                ${CoreUtils.formatDate(extendedAt)}
              </span>
              <span class="extension-user">
                <i class="fas fa-user"></i>
                ${ext.extendedBy || 'לא ידוע'}
              </span>
            </div>
            <div class="extension-details">
              <div class="extension-dates">
                <span class="old-date">${CoreUtils.formatDate(oldDate)}</span>
                <i class="fas fa-arrow-left"></i>
                <span class="new-date">${CoreUtils.formatDate(newDate)}</span>
              </div>
              <div class="extension-reason">${ext.reason || 'ללא סיבה'}</div>
            </div>
          </div>
        `;
      })
      .reverse() // Latest first
      .join('');

    return `
      <div class="extensions-history-section">
        <div class="extensions-history-header">
          <i class="fas fa-history"></i>
          היסטוריית הארכות (${task.deadlineExtensions.length})
        </div>
        <div class="extensions-history-list">
          ${extensions}
        </div>
      </div>
    `;
  }

  async submitDeadlineExtension(taskId) {
    const newDate = document.getElementById('newDeadlineDate')?.value;
    const reason = document.getElementById('extensionReason')?.value?.trim();

    if (!newDate || !reason) {
      this.showNotification('אנא מלא את כל השדות', 'error');
      return;
    }

    // Use ActionFlowManager with auto-close popup and NotificationMessages
    const msgs = window.NotificationMessages.tasks;

    await ActionFlowManager.execute({
      operationKey: `submitDeadlineExtension_${taskId}`,
      ...msgs.loading.extendDeadline(),
      action: async () => {
        // Architecture v2.0 - FirebaseService with retry
        Logger.log('  🚀 [v2.0] Using FirebaseService.call for extendTaskDeadline');

        const result = await window.FirebaseService.call('extendTaskDeadline', {
          taskId,
          newDeadline: newDate,
          reason
        }, {
          retries: 3,
          timeout: 10000
        });

        if (!result.success) {
          throw buildErrorFromResult(result, 'שגיאה בהארכת יעד');
        }

        // Reload tasks (loadData() already refreshes all selectors)
        await this.loadData();
        this.filterBudgetTasks();

        // Emit EventBus event AFTER reload (when we have fresh data)
        const task = this.budgetTasks.find(t => t.id === taskId);
        window.EventBus.emit('task:deadline-extended', {
          taskId,
          oldDeadline: task?.deadline || newDate, // Use current deadline (or newDate if not found)
          newDeadline: newDate,
          reason,
          extendedBy: this.currentUser
        });
        Logger.log('  🚀 [v2.0] EventBus: task:deadline-extended emitted');
      },
      successMessage: msgs.success.deadlineExtended(newDate),
      errorMessage: msgs.error.updateFailed,
      closePopupOnSuccess: true,  // ✅ Auto-close popup
      closeDelay: 500
    });
  }

  async completeTask(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification('המשימה לא נמצאה', 'error');
      return;
    }

    if (!window.DialogsModule) {
      this.showNotification('מודול דיאלוגים לא נטען', 'error');
      return;
    }

    // ✨ NEW: Use task completion validation system
    if (window.TaskCompletionValidation) {
      window.TaskCompletionValidation.initiateTaskCompletion(task, this);
    } else {
      // Fallback to standard completion if validation module not loaded
      window.DialogsModule.showTaskCompletionModal(task, this);
    }
  }

  /**
   * Show cancel task dialog
   * ביטול משימה - רק למשימות פעילות ללא זמן רשום
   */
  showCancelTaskDialog(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification('המשימה לא נמצאה', 'error');
      return;
    }

    // Validate task can be cancelled
    if (task.status !== 'פעיל') {
      this.showNotification('ניתן לבטל רק משימות פעילות', 'error');
      return;
    }

    if (task.actualMinutes > 0) {
      this.showNotification('לא ניתן לבטל משימה עם זמן רשום. נא לפנות למנהל/ת.', 'error');
      return;
    }

    const actualHours = task.actualMinutes ? Math.round((task.actualMinutes / 60) * 10) / 10 : 0;

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    overlay.innerHTML = `
      <div class="popup" style="max-width: 480px;">
        <div class="popup-header">
          <i class="fas fa-ban"></i>
          ביטול משימה
        </div>
        <div class="popup-content">
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <i class="fas fa-user" style="color: #64748b; font-size: 12px; width: 14px;"></i>
              <span style="font-size: 13px; color: #64748b;">לקוח:</span>
              <span style="font-size: 13px; color: #1e293b; font-weight: 600;">${CoreUtils.safeText(task.clientName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <i class="fas fa-tasks" style="color: #64748b; font-size: 12px; width: 14px;"></i>
              <span style="font-size: 13px; color: #64748b;">משימה:</span>
              <span style="font-size: 13px; color: #1e293b; font-weight: 600;">${CoreUtils.safeText(task.description || task.taskDescription)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-clock" style="color: #64748b; font-size: 12px; width: 14px;"></i>
              <span style="font-size: 13px; color: #64748b;">זמן רשום:</span>
              <span style="font-size: 13px; color: #1e293b; font-weight: 600;">${actualHours} שעות</span>
            </div>
          </div>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-right: 3px solid #f59e0b; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 13px; color: #92400e; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 12px;"></i>
            <span>המשימה תוסר מרשימת המשימות הפעילות</span>
          </div>
          <div class="form-group">
            <label for="cancelReason">סיבת ביטול:</label>
            <textarea id="cancelReason" rows="3" placeholder="נא לתאר את סיבת ביטול המשימה..." required></textarea>
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> ביטול
          </button>
          <button class="popup-btn popup-btn-confirm" onclick="manager.submitCancelTask('${taskId}')" style="background: #dc2626; border-color: #dc2626;">
            <i class="fas fa-ban"></i> אשר ביטול
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Focus on reason textarea
    setTimeout(() => {
      const reasonInput = document.getElementById('cancelReason');
      if (reasonInput) {
        reasonInput.focus();
      }
    }, 100);
  }

  /**
   * Submit task cancellation
   * שליחת בקשת ביטול לשרת
   */
  async submitCancelTask(taskId) {
    if (this._isCancelling) {
      return;
    }
    this._isCancelling = true;

    try {
      const reasonInput = document.getElementById('cancelReason');
      const reason = reasonInput?.value?.trim();

      // Clear previous errors
      reasonInput?.classList.remove('error');
      const existingError = reasonInput?.parentElement.querySelector('.error-message');
      if (existingError) {
        existingError.remove();
      }

      // Validate reason
      if (!reason) {
        reasonInput?.classList.add('error');
        const errorMsg = document.createElement('span');
        errorMsg.className = 'error-message';
        errorMsg.textContent = 'נא למלא סיבת ביטול';
        reasonInput?.parentElement.appendChild(errorMsg);
        return;
      }

      const overlay = document.querySelector('.popup-overlay.show');
      const confirmBtn = overlay?.querySelector('.popup-btn-confirm');

      try {
        // Show loading state (no layout shift)
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.classList.add('loading');
        }

        // Call Cloud Function
        const cancelTask = firebase.functions().httpsCallable('cancelBudgetTask');
        const result = await cancelTask({
          taskId: taskId,
          reason: reason
        });

        // Success - show toast
        this.showNotification('המשימה בוטלה בהצלחה', 'success');

        // Close dialog with smooth transition
        if (overlay) {
          overlay.classList.remove('show');
          setTimeout(() => overlay.remove(), 300);
        }

        // Close expanded card if open (smooth transition)
        const expandedOverlay = document.querySelector('.linear-expanded-overlay.active');
        if (expandedOverlay) {
          expandedOverlay.style.opacity = '0';
          setTimeout(() => this.closeExpandedCard(), 200);
        }

      } catch (error) {
        console.error('❌ Cancel task failed:', error);

        // Remove loading state
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.classList.remove('loading');
        }

        // Show error toast from server (already in Hebrew)
        const errorMessage = error.message || 'שגיאה בביטול המשימה';
        this.showNotification(errorMessage, 'error');
      }
    } finally {
      this._isCancelling = false;
    }
  }

  async submitTimeEntry(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
return;
}

    // ✅ NEW: Visual validation with field highlighting - FIRST!
    const workDate = document.getElementById('workDate')?.value;
    const workMinutes = parseInt(document.getElementById('workMinutes')?.value);
    const dateInput = document.getElementById('workDate');
    const minutesInput = document.getElementById('workMinutes');
    const guidedInput = window._currentGuidedInput;

    // Clear previous errors (scoped to popup for performance)
    dateInput?.classList.remove('error');
    minutesInput?.classList.remove('error');
    const guidedTextarea = document.querySelector('.guided-textarea');
    guidedTextarea?.classList.remove('error');
    const popup = document.querySelector('.popup-overlay.show .popup');
    if (popup) {
      popup.querySelectorAll('.error-message').forEach(el => el.remove());
    }

    let hasErrors = false;

    // Validate date
    if (!workDate) {
      hasErrors = true;
      dateInput?.classList.add('error');
      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message';
      errorMsg.textContent = 'נא לבחור תאריך';
      dateInput?.parentElement.appendChild(errorMsg);
    }

    // Validate minutes
    if (!workMinutes || workMinutes <= 0) {
      hasErrors = true;
      minutesInput?.classList.add('error');
      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message';
      errorMsg.textContent = 'נא להזין מספר דקות תקין';
      minutesInput?.parentElement.appendChild(errorMsg);
    }

    // Validate description
    let workDescription = '';
    if (guidedInput) {
      const validation = guidedInput.validate();
      if (!validation.valid) {
        hasErrors = true;
        // Add visual error styling to the textarea only (not the suggestions)
        const guidedTextarea = document.querySelector('.guided-textarea');
        if (guidedTextarea) {
          guidedTextarea.classList.add('error');
        }
        // Add error message below the input
        const guidedInputWrapper = document.querySelector('.guided-input-wrapper');
        if (guidedInputWrapper && !guidedInputWrapper.querySelector('.error-message')) {
          const errorMsg = document.createElement('span');
          errorMsg.className = 'error-message';
          errorMsg.textContent = 'נא למלא תיאור';
          guidedInputWrapper.appendChild(errorMsg);
        }
      } else {
        workDescription = guidedInput.getValue();
        // Remove error styling if valid
        const guidedTextarea = document.querySelector('.guided-textarea');
        if (guidedTextarea) {
          guidedTextarea.classList.remove('error');
        }
      }
    } else {
      // Fallback to old method
      workDescription = document.getElementById('workDescription')?.value?.trim();
      if (!workDescription) {
        hasErrors = true;
        const descInput = document.getElementById('workDescription');
        descInput?.classList.add('error');
        const errorMsg = document.createElement('span');
        errorMsg.className = 'error-message';
        errorMsg.textContent = 'נא להזין תיאור';
        descInput?.parentElement.appendChild(errorMsg);
      }
    }

    // If any errors, show notification and stop
    if (hasErrors) {
      this.showNotification('נא למלא את כל השדות הנדרשים', 'error');
      return;
    }

    // Save to recent items if using GuidedTextInput
    if (guidedInput) {
      guidedInput.saveToRecent();
    }

    // Direct call to Cloud Function - clean and simple with NotificationMessages
    const msgs = window.NotificationMessages.tasks;

    await ActionFlowManager.execute({
      operationKey: `submitTimeEntry_${taskId}`,
      ...msgs.loading.addTime(),
      action: async () => {
        // Architecture v2.0 - FirebaseService with retry
        Logger.log('  🚀 [v2.0] Using FirebaseService.call for addTimeToTask');

        const result = await window.FirebaseService.call('addTimeToTask', {
          taskId,
          minutes: workMinutes,
          description: workDescription,
          date: workDate
        }, {
          retries: 3,
          timeout: 15000
        });

        if (!result.success) {
          throw buildErrorFromResult(result, 'שגיאה בהוספת זמן');
        }

        // Invalidate clients cache so loadData() fetches fresh from Firestore
        this.dataCache.invalidate('clients');

        // Reload all data (loadData() refreshes selectors automatically)
        await this.loadData();  // Loads clients + budgetTasks + timesheet + refreshes selectors
        this.filterBudgetTasks();

        // Emit EventBus event
        window.EventBus.emit('task:time-added', {
          taskId,
          clientId: task.clientId,
          clientName: task.clientName,
          minutes: workMinutes,
          description: workDescription,
          date: workDate,
          addedBy: this.currentUser
        });
        Logger.log('  🚀 [v2.0] EventBus: task:time-added emitted');
      },
      successMessage: msgs.success.timeAdded(workMinutes),
      errorMessage: msgs.error.updateFailed,
      closePopupOnSuccess: true,
      closeDelay: 500,
      onSuccess: () => {
        this.closeExpandedCard();
      }
    });
  }

  async submitTaskCompletion(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
return;
}

    const completionNotes = document.getElementById('completionNotes')?.value?.trim();

    // ✨ NEW: Get gap metadata from validation flow (if exists)
    const metadata = window._taskCompletionMetadata || {};

    // Use ActionFlowManager with auto-close popup and NotificationMessages
    const msgs = window.NotificationMessages.tasks;

    await ActionFlowManager.execute({
      operationKey: `submitTaskCompletion_${taskId}`,
      ...msgs.loading.complete(),
      action: async () => {
        // Architecture v2.0 - FirebaseService with retry
        Logger.log('  🚀 [v2.0] Using FirebaseService.call for completeTask');

        const result = await window.FirebaseService.call('completeTask', {
          taskId,
          completionNotes,
          // ✨ NEW: Pass gap metadata to server
          gapReason: metadata.gapReason || null,
          gapNotes: metadata.gapNotes || null
        }, {
          retries: 3,
          timeout: 15000
        });

        // Clear metadata after use
        delete window._taskCompletionMetadata;

        if (!result.success) {
          throw buildErrorFromResult(result, 'שגיאה בסיום משימה');
        }

        // Reload tasks
        this.budgetTasks = await (
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, BUDGET_TASKS_LOAD_LIMIT)
        );
        this.filterBudgetTasks();

        // Emit EventBus event
        window.EventBus.emit('task:completed', {
          taskId,
          clientId: task.clientId,
          clientName: task.clientName,
          completionNotes,
          completedBy: this.currentUser,
          estimatedMinutes: task.estimatedMinutes,
          actualMinutes: task.totalMinutesSpent || 0
        });
        Logger.log('  🚀 [v2.0] EventBus: task:completed emitted');
      },
      successMessage: null,  // ✅ No automatic success message - will show custom one in onSuccess
      errorMessage: msgs.error.completeFailed,
      closePopupOnSuccess: true,  // ✅ Auto-close popup
      closeDelay: 500,
      onSuccess: async () => {
        // Close expanded card if open
        this.closeExpandedCard();

        // ✅ החלפה אוטומטית לתצוגת משימות מושלמות
        await this.toggleTaskView('completed');
        this.showNotification(msgs.success.completed(task.clientName), 'success');
      }
    });
  }

  /**
   * 🆕 Phase 1: Submit budget adjustment
   */
  async submitBudgetAdjustment(taskId) {
    const newBudgetMinutes = parseInt(document.getElementById('newBudgetMinutes')?.value);
    const reason = document.getElementById('adjustReason')?.value?.trim();

    if (!newBudgetMinutes || newBudgetMinutes <= 0) {
      this.showNotification('אנא הזן תקציב תקין', 'error');
      return;
    }

    const msgs = window.NotificationMessages.tasks;

    await ActionFlowManager.execute({
      operationKey: `submitBudgetAdjustment_${taskId}`,
      ...msgs.loading.updateBudget(),
      action: async () => {
        // Architecture v2.0 - FirebaseService with retry
        Logger.log('  🚀 [v2.0] Using FirebaseService.call for adjustTaskBudget');

        const result = await window.FirebaseService.call('adjustTaskBudget', {
          taskId,
          newEstimate: newBudgetMinutes,
          reason
        }, {
          retries: 3,
          timeout: 10000
        });

        if (!result.success) {
          throw buildErrorFromResult(result, 'שגיאה בעדכון תקציב');
        }

        // Reload tasks
        this.budgetTasks = await (
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, BUDGET_TASKS_LOAD_LIMIT)
        );
        this.filterBudgetTasks();

        // Emit EventBus event
        const task = this.budgetTasks.find(t => t.id === taskId);
        window.EventBus.emit('task:budget-adjusted', {
          taskId,
          oldEstimate: task?.estimatedMinutes || 0,
          newEstimate: newBudgetMinutes,
          reason,
          adjustedBy: this.currentUser
        });
        Logger.log('  🚀 [v2.0] EventBus: task:budget-adjusted emitted');
      },
      successMessage: msgs.success.budgetUpdated(Math.round(newBudgetMinutes / 60 * 10) / 10),
      errorMessage: msgs.error.updateFailed,
      closePopupOnSuccess: true,
      closeDelay: 500
    });
  }

  /**
   * 🆕 Phase 1: Show adjust budget dialog (wrapper)
   */
  showAdjustBudgetDialog(taskId) {
    if (window.DialogsModule && window.DialogsModule.showAdjustBudgetDialog) {
      window.DialogsModule.showAdjustBudgetDialog(taskId, this);
    } else {
      console.error('DialogsModule not loaded');
    }
  }

  /* ========================================
     NOTIFICATIONS & UI FEEDBACK
     ======================================== */

  showNotification(message, type = 'info') {
    // Use NotificationSystem directly (not wrapper to avoid recursion)
    if (window.NotificationSystem) {
      window.NotificationSystem.show(message, type, 3000);
    } else {
      console.warn('⚠️ Notification system not loaded:', message);
    }
  }

  /* ========================================
     UTILITY METHODS
     ======================================== */

  // Expose utility functions
  safeText(text) {
    return CoreUtils.safeText(text);
  }

  formatDate(date) {
    return CoreUtils.formatDate(date);
  }

  formatDateTime(date) {
    return CoreUtils.formatDateTime(date);
  }
}


/* ========================================
   GLOBAL EXPORTS & INITIALIZATION
   ======================================== */

// Create and expose manager instance globally
const manager = new LawOfficeManager();
window.manager = manager;

// ✅ Cleanup on page unload - prevent memory leaks and Firebase quota waste
window.addEventListener('beforeunload', () => {
  console.log('🧹 Page unloading - cleaning up resources');
  manager.cleanup();
});

// ✅ Fallback for iOS Safari (doesn't support beforeunload reliably)
window.addEventListener('pagehide', () => {
  console.log('🧹 Page hiding - cleaning up resources');
  manager.cleanup();
});

// Expose notification systems globally
window.notificationBell = manager.notificationBell;
// window.notificationSystem already exists from notification-system.js (global instance)

// Expose navigation functions globally (for onclick handlers)
window.switchTab = Navigation.switchTab;
window.toggleNotifications = Navigation.toggleNotifications;
window.clearAllNotifications = Navigation.clearAllNotifications;
window.openSmartForm = Navigation.openSmartForm;
window.logout = Auth.logout;
window.confirmLogout = Auth.confirmLogout;
window.showLogin = Auth.showLogin;
window.showForgotPassword = Auth.showForgotPassword;
window.togglePasswordVisibility = Auth.togglePasswordVisibility;

// ✅ OLD client search functions removed - now using ClientCaseSelector component
// Old: window.searchClients, window.selectClient
// New: ClientCaseSelector component with unified client→case selection

// Expose utility functions globally
// ✅ showSimpleLoading, hideSimpleLoading removed - handled by backward compatibility wrapper in index.html
window.safeText = CoreUtils.safeText;

// ✅ Toggle timesheet client selector visibility based on internal activity checkbox
window.toggleTimesheetClientSelector = function(isInternal) {
  const selector = document.getElementById('timesheetClientCaseSelector');
  if (selector) {
    if (isInternal) {
      selector.style.display = 'none';
    } else {
      selector.style.display = '';
    }
  }
};
window.formatDate = CoreUtils.formatDate;
window.formatDateTime = CoreUtils.formatDateTime;
window.formatShort = CoreUtils.formatShort;

// Expose Firebase operations globally (for firebase-server-adapter.js)
// Store originals with special names so adapter can find them
window._firebase_loadClientsFromFirebase_ORIGINAL = FirebaseOps.loadClientsFromFirebase;
window._firebase_loadTimesheetFromFirebase_ORIGINAL = FirebaseOps.loadTimesheetFromFirebase;
window._firebase_loadBudgetTasksFromFirebase_ORIGINAL = FirebaseOps.loadBudgetTasksFromFirebase;
// ✅ saveClientToFirebase removed
window._firebase_saveTimesheetToFirebase_v2_ORIGINAL = FirebaseOps.saveTimesheetToFirebase_v2;  // ✅ ENTERPRISE v2.0
window._firebase_saveBudgetTaskToFirebase_ORIGINAL = FirebaseOps.saveBudgetTaskToFirebase;
window._firebase_updateTimesheetEntryFirebase_ORIGINAL = FirebaseOps.updateTimesheetEntryFirebase;

// 🆕 NEW: Keep originals for both old and new client hours functions
window._firebase_calculateClientHoursByCaseNumber_ORIGINAL = ClientHours.calculateClientHoursByCaseNumber;
window._firebase_updateClientHoursImmediatelyByCaseNumber_ORIGINAL = ClientHours.updateClientHoursImmediatelyByCaseNumber;

// 🔄 LEGACY: Keep originals for backward compatibility
window._firebase_calculateClientHoursAccurate_ORIGINAL = ClientHours.calculateClientHoursAccurate;
window._firebase_updateClientHoursImmediately_ORIGINAL = ClientHours.updateClientHoursImmediately;

window._firebase_addTimeToTaskFirebase_ORIGINAL = FirebaseOps.addTimeToTaskFirebase;
window._firebase_completeTaskFirebase_ORIGINAL = FirebaseOps.completeTaskFirebase;
window._firebase_extendTaskDeadlineFirebase_ORIGINAL = FirebaseOps.extendTaskDeadlineFirebase;

// Also expose normally (will be overridden by adapter if needed)
window.loadClientsFromFirebase = FirebaseOps.loadClientsFromFirebase;
window.loadTimesheetFromFirebase = FirebaseOps.loadTimesheetFromFirebase;
window.loadBudgetTasksFromFirebase = FirebaseOps.loadBudgetTasksFromFirebase;
// ✅ saveClientToFirebase removed
window.saveTimesheetToFirebase = FirebaseOps.saveTimesheetToFirebase_v2;  // ✅ v1 removed, using v2
window.saveTimesheetToFirebase_v2 = FirebaseOps.saveTimesheetToFirebase_v2;  // ✅ ENTERPRISE v2.0
window.saveBudgetTaskToFirebase = FirebaseOps.saveBudgetTaskToFirebase;
window.updateTimesheetEntryFirebase = FirebaseOps.updateTimesheetEntryFirebase;

// 🆕 NEW: caseNumber-based client hours functions (recommended)
window.calculateClientHoursByCaseNumber = ClientHours.calculateClientHoursByCaseNumber;
window.updateClientHoursImmediatelyByCaseNumber = ClientHours.updateClientHoursImmediatelyByCaseNumber;

// 🔄 LEGACY: clientName-based functions (backward compatibility)
window.updateClientHoursImmediately = ClientHours.updateClientHoursImmediately;
window.calculateClientHoursAccurate = ClientHours.calculateClientHoursAccurate;

window.addTimeToTaskFirebase = FirebaseOps.addTimeToTaskFirebase;
window.completeTaskFirebase = FirebaseOps.completeTaskFirebase;
window.extendTaskDeadlineFirebase = FirebaseOps.extendTaskDeadlineFirebase;

// Debug mode (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.debug = DebugTools;
  Logger.log('🐛 Debug tools enabled');
}

// ===== CRITICAL: Expose manager globally for HTML onclick handlers =====
window.manager = manager;
window.LawOfficeManager = LawOfficeManager;

// ✅ Global cache utilities for debugging
window.getCacheStats = () => {
  const stats = manager.dataCache.getStats();
  console.log('📊 Data Cache Statistics:');
  console.log('━'.repeat(50));
  console.log(`✅ Cache Hits: ${stats.hits}`);
  console.log(`❌ Cache Misses: ${stats.misses}`);
  console.log(`🔄 Background Revalidations: ${stats.revalidations}`);
  console.log(`⚠️  Errors: ${stats.errors}`);
  console.log(`📦 Cache Size: ${stats.size} entries`);
  console.log(`📈 Hit Rate: ${stats.hitRate}%`);
  console.log('━'.repeat(50));
  return stats;
};

window.clearCache = () => {
  const count = manager.dataCache.clear();
  console.log(`🗑️  Cache cleared: ${count} entries removed`);
  return count;
};

window.invalidateCache = (key) => {
  const found = manager.dataCache.invalidate(key);
  console.log(found ? `✅ Cache invalidated: ${key}` : `⚠️  Key not found: ${key}`);
  return found;
};

// ===== EventBus UI Listeners (Architecture v2.0) =====

/**
 * Initialize UI-related EventBus listeners
 * ✅ מאזין לאירועים ומעדכן UI אוטומטית
 */
function initializeUIListeners() {
  if (!window.EventBus) {
    console.warn('⚠️ EventBus not available - skipping UI listeners');
    return;
  }

  // 👂 Listen to system:data-loaded - הסתר spinner
  window.EventBus.on('system:data-loaded', (data) => {
    Logger.log('👂 [UI] system:data-loaded received - hiding spinner');
    window.hideSimpleLoading();
  });

  // 👂 Listen to system:error - הצג הודעת שגיאה
  window.EventBus.on('system:error', (data) => {
    Logger.log('👂 [UI] system:error received:', data.message);
    // ההודעה כבר מוצגת על ידי notification-system.js
    // כאן אפשר להוסיף UI נוסף (אייקון אדום, badge, וכו')
  });

  Logger.log('✅ UI EventBus listeners initialized (v2.0)');
}

// Initialize Sidebar Component (must run before manager.init → showLogin)
function initSidebar() {
  const sidebarRoot = document.getElementById('sidebarRoot');
  if (sidebarRoot) {
    const sidebar = new Sidebar(sidebarRoot);
    sidebar.init();
    window.sidebarInstance = sidebar;
    window.toggleSidebar = () => sidebar.toggle();
  }
}

// Initialize Beit Midrash Component (lazy — first visit only)
let beitMidrashInstance = null;

async function initBeitMidrash() {
  if (beitMidrashInstance) {
return;
}
  const root = document.getElementById('beitMidrashRoot');
  if (root) {
    beitMidrashInstance = new BeitMidrash(root);
    window.beitMidrashInstance = beitMidrashInstance;
    await beitMidrashInstance.init();
  }
}

window.initBeitMidrash = initBeitMidrash;

// Initialize listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSidebar(); // Sidebar first — auth needs #minimalSidebar
    Auth.initOAuthFeatureFlags(); // Apply feature flags
    initializeUIListeners();
    manager.init();
  });
} else {
  initSidebar(); // Sidebar first — auth needs #minimalSidebar
  Auth.initOAuthFeatureFlags(); // Apply feature flags
  initializeUIListeners();
  manager.init();
}

// Export for module usage
export default LawOfficeManager;
export { manager };

Logger.log('🎉 Law Office System v5.0.0 - Fully Modular - Ready');
