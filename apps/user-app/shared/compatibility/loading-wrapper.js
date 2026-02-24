/**
 * ========================================
 * Loading Overlay - Compatibility Wrapper
 * ========================================
 *
 * שכבת תאימות המאפשרת שימוש במערכת החדשה דרך ה-API הישן
 * כך הקוד הקיים ממשיך לעבוד ללא שינויים!
 *
 * @version 1.0.0
 * @date 2025-01-27
 * @module LoadingCompatibilityWrapper
 *
 * ========================================
 * איך זה עובד:
 * ========================================
 *
 * 1. אם Feature Flag = false:
 *    → השארת המערכת הישנה (לא נוגעים בכלום)
 *
 * 2. אם Feature Flag = true:
 *    → ה-API הישן מפנה למערכת החדשה
 *    → הקוד הקיים ממשיך לעבוד!
 *
 * ========================================
 * דוגמאות:
 * ========================================
 *
 * // הקוד הישן עדיין עובד:
 * window.showLoading('טוען...');
 * window.hideLoading();
 *
 * // או דרך NotificationSystem:
 * window.NotificationSystem.showLoading('שומר...');
 * window.NotificationSystem.hideLoading();
 *
 * // או דרך NotificationManager (master-admin-panel):
 * window.NotificationManager.loading('מעבד...');
 */

