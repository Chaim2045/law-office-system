/**
 * BROWSER CONSOLE SCRIPT - Investigate Missing Tasks
 * Copy-paste into Browser Console (F12) while logged in as Marva
 *
 * This will check why some tasks are not showing up for certain clients
 */

(async function investigateMissingTasks() {
  console.log('🔍 INVESTIGATING MISSING TASKS FOR MARVA\n');
  console.log('═══════════════════════════════════════════════════\n');

  const currentUser = window.manager?.currentUser;

  if (!currentUser || currentUser !== 'marva@ghlawoffice.co.il') {
    console.warn('⚠️  Please login as marva@ghlawoffice.co.il first!');
    return;
  }

  console.log('📧 Logged in as:', currentUser, '\n');

  // Test clients that have missing tasks
  const testClients = [
    'רון פישמן',
    'הרקפה פרו',
    'אודי חסידי'
  ];

  console.log('═══════════════════════════════════════════════════');
  console.log('1️⃣  CHECKING FIRESTORE DIRECTLY');
  console.log('═══════════════════════════════════════════════════\n');

  for (const clientName of testClients) {
    console.log(`\n🔍 Client: "${clientName}"`);
    console.log('─────────────────────────────────────────────────');

    try {
      // Query budget_tasks for this client + Marva
      const tasksQuery = await window.firebaseDB.collection('budget_tasks')
        .where('employee', '==', currentUser)
        .where('clientName', '==', clientName)
        .get();

      console.log(`   Found in Firestore: ${tasksQuery.size} tasks\n`);

      if (tasksQuery.size > 0) {
        console.log('   Tasks:');
        tasksQuery.forEach(doc => {
          const task = doc.data();
          console.log(`     - ${task.description || 'No description'}`);
          console.log(`       Status: ${task.status || 'No status'}`);
          console.log(`       ID: ${doc.id}`);
          console.log(`       Employee: ${task.employee}`);
          console.log(`       ClientName: ${task.clientName}\n`);
        });
      }

    } catch (error) {
      console.error(`   ❌ Error querying Firestore: ${error.message}`);
      console.error(`   Code: ${error.code}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('2️⃣  CHECKING APP MEMORY (window.manager.tasks)');
  console.log('═══════════════════════════════════════════════════\n');

  // Check what's in memory
  const loadedTasks = window.manager?.tasks || [];
  console.log(`Total tasks in memory: ${loadedTasks.length}\n`);

  for (const clientName of testClients) {
    const clientTasks = loadedTasks.filter(t => t.clientName === clientName);
    console.log(`${clientName}: ${clientTasks.length} tasks in memory`);

    if (clientTasks.length > 0) {
      console.log('   Tasks:');
      clientTasks.slice(0, 5).forEach(task => {
        console.log(`     - ${task.description || 'No description'}`);
        console.log(`       Status: ${task.status}`);
      });
    }
    console.log('');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('3️⃣  CHECKING QUERY LIMITS');
  console.log('═══════════════════════════════════════════════════\n');

  // Check if there's a limit() on queries
  console.log('Testing if query has limit...\n');

  try {
    const unlimitedQuery = await window.firebaseDB.collection('budget_tasks')
      .where('employee', '==', currentUser)
      .get();

    console.log(`Total Marva tasks (no limit): ${unlimitedQuery.size}`);

    // Check in memory
    console.log(`Total Marva tasks (in memory): ${loadedTasks.length}`);

    if (unlimitedQuery.size !== loadedTasks.length) {
      console.log('\n⚠️  MISMATCH DETECTED!');
      console.log(`   Firestore has: ${unlimitedQuery.size} tasks`);
      console.log(`   Memory has: ${loadedTasks.length} tasks`);
      console.log(`   Missing: ${unlimitedQuery.size - loadedTasks.length} tasks`);
      console.log('\n   💡 Possible causes:');
      console.log('      - Query has .limit() clause');
      console.log('      - Pagination issue');
      console.log('      - Filtering after load');
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('4️⃣  CHECKING loadData() FUNCTION');
  console.log('═══════════════════════════════════════════════════\n');

  // Check how tasks are loaded
  if (window.manager && window.manager.loadData) {
    console.log('✅ window.manager.loadData exists');

    // Try to find the loadData source
    const loadDataStr = window.manager.loadData.toString();

    // Check for .limit()
    if (loadDataStr.includes('.limit(')) {
      console.log('⚠️  FOUND .limit() in loadData!');
      const limitMatch = loadDataStr.match(/\.limit\((\d+)\)/);
      if (limitMatch) {
        console.log(`   Limit value: ${limitMatch[1]}`);
      }
    } else {
      console.log('✅ No .limit() found in loadData');
    }

    // Check for where clauses
    if (loadDataStr.includes('where(')) {
      console.log('\n📌 WHERE clauses found in loadData');
    }

  } else {
    console.log('❌ window.manager.loadData not found');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎯 INTERACTIVE SEARCH');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Run this command to search for a specific client:');
  console.log('searchClientTasks("Client Name")');
  console.log('\nExample: searchClientTasks("רון פישמן")\n');

  window.searchClientTasks = async function(clientName) {
    console.log(`\n🔍 Searching for: "${clientName}"\n`);

    try {
      const results = await window.firebaseDB.collection('budget_tasks')
        .where('employee', '==', currentUser)
        .where('clientName', '==', clientName)
        .get();

      console.log(`Firestore results: ${results.size} tasks\n`);

      results.forEach(doc => {
        const task = doc.data();
        console.log(`📋 ${task.description || 'No description'}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Created: ${task.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || 'Unknown'}\n`);
      });

      // Check if these tasks are in memory
      const inMemory = loadedTasks.filter(t => t.clientName === clientName);
      console.log(`In memory: ${inMemory.length} tasks`);

      if (results.size !== inMemory.length) {
        console.log(`\n⚠️  MISMATCH: ${results.size - inMemory.length} tasks are missing from memory!`);
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  };

})();