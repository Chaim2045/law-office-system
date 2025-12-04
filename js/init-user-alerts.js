/**
 * Initialize User Alerts Panel
 * אתחול מערכת התראות משתמש
 *
 * נוצר: 2025-12-04
 * גרסה: 1.0.0
 *
 * תפקיד: אתחול אוטומטי של UserAlertsPanel כאשר משתמש מתחבר
 */

(function() {
    'use strict';

    console.log('🔔 User Alerts Init: Script loaded');

    // Wait for Firebase Auth to be ready
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            console.log('🔔 User Alerts: No user logged in, skipping initialization');
            return;
        }

        // Wait for UserAlertsPanel class to be loaded
        if (typeof window.UserAlertsPanel === 'undefined') {
            console.warn('⚠️ UserAlertsPanel class not loaded yet, waiting...');

            // Wait up to 5 seconds for the class to load
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds (50 * 100ms)

            const waitForClass = setInterval(() => {
                attempts++;

                if (typeof window.UserAlertsPanel !== 'undefined') {
                    clearInterval(waitForClass);
                    initializePanel(user);
                } else if (attempts >= maxAttempts) {
                    clearInterval(waitForClass);
                    console.error('❌ UserAlertsPanel class failed to load after 5 seconds');
                }
            }, 100);

            return;
        }

        // Initialize immediately if class is already loaded
        initializePanel(user);
    });

    /**
     * Initialize the UserAlertsPanel
     */
    async function initializePanel(user) {
        try {
            console.log('🔔 User Alerts: Initializing for user:', user.email);

            // Create instance
            const userAlertsPanel = new window.UserAlertsPanel(window.firebaseDB);

            // Store globally for access from onclick handlers
            window.userAlertsPanel = userAlertsPanel;

            // Initialize with user
            await userAlertsPanel.init(user);

            console.log('✅ User Alerts Panel initialized successfully!');

        } catch (error) {
            console.error('❌ Error initializing User Alerts Panel:', error);
        }
    }

    console.log('🔔 User Alerts Init: Monitoring auth state...');

})();
