/**
 * Alert Types Constants
 * קבועי סוגי התראות
 *
 * Created: 2025-12-01
 * Phase: Foundation Layer
 */

const ALERT_TYPES = Object.freeze({
    MISSING_HOURS: 'missing_hours',           // לא דיווח שעות
    INSUFFICIENT_HOURS: 'insufficient_hours', // חוסר בשעות לפי תקן
    OVERDUE_TASKS: 'overdue_tasks',           // משימות באיחור
    INACTIVE_USER: 'inactive_user',           // משתמש לא פעיל
    MISSED_DEADLINE: 'missed_deadline',       // פספס דדליין
    LOW_PERFORMANCE: 'low_performance',       // ביצועים נמוכים
    NO_ACTIVITY: 'no_activity',               // אין פעילות
    INCOMPLETE_PROFILE: 'incomplete_profile'  // פרופיל לא מלא
});

const ALERT_SEVERITY = Object.freeze({
    INFO: 'info',             // מידע - כחול
    WARNING: 'warning',       // אזהרה - צהוב
    CRITICAL: 'critical'      // קריטי - אדום
});

// Alert Icons
const ALERT_ICONS = Object.freeze({
    [ALERT_TYPES.MISSING_HOURS]: 'fas fa-clock',
    [ALERT_TYPES.INSUFFICIENT_HOURS]: 'fas fa-hourglass-half',
    [ALERT_TYPES.OVERDUE_TASKS]: 'fas fa-tasks',
    [ALERT_TYPES.INACTIVE_USER]: 'fas fa-user-clock',
    [ALERT_TYPES.MISSED_DEADLINE]: 'fas fa-calendar-times',
    [ALERT_TYPES.LOW_PERFORMANCE]: 'fas fa-chart-line',
    [ALERT_TYPES.NO_ACTIVITY]: 'fas fa-bed',
    [ALERT_TYPES.INCOMPLETE_PROFILE]: 'fas fa-user-edit'
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ALERT_TYPES, ALERT_SEVERITY, ALERT_ICONS };
}

if (typeof window !== 'undefined') {
    window.ALERT_TYPES = ALERT_TYPES;
    window.ALERT_SEVERITY = ALERT_SEVERITY;
    window.ALERT_ICONS = ALERT_ICONS;
}
