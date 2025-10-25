/**
 * ========================================
 * System Snapshot - Full System State Diagnostic
 * ========================================
 * מייצר snapshot מלא של מצב המערכת
 * להשוואה בין גרסאות שונות
 */

window.SystemSnapshot = {
  /**
   * יצירת snapshot מלא של המערכת
   */
  create() {
    const snapshot = {
      timestamp: new Date().toISOString(),

      // ===== 1. Global Objects & Modules =====
      globalObjects: {
        // Core modules
        DialogsModule: typeof DialogsModule !== 'undefined' ? {
          exists: true,
          functions: Object.keys(DialogsModule || {})
        } : { exists: false },

        ModalsManager: typeof ModalsManager !== 'undefined' ? {
          exists: true,
          functions: Object.keys(ModalsManager || {})
        } : { exists: false },

        NotificationSystem: typeof NotificationSystem !== 'undefined' ? {
          exists: true,
          functions: Object.keys(NotificationSystem || {})
        } : { exists: false },

        // Client-Case modules
        ClientCaseSelector: typeof window.ClientCaseSelector !== 'undefined' ? {
          exists: true,
          type: typeof window.ClientCaseSelector
        } : { exists: false },

        ClientCaseSelectorsManager: typeof window.ClientCaseSelectorsManager !== 'undefined' ? {
          exists: true,
          functions: Object.keys(window.ClientCaseSelectorsManager || {})
        } : { exists: false },

        // Cases modules
        CasesModule: typeof window.CasesModule !== 'undefined' ? {
          exists: true,
          functions: Object.keys(window.CasesModule || {})
        } : { exists: false },

        CasesIntegration: typeof window.CasesIntegration !== 'undefined' ? {
          exists: true,
          functions: Object.keys(window.CasesIntegration || {})
        } : { exists: false },

        // Main manager
        lawOfficeManager: typeof window.lawOfficeManager !== 'undefined' ? {
          exists: true,
          functions: Object.keys(window.lawOfficeManager || {})
        } : { exists: false },
      },

      // ===== 2. Utility Functions =====
      utilityFunctions: {
        safeText: typeof window.safeText === 'function',
        formatDate: typeof window.formatDate === 'function',
        generateId: typeof window.generateId === 'function',
        showNotification: typeof window.showNotification === 'function',
      },

      // ===== 3. Data State =====
      dataState: {
        clients: {
          exists: typeof window.clients !== 'undefined',
          count: window.clients?.length || 0,
          sample: window.clients?.[0] ? Object.keys(window.clients[0]) : []
        },
        cases: {
          exists: typeof window.cases !== 'undefined',
          count: window.cases?.length || 0,
          sample: window.cases?.[0] ? Object.keys(window.cases[0]) : []
        },
        budgetTasks: {
          exists: typeof window.budgetTasks !== 'undefined',
          count: window.budgetTasks?.length || 0,
          sample: window.budgetTasks?.[0] ? Object.keys(window.budgetTasks[0]) : []
        },
        timesheetEntries: {
          exists: typeof window.timesheetEntries !== 'undefined',
          count: window.timesheetEntries?.length || 0,
          sample: window.timesheetEntries?.[0] ? Object.keys(window.timesheetEntries[0]) : []
        },
      },

      // ===== 4. DOM Elements =====
      domElements: {
        // Main containers
        budgetContainer: !!document.getElementById('budget-container'),
        timesheetContainer: !!document.getElementById('timesheet-container'),
        clientsContainer: !!document.getElementById('clients-container'),

        // Forms
        budgetForm: !!document.getElementById('budgetForm'),
        timesheetForm: !!document.getElementById('timesheetForm'),

        // Selectors
        budgetClientSelector: !!document.getElementById('budgetClientSelector'),
        budgetCaseSelector: !!document.getElementById('budgetCaseSelector'),
        timesheetClientSelector: !!document.getElementById('timesheetClientSelector'),
        timesheetCaseSelector: !!document.getElementById('timesheetCaseSelector'),

        // Buttons
        addBudgetBtn: !!document.getElementById('addBudgetBtn'),
        addTimesheetBtn: !!document.getElementById('addTimesheetBtn'),
      },

      // ===== 5. Loaded Scripts =====
      loadedScripts: Array.from(document.querySelectorAll('script[src]')).map(script => {
        const src = script.getAttribute('src');
        return {
          src: src,
          loaded: true,
          version: src.match(/\?v=([^&]+)/)?.[1] || 'no-version'
        };
      }),

      // ===== 6. Event Listeners =====
      eventListeners: {
        budgetForm: !!document.getElementById('budgetForm')?.onsubmit,
        timesheetForm: !!document.getElementById('timesheetForm')?.onsubmit,
        addBudgetBtn: !!document.getElementById('addBudgetBtn')?.onclick,
        addTimesheetBtn: !!document.getElementById('addTimesheetBtn')?.onclick,
      },

      // ===== 7. Firebase State =====
      firebaseState: {
        firebase: typeof firebase !== 'undefined',
        firebaseInitialized: typeof firebase !== 'undefined' && firebase.apps?.length > 0,
        firestore: typeof firebase !== 'undefined' && typeof firebase.firestore === 'function',
        auth: typeof firebase !== 'undefined' && typeof firebase.auth === 'function',
      },

      // ===== 8. Console Errors =====
      consoleErrors: window._consoleErrors || [],

      // ===== 9. Browser Info =====
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
      },
    };

    return snapshot;
  },

  /**
   * הצגת snapshot בפורמט קריא
   */
  print(snapshot) {
    if (!snapshot) snapshot = this.create();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📸 SYSTEM SNAPSHOT - ' + snapshot.timestamp);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Global Objects
    console.log('🔧 GLOBAL OBJECTS:');
    Object.entries(snapshot.globalObjects).forEach(([name, info]) => {
      const status = info.exists ? '✅' : '❌';
      const details = info.functions ? ` (${info.functions.length} functions)` : '';
      console.log(`  ${status} ${name}${details}`);
    });
    console.log('');

    // Utility Functions
    console.log('⚙️ UTILITY FUNCTIONS:');
    Object.entries(snapshot.utilityFunctions).forEach(([name, exists]) => {
      console.log(`  ${exists ? '✅' : '❌'} ${name}`);
    });
    console.log('');

    // Data State
    console.log('💾 DATA STATE:');
    Object.entries(snapshot.dataState).forEach(([name, info]) => {
      const status = info.exists ? '✅' : '❌';
      console.log(`  ${status} ${name}: ${info.count} items`);
    });
    console.log('');

    // DOM Elements
    console.log('🎨 DOM ELEMENTS:');
    Object.entries(snapshot.domElements).forEach(([name, exists]) => {
      console.log(`  ${exists ? '✅' : '❌'} ${name}`);
    });
    console.log('');

    // Firebase
    console.log('🔥 FIREBASE:');
    Object.entries(snapshot.firebaseState).forEach(([name, exists]) => {
      console.log(`  ${exists ? '✅' : '❌'} ${name}`);
    });
    console.log('');

    // Loaded Scripts (top 10)
    console.log('📜 LOADED SCRIPTS (sample):');
    snapshot.loadedScripts.slice(0, 10).forEach(script => {
      console.log(`  • ${script.src} [v${script.version}]`);
    });
    if (snapshot.loadedScripts.length > 10) {
      console.log(`  ... and ${snapshot.loadedScripts.length - 10} more`);
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return snapshot;
  },

  /**
   * השוואה בין שני snapshots
   */
  compare(snapshot1, snapshot2) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 SNAPSHOT COMPARISON');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 Snapshot 1: ${snapshot1.timestamp}`);
    console.log(`📅 Snapshot 2: ${snapshot2.timestamp}`);
    console.log('');

    const differences = [];

    // Compare Global Objects
    console.log('🔧 GLOBAL OBJECTS DIFFERENCES:');
    Object.keys(snapshot1.globalObjects).forEach(key => {
      const obj1 = snapshot1.globalObjects[key];
      const obj2 = snapshot2.globalObjects[key];

      if (obj1.exists !== obj2.exists) {
        const status = obj2.exists ? '✅ ADDED' : '❌ REMOVED';
        console.log(`  ${status}: ${key}`);
        differences.push({ type: 'globalObject', key, status });
      }
    });
    console.log('');

    // Compare Utility Functions
    console.log('⚙️ UTILITY FUNCTIONS DIFFERENCES:');
    Object.keys(snapshot1.utilityFunctions).forEach(key => {
      const val1 = snapshot1.utilityFunctions[key];
      const val2 = snapshot2.utilityFunctions[key];

      if (val1 !== val2) {
        const status = val2 ? '✅ ADDED' : '❌ REMOVED';
        console.log(`  ${status}: ${key}`);
        differences.push({ type: 'utilityFunction', key, status });
      }
    });
    console.log('');

    // Compare Data State
    console.log('💾 DATA STATE DIFFERENCES:');
    Object.keys(snapshot1.dataState).forEach(key => {
      const data1 = snapshot1.dataState[key];
      const data2 = snapshot2.dataState[key];

      if (data1.count !== data2.count) {
        console.log(`  🔄 ${key}: ${data1.count} → ${data2.count} items`);
        differences.push({ type: 'dataState', key, from: data1.count, to: data2.count });
      }
    });
    console.log('');

    // Compare Scripts
    console.log('📜 SCRIPT DIFFERENCES:');
    const scripts1 = new Set(snapshot1.loadedScripts.map(s => s.src));
    const scripts2 = new Set(snapshot2.loadedScripts.map(s => s.src));

    snapshot2.loadedScripts.forEach(script => {
      if (!scripts1.has(script.src)) {
        console.log(`  ✅ ADDED: ${script.src}`);
        differences.push({ type: 'script', action: 'added', script: script.src });
      }
    });

    snapshot1.loadedScripts.forEach(script => {
      if (!scripts2.has(script.src)) {
        console.log(`  ❌ REMOVED: ${script.src}`);
        differences.push({ type: 'script', action: 'removed', script: script.src });
      }
    });
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total differences found: ${differences.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return differences;
  },

  /**
   * שמירת snapshot ל-localStorage
   */
  save(name) {
    const snapshot = this.create();
    localStorage.setItem(`snapshot_${name}`, JSON.stringify(snapshot));
    console.log(`✅ Snapshot saved as: snapshot_${name}`);
    return snapshot;
  },

  /**
   * טעינת snapshot מ-localStorage
   */
  load(name) {
    const data = localStorage.getItem(`snapshot_${name}`);
    if (!data) {
      console.error(`❌ Snapshot not found: snapshot_${name}`);
      return null;
    }
    return JSON.parse(data);
  },

  /**
   * רשימת כל ה-snapshots השמורים
   */
  list() {
    const snapshots = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('snapshot_')) {
        const name = key.replace('snapshot_', '');
        const data = JSON.parse(localStorage.getItem(key));
        snapshots.push({ name, timestamp: data.timestamp });
      }
    }

    console.log('📋 SAVED SNAPSHOTS:');
    snapshots.forEach(s => {
      console.log(`  • ${s.name} - ${s.timestamp}`);
    });

    return snapshots;
  }
};

// התקנת error tracking
window._consoleErrors = [];
const originalError = console.error;
console.error = function(...args) {
  const message = args.join(' ');

  window._consoleErrors.push({
    timestamp: new Date().toISOString(),
    message: message
  });

  // 🔇 Production mode - suppress known non-critical errors
  if (window.PRODUCTION_MODE) {
    // Suppress Virtual Assistant Analytics errors (permissions)
    if (message.includes('VirtualAssistant Error') || message.includes('AnalyticsEngine')) {
      return; // Don't print
    }
    // Suppress other known benign errors if needed
  }

  originalError.apply(console, args);
};

if (!window.PRODUCTION_MODE) {
  console.log('✅ SystemSnapshot loaded! Available commands:');
  console.log('  • SystemSnapshot.print()         - הצגת snapshot של המצב הנוכחי');
  console.log('  • SystemSnapshot.save("name")    - שמירת snapshot');
  console.log('  • SystemSnapshot.load("name")    - טעינת snapshot');
  console.log('  • SystemSnapshot.compare(s1,s2)  - השוואת snapshots');
  console.log('  • SystemSnapshot.list()          - רשימת snapshots שמורים');
}
