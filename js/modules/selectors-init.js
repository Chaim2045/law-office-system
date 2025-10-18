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
      console.log('✅ Budget selector already initialized');
      return;
    }

    console.log('🎯 Initializing Budget ClientCaseSelector...');

    try {
      const container = document.getElementById('budgetClientCaseSelector');
      if (!container) {
        console.error('❌ Budget container not found');
        return;
      }

      window.clientCaseSelectors.budget = new ClientCaseSelector('budgetClientCaseSelector', {
        required: true,
        showOnlyActive: true,
        onClientSelected: (client) => {
          console.log('✅ Budget: Client selected:', client.fullName);
        },
        onCaseSelected: (caseData) => {
          console.log('✅ Budget: Case selected:', caseData.caseTitle);
        }
      });

      console.log('✅ Budget ClientCaseSelector initialized');
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
      console.log('✅ Timesheet selector already initialized');
      return;
    }

    console.log('🎯 Initializing Timesheet ClientCaseSelector...');

    try {
      const container = document.getElementById('timesheetClientCaseSelector');
      if (!container) {
        console.error('❌ Timesheet container not found');
        return;
      }

      window.clientCaseSelectors.timesheet = new ClientCaseSelector('timesheetClientCaseSelector', {
        required: true,
        showOnlyActive: true,
        onClientSelected: (client) => {
          console.log('✅ Timesheet: Client selected:', client.fullName);

          // Auto-fill file number (backward compatibility)
          const fileNumberInput = document.getElementById('fileNumber');
          if (fileNumberInput && client.fileNumber) {
            fileNumberInput.value = client.fileNumber;
          }
        },
        onCaseSelected: (caseData) => {
          console.log('✅ Timesheet: Case selected:', caseData.caseTitle);
        }
      });

      console.log('✅ Timesheet ClientCaseSelector initialized');
    } catch (error) {
      console.error('❌ Error initializing Timesheet selector:', error);
    }
  }

  /**
   * Initialize all client-case selectors (calls lazy initializers)
   */
  function initializeSelectors() {
    console.log('🎯 Setting up ClientCaseSelectors (lazy initialization)...');
    // Selectors will be initialized when forms are first opened
    // This prevents issues with hidden forms
    console.log('✅ ClientCaseSelectors ready for lazy initialization');
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

  console.log('✅ ClientCaseSelectorsManager ready (lazy initialization enabled)');

})();
