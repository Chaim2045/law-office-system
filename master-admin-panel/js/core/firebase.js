/**
 * Firebase Connection Module
 * מודול חיבור Firebase
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 1 - Foundation
 *
 * תפקיד: ניהול חיבור Firebase והפצת ה-instances למערכת
 */

(function() {
    'use strict';

    // Firebase Configuration (Correct - from main system)
    const firebaseConfig = {
        apiKey: 'AIzaSyAlVbkAEBklF6lnxI_LsSg8ZXGlp0pgeMw',
        authDomain: 'law-office-system-e4801.firebaseapp.com',
        databaseURL: 'https://law-office-system-e4801-default-rtdb.firebaseio.com',
        projectId: 'law-office-system-e4801',
        storageBucket: 'law-office-system-e4801.firebasestorage.app',
        messagingSenderId: '199682320505',
        appId: '1:199682320505:web:8e4f5e34653476479b4ca8'
    };

    /**
     * FirebaseManager Class
     * מנהל את חיבור Firebase והגישה לשירותים
     */
    class FirebaseManager {
        constructor() {
            this.app = null;
            this.auth = null;
            this.db = null;
            this.functions = null;
            this.storage = null;
            this.initialized = false;
        }

        /**
         * Initialize Firebase
         * אתחול Firebase
         */
        init() {
            try {
                // Check if Firebase SDK is loaded
                if (typeof firebase === 'undefined') {
                    throw new Error('Firebase SDK לא נטען. ודא שהספריות נטענו לפני הסקריפט.');
                }

                // Initialize Firebase App with SEPARATE NAME for Master Admin
                // זה מונע שיתוף של auth state עם הממשק הרגיל
                const appName = 'master-admin-panel';

                // Check if already initialized
                const existingApp = firebase.apps.find(app => app.name === appName);
                if (existingApp) {
                    this.app = existingApp;
                } else {
                    this.app = firebase.initializeApp(firebaseConfig, appName);
                }

                // Initialize Services
                this.auth = this.app.auth();
                this.db = this.app.firestore();
                this.functions = this.app.functions();
                this.storage = this.app.storage();

                // CRITICAL: Set persistence to SESSION only for Master Admin
                // זה מבטיח שה-session לא ישתף עם טאבים אחרים
                this.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
                    .then(() => {
                        console.log('✅ Master Admin: Using SESSION persistence (isolated from main app)');
                    })
                    .catch((error) => {
                        console.warn('⚠️ Failed to set persistence:', error);
                    });

                // Firestore Settings for Optimal Performance
                this.db.settings({
                    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
                    merge: true,
                    ignoreUndefinedProperties: true
                });

                // Set log level to error only (production mode)
                firebase.firestore.setLogLevel('error');

                this.initialized = true;

                console.log('✅ Firebase initialized successfully (MASTER ADMIN ISOLATED INSTANCE)');
                console.log('📦 Project:', firebaseConfig.projectId);
                console.log('🔒 App Name:', appName);
                console.log('🔐 Persistence: SESSION (isolated from other tabs)');

                // Make instances globally available
                window.firebaseApp = this.app;
                window.firebaseAuth = this.auth;
                window.firebaseDB = this.db;
                window.firebaseFunctions = this.functions;
                window.firebaseStorage = this.storage;

                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('firebase:ready'));

                return true;

            } catch (error) {
                console.error('❌ Firebase Initialization Error:', error);
                this.showError('שגיאה בחיבור למערכת. אנא רענן את הדף.');
                return false;
            }
        }

        /**
         * Get Firebase Auth Instance
         * קבלת instance של Authentication
         */
        getAuth() {
            if (!this.initialized) {
                throw new Error('Firebase לא אותחל. קרא ל-init() תחילה.');
            }
            return this.auth;
        }

        /**
         * Get Firestore Instance
         * קבלת instance של Firestore
         */
        getFirestore() {
            if (!this.initialized) {
                throw new Error('Firebase לא אותחל. קרא ל-init() תחילה.');
            }
            return this.db;
        }

        /**
         * Get Functions Instance
         * קבלת instance של Cloud Functions
         */
        getFunctions() {
            if (!this.initialized) {
                throw new Error('Firebase לא אותחל. קרא ל-init() תחילה.');
            }
            return this.functions;
        }

        /**
         * Get Storage Instance
         * קבלת instance של Cloud Storage
         */
        getStorage() {
            if (!this.initialized) {
                throw new Error('Firebase לא אותחל. קרא ל-init() תחילה.');
            }
            return this.storage;
        }

        /**
         * Check if user is authenticated
         * בדיקה אם המשתמש מחובר
         */
        isAuthenticated() {
            return this.auth && this.auth.currentUser !== null;
        }

        /**
         * Get current user
         * קבלת המשתמש הנוכחי
         */
        getCurrentUser() {
            if (!this.isAuthenticated()) {
                return null;
            }
            return this.auth.currentUser;
        }

        /**
         * Get current user email
         * קבלת אימייל המשתמש הנוכחי
         */
        getCurrentUserEmail() {
            const user = this.getCurrentUser();
            return user ? user.email : null;
        }

        /**
         * Show error message
         * הצגת הודעת שגיאה
         */
        showError(message) {
            // Using notification system (replaced alert in Sprint 1)
            window.notify.error(message, 'שגיאה');
        }

        /**
         * Sign out
         * יציאה מהמערכת
         */
        async signOut() {
            try {
                await this.auth.signOut();
                console.log('✅ User signed out successfully');
                return true;
            } catch (error) {
                console.error('❌ Sign out error:', error);
                return false;
            }
        }
    }

    // Create global instance
    const firebaseManager = new FirebaseManager();

    // Initialize Firebase
    firebaseManager.init();

    // Make FirebaseManager available globally
    window.FirebaseManager = firebaseManager;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = firebaseManager;
    }

})();
