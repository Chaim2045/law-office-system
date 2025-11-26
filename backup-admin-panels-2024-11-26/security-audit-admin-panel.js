/**
 * 🔐 Security Audit - Admin Panel
 *
 * בדיקת אבטחה מקיפה לפי תקני OWASP Top 10
 * הרץ בקונסול של ה-Admin Panel
 */

(async function() {
    console.clear();
    console.log('%c🔐 Security Audit - Admin Panel', 'font-size: 24px; font-weight: bold; color: #dc3545;');
    console.log('═'.repeat(70));
    console.log('%cבודק אבטחה לפי OWASP Top 10 & Industry Standards', 'color: #666;');
    console.log('═'.repeat(70));

    const results = {
        passed: [],
        failed: [],
        warnings: [],
        info: []
    };

    function pass(test, details) {
        results.passed.push({ test, details });
        console.log(`%c✅ PASS: ${test}`, 'color: #28a745;');
        if (details) {
console.log(`   ${details}`);
}
    }

    function fail(test, details, recommendation) {
        results.failed.push({ test, details, recommendation });
        console.log(`%c❌ FAIL: ${test}`, 'color: #dc3545; font-weight: bold;');
        if (details) {
console.log(`   Issue: ${details}`);
}
        if (recommendation) {
console.log(`   🔧 Fix: ${recommendation}`);
}
    }

    function warn(test, details, recommendation) {
        results.warnings.push({ test, details, recommendation });
        console.log(`%c⚠️  WARN: ${test}`, 'color: #ffc107;');
        if (details) {
console.log(`   ${details}`);
}
        if (recommendation) {
console.log(`   💡 Recommendation: ${recommendation}`);
}
    }

    function info(test, details) {
        results.info.push({ test, details });
        console.log(`%cℹ️  INFO: ${test}`, 'color: #17a2b8;');
        if (details) {
console.log(`   ${details}`);
}
    }

    // ═══════════════════════════════════════════════════════════════
    // 1️⃣ AUTHENTICATION & SESSION MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c1️⃣ Authentication & Session Management', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check if using Firebase Auth
    if (window.firebaseAuth) {
        pass('Firebase Authentication', 'Using Firebase Auth (industry standard)');
    } else {
        fail('Firebase Authentication', 'Firebase Auth not initialized');
    }

    // Check authentication state
    const user = window.firebaseAuth?.currentUser;
    if (user) {
        pass('User Authentication', `Authenticated as ${user.email}`);

        // Check session persistence
        const persistence = localStorage.getItem('firebase:authUser');
        if (persistence) {
            warn('Session Persistence', 'Using localStorage (survives browser restart)',
                 'Consider SESSION persistence for admin panels');
        }
    } else {
        info('User Authentication', 'Not currently authenticated (expected if not logged in)');
    }

    // Check for admin verification
    if (window.AuthSystem?.isCurrentUserAdmin) {
        const isAdmin = window.AuthSystem.isCurrentUserAdmin();
        if (isAdmin) {
            pass('Admin Authorization', 'Admin verification working');
        } else {
            fail('Admin Authorization', 'Current user is not admin');
        }
    } else {
        fail('Admin Authorization', 'AuthSystem not found or isCurrentUserAdmin method missing');
    }

    // ═══════════════════════════════════════════════════════════════
    // 2️⃣ BROKEN ACCESS CONTROL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c2️⃣ Access Control', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check Firestore rules (we can't check directly, but we can test)
    try {
        const testDoc = await window.firebaseDB.collection('employees').limit(1).get();
        if (testDoc.size > 0) {
            warn('Firestore Access', 'Can read employees collection',
                 'Verify Firestore rules restrict to admin-only');
        }
    } catch (e) {
        if (e.code === 'permission-denied') {
            fail('Firestore Access', 'Permission denied - check if you are logged in');
        }
    }

    // Check for client-side auth bypass
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');

    if (loginScreen && dashboardScreen) {
        const loginVisible = loginScreen.style.display !== 'none';
        const dashboardVisible = dashboardScreen.style.display !== 'none';

        if (!user && dashboardVisible) {
            fail('UI Access Control', 'Dashboard visible without authentication!',
                 'Dashboard should be hidden when not authenticated');
        } else if (user && loginVisible && !dashboardVisible) {
            warn('UI Access Control', 'User authenticated but showing login screen');
        } else {
            pass('UI Access Control', 'Correct screen displayed for auth state');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3️⃣ INJECTION ATTACKS (XSS, SQL, etc.)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c3️⃣ Injection Protection', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check CSP
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
        const cspContent = cspMeta.getAttribute('content');
        pass('Content Security Policy (CSP)', 'CSP meta tag present');

        // Check for unsafe practices
        if (cspContent.includes("'unsafe-inline'")) {
            warn('CSP - unsafe-inline', 'Using unsafe-inline for scripts/styles',
                 'Consider using nonces or hashes instead');
        }
        if (cspContent.includes("'unsafe-eval'")) {
            warn('CSP - unsafe-eval', 'Using unsafe-eval',
                 'Avoid eval() if possible');
        }

        // Check if cloudfunctions is allowed
        if (cspContent.includes('cloudfunctions.net')) {
            pass('CSP - Cloud Functions', 'Cloud Functions domain allowed in CSP');
        }
    } else {
        warn('Content Security Policy', 'No CSP meta tag in HTML',
             'CSP may be set by server headers (Netlify)');
    }

    // Check for XSS vulnerabilities (basic test)
    const inputs = document.querySelectorAll('input, textarea');
    if (inputs.length > 0) {
        info('Input Fields', `Found ${inputs.length} input fields`);
        // Note: We can't automatically detect XSS, but we can warn
        warn('XSS Protection', 'Manual review needed',
             'Ensure all user input is sanitized before display');
    }

    // ═══════════════════════════════════════════════════════════════
    // 4️⃣ CRYPTOGRAPHY & SECURE COMMUNICATION
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c4️⃣ Cryptography & Secure Communication', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check HTTPS
    if (window.location.protocol === 'https:') {
        pass('HTTPS', 'Using HTTPS (secure connection)');
    } else if (window.location.protocol === 'file:') {
        info('HTTPS', 'Running locally (file://) - HTTPS not applicable');
    } else {
        fail('HTTPS', 'Not using HTTPS!',
             'ALWAYS use HTTPS in production');
    }

    // Check HSTS header (can't check directly in JS, but can inform)
    info('HSTS', 'Check Netlify config for Strict-Transport-Security header');

    // Check password handling
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    if (passwordInputs.length > 0) {
        pass('Password Fields', `Found ${passwordInputs.length} password fields with type="password"`);

        // Check autocomplete
        passwordInputs.forEach((input, i) => {
            const autocomplete = input.getAttribute('autocomplete');
            if (autocomplete === 'current-password' || autocomplete === 'new-password') {
                pass(`Password Field ${i + 1}`, 'Has proper autocomplete attribute');
            } else {
                warn(`Password Field ${i + 1}`, 'Missing autocomplete attribute',
                     'Use autocomplete="current-password" or "new-password"');
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // 5️⃣ SECURITY HEADERS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c5️⃣ Security Headers', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // These are typically set by server, so we inform user to check
    info('X-Frame-Options', 'Check Netlify config for "DENY" or "SAMEORIGIN"');
    info('X-Content-Type-Options', 'Check Netlify config for "nosniff"');
    info('Referrer-Policy', 'Check Netlify config for "strict-origin-when-cross-origin"');
    info('Permissions-Policy', 'Check Netlify config for restrictive policy');

    // Check meta tags
    const robotsMeta = document.querySelector('meta[name="robots"]');
    if (robotsMeta && robotsMeta.content.includes('noindex')) {
        pass('Robots Meta Tag', 'Admin panel is noindex (not indexed by search engines)');
    } else {
        fail('Robots Meta Tag', 'Missing or incorrect robots meta tag',
             'Add <meta name="robots" content="noindex, nofollow">');
    }

    // ═══════════════════════════════════════════════════════════════
    // 6️⃣ RATE LIMITING & BRUTE FORCE PROTECTION
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c6️⃣ Rate Limiting & Brute Force Protection', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Firebase Auth has built-in rate limiting
    pass('Firebase Auth Rate Limiting', 'Firebase Auth has built-in protection against brute force');

    warn('Custom Rate Limiting', 'No visible custom rate limiting on admin actions',
         'Consider adding rate limiting for sensitive operations');

    // ═══════════════════════════════════════════════════════════════
    // 7️⃣ LOGGING & MONITORING
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c7️⃣ Logging & Monitoring', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check AuditLogger
    if (window.AuditLogger) {
        pass('Audit Logging', 'AuditLogger component exists');

        if (window.AuditLogger.initialized) {
            pass('AuditLogger Initialized', 'Audit logging is active');
        } else {
            warn('AuditLogger Initialized', 'AuditLogger exists but may not be initialized');
        }
    } else {
        fail('Audit Logging', 'AuditLogger not found',
             'Implement audit logging for all admin actions');
    }

    // ═══════════════════════════════════════════════════════════════
    // 8️⃣ DATA EXPOSURE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c8️⃣ Data Exposure', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check for sensitive data in console
    warn('Console Logging', 'Check for sensitive data in console logs',
         'Remove detailed logging in production');

    // Check localStorage for sensitive data
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    let foundSensitive = false;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            fail(`localStorage - ${key}`, 'Potentially sensitive data in localStorage',
                 'Do not store sensitive data in localStorage');
            foundSensitive = true;
        }
    }
    if (!foundSensitive) {
        pass('localStorage Security', 'No obvious sensitive data in localStorage');
    }

    // ═══════════════════════════════════════════════════════════════
    // 9️⃣ ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c9️⃣ Error Handling', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check error message element
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        pass('Error Message UI', 'Error message element exists');
    } else {
        warn('Error Message UI', 'Error message element not found');
    }

    warn('Error Details', 'Verify that error messages do not expose sensitive system details',
         'Use generic error messages for users, log details server-side');

    // ═══════════════════════════════════════════════════════════════
    // 🔟 DEPENDENCY SECURITY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c🔟 Dependency Security', 'font-size: 18px; font-weight: bold; color: #007bff;');
    console.log('─'.repeat(70));

    // Check Firebase version
    if (typeof firebase !== 'undefined') {
        const version = firebase.SDK_VERSION;
        pass('Firebase SDK Version', `v${version}`);
        info('Firebase Updates', 'Check for latest Firebase version periodically');
    }

    // Check for CDN integrity
    const scripts = document.querySelectorAll('script[src*="https://"]');
    let hasIntegrity = false;
    scripts.forEach(script => {
        if (script.hasAttribute('integrity')) {
            hasIntegrity = true;
        }
    });

    if (!hasIntegrity) {
        warn('Subresource Integrity (SRI)', 'External scripts lack integrity attribute',
             'Add integrity hashes to CDN scripts for security');
    }

    // ═══════════════════════════════════════════════════════════════
    // 📊 SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n%c═══════════════════════════════════════════════════════════════', 'color: #999;');
    console.log('%c📊 Security Audit Summary', 'font-size: 20px; font-weight: bold; color: #dc3545;');
    console.log('%c═══════════════════════════════════════════════════════════════', 'color: #999;');

    console.log(`\n%c✅ Passed: ${results.passed.length}`, 'color: #28a745; font-size: 16px; font-weight: bold;');
    console.log(`%c⚠️  Warnings: ${results.warnings.length}`, 'color: #ffc107; font-size: 16px; font-weight: bold;');
    console.log(`%c❌ Failed: ${results.failed.length}`, 'color: #dc3545; font-size: 16px; font-weight: bold;');
    console.log(`%cℹ️  Info: ${results.info.length}`, 'color: #17a2b8; font-size: 16px;');

    // Overall Security Score
    const totalChecks = results.passed.length + results.warnings.length + results.failed.length;
    const score = Math.round((results.passed.length / totalChecks) * 100);

    console.log(`\n%c🎯 Security Score: ${score}%`, `font-size: 20px; font-weight: bold; color: ${score >= 80 ? '#28a745' : score >= 60 ? '#ffc107' : '#dc3545'};`);

    if (score >= 80) {
        console.log('%c✨ Good security posture! Address warnings to improve further.', 'color: #28a745;');
    } else if (score >= 60) {
        console.log('%c⚠️  Moderate security. Address critical issues and warnings.', 'color: #ffc107;');
    } else {
        console.log('%c🚨 Security needs improvement! Address all failed checks immediately.', 'color: #dc3545; font-weight: bold;');
    }

    // Critical Issues
    if (results.failed.length > 0) {
        console.log('\n%c🚨 Critical Issues to Fix:', 'font-size: 16px; font-weight: bold; color: #dc3545;');
        results.failed.forEach((item, i) => {
            console.log(`\n${i + 1}. ${item.test}`);
            console.log(`   Issue: ${item.details}`);
            if (item.recommendation) {
                console.log(`   🔧 Fix: ${item.recommendation}`);
            }
        });
    }

    // Top Recommendations
    if (results.warnings.length > 0) {
        console.log('\n%c💡 Top Recommendations:', 'font-size: 16px; font-weight: bold; color: #ffc107;');
        results.warnings.slice(0, 5).forEach((item, i) => {
            console.log(`\n${i + 1}. ${item.test}`);
            if (item.recommendation) {
                console.log(`   ${item.recommendation}`);
            }
        });
    }

    console.log('\n%c═══════════════════════════════════════════════════════════════', 'color: #999;');
    console.log('%c✅ Security Audit Complete!', 'font-size: 18px; font-weight: bold; color: #28a745;');
    console.log('%c📝 Review the findings above and implement recommendations.', 'color: #666;');

    return results;
})();
