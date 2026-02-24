/**
 * System Diagnostics - בדיקות מערכת
 * רץ בתוך המערכת (אחרי התחברות) כדי לבדוק מה עובד ומה לא
 */

(function() {
  'use strict';

  // ===============================
  // Global Diagnostics Object
  // ===============================
  window.SystemDiagnostics = {
    results: {},

    /**
     * Run all diagnostic tests
     */
    async runAll() {
      console.log('%c🔍 System Diagnostics Started', 'font-size: 18px; font-weight: bold; color: #3498db;');
      console.log('='.repeat(60));

      this.results = {};

      // Test 1: Modules loaded
      this.testModulesLoaded();

      // Test 2: Firebase connection
      await this.testFirebaseConnection();

      // Test 3: Data loading
      await this.testDataLoading();

      // Test 4: ClientCaseSelector
      this.testClientCaseSelector();

      // Test 5: Dialogs Module
      this.testDialogsModule();

      // Test 6: Render functions
      this.testRenderFunctions();

      console.log('='.repeat(60));
      console.log('%c📊 Diagnostics Complete', 'font-size: 18px; font-weight: bold; color: #27ae60;');
      this.printSummary();

      return this.results;
    },

    /**
     * Test 1: Check if all modules are loaded
     */
    testModulesLoaded() {
      console.log('\n%c📦 Test 1: Modules Loaded', 'font-size: 14px; font-weight: bold; color: #9b59b6;');

      const modules = {
        'window.manager': !!window.manager,
        'window.firebaseDB': !!window.firebaseDB,
        'window.firebaseAuth': !!window.firebaseAuth,
        'window.DialogsModule': !!window.DialogsModule,
        'window.ClientCaseSelector': !!window.ClientCaseSelector,
        'window.ClientCaseSelectorsManager': !!window.ClientCaseSelectorsManager,
        'window.NotificationSystem': !!window.NotificationSystem,
        'window.casesManager': !!window.casesManager
      };

      this.results.modules = modules;

      Object.entries(modules).forEach(([name, exists]) => {
        if (exists) {
          console.log(`  ✅ ${name}`);
        } else {
          console.error(`  ❌ ${name} - NOT LOADED!`);
        }
      });
    },

    /**
     * Test 2: Firebase connection
     */
    async testFirebaseConnection() {
      console.log('\n%c🔥 Test 2: Firebase Connection', 'font-size: 14px; font-weight: bold; color: #e74c3c;');

      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('firebaseDB is not available');
        }

        // Try to read a single document
        const testQuery = await db.collection('clients').limit(1).get();

        console.log('  ✅ Firebase connected');
        console.log('  ✅ Can read from Firestore');
        this.results.firebase = { connected: true, canRead: true };
      } catch (error) {
        console.error(`  ❌ Firebase error: ${error.message}`);
        this.results.firebase = { connected: false, error: error.message };
      }
    },

    /**
     * Test 3: Data loading
     */
    async testDataLoading() {
      console.log('\n%c📊 Test 3: Data Loading', 'font-size: 14px; font-weight: bold; color: #f39c12;');

      try {
        const db = window.firebaseDB;

        // Load clients (במבנה החדש: Client=Case)
        const clientsSnapshot = await db.collection('clients').get();
        console.log(`  ✅ Loaded ${clientsSnapshot.size} clients/cases (NEW architecture)`);

        // Count old cases collection (for reference only)
        const casesSnapshot = await db.collection('cases').get();
        console.log(`  ℹ️ Old cases collection: ${casesSnapshot.size} documents (legacy backup)`);

        // Load budget_tasks
        const tasksSnapshot = await db.collection('budget_tasks').limit(20).get();
        console.log(`  ✅ Loaded ${tasksSnapshot.size} budget tasks (sample)`);

        // Analyze tasks structure
        let newArchCount = 0;
        let oldArchCount = 0;

        tasksSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.caseId) {
            newArchCount++;
          } else {
            oldArchCount++;
          }
        });

        console.log(`  📈 Tasks with caseId (NEW): ${newArchCount}`);
        console.log(`  📉 Tasks without caseId (OLD): ${oldArchCount}`);

        if (newArchCount > 0) {
          console.log('  ✅ System is using NEW architecture!');
        } else {
          console.warn('  ⚠️ No tasks with NEW architecture found');
        }

        this.results.data = {
          clients: clientsSnapshot.size,
          cases: casesSnapshot.size,
          tasks: tasksSnapshot.size,
          newArchTasks: newArchCount,
          oldArchTasks: oldArchCount
        };

        // Sample first task
        if (!tasksSnapshot.empty) {
          const firstTask = tasksSnapshot.docs[0].data();
          console.log('\n  📝 Sample Task:');
          console.log(`     Description: ${firstTask.description}`);
          console.log(`     Client: ${firstTask.clientName}`);
          console.log(`     Case ID: ${firstTask.caseId || 'NULL'}`);
          console.log(`     Status: ${firstTask.status}`);
        }

      } catch (error) {
        console.error(`  ❌ Data loading error: ${error.message}`);
        this.results.data = { error: error.message };
      }
    },

    /**
     * Test 4: ClientCaseSelector
     */
    testClientCaseSelector() {
      console.log('\n%c🎯 Test 4: ClientCaseSelector', 'font-size: 14px; font-weight: bold; color: #16a085;');

      try {
        if (!window.ClientCaseSelector) {
          throw new Error('ClientCaseSelector class not found');
        }

        if (!window.ClientCaseSelectorsManager) {
          throw new Error('ClientCaseSelectorsManager not found');
        }

        console.log('  ✅ ClientCaseSelector class exists');
        console.log('  ✅ ClientCaseSelectorsManager exists');

        // Check if budget selector is initialized
        const budgetSelector = window.clientCaseSelectors?.budget;
        if (budgetSelector) {
          console.log('  ✅ Budget selector initialized');
        } else {
          console.log('  ℹ️ Budget selector not yet initialized (normal if form not opened)');
        }

        this.results.clientCaseSelector = { available: true, budgetInitialized: !!budgetSelector };
      } catch (error) {
        console.error(`  ❌ ClientCaseSelector error: ${error.message}`);
        this.results.clientCaseSelector = { available: false, error: error.message };
      }
    },

    /**
     * Test 5: Dialogs Module
     */
    testDialogsModule() {
      console.log('\n%c💬 Test 5: Dialogs Module', 'font-size: 14px; font-weight: bold; color: #8e44ad;');

      try {
        if (!window.DialogsModule) {
          throw new Error('DialogsModule not found - dialogs.js not loaded!');
        }

        console.log('  ✅ DialogsModule exists');

        // Check critical functions
        const functions = [
          'showAdvancedTimeDialog',
          'showTaskCompletionModal',
          'openSmartForm'
        ];

        functions.forEach(funcName => {
          if (window.DialogsModule[funcName]) {
            console.log(`  ✅ ${funcName} exists`);
          } else {
            console.error(`  ❌ ${funcName} NOT FOUND!`);
          }
        });

        this.results.dialogs = {
          available: true,
          functions: functions.reduce((acc, name) => {
            acc[name] = !!window.DialogsModule[name];
            return acc;
          }, {})
        };

      } catch (error) {
        console.error(`  ❌ Dialogs error: ${error.message}`);
        this.results.dialogs = { available: false, error: error.message };
      }
    },

    /**
     * Test 6: Render functions
     */
    testRenderFunctions() {
      console.log('\n%c🎨 Test 6: Render Functions', 'font-size: 14px; font-weight: bold; color: #c0392b;');

      try {
        const manager = window.manager;
        if (!manager) {
          throw new Error('manager not found');
        }

        console.log('  ✅ manager exists');
        console.log(`  📊 Budget tasks: ${manager.budgetTasks?.length || 0}`);
        console.log(`  📊 Filtered tasks: ${manager.filteredBudgetTasks?.length || 0}`);
        console.log(`  📊 Current view: ${manager.currentBudgetView}`);

        // Check containers
        const budgetContainer = document.getElementById('budgetContainer');
        const budgetTableContainer = document.getElementById('budgetTableContainer');

        if (budgetContainer) {
          console.log(`  ✅ budgetContainer exists (${budgetContainer.children.length} children)`);
        } else {
          console.error('  ❌ budgetContainer NOT FOUND');
        }

        if (budgetTableContainer) {
          console.log('  ✅ budgetTableContainer exists');
        } else {
          console.error('  ❌ budgetTableContainer NOT FOUND');
        }

        this.results.render = {
          managerExists: true,
          budgetTasksCount: manager.budgetTasks?.length || 0,
          filteredTasksCount: manager.filteredBudgetTasks?.length || 0,
          currentView: manager.currentBudgetView,
          containersExist: !!budgetContainer && !!budgetTableContainer
        };

      } catch (error) {
        console.error(`  ❌ Render error: ${error.message}`);
        this.results.render = { error: error.message };
      }
    },

    /**
     * Print summary
     */
    printSummary() {
      console.log('\n%c📋 Summary', 'font-size: 16px; font-weight: bold; color: #2c3e50;');

      const issues = [];

      // Check modules
      if (this.results.modules) {
        Object.entries(this.results.modules).forEach(([name, loaded]) => {
          if (!loaded) {
issues.push(`${name} not loaded`);
}
        });
      }

      // Check dialogs
      if (!this.results.dialogs?.available) {
        issues.push('DialogsModule not available - THIS IS CRITICAL!');
      }

      // Check data
      if (this.results.data?.newArchTasks === 0) {
        issues.push('No tasks using NEW architecture (caseId)');
      }

      if (issues.length === 0) {
        console.log('%c  ✅ All systems operational!', 'color: #27ae60; font-weight: bold;');
      } else {
        console.log('%c  ⚠️ Issues found:', 'color: #e74c3c; font-weight: bold;');
        issues.forEach(issue => {
          console.log(`     ❌ ${issue}`);
        });
      }

      console.log('\n💡 To run again: SystemDiagnostics.runAll()');
    }
  };

  console.log('✅ System Diagnostics loaded. Run SystemDiagnostics.runAll() to test.');

})();
