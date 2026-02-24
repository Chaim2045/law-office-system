/**
 * ContextMessage Model
 * מודל של הודעה הקשרית (מבוססת הקשר)
 *
 * Created: 2025-12-01
 * Phase: Data Models
 *
 * זו הודעה מהירה שהמנהל שולח בהקשר של בעיה ספציפית
 * לדוגמה: "לא דיווחת שעות" או "משימה באיחור"
 */

class ContextMessage {
    /**
     * Create a new ContextMessage
     * @param {Object} data - Message data
     */
    constructor(data = {}) {
        // Required fields
        this.id = data.id || null;
        this.from = data.from || null; // { uid, name, role }
        this.to = data.to || null; // { uid, name, role }
        this.messageType = data.messageType || MESSAGE_TYPES.REMINDER;
        this.title = data.title || '';
        this.body = data.body || '';

        // Context (why was this sent?)
        this.context = data.context || null; // { type, relatedData }

        // Optional fields
        this.canReply = data.canReply !== undefined ? data.canReply : true;
        this.threadCreated = data.threadCreated || false;
        this.threadId = data.threadId || null;
        this.isRead = data.isRead || false;
        this.readAt = data.readAt || null;
        this.repliedAt = data.repliedAt || null;
        this.priority = data.priority || THREAD_PRIORITY.NORMAL;

        // Timestamps
        this.createdAt = data.createdAt || new Date();

        // Validate on creation
        if (!data.skipValidation) {
            this.validate();
        }
    }

    /**
     * Validate context message data
     */
    validate() {
        // From
        if (!this.from || !this.from.uid) {
            throw new ValidationError('שולח ההודעה הוא שדה חובה', 'from');
        }

        // To
        if (!this.to || !this.to.uid) {
            throw new ValidationError('נמען ההודעה הוא שדה חובה', 'to');
        }

        // Message Type
        const validTypes = Object.values(MESSAGE_TYPES);
        if (!validTypes.includes(this.messageType)) {
            throw new ValidationError(
                `סוג הודעה לא תקין. חייב להיות אחד מ: ${validTypes.join(', ')}`,
                'messageType'
            );
        }

        // Title
        if (!this.title || this.title.trim().length === 0) {
            throw new ValidationError('כותרת ההודעה היא שדה חובה', 'title');
        }

        // Body
        if (!this.body || this.body.trim().length === 0) {
            throw new ValidationError('תוכן ההודעה הוא שדה חובה', 'body');
        }

        if (this.body.length > 2000) {
            throw new ValidationError('ההודעה ארוכה מדי (מקסימום 2000 תווים)', 'body');
        }
    }

    /**
     * Mark as read
     */
    markAsRead() {
        if (!this.isRead) {
            this.isRead = true;
            this.readAt = new Date();
        }
    }

    /**
     * Mark as replied
     */
    markAsReplied() {
        if (!this.repliedAt) {
            this.repliedAt = new Date();
        }
    }

    /**
     * Create thread from this message
     */
    createThread(threadId) {
        this.threadCreated = true;
        this.threadId = threadId;
    }

    /**
     * Check if message type is urgent
     */
    isUrgent() {
        return this.messageType === MESSAGE_TYPES.URGENT;
    }

    /**
     * Check if message type is warning
     */
    isWarning() {
        return this.messageType === MESSAGE_TYPES.WARNING;
    }

    /**
     * Get message type color
     */
    getTypeColor() {
        const colors = {
            [MESSAGE_TYPES.REMINDER]: '#3b82f6',   // Blue
            [MESSAGE_TYPES.INFO]: '#10b981',       // Green
            [MESSAGE_TYPES.WARNING]: '#f59e0b',    // Orange
            [MESSAGE_TYPES.URGENT]: '#ef4444'      // Red
        };
        return colors[this.messageType] || '#6b7280';
    }

    /**
     * Get message type icon
     */
    getTypeIcon() {
        const icons = {
            [MESSAGE_TYPES.REMINDER]: 'fas fa-bell',
            [MESSAGE_TYPES.INFO]: 'fas fa-info-circle',
            [MESSAGE_TYPES.WARNING]: 'fas fa-exclamation-triangle',
            [MESSAGE_TYPES.URGENT]: 'fas fa-exclamation-circle'
        };
        return icons[this.messageType] || 'fas fa-envelope';
    }

    /**
     * Convert to Firestore format
     */
    toFirestore() {
        return {
            from: this.from,
            to: this.to,
            messageType: this.messageType,
            title: this.title,
            body: this.body,
            context: this.context,
            canReply: this.canReply,
            threadCreated: this.threadCreated,
            threadId: this.threadId,
            isRead: this.isRead,
            readAt: this.readAt ? firebase.firestore.Timestamp.fromDate(this.readAt) : null,
            repliedAt: this.repliedAt ? firebase.firestore.Timestamp.fromDate(this.repliedAt) : null,
            priority: this.priority,
            createdAt: firebase.firestore.Timestamp.fromDate(this.createdAt)
        };
    }

    /**
     * Create ContextMessage from Firestore document
     */
    static fromFirestore(id, data) {
        return new ContextMessage({
            id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            readAt: data.readAt?.toDate(),
            repliedAt: data.repliedAt?.toDate(),
            skipValidation: false
        });
    }

    /**
     * Create from alert
     */
    static fromAlert(alert, from, to, messageBody) {
        return new ContextMessage({
            from,
            to,
            messageType: alert.isCritical() ? MESSAGE_TYPES.URGENT : MESSAGE_TYPES.REMINDER,
            title: alert.title,
            body: messageBody,
            context: {
                type: alert.type,
                relatedData: alert.contextData
            },
            priority: alert.isCritical() ? THREAD_PRIORITY.URGENT : THREAD_PRIORITY.NORMAL
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContextMessage;
}

if (typeof window !== 'undefined') {
    window.ContextMessage = ContextMessage;
}
