/**
 * Check budget_tasks collection for Marva
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkBudgetTasks() {
  console.log('🔍 CHECKING budget_tasks COLLECTION\n');
  console.log('═══════════════════════════════════════════════════\n');

  const db = admin.firestore();

  // Get all budget_tasks
  const snapshot = await db.collection('budget_tasks').get();

  console.log(`Total budget_tasks: ${snapshot.size}\n`);

  // Collect unique assignedTo values
  const assignedToMap = new Map();

  snapshot.forEach(doc => {
    const task = doc.data();
    const assignedTo = task.assignedTo || task.assignedToEmail || task.employee || 'Unknown';

    if (!assignedToMap.has(assignedTo)) {
      assignedToMap.set(assignedTo, []);
    }

    assignedToMap.get(assignedTo).push({
      id: doc.id,
      description: task.description || 'No description',
      completed: task.completed || false,
      status: task.status || 'unknown'
    });
  });

  console.log('📊 Tasks by assignedTo:\n');

  Array.from(assignedToMap.entries()).sort().forEach(([assignedTo, tasks]) => {
    console.log(`${assignedTo}: ${tasks.length} tasks`);
  });

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔍 MARVA\'S TASKS');
  console.log('═══════════════════════════════════════════════════\n');

  // Check for Marva specifically
  const marvaSearches = [
    'marva@ghlawoffice.co.il',
    'מרווה',
    'marva'
  ];

  for (const search of marvaSearches) {
    if (assignedToMap.has(search)) {
      const tasks = assignedToMap.get(search);
      console.log(`\n✅ Found ${tasks.length} tasks for "${search}":\n`);

      tasks.slice(0, 10).forEach((task, i) => {
        console.log(`   ${i + 1}. [${task.id.substring(0, 8)}...] ${task.description}`);
        console.log(`      Status: ${task.status} | Completed: ${task.completed ? 'Yes' : 'No'}`);
      });
    } else {
      console.log(`❌ No tasks found for "${search}"`);
    }
  }

  // Show sample task structure
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('📋 SAMPLE TASK STRUCTURE');
  console.log('═══════════════════════════════════════════════════\n');

  const sampleDoc = snapshot.docs[0];
  if (sampleDoc) {
    const sampleData = sampleDoc.data();
    console.log(`Task ID: ${sampleDoc.id}\n`);
    console.log('Fields:');
    Object.keys(sampleData).forEach(key => {
      const value = sampleData[key];
      const displayValue = typeof value === 'object' && value !== null
        ? `[${value.constructor.name}]`
        : String(value).substring(0, 50);
      console.log(`  ${key}: ${displayValue}`);
    });
  }

  process.exit(0);
}

checkBudgetTasks().catch(console.error);