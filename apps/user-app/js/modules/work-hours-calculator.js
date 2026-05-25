/**
 * מחשבון שעות עבודה חכם
 * מחשב מכסת שעות חודשית מדויקת לפי לוח שנה ישראלי
 * מדד: 186 שעות/חודש ממוצע (או תקן אישי לפי עובד)
 */

class WorkHoursCalculator {
    constructor(dailyHoursTarget = null) {
        // PR-G.2: DEFAULT_DAILY_TARGET centralized — see js/shared/work-hours-constants.js
        const _C = (typeof window !== 'undefined' && window.WORK_HOURS_CONSTANTS) || null;
        const DEFAULT_DAILY_TARGET = _C ? _C.DEFAULT_DAILY_TARGET : 8.45;
        const DEFAULT_MONTHLY_HOURS = _C ? _C.DEFAULT_MONTHLY_HOURS : 186;

        // תקן שעות יומי (אם מועבר תקן אישי - משתמש בו, אחרת ברירת המחדל)
        this.DAILY_HOURS_TARGET = dailyHoursTarget || DEFAULT_DAILY_TARGET;

        // מדד שעות חודשי ממוצע (למען תאימות לאחור)
        this.MONTHLY_HOURS_TARGET = DEFAULT_MONTHLY_HOURS;

        // PR-G.3.2 (2026-05-20): holidays come from `window.WORK_HOURS_HOLIDAYS_MAP`
        // populated by `js/shared/holidays-cache.js` (PR-G.3.1) which subscribes to
        // Firestore `system_holidays/{year}` via onSnapshot. NO LOCAL CACHE — the
        // map is read LIVE on every `isHoliday()` call, so:
        //   (a) admin edits to a holiday doc are visible immediately
        //   (b) late-arriving snapshots populate the map after this constructor ran
        //   (c) the legacy `holidays2024/2025/2026` hardcoded arrays were removed
        // Office policy (Tommy 2026-05-20): "אין עבודה בערב חג". Eve days
        // (`isHalfDay: true`) are treated as full non-working days, identical to
        // closed holidays. See `isHoliday()` below.
    }

    /**
     * בודק אם תאריך הוא יום עבודה
     * @param {Date} date - התאריך לבדיקה
     * @returns {boolean} - האם זה יום עבודה
     */
    isWorkDay(date) {
        const dayOfWeek = date.getDay();

        // שישי-שבת לא עובדים
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            return false;
        }

        // בדוק אם זה חג
        if (this.isHoliday(date)) {
            return false;
        }

