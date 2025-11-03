/**
 * Authentication System
 * מערכת אימות ובקרת הרשאות
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 1 - Foundation
 *
 * תפקיד: ניהול כניסה, יציאה, ובדיקת הרשאות Admin
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
                'uri@ghlawoffice.co.il'
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

                // Check if email is in admin list (pre-check before Firebase call)
                if (!this.adminEmails.includes(email.toLowerCase())) {
                    this.showError('אין לך הרשאות גישה למערכת זו. גישה למנהלים בלבד.');
                    return;
                }

                // Show loading
                this.showLoading();
                this.setButtonLoading(true);

                // Sign in with Firebase
                const userCredential = await this.auth.signInWithEmailAndPassword(email, password);

                console.log('✅ Login successful:', userCredential.user.email);

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

                // Cleanup real-time listeners before logout
                if (window.DataManager) {
                    window.DataManager.cleanup();
                }

                await this.auth.signOut();

                console.log('✅ Logout successful');

                // Clear form
                if (this.emailInput) this.emailInput.value = '';
                if (this.passwordInput) this.passwordInput.value = '';

                this.hideLoading();

            } catch (error) {
                console.error('❌ Logout error:', error);
                this.hideLoading();
                this.showError('שגיאה ביציאה מהמערכת');
            }
        }

        /**
         * Check if user is admin
         * בדיקה אם המשתמש הוא מנהל
         */
        async checkIfAdmin(user) {
            try {
                // Method 1: Check email in admin list
                if (this.adminEmails.includes(user.email.toLowerCase())) {
                    console.log('✅ Admin verified (email list):', user.email);
                    return true;
                }

                // Method 2: Check custom claims (if set)
                const tokenResult = await user.getIdTokenResult();
                if (tokenResult.claims.role === 'admin' || tokenResult.claims.admin === true) {
                    console.log('✅ Admin verified (custom claims):', user.email);
                    return true;
                }

                // Method 3: Check Firestore employees collection
                const employeeDoc = await this.db.collection('employees').doc(user.email).get();
                if (employeeDoc.exists) {
                    const employeeData = employeeDoc.data();
                    if (employeeData.role === 'admin') {
                        console.log('✅ Admin verified (Firestore):', user.email);
                        return true;
                    }
                }

                console.warn('⚠️ Not an admin:', user.email);
                return false;

            } catch (error) {
                console.error('❌ Error checking admin status:', error);
                return false;
            }
        }

        /**
         * Show login screen
         * הצגת מסך כניסה
         */
        showLoginScreen() {
            if (this.loginScreen) this.loginScreen.style.display = 'flex';
            if (this.dashboardScreen) this.dashboardScreen.style.display = 'none';
            this.hideLoading();
            this.setButtonLoading(false);
        }

        /**
         * Show dashboard
         * הצגת דשבורד
         */
        showDashboard() {
            if (this.loginScreen) this.loginScreen.style.display = 'none';
            if (this.dashboardScreen) this.dashboardScreen.style.display = 'flex';
            this.hideLoading();
            this.setButtonLoading(false);

            // Update admin name
            if (this.adminName && this.currentUser) {
                const displayName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
                this.adminName.textContent = displayName;
            }
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
            if (!this.loginButton) return;

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
