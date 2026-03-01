# SYSTEM MAP

> Generated: 2026-02-26 16:35:28  
> Git commit: `ff71201`

---

## 1. Backend Functions

| # | Function Name | Type | Source File | Line |
|---|---------------|------|-------------|------|
| 1 | `<anonymous:functions/src/deletion/validators.js:79>` | http | `functions/src/deletion/validators.js` | 79 |
| 2 | `addHoursPackageToStage` | callable | `functions/services/index.js` | 409 |
| 3 | `addPackageToService` | callable | `functions/services/index.js` | 236 |
| 4 | `addServiceToClient` | callable | `functions/services/index.js` | 20 |
| 5 | `addTimeToTask` | callable | `functions/budget-tasks/index.js` | 273 |
| 6 | `adjustTaskBudget` | callable | `functions/budget-tasks/index.js` | 702 |
| 7 | `blockUser` | callable | `functions/admin/master-admin-wrappers.js` | 403 |
| 8 | `cancelBudgetTask` | callable | `functions/budget-tasks/index.js` | 520 |
| 9 | `changeClientStatus` | callable | `functions/clients/index.js` | 534 |
| 10 | `changeServiceStatus` | callable | `functions/services/index.js` | 1056 |
| 11 | `closeCase` | callable | `functions/clients/index.js` | 679 |
| 12 | `completeService` | callable | `functions/services/index.js` | 910 |
| 13 | `completeTask` | callable | `functions/budget-tasks/index.js` | 320 |
| 14 | `createAuthUser` | callable | `functions/auth/index.js` | 21 |
| 15 | `createBudgetTask` | callable | `functions/budget-tasks/index.js` | 19 |
| 16 | `createClient` | callable | `functions/clients/index.js` | 59 |
| 17 | `createQuickLogEntry` | callable | `functions/timesheet/index.js` | 54 |
| 18 | `createTimesheetEntry_v2` | callable | `functions/timesheet/index.js` | 513 |
| 19 | `createUser` | callable | `functions/admin/master-admin-wrappers.js` | 165 |
| 20 | `dailyBudgetWarnings` | scheduled | `functions/scheduled/index.js` | 114 |
| 21 | `dailyInvariantCheck` | scheduled | `functions/scheduled/index.js` | 211 |
| 22 | `dailyTaskReminders` | scheduled | `functions/scheduled/index.js` | 27 |
| 23 | `deleteClient` | callable | `functions/clients/index.js` | 1007 |
| 24 | `deleteFeeAgreement` | callable | `functions/fee-agreements/index.js` | 194 |
| 25 | `deleteService` | callable | `functions/services/index.js` | 1250 |
| 26 | `deleteUser` | callable | `functions/admin/master-admin-wrappers.js` | 488 |
| 27 | `deleteUserData` | callable | `functions/admin/index.js` | 95 |
| 28 | `deleteUserDataSelective` | callable | `functions/admin/index.js` | 234 |
| 29 | `extendTaskDeadline` | callable | `functions/budget-tasks/index.js` | 848 |
| 30 | `getBudgetTasks` | callable | `functions/budget-tasks/index.js` | 224 |
| 31 | `getClients` | callable | `functions/clients/index.js` | 858 |
| 32 | `getNextCaseNumber` | callable | `functions/clients/index.js` | 35 |
| 33 | `getTeamWorkloadData` | callable | `functions/workload-analytics.js` | 63 |
| 34 | `getTimesheetEntries` | callable | `functions/timesheet/index.js` | 1042 |
| 35 | `getUserActivity` | callable | `functions/admin/master-admin-wrappers.js` | 755 |
| 36 | `getUserFullDetails` | callable | `functions/admin/master-admin-wrappers.js` | 569 |
| 37 | `getUserMetrics` | callable | `functions/metrics/index.js` | 18 |
| 38 | `initializeAdminClaims` | callable | `functions/auth/index.js` | 255 |
| 39 | `linkAuthToEmployee` | callable | `functions/auth/index.js` | 127 |
| 40 | `logActivity` | callable | `functions/admin/index.js` | 35 |
| 41 | `markNotificationAsRead` | callable | `functions/task-update-realtime.js` | 260 |
| 42 | `moveToNextStage` | callable | `functions/services/index.js` | 748 |
| 43 | `onApprovalCreated` | trigger | `functions/whatsapp/index.js` | 22 |
| 44 | `sendBroadcastMessage` | callable | `functions/whatsapp/index.js` | 139 |
| 45 | `sendWhatsAppApprovalNotification` | callable | `functions/whatsapp/index.js` | 313 |
| 46 | `setAdminClaim` | callable | `functions/auth/index.js` | 183 |
| 47 | `setAdminClaims` | http | `functions/auth/index.js` | 329 |
| 48 | `updateBudgetTask` | callable | `functions/task-update-realtime.js` | 98 |
| 49 | `updateClient` | callable | `functions/clients/index.js` | 906 |
| 50 | `updateMetricsOnTaskChange` | trigger | `functions/metrics/index.js` | 124 |
| 51 | `updateTimesheetEntry` | callable | `functions/timesheet/index.js` | 1100 |
| 52 | `updateUser` | callable | `functions/admin/master-admin-wrappers.js` | 292 |
| 53 | `uploadFeeAgreement` | callable | `functions/fee-agreements/index.js` | 21 |
| 54 | `validatedData` | http | `functions/admin/index.js` | 276 |
| 55 | `whatsappWebhook` | http | `functions/whatsapp/index.js` | 450 |

**Total: 55 functions**

---

## 2. Frontend Calls to Cloud Functions

