/**
 * System Announcement Model
 * מודל נתונים להודעות מערכת
 *
 * Created: 2025-12-11
 * Version: 1.0.0
 */

(function() {
    'use strict';

    /**
     * System Announcement Types
     */
    const ANNOUNCEMENT_TYPES = {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error'
    };

    /**
     * Target Audience
     */
    const TARGET_AUDIENCE = {
        ALL: 'all',
        EMPLOYEES: 'employees',
        ADMINS: 'admins'
    };

    /**
     * System Announcement Class
     */
    class SystemAnnouncement {
        constructor(data = {}) {
            this.id = data.id || null;
            this.title = data.title || ''; // Optional - for future modal support
            this.message = data.message || '';
            this.tenantId = data.tenantId || 'default';
            this.type = data.type || ANNOUNCEMENT_TYPES.INFO;
            this.priority = data.priority || 3; // 1-10
            this.active = data.active !== undefined ? data.active : true;
            this.startDate = data.startDate || new Date();
            this.endDate = data.endDate || null;
            this.targetAudience = data.targetAudience || TARGET_AUDIENCE.ALL;
            this.createdBy = data.createdBy || '';
            this.createdAt = data.createdAt || new Date();
            this.updatedAt = data.updatedAt || new Date();

            this.displaySettings = {
                showOnLogin: data.displaySettings?.showOnLogin !== undefined ? data.displaySettings.showOnLogin : true,
                showInHeader: data.displaySettings?.showInHeader !== undefined ? data.displaySettings.showInHeader : true,
                dismissible: data.displaySettings?.dismissible !== undefined ? data.displaySettings.dismissible : true
            };

            // Display style - auto or manual repeat control
            this.displayStyle = {
                mode: data.displayStyle?.mode || 'auto', // 'auto' or 'manual'
                repeatCount: data.displayStyle?.repeatCount || null // null for auto, 1/3/5 for manual
            };

            this.readBy = data.readBy || {};
            this.popupSettings = data.popupSettings || {
                requireReadConfirmation: true,
                readTimer: 'auto'
            };
        }

        /**
         * Validate announcement data
         * @returns {Object} { valid: boolean, errors: string[] }
         */
        validate() {
            const errors = [];

            // Message is required (title is optional for ticker-only mode)
            if (!this.message || this.message.trim() === '') {
                errors.push('תוכן ההודעה חובה');
            }

            if (!Object.values(ANNOUNCEMENT_TYPES).includes(this.type)) {
                errors.push('סוג הודעה לא תקין');
            }

            if (this.priority < 1 || this.priority > 10) {
                errors.push('עדיפות חייבת להיות בין 1 ל-10');
            }

            if (!Object.values(TARGET_AUDIENCE).includes(this.targetAudience)) {
                errors.push('קהל יעד לא תקין');
            }

            if (this.endDate && this.startDate > this.endDate) {
                errors.push('תאריך סיום חייב להיות אחרי תאריך התחלה');
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }

        /**
         * Check if announcement is currently active
         * @returns {boolean}
         */
        isCurrentlyActive() {
            if (!this.active) {
return false;
}

            const now = new Date();
            const start = this.startDate instanceof Date ? this.startDate : new Date(this.startDate);

            if (now < start) {
return false;
}

            if (this.endDate) {
                const end = this.endDate instanceof Date ? this.endDate : new Date(this.endDate);
                if (now > end) {
return false;
}
            }

            return true;
        }

        /**
         * Convert to plain object for Firestore
         * @returns {Object}
         */
        toFirestore() {
            const data = {
                message: this.message,
                type: this.type,
                priority: this.priority,
                active: this.active,
                startDate: this.startDate instanceof Date ?
                    firebase.firestore.Timestamp.fromDate(this.startDate) :
                    this.startDate,
                endDate: this.endDate ?
                    (this.endDate instanceof Date ?
                        firebase.firestore.Timestamp.fromDate(this.endDate) :
                        this.endDate) :
                    null,
                targetAudience: this.targetAudience,
                createdBy: this.createdBy,
                createdAt: this.createdAt instanceof Date ?
                    firebase.firestore.Timestamp.fromDate(this.createdAt) :
                    this.createdAt,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                displaySettings: this.displaySettings
            };

            // Only include title if it exists (for backward compatibility)
            if (this.title) {
                data.title = this.title;
            }

            data.tenantId = this.tenantId;
            data.readBy = this.readBy;
            data.popupSettings = this.popupSettings;

            return data;
        }

        /**
         * Create from Firestore document
         * @param {Object} doc - Firestore document
         * @returns {SystemAnnouncement}
         */
        static fromFirestore(doc) {
            const data = doc.data();
            return new SystemAnnouncement({
                id: doc.id,
                title: data.title || '',
                message: data.message,
                type: data.type,
                priority: data.priority,
                active: data.active,
                startDate: data.startDate?.toDate(),
                endDate: data.endDate?.toDate(),
                targetAudience: data.targetAudience,
                tenantId: data.tenantId || 'default',
                createdBy: data.createdBy,
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate(),
                displaySettings: data.displaySettings,
                readBy: data.readBy || {},
                popupSettings: data.popupSettings || { requireReadConfirmation: true, readTimer: 'auto' }
            });
        }

        /**
         * Get type icon
         * @returns {string}
         */
        getTypeIcon() {
            const icons = {
                [ANNOUNCEMENT_TYPES.INFO]: 'fa-info-circle',
                [ANNOUNCEMENT_TYPES.SUCCESS]: 'fa-check-circle',
                [ANNOUNCEMENT_TYPES.WARNING]: 'fa-exclamation-triangle',
                [ANNOUNCEMENT_TYPES.ERROR]: 'fa-times-circle'
            };
            return icons[this.type] || icons[ANNOUNCEMENT_TYPES.INFO];
        }

        /**
         * Get type color
         * @returns {string}
         */
        getTypeColor() {
            const colors = {
                [ANNOUNCEMENT_TYPES.INFO]: '#3b82f6',
                [ANNOUNCEMENT_TYPES.SUCCESS]: '#10b981',
                [ANNOUNCEMENT_TYPES.WARNING]: '#f59e0b',
                [ANNOUNCEMENT_TYPES.ERROR]: '#ef4444'
            };
            return colors[this.type] || colors[ANNOUNCEMENT_TYPES.INFO];
        }

        /**
         * Clone announcement
         * @returns {SystemAnnouncement}
         */
        clone() {
            const data = {
                message: this.message,
                type: this.type,
                priority: this.priority,
                active: this.active,
                startDate: this.startDate,
                endDate: this.endDate,
                targetAudience: this.targetAudience,
                createdBy: this.createdBy,
                displaySettings: { ...this.displaySettings }
            };

            // Only include title if it exists
            if (this.title) {
                data.title = this.title;
            }

            data.tenantId = this.tenantId;
            data.readBy = JSON.parse(JSON.stringify(this.readBy));
            data.popupSettings = { ...this.popupSettings };

            return new SystemAnnouncement(data);
        }
    }

    // Export
    window.SystemAnnouncement = SystemAnnouncement;
    window.ANNOUNCEMENT_TYPES = ANNOUNCEMENT_TYPES;
    window.TARGET_AUDIENCE = TARGET_AUDIENCE;

    console.log('✅ SystemAnnouncement model loaded');

})();
