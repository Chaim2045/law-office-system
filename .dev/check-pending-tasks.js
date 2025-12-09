const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'law-office-system-e4801'
  });
}

const db = admin.firestore();

async function checkPendingTasks() {
  console.log('🔍 בודק משימות עם סטטוס pending_approval...\n');

  try {
    // בדיקה 1: משימות עם סטטוס pending_approval
    const pendingTasks = await db.collection('budget_tasks')
      .where('status', '==', 'pending_approval')
      .get();

    console.log(`📊 נמצאו ${pendingTasks.size} משימות עם סטטוס pending_approval:`);
    pendingTasks.forEach(doc => {
      const data = doc.data();
      console.log(`  - ID: ${doc.id}`);
      console.log(`    תיאור: ${data.description || data.taskDescription}`);
      console.log(`    עובד: ${data.employee}`);
      console.log(`    נוצר: ${data.createdAt?.toDate()}`);
      console.log('');
    });

    // בדיקה 2: בקשות אישור תלויות
    console.log('\n🔍 בודק בקשות אישור ב-pending_task_approvals...\n');
    const pendingApprovals = await db.collection('pending_task_approvals')
      .where('status', '==', 'pending')
      .get();

    console.log(`📊 נמצאו ${pendingApprovals.size} בקשות אישור תלויות:`);
    pendingApprovals.forEach(doc => {
      const data = doc.data();
      console.log(`  - Approval ID: ${doc.id}`);
      console.log(`    Task ID: ${data.taskId}`);
      console.log(`    תיאור: ${data.taskData?.description}`);
      console.log(`    מבקש: ${data.requestedByName || data.requestedBy}`);
      console.log(`    זמן: ${data.requestedAt?.toDate()}`);
      console.log('');
    });

    // בדיקה 3: בקשות שאושרו/נדחו
    const reviewedApprovals = await db.collection('pending_task_approvals')
      .where('status', 'in', ['approved', 'modified', 'rejected'])
      .orderBy('reviewedAt', 'desc')
      .limit(10)
      .get();

    console.log('\n📊 10 בקשות אישור אחרונות שאושרו/נדחו:');
    reviewedApprovals.forEach(doc => {
      const data = doc.data();
      console.log(`  - Approval ID: ${doc.id}`);
      console.log(`    Task ID: ${data.taskId}`);
      console.log(`    סטטוס: ${data.status}`);
      console.log(`    אושר ע"י: ${data.reviewedByName || data.reviewedBy}`);
      console.log(`    זמן: ${data.reviewedAt?.toDate()}`);
      console.log('');
    });

    // בדיקה 4: בדיקת התאמה
    console.log('\n🔍 בדיקת התאמה בין בקשות לבין משימות...\n');

    for (const approvalDoc of pendingApprovals.docs) {
      const approval = approvalDoc.data();
      const taskId = approval.taskId;

      const taskDoc = await db.collection('budget_tasks').doc(taskId).get();

      if (!taskDoc.exists) {
        console.log(`⚠️ בקשת אישור ${approvalDoc.id} מצביעה על משימה ${taskId} שלא קיימת!`);
      } else {
        const task = taskDoc.data();
        console.log(`✅ בקשת אישור ${approvalDoc.id}:`);
        console.log(`   משימה ${taskId} קיימת עם סטטוס: "${task.status}"`);
        if (task.status !== 'pending_approval') {
          console.log(`   ⚠️ אי-התאמה! הבקשה pending אבל המשימה ${task.status}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ שגיאה:', error);
  }

  process.exit(0);
}

checkPendingTasks();
