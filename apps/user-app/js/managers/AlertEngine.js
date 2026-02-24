/**
 * AlertEngine
 * מנוע התראות חכם - מחשב אוטומטית התראות על עובדים
 *
 * Created: 2025-12-01
 * Phase: Managers Layer
 *
 * זה המנוע שמזהה בעיות ויוצר התראות למנהל
 */

(function() {
    'use strict';

    class AlertEngine {
        constructor() {
            this.rules = [];
            this.cache = new Map(); // Cache alerts for performance
            this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

            this._initializeRules();
        }

        /**
         * Initialize alert rules
         * כל rule הוא פונקציה שבודקת תנאי ומחזירה Alert או null
         */
        _initializeRules() {
            this.rules = [
                this._missingHoursRule.bind(this),
                this._insufficientHoursRule.bind(this), // ✅ New rule!
                this._overdueTasksRule.bind(this),
                this._inactiveUserRule.bind(this),
                this._noActivityRule.bind(this),
                this._incompleteProfileRule.bind(this)
            ];
        }

        /**
         * Calculate all alerts for a user
         * @param {Object} userData - Full user data from backend
         * @returns {Array<Alert>} - Array of alerts
         */
        calculateAlerts(userData) {
            if (!userData || !userData.uid) {
                console.warn('⚠️ AlertEngine: Invalid user data');
                return [];
            }

            console.log(`🔍 AlertEngine: Calculating alerts for user ${userData.uid}`);

            // Check cache
            const cacheKey = this._getCacheKey(userData.uid);
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                console.log('✅ AlertEngine: Returning cached alerts');
                return cached.alerts;
            }

            const alerts = [];

            // Run all rules
            for (const rule of this.rules) {
                try {
                    const alert = rule(userData);
                    if (alert) {
                        alerts.push(alert);
                    }
                } catch (error) {
                    console.error('❌ AlertEngine: Rule failed:', error);
                    // Continue with other rules
                }
            }

            // Sort by severity (critical first)
            alerts.sort((a, b) => {
                const severityOrder = {
                    [ALERT_SEVERITY.CRITICAL]: 0,
                    [ALERT_SEVERITY.WARNING]: 1,
                    [ALERT_SEVERITY.INFO]: 2
                };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });

            // Cache results
            this.cache.set(cacheKey, {
                alerts,
                timestamp: Date.now()
            });

            console.log(`✅ AlertEngine: Found ${alerts.length} alerts`);
            return alerts;
        }

        /**
         * Rule: Missing hours report
         * בדיקה: לא דיווח שעות
         */
        _missingHoursRule(userData) {
            const lastTimesheetDate = this._getLastTimesheetDate(userData);

            if (!lastTimesheetDate) {
                // Never reported hours
                return new Alert({
                    type: ALERT_TYPES.MISSING_HOURS,
                    severity: ALERT_SEVERITY.CRITICAL,
                    userId: userData.uid,
                    title: 'לא דיווח שעות מעולם',
                    description: 'העובד לא דיווח שעות אף פעם',
                    icon: ALERT_ICONS[ALERT_TYPES.MISSING_HOURS],
                    actionable: true,
                    actions: [
                        {
                            type: 'send_reminder',
                            label: 'שלח תזכורת',
                            template: 'missing_hours_never'
                        },
                        {
                            type: 'create_thread',
                            label: 'פתח דיון',
                            threadTitle: `דיווח שעות - ${userData.displayName || userData.email}`
                        }
                    ],
                    contextData: {
                        type: 'missing_hours',
                        days: null,
                        lastReportDate: null,
                        neverReported: true
                    }
                });
            }

            const daysSince = DateUtils.getDaysBetween(lastTimesheetDate, new Date());

            if (daysSince >= 3) {
                return new Alert({
                    type: ALERT_TYPES.MISSING_HOURS,
                    severity: daysSince >= 7 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
                    userId: userData.uid,
                    title: 'לא דיווח שעות',
                    description: `${daysSince} ימים ללא דיווח שעות`,
                    icon: ALERT_ICONS[ALERT_TYPES.MISSING_HOURS],
                    actionable: true,
                    actions: [
                        {
                            type: 'send_reminder',
                            label: 'שלח תזכורת',
                            template: 'missing_hours',
                            templateData: { days: daysSince }
                        },
                        {
                            type: 'create_thread',
                            label: 'פתח דיון',
                            threadTitle: `דיווח שעות - ${userData.displayName || userData.email}`
                        }
                    ],
                    contextData: {
                        type: 'missing_hours',
                        days: daysSince,
                        lastReportDate: lastTimesheetDate,
                        neverReported: false
                    }
                });
            }

            return null;
        }

        /**
         * Rule: Overdue tasks
         * בדיקה: משימות באיחור
         */
        _overdueTasksRule(userData) {
            const tasks = userData.tasks || [];

            const overdueTasks = tasks.filter(task => {
                if (task.status === 'completed' || task.status === 'cancelled') {
                    return false;
                }
                if (!task.dueDate) {
                    return false;
                }

                const dueDate = new Date(task.dueDate);
                return dueDate < new Date();
            });

            if (overdueTasks.length === 0) {
                return null;
            }

            return new Alert({
                type: ALERT_TYPES.OVERDUE_TASKS,
                severity: overdueTasks.length >= 5 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
                userId: userData.uid,
                title: 'משימות באיחור',
                description: `${overdueTasks.length} משימות שעברו את מועד היעד`,
                icon: ALERT_ICONS[ALERT_TYPES.OVERDUE_TASKS],
                actionable: true,
                actions: [
                    {
                        type: 'send_reminder',
                        label: 'שלח תזכורת',
                        template: 'overdue_tasks',
                        templateData: {
                            count: overdueTasks.length,
                            tasks: overdueTasks.slice(0, 3)
                        }
                    },
                    {
                        type: 'view_tasks',
                        label: 'צפה במשימות'
                    }
                ],
                contextData: {
                    type: 'overdue_tasks',
                    taskIds: overdueTasks.map(t => t.id),
                    count: overdueTasks.length,
                    tasks: overdueTasks
                }
            });
        }

        /**
         * Rule: Inactive user
         * בדיקה: משתמש לא פעיל (לא התחבר)
         */
        _inactiveUserRule(userData) {
            if (!userData.lastLogin) {
                return null;
            }

            const lastLogin = new Date(userData.lastLogin);
            const daysSinceLogin = DateUtils.getDaysBetween(lastLogin, new Date());

            if (daysSinceLogin >= 7) {
                return new Alert({
                    type: ALERT_TYPES.INACTIVE_USER,
                    severity: daysSinceLogin >= 14 ? ALERT_SEVERITY.WARNING : ALERT_SEVERITY.INFO,
                    userId: userData.uid,
                    title: 'משתמש לא פעיל',
                    description: `לא התחבר למערכת ${daysSinceLogin} ימים`,
                    icon: ALERT_ICONS[ALERT_TYPES.INACTIVE_USER],
                    actionable: true,
                    actions: [
                        {
                            type: 'send_message',
                            label: 'שלח הודעה',
                            template: 'inactive_user',
                            templateData: { days: daysSinceLogin }
                        }
                    ],
                    contextData: {
                        type: 'inactive_user',
                        days: daysSinceLogin,
                        lastLoginDate: lastLogin
                    }
                });
            }

            return null;
        }

        /**
         * Rule: No activity
         * בדיקה: אין פעילות כלל (לא שעות, לא משימות)
         */
        _noActivityRule(userData) {
            const hasTimesheet = userData.timesheet && userData.timesheet.length > 0;
            const hasTasks = userData.tasks && userData.tasks.length > 0;
            const hasClients = userData.clients && userData.clients.length > 0;

            if (!hasTimesheet && !hasTasks && !hasClients) {
                return new Alert({
                    type: ALERT_TYPES.NO_ACTIVITY,
                    severity: ALERT_SEVERITY.WARNING,
                    userId: userData.uid,
                    title: 'אין פעילות',
                    description: 'העובד לא רשום על שום דבר (לא שעות, לא משימות, לא לקוחות)',
                    icon: ALERT_ICONS[ALERT_TYPES.NO_ACTIVITY],
                    actionable: true,
                    actions: [
                        {
                            type: 'send_message',
                            label: 'שלח הודעה',
                            template: 'no_activity'
                        },
                        {
                            type: 'assign_tasks',
                            label: 'הקצה משימות'
                        }
                    ],
                    contextData: {
                        type: 'no_activity'
                    }
                });
            }

            return null;
        }

        /**
         * Rule: Incomplete profile
         * בדיקה: פרופיל לא מלא
         */
        _incompleteProfileRule(userData) {
            const missingFields = [];

            if (!userData.displayName || userData.displayName.trim() === '') {
                missingFields.push('שם מלא');
            }
            if (!userData.phone) {
                missingFields.push('טלפון');
            }
            if (!userData.role || userData.role === 'employee') {
                missingFields.push('תפקיד');
            }

            if (missingFields.length > 0) {
                return new Alert({
                    type: ALERT_TYPES.INCOMPLETE_PROFILE,
                    severity: ALERT_SEVERITY.INFO,
                    userId: userData.uid,
                    title: 'פרופיל לא מלא',
                    description: `חסרים שדות: ${missingFields.join(', ')}`,
                    icon: ALERT_ICONS[ALERT_TYPES.INCOMPLETE_PROFILE],
                    actionable: true,
                    actions: [
                        {
                            type: 'edit_profile',
                            label: 'ערוך פרופיל'
                        }
                    ],
                    contextData: {
                        type: 'incomplete_profile',
                        missingFields
                    }
                });
            }

            return null;
        }

        /**
         * Rule: Insufficient hours (below expected daily hours standard)
         * בדיקה: חוסר בשעות לפי שעות התקן היומיות של העובד
         */
        _insufficientHoursRule(userData) {
            // Get expected daily hours (default: 8)
            const expectedDailyHours = parseFloat(userData.expectedDailyHours) || 8;

            // Get timesheet entries for current month
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const timesheet = userData.timesheet || userData.hours || [];

            // Calculate hours worked this month
            let hoursWorkedThisMonth = 0;
            timesheet.forEach(entry => {
                const entryDate = new Date(entry.date || entry.createdAt);
                if (entryDate >= monthStart && entryDate <= now) {
                    hoursWorkedThisMonth += (entry.minutes || 0) / 60;
                }
            });

            // Calculate work days passed this month (excluding weekends and holidays)
            // Using WorkHoursCalculator for accurate calculation including Israeli holidays
            // CRITICAL: Must use existing instance - fail fast if unavailable
            const calculator = this.workHoursCalculator || window.WorkHoursCalculatorInstance;

            if (!calculator) {
                throw new Error('WORKHOURS_MISSING: WorkHoursCalculator unavailable');
            }

            const workDaysPassed = calculator.getWorkDaysPassedThisMonth();

            // Calculate expected hours for days passed
            const expectedHoursForDaysPassed = workDaysPassed * expectedDailyHours;

            // Calculate deficit
            const hoursDeficit = expectedHoursForDaysPassed - hoursWorkedThisMonth;

            // Alert if deficit is significant (more than 20% behind)
            if (hoursDeficit > expectedDailyHours * 2 && workDaysPassed > 5) {
                const deficitDays = Math.floor(hoursDeficit / expectedDailyHours);

                return new Alert({
                    type: ALERT_TYPES.INSUFFICIENT_HOURS,
                    severity: hoursDeficit > expectedDailyHours * 4 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
                    userId: userData.uid,
                    title: 'חוסר בדיווח שעות',
                    description: `חסרות ${hoursDeficit.toFixed(1)} שעות (כ-${deficitDays} ימי עבודה) מול שעות התקן (${expectedDailyHours} שעות/יום)`,
                    icon: ALERT_ICONS[ALERT_TYPES.INSUFFICIENT_HOURS] || ALERT_ICONS[ALERT_TYPES.MISSING_HOURS],
                    actionable: true,
                    actions: [
                        {
                            type: 'send_reminder',
                            label: 'שלח תזכורת',
                            template: 'insufficient_hours',
                            templateData: {
                                hoursDeficit: hoursDeficit.toFixed(1),
                                daysDeficit: deficitDays,
                                expectedDailyHours,
                                hoursWorked: hoursWorkedThisMonth.toFixed(1),
                                expectedHours: expectedHoursForDaysPassed.toFixed(1)
                            }
                        },
                        {
                            type: 'view_tasks',
                            label: 'צפה בדיווחים'
                        }
                    ],
                    contextData: {
                        type: 'insufficient_hours',
                        hoursDeficit: hoursDeficit.toFixed(1),
                        hoursWorked: hoursWorkedThisMonth.toFixed(1),
                        expectedHours: expectedHoursForDaysPassed.toFixed(1),
                        workDaysPassed,
                        expectedDailyHours
                    }
                });
            }

            return null;
        }

        /**
         * Get message template
         */
        getMessageTemplate(templateName, templateData = {}) {
            const templates = {
                missing_hours: (data) => `היי,

שמתי לב שלא דיווחת שעות מזה ${data.days} ימים.
אנא עדכן את השעות במערכת בהקדם האפשרי.

תודה,
${window.firebaseAuth?.currentUser?.displayName || 'המנהל'}`,

                missing_hours_never: () => `היי,

שמתי לב שעדיין לא דיווחת שעות במערכת.
אנא התחל לדווח על השעות שלך החל מהיום.

תודה,
${window.firebaseAuth?.currentUser?.displayName || 'המנהל'}`,

                overdue_tasks: (data) => `היי,

יש לך ${data.count} משימות שעברו את מועד היעד:
${data.tasks.map((t, i) => `${i + 1}. ${t.title || t.name}`).join('\n')}

אנא טפל בהן בהקדם.

תודה,
${window.firebaseAuth?.currentUser?.displayName || 'המנהל'}`,

                inactive_user: (data) => `היי,

שמתי לב שלא התחברת למערכת ${data.days} ימים.
האם הכל בסדר? נשמח לעדכון.

תודה,
${window.firebaseAuth?.currentUser?.displayName || 'המנהל'}`,

                no_activity: () => `היי,

שמתי לב שאין לך פעילות במערכת.
בואו נדבר על זה - יש משהו שאתה צריך?

תודה,
${window.firebaseAuth?.currentUser?.displayName || 'המנהל'}`,

                insufficient_hours: (data) => `היי,

שמתי לב שיש חוסר בדיווח השעות שלך החודש.

📊 **סיכום:**
• דיווחת: ${data.hoursWorked} שעות
• צפוי עד כה: ${data.expectedHours} שעות (לפי ${data.expectedDailyHours} שעות ליום)
• **חסר: ${data.hoursDeficit} שעות** (כ-${data.daysDeficit} ימי עבודה)

אנא עדכן את דיווחי השעות שלך בהקדם כדי לשמור על המעקב המדויק.

תודה,
${window.firebaseAuth?.currentUser?.displayName || 'המנהל'}`
            };

            const template = templates[templateName];
            return template ? template(templateData) : '';
        }

        /**
         * Clear cache
         */
        clearCache(userId = null) {
            if (userId) {
                const cacheKey = this._getCacheKey(userId);
                this.cache.delete(cacheKey);
            } else {
                this.cache.clear();
            }
        }

        /**
         * Helper: Get cache key
         */
        _getCacheKey(userId) {
            return `alerts_${userId}`;
        }

        /**
         * Helper: Get last timesheet date
         */
        _getLastTimesheetDate(userData) {
            const timesheet = userData.timesheet || userData.hours || [];

            if (timesheet.length === 0) {
                return null;
            }

            // Sort by date (newest first)
            const sorted = [...timesheet].sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt);
                const dateB = new Date(b.date || b.createdAt);
                return dateB - dateA;
            });

            return new Date(sorted[0].date || sorted[0].createdAt);
        }
    }

    // Make available globally
    window.AlertEngine = AlertEngine;

    // Auto-initialize singleton
    if (!window.alertEngine) {
        window.alertEngine = new AlertEngine();
        console.log('✅ AlertEngine initialized');
    }

})();
