/**
 * Alert Model
 * מודל של התראה למנהל
 *
 * Created: 2025-12-01
 * Phase: Data Models
 *
 * זו התראה שמופיעה למנהל על בעיה שצריכה טיפול
 */

class Alert {
    /**
     * Create a new Alert
     * @param {Object} data - Alert data
     */
    constructor(data = {}) {
        // Required fields
        this.id = data.id || null;
        this.type = data.type || null; // ALERT_TYPES
        this.severity = data.severity || ALERT_SEVERITY.INFO;
        this.userId = data.userId || null; // The user this alert is about
        this.title = data.title || '';
        this.description = data.description || '';

        // Optional fields
        this.icon = data.icon || 'fas fa-exclamation-circle';
        this.actionable = data.actionable !== undefined ? data.actionable : true;
        this.actions = data.actions || []; // Array of { type, label, data }
        this.contextData = data.contextData || {}; // Related data
        this.status = data.status || 'active'; // active, dismissed, handled
        this.handledBy = data.handledBy || null;
        this.handledAt = data.handledAt || null;

        // Timestamps
        this.createdAt = data.createdAt || new Date();

        // Validate on creation
        if (!data.skipValidation) {
            this.validate();
        }
    }

    /**
     * Validate alert data
     */
    validate() {
        // Type
        const validTypes = Object.values(ALERT_TYPES);
        if (!validTypes.includes(this.type)) {
            throw new ValidationError(
                `סוג התראה לא תקין. חייב להיות אחד מ: ${validTypes.join(', ')}`,
                'type'
            );
        }

        // Severity
        const validSeverities = Object.values(ALERT_SEVERITY);
        if (!validSeverities.includes(this.severity)) {
            throw new ValidationError(
                `חומרת התראה לא תקינה. חייבת להיות אחת מ: ${validSeverities.join(', ')}`,
                'severity'
            );
        }

        // User ID
        if (!this.userId) {
            throw new ValidationError('User ID הוא שדה חובה', 'userId');
        }

        // Title
        if (!this.title || this.title.trim().length === 0) {
            throw new ValidationError('כותרת ההתראה היא שדה חובה', 'title');
        }
    }

    /**
     * Mark alert as dismissed
     */
    dismiss(handlerUid) {
        this.status = 'dismissed';
        this.handledBy = handlerUid;
        this.handledAt = new Date();
    }

    /**
     * Mark alert as handled
     */
    handle(handlerUid) {
        this.status = 'handled';
        this.handledBy = handlerUid;
        this.handledAt = new Date();
    }

    /**
     * Check if alert is active
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Check if alert is critical
     */
    isCritical() {
        return this.severity === ALERT_SEVERITY.CRITICAL;
    }

    /**
     * Check if alert is warning
     */
    isWarning() {
        return this.severity === ALERT_SEVERITY.WARNING;
    }

    /**
     * Get severity color
     */
    getSeverityColor() {
        const colors = {
            [ALERT_SEVERITY.INFO]: '#3b82f6',     // Blue
            [ALERT_SEVERITY.WARNING]: '#f59e0b',  // Orange
            [ALERT_SEVERITY.CRITICAL]: '#ef4444'  // Red
        };
        return colors[this.severity] || '#6b7280';
    }

    /**
     * Get severity label (Hebrew)
     */
    getSeverityLabel() {
        const labels = {
            [ALERT_SEVERITY.INFO]: 'מידע',
            [ALERT_SEVERITY.WARNING]: 'אזהרה',
            [ALERT_SEVERITY.CRITICAL]: 'קריטי'
        };
        return labels[this.severity] || '';
    }

    /**
     * Convert to Firestore format
     */
    toFirestore() {
        return {
            type: this.type,
            severity: this.severity,
            userId: this.userId,
            title: this.title,
            description: this.description,
            icon: this.icon,
            actionable: this.actionable,
            actions: this.actions,
            contextData: this.contextData,
            status: this.status,
            handledBy: this.handledBy,
            handledAt: this.handledAt ? firebase.firestore.Timestamp.fromDate(this.handledAt) : null,
            createdAt: firebase.firestore.Timestamp.fromDate(this.createdAt)
        };
    }

    /**
     * Create Alert from Firestore document
     */
    static fromFirestore(id, data) {
        return new Alert({
            id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            handledAt: data.handledAt?.toDate(),
            skipValidation: false
        });
    }

    /**
     * Create alert from rule result
     */
    static fromRuleResult(ruleResult) {
        return new Alert(ruleResult);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Alert;
}

if (typeof window !== 'undefined') {
    window.Alert = Alert;
}
