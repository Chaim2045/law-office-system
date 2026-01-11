/**
 * מחשבון שעות עבודה חכם
 * מחשב מכסת שעות חודשית מדויקת לפי לוח שנה ישראלי
 * מדד: 186 שעות/חודש ממוצע (או תקן אישי לפי עובד)
 */

class WorkHoursCalculator {
    constructor(dailyHoursTarget = null) {
        // תקן שעות יומי (ברירת מחדל: 8.45 שעות/יום)
        // אם מועבר תקן אישי - משתמש בו, אחרת 8.45
        this.DAILY_HOURS_TARGET = dailyHoursTarget || 8.45;

        // מדד שעות חודשי ממוצע (למען תאימות לאחור)
        this.MONTHLY_HOURS_TARGET = 186;

        // חגים ישראליים 2025 (תאריכים גרגוריאניים)
        this.holidays2025 = [
            // ראש השנה
            { name: 'ראש השנה', start: new Date(2025, 8, 23), end: new Date(2025, 8, 24) }, // 23-24 ספטמבר

            // יום כיפור
            { name: 'יום כיפור', start: new Date(2025, 9, 2), end: new Date(2025, 9, 2) }, // 2 אוקטובר

            // סוכות
            { name: 'סוכות', start: new Date(2025, 9, 7), end: new Date(2025, 9, 8) }, // 7-8 אוקטובר
            { name: 'שמחת תורה', start: new Date(2025, 9, 14), end: new Date(2025, 9, 14) }, // 14 אוקטובר

            // חנוכה (לא חג רשמי, אבל כאן לידע)

            // פורים
            { name: 'פורים', start: new Date(2025, 2, 14), end: new Date(2025, 2, 14) }, // 14 מרץ

            // פסח
            { name: 'פסח', start: new Date(2025, 3, 13), end: new Date(2025, 3, 14) }, // 13-14 אפריל
            { name: 'פסח (ז׳ חג)', start: new Date(2025, 3, 19), end: new Date(2025, 3, 20) }, // 19-20 אפריל

            // יום העצמאות
            { name: 'יום הזיכרון', start: new Date(2025, 4, 1), end: new Date(2025, 4, 1) }, // 1 מאי
            { name: 'יום העצמאות', start: new Date(2025, 4, 2), end: new Date(2025, 4, 2) }, // 2 מאי

            // שבועות
            { name: 'שבועות', start: new Date(2025, 5, 2), end: new Date(2025, 5, 2) }, // 2 יוני

            // תשעה באב (לא חג רשמי אבל חלק מהמקומות לא עובדים)
            { name: 'תשעה באב', start: new Date(2025, 7, 3), end: new Date(2025, 7, 3) } // 3 אוגוסט
        ];

        // חגים 2024 (למי שצריך)
        this.holidays2024 = [
            { name: 'ראש השנה', start: new Date(2024, 9, 3), end: new Date(2024, 9, 4) },
            { name: 'יום כיפור', start: new Date(2024, 9, 12), end: new Date(2024, 9, 12) },
            { name: 'סוכות', start: new Date(2024, 9, 17), end: new Date(2024, 9, 18) },
            { name: 'שמחת תורה', start: new Date(2024, 9, 24), end: new Date(2024, 9, 24) },
            { name: 'פורים', start: new Date(2024, 2, 24), end: new Date(2024, 2, 24) },
            { name: 'פסח', start: new Date(2024, 3, 23), end: new Date(2024, 3, 24) },
            { name: 'פסח (ז׳ חג)', start: new Date(2024, 3, 29), end: new Date(2024, 3, 30) },
            { name: 'יום הזיכרון', start: new Date(2024, 4, 13), end: new Date(2024, 4, 13) },
            { name: 'יום העצמאות', start: new Date(2024, 4, 14), end: new Date(2024, 4, 14) },
            { name: 'שבועות', start: new Date(2024, 5, 12), end: new Date(2024, 5, 12) },
            { name: 'תשעה באב', start: new Date(2024, 7, 13), end: new Date(2024, 7, 13) }
        ];

        // חגים 2026 (למי שצריך)
        this.holidays2026 = [
            { name: 'ראש השנה', start: new Date(2026, 8, 12), end: new Date(2026, 8, 13) },
            { name: 'יום כיפור', start: new Date(2026, 8, 21), end: new Date(2026, 8, 21) },
            { name: 'סוכות', start: new Date(2026, 8, 26), end: new Date(2026, 8, 27) },
            { name: 'שמחת תורה', start: new Date(2026, 9, 3), end: new Date(2026, 9, 3) },
            { name: 'פורים', start: new Date(2026, 2, 3), end: new Date(2026, 2, 3) },
            { name: 'פסח', start: new Date(2026, 3, 2), end: new Date(2026, 3, 3) },
            { name: 'פסח (ז׳ חג)', start: new Date(2026, 3, 8), end: new Date(2026, 3, 9) },
            { name: 'יום הזיכרון', start: new Date(2026, 3, 21), end: new Date(2026, 3, 21) },
            { name: 'יום העצמאות', start: new Date(2026, 3, 22), end: new Date(2026, 3, 22) },
            { name: 'שבועות', start: new Date(2026, 4, 22), end: new Date(2026, 4, 22) },
            { name: 'תשעה באב', start: new Date(2026, 6, 23), end: new Date(2026, 6, 23) }
        ];

        this.allHolidays = [...this.holidays2024, ...this.holidays2025, ...this.holidays2026];
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
     * בודק אם תאריך הוא חג
     * @param {Date} date - התאריך לבדיקה
     * @returns {boolean} - האם זה חג
     */
    isHoliday(date) {
        const dateStr = this.dateToString(date);

        for (const holiday of this.allHolidays) {
            const startStr = this.dateToString(holiday.start);
            const endStr = this.dateToString(holiday.end);

            if (dateStr >= startStr && dateStr <= endStr) {
                return true;
            }
        }

        return false;
    }

    /**
     * מחזיר את שם החג (אם זה חג)
     * @param {Date} date - התאריך לבדיקה
     * @returns {string|null} - שם החג או null
     */
    getHolidayName(date) {
        const dateStr = this.dateToString(date);

        for (const holiday of this.allHolidays) {
            const startStr = this.dateToString(holiday.start);
            const endStr = this.dateToString(holiday.end);

            if (dateStr >= startStr && dateStr <= endStr) {
                return holiday.name;
            }
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
            isCustomTarget: this.DAILY_HOURS_TARGET !== 8.45 // האם זה תקן אישי
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
