/**
 * RateLimiter Component
 *
 * Prevents brute force attacks by limiting login attempts.
 * Uses localStorage to track failed attempts per email.
 *
 * Security Features:
 * - Maximum attempts limit (default: 5)
 * - Lockout period (default: 15 minutes)
 * - Automatic reset after lockout expires
 * - Per-email tracking
 *
 * Usage:
 *   const rateLimiter = new RateLimiter({ maxAttempts: 5, lockoutTime: 15 * 60 * 1000 });
 *
 *   // Before login:
 *   const check = rateLimiter.check(email);
 *   if (check.locked) {
 *       alert(`נסה שוב בעוד ${check.remainingTime} דקות`);
 *       return;
 *   }
 *
 *   // On failed login:
 *   rateLimiter.recordFailure(email);
 *
 *   // On successful login:
 *   rateLimiter.reset(email);
 */

class RateLimiter {
    /**
     * @param {Object} options - Configuration options
     * @param {number} options.maxAttempts - Maximum failed attempts before lockout (default: 5)
     * @param {number} options.lockoutTime - Lockout duration in milliseconds (default: 15 minutes)
     * @param {string} options.storagePrefix - Prefix for localStorage keys (default: 'login_attempts')
     */
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts || 5;
        this.lockoutTime = options.lockoutTime || 15 * 60 * 1000; // 15 minutes in ms
        this.storagePrefix = options.storagePrefix || 'login_attempts';
    }

    /**
     * Get storage key for specific email
     * @param {string} email - User email
     * @returns {string} localStorage key
     */
    getStorageKey(email) {
        return `${this.storagePrefix}_${email}`;
    }

    /**
     * Get attempt data for email
     * @param {string} email - User email
     * @returns {Object} { count: number, timestamp: number }
     */
    getAttempts(email) {
        const key = this.getStorageKey(email);
        const data = localStorage.getItem(key);

        if (!data) {
            return { count: 0, timestamp: 0 };
        }

        try {
            return JSON.parse(data);
        } catch (error) {
            console.error('RateLimiter: Error parsing stored data:', error);
            return { count: 0, timestamp: 0 };
        }
    }

    /**
     * Check if email is locked out
     * @param {string} email - User email
     * @returns {Object} { locked: boolean, remainingTime?: number }
     */
    check(email) {
        const attempts = this.getAttempts(email);
        const now = Date.now();

        // Reset if lockout time has passed
        if (attempts.timestamp > 0 && (now - attempts.timestamp > this.lockoutTime)) {
            this.reset(email);
            return { locked: false };
        }

        // Check if user is locked out
        if (attempts.count >= this.maxAttempts) {
            const remainingTime = Math.ceil(
                (this.lockoutTime - (now - attempts.timestamp)) / 60000
            );
            return {
                locked: true,
                remainingTime: remainingTime > 0 ? remainingTime : 0
            };
        }

        return { locked: false };
    }

    /**
     * Record failed login attempt
     * @param {string} email - User email
     */
    recordFailure(email) {
        const attempts = this.getAttempts(email);
        attempts.count++;
        attempts.timestamp = Date.now();

        const key = this.getStorageKey(email);
        localStorage.setItem(key, JSON.stringify(attempts));

        console.warn(`RateLimiter: Recorded failure for ${email} - ${attempts.count}/${this.maxAttempts} attempts`);
    }

    /**
     * Reset attempts (call on successful login)
     * @param {string} email - User email
     */
    reset(email) {
        const key = this.getStorageKey(email);
        localStorage.removeItem(key);

        console.warn(`RateLimiter: Reset attempts for ${email}`);
    }

    /**
     * Get remaining attempts before lockout
     * @param {string} email - User email
     * @returns {number} Number of attempts remaining
     */
    getRemainingAttempts(email) {
        const attempts = this.getAttempts(email);
        const remaining = this.maxAttempts - attempts.count;
        return remaining > 0 ? remaining : 0;
    }

    /**
     * Check if email has any failed attempts
     * @param {string} email - User email
     * @returns {boolean}
     */
    hasFailedAttempts(email) {
        const attempts = this.getAttempts(email);
        return attempts.count > 0;
    }

    /**
     * Clear all rate limit data (admin function)
     * Use with caution - clears ALL stored rate limits
     */
    clearAll() {
        const keys = Object.keys(localStorage);
        let cleared = 0;

        keys.forEach(key => {
            if (key.startsWith(this.storagePrefix)) {
                localStorage.removeItem(key);
                cleared++;
            }
        });

        console.warn(`RateLimiter: Cleared ${cleared} rate limit entries`);
        return cleared;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateLimiter;
}
