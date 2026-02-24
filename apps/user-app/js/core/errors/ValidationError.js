/**
 * ValidationError
 * שגיאת ולידציה - עבור קלט לא תקין
 *
 * Created: 2025-12-01
 * Phase: Foundation Layer
 */

class ValidationError extends BaseError {
    /**
     * @param {string} message - הודעת שגיאה
     * @param {string} field - שם השדה שנכשל
     * @param {object} details - פרטים נוספים
     */
    constructor(message, field, details = {}) {
        super(message, 'VALIDATION_ERROR', { field, ...details });
        this.field = field;
    }

    /**
     * Check if error is validation error
     */
    static isValidationError(error) {
        return error instanceof ValidationError || error?.code === 'VALIDATION_ERROR';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationError;
}

if (typeof window !== 'undefined') {
    window.ValidationError = ValidationError;
}
