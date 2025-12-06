/**
 * בדיקת נתוני משימות
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTasks() {
  try {
    const snapshot = await db.collection('budget_tasks')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📋 BUDGET TASKS');
    console.log('═══════════════════════════════════════════════════\n');

    snapshot.forEach((doc, idx) => {
      const data = doc.data();

      console.log(`[${idx + 1}] ${doc.id}`);
      console.log(`   Client: ${data.clientName}`);
      console.log(`   Service ID: ${data.serviceId || 'N/A'}`);
      console.log(`   Service Name: ${data.serviceName || 'N/A'}`);
      console.log(`   Service Type: ${data.serviceType || 'N/A'}`);
      console.log(`   Parent Service ID: ${data.parentServiceId || 'N/A'}`);
      console.log(`   Actual Minutes: ${data.actualMinutes || 0}`);
      console.log(`   Time Entries Count: ${data.timeEntries?.length || 0}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTasks();
