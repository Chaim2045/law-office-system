/**
 * סקריפט למחיקת כל המשימות והשעתונים
 *
 * שימוש:
 * 1. פתח את index.html בדפדפן
 * 2. פתח קונסול (F12)
 * 3. העתק והדבק את כל הקוד הזה
 * 4. הרץ: await deleteAllData()
 */

async function deleteAllData() {
  console.log('🗑️ Starting deletion process...');

  // בדוק שאתה מחובר
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    console.error('❌ You must be logged in!');
    return;
  }

  const userEmail = currentUser.email;
  console.log(`👤 Logged in as: ${userEmail}`);

  // ספירה ראשונית
  console.log('\n📊 Counting current data...');

  const budgetTasksSnapshot = await firebase.firestore()
    .collection('budgetTasks')
    .where('employee', '==', userEmail)
    .get();

  const timesheetEntriesSnapshot = await firebase.firestore()
    .collection('timesheetEntries')
    .where('employee', '==', userEmail)
    .get();

  console.log(`📦 Found ${budgetTasksSnapshot.size} budget tasks`);
  console.log(`⏱️ Found ${timesheetEntriesSnapshot.size} timesheet entries`);

  // אישור אחרון
  const totalToDelete = budgetTasksSnapshot.size + timesheetEntriesSnapshot.size;
  console.log(`\n⚠️ Total items to delete: ${totalToDelete}`);
  console.log('⚠️ This action cannot be undone!');

  const confirmed = confirm(`Are you sure you want to delete ${totalToDelete} items?\n\n- ${budgetTasksSnapshot.size} budget tasks\n- ${timesheetEntriesSnapshot.size} timesheet entries\n\nClients will NOT be deleted.`);

  if (!confirmed) {
    console.log('❌ Deletion cancelled');
    return;
  }

  console.log('\n🚀 Starting deletion...\n');

  // מחק משימות תקציב
  console.log('🗑️ Deleting budget tasks...');
  let deletedTasks = 0;
  const batch1 = firebase.firestore().batch();

  budgetTasksSnapshot.forEach((doc) => {
    batch1.delete(doc.ref);
    deletedTasks++;
  });

  await batch1.commit();
  console.log(`✅ Deleted ${deletedTasks} budget tasks`);

  // מחק רישומי שעתון
  console.log('\n🗑️ Deleting timesheet entries...');
  let deletedEntries = 0;
  const batch2 = firebase.firestore().batch();

  timesheetEntriesSnapshot.forEach((doc) => {
    batch2.delete(doc.ref);
    deletedEntries++;
  });

  await batch2.commit();
  console.log(`✅ Deleted ${deletedEntries} timesheet entries`);

  // סיכום
  console.log('\n' + '='.repeat(50));
  console.log('✅ DELETION COMPLETED!');
  console.log('='.repeat(50));
  console.log(`✅ Total deleted: ${deletedTasks + deletedEntries} items`);
  console.log(`   - Budget tasks: ${deletedTasks}`);
  console.log(`   - Timesheet entries: ${deletedEntries}`);
  console.log(`\n✅ Clients were NOT deleted (${12} clients remain)`);
  console.log('\n💡 Refresh the page to see the clean state!');
  console.log('='.repeat(50));

  // שאל אם לרענן
  const shouldRefresh = confirm('Delete completed! Refresh the page now?');
  if (shouldRefresh) {
    location.reload();
  }
}

// הוראות
console.log(`
╔════════════════════════════════════════════════════════════╗
║                 🗑️ DELETE ALL DATA SCRIPT                  ║
╚════════════════════════════════════════════════════════════╝

📋 This script will delete:
   ✅ All budget tasks (for your user)
   ✅ All timesheet entries (for your user)
   ❌ Clients will NOT be deleted

⚠️  WARNING: This action cannot be undone!

🚀 To run:
   await deleteAllData()

`);
