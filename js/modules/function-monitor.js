/**
 * Function Monitor - POC
 * מערכת ניטור פונקציות אוטומטית
 *
 * מעקב אחרי:
 * - כמה פעמים כל פונקציה נקראה
 * - כמה זמן היא לוקחת
 * - שגיאות וכשלים
 * - ביצועים לאורך זמן
 *
 * @author Claude + Chaim
 * @version 1.0.0 - POC
 */

class FunctionMonitor {
  constructor() {
    this.functionCalls = [];
    this.errors = [];
    this.startTime = Date.now();
    this.maxStoredCalls = 1000; // מקסימום 1000 קריאות בזיכרון

    // סטטיסטיקות בזמן אמת
    this.stats = {
      totalCalls: 0,
      totalErrors: 0,
      avgResponseTime: 0,
      slowestFunction: null,
      mostCalledFunction: null
    };

    // התראות
    this.alerts = [];
    this.alertThresholds = {
      slowFunction: 2000,      // 2 שניות
      errorRate: 0.1,          // 10% שגיאות
      callsPerMinute: 100      // 100 קריאות לדקה
    };

    console.log('🔍 Function Monitor initialized');
  }

  /**
   * עוטף פונקציה אסינכרונית עם ניטור מלא
   * @param {Object} obj - האובייקט שמכיל את הפונקציה
   * @param {string} functionName - שם הפונקציה
   */
  wrapAsync(obj, functionName) {
    const original = obj[functionName];
    if (typeof original !== 'function') {
      console.warn(`⚠️ ${functionName} is not a function`);
      return;
    }

    const monitor = this;
    const wrappedName = `${obj.constructor?.name || 'Global'}.${functionName}`;

    obj[functionName] = async function(...args) {
      const callId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = performance.now();

      // תיעוד קריאה
      const callData = {
        id: callId,
        function: wrappedName,
        timestamp: new Date().toISOString(),
        args: monitor._safeStringify(args),
        startTime: startTime
      };

      try {
        // הרצת הפונקציה המקורית
        const result = await original.apply(this, args);

        const duration = performance.now() - startTime;
        monitor._logSuccess(callData, result, duration);

        return result;

      } catch (error) {
        const duration = performance.now() - startTime;
        monitor._logError(callData, error, duration);

        // זרוק את השגיאה הלאה (לא לחסום את הפונקציה)
        throw error;
      }
    };

    console.log(`✅ Wrapped: ${wrappedName}`);
  }

  /**
   * עוטף פונקציה סינכרונית
   */
  wrapSync(obj, functionName) {
    const original = obj[functionName];
    if (typeof original !== 'function') {
      console.warn(`⚠️ ${functionName} is not a function`);
      return;
    }

    const monitor = this;
    const wrappedName = `${obj.constructor?.name || 'Global'}.${functionName}`;

    obj[functionName] = function(...args) {
      const callId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = performance.now();

      const callData = {
        id: callId,
        function: wrappedName,
        timestamp: new Date().toISOString(),
        args: monitor._safeStringify(args),
        startTime: startTime
      };

      try {
        const result = original.apply(this, args);
        const duration = performance.now() - startTime;
        monitor._logSuccess(callData, result, duration);
        return result;

      } catch (error) {
        const duration = performance.now() - startTime;
        monitor._logError(callData, error, duration);
        throw error;
      }
    };

    console.log(`✅ Wrapped: ${wrappedName}`);
  }

  /**
   * רישום קריאה מצליחה
   */
  _logSuccess(callData, result, duration) {
    const record = {
      ...callData,
      status: 'success',
      duration: Math.round(duration),
      resultType: typeof result,
      hasResult: result !== undefined && result !== null
    };

    this._addCall(record);
    this._updateStats(record);
    this._checkAlerts(record);

    // לוג לקונסול רק אם איטי
    if (duration > this.alertThresholds.slowFunction) {
      console.warn(`⏱️ SLOW: ${callData.function} took ${duration.toFixed(0)}ms`);
    }
  }

  /**
   * רישום שגיאה
   */
  _logError(callData, error, duration) {
    const record = {
      ...callData,
      status: 'error',
      duration: Math.round(duration),
      error: error.message,
      errorStack: error.stack,
      errorType: error.constructor.name
    };

    this._addCall(record);
    this.errors.push(record);
    this._updateStats(record);
    this._checkAlerts(record);

    console.error(`❌ ERROR: ${callData.function}`, {
      message: error.message,
      duration: `${duration.toFixed(0)}ms`
    });
  }

  /**
   * הוספת קריאה למאגר
   */
  _addCall(record) {
    this.functionCalls.push(record);

    // מגבלת זיכרון - מחק ישנים
    if (this.functionCalls.length > this.maxStoredCalls) {
      this.functionCalls.shift();
    }
  }

  /**
   * עדכון סטטיסטיקות
   */
  _updateStats(record) {
    this.stats.totalCalls++;

    if (record.status === 'error') {
      this.stats.totalErrors++;
    }

    // עדכון זמן תגובה ממוצע
    const allDurations = this.functionCalls
      .filter(c => c.duration)
      .map(c => c.duration);

    if (allDurations.length > 0) {
      this.stats.avgResponseTime = Math.round(
        allDurations.reduce((a, b) => a + b, 0) / allDurations.length
      );
    }

    // פונקציה הכי איטית
    const slowest = this.functionCalls
      .filter(c => c.duration)
      .sort((a, b) => b.duration - a.duration)[0];

    if (slowest) {
      this.stats.slowestFunction = {
        name: slowest.function,
        duration: slowest.duration,
        timestamp: slowest.timestamp
      };
    }

    // פונקציה הכי נקראת
    const callCounts = {};
    this.functionCalls.forEach(c => {
      callCounts[c.function] = (callCounts[c.function] || 0) + 1;
    });

    const mostCalled = Object.entries(callCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCalled) {
      this.stats.mostCalledFunction = {
        name: mostCalled[0],
        calls: mostCalled[1]
      };
    }
  }

