/**
 * Performance Monitor
 * מערכת ניטור ביצועים לפעולות קריטיות
 *
 * @module performance-monitor
 * @version 1.0.0
 *
 * שימוש:
 * ```javascript
 * const monitor = PerformanceMonitor;
 *
 * // התחלת מדידה
 * const opId = monitor.start('case-number-generation');
 *
 * try {
 *   // ... פעולה קריטית ...
 *   monitor.success(opId);
 * } catch (error) {
 *   monitor.failure(opId, error);
 * }
 *
 * // קבלת סטטיסטיקות
 * const stats = monitor.getStats('case-number-generation');
 * console.log(`Average time: ${stats.avgDuration}ms`);
 * ```
 */

(function() {
  'use strict';

  class PerformanceMonitor {
    constructor() {
      // אחסון כל הפעולות הפעילות (key = operationId)
      this.activeOperations = new Map();

      // אחסון היסטוריה של פעולות שהסתיימו (key = operationType)
      this.completedOperations = new Map();

      // הגדרות
      this.config = {
        maxHistorySize: 1000,        // מקסימום פעולות בהיסטוריה לכל סוג
        alertThresholds: {
          duration: 5000,             // אזהרה אם פעולה לוקחת > 5 שניות
          failureRate: 0.1            // אזהרה אם > 10% מהפעולות נכשלות
        },
        enableConsoleLogging: false  // האם להדפיס ל-console
      };

      // מונים גלובליים
      this.globalStats = {
        totalOperations: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        totalDuration: 0
      };

      Logger.log('✅ PerformanceMonitor initialized');
    }

    /**
     * התחלת מדידת פעולה
     * @param {string} operationType - סוג הפעולה (case-number-generation, firebase-query, etc.)
     * @param {Object} metadata - מטא-דאטה נוסף (אופציונלי)
     * @returns {string} operationId - מזהה ייחודי לפעולה
     */
    start(operationType, metadata = {}) {
      const operationId = this._generateOperationId(operationType);

      const operation = {
        id: operationId,
        type: operationType,
        startTime: performance.now(),
        startTimestamp: new Date().toISOString(),
        metadata: metadata,
        status: 'running'
      };

      this.activeOperations.set(operationId, operation);

      if (this.config.enableConsoleLogging) {
        Logger.log(`⏱️ [PerformanceMonitor] Started: ${operationType} (${operationId})`);
      }

      return operationId;
    }

    /**
     * סיום מוצלח של פעולה
     * @param {string} operationId - מזהה הפעולה
     * @param {Object} result - תוצאת הפעולה (אופציונלי)
     */
    success(operationId, result = null) {
      this._endOperation(operationId, 'success', result);
    }

    /**
     * סיום כושל של פעולה
     * @param {string} operationId - מזהה הפעולה
     * @param {Error|string} error - השגיאה שארעה
     */
    failure(operationId, error) {
      this._endOperation(operationId, 'failure', error);
    }

    /**
     * סיום פעולה (פנימי)
     * @private
     */
    _endOperation(operationId, status, data) {
      const operation = this.activeOperations.get(operationId);

      if (!operation) {
        console.warn(`⚠️ [PerformanceMonitor] Operation not found: ${operationId}`);
        return;
      }

      const endTime = performance.now();
      const duration = endTime - operation.startTime;

      // עדכון הפעולה
      operation.endTime = endTime;
      operation.endTimestamp = new Date().toISOString();
      operation.duration = duration;
      operation.status = status;
      operation.data = data;

      // הסרה מפעולות פעילות
      this.activeOperations.delete(operationId);

      // הוספה להיסטוריה
      this._addToHistory(operation);

      // עדכון סטטיסטיקות גלובליות
      this._updateGlobalStats(operation);

      // בדיקת אזהרות
      this._checkAlerts(operation);

      if (this.config.enableConsoleLogging) {
        const emoji = status === 'success' ? '✅' : '❌';
        Logger.log(`${emoji} [PerformanceMonitor] ${operation.type}: ${duration.toFixed(2)}ms (${status})`);
      }
    }

    /**
     * הוספת פעולה להיסטוריה
     * @private
     */
    _addToHistory(operation) {
      const type = operation.type;

      if (!this.completedOperations.has(type)) {
        this.completedOperations.set(type, []);
      }

      const history = this.completedOperations.get(type);
      history.push(operation);

      // שמירה על גודל מקסימלי
      if (history.length > this.config.maxHistorySize) {
        history.shift(); // הסרת הפעולה הכי ישנה
      }
    }

    /**
     * עדכון סטטיסטיקות גלובליות
     * @private
     */
    _updateGlobalStats(operation) {
      this.globalStats.totalOperations++;
      this.globalStats.totalDuration += operation.duration;

      if (operation.status === 'success') {
        this.globalStats.totalSuccesses++;
      } else {
        this.globalStats.totalFailures++;
      }
    }

    /**
     * בדיקת תנאי אזהרה
     * @private
     */
    _checkAlerts(operation) {
      // אזהרה על זמן ביצוע ארוך
      if (operation.duration > this.config.alertThresholds.duration) {
        console.warn(
          `⚠️ [PerformanceMonitor] SLOW OPERATION: ${operation.type} took ${operation.duration.toFixed(2)}ms ` +
          `(threshold: ${this.config.alertThresholds.duration}ms)`
        );

        // שליחת אירוע מותאם אישית
        this._triggerAlert('slow-operation', {
          type: operation.type,
          duration: operation.duration,
          threshold: this.config.alertThresholds.duration
        });
      }

      // אזהרה על שיעור כשלונות גבוה
      const stats = this.getStats(operation.type);
      if (stats.failureRate > this.config.alertThresholds.failureRate) {
        console.warn(
          `⚠️ [PerformanceMonitor] HIGH FAILURE RATE: ${operation.type} has ${(stats.failureRate * 100).toFixed(1)}% failures ` +
          `(threshold: ${(this.config.alertThresholds.failureRate * 100).toFixed(1)}%)`
        );

        this._triggerAlert('high-failure-rate', {
          type: operation.type,
          failureRate: stats.failureRate,
          threshold: this.config.alertThresholds.failureRate
        });
      }
    }

    /**
     * הפעלת אירוע אזהרה
     * @private
     */
    _triggerAlert(alertType, data) {
      const event = new CustomEvent('performance-alert', {
        detail: {
          alertType: alertType,
          timestamp: new Date().toISOString(),
          data: data
        }
      });

      window.dispatchEvent(event);
    }

    /**
     * קבלת סטטיסטיקות עבור סוג פעולה מסוים
     * @param {string} operationType - סוג הפעולה
     * @returns {Object} סטטיסטיקות
     */
    getStats(operationType) {
      const history = this.completedOperations.get(operationType) || [];

      if (history.length === 0) {
        return {
          type: operationType,
          count: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
          failureRate: 0,
          avgDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          p50Duration: 0,
          p95Duration: 0,
          p99Duration: 0
        };
      }

      const successes = history.filter(op => op.status === 'success');
      const failures = history.filter(op => op.status === 'failure');
      const durations = history.map(op => op.duration).sort((a, b) => a - b);

      return {
        type: operationType,
        count: history.length,
        successCount: successes.length,
        failureCount: failures.length,
        successRate: successes.length / history.length,
        failureRate: failures.length / history.length,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        p50Duration: this._percentile(durations, 50),
        p95Duration: this._percentile(durations, 95),
        p99Duration: this._percentile(durations, 99)
      };
    }

    /**
     * קבלת כל הסטטיסטיקות
     * @returns {Object} כל הסטטיסטיקות
     */
    getAllStats() {
      const stats = {};

      for (const [type, _] of this.completedOperations) {
        stats[type] = this.getStats(type);
      }

      // הוספת סטטיסטיקות גלובליות
      stats._global = {
        totalOperations: this.globalStats.totalOperations,
        totalSuccesses: this.globalStats.totalSuccesses,
        totalFailures: this.globalStats.totalFailures,
        avgDuration: this.globalStats.totalOperations > 0
          ? this.globalStats.totalDuration / this.globalStats.totalOperations
          : 0,
        successRate: this.globalStats.totalOperations > 0
          ? this.globalStats.totalSuccesses / this.globalStats.totalOperations
          : 0,
        failureRate: this.globalStats.totalOperations > 0
          ? this.globalStats.totalFailures / this.globalStats.totalOperations
          : 0
      };

      return stats;
    }

    /**
     * קבלת פעולות פעילות
     * @returns {Array} רשימת פעולות פעילות
     */
    getActiveOperations() {
      return Array.from(this.activeOperations.values());
    }

    /**
     * קבלת היסטוריה של סוג פעולה מסוים
     * @param {string} operationType - סוג הפעולה
     * @param {number} limit - מספר פעולות מקסימלי (ברירת מחדל: 100)
     * @returns {Array} רשימת פעולות
     */
    getHistory(operationType, limit = 100) {
      const history = this.completedOperations.get(operationType) || [];
      return history.slice(-limit); // N אחרונות
    }

    /**
     * ניקוי כל ההיסטוריה
     */
    clear() {
      this.activeOperations.clear();
      this.completedOperations.clear();
      this.globalStats = {
        totalOperations: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        totalDuration: 0
      };

      Logger.log('🧹 PerformanceMonitor cleared');
    }

    /**
     * ניקוי היסטוריה של סוג פעולה מסוים
     * @param {string} operationType - סוג הפעולה
     */
    clearType(operationType) {
      this.completedOperations.delete(operationType);
      Logger.log(`🧹 PerformanceMonitor cleared: ${operationType}`);
    }

    /**
     * עדכון הגדרות
     * @param {Object} newConfig - הגדרות חדשות
     */
    configure(newConfig) {
      this.config = { ...this.config, ...newConfig };
      Logger.log('⚙️ PerformanceMonitor configured:', this.config);
    }

    /**
     * ייצוא נתונים ל-JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
      const data = {
        timestamp: new Date().toISOString(),
        globalStats: this.globalStats,
        activeOperations: this.getActiveOperations(),
        stats: this.getAllStats()
      };

      return JSON.stringify(data, null, 2);
    }

    /**
     * ייצוא נתונים ל-Firebase (אופציונלי)
     * @param {string} collection - שם האוסף ב-Firestore
     * @returns {Promise<void>}
     */
    async exportToFirebase(collection = 'performance_metrics') {
      try {
        const data = {
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          globalStats: this.globalStats,
          stats: this.getAllStats(),
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        };

        await firebase.firestore()
          .collection(collection)
          .add(data);

        Logger.log('✅ Performance metrics exported to Firebase');
      } catch (error) {
        console.error('❌ Error exporting to Firebase:', error);
        throw error;
      }
    }

    /**
     * יצירת מזהה ייחודי לפעולה
     * @private
     */
    _generateOperationId(operationType) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `${operationType}-${timestamp}-${random}`;
    }

    /**
     * חישוב percentile
     * @private
     */
    _percentile(sortedArray, percentile) {
      if (sortedArray.length === 0) {
return 0;
}

      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
      return sortedArray[Math.max(0, index)];
    }

    /**
     * הדפסת דוח מסודר ל-console
     */
    printReport() {
      console.log('\n═══════════════════════════════════════════');
      console.log('📊 PERFORMANCE MONITOR REPORT');
      console.log('═══════════════════════════════════════════\n');

      const stats = this.getAllStats();

      // סטטיסטיקות גלובליות
      console.log('🌍 Global Stats:');
      console.log(`   Total Operations: ${stats._global.totalOperations}`);
      console.log(`   Successes: ${stats._global.totalSuccesses} (${(stats._global.successRate * 100).toFixed(1)}%)`);
      console.log(`   Failures: ${stats._global.totalFailures} (${(stats._global.failureRate * 100).toFixed(1)}%)`);
      console.log(`   Avg Duration: ${stats._global.avgDuration.toFixed(2)}ms\n`);

      // סטטיסטיקות לפי סוג
      for (const [type, typeStats] of Object.entries(stats)) {
        if (type === '_global') {
continue;
}

        console.log(`📈 ${type}:`);
        console.log(`   Count: ${typeStats.count}`);
        console.log(`   Success Rate: ${(typeStats.successRate * 100).toFixed(1)}%`);
        console.log(`   Avg: ${typeStats.avgDuration.toFixed(2)}ms | Min: ${typeStats.minDuration.toFixed(2)}ms | Max: ${typeStats.maxDuration.toFixed(2)}ms`);
        console.log(`   P50: ${typeStats.p50Duration.toFixed(2)}ms | P95: ${typeStats.p95Duration.toFixed(2)}ms | P99: ${typeStats.p99Duration.toFixed(2)}ms\n`);
      }

      // פעולות פעילות
      const active = this.getActiveOperations();
      if (active.length > 0) {
        console.log(`⏳ Active Operations (${active.length}):`);
        active.forEach(op => {
          const elapsed = performance.now() - op.startTime;
          console.log(`   ${op.type}: ${elapsed.toFixed(2)}ms (running)`);
        });
        console.log('');
      }

      console.log('═══════════════════════════════════════════\n');
    }
  }

  // ✅ יצירת instance גלובלי יחיד (Singleton)
  window.PerformanceMonitor = window.PerformanceMonitor || new PerformanceMonitor();

  // ✅ הוספת event listener לאזהרות
  window.addEventListener('performance-alert', (event) => {
    const { alertType, data } = event.detail;
    Logger.log(`⚠️ [Performance Alert] ${alertType}:`, data);
  });

  Logger.log('✅ PerformanceMonitor module loaded');

})();
