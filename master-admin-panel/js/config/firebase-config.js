/**
 * Firebase Configuration for Monitoring Dashboard
 * קונפיגורציה של Firebase לדשבורד ניטור
 */

// Import existing Firebase configuration from core
(function() {
    'use strict';

    // Wait for Firebase to be initialized from core/firebase.js
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDB && window.firebaseFunctions) {
            clearInterval(checkFirebase);
            console.log('✅ Firebase configuration loaded for monitoring dashboard');

            // Dispatch event to signal Firebase is ready
            window.dispatchEvent(new CustomEvent('firebase:ready'));
        }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!window.firebaseAuth) {
            console.error('❌ Firebase failed to initialize after 10 seconds');
        }
    }, 10000);
})();