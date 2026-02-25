/**
 * Find Marva's Tasks - Search all possible fields
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function findMarvaTasks() {
  console.log('🔍 SEARCHING FOR MARVA\'S TASKS\n');
  console.log('═══════════════════════════════════════════════════\n');

  const db = admin.firestore();

  // Search strategies
  const searches = [
    { name: 'assignedTo = marva@ghlawoffice.co.il', field: 'assignedTo', value: 'marva@ghlawoffice.co.il' },
    { name: 'assignedTo = מרווה', field: 'assignedTo', value: 'מרווה' },
    { name: 'assignedTo = marva', field: 'assignedTo', value: 'marva' },
    { name: 'createdBy = marva@ghlawoffice.co.il', field: 'createdBy', value: 'marva@ghlawoffice.co.il' },
    { name: 'createdBy = מרווה', field: 'createdBy', value: 'מרווה' }
  ];

  for (const search of searches) {
    try {
      const snapshot = await db.collection('tasks')
        .where(search.field, '==', search.value)
        .limit(10)
        .get();

      console.log(`${search.name}: ${snapshot.size} tasks`);

      if (snapshot.size > 0) {
        console.log('  Sample tasks:');
        snapshot.forEach(doc => {
          const task = doc.data();
          console.log(`    - ${task.title || 'No title'}`);
          console.log(`      assignedTo: ${task.assignedTo}`);
          console.log(`      createdBy: ${task.createdBy || 'N/A'}`);
          console.log(`      completed: ${task.completed ? 'Yes' : 'No'}\n`);
        });
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 ANALYZING ALL TASKS');
  console.log('═══════════════════════════════════════════════════\n');

  // Get sample of all tasks to see the structure
  const allTasksSample = await db.collection('tasks').limit(5).get();

  console.log('Sample tasks structure (first 5):\n');

  allTasksSample.forEach(doc => {
    const task = doc.data();
    console.log(`Task ID: ${doc.id}`);
    console.log(`  title: ${task.title || 'N/A'}`);
    console.log(`  assignedTo: ${task.assignedTo || 'N/A'}`);
    console.log(`  createdBy: ${task.createdBy || 'N/A'}`);
    console.log(`  clientName: ${task.clientName || 'N/A'}`);
    console.log(`  completed: ${task.completed ? 'Yes' : 'No'}`);
    console.log(`  createdAt: ${task.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || 'N/A'}\n`);
  });

  console.log('═══════════════════════════════════════════════════');
  console.log('🔧 CHECKING UNIQUE assignedTo VALUES');
  console.log('═══════════════════════════════════════════════════\n');

  // Get unique assignedTo values
  const allTasks = await db.collection('tasks').get();
  const assignedToValues = new Set();

  allTasks.forEach(doc => {
    const task = doc.data();
    if (task.assignedTo) {
      assignedToValues.add(task.assignedTo);
    }
  });

  console.log(`Total tasks: ${allTasks.size}`);
  console.log(`Unique assignedTo values (${assignedToValues.size}):\n`);

  Array.from(assignedToValues).sort().forEach(value => {
    const count = allTasks.docs.filter(doc => doc.data().assignedTo === value).length;
    console.log(`  ${value}: ${count} tasks`);
  });

  process.exit(0);
}

findMarvaTasks().catch(console.error);