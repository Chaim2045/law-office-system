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

// getFeeAgreementUrl: admin-gated, on-demand SHORT-LIVED signed URL for viewing a
// fee-agreement PDF (security remediation — replaces the world-readable public-ACL
// URLs). Compiled from functions/src-ts/fee-agreements/get-fee-agreement-url.ts.
const getFeeAgreementUrlModule = require('./lib/fee-agreements/get-fee-agreement-url');
exports.getFeeAgreementUrl = getFeeAgreementUrlModule.getFeeAgreementUrl;

// Scheduled Functions (imported from ./scheduled)
const scheduled = require('./scheduled');
exports.dailyTaskReminders = scheduled.dailyTaskReminders;
exports.dailyBudgetWarnings = scheduled.dailyBudgetWarnings;
exports.dailyInvariantCheck = scheduled.dailyInvariantCheck;
exports.holidaysCalendarSync = scheduled.holidaysCalendarSync;  // PR-G.1
// OWN-2: the live package/service reconciliation loop (self-healing half of the
// single-owner redesign). Gated by system_settings/package_reconciliation
// (default OFF → inert on deploy); calls the OWN-1 owner in enforce mode.
exports.reconcilePackageDrift = require('./scheduled/reconcile-package-drift').reconcilePackageDrift;

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

// tofes-mecher bridge (TS — Phase 2 H.1.b, Pattern A live read). Admin-gated v2
// onCall that reads ONE specific sales_record from the tofes-mecher project via
// the cross-project named app and returns a FIELD-MINIMIZED snapshot for the H.6
// cutover flow. Every lookup writes a NON-PII access audit (DLR §8.2.5).
// ⚠️ DEPLOY PREREQUISITE: the secret TOFES_MECHER_SA_KEY must exist in Secret
// Manager BEFORE any functions deploy, else the WHOLE deploy fails (defineSecret).
// It is set (Secret Manager versions/1, H.0 console setup) — landmine disarmed.
//
// This SUPERSEDES + DELETES the H.0 tofesMecherConnectivityCheck: it proves the
// identical wiring (Secret → named app → tofes Firestore read) AND does real work
// (the H.0 REPURPOSE-OR-DELETE debt, MASTER_PLAN §8.3, resolved here).
const validateSalesRecordModule = require('./lib/tofes-mecher/validate-sales-record');
exports.validateSalesRecordExists = validateSalesRecordModule.validateSalesRecordExists;

// tofes-mecher Pattern-D analytical export (TS — Phase 2 H.1.c). Scheduled hourly
// CF: reads tofes-mecher sales_records (cross-project) → WRITE_TRUNCATE-loads the
// BigQuery mirror law_office_analytics.sales_records (MAIN project, ADC). Hardened:
// all-or-nothing read, never-truncate-to-empty, reconciliation counts + run audit,
// dead-letter (non-PII), no-PII-in-logs. @google-cloud/bigquery is lazy-imported.
// ⚠️ RUNTIME PREREQUISITE: the Functions runtime SA needs roles/bigquery.dataEditor
// (dataset) + roles/bigquery.jobUser (project) — fails at FIRST RUN, not deploy.
const exportSalesToBigQueryModule = require('./lib/tofes-mecher/export-sales-to-bigquery');
exports.exportSalesToBigQuery = exportSalesToBigQueryModule.exportSalesToBigQuery;

// Profitability — Forecast layer (TS — Phase 2 H.3 PR3). The dynamic per-case
// cost/profit aggregate in the CF-only client_profitability/{caseNumber} collection
// (firestore.rules: read isAdmin()||isPartner(), write false — the cost MUST stay OFF
// the world-readable clients doc, §7.6 / §8.5 D-A).
//   • aggregateClientProfitability — scheduled daily 06:30 (staggered after the
//     dailyInvariantCheck full-client scan). Σ(entry.minutes/60 × snapshot cost),
//     joined by entryId, null≠0, un-costed-coverage %. Admin SDK (bypasses rules).
//   • recomputeProfitability — admin||partner callable: on-demand single-case recompute
//     (the PR4 "refresh now" path). Audit-FIRST (mutation).
//   • getProfitability — admin||partner callable: AUDITED single-case read (the live
//     grid uses onSnapshot directly; this is the audited deliberate fetch).
const forecastAggregationModule = require('./lib/profitability/forecast-aggregation');
exports.aggregateClientProfitability = forecastAggregationModule.aggregateClientProfitability;
const recomputeProfitabilityModule = require('./lib/profitability/recompute-profitability');
exports.recomputeProfitability = recomputeProfitabilityModule.recomputeProfitability;
const getProfitabilityModule = require('./lib/profitability/get-profitability');
exports.getProfitability = getProfitabilityModule.getProfitability;

// Signature-presence check (TS — Phase 2 H.5). Admin-gated v2 onCall: downloads a
// stored fee-agreement (PDF/image) from Storage (Admin SDK) and asks Claude whether
// the page VISUALLY contains a client + a lawyer signature (presence, NOT fraud).
// Returns the two booleans + confidence + Hebrew reasoning + a derived `passed`
// gate for the future H.6 cutover. AUDIT-FIRST/egress-second (the document is sent
// to Anthropic only AFTER a non-PII access audit). @anthropic-ai/sdk is lazy-imported.
// ⚠️ DEPLOY PREREQUISITE: the secret ANTHROPIC_API_KEY must exist in Secret Manager
// BEFORE any functions deploy, else the WHOLE deploy fails (defineSecret) — same
// landmine class as TOFES_MECHER_SA_KEY. See docs/PHASE_2_FOUNDATIONS.md.
// ⚠️ PII EGRESS (H.5 checkpoint): ships as PLUMBING — no live consumer until H.6;
// a DPA / privacy-law basis is an H.6 prerequisite before wiring to real PROD data.
const verifySignaturePresenceModule = require('./lib/signatures/verify-signature-presence');
exports.verifySignaturePresence = verifySignaturePresenceModule.verifySignaturePresence;

// Cutover — deterministic client creation from a tofes-mecher sale (TS — Phase 2
// H.6, the core). Admin-gated v2 onCall: LIVE-reads ONE sales_record via the SSOT
// readSalesRecordSnapshot (the same named-app read + 9-field projection as
// validateSalesRecordExists), then in ONE transaction idempotently creates a
// client + a fixed-price service (fixedPrice = the sale's amountBeforeVat, DLR §8.2.5
// D1) EXACTLY as createClient's `fixed` branch, with plan = computeClientPlan. The
// agreed-fee snapshot lives in the CF-only sales_record_links/{salesRecordId} doc —
// OFF the world-readable clients doc (§7.6 / DLR D-A). Audit-FIRST IN-TXN (the audit
// commits atomically with the create); re-calling for the same sale is a no-op
// ({ created:false }). NO PDF / AI egress here — Option A defers the H.5 signature
// gate to a later H.6 increment.
const createClientFromSalesRecordModule = require('./lib/cutover/create-client-from-sales-record');
exports.createClientFromSalesRecord = createClientFromSalesRecordModule.createClientFromSalesRecord;

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
