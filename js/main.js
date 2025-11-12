/**
 * Law Office Management System - Main Entry Point
 * Unified module system that combines all functionality
 *
 * @version 5.1.7
 * @created 2025-10-15
 * @description Central orchestration of all system modules
 */

/* ========================================
   MODULE IMPORTS - Core System Components
   ======================================== */

// Core Utilities & State Management
import * as CoreUtils from './modules/core-utils.js';
import { DOMCache } from './modules/dom-cache.js';
import DataCache from './modules/data-cache.js';
import STATE_CONFIG from './config/state-config.js';

// Notification System
import { NotificationBellSystem } from './modules/notification-bell.js';
// NotificationSystem is available globally on window object

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

// Budget Tasks Module
import * as BudgetTasks from './modules/budget-tasks.js';

// Timesheet Module
import * as Timesheet from './modules/timesheet.js';

// Search & Filtering
import * as Search from './modules/search.js';

// UI Components
import * as UIComponents from './modules/ui-components.js';
import { ActionFlowManager } from './modules/ui-components.js';

// Debug Tools (Development Only)
import * as DebugTools from './modules/debug-tools.js';


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
    this.clients = [];
    this.budgetTasks = [];
    this.timesheetEntries = [];
    this.connectionStatus = 'unknown';

    // View State - ✅ Managed by STATE_CONFIG (config/state-config.js)
    // Session-only (resets on page load): taskFilter, timesheetFilter
    // Persisted (saved): budgetView, timesheetView, budgetSort, timesheetSort
    this.currentTaskFilter = STATE_CONFIG.getStateValue('taskFilter'); // ✅ Always 'active'
    this.currentTimesheetFilter = STATE_CONFIG.getStateValue('timesheetFilter'); // ✅ Always 'month'
    this.currentBudgetView = STATE_CONFIG.getStateValue('budgetView'); // ✅ Persisted
    this.currentTimesheetView = STATE_CONFIG.getStateValue('timesheetView'); // ✅ Persisted

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
    this.notificationBell = new NotificationBellSystem();
    this.clientValidation = new ClientValidation(this); // Pass 'this' as manager

    // Activity Logger & Task Actions (initialized after Firebase)
    this.activityLogger = null;
    this.taskActionsManager = null;

    // Integration Manager
    this.integrationManager = window.IntegrationManagerModule
      ? window.IntegrationManagerModule.create()
      : null;

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
    Logger.log('🚀 Initializing Law Office System...');

    // Setup event listeners (UI only)
    this.setupEventListeners();

    // 🛡️ המתן ל-Firebase Auth להיות מוכן
    Logger.log('⏳ Waiting for Firebase Auth...');
    const user = await this.waitForAuthReady();

    // טיפול בהתאם למצב authentication
    if (user) {
      await this.handleAuthenticatedUser(user);
    } else {
      this.showLogin();
    }

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

      const snapshot = await window.firebaseDB
        .collection('employees')
        .where('authUID', '==', user.uid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const employee = snapshot.docs[0].data();
        this.currentUser = employee.email; // ✅ EMAIL for queries
        this.currentUsername = employee.username || employee.name; // Username for display

        UIComponents.updateUserDisplay(this.currentUsername);

        // Load data and show app
        await this.loadData();
        this.showApp();
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

    Logger.log('✅ Manager cleanup completed');
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

  updateLoaderText(text) {
    Auth.updateLoaderText.call(this, text);
  }

  showApp() {
    Auth.showApp.call(this);
  }

  logout() {
    Auth.logout();
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
      this.updateLoaderText('טוען נתונים...');

      // Initialize Firebase
      FirebaseOps.initializeFirebase();

      // 🎯 אתחול CaseNumberGenerator (רק אחרי auth!)
      if (window.CaseNumberGenerator) {
        try {
          await window.CaseNumberGenerator.initialize();
        } catch (error) {
          Logger.log('⚠️ CaseNumberGenerator initialization failed:', error);
          // לא עוצרים את הטעינה בגלל זה
        }
      }

      // ✅ Load all data in parallel with smart caching
      // First load: Fetch from Firebase and cache
      // Second load (< 5 min): Return from cache immediately (fast!)
      // Third load (5-15 min): Return stale cache + refresh in background
      const [clients, budgetTasks, timesheetEntries] = await Promise.all([
        this.dataCache.get('clients', () => FirebaseOps.loadClientsFromFirebase()),
        this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`, () =>
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, 50)
        ),
        this.dataCache.get(`timesheetEntries:${this.currentUser}`, () =>
          this.integrationManager?.loadTimesheet(this.currentUser)
            || FirebaseOps.loadTimesheetFromFirebase(this.currentUser)
        )
      ]);

      this.clients = clients;
      this.budgetTasks = budgetTasks;
      this.timesheetEntries = timesheetEntries;

      // ✅ Expose to window for backward compatibility with old code
      window.clients = clients;
      window.cases = window.cases || []; // Use existing cases if already loaded by CasesModule
      window.budgetTasks = budgetTasks;
      window.timesheetEntries = timesheetEntries;
      window.lawOfficeManager = this;
      window.CoreUtils = CoreUtils; // Expose CoreUtils for date formatting, etc.

      this.updateLoaderText('מכין ממשק...');

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
      await this.updateTaskCountBadges();

      // 🔄 Update client validation and selectors (for old system)
      if (this.clientValidation) {
        this.clientValidation.updateBlockedClients();
      }

      // 🔄 Refresh all active client-case selectors with fresh data
      await this.refreshAllClientCaseSelectors();

      // 🔄 Refresh CasesModule if it has a current case open
      if (window.CasesModule && typeof window.CasesModule.refreshCurrentCase === 'function') {
        await window.CasesModule.refreshCurrentCase();
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

      Logger.log(`✅ Data loaded: ${clients.length} clients, ${budgetTasks.length} tasks, ${timesheetEntries.length} entries`);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      this.showNotification('שגיאה בטעינת נתונים', 'error');
      throw error;
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
    const description = document.getElementById('budgetDescription')?.value?.trim();
    const descriptionCategory = document.getElementById('budgetDescriptionCategory')?.value || null;
    const estimatedMinutes = parseInt(document.getElementById('estimatedTime')?.value);
    const deadline = document.getElementById('budgetDeadline')?.value;

    // ✅ Get category name for display purposes
    let categoryName = null;
    if (descriptionCategory && window.WorkCategories) {
      const cat = window.WorkCategories.getCategoryById(descriptionCategory);
      categoryName = cat?.name || null;
    }

    if (!description || description.length < 3) {
      this.showNotification('חובה להזין תיאור משימה (לפחות 3 תווים)', 'error');
      return;
    }

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

      // ✅ NEW: Use ActionFlowManager for consistent UX
      await ActionFlowManager.execute({
        loadingMessage: 'שומר משימה...',
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
            status: 'active',
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
            throw new Error(result.error || 'Failed to create budget task');
          }

          // Emit EventBus event
          window.EventBus.emit('task:created', {
            taskId: result.data?.taskId || 'unknown',
            clientId: taskData.clientId,
            clientName: taskData.clientName,
            employee: taskData.employee,
            originalEstimate: taskData.estimatedMinutes
          });
          Logger.log('  🚀 [v2.0] EventBus: task:created emitted');

          // ✅ Invalidate cache to force fresh data on next load (all filters)
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:active`);
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:completed`);
          this.dataCache.invalidate(`budgetTasks:${this.currentUser}:all`);

          // Reload tasks with cache (will fetch fresh because invalidated)
          this.budgetTasks = await this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`, () =>
            this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
              || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, 50)
          );
          this.filterBudgetTasks();
        },
        successMessage: 'המשימה נוספה בהצלחה',
        errorMessage: 'שגיאה בהוספת משימה',
        onSuccess: () => {
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

    // ✅ budgetTasks is already filtered by server-side (active/completed/all)
    // So we just search within these pre-filtered tasks
    // No need to filter again - prevents double filtering and potential mixing
    this.filteredBudgetTasks = this.budgetTasks.filter(task => {
      return (
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

      // ✅ עדכון ה-labels (iOS toggle)
      const activeLabel = document.getElementById('activeLabel');
      const completedLabel = document.getElementById('completedLabel');
      const toggleCheckbox = document.getElementById('taskViewToggle');

      if (activeLabel && completedLabel) {
        if (viewMode === 'active') {
          activeLabel.classList.add('active');
          completedLabel.classList.remove('active');
          if (toggleCheckbox) {
toggleCheckbox.checked = false;
}
        } else {
          activeLabel.classList.remove('active');
          completedLabel.classList.add('active');
          if (toggleCheckbox) {
toggleCheckbox.checked = true;
}
        }
      }

      // ✅ טעינה מהשרת עם הסינון הנכון + cache update
      // Invalidate old cache first
      this.dataCache.invalidate(`budgetTasks:${this.currentUser}:${viewMode}`);

      // Load with cache (will fetch fresh because invalidated)
      const loadedTasks = await this.dataCache.get(
        `budgetTasks:${this.currentUser}:${viewMode}`,
        () => BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, viewMode, 50)
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
    const activeLabel = document.getElementById('activeLabel');
    const completedLabel = document.getElementById('completedLabel');
    const toggleCheckbox = document.getElementById('taskViewToggle');

    if (!activeLabel || !completedLabel || !toggleCheckbox) {
      return; // Elements not ready yet
    }

    // ✅ Update UI to match currentTaskFilter
    if (this.currentTaskFilter === 'completed') {
      activeLabel.classList.remove('active');
      completedLabel.classList.add('active');
      toggleCheckbox.checked = true;
    } else {
      activeLabel.classList.add('active');
      completedLabel.classList.remove('active');
      toggleCheckbox.checked = false;
    }

    Logger.log(`✅ Toggle state synced: ${this.currentTaskFilter}`);
  }

  /**
   * ✅ Filter budget tasks - ensures filteredBudgetTasks is always synced with budgetTasks
   * CRITICAL: Must always update to prevent mixing of active/completed tasks
   */
  async filterBudgetTasks() {
    // ✅ ALWAYS sync filteredBudgetTasks with budgetTasks
    // This prevents completed tasks from appearing in active view and vice versa
    this.filteredBudgetTasks = [...this.budgetTasks];
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
   */
  async updateTaskCountBadges() {
    try {
      // טעינה מהירה של שני הסוגים לספירה
      const [activeTasks, completedTasks] = await Promise.all([
        BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, 'active', 50),
        BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, 'completed', 50)
      ]);

      // עדכון המונה של פעילות
      const activeBadge = document.getElementById('activeCountBadge');
      if (activeBadge) {
        activeBadge.textContent = activeTasks.length;
        activeBadge.style.display = activeTasks.length > 0 ? 'inline-flex' : 'none';
      }

      // עדכון המונה של מושלמות
      const completedBadge = document.getElementById('completedCountBadge');
      if (completedBadge) {
        completedBadge.textContent = completedTasks.length;
        completedBadge.style.display = completedTasks.length > 0 ? 'inline-flex' : 'none';
      }
    } catch (error) {
      console.error('Error updating count badges:', error);
    }
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
      paginationStatus: null, // Will be added when pagination is implemented
      taskActionsManager: this.taskActionsManager
    };

    if (this.currentBudgetView === 'cards') {
      BudgetTasks.renderBudgetCards(this.filteredBudgetTasks, options);
    } else {
      BudgetTasks.renderBudgetTable(this.filteredBudgetTasks, options);
    }
  }

  switchBudgetView(view) {
    // ✅ Save user preference (persisted)
    STATE_CONFIG.setStateValue('budgetView', view);
    this.currentBudgetView = view;

    // Update view tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
      if (tab.dataset.view === view) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.renderBudgetView();
  }

  /* ========================================
     TIMESHEET MANAGEMENT
     ======================================== */

  async addTimesheetEntry() {
    // ✅ This form is now ONLY for internal activities
    // Time tracking on clients is done automatically through tasks

    // Validate form fields
    const date = document.getElementById('actionDate')?.value;

    const minutes = parseInt(document.getElementById('actionMinutes')?.value);
    const action = document.getElementById('actionDescription')?.value?.trim();
    const notes = document.getElementById('actionNotes')?.value?.trim();

    if (!date) {
      this.showNotification('חובה לבחור תאריך', 'error');
      return;
    }

    if (!minutes || minutes < 1) {
      this.showNotification('חובה להזין זמן בדקות', 'error');
      return;
    }

    if (!action || action.length < 3) {
      this.showNotification('חובה להזין תיאור פעולה (לפחות 3 תווים)', 'error');
      return;
    }

    // Use ActionFlowManager for consistent UX
    await ActionFlowManager.execute({
      loadingMessage: 'שומר פעילות פנימית...',
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

        // Architecture v2.0 - FirebaseService with retry
        Logger.log('  🚀 [v2.0] Using FirebaseService.call for createTimesheetEntry');

        const result = await window.FirebaseService.call('createTimesheetEntry', entryData, {
          retries: 3,
          timeout: 15000
        });

        if (!result.success) {
          throw new Error(result.error || 'שגיאה ברישום פעילות');
        }

        // Invalidate cache to force fresh data on next load
        this.dataCache.invalidate(`timesheetEntries:${this.currentUser}`);

        // Reload entries with cache (will fetch fresh because invalidated)
        this.timesheetEntries = await this.dataCache.get(`timesheetEntries:${this.currentUser}`, () =>
          this.integrationManager?.loadTimesheet(this.currentUser)
            || FirebaseOps.loadTimesheetFromFirebase(this.currentUser)
        );
        this.filterTimesheetEntries();

        // Emit EventBus event
        window.EventBus.emit('timesheet:entry-created', {
          entryId: result.data?.entryId || 'unknown',
          date,
          minutes,
          action,
          notes,
          employee: this.currentUser,
          isInternal: true
        });
        Logger.log('  🚀 [v2.0] EventBus: timesheet:entry-created emitted');
      },
      successMessage: '✅ הפעילות הפנימית נרשמה בהצלחה',
      errorMessage: 'שגיאה ברישום פעילות',
      onSuccess: () => {
        // Clear form and hide
        Forms.clearTimesheetForm(this);
        document.getElementById('timesheetFormContainer')?.classList.add('hidden');

        // Remove active class from plus button
        const plusButton = document.getElementById('smartPlusBtn');
        if (plusButton) {
plusButton.classList.remove('active');
}
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

  renderTimesheetView() {
    // Calculate statistics on ALL entries (not filtered) to show total counts
    const stats = window.StatisticsModule
      ? window.StatisticsModule.calculateTimesheetStatistics(this.timesheetEntries)
      : {
          totalMinutes: Timesheet.getTotalMinutes(this.filteredTimesheetEntries),
          totalHours: Math.round((Timesheet.getTotalMinutes(this.filteredTimesheetEntries) / 60) * 10) / 10,
          totalEntries: this.filteredTimesheetEntries.length
        };

    const paginationStatus = {
      currentPage: this.currentTimesheetPage,
      totalPages: Math.ceil(this.filteredTimesheetEntries.length / 20),
      hasMore: false,
      displayedItems: this.filteredTimesheetEntries.length,
      filteredItems: this.filteredTimesheetEntries.length
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
      <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
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

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    let historyHtml = '';
    if (task.history?.length > 0) {
      historyHtml = task.history
        .map(
          (entry) => `
        <div class="history-entry">
          <div class="history-header">
            <span class="history-date">${CoreUtils.formatDate(entry.date)}</span>
            <span class="history-minutes">${entry.minutes} דקות</span>
          </div>
          <div class="history-description">${CoreUtils.safeText(
            entry.description || ''
          )}</div>
          <div class="history-timestamp">נוסף ב: ${CoreUtils.safeText(
            entry.timestamp || ''
          )}</div>
        </div>
      `
        )
        .join('');
    } else {
      historyHtml =
        '<div style="text-align: center; color: #6b7280; padding: 40px;">אין היסטוריה עדיין</div>';
    }

    overlay.innerHTML = `
      <div class="popup" style="max-width: 600px;">
        <div class="popup-header">
          <i class="fas fa-history"></i>
          היסטוריית זמנים - ${CoreUtils.safeText(task.clientName || '')}
        </div>
        <div class="popup-content">
          <div class="task-summary">
            <h4>${CoreUtils.safeText(task.description || '')}</h4>
            <p>סה"כ זמן: ${task.actualMinutes || 0} דקות מתוך ${
      task.estimatedMinutes || 0
    }</p>
          </div>
          <div class="history-container">
            ${historyHtml}
          </div>
        </div>
        <div class="popup-buttons" style="justify-content: flex-start;">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> סגור
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  showExtendDeadlineDialog(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification('המשימה לא נמצאה', 'error');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

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

    overlay.innerHTML = `
      <div class="popup" style="max-width: 500px;">
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
          <div class="form-group">
            <label for="newDeadlineDate">תאריך יעד חדש:</label>
            <input type="date" id="newDeadlineDate" value="${defaultDateValue}" required>
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
  }

  async submitDeadlineExtension(taskId) {
    const newDate = document.getElementById('newDeadlineDate')?.value;
    const reason = document.getElementById('extensionReason')?.value?.trim();

    if (!newDate || !reason) {
      this.showNotification('אנא מלא את כל השדות', 'error');
      return;
    }

    // Use ActionFlowManager with auto-close popup
    await ActionFlowManager.execute({
      loadingMessage: 'מאריך תאריך יעד...',
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
          throw new Error(result.error || 'שגיאה בהארכת יעד');
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
      successMessage: 'תאריך היעד הוארך בהצלחה',
      errorMessage: 'שגיאה בהארכת יעד',
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

  async submitTimeEntry(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
return;
}

    const workDate = document.getElementById('workDate')?.value;
    const workMinutes = parseInt(document.getElementById('workMinutes')?.value);
    const workDescription = document.getElementById('workDescription')?.value?.trim();

    if (!workDate || !workMinutes || !workDescription) {
      this.showNotification('נא למלא את כל השדות', 'error');
      return;
    }

    // Direct call to Cloud Function - clean and simple
    await ActionFlowManager.execute({
      loadingMessage: 'שומר זמן...',
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
          throw new Error(result.error || 'שגיאה בהוספת זמן');
        }

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
      successMessage: '✅ הזמן נוסף למשימה ונרשם בשעתון',
      errorMessage: 'שגיאה בהוספת זמן',
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

    // Use ActionFlowManager with auto-close popup
    await ActionFlowManager.execute({
      loadingMessage: 'משלים משימה...',
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
          throw new Error(result.error || 'שגיאה בסיום משימה');
        }

        // Reload tasks
        this.budgetTasks = await (
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, 50)
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
      errorMessage: 'שגיאה בסיום משימה',
      closePopupOnSuccess: true,  // ✅ Auto-close popup
      closeDelay: 500,
      onSuccess: async () => {
        // Close expanded card if open
        this.closeExpandedCard();

        // ✅ החלפה אוטומטית לתצוגת משימות מושלמות
        await this.toggleTaskView('completed');
        this.showNotification('המשימה הושלמה ועברה לתצוגת "הושלמו" ✓', 'success');
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

    await ActionFlowManager.execute({
      loadingMessage: 'מעדכן תקציב...',
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
          throw new Error(result.error || 'שגיאה בעדכון תקציב');
        }

        // Reload tasks
        this.budgetTasks = await (
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, 50)
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
      successMessage: `תקציב עודכן בהצלחה ל-${Math.round(newBudgetMinutes / 60 * 10) / 10} שעות`,
      errorMessage: 'שגיאה בעדכון תקציב',
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
window._firebase_saveTimesheetToFirebase_ORIGINAL = FirebaseOps.saveTimesheetToFirebase;
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
window.saveTimesheetToFirebase = FirebaseOps.saveTimesheetToFirebase;
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

// Initialize listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeUIListeners();
    manager.init();
  });
} else {
  initializeUIListeners();
  manager.init();
}

// Export for module usage
export default LawOfficeManager;
export { manager };

Logger.log('🎉 Law Office System v5.0.0 - Fully Modular - Ready');
