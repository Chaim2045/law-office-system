/**
 * Audit Logging Module
 * מודול רישום מבקר
 *
 * 🔒 Security Layer 6: Audit Log
 * כל פעולה נרשמת במלואה למעקב ואחריות
 */

const admin = require('firebase-admin');

/**
 * Log deletion attempt
 * רישום ניסיון מחיקה
 */
async function logDeletionAttempt(db, {
  adminEmail,
  userEmail,
  requestData,
  verifiedOwnership,
  result,
  dryRun,
  success,
  error = null
}) {
  try {
    const logEntry = {
      // Metadata
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      action: 'delete_user_data_selective',
      phase: 'phase_1_readonly', // ← יעודכן בהמשך

      // Who
      adminEmail,
      adminUid: requestData.adminUid || null,

      // What
      targetUserEmail: userEmail,
      requestedItems: {
        taskIds: requestData.taskIds || [],
        timesheetIds: requestData.timesheetIds || [],
        approvalIds: requestData.approvalIds || []
      },

      // Verified ownership
      verifiedItems: {
        tasks: verifiedOwnership.tasks?.length || 0,
        timesheets: verifiedOwnership.timesheets?.length || 0,
        approvals: verifiedOwnership.approvals?.length || 0,
        total: verifiedOwnership.totalVerified || 0
      },

      // Result
      deletedCounts: result?.deletedCounts || {
        tasks: 0,
        timesheets: 0,
        approvals: 0,
        total: 0
      },

      // Flags
      dryRun,
      success,

      // Error (if any)
      error: error ? {
        code: error.code || 'unknown',
        message: error.message || 'Unknown error',
        details: error.details || null
      } : null,

      // Security metadata
      ipAddress: requestData.ipAddress || null,
      userAgent: requestData.userAgent || null
    };

    const docRef = await db.collection('audit_log').add(logEntry);

    console.log(`📝 Audit log created: ${docRef.id}`);

    // אם זו מחיקה אמיתית (לא dry run) - רשום גם ב-deletion_metrics
    if (!dryRun && success) {
      await updateDeletionMetrics(db, adminEmail, result.deletedCounts);
    }

    return docRef.id;

  } catch (error) {
    console.error('❌ Failed to write audit log:', error);
    // אל תזרוק שגיאה - audit log לא צריך לבלום את התהליך
    return null;
  }
}

/**
 * Update deletion metrics
 * עדכון מדדי מחיקה
 */
async function updateDeletionMetrics(db, adminEmail, deletedCounts) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const metricsRef = db.collection('deletion_metrics').doc(`daily_${today}`);

    await metricsRef.set({
      date: today,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      totalDeletions: admin.firestore.FieldValue.increment(1),
      totalItems: admin.firestore.FieldValue.increment(deletedCounts.total || 0),
      itemsByType: {
        tasks: admin.firestore.FieldValue.increment(deletedCounts.tasks || 0),
        timesheets: admin.firestore.FieldValue.increment(deletedCounts.timesheets || 0),
        approvals: admin.firestore.FieldValue.increment(deletedCounts.approvals || 0)
      },
      adminEmails: admin.firestore.FieldValue.arrayUnion(adminEmail)
    }, { merge: true });

    console.log(`📊 Deletion metrics updated for ${today}`);

  } catch (error) {
    console.error('❌ Failed to update deletion metrics:', error);
  }
}

/**
 * Check for suspicious activity
 * בדיקת פעילות חשודה
 */
async function checkSuspiciousActivity(db, adminEmail) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentDeletions = await db.collection('audit_log')
    .where('adminEmail', '==', adminEmail)
    .where('action', '==', 'delete_user_data_selective')
    .where('timestamp', '>', oneHourAgo)
    .where('dryRun', '==', false)
    .get();

  let totalItemsDeleted = 0;
  recentDeletions.forEach(doc => {
    const data = doc.data();
    totalItemsDeleted += (data.deletedCounts?.total || 0);
  });

  // אם נמחקו יותר מ-1000 פריטים בשעה - זה חשוד
  if (totalItemsDeleted > 1000) {
    console.warn(`🚨 Suspicious activity detected: ${adminEmail} deleted ${totalItemsDeleted} items in the last hour`);

    await db.collection('deletion_metrics').doc('alerts').set({
      lastAlert: admin.firestore.FieldValue.serverTimestamp(),
      alerts: admin.firestore.FieldValue.arrayUnion({
        timestamp: new Date(),
        adminEmail,
        itemsDeleted: totalItemsDeleted,
        period: 'last_hour',
        severity: 'high'
      })
    }, { merge: true });

    return {
      suspicious: true,
      itemsDeleted: totalItemsDeleted,
      period: 'last_hour'
    };
  }

  return {
    suspicious: false
  };
}

/**
 * Get admin deletion history
 * קבלת היסטוריית מחיקות של מנהל
 */
async function getAdminDeletionHistory(db, adminEmail, limit = 50) {
  const snapshot = await db.collection('audit_log')
    .where('adminEmail', '==', adminEmail)
    .where('action', '==', 'delete_user_data_selective')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

module.exports = {
  logDeletionAttempt,
  updateDeletionMetrics,
  checkSuspiciousActivity,
  getAdminDeletionHistory
};
