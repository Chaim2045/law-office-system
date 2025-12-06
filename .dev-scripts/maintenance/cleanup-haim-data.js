const admin = require('firebase-admin');

// Initialize admin without explicit credentials (will use environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const haimUserId = 'xrOVgsWlIYdBWHn60hXBvVODQ3z1';

async function cleanupHaimData() {
  console.log('🔍 Checking Haim\'s data...\n');

  try {
    // קבלת כל הלקוחות
    const clientsSnapshot = await db.collection('users').doc(haimUserId).collection('clients').get();
    console.log(`Found ${clientsSnapshot.size} clients:`);

    let ehudWalterClient = null;
    const clientsToDelete = [];

    clientsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.name} (${doc.id})`);

      if (data.name && data.name.includes('אהוד') && data.name.includes('ולטר')) {
        ehudWalterClient = { id: doc.id, ...data };
        console.log('    ✅ KEEPING (real client)');
      } else {
        clientsToDelete.push({ id: doc.id, name: data.name });
        console.log('    ❌ WILL DELETE (test data)');
      }
    });

    // קבלת כל השעתונים
    const timesheetsSnapshot = await db.collection('users').doc(haimUserId).collection('timesheets').get();
    console.log(`\nFound ${timesheetsSnapshot.size} timesheets - ALL WILL BE DELETED`);

    // קבלת כל המשימות
    const tasksSnapshot = await db.collection('users').doc(haimUserId).collection('tasks').get();
    console.log(`Found ${tasksSnapshot.size} tasks - ALL WILL BE DELETED\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Summary:');
    console.log(`  Clients to DELETE: ${clientsToDelete.length}`);
    console.log(`  Clients to KEEP: ${ehudWalterClient ? 1 : 0}`);
    console.log(`  Timesheets to DELETE: ${timesheetsSnapshot.size}`);
    console.log(`  Tasks to DELETE: ${tasksSnapshot.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('⚠️  Are you sure you want to proceed? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Cleanup cancelled.');
        readline.close();
        process.exit(0);
      }

      console.log('\n🗑️  Starting cleanup...\n');

      // מחיקת לקוחות (מלבד אהוד ולטר)
      let deletedClients = 0;
      for (const client of clientsToDelete) {
        try {
          await db.collection('users').doc(haimUserId).collection('clients').doc(client.id).delete();
          console.log(`✅ Deleted client: ${client.name}`);
          deletedClients++;
        } catch (error) {
          console.error(`❌ Error deleting client ${client.name}:`, error.message);
        }
      }

      // מחיקת שעתונים
      let deletedTimesheets = 0;
      for (const doc of timesheetsSnapshot.docs) {
        try {
          await db.collection('users').doc(haimUserId).collection('timesheets').doc(doc.id).delete();
          console.log(`✅ Deleted timesheet: ${doc.id}`);
          deletedTimesheets++;
        } catch (error) {
          console.error(`❌ Error deleting timesheet ${doc.id}:`, error.message);
        }
      }

      // מחיקת משימות
      let deletedTasks = 0;
      for (const doc of tasksSnapshot.docs) {
        try {
          await db.collection('users').doc(haimUserId).collection('tasks').doc(doc.id).delete();
          console.log(`✅ Deleted task: ${doc.id}`);
          deletedTasks++;
        } catch (error) {
          console.error(`❌ Error deleting task ${doc.id}:`, error.message);
        }
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✨ Cleanup completed!');
      console.log(`  Deleted ${deletedClients} clients`);
      console.log(`  Deleted ${deletedTimesheets} timesheets`);
      console.log(`  Deleted ${deletedTasks} tasks`);
      if (ehudWalterClient) {
        console.log(`  Kept client: ${ehudWalterClient.name}`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      readline.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupHaimData().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
