/**
 * Law Office Management System - Firebase Functions
 *
 * מערכת ניהול משרד עורכי דין - פונקציות שרת
 * ארכיטקטורה מאובטחת עם Validation, Authorization, ו-Audit Logging
 */

const admin = require('firebase-admin');

// אתחול Admin SDK — חייב להיות לפני כל require שמשתמש ב-admin.firestore()
admin.initializeApp();

const { updateBudgetTask, markNotificationAsRead } = require('./task-update-realtime');

// Real-time Task Updates & Notifications
exports.updateBudgetTask = updateBudgetTask;
exports.markNotificationAsRead = markNotificationAsRead;

// ═══════════════════════════════════════════════════════════════
// 📊 Workload Analytics Functions - Performance Optimized
// ═══════════════════════════════════════════════════════════════
const { getTeamWorkloadData } = require('./workload-analytics');
exports.getTeamWorkloadData = getTeamWorkloadData;

// Fee Agreements Functions (imported from ./fee-agreements)
const feeAgreements = require('./fee-agreements');
exports.uploadFeeAgreement = feeAgreements.uploadFeeAgreement;
exports.deleteFeeAgreement = feeAgreements.deleteFeeAgreement;

// Scheduled Functions (imported from ./scheduled)
const scheduled = require('./scheduled');
exports.dailyTaskReminders = scheduled.dailyTaskReminders;
exports.dailyBudgetWarnings = scheduled.dailyBudgetWarnings;
exports.dailyInvariantCheck = scheduled.dailyInvariantCheck;
exports.holidaysCalendarSync = scheduled.holidaysCalendarSync;  // PR-G.1

// WhatsApp Functions (imported from ./whatsapp)
const whatsapp = require('./whatsapp');
exports.sendBroadcastMessage = whatsapp.sendBroadcastMessage;
exports.sendWhatsAppApprovalNotification = whatsapp.sendWhatsAppApprovalNotification;
exports.whatsappWebhook = whatsapp.whatsappWebhook;
exports.onApprovalCreated = whatsapp.onApprovalCreated;

// Metrics Functions (imported from ./metrics)
const metrics = require('./metrics');
exports.getUserMetrics = metrics.getUserMetrics;
exports.updateMetricsOnTaskChange = metrics.updateMetricsOnTaskChange;

// Admin Functions (imported from ./admin)
const adminOps = require('./admin');
exports.createUser = adminOps.createUser;
exports.updateUser = adminOps.updateUser;
exports.blockUser = adminOps.blockUser;
exports.deleteUser = adminOps.deleteUser;
exports.getUserFullDetails = adminOps.getUserFullDetails;
exports.logActivity = adminOps.logActivity;
exports.deleteUserData = adminOps.deleteUserData;
exports.deleteUserDataSelective = adminOps.deleteUserDataSelective;

// System Config Functions (imported from ./admin/system-config)
const systemConfig = require('./admin/system-config');
exports.updateSystemConfig = systemConfig.updateSystemConfig;
exports.getSystemConfig = systemConfig.getSystemConfig;
exports.rollbackSystemConfig = systemConfig.rollbackSystemConfig;

// PR-D (2026-05-18): on-demand audit + repair for client aggregate drift.
// See functions/admin/repair-aggregates.js for the canonical-recompute rationale.
const repairAggregates = require('./admin/repair-aggregates');
exports.auditClientAggregates = repairAggregates.auditClientAggregates;
exports.repairClientAggregates = repairAggregates.repairClientAggregates;

// PR-C.2-fns (2026-05-18): outbox trigger for system_health_checks → bot.
// See functions/triggers/system-reports-outbox-trigger.js for the outbox-pattern rationale.
const systemReportsOutboxTrigger = require('./triggers/system-reports-outbox-trigger');
exports.onSystemHealthCheckCreated = systemReportsOutboxTrigger.onSystemHealthCheckCreated;

// Auth Functions (imported from ./auth)
const authModule = require('./auth');
exports.createAuthUser = authModule.createAuthUser;
exports.linkAuthToEmployee = authModule.linkAuthToEmployee;
exports.setAdminClaim = authModule.setAdminClaim; // legacy onCall singular form (revoke + grant)
exports.verifyClaims = authModule.verifyClaims; // PR-H.0.0.A — read-only diagnostic

// Auth Functions (TS — Pre-H.0.0.B replacements for the legacy unauth'd setAdminClaims
// and the under-auth'd initializeAdminClaims). Both compiled from functions/src-ts/.
const setAdminClaimsModule = require('./lib/set-admin-claims');
exports.setAdminClaims = setAdminClaimsModule.setAdminClaims;
const initializeAdminClaimsModule = require('./lib/initialize-admin-claims');
exports.initializeAdminClaims = initializeAdminClaimsModule.initializeAdminClaims;

