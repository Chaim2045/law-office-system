/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║              MODALS COMPATIBILITY LAYER                               ║
 * ║                   Law Office Management System                        ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  Provides backward compatibility during migration                    ║
 * ║  Wraps old modal functions to use ModalsManager                      ║
 * ║                                                                       ║
 * ║  Usage: Include BEFORE application code                              ║
 * ║  <script src="js/modules/modals-manager.js"></script>                ║
 * ║  <script src="js/modules/modals-compat.js"></script>                 ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/* global ModalsManager */

(function (global) {
  'use strict';

  // Verify ModalsManager is loaded
  if (typeof ModalsManager === 'undefined') {
    console.error('❌ ModalsManager must be loaded before modals-compat.js');
    return;
  }

  Logger.log('🔄 Initializing Modals Compatibility Layer...');

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Enable logging for debugging
    debug: false,

    // Keep original functions as backup
    preserveOriginals: true,

    // Track usage statistics
    trackUsage: true,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ORIGINAL FUNCTIONS BACKUP
  // ═══════════════════════════════════════════════════════════════════════

  const ORIGINALS = {
    alert: global.alert,
    confirm: global.confirm,
    prompt: global.prompt,
  };

  // Usage statistics
  const USAGE_STATS = {
    alert: 0,
    confirm: 0,
    prompt: 0,
    showSimpleLoading: 0,
    hideSimpleLoading: 0,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Log debug message
   */
  function debug(message, ...args) {
    if (CONFIG.debug) {
      Logger.log('[Compat]', message, ...args);
    }
  }

  /**
   * Track usage
   */
  function trackUsage(functionName) {
    if (CONFIG.trackUsage && USAGE_STATS.hasOwnProperty(functionName)) {
      USAGE_STATS[functionName]++;
    }
  }

  /**
   * Get usage report
   */
  function getUsageReport() {
    const total = Object.values(USAGE_STATS).reduce((sum, count) => sum + count, 0);
    return {
      ...USAGE_STATS,
      total,
      timestamp: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NATIVE BROWSER MODALS OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Override window.alert()
   *
   * NOTE: This is a NON-BLOCKING replacement!
   * Original alert() blocks execution, new one doesn't.
   */
  global.alert = function (message) {
    debug('alert() called:', message);
    trackUsage('alert');

    // Use ModalsManager (non-blocking)
    ModalsManager.showAlert(String(message || ''));

    // Note: Cannot block execution in modern browsers
    // If blocking is needed, use ORIGINALS.alert
  };

  /**
   * Override window.confirm()
   *
   * NOTE: This returns a Promise instead of boolean!
   * For backward compatibility, you MUST use await or .then()
   */
  global.confirm = function (message) {
    debug('confirm() called:', message);
    trackUsage('confirm');

    // Return Promise (breaking change!)
    return ModalsManager.showConfirm(String(message || ''));
  };

  /**
   * Override window.prompt()
   *
   * NOTE: prompt() is not yet implemented in ModalsManager
   * Falls back to original for now
   */
  global.prompt = function (message, defaultValue) {
    debug('prompt() called:', message);
    trackUsage('prompt');

    console.warn('⚠️ prompt() not yet migrated to ModalsManager, using native');
    return ORIGINALS.prompt.call(global, message, defaultValue);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING OVERLAYS COMPATIBILITY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Backward compatible showSimpleLoading
   */
  global.showSimpleLoading = function (message) {
    debug('showSimpleLoading() called:', message);
    trackUsage('showSimpleLoading');

    return ModalsManager.showLoading(message);
  };

  /**
   * Backward compatible hideSimpleLoading
   */
  global.hideSimpleLoading = function (loadingId) {
    debug('hideSimpleLoading() called');
    trackUsage('hideSimpleLoading');

    ModalsManager.hideLoading(loadingId);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS (Recommended for new code)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Async alert helper
   * Use this instead of alert() for cleaner code
   */
  global.showAlert = async function (message, config = {}) {
    debug('showAlert() called:', message);

    if (typeof message === 'string') {
      return await ModalsManager.showAlert({ ...config, message });
    } else {
      return await ModalsManager.showAlert(message);
    }
  };

  /**
   * Async confirm helper
   * Use this instead of confirm() for clearer async behavior
   */
  global.showConfirm = async function (message, config = {}) {
    debug('showConfirm() called:', message);

    if (typeof message === 'string') {
      return await ModalsManager.showConfirm({ ...config, message });
    } else {
      return await ModalsManager.showConfirm(message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RESTORE ORIGINAL FUNCTIONS (Emergency fallback)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Restore original browser functions
   * Use in case of critical bugs
   */
  global.restoreOriginalModals = function () {
    console.warn('⚠️ Restoring original modal functions');

    global.alert = ORIGINALS.alert;
    global.confirm = ORIGINALS.confirm;
    global.prompt = ORIGINALS.prompt;

    Logger.log('✅ Original modals restored');
  };

  // ═══════════════════════════════════════════════════════════════════════
  // MIGRATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if code is using old alert/confirm pattern
   */
  global.checkModalUsage = function () {
    const report = getUsageReport();

    Logger.log('📊 Modal Usage Report:');
    Logger.log('═══════════════════════════════════════');
    Logger.log(`Total calls: ${report.total}`);
    Logger.log('Breakdown:');
    Logger.log(`  - alert():             ${report.alert}`);
    Logger.log(`  - confirm():           ${report.confirm}`);
    Logger.log(`  - prompt():            ${report.prompt}`);
    Logger.log(`  - showSimpleLoading(): ${report.showSimpleLoading}`);
    Logger.log(`  - hideSimpleLoading(): ${report.hideSimpleLoading}`);
    Logger.log('═══════════════════════════════════════');

    return report;
  };

  /**
   * Get migration recommendations
   */
  global.getMigrationRecommendations = function () {
    const report = getUsageReport();
    const recommendations = [];

    if (report.alert > 0) {
      recommendations.push({
        type: 'alert',
        count: report.alert,
        priority: 'high',
        recommendation: 'Replace alert() with await ModalsManager.showAlert()',
        example: `
          // Old:
          alert('Message');

          // New:
          await ModalsManager.showAlert('Message');
        `,
      });
    }

    if (report.confirm > 0) {
      recommendations.push({
        type: 'confirm',
        count: report.confirm,
        priority: 'high',
        recommendation: 'Replace confirm() with await ModalsManager.showConfirm()',
        example: `
          // Old:
          if (confirm('Delete?')) { ... }

          // New:
          if (await ModalsManager.showConfirm('Delete?')) { ... }
        `,
      });
    }

    if (report.showSimpleLoading > 0) {
      recommendations.push({
        type: 'loading',
        count: report.showSimpleLoading,
        priority: 'medium',
        recommendation: 'Already compatible, but consider using ModalsManager directly',
        example: `
          // Current (works):
          showSimpleLoading('Loading...');

          // Recommended:
          const id = ModalsManager.showLoading('Loading...');
          // ...
          ModalsManager.hideLoading(id);
        `,
      });
    }

    Logger.log('💡 Migration Recommendations:');
    Logger.log('═══════════════════════════════════════');
    recommendations.forEach((rec, i) => {
      Logger.log(`\n${i + 1}. ${rec.type} (${rec.count} usages)`);
      Logger.log(`   Priority: ${rec.priority}`);
      Logger.log(`   ${rec.recommendation}`);
      Logger.log(`   Example:${rec.example}`);
    });
    Logger.log('═══════════════════════════════════════');

    return recommendations;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-FIX WARNINGS
  // ═══════════════════════════════════════════════════════════════════════

  // Warn about blocking behavior changes
  console.warn(`
⚠️  IMPORTANT: Compatibility Layer Loaded
════════════════════════════════════════

The following functions have been overridden:
- alert()   → ModalsManager.showAlert()   (NON-BLOCKING!)
- confirm() → ModalsManager.showConfirm() (RETURNS PROMISE!)

Breaking Changes:
1. alert() no longer blocks code execution
2. confirm() returns Promise<boolean> instead of boolean

Migration Path:
- Replace: if (confirm('msg'))
- With:    if (await ModalsManager.showConfirm('msg'))

Commands:
- checkModalUsage()             → See usage stats
- getMigrationRecommendations() → Get migration guide
- restoreOriginalModals()       → Emergency rollback

════════════════════════════════════════
  `);

  // ═══════════════════════════════════════════════════════════════════════
  // EXPOSE UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  global.ModalsCompat = {
    version: '1.0.0',
    getUsageReport,
    checkModalUsage: global.checkModalUsage,
    getMigrationRecommendations: global.getMigrationRecommendations,
    restoreOriginalModals: global.restoreOriginalModals,
    originals: CONFIG.preserveOriginals ? ORIGINALS : null,
  };

  Logger.log('✅ Modals Compatibility Layer initialized');

})(typeof window !== 'undefined' ? window : global);
