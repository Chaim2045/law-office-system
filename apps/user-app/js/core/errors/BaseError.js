/**
 * BaseError
 * שגיאת בסיס - כל השגיאות במערכת יורשות מזה
 *
 * Created: 2025-12-01
 * Author: Claude & Haim
 * Phase: Foundation Layer
 */

class BaseError extends Error {
    /**
     * @param {string} message - הודעת שגיאה
     * @param {string} code - קוד שגיאה ייחודי
     * @param {object} details - פרטים נוספים
     */
    constructor(message, code, details = {}) {
        super(message);

        // Set error name to class name
        this.name = this.constructor.name;

        // Custom properties
        this.code = code;
        this.details = details;
        this.timestamp = new Date();

        // Maintains proper stack trace (V8 only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to JSON for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack
        };
    }

    /**
     * Log error to console
     */
    log() {
        console.error(`[${this.name}] ${this.message}`, {
            code: this.code,
            details: this.details,
            timestamp: this.timestamp
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseError;
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.BaseError = BaseError;
}