| # | Function Called | Calling File | Line | App |
|---|----------------|-------------|------|-----|
| 1 | `addHoursPackageToStage` | `apps/user-app/js/legal-procedures.js` | 188 | user-app |
| 2 | `addHoursPackageToStage` | `apps/admin-panel/js/features/AddPackageToStage.js` | 767 | admin-panel |
| 3 | `addPackageToService` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1140 | admin-panel |
| 4 | `addServiceToClient` | `apps/user-app/js/modules/case-creation/case-creation-dialog.js` | 2332 | user-app |
| 5 | `addServiceToClient` | `apps/admin-panel/js/modules/case-creation-dialog.js` | 2092 | admin-panel |
| 6 | `addTimeToTask` | `apps/user-app/js/main.js` | 2800 | user-app |
| 7 | `addTimeToTask` | `apps/user-app/js/modules/firebase-operations.js` | 337 | user-app |
| 8 | `addTimeToTask` | `apps/user-app/js/modules/firebase-operations.js` | 340 | user-app |
| 9 | `addTimeToTask` | `apps/user-app/js/modules/firebase-operations.js` | 344 | user-app |
| 10 | `addTimeToTask` | `apps/user-app/js/modules/firebase-server-adapter.js` | 278 | user-app |
| 11 | `adjustTaskBudget` | `apps/user-app/js/main.js` | 2932 | user-app |
| 12 | `adminUpdateTask` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 5017 | admin-panel |
| 13 | `adminUpdateTimesheetEntry` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 5260 | admin-panel |
| 14 | `approveTaskBudget` | `apps/user-app/components/task-approval-system/services/task-approval-service.js` | 91 | user-app |
| 15 | `approveTaskBudget` | `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` | 155 | admin-panel |
| 16 | `blockUser` | `apps/admin-panel/js/managers/UsersActions.js` | 154 | admin-panel |
| 17 | `cancelBudgetTask` | `apps/user-app/js/main.js` | 2654 | user-app |
| 18 | `changeClientStatus` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 985 | admin-panel |
| 19 | `changeServiceStatus` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1393 | admin-panel |
| 20 | `closeCase` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1038 | admin-panel |
| 21 | `completeService` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1251 | admin-panel |
| 22 | `completeTask` | `apps/user-app/js/main.js` | 2860 | user-app |
| 23 | `completeTask` | `apps/user-app/js/modules/firebase-operations.js` | 364 | user-app |
| 24 | `completeTask` | `apps/user-app/js/modules/firebase-operations.js` | 367 | user-app |
| 25 | `completeTask` | `apps/user-app/js/modules/firebase-operations.js` | 371 | user-app |
| 26 | `createBudgetTask` | `apps/user-app/js/main.js` | 1213 | user-app |
| 27 | `createBudgetTask` | `apps/user-app/js/modules/budget-tasks.js` | 182 | user-app |
| 28 | `createBudgetTask` | `apps/user-app/js/modules/firebase-operations.js` | 191 | user-app |
| 29 | `createBudgetTask` | `apps/user-app/js/modules/firebase-operations.js` | 194 | user-app |
| 30 | `createBudgetTask` | `apps/user-app/js/modules/firebase-operations.js` | 203 | user-app |
| 31 | `createBudgetTask` | `apps/user-app/components/add-task/AddTaskDialog.js` | 473 | user-app |
| 32 | `createBudgetTask` | `apps/user-app/components/add-task/utils/task-data-builder.js` | 27 | user-app |
| 33 | `createClient` | `apps/user-app/js/cases.js` | 77 | user-app |
| 34 | `createClient` | `apps/user-app/js/legal-procedures.js` | 135 | user-app |
| 35 | `createClient` | `apps/user-app/js/modules/case-creation/case-creation-dialog.js` | 2415 | user-app |
| 36 | `createClient` | `apps/user-app/js/validation-script.js` | 186 | user-app |
| 37 | `createClient` | `apps/admin-panel/js/modules/case-creation-dialog.js` | 2175 | admin-panel |
| 38 | `createQuickLogEntry` | `apps/user-app/js/quick-log.js` | 1382 | user-app |
| 39 | `createTimesheetEntry` | `apps/user-app/js/modules/firebase-operations.js` | 232 | user-app |
| 40 | `createTimesheetEntry_v2` | `apps/user-app/js/modules/firebase-operations.js` | 264 | user-app |
| 41 | `createTimesheetEntry_v2` | `apps/user-app/js/modules/timesheet-adapter.js` | 139 | user-app |
| 42 | `createUser` | `apps/admin-panel/js/ui/UserForm.js` | 704 | admin-panel |
| 43 | `deleteFeeAgreement` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1842 | admin-panel |
| 44 | `deleteService` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1476 | admin-panel |
| 45 | `deleteUser` | `apps/admin-panel/js/managers/UsersActions.js` | 226 | admin-panel |
| 46 | `deleteUserDataSelective` | `apps/admin-panel/js/ui/DeleteDataSidePanel.js` | 872 | admin-panel |
| 47 | `deleteUserDataSelective` | `apps/admin-panel/js/ui/DeleteDataSidePanel.js` | 956 | admin-panel |
| 48 | `extendTaskDeadline` | `apps/user-app/js/main.js` | 2479 | user-app |
| 49 | `extendTaskDeadline` | `apps/user-app/js/modules/firebase-operations.js` | 389 | user-app |
| 50 | `extendTaskDeadline` | `apps/user-app/js/modules/firebase-operations.js` | 392 | user-app |
| 51 | `extendTaskDeadline` | `apps/user-app/js/modules/firebase-operations.js` | 396 | user-app |
| 52 | `getClients` | `apps/user-app/js/cases.js` | 102 | user-app |
| 53 | `getClients` | `apps/user-app/js/cases.js` | 166 | user-app |
| 54 | `getTeamWorkloadData` | `apps/admin-panel/js/workload-analytics/WorkloadService.js` | 188 | admin-panel |
| 55 | `getUserActivity` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 1305 | admin-panel |
| 56 | `getUserActivity` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 1354 | admin-panel |
| 57 | `getUserFullDetails` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 216 | admin-panel |
| 58 | `getUserFullDetails` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 3781 | admin-panel |
| 59 | `getUserMetrics` | `apps/user-app/js/modules/statistics.js` | 174 | user-app |
| 60 | `logActivity` | `apps/user-app/js/modules/activity-logger.js` | 118 | user-app |
| 61 | `logActivity` | `apps/user-app/js/modules/activity-logger.js` | 145 | user-app |
| 62 | `markNotificationAsRead` | `apps/user-app/js/modules/notification-realtime-bridge.js` | 104 | user-app |
| 63 | `moveToNextStage` | `apps/user-app/js/legal-procedures.js` | 235 | user-app |
| 64 | `moveToNextStage` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1208 | admin-panel |
| 65 | `rejectTaskBudget` | `apps/user-app/components/task-approval-system/services/task-approval-service.js` | 114 | user-app |
| 66 | `rejectTaskBudget` | `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` | 178 | admin-panel |
| 67 | `sendBroadcastMessage` | `apps/admin-panel/js/managers/BroadcastManager.js` | 411 | admin-panel |
| 68 | `sendBroadcastMessage` | `apps/admin-panel/js/managers/WhatsAppMessageDialog.js` | 229 | admin-panel |
| 69 | `updateBudgetTask` | `apps/user-app/js/modules/budget-tasks.js` | 230 | user-app |
| 70 | `updateClient` | `apps/user-app/js/cases.js` | 193 | user-app |
| 71 | `updateTimesheetEntry` | `apps/user-app/js/main.js` | 1952 | user-app |
| 72 | `updateTimesheetEntry` | `apps/user-app/js/modules/firebase-operations.js` | 311 | user-app |
| 73 | `updateTimesheetEntry` | `apps/user-app/js/modules/firebase-operations.js` | 314 | user-app |
| 74 | `updateTimesheetEntry` | `apps/user-app/js/modules/firebase-operations.js` | 318 | user-app |
| 75 | `updateTimesheetEntry` | `apps/user-app/js/modules/timesheet.js` | 153 | user-app |
| 76 | `updateTimesheetEntry` | `apps/admin-panel/js/ui/ClientReportModal.js` | 1908 | admin-panel |
| 77 | `updateUser` | `apps/admin-panel/js/ui/UserForm.js` | 774 | admin-panel |
| 78 | `uploadFeeAgreement` | `apps/admin-panel/js/ui/ClientManagementModal.js` | 1766 | admin-panel |

