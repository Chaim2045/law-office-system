/**
 * Task Approval System - Entry Point
 * מערכת אישור תקציב משימות
 */

import { TaskApprovalPanel } from './TaskApprovalPanel.js';
import { TaskApprovalDialog } from './TaskApprovalDialog.js';
import { taskApprovalService } from './services/task-approval-service.js';

export function initTaskApprovalSystem(options = {}) {
  console.log('🚀 Initializing Task Approval System...');

  if (!options.db) {
    throw new Error('❌ Firestore database (db) is required');
  }

  if (!options.containerId) {
    throw new Error('❌ Container ID is required');
  }

  const panel = new TaskApprovalPanel(options);
  panel.init();

  if (typeof window !== 'undefined') {
    window.TaskApprovalSystem = {
      panel,
      service: taskApprovalService,
      version: '1.0.0'
    };
  }

  console.log('✅ Task Approval System initialized');
  return panel;
}

export { TaskApprovalPanel, TaskApprovalDialog, taskApprovalService };

export default {
  TaskApprovalPanel,
  TaskApprovalDialog,
  taskApprovalService,
  initTaskApprovalSystem,
  version: '1.0.0'
};
