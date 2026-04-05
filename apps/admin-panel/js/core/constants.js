/**
 * Admin Panel Constants
 * קבועים למערכת ניהול Admin
 *
 * תאריך: 19 נובמבר 2025
 * גרסה: 1.0.0
 * Sprint: 1 - Quick Wins
 *
 * תפקיד: ריכוז כל הקבועים במקום אחד למניעת magic numbers/strings
 */

(function() {
    'use strict';

    /**
     * System-wide constants for Admin Panel
     * קבועים כלל-מערכתיים לפאנל ניהול
     */
    const ADMIN_PANEL_CONSTANTS = {

        // ==========================================
        // Cache Configuration
        // הגדרות מטמון
        // ==========================================
        CACHE: {
            /**
             * Cache expiry time in milliseconds
             * זמן תפוגת מטמון במילישניות
             * @type {number}
             * @default 300000 (5 minutes)
             */
            EXPIRY_MS: 5 * 60 * 1000,

            /**
             * Cache expiry in minutes (for display)
             * זמן תפוגת מטמון בדקות (לתצוגה)
             * @type {number}
             * @default 5
             */
            EXPIRY_MINUTES: 5
        },

        // ==========================================
        // Notification Configuration
        // הגדרות התראות
        // ==========================================
        NOTIFICATIONS: {
            /**
             * Maximum simultaneous notifications
             * מקסימום התראות במקביל
             * @type {number}
             * @default 5
             */
            MAX_SIMULTANEOUS: 5,

            /**
             * Default notification duration in milliseconds
             * משך התראה ברירת מחדל במילישניות
             * @type {number}
             * @default 5000 (5 seconds)
             */
            DEFAULT_DURATION_MS: 5000,

            /**
             * Default notification duration in seconds (for display)
             * משך התראה ברירת מחדל בשניות (לתצוגה)
             * @type {number}
             * @default 5
             */
            DEFAULT_DURATION_SECONDS: 5
        },

        // ==========================================
        // Pagination Configuration
        // הגדרות עימוד
        // ==========================================
        PAGINATION: {
            /**
             * Maximum visible page buttons
             * מקסימום כפתורי עמוד גלויים
             * @type {number}
             * @default 7
             */
            MAX_VISIBLE_BUTTONS: 7,

            /**
             * Default page size
             * גודל עמוד ברירת מחדל
             * @type {number}
             * @default 20
             */
            DEFAULT_PAGE_SIZE: 20,

            /**
             * Available page size options
             * אפשרויות גודל עמוד זמינות
             * @type {number[]}
             */
            PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
        },

        // ==========================================
        // User Roles
        // תפקידי משתמש
        // ==========================================
        // USER_ROLES — sourced from SYSTEM_CONSTANTS with fallback
        USER_ROLES: window.SYSTEM_CONSTANTS ? window.SYSTEM_CONSTANTS.USER_ROLES : {
            ADMIN: 'admin',
            USER: 'user',
            LAWYER: 'lawyer',
            EMPLOYEE: 'employee',
            INTERN: 'intern'
        },

        // ==========================================
        // User Status
        // סטטוס משתמש
        // ==========================================
        USER_STATUS: {
            /**
             * Active user
             * משתמש פעיל
             * @type {string}
             */
            ACTIVE: 'active',

            /**
             * Blocked user
             * משתמש חסום
             * @type {string}
             */
            BLOCKED: 'blocked',

            /**
             * Pending user
             * משתמש ממתין
             * @type {string}
             */
            PENDING: 'pending'
        },

        // ==========================================
        // UI Configuration
        // הגדרות ממשק משתמש
        // ==========================================
        UI: {
            /**
             * Debounce delay for search input in milliseconds
             * השהיית debounce לחיפוש במילישניות
             * @type {number}
             * @default 300
             */
            SEARCH_DEBOUNCE_MS: 300,

            /**
             * Animation duration in milliseconds
             * משך אנימציה במילישניות
             * @type {number}
             * @default 300
             */
            ANIMATION_DURATION_MS: 300,

            /**
             * Loading skeleton delay in milliseconds
             * השהיית skeleton loader במילישניות
             * @type {number}
             * @default 200
             */
            SKELETON_DELAY_MS: 200
        },

        // ==========================================
        // Table Configuration
        // הגדרות טבלה
        // ==========================================
        TABLE: {
            /**
             * Maximum rows to display initially
             * מקסימום שורות להצגה ראשונית
             * @type {number}
             * @default 50
             */
            MAX_INITIAL_ROWS: 50,

            /**
             * Row height in pixels (for virtual scrolling)
             * גובה שורה בפיקסלים (לגלילה וירטואלית)
             * @type {number}
             * @default 48
             */
            ROW_HEIGHT_PX: 48
        },

        // ==========================================
        // Export Configuration
        // הגדרות ייצוא
        // ==========================================
        EXPORT: {
            /**
             * Maximum rows to export
             * מקסימום שורות לייצוא
             * @type {number}
             * @default 10000
             */
            MAX_ROWS: 10000,

            /**
             * Default file name prefix
             * קידומת שם קובץ ברירת מחדל
             * @type {string}
             */
            FILE_PREFIX: 'admin_export',

            /**
             * Date format for file names
             * פורמט תאריך לשמות קבצים
             * @type {string}
             */
            DATE_FORMAT: 'YYYY-MM-DD_HHmmss'
        }
    };

    /**
     * Helper function to get role text in Hebrew
     * פונקציית עזר לקבלת טקסט תפקיד בעברית
     *
     * @param {string} role - Role key
     * @returns {string} Hebrew role text
     */
    function getRoleText(role) {
        const roleTexts = {
            [ADMIN_PANEL_CONSTANTS.USER_ROLES.ADMIN]: 'מנהל',
            [ADMIN_PANEL_CONSTANTS.USER_ROLES.LAWYER]: 'עורך דין',
            [ADMIN_PANEL_CONSTANTS.USER_ROLES.EMPLOYEE]: 'עובד',
            [ADMIN_PANEL_CONSTANTS.USER_ROLES.INTERN]: 'מתמחה',
            [ADMIN_PANEL_CONSTANTS.USER_ROLES.USER]: 'משתמש'
        };

        return roleTexts[role] || role;
    }

    /**
     * Helper function to get status text in Hebrew
     * פונקציית עזר לקבלת טקסט סטטוס בעברית
     *
     * @param {string} status - Status key
     * @returns {string} Hebrew status text
     */
    function getStatusText(status) {
        const statusTexts = {
            [ADMIN_PANEL_CONSTANTS.USER_STATUS.ACTIVE]: 'פעיל',
            [ADMIN_PANEL_CONSTANTS.USER_STATUS.BLOCKED]: 'חסום',
            [ADMIN_PANEL_CONSTANTS.USER_STATUS.PENDING]: 'ממתין'
        };

        return statusTexts[status] || status;
    }

    /**
     * Helper function to validate role
     * פונקציית עזר לאימות תפקיד
     *
     * @param {string} role - Role to validate
     * @returns {boolean} True if role is valid
     */
    function isValidRole(role) {
        return Object.values(ADMIN_PANEL_CONSTANTS.USER_ROLES).includes(role);
    }

    /**
     * Helper function to validate status
     * פונקציית עזר לאימות סטטוס
     *
     * @param {string} status - Status to validate
     * @returns {boolean} True if status is valid
     */
    function isValidStatus(status) {
        return Object.values(ADMIN_PANEL_CONSTANTS.USER_STATUS).includes(status);
    }

    // ==========================================
    // Global Exports
    // ייצוא גלובלי
    // ==========================================

    // Make constants available globally
    window.ADMIN_PANEL_CONSTANTS = ADMIN_PANEL_CONSTANTS;

    // Make helper functions available globally
    window.AdminPanelHelpers = {
        getRoleText,
        getStatusText,
        isValidRole,
        isValidStatus
    };

    console.log('✅ Admin Panel Constants loaded');
    console.log('📋 Available: window.ADMIN_PANEL_CONSTANTS');
    console.log('🛠️ Helpers: window.AdminPanelHelpers');

})();