**Total: 78 calls**

---

## 3. Firestore Collections

| # | Collection | Readers | Writers | Listeners |
|---|------------|---------|---------|----------|
| 1 | `_system` | `functions/case-number-transaction.js` | - | - |
| 2 | `${itemType}_${itemId}` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | - |
| 3 | `action_logs` | `functions/addTimeToTask_v2.js` | `functions/addTimeToTask_v2.js` | - |
| 4 | `activity_log` | `functions/admin/index.js`, `apps/admin-panel/js/ui/UserDetailsModal.js` | `functions/admin/index.js` | - |
| 5 | `alerts` | `functions/src/deletion/audit.js` | `functions/src/deletion/audit.js` | - |
| 6 | `audit_failures` | `functions/services/index.js` | `functions/services/index.js` | - |
| 7 | `audit_log` | `functions/admin/index.js`, `functions/admin/master-admin-wrappers.js`, `functions/shared/audit.js`, `functions/src/deletion/audit.js`, `functions/src/deletion/deletion-engine.js`, `functions/src/deletion/validators.js`, `functions/task-update-realtime.js`, `functions/timesheet/index.js`, `apps/admin-panel/js/managers/AuditLogger.js` | `functions/admin/index.js`, `functions/admin/master-admin-wrappers.js`, `functions/shared/audit.js`, `functions/src/deletion/audit.js`, `functions/task-update-realtime.js`, `functions/timesheet/index.js`, `apps/admin-panel/js/managers/AuditLogger.js` | - |
| 8 | `budget_tasks` | `functions/addTimeToTask_v2.js`, `functions/admin/index.js`, `functions/admin/master-admin-wrappers.js`, `functions/budget-tasks/index.js`, `functions/clients/index.js`, `functions/metrics/index.js`, `functions/scheduled/index.js`, `functions/src/deletion/ownership.js`, `functions/src/whatsapp-bot/WhatsAppBot.js`, `functions/task-update-realtime.js`, `functions/timesheet/index.js`, `functions/workload-analytics.js`, `apps/user-app/js/main.js`, `apps/user-app/js/modules/ai-system/ai-context-builder.js`, `apps/user-app/js/modules/budget-tasks.js`, `apps/user-app/js/modules/firebase-pagination.js`, `apps/user-app/js/modules/real-time-listeners.js`, `apps/user-app/js/system-diagnostics.js`, `apps/admin-panel/js/managers/ClientsDataManager.js`, `apps/admin-panel/js/managers/DataManager.js`, `apps/admin-panel/js/ui/DeleteDataSidePanel.js`, `apps/admin-panel/js/ui/UserDetailsModal.js`, `apps/admin-panel/js/workload-analytics/WorkloadService.js` | `functions/budget-tasks/index.js`, `functions/src/whatsapp-bot/WhatsAppBot.js` | `apps/user-app/js/modules/real-time-listeners.js` |
| 9 | `caseNumberCounter` | `functions/case-number-transaction.js` | - | - |
| 10 | `cases` | `apps/user-app/js/modules/ai-system/ai-context-builder.js`, `apps/user-app/js/system-diagnostics.js`, `apps/user-app/js/validation-script.js`, `apps/admin-panel/js/ui/UserDetailsModal.js` | - | - |
| 11 | `clients` | `functions/addTimeToTask_v2.js`, `functions/admin/master-admin-wrappers.js`, `functions/budget-tasks/index.js`, `functions/clients/index.js`, `functions/fee-agreements/index.js`, `functions/scheduled/index.js`, `functions/services/index.js`, `functions/src/whatsapp-bot/WhatsAppBot.js`, `functions/timesheet/index.js`, `functions/timesheet/internal-case.js`, `apps/user-app/js/cases-integration.js`, `apps/user-app/js/cases.js`, `apps/user-app/js/fix-old-clients.js`, `apps/user-app/js/legal-procedures.js`, `apps/user-app/js/modules/case-creation/case-creation-dialog.js`, `apps/user-app/js/modules/case-creation/case-number-generator.js`, `apps/user-app/js/modules/client-case-selector.js`, `apps/user-app/js/modules/client-hours.js`, `apps/user-app/js/modules/debug-tools.js`, `apps/user-app/js/modules/firebase-operations.js`, `apps/user-app/js/modules/firebase-pagination.js`, `apps/user-app/js/quick-log.js`, `apps/user-app/js/system-diagnostics.js`, `apps/user-app/js/validation-script.js`, `apps/admin-panel/js/features/ServiceOverdraftResolution.js`, `apps/admin-panel/js/fluent/FluentClientsManager.js`, `apps/admin-panel/js/fluent/FluentDataGrid.js`, `apps/admin-panel/js/managers/ClientsDataManager.js`, `apps/admin-panel/js/managers/DataManager.js`, `apps/admin-panel/js/modules/case-creation-dialog.js`, `apps/admin-panel/js/modules/case-number-generator.js`, `apps/admin-panel/js/modules/client-case-selector.js`, `apps/admin-panel/js/ui/ClientManagementModal.js`, `apps/admin-panel/js/ui/SimpleClientDialog.js` | `functions/clients/index.js`, `functions/fee-agreements/index.js`, `functions/timesheet/internal-case.js`, `apps/user-app/js/fix-old-clients.js`, `apps/admin-panel/js/features/ServiceOverdraftResolution.js`, `apps/admin-panel/js/ui/SimpleClientDialog.js` | `apps/user-app/js/modules/case-creation/case-number-generator.js`, `apps/user-app/js/modules/client-case-selector.js`, `apps/admin-panel/js/fluent/FluentClientsManager.js`, `apps/admin-panel/js/managers/ClientsDataManager.js`, `apps/admin-panel/js/modules/case-number-generator.js`, `apps/admin-panel/js/modules/client-case-selector.js` |
| 12 | `daily_${today}` | `functions/src/deletion/audit.js` | `functions/src/deletion/audit.js` | - |
| 13 | `deletion_metrics` | `functions/src/deletion/audit.js` | `functions/src/deletion/audit.js` | - |
| 14 | `employees` | `functions/admin/index.js`, `functions/admin/master-admin-wrappers.js`, `functions/auth/index.js`, `functions/shared/auth.js`, `functions/src/whatsapp-bot/WhatsAppBot.js`, `functions/task-update-realtime.js`, `functions/whatsapp/index.js`, `functions/workload-analytics.js`, `apps/user-app/js/main.js`, `apps/user-app/js/modules/authentication.js`, `apps/user-app/js/modules/employees-manager.js`, `apps/user-app/js/modules/presence-system.js`, `apps/user-app/js/modules/system-announcement-popup.js`, `apps/user-app/js/modules/system-announcement-ticker.js`, `apps/user-app/js/quick-log.js`, `apps/admin-panel/js/core/auth.js`, `apps/admin-panel/js/managers/ClientsDataManager.js`, `apps/admin-panel/js/managers/DataManager.js`, `apps/admin-panel/js/modules/presence-system.js`, `apps/admin-panel/js/ui/AnnouncementEditor.js`, `apps/admin-panel/js/ui/Navigation.js`, `apps/admin-panel/js/ui/ReadStatusModal.js`, `apps/admin-panel/js/ui/SMSManagement.js`, `apps/admin-panel/js/ui/TaskApprovalSidePanel.js`, `apps/admin-panel/js/ui/UserDetailsModal.js`, `apps/admin-panel/js/workload-analytics/WorkloadService.js` | `functions/admin/master-admin-wrappers.js`, `functions/auth/index.js`, `apps/user-app/js/modules/authentication.js`, `apps/user-app/js/modules/employees-manager.js`, `apps/user-app/js/modules/presence-system.js`, `apps/admin-panel/js/modules/presence-system.js`, `apps/admin-panel/js/ui/SMSManagement.js`, `apps/admin-panel/js/ui/TaskApprovalSidePanel.js` | `apps/admin-panel/js/managers/ClientsDataManager.js`, `apps/admin-panel/js/managers/DataManager.js` |
| 15 | `function_monitor_logs` | `apps/user-app/js/modules/function-monitor.js` | `apps/user-app/js/modules/function-monitor.js` | - |
| 16 | `kb_analytics` | `apps/user-app/js/modules/knowledge-base/kb-analytics.js` | `apps/user-app/js/modules/knowledge-base/kb-analytics.js` | - |
| 17 | `monitoring` | `functions/services/index.js` | `functions/services/index.js` | - |
| 18 | `notifications` | `functions/scheduled/index.js`, `functions/task-update-realtime.js`, `apps/user-app/js/modules/real-time-listeners.js` | `functions/scheduled/index.js`, `functions/task-update-realtime.js` | `apps/user-app/js/modules/real-time-listeners.js` |
| 19 | `pending_task_approvals` | `functions/admin/index.js`, `functions/budget-tasks/index.js`, `functions/src/deletion/deletion-engine.js`, `functions/src/deletion/ownership.js`, `functions/src/whatsapp-bot/WhatsAppBot.js`, `apps/user-app/components/task-approval-system/services/task-approval-service.js`, `apps/admin-panel/js/ui/DeleteDataSidePanel.js`, `apps/admin-panel/js/ui/Navigation.js`, `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` | `functions/src/whatsapp-bot/WhatsAppBot.js`, `apps/user-app/components/task-approval-system/services/task-approval-service.js`, `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` | `apps/user-app/components/task-approval-system/services/task-approval-service.js`, `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` |
| 20 | `presentations` | `apps/user-app/js/modules/components/beit-midrash/beit-midrash.js` | - | - |
| 21 | `processed_operations` | `functions/clients/index.js`, `functions/timesheet/helpers.js` | `functions/clients/index.js`, `functions/timesheet/helpers.js` | - |
| 22 | `replies` | `apps/user-app/js/modules/notification-bell.js`, `apps/admin-panel/js/managers/AlertCommunicationManager.js`, `apps/admin-panel/js/modules/notification-bell.js` | `apps/user-app/js/modules/notification-bell.js`, `apps/admin-panel/js/managers/AlertCommunicationManager.js`, `apps/admin-panel/js/modules/notification-bell.js` | `apps/user-app/js/modules/notification-bell.js`, `apps/admin-panel/js/managers/AlertCommunicationManager.js`, `apps/admin-panel/js/modules/notification-bell.js` |
| 23 | `reservations` | `functions/timesheet/helpers.js` | `functions/timesheet/helpers.js` | - |
| 24 | `system_announcements` | `apps/user-app/js/modules/system-announcement-popup.js`, `apps/user-app/js/modules/system-announcement-ticker.js` | `apps/user-app/js/modules/system-announcement-popup.js` | `apps/user-app/js/modules/system-announcement-ticker.js` |
| 25 | `system_health_checks` | `functions/scheduled/index.js` | `functions/scheduled/index.js` | - |
| 26 | `task_completion_alerts` | `functions/budget-tasks/index.js` | `functions/budget-tasks/index.js` | - |
| 27 | `time_events` | `functions/timesheet/helpers.js` | `functions/timesheet/helpers.js` | - |
| 28 | `timesheet_entries` | `functions/addTimeToTask_v2.js`, `functions/admin/index.js`, `functions/admin/master-admin-wrappers.js`, `functions/scheduled/index.js`, `functions/services/index.js`, `functions/src/deletion/ownership.js`, `functions/src/whatsapp-bot/WhatsAppBot.js`, `functions/timesheet/index.js`, `functions/workload-analytics.js`, `apps/user-app/js/main.js`, `apps/user-app/js/modules/ai-system/ai-context-builder.js`, `apps/user-app/js/modules/client-hours.js`, `apps/user-app/js/modules/debug-tools.js`, `apps/user-app/js/modules/firebase-operations.js`, `apps/user-app/js/modules/firebase-pagination.js`, `apps/user-app/js/modules/real-time-listeners.js`, `apps/user-app/js/modules/timesheet.js`, `apps/admin-panel/js/managers/ClientsDataManager.js`, `apps/admin-panel/js/managers/DataManager.js`, `apps/admin-panel/js/ui/ClientReportModal.js`, `apps/admin-panel/js/ui/DeleteDataSidePanel.js`, `apps/admin-panel/js/ui/UserDetailsModal.js`, `apps/admin-panel/js/workload-analytics/WorkloadService.js` | `functions/addTimeToTask_v2.js`, `functions/timesheet/index.js` | `apps/user-app/js/modules/real-time-listeners.js` |
| 29 | `user_logs` | `apps/user-app/js/modules/firebase-operations.js` | `apps/user-app/js/modules/firebase-operations.js` | - |
| 30 | `user_messages` | `functions/admin/master-admin-wrappers.js`, `functions/src/whatsapp-bot/WhatsAppBot.js`, `apps/user-app/js/modules/ai-system/ThreadView.js`, `apps/user-app/js/modules/notification-bell.js`, `apps/admin-panel/js/managers/AlertCommunicationManager.js`, `apps/admin-panel/js/modules/notification-bell.js`, `apps/admin-panel/js/ui/UserDetailsModal.js` | `functions/src/whatsapp-bot/WhatsAppBot.js`, `apps/user-app/js/modules/ai-system/ThreadView.js`, `apps/user-app/js/modules/notification-bell.js`, `apps/admin-panel/js/managers/AlertCommunicationManager.js`, `apps/admin-panel/js/modules/notification-bell.js` | `apps/user-app/js/modules/notification-bell.js`, `apps/admin-panel/js/managers/AlertCommunicationManager.js`, `apps/admin-panel/js/modules/notification-bell.js`, `apps/admin-panel/js/ui/UserDetailsModal.js` |
| 31 | `user_metrics` | `functions/metrics/index.js` | `functions/metrics/index.js` | - |
| 32 | `va_analytics` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | - |
| 33 | `va_feedback` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | - |
| 34 | `va_metrics` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | - |
| 35 | `va_user_stats` | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-complete.js` | - | - |
| 36 | `whatsapp_approval_notifications` | `functions/whatsapp/index.js` | `functions/whatsapp/index.js` | - |
| 37 | `whatsapp_bot_interactions` | `functions/whatsapp/index.js` | `functions/whatsapp/index.js` | - |

**Total: 37 collections**

---

## 4. HTML Pages

### `apps/admin-panel/clients-fluent.html`
- **Title:** ניהול לקוחות | Fluent Design System
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `https://unpkg.com/@fluentui/web-components`
  - `js/core/firebase.js`
  - `js/core/auth.js`
  - `js/core/constants.js`
  - `js/ui/Navigation.js`
  - `js/managers/ClientsDataManager.js`
  - `js/ui/ClientsTable.js`
  - `js/ui/ClientReportModal.js`
  - `js/managers/ReportGenerator.js`
  - `js/fluent/FluentDataGrid.js`
  - `js/fluent/FluentClientsManager.js`
  - `js/ui/Notifications.js`

