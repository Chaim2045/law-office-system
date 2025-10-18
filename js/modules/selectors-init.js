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
   * Initialize all client-case selectors
   */
  function initializeSelectors() {
    console.log('🎯 Initializing ClientCaseSelectors...');

    try {
      // Budget Task Selector
      if (document.getElementById('budgetClientCaseSelector')) {
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
      }

      // Timesheet Selector
      if (document.getElementById('timesheetClientCaseSelector')) {
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
      }

      console.log('🎉 All ClientCaseSelectors initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing ClientCaseSelectors:', error);
    }
  }

  /**
   * Get budget task form values using ClientCaseSelector
   * @returns {Object} Form values including client and case info
   */
  function getBudgetTaskValues() {
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
    getBudgetValues: getBudgetTaskValues,
    getTimesheetValues: getTimesheetValues,
    clearBudget: clearBudgetSelector,
    clearTimesheet: clearTimesheetSelector
  };

  console.log('✅ ClientCaseSelectorsManager ready');

})();