(function() {
  'use strict';

  // ========================================
  // Check Configuration
  // ========================================

  const useSharedUI = window.SHARED_UI_CONFIG?.USE_SHARED_LOADING || false;
  const debugLog = window.SharedUIHelpers?.debugLog || console.log.bind(console);

  debugLog('🔄 Loading Compatibility Wrapper initializing...', {
    useSharedUI,
    rollback: window.SHARED_UI_CONFIG?.ROLLBACK_TO_LEGACY
  });

  // Emergency rollback check
  if (window.SHARED_UI_CONFIG?.ROLLBACK_TO_LEGACY) {
    console.warn('🚨 [LoadingWrapper] EMERGENCY ROLLBACK - Using legacy system');
    return; // Exit early - use old system
  }

  // ========================================
  // If NOT using shared UI - exit early
  // ========================================

  if (!useSharedUI) {
    debugLog('🔵 Using legacy loading system (default)');
    return; // Exit - old system continues to work
  }

  // ========================================
  // If using shared UI - create wrapper
  // ========================================

  debugLog('✅ Activating Unified Loading System');

  // Create unified loader instance
  let unifiedLoader = null;

  /**
   * Get or create unified loader instance
   * @returns {UnifiedLoadingOverlay}
   */
  function getLoader() {
    if (!unifiedLoader) {
      if (typeof window.UnifiedLoadingOverlay !== 'function') {
        console.error('[LoadingWrapper] ❌ UnifiedLoadingOverlay not found!');
        return null;
      }
      unifiedLoader = new window.UnifiedLoadingOverlay();
      debugLog('✅ UnifiedLoadingOverlay instance created');
    }
    return unifiedLoader;
  }

  // ========================================
  // Global API (window.showLoading / window.hideLoading)
  // ========================================

  /**
   * Global showLoading function
   * תואם ל-API הישן
   */
  window.showLoading = function(message, options) {
    debugLog('📤 window.showLoading called', { message, options });

    const loader = getLoader();
    if (loader) {
      loader.show(message, options);
    } else {
      console.error('[LoadingWrapper] Failed to show loading');
    }
  };

  /**
   * Global hideLoading function
   * תואם ל-API הישן
   */
  window.hideLoading = function() {
    debugLog('📥 window.hideLoading called');

    const loader = getLoader();
    if (loader) {
      loader.hide();
    } else {
      console.error('[LoadingWrapper] Failed to hide loading');
    }
  };

  // ========================================
  // NotificationSystem API (Main App)
  // ========================================

  if (window.NotificationSystem) {
    debugLog('🔧 Wrapping NotificationSystem.showLoading/hideLoading');

    // Save original methods (for rollback if needed)
    const originalShowLoading = window.NotificationSystem.showLoading;
    const originalHideLoading = window.NotificationSystem.hideLoading;

    /**
     * Wrap showLoading
     */
    window.NotificationSystem.showLoading = function(message, options) {
      debugLog('📤 NotificationSystem.showLoading called', { message, options });

      const loader = getLoader();
      if (loader) {
        // Convert options format (if needed)
        const unifiedOptions = {
          animationType: options?.animationType || 'loading',
          timeout: options?.timeout,
          onTimeout: options?.onTimeout
        };

        loader.show(message, unifiedOptions);
      } else {
        console.warn('[LoadingWrapper] Falling back to original showLoading');
        originalShowLoading.call(this, message, options);
      }
    };

    /**
     * Wrap hideLoading
     */
    window.NotificationSystem.hideLoading = function() {
      debugLog('📥 NotificationSystem.hideLoading called');

      const loader = getLoader();
      if (loader) {
        loader.hide();
      } else {
        console.warn('[LoadingWrapper] Falling back to original hideLoading');
        originalHideLoading.call(this);
      }
    };

    // Store originals for potential rollback
    window.NotificationSystem._originalShowLoading = originalShowLoading;
    window.NotificationSystem._originalHideLoading = originalHideLoading;

    debugLog('✅ NotificationSystem wrapped successfully');
  }

  // ========================================
  // NotificationManager API (Master Admin Panel)
  // ========================================

  if (window.NotificationManager) {
    debugLog('🔧 Wrapping NotificationManager.loading');

    // Save original method
    const originalLoading = window.NotificationManager.loading;

    /**
     * Wrap loading method
     * NotificationManager.loading() returns a notification ID
     */
    window.NotificationManager.loading = function(message, title) {
      debugLog('📤 NotificationManager.loading called', { message, title });

      const loader = getLoader();
      if (loader) {
        // Combine title + message
        const fullMessage = title ? `${title}\n${message}` : message;

        loader.show(fullMessage, {
          animationType: 'loading',
          timeout: 0 // Don't auto-hide
        });

        // Return a fake notification ID (for compatibility)
        return 'unified-loading-notification';
      } else {
        console.warn('[LoadingWrapper] Falling back to original loading');
        return originalLoading.call(this, message, title);
      }
    };

    // Store original for potential rollback
    window.NotificationManager._originalLoading = originalLoading;

    debugLog('✅ NotificationManager wrapped successfully');
  }

  // ========================================
  // Additional Helper Methods
  // ========================================

  /**
   * Update loading message
   * שיטה חדשה - לא הייתה במערכת הישנה
   */
  window.updateLoadingMessage = function(message) {
    debugLog('🔄 updateLoadingMessage called', { message });

    const loader = getLoader();
    if (loader) {
      loader.updateMessage(message);
    }
  };

  /**
   * Check if loading is visible
   * שיטה חדשה - לא הייתה במערכת הישנה
   */
  window.isLoadingVisible = function() {
    const loader = getLoader();
    return loader ? loader.isShown() : false;
  };

  /**
   * Rollback to legacy system (emergency)
   * חזרה למערכת הישנה במקרה חירום
   */
  window.rollbackToLegacyLoading = function() {
    console.warn('🚨 [LoadingWrapper] Rolling back to legacy loading system');

    // Restore original methods
    if (window.NotificationSystem) {
      if (window.NotificationSystem._originalShowLoading) {
        window.NotificationSystem.showLoading = window.NotificationSystem._originalShowLoading;
      }
      if (window.NotificationSystem._originalHideLoading) {
        window.NotificationSystem.hideLoading = window.NotificationSystem._originalHideLoading;
      }
    }

    if (window.NotificationManager) {
      if (window.NotificationManager._originalLoading) {
        window.NotificationManager.loading = window.NotificationManager._originalLoading;
      }
    }

    // Destroy unified loader
    if (unifiedLoader) {
      unifiedLoader.destroy();
      unifiedLoader = null;
    }

    console.log('✅ [LoadingWrapper] Rollback complete - using legacy system');
  };

  // ========================================
  // Initialization Complete
  // ========================================

  debugLog('✅ Loading Compatibility Wrapper activated', {
    globalAPI: typeof window.showLoading === 'function',
    notificationSystem: !!window.NotificationSystem,
    notificationManager: !!window.NotificationManager
  });

  // Show deprecation warnings (if enabled)
  if (window.SHARED_UI_CONFIG?.SHOW_DEPRECATION_WARNINGS) {
    console.info(
      '[LoadingWrapper] 💡 Tip: You can now use the new UnifiedLoadingOverlay API directly:\n' +
      '  const loader = new UnifiedLoadingOverlay();\n' +
      '  loader.show("Loading...", { animationType: "saving" });\n' +
      '  loader.hide();'
    );
  }

})();