### `apps/admin-panel/clients.html`
- **Title:** 👥 ניהול לקוחות | Master Admin Panel
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-storage-compat.js`
  - `js/core/firebase.js`
  - `js/core/auth.js`
  - `js/core/constants.js`
  - `js/core/auth-guard.js`
  - `js/ui/Navigation.js`
  - `js/models/SystemAnnouncement.js`
  - `js/services/AnnouncementService.js`
  - `js/ui/AnnouncementEditor.js`
  - `js/managers/ClientsDataManager.js`
  - `js/managers/ReportGenerator.js`
  - `js/ui/Pagination.js`
  - `js/ui/ClientReportModal.js`
  - `js/ui/ClientManagementModal.js`
  - `js/ui/ClientsTable.js`
  - `js/ui/Notifications.js`
  - `js/features/ServiceOverdraftResolution.js`
  - `js/ui/TaskApprovalSidePanel.js`
  - `js/modules/logger.js`
  - `js/modules/event-bus.js`
  - `js/modules/client-case-selector.js`
  - `js/modules/service-card-renderer.js`
  - `js/ui/FloatingActionButton.js`
  - `js/features/AddPackageToStage.js`
  - `./components/task-approval-system/services/task-approval-service.js`
  - `./components/task-approval-system/TaskApprovalDialog.js`

### `apps/admin-panel/debug-firebase-init.html`
- **Title:** 🔍 Firebase Init Debug
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `js/core/firebase.js`

### `apps/admin-panel/feature-flags.html`
- **Title:** ניהול פיצ'רים - Feature Flags
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js`
  - `../firebase-config.js`

