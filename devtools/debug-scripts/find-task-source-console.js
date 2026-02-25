/**
 * Find Where Tasks Come From
 * Run this in Browser Console while seeing tasks on screen
 */

(async function findTaskSource() {
  console.log('🔍 FINDING TASK SOURCE\n');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Check window.manager.tasks
  console.log('1️⃣  window.manager.tasks:', window.manager?.tasks?.length || 0);

  // 2. Check localStorage
  console.log('\n2️⃣  Checking localStorage...');
  const localStorageKeys = Object.keys(localStorage);
  console.log(`   Total keys: ${localStorageKeys.length}`);

  const taskRelatedKeys = localStorageKeys.filter(key =>
    key.includes('task') || key.includes('budget') || key.includes('marva')
  );

  if (taskRelatedKeys.length > 0) {
    console.log('\n   Task-related keys found:');
    taskRelatedKeys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`   - ${key}: ${value?.length || 0} chars`);
    });
  } else {
    console.log('   No task-related keys in localStorage');
  }

  // 3. Check indexedDB
  console.log('\n3️⃣  Checking IndexedDB...');
  if (window.indexedDB) {
    const dbs = await window.indexedDB.databases?.() || [];
    console.log(`   Databases: ${dbs.length}`);
    dbs.forEach(db => {
      console.log(`   - ${db.name} (version ${db.version})`);
    });
  }

  // 4. Check DOM - how many task cards are visible
  console.log('\n4️⃣  Checking DOM...');
  const taskCards = document.querySelectorAll('[data-task-id], .task-card, .task-item, .budget-task-item');
  console.log(`   Visible task elements: ${taskCards.length}`);

  if (taskCards.length > 0) {
    console.log('\n   First 3 visible tasks:');
    Array.from(taskCards).slice(0, 3).forEach((card, i) => {
      const taskId = card.dataset?.taskId || card.getAttribute('data-task-id');
      const description = card.querySelector('.task-description, .description, [class*="description"]')?.textContent;
      console.log(`   ${i + 1}. ID: ${taskId || 'unknown'}`);
      console.log(`      Text: ${description?.substring(0, 50) || 'No description'}`);
    });
  }

  // 5. Check if there's a global tasks array
  console.log('\n5️⃣  Checking global variables...');
  const globalTaskVars = [
    'tasks',
    'budgetTasks',
    'allTasks',
    'loadedTasks',
    'cachedTasks'
  ];

  globalTaskVars.forEach(varName => {
    if (window[varName]) {
      console.log(`   ✅ window.${varName}: ${window[varName]?.length || 0} items`);
    }
  });

  // 6. Check if tasks are rendered from a specific component
  console.log('\n6️⃣  Checking render functions...');

  const renderFuncs = [
    'renderTasks',
    'displayTasks',
    'showTasks',
    'renderBudgetTasks',
    'updateTaskList'
  ];

  renderFuncs.forEach(funcName => {
    if (window.manager?.[funcName] || window[funcName]) {
      console.log(`   ✅ ${funcName} exists`);
    }
  });

  // 7. Check current page/view
  console.log('\n7️⃣  Current view info...');
  console.log(`   URL: ${window.location.pathname}`);
  console.log(`   Hash: ${window.location.hash || 'none'}`);

  // Check active tab/section
  const activeTab = document.querySelector('.tab.active, .nav-item.active, [aria-selected="true"]');
  if (activeTab) {
    console.log(`   Active tab: ${activeTab.textContent?.trim() || activeTab.className}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎯 TESTING TASK LOAD');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Let\'s try to manually trigger task load...\n');

  // Try to call load functions
  const loadFunctions = [
    { obj: window.manager, func: 'loadTasks' },
    { obj: window.manager, func: 'loadBudgetTasks' },
    { obj: window.manager, func: 'loadData' },
    { obj: window, func: 'loadTasks' }
  ];

  for (const { obj, func } of loadFunctions) {
    if (obj && typeof obj[func] === 'function') {
      console.log(`✅ Found: ${obj === window ? 'window' : 'window.manager'}.${func}`);
      console.log(`   You can try: ${obj === window ? '' : 'window.manager.'}${func}()`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📌 INSTRUCTIONS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('To debug further:');
  console.log('1. Look at the visible tasks on screen');
  console.log('2. Right-click on a task → Inspect Element');
  console.log('3. Look for data-task-id or similar attributes');
  console.log('4. Check the React/Vue DevTools (if applicable)\n');

  console.log('Or run: inspectVisibleTask(0)  // to inspect first visible task\n');

  window.inspectVisibleTask = function(index = 0) {
    const taskCards = document.querySelectorAll('[data-task-id], .task-card, .task-item, .budget-task-item');
    if (taskCards[index]) {
      console.log('\n📋 Task element:', taskCards[index]);
      console.log('Dataset:', taskCards[index].dataset);
      console.log('innerHTML sample:', taskCards[index].innerHTML.substring(0, 200) + '...');
    } else {
      console.log('❌ No task found at index', index);
    }
  };

})();