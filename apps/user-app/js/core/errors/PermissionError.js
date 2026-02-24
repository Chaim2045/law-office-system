/**
 * PermissionError
 * שגיאת הרשאה - כשמשתמש לא מורשה לפעולה
 *
 * Created: 2025-12-01
 * Phase: Foundation Layer
 */

class PermissionError extends BaseError {
    /**
     * @param {string} message - הודעת שגיאה
     * @param {string} requiredPermission - ההרשאה הנדרשת
     * @param {object} details - פרטים נוספים
     */
    constructor(message, requiredPermission, details = {}) {
        super(message, 'PERMISSION_ERROR', { requiredPermission, ...details });
        this.requiredPermission = requiredPermission;
    }

    /**
     * Check if error is permission error
     */
    static isPermissionError(error) {
        return error instanceof PermissionError || error?.code === 'PERMISSION_ERROR';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PermissionError;
}

if (typeof window !== 'undefined') {
    window.PermissionError = PermissionError;
}
