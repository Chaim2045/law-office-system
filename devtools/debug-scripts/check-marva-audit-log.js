const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkMarvaAuditLog() {
  try {
    console.log('\n=== בדיקת Audit Log של marva ===\n');

    // Get all audit logs related to marva (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const auditSnapshot = await db.collection('audit_log')
      .where('timestamp', '>', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .orderBy('timestamp', 'desc')
      .get();

    const marvaLogs = [];

    auditSnapshot.forEach(doc => {
      const data = doc.data();
      const detailsStr = JSON.stringify(data.details || {});

      // Filter for marva-related logs
      if (
        detailsStr.includes('marva') ||
        data.userId === 'marva@ghlawoffice.co.il' ||
        data.username === 'מרווה'
      ) {
        marvaLogs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate()
        });
      }
    });

    console.log(`מצאתי ${marvaLogs.length} פעולות הקשורות למרווה:\n`);

    marvaLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.action} - ${log.timestamp}`);
      console.log(`   User: ${log.username} (${log.userId})`);
      console.log('   Details:', JSON.stringify(log.details, null, 2));
      console.log('');
    });

    // Look specifically for LINK_AUTH_TO_EMPLOYEE or UPDATE_EMPLOYEE_AUTH
    const authLogs = marvaLogs.filter(log =>
      log.action.includes('AUTH') ||
      log.action.includes('LINK') ||
      log.action.includes('PASSWORD')
    );

    if (authLogs.length > 0) {
      console.log('\n🔐 פעולות Auth/Link ספציפיות:');
      authLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.action} - ${log.timestamp}`);
        console.log('   Details:', JSON.stringify(log.details, null, 2));
      });
    }

  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkMarvaAuditLog();