### `apps/admin-panel/index.html`
- **Title:** 🔐 Master Admin Panel | מערכת ניהול
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js`
  - `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`
  - `js/core/firebase.js`
  - `js/modules/logger.js`
  - `js/modules/presence-system.js`
  - `js/modules/idle-timeout-manager.js`
  - `js/core/auth.js`
  - `js/core/constants.js`
  - `js/ui/Navigation.js`
  - `js/models/SystemAnnouncement.js`
  - `js/services/AnnouncementService.js`
  - `js/ui/AnnouncementEditor.js`
  - `js/managers/DataManager.js`
  - `js/ui/StatsCards.js`
  - `js/ui/UsersTable.js`
  - `js/ui/FilterBar.js`
  - `js/ui/Pagination.js`
  - `js/ui/DashboardUI.js`
  - `js/managers/AuditLogger.js`
  - `js/ui/Modals.js`
  - `js/ui/Notifications.js`
  - `js/ui/UserForm.js`
  - `js/ui/UserDetailsModal.js`
  - `js/ui/DeleteDataSidePanel.js`
  - `js/managers/UsersActions.js`
  - `js/managers/AlertEngine.js`
  - `js/managers/AlertsAnalyticsService.js`
  - `js/managers/WhatsAppMessageDialog.js`
  - `js/config/message-categories.js`
  - `js/managers/AlertCommunicationManager.js`
  - `js/ui/UserAlertsPanel.js`
  - `js/ui/QuickMessageDialog.js`
  - `js/ui/MessagesFullscreenModal.js`
  - `js/ui/AdminThreadView.js`
  - `js/ui/TaskApprovalSidePanel.js`
  - `js/modules/notification-bell.js`
  - `js/ui/FloatingActionButton.js`
  - `./components/task-approval-system/services/task-approval-service.js?v=933e079`
  - `./components/task-approval-system/TaskApprovalDialog.js?v=933e079`

### `apps/admin-panel/system-announcements.html`
- **Title:** הודעות מערכת | Admin Panel
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `js/core/firebase.js`
  - `js/core/auth.js`
  - `js/core/constants.js`
  - `js/core/auth-guard.js`
  - `js/ui/Navigation.js`
  - `js/models/SystemAnnouncement.js`
  - `js/services/AnnouncementService.js`
  - `js/ui/AnnouncementCard.js`
  - `js/ui/AnnouncementEditor.js`
  - `js/ui/ReadStatusModal.js`
  - `js/ui/SystemAnnouncementsPanel.js`
  - `js/ui/Notifications.js`

### `apps/admin-panel/tasks.html`
- **Title:** 📋 ניהול משימות | Master Admin Panel
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `js/core/firebase.js`
  - `js/core/auth.js`
  - `js/managers/AuditLogger.js`
  - `js/managers/TasksManager.js`
  - `js/ui/Navigation.js`
  - `js/ui/TasksTable.js`
  - `js/ui/Notifications.js`
  - `js/ui/Modals.js`

### `apps/admin-panel/timesheet.html`
- **Title:** ⏰ ניהול שעות | Master Admin Panel
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `js/core/firebase.js`
  - `js/core/auth.js`
  - `js/managers/AuditLogger.js`
  - `js/managers/TimesheetManager.js`
  - `js/ui/Navigation.js`
  - `js/ui/TimesheetTable.js`
  - `js/ui/Notifications.js`
  - `js/ui/Modals.js`

### `apps/admin-panel/workload.html`
- **Title:** 📊 ניתוח עומס | Master Admin Panel
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js`
  - `js/core/firebase.js`
  - `js/modules/logger.js`
  - `js/modules/presence-system.js`
  - `js/modules/idle-timeout-manager.js`
  - `js/core/auth.js`
  - `js/core/constants.js`
  - `js/core/auth-guard.js`
  - `js/ui/Navigation.js`
  - `js/managers/DataManager.js`
  - `js/modules/work-hours-calculator.js`
  - `js/workload-analytics/WorkloadConstants.js`
  - `js/workload-analytics/WorkloadCalculator.js`
  - `js/workload-analytics/WorkloadService.js`
  - `js/workload-analytics/WorkloadCard.js`

