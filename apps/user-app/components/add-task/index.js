/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADD TASK SYSTEM - ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description Entry point for Add Task System - מערכת הוספת משימות חדשות
 * @version 2.0.0
 * @created 2025-01-20
 *
 * @features
 * - מערכת מודולרית להוספת משימות תקציב
 * - אינטגרציה עם ClientCaseSelector
 * - אינטגרציה עם SmartComboSelector
 * - ולידציה מלאה
 * - תמיכה ב-Backward Compatibility
 *
 * @example
 * ```javascript
 * // Initialize the system
 * import { initAddTaskSystem } from './components/add-task/index.js';
 *
 * const addTaskDialog = initAddTaskSystem(manager, {
 *   onSuccess: (taskData) => console.log('Created:', taskData),
 *   onError: (error) => console.error('Error:', error)
 * });
 *
 * // Show dialog
 * addTaskDialog.show();
 * ```
 */

import { AddTaskDialog } from './AddTaskDialog.js';
import { TaskFormValidator } from './TaskFormValidator.js';
import { TaskFormManager } from './TaskFormManager.js';

/**
 * Initialize Add Task System
 * אתחול מערכת הוספת משימות
 *
 * @param {Object} manager - Main application manager
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Callback on successful task creation
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onCancel - Callback on cancel
 * @param {boolean} options.enableDrafts - Enable draft saving (default: true)
 * @returns {AddTaskDialog} Dialog instance
 */
export function initAddTaskSystem(manager, options = {}) {
  console.log('🚀 Initializing Add Task System v2.0...');

  // Validate manager
  if (!manager) {
    throw new Error('❌ Manager is required for Add Task System');
  }

  // Create dialog instance
  const dialog = new AddTaskDialog(manager, options);

  // ✅ Backward compatibility - attach to window
  if (typeof window !== 'undefined') {
    window.AddTaskSystem = {
      dialog,
      show: () => dialog.show(),
      hide: () => dialog.hide(),
      version: '2.0.0'
    };
  }

  console.log('✅ Add Task System v2.0 initialized');

  return dialog;
}

/**
 * Quick helper to show the dialog
 * פונקציית עזר מהירה להצגת הדיאלוג
 *
 * @returns {void}
 */
export function showAddTaskDialog() {
  if (window.AddTaskSystem?.dialog) {
    window.AddTaskSystem.dialog.show();
  } else {
    console.error('❌ Add Task System not initialized. Call initAddTaskSystem() first.');
  }
}

/**
 * Quick helper to hide the dialog
 * פונקציית עזר מהירה להסתרת הדיאלוג
 *
 * @returns {void}
 */
export function hideAddTaskDialog() {
  if (window.AddTaskSystem?.dialog) {
    window.AddTaskSystem.dialog.hide();
  }
}

// Export components for advanced usage
export { AddTaskDialog, TaskFormValidator, TaskFormManager };

// Default export
export default {
  AddTaskDialog,
  TaskFormValidator,
  TaskFormManager,
  initAddTaskSystem,
  showAddTaskDialog,
  hideAddTaskDialog
};
