/**
 * Ownership Verification Module
 * מודול בדיקת בעלות
 *
 * 🔒 Security Layer 5: Ownership Verification
 * כל פריט נבדק שהוא שייך למשתמש הנכון לפני מחיקה
 */

const functions = require('firebase-functions');

/**
 * Verify task ownership
 * בדיקת בעלות על משימה
 *
 * @returns {Object} { verified: [], rejected: [] }
 */
async function verifyTaskOwnership(db, userEmail, taskIds) {
  if (!taskIds || taskIds.length === 0) {
    return { verified: [], rejected: [] };
  }

  console.log(`🔍 Verifying ownership of ${taskIds.length} tasks for ${userEmail}`);

  const verified = [];
  const rejected = [];

  // בדיקה ב-batches של 10 (Firestore 'in' מגבלה)
  const batchSize = 10;
  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batch = taskIds.slice(i, i + batchSize);

    const tasksSnapshot = await db.collection('budget_tasks')
      .where('__name__', 'in', batch)
      .get();

    // בדיקה שכל task קיים ושייך למשתמש
    for (const taskId of batch) {
      const taskDoc = tasksSnapshot.docs.find(doc => doc.id === taskId);

      if (!taskDoc) {
        console.warn(`⚠️ Task ${taskId} not found`);
        rejected.push({
          id: taskId,
          reason: 'לא נמצא במערכת'
        });
        continue;
      }

      const taskData = taskDoc.data();

      // בדיקה שהמשימה שייכת למשתמש הנכון
      if (taskData.employeeEmail !== userEmail) {
        console.warn(`⚠️ Task ${taskId} belongs to ${taskData.employeeEmail}, not ${userEmail}`);
        rejected.push({
          id: taskId,
          reason: `שייך למשתמש ${taskData.employeeEmail}`,
          actualOwner: taskData.employeeEmail
        });
        continue;
      }

      // אישור - שייך למשתמש הנכון
      verified.push({
        id: taskId,
        data: taskData
      });
    }
  }

  console.log(`✅ Verified ${verified.length} tasks, rejected ${rejected.length}`);

  return { verified, rejected };
}

/**
 * Verify timesheet ownership
 * בדיקת בעלות על שעתונים
 */
async function verifyTimesheetOwnership(db, userEmail, timesheetIds) {
  if (!timesheetIds || timesheetIds.length === 0) {
    return { verified: [], rejected: [] };
  }

  console.log(`🔍 Verifying ownership of ${timesheetIds.length} timesheets for ${userEmail}`);

  const verified = [];
  const rejected = [];

  // בדיקה ב-batches של 10
  const batchSize = 10;
  for (let i = 0; i < timesheetIds.length; i += batchSize) {
    const batch = timesheetIds.slice(i, i + batchSize);

    const timesheetsSnapshot = await db.collection('timesheet_entries')
      .where('__name__', 'in', batch)
      .get();

    for (const timesheetId of batch) {
      const timesheetDoc = timesheetsSnapshot.docs.find(doc => doc.id === timesheetId);

      if (!timesheetDoc) {
        console.warn(`⚠️ Timesheet ${timesheetId} not found`);
        rejected.push({
          id: timesheetId,
          reason: 'לא נמצא במערכת'
        });
        continue;
      }

      const timesheetData = timesheetDoc.data();

      // בדיקה שהשעתון שייך למשתמש הנכון
      if (timesheetData.employeeEmail !== userEmail) {
        console.warn(`⚠️ Timesheet ${timesheetId} belongs to ${timesheetData.employeeEmail}, not ${userEmail}`);
        rejected.push({
          id: timesheetId,
          reason: `שייך למשתמש ${timesheetData.employeeEmail}`,
          actualOwner: timesheetData.employeeEmail
        });
        continue;
      }

      verified.push({
        id: timesheetId,
        data: timesheetData
      });
    }
  }

  console.log(`✅ Verified ${verified.length} timesheets, rejected ${rejected.length}`);

  return { verified, rejected };
}

/**
 * Verify approval ownership
 * בדיקת בעלות על אישורים
 */
async function verifyApprovalOwnership(db, userEmail, approvalIds) {
  if (!approvalIds || approvalIds.length === 0) {
    return { verified: [], rejected: [] };
  }

  console.log(`🔍 Verifying ownership of ${approvalIds.length} approvals for ${userEmail}`);

  const verified = [];
  const rejected = [];

  const batchSize = 10;
  for (let i = 0; i < approvalIds.length; i += batchSize) {
    const batch = approvalIds.slice(i, i + batchSize);

    const approvalsSnapshot = await db.collection('pending_task_approvals')
      .where('__name__', 'in', batch)
      .get();

    for (const approvalId of batch) {
      const approvalDoc = approvalsSnapshot.docs.find(doc => doc.id === approvalId);

      if (!approvalDoc) {
        console.warn(`⚠️ Approval ${approvalId} not found`);
        rejected.push({
          id: approvalId,
          reason: 'לא נמצא במערכת'
        });
        continue;
      }

      const approvalData = approvalDoc.data();

      // בדיקה שהאישור שייך למשתמש הנכון
      if (approvalData.requestedBy !== userEmail) {
        console.warn(`⚠️ Approval ${approvalId} belongs to ${approvalData.requestedBy}, not ${userEmail}`);
        rejected.push({
          id: approvalId,
          reason: `שייך למשתמש ${approvalData.requestedBy}`,
          actualOwner: approvalData.requestedBy
        });
        continue;
      }

      verified.push({
        id: approvalId,
        data: approvalData
      });
    }
  }

  console.log(`✅ Verified ${verified.length} approvals, rejected ${rejected.length}`);

  return { verified, rejected };
}

/**
 * Verify all ownership
 * בדיקת בעלות על כל הפריטים
 */
async function verifyAllOwnership(db, userEmail, { taskIds, timesheetIds, approvalIds }) {
  console.log(`🔒 Starting ownership verification for ${userEmail}`);

  const [tasks, timesheets, approvals] = await Promise.all([
    verifyTaskOwnership(db, userEmail, taskIds),
    verifyTimesheetOwnership(db, userEmail, timesheetIds),
    verifyApprovalOwnership(db, userEmail, approvalIds)
  ]);

  const totalRejected = tasks.rejected.length + timesheets.rejected.length + approvals.rejected.length;
  const totalVerified = tasks.verified.length + timesheets.verified.length + approvals.verified.length;

  // אם יש פריטים שנדחו - זרוק שגיאה
  if (totalRejected > 0) {
    const rejectionDetails = {
      tasks: tasks.rejected,
      timesheets: timesheets.rejected,
      approvals: approvals.rejected
    };

    console.error(`❌ Ownership verification failed: ${totalRejected} items rejected`);
    console.error('Rejection details:', JSON.stringify(rejectionDetails, null, 2));

    throw new functions.https.HttpsError(
      'permission-denied',
      `בדיקת בעלות נכשלה: ${totalRejected} פריטים לא שייכים למשתמש ${userEmail}`,
      rejectionDetails
    );
  }

  console.log(`✅ Ownership verification passed: ${totalVerified} items verified`);

  return {
    tasks: tasks.verified,
    timesheets: timesheets.verified,
    approvals: approvals.verified,
    totalVerified
  };
}

module.exports = {
  verifyTaskOwnership,
  verifyTimesheetOwnership,
  verifyApprovalOwnership,
  verifyAllOwnership
};