### `apps/user-app/components/add-task/demo.html`
- **Title:** Add Task System - Demo
- **Scripts:**
  - `./index.js`

### `apps/user-app/index.html`
- **Title:** מערכת ניהול מתקדמת - משרד עו"ד גיא הרשקוביץ
- **Scripts:**
  - `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`
  - `https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js`
  - `https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js`
  - `js/modules/logger.js`
  - `js/modules/lazy-loader.js`
  - `js/modules/dates.js`
  - `js/modules/statistics.js`
  - `js/modules/pagination.js`
  - `js/modules/activity-logger.js`
  - `dist/js/core/event-bus.js`
  - `dist/js/services/firebase-service.js`
  - `src/modules/deduction/index.js`
  - `js/modules/task-actions.js`
  - `js/modules/task-completion-validation.js`
  - `components/task-timeline/TaskTimeline.js`
  - `js/modules/firebase-pagination.js`
  - `js/modules/integration-manager.js`
  - `js/modules/api-client-v2.js`
  - `js/modules/firebase-server-adapter.js`
  - `js/modules/employees-manager.js`
  - `js/modules/presence-system.js`
  - `js/modules/idle-timeout-manager.js`
  - `js/cases.js`
  - `js/cases-integration.js`
  - `js/legal-procedures.js`
  - `js/modules/lottie-animations.js`
  - `js/modules/lottie-manager.js`
  - `js/modules/notification-messages.js`
  - `js/modules/notification-system.js`
  - `shared/config/feature-flags.js`
  - `shared/ui/loading/LoadingOverlay.js`
  - `shared/compatibility/loading-wrapper.js`
  - `js/modules/modals-manager.js`
  - `js/modules/modals-compat.js`
  - `js/modules/service-card-renderer.js`
  - `js/modules/ui/client-search.js`
  - `js/modules/client-case-selector.js`
  - `js/modules/selectors-init.js`
  - `js/modules/monitoring/performance-monitor.js`
  - `js/modules/case-creation/case-number-generator.js`
  - `js/modules/case-creation/case-form-validator.js`
  - `js/modules/case-creation/case-creation-dialog.js`
  - `js/modules/descriptions/category-mapping.js`
  - `js/modules/descriptions/descriptions-manager.js`
  - `js/modules/descriptions/smart-combo-selector.js`
  - `js/modules/descriptions/GuidedTextInput.js`
  - `js/modules/core-utils.js`
  - `js/modules/dialogs.js`
  - `js/modules/system-snapshot.js`
  - `js/modules/event-analyzer.js`
  - `js/modules/svg-rings.js`
  - `js/main.js`
  - `js/modules/description-tooltips.js`
  - `js/modules/work-hours-calculator.js`
  - `js/modules/function-monitor.js`
  - `js/modules/function-monitor-dashboard.js`
  - `js/modules/function-monitor-init.js`
  - `js/modules/knowledge-base/kb-icons.js`
  - `js/modules/knowledge-base/kb-analytics.js`
  - `js/modules/knowledge-base/kb-data.js`
  - `js/modules/knowledge-base/kb-search.js`
  - `js/modules/knowledge-base/knowledge-base.js`
  - `js/modules/virtual-assistant/virtual-assistant-complete.js`
  - `js/modules/smart-faq-bot.js`
  - `script.js`
  - `js/validation-script.js`
  - `js/fix-old-clients.js`

