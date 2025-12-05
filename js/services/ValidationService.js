/**
 * ValidationService
 * שירות ולידציה מרכזי
 *
 * Created: 2025-12-01
 * Phase: Services Layer
 *
 * כל הולידציות במערכת עוברות כאן
 */

class ValidationService {
    /**
     * Validate required field
     */
    static validateRequired(value, fieldName) {
        if (value === null || value === undefined || value === '') {
            throw new ValidationError(
                `${fieldName} הוא שדה חובה`,
                fieldName
            );
        }
        return true;
    }

    /**
     * Validate string length
     */
    static validateLength(value, fieldName, min, max) {
        this.validateRequired(value, fieldName);

        if (typeof value !== 'string') {
            throw new ValidationError(
                `${fieldName} חייב להיות טקסט`,
                fieldName,
                { expectedType: 'string', actualType: typeof value }
            );
        }

        const trimmed = value.trim();

        if (min !== undefined && trimmed.length < min) {
            throw new ValidationError(
                `${fieldName} חייב להיות לפחות ${min} תווים`,
                fieldName,
                { min, actual: trimmed.length }
            );
        }

        if (max !== undefined && trimmed.length > max) {
            throw new ValidationError(
                `${fieldName} לא יכול להיות יותר מ-${max} תווים`,
                fieldName,
                { max, actual: trimmed.length }
            );
        }

        return true;
    }

    /**
     * Validate enum value
     */
    static validateEnum(value, fieldName, allowedValues) {
        this.validateRequired(value, fieldName);

        if (!Array.isArray(allowedValues)) {
            throw new Error('allowedValues must be an array');
        }

        if (!allowedValues.includes(value)) {
            throw new ValidationError(
                `${fieldName} חייב להיות אחד מהערכים: ${allowedValues.join(', ')}`,
                fieldName,
                { allowedValues, actualValue: value }
            );
        }

        return true;
    }

    /**
     * Validate UID (Firebase Auth UID)
     */
    static validateUID(uid, fieldName = 'UID') {
        this.validateRequired(uid, fieldName);

        if (typeof uid !== 'string') {
            throw new ValidationError(
                `${fieldName} חייב להיות מחרוזת`,
                fieldName
            );
        }

        if (uid.length < 10 || uid.length > 128) {
            throw new ValidationError(
                `${fieldName} לא תקין (אורך לא חוקי)`,
                fieldName,
                { actualLength: uid.length }
            );
        }

        return true;
    }

    /**
     * Validate email
     */
    static validateEmail(email, fieldName = 'Email') {
        this.validateRequired(email, fieldName);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new ValidationError(
                `${fieldName} לא תקין`,
                fieldName,
                { actualValue: email }
            );
        }

        return true;
    }

    /**
     * Validate object structure
     */
    static validateObject(obj, fieldName, requiredFields = []) {
        this.validateRequired(obj, fieldName);

        if (typeof obj !== 'object' || Array.isArray(obj)) {
            throw new ValidationError(
                `${fieldName} חייב להיות אובייקט`,
                fieldName
            );
        }

        for (const field of requiredFields) {
            if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
                throw new ValidationError(
                    `${fieldName}.${field} הוא שדה חובה`,
                    `${fieldName}.${field}`
                );
            }
        }

        return true;
    }

    /**
     * Validate array
     */
    static validateArray(arr, fieldName, minLength = 0, maxLength = null) {
        if (!Array.isArray(arr)) {
            throw new ValidationError(
                `${fieldName} חייב להיות מערך`,
                fieldName
            );
        }

        if (arr.length < minLength) {
            throw new ValidationError(
                `${fieldName} חייב להכיל לפחות ${minLength} פריטים`,
                fieldName,
                { minLength, actualLength: arr.length }
            );
        }

        if (maxLength !== null && arr.length > maxLength) {
            throw new ValidationError(
                `${fieldName} לא יכול להכיל יותר מ-${maxLength} פריטים`,
                fieldName,
                { maxLength, actualLength: arr.length }
            );
        }

        return true;
    }

    /**
     * Sanitize HTML - prevent XSS attacks
     */
    static sanitizeHTML(html) {
        if (!html) {
return '';
}

        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    /**
     * Escape HTML entities
     */
    static escapeHTML(text) {
        if (!text) {
return '';
}

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Validate URL
     */
    static validateURL(url, fieldName = 'URL') {
        this.validateRequired(url, fieldName);

        try {
            new URL(url);
            return true;
        } catch (e) {
            throw new ValidationError(
                `${fieldName} לא תקין`,
                fieldName,
                { actualValue: url }
            );
        }
    }

    /**
     * Validate date
     */
    static validateDate(date, fieldName = 'Date') {
        if (!(date instanceof Date) || isNaN(date)) {
            throw new ValidationError(
                `${fieldName} חייב להיות תאריך תקין`,
                fieldName
            );
        }

        return true;
    }

    /**
     * Validate date range
     */
    static validateDateRange(startDate, endDate, fieldName = 'Date Range') {
        this.validateDate(startDate, `${fieldName} - תאריך התחלה`);
        this.validateDate(endDate, `${fieldName} - תאריך סיום`);

        if (startDate > endDate) {
            throw new ValidationError(
                'תאריך ההתחלה חייב להיות לפני תאריך הסיום',
                fieldName
            );
        }

        return true;
    }

    /**
     * Validate phone number (Israeli)
     */
    static validatePhoneNumber(phone, fieldName = 'Phone') {
        this.validateRequired(phone, fieldName);

        // Israeli phone number pattern
        const phoneRegex = /^0\d{1,2}-?\d{7}$/;
        if (!phoneRegex.test(phone)) {
            throw new ValidationError(
                `${fieldName} לא תקין (פורמט: 0XX-XXXXXXX)`,
                fieldName,
                { actualValue: phone }
            );
        }

        return true;
    }

    /**
     * Validate number range
     */
    static validateNumberRange(value, fieldName, min, max) {
        this.validateRequired(value, fieldName);

        if (typeof value !== 'number' || isNaN(value)) {
            throw new ValidationError(
                `${fieldName} חייב להיות מספר`,
                fieldName
            );
        }

        if (min !== undefined && value < min) {
            throw new ValidationError(
                `${fieldName} חייב להיות לפחות ${min}`,
                fieldName,
                { min, actualValue: value }
            );
        }

        if (max !== undefined && value > max) {
            throw new ValidationError(
                `${fieldName} לא יכול להיות יותר מ-${max}`,
                fieldName,
                { max, actualValue: value }
            );
        }

        return true;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationService;
}

if (typeof window !== 'undefined') {
    window.ValidationService = ValidationService;
}