        return true;
    }

    /**
     * בודק אם תאריך הוא חג (או ערב חג, לפי policy החדש מ-2026-05-20).
     * PR-G.3.2: reads `window.WORK_HOURS_HOLIDAYS_MAP` LIVE on each call.
     * Empty map → returns false → graceful degradation to weekend-only logic.
     *
     * @param {Date} date - התאריך לבדיקה
     * @returns {boolean} - האם זה חג או ערב חג
     */
    isHoliday(date) {
        const dateStr = this.dateToString(date);
        const map = (typeof window !== 'undefined') ? window.WORK_HOURS_HOLIDAYS_MAP : null;
        if (!map || typeof map.get !== 'function') {
            return false;
        }
        const h = map.get(dateStr);
        if (!h) {
            return false;
        }
        // Closed holiday OR eve (per Tommy 2026-05-20: no work on eves)
        return !h.isWorking || h.isHalfDay === true;
    }

    /**
     * מחזיר את שם החג (אם זה חג)
     * @param {Date} date - התאריך לבדיקה
     * @returns {string|null} - שם החג או null
     */
    getHolidayName(date) {
        const dateStr = this.dateToString(date);
        const map = (typeof window !== 'undefined') ? window.WORK_HOURS_HOLIDAYS_MAP : null;
        if (!map || typeof map.get !== 'function') {
            return null;
        }
        const h = map.get(dateStr);
        if (!h) {
            return null;
        }
        if (!h.isWorking || h.isHalfDay === true) {
            return h.nameHe || null;
        }
        return null;
    }

    /**
     * ממיר תאריך למחרוזת לצורך השוואה
     * @param {Date} date
     * @returns {string} - YYYY-MM-DD
     */
    dateToString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * מחשב כמה ימי עבודה יש בחודש מסוים
     * @param {number} year - שנה
     * @param {number} month - חודש (0-11)
     * @returns {number} - מספר ימי עבודה
     */
    getWorkDaysInMonth(year, month) {
        let workDays = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            if (this.isWorkDay(date)) {
                workDays++;
            }
        }

        return workDays;
    }

    /**
     * מחשב ימי עבודה שעברו בחודש הנוכחי עד היום
     * @returns {number} - ימי עבודה שעברו
     */
    getWorkDaysPassedThisMonth() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const currentDay = today.getDate();

        let workDaysPassed = 0;

        for (let day = 1; day <= currentDay; day++) {
            const date = new Date(year, month, day);
            if (this.isWorkDay(date)) {
                workDaysPassed++;
            }
        }

        return workDaysPassed;
    }

    /**
     * מחשב ימי עבודה שנותרו בחודש הנוכחי (לא כולל היום)
     * @returns {number} - ימי עבודה שנותרו
     */
    getWorkDaysRemainingThisMonth() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentDay = today.getDate();

        let workDaysRemaining = 0;

        for (let day = currentDay + 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            if (this.isWorkDay(date)) {
                workDaysRemaining++;
            }
        }

        return workDaysRemaining;
    }

    /**
     * מחשב מכסת שעות חודשית מדויקת לפי ימי עבודה בפועל
     * מבוסס על תקן יומי × ימי עבודה בחודש (אחרי קיזוז שישי-שבת וחגים)
     * @param {number} year - שנה (אופציונלי, ברירת מחדל: שנה נוכחית)
     * @param {number} month - חודש 0-11 (אופציונלי, ברירת מחדל: חודש נוכחי)
     * @returns {Object} - אובייקט עם פרטי מכסה
     */
    getMonthlyQuota(year = null, month = null) {
        const today = new Date();
        year = year || today.getFullYear();
        month = month !== null ? month : today.getMonth();

        // חישוב ימי עבודה בחודש (אחרי קיזוז שישי-שבת וחגים)
        const workDaysInMonth = this.getWorkDaysInMonth(year, month);

        // תקן שעות יומי (אישי או ברירת מחדל)
        const dailyTarget = this.DAILY_HOURS_TARGET;

        // מכסת שעות לחודש זה = ימי עבודה × תקן יומי
        const monthlyQuota = Math.round(workDaysInMonth * dailyTarget * 10) / 10;

        return {
            year,
            month,
            monthName: this.getMonthName(month),
            workDaysInMonth,
            monthlyQuota,
            avgHoursPerDay: Math.round(dailyTarget * 10) / 10,
            dailyTarget: Math.round(dailyTarget * 10) / 10,
            // PR-G.2: compare against centralized default
            isCustomTarget: this.DAILY_HOURS_TARGET !== (window.WORK_HOURS_CONSTANTS ? window.WORK_HOURS_CONSTANTS.DEFAULT_DAILY_TARGET : 8.45)
        };
    }

    /**
     * מחשב מצב שעות עבודה נוכחי
     * @param {Array} timesheetEntries - רשומות שעתון של המשתמש
     * @returns {Object} - סטטיסטיקות מפורטות
     */
    calculateCurrentStatus(timesheetEntries = []) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const currentDay = today.getDate();

        // קבל מכסה חודשית
        const quota = this.getMonthlyQuota(year, month);

        // חשב ימי עבודה
        const workDaysPassed = this.getWorkDaysPassedThisMonth();
        const workDaysRemaining = this.getWorkDaysRemainingThisMonth();
        const workDaysTotal = quota.workDaysInMonth;

        // חשב שעות שדווחו בחודש הנוכחי
        let hoursWorkedThisMonth = 0;
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);

        if (timesheetEntries && timesheetEntries.length > 0) {
            timesheetEntries.forEach(entry => {
                const entryDate = entry.date ? new Date(entry.date) : new Date();
                if (entryDate >= monthStart && entryDate <= monthEnd) {
                    hoursWorkedThisMonth += (entry.minutes || 0) / 60;
                }
            });
        }

        hoursWorkedThisMonth = Math.round(hoursWorkedThisMonth * 10) / 10;

        // חישובים
        const quotaForDaysPassed = Math.round(workDaysPassed * quota.avgHoursPerDay * 10) / 10;
        const hoursRemaining = Math.round((quota.monthlyQuota - hoursWorkedThisMonth) * 10) / 10;
        const avgHoursPerRemainingDay = workDaysRemaining > 0
            ? Math.round((hoursRemaining / workDaysRemaining) * 10) / 10
            : 0;

        // אחוזים
        const percentageOfQuota = Math.round((hoursWorkedThisMonth / quota.monthlyQuota) * 100);
        const percentageOfExpected = quotaForDaysPassed > 0
            ? Math.round((hoursWorkedThisMonth / quotaForDaysPassed) * 100)
            : 0;

        // סטטוס
        let status = 'במעקב';
        let statusColor = '#3b82f6';

        if (percentageOfExpected >= 100) {
            status = 'מעולה! בקצב טוב';
            statusColor = '#10b981';
        } else if (percentageOfExpected >= 80) {
            status = 'כמעט שם';
            statusColor = '#f59e0b';
        } else if (percentageOfExpected < 70) {
            status = 'נדרש להתעדכן';
            statusColor = '#ef4444';
        }

        // בדוק אם היום יום עבודה
        const isTodayWorkDay = this.isWorkDay(today);
        const todayHolidayName = this.getHolidayName(today);

        return {
            // מידע בסיסי
            monthName: quota.monthName,
            year: quota.year,
            currentDay,

            // ימי עבודה
            workDaysPassed,
            workDaysRemaining,
            workDaysTotal,
            isTodayWorkDay,
            todayHolidayName,

            // שעות
            hoursWorkedThisMonth,
            monthlyQuota: quota.monthlyQuota,
            quotaForDaysPassed,
            hoursRemaining,
            avgHoursPerDay: quota.avgHoursPerDay,
            avgHoursPerRemainingDay,

            // אחוזים וסטטוס
            percentageOfQuota,
            percentageOfExpected,
            status,
            statusColor,

            // התראות
            alerts: this.generateAlerts(hoursWorkedThisMonth, quotaForDaysPassed, workDaysRemaining, hoursRemaining)
        };
    }

    /**
     * יוצר התראות מותאמות אישית
     */
    generateAlerts(hoursWorked, quotaExpected, daysRemaining, hoursRemaining) {
        const alerts = [];

        // פיגור משמעותי
        if (hoursWorked < quotaExpected * 0.7 && daysRemaining < 10) {
            alerts.push({
                type: 'warning',
                message: `יש פיגור של ${Math.round((quotaExpected - hoursWorked) * 10) / 10} שעות לעומת הצפוי`,
                icon: '⚠️'
            });
        }

        // נדרשות הרבה שעות ביום
        if (daysRemaining > 0 && hoursRemaining / daysRemaining > 10) {
            alerts.push({
                type: 'urgent',
                message: `נדרש ממוצע של ${Math.round((hoursRemaining / daysRemaining) * 10) / 10} שעות ביום!`,
                icon: '🔥'
            });
        }

        // הכל טוב
        if (hoursWorked >= quotaExpected && daysRemaining > 5) {
            alerts.push({
                type: 'success',
                message: 'מצוין! אתה בקצב מעולה',
                icon: '🎉'
            });
        }

        return alerts;
    }

    /**
     * מחזיר שם חודש בעברית
     */
    getMonthName(month) {
        const months = [
            'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
            'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
        ];
        return months[month];
    }

    /**
     * יוצר דוח מפורט בפורמט טקסט
     */
    generateReport(timesheetEntries = []) {
        const status = this.calculateCurrentStatus(timesheetEntries);

        return `
📊 סיכום שעות ${status.monthName} ${status.year}

🗓️ ימי עבודה:
• עברו: ${status.workDaysPassed} ימים
• נותרו: ${status.workDaysRemaining} ימים
• סה"כ בחודש: ${status.workDaysTotal} ימים

⏰ שעות:
• דווחו: ${status.hoursWorkedThisMonth} שעות
• מכסה חודשית: ${status.monthlyQuota} שעות
• צפי עד כה: ${status.quotaForDaysPassed} שעות
• נותר: ${status.hoursRemaining} שעות

📈 התקדמות:
• ${status.percentageOfQuota}% מהמכסה החודשית
• ${status.percentageOfExpected}% מהצפוי עד כה
• ממוצע נדרש ליום נותר: ${status.avgHoursPerRemainingDay} שעות

${status.alerts.map(a => `${a.icon} ${a.message}`).join('\n')}

סטטוס: ${status.status}
        `.trim();
    }
}

// יצוא
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkHoursCalculator;
}

// הנגש גלובלית
window.WorkHoursCalculator = WorkHoursCalculator;
