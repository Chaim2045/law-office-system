/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CASE CREATION SYSTEM - ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description Entry point for Case Creation System - מערכת יצירת תיקים ושירותים
 * @version 1.0.0
 * @created 2025-12-07
 *
 * @features
 * - מערכת מודולרית ליצירת לקוחות חדשים
 * - הוספת שירותים ללקוחות קיימים
 * - אינטגרציה עם ClientCaseSelector
 * - Stepper/Wizard רב-שלבי
 * - Lottie Animations
 * - EventBus Integration
 * - תמיכה ב-Backward Compatibility
 *
 * @example
 * ```javascript
 * // Initialize the system
 * import { initCaseCreationSystem } from './components/case-creation/index.js';
 *
 * const caseCreationDialog = initCaseCreationSystem(manager, {
 *   onSuccess: (caseData) => console.log('Created:', caseData),
 *   onError: (error) => console.error('Error:', error)
 * });
 *
 * // Show dialog for new client
 * caseCreationDialog.show('new-client');
 *
 * // Show dialog for existing client
 * caseCreationDialog.show('existing-client');
 * ```
 */

import { CaseCreationDialog } from './CaseCreationDialog.js';
import { CaseFormValidator } from './CaseFormValidator.js';
import { CaseNumberGenerator } from './CaseNumberGenerator.js';
import { CasesManager } from './CasesManager.js';

/**
 * Initialize Case Creation System
 * אתחול מערכת יצירת תיקים
 *
 * @param {Object} manager - Main application manager
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Callback on successful case creation
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onCancel - Callback on cancel
 * @returns {CaseCreationDialog} Dialog instance
 */
export function initCaseCreationSystem(manager, options = {}) {
  console.log('🚀 Initializing Case Creation System v1.0...');

  // Validate manager
  if (!manager) {
    throw new Error('❌ Manager is required for Case Creation System');
  }

  // Create dialog instance
  const dialog = new CaseCreationDialog(manager, options);

  // ✅ Backward compatibility - attach to window
  if (typeof window !== 'undefined') {
    window.CaseCreationSystem = {
      dialog,
      show: (mode) => dialog.show(mode),
      hide: () => dialog.hide(),
      version: '1.0.0'
    };
  }

  console.log('✅ Case Creation System v1.0 initialized');

  return dialog;
}

/**
 * Quick helper to show the dialog for new client
 * פונקציית עזר מהירה להצגת דיאלוג ללקוח חדש
 *
 * @returns {void}
 */
export function showNewClientDialog() {
  if (window.CaseCreationSystem?.dialog) {
    window.CaseCreationSystem.dialog.show('new-client');
  } else {
    console.error('❌ Case Creation System not initialized. Call initCaseCreationSystem() first.');
  }
}

/**
 * Quick helper to show the dialog for existing client
 * פונקציית עזר מהירה להצגת דיאלוג ללקוח קיים
 *
 * @returns {void}
 */
export function showExistingClientDialog() {
  if (window.CaseCreationSystem?.dialog) {
    window.CaseCreationSystem.dialog.show('existing-client');
  } else {
    console.error('❌ Case Creation System not initialized. Call initCaseCreationSystem() first.');
  }
}

/**
 * Quick helper to hide the dialog
 * פונקציית עזר מהירה להסתרת הדיאלוג
 *
 * @returns {void}
 */
export function hideCaseCreationDialog() {
  if (window.CaseCreationSystem?.dialog) {
    window.CaseCreationSystem.dialog.hide();
  }
}

// Export components for advanced usage
export { CaseCreationDialog, CaseFormValidator, CaseNumberGenerator, CasesManager };

// Default export
export default {
  CaseCreationDialog,
  CaseFormValidator,
  CaseNumberGenerator,
  CasesManager,
  initCaseCreationSystem,
  showNewClientDialog,
  showExistingClientDialog,
  hideCaseCreationDialog
};
