/**
 * Client-Case Selectors Initialization
 * Creates and manages ClientCaseSelector instances for budget and timesheet forms
 *
 * @version 1.0.0
 * @created 2025-10-18
 */

(function() {
  'use strict';

  // Global selectors storage
  window.clientCaseSelectors = window.clientCaseSelectors || {};

  /**
   * Initialize budget selector (lazy initialization)
   */
  function initializeBudgetSelector() {
    // Check if already initialized
    if (window.clientCaseSelectors.budget) {
      // ✅ Re-render if container is empty (form was hidden and reopened)
      const container = document.getElementById('budgetClientCaseSelector');
      if (container && container.innerHTML.length === 0) {
        window.clientCaseSelectors.budget.render();
        window.clientCaseSelectors.budget.attachEventListeners();
      }
      // ✅ ALWAYS clear/reset when reopening the form
      Logger.log('🔄 Clearing budget selector...');
      window.clientCaseSelectors.budget.clear();
      return;
    }

    try {
      const container = document.getElementById('budgetClientCaseSelector');
      if (!container) {
        console.error('❌ Budget container not found');
        return;
      }

      // Create immediately - no setTimeout needed
      window.clientCaseSelectors.budget = new ClientCaseSelector('budgetClientCaseSelector', {
        required: true,
        showOnlyActive: true
        // ✅ Callbacks removed - using EventBus listeners instead (v2.0)
      });

    } catch (error) {
      console.error('❌ Error initializing Budget selector:', error);
    }
  }

  /**
   * Initialize timesheet selector (lazy initialization)
   */
  function initializeTimesheetSelector() {
    // Check if already initialized
    if (window.clientCaseSelectors.timesheet) {
      // ✅ Re-render if container is empty (form was hidden and reopened)
      const container = document.getElementById('timesheetClientCaseSelector');
      if (container && container.innerHTML.length === 0) {
        window.clientCaseSelectors.timesheet.render();
        window.clientCaseSelectors.timesheet.attachEventListeners();
      }
      // ✅ ALWAYS clear/reset when reopening the form
      Logger.log('🔄 Clearing timesheet selector...');
      window.clientCaseSelectors.timesheet.clear();
      return;
    }

    try {
      const container = document.getElementById('timesheetClientCaseSelector');
      if (!container) {
        console.error('❌ Timesheet container not found');
        return;
      }

      // Create immediately - no setTimeout needed
      window.clientCaseSelectors.timesheet = new ClientCaseSelector('timesheetClientCaseSelector', {
        required: true,
        showOnlyActive: true
        // ✅ Callbacks removed - using EventBus listeners instead (v2.0)
      });

    } catch (error) {
      console.error('❌ Error initializing Timesheet selector:', error);
    }
  }

  /**
   * Initialize EventBus listeners for client/case selection
   * ✅ Architecture v2.0 - Event-Driven
   */
  function initializeEventListeners() {
    if (!window.EventBus) {
      console.warn('⚠️ EventBus not available - skipping listener initialization');
      return;
    }

    // 👂 Listen to client:selected event
    window.EventBus.on('client:selected', (data) => {
      Logger.log(`👂 [EventBus] client:selected received:`, data);

      // Auto-fill file number in timesheet form
      const fileNumberInput = document.getElementById('fileNumber');
      if (fileNumberInput && data.clientId) {
        // מצא את הלקוח ב-cache כדי לקבל את fileNumber
        const clientsCache = window.LawOfficeManager?.clientsCache || [];
        const client = clientsCache.find(c => c.id === data.clientId);

        if (client && client.fileNumber) {
          fileNumberInput.value = client.fileNumber;
          Logger.log(`  ✅ Auto-filled fileNumber: ${client.fileNumber}`);
        }
      }
    });

    // 👂 Listen to case:selected event
    window.EventBus.on('case:selected', (data) => {
      Logger.log(`👂 [EventBus] case:selected received:`, data);
      // כאן אפשר להוסיף לוגיקה נוספת כשתיק נבחר
    });

    Logger.log('✅ EventBus listeners initialized (v2.0)');
  }

  /**
   * Initialize all client-case selectors (calls lazy initializers)
   */
  function initializeSelectors() {
    Logger.log('🎯 Setting up ClientCaseSelectors (lazy initialization)...');

    // Initialize EventBus listeners
    initializeEventListeners();

    // Selectors will be initialized when forms are first opened
    // This prevents issues with hidden forms
    Logger.log('✅ ClientCaseSelectors ready for lazy initialization');
  }

  /**
   * Get budget task form values using ClientCaseSelector
   * @returns {Object} Form values including client and case info
   */
  function getBudgetTaskValues() {
    // Lazy initialization - create selector if not exists
    if (!window.clientCaseSelectors.budget) {
      initializeBudgetSelector();
    }

    const selector = window.clientCaseSelectors.budget;
    if (!selector) {
      console.error('❌ Budget selector not initialized');
      return null;
    }

    const validation = selector.validate();
    if (!validation.isValid) {
      console.error('❌ Budget selector validation failed:', validation.error);
      return null;
    }

    return selector.getSelectedValues();
  }

  /**
   * Get timesheet entry values using ClientCaseSelector
   * @returns {Object} Form values including client and case info
   */
  function getTimesheetValues() {
    // Lazy initialization - create selector if not exists
    if (!window.clientCaseSelectors.timesheet) {
      initializeTimesheetSelector();
    }

    const selector = window.clientCaseSelectors.timesheet;
    if (!selector) {
      console.error('❌ Timesheet selector not initialized');
      return null;
    }

    const validation = selector.validate();
    if (!validation.isValid) {
      console.error('❌ Timesheet selector validation failed:', validation.error);
      return null;
    }

    return selector.getSelectedValues();
  }

  /**
   * Clear budget selector
   */
  function clearBudgetSelector() {
    const selector = window.clientCaseSelectors.budget;
    if (selector) {
      selector.clear();
    }
  }

  /**
   * Clear timesheet selector
   */
  function clearTimesheetSelector() {
    const selector = window.clientCaseSelectors.timesheet;
    if (selector) {
      selector.clear();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSelectors);
  } else {
    // DOM already ready, initialize immediately
    initializeSelectors();
  }

  // Export globally
  window.ClientCaseSelectorsManager = {
    initialize: initializeSelectors,
    initializeBudget: initializeBudgetSelector,      // ✅ NEW: Manual budget init
    initializeTimesheet: initializeTimesheetSelector, // ✅ NEW: Manual timesheet init
    getBudgetValues: getBudgetTaskValues,
    getTimesheetValues: getTimesheetValues,
    clearBudget: clearBudgetSelector,
    clearTimesheet: clearTimesheetSelector
  };

  Logger.log('✅ ClientCaseSelectorsManager ready (lazy initialization enabled)');

})();