// syncRoleClaims (TS — Pre-H.0.0.F). Admin-gated v2 onCall that reconciles each
// employee's Auth role claim to the employees.role SSOT: writes the first
// {role:'partner'} claims, removes residual {role:'lawyer'}, read-merge-write
// (never clobbers other claim fields). DRY-RUN by default; --apply is a
// supervised PROD-Auth action. Closes Phase 1.
const syncRoleClaimsModule = require('./lib/sync-role-claims');
exports.syncRoleClaims = syncRoleClaimsModule.syncRoleClaims;

// Employee Costs (TS — Pre-H.0.0.G). CF-only employee_costs/{email} collection.
// setEmployeeCost: admin-gated write, audit-first. getEmployeeCost: admin-gated read.
// Both compiled from functions/src-ts/. Consumed by Phase 2 H.2 (cost foundation).
const setEmployeeCostModule = require('./lib/set-employee-cost');
exports.setEmployeeCost = setEmployeeCostModule.setEmployeeCost;
const getEmployeeCostModule = require('./lib/get-employee-cost');
exports.getEmployeeCost = getEmployeeCostModule.getEmployeeCost;

// tofes-mecher bridge (TS — Phase 2 H.0 foundation). Admin-gated v2 onCall that
// proves the cross-project wiring (Secret Manager → SA key → named app → 1 read).
// ⚠️ DEPLOY PREREQUISITE: the secret TOFES_MECHER_SA_KEY must exist in Secret
// Manager BEFORE any functions deploy, else the WHOLE deploy fails (defineSecret).
// ⚠️ REPURPOSE-OR-DELETE in H.1.b: once the real validateSalesRecordExists ships
// it proves the identical wiring AND does real work, making this diagnostic dead
// weight — H.1.b deletes this export then.
//
// ✅ RE-ENABLED in H.1.a (2026-06-08). The 2026-06-04 deploy-unblock incident had
// commented these two lines because the top-level defineSecret('TOFES_MECHER_SA_KEY')
// in connectivity-check.ts aborted EVERY PROD functions deploy while the secret was
// unset ("In non-interactive mode but have no value for the secret"). H.0 Console
// setup has since set the secret in Secret Manager (versions/1), so re-loading the
// module + re-running defineSecret is safe. This function is the live-wiring proof
// for H.1 (MASTER_PLAN §8.2/§8.3): a local script cannot exercise the DEPLOYED
// secret-binding + cross-project IAM grant — only a live admin call can.
const connectivityCheckModule = require('./lib/tofes-mecher/connectivity-check');
exports.tofesMecherConnectivityCheck = connectivityCheckModule.connectivityCheck;

// Budget Tasks Functions (imported from ./budget-tasks)
const budgetTasks = require('./budget-tasks');
exports.createBudgetTask = budgetTasks.createBudgetTask;
exports.getBudgetTasks = budgetTasks.getBudgetTasks;
exports.addTimeToTask = budgetTasks.addTimeToTask;
exports.completeTask = budgetTasks.completeTask;
exports.cancelBudgetTask = budgetTasks.cancelBudgetTask;
exports.adjustTaskBudget = budgetTasks.adjustTaskBudget;
exports.extendTaskDeadline = budgetTasks.extendTaskDeadline;

// Clients Functions (imported from ./clients)
const clients = require('./clients');
exports.getNextCaseNumber = clients.getNextCaseNumber;
exports.createClient = clients.createClient;
exports.getClients = clients.getClients;
exports.updateClient = clients.updateClient;
exports.deleteClient = clients.deleteClient;
exports.changeClientStatus = clients.changeClientStatus;
exports.closeCase = clients.closeCase;
exports.setServiceOverride = clients.setServiceOverride;
exports.setServiceOverdraftResolved = clients.setServiceOverdraftResolved;

// Services Functions (imported from ./services)
const services = require('./services');
exports.addServiceToClient = services.addServiceToClient;
exports.addPackageToService = services.addPackageToService;
exports.addHoursPackageToStage = services.addHoursPackageToStage;
exports.moveToNextStage = services.moveToNextStage;
exports.completeService = services.completeService;
exports.changeServiceStatus = services.changeServiceStatus;
exports.deleteService = services.deleteService;

// Timesheet Functions (imported from ./timesheet)
const timesheet = require('./timesheet');
exports.createQuickLogEntry = timesheet.createQuickLogEntry;
exports.createTimesheetEntry_v2 = timesheet.createTimesheetEntry_v2;
exports.getTimesheetEntries = timesheet.getTimesheetEntries;
exports.updateTimesheetEntry = timesheet.updateTimesheetEntry;

// Timesheet Triggers (imported from ./triggers/timesheet-trigger)
const { onTimesheetEntryChanged } = require('./triggers/timesheet-trigger');
exports.onTimesheetEntryChanged = onTimesheetEntryChanged;

console.log('✅ Law Office Functions loaded successfully');
