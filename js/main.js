/**
 * Law Office Management System - Main Entry Point
 * Unified module system that combines all functionality
 *
 * @version 5.0.0
 * @created 2025-10-15
 * @description Central orchestration of all system modules
 */

/* ========================================
   MODULE IMPORTS - Core System Components
   ======================================== */

// Core Utilities & State Management
import * as CoreUtils from './modules/core-utils.js';
import { DOMCache } from './modules/dom-cache.js';

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
    this.connectionStatus = "unknown";

    // View State
    this.currentTaskFilter = "active"; // Show only active tasks by default (completed tasks hidden)
    this.currentTimesheetFilter = "month";
    this.currentBudgetView = "cards";
    this.currentTimesheetView = "table";

    // Filtered Data
    this.filteredBudgetTasks = [];
    this.filteredTimesheetEntries = [];

    // Sorting State
    this.budgetSortField = null;
    this.budgetSortDirection = "asc";
    this.timesheetSortField = null;
    this.timesheetSortDirection = "asc";
    this.currentBudgetSort = "recent";
    this.currentTimesheetSort = "recent";

    // Pagination State
    this.currentBudgetPage = 1;
    this.currentTimesheetPage = 1;
    this.budgetPagination = window.PaginationModule?.create({ pageSize: 20 });
    this.timesheetPagination = window.PaginationModule?.create({ pageSize: 20 });

    // Welcome Screen Timing
    this.welcomeScreenStartTime = null;

    // Module Instances
    this.domCache = new DOMCache();
    this.notificationBell = new NotificationBellSystem();
    this.clientValidation = new ClientValidation();

    // Activity Logger & Task Actions (initialized after Firebase)
    this.activityLogger = null;
    this.taskActionsManager = null;

    // Integration Manager
    this.integrationManager = window.IntegrationManagerModule
      ? window.IntegrationManagerModule.create()
      : null;

    console.log('✅ LawOfficeManager initialized');
  }

  /* ========================================
     INITIALIZATION & LIFECYCLE
     ======================================== */

  /**
   * Initialize the application
   */
  init() {
    console.log('🚀 Initializing Law Office System...');

    // Setup Firebase Auth listener
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        await this.handleAuthenticatedUser(user);
      } else {
        this.showLogin();
      }
    });

    // Setup event listeners
    this.setupEventListeners();

    console.log('✅ System initialized');
  }

  /**
   * Handle authenticated user
   */
  async handleAuthenticatedUser(user) {
    try {
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
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await Auth.handleLogin.call(this);
      });
    }

    // Budget form
    const budgetForm = document.getElementById("budgetForm");
    if (budgetForm) {
      budgetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addBudgetTask();
      });
    }

    // Timesheet form
    const timesheetForm = document.getElementById("timesheetForm");
    if (timesheetForm) {
      timesheetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addTimesheetEntry();
      });
    }

    // ✅ Client form removed - now handled by CasesManager

    // Set default action date
    const actionDate = document.getElementById("actionDate");
    if (actionDate) {
      actionDate.value = new Date().toISOString().split("T")[0];
    }

    console.log('✅ Event listeners configured');
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

    console.log('✅ Manager cleanup completed');
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
   */
  async loadData() {
    try {
      this.updateLoaderText('טוען נתונים...');

      // Initialize Firebase
      FirebaseOps.initializeFirebase();

      // Load all data in parallel
      const [clients, budgetTasks, timesheetEntries] = await Promise.all([
        FirebaseOps.loadClientsFromFirebase(),
        FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser),
        FirebaseOps.loadTimesheetFromFirebase(this.currentUser)
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
        console.log('✅ TaskActionsManager initialized');
      }

      // Initialize ActivityLogger if available
      if (window.ActivityLoggerModule && !this.activityLogger) {
        this.activityLogger = window.ActivityLoggerModule.create();
        console.log('✅ ActivityLogger initialized');
      }

      // Apply filters and render
      this.filterBudgetTasks();
      this.filterTimesheetEntries();

      // Update notifications bell with urgent tasks and critical clients
      if (this.notificationBell) {
        const urgentTasks = budgetTasks.filter(task => {
          if (task.status === 'הושלם') return false;
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

      console.log(`✅ Data loaded: ${clients.length} clients, ${budgetTasks.length} tasks, ${timesheetEntries.length} entries`);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      this.showNotification('שגיאה בטעינת נתונים', 'error');
      throw error;
    }
  }

  /**
   * Reload data from Firebase
   */
  async loadDataFromFirebase() {
    window.showSimpleLoading('טוען נתונים מחדש...');

    try {
      await this.loadData();
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
    // ✅ NEW: Get values from ClientCaseSelector
    const selectorValues = window.ClientCaseSelectorsManager?.getBudgetValues();

    if (!selectorValues) {
      this.showNotification('חובה לבחור לקוח ותיק', 'error');
      return;
    }

    // Validate other form fields
    const description = document.getElementById("budgetDescription")?.value?.trim();
    const estimatedMinutes = parseInt(document.getElementById("estimatedTime")?.value);
    const deadline = document.getElementById("budgetDeadline")?.value;

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

    // ✅ NEW: Use ActionFlowManager for consistent UX
    await ActionFlowManager.execute({
      loadingMessage: 'שומר משימה...',
      action: async () => {
        const taskData = {
          description: description,
          clientName: selectorValues.clientName,
          clientId: selectorValues.clientId,
          caseId: selectorValues.caseId,
          caseNumber: selectorValues.caseNumber,
          caseTitle: selectorValues.caseTitle,
          estimatedMinutes: estimatedMinutes,
          deadline: deadline,
          employee: this.currentUser,
          status: 'active',
          timeSpent: 0,
          timeEntries: [],
          createdAt: new Date()
        };

        console.log('📝 Creating budget task with data:', taskData);

        await FirebaseOps.saveBudgetTaskToFirebase(taskData);

        // Reload tasks
        this.budgetTasks = await FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser);
        this.filterBudgetTasks();
      },
      successMessage: 'המשימה נוספה בהצלחה',
      errorMessage: 'שגיאה בהוספת משימה',
      onSuccess: () => {
        // Clear form and hide
        Forms.clearBudgetForm(this);
        document.getElementById("budgetFormContainer")?.classList.add("hidden");

        // Remove active class from plus button
        const plusButton = document.getElementById("smartPlusBtn");
        if (plusButton) plusButton.classList.remove("active");

        // Clear selector
        window.ClientCaseSelectorsManager?.clearBudget();
      }
    });
  }

  filterBudgetTasks() {
    // Get current filter value from the select element
    const filterSelect = document.getElementById('taskFilter');
    if (filterSelect) {
      this.currentTaskFilter = filterSelect.value;
    }

    const filterValue = this.currentTaskFilter;
    this.filteredBudgetTasks = Search.filterBudgetTasks(this.budgetTasks, filterValue);
    this.renderBudgetView();
  }

  sortBudgetTasks(event) {
    // Get value from event or direct value (backward compatibility)
    const sortValue = event?.target?.value || event;
    this.currentBudgetSort = sortValue;
    this.filteredBudgetTasks = Search.sortBudgetTasks(this.filteredBudgetTasks, sortValue);
    this.renderBudgetView();
  }

  renderBudgetView() {
    // Calculate statistics on ALL tasks (not filtered) to show total counts
    const stats = window.StatisticsModule
      ? window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks)
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
    // Get checkbox state first
    const isInternal = document.getElementById("isInternalActivity")?.checked || false;

    // ✅ NEW: Get values from ClientCaseSelector (only required if NOT internal activity)
    const selectorValues = window.ClientCaseSelectorsManager?.getTimesheetValues();

    if (!isInternal && !selectorValues) {
      this.showNotification('חובה לבחור לקוח ותיק או לסמן פעילות פנימית', 'error');
      return;
    }

    // Validate other form fields
    const date = document.getElementById("actionDate")?.value;
    const minutes = parseInt(document.getElementById("actionMinutes")?.value);
    const action = document.getElementById("actionDescription")?.value?.trim();
    const notes = document.getElementById("actionNotes")?.value?.trim();

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

    // ✅ NEW: Use ActionFlowManager for consistent UX
    await ActionFlowManager.execute({
      loadingMessage: 'שומר רשומה...',
      action: async () => {
        const entryData = {
          date: date,
          minutes: minutes,
          clientName: isInternal ? null : selectorValues.clientName,
          clientId: isInternal ? null : selectorValues.clientId,
          fileNumber: isInternal ? null : selectorValues.caseNumber, // caseNumber used as fileNumber
          caseId: isInternal ? null : selectorValues.caseId,
          caseTitle: isInternal ? null : selectorValues.caseTitle,
          action: action,
          notes: notes,
          employee: this.currentUser,
          isInternal: isInternal, // ✅ NEW: Internal activity flag
          createdAt: new Date()
        };

        console.log('📝 Creating timesheet entry with data:', entryData);

        await FirebaseOps.saveTimesheetToFirebase(entryData);

        // Reload entries
        this.timesheetEntries = await FirebaseOps.loadTimesheetFromFirebase(this.currentUser);
        this.filterTimesheetEntries();
      },
      successMessage: 'הרשומה נוספה בהצלחה',
      errorMessage: 'שגיאה בהוספת רשומה',
      onSuccess: () => {
        // Clear form and hide
        Forms.clearTimesheetForm(this);
        document.getElementById("timesheetFormContainer")?.classList.add("hidden");

        // Remove active class from plus button
        const plusButton = document.getElementById("smartPlusBtn");
        if (plusButton) plusButton.classList.remove("active");

        // Clear selector
        window.ClientCaseSelectorsManager?.clearTimesheet();
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
    const task = this.filteredBudgetTasks.find((t) => t.id == taskId);
    if (!task) return;

    this.showExpandedCard(task);
  }

  showExpandedCard(task) {
    // Calculate simple progress
    let progress = 0;
    if (task.estimatedMinutes && task.estimatedMinutes > 0) {
      progress = Math.round(((task.actualMinutes || 0) / task.estimatedMinutes) * 100);
      progress = Math.min(progress, 100);
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

    document.body.insertAdjacentHTML("beforeend", expandedContent);

    setTimeout(() => {
      const overlay = document.querySelector(".linear-expanded-overlay");
      if (overlay) {
        overlay.classList.add("active");
      }
    }, 10);
  }

  closeExpandedCard() {
    const overlay = document.querySelector(".linear-expanded-overlay");
    if (overlay) {
      overlay.classList.remove("active");
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

    // ✅ NEW: Use ActionFlowManager with auto-close popup
    await ActionFlowManager.execute({
      loadingMessage: 'מאריך תאריך יעד...',
      action: async () => {
        // Call Firebase Function
        await window.extendTaskDeadlineFirebase(taskId, newDate, reason);

        // Reload tasks
        await this.loadData();
        this.filterBudgetTasks();
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

    window.DialogsModule.showTaskCompletionModal(task, this);
  }

  async submitTimeEntry(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) return;

    const workDate = document.getElementById('workDate')?.value;
    const workMinutes = parseInt(document.getElementById('workMinutes')?.value);
    const workDescription = document.getElementById('workDescription')?.value?.trim();

    if (!workDate || !workMinutes || !workDescription) {
      this.showNotification('נא למלא את כל השדות', 'error');
      return;
    }

    // ✅ קריאה ישירה ל-Cloud Function - קוד נקי ופשוט
    await ActionFlowManager.execute({
      loadingMessage: 'שומר זמן...',
      action: async () => {
        // קריאה ל-Cloud Function שמטפלת בהכל אטומית
        await window.addTimeToTaskFirebase(taskId, workMinutes, workDescription, workDate);

        // טעינה מחדש של משימות
        this.budgetTasks = await FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser);
        this.filterBudgetTasks();
      },
      successMessage: 'הזמן נוסף בהצלחה',
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
    if (!task) return;

    const completionNotes = document.getElementById('completionNotes')?.value?.trim();

    // ✅ NEW: Use ActionFlowManager with auto-close popup
    await ActionFlowManager.execute({
      loadingMessage: 'משלים משימה...',
      action: async () => {
        // Update task status
        task.status = 'הושלם';
        task.completedAt = new Date();
        task.completionNotes = completionNotes;

        await FirebaseOps.saveBudgetTaskToFirebase(task);

        // Reload tasks
        this.budgetTasks = await FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser);
        this.filterBudgetTasks();
      },
      successMessage: 'המשימה הושלמה בהצלחה',
      errorMessage: 'שגיאה בסיום משימה',
      closePopupOnSuccess: true,  // ✅ Auto-close popup
      closeDelay: 500,
      onSuccess: () => {
        // Close expanded card if open
        this.closeExpandedCard();
      }
    });
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
window._firebase_saveBudgetTaskToFirebase_ORIGINAL = FirebaseOps.saveBudgetTaskToFirebase;
window._firebase_updateTimesheetEntryFirebase_ORIGINAL = FirebaseOps.updateTimesheetEntryFirebase;
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
window.saveBudgetTaskToFirebase = FirebaseOps.saveBudgetTaskToFirebase;
window.updateTimesheetEntryFirebase = FirebaseOps.updateTimesheetEntryFirebase;
window.updateClientHoursImmediately = ClientHours.updateClientHoursImmediately;
window.addTimeToTaskFirebase = FirebaseOps.addTimeToTaskFirebase;
window.completeTaskFirebase = FirebaseOps.completeTaskFirebase;
window.extendTaskDeadlineFirebase = FirebaseOps.extendTaskDeadlineFirebase;

// Debug mode (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.debug = DebugTools;
  console.log('🐛 Debug tools enabled');
}

// ===== CRITICAL: Expose manager globally for HTML onclick handlers =====
window.manager = manager;
window.LawOfficeManager = LawOfficeManager;

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    manager.init();
  });
} else {
  manager.init();
}

// Export for module usage
export default LawOfficeManager;
export { manager };

console.log('🎉 Law Office System v5.0.0 - Fully Modular - Ready');
