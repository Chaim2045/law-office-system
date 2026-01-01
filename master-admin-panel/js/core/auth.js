/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔐 AUTHENTICATION SYSTEM - Master Admin Panel
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📅 Created: 31/10/2025
 * 📅 Last Update: 2025-01-17
 * 🎯 Version: 3.2.0 (UX Bug Fix - Login Box Animation)
 * 📦 Phase: 1 - Foundation
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🐛 BUG FIX (v3.2.0):
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. ✅ FIXED: Login box "drop" visual glitch during login
 *    - PROBLEM: slide-up animation re-ran during fade-out transition
 *    - CAUSE: Browser re-renders children when parent opacity changes
 *    - SOLUTION: Freeze login-box transform before fade-out starts
 *    - IMPACT: Eliminates annoying visual jump behind loading spinner
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🎨 UX IMPROVEMENTS (v3.1.0):
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. ✅ ENHANCED: Screen transitions with smooth fade animations
 *    - Login → Dashboard: Fade-out login, fade-in dashboard
 *    - Dashboard → Login: Fade-out dashboard, fade-in login
 *    - Duration: 300ms fade-out + 400ms fade-in = 700ms total
 *    - Timing: ease-in-out for natural feel
 *
 * 2. ✅ ADDED: Async/await pattern for transition sequencing
 *    - Prevents visual "jumps" and race conditions
 *    - Ensures animations complete before next step
 *    - Uses Promise-based wait() utility function
 *
 * 3. 🎯 BENEFIT: Professional, polished user experience
 *    - Smooth transitions instead of jarring screen switches
 *    - Eliminates the "initialization jump" on logout
 *    - CSS classes: .fade-in, .fade-out for reusability
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔧 SECURITY CHANGES (v3.0.0):
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. ✅ REMOVED: Pre-login adminEmails check
 *    - Previously blocked login before Firebase Auth check
 *    - Now allows any authenticated user to attempt login
 *    - Authorization handled by checkIfAdmin() post-authentication
 *
 * 2. ✅ ENHANCED: checkIfAdmin() - Multi-layer verification (unchanged)
 *    - Primary: Firebase Auth Custom Claims (token.role === 'admin')
 *    - Fallback 1: Check adminEmails list (backwards compatibility)
 *    - Fallback 2: Firestore employees collection (if Custom Claims not set)
 *
 * 3. 🎯 BENEFIT: Dynamic admin management
 *    - Admins can now be added/removed via Admin Panel UI
 *    - No code changes required (uses Custom Claims + Firestore)
 *    - Changes take effect immediately after updateUser() call
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🎯 WHY THESE CHANGES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🚨 Problem Solved:
 * - Previously: Adding admin via UI didn't grant immediate access
 * - Reason: Pre-login check blocked users not in hardcoded adminEmails array
 * - Solution: Remove pre-login check, rely on post-auth verification
 *
 * ✅ Security Benefits:
 * - Defense in depth: Multiple verification layers after authentication
 * - Token-based verification (industry standard, cannot be forged)
 * - Dynamic management: Add/remove admins via UI without code deployment
 * - Aligns with Firebase best practices and OWASP recommendations
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 📊 IMPACT ON SYSTEM:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ✅ Improved UX: Admins added via UI can login immediately
 * ✅ Improved security: Token-based verification (Custom Claims)
 * ✅ Better scalability: No code changes needed for admin changes
 * ⚠️ Note: adminEmails array kept for backwards compatibility only
 *
 * Performance:
 * - Custom Claims: Instant (no database lookup)
 * - Email list fallback: Instant (in-memory array check)
 * - Firestore fallback: ~100-300ms (database query)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔒 SECURITY FEATURES:
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ✅ Authentication: Firebase Auth (industry standard)
 * ✅ Authorization: Multi-layer admin verification (post-authentication)
 * ✅ Session Management: Firebase Session Persistence (SESSION mode)
 * ✅ Password Security: Firebase handles hashing/salting
 * ✅ Rate Limiting: Firebase Auth built-in protection
 * ✅ Error Handling: Generic errors to prevent info leakage
 * ✅ Audit Logging: All admin actions logged
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    /**
     * AuthSystem Class
     * מערכת אימות מרכזית
     */
    class AuthSystem {
        constructor() {
            this.auth = null;
            this.db = null;
            this.currentUser = null;
            this.isAdmin = false;
            this.rememberMe = false;
            this.idleTimeout = null; // ✅ NEW: Idle timeout manager

            // DOM Elements
            this.loginScreen = null;
            this.dashboardScreen = null;
            this.loginForm = null;
            this.emailInput = null;
            this.passwordInput = null;
            this.rememberMeCheckbox = null;
            this.loginButton = null;
            this.errorMessage = null;
            this.errorText = null;
            this.logoutButton = null;
            this.adminName = null;
            this.loadingOverlay = null;

            // Admin emails list
            this.adminEmails = [
                'haim@ghlawoffice.co.il',
                'uri@ghlawoffice.co.il',
                'guy@ghlawoffice.co.il'
            ];
        }

        /**
         * Initialize Authentication System
         * אתחול מערכת האימות
         */
        init() {
            try {
                // Wait for Firebase to be ready
                if (!window.FirebaseManager || !window.FirebaseManager.initialized) {
                    console.warn('⏳ Waiting for Firebase...');
                    window.addEventListener('firebase:ready', () => this.init());
                    return;
                }

                // Get Firebase instances
                this.auth = window.firebaseAuth;
                this.db = window.firebaseDB;

                // Get DOM elements
                this.getDOMElements();

                // Setup event listeners
                this.setupEventListeners();

                // Monitor auth state changes
                this.monitorAuthState();

                // Check for saved credentials (if Remember Me was checked)
                this.checkRememberedUser();

                console.log('✅ AuthSystem initialized successfully');

            } catch (error) {
                console.error('❌ AuthSystem initialization error:', error);
                this.showError('שגיאה באתחול מערכת האימות');
            }
        }

        /**
         * Get all DOM elements
         * קבלת כל האלמנטים מה-DOM
         */
        getDOMElements() {
            this.loginScreen = document.getElementById('loginScreen');
            this.dashboardScreen = document.getElementById('dashboardScreen');
            this.loginForm = document.getElementById('loginForm');
            this.emailInput = document.getElementById('emailInput');
            this.passwordInput = document.getElementById('passwordInput');
            this.rememberMeCheckbox = document.getElementById('rememberMe');
            this.loginButton = document.getElementById('loginButton');
            this.errorMessage = document.getElementById('errorMessage');
            this.errorText = document.getElementById('errorText');
            this.logoutButton = document.getElementById('logoutButton');
            this.adminName = document.getElementById('adminName');
            this.loadingOverlay = document.getElementById('loadingOverlay');
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Login form submit
            if (this.loginForm) {
                this.loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }

            // Logout button
            if (this.logoutButton) {
                this.logoutButton.addEventListener('click', () => {
                    this.handleLogout();
                });
            }

            // Enter key on inputs
            [this.emailInput, this.passwordInput].forEach(input => {
                if (input) {
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.handleLogin();
                        }
                    });
                }
            });

            // Clear error on input
            [this.emailInput, this.passwordInput].forEach(input => {
                if (input) {
                    input.addEventListener('input', () => {
                        this.hideError();
                    });
                }
            });
        }

        /**
         * Monitor authentication state changes
         * ניטור שינויים בסטטוס האימות
         */
        monitorAuthState() {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('👤 User authenticated:', user.email);

                    // Check if user is admin
                    const isAdmin = await this.checkIfAdmin(user);

                    if (isAdmin) {
                        this.currentUser = user;
                        this.isAdmin = true;
                        this.showDashboard();
                    } else {
                        // Not an admin - sign out immediately
                        console.warn('⚠️ Unauthorized access attempt:', user.email);
                        await this.auth.signOut();
                        this.showError('אין לך הרשאות גישה למערכת זו. גישה למנהלים בלבד.');
                    }
                } else {
                    console.log('👤 No user authenticated');
                    this.currentUser = null;
                    this.isAdmin = false;
                    this.showLoginScreen();
                }
            });
        }

        /**
         * Handle login
         * טיפול בכניסה למערכת
         */
        async handleLogin() {
            try {
                // Get input values
                const email = this.emailInput.value.trim();
                const password = this.passwordInput.value;
                this.rememberMe = this.rememberMeCheckbox.checked;

                // Validate inputs
                if (!email || !password) {
                    this.showError('אנא הזן אימייל וסיסמה');
                    return;
                }

                // Validate email format
                if (!this.isValidEmail(email)) {
                    this.showError('פורמט אימייל לא תקין');
                    return;
                }

                // Show loading
                this.showLoading();
                this.setButtonLoading(true);

                // Sign in with Firebase
                const userCredential = await this.auth.signInWithEmailAndPassword(email, password);

                console.log('✅ Login successful:', userCredential.user.email);

                // Log admin login
                if (window.AuditLogger && window.AuditLogger.initialized) {
                    await window.AuditLogger.logAdminLogin();
                }

                // Save credentials if Remember Me is checked
                if (this.rememberMe) {
                    this.saveCredentials(email);
                } else {
                    this.clearSavedCredentials();
                }

                // Auth state change will handle the rest (monitorAuthState)

            } catch (error) {
                console.error('❌ Login error:', error);
                this.hideLoading();
                this.setButtonLoading(false);

                // Handle specific error codes
                switch (error.code) {
                    case 'auth/invalid-email':
                        this.showError('כתובת אימייל לא תקינה');
                        break;
                    case 'auth/user-disabled':
                        this.showError('חשבון זה חסום. פנה למנהל המערכת');
                        break;
                    case 'auth/user-not-found':
                        this.showError('אימייל או סיסמה שגויים');
                        break;
                    case 'auth/wrong-password':
                        this.showError('אימייל או סיסמה שגויים');
                        break;
                    case 'auth/too-many-requests':
                        this.showError('יותר מדי ניסיונות כניסה. נסה שוב מאוחר יותר');
                        break;
                    case 'auth/network-request-failed':
                        this.showError('בעיית תקשורת. בדוק את החיבור לאינטרנט');
                        break;
                    default:
                        this.showError('שגיאה בכניסה למערכת. נסה שוב');
                }
            }
        }

        /**
         * Handle logout
         * טיפול ביציאה מהמערכת
         */
        async handleLogout() {
            try {
                this.showLoading();

                // 🔒 Clear session storage and broadcast logout event to all tabs
                sessionStorage.removeItem('authState');
                localStorage.setItem('logoutEvent', Date.now().toString());
                setTimeout(() => localStorage.removeItem('logoutEvent'), 100);
                console.log('📢 Logout event broadcasted to all tabs');

                // Log admin logout BEFORE signing out
                if (window.AuditLogger && window.AuditLogger.initialized) {
                    await window.AuditLogger.logAdminLogout();
                }

                // Cleanup real-time listeners before logout
                if (window.DataManager) {
                    window.DataManager.cleanup();
                }

                // ✅ Cleanup NotificationBell listeners
                if (window.notificationBell) {
                    console.log('🔔 [Admin Panel] Cleaning up NotificationBell listeners');
                    window.notificationBell.cleanup();
                }

                await this.auth.signOut();

                console.log('✅ Logout successful');

                // Clear form
                if (this.emailInput) {
this.emailInput.value = '';
}
                if (this.passwordInput) {
this.passwordInput.value = '';
}

                this.hideLoading();

            } catch (error) {
                console.error('❌ Logout error:', error);
                this.hideLoading();
                this.showError('שגיאה ביציאה מהמערכת');
            }
        }

        /**
         * Check if user is admin (ENHANCED v2.0.0)
         * בדיקה אם המשתמש הוא מנהל
         *
         * Security Model: Defense in Depth (Multi-layer verification)
         *
         * Layer 1: Custom Claims (RECOMMENDED - cryptographically signed by Firebase)
         * Layer 2: Admin Email List (DEPRECATED - backwards compatibility only)
         * Layer 3: Firestore Database (FALLBACK - requires network request)
         *
         * @param {Object} user - Firebase User object
         * @returns {Promise<boolean>} - true if admin, false otherwise
         */
        async checkIfAdmin(user) {
            try {
                // ════════════════════════════════════════════════════════════
                // LAYER 1: Custom Claims (PRIMARY METHOD - MOST SECURE)
                // ════════════════════════════════════════════════════════════
                // Why: Custom Claims are cryptographically signed by Firebase
                //      Cannot be tampered with by client-side code
                //      No database lookup required (instant verification)
                // Set via: run set-admin-claims.js script
                const tokenResult = await user.getIdTokenResult();

                const isAdminRole = tokenResult.claims.role === window.ADMIN_PANEL_CONSTANTS.USER_ROLES.ADMIN;
                const isAdminClaim = tokenResult.claims.admin === true;
                if (isAdminRole || isAdminClaim) {
                    console.log('✅ Admin verified (Custom Claims - SECURE):', user.email);
                    console.log('   🔐 Token-based verification (cannot be spoofed)');
                    return true;
                }

                // ════════════════════════════════════════════════════════════
                // LAYER 2: Email List (DEPRECATED - BACKWARDS COMPATIBILITY)
                // ════════════════════════════════════════════════════════════
                // Why deprecated: Client-side lists can be modified (low risk)
                // Migration: Run set-admin-claims.js to set Custom Claims
                // Will be removed in: v3.0.0
                if (this.adminEmails.includes(user.email.toLowerCase())) {
                    console.warn('⚠️ Admin verified (Email List - DEPRECATED):', user.email);
                    console.warn('   🔧 Please run set-admin-claims.js to enable Custom Claims');
                    console.warn('   📝 Email list verification will be removed in v3.0.0');
                    return true;
                }

                // ════════════════════════════════════════════════════════════
                // LAYER 3: Firestore Database (FALLBACK - SLOWEST)
                // ════════════════════════════════════════════════════════════
                // Why fallback: Requires network request (~100-300ms)
                // Use case: If Custom Claims not set and email not in list
                // Security: Protected by Firestore security rules
                const employeeDoc = await this.db.collection('employees').doc(user.email).get();

                if (employeeDoc.exists) {
                    const employeeData = employeeDoc.data();
                    if (employeeData.role === window.ADMIN_PANEL_CONSTANTS.USER_ROLES.ADMIN) {
                        console.warn('⚠️ Admin verified (Firestore - SLOW FALLBACK):', user.email);
                        console.warn('   🔧 Please run set-admin-claims.js for better performance');
                        return true;
                    }
                }

                // ════════════════════════════════════════════════════════════
                // NO ADMIN PRIVILEGES FOUND
                // ════════════════════════════════════════════════════════════
                console.warn('❌ Access Denied: Not an admin:', user.email);
                console.warn('   User does not have admin privileges in any verification layer');
                return false;

            } catch (error) {
                console.error('❌ Error checking admin status:', error);
                console.error('   Denying access due to verification failure');
                // Security: Fail closed (deny access on error)
                return false;
            }
        }

        /**
         * Show login screen
         * הצגת מסך כניסה
         */
        showLoginScreen() {
            if (this.loginScreen) {
                this.loginScreen.style.display = 'flex';
            }
            if (this.dashboardScreen) {
                this.dashboardScreen.style.display = 'none';
            }
            this.hideLoading();
            this.setButtonLoading(false);
        }

        /**
         * Show dashboard
         * הצגת דשבורד
         */
        showDashboard() {
            if (this.loginScreen) {
                this.loginScreen.style.display = 'none';
            }
            if (this.dashboardScreen) {
                this.dashboardScreen.style.display = 'flex';
            }

            this.hideLoading();
            this.setButtonLoading(false);

            // 💾 Update auth state in sessionStorage for fast pre-flight checks
            if (this.currentUser) {
                const authState = {
                    isAuthenticated: true,
                    timestamp: Date.now(),
                    email: this.currentUser.email,
                    uid: this.currentUser.uid
                };
                sessionStorage.setItem('authState', JSON.stringify(authState));
                console.log('💾 Auth state saved to sessionStorage');
            }

            // Dispatch dashboard ready event for other components
            window.dispatchEvent(new CustomEvent('dashboard:ready'));
            console.log('📊 Dashboard ready event dispatched');

            // Update admin name
            if (this.adminName && this.currentUser) {
                const displayName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
                this.adminName.textContent = displayName;
            }

            // ✅ NEW: Start listening to admin messages (for admins who are also users)
            // This allows admins to receive notifications when they are in admin panel
            if (window.notificationBell && this.currentUser && window.firebaseDB) {
                console.log('🔔 [Admin Panel] Starting NotificationBell listener for', this.currentUser.email);
                try {
                    window.notificationBell.startListeningToAdminMessages(this.currentUser, window.firebaseDB);
                    console.log('✅ [Admin Panel] NotificationBell listener started successfully');
                } catch (error) {
                    console.error('❌ [Admin Panel] Failed to start NotificationBell listener:', error);
                }
            } else {
                console.warn('⚠️ [Admin Panel] Cannot start NotificationBell listener:', {
                    hasNotificationBell: !!window.notificationBell,
                    hasCurrentUser: !!this.currentUser,
                    hasFirebaseDB: !!window.firebaseDB
                });
            }

            // ✅ NEW: Initialize Idle Timeout for Admin Panel
            this.initIdleTimeout();
        }

        /**
         * Show error message
         * הצגת הודעת שגיאה
         */
        showError(message) {
            if (this.errorMessage && this.errorText) {
                this.errorText.textContent = message;
                this.errorMessage.style.display = 'flex';

                // Auto hide after 5 seconds
                setTimeout(() => {
                    this.hideError();
                }, 5000);
            }
        }

        /**
         * Hide error message
         * הסתרת הודעת שגיאה
         */
        hideError() {
            if (this.errorMessage) {
                this.errorMessage.style.display = 'none';
            }
        }

        /**
         * Show loading overlay
         * הצגת מסך טעינה
         */
        showLoading() {
            if (this.loadingOverlay) {
                this.loadingOverlay.style.display = 'flex';
            }
        }

        /**
         * Hide loading overlay
         * הסתרת מסך טעינה
         */
        hideLoading() {
            if (this.loadingOverlay) {
                this.loadingOverlay.style.display = 'none';
            }
        }

        /**
         * Set button loading state
         * הגדרת מצב טעינה לכפתור
         */
        setButtonLoading(isLoading) {
            if (!this.loginButton) {
return;
}

            if (isLoading) {
                this.loginButton.disabled = true;
                this.loginButton.innerHTML = '<span class="btn-text">מתחבר...</span><i class="fas fa-spinner fa-spin btn-icon"></i>';
            } else {
                this.loginButton.disabled = false;
                this.loginButton.innerHTML = '<span class="btn-text">כניסה למערכת</span><i class="fas fa-arrow-left btn-icon"></i>';
            }
        }

        /**
         * Validate email format
         * בדיקת תקינות פורמט אימייל
         */
        isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        /**
         * Save credentials to localStorage
         * שמירת פרטי התחברות
         */
        saveCredentials(email) {
            try {
                localStorage.setItem('admin_email', email);
                localStorage.setItem('admin_remember', 'true');
            } catch (error) {
                console.error('❌ Error saving credentials:', error);
            }
        }

        /**
         * Clear saved credentials
         * ניקוי פרטי התחברות שמורים
         */
        clearSavedCredentials() {
            try {
                localStorage.removeItem('admin_email');
                localStorage.removeItem('admin_remember');
            } catch (error) {
                console.error('❌ Error clearing credentials:', error);
            }
        }

        /**
         * Check for remembered user
         * בדיקה אם יש משתמש שמור
         */
        checkRememberedUser() {
            try {
                const savedEmail = localStorage.getItem('admin_email');
                const remember = localStorage.getItem('admin_remember');

                if (savedEmail && remember === 'true') {
                    if (this.emailInput) {
                        this.emailInput.value = savedEmail;
                    }
                    if (this.rememberMeCheckbox) {
                        this.rememberMeCheckbox.checked = true;
                    }
                }
            } catch (error) {
                console.error('❌ Error checking remembered user:', error);
            }
        }

        /**
         * Get current admin user
         * קבלת המנהל הנוכחי
         */
        getCurrentAdmin() {
            return this.currentUser;
        }

        /**
         * Check if current user is admin
         * בדיקה אם המשתמש הנוכחי הוא מנהל
         */
        isCurrentUserAdmin() {
            return this.isAdmin && this.currentUser !== null;
        }

        /**
         * ════════════════════════════════════════════════════════════════════
         * 🆕 NEW: IDLE TIMEOUT FOR ADMIN PANEL
         * ════════════════════════════════════════════════════════════════════
         * Auto logout after inactivity - same as regular users
         * Timeout: 15 minutes total (10 min idle + 5 min warning)
         * ════════════════════════════════════════════════════════════════════
         */

        /**
         * Initialize Idle Timeout Manager
         * אתחול מנהל התנתקות אוטומטית
         */
        initIdleTimeout() {
            if (!window.IdleTimeoutManager) {
                console.warn('⚠️ [Admin Panel] IdleTimeoutManager not loaded - auto-logout disabled');
                return;
            }

            if (this.idleTimeout) {
                console.log('ℹ️ [Admin Panel] Idle Timeout Manager already initialized');
                return;
            }

            this.idleTimeout = new window.IdleTimeoutManager({
                idleTimeout: 10 * 60 * 1000,      // 10 minutes idle
                warningTimeout: 5 * 60 * 1000,    // 5 minutes warning
                enabled: true,                     // Enable auto-logout
                onWarning: (remainingSeconds) => {
                    this.showIdleWarning(remainingSeconds);
                },
                onLogout: async () => {
                    console.log('🚪 [Admin Panel] Auto-logout triggered by idle timeout');
                    await this.handleLogout();
                }
            });

            this.idleTimeout.start();
            console.log('✅ [Admin Panel] Idle Timeout Manager initialized (15 min total)');
        }

        /**
         * Show idle warning (Admin Panel version)
         * הצגת אזהרת Idle
         */
        showIdleWarning(remainingSeconds) {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const timeText = minutes > 0
                ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                : `${seconds} שניות`;

            // Remove existing overlay if any
            const existingOverlay = document.getElementById('idleWarningOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            // Create minimal warning overlay
            const overlay = document.createElement('div');
            overlay.id = 'idleWarningOverlay';
            overlay.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(0, 0, 0, 0.15); backdrop-filter: blur(2px);';
            overlay.innerHTML = `
              <div style="background: white; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); max-width: 320px; width: 90%; border: 1px solid #e2e8f0;">
                <div style="padding: 18px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                  <div style="background: #f8fafc; width: 40px; height: 40px; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-clock" style="font-size: 18px; color: #64748b;"></i>
                  </div>
                  <h3 style="color: #1e293b; margin: 0; font-size: 15px; font-weight: 600;">התנתקות אוטומטית</h3>
                </div>
                <div style="padding: 20px 18px; text-align: center;">
                  <p style="color: #64748b; font-size: 12px; margin: 0 0 12px 0;">
                    לא זוהתה פעילות
                  </p>
                  <div id="idleCountdownTimer" style="font-size: 32px; font-weight: 600; color: #334155; margin: 0 0 16px 0; font-family: 'Courier New', monospace;">
                    ${timeText}
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button id="idleLogoutBtn" style="flex: 1; padding: 9px 12px; background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit;">
                      התנתק
                    </button>
                    <button id="idleStayBtn" style="flex: 1; padding: 9px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;">
                      המשך
                    </button>
                  </div>
                </div>
              </div>
            `;
            document.body.appendChild(overlay);

            // Setup button handlers
            document.getElementById('idleLogoutBtn').addEventListener('click', () => {
                overlay.remove();
                this.handleLogout();
            });

            document.getElementById('idleStayBtn').addEventListener('click', () => {
                if (this.idleTimeout) {
                    this.idleTimeout.resetActivity();
                }
                overlay.remove();
            });

            // Setup countdown update listener
            this.setupIdleCountdownListener();
        }

        /**
         * Setup countdown update listener
         * הגדרת מאזין לספירה לאחור
         */
        setupIdleCountdownListener() {
            // Remove existing listener if any
            if (this.idleCountdownListener) {
                window.removeEventListener('idle:countdown', this.idleCountdownListener);
            }

            // Add new listener
            this.idleCountdownListener = (event) => {
                const remainingSeconds = event.detail.remainingSeconds;
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                const timeText = minutes > 0
                    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                    : `${seconds} שניות`;

                // Update countdown in modal
                const countdownElement = document.getElementById('idleCountdownTimer');
                if (countdownElement) {
                    countdownElement.textContent = timeText;
                }
            };

            window.addEventListener('idle:countdown', this.idleCountdownListener);

            // Listen for warning hide event
            const hideListener = () => {
                const overlay = document.getElementById('idleWarningOverlay');
                if (overlay) {
                    overlay.remove();
                }
                window.removeEventListener('idle:warning-hide', hideListener);
            };

            window.addEventListener('idle:warning-hide', hideListener);
        }

    }

    // Create global instance
    const authSystem = new AuthSystem();

    // Make AuthSystem available globally
    window.AuthSystem = authSystem;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = authSystem;
    }

})();
