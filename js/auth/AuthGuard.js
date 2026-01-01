/**
 * AuthGuard Component
 *
 * Handles authentication verification and role-based access control.
 * Used by both employee dashboard (index.html) and admin panel.
 *
 * Features:
 * - Promise-based auth state waiting (no race conditions)
 * - Role verification for admin access
 * - Automatic redirect to login if unauthorized
 * - Logging for debugging
 *
 * Usage:
 *   const authGuard = new AuthGuard(auth, 'login-v2.html');
 *   const user = await authGuard.verify();
 *
 *   // For admin-only pages:
 *   const verified = await authGuard.verifyRole(db, ['admin', 'master-admin']);
 */

class AuthGuard {
    /**
     * @param {Object} auth - Firebase Auth instance
     * @param {string} redirectUrl - URL to redirect to if not authenticated (default: 'login-v2.html')
     */
    constructor(auth, redirectUrl = 'login-v2.html') {
        this.auth = auth;
        this.redirectUrl = redirectUrl;
    }

    /**
     * Wait for Firebase Auth to initialize
     * Returns Promise that resolves with user or null
     *
     * This prevents race conditions where onAuthStateChanged
     * hasn't fired yet when the page loads.
     *
     * @returns {Promise<Object|null>} Firebase user object or null
     */
    async waitForAuth() {
        return new Promise((resolve) => {
            // If auth state is already determined, resolve immediately
            if (this.auth.currentUser !== undefined) {
                resolve(this.auth.currentUser);
                return;
            }

            // Wait for first onAuthStateChanged event
            const unsubscribe = this.auth.onAuthStateChanged((user) => {
                unsubscribe(); // Stop listening after first event
                resolve(user);
            });
        });
    }

    /**
     * Verify user is authenticated
     * Redirects to login if not authenticated
     *
     * @returns {Promise<Object|null>} Firebase user object or null (if redirected)
     */
    async verify() {
        const user = await this.waitForAuth();

        if (!user) {
            console.warn('❌ AuthGuard: No user authenticated - redirecting to login');
            window.location.href = this.redirectUrl;
            return null;
        }

        console.warn('✅ AuthGuard: User authenticated:', user.email);
        return user;
    }

    /**
     * Verify user has specific role(s)
     * Used for admin-only pages
     *
     * @param {Object} db - Firestore instance
     * @param {Array<string>} allowedRoles - Array of allowed role names (default: ['admin', 'master-admin'])
     * @returns {Promise<boolean>} true if verified, false if not (will redirect)
     */
    async verifyRole(db, allowedRoles = ['admin', 'master-admin']) {
        // First verify authentication
        const user = await this.verify();
        if (!user) {
return false;
}

        try {
            // Get user document from Firestore
            const userDoc = await db.collection('employees').doc(user.email).get();

            // Check if user document exists
            if (!userDoc.exists) {
                console.error('❌ AuthGuard: User document not found in Firestore');
                await this.auth.signOut();
                window.location.href = this.redirectUrl;
                return false;
            }

            const userData = userDoc.data();
            const role = userData.role;

            // Check if user has required role
            if (!allowedRoles.includes(role)) {
                console.error('❌ AuthGuard: Insufficient permissions - required roles:', allowedRoles, 'user role:', role);
                await this.auth.signOut();
                window.location.href = this.redirectUrl;
                return false;
            }

            console.warn('✅ AuthGuard: Role verified -', role);
            return true;

        } catch (error) {
            console.error('❌ AuthGuard: Error verifying role:', error);
            await this.auth.signOut();
            window.location.href = this.redirectUrl;
            return false;
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}
