/**
 * ========================================
 * Admin API - Main Entry Point
 * ========================================
 * ייצוא כל ה-Admin Cloud Functions
 *
 * Usage:
 * העתק קובץ זה ל-functions/admin/index.js
 * ואז ב-functions/index.js הוסף:
 * exports.admin = require('./admin');
 *
 * @version 1.0.0
 * @date 2025-10-23
 */

// ייבוא כל המודולים
const users = require('./users');
const tasks = require('./tasks');
const notifications = require('./notifications');

// ==================== Users Management ====================
exports.adminCreateUser = users.adminCreateUser;
exports.adminBlockUser = users.adminBlockUser;
exports.adminUnblockUser = users.adminUnblockUser;
exports.adminDeleteUser = users.adminDeleteUser;
exports.adminUpdateUserRole = users.adminUpdateUserRole;
exports.adminResetPassword = users.adminResetPassword;

// ==================== Tasks Management ====================
exports.adminTransferTask = tasks.adminTransferTask;
exports.adminBulkTransferTasks = tasks.adminBulkTransferTasks;
exports.adminDeleteTask = tasks.adminDeleteTask;
exports.adminCompleteTask = tasks.adminCompleteTask;
exports.adminUpdateTaskDeadline = tasks.adminUpdateTaskDeadline;

// ==================== Notifications ====================
exports.adminSendNotification = notifications.adminSendNotification;
exports.adminBroadcastNotification = notifications.adminBroadcastNotification;
exports.adminSendTaskReminder = notifications.adminSendTaskReminder;

// ==================== Summary ====================
console.log('✅ Admin API loaded - 14 functions available');
console.log('📦 Functions groups:');
console.log('   - Users Management: 6 functions');
console.log('   - Tasks Management: 5 functions');
console.log('   - Notifications: 3 functions');
