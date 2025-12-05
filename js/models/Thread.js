/**
 * Thread Model
 * מודל של דיון מקצועי
 *
 * Created: 2025-12-01
 * Phase: Data Models
 *
 * זהו דיון מקצועי בסגנון Slack - ממוקד בנושא ספציפי
 */

class Thread {
    /**
     * Create a new Thread
     * @param {Object} data - Thread data
     */
    constructor(data = {}) {
        // Required fields
        this.id = data.id || null;
        this.title = data.title || '';
        this.category = data.category || THREAD_CATEGORIES.GENERAL;
        this.createdBy = data.createdBy || null;
        this.participants = data.participants || [];

        // Optional fields
        this.status = data.status || THREAD_STATUS.OPEN;
        this.priority = data.priority || THREAD_PRIORITY.NORMAL;
        this.relatedTo = data.relatedTo || null; // { type, id, name }
        this.lastMessageAt = data.lastMessageAt || null;
        this.lastMessagePreview = data.lastMessagePreview || '';
        this.unreadCount = data.unreadCount || {};
        this.tags = data.tags || [];

        // Timestamps
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();

        // Validate on creation
        if (!data.skipValidation) {
            this.validate();
        }
    }

    /**
     * Validate thread data
     */
    validate() {
        // Title
        if (!this.title || this.title.trim().length === 0) {
            throw new ValidationError('כותרת הדיון היא שדה חובה', 'title');
        }
        if (this.title.length > 200) {
            throw new ValidationError('כותרת הדיון ארוכה מדי (מקסימום 200 תווים)', 'title');
        }

        // Category
        const validCategories = Object.values(THREAD_CATEGORIES);
        if (!validCategories.includes(this.category)) {
            throw new ValidationError(
                `קטגוריה לא תקינה. חייב להיות אחד מ: ${validCategories.join(', ')}`,
                'category'
            );
        }

        // Creator
        if (!this.createdBy || !this.createdBy.uid) {
            throw new ValidationError('יוצר הדיון הוא שדה חובה', 'createdBy');
        }

        // Status
        const validStatuses = Object.values(THREAD_STATUS);
        if (!validStatuses.includes(this.status)) {
            throw new ValidationError(
                `סטטוס לא תקין. חייב להיות אחד מ: ${validStatuses.join(', ')}`,
                'status'
            );
        }

        // Priority
        const validPriorities = Object.values(THREAD_PRIORITY);
        if (!validPriorities.includes(this.priority)) {
            throw new ValidationError(
                `עדיפות לא תקינה. חייבת להיות אחת מ: ${validPriorities.join(', ')}`,
                'priority'
            );
        }

        // Participants must be unique UIDs
        if (this.participants.length > 0) {
            const uniqueParticipants = [...new Set(this.participants)];
            this.participants = uniqueParticipants;
        }
    }

    /**
     * Add participant to thread
     */
    addParticipant(uid) {
        if (!uid) {
            throw new ValidationError('UID של משתמש הוא שדה חובה', 'uid');
        }

        if (!this.participants.includes(uid)) {
            this.participants.push(uid);
            this.updatedAt = new Date();
        }
    }

    /**
     * Remove participant from thread
     */
    removeParticipant(uid) {
        const index = this.participants.indexOf(uid);
        if (index > -1) {
            this.participants.splice(index, 1);
            this.updatedAt = new Date();
        }
    }

    /**
     * Close thread
     */
    close() {
        if (this.status !== THREAD_STATUS.CLOSED) {
            this.status = THREAD_STATUS.CLOSED;
            this.updatedAt = new Date();
        }
    }

    /**
     * Reopen thread
     */
    reopen() {
        if (this.status === THREAD_STATUS.CLOSED) {
            this.status = THREAD_STATUS.OPEN;
            this.updatedAt = new Date();
        }
    }

    /**
     * Archive thread
     */
    archive() {
        this.status = THREAD_STATUS.ARCHIVED;
        this.updatedAt = new Date();
    }

    /**
     * Increment unread count for user
     */
    incrementUnreadCount(uid) {
        if (!this.unreadCount[uid]) {
            this.unreadCount[uid] = 0;
        }
        this.unreadCount[uid]++;
    }

    /**
     * Reset unread count for user
     */
    resetUnreadCount(uid) {
        this.unreadCount[uid] = 0;
    }

    /**
     * Get total unread count for user
     */
    getUnreadCount(uid) {
        return this.unreadCount[uid] || 0;
    }

    /**
     * Update last message info
     */
    updateLastMessage(messagePreview) {
        this.lastMessageAt = new Date();
        this.lastMessagePreview = messagePreview.substring(0, 100);
        this.updatedAt = new Date();
    }

    /**
     * Check if user is participant
     */
    isParticipant(uid) {
        return this.participants.includes(uid);
    }

    /**
     * Convert to Firestore format
     */
    toFirestore() {
        return {
            title: this.title,
            category: this.category,
            createdBy: this.createdBy,
            participants: this.participants,
            status: this.status,
            priority: this.priority,
            relatedTo: this.relatedTo,
            lastMessageAt: this.lastMessageAt ? firebase.firestore.Timestamp.fromDate(this.lastMessageAt) : null,
            lastMessagePreview: this.lastMessagePreview,
            unreadCount: this.unreadCount,
            tags: this.tags,
            createdAt: firebase.firestore.Timestamp.fromDate(this.createdAt),
            updatedAt: firebase.firestore.Timestamp.fromDate(this.updatedAt)
        };
    }

    /**
     * Create Thread from Firestore document
     */
    static fromFirestore(id, data) {
        return new Thread({
            id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            lastMessageAt: data.lastMessageAt?.toDate(),
            skipValidation: false
        });
    }

    /**
     * Create empty thread
     */
    static createEmpty() {
        return new Thread({ skipValidation: true });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Thread;
}

if (typeof window !== 'undefined') {
    window.Thread = Thread;
}
