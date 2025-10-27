const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkData() {
  console.log('='.repeat(60));
  console.log('CHECKING TIMESHEET DATA');
  console.log('='.repeat(60));

  // Check timesheet_entries
  console.log('\n1. Checking timesheet_entries collection...\n');
  const timesheetSnapshot = await db.collection('timesheet_entries').limit(10).get();
  console.log(`   Total entries found: ${timesheetSnapshot.size}`);

  if (timesheetSnapshot.size > 0) {
    console.log('\n   Sample entries:');
    timesheetSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ID: ${doc.id}`);
      console.log(`     Action: ${data.action || 'N/A'}`);
      console.log(`     Minutes: ${data.minutes || 0}`);
      console.log(`     Type: ${data.isInternal ? 'Internal' : 'Client work'}`);
      console.log(`     Employee: ${data.employee || 'N/A'}`);
      console.log(`     Client: ${data.clientName || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('   ❌ NO TIMESHEET ENTRIES FOUND!\n');
  }

  // Check budget_tasks with time tracking
  console.log('='.repeat(60));
  console.log('\n2. Checking budget_tasks for time tracking...\n');
  const tasksSnapshot = await db.collection('budget_tasks').limit(10).get();
  console.log(`   Total tasks found: ${tasksSnapshot.size}`);

  let tasksWithTime = 0;
  let totalActualMinutes = 0;

  if (tasksSnapshot.size > 0) {
    console.log('\n   Sample tasks:');
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      const timeEntries = data.timeEntries || [];
      const actualMinutes = data.actualMinutes || 0;

      if (timeEntries.length > 0 || actualMinutes > 0) {
        tasksWithTime++;
        totalActualMinutes += actualMinutes;

        console.log(`   - ID: ${doc.id}`);
        console.log(`     Description: ${data.description || 'N/A'}`);
        console.log(`     Client: ${data.clientName || 'N/A'}`);
        console.log(`     Time entries: ${timeEntries.length}`);
        console.log(`     Actual minutes: ${actualMinutes}`);
        console.log('');
      }
    });

    console.log(`   Tasks with time tracking: ${tasksWithTime}`);
    console.log(`   Total minutes tracked in tasks: ${totalActualMinutes}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Timesheet entries: ${timesheetSnapshot.size}`);
  console.log(`Budget tasks: ${tasksSnapshot.size}`);
  console.log(`Tasks with time: ${tasksWithTime}`);
  console.log('='.repeat(60));
}

checkData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
  });
