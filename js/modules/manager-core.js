/**
 * Manager Core Module - LawOfficeManager Core Functionality
 * Extracted from script.js
 * Handles: constructor, init, cleanup, setupEventListeners, switchTab, logout
 *
 * @module ManagerCore
 * @version 1.0.0
 */

(function (window) {
  'use strict';

  /**
   * LawOfficeManager - Core Class
   * Manages the main application lifecycle and core functionality
   */
  class LawOfficeManagerCore {
    constructor() {
      this.currentUser = null;
      this.clients = [];
      this.budgetTasks = [];
      this.timesheetEntries = [];
      this.connectionStatus = "unknown";
      this.currentTaskFilter = "active";
      this.currentTimesheetFilter = "month";
      this.currentBudgetView = "cards";
      this.currentTimesheetView = "table";
      this.filteredBudgetTasks = [];
      this.filteredTimesheetEntries = [];
      this.budgetSortField = null;
      this.budgetSortDirection = "asc";
      this.timesheetSortField = null;
      this.timesheetSortDirection = "asc";
      this.currentBudgetSort = "recent";
      this.currentTimesheetSort = "recent";

      // Initialize Pagination Managers
      this.budgetPagination = window.PaginationModule?.create({ pageSize: 20 });
      this.timesheetPagination = window.PaginationModule?.create({ pageSize: 20 });

      // Initialize Activity Logger
      this.activityLogger = null; // Will be initialized after Firebase setup
      this.taskActionsManager = null; // Will be initialized after module loads

      // Initialize Integration Manager
      this.integrationManager = window.IntegrationManagerModule
        ? window.IntegrationManagerModule.create()
        : null;

      this.currentBudgetPage = 1;
      this.currentTimesheetPage = 1;
      this.clientValidation = null; // Will be initialized if ClientValidation class exists
      this.welcomeScreenStartTime = null; // Track welcome screen duration
    }

    /**
     * Initialize the application
     * Sets up Firebase authentication listener and event listeners
     */
    init() {
      // Check if user is already logged in
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          // User is logged in - load their profile
          try {
            const snapshot = await window.firebaseDB
              .collection('employees')
              .where('authUID', '==', user.uid)
              .limit(1)
              .get();

            if (!snapshot.empty) {
              const employee = snapshot.docs[0].data();
              this.currentUser = employee.username || employee.name;

              if (typeof updateUserDisplay === 'function') {
                updateUserDisplay(this.currentUser);
              }

              // Load data and show app
              if (this.loadData && typeof this.loadData === 'function') {
                await this.loadData();
              }
              this.showApp();
            } else {
              // User not found in employees - sign out
              await firebase.auth().signOut();
              this.showLogin();
            }
          } catch (error) {
            console.error('Error loading user profile:', error);
            this.showLogin();
          }
        } else {
          // User not logged in - show login screen
          this.showLogin();
        }
      });

      this.setupEventListeners();
    }

    /**
     * Set up event listeners for forms and UI elements
     */
    setupEventListeners() {
      // Login form
      const loginForm = document.getElementById("loginForm");
      if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (this.handleLogin && typeof this.handleLogin === 'function') {
            await this.handleLogin();
          }
        });
      }

      // Budget form
      const budgetForm = document.getElementById("budgetForm");
      if (budgetForm) {
        budgetForm.addEventListener("submit", (e) => {
          e.preventDefault();
          if (this.addBudgetTask && typeof this.addBudgetTask === 'function') {
            this.addBudgetTask();
          }
        });
      }

      // Timesheet form
      const timesheetForm = document.getElementById("timesheetForm");
      if (timesheetForm) {
        timesheetForm.addEventListener("submit", (e) => {
          e.preventDefault();
          if (this.addTimesheetEntry && typeof this.addTimesheetEntry === 'function') {
            this.addTimesheetEntry();
          }
        });
      }

      // Client form
      const clientForm = document.getElementById("clientForm");
      if (clientForm) {
        clientForm.addEventListener("submit", (e) => {
          e.preventDefault();
          if (this.createClient && typeof this.createClient === 'function') {
            this.createClient();
          }
        });
      }

      // Client type radio buttons
      document.querySelectorAll('input[name="clientType"]').forEach((radio) => {
        radio.addEventListener("change", () => {
          if (this.updateClientTypeDisplay && typeof this.updateClientTypeDisplay === 'function') {
            this.updateClientTypeDisplay();
          }
        });
      });

      // Timesheet client select
      const timesheetClientSelect = document.getElementById("timesheetClientSelect");
      if (timesheetClientSelect) {
        timesheetClientSelect.addEventListener("change", (e) => {
          const selectedClient = this.clients.find(
            (c) => c.fullName === e.target.value
          );
          const fileNumberField = document.getElementById("fileNumber");
          if (selectedClient && fileNumberField) {
            fileNumberField.value = selectedClient.fileNumber;
          } else if (fileNumberField) {
            fileNumberField.value = "";
          }
        });
      }

      // Set default action date
      const actionDate = document.getElementById("actionDate");
      if (actionDate) {
        actionDate.value = new Date().toISOString().split("T")[0];
      }

      // Setup table sorting
      if (this.setupTableSorting && typeof this.setupTableSorting === 'function') {
        this.setupTableSorting();
      }
    }

    /**
     * Set up table sorting event listeners
     */
    setupTableSorting() {
      document.addEventListener("click", (e) => {
        if (e.target.closest("#budgetTable th.sortable")) {
          const th = e.target.closest("th");
          const sortField = th.dataset.sort;
          if (this.sortBudgetTable && typeof this.sortBudgetTable === 'function') {
            this.sortBudgetTable(sortField);
          }
        }

        if (e.target.closest("#timesheetTable th.sortable")) {
          const th = e.target.closest("th");
          const sortField = th.dataset.sort;
          if (this.sortTimesheetTable && typeof this.sortTimesheetTable === 'function') {
            this.sortTimesheetTable(sortField);
          }
        }
      });
    }

    /**
     * Show login screen
     */
    showLogin() {
      const loginSection = document.getElementById("loginSection");
      const appContent = document.getElementById("appContent");
      const minimalSidebar = document.getElementById("minimalSidebar");
      const interfaceElements = document.getElementById("interfaceElements");
      const mainFooter = document.getElementById("mainFooter");
      const bubblesContainer = document.getElementById("bubblesContainer");

      if (loginSection) loginSection.classList.remove("hidden");
      if (appContent) appContent.classList.add("hidden");
      if (minimalSidebar) minimalSidebar.classList.add("hidden");
      if (interfaceElements) interfaceElements.classList.add("hidden");
      if (mainFooter) mainFooter.classList.add("hidden");
      if (bubblesContainer) bubblesContainer.classList.remove("hidden");

      // Remove class from body when logged out
      document.body.classList.remove("logged-in");
    }

    /**
     * Show main application
     */
    showApp() {
      const loginSection = document.getElementById("loginSection");
      const welcomeScreen = document.getElementById("welcomeScreen");
      const appContent = document.getElementById("appContent");
      const interfaceElements = document.getElementById("interfaceElements");
      const minimalSidebar = document.getElementById("minimalSidebar");
      const mainFooter = document.getElementById("mainFooter");
      const bubblesContainer = document.getElementById("bubblesContainer");

      if (loginSection) loginSection.classList.add("hidden");
      if (welcomeScreen) welcomeScreen.classList.add("hidden");
      if (appContent) appContent.classList.remove("hidden");
      if (interfaceElements) interfaceElements.classList.remove("hidden");
      if (minimalSidebar) minimalSidebar.classList.remove("hidden");
      if (mainFooter) mainFooter.classList.remove("hidden");
      if (bubblesContainer) bubblesContainer.classList.add("hidden");

      // Add class to body when logged in
      document.body.classList.add("logged-in");

      const userInfo = document.getElementById("userInfo");
      if (userInfo) {
        userInfo.innerHTML = `
        <span>שלום ${this.currentUser}</span>
        <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
      `;
        userInfo.classList.remove("hidden");
      }

      setTimeout(() => {
        if (typeof updateSidebarUser === 'function') {
          updateSidebarUser(this.currentUser);
        }
      }, 500);
    }

    /**
     * Cleanup method - removes event listeners and clears resources
     * Currently implements basic cleanup, can be extended
     */
    cleanup() {
      // Clear intervals if any
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }

      // Cleanup notification bell system if it exists
      if (window.notificationBell?.cleanup) {
        window.notificationBell.cleanup();
      }

      console.log('Manager cleanup completed');
    }
  }

  /**
   * Standalone function: Switch between tabs
   * @param {string} tabName - The name of the tab to switch to
   */
  function switchTab(tabName) {
    const budgetFormContainer = document.getElementById("budgetFormContainer");
    const timesheetFormContainer = document.getElementById("timesheetFormContainer");

    if (budgetFormContainer) budgetFormContainer.classList.add("hidden");
    if (timesheetFormContainer) timesheetFormContainer.classList.add("hidden");

    const plusButton = document.getElementById("smartPlusBtn");
    if (plusButton) {
      plusButton.classList.remove("active");
    }

    // Remove active from all buttons and contents
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.classList.remove("active");
    });

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // Add active to the correct button and content
    if (tabName === "budget") {
      const budgetTab = document.getElementById("budgetTab");
      if (budgetTab) budgetTab.classList.add("active");

      // Add active to budget button
      document.querySelectorAll('.tab-button[onclick*="budget"]').forEach(btn => {
        btn.classList.add("active");
      });
    } else if (tabName === "timesheet") {
      const timesheetTab = document.getElementById("timesheetTab");
      if (timesheetTab) timesheetTab.classList.add("active");

      // Add active to timesheet button
      document.querySelectorAll('.tab-button[onclick*="timesheet"]').forEach(btn => {
        btn.classList.add("active");
      });

      const dateField = document.getElementById("actionDate");
      if (dateField) {
        dateField.value = new Date().toISOString().split("T")[0];
      }
    } else if (tabName === "reports") {
      const reportsTab = document.getElementById("reportsTab");
      if (reportsTab) reportsTab.classList.add("active");

      // Add active to reports button
      document.querySelectorAll('.tab-button[onclick*="reports"], .nav-item[onclick*="reports"]').forEach(btn => {
        btn.classList.add("active");
      });

      // Hide plus button in reports tab - not relevant
      if (plusButton) {
        plusButton.style.display = 'none';
      }

      // Initialize reports form on first load
      if (typeof manager !== 'undefined' && manager.initReportsForm) {
        manager.initReportsForm();
      }
    }

    // Show plus button in other tabs
    if (tabName !== 'reports' && plusButton) {
      plusButton.style.display = '';
      plusButton.style.visibility = 'visible';
      plusButton.style.opacity = '1';
    }

    if (typeof window.currentActiveTab !== 'undefined') {
      window.currentActiveTab = tabName;
    }
  }

  /**
   * Standalone function: Show logout confirmation dialog
   */
  function logout() {
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.innerHTML = `
    <div class="popup" style="max-width: 450px;">
      <div class="popup-header" style="color: #dc2626;">
        <i class="fas fa-power-off"></i>
        יציאה מהמערכת
      </div>
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
        <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">
          האם אתה בטוח שברצונך לצאת?
        </h3>
        <p style="color: #6b7280; font-size: 16px;">
          כל הנתונים שלא נשמרו יאבדו.
        </p>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
        <button class="popup-btn popup-btn-confirm" onclick="confirmLogout()">
          <i class="fas fa-check"></i> כן, צא מהמערכת
        </button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);
  }

  /**
   * Standalone function: Confirm and execute logout
   */
  async function confirmLogout() {
    const interfaceElements = document.getElementById("interfaceElements");
    if (interfaceElements) interfaceElements.classList.add("hidden");

    if (window.manager) {
      window.manager.showNotification("מתנתק מהמערכת... להתראות! 👋", "info");
    }

    // Track logout in Firebase
    if (window.UserTracker) {
      await window.UserTracker.trackLogout();
    }

    // Sign out from Firebase Auth
    await firebase.auth().signOut();

    // Reload page - Auth State Listener will detect logout and show login screen
    setTimeout(() => location.reload(), 1500);
  }

  // Export to window
  window.ManagerCore = {
    LawOfficeManagerCore,
    switchTab,
    logout,
    confirmLogout
  };

  // Also export functions globally for backward compatibility
  window.switchTab = switchTab;
  window.logout = logout;
  window.confirmLogout = confirmLogout;

  console.log('✓ Manager Core module loaded');

})(window);
