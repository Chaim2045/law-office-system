/**
 * Workload Card - רכיב UI להצגת עומס עבודה
 *
 * תפקיד: הצגה ויזואלית של מדדי עומס בדשבורד האדמין
 * תלות: WorkloadService, WorkloadConstants
 *
 * נוצר: 2025-12-30
 * גרסה: 4.0.0 - Production-Ready Refactoring
 *
 * שינויים בגרסה 4.0.0:
 * ✅ מחיקת 250+ שורות קוד LEGACY
 * ✅ תיקון משתנים לא בשימוש
 * ✅ שימוש ב-helper functions מ-WorkloadConstants
 * ✅ קוד נקי יותר וממוקד
 *
 * גרסה 3.0 (בסיס):
 * - ארכיטקטורה קטגורית: תוכן מאורגן בקטגוריות מתקפלות
 * - Quick Metrics תמיד גלויים
 * - התראות קריטיות תמיד פתוחות
 * - Smart Headers עם סיכומים
 * - הסברים למנהלים (help icons)
 * - פלטת צבעים יוקרתית: כחול לאייקונים, אדום להתראות בלבד
 */

(function() {
    'use strict';

    /**
     * WorkloadCard Class
     * כרטיס הצגת עומס עבודה
     */
    class WorkloadCard {
        constructor() {
            this.container = null;
            this.workloadService = null;
            this.currentView = 'grid'; // grid | list
        }

        /**
         * אתחול הקומפוננטה
         */
        init() {
            if (!window.WorkloadService) {
                console.error('❌ WorkloadCard: WorkloadService not loaded');
                return false;
            }

            this.workloadService = window.WorkloadService;
            console.log('✅ WorkloadCard initialized');
            return true;
        }

        /**
         * רינדור מפת עומס צוות
         * @param {HTMLElement} container - אלמנט קונטיינר
         * @param {Array} employees - רשימת עובדים
         */
        async render(container, employees) {
            this.container = container;

            // הצג loading
            container.innerHTML = this.renderLoading();

            // וודא שהשירות מאותחל
            if (!this.workloadService) {
                console.warn('⚠️ WorkloadService not initialized, calling init()');
                const initialized = this.init();
                if (!initialized) {
                    container.innerHTML = this.renderError('WorkloadService לא זמין');
                    return;
                }
            }

            try {
                // ✅ v5.2.0: Use SAFE wrapper with fail-fast checking
                const result = await this.workloadService.calculateAllEmployeesWorkloadSafe(employees);

                // ✅ v5.2.0: FAIL-FAST - Check if calculation succeeded
                if (!result.ok) {
                    console.error('❌ Workload calculation failed:', result.error.code);
                    container.innerHTML = this.renderFailFastError(result.error.message);
                    return;
                }

                const workloadMap = result.data;

                // 🔍 DEBUG: בדיקת נתונים
                console.log('📊 Workload Map:', workloadMap);
                console.log('👥 Number of employees:', employees.length);

                // בדיקה לדוגמה של עובד ראשון
                if (employees.length > 0 && workloadMap.size > 0) {
                    const firstEmp = employees[0];
                    const firstMetrics = workloadMap.get(firstEmp.email);
                    console.log('🔍 First employee metrics:', {
                        email: firstEmp.email,
                        name: firstEmp.displayName,
                        metrics: firstMetrics
                    });
                }

                // חשב סטטיסטיקות צוות
                const teamStats = this.workloadService.calculateTeamStats(workloadMap);
                console.log('📈 Team Stats:', teamStats);

                // רינדור
                container.innerHTML = this.renderWorkloadDashboard(
                    employees,
                    workloadMap,
                    teamStats
                );

                // הוסף event listeners
                this.attachEventListeners();

            } catch (error) {
                console.error('❌ Error rendering workload card:', error);
                container.innerHTML = this.renderError(error.message);
            }
        }

        /**
         * רינדור מסך טעינה
         */
        renderLoading() {
            return `
                <div class="workload-loading">
                    <div class="loading-spinner-small"></div>
                    <p>מחשב עומס עבודה...</p>
                </div>
            `;
        }

        /**
         * רינדור שגיאת Fail-Fast (באנר אדום)
         * ✅ v5.2.0: No partial data shown - clean failure state
         */
        renderFailFastError(message) {
            return `
                <div class="workload-fail-fast-banner">
                    <div class="fail-fast-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="fail-fast-message">
                            <h3>${message}</h3>
                            <p>המערכת זיהתה שחישובי ימי עבודה אינם זמינים ועצרה את כל התהליך כדי למנוע הצגת נתונים שגויים.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * רינדור שגיאה כללית
         */
        renderError(message) {
            return `
                <div class="workload-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>שגיאה בחישוב עומס</p>
                    <small>${message}</small>
                </div>
            `;
        }

        /**
         * רינדור דשבורד עומס מלא
         */
        renderWorkloadDashboard(employees, workloadMap, teamStats) {
            return `
                <div class="workload-dashboard-card">
                    <!-- כותרת + תובנות צוות -->
                    <div class="workload-header">
                        <div class="workload-title-section">
                            <h3 class="workload-title">
                                <i class="fas fa-chart-line"></i>
                                מפת עומס צוות
                            </h3>
                            <p class="workload-subtitle">עדכון אוטומטי כל 5 דקות</p>
                        </div>

                        <div class="workload-view-toggle">
                            <button class="view-toggle-btn active" data-view="grid" title="תצוגת רשת">
                                <i class="fas fa-th"></i>
                            </button>
                            <button class="view-toggle-btn" data-view="list" title="תצוגת רשימה">
                                <i class="fas fa-list"></i>
                            </button>
                        </div>
                    </div>

                    <!-- סטטיסטיקות צוות -->
                    ${this.renderTeamStats(teamStats)}

                    <!-- רשת עובדים -->
                    <div class="workload-employees-container">
                        ${this.renderEmployeesGrid(employees, workloadMap)}
                    </div>

                    <!-- פעולות -->
                    <div class="workload-actions">
                        <button class="btn-workload-refresh" id="refreshWorkloadBtn">
                            <i class="fas fa-sync-alt"></i>
                            רענן נתונים
                        </button>
                        <button class="btn-workload-details" id="detailsWorkloadBtn">
                            <i class="fas fa-chart-bar"></i>
                            דו״ח מפורט
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * רינדור סטטיסטיקות צוות
         */
        renderTeamStats(stats) {
            // v3.0: רק גווני אפור, רק קריטי אדום
            const getStatusColor = (avg) => {
                if (avg < 60) {
return '#94a3b8';
}  // Gray for normal
                if (avg < 85) {
return '#64748b';
}  // Darker gray for high
                return '#ef4444';  // Red for critical only
            };

            return `
                <div class="team-stats-grid">
                    <div class="team-stat-card">
                        <div class="stat-icon" style="background: ${getStatusColor(stats.averageScore)}20; color: ${getStatusColor(stats.averageScore)}">
                            <i class="fas fa-tachometer-alt"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">ממוצע עומס צוות</div>
                            <div class="stat-value" style="color: ${getStatusColor(stats.averageScore)}">${stats.averageScore}%</div>
                        </div>
                    </div>

                    <div class="team-stat-card">
                        <div class="stat-icon" style="background: #94a3b820; color: #64748b">
                            <i class="fas fa-user-check"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">עובדים זמינים</div>
                            <div class="stat-value" style="color: #1e293b">${stats.availableCount}</div>
                        </div>
                    </div>

                    <div class="team-stat-card">
                        <div class="stat-icon" style="background: #ef444420; color: #ef4444">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">עומס קריטי</div>
                            <div class="stat-value" style="color: #ef4444">${stats.criticalCount}</div>
                        </div>
                    </div>

                    <div class="team-stat-card">
                        <div class="stat-icon" style="background: #94a3b820; color: #64748b">
                            <i class="fas fa-bell"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">סה״כ התראות</div>
                            <div class="stat-value" style="color: #1e293b">${stats.totalAlerts}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * רינדור רשת עובדים
         */
        renderEmployeesGrid(employees, workloadMap) {
            const html = employees.map(emp => {
                const metrics = workloadMap.get(emp.email);
                if (!metrics) {
return '';
}

                return this.renderEmployeeCard(emp, metrics);
            }).join('');

            return `<div class="workload-grid" id="workloadGrid">${html}</div>`;
        }

        /**
         * v3.0: רינדור כרטיס עובד בודד - ארכיטקטורה קטגורית
         */
        renderEmployeeCard(employee, metrics) {
            // v3.0: Minimal colors - רק אפור + אדום לקריטי
            const levelColors = {
                low: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
                medium: { bg: '#e2e8f0', text: '#475569', border: '#cbd5e1' },
                high: { bg: '#cbd5e1', text: '#1e293b', border: '#94a3b8' },
                critical: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
                unknown: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' }
            };

            const color = levelColors[metrics.workloadLevel];
            const levelLabels = {
                low: 'זמין',
                medium: 'בינוני',
                high: 'עמוס',
                critical: 'קריטי',
                unknown: 'לא ידוע'
            };

            // בדיקה אם יש נושאים קריטיים
            const hasCriticalAlerts = metrics.alerts.some(a => a.severity === 'critical');

            return `
                <div class="employee-workload-card v3" data-level="${metrics.workloadLevel}">
                    <!-- ══════ HEADER - תמיד פתוח ══════ -->
                    <div class="employee-card-header-v3">
                        <div class="employee-identity">
                            <div class="employee-name-v3">${this.sanitize(employee.displayName || employee.username)}</div>
                            <div class="employee-role-v3">${this.getRoleLabel(employee.role)}</div>
                        </div>
                        <div class="workload-status-badge" style="background: ${color.bg}; color: ${color.text}">
                            <div class="badge-score">${metrics.workloadScore}%</div>
                            <div class="badge-label">${levelLabels[metrics.workloadLevel]}</div>
                        </div>
                    </div>

                    <!-- ══════ QUICK METRICS - תמיד פתוח ══════ -->
                    <div class="quick-metrics-row">
                        <div class="quick-metric" title="מספר המשימות הפעילות (שטרם הושלמו)">
                            <i class="fas fa-tasks"></i>
                            <div class="qm-value">${metrics.activeTasksCount || 0}</div>
                            <div class="qm-label">משימות</div>
                        </div>
                        <div class="quick-metric" title="סה״כ שעות שנותרו לביצוע בכל המשימות">
                            <i class="fas fa-clock"></i>
                            <div class="qm-value">${this.formatHours(metrics.totalBacklogHours)}</div>
                            <div class="qm-label">Backlog</div>
                        </div>
                        <div class="quick-metric urgent" title="משימות עם דדליין עד 24 שעות">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div class="qm-value">${metrics.tasksWithin24h || 0}</div>
                            <div class="qm-label">דחופות</div>
                        </div>
                        <div class="quick-metric ${metrics.maxDailyLoad > (metrics.dailyHoursTarget || employee.dailyHoursTarget || 8.45) ? 'peak-alert' : ''}"
                             title="היום עם העומס הגבוה ביותר בשבוע הקרוב">
                            <i class="fas fa-chart-bar"></i>
                            <div class="qm-value">${metrics.maxDailyLoad !== undefined ? this.formatHours(metrics.maxDailyLoad) : '-'}</div>
                            <div class="qm-label">יום שיא</div>
                        </div>
                        <div class="quick-metric available" title="כמה שעות העובד יכול לקבל משימות נוספות השבוע">
                            <i class="fas fa-battery-three-quarters"></i>
                            <div class="qm-value">${this.formatHours(metrics.availableHoursThisWeek)}</div>
                            <div class="qm-label">זמין</div>
                        </div>
                    </div>

                    <!-- 🆕 SECONDARY QUICK METRICS - New Metrics Row -->
                    <div class="quick-metrics-row secondary">
                        <div class="quick-metric" title="אחוז ימי עבודה עם דיווח שעות החודש (כולל היום)">
                            <i class="fas fa-calendar-check"></i>
                            <div class="qm-value">${metrics.reportingConsistency !== undefined ? Math.round(metrics.reportingConsistency) : '-'}%</div>
                            <div class="qm-label">דיווח</div>
                        </div>
                        <div class="quick-metric ${(metrics.next5DaysCoverage?.coverageGap || 0) > 0 ? 'coverage-alert' : ''}"
                             title="כיסוי קיבולת ל-5 ימים הבאים: ${this.formatHours(metrics.next5DaysCoverage?.availableHours || 0)} זמין vs ${this.formatHours(metrics.next5DaysCoverage?.requiredHours || 0)} נדרש">
                            <i class="fas fa-shield-alt"></i>
                            <div class="qm-value">${metrics.next5DaysCoverage?.coverageRatio !== undefined ? Math.round(metrics.next5DaysCoverage.coverageRatio) : '-'}%</div>
                            <div class="qm-label">כיסוי</div>
                        </div>
                        <div class="quick-metric urgent" title="משימות באיחור + דחופות (עד 3 ימים)">
                            <i class="fas fa-fire"></i>
                            <div class="qm-value">${metrics.overduePlusDueSoon || 0}</div>
                            <div class="qm-label">קריטי</div>
                        </div>
                        <div class="quick-metric ${(metrics.dailyBreakdown?.peakMultiplier || 0) >= 2 ? 'peak-alert' : ''}"
                             title="כפולת עומס יום השיא (${this.formatHours(metrics.maxDailyLoad || 0)} ÷ ${this.formatHours(metrics.dailyHoursTarget || 8.45)})">
                            <i class="fas fa-times"></i>
                            <div class="qm-value">×${metrics.dailyBreakdown?.peakMultiplier || 0}</div>
                            <div class="qm-label">שיא</div>
                        </div>
                    </div>

                    <!-- ══════ CRITICAL ALERTS - פתוח אוטומטית אם יש ══════ -->
                    ${hasCriticalAlerts ? this.renderCriticalAlertsSection(metrics.alerts) : ''}

                    <!-- ══════ CATEGORIES - Collapsible ══════ -->
                    <div class="workload-categories">
                        ${this.renderTaskQualityCategory(metrics, employee)}
                        ${this.renderWeeklyBreakdownCategory(metrics, employee)}
                        ${this.renderRiskyTasksCategory(metrics, employee)}
                        ${this.renderAllAlertsCategory(metrics, employee)}
                    </div>
                </div>
            `;
        }

        /**
         * v3.0: רינדור סקשן התראות קריטיות (פתוח תמיד אם יש)
         */
        renderCriticalAlertsSection(alerts) {
            const criticalAlerts = alerts.filter(a => a.severity === 'critical');
            if (criticalAlerts.length === 0) {
return '';
}

            return `
                <div class="critical-alerts-section">
                    <div class="critical-alerts-header">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>התראות קריטיות</span>
                        ${this.renderHelpIcon('התראות שדורשות טיפול מיידי', 'משימות באיחור, עומס-יתר חמור')}
                    </div>
                    <div class="critical-alerts-list">
                        ${criticalAlerts.map(alert => `
                            <div class="critical-alert-item">
                                <i class="fas fa-exclamation-triangle"></i>
                                <div class="alert-text">
                                    <div class="alert-message">${this.sanitize(alert.message)}</div>
                                    ${alert.tip ? `<div class="alert-tip-text">${this.sanitize(alert.tip)}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * v3.0: קטגוריה - איכות ניהול משימות
         */
        renderTaskQualityCategory(metrics, employee) {
            const taskQuality = metrics.taskQuality;
            if (!taskQuality || !taskQuality.hasIssues) {
return '';
}

            const totalIssues = taskQuality.shouldBeClosedCount +
                               taskQuality.missingTimeTrackingCount +
                               taskQuality.nearCompleteCount +
                               (taskQuality.almostDoneCount || 0);

            if (totalIssues === 0) {
return '';
}

            // Smart header summary
            const summaryParts = [];
            if (taskQuality.shouldBeClosedCount > 0) {
summaryParts.push(`${taskQuality.shouldBeClosedCount} לסגירה`);
}
            if (taskQuality.almostDoneCount > 0) {
summaryParts.push(`${taskQuality.almostDoneCount} כמעט גמורות`);
}
            if (taskQuality.missingTimeTrackingCount > 0) {
summaryParts.push(`${taskQuality.missingTimeTrackingCount} ללא דיווח`);
}

            const summary = summaryParts.slice(0, 2).join(' • ');

            return `
                <div class="workload-category">
                    <div class="category-header" onclick="window.toggleCategory('quality', '${this.sanitize(employee.email)}')">
                        <div class="category-title">
                            <i class="fas fa-clipboard-check"></i>
                            <span>איכות ניהול משימות</span>
                            ${this.renderHelpIcon(
                                'ניהול נכון של משימות מבטיח דיווח מדויק ומונע עומס מוסתר',
                                'משימה שדווח עליה 8 מתוך 10 שעות צריכה להישלם או להתעדכן'
                            )}
                        </div>
                        <div class="category-summary">
                            <span class="summary-text">${summary}</span>
                            <span class="summary-badge">${totalIssues}</span>
                            <i class="fas fa-chevron-down category-toggle-icon"></i>
                        </div>
                    </div>

                    <div class="category-content" id="quality-${this.sanitize(employee.email)}" style="display: none;">
                        ${taskQuality.shouldBeClosedCount > 0 ? `
                            <div class="quality-issue-item">
                                <i class="fas fa-check-circle"></i>
                                <div class="issue-content">
                                    <div class="issue-label">${taskQuality.shouldBeClosedCount} משימות לסגירה</div>
                                    <div class="issue-description">הושלמו 80%+ מהתקציב והדדליין עבר</div>
                                </div>
                            </div>
                        ` : ''}
                        ${(taskQuality.almostDoneCount || 0) > 0 ? `
                            <div class="quality-issue-item critical">
                                <i class="fas fa-hourglass-end"></i>
                                <div class="issue-content">
                                    <div class="issue-label">${taskQuality.almostDoneCount} משימות כמעט גמורות</div>
                                    <div class="issue-description">נותרו פחות משעה אחת (95%+ הושלמו)</div>
                                </div>
                            </div>
                        ` : ''}
                        ${taskQuality.nearCompleteCount > 0 ? `
                            <div class="quality-issue-item">
                                <i class="fas fa-tasks"></i>
                                <div class="issue-content">
                                    <div class="issue-label">${taskQuality.nearCompleteCount} משימות קרובות לסיום</div>
                                    <div class="issue-description">90%+ הושלמו, כדאי לבדוק סטטוס</div>
                                </div>
                            </div>
                        ` : ''}
                        ${taskQuality.missingTimeTrackingCount > 0 ? `
                            <div class="quality-issue-item info">
                                <i class="fas fa-clock"></i>
                                <div class="issue-content">
                                    <div class="issue-label">${taskQuality.missingTimeTrackingCount} משימות ללא דיווח שעות</div>
                                    <div class="issue-description">לא דווח זמן עבודה, עלול ליצור עומס מוסתר</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        /**
         * v3.0: קטגוריה - פירוט עומס שבועי
         */
        renderWeeklyBreakdownCategory(metrics, employee) {
            const dailyBreakdown = metrics.dailyBreakdown;
            if (!dailyBreakdown || !dailyBreakdown.dailyLoads || metrics.maxDailyLoad === 0) {
return '';
}

            const { peakDay, peakDayLoad } = dailyBreakdown;
            const peakDayFormatted = peakDay ? this.formatDateFromString(peakDay) : '';

            // Smart header summary
            const summary = `שיא: ${this.formatHours(peakDayLoad)} ב-${peakDayFormatted}`;

            return `
                <div class="workload-category">
                    <div class="category-header" onclick="window.toggleCategory('weekly', '${this.sanitize(employee.email)}')">
                        <div class="category-title">
                            <i class="fas fa-calendar-week"></i>
                            <span>פירוט שבועי</span>
                            ${this.renderHelpIcon(
                                'התפלגות העומס על פני 5 ימי העבודה הקרובים',
                                'עובד עם יום שיא של 19 שעות צריך סידור מחדש של משימות'
                            )}
                        </div>
                        <div class="category-summary">
                            <span class="summary-text">${summary}</span>
                            <i class="fas fa-chevron-down category-toggle-icon"></i>
                        </div>
                    </div>

                    <div class="category-content" id="weekly-${this.sanitize(employee.email)}" style="display: none;">
                        ${this.renderWeeklyBreakdownContent(dailyBreakdown, employee)}
                    </div>
                </div>
            `;
        }

        /**
         * v3.0: קטגוריה - משימות בסיכון
         */
        renderRiskyTasksCategory(metrics, employee) {
            if (!metrics.riskyTasks || metrics.riskyTasks.length === 0) {
return '';
}

            const riskyCount = metrics.riskyTasks.length;
            const criticalCount = metrics.riskyTasks.filter(t => t.riskLevel === 'critical').length;

            // Smart header summary
            const summary = criticalCount > 0
                ? `${criticalCount} קריטיות מתוך ${riskyCount}`
                : `${riskyCount} משימות`;

            const employeeEmail = employee.email || employee.username || metrics.employeeEmail || 'unknown';

            return `
                <div class="workload-category">
                    <div class="category-header" onclick="window.toggleCategory('risky', '${this.sanitize(employeeEmail)}')">
                        <div class="category-title">
                            <i class="fas fa-fire"></i>
                            <span>משימות בסיכון</span>
                            ${this.renderHelpIcon(
                                'משימות עם דדליין קרוב ושעות רבות שנותרו',
                                'משימה עם 15 שעות נותרות ודדליין בעוד יומיים'
                            )}
                        </div>
                        <div class="category-summary">
                            <span class="summary-text">${summary}</span>
                            <span class="summary-badge">${riskyCount}</span>
                            <i class="fas fa-chevron-down category-toggle-icon"></i>
                        </div>
                    </div>

                    <div class="category-content" id="risky-${this.sanitize(employeeEmail)}" style="display: none;">
                        ${this.renderRiskyTasksContent(metrics.riskyTasks)}
                    </div>
                </div>
            `;
        }

        /**
         * v3.0: קטגוריה - כל ההתראות
         */
        renderAllAlertsCategory(metrics, employee) {
            const alerts = metrics.alerts;
            // הצג רק התראות שאינן קריטיות (הקריטיות מוצגות בנפרד)
            const nonCriticalAlerts = alerts.filter(a => a.severity !== 'critical');
            if (nonCriticalAlerts.length === 0) {
return '';
}

            const warningCount = nonCriticalAlerts.filter(a => a.severity === 'warning').length;
            const infoCount = nonCriticalAlerts.filter(a => a.severity === 'info').length;

            // Smart header summary
            const summary = warningCount > 0
                ? `${warningCount} אזהרות`
                : `${infoCount} מידע`;

            const employeeEmail = employee.email || employee.username || 'unknown';

            return `
                <div class="workload-category">
                    <div class="category-header" onclick="window.toggleCategory('alerts', '${this.sanitize(employeeEmail)}')">
                        <div class="category-title">
                            <i class="fas fa-bell"></i>
                            <span>התראות נוספות</span>
                            ${this.renderHelpIcon(
                                'התראות ומידע שימושי על העומס',
                                'המלצות לשיפור תזרים העבודה'
                            )}
                        </div>
                        <div class="category-summary">
                            <span class="summary-text">${summary}</span>
                            <span class="summary-badge">${nonCriticalAlerts.length}</span>
                            <i class="fas fa-chevron-down category-toggle-icon"></i>
                        </div>
                    </div>

                    <div class="category-content" id="alerts-${this.sanitize(employeeEmail)}" style="display: none;">
                        ${nonCriticalAlerts.map(alert => {
                            // v3.0: רק אפור - ללא צבעים
                            const severityIcons = {
                                warning: 'fa-exclamation-triangle',
                                info: 'fa-info-circle'
                            };
                            return `
                                <div class="alert-item ${alert.severity}">
                                    <i class="fas ${severityIcons[alert.severity]}"></i>
                                    <div class="alert-content-v3">
                                        <div class="alert-message-v3">${this.sanitize(alert.message)}</div>
                                        ${alert.tip ? `<div class="alert-tip-v3">${this.sanitize(alert.tip)}</div>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * v3.0: תוכן פירוט שבועי (להשתמש בקטגוריה)
         */
        renderWeeklyBreakdownContent(dailyBreakdown, employee) {
            const { dailyLoads, tasksByDay, peakDay, peakDayLoad, dailyTarget } = dailyBreakdown;

            // Get next 5 days
            const today = new Date();
            const next5Days = [];
            for (let i = 0; i < 5; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                const dateKey = this.dateToYYYYMMDD(date);
                next5Days.push({
                    date: date,
                    dateKey: dateKey,
                    load: dailyLoads[dateKey] || 0,
                    dayName: this.getDayName(date)
                });
            }

            const maxLoad = Math.max(...next5Days.map(d => d.load), dailyTarget);

            // Chart
            const chartHtml = next5Days.map(day => {
                const heightPercent = maxLoad > 0 ? (day.load / maxLoad) * 100 : 0;
                const isOverloaded = day.load > dailyTarget;

                return `
                    <div class="daily-bar-wrapper">
                        <div class="daily-bar-value">${this.formatHours(day.load)}</div>
                        <div class="daily-bar ${isOverloaded ? 'overloaded' : ''}"
                             style="height: ${heightPercent}%"
                             title="${day.dayName}: ${this.formatHours(day.load)}">
                        </div>
                        <div class="daily-bar-label">${day.dayName}</div>
                    </div>
                `;
            }).join('');

            // Peak day tasks
            let peakDayTasksHtml = '';
            if (peakDay && tasksByDay[peakDay]) {
                const allPeakDayTasks = tasksByDay[peakDay];
                const initialDisplayCount = 5; // הצג פחות משימות בברירת מחדל בגרסה החדשה
                const showExpandButton = allPeakDayTasks.length > initialDisplayCount;

                peakDayTasksHtml = allPeakDayTasks.map((item, index) => {
                    const task = item.task;
                    const hours = item.hoursForThisDay;
                    const deadline = this.parseDeadlineForDisplay(task.deadline);
                    const isOverdue = deadline && deadline < today;
                    const isHidden = index >= initialDisplayCount;

                    return `
                        <div class="breakdown-task-item-v3 ${isOverdue ? 'overdue' : ''} ${isHidden ? 'breakdown-task-hidden' : ''}" data-task-index="${index}">
                            <i class="fas fa-briefcase breakdown-task-icon"></i>
                            <div class="breakdown-task-info-v3">
                                <div class="breakdown-task-client">${this.sanitize(task.clientName || 'ללא לקוח')}</div>
                                <div class="breakdown-task-desc">${this.sanitize(task.description || task.taskName || 'ללא תיאור')}</div>
                                <div class="breakdown-task-meta">
                                    <span><i class="fas fa-clock"></i> ${this.formatHours(hours)}</span>
                                    <span>•</span>
                                    <span><i class="fas fa-calendar"></i> ${deadline ? this.formatDate(deadline.toISOString()) : 'ללא דדליין'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                if (showExpandButton) {
                    const remainingCount = allPeakDayTasks.length - initialDisplayCount;
                    peakDayTasksHtml += `
                        <div class="breakdown-more-tasks" onclick="window.toggleAllPeakTasks('${this.sanitize(employee.email)}')">
                            <i class="fas fa-chevron-down"></i>
                            <span class="more-tasks-text">הצג עוד ${remainingCount} משימות</span>
                        </div>
                    `;
                }
            }

            const peakDayDate = peakDay ? this.formatDateFromString(peakDay) : '';

            return `
                <!-- Bar Chart -->
                <div class="breakdown-chart-v3">
                    ${chartHtml}
                </div>

                <!-- Peak Day Tasks -->
                ${peakDay && peakDayTasksHtml ? `
                <div class="breakdown-tasks-v3">
                    <div class="breakdown-tasks-header-v3">
                        <i class="fas fa-chart-bar"></i>
                        משימות ביום השיא (${peakDayDate} - ${this.formatHours(peakDayLoad)})
                    </div>
                    <div class="breakdown-task-list-v3">
                        ${peakDayTasksHtml}
                    </div>
                </div>
                ` : ''}
            `;
        }

        /**
         * v3.0: תוכן משימות בסיכון (להשתמש בקטגוריה)
         */
        renderRiskyTasksContent(riskyTasks) {
            return riskyTasks.slice(0, 5).map(task => {
                // v3.0: רק אדום לקריטי, שאר בלי צבע
                const iconClass = task.riskLevel === 'critical' ? 'risk-critical' : 'risk-normal';

                return `
                    <div class="risky-task-item-v3 ${iconClass}">
                        <i class="fas fa-exclamation-circle"></i>
                        <div class="risky-task-info-v3">
                            <div class="risky-task-desc">${this.sanitize(task.description)}</div>
                            <div class="risky-task-meta-v3">
                                ${task.daysUntilDeadline < 0 ?
                                    `<span class="overdue">באיחור ${Math.abs(task.daysUntilDeadline)} ימים</span>` :
                                    `<span>נותרו ${task.daysUntilDeadline} ימים</span>`
                                }
                                <span>•</span>
                                <span>${task.remainingHours}h נותרו</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // ═══════════════════════════════════════════════════════════════
        // LEGACY FUNCTIONS REMOVED - Cleaned up in Phase 1 Refactoring
        // All functionality moved to v3.0 categorical architecture
        // ═══════════════════════════════════════════════════════════════

        /**
         * המרת Date ל-YYYY-MM-DD
         */
        dateToYYYYMMDD(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        /**
         * קבל שם יום בשבוע
         */
        getDayName(date) {
            // ✅ v4.0.0: שימוש ב-helper function מ-constants
            if (window.WorkloadConstants) {
                return window.WorkloadConstants.getDayName(date.getDay());
            }

            // Fallback
            const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
            return days[date.getDay()];
        }

        /**
         * המרת deadline ל-Date (support Firestore Timestamp)
         */
        parseDeadlineForDisplay(deadline) {
            if (!deadline) {
return null;
}

            if (deadline.toDate && typeof deadline.toDate === 'function') {
                return deadline.toDate();
            }

            if (typeof deadline === 'string') {
                return new Date(deadline);
            }

            if (deadline instanceof Date) {
                return deadline;
            }

            return null;
        }

        /**
         * פורמט תאריך מ-string YYYY-MM-DD
         */
        formatDateFromString(dateStr) {
            const parts = dateStr.split('-');
            if (parts.length !== 3) {
return dateStr;
}

            const day = parts[2];
            const month = parts[1];
            return `${day}/${month}`;
        }

        /**
         * הוספת event listeners
         */
        attachEventListeners() {
            // Toggle view
            const viewButtons = this.container.querySelectorAll('.view-toggle-btn');
            viewButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const view = btn.dataset.view;
                    this.toggleView(view);

                    viewButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // Refresh
            const refreshBtn = this.container.querySelector('#refreshWorkloadBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.workloadService.clearCache();
                    window.location.reload();
                });
            }

            // Details (placeholder)
            const detailsBtn = this.container.querySelector('#detailsWorkloadBtn');
            if (detailsBtn) {
                detailsBtn.addEventListener('click', () => {
                    alert('דו״ח מפורט - בפיתוח');
                });
            }
        }

        /**
         * החלף תצוגה (grid/list)
         */
        toggleView(view) {
            const grid = this.container.querySelector('#workloadGrid');
            if (!grid) {
return;
}

            if (view === 'list') {
                grid.classList.add('workload-list-view');
            } else {
                grid.classList.remove('workload-list-view');
            }

            this.currentView = view;
        }

        // ═══════════════════════════════════════════════════════════════
        // Helper Functions
        // ═══════════════════════════════════════════════════════════════

        /**
         * v3.0: יצירת אייקון עזרה עם tooltip להסבר למנהלים
         * @param {string} explanation - טקסט ההסבר
         * @param {string} example - דוגמה (אופציונלי)
         * @returns {string} HTML של אייקון העזרה
         */
        renderHelpIcon(explanation, example = null) {
            const fullTooltip = example
                ? `${explanation}\n\nדוגמה: ${example}`
                : explanation;

            return `
                <i class="fas fa-question-circle help-icon"
                   title="${this.sanitize(fullTooltip)}"
                   data-tooltip="${this.sanitize(fullTooltip)}"></i>
            `;
        }

        sanitize(text) {
            if (!text) {
return '';
}
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        getRoleLabel(role) {
            // ✅ v4.0.0: שימוש ב-helper function מ-constants
            if (window.WorkloadConstants) {
                return window.WorkloadConstants.getRoleLabel(role);
            }

            // Fallback אם constants לא נטען
            const labels = {
                admin: 'מנהל',
                lawyer: 'עורך דין',
                assistant: 'עוזר',
                intern: 'מתמחה'
            };
            return labels[role] || role;
        }

        formatDate(dateStr) {
            if (!dateStr) {
return '-';
}

            const date = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
return 'היום';
}
            if (diffDays === 1) {
return 'מחר';
}
            if (diffDays < 7) {
return `בעוד ${diffDays} ימים`;
}

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${day}/${month}`;
        }

        formatHours(hours) {
            if (hours === undefined || hours === null) {
return '0h';
}
            if (hours === 0) {
return '0h';
}

            // אם זה מספר שלם, הצג בלי נקודה עשרונית
            if (hours === Math.floor(hours)) {
                return `${hours}h`;
            }

            // אחרת, הצג עם נקודה עשרונית אחת
            return `${hours.toFixed(1)}h`;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Global Functions (for onclick)
    // ═══════════════════════════════════════════════════════════════

    /**
     * v3.0: Toggle category section (new architecture)
     */
    window.toggleCategory = function(categoryName, employeeEmail) {
        const content = document.getElementById(`${categoryName}-${employeeEmail}`);
        if (!content) {
            console.warn(`⚠️ Category content not found: ${categoryName} for ${employeeEmail}`);
            return;
        }

        const header = content.previousElementSibling;
        const icon = header ? header.querySelector('.category-toggle-icon') : null;

        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        } else {
            content.style.display = 'none';
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }
    };

    /**
     * v2.1: Toggle weekly breakdown section (LEGACY - kept for backward compatibility)
     */
    window.toggleBreakdown = function(employeeEmail) {
        const content = document.getElementById(`breakdown-${employeeEmail}`);
        if (!content) {
            console.warn('⚠️ Breakdown content not found for:', employeeEmail);
            return;
        }

        const header = content.previousElementSibling;
        const icon = header ? header.querySelector('.breakdown-toggle-icon') : null;

        if (content.style.display === 'none') {
            content.style.display = 'block';
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        } else {
            content.style.display = 'none';
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }
    };

    /**
     * v2.1.1: Toggle all peak day tasks (show/hide additional tasks)
     */
    window.toggleAllPeakTasks = function(employeeEmail) {
        const breakdownContent = document.getElementById(`breakdown-${employeeEmail}`);
        if (!breakdownContent) {
            console.warn('⚠️ Breakdown content not found for:', employeeEmail);
            return;
        }

        const hiddenTasks = breakdownContent.querySelectorAll('.breakdown-task-hidden');
        const button = breakdownContent.querySelector('.breakdown-more-tasks');
        const icon = button ? button.querySelector('i') : null;
        const text = button ? button.querySelector('.more-tasks-text') : null;

        if (hiddenTasks.length === 0) {
return;
}

        const isCurrentlyHidden = hiddenTasks[0].style.display === 'none' || hiddenTasks[0].style.display === '';

        if (isCurrentlyHidden) {
            // Show all tasks
            hiddenTasks.forEach(task => {
                task.style.display = 'flex';
            });
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
            if (text) {
                text.textContent = 'הסתר משימות נוספות';
            }
        } else {
            // Hide additional tasks
            hiddenTasks.forEach(task => {
                task.style.display = 'none';
            });
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
            if (text) {
                const count = hiddenTasks.length;
                text.textContent = `הצג עוד ${count} משימות נוספות`;
            }
        }
    };

    window.viewEmployeeWorkloadDetails = function(email) {
        console.log('📊 Viewing detailed workload for:', email);
        // TODO: פתח modal עם פרטים מלאים
        if (window.UserDetailsModal) {
            window.UserDetailsModal.show(email);
        } else {
            alert(`פרטי עומס מלאים - ${email}\n(בפיתוח)`);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // Global Export
    // ═══════════════════════════════════════════════════════════════

    // Export both Class and Instance
    window.WorkloadCardClass = WorkloadCard;

    const workloadCard = new WorkloadCard();
    window.WorkloadCard = workloadCard;

    console.log('✅ WorkloadCard v5.2.0 loaded - Fail-Fast Error Handling');

})();
