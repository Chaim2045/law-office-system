/**
 * Workload Calculator - מנוע חישוב עומס עבודה
 *
 * תפקיד: חישוב מדדי עומס עבודה מנתונים גולמיים
 * אין תלות ב-Firestore או ספריות חיצוניות - רק חישובים מתמטיים טהורים
 *
 * נוצר: 2025-12-30
 * גרסה: 5.1.0 - Single Source of Truth for Workdays
 *
 * שינויים בגרסה 5.1.0 (2026-01-04):
 * ✅ Single source of truth: WorkHoursCalculator delegated for all workday counting
 * ✅ Holiday deduction now working correctly (was TODO before)
 * ✅ Dependency injection: WorkHoursCalculator passed via constructor
 *
 * שינויים בגרסה 5.0.0 (2026-01-03):
 * ✅ מודול איכות נתונים (Data Quality) - זיהוי עובדים שלא ממלאים timesheet
 * ✅ חישוב קיבולת אפקטיבית (Effective Capacity) - תקן אמיתי עם הפסקות ומרחב אישי
 * ✅ עומס משוקלל (Weighted Backlog) - משקל לפי דחיפות (overdue ×3, <24h ×2.5)
 * ✅ זיהוי משימות תקועות (Stale Tasks) - משימות שלא עודכנו 7+ ימים
 * ✅ התראות חכמות (Smart Alerts) - התראות קונטקסטואליות לפי דפוסי נתונים
 * ✅ תיקון NaN bug - גארדים למניעת חלוקה באפס
 *
 * שינויים בגרסה 4.0.0:
 * ✅ ריכוז כל ה-Magic Numbers ב-WorkloadConstants.js
 * ✅ שימוש ב-helper functions למקרי קצה
 * ✅ קוד נקי יותר, קל לתחזוקה
 * ✅ תיקון משתנים לא בשימוש
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 מדריך למנהלים: הבנת נתוני העומס ומקורותיהם
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## מקורות הנתונים (Data Sources)
 *
 * כל החישובים מבוססים על 4 שדות עיקריים במסד הנתונים:
 *
 * 1. **estimatedMinutes** - תקציב שעות למשימה (הערכה ראשונית)
 * 2. **actualMinutes** - שעות שהעובד דיווח שעבד (זמן בפועל)
 * 3. **deadline** - תאריך יעד לסיום המשימה
 * 4. **status** - סטטוס המשימה ('פעיל', 'הושלם', וכו')
 *
 * ## 🎯 חישוב חכם של שעות נותרות (v2.1.2)
 *
 * **נוסחה**: `remainingMinutes = estimatedMinutes - actualMinutes`
 *
 * **דוגמה מעשית**:
 * - משימה מתוקצבת ל-5 שעות (300 דקות)
 * - העובד דיווח 4 שעות (240 דקות)
 * - **שעות נותרות**: 300 - 240 = 60 דקות (שעה אחת) ✅
 *
 * המערכת מחשבת בדיוק כמה עבודה נותרה לכל משימה ומפזרת אותה על הימים עד deadline!
 *
 * ## חישובי איכות ניהול משימות (v2.1.2)
 *
 * ### 1. משימות שצריכות להיסגר (shouldBeClosed)
 * **תנאי**: actualMinutes / estimatedMinutes >= 80% **וגם** deadline < היום
 * **משמעות**: העובד ניצל 80%+ מהתקציב והדדליין עבר - כנראה המשימה הסתיימה
 * **פעולה**: בדוק עם העובד למה המשימה לא נסגרה
 *
 * ### 2. משימות ללא עדכון שעות (missingTimeTracking)
 * **תנאי**: actualMinutes === 0
 * **משמעות**: העובד לא דיווח שעות כלל - הנתונים לא מדויקים
 * **פעולה**: בקש מהעובד לעדכן שעות עבודה
 * **⚠️ השפעה**: העומס המחושב עשוי להיות גבוה מהמציאות!
 *
 * ### 3. משימות קרובות לסיום (nearComplete)
 * **תנאי**: actualMinutes / estimatedMinutes >= 90%
 * **משמעות**: נותרו פחות מ-10% מהתקציב - המשימה כמעט הושלמה
 * **פעולה**: ניתן לסגור בקרוב
 *
 * ### 3.5. 🆕 משימות כמעט גמורות (almostDone)
 * **תנאי**: actualMinutes / estimatedMinutes >= 95% **וגם** remainingMinutes <= 60
 * **משמעות**: נותרה פחות משעה בלבד! המשימה צריכה להיסגר עכשיו
 * **פעולה**: **בקש מהעובד לסיים ולסגור מיד!**
 * **דוגמה**: משימה עם 5h, בוצעו 4h → נותרה 1h → **הפקד על סגירה מיד בסיום!**
 *
 * ### 4. משימות stale (ישנות)
 * **תנאי**: createdAt > 30 ימים **וגם** actualMinutes === 0
 * **משמעות**: המשימה פתוחה למעלה מחודש ללא כל עבודה
 * **פעולה**: בדוק אם המשימה עדיין רלוונטית
 *
 * ## הבנת "עומס יומי מקסימלי: 34.8h (פי 4!)"
 *
 * ### מה זה אומר?
 * - **תקן יומי**: 8.45 שעות (או תקן מותאם אישית לעובד)
 * - **עומס יומי מקסימלי**: 34.8 שעות
 * - **פי 4**: 34.8 / 8.45 = 4
 *
 * ### איך זה מחושב?
 * המערכת מפזרת את השעות הנותרות של כל משימה באופן שווה על הימים עד תאריך היעד:
 *
 * דוגמה:
 * - משימה A: 40 שעות נותרות, deadline בעוד 10 ימים → 4h ליום
 * - משימה B: 15 שעות נותרות, deadline בעוד 5 ימים → 3h ליום
 * - משימה C: 20 שעות נותרות, deadline בעוד 2 ימים → 10h ליום
 * - **יום השיא**: אם כל 3 המשימות חופפות ליום מחר → 4 + 3 + 10 = 17h
 *
 * ### ⚠️ האם זה תמיד אומר עומס יתר?
 * **לא בהכרח!** יכול להיות:
 *
 * ✅ **עומס אמיתי** - העובד באמת צריך לעבוד 34 שעות ביום אחד
 * ❌ **בעיות איכות נתונים**:
 *    - משימות שהסתיימו אבל לא נסגרו (status לא עודכן)
 *    - שעות שלא דווחו (actualMinutes לא עודכן)
 *    - דדליינים שלא עודכנו
 *
 * 👉 **לכן** - תסתכל על "איכות ניהול משימות" כדי להבין את הסיבה האמיתית!
 *
 * ## דוגמה מעשית
 *
 * עובד עם 6 משימות פתוחות, עומס יומי של 34.8h (פי 4):
 *
 * **תרחיש 1: עומס אמיתי**
 * - איכות נתונים: ✅ הכל תקין
 * - פעולה: הקצה משימות לעובדים אחרים / דחה דדליינים
 *
 * **תרחיש 2: בעיית נתונים**
 * - איכות נתונים:
 *   - 4 משימות צריכות להיסגר (80%+ הושלמו)
 *   - 3 משימות ללא עדכון שעות
 * - פעולה: בקש מהעובד לעדכן משימות ושעות
 * - תוצאה: העומס יירד באופן דרמטי לאחר העדכון!
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    /**
     * WorkloadCalculator Class
     * מחשבון עומס עבודה
     */
    class WorkloadCalculator {
        constructor(workHoursCalculator = null) {
            // ✅ v4.0.0: קבועים הועברו ל-WorkloadConstants.js
            // טוען קבועים מקובץ ריכוזי
            if (!window.WorkloadConstants) {
                console.error('❌ WorkloadConstants not loaded! Load WorkloadConstants.js before WorkloadCalculator.js');
                throw new Error('WorkloadConstants is required');
            }

            this.constants = window.WorkloadConstants;

            // 🔧 FIX v5.3: Normalize weights and validate sum
            const rawWeights = this.constants.SCORE_WEIGHTS;
            const weightsSum = rawWeights.BACKLOG + rawWeights.URGENCY + rawWeights.TASK_COUNT + rawWeights.CAPACITY;

            // Validate weights sum to 1.0 (with tolerance for floating point)
            if (Math.abs(weightsSum - 1.0) > 0.001) {
                console.warn('⚠️ WorkloadCalculator: SCORE_WEIGHTS sum is', weightsSum, 'not 1.0. Normalizing weights.');
                this.WEIGHTS = {
                    backlog: rawWeights.BACKLOG / weightsSum,
                    urgency: rawWeights.URGENCY / weightsSum,
                    taskCount: rawWeights.TASK_COUNT / weightsSum,
                    capacity: rawWeights.CAPACITY / weightsSum
                };
            } else {
                // Map UPPERCASE to camelCase for consistency
                this.WEIGHTS = {
                    backlog: rawWeights.BACKLOG,
                    urgency: rawWeights.URGENCY,
                    taskCount: rawWeights.TASK_COUNT,
                    capacity: rawWeights.CAPACITY
                };
            }

            this.DEFAULT_DAILY_HOURS = this.constants.WORK_HOURS.DEFAULT_DAILY_HOURS;
            this.DEFAULT_WEEKLY_HOURS = this.constants.WORK_HOURS.DEFAULT_WEEKLY_HOURS;

            // ✅ v5.1.0: Single source of truth for workday counting
            // WorkHoursCalculator handles holidays + weekends
            this.workHoursCalculator = workHoursCalculator;
            if (!this.workHoursCalculator) {
                console.warn('⚠️ WorkloadCalculator: No WorkHoursCalculator provided, creating default instance');
                // Fallback: create a default instance if WorkHoursCalculator is available globally
                if (window.WorkHoursCalculator) {
                    this.workHoursCalculator = new window.WorkHoursCalculator();
                }
            }
        }

        /**
         * חישוב מדדי עומס מלאים לעובד
         * @param {Object} employee - נתוני העובד
         * @param {Array} tasks - רשימת המשימות הפעילות
         * @param {Array} timesheetEntries - רשימת רישומי זמן
         * @returns {Object} - מדדי עומס מלאים
         */
        calculateWorkload(employee, tasks, timesheetEntries) {
            const now = new Date();

            // 🐛 DEBUG: Log inputs for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && tasks.length > 0 && !window._workloadDebugLogged) {
                console.log('🐛 [WORKLOAD DEBUG] Employee:', employee.email);
                console.log('🐛 [WORKLOAD DEBUG] Total tasks received:', tasks.length);
                console.log('🐛 [WORKLOAD DEBUG] First 3 tasks:', tasks.slice(0, 3).map(t => ({
                    status: t.status,
                    estimatedMinutes: t.estimatedMinutes,
                    actualMinutes: t.actualMinutes,
                    deadline: t.deadline,
                    remainingMinutes: (t.estimatedMinutes || 0) - (t.actualMinutes || 0)
                })));
                console.log('🐛 [WORKLOAD DEBUG] Timesheet entries count:', timesheetEntries.length);

                // 🐛 DEBUG: Detailed deadline inspection for first task
                const firstTask = tasks[0];
                if (firstTask) {
                    console.log('🐛 [TASK DEBUG]', {
                        employee: employee.email,
                        status: firstTask.status,
                        deadlineRaw: firstTask.deadline,
                        deadlineType: typeof firstTask.deadline,
                        estimatedMinutes: firstTask.estimatedMinutes,
                        actualMinutes: firstTask.actualMinutes
                    });
                }

                window._workloadDebugLogged = true; // Log only once
            }

            // ═══ חלק 1: מדדים בסיסיים ═══
            const basicMetrics = this.calculateBasicMetrics(tasks);

            // ═══ חלק 2: מדדי קיבולת ═══
            const capacityMetrics = this.calculateCapacityMetrics(
                employee,
                timesheetEntries,
                now
            );

            // ═══ חלק 3: ניתוח דחיפות ═══
            const urgencyMetrics = this.calculateUrgencyMetrics(tasks, now);

            // ═══ חלק 3.5: ניתוח עומס יומי (v2.0) ═══
            const dailyLoadAnalysis = this.calculateDailyLoadAnalysis(tasks, employee, now);

            // ═══ 🆕 v5.0: Smart Workload Modules ═══
            const effectiveCapacity = this.calculateEffectiveCapacity(employee);
            const weightedBacklog = this.calculateWeightedBacklog(tasks, effectiveCapacity.effective);
            const dataQuality = this.calculateDataQuality(employee, tasks, timesheetEntries);
            const staleTasks = this.detectStaleTasks(tasks);

            // ═══ חלק 4: ציון עומס משוקלל ═══
            const workloadScore = this.calculateWorkloadScore(
                basicMetrics,
                capacityMetrics,
                urgencyMetrics,
                employee
            );

            // ═══ חלק 5: חיזוי זמינות ═══
            const predictions = this.calculatePredictions(
                basicMetrics,
                capacityMetrics,
                employee,
                dailyLoadAnalysis
            );

            // ═══ v2.1.1: ניתוח איכות ניהול משימות ═══
            const taskQuality = this.analyzeTaskManagementQuality(tasks, now);

            // ═══ חלק 6: התראות חכמות (v5.0) ═══
            const alerts = this.generateSmartAlerts(
                employee,
                tasks,
                dataQuality,
                staleTasks,
                weightedBacklog
            );

            // ═══ חלק 7: משימות בסיכון ═══
            const riskyTasks = this.identifyRiskyTasks(tasks, now);

            // ═══ v2.1: פירוט מפורט של עומס יומי ═══
            const dailyBreakdown = this.calculateDailyTaskBreakdown(tasks, employee, now);

            // 🐛 DEBUG: Log final workload scores for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && tasks.length > 0 && !window._workloadScoreDebugLogged) {
                console.log('🐛 [WORKLOAD SCORE DEBUG]');
                console.log('  workloadScore:', workloadScore.score);
                console.log('  workloadLevel:', workloadScore.level);
                console.log('  maxDailyLoad:', dailyLoadAnalysis.maxDailyLoad);
                console.log('  dailyBreakdown.peakDayLoad:', dailyBreakdown.peakDayLoad);
                console.log('  dailyBreakdown.peakMultiplier:', dailyBreakdown.peakMultiplier);
                window._workloadScoreDebugLogged = true;
            }

            return {
                // Metadata
                calculatedAt: now.toISOString(),
                employeeEmail: employee.email,
                version: '5.0.0',

                // 🆕 v5.0: Smart Workload Metrics
                dataQuality,
                effectiveCapacity,
                weightedBacklog,
                staleTasks,

                // Raw metrics
                ...basicMetrics,
                ...capacityMetrics,
                ...urgencyMetrics,

                // Daily Load Analysis (v2.0)
                ...dailyLoadAnalysis,

                // v2.1: Daily Breakdown (detailed task breakdown)
                dailyBreakdown,

                // v2.1.1: Task Management Quality
                taskQuality,

                // Composite score
                workloadScore: workloadScore.score,
                workloadLevel: workloadScore.level,
                workloadBreakdown: workloadScore.breakdown,

                // Predictions
                ...predictions,

                // Alerts & risks (v5.0: Smart Alerts)
                alerts,
                riskyTasks
            };
        }

        /**
         * חישוב מדדים בסיסיים
         */
        calculateBasicMetrics(tasks) {
            // ⚠️ IMPORTANT: tasks כבר מסוננות ב-WorkloadService (רק משימות שלא הושלמו)
            // לא צריך לסנן שוב - כל ה-tasks הן משימות פעילות
            const activeTasks = tasks; // כל המשימות שהתקבלו הן פעילות

            let totalEstimatedMinutes = 0;
            let totalActualMinutes = 0;
            const tasksByPriority = {
                urgent: 0,
                high: 0,
                medium: 0,
                low: 0
            };

            activeTasks.forEach(task => {
                totalEstimatedMinutes += task.estimatedMinutes || 0;
                totalActualMinutes += task.actualMinutes || 0;

                const priority = task.priority || 'medium';
                if (tasksByPriority.hasOwnProperty(priority)) {
                    tasksByPriority[priority]++;
                }
            });

            const totalBacklogMinutes = totalEstimatedMinutes - totalActualMinutes;

            return {
                activeTasksCount: activeTasks.length,
                totalEstimatedHours: this.minutesToHours(totalEstimatedMinutes),
                totalActualHours: this.minutesToHours(totalActualMinutes),
                totalBacklogHours: this.minutesToHours(totalBacklogMinutes),
                tasksByPriority
            };
        }

        /**
         * חישוב מדדי קיבולת
         */
        calculateCapacityMetrics(employee, timesheetEntries, now) {
            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;

            // שעות היום
            const todayStr = this.dateToString(now);
            const todayEntries = timesheetEntries.filter(e => e.date === todayStr);
            const hoursWorkedToday = this.sumMinutes(todayEntries) / 60;

            // שעות השבוע
            const startOfWeek = this.getStartOfWeek(now);
            const weekEntries = timesheetEntries.filter(e => {
                const entryDate = new Date(e.date);
                return entryDate >= startOfWeek && entryDate <= now;
            });
            const hoursWorkedThisWeek = this.sumMinutes(weekEntries) / 60;

            // שעות החודש
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEntries = timesheetEntries.filter(e => {
                const entryDate = new Date(e.date);
                return entryDate >= startOfMonth && entryDate <= now;
            });
            const hoursWorkedThisMonth = this.sumMinutes(monthEntries) / 60;

            // יעד חודשי (מבוסס על ימי עבודה)
            const workDaysThisMonth = this.getWorkDaysInMonth(now);
            const monthlyTarget = workDaysThisMonth * dailyTarget;

            // ספירת ימי עבודה שעברו החודש (לא כולל סופ"ש וחגים)
            const workDaysPassed = this.workHoursCalculator
                ? this.workHoursCalculator.getWorkDaysPassedThisMonth()
                : Math.floor(now.getDate() * 0.7); // fallback: ~70% of days are workdays

            // 🔧 FIX v5.2: Fair mid-month comparison - use workdays passed so far
            const monthlyTargetSoFar = workDaysPassed * dailyTarget;
            const monthlyUtil = monthlyTargetSoFar > 0
                ? this.roundTo((hoursWorkedThisMonth / monthlyTargetSoFar) * 100, 1)
                : 0;

            // 🆕 Metric 1: Reporting Consistency %
            // ספירת ימים ייחודיים עם דיווח timesheet
            const uniqueDatesReported = new Set(timesheetEntries.map(e => e.date)).size;

            const reportingConsistency = workDaysPassed > 0
                ? Math.min(100, this.roundTo((uniqueDatesReported / workDaysPassed) * 100, 1))
                : 0;

            // 🐛 DEBUG: Log reporting consistency calculation for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && !window._reportingDebugLogged) {
                console.log('🐛 [REPORTING CONSISTENCY DEBUG]');
                console.log('  uniqueDatesReported:', uniqueDatesReported);
                console.log('  workDaysPassed:', workDaysPassed);
                console.log('  reportingConsistency:', reportingConsistency);
                window._reportingDebugLogged = true;
            }

            return {
                dailyHoursTarget: this.roundTo(dailyTarget, 2),
                hoursWorkedToday: this.roundTo(hoursWorkedToday, 2),
                availableHoursToday: this.roundTo(dailyTarget - hoursWorkedToday, 2),
                hoursWorkedThisWeek: this.roundTo(hoursWorkedThisWeek, 2),
                hoursWorkedThisMonth: this.roundTo(hoursWorkedThisMonth, 2),
                monthlyTarget: this.roundTo(monthlyTarget, 2),
                monthlyTargetSoFar: this.roundTo(monthlyTargetSoFar, 2),  // 🆕 For fair comparison
                monthlyUtilization: monthlyUtil,
                workDaysThisMonth,
                reportingConsistency,  // 🆕 NEW METRIC
                reportingDays: uniqueDatesReported,  // 🆕 For UI subtext
                workDaysPassed  // 🆕 For UI subtext
            };
        }

        /**
         * ניתוח דחיפות
         */
        calculateUrgencyMetrics(tasks, now) {
            const activeTasks = tasks.filter(t => t.status === 'פעיל');

            let tasksWithin24h = 0;
            let tasksWithin3days = 0;
            let tasksWithin7days = 0;
            let overdueTasksCount = 0;

            activeTasks.forEach(task => {
                if (!task.deadline) {
return;
}

                const deadline = this.parseDeadline(task.deadline);
                if (!deadline) {
return;
}

                const daysUntil = (deadline - now) / (1000 * 60 * 60 * 24);

                // ✅ v4.0.0: שימוש ב-constants
                if (daysUntil < this.constants.URGENCY.WITHIN_24H_DAYS - 1) {
                    overdueTasksCount++;
                } else if (daysUntil <= this.constants.URGENCY.WITHIN_24H_DAYS) {
                    tasksWithin24h++;
                } else if (daysUntil <= this.constants.URGENCY.WITHIN_3DAYS) {
                    tasksWithin3days++;
                } else if (daysUntil <= this.constants.URGENCY.WITHIN_7DAYS) {
                    tasksWithin7days++;
                }
            });

            // חישוב ציון דחיפות (0-100)
            // ✅ v4.0.0: שימוש ב-constants
            const urgencyScore = Math.min(100,
                (overdueTasksCount * this.constants.URGENCY.OVERDUE_SCORE) +
                (tasksWithin24h * this.constants.URGENCY.WITHIN_24H_SCORE) +
                (tasksWithin3days * this.constants.URGENCY.WITHIN_3DAYS_SCORE) +
                (tasksWithin7days * this.constants.URGENCY.WITHIN_7DAYS_SCORE)
            );

            // 🆕 Metric 3: Overdue + DueSoon (critical tasks count)
            const overduePlusDueSoon = overdueTasksCount + tasksWithin3days;

            return {
                urgencyScore: Math.round(urgencyScore),
                tasksWithin24h,
                tasksWithin3days,
                tasksWithin7days,
                overdueTasksCount,
                overduePlusDueSoon  // 🆕 NEW METRIC
            };
        }

        /**
         * חישוב ציון עומס משוקלל (0-100)
         */
        calculateWorkloadScore(basicMetrics, capacityMetrics, urgencyMetrics, employee) {
            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;

            // 🐛 DEBUG: Log inputs for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && !window._workloadScoreInputsLogged) {
                console.log('🐛 [WORKLOAD SCORE INPUTS]');
                console.log('  activeTasksCount:', basicMetrics.activeTasksCount);
                console.log('  totalBacklogHours:', basicMetrics.totalBacklogHours);
                console.log('  urgencyScore:', urgencyMetrics.urgencyScore);
                console.log('  overdueTasksCount:', urgencyMetrics.overdueTasksCount);
                console.log('  tasksWithin3days:', urgencyMetrics.tasksWithin3days);
                console.log('  monthlyUtilization:', capacityMetrics.monthlyUtilization);
                console.log('  weights:', this.WEIGHTS);
                window._workloadScoreInputsLogged = true;
            }

            // נרמול backlog (7 ימי עבודה = 100%)
            // 🔧 FIX v5.0: מניעת NaN
            const maxBacklogHours = dailyTarget * this.constants.WORK_HOURS.MAX_BACKLOG_DAYS;
            const normalizedBacklog = maxBacklogHours > 0
                ? Math.min(100, (basicMetrics.totalBacklogHours / maxBacklogHours) * 100)
                : 0;

            // נרמול urgency (כבר 0-100)
            // 🔧 FIX v5.0: מניעת undefined
            const normalizedUrgency = urgencyMetrics.urgencyScore || 0;

            // נרמול task count (10 משימות = 100%)
            // ✅ v4.0.0: שימוש ב-constant
            const normalizedTaskCount = Math.min(100,
                (basicMetrics.activeTasksCount / this.constants.NORMALIZATION.MAX_TASK_COUNT) * 100
            );

            // נרמול capacity utilization (כבר באחוזים)
            // 🔧 FIX v5.0: טיפול ב-NaN
            const normalizedCapacity = isNaN(capacityMetrics.monthlyUtilization)
                ? 0
                : Math.min(100, capacityMetrics.monthlyUtilization);

            // 🐛 DEBUG: Log normalized components for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && !window._workloadScoreNormalizedLogged) {
                console.log('🐛 [WORKLOAD SCORE NORMALIZED]');
                console.log('  normalizedBacklog:', normalizedBacklog);
                console.log('  normalizedUrgency:', normalizedUrgency);
                console.log('  normalizedTaskCount:', normalizedTaskCount);
                console.log('  normalizedCapacity:', normalizedCapacity);
                window._workloadScoreNormalizedLogged = true;
            }

            // חישוב משוקלל
            // 🔧 FIX v5.3: Explicit component validation + NaN prevention
            const backlogComponent = (normalizedBacklog || 0) * this.WEIGHTS.backlog;
            const urgencyComponent = (normalizedUrgency || 0) * this.WEIGHTS.urgency;
            const taskCountComponent = (normalizedTaskCount || 0) * this.WEIGHTS.taskCount;
            const capacityComponent = (normalizedCapacity || 0) * this.WEIGHTS.capacity;

            const rawScore = backlogComponent + urgencyComponent + taskCountComponent + capacityComponent;

            // Ensure score is valid number in 0-100 range
            let score = Math.round(rawScore);
            if (isNaN(score) || score < 0) {
                console.warn('⚠️ WorkloadCalculator: Invalid score calculated, defaulting to 0. rawScore was:', rawScore);
                score = 0;
            } else if (score > 100) {
                score = 100; // Cap at 100
            }

            // 🔧 FIX v5.3: Sanity check - if there's workload but score is 0, warn
            const hasWorkload = basicMetrics.totalBacklogHours > 0 ||
                               basicMetrics.activeTasksCount > 0 ||
                               urgencyMetrics.urgencyScore > 0;
            if (hasWorkload && score === 0 && employee.email === 'haim@ghlawoffice.co.il') {
                console.warn('⚠️ WorkloadCalculator: Workload exists but score is 0. Check weights:', this.WEIGHTS);
            }

            // 🐛 DEBUG: Log final score calculation for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && !window._workloadScoreFinalLogged) {
                console.log('🐛 [WORKLOAD SCORE FINAL]');
                console.log('  rawScore (before rounding):', rawScore);
                console.log('  score (after rounding):', score);
                console.log('  component breakdown:', {
                    backlogComponent: backlogComponent.toFixed(2),
                    urgencyComponent: urgencyComponent.toFixed(2),
                    taskCountComponent: taskCountComponent.toFixed(2),
                    capacityComponent: capacityComponent.toFixed(2),
                    sum: rawScore.toFixed(2)
                });
                console.log('  weights used:', {
                    backlog: this.WEIGHTS.backlog,
                    urgency: this.WEIGHTS.urgency,
                    taskCount: this.WEIGHTS.taskCount,
                    capacity: this.WEIGHTS.capacity,
                    sum: (this.WEIGHTS.backlog + this.WEIGHTS.urgency + this.WEIGHTS.taskCount + this.WEIGHTS.capacity).toFixed(3)
                });
                window._workloadScoreFinalLogged = true;
            }

            // קביעת רמת עומס
            // ✅ v4.0.0: שימוש ב-constants במקום magic numbers
            const level = this.constants.getWorkloadLevel(score);

            return {
                score,
                level,
                breakdown: {
                    backlogScore: Math.round(backlogComponent),
                    urgencyScore: Math.round(urgencyComponent),
                    taskCountScore: Math.round(taskCountComponent),
                    capacityScore: Math.round(capacityComponent)
                }
            };
        }

        /**
         * חישוב חיזויים
         * @param {Object} basicMetrics - מדדים בסיסיים
         * @param {Object} capacityMetrics - מדדי קיבולת
         * @param {Object} employee - נתוני עובד
         * @param {Object} dailyLoadAnalysis - ניתוח עומס יומי (v2.0)
         */
        calculatePredictions(basicMetrics, _capacityMetrics, employee, dailyLoadAnalysis) {
            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;
            const backlogHours = basicMetrics.totalBacklogHours;

            // v2.0: משתמשים ב-totalAvailableHours האמיתי מניתוח יומי
            const availableHoursThisWeek = dailyLoadAnalysis.totalAvailableHours;
            const averageAvailablePerDay = dailyLoadAnalysis.averageAvailablePerDay;

            // כמה ימי עבודה נדרשים לסיום (לפי ממוצע זמינות יומי אמיתי)
            const estimatedDaysToComplete = averageAvailablePerDay > 0
                ? this.roundTo(backlogHours / averageAvailablePerDay, 1)
                : (backlogHours > 0 ? 999 : 0); // אם אין זמינות כלל, החזר מספר גדול

            // תאריך זמינות (מתי יסיים את כל המשימות)
            const today = new Date();
            const nextAvailableDate = new Date(today);
            nextAvailableDate.setDate(today.getDate() + Math.ceil(estimatedDaysToComplete));

            // האם יכול לקבל משימה חדשה? (יש לו זמינות השבוע)
            // ✅ v4.0.0: שימוש ב-constants
            const canTakeNewTask = availableHoursThisWeek >= dailyTarget * this.constants.CAPACITY.MIN_AVAILABLE_HALF_DAY;

            // גודל משימה מומלץ (לפי זמינות אמיתית)
            let recommendedTaskSize;
            if (availableHoursThisWeek >= dailyTarget * this.constants.CAPACITY.LARGE_TASK_DAYS) {
                recommendedTaskSize = 'large'; // יותר מיומיים זמינים
            } else if (availableHoursThisWeek >= dailyTarget * this.constants.CAPACITY.MEDIUM_TASK_DAYS) {
                recommendedTaskSize = 'medium'; // חצי יום עד יומיים
            } else {
                recommendedTaskSize = 'small'; // רק משימות קטנות
            }

            return {
                estimatedDaysToComplete,
                nextAvailableDate: this.dateToString(nextAvailableDate),
                canTakeNewTask,
                recommendedTaskSize,
                availableHoursThisWeek: this.roundTo(availableHoursThisWeek, 1),
                averageAvailablePerDay: this.roundTo(averageAvailablePerDay, 1)
            };
        }

        /**
         * 🔧 FIX v5.4: Count actual workdays between two dates (holiday/weekend-aware)
         * @param {Date} startDate - תאריך התחלה
         * @param {Date} endDate - תאריך סיום
         * @returns {number} מספר ימי עבודה בפועל
         */
        countWorkdaysBetween(startDate, endDate) {
            if (!this.workHoursCalculator) {
                // Fallback: count calendar days if no WorkHoursCalculator
                return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            }

            let workdays = 0;
            const current = new Date(startDate);
            current.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);

            while (current <= end) {
                if (this.workHoursCalculator.isWorkDay(current)) {
                    workdays++;
                }
                current.setDate(current.getDate() + 1);
            }

            return workdays;
        }

        /**
         * חישוב עומס יומי נדרש לכל משימה
         * @param {Array} tasks - רשימת משימות
         * @param {Date} now - תאריך נוכחי
         * @returns {Object} מפת עומס יומי { 'YYYY-MM-DD': totalHours }
         */
        calculateDailyTaskLoad(tasks, now) {
            const dailyLoads = {}; // { 'YYYY-MM-DD': totalHours }

            tasks.forEach(task => {
                if (!task.deadline) {
return;
} // דילוג על משימות ללא deadline

                const remainingMinutes = (task.estimatedMinutes || 0) - (task.actualMinutes || 0);
                if (remainingMinutes <= 0) {
return;
} // כבר הושלמה

                const remainingHours = remainingMinutes / 60;

                // המרת deadline ל-Date
                const deadline = this.parseDeadline(task.deadline);
                if (!deadline) {
return;
} // deadline לא תקין

                // 🔧 FIX v5.4: Count actual workdays, not calendar days
                const calendarDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

                if (calendarDays <= 0) {
                    // Overdue! כל השעות נדרשות היום
                    const today = this.dateToString(now);
                    // Only add to workdays
                    if (!this.workHoursCalculator || this.workHoursCalculator.isWorkDay(now)) {
                        dailyLoads[today] = (dailyLoads[today] || 0) + remainingHours;
                    }
                } else {
                    // 🔧 FIX v5.4: Calculate workdays for accurate distribution
                    const workdaysUntilDeadline = this.countWorkdaysBetween(now, deadline);

                    if (workdaysUntilDeadline <= 0) {
                        // No workdays left but not yet overdue - treat as overdue
                        const today = this.dateToString(now);
                        if (!this.workHoursCalculator || this.workHoursCalculator.isWorkDay(now)) {
                            dailyLoads[today] = (dailyLoads[today] || 0) + remainingHours;
                        }
                    } else {
                        // פיזור שווה על ימי עבודה בלבד
                        const dailyHoursNeeded = remainingHours / workdaysUntilDeadline;

                        // Iterate through calendar days but only add to workdays
                        for (let i = 0; i < calendarDays; i++) {
                            const date = new Date(now);
                            date.setDate(date.getDate() + i);
                            const dateKey = this.dateToString(date);

                            // Skip weekends and holidays
                            if (this.workHoursCalculator && !this.workHoursCalculator.isWorkDay(date)) {
                                continue;
                            }

                            dailyLoads[dateKey] = (dailyLoads[dateKey] || 0) + dailyHoursNeeded;
                        }
                    }
                }
            });

            return dailyLoads;
        }

        /**
         * ניתוח קיבולת יומית
         * @param {Object} dailyLoads - מפת עומס יומי
         * @param {number} dailyTarget - יעד שעות יומי
         * @returns {Object} ניתוח עומס
         */
        analyzeDailyCapacity(dailyLoads, dailyTarget) {
            let overloadedDays = 0;
            let totalOverloadHours = 0;
            let maxDailyLoad = 0;

            Object.entries(dailyLoads).forEach(([_date, load]) => {
                maxDailyLoad = Math.max(maxDailyLoad, load);

                if (load > dailyTarget) {
                    overloadedDays++;
                    totalOverloadHours += (load - dailyTarget);
                }
            });

            return {
                dailyLoads,
                overloadedDays,
                totalOverloadHours: this.roundTo(totalOverloadHours, 1),
                maxDailyLoad: this.roundTo(maxDailyLoad, 1),
                isOverloaded: overloadedDays > 0
            };
        }

        /**
         * חישוב שעות זמינות אמיתיות
         * @param {Object} dailyLoads - מפת עומס יומי
         * @param {number} dailyTarget - יעד שעות יומי
         * @param {number} daysInWeek - ימי עבודה בשבוע
         * @returns {Object} זמינות אמיתית
         */
        calculateRealAvailableHours(dailyLoads, dailyTarget, daysInWeek = 5) {
            let totalAvailable = 0;
            const now = new Date();

            for (let i = 0; i < daysInWeek; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() + i);
                const dateKey = this.dateToString(date);

                const committedHours = dailyLoads[dateKey] || 0;
                const availableToday = Math.max(0, dailyTarget - committedHours);

                totalAvailable += availableToday;
            }

            return {
                totalAvailableHours: this.roundTo(totalAvailable, 1),
                averageAvailablePerDay: this.roundTo(totalAvailable / daysInWeek, 1)
            };
        }

        /**
         * ניתוח עומס יומי מבוסס-deadline (גרסה 2.0)
         * @param {Array} tasks - רשימת משימות
         * @param {Object} employee - נתוני עובד
         * @param {Date} now - תאריך נוכחי
         * @returns {Object} ניתוח מפורט של עומס יומי
         */
        calculateDailyLoadAnalysis(tasks, employee, now) {
            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;

            // חישוב עומס יומי נדרש
            const dailyLoads = this.calculateDailyTaskLoad(tasks, now);

            // ניתוח קיבולת
            const capacityAnalysis = this.analyzeDailyCapacity(dailyLoads, dailyTarget);

            // חישוב זמינות אמיתית
            const availability = this.calculateRealAvailableHours(dailyLoads, dailyTarget, 5);

            // 🆕 Metric 2: Coverage Next 5 Business Days
            // חישוב סה"כ שעות נדרשות ב-5 ימים הקרובים
            let totalRequiredNext5 = 0;
            for (let i = 0; i < 5; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() + i);
                const dateKey = this.dateToString(date);
                totalRequiredNext5 += dailyLoads[dateKey] || 0;
            }

            const next5DaysCoverage = {
                requiredHours: this.roundTo(totalRequiredNext5, 1),
                availableHours: availability.totalAvailableHours,
                coverageGap: this.roundTo(totalRequiredNext5 - availability.totalAvailableHours, 1),
                // Fixed: Coverage ratio = (available / required) * 100, not capacity utilization
                coverageRatio: totalRequiredNext5 > 0
                    ? this.roundTo((availability.totalAvailableHours / totalRequiredNext5) * 100, 1)
                    : null  // Return null if no tasks, UI will show "—"
            };

            // 🐛 DEBUG: Log coverage calculation for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && !window._coverageDebugLogged) {
                console.log('🐛 [COVERAGE DEBUG]');
                console.log('  dailyLoads keys:', Object.keys(dailyLoads).length);
                console.log('  totalRequiredNext5:', totalRequiredNext5);
                console.log('  availableHours:', availability.totalAvailableHours);
                console.log('  coverageRatio:', next5DaysCoverage.coverageRatio);
                window._coverageDebugLogged = true;
            }

            return {
                ...capacityAnalysis,
                ...availability,
                next5DaysCoverage  // 🆕 NEW METRIC
            };
        }

        /**
         * v2.1: חישוב פירוט מפורט של עומס יומי כולל רשימת משימות
         * @param {Array} tasks - רשימת משימות
         * @param {Object} employee - נתוני עובד
         * @param {Date} now - תאריך נוכחי
         * @returns {Object} פירוט מפורט של עומס יומי
         */
        calculateDailyTaskBreakdown(tasks, employee, now) {
            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;
            const dailyLoads = {}; // { 'YYYY-MM-DD': totalHours }
            const tasksByDay = {}; // { 'YYYY-MM-DD': [{ task, hoursForThisDay }] }

            // חישוב עומס + tracking של משימות לכל יום
            tasks.forEach(task => {
                if (!task.deadline) {
return;
}

                const remainingMinutes = (task.estimatedMinutes || 0) - (task.actualMinutes || 0);
                if (remainingMinutes <= 0) {
return;
}

                const remainingHours = remainingMinutes / 60;
                const deadline = this.parseDeadline(task.deadline);
                if (!deadline) {
return;
}

                // 🔧 FIX v5.4: Count actual workdays, not calendar days
                const calendarDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

                if (calendarDays <= 0) {
                    // Overdue! כל השעות נדרשות היום
                    const today = this.dateToString(now);

                    // Only add to workdays
                    if (!this.workHoursCalculator || this.workHoursCalculator.isWorkDay(now)) {
                        dailyLoads[today] = (dailyLoads[today] || 0) + remainingHours;

                        // הוסף למעקב משימות
                        if (!tasksByDay[today]) {
tasksByDay[today] = [];
}
                        tasksByDay[today].push({
                            task: task,
                            hoursForThisDay: remainingHours
                        });
                    }
                } else {
                    // 🔧 FIX v5.4: Calculate workdays for accurate distribution
                    const workdaysUntilDeadline = this.countWorkdaysBetween(now, deadline);

                    if (workdaysUntilDeadline <= 0) {
                        // No workdays left but not yet overdue - treat as overdue
                        const today = this.dateToString(now);
                        if (!this.workHoursCalculator || this.workHoursCalculator.isWorkDay(now)) {
                            dailyLoads[today] = (dailyLoads[today] || 0) + remainingHours;
                            if (!tasksByDay[today]) {
tasksByDay[today] = [];
}
                            tasksByDay[today].push({
                                task: task,
                                hoursForThisDay: remainingHours
                            });
                        }
                    } else {
                        // פיזור שווה על ימי עבודה בלבד
                        const dailyHoursNeeded = remainingHours / workdaysUntilDeadline;

                        // Iterate through calendar days but only add to workdays
                        for (let i = 0; i < calendarDays; i++) {
                            const date = new Date(now);
                            date.setDate(date.getDate() + i);
                            const dateKey = this.dateToString(date);

                            // Skip weekends and holidays
                            if (this.workHoursCalculator && !this.workHoursCalculator.isWorkDay(date)) {
                                continue;
                            }

                            dailyLoads[dateKey] = (dailyLoads[dateKey] || 0) + dailyHoursNeeded;

                            // הוסף למעקב משימות
                            if (!tasksByDay[dateKey]) {
tasksByDay[dateKey] = [];
}
                            tasksByDay[dateKey].push({
                                task: task,
                                hoursForThisDay: dailyHoursNeeded
                            });
                        }
                    }
                }
            });

            // מצא יום שיא - only from workdays
            let peakDay = null;
            let peakDayLoad = 0;

            Object.keys(dailyLoads).forEach(day => {
                // Skip non-workdays in peak selection
                const dayDate = new Date(day);
                if (this.workHoursCalculator && !this.workHoursCalculator.isWorkDay(dayDate)) {
                    return;
                }

                if (dailyLoads[day] > peakDayLoad) {
                    peakDayLoad = dailyLoads[day];
                    peakDay = day;
                }
            });

            // מיין משימות בכל יום לפי שעות (מהגבוה לנמוך)
            Object.keys(tasksByDay).forEach(day => {
                tasksByDay[day].sort((a, b) => b.hoursForThisDay - a.hoursForThisDay);
            });

            // 🆕 Metric 4: Peak Multiplier (peak load / daily target)
            const peakMultiplier = dailyTarget > 0
                ? this.roundTo(peakDayLoad / dailyTarget, 2)
                : 0;

            // 🐛 DEBUG: Log peak day calculation for haim@ghlawoffice.co.il only
            if (employee.email === 'haim@ghlawoffice.co.il' && !window._peakDebugLogged) {
                console.log('🐛 [PEAK DAY DEBUG]');
                console.log('  dailyLoads keys count:', Object.keys(dailyLoads).length);
                console.log('  peakDay:', peakDay);
                console.log('  peakDayLoad:', peakDayLoad);
                console.log('  dailyTarget:', dailyTarget);
                console.log('  peakMultiplier:', peakMultiplier);
                console.log('  dailyLoads sample:', Object.entries(dailyLoads).slice(0, 3));

                // 🐛 DEBUG: Peak day details
                if (peakDay) {
                    const peakDayDate = new Date(peakDay);
                    const peakDayOfWeek = peakDayDate.getDay(); // 0=Sunday, 6=Saturday
                    const isWorkDay = this.workHoursCalculator
                        ? this.workHoursCalculator.isWorkDay(peakDayDate)
                        : null;
                    console.log('  peakDay string:', peakDay);
                    console.log('  peakDay.getDay():', peakDayOfWeek, ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][peakDayOfWeek]);
                    console.log('  workHoursCalculator.isWorkDay(peakDay):', isWorkDay);
                }

                // 🐛 DEBUG: Date key generation format
                const sampleDate = new Date(2026, 0, 17); // Jan 17, 2026
                console.log('  Date key format test (2026-01-17):');
                console.log('    dateToString:', this.dateToString(sampleDate));
                console.log('    toISOString().slice(0,10):', sampleDate.toISOString().slice(0, 10));

                window._peakDebugLogged = true;
            }

            return {
                dailyLoads,           // { '2026-01-02': 19.0, ... }
                tasksByDay,           // { '2026-01-02': [{ task, hoursForThisDay }, ...] }
                peakDay,              // '2026-01-02'
                peakDayLoad: this.roundTo(peakDayLoad, 1),  // 19.0
                dailyTarget,          // 8.45 (or custom)
                peakMultiplier        // 🆕 NEW METRIC (e.g. 2.25 = 225% of target)
            };
        }

        /**
         * v2.1.2: ניתוח איכות ניהול משימות (משופר)
         * מזהה משימות שצריכות להיסגר או לעדכן
         * כולל חישוב מדויק של שעות נותרות לכל משימה
         */
        analyzeTaskManagementQuality(tasks, now) {
            const issues = {
                shouldBeClosed: [],      // משימות שצריך לסגור (80%+ הושלם + deadline עבר)
                missingTimeTracking: [], // משימות ללא עדכון שעות בכלל
                stale: [],               // משימות פתוחות יותר מ-30 ימים ללא התקדמות
                nearComplete: [],        // משימות קרובות לסיום (90%+) אבל עדיין פתוחות
                almostDone: []           // משימות עם פחות משעה נותרת (95%+)
            };

            tasks.forEach(task => {
                const estimated = task.estimatedMinutes || 0;
                const actual = task.actualMinutes || 0;
                const remaining = estimated - actual; // 🎯 חישוב מדויק של שעות נותרות!
                const completionPercent = estimated > 0 ? (actual / estimated) * 100 : 0;

                // 1. משימה ללא עדכון שעות בכלל
                if (actual === 0 && estimated > 0) {
                    issues.missingTimeTracking.push({
                        task,
                        estimatedHours: this.roundTo(estimated / 60, 1)
                    });
                }

                // 2. משימה שצריך לסגור (80%+ הושלם + deadline עבר)
                // ✅ v4.0.0: שימוש ב-helper function
                if (task.deadline) {
                    const deadline = this.parseDeadline(task.deadline);
                    const isOverdue = deadline && deadline < now;

                    if (this.constants.shouldTaskBeClosed(completionPercent, isOverdue)) {
                        issues.shouldBeClosed.push({
                            task,
                            completionPercent: Math.round(completionPercent),
                            daysOverdue: Math.ceil((now - deadline) / (1000 * 60 * 60 * 24))
                        });
                    }
                }

                // 3. משימה קרובה לסיום (90%+) אבל עדיין פתוחה
                // ✅ v4.0.0: שימוש ב-helper function
                if (this.constants.isNearComplete(completionPercent) && completionPercent < 100) {
                    issues.nearComplete.push({
                        task,
                        completionPercent: Math.round(completionPercent),
                        remainingHours: this.roundTo(remaining / 60, 1),
                        remainingMinutes: remaining
                    });
                }

                // 3.5. משימה כמעט גמורה (95%+) - נותרה פחות משעה!
                // ✅ v4.0.0: שימוש ב-helper function
                if (this.constants.isAlmostDone(completionPercent, remaining) && completionPercent < 100 && remaining > 0) {
                    issues.almostDone.push({
                        task,
                        completionPercent: Math.round(completionPercent),
                        remainingMinutes: remaining,
                        clientName: task.clientName || this.constants.I18N.HE.NO_CLIENT,
                        description: task.description || task.taskName || this.constants.I18N.HE.NO_DESCRIPTION
                    });
                }

                // 4. משימות stale (פתוחות יותר מ-30 ימים ללא עדכון)
                // ✅ v4.0.0: שימוש ב-helper function
                if (task.createdAt && actual === 0) {
                    const createdAt = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
                    const daysOpen = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));

                    if (this.constants.isStaleTask(daysOpen, true)) {
                        issues.stale.push({
                            task,
                            daysOpen
                        });
                    }
                }
            });

            return {
                hasIssues: issues.shouldBeClosed.length > 0 ||
                          issues.missingTimeTracking.length > 0 ||
                          issues.nearComplete.length > 0 ||
                          issues.almostDone.length > 0,
                shouldBeClosedCount: issues.shouldBeClosed.length,
                missingTimeTrackingCount: issues.missingTimeTracking.length,
                nearCompleteCount: issues.nearComplete.length,
                almostDoneCount: issues.almostDone.length,
                staleCount: issues.stale.length,
                issues
            };
        }

        /**
         * יצירת התראות
         * @param {Object} workloadScore - ציון עומס
         * @param {Object} urgencyMetrics - מדדי דחיפות
         * @param {Object} basicMetrics - מדדים בסיסיים
         * @param {Object} dailyLoadAnalysis - ניתוח עומס יומי (v2.0)
         */
        generateAlerts(workloadScore, urgencyMetrics, basicMetrics, dailyLoadAnalysis = null, taskQuality = null) {
            const alerts = [];

            // התראת עומס קריטי
            // ✅ v4.0.0: שימוש ב-constants
            if (workloadScore.score >= this.constants.WORKLOAD_THRESHOLDS.CRITICAL) {
                alerts.push({
                    type: 'overload_critical',
                    severity: this.constants.ALERT_SEVERITY.CRITICAL,
                    message: `עומס קריטי - ${workloadScore.score}%`
                });
            } else if (workloadScore.score >= 70) {
                alerts.push({
                    type: 'overload_high',
                    severity: this.constants.ALERT_SEVERITY.WARNING,
                    message: `עומס גבוה - ${workloadScore.score}%`
                });
            }

            // v2.0: התראת עומס יומי
            // ✅ v4.0.0: שימוש ב-constants
            if (dailyLoadAnalysis && dailyLoadAnalysis.isOverloaded) {
                alerts.push({
                    type: 'daily_overload',
                    severity: dailyLoadAnalysis.overloadedDays > 3 ? this.constants.ALERT_SEVERITY.CRITICAL : this.constants.ALERT_SEVERITY.WARNING,
                    message: `עומס יומי גבוה: ${dailyLoadAnalysis.overloadedDays} ימים עם עומס-יתר (שיא: ${dailyLoadAnalysis.maxDailyLoad}h)`
                });
            }

            // התראת דדליינים
            // ✅ v4.0.0: שימוש ב-constants
            const urgentCount = urgencyMetrics.overdueTasksCount + urgencyMetrics.tasksWithin24h;
            if (urgentCount > 0) {
                alerts.push({
                    type: 'deadline_risk',
                    severity: urgentCount > 2 ? this.constants.ALERT_SEVERITY.CRITICAL : this.constants.ALERT_SEVERITY.WARNING,
                    message: `${urgentCount} משימות דחופות! (${urgencyMetrics.overdueTasksCount} באיחור)`
                });
            }

            // התראת מספר משימות גבוה
            // ✅ v4.0.0: שימוש ב-constant
            if (basicMetrics.activeTasksCount > this.constants.TASK_QUALITY.MAX_TASKS_BEFORE_ALERT) {
                alerts.push({
                    type: 'task_overload',
                    severity: this.constants.ALERT_SEVERITY.INFO,
                    message: `${basicMetrics.activeTasksCount} משימות פעילות במקביל`
                });
            }

            // ═══ v2.1.1: התראות איכות ניהול משימות ═══
            if (taskQuality && taskQuality.hasIssues) {
                // התראה על משימות שצריך לסגור
                // ✅ v4.0.0: שימוש ב-constants
                if (taskQuality.shouldBeClosedCount > 0) {
                    alerts.push({
                        type: 'tasks_should_close',
                        severity: this.constants.ALERT_SEVERITY.WARNING,
                        message: `${taskQuality.shouldBeClosedCount} משימות צריכות להיסגר (${this.constants.TASK_QUALITY.SHOULD_CLOSE_PERCENT}%+ הושלמו, דדליין עבר)`,
                        actionable: true,
                        tip: 'בדוק עם העובד למה משימות אלו לא נסגרו'
                    });
                }

                // התראה על משימות ללא עדכון שעות
                if (taskQuality.missingTimeTrackingCount > 0) {
                    alerts.push({
                        type: 'missing_time_tracking',
                        severity: this.constants.ALERT_SEVERITY.INFO,
                        message: `${taskQuality.missingTimeTrackingCount} משימות ללא עדכון שעות עבודה`,
                        actionable: true,
                        tip: 'העובד לא מעדכן שעות - העומס המחושב עשוי להיות לא מדויק'
                    });
                }

                // התראה על משימות קרובות לסיום
                if (taskQuality.nearCompleteCount > 0) {
                    alerts.push({
                        type: 'near_complete_tasks',
                        severity: this.constants.ALERT_SEVERITY.INFO,
                        message: `${taskQuality.nearCompleteCount} משימות קרובות לסיום (${this.constants.TASK_QUALITY.NEAR_COMPLETE_PERCENT}%+)`,
                        actionable: true,
                        tip: 'משימות אלו כמעט מוכנות - ניתן לסגור בקרוב'
                    });
                }

                // 🆕 v2.1.2: התראה על משימות שנותרה בהן פחות משעה!
                // ✅ v4.0.0: שימוש ב-constants
                if (taskQuality.almostDoneCount > 0) {
                    // בניית רשימה מפורטת
                    const taskList = taskQuality.issues.almostDone
                        .slice(0, 3) // הצג עד 3 ראשונות
                        .map(item => `${item.clientName}: ${item.remainingMinutes}min נותרו`)
                        .join(', ');

                    const moreText = taskQuality.almostDoneCount > 3 ? ` ועוד ${taskQuality.almostDoneCount - 3}` : '';

                    alerts.push({
                        type: 'almost_done_tasks',
                        severity: this.constants.ALERT_SEVERITY.WARNING,
                        message: `${taskQuality.almostDoneCount} משימות עם פחות משעה נותרת (${this.constants.TASK_QUALITY.ALMOST_DONE_PERCENT}%+)`,
                        actionable: true,
                        tip: `בקש מהעובד לסיים ולסגור: ${taskList}${moreText}. הפקד על סגירת משימות מיד כשהן מסתיימות!`
                    });
                }

                // התראה מקיפה - כשיש משימות רבות פתוחות אבל תקציב מולא
                // ✅ v4.0.0: שימוש ב-constant
                if (taskQuality.shouldBeClosedCount > 0 && basicMetrics.activeTasksCount > 5) {
                    const percentComplete = taskQuality.shouldBeClosedCount > 0
                        ? Math.round((taskQuality.shouldBeClosedCount / basicMetrics.activeTasksCount) * 100)
                        : 0;

                    if (percentComplete >= this.constants.TASK_QUALITY.DATA_QUALITY_THRESHOLD) {
                        alerts.push({
                            type: 'data_quality_issue',
                            severity: this.constants.ALERT_SEVERITY.WARNING,
                            message: `איכות נתונים: ${basicMetrics.activeTasksCount} משימות פתוחות, ${taskQuality.shouldBeClosedCount} צריכות להיסגר (${percentComplete}%)`,
                            actionable: true,
                            tip: 'העומס המחושב גבוה מהמציאות - העובד לא מעדכן משימות שהושלמו'
                        });
                    }
                }
            }

            return alerts;
        }

        /**
         * זיהוי משימות בסיכון
         */
        identifyRiskyTasks(tasks, now) {
            const riskyTasks = [];
            const activeTasks = tasks.filter(t => t.status === 'פעיל');

            activeTasks.forEach(task => {
                if (!task.deadline) {
return;
}

                const deadline = this.parseDeadline(task.deadline);
                if (!deadline) {
return;
}

                const daysUntil = (deadline - now) / (1000 * 60 * 60 * 24);
                const remainingHours = this.minutesToHours(
                    (task.estimatedMinutes || 0) - (task.actualMinutes || 0)
                );

                // משימה בסיכון אם:
                // 1. באיחור
                // 2. דחוף (< 2 ימים) ועדיין יש הרבה עבודה
                // 3. priority=urgent
                // ✅ v4.0.0: שימוש ב-constants
                const isRisky =
                    daysUntil < this.constants.RISK_LEVELS.OVERDUE_THRESHOLD ||
                    (daysUntil <= this.constants.RISK_LEVELS.MEDIUM_RISK_DAYS && remainingHours > this.constants.RISK_LEVELS.MEDIUM_RISK_HOURS) ||
                    task.priority === 'urgent';

                if (isRisky) {
                    let riskLevel;
                    if (daysUntil < this.constants.RISK_LEVELS.OVERDUE_THRESHOLD) {
                        riskLevel = this.constants.RISK_LEVELS.CRITICAL;
                    } else if (daysUntil < this.constants.RISK_LEVELS.HIGH_RISK_DAYS) {
                        riskLevel = this.constants.RISK_LEVELS.HIGH;
                    } else {
                        riskLevel = this.constants.RISK_LEVELS.MEDIUM;
                    }

                    riskyTasks.push({
                        taskId: task.taskId,
                        description: task.description,
                        deadline: task.deadline,
                        daysUntilDeadline: this.roundTo(daysUntil, 1),
                        remainingHours: this.roundTo(remainingHours, 1),
                        priority: task.priority || 'medium',
                        riskLevel
                    });
                }
            });

            // מיון לפי דחיפות
            riskyTasks.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);

            // ✅ v4.0.0: שימוש ב-constant
            return riskyTasks.slice(0, this.constants.UI_LIMITS.MAX_RISKY_TASKS); // Top 5 בסיכון
        }

        // ═══════════════════════════════════════════════════════════════
        // פונקציות עזר
        // ═══════════════════════════════════════════════════════════════

        minutesToHours(minutes) {
            return this.roundTo(minutes / 60, 2);
        }

        roundTo(num, decimals) {
            const factor = Math.pow(10, decimals);
            return Math.round(num * factor) / factor;
        }

        /**
         * המרת deadline (Firestore Timestamp / string / Date) ל-Date object
         */
        parseDeadline(deadline) {
            if (!deadline) {
return null;
}

            // Firestore Timestamp (native object with toDate method)
            if (deadline.toDate && typeof deadline.toDate === 'function') {
                return deadline.toDate();
            }

            // Serialized Firestore Timestamp (plain object with seconds property)
            if (typeof deadline === 'object' && deadline !== null) {
                if (typeof deadline.seconds === 'number') {
                    return new Date(deadline.seconds * 1000);
                }
                if (typeof deadline._seconds === 'number') {
                    return new Date(deadline._seconds * 1000);
                }
            }

            // String
            if (typeof deadline === 'string') {
                return new Date(deadline);
            }

            // כבר Date object
            if (deadline instanceof Date) {
                return deadline;
            }

            // Parse failed - log once per session
            if (!window._deadlineParseFailLogged) {
                console.warn('⚠️ [DEADLINE PARSE FAILED] Unknown format:', typeof deadline, deadline);
                window._deadlineParseFailLogged = true;
            }
            return null;
        }

        dateToString(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        getStartOfWeek(date) {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day; // יום ראשון
            d.setDate(diff);
            d.setHours(0, 0, 0, 0);
            return d;
        }

        /**
         * ✅ v5.1.0: Delegate to WorkHoursCalculator for single source of truth
         * Gets work days in month (excluding weekends AND holidays)
         * @param {Date} date - התאריך בחודש הרצוי
         * @returns {number} - מספר ימי עבודה בחודש
         */
        getWorkDaysInMonth(date) {
            const year = date.getFullYear();
            const month = date.getMonth();

            // ✅ Single source of truth: WorkHoursCalculator
            if (this.workHoursCalculator) {
                return this.workHoursCalculator.getWorkDaysInMonth(year, month);
            }

            // ❌ Fallback (should never reach here if properly initialized)
            console.error('❌ WorkHoursCalculator not available! Falling back to simple weekend counting (NO holidays)');
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let workDays = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const d = new Date(year, month, day);
                const dayOfWeek = d.getDay();
                if (dayOfWeek !== 5 && dayOfWeek !== 6) {
                    workDays++;
                }
            }
            return workDays;
        }

        sumMinutes(timesheetEntries) {
            return timesheetEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0);
        }

        // ═══════════════════════════════════════════════════════════════
        // 🆕 v5.0: SMART WORKLOAD MODULES - מודולים חכמים
        // ═══════════════════════════════════════════════════════════════

        /**
         * v5.0: חישוב ציון איכות נתונים (Data Quality Score)
         */
        calculateDataQuality(employee, tasks, timesheetEntries) {
            let score = 100;
            const issues = [];
            const recommendations = [];

            const now = new Date();
            const startOfWeek = this.getStartOfWeek(now);
            const timesheetThisWeek = timesheetEntries.filter(entry => {
                const entryDate = new Date(entry.date);
                return entryDate >= startOfWeek;
            });

            if (timesheetThisWeek.length === 0) {
                score -= 30;
                issues.push('no_timesheet_this_week');
                recommendations.push('העובד לא רשם שעות השבוע - נתוני העומס לא מדויקים');
            }

            const tasksWithoutTime = tasks.filter(t =>
                t.status === 'פעיל' && (t.actualMinutes === 0 || !t.actualMinutes)
            );
            const missingTimePercent = tasks.length > 0
                ? (tasksWithoutTime.length / tasks.length) * 100
                : 0;

            if (missingTimePercent > 30) {
                score -= Math.min(40, missingTimePercent);
                issues.push('missing_time_tracking');
                recommendations.push(`${tasksWithoutTime.length} משימות ללא עדכון שעות`);
            }

            const tasksWithoutDeadline = tasks.filter(t => !t.deadline);
            if (tasksWithoutDeadline.length > 0) {
                score -= 15;
                issues.push('missing_deadlines');
                recommendations.push(`${tasksWithoutDeadline.length} משימות ללא תאריך יעד`);
            }

            const shouldBeClosed = tasks.filter(t => {
                if (t.status === 'הושלם') {
return false;
}
                const completionPercent = t.estimatedMinutes > 0
                    ? (t.actualMinutes / t.estimatedMinutes) * 100
                    : 0;
                const isOverdue = t.deadline && new Date(t.deadline) < now;
                return completionPercent >= this.constants.TASK_QUALITY.SHOULD_CLOSE_PERCENT && isOverdue;
            });

            if (shouldBeClosed.length > 0) {
                score -= 15;
                issues.push('tasks_need_closing');
                recommendations.push(`${shouldBeClosed.length} משימות בוצעו 80%+ ובאיחור`);
            }

            return {
                score: Math.max(0, Math.round(score)),
                issues,
                recommendations,
                details: {
                    timesheetEntriesThisWeek: timesheetThisWeek.length,
                    tasksWithoutTime: tasksWithoutTime.length,
                    tasksWithoutDeadline: tasksWithoutDeadline.length,
                    tasksShouldBeClosed: shouldBeClosed.length
                }
            };
        }

        /**
         * v5.0: חישוב קיבולת אפקטיבית (Effective Capacity)
         */
        calculateEffectiveCapacity(employee) {
            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;
            const afterBreak = dailyTarget - 1;
            const personalSpace = afterBreak * 0.15;
            const effectiveDaily = afterBreak - personalSpace;
            const weeklyEffective = effectiveDaily * this.constants.WORK_HOURS.WORK_DAYS_PER_WEEK;

            return {
                nominal: this.roundTo(dailyTarget, 2),
                afterBreak: this.roundTo(afterBreak, 2),
                personalSpace: this.roundTo(personalSpace, 2),
                effective: this.roundTo(effectiveDaily, 2),
                weeklyEffective: this.roundTo(weeklyEffective, 2)
            };
        }

        /**
         * v5.0: חישוב עומס משוקלל (Weighted Backlog)
         */
        calculateWeightedBacklog(tasks, effectiveDaily) {
            const now = new Date();
            let totalBacklogHours = 0;
            let weightedBacklog = 0;

            tasks.forEach(task => {
                if (task.status === 'הושלם') {
return;
}

                const remaining = ((task.estimatedMinutes || 0) - (task.actualMinutes || 0)) / 60;
                if (remaining <= 0) {
return;
}

                const deadline = this.parseDeadline(task.deadline);
                if (!deadline) {
                    totalBacklogHours += remaining;
                    weightedBacklog += remaining;
                    return;
                }

                const daysUntilDeadline = (deadline - now) / (1000 * 60 * 60 * 24);

                let urgencyWeight = 1;
                if (daysUntilDeadline < 0) {
                    urgencyWeight = 3;
                } else if (daysUntilDeadline < 1) {
                    urgencyWeight = 2.5;
                } else if (daysUntilDeadline < 3) {
                    urgencyWeight = 2;
                } else if (daysUntilDeadline < 7) {
                    urgencyWeight = 1.5;
                }

                totalBacklogHours += remaining;
                weightedBacklog += (remaining * urgencyWeight);
            });

            return {
                totalHours: this.roundTo(totalBacklogHours, 1),
                weightedHours: this.roundTo(weightedBacklog, 1),
                estimatedDays: effectiveDaily > 0
                    ? this.roundTo(totalBacklogHours / effectiveDaily, 1)
                    : 0,
                weightedDays: effectiveDaily > 0
                    ? this.roundTo(weightedBacklog / effectiveDaily, 1)
                    : 0
            };
        }

        /**
         * v5.0: זיהוי משימות תקועות (Stale Task Detection)
         */
        detectStaleTasks(tasks) {
            const now = new Date();
            const staleTasks = [];
            const STALE_DAYS = 7;

            tasks.forEach(task => {
                if (task.status === 'הושלם') {
return;
}

                const lastModified = task.lastModifiedAt
                    ? (task.lastModifiedAt.toDate ? task.lastModifiedAt.toDate() : new Date(task.lastModifiedAt))
                    : null;

                if (!lastModified) {
return;
}

                const daysSinceUpdate = (now - lastModified) / (1000 * 60 * 60 * 24);
                if (daysSinceUpdate < STALE_DAYS) {
return;
}

                const progressPercent = task.estimatedMinutes > 0
                    ? (task.actualMinutes / task.estimatedMinutes) * 100
                    : 0;

                const deadline = this.parseDeadline(task.deadline);
                const daysUntilDeadline = deadline
                    ? (deadline - now) / (1000 * 60 * 60 * 24)
                    : 999;

                if (progressPercent < 20 && daysUntilDeadline < 14) {
                    staleTasks.push({
                        task,
                        daysSinceUpdate: Math.round(daysSinceUpdate),
                        progressPercent: Math.round(progressPercent),
                        daysUntilDeadline: Math.round(daysUntilDeadline),
                        severity: daysUntilDeadline < 7 ? 'critical' : 'warning'
                    });
                }
            });

            staleTasks.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
            return staleTasks;
        }

        /**
         * v5.0: יצירת התראות חכמות (Smart Alerts)
         */
        generateSmartAlerts(employee, tasks, dataQuality, staleTasks, weightedBacklog) {
            const alerts = [];

            if (dataQuality.score < 70) {
                alerts.push({
                    type: 'data_quality',
                    severity: dataQuality.score < 50 ? 'critical' : 'warning',
                    message: `ציון איכות נתונים: ${dataQuality.score}%`,
                    recommendations: dataQuality.recommendations,
                    details: dataQuality.details
                });
            }

            if (staleTasks.length > 0) {
                const criticalStale = staleTasks.filter(st => st.severity === 'critical');
                alerts.push({
                    type: 'stale_tasks',
                    severity: criticalStale.length > 0 ? 'critical' : 'warning',
                    message: `${staleTasks.length} משימות תקועות (${criticalStale.length} קריטיות)`,
                    details: staleTasks.slice(0, 3),
                    actionable: true
                });
            }

            if (weightedBacklog.weightedDays > 10) {
                alerts.push({
                    type: 'weighted_overload',
                    severity: weightedBacklog.weightedDays > 15 ? 'critical' : 'warning',
                    message: `עומס משוקלל: ${weightedBacklog.weightedDays} ימי עבודה`,
                    tip: 'עומס גבוה - שקול להעביר משימות',
                    details: {
                        totalBacklog: weightedBacklog.totalHours,
                        weightedBacklog: weightedBacklog.weightedHours,
                        difference: this.roundTo(weightedBacklog.weightedHours - weightedBacklog.totalHours, 1)
                    }
                });
            }

            const urgentWithoutTime = tasks.filter(t => {
                if (t.status === 'הושלם') {
return false;
}
                const deadline = this.parseDeadline(t.deadline);
                if (!deadline) {
return false;
}
                const daysUntil = (deadline - new Date()) / (1000 * 60 * 60 * 24);
                return daysUntil < 3 && (t.actualMinutes === 0 || !t.actualMinutes);
            });

            if (urgentWithoutTime.length > 0) {
                alerts.push({
                    type: 'urgent_without_time',
                    severity: 'critical',
                    message: `${urgentWithoutTime.length} משימות דחופות (< 3 ימים) ללא עדכון שעות!`,
                    actionable: true,
                    tip: 'יש לעדכן זמן עבודה מיד'
                });
            }

            return alerts;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Global Export
    // ═══════════════════════════════════════════════════════════════

    window.WorkloadCalculator = WorkloadCalculator;

    console.log('✅ WorkloadCalculator v5.0.0 loaded - Smart Workload Logic');

})();
