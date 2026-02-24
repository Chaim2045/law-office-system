/**
 * NetworkError
 * שגיאת רשת - כשיש בעיה בחיבור לשרת
 *
 * Created: 2025-12-01
 * Phase: Foundation Layer
 */

class NetworkError extends BaseError {
    /**
     * @param {string} message - הודעת שגיאה
     * @param {Error} originalError - השגיאה המקורית
     * @param {object} details - פרטים נוספים
     */
    constructor(message, originalError = null, details = {}) {
        const errorDetails = {
            originalError: originalError?.message,
            originalCode: originalError?.code,
            ...details
        };

        super(message, 'NETWORK_ERROR', errorDetails);
        this.originalError = originalError;
        this.retryable = true; // Can retry this error
    }

    /**
     * Check if error is network error
     */
    static isNetworkError(error) {
        return error instanceof NetworkError ||
               error?.code === 'NETWORK_ERROR' ||
               error?.code === 'unavailable' ||
               error?.code === 'deadline-exceeded';
    }

    /**
     * Check if error is retryable
     */
    isRetryable() {
        return this.retryable;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkError;
}

if (typeof window !== 'undefined') {
    window.NetworkError = NetworkError;
}
