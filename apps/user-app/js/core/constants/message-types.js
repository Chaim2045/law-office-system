/**
 * Message Types Constants
 * קבועי סוגי הודעות
 *
 * Created: 2025-12-01
 * Phase: Foundation Layer
 */

const MESSAGE_TYPES = Object.freeze({
    // Context Messages
    REMINDER: 'reminder',     // תזכורת
    WARNING: 'warning',       // אזהרה
    URGENT: 'urgent',         // דחוף
    INFO: 'info',             // מידע

    // Announcement Types
    ANNOUNCEMENT: 'announcement',
    SYSTEM: 'system'
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MESSAGE_TYPES;
}

if (typeof window !== 'undefined') {
    window.MESSAGE_TYPES = MESSAGE_TYPES;
}
