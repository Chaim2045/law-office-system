/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔐 AUTH GUARD - Unified Authentication Guard for MPA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📅 Created: 2025-01-03
 * 🎯 Version: 1.0.0
 * 📦 Purpose: Prevent false login redirects in multi-page admin panel
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🎯 PROBLEM SOLVED:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Before: Pre-flight checks did IMMEDIATE redirects based on sessionStorage
 * Issue: sessionStorage can be stale/out-of-sync across tabs → false redirects
 * Result: Users kicked to login when switching tabs (ping-pong effect)
 *
 * Solution: Only Firebase Auth decides redirects, pre-flight only shows overlay
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔧 HOW IT WORKS:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. Pre-flight Check (Optimistic):
 *    - Reads sessionStorage.authState
 *    - If fresh (< 5 min) → Show optimistic "loading" overlay
 *    - If stale/missing → Show "authenticating" overlay
 *    - NO REDIRECT at this stage!
 *
 * 2. Firebase Auth Check (Definitive):
 *    - onAuthStateChanged() is the ONLY source of truth
 *    - If user exists → Update sessionStorage, hide overlay, call onAuthenticated()
 *    - If no user → Clear sessionStorage, call onUnauthenticated() (which redirects)
 *
 * 3. Timeout Protection:
 *    - If Firebase doesn't respond within timeoutMs (default 5s)
 *    - Call onUnauthenticated() to prevent infinite loading
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 📊 BENEFITS:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ✅ No false redirects when switching tabs
 * ✅ Consistent behavior across all pages (clients, workload, etc.)
 * ✅ Better UX: Optimistic overlay if user was recently authenticated
 * ✅ Fail-safe: Timeout prevents stuck loading screens
 * ✅ Security: Only Firebase Auth (cryptographic tokens) decides auth status
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    /**
     * Initialize Authentication Guard
     *
     * @param {Object} config - Configuration object
     * @param {string} config.pageName - Page name for logging (e.g., 'clients', 'workload')
     * @param {Function} config.onAuthenticated - Called when user is authenticated (receives user object)
     * @param {Function} config.onUnauthenticated - Called when user is NOT authenticated (should redirect)
     * @param {number} [config.timeoutMs=5000] - Timeout in milliseconds (default: 5 seconds)
     * @param {string} [config.overlayMode='auto'] - Overlay mode: 'auto', 'always', 'never'
     */
    function initAuthGuard(config) {
        const {
            pageName,
            onAuthenticated,
            onUnauthenticated,
            timeoutMs = 5000,
            overlayMode = 'auto'
        } = config;

        // Validate required params
        if (!pageName || !onAuthenticated || !onUnauthenticated) {
            console.error('❌ [Auth Guard] Missing required config:', { pageName, onAuthenticated, onUnauthenticated });
            throw new Error('Auth Guard: pageName, onAuthenticated, and onUnauthenticated are required');
        }

        // Check Firebase availability
        if (!window.firebaseAuth) {
            console.error('❌ [Auth Guard] Firebase Auth not available');
            throw new Error('Auth Guard: Firebase Auth not initialized');
        }

        console.log(`🔐 [Auth Guard: ${pageName}] Initializing...`);

        // ════════════════════════════════════════════════════════════════════
        // STEP 1: Pre-flight Optimistic Check (NO REDIRECT)
        // ════════════════════════════════════════════════════════════════════

        let showOptimisticLoading = false;

        try {
            const authState = sessionStorage.getItem('authState');

            if (authState) {
                const state = JSON.parse(authState);
                const now = Date.now();
                const age = now - (state.timestamp || 0);
                const isRecent = state.isAuthenticated && age < 5 * 60 * 1000; // 5 minutes

                if (isRecent) {
                    showOptimisticLoading = true;
                    console.log(`✅ [Auth Guard: ${pageName}] Pre-flight: Recent auth found (${Math.round(age / 1000)}s old)`);
                } else {
                    console.log(`⚠️ [Auth Guard: ${pageName}] Pre-flight: Stale auth (${Math.round(age / 1000)}s old)`);
                }
            } else {
                console.log(`⚠️ [Auth Guard: ${pageName}] Pre-flight: No auth state found`);
            }
        } catch (error) {
            console.warn(`⚠️ [Auth Guard: ${pageName}] Pre-flight error:`, error);
        }

        // Show overlay based on mode and optimistic check
        if (overlayMode === 'always' || (overlayMode === 'auto' && !showOptimisticLoading)) {
            showLoadingOverlay(showOptimisticLoading);
        }

        // ════════════════════════════════════════════════════════════════════
        // STEP 2: Firebase Auth Check (DEFINITIVE - ONLY SOURCE OF TRUTH)
        // ════════════════════════════════════════════════════════════════════

        let authResolved = false;
        let timeoutHandle = null;

        // Timeout protection
        timeoutHandle = setTimeout(() => {
            if (!authResolved) {
                console.warn(`⏱️ [Auth Guard: ${pageName}] Timeout: Firebase Auth did not respond in ${timeoutMs}ms`);
                authResolved = true;
                hideLoadingOverlay();

                // Clear stale session storage
                sessionStorage.removeItem('authState');

                // Call unauthenticated handler (which should redirect)
                onUnauthenticated();
            }
        }, timeoutMs);

        // Listen to Firebase Auth state
        const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
            // Clear timeout
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }

            // Mark as resolved
            if (authResolved) {
                return; // Already handled by timeout
            }
            authResolved = true;

            if (user) {
                // ✅ User is authenticated
                console.log(`✅ [Auth Guard: ${pageName}] User authenticated:`, user.email);

                // Update sessionStorage with fresh timestamp
                const authState = {
                    isAuthenticated: true,
                    timestamp: Date.now(),
                    email: user.email,
                    uid: user.uid
                };
                sessionStorage.setItem('authState', JSON.stringify(authState));
                console.log(`💾 [Auth Guard: ${pageName}] Session state updated`);

                // Hide overlay
                hideLoadingOverlay();

                // Call authenticated handler
                onAuthenticated(user);

            } else {
                // ❌ User is NOT authenticated
                console.log(`🔒 [Auth Guard: ${pageName}] No user authenticated`);

                // Clear sessionStorage
                sessionStorage.removeItem('authState');

                // Hide overlay
                hideLoadingOverlay();

                // Call unauthenticated handler (which should redirect)
                onUnauthenticated();
            }
        });

        // Store unsubscribe for cleanup (if needed)
        window._authGuardUnsubscribe = unsubscribe;
    }

    /**
     * Show loading overlay
     * @param {boolean} optimistic - If true, show optimistic "loading" text
     */
    function showLoadingOverlay(optimistic = false) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            const loadingText = overlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = optimistic ? 'טוען...' : 'מאמת זהות...';
            }
            overlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    function hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // EXPORT
    // ════════════════════════════════════════════════════════════════════

    window.initAuthGuard = initAuthGuard;

    console.log('✅ Auth Guard utility loaded');

})();
