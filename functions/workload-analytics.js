/**
 * Workload Analytics Cloud Function
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Purpose: Batch fetch employee workload data (employees, tasks, timesheet)
 * Performance: Reduces N client queries to 1 server-side batch operation
 *
 * Created: 2026-01-15
 * Version: 1.0.0
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Joi = require('joi');

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const MAX_EMPLOYEES_PER_REQUEST = 50;  // Hard limit
const FIRESTORE_IN_LIMIT = 10;         // Firestore 'in' query limit
const ACTIVE_TASK_STATUS = 'פעיל';      // Active task status in Hebrew

// ═══════════════════════════════════════════════════════════════════════
// Input Validation Schema
// ═══════════════════════════════════════════════════════════════════════

const inputSchema = Joi.object({
  employeeEmails: Joi.array()
    .items(Joi.string().email())
    .min(1)
    .max(MAX_EMPLOYEES_PER_REQUEST)
    .required()
});

// ═══════════════════════════════════════════════════════════════════════
// Helper: Chunk array into smaller chunks
// ═══════════════════════════════════════════════════════════════════════

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ═══════════════════════════════════════════════════════════════════════
// Helper: Get start of current month (YYYY-MM-DD)
// ═══════════════════════════════════════════════════════════════════════

function getStartOfMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

// ═══════════════════════════════════════════════════════════════════════
// Main Cloud Function: getTeamWorkloadData
// ═══════════════════════════════════════════════════════════════════════

exports.getTeamWorkloadData = functions.https.onCall(async (data, context) => {
  const startTime = Date.now();

  // ─────────────────────────────────────────────────────────────────────
  // 1. Authentication Check
  // ─────────────────────────────────────────────────────────────────────

  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'משתמש לא מאומת. נדרשת התחברות.'
    );
  }

  const callerEmail = context.auth.token.email;
  console.log(`📊 [Workload Analytics] Request from: ${callerEmail}`);

  // ─────────────────────────────────────────────────────────────────────
  // 2. Authorization Check (Admin Only)
  // ─────────────────────────────────────────────────────────────────────

  const db = admin.firestore();
  const callerDoc = await db.collection('employees').doc(callerEmail).get();

  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'עובד לא נמצא במערכת'
    );
  }

  const callerData = callerDoc.data();

  if (callerData.isActive === false) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'חשבון המשתמש לא פעיל. אנא פנה למנהל המערכת.'
    );
  }

  const isAdmin = callerData.isAdmin === true || callerData.role === 'admin';

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'רק מנהלים יכולים לצפות בניתוח עומס של הצוות'
    );
  }

  console.log(`✅ [Workload Analytics] Admin authorization confirmed for: ${callerEmail}`);

  // ─────────────────────────────────────────────────────────────────────
  // 3. Input Validation
  // ─────────────────────────────────────────────────────────────────────

  const { error, value } = inputSchema.validate(data);

  if (error) {
    console.error('❌ Validation error:', error.details);
    throw new functions.https.HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: ${error.details.map(d => d.message).join(', ')}`
    );
  }

  const { employeeEmails } = value;
  console.log(`📊 Fetching workload data for ${employeeEmails.length} employees`);

  // ─────────────────────────────────────────────────────────────────────
  // 4. Firestore References (db already initialized above)
  // ─────────────────────────────────────────────────────────────────────

  const employeesRef = db.collection('employees');
  const tasksRef = db.collection('budget_tasks');
  const timesheetRef = db.collection('timesheet_entries');

  const result = {
    data: {},
    metadata: {
      requestedCount: employeeEmails.length,
      successCount: 0,
      failedCount: 0,
      queryTime: 0,
      startOfMonth: getStartOfMonth()
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // 5. Chunk employee emails (Firestore 'in' limit = 10)
  // ─────────────────────────────────────────────────────────────────────

  const emailChunks = chunkArray(employeeEmails, FIRESTORE_IN_LIMIT);
  console.log(`📦 Split into ${emailChunks.length} chunks (max ${FIRESTORE_IN_LIMIT} per chunk)`);

  try {
    // ───────────────────────────────────────────────────────────────────
    // 6. Fetch Employees (batched by chunks)
    // ───────────────────────────────────────────────────────────────────

    const employeeSnapshots = await Promise.all(
      emailChunks.map(chunk =>
        employeesRef.where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
      )
    );

    const employeesMap = new Map();
    employeeSnapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        employeesMap.set(doc.id, { email: doc.id, ...doc.data() });
      });
    });

    console.log(`✅ Fetched ${employeesMap.size} employee records`);

    // ───────────────────────────────────────────────────────────────────
    // 7. Fetch Tasks (batched by chunks, filter by status)
    // ───────────────────────────────────────────────────────────────────

    const taskSnapshots = await Promise.all(
      emailChunks.map(chunk =>
        tasksRef.where('employee', 'in', chunk).get()
      )
    );

    const tasksMap = new Map();
    employeeEmails.forEach(email => tasksMap.set(email, []));

    taskSnapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        const taskData = doc.data();
        const employeeEmail = taskData.employee;

        // Filter: only active tasks (status === 'פעיל')
        if (taskData.status === ACTIVE_TASK_STATUS && tasksMap.has(employeeEmail)) {
          tasksMap.get(employeeEmail).push({
            taskId: doc.id,
            ...taskData
          });
        }
      });
    });

    const totalTasks = Array.from(tasksMap.values()).reduce((sum, tasks) => sum + tasks.length, 0);
    console.log(`✅ Fetched ${totalTasks} active tasks (status='${ACTIVE_TASK_STATUS}')`);

    // ───────────────────────────────────────────────────────────────────
    // 8. Fetch Timesheet Entries (batched, filtered by start of month)
    // ───────────────────────────────────────────────────────────────────

    const startOfMonth = getStartOfMonth();

    const timesheetSnapshots = await Promise.all(
      emailChunks.map(chunk =>
        timesheetRef
          .where('employee', 'in', chunk)
          .where('date', '>=', startOfMonth)
          .get()
      )
    );

    const timesheetMap = new Map();
    employeeEmails.forEach(email => timesheetMap.set(email, []));

    timesheetSnapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        const entryData = doc.data();
        const employeeEmail = entryData.employee;

        if (timesheetMap.has(employeeEmail)) {
          timesheetMap.get(employeeEmail).push(entryData);
        }
      });
    });

    const totalEntries = Array.from(timesheetMap.values()).reduce((sum, entries) => sum + entries.length, 0);
    console.log(`✅ Fetched ${totalEntries} timesheet entries (since ${startOfMonth})`);

    // ───────────────────────────────────────────────────────────────────
    // 9. Build Response Data
    // ───────────────────────────────────────────────────────────────────

    employeeEmails.forEach(email => {
      const employee = employeesMap.get(email);
      const tasks = tasksMap.get(email) || [];
      const timesheetEntries = timesheetMap.get(email) || [];

      if (employee) {
        result.data[email] = {
          employee,
          tasks,
          timesheetEntries
        };
        result.metadata.successCount++;
      } else {
        console.warn(`⚠️ Employee not found: ${email}`);
        result.data[email] = {
          employee: null,
          tasks: [],
          timesheetEntries: []
        };
        result.metadata.failedCount++;
      }
    });

    // ───────────────────────────────────────────────────────────────────
    // 10. Finalize Metadata
    // ───────────────────────────────────────────────────────────────────

    const endTime = Date.now();
    result.metadata.queryTime = endTime - startTime;

    console.log(`✅ [Workload Analytics] Completed in ${result.metadata.queryTime}ms`);
    console.log(`   ├─ Success: ${result.metadata.successCount}`);
    console.log(`   ├─ Failed: ${result.metadata.failedCount}`);
    console.log(`   ├─ Tasks: ${totalTasks}`);
    console.log(`   └─ Timesheet: ${totalEntries}`);

    return result;

  } catch (error) {
    console.error('❌ [Workload Analytics] Error:', error);

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בשליפת נתוני עומס: ${error.message}`
    );
  }
});
