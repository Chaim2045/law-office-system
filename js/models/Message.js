/**
 * Message Model
 * מודל של הודעה בדיון
 *
 * Created: 2025-12-01
 * Phase: Data Models
 *
 * זו הודעה בודדת בתוך Thread
 */

class Message {
    /**
     * Create a new Message
     * @param {Object} data - Message data
     */
    constructor(data = {}) {
        // Required fields
        this.id = data.id || null;
        this.threadId = data.threadId || null;
        this.from = data.from || null; // { uid, name, role }
        this.text = data.text || '';

        // Optional fields
        this.attachments = data.attachments || [];
        this.mentions = data.mentions || []; // Array of UIDs
        this.isEdited = data.isEdited || false;
        this.editedAt = data.editedAt || null;
        this.isDeleted = data.isDeleted || false;
        this.deletedAt = data.deletedAt || null;
        this.reactions = data.reactions || {}; // { emoji: [uid1, uid2] }

        // Timestamps
        this.createdAt = data.createdAt || new Date();

        // Validate on creation
        if (!data.skipValidation) {
            this.validate();
        }
    }

    /**
     * Validate message data
     */
    validate() {
        // Thread ID
        if (!this.threadId) {
            throw new ValidationError('Thread ID הוא שדה חובה', 'threadId');
        }

        // From
        if (!this.from || !this.from.uid) {
            throw new ValidationError('שולח ההודעה הוא שדה חובה', 'from');
        }

        // Text
        if (!this.text || this.text.trim().length === 0) {
            throw new ValidationError('תוכן ההודעה הוא שדה חובה', 'text');
        }

        if (this.text.length > 5000) {
            throw new ValidationError('ההודעה ארוכה מדי (מקסימום 5000 תווים)', 'text');
        }
    }

    /**
     * Edit message
     */
    edit(newText) {
        if (!newText || newText.trim().length === 0) {
            throw new ValidationError('תוכן ההודעה החדש לא יכול להיות רק', 'text');
        }

        this.text = newText.trim();
        this.isEdited = true;
        this.editedAt = new Date();
    }

    /**
     * Delete message (soft delete)
     */
    delete() {
        this.isDeleted = true;
        this.deletedAt = new Date();
        this.text = '[ההודעה נמחקה]';
    }

    /**
     * Add reaction
     */
    addReaction(emoji, uid) {
        if (!this.reactions[emoji]) {
            this.reactions[emoji] = [];
        }

        if (!this.reactions[emoji].includes(uid)) {
            this.reactions[emoji].push(uid);
        }
    }

    /**
     * Remove reaction
     */
    removeReaction(emoji, uid) {
        if (this.reactions[emoji]) {
            const index = this.reactions[emoji].indexOf(uid);
            if (index > -1) {
                this.reactions[emoji].splice(index, 1);
            }

            // Remove emoji key if no reactions left
            if (this.reactions[emoji].length === 0) {
                delete this.reactions[emoji];
            }
        }
    }

    /**
     * Check if user reacted with emoji
     */
    hasReaction(emoji, uid) {
        return this.reactions[emoji] && this.reactions[emoji].includes(uid);
    }

    /**
     * Get preview text (first 100 chars)
     */
    getPreview() {
        if (this.isDeleted) {
            return '[ההודעה נמחקה]';
        }
        return this.text.substring(0, 100) + (this.text.length > 100 ? '...' : '');
    }

    /**
     * Convert to Firestore format
     */
    toFirestore() {
        return {
            threadId: this.threadId,
            from: this.from,
            text: this.text,
            attachments: this.attachments,
            mentions: this.mentions,
            isEdited: this.isEdited,
            editedAt: this.editedAt ? firebase.firestore.Timestamp.fromDate(this.editedAt) : null,
            isDeleted: this.isDeleted,
            deletedAt: this.deletedAt ? firebase.firestore.Timestamp.fromDate(this.deletedAt) : null,
            reactions: this.reactions,
            createdAt: firebase.firestore.Timestamp.fromDate(this.createdAt)
        };
    }

    /**
     * Create Message from Firestore document
     */
    static fromFirestore(id, data) {
        return new Message({
            id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            editedAt: data.editedAt?.toDate(),
            deletedAt: data.deletedAt?.toDate(),
            skipValidation: false
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Message;
}

if (typeof window !== 'undefined') {
    window.Message = Message;
}