### `apps/user-app/js/load-messaging-system.html`
- **Title:** Messaging System - Script Loader
- **Scripts:**
  - `../js/core/errors/BaseError.js`
  - `../js/core/errors/ValidationError.js`
  - `../js/core/errors/PermissionError.js`
  - `../js/core/errors/NetworkError.js`
  - `../js/core/constants/message-types.js`
  - `../js/core/constants/alert-types.js`
  - `../js/core/constants/thread-constants.js`
  - `../js/models/Thread.js`
  - `../js/models/Message.js`
  - `../js/models/Alert.js`
  - `../js/models/ContextMessage.js`
  - `../js/services/ValidationService.js`
  - `../js/utils/date-utils.js`
  - `../js/managers/AlertEngine.js`
  - `../js/managers/ThreadManager.js`
  - `../js/managers/ContextMessageManager.js`

### `apps/user-app/quick-log.html`
- **Title:** ⏱ רישום שעות מהיר | משרד עו"ד
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js`
  - `js/quick-log.js`

### `apps/user-app/reset-password.html`
- **Title:** איפוס סיסמה - משרד עו"ד גיא הרשקוביץ
- **Scripts:**
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js`
  - `https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js`

### `apps/user-app/shared/demo.html`
- **Title:** Unified UI System - Demo
- **Scripts:**
  - `https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js`
  - `../js/modules/lottie-animations.js`
  - `config/feature-flags.js`
  - `ui/loading/LoadingOverlay.js`
  - `compatibility/loading-wrapper.js`

---

## 5. Cross-Reference Analysis

### A. Backend Functions with No Frontend Calls

| # | Function | Type | File |
|---|----------|------|------|
| 1 | `deleteUserData` | callable | `functions/admin/index.js` |
| 2 | `validatedData` | http | `functions/admin/index.js` |
| 3 | `createAuthUser` | callable | `functions/auth/index.js` |
| 4 | `linkAuthToEmployee` | callable | `functions/auth/index.js` |
| 5 | `setAdminClaim` | callable | `functions/auth/index.js` |
| 6 | `initializeAdminClaims` | callable | `functions/auth/index.js` |
| 7 | `setAdminClaims` | http | `functions/auth/index.js` |
| 8 | `getBudgetTasks` | callable | `functions/budget-tasks/index.js` |
| 9 | `getNextCaseNumber` | callable | `functions/clients/index.js` |
| 10 | `deleteClient` | callable | `functions/clients/index.js` |
| 11 | `<anonymous:functions/src/deletion/validators.js:79>` | http | `functions/src/deletion/validators.js` |
| 12 | `getTimesheetEntries` | callable | `functions/timesheet/index.js` |
| 13 | `sendWhatsAppApprovalNotification` | callable | `functions/whatsapp/index.js` |
| 14 | `whatsappWebhook` | http | `functions/whatsapp/index.js` |

### B. Frontend Calls to Non-Existent Backend Functions

| # | Function Called | Calling File | Line | App |
|---|----------------|-------------|------|-----|
| 1 | `createTimesheetEntry` | `apps/user-app/js/modules/firebase-operations.js` | 232 | user-app |
| 2 | `approveTaskBudget` | `apps/user-app/components/task-approval-system/services/task-approval-service.js` | 91 | user-app |
| 3 | `rejectTaskBudget` | `apps/user-app/components/task-approval-system/services/task-approval-service.js` | 114 | user-app |
| 4 | `adminUpdateTask` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 5017 | admin-panel |
| 5 | `adminUpdateTimesheetEntry` | `apps/admin-panel/js/ui/UserDetailsModal.js` | 5260 | admin-panel |
| 6 | `approveTaskBudget` | `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` | 155 | admin-panel |
| 7 | `rejectTaskBudget` | `apps/admin-panel/components/task-approval-system/services/task-approval-service.js` | 178 | admin-panel |

