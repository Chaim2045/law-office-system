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

// Firebase Operations
import * as FirebaseOps from './modules/firebase-operations.js';

// Authentication & User Management
import * as Auth from './modules/authentication.js';

// Navigation & UI Controls
import * as Navigation from './modules/navigation.js';

// Client Management
import * as Clients from './modules/clients.js';
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
    this.currentUser = null;
    this.clients = [];
    this.budgetTasks = [];
    this.timesheetEntries = [];
    this.connectionStatus = "unknown";

    // View State
    this.currentTaskFilter = "active";
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
        this.currentUser = employee.username || employee.name;

        UIComponents.updateUserDisplay(this.currentUser);

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

    // Client form
    const clientForm = document.getElementById("clientForm");
    if (clientForm) {
      clientForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.createClient();
      });
    }

    // Client type radio buttons
    document.querySelectorAll('input[name="clientType"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        this.updateClientTypeDisplay();
      });
    });

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
    CoreUtils.showSimpleLoading('טוען נתונים מחדש...');

    try {
      await this.loadData();
      this.showNotification('הנתונים עודכנו בהצלחה', 'success');
    } catch (error) {
      this.showNotification('שגיאה בטעינת נתונים', 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
  }

  /* ========================================
     CLIENT MANAGEMENT
     ======================================== */

  async createClient() {
    const clientName = document.getElementById("clientName")?.value?.trim();
    const fileNumber = document.getElementById("fileNumberInput")?.value?.trim();
    const description = document.getElementById("clientDescription")?.value?.trim();
    const clientType = document.querySelector('input[name="clientType"]:checked')?.value;
    const hoursAmount = document.getElementById("hoursAmount")?.value;

    // Validation
    if (!clientName || !fileNumber) {
      this.showNotification('נא למלא את כל השדות הנדרשים', 'error');
      return;
    }

    // Check if client already exists
    const existingClient = this.clients.find(
      c => c.fileNumber === fileNumber || c.fullName === clientName
    );

    if (existingClient) {
      this.showNotification('לקוח או מספר תיק כבר קיימים במערכת', 'error');
      return;
    }

    try {
      CoreUtils.showSimpleLoading('יוצר לקוח...');

      const clientData = {
        fullName: clientName,
        clientName: clientName,
        fileNumber: fileNumber,
        description: description || '',
        type: clientType || 'hours',
        hoursRemaining: clientType === 'hours' ? parseInt(hoursAmount) : null,
        totalHours: clientType === 'hours' ? parseInt(hoursAmount) : null,
        stages: clientType === 'fixed' ? {
          stage1: false,
          stage2: false,
          stage3: false
        } : null,
        createdAt: new Date(),
        createdBy: this.currentUser
      };

      await FirebaseOps.saveClientToFirebase(clientData);

      // Reload clients
      this.clients = await FirebaseOps.loadClientsFromFirebase();

      this.showNotification('לקוח נוסף בהצלחה', 'success');

      // Clear form and hide
      document.getElementById("clientForm")?.reset();
      Clients.hideClientForm();

    } catch (error) {
      console.error('❌ Error creating client:', error);
      this.showNotification('שגיאה ביצירת לקוח: ' + error.message, 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
  }

  updateClientTypeDisplay() {
    Clients.updateClientTypeDisplay();
  }

  /* ========================================
     BUDGET TASKS MANAGEMENT
     ======================================== */

  async addBudgetTask() {
    // Validate form
    const validation = Forms.validateBudgetTaskForm(this);
    if (!validation.isValid) {
      Forms.showValidationErrors(this, validation.errors);
      return;
    }

    try {
      CoreUtils.showSimpleLoading('שומר משימה...');

      const taskData = {
        description: document.getElementById("budgetDescription")?.value?.trim(),
        clientName: document.getElementById("budgetClientSelect")?.value,
        branch: document.getElementById("budgetBranch")?.value,
        estimatedMinutes: parseInt(document.getElementById("estimatedTime")?.value),
        deadline: document.getElementById("budgetDeadline")?.value,
        employee: this.currentUser,
        status: 'active',
        timeSpent: 0,
        timeEntries: [],
        createdAt: new Date(),
        // ✅ NEW: Include case data if available
        caseId: document.getElementById("budgetCaseId")?.value || null,
        caseTitle: document.getElementById("budgetCaseTitle")?.value || null
      };

      await FirebaseOps.saveBudgetTaskToFirebase(taskData);

      // Reload tasks
      this.budgetTasks = await FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser);
      this.filterBudgetTasks();

      this.showNotification('משימה נוספה בהצלחה', 'success');

      // Clear form and hide
      Forms.clearBudgetForm(this);
      document.getElementById("budgetFormContainer")?.classList.add("hidden");

      // ✅ NEW: Clear case container
      const caseContainer = document.getElementById("budgetCaseContainer");
      if (caseContainer) {
        caseContainer.innerHTML = '';
        caseContainer.style.display = 'none';
      }

    } catch (error) {
      console.error('❌ Error adding budget task:', error);
      this.showNotification('שגיאה בהוספת משימה: ' + error.message, 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
  }

  filterBudgetTasks() {
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
    // Calculate statistics
    const stats = window.StatisticsModule
      ? window.StatisticsModule.calculateBudgetStatistics(this.filteredBudgetTasks)
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
    try {
      CoreUtils.showSimpleLoading('שומר רשומה...');

      const entryData = {
        date: document.getElementById("actionDate")?.value,
        minutes: parseInt(document.getElementById("actionMinutes")?.value),
        clientName: document.getElementById("timesheetClientSelect")?.value,
        fileNumber: document.getElementById("fileNumber")?.value,
        action: document.getElementById("actionDescription")?.value?.trim(),
        notes: document.getElementById("actionNotes")?.value?.trim(),
        employee: this.currentUser,
        createdAt: new Date(),
        // ✅ NEW: Include case data if available
        caseId: document.getElementById("timesheetCaseId")?.value || null,
        caseTitle: document.getElementById("timesheetCaseTitle")?.value || null
      };

      await FirebaseOps.saveTimesheetToFirebase(entryData);

      // Reload entries
      this.timesheetEntries = await FirebaseOps.loadTimesheetFromFirebase(this.currentUser);
      this.filterTimesheetEntries();

      this.showNotification('רשומה נוספה בהצלחה', 'success');

      // Clear form and hide
      Forms.clearTimesheetForm(this);
      document.getElementById("timesheetFormContainer")?.classList.add("hidden");

      // ✅ NEW: Clear case container
      const caseContainer = document.getElementById("timesheetCaseContainer");
      if (caseContainer) {
        caseContainer.innerHTML = '';
        caseContainer.style.display = 'none';
      }

    } catch (error) {
      console.error('❌ Error adding timesheet entry:', error);
      this.showNotification('שגיאה בהוספת רשומה: ' + error.message, 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
  }

  filterTimesheetEntries() {
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
    const stats = {
      totalMinutes: Timesheet.getTotalMinutes(this.filteredTimesheetEntries),
      totalEntries: this.filteredTimesheetEntries.length
    };

    const paginationStatus = {
      currentPage: this.currentTimesheetPage,
      totalPages: Math.ceil(this.filteredTimesheetEntries.length / 20)
    };

    if (this.currentTimesheetView === 'cards') {
      Timesheet.renderTimesheetCards(
        this.filteredTimesheetEntries,
        stats,
        paginationStatus,
        this.currentTimesheetSort
      );
    } else {
      Timesheet.renderTimesheetTable(
        this.filteredTimesheetEntries,
        stats,
        paginationStatus,
        this.currentTimesheetSort
      );
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

    // תיקון: בדיקה שתאריך היעד תקף
    let currentDeadline = new Date(task.deadline);
    if (isNaN(currentDeadline.getTime())) {
      // אם התאריך לא תקין, השתמש בתאריך נוכחי
      currentDeadline = new Date();
      console.warn('⚠️ task.deadline is invalid, using current date');
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

    try {
      CoreUtils.showSimpleLoading('מאריך תאריך יעד...');

      // Call Firebase Function
      await window.extendTaskDeadlineFirebase(taskId, newDate, reason);

      // Reload tasks
      await this.loadDataFromFirebase();

      this.showNotification('תאריך היעד הוארך בהצלחה', 'success');

      // Close popup
      document.querySelector('.popup-overlay')?.remove();

    } catch (error) {
      console.error('Error extending deadline:', error);
      this.showNotification('שגיאה בהארכת יעד: ' + error.message, 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
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

    try {
      CoreUtils.showSimpleLoading('שומר זמן...');

      console.log('📝 submitTimeEntry - Before update:', {
        taskId: task.id,
        oldActualMinutes: task.actualMinutes,
        addingMinutes: workMinutes,
        oldTimeEntries: task.timeEntries?.length || 0
      });

      // Update task with new time entry
      task.timeEntries = task.timeEntries || [];
      task.timeEntries.push({
        date: workDate,
        minutes: workMinutes,
        description: workDescription,
        addedAt: new Date()
      });

      task.actualMinutes = (task.actualMinutes || 0) + workMinutes;

      console.log('📝 submitTimeEntry - After update:', {
        taskId: task.id,
        newActualMinutes: task.actualMinutes,
        newTimeEntriesCount: task.timeEntries.length,
        callingFunction: 'FirebaseOps.saveBudgetTaskToFirebase'
      });

      await FirebaseOps.saveBudgetTaskToFirebase(task);

      console.log('✅ submitTimeEntry - Save completed successfully');

      // Reload tasks
      this.budgetTasks = await FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser);
      this.filterBudgetTasks();

      this.showNotification('הזמן נוסף בהצלחה', 'success');

      // Close dialog
      document.querySelector('.popup-overlay')?.remove();

      // Close expanded card to show updated data in cards view
      this.closeExpandedCard();

    } catch (error) {
      console.error('❌ Error adding time:', error);
      this.showNotification('שגיאה בהוספת זמן: ' + error.message, 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
  }

  async submitTaskCompletion(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) return;

    const completionNotes = document.getElementById('completionNotes')?.value?.trim();

    try {
      CoreUtils.showSimpleLoading('משלים משימה...');

      // Update task status
      task.status = 'הושלם';
      task.completedAt = new Date();
      task.completionNotes = completionNotes;

      await FirebaseOps.saveBudgetTaskToFirebase(task);

      // Reload tasks
      this.budgetTasks = await FirebaseOps.loadBudgetTasksFromFirebase(this.currentUser);
      this.filterBudgetTasks();

      this.showNotification('המשימה הושלמה בהצלחה', 'success');

      // Close dialog
      document.querySelector('.popup-overlay')?.remove();

      // Close expanded card if open
      this.closeExpandedCard();

    } catch (error) {
      console.error('❌ Error completing task:', error);
      this.showNotification('שגיאה בסיום משימה: ' + error.message, 'error');
    } finally {
      CoreUtils.hideSimpleLoading();
    }
  }

  /* ========================================
     NOTIFICATIONS & UI FEEDBACK
     ======================================== */

  showNotification(message, type = 'info') {
    UIComponents.showNotification(message, type);
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

// Expose notification bell globally
window.notificationBell = manager.notificationBell;

// Expose navigation functions globally (for onclick handlers)
window.switchTab = Navigation.switchTab;
window.toggleNotifications = Navigation.toggleNotifications;
window.clearAllNotifications = Navigation.clearAllNotifications;
window.openSmartForm = Navigation.openSmartForm;
window.logout = Auth.logout;
window.confirmLogout = Auth.confirmLogout;

// Expose client functions globally
window.searchClients = Clients.searchClients;
window.selectClient = Clients.selectClient;
window.showClientForm = Clients.showClientForm;
window.hideClientForm = Clients.hideClientForm;

// Expose utility functions globally
window.showSimpleLoading = CoreUtils.showSimpleLoading;
window.hideSimpleLoading = CoreUtils.hideSimpleLoading;
window.safeText = CoreUtils.safeText;
window.formatDate = CoreUtils.formatDate;
window.formatDateTime = CoreUtils.formatDateTime;
window.formatShort = CoreUtils.formatShort;

// Expose Firebase operations globally (for firebase-server-adapter.js)
// Store originals with special names so adapter can find them
window._firebase_loadClientsFromFirebase_ORIGINAL = FirebaseOps.loadClientsFromFirebase;
window._firebase_loadTimesheetFromFirebase_ORIGINAL = FirebaseOps.loadTimesheetFromFirebase;
window._firebase_loadBudgetTasksFromFirebase_ORIGINAL = FirebaseOps.loadBudgetTasksFromFirebase;
window._firebase_saveClientToFirebase_ORIGINAL = FirebaseOps.saveClientToFirebase;
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
window.saveClientToFirebase = FirebaseOps.saveClientToFirebase;
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
