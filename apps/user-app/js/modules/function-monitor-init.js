/**
 * Function Monitor Initialization
 * אתחול ועטיפה של פונקציות קריטיות במערכת
 *
 * @author Claude + Chaim
 * @version 1.0.0 - POC
 */

(function() {
  'use strict';

  console.log('🚀 Initializing Function Monitor...');

  // המתן ש-manager יהיה מוכן
  function waitForManager() {
    return new Promise((resolve) => {
      const checkManager = () => {
        if (window.manager) {
          resolve(window.manager);
        } else {
          setTimeout(checkManager, 100);
        }
      };
      checkManager();
    });
  }

  // המתן ש-FirebaseOps יהיה מוכן
  function waitForFirebaseOps() {
    return new Promise((resolve) => {
      const checkFirebaseOps = () => {
        if (window.FirebaseOps) {
          resolve(window.FirebaseOps);
        } else {
          setTimeout(checkFirebaseOps, 100);
        }
      };
      checkFirebaseOps();
    });
  }

  // אתחול ראשי
  async function initialize() {
    try {
      // המתן למערכת להיות מוכנה
      await Promise.all([
        waitForManager(),
        waitForFirebaseOps()
      ]);

      console.log('✅ System ready, starting monitor...');

      // יצירת monitor
      const monitor = new FunctionMonitor();
      window.functionMonitor = monitor;

      // יצירת dashboard
      const dashboard = new FunctionMonitorDashboard(monitor);
      window.functionMonitorDashboard = dashboard;

      // עטיפת פונקציות קריטיות
      wrapCriticalFunctions(monitor);

      // הוספת כפתור toggle בממשק
      addToggleButton(dashboard);

      // שמירה אוטומטית ל-Firebase כל 5 דקות
      startAutoSave(monitor);

      console.log('✅ Function Monitor initialized successfully!');
      console.log('💡 Use Ctrl+Shift+M to toggle dashboard');
      console.log('💡 Or click the floating button in the bottom-left corner');

    } catch (error) {
      console.error('❌ Failed to initialize Function Monitor:', error);
    }
  }

  /**
   * עטיפת 5 הפונקציות הקריטיות
   */
  function wrapCriticalFunctions(monitor) {
    console.log('🔧 Wrapping critical functions...');

    const manager = window.manager;
    const FirebaseOps = window.FirebaseOps;

    // 1. addBudgetTask - הוספת משימה
    if (manager && typeof manager.addBudgetTask === 'function') {
      monitor.wrapAsync(manager, 'addBudgetTask');
      console.log('  ✅ Wrapped: manager.addBudgetTask');
    }

    // 2. addTimesheetEntry - רישום שעות
    if (manager && typeof manager.addTimesheetEntry === 'function') {
      monitor.wrapAsync(manager, 'addTimesheetEntry');
      console.log('  ✅ Wrapped: manager.addTimesheetEntry');
    }

    // 3. loadClientsFromFirebase - טעינת לקוחות
    if (FirebaseOps && typeof FirebaseOps.loadClientsFromFirebase === 'function') {
      monitor.wrapAsync(FirebaseOps, 'loadClientsFromFirebase');
      console.log('  ✅ Wrapped: FirebaseOps.loadClientsFromFirebase');
    }

    // 4. createClient - יצירת לקוח חדש
    if (manager && typeof manager.createClient === 'function') {
      monitor.wrapAsync(manager, 'createClient');
      console.log('  ✅ Wrapped: manager.createClient');
    }

    // 5. generateReport - יצירת דוח
    if (window.generateReport && typeof window.generateReport === 'function') {
      monitor.wrapAsync(window, 'generateReport');
      console.log('  ✅ Wrapped: window.generateReport');
    }

    // בונוס: עטוף פונקציות נוספות שימושיות
    wrapAdditionalFunctions(monitor, manager, FirebaseOps);
  }

  /**
   * עטיפת פונקציות נוספות (אופציונלי)
   */
  function wrapAdditionalFunctions(monitor, manager, FirebaseOps) {
    // טעינת משימות תקצוב
    if (FirebaseOps && typeof FirebaseOps.loadBudgetTasksFromFirebase === 'function') {
      monitor.wrapAsync(FirebaseOps, 'loadBudgetTasksFromFirebase');
    }

    // עדכון משימה
    if (manager && typeof manager.updateTask === 'function') {
      monitor.wrapAsync(manager, 'updateTask');
    }

    // השלמת משימה
    if (manager && typeof manager.completeTask === 'function') {
      monitor.wrapAsync(manager, 'completeTask');
    }

    // סינון משימות
    if (manager && typeof manager.filterTasks === 'function') {
      monitor.wrapSync(manager, 'filterTasks');
    }

    console.log('  ✅ Wrapped additional functions');
  }

  /**
   * הוספת כפתור toggle צף
   */
  function addToggleButton(dashboard) {
    const button = document.createElement('button');
    button.id = 'fm-toggle-button';
    button.innerHTML = '🔍';
    button.title = 'Toggle Function Monitor (Ctrl+Shift+M)';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      transition: all 0.3s ease;
    `;

    button.addEventListener('mouseover', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
    });

    button.addEventListener('mouseout', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });

    button.addEventListener('click', () => {
      dashboard.toggle();
    });

    document.body.appendChild(button);

    // קיצור מקלדת: Ctrl+Shift+M
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        dashboard.toggle();
      }
    });

    console.log('✅ Toggle button added');
  }

  /**
   * שמירה אוטומטית ל-Firebase
   */
  function startAutoSave(monitor) {
    // שמירה כל 5 דקות
    setInterval(() => {
      if (monitor.stats.totalCalls > 0) {
        monitor.saveToFirebase();
        console.log('💾 Auto-saved monitoring data to Firebase');
      }
    }, 5 * 60 * 1000); // 5 דקות

    console.log('✅ Auto-save enabled (every 5 minutes)');
  }

  /**
   * פונקציות עזר גלובליות
   */
  window.FunctionMonitorHelper = {
    /**
     * הצג סיכום בקונסול
     */
    showSummary() {
      if (!window.functionMonitor) {
        console.warn('Function Monitor not initialized');
        return;
      }

      window.functionMonitor.printDashboard();
    },

    /**
     * קבל סטטיסטיקות לפונקציה מסוימת
     */
    getStats(functionName) {
      if (!window.functionMonitor) {
        console.warn('Function Monitor not initialized');
        return null;
      }

      return window.functionMonitor.getStatsByFunction(functionName);
    },

    /**
     * הצג דשבורד
     */
    showDashboard() {
      if (!window.functionMonitorDashboard) {
        console.warn('Dashboard not initialized');
        return;
      }

      window.functionMonitorDashboard.show();
    },

    /**
     * הסתר דשבורד
     */
    hideDashboard() {
      if (!window.functionMonitorDashboard) {
        console.warn('Dashboard not initialized');
        return;
      }

      window.functionMonitorDashboard.hide();
    },

    /**
     * שמור ל-Firebase ידנית
     */
    async saveNow() {
      if (!window.functionMonitor) {
        console.warn('Function Monitor not initialized');
        return;
      }

      await window.functionMonitor.saveToFirebase();
      console.log('✅ Saved to Firebase');
    },

    /**
     * נקה נתונים
     */
    clear() {
      if (!window.functionMonitor) {
        console.warn('Function Monitor not initialized');
        return;
      }

      if (confirm('Are you sure you want to clear all monitoring data?')) {
        window.functionMonitor.clear();
        console.log('✅ Data cleared');
      }
    },

    /**
     * עזרה
     */
    help() {
      console.log(`
╔════════════════════════════════════════════════════════╗
║         🔍 FUNCTION MONITOR - HELP 🔍                 ║
╚════════════════════════════════════════════════════════╝

📌 Available Commands:

  FunctionMonitorHelper.showSummary()
    → Display summary in console

  FunctionMonitorHelper.getStats('functionName')
    → Get detailed stats for a specific function

  FunctionMonitorHelper.showDashboard()
    → Show visual dashboard

  FunctionMonitorHelper.hideDashboard()
    → Hide visual dashboard

  FunctionMonitorHelper.saveNow()
    → Save monitoring data to Firebase immediately

  FunctionMonitorHelper.clear()
    → Clear all monitoring data

  FunctionMonitorHelper.help()
    → Show this help message

⌨️ Keyboard Shortcuts:

  Ctrl+Shift+M
    → Toggle dashboard

🎯 Direct Access:

  window.functionMonitor
    → Access monitor instance

  window.functionMonitorDashboard
    → Access dashboard instance

💡 Example Usage:

  // Get stats for a function
  FunctionMonitorHelper.getStats('addBudgetTask')

  // Show dashboard
  FunctionMonitorHelper.showDashboard()

  // Save to Firebase
  FunctionMonitorHelper.saveNow()

      `);
    }
  };

  // התחל אתחול
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