### C. Collections in Code but Not in firestore.rules

| # | Collection Name |
|---|----------------|
| 1 | `action_logs` |
| 2 | `task_completion_alerts` |
| 3 | `caseNumberCounter` |
| 4 | `processed_operations` |
| 5 | `user_metrics` |
| 6 | `notifications` |
| 7 | `system_health_checks` |
| 8 | `monitoring` |
| 9 | `audit_failures` |
| 10 | `deletion_metrics` |
| 11 | `daily_${today}` |
| 12 | `alerts` |
| 13 | `time_events` |
| 14 | `reservations` |
| 15 | `whatsapp_approval_notifications` |
| 16 | `whatsapp_bot_interactions` |
| 17 | `user_logs` |
| 18 | `va_feedback` |
| 19 | `va_metrics` |
| 20 | `va_analytics` |
| 21 | `va_user_stats` |
| 22 | `${itemType}_${itemId}` |

### D. JS Files Not Loaded by Any HTML

| # | File |
|---|------|
| 1 | `apps/admin-panel/components/task-approval-system/utils/approval-helpers.js` |
| 2 | `apps/admin-panel/components/utils/approval-helpers.js` |
| 3 | `apps/admin-panel/js/managers/BroadcastManager.js` |
| 4 | `apps/admin-panel/js/ui/SimpleClientDialog.js` |
| 5 | `apps/admin-panel/js/ui/SMSManagement.js` |
| 6 | `apps/user-app/chatbot/core/system-tour.js` |
| 7 | `apps/user-app/chatbot/data/faq-database.js` |
| 8 | `apps/user-app/chatbot/styles/chatbot-styles.js` |
| 9 | `apps/user-app/chatbot/styles/tour-styles.js` |
| 10 | `apps/user-app/chatbot/ui/suggestions.js` |
| 11 | `apps/user-app/chatbot/utils/highlighter.js` |
| 12 | `apps/user-app/chatbot/utils/text-processing.js` |
| 13 | `apps/user-app/components/add-task/AddTaskDialog.js` |
| 14 | `apps/user-app/components/add-task/TaskFormManager.js` |
| 15 | `apps/user-app/components/add-task/TaskFormValidator.js` |
| 16 | `apps/user-app/components/add-task/utils/task-data-builder.js` |
| 17 | `apps/user-app/components/task-approval-system/TaskApprovalPanel.js` |
| 18 | `apps/user-app/components/task-approval-system/utils/approval-helpers.js` |
| 19 | `apps/user-app/js/config/state-config.js` |
| 20 | `apps/user-app/js/modules/ai-system/ai-chat-ui.js` |
| 21 | `apps/user-app/js/modules/ai-system/ai-config.js` |
| 22 | `apps/user-app/js/modules/ai-system/ai-context-builder.js` |
| 23 | `apps/user-app/js/modules/ai-system/ai-engine.js` |
| 24 | `apps/user-app/js/modules/authentication.js` |
| 25 | `apps/user-app/js/modules/break-manager.js` |
| 26 | `apps/user-app/js/modules/budget-tasks.js` |
| 27 | `apps/user-app/js/modules/case-creation/apply-css-updates.js` |
| 28 | `apps/user-app/js/modules/client-hours.js` |
| 29 | `apps/user-app/js/modules/client-validation.js` |
| 30 | `apps/user-app/js/modules/components/beit-midrash/beit-midrash-viewer.js` |
| 31 | `apps/user-app/js/modules/components/beit-midrash/beit-midrash.js` |
| 32 | `apps/user-app/js/modules/components/sidebar/sidebar-config.js` |
| 33 | `apps/user-app/js/modules/components/sidebar/sidebar.js` |
| 34 | `apps/user-app/js/modules/data-cache.js` |
| 35 | `apps/user-app/js/modules/debug-tools.js` |
| 36 | `apps/user-app/js/modules/dom-cache.js` |
| 37 | `apps/user-app/js/modules/firebase-operations.js` |
| 38 | `apps/user-app/js/modules/flatpickr-wrapper.js` |
| 39 | `apps/user-app/js/modules/forms.js` |
| 40 | `apps/user-app/js/modules/navigation.js` |
| 41 | `apps/user-app/js/modules/notification-bridge.js` |
| 42 | `apps/user-app/js/modules/notification-realtime-bridge.js` |
| 43 | `apps/user-app/js/modules/pagination-manager.js` |
| 44 | `apps/user-app/js/modules/reports.js` |
| 45 | `apps/user-app/js/modules/statistics-calculator.js` |
| 46 | `apps/user-app/js/modules/system-announcement-popup.js` |
| 47 | `apps/user-app/js/modules/system-announcement-ticker.js` |
| 48 | `apps/user-app/js/modules/task-status.js` |
| 49 | `apps/user-app/js/modules/timesheet-adapter.js` |
| 50 | `apps/user-app/js/modules/timesheet-constants.js` |
| 51 | `apps/user-app/js/modules/timesheet.js` |
| 52 | `apps/user-app/js/modules/ui-components.js` |
| 53 | `apps/user-app/js/modules/UserReplyModal.js` |
| 54 | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-bundle.js` |
| 55 | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-core.js` |
| 56 | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-data.js` |
| 57 | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-engines.js` |
| 58 | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-main.js` |
| 59 | `apps/user-app/js/modules/virtual-assistant/virtual-assistant-ui.js` |
| 60 | `apps/user-app/js/modules/virtual-assistant.js` |
| 61 | `apps/user-app/js/scripts/add-employee-phones.js` |
| 62 | `apps/user-app/js/system-diagnostics.js` |
| 63 | `apps/user-app/src/modules/deduction/aggregators.js` |
| 64 | `apps/user-app/src/modules/deduction/builders.js` |
| 65 | `apps/user-app/src/modules/deduction/calculators.js` |
| 66 | `apps/user-app/src/modules/deduction/deduction-logic.js` |
| 67 | `apps/user-app/src/modules/deduction/validators.js` |

