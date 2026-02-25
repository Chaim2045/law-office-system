/**
 * Compare window.budgetTasks vs Firestore
 * Find the missing 14 tasks
 */

(async function compareTasks() {
  console.log('🔍 COMPARING TASKS: window.budgetTasks vs Firestore\n');
  console.log('═══════════════════════════════════════════════════\n');

  const currentUser = 'marva@ghlawoffice.co.il';

  // Get tasks from Firestore
  console.log('1️⃣  Loading ALL tasks from Firestore...\n');

  const firestoreTasks = await window.firebaseDB.collection('budget_tasks')
    .where('employee', '==', currentUser)
    .get();

  console.log(`Firestore: ${firestoreTasks.size} tasks`);

  const firestoreIds = new Set();
  const firestoreMap = new Map();

  firestoreTasks.forEach(doc => {
    firestoreIds.add(doc.id);
    firestoreMap.set(doc.id, doc.data());
  });

  // Get tasks from window.budgetTasks
  console.log(`window.budgetTasks: ${window.budgetTasks?.length || 0} tasks\n`);

  const loadedIds = new Set();
  const loadedMap = new Map();

  (window.budgetTasks || []).forEach(task => {
    if (task.id) {
      loadedIds.add(task.id);
      loadedMap.set(task.id, task);
    }
  });

  // Find missing tasks
  const missingIds = Array.from(firestoreIds).filter(id => !loadedIds.has(id));

  console.log('═══════════════════════════════════════════════════');
  console.log('🚨 MISSING TASKS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`Missing: ${missingIds.length} tasks\n`);

  if (missingIds.length > 0) {
    console.log('Missing tasks details:\n');

    missingIds.forEach((id, index) => {
      const task = firestoreMap.get(id);
      console.log(`${index + 1}. ${task.description || 'No description'}`);
      console.log(`   ID: ${id}`);
      console.log(`   Client: ${task.clientName || 'N/A'}`);
      console.log(`   Status: ${task.status || 'N/A'}`);
      console.log(`   Created: ${task.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || 'Unknown'}`);

      // Check for patterns
      const patterns = {
        cancelled: task.cancelledAt || task.status === 'בוטל',
        completed: task.completedAt || task.status === 'הושלם',
        active: task.status === 'פעיל',
        hasDeadline: !!task.deadline,
        oldTask: task.createdAt && (new Date() - task.createdAt.toDate()) > (90 * 24 * 60 * 60 * 1000) // older than 90 days
      };

      const flags = Object.entries(patterns)
        .filter(([, value]) => value)
        .map(([key]) => key);

      if (flags.length > 0) {
        console.log(`   Flags: [${flags.join(', ')}]`);
      }

      console.log('');
    });

    // Analyze patterns
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 PATTERN ANALYSIS');
    console.log('═══════════════════════════════════════════════════\n');

    const statusCounts = { פעיל: 0, הושלם: 0, בוטל: 0, other: 0 };

    missingIds.forEach(id => {
      const task = firestoreMap.get(id);
      const status = task.status || 'other';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('Missing tasks by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        console.log(`   ${status}: ${count} tasks`);
      }
    });

    // Check date ranges
    const missingDates = missingIds
      .map(id => firestoreMap.get(id).createdAt?.toDate?.())
      .filter(d => d)
      .sort((a, b) => a - b);

    if (missingDates.length > 0) {
      console.log('\nMissing tasks date range:');
      console.log(`   Oldest: ${missingDates[0].toLocaleDateString('he-IL')}`);
      console.log(`   Newest: ${missingDates[missingDates.length - 1].toLocaleDateString('he-IL')}`);
    }

    // Check loaded tasks patterns
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 LOADED TASKS ANALYSIS');
    console.log('═══════════════════════════════════════════════════\n');

    const loadedDates = Array.from(loadedMap.values())
      .map(t => firestoreMap.get(t.id)?.createdAt?.toDate?.())
      .filter(d => d)
      .sort((a, b) => a - b);

    if (loadedDates.length > 0) {
      console.log('Loaded tasks date range:');
      console.log(`   Oldest: ${loadedDates[0].toLocaleDateString('he-IL')}`);
      console.log(`   Newest: ${loadedDates[loadedDates.length - 1].toLocaleDateString('he-IL')}`);
    }

    // Check for query limit
    console.log('\n═══════════════════════════════════════════════════');
    console.log('💡 HYPOTHESIS');
    console.log('═══════════════════════════════════════════════════\n');

    if (window.budgetTasks.length === 50) {
      console.log('⚠️  window.budgetTasks has EXACTLY 50 tasks!');
      console.log('   This suggests a .limit(50) in the query');
      console.log('   The 14 missing tasks are likely the 14 oldest/newest');
    }

    // Check if missing tasks are all older or newer
    const allTasksDates = Array.from(firestoreMap.values())
      .map(t => ({ id: t.id || Math.random(), date: t.createdAt?.toDate?.(), description: t.description }))
      .filter(t => t.date)
      .sort((a, b) => a.date - b.date);

    if (allTasksDates.length > 0) {
      const missingIdsSet = new Set(missingIds);
      const oldestTasks = allTasksDates.slice(0, 14);
      const newestTasks = allTasksDates.slice(-14);

      const missingAreOldest = oldestTasks.every(t => missingIdsSet.has(t.id));
      const missingAreNewest = newestTasks.every(t => missingIdsSet.has(t.id));

      if (missingAreOldest) {
        console.log('\n✅ CONFIRMED: Missing tasks are the 14 OLDEST tasks');
        console.log('   Query is probably: .orderBy(\'createdAt\', \'desc\').limit(50)');
      } else if (missingAreNewest) {
        console.log('\n✅ CONFIRMED: Missing tasks are the 14 NEWEST tasks');
        console.log('   Query is probably: .orderBy(\'createdAt\', \'asc\').limit(50)');
      } else {
        console.log('\n⚠️  Missing tasks are NOT consistently oldest or newest');
        console.log('   Different filtering logic is in play');
      }
    }
  }

  console.log('\n');
})();