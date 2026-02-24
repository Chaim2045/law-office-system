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

// Auth Functions (imported from ./auth)
const authModule = require('./auth');
exports.createAuthUser = authModule.createAuthUser;
exports.linkAuthToEmployee = authModule.linkAuthToEmployee;
exports.setAdminClaim = authModule.setAdminClaim;
exports.initializeAdminClaims = authModule.initializeAdminClaims;
exports.setAdminClaims = authModule.setAdminClaims;

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

console.log('✅ Law Office Functions loaded successfully');
