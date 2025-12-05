/**
 * Thread Constants
 * קבועי דיונים (Threads)
 *
 * Created: 2025-12-01
 * Phase: Foundation Layer
 */

const THREAD_CATEGORIES = Object.freeze({
    CASE_WORK: 'case_work',       // עבודה על תיקים
    ADMIN: 'admin',               // אדמיניסטרציה
    GENERAL: 'general',           // כללי
    TECHNICAL: 'technical',       // טכני
    HR: 'hr',                     // משאבי אנוש
    FINANCE: 'finance'            // כלכלה
});

const THREAD_STATUS = Object.freeze({
    OPEN: 'open',                 // פתוח
    CLOSED: 'closed',             // סגור
    ARCHIVED: 'archived'          // ארכיון
});

const THREAD_PRIORITY = Object.freeze({
    LOW: 'low',                   // נמוך
    NORMAL: 'normal',             // רגיל
    HIGH: 'high',                 // גבוה
    URGENT: 'urgent'              // דחוף
});

// Category Labels (Hebrew)
const THREAD_CATEGORY_LABELS = Object.freeze({
    [THREAD_CATEGORIES.CASE_WORK]: 'עבודה על תיקים',
    [THREAD_CATEGORIES.ADMIN]: 'אדמיניסטרציה',
    [THREAD_CATEGORIES.GENERAL]: 'כללי',
    [THREAD_CATEGORIES.TECHNICAL]: 'טכני',
    [THREAD_CATEGORIES.HR]: 'משאבי אנוש',
    [THREAD_CATEGORIES.FINANCE]: 'כלכלה'
});

// Priority Labels (Hebrew)
const THREAD_PRIORITY_LABELS = Object.freeze({
    [THREAD_PRIORITY.LOW]: 'נמוך',
    [THREAD_PRIORITY.NORMAL]: 'רגיל',
    [THREAD_PRIORITY.HIGH]: 'גבוה',
    [THREAD_PRIORITY.URGENT]: 'דחוף'
});

// Priority Colors
const THREAD_PRIORITY_COLORS = Object.freeze({
    [THREAD_PRIORITY.LOW]: '#6b7280',       // Gray
    [THREAD_PRIORITY.NORMAL]: '#3b82f6',   // Blue
    [THREAD_PRIORITY.HIGH]: '#f59e0b',     // Orange
    [THREAD_PRIORITY.URGENT]: '#ef4444'    // Red
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        THREAD_CATEGORIES,
        THREAD_STATUS,
        THREAD_PRIORITY,
        THREAD_CATEGORY_LABELS,
        THREAD_PRIORITY_LABELS,
        THREAD_PRIORITY_COLORS
    };
}

if (typeof window !== 'undefined') {
    window.THREAD_CATEGORIES = THREAD_CATEGORIES;
    window.THREAD_STATUS = THREAD_STATUS;
    window.THREAD_PRIORITY = THREAD_PRIORITY;
    window.THREAD_CATEGORY_LABELS = THREAD_CATEGORY_LABELS;
    window.THREAD_PRIORITY_LABELS = THREAD_PRIORITY_LABELS;
    window.THREAD_PRIORITY_COLORS = THREAD_PRIORITY_COLORS;
}
