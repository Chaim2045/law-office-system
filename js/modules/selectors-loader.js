/**
 * Selectors Loader - Smart Loading System
 * מערכת טעינה חכמה עם fallback למצב ישן
 *
 * @version 1.0.0
 * @created 2025-10-19
 */

(function() {
  'use strict';

  // ===============================
  // Configuration
  // ===============================

  const CONFIG = {
    USE_NEW_SELECTORS: true, // Feature flag - set to false to disable
    DEBUG: true, // Show detailed logs
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 100
  };

  // ===============================
  // Selector Manager
  // ===============================

  class SelectorsManager {
    constructor() {
      this.instances = {
        budget: null,
        timesheet: null
      };
      this.initialized = false;
      this.useModernSelector = CONFIG.USE_NEW_SELECTORS && !!window.ModernClientCaseSelector;

      this.log('✅ SelectorsManager created', {
        useModernSelector: this.useModernSelector,
        hasModernClass: !!window.ModernClientCaseSelector
      });
    }

    log(...args) {
      if (CONFIG.DEBUG) {
        console.log('[SelectorsManager]', ...args);
      }
    }

    error(...args) {
      console.error('[SelectorsManager]', ...args);
    }

    /**
     * Initialize budget selector (lazy)
     */
    initializeBudget() {
      this.log('🎯 Initializing budget selector...');

      try {
        const container = document.getElementById('budgetClientCaseSelector');

        if (!container) {
          this.error('❌ Budget container not found');
          return false;
        }

        // Check if already initialized and visible
        if (this.instances.budget && container.innerHTML.length > 0) {
          this.log('ℹ️ Budget selector already initialized');
          return true;
        }

        // Use modern selector if available
        if (this.useModernSelector) {
          this.log('✨ Using ModernClientCaseSelector for budget');
          this.instances.budget = new window.ModernClientCaseSelector('budgetClientCaseSelector', {
            placeholder: 'חפש לקוח...',
            casePlaceholder: 'בחר תיק...',
            showOnlyActive: true,
            required: true
          });

          const rendered = this.instances.budget.render();
          if (rendered) {
            // Store instance globally for onclick handlers
            window[`modernSelectorInstance_${this.instances.budget.uniqueId}`] = this.instances.budget;
            this.log('✅ Budget selector initialized successfully');
            return true;
          } else {
            this.error('❌ Failed to render budget selector');
            return false;
          }
        } else {
          this.log('⚠️ Modern selector not available - using fallback (old system)');
          // Old system continues to work as-is
          return true;
        }
      } catch (error) {
        this.error('❌ Error initializing budget selector:', error);
        return false;
      }
    }

    /**
     * Initialize timesheet selector (lazy)
     */
    initializeTimesheet() {
      this.log('🎯 Initializing timesheet selector...');

      try {
        const container = document.getElementById('timesheetClientCaseSelector');

        if (!container) {
          this.error('❌ Timesheet container not found');
          return false;
        }

        // Check if already initialized and visible
        if (this.instances.timesheet && container.innerHTML.length > 0) {
          this.log('ℹ️ Timesheet selector already initialized');
          return true;
        }

        // Use modern selector if available
        if (this.useModernSelector) {
          this.log('✨ Using ModernClientCaseSelector for timesheet');
          this.instances.timesheet = new window.ModernClientCaseSelector('timesheetClientCaseSelector', {
            placeholder: 'חפש לקוח...',
            casePlaceholder: 'בחר תיק...',
            showOnlyActive: true,
            required: true
          });

          const rendered = this.instances.timesheet.render();
          if (rendered) {
            // Store instance globally for onclick handlers
            window[`modernSelectorInstance_${this.instances.timesheet.uniqueId}`] = this.instances.timesheet;
            this.log('✅ Timesheet selector initialized successfully');
            return true;
          } else {
            this.error('❌ Failed to render timesheet selector');
            return false;
          }
        } else {
          this.log('⚠️ Modern selector not available - using fallback (old system)');
          // Old system continues to work as-is
          return true;
        }
      } catch (error) {
        this.error('❌ Error initializing timesheet selector:', error);
        return false;
      }
    }

    /**
     * Get budget values
     */
    getBudgetValues() {
      try {
        if (!this.instances.budget) {
          this.error('❌ Budget selector not initialized');
          return null;
        }

        if (this.useModernSelector) {
          const validation = this.instances.budget.validate();
          if (!validation.isValid) {
            this.error('❌ Budget validation failed:', validation.message);
            return null;
          }
          return validation.values;
        } else {
          // Fallback to old system
          this.log('⚠️ Using old system for budget values');
          return this.getOldSystemValues('budget');
        }
      } catch (error) {
        this.error('❌ Error getting budget values:', error);
        return null;
      }
    }

    /**
     * Get timesheet values
     */
    getTimesheetValues() {
      try {
        if (!this.instances.timesheet) {
          this.error('❌ Timesheet selector not initialized');
          return null;
        }

        if (this.useModernSelector) {
          const validation = this.instances.timesheet.validate();
          if (!validation.isValid) {
            this.error('❌ Timesheet validation failed:', validation.message);
            return null;
          }
          return validation.values;
        } else {
          // Fallback to old system
          this.log('⚠️ Using old system for timesheet values');
          return this.getOldSystemValues('timesheet');
        }
      } catch (error) {
        this.error('❌ Error getting timesheet values:', error);
        return null;
      }
    }

    /**
     * Get values from old system (backward compatibility)
     */
    getOldSystemValues(type) {
      try {
        const prefix = type === 'budget' ? 'budget' : 'timesheet';
        const clientSelect = document.getElementById(`${prefix}ClientSelect`);

        if (!clientSelect || !clientSelect.value) {
          return null;
        }

        const selectedOption = clientSelect.options[clientSelect.selectedIndex];
        const clientName = selectedOption.textContent;
        const caseId = clientSelect.value;

        return {
          clientId: selectedOption.dataset.clientId || '',
          clientName: clientName,
          caseId: caseId,
          caseNumber: selectedOption.dataset.caseNumber || '',
          caseTitle: selectedOption.dataset.caseTitle || '',
          caseData: null
        };
      } catch (error) {
        this.error('❌ Error getting old system values:', error);
        return null;
      }
    }

    /**
     * Clear budget selector
     */
    clearBudget() {
      if (this.instances.budget && this.useModernSelector) {
        this.instances.budget.clear();
      }
    }

    /**
     * Clear timesheet selector
     */
    clearTimesheet() {
      if (this.instances.timesheet && this.useModernSelector) {
        this.instances.timesheet.clear();
      }
    }

    /**
     * Health check
     */
    healthCheck() {
      const status = {
        modernSelectorAvailable: !!window.ModernClientCaseSelector,
        usingModernSelector: this.useModernSelector,
        budgetInitialized: !!this.instances.budget,
        timesheetInitialized: !!this.instances.timesheet,
        featureFlag: CONFIG.USE_NEW_SELECTORS
      };

      this.log('🏥 Health Check:', status);
      return status;
    }
  }

  // ===============================
  // Global Export
  // ===============================

  const selectorsManager = new SelectorsManager();

  window.ModernSelectorsManager = {
    initialize: () => selectorsManager.healthCheck(),
    initializeBudget: () => selectorsManager.initializeBudget(),
    initializeTimesheet: () => selectorsManager.initializeTimesheet(),
    getBudgetValues: () => selectorsManager.getBudgetValues(),
    getTimesheetValues: () => selectorsManager.getTimesheetValues(),
    clearBudget: () => selectorsManager.clearBudget(),
    clearTimesheet: () => selectorsManager.clearTimesheet(),
    healthCheck: () => selectorsManager.healthCheck(),
    toggleFeature: (enabled) => {
      CONFIG.USE_NEW_SELECTORS = enabled;
      selectorsManager.useModernSelector = enabled && !!window.ModernClientCaseSelector;
      console.log(`🎚️ Modern selectors ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  console.log('✅ SelectorsLoader loaded successfully');

})();
