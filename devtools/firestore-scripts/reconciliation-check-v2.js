/**
 * DATA RECONCILIATION CHECK V2
 *
 * PURPOSE: Check if missing hours are in budget_tasks.timeEntries
 * - clients.services[].hoursUsed (aggregated field)
 * - SUM(timesheet_entries.minutes) grouped by clientId + serviceId
 * - SUM(budget_tasks.timeEntries[].minutes) grouped by clientId
 *
 * This script does NOT write to Firestore.
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

// The 25 clients/services with discrepancies from previous check
const DISCREPANCIES = [
  { clientId: '2025003', serviceId: 'srv_1765051135369', serviceName: 'תוכנית שעות #1', hoursUsed: 64.05 },
  { clientId: '2025003', serviceId: 'srv_1765051737568', serviceName: 'בדיקת יסדית', hoursUsed: 0.18 },
  { clientId: '2025003', serviceId: 'srv_1765068180809', serviceName: 'בדיקת יסדית', hoursUsed: 8.40 },
  { clientId: '2025006', serviceId: 'srv_1765177554252', serviceName: 'תוכנית שעות #1', hoursUsed: 70.80 },
  { clientId: '2025006', serviceId: 'srv_1769776553488', serviceName: 'תיק מקרקעין - אכיפת הסכם', hoursUsed: 3.33 },
  { clientId: '2025009', serviceId: 'srv_1769010030109', serviceName: 'הליך בוררות', hoursUsed: 3.00 },
  { clientId: '2025011', serviceId: 'srv_1766574628760', serviceName: 'תוכנית שעות #1', hoursUsed: 39.92 },
  { clientId: '2025016', serviceId: 'srv_legal_1766579367037', serviceName: 'תביעה נגד בר שלטון', hoursUsed: 2.02 },
  { clientId: '2025018', serviceId: 'srv_legal_1766579485089', serviceName: 'תביעה ותביעה שכנגד', hoursUsed: 18.33 },
  { clientId: '2025366', serviceId: 'srv_legal_1765663005620', serviceName: 'תביעת מקרקעין', hoursUsed: 62.25 },
  { clientId: '2025430', serviceId: 'srv_1765299566466', serviceName: 'תוכנית שעות #1', hoursUsed: 2.38 },
  { clientId: '2025549', serviceId: 'srv_1766392968349', serviceName: 'תוכנית שעות #1', hoursUsed: 30.00 },
  { clientId: '2025634', serviceId: 'srv_1765273248005', serviceName: 'תוכנית שעות #1', hoursUsed: 17.97 },
  { clientId: '2025863', serviceId: 'srv_1765464200615', serviceName: 'תוכנית שעות #1', hoursUsed: 17.82 },
  { clientId: '2025863', serviceId: 'srv_1765464802356', serviceName: 'כתב הגנה ותביעה שכנגד', hoursUsed: 20.38 },
  { clientId: '2025994', serviceId: 'srv_legal_1765742557141', serviceName: 'תביעה', hoursUsed: 22.58 },
  { clientId: '2025994', serviceId: 'srv_1768299874412', serviceName: 'כתב הגנה - סכסוך שכנים', hoursUsed: 21.42 },
  { clientId: '2025998', serviceId: 'srv_1765746948255', serviceName: 'תוכנית שעות #1', hoursUsed: 21.02 },
  { clientId: '2026002', serviceId: 'srv_legal_1767457338563', serviceName: 'הליך משפטי כתב הגנה + תביעה שכנגד', hoursUsed: 15.00 },
  { clientId: '2026008', serviceId: 'srv_1767719279651', serviceName: 'תוכנית שעות #1', hoursUsed: 62.48 },
  { clientId: '2026015', serviceId: 'srv_legal_1769065533271', serviceName: 'תביעת עובד דיני עבודה', hoursUsed: 34.00 },
  { clientId: '2026018', serviceId: 'srv_legal_1769066470209', serviceName: 'תביעת נדלן', hoursUsed: 4.50 },
  { clientId: '2026019', serviceId: 'srv_1769066811801', serviceName: 'תוכנית שעות #1', hoursUsed: 6.67 },
  { clientId: '2026022', serviceId: 'srv_1769416212328', serviceName: 'תוכנית שעות #1', hoursUsed: 6.60 },
  { clientId: '2026030', serviceId: 'srv_1770059800343', serviceName: 'תוכנית שעות #1', hoursUsed: 0.13 }
];

async function checkReconciliationV2() {
  console.log('🔍 Starting Reconciliation Check V2 - Including budget_tasks.timeEntries\n');

  try {
    let resolvedCount = 0;
    let stillMismatchCount = 0;
    let noSourcesCount = 0;

    for (const item of DISCREPANCIES) {
      const { clientId, serviceId, serviceName, hoursUsed } = item;

      // Step 1: Get timesheet_entries for this clientId + serviceId
      const timesheetQuery = await db.collection('timesheet_entries')
        .where('clientId', '==', clientId)
        .where('serviceId', '==', serviceId)
        .get();

      let timesheetMinutes = 0;
      const timesheetTaskIds = new Set();

      timesheetQuery.forEach(doc => {
        const entry = doc.data();
        timesheetMinutes += entry.minutes || 0;
        if (entry.taskId) {
          timesheetTaskIds.add(entry.taskId);
        }
      });

      // Step 2: Get budget_tasks for this clientId
      const tasksQuery = await db.collection('budget_tasks')
        .where('clientId', '==', clientId)
        .get();

      let taskMinutes = 0;
      let taskEntriesCount = 0;

      tasksQuery.forEach(doc => {
        const task = doc.data();
        const taskId = doc.id;

        // Skip if this task's time is already counted in timesheet_entries
        if (timesheetTaskIds.has(taskId)) {
          return;
        }

        // Count timeEntries that are NOT already in timesheet
        if (task.timeEntries && Array.isArray(task.timeEntries)) {
          task.timeEntries.forEach(entry => {
            taskMinutes += entry.minutes || 0;
            taskEntriesCount++;
          });
        }
      });

      // Step 3: Calculate totals
      const hoursFromTimesheet = timesheetMinutes / 60;
      const hoursFromTasks = taskMinutes / 60;
      const hoursCombined = (timesheetMinutes + taskMinutes) / 60;
      const remainingDifference = Math.abs(hoursUsed - hoursCombined);
      const tolerance = 0.01;

      // Step 4: Categorize
      if (timesheetQuery.size === 0 && tasksQuery.size === 0) {
        noSourcesCount++;
      } else if (remainingDifference <= tolerance) {
        resolvedCount++;
      } else {
        stillMismatchCount++;
      }

      // Step 5: Print
      console.log(`📊 Client: ${clientId}`);
      console.log(`   Service: ${serviceName} (${serviceId})`);
      console.log(`   hoursUsed in card: ${hoursUsed.toFixed(2)}`);
      console.log(`   Hours from timesheet_entries: ${hoursFromTimesheet.toFixed(2)} (${timesheetQuery.size} entries)`);
      console.log(`   Hours from budget_tasks.timeEntries: ${hoursFromTasks.toFixed(2)} (${taskEntriesCount} entries, ${tasksQuery.size} tasks)`);
      console.log(`   Combined total: ${hoursCombined.toFixed(2)}`);
      console.log(`   Remaining difference: ${remainingDifference.toFixed(2)}`);

      if (remainingDifference <= tolerance) {
        console.log('   ✅ RESOLVED by including budget_tasks');
      } else if (timesheetQuery.size === 0 && tasksQuery.size === 0) {
        console.log('   ⚠️  NO SOURCES - requires manual investigation');
      } else {
        console.log('   ❌ STILL MISMATCH');
      }
      console.log('');
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 RECONCILIATION V2 SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total services checked: ${DISCREPANCIES.length}`);
    console.log(`Resolved (gap = 0 after including budget_tasks): ${resolvedCount}`);
    console.log(`Still with gap: ${stillMismatchCount}`);
    console.log(`No sources at all (0 timesheet + 0 tasks): ${noSourcesCount}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during reconciliation check v2:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

checkReconciliationV2()
  .then(() => {
    console.log('\n✅ Reconciliation check v2 completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Reconciliation check v2 failed:', error);
    process.exit(1);
  });
