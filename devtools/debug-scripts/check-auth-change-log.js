const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAuthChangeLog() {
  try {
    console.log('\n=== חיפוש פעולות שינוי Auth ===\n');

    // Get all audit logs in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const auditSnapshot = await db.collection('audit_log')
      .where('timestamp', '>', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .orderBy('timestamp', 'desc')
      .get();

    const authLogs = [];

    auditSnapshot.forEach(doc => {
      const data = doc.data();

      // Filter for Auth-related actions
      if (
        data.action.includes('AUTH') ||
        data.action.includes('PASSWORD') ||
        data.action.includes('LINK') ||
        data.action.includes('CREATE_USER') ||
        data.action.includes('UPDATE_USER')
      ) {
        authLogs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate()
        });
      }
    });

    console.log(`מצאתי ${authLogs.length} פעולות Auth:\n`);

    authLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.action} - ${log.timestamp}`);
      console.log(`   By: ${log.username} (${log.userId})`);
      console.log('   Details:', JSON.stringify(log.details, null, 2));
      console.log('');
    });

    // Check if there are any that mention the two UIDs we found
    console.log('\n🔍 חיפוש לפי UIDs ספציפיים:');
    console.log('   UID ישן: MljNwI8IK9dnd3p8mC0cxTp3yUD3');
    console.log('   UID חדש: Chh0wGc6EZZyOytdISQEq29Yo7v2\n');

    const uidLogs = authLogs.filter(log => {
      const detailsStr = JSON.stringify(log.details);
      return detailsStr.includes('MljNwI8IK9dnd3p8mC0cxTp3yUD3') ||
             detailsStr.includes('Chh0wGc6EZZyOytdISQEq29Yo7v2');
    });

    if (uidLogs.length > 0) {
      console.log(`נמצאו ${uidLogs.length} לוגים עם ה-UIDs:\n`);
      uidLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.action} - ${log.timestamp}`);
        console.log('   Details:', JSON.stringify(log.details, null, 2));
      });
    } else {
      console.log('❌ לא נמצאו לוגים עם ה-UIDs האלה');
    }

  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkAuthChangeLog();
