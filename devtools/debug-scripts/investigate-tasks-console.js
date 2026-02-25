/**
 * BROWSER CONSOLE INVESTIGATION SCRIPT
 * Copy-paste this into Browser Console (F12) while logged in as Marva
 *
 * This will check:
 * 1. What tasks exist in Firestore for Marva
 * 2. What tasks are loaded in the app (window.manager)
 * 3. Any filtering/hiding logic
 */

(async function investigateTasks() {
  console.log('🔍 TASK INVESTIGATION - Marva');
  console.log('═══════════════════════════════════════════════════\n');

  // Check current user
  const currentUser = window.manager?.currentUser;
  const currentUsername = window.manager?.currentUsername;

  console.log('📧 Current User:');
  console.log(`   Email: ${currentUser}`);
  console.log(`   Username: ${currentUsername}\n`);

  if (currentUser !== 'marva@ghlawoffice.co.il') {
    console.warn('⚠️  Not logged in as Marva! Please login as marva@ghlawoffice.co.il first.');
    return;
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('1️⃣  FIRESTORE DATA - Raw Tasks');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Query all tasks assigned to Marva
    const tasksSnapshot = await window.firebaseDB.collection('tasks')
      .where('assignedTo', '==', currentUser)
      .get();

    console.log(`Total tasks in Firestore: ${tasksSnapshot.size}\n`);

    const tasksByStatus = {
      active: [],
      completed: []
    };

    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      const status = task.completed ? 'completed' : 'active';
      tasksByStatus[status].push({
        id: doc.id,
        title: task.title || 'No title',
        clientName: task.clientName || 'No client',
        completed: task.completed || false,
        createdAt: task.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || 'Unknown',
        priority: task.priority || 'normal'
      });
    });

    console.log('📊 Breakdown:');
    console.log(`   Active tasks: ${tasksByStatus.active.length}`);
    console.log(`   Completed tasks: ${tasksByStatus.completed.length}\n`);

    console.log('📋 Active Tasks (first 10):');
    tasksByStatus.active.slice(0, 10).forEach((task, i) => {
      console.log(`   ${i + 1}. [${task.id.substring(0, 8)}...] ${task.title}`);
      console.log(`      Client: ${task.clientName} | Created: ${task.createdAt}`);
    });

    console.log('\n✅ Completed Tasks (first 10):');
    tasksByStatus.completed.slice(0, 10).forEach((task, i) => {
      console.log(`   ${i + 1}. [${task.id.substring(0, 8)}...] ${task.title}`);
      console.log(`      Client: ${task.clientName} | Created: ${task.createdAt}`);
    });

  } catch (error) {
    console.error('❌ Error loading tasks from Firestore:', error);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('2️⃣  APP STATE - What the app has loaded');
  console.log('═══════════════════════════════════════════════════\n');

  if (window.manager?.tasks) {
    const loadedTasks = window.manager.tasks;
    console.log(`Tasks in memory (window.manager.tasks): ${loadedTasks.length}\n`);

    const activeTasks = loadedTasks.filter(t => !t.completed);
    const completedTasks = loadedTasks.filter(t => t.completed);

    console.log('📊 Breakdown:');
    console.log(`   Active: ${activeTasks.length}`);
    console.log(`   Completed: ${completedTasks.length}\n`);

    console.log('📋 Active Tasks in Memory (first 10):');
    activeTasks.slice(0, 10).forEach((task, i) => {
      console.log(`   ${i + 1}. [${task.id?.substring(0, 8) || 'no-id'}...] ${task.title || 'No title'}`);
      console.log(`      Client: ${task.clientName || 'No client'}`);
    });

  } else {
    console.log('⚠️  window.manager.tasks not found or empty');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('3️⃣  UI STATE - What filters are active');
  console.log('═══════════════════════════════════════════════════\n');

  // Check current filter
  const currentFilter = window.manager?.currentFilter;
  console.log(`Current filter: ${currentFilter || 'none'}`);

  // Check if there's a search active
  const searchInput = document.querySelector('#taskSearchInput, #searchInput, input[type="search"]');
  if (searchInput) {
    console.log(`Search input value: "${searchInput.value}"`);
  }

  // Check visible tasks in DOM
  const visibleTasks = document.querySelectorAll('.task-card:not(.hidden), .task-item:not(.hidden), [data-task-id]');
  console.log(`Visible tasks in DOM: ${visibleTasks.length}\n`);

  console.log('═══════════════════════════════════════════════════');
  console.log('4️⃣  SEARCH INVESTIGATION');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Testing search for a specific client...');
  console.log('Please provide a client name to search for.');
  console.log('Run: investigateSearch("Client Name Here")');

  window.investigateSearch = async function(clientName) {
    console.log(`\n🔍 Searching for: "${clientName}"\n`);

    try {
      const results = await window.firebaseDB.collection('tasks')
        .where('assignedTo', '==', currentUser)
        .where('clientName', '>=', clientName)
        .where('clientName', '<=', clientName + '\uf8ff')
        .get();

      console.log(`Found ${results.size} tasks for "${clientName}":\n`);

      results.forEach(doc => {
        const task = doc.data();
        console.log(`   ${task.completed ? '✅' : '📋'} ${task.title || 'No title'}`);
        console.log(`      Status: ${task.completed ? 'Completed' : 'Active'}`);
        console.log(`      Client: ${task.clientName}`);
        console.log(`      Created: ${task.createdAt?.toDate?.()?.toLocaleDateString('he-IL')}\n`);
      });

      // Check if app is filtering correctly
      if (window.manager?.filterTasksByClient) {
        console.log('🔧 App has filterTasksByClient function');
      }

    } catch (error) {
      console.error('❌ Search error:', error);
    }
  };

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎯 SUMMARY & NEXT STEPS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('✅ Investigation script ready!');
  console.log('\n📌 To investigate search issues:');
  console.log('   1. Copy a client name that has missing tasks');
  console.log('   2. Run: investigateSearch("Client Name")');
  console.log('   3. Copy the results and send to me\n');

})();