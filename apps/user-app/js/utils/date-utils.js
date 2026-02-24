/**
 * Date Utilities
 * פונקציות עזר לעבודה עם תאריכים
 *
 * Created: 2025-12-01
 * Phase: Services Layer
 */

const DateUtils = {
    /**
     * Format date to Hebrew
     */
    formatDate(date, options = {}) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...options
        };

        return date.toLocaleDateString('he-IL', defaultOptions);
    },

    /**
     * Format time
     */
    formatTime(date, options = {}) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const defaultOptions = {
            hour: '2-digit',
            minute: '2-digit',
            ...options
        };

        return date.toLocaleTimeString('he-IL', defaultOptions);
    },

    /**
     * Format date and time
     */
    formatDateTime(date) {
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    /**
     * Get relative time (e.g., "לפני 5 דקות")
     */
    getRelativeTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);

        if (diffSec < 60) {
            return 'עכשיו';
        } else if (diffMin < 60) {
            return `לפני ${diffMin} דקות`;
        } else if (diffHour < 24) {
            return `לפני ${diffHour} שעות`;
        } else if (diffDay < 7) {
            return `לפני ${diffDay} ימים`;
        } else if (diffWeek < 4) {
            return `לפני ${diffWeek} שבועות`;
        } else if (diffMonth < 12) {
            return `לפני ${diffMonth} חודשים`;
        } else {
            return `לפני ${diffYear} שנים`;
        }
    },

    /**
     * Check if date is today
     */
    isToday(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const today = new Date();
        return date.toDateString() === today.toDateString();
    },

    /**
     * Check if date is yesterday
     */
    isYesterday(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return date.toDateString() === yesterday.toDateString();
    },

    /**
     * Get days between dates
     */
    getDaysBetween(date1, date2) {
        if (!(date1 instanceof Date)) {
date1 = new Date(date1);
}
        if (!(date2 instanceof Date)) {
date2 = new Date(date2);
}

        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    /**
     * Get start of day
     */
    getStartOfDay(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        return start;
    },

    /**
     * Get end of day
     */
    getEndOfDay(date = new Date()) {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end;
    },

    /**
     * Get start of week
     */
    getStartOfWeek(date = new Date()) {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day;
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        return start;
    },

    /**
     * Get end of week
     */
    getEndOfWeek(date = new Date()) {
        const end = new Date(date);
        const day = end.getDay();
        const diff = end.getDate() + (6 - day);
        end.setDate(diff);
        end.setHours(23, 59, 59, 999);
        return end;
    },

    /**
     * Get start of month
     */
    getStartOfMonth(date = new Date()) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    },

    /**
     * Get end of month
     */
    getEndOfMonth(date = new Date()) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    },

    /**
     * Format for date input (YYYY-MM-DD)
     */
    formatForInput(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateUtils;
}

if (typeof window !== 'undefined') {
    window.DateUtils = DateUtils;
}