  /**
   * בדיקת התראות
   */
  _checkAlerts(record) {
    // פונקציה איטית
    if (record.duration > this.alertThresholds.slowFunction) {
      this.alerts.push({
        type: 'SLOW_FUNCTION',
        function: record.function,
        duration: record.duration,
        threshold: this.alertThresholds.slowFunction,
        timestamp: new Date().toISOString()
      });
    }

    // שיעור שגיאות גבוה
    const errorRate = this.stats.totalErrors / this.stats.totalCalls;
    if (errorRate > this.alertThresholds.errorRate && this.stats.totalCalls > 10) {
      this.alerts.push({
        type: 'HIGH_ERROR_RATE',
        errorRate: (errorRate * 100).toFixed(2) + '%',
        totalErrors: this.stats.totalErrors,
        totalCalls: this.stats.totalCalls,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * המרה בטוחה ל-JSON (מונע circular references)
   */
  _safeStringify(obj) {
    try {
      // הגבלת עומק
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Error) return value.message;
        if (typeof value === 'object' && value !== null) {
          // הגבלת גודל אובייקט
          const keys = Object.keys(value);
          if (keys.length > 10) {
            return `[Object with ${keys.length} keys]`;
          }
        }
        return value;
      });
    } catch (e) {
      return '[Unable to stringify]';
    }
  }

  /**
   * קבלת סטטיסטיקות לפי פונקציה
   */
  getStatsByFunction(functionName) {
    const calls = this.functionCalls.filter(c => c.function.includes(functionName));

    if (calls.length === 0) {
      return null;
    }

    const errors = calls.filter(c => c.status === 'error');
    const durations = calls.filter(c => c.duration).map(c => c.duration);

    return {
      function: functionName,
      totalCalls: calls.length,
      errors: errors.length,
      errorRate: ((errors.length / calls.length) * 100).toFixed(2) + '%',
      avgDuration: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastCall: calls[calls.length - 1]?.timestamp,
      recentCalls: calls.slice(-5) // 5 אחרונות
    };
  }

  /**
   * סיכום כללי של כל הפונקציות
   */
  getSummary() {
    const functionNames = [...new Set(this.functionCalls.map(c => c.function))];
    const summary = {};

    functionNames.forEach(name => {
      const stats = this.getStatsByFunction(name);
      if (stats) {
        summary[name] = {
          calls: stats.totalCalls,
          errors: stats.errors,
          avgTime: stats.avgDuration + 'ms',
          errorRate: stats.errorRate
        };
      }
    });

    return summary;
  }

  /**
   * דשבורד טקסטואלי
   */
  printDashboard() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║         🔍 FUNCTION MONITOR DASHBOARD 🔍              ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // סטטיסטיקות כלליות
    console.log('📊 Overall Statistics:');
    console.log(`  Total Calls: ${this.stats.totalCalls}`);
    console.log(`  Total Errors: ${this.stats.totalErrors}`);
    console.log(`  Error Rate: ${((this.stats.totalErrors / this.stats.totalCalls) * 100).toFixed(2)}%`);
    console.log(`  Avg Response Time: ${this.stats.avgResponseTime}ms`);
    console.log(`  Uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s\n`);

    // פונקציה הכי איטית
    if (this.stats.slowestFunction) {
      console.log('🐌 Slowest Function:');
      console.log(`  ${this.stats.slowestFunction.name}`);
      console.log(`  Duration: ${this.stats.slowestFunction.duration}ms\n`);
    }

    // פונקציה הכי נקראת
    if (this.stats.mostCalledFunction) {
      console.log('🔥 Most Called Function:');
      console.log(`  ${this.stats.mostCalledFunction.name}`);
      console.log(`  Calls: ${this.stats.mostCalledFunction.calls}\n`);
    }

    // התראות אחרונות
    if (this.alerts.length > 0) {
      console.log('⚠️ Recent Alerts:');
      this.alerts.slice(-5).forEach(alert => {
        console.log(`  [${alert.type}] ${alert.function || ''} - ${JSON.stringify(alert)}`);
      });
      console.log('');
    }

    // טבלת פונקציות
    console.log('📋 Function Statistics:');
    console.table(this.getSummary());

    console.log('\n💡 Usage:');
    console.log('  functionMonitor.getStatsByFunction("functionName") - detailed stats');
    console.log('  functionMonitor.getSummary() - all functions summary');
    console.log('  functionMonitor.printDashboard() - show this dashboard\n');
  }

  /**
   * ייצוא נתונים ל-Firebase לשמירה
   */
  async saveToFirebase() {
    if (!window.firebaseDB) {
      console.warn('⚠️ Firebase not available');
      return;
    }

    try {
      const data = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        stats: this.stats,
        summary: this.getSummary(),
        alerts: this.alerts,
        recentErrors: this.errors.slice(-10), // 10 שגיאות אחרונות
        uptime: Date.now() - this.startTime
      };

      await window.firebaseDB.collection('function_monitor_logs').add(data);
      console.log('✅ Monitoring data saved to Firebase');
    } catch (error) {
      console.error('❌ Failed to save monitoring data:', error);
    }
  }

  /**
   * ניקוי נתונים
   */
  clear() {
    this.functionCalls = [];
    this.errors = [];
    this.alerts = [];
    this.stats.totalCalls = 0;
    this.stats.totalErrors = 0;
    console.log('🧹 Monitor data cleared');
  }
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FunctionMonitor;
}
