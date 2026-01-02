/**
 * Workload Analytics - Constants & Configuration
 * קבועים והגדרות עבור מערכת ניתוח עומס עבודה
 *
 * נוצר: 2026-01-01
 * גרסה: 4.0.0 - Production-Ready Refactoring
 *
 * מטרה: ריכוז כל ה-Magic Numbers במקום אחד
 */

(function() {
    'use strict';

    /**
     * WorkloadConstants - קבועים גלובליים
     */
    const WorkloadConstants = {

        // ═══════════════════════════════════════════════════════════════
        // WORKLOAD SCORE THRESHOLDS - סף ציון עומס
        // ═══════════════════════════════════════════════════════════════
        WORKLOAD_THRESHOLDS: {
            LOW_MAX: 30,        // 0-29% = זמין
            MEDIUM_MAX: 60,     // 30-59% = בינוני
            HIGH_MAX: 85,       // 60-84% = עמוס
            CRITICAL: 85        // 85-100% = קריטי
        },

        // ═══════════════════════════════════════════════════════════════
        // WORKLOAD SCORE WEIGHTS - משקולות לחישוב ציון
        // ═══════════════════════════════════════════════════════════════
        SCORE_WEIGHTS: {
            BACKLOG: 0.35,      // 35% - כמות עבודה נותרת
            URGENCY: 0.30,      // 30% - דחיפות (דדליינים)
            TASK_COUNT: 0.15,   // 15% - מספר משימות מקבילות
            CAPACITY: 0.20      // 20% - ניצול קיבולת
        },

        // ═══════════════════════════════════════════════════════════════
        // TASK QUALITY THRESHOLDS - סף איכות משימות
        // ═══════════════════════════════════════════════════════════════
        TASK_QUALITY: {
            // משימה שצריכה להיסגר
            SHOULD_CLOSE_PERCENT: 80,          // 80%+ הושלם

            // משימה קרובה לסיום
            NEAR_COMPLETE_PERCENT: 90,         // 90%+ הושלם

            // משימה כמעט גמורה
            ALMOST_DONE_PERCENT: 95,           // 95%+ הושלם
            ALMOST_DONE_MINUTES: 60,           // פחות משעה נותרת

            // משימה stale (ישנה)
            STALE_DAYS: 30,                    // 30+ ימים ללא התקדמות

            // מספר משימות מקסימלי
            MAX_TASKS_BEFORE_ALERT: 8,         // יותר מ-8 משימות = התראה

            // סף איכות נתונים
            DATA_QUALITY_THRESHOLD: 30         // 30%+ משימות לסגירה = בעיית איכות
        },

        // ═══════════════════════════════════════════════════════════════
        // URGENCY METRICS - מדדי דחיפות
        // ═══════════════════════════════════════════════════════════════
        URGENCY: {
            WITHIN_24H_DAYS: 1,         // משימות עד 24 שעות
            WITHIN_3DAYS: 3,            // משימות עד 3 ימים
            WITHIN_7DAYS: 7,            // משימות עד שבוע

            // ניקוד דחיפות
            OVERDUE_SCORE: 50,          // משימה באיחור = 50 נקודות
            WITHIN_24H_SCORE: 30,       // עד 24h = 30 נקודות
            WITHIN_3DAYS_SCORE: 15,     // עד 3 ימים = 15 נקודות
            WITHIN_7DAYS_SCORE: 5       // עד שבוע = 5 נקודות
        },

        // ═══════════════════════════════════════════════════════════════
        // WORK HOURS - שעות עבודה
        // ═══════════════════════════════════════════════════════════════
        WORK_HOURS: {
            DEFAULT_DAILY_HOURS: 8.45,      // שעות עבודה יומיות (ברירת מחדל)
            DEFAULT_WEEKLY_HOURS: 42.25,    // שעות עבודה שבועיות (5 ימים)
            WORK_DAYS_PER_WEEK: 5,          // ימי עבודה בשבוע

            // נרמול backlog
            MAX_BACKLOG_DAYS: 7             // 7 ימי עבודה = 100% backlog
        },

        // ═══════════════════════════════════════════════════════════════
        // CAPACITY & AVAILABILITY - קיבולת וזמינות
        // ═══════════════════════════════════════════════════════════════
        CAPACITY: {
            // עובד יכול לקבל משימה חדשה אם יש לו:
            MIN_AVAILABLE_HALF_DAY: 0.5,    // חצי יום זמין (50% מיום עבודה)

            // גודל משימה מומלץ
            LARGE_TASK_DAYS: 2,             // יותר מיומיים זמינים = משימה גדולה
            MEDIUM_TASK_DAYS: 0.5,          // חצי יום עד יומיים = משימה בינונית

            // סף עומס יומי
            DAILY_OVERLOAD_THRESHOLD: 1.0   // עומס יומי > 100% מהתקן = overload
        },

        // ═══════════════════════════════════════════════════════════════
        // CACHE SETTINGS - הגדרות Cache
        // ═══════════════════════════════════════════════════════════════
        CACHE: {
            TTL_MILLISECONDS: 5 * 60 * 1000 // 5 דקות
        },

        // ═══════════════════════════════════════════════════════════════
        // UI DISPLAY LIMITS - מגבלות תצוגה
        // ═══════════════════════════════════════════════════════════════
        UI_LIMITS: {
            // מספר פריטים להצגה
            MAX_RISKY_TASKS: 5,                 // Top 5 משימות בסיכון
            MAX_ALERTS_DISPLAY: 4,              // עד 4 התראות
            INITIAL_PEAK_TASKS: 5,              // 5 משימות ראשונות ביום שיא (v3.0)
            LEGACY_PEAK_TASKS: 10,              // 10 משימות (legacy)

            // תצוגת גרפים
            WEEKLY_CHART_DAYS: 5,               // 5 ימי עבודה בגרף שבועי
            DAILY_CHART_HEIGHT: 120             // גובה גרף (px)
        },

        // ═══════════════════════════════════════════════════════════════
        // ALERT SEVERITY LEVELS - רמות חומרה להתראות
        // ═══════════════════════════════════════════════════════════════
        ALERT_SEVERITY: {
            CRITICAL: 'critical',
            WARNING: 'warning',
            INFO: 'info'
        },

        // ═══════════════════════════════════════════════════════════════
        // RISK LEVELS - רמות סיכון למשימות
        // ═══════════════════════════════════════════════════════════════
        RISK_LEVELS: {
            CRITICAL: 'critical',       // משימה באיחור
            HIGH: 'high',               // משימה דחופה (< 1 יום)
            MEDIUM: 'medium',           // משימה בסיכון (< 2 ימים + 4+ שעות)

            // סף סיכון
            OVERDUE_THRESHOLD: 0,       // פחות מ-0 ימים = באיחור
            HIGH_RISK_DAYS: 1,          // פחות מיום אחד
            MEDIUM_RISK_DAYS: 2,        // פחות מיומיים
            MEDIUM_RISK_HOURS: 4        // + יותר מ-4 שעות נותרות
        },

        // ═══════════════════════════════════════════════════════════════
        // NORMALIZATION FACTORS - גורמי נרמול לציון
        // ═══════════════════════════════════════════════════════════════
        NORMALIZATION: {
            // Task count normalization
            MAX_TASK_COUNT: 10,         // 10 משימות = 100%

            // Capacity normalization
            MAX_CAPACITY_PERCENT: 100   // 100% ניצול = 100%
        },

        // ═══════════════════════════════════════════════════════════════
        // VERSION INFO - מידע גרסה
        // ═══════════════════════════════════════════════════════════════
        VERSION: {
            CONSTANTS: '4.0.0',         // גרסת קובץ זה
            CALCULATOR: '2.1.3',        // גרסת Calculator
            SERVICE: '3.0.0',           // גרסת Service
            CARD: '3.0.0'               // גרסת Card (UI)
        },

        // ═══════════════════════════════════════════════════════════════
        // COLOR PALETTE - פלטת צבעים (v3.0 Minimal Design)
        // ═══════════════════════════════════════════════════════════════
        COLORS: {
            // Gray Scale (primary)
            GRAY_DARKEST: '#1e293b',
            GRAY_DARK: '#475569',
            GRAY_BASE: '#64748b',
            GRAY_LIGHT: '#94a3b8',
            GRAY_LIGHTER: '#cbd5e1',
            GRAY_LIGHTEST: '#e2e8f0',
            GRAY_BG: '#f1f5f9',
            GRAY_BG_LIGHT: '#fafbfc',

            // Accent Colors (minimal usage)
            BLUE_PREMIUM: '#3b82f6',    // כחול יוקרתי - רק לאייקונים
            RED_ALERT: '#ef4444',       // אדום - רק לקריטי
            RED_CRITICAL: '#dc2626',    // אדום כהה - התראות

            // Background Colors
            WHITE: '#ffffff',
            CRITICAL_BG: '#fef2f2',     // רקע אדום עדין
            CRITICAL_BORDER: '#fecaca' // גבול אדום עדין
        },

        // ═══════════════════════════════════════════════════════════════
        // I18N STRINGS - מחרוזות בינלאומיות (עברית בלבד כרגע)
        // ═══════════════════════════════════════════════════════════════
        I18N: {
            HE: {
                // Workload Levels
                LEVEL_LOW: 'זמין',
                LEVEL_MEDIUM: 'בינוני',
                LEVEL_HIGH: 'עמוס',
                LEVEL_CRITICAL: 'קריטי',
                LEVEL_UNKNOWN: 'לא ידוע',

                // Roles
                ROLE_ADMIN: 'מנהל',
                ROLE_LAWYER: 'עורך דין',
                ROLE_ASSISTANT: 'עוזר',
                ROLE_INTERN: 'מתמחה',

                // Days of Week
                DAY_SUNDAY: 'ראשון',
                DAY_MONDAY: 'שני',
                DAY_TUESDAY: 'שלישי',
                DAY_WEDNESDAY: 'רביעי',
                DAY_THURSDAY: 'חמישי',
                DAY_FRIDAY: 'שישי',
                DAY_SATURDAY: 'שבת',

                // Common Phrases
                TODAY: 'היום',
                TOMORROW: 'מחר',
                NO_DEADLINE: 'ללא דדליין',
                NO_CLIENT: 'ללא לקוח',
                NO_DESCRIPTION: 'ללא תיאור'
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // Helper Functions - פונקציות עזר
    // ═══════════════════════════════════════════════════════════════

    /**
     * קבלת סף ציון עומס
     */
    WorkloadConstants.getWorkloadLevel = function(score) {
        if (score < this.WORKLOAD_THRESHOLDS.LOW_MAX) {
return 'low';
}
        if (score < this.WORKLOAD_THRESHOLDS.MEDIUM_MAX) {
return 'medium';
}
        if (score < this.WORKLOAD_THRESHOLDS.HIGH_MAX) {
return 'high';
}
        return 'critical';
    };

    /**
     * קבלת תווית ברמת עומס
     */
    WorkloadConstants.getWorkloadLevelLabel = function(level) {
        const labels = {
            low: this.I18N.HE.LEVEL_LOW,
            medium: this.I18N.HE.LEVEL_MEDIUM,
            high: this.I18N.HE.LEVEL_HIGH,
            critical: this.I18N.HE.LEVEL_CRITICAL,
            unknown: this.I18N.HE.LEVEL_UNKNOWN
        };
        return labels[level] || labels.unknown;
    };

    /**
     * קבלת תווית לתפקיד
     */
    WorkloadConstants.getRoleLabel = function(role) {
        const labels = {
            admin: this.I18N.HE.ROLE_ADMIN,
            lawyer: this.I18N.HE.ROLE_LAWYER,
            assistant: this.I18N.HE.ROLE_ASSISTANT,
            intern: this.I18N.HE.ROLE_INTERN
        };
        return labels[role] || role;
    };

    /**
     * קבלת שם יום בשבוע
     */
    WorkloadConstants.getDayName = function(dayIndex) {
        const days = [
            this.I18N.HE.DAY_SUNDAY,
            this.I18N.HE.DAY_MONDAY,
            this.I18N.HE.DAY_TUESDAY,
            this.I18N.HE.DAY_WEDNESDAY,
            this.I18N.HE.DAY_THURSDAY,
            this.I18N.HE.DAY_FRIDAY,
            this.I18N.HE.DAY_SATURDAY
        ];
        return days[dayIndex] || '';
    };

    /**
     * בדיקה אם משימה צריכה להיסגר
     */
    WorkloadConstants.shouldTaskBeClosed = function(completionPercent, isOverdue) {
        return completionPercent >= this.TASK_QUALITY.SHOULD_CLOSE_PERCENT && isOverdue;
    };

    /**
     * בדיקה אם משימה קרובה לסיום
     */
    WorkloadConstants.isNearComplete = function(completionPercent) {
        return completionPercent >= this.TASK_QUALITY.NEAR_COMPLETE_PERCENT;
    };

    /**
     * בדיקה אם משימה כמעט גמורה
     */
    WorkloadConstants.isAlmostDone = function(completionPercent, remainingMinutes) {
        return completionPercent >= this.TASK_QUALITY.ALMOST_DONE_PERCENT &&
               remainingMinutes <= this.TASK_QUALITY.ALMOST_DONE_MINUTES;
    };

    /**
     * בדיקה אם משימה stale
     */
    WorkloadConstants.isStaleTask = function(daysOpen, hasNoProgress) {
        return daysOpen > this.TASK_QUALITY.STALE_DAYS && hasNoProgress;
    };

    // ═══════════════════════════════════════════════════════════════
    // Global Export
    // ═══════════════════════════════════════════════════════════════

    window.WorkloadConstants = WorkloadConstants;

    console.log('✅ WorkloadConstants v4.0.0 loaded - Production-Ready Configuration');

})();
