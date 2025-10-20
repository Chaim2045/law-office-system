/**
 * Quick Task Field Checker
 * Copy and paste this into the browser console to check task fields
 */

console.log('='.repeat(80));
console.log('BUDGET TASKS FIELD ANALYSIS');
console.log('='.repeat(80));

if (!window.budgetTasks || window.budgetTasks.length === 0) {
  console.error('❌ No budgetTasks found! Make sure data is loaded.');
} else {
  console.log(`✅ Found ${window.budgetTasks.length} budget tasks\n`);

  // Check first task
  const firstTask = window.budgetTasks[0];
  console.log('📋 FIRST TASK ANALYSIS:');
  console.log('Task ID:', firstTask.id);
  console.log('Description:', firstTask.description || firstTask.taskDescription);
  console.log('\n🔑 ALL FIELDS:');
  console.log(Object.keys(firstTask).sort());

  console.log('\n📅 DATE FIELDS:');
  console.log('  deadline:', firstTask.deadline, `(${typeof firstTask.deadline})`);
  console.log('  targetDate:', firstTask.targetDate, `(${typeof firstTask.targetDate})`);
  console.log('  createdAt:', firstTask.createdAt, `(${typeof firstTask.createdAt})`);
  console.log('  dueDate:', firstTask.dueDate, `(${typeof firstTask.dueDate})`);

  // Check if any tasks have deadline
  console.log('\n📊 DEADLINE FIELD STATS:');
  const withDeadline = window.budgetTasks.filter(t => t.deadline).length;
  const withTargetDate = window.budgetTasks.filter(t => t.targetDate).length;
  const withDueDate = window.budgetTasks.filter(t => t.dueDate).length;

  console.log(`  Tasks with deadline: ${withDeadline}/${window.budgetTasks.length}`);
  console.log(`  Tasks with targetDate: ${withTargetDate}/${window.budgetTasks.length}`);
  console.log(`  Tasks with dueDate: ${withDueDate}/${window.budgetTasks.length}`);

  // Show sample task with deadline
  const taskWithDeadline = window.budgetTasks.find(t => t.deadline);
  if (taskWithDeadline) {
    console.log('\n✅ SAMPLE TASK WITH DEADLINE:');
    console.log('  ID:', taskWithDeadline.id);
    console.log('  Description:', taskWithDeadline.description);
    console.log('  Deadline:', taskWithDeadline.deadline);
    console.log('  Deadline type:', typeof taskWithDeadline.deadline);
    console.log('  Deadline instanceof Date:', taskWithDeadline.deadline instanceof Date);

    // Test formatDate
    if (window.formatDate) {
      console.log('  formatDate result:', window.formatDate(taskWithDeadline.deadline));
    }
  } else {
    console.warn('⚠️ NO tasks with deadline field found!');

    // Check for alternative date fields
    const taskWithDate = window.budgetTasks.find(t => t.targetDate || t.dueDate);
    if (taskWithDate) {
      console.log('\n🔍 FOUND TASK WITH ALTERNATIVE DATE FIELD:');
      console.log('  ID:', taskWithDate.id);
      console.log('  Description:', taskWithDate.description);
      console.log('  targetDate:', taskWithDate.targetDate);
      console.log('  dueDate:', taskWithDate.dueDate);
    }
  }
}

console.log('\n' + '='.repeat(80));
