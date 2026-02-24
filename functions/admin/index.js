/** Admin Module — ניהול משתמשים, מחיקת נתונים, פעילות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString } = require('../shared/validators');

// Deletion modules
const { validateDeletionRequest, checkRateLimit } = require('../src/deletion/validators');
const { verifyAllOwnership } = require('../src/deletion/ownership');
const { executeDeletion, DELETION_ENABLED } = require('../src/deletion/deletion-engine');
const { logDeletionAttempt, checkSuspiciousActivity } = require('../src/deletion/audit');

// Master Admin Panel Wrappers
const {
  createUser,
  updateUser,
  blockUser,
  deleteUser,
  getUserFullDetails,
  getUserActivity
} = require('./master-admin-wrappers');

const db = admin.firestore();

// ===============================
// Activity Logging & User Tracking
// ===============================

/**
 * רישום פעילות משתמש (Activity Log)
 * נקרא מ-activity-logger.js
 */
const logActivity = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    // Validation
    if (!data.type || typeof data.type !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר סוג פעילות'
      );
    }

    if (!data.action || typeof data.action !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תיאור פעולה'
      );
    }

    // רישום הפעילות
    const activityData = {
      type: sanitizeString(data.type),
      action: sanitizeString(data.action),
      details: data.details ? sanitizeString(JSON.stringify(data.details)) : '',
      userId: user.uid,
      username: user.username,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: data.userAgent || null,
      sessionId: data.sessionId || null
    };

    const docRef = await db.collection('activity_log').add(activityData);

    return {
      success: true,
      activityId: docRef.id
    };

  } catch (error) {
    console.error('Error in logActivity:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ברישום פעילות: ${error.message}`
    );
  }
});

// ===============================
// DELETE USER DATA - מחיקת נתוני משתמש
// ===============================

/**
 * Delete user data (tasks, timesheets, approvals)
 * מחיקת נתוני משתמש (משימות, שעתונים, אישורים)
 */
const deleteUserData = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    // Check admin permissions
    const callerEmail = context.auth.token.email;
    const adminSnapshot = await db.collection('employees').where('email', '==', callerEmail).get();

    if (adminSnapshot.empty) {
      throw new functions.https.HttpsError('permission-denied', 'אין הרשאות מנהל');
    }

    const adminData = adminSnapshot.docs[0].data();
    if (!adminData.isAdmin && adminData.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'אין הרשאות מנהל');
    }

    const { email, deleteTasks, deleteTimesheets, deleteApprovals } = data;

    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'חסר אימייל משתמש');
    }

    console.log(`🗑️ Deleting user data for: ${email}`);
    console.log(`   Tasks: ${deleteTasks}, Timesheets: ${deleteTimesheets}, Approvals: ${deleteApprovals}`);

    let deletedCounts = {
      tasks: 0,
      timesheets: 0,
      approvals: 0
    };

    // Delete budget_tasks
    if (deleteTasks) {
      const tasksQuery = db.collection('budget_tasks').where('employeeEmail', '==', email);
      let tasksSnapshot = await tasksQuery.get();

      while (!tasksSnapshot.empty) {
        const batch = db.batch();
        tasksSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCounts.tasks++;
        });
        await batch.commit();

        // Get next batch
        tasksSnapshot = await tasksQuery.limit(500).get();
      }
      console.log(`✅ Deleted ${deletedCounts.tasks} tasks`);
    }

    // Delete timesheet_entries
    if (deleteTimesheets) {
      const timesheetsQuery = db.collection('timesheet_entries').where('employeeEmail', '==', email);
      let timesheetsSnapshot = await timesheetsQuery.get();

      while (!timesheetsSnapshot.empty) {
        const batch = db.batch();
        timesheetsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCounts.timesheets++;
        });
        await batch.commit();

        // Get next batch
        timesheetsSnapshot = await timesheetsQuery.limit(500).get();
      }
      console.log(`✅ Deleted ${deletedCounts.timesheets} timesheet entries`);
    }

    // Delete pending_task_approvals
    if (deleteApprovals) {
      const approvalsQuery = db.collection('pending_task_approvals').where('requestedBy', '==', email);
      let approvalsSnapshot = await approvalsQuery.get();

      while (!approvalsSnapshot.empty) {
        const batch = db.batch();
        approvalsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCounts.approvals++;
        });
        await batch.commit();

        // Get next batch
        approvalsSnapshot = await approvalsQuery.limit(500).get();
      }
      console.log(`✅ Deleted ${deletedCounts.approvals} task approvals`);
    }

    // Log the action
    await db.collection('audit_log').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      action: 'delete_user_data',
      adminEmail: callerEmail,
      targetEmail: email,
      deletedCounts,
      details: { deleteTasks, deleteTimesheets, deleteApprovals }
    });

    console.log(`✅ User data deleted successfully for: ${email}`);

    return {
      success: true,
      message: 'הנתונים נמחקו בהצלחה',
      deletedCounts
    };

  } catch (error) {
    console.error('❌ Error deleting user data:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'שגיאה במחיקת נתונים'
    );
  }
});

// ===============================
// DELETE USER DATA SELECTIVE - מחיקה סלקטיבית מאובטחת
// 🔒 PHASE 1: READ-ONLY MODE
// ===============================

/**
 * Delete user data selectively (tasks, timesheets, approvals)
 * מחיקה סלקטיבית של נתוני משתמש
 *
 * 🔒 Security Layers:
 * 1. Authentication - אימות
 * 2. Authorization - הרשאות admin בלבד
 * 3. Input Validation - וולידציה מלאה
 * 4. Rate Limiting - מניעת שימוש לרעה
 * 5. Ownership Verification - בדיקת בעלות
 * 6. Transaction Safety - מחיקה מאובטחת
 * 7. Audit Logging - רישום מלא
 *
 * 🚀 PHASE 3: LIMITED DELETE - מחיקה מוגבלת (50 items max)
 */
const deleteUserDataSelective = functions.https.onCall(async (data, context) => {
  const startTime = Date.now();

  try {
    console.log('🚀 =================================');
    console.log('🗑️  DELETE USER DATA SELECTIVE');
    console.log('🚀 PHASE 3: LIMITED DELETE (50 items max)');
    console.log('🚀 =================================');

    // ============================================
    // 🔒 LAYER 1: Authentication Check
    // ============================================
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    const callerEmail = context.auth.token.email;
    const callerUid = context.auth.uid;

    console.log(`👤 Caller: ${callerEmail} (${callerUid})`);

    // ============================================
    // 🔒 LAYER 2: Authorization Check (Admin Only)
    // ============================================
    const adminSnapshot = await db.collection('employees').where('email', '==', callerEmail).get();

    if (adminSnapshot.empty) {
      console.error(`❌ User ${callerEmail} not found in employees collection`);
      throw new functions.https.HttpsError('permission-denied', 'אין הרשאות מנהל');
    }

    const adminData = adminSnapshot.docs[0].data();
    if (!adminData.isAdmin && adminData.role !== 'admin') {
      console.error(`❌ User ${callerEmail} is not admin: isAdmin=${adminData.isAdmin}, role=${adminData.role}`);
      throw new functions.https.HttpsError('permission-denied', 'רק מנהלים יכולים למחוק נתונים');
    }

    console.log(`✅ Admin verified: ${callerEmail}`);

    // ============================================
    // 🔒 LAYER 3: Input Validation
    // ============================================
    const validatedData = validateDeletionRequest(data);
    console.log(`✅ Validation passed: ${validatedData.totalItems} items to process`);

    // ============================================
    // 🔒 LAYER 4: Rate Limiting
    // ============================================
    if (!validatedData.dryRun) {
      const rateLimit = await checkRateLimit(db, callerEmail);
      console.log(`✅ Rate limit check passed: ${rateLimit.remainingInWindow} deletions remaining`);
    }

    // ============================================
    // 🔒 LAYER 5: Suspicious Activity Check
    // ============================================
    const suspiciousCheck = await checkSuspiciousActivity(db, callerEmail);
    if (suspiciousCheck.suspicious) {
      console.warn(`⚠️ Suspicious activity detected for ${callerEmail}`);
      // בשלב זה רק מתריעים, לא חוסמים
    }

    // ============================================
    // 🔒 LAYER 6: Ownership Verification
    // ============================================
    const verifiedOwnership = await verifyAllOwnership(db, validatedData.userEmail, {
      taskIds: validatedData.taskIds,
      timesheetIds: validatedData.timesheetIds,
      approvalIds: validatedData.approvalIds
    });

    console.log(`✅ Ownership verified: ${verifiedOwnership.totalVerified} items belong to ${validatedData.userEmail}`);

    // ============================================
    // 🔒 LAYER 7: Execute Deletion (or Dry Run)
    // ============================================
    const result = await executeDeletion(db, verifiedOwnership, validatedData.dryRun);

    // ============================================
    // 🔒 LAYER 8: Audit Logging
    // ============================================
    await logDeletionAttempt(db, {
      adminEmail: callerEmail,
      userEmail: validatedData.userEmail,
      requestData: {
        ...validatedData,
        adminUid: callerUid
      },
      verifiedOwnership,
      result,
      dryRun: validatedData.dryRun,
      success: true
    });

    const executionTime = Date.now() - startTime;

    console.log('🚀 =================================');
    console.log(`✅ SUCCESS (${executionTime}ms)`);
    console.log(`   Mode: ${validatedData.dryRun ? 'DRY RUN' : 'REAL DELETION'}`);
    console.log(`   Items: ${result.deletedCounts.total}`);
    console.log('🚀 =================================');

    // ============================================
    // Response
    // ============================================
    return {
      success: true,
      dryRun: validatedData.dryRun,
      phase: 'phase_3_limited',
      deletionEnabled: DELETION_ENABLED,
      message: validatedData.dryRun
        ? `✅ Preview: ${result.deletedCounts.total} פריטים יימחקו`
        : `✅ נמחקו ${result.deletedCounts.total} פריטים${result.deletedCounts.orphanedApprovals ? ` (כולל ${result.deletedCounts.orphanedApprovals} orphaned approvals)` : ''}`,
      deletedCounts: result.deletedCounts,
      preview: result.preview,
      executionTime: `${executionTime}ms`
    };

  } catch (error) {
    console.error('❌ Error in deleteUserDataSelective:', error);

    // רישום שגיאה ב-audit log
    try {
      await logDeletionAttempt(db, {
        adminEmail: context.auth?.token?.email || 'unknown',
        userEmail: data?.userEmail || 'unknown',
        requestData: data || {},
        verifiedOwnership: {},
        result: null,
        dryRun: data?.dryRun || false,
        success: false,
        error
      });
    } catch (auditError) {
      console.error('❌ Failed to log error to audit:', auditError);
    }

    // זריקת השגיאה הלאה
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'שגיאה במחיקת נתונים'
    );
  }
});

module.exports = {
  // Master Admin Panel Wrappers
  createUser,
  updateUser,
  blockUser,
  deleteUser,
  getUserFullDetails,
  getUserActivity,
  // Admin operations
  logActivity,
  deleteUserData,
  deleteUserDataSelective
};
