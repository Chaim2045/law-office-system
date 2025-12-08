/**
 * Live Task Debugging Script - בודק את כל המשימות ובודק למה חלק עובד וחלק לא
 */

const admin = require('firebase-admin');
const serviceAccount = require('./law-office-system-e4801-firebase-adminsdk-gtyb4-f4f1edadf7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugAllTasks() {
  console.log('🔍 בודק את כל המשימות של המשתמש...\n');

  const now = new Date();
  console.log(`⏰ זמן עכשיו: ${now.toLocaleString('he-IL')}`);
  console.log(`📅 תאריך: ${now.toLocaleDateString('he-IL')}\n`);

  try {
    // קבל את כל המשימות
    const tasksSnapshot = await db.collection('tasks').get();

    console.log(`📊 נמצאו ${tasksSnapshot.size} משימות\n`);
    console.log('═'.repeat(80));

    const issues = [];

    tasksSnapshot.forEach((doc) => {
      const task = doc.data();

      // רק משימות עם deadline
      if (!task.deadline) {
        return;
      }

      const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
      const createdAt = task.createdAt ?
        (task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt)) :
        now;

      // חישוב לפי הלוגיקה החדשה
      const startDate = createdAt < deadline ? createdAt : deadline;
      const totalDays = Math.max(1, (deadline - startDate) / (1000 * 60 * 60 * 24));
      const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);
      const deadlineProgress = Math.max(0, Math.round((elapsedDays / totalDays) * 100));

      const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilDeadline < 0;

      console.log(`\n📋 משימה: ${doc.id.substring(0, 8)}`);
      console.log(`   תיאור: ${task.description || 'אין תיאור'}`);
      console.log(`   לקוח: ${task.clientName || 'לא צוין'}`);
      console.log(`   📅 יצירה: ${createdAt.toLocaleDateString('he-IL')}`);
      console.log(`   ⏰ יעד: ${deadline.toLocaleDateString('he-IL')}`);
      console.log(`   📊 התקדמות: ${deadlineProgress}%`);
      console.log(`   ${isOverdue ? '🔴' : '🟢'} סטטוס: ${isOverdue ? `באיחור ${Math.abs(daysUntilDeadline)} ימים` : `${daysUntilDeadline} ימים נותרו`}`);

      // בדוק אם יש בעיה
      if (isOverdue && deadlineProgress < 100) {
        issues.push({
          id: doc.id.substring(0, 8),
          description: task.description,
          deadline: deadline.toLocaleDateString('he-IL'),
          createdAt: createdAt.toLocaleDateString('he-IL'),
          progress: deadlineProgress,
          problem: '❌ משימה באיחור אבל מציגה פחות מ-100%'
        });
        console.log(`   ⚠️  בעיה: משימה באיחור אבל progress = ${deadlineProgress}%`);
      }

      if (createdAt > deadline) {
        console.log('   ⚠️  נתונים לא תקינים: createdAt > deadline');
        issues.push({
          id: doc.id.substring(0, 8),
          description: task.description,
          deadline: deadline.toLocaleDateString('he-IL'),
          createdAt: createdAt.toLocaleDateString('he-IL'),
          problem: '⚠️ תאריך יצירה אחרי תאריך יעד'
        });
      }
    });

    console.log('\n' + '═'.repeat(80));

    if (issues.length === 0) {
      console.log('\n✅ כל המשימות תקינות! אין בעיות.\n');
    } else {
      console.log(`\n❌ נמצאו ${issues.length} משימות עם בעיות:\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.id} - ${issue.description}`);
        console.log(`   ${issue.problem}`);
        if (issue.progress !== undefined) {
          console.log(`   Progress: ${issue.progress}%`);
        }
        console.log(`   יצירה: ${issue.createdAt}, יעד: ${issue.deadline}\n`);
      });
    }

  } catch (error) {
    console.error('❌ שגיאה:', error);
  }

  process.exit(0);
}

debugAllTasks();
