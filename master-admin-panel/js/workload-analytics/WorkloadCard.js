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

                // UI/WORKLOAD-DRAWER-2026: Store data for drawer access
                this.employees = employees;
                this.workloadMap = workloadMap;

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
         * UI/WORKLOAD-DRAWER-2026: Removed view toggle, added drawer container
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
                    </div>

                    <!-- סטטיסטיקות צוות -->
                    ${this.renderTeamStats(teamStats)}

                    <!-- רשימת עובדים (קליק פותח drawer) -->
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

                <!-- UI/WORKLOAD-DRAWER-2026: Drawer container (injected into DOM) -->
                <div id="workloadDrawerContainer"></div>
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
                        <div class="stat-icon" style="background: ${stats.totalUrgentTasks > 0 ? '#ef444420' : '#94a3b820'}; color: ${stats.totalUrgentTasks > 0 ? '#ef4444' : '#64748b'}">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">משימות דחופות</div>
                            <div class="stat-value" style="color: ${stats.totalUrgentTasks > 0 ? '#ef4444' : '#1e293b'}">${stats.totalUrgentTasks || 0}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * רינדור רשימת עובדים (קומפקטית)
         * UI/WORKLOAD-DRAWER-2026: Replaced grid with compact list
         */
        renderEmployeesGrid(employees, workloadMap) {
            const html = employees.map(emp => {
                const metrics = workloadMap.get(emp.email);
                if (!metrics) {
return '';
}

                return this.renderEmployeeListRow(emp, metrics);
            }).join('');

            return `<div class="workload-employees-list" id="workloadEmployeesList">${html}</div>`;
        }

        /**
         * UI/WORKLOAD-DRAWER-2026: Render compact employee list row
         */
        renderEmployeeListRow(employee, metrics) {
            const status = metrics.managerRisk?.level || metrics.workloadLevel;
            const statusLabels = {
                low: 'תקין',
                medium: 'גבולי',
                high: 'דורש תשומת לב',
                critical: 'חריג'
            };

            // Extract reasons chips (up to 2)
            const reasonsChips = this.extractReasonsChips(metrics);

            // Status icon
            const statusIcons = {
                low: 'fa-check-circle',
                medium: 'fa-exclamation-circle',
                high: 'fa-exclamation-triangle',
                critical: 'fa-exclamation-triangle'
            };

            return `
                <div class="employee-list-row"
                     data-status="${status}"
                     data-email="${this.sanitize(employee.email)}"
                     onclick="window.workloadDrawer.open('${this.sanitize(employee.email)}')">

                    <!-- Employee Info -->
                    <div class="employee-list-info">
                        <div class="employee-list-name">${this.sanitize(employee.displayName || employee.username)}</div>
                        <div class="employee-list-role">${this.getRoleLabel(employee.role)}</div>
                    </div>

                    <!-- Workload Score -->
                    <div class="employee-list-score">
                        <div class="employee-list-score-value">${metrics.workloadScore}%</div>
                        <div class="employee-list-score-label">עומס</div>
                    </div>

                    <!-- Reasons Chips -->
                    <div class="employee-list-reasons">
                        ${reasonsChips.map(chip => `
                            <div class="employee-reason-chip ${chip.critical ? 'critical' : ''}">
                                <i class="fas ${chip.icon}"></i>
                                ${this.sanitize(chip.text)}
                            </div>
                        `).join('')}
                    </div>

                    <!-- Status Badge -->
                    <div class="employee-list-status">
                        <i class="fas ${statusIcons[status]}"></i>
                        ${statusLabels[status] || 'לא ידוע'}
                    </div>
                </div>
            `;
        }

        /**
         * UI/WORKLOAD-DRAWER-2026: Extract up to 2 reason chips
         * Priority: managerRisk.reasons > critical alerts > high alerts
         */
        extractReasonsChips(metrics) {
            const chips = [];

            // Try managerRisk.reasons first (up to 2)
            if (metrics.managerRisk?.reasons && metrics.managerRisk.reasons.length > 0) {
                const isCritical = metrics.managerRisk.level === 'critical';
                chips.push({
                    text: metrics.managerRisk.reasons[0],
                    icon: 'fa-info-circle',
                    critical: isCritical
                });
                if (metrics.managerRisk.reasons.length > 1) {
                    chips.push({
                        text: metrics.managerRisk.reasons[1],
                        icon: 'fa-info-circle',
                        critical: isCritical
                    });
                }
                return chips;
            }

            // Fallback: alerts (critical first, then high)
            if (metrics.alerts && metrics.alerts.length > 0) {
                const criticalAlerts = metrics.alerts.filter(a => a.severity === 'critical');
                const highAlerts = metrics.alerts.filter(a => a.severity === 'warning');

                if (criticalAlerts.length > 0) {
                    chips.push({
                        text: criticalAlerts[0].message,
                        icon: 'fa-exclamation-triangle',
                        critical: true
                    });
                    if (criticalAlerts.length > 1) {
                        chips.push({
                            text: criticalAlerts[1].message,
                            icon: 'fa-exclamation-triangle',
                            critical: true
                        });
                        return chips;
                    }
                }

                if (highAlerts.length > 0 && chips.length < 2) {
                    chips.push({
                        text: highAlerts[0].message,
                        icon: 'fa-exclamation-circle',
                        critical: false
                    });
                }

                if (chips.length > 0) {
return chips;
}
            }

            // Final fallback: "ללא התראות"
            return [{
                text: 'ללא התראות',
                icon: 'fa-check',
                critical: false
            }];
        }

        /**
         * Manager Summary Line - תמציתי ומדויק
         */
        renderManagerSummary(metrics) {
            const coverage = metrics.next5DaysCoverage;
            const peakMultiplier = metrics.dailyBreakdown?.peakMultiplier || 0;
            const coverageRatio = coverage?.coverageRatio;
            const requiredHours = coverage?.requiredHours || 0;
            const gapHours = coverage?.coverageGap || 0;

            // Priority 1: Coverage gap (most critical)
            if (coverageRatio !== null && coverageRatio < 100 && requiredHours > 0 && gapHours > 0) {
                return `
                    <div class="manager-summary-line critical">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>בסיכון: חסרות ${this.formatHours(gapHours)} ל-5 ימים</span>
                    </div>
                `;
            }

            // Priority 2: Peak overload
            if (peakMultiplier >= 1.2) {
                return `
                    <div class="manager-summary-line warning">
                        <i class="fas fa-chart-line"></i>
                        <span>עומס נקודתי: יום שיא ×${peakMultiplier.toFixed(2)}</span>
                    </div>
                `;
            }

            // No issues - don't show line
            return '';
        }

        /**
         * Manager Insight Row - Modern, clean information display
         */
        renderManagerInsightRow(metrics) {
            const riskLevel = metrics.managerRisk?.level || 'low';
            const reasons = metrics.managerRisk?.reasons || [];
            const confidenceLow = metrics.dataConfidence?.level === 'low';

            // Only show if there's something important to communicate
            if (riskLevel === 'low' && !confidenceLow) {
                return '';
            }

            const firstReason = reasons[0] || '';

            // If confidence is low, show that as priority
            if (confidenceLow) {
                const confidenceReasons = metrics.dataConfidence?.reasons || [];
                const confidenceText = confidenceReasons[0] || 'דיווח שעות נמוך — הנתונים פחות אמינים';
                return `
                    <div class="manager-insight-row" data-level="warning">
                        <svg class="insight-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                        <span class="insight-text">${confidenceText}</span>
                    </div>
                `;
            }

            // Show risk reason
            if (firstReason) {
                return `
                    <div class="manager-insight-row" data-level="${riskLevel}">
                        <svg class="insight-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                        </svg>
                        <span class="insight-text">${firstReason}</span>
                    </div>
                `;
            }

            return '';
        }

        /**
         * Render detailed sections (collapsed by default)
         */
        renderDetailedSections(employee, metrics) {
            return `
                <!-- Old Quick Metrics -->
                <div class="quick-metrics-row">
                    <div class="quick-metric">
                        <i class="fas fa-tasks"></i>
                        <div class="qm-value">${metrics.activeTasksCount || 0}</div>
                        <div class="qm-label">משימות פעילות</div>
                    </div>
                    <div class="quick-metric">
                        <i class="fas fa-clock"></i>
                        <div class="qm-value">${this.formatHours(metrics.totalBacklogHours)}</div>
                        <div class="qm-label">Backlog</div>
                    </div>
                    <div class="quick-metric">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="qm-value">${metrics.tasksWithin24h || 0}</div>
                        <div class="qm-label">דחופות (24h)</div>
                    </div>
                    <div class="quick-metric">
                        <i class="fas fa-battery-three-quarters"></i>
                        <div class="qm-value">${this.formatHours(metrics.availableHoursThisWeek)}</div>
                        <div class="qm-label">זמין השבוע</div>
                    </div>
                </div>
            `;
        }

        /**
         * Helper: Get CSS class for confidence score
         */
        getConfidenceClass(score) {
            if (score === undefined || score === null) {
return '';
}
            if (score < 30) {
return 'reporting-poor';
}
            if (score < 70) {
return 'reporting-medium';
}
            return 'reporting-good';
        }

        /**
         * v4.1: רינדור כרטיס עובד בודד - Modern Dashboard Design
         */
        renderEmployeeCard(employee, metrics) {
            // Status determination: use managerRisk if available, else workload
            const primaryStatus = metrics.managerRisk?.level || metrics.workloadLevel;
            const statusLabels = {
                low: 'תקין',
                medium: 'במעקב',
                high: 'דורש תשומת לב',
                critical: 'קריטי'
            };

            return `
                <div class="employee-workload-card-modern" data-status="${primaryStatus}">
                    <!-- ══════ HEADER ══════ -->
                    <div class="employee-card-header-modern">
                        <div class="employee-identity-modern">
                            <div class="employee-name-modern">${this.sanitize(employee.displayName || employee.username)}</div>
                            <div class="employee-meta-modern">
                                <span class="employee-role-modern">${this.getRoleLabel(employee.role)}</span>
                                <span class="status-dot" data-status="${primaryStatus}"></span>
                                <span class="status-label-modern">${statusLabels[primaryStatus] || 'לא ידוע'}</span>
                            </div>
                        </div>
                        <div class="workload-score-modern">
                            <div class="score-value">${metrics.workloadScore}<span class="score-unit">%</span></div>
                            <div class="score-label">עומס</div>
                        </div>
                    </div>

                    ${this.renderManagerInsightRow(metrics)}

                    <!-- ══════ METRICS GRID - Compact Cards ══════ -->
                    <div class="metrics-grid-compact">
                        <!-- Row 1: Most Important (Priority Order) -->

                        <!-- 1. משימות דחופות - הכי חשוב! -->
                        <div class="metric-card-compact" data-status="${this.getCriticalStatus(metrics.overduePlusDueSoon)}"
                             title="משימות דחופות - מספר המשימות באיחור + משימות עם דדליין ב-3 הימים הקרובים">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" />
                            </svg>
                            <div class="metric-value-compact">${metrics.overduePlusDueSoon || 0}</div>
                            <div class="metric-label-compact">משימות דחופות</div>
                            ${this.getUrgentStatusText(metrics.overduePlusDueSoon)}
                        </div>

                        <!-- 2. עמידה בדדליינים -->
                        <div class="metric-card-compact" data-status="${this.getCoverageStatus(metrics.next5DaysCoverage?.coverageRatio)}"
                             title="עמידה בדדליינים - האם יש מספיק זמן פנוי כדי לעמוד בכל המשימות עם דדליין ב-5 ימים הקרובים">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>
                            <div class="metric-value-compact">${this.formatCoverageRatio(metrics.next5DaysCoverage?.coverageRatio)}</div>
                            <div class="metric-label-compact">עמידה בדדליינים</div>
                            ${this.getCoverageStatusText(metrics.next5DaysCoverage)}
                        </div>

                        <!-- 3. עומס יומי מקסימלי -->
                        <div class="metric-card-compact" data-status="${this.getPeakStatus(metrics.dailyBreakdown?.peakMultiplier)}"
                             title="עומס יומי מקסימלי - מכפלת העומס ביום העמוס ביותר (מתוך 5 ימים הקרובים) לעומת תקן יומי">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                            </svg>
                            <div class="metric-value-compact">×${metrics.dailyBreakdown?.peakMultiplier?.toFixed(2) || '0.00'}</div>
                            <div class="metric-label-compact">עומס יומי מקסימלי</div>
                            ${this.getPeakStatusText(metrics.dailyBreakdown?.peakMultiplier)}
                        </div>

                        <!-- 4. איכות דיווח -->
                        <div class="metric-card-compact" data-status="${this.getConfidenceStatus(metrics.dataConfidence?.score)}"
                             title="איכות דיווח - עקביות דיווח שעות עבודה במהלך החודש (משפיע על דיוק הנתונים)">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
                            </svg>
                            <div class="metric-value-compact">${metrics.dataConfidence?.score !== undefined ? Math.round(metrics.dataConfidence.score) + '%' : '—'}</div>
                            <div class="metric-label-compact">איכות דיווח</div>
                            ${this.getConfidenceStatusText(metrics.dataConfidence, metrics.reportingDays, metrics.workDaysPassed)}
                        </div>

                        <!-- Row 2: Additional Info -->
                        <div class="metric-card-compact" data-status="neutral"
                             title="משימות פעילות - מספר המשימות שהעובד עובד עליהן כרגע">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
                            </svg>
                            <div class="metric-value-compact">${metrics.activeTasksCount || 0}</div>
                            <div class="metric-label-compact">משימות פעילות</div>
                        </div>

                        <div class="metric-card-compact" data-status="neutral"
                             title="Backlog - סך שעות עבודה שנותרו בכל המשימות הפעילות">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                            </svg>
                            <div class="metric-value-compact">${this.formatHours(metrics.totalBacklogHours)}</div>
                            <div class="metric-label-compact">Backlog כולל</div>
                        </div>

                        <div class="metric-card-compact" data-status="neutral"
                             title="זמינות השבוע - כמה שעות עבודה יש לעובד פנויות השבוע הקרוב">
                            <svg class="metric-icon-compact" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd" />
                            </svg>
                            <div class="metric-value-compact">${this.formatHours(metrics.availableHoursThisWeek)}</div>
                            <div class="metric-label-compact">זמינות השבוע</div>
                        </div>
                    </div>

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

            // Already Date object
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
         * UI/WORKLOAD-DRAWER-2026: Removed view toggle (now always list)
         */
        attachEventListeners() {
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

        /**
         * CSS class helpers for new metrics
         */
        getReportingConsistencyClass(consistency) {
            if (consistency === undefined || consistency === null) {
return '';
}
            if (consistency >= 71) {
return 'reporting-good';
}
            if (consistency >= 31) {
return 'reporting-medium';
}
            return 'reporting-poor';
        }

        getCoverageClass(ratio) {
            if (ratio === null || ratio === undefined) {
return '';
}
            if (ratio >= 100) {
return 'coverage-good';
}
            if (ratio >= 80) {
return 'coverage-medium';
}
            return 'coverage-poor';
        }

        getCriticalTasksClass(count) {
            if (!count || count === 0) {
return '';
}
            if (count >= 3) {
return 'critical-high';
}
            if (count >= 1) {
return 'critical-medium';
}
            return '';
        }

        getPeakMultiplierClass(multiplier) {
            if (!multiplier) {
return '';
}
            if (multiplier >= 1.5) {
return 'peak-high';
}
            if (multiplier >= 1.1) {
return 'peak-medium';
}
            return '';
        }

        getCoverageSubtext(coverage) {
            if (!coverage || coverage.coverageRatio === null || coverage.coverageRatio === undefined) {
                return '';
            }

            const gap = coverage.coverageGap || 0;
            if (gap > 0) {
                return `<div class="qm-subtext">חסר ${this.formatHours(gap)}</div>`;
            } else if (gap < 0) {
                return `<div class="qm-subtext">עודף ${this.formatHours(Math.abs(gap))}</div>`;
            }
            return '';
        }

        /**
         * Modern metric helpers - return status for styling
         */
        getCoverageStatus(ratio) {
            if (ratio === null || ratio === undefined) {
return 'neutral';
}
            if (ratio >= 100) {
return 'good';
}
            if (ratio >= 80) {
return 'warning';
}
            return 'critical';
        }

        getPeakStatus(multiplier) {
            if (!multiplier) {
return 'neutral';
}
            if (multiplier >= 1.5) {
return 'critical';
}
            if (multiplier >= 1.1) {
return 'warning';
}
            return 'good';
        }

        getCriticalStatus(count) {
            if (!count || count === 0) {
return 'good';
}
            if (count >= 3) {
return 'critical';
}
            if (count >= 1) {
return 'warning';
}
            return 'good';
        }

        getConfidenceStatus(score) {
            if (score === undefined || score === null) {
return 'neutral';
}
            if (score >= 70) {
return 'good';
}
            if (score >= 30) {
return 'warning';
}
            return 'critical';
        }

        getCoverageSubtextModern(coverage) {
            if (!coverage || coverage.coverageRatio === null || coverage.coverageRatio === undefined) {
                return '';
            }

            const gap = coverage.coverageGap || 0;
            if (gap > 0) {
                return `<div class="metric-subtext-modern">חסר ${this.formatHours(gap)}</div>`;
            } else if (gap < 0) {
                return `<div class="metric-subtext-modern">עודף ${this.formatHours(Math.abs(gap))}</div>`;
            }
            return '<div class="metric-subtext-modern">מכוסה</div>';
        }

        getCoverageGapText(coverage) {
            if (!coverage || coverage.coverageRatio === null || coverage.coverageRatio === undefined) {
                return '';
            }

            const gap = coverage.coverageGap || 0;
            if (gap > 0) {
                return ` (חסר ${this.formatHours(gap)})`;
            } else if (gap < 0) {
                return ` (עודף ${this.formatHours(Math.abs(gap))})`;
            }
            return '';
        }

        getCoverageSubline(coverage) {
            if (!coverage || coverage.coverageRatio === null || coverage.coverageRatio === undefined) {
                return '';
            }

            const gap = coverage.coverageGap || 0;
            if (gap > 0) {
                return `<div class="metric-subline-compact">חסר ${this.formatHours(gap)}</div>`;
            } else if (gap < 0) {
                return `<div class="metric-subline-compact">עודף ${this.formatHours(Math.abs(gap))}</div>`;
            }
            return '';
        }

        /**
         * UX Improvement: Status text helpers - מסביר אם המצב טוב או רע
         */
        getUrgentStatusText(count) {
            if (!count || count === 0) {
                return '<div class="metric-subline-compact status-good">✓ אין משימות דחופות</div>';
            }
            if (count >= 3) {
                return '<div class="metric-subline-compact status-critical">⚠️ דורש טיפול מיידי</div>';
            }
            return '<div class="metric-subline-compact status-warning">⚠️ יש משימות לטיפול</div>';
        }

        getCoverageStatusText(coverage) {
            if (!coverage || coverage.coverageRatio === null || coverage.coverageRatio === undefined) {
                return '<div class="metric-subline-compact">—</div>';
            }

            const ratio = coverage.coverageRatio;
            const gap = coverage.coverageGap || 0;

            if (ratio >= 100) {
                return '<div class="metric-subline-compact status-good">✓ יעמוד בזמנים</div>';
            }
            if (ratio >= 80) {
                return `<div class="metric-subline-compact status-warning">⚠️ חסר ${this.formatHours(gap)}</div>`;
            }
            return `<div class="metric-subline-compact status-critical">❌ חסר ${this.formatHours(gap)}</div>`;
        }

        getPeakStatusText(multiplier) {
            if (!multiplier) {
                return '<div class="metric-subline-compact">—</div>';
            }

            if (multiplier >= 1.5) {
                return '<div class="metric-subline-compact status-critical">❌ עומס יתר גבוה</div>';
            }
            if (multiplier >= 1.1) {
                return '<div class="metric-subline-compact status-warning">⚠️ עומס מעל התקן</div>';
            }
            return '<div class="metric-subline-compact status-good">✓ תקין</div>';
        }

        getConfidenceStatusText(confidence, reportingDays, workDaysPassed) {
            if (!confidence || confidence.score === undefined || confidence.score === null) {
                return '<div class="metric-subline-compact">—</div>';
            }

            const score = confidence.score;
            const daysText = (reportingDays !== undefined && workDaysPassed !== undefined)
                ? `${reportingDays}/${workDaysPassed} ימים`
                : '';

            if (score >= 70) {
                return `<div class="metric-subline-compact status-good">✓ ${daysText || 'דיווח טוב'}</div>`;
            }
            if (score >= 30) {
                return `<div class="metric-subline-compact status-warning">⚠️ ${daysText || 'דיווח חלקי'}</div>`;
            }
            return `<div class="metric-subline-compact status-critical">❌ ${daysText || 'דיווח חסר'}</div>`;
        }

        /**
         * Format coverage ratio to prevent displaying huge percentages
         * Caps display at 100% when there's surplus time
         */
        formatCoverageRatio(ratio) {
            if (ratio === null || ratio === undefined) {
                return '—';
            }

            // Cap display at 100% - no need to show 4,130%
            const displayRatio = Math.min(100, Math.round(ratio));
            return `${displayRatio}%`;
        }

/**
         * UI/WORKLOAD-DRAWER-2026: Render drawer with all employee details
         */
        renderDrawer(employee, metrics, workloadMap) {
            const whyLine = this.getDrawerWhyLine(metrics);
            const whyClass = metrics.managerRisk?.level === 'critical' ? 'critical' :
                            (metrics.managerRisk?.level === 'high' ? '' : 'neutral');

            return `
                <!-- Drawer Overlay -->
                <div class="workload-drawer-overlay" id="workloadDrawerOverlay"></div>

                <!-- Drawer -->
                <div class="workload-drawer" id="workloadDrawer">
                    <!-- Header -->
                    <div class="drawer-header">
                        <div class="drawer-header-top">
                            <div class="drawer-employee-info">
                                <h3>${this.sanitize(employee.displayName || employee.username)}</h3>
                                <div class="role">${this.getRoleLabel(employee.role)}</div>
                            </div>
                            <button class="drawer-close-btn" id="drawerCloseBtn">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        ${whyLine ? `<div class="drawer-why-line ${whyClass}">${whyLine}</div>` : ''}
                    </div>

                    <!-- Content -->
                    <div class="drawer-content">
                        ${this.renderDrawerSectionA(metrics)}
                        ${this.renderDrawerSectionB(metrics)}
                        ${this.renderDrawerSectionC(metrics)}
                        ${this.renderDrawerSectionD(metrics)}
                        ${this.renderDrawerSectionE(metrics, employee)}
                    </div>
                </div>
            `;
        }

        /**
         * UI/WORKLOAD-DRAWER-2026: Get "why" explanation line for drawer header
         */
        getDrawerWhyLine(metrics) {
            // Priority: managerRisk.reasons
            if (metrics.managerRisk?.reasons && metrics.managerRisk.reasons.length > 0) {
                return metrics.managerRisk.reasons.slice(0, 2).join(' • ');
            }

            // Fallback: critical alerts
            if (metrics.alerts && metrics.alerts.length > 0) {
                const critical = metrics.alerts.filter(a => a.severity === 'critical');
                if (critical.length > 0) {
                    return critical.slice(0, 2).map(a => a.message).join(' • ');
                }
            }

            // Neutral fallback
            return 'מצב תקין, אין התראות משמעותיות';
        }

        /**
         * Section A: Workload Overview
         */
        renderDrawerSectionA(metrics) {
            const statusLabels = {
                low: 'זמין',
                medium: 'בינוני',
                high: 'עמוס',
                critical: 'קריטי'
            };
            const status = metrics.managerRisk?.level || metrics.workloadLevel;

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-tachometer-alt"></i>
                        סקירת עומס
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-percentage"></i>
                            ציון עומס
                        </div>
                        <div class="drawer-metric-value">
                            ${metrics.workloadScore}%
                            <div class="drawer-metric-context">100% = ניצול מלא של שעות התקן</div>
                        </div>
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-info-circle"></i>
                            מצב כללי
                        </div>
                        <div class="drawer-metric-value">
                            ${statusLabels[status] || 'לא ידוע'}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Section B: Deadlines & Risk
         */
        renderDrawerSectionB(metrics) {
            const coverage = metrics.next5DaysCoverage || {};
            const coverageRatio = coverage.coverageRatio !== null && coverage.coverageRatio !== undefined
                ? Math.min(100, Math.round(coverage.coverageRatio))
                : null;
            const gap = coverage.coverageGap || 0;

            let gapText = '';
            if (coverageRatio !== null) {
                if (gap > 0) {
                    gapText = `חסר ${this.formatHours(gap)}`;
                } else if (gap < 0) {
                    gapText = `עודף ${this.formatHours(Math.abs(gap))}`;
                } else {
                    gapText = 'מכוסה במלואו';
                }
            }

            const isCritical = metrics.overduePlusDueSoon >= 3;

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-calendar-exclamation"></i>
                        דדליינים וסיכונים
                    </div>
                    <div class="drawer-metric ${isCritical ? 'critical' : ''}">
                        <div class="drawer-metric-label">
                            <i class="fas fa-fire"></i>
                            משימות דחופות
                        </div>
                        <div class="drawer-metric-value">
                            ${metrics.overduePlusDueSoon || 0}
                            <div class="drawer-metric-context">באיחור + 3 ימים קרובים</div>
                        </div>
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-shield-alt"></i>
                            כיסוי 5 ימים
                        </div>
                        <div class="drawer-metric-value">
                            ${coverageRatio !== null ? `${coverageRatio}%` : '—'}
                            ${gapText ? `<div class="drawer-metric-context">${gapText}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Section C: Capacity Context
         */
        renderDrawerSectionC(metrics) {
            const peakMultiplier = metrics.dailyBreakdown?.peakMultiplier;
            const peakDisplay = peakMultiplier ? `×${peakMultiplier.toFixed(2)}` : '—';

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-battery-three-quarters"></i>
                        קיבולת והיקף
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-clock"></i>
                            זמינות השבוע
                        </div>
                        <div class="drawer-metric-value">
                            ${this.formatHours(metrics.availableHoursThisWeek)}
                            <div class="drawer-metric-context">שעות פנויות זמינות</div>
                        </div>
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-chart-bar"></i>
                            עומס יומי מקסימלי
                        </div>
                        <div class="drawer-metric-value">
                            ${peakDisplay}
                            <div class="drawer-metric-context">ביום העמוס ביותר ביחס לתקן</div>
                        </div>
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-tasks"></i>
                            Backlog כולל
                        </div>
                        <div class="drawer-metric-value">
                            ${this.formatHours(metrics.totalBacklogHours)}
                            <div class="drawer-metric-context">שעות עבודה נותרות</div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Section D: Data Quality
         */
        renderDrawerSectionD(metrics) {
            const confidence = metrics.dataConfidence?.score;
            const confidenceDisplay = confidence !== undefined && confidence !== null
                ? `${Math.round(confidence)}%`
                : '—';

            let qualityText = '';
            if (confidence !== undefined) {
                if (confidence >= 70) {
                    qualityText = 'דיווח עקבי ואמין';
                } else if (confidence >= 30) {
                    qualityText = 'דיווח חלקי';
                } else {
                    qualityText = 'דיווח חסר';
                }
            }

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-chart-line"></i>
                        איכות נתונים
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-clipboard-check"></i>
                            אמון בנתונים
                        </div>
                        <div class="drawer-metric-value">
                            ${confidenceDisplay}
                            ${qualityText ? `<div class="drawer-metric-context">${qualityText}</div>` : ''}
                        </div>
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-list"></i>
                            משימות פעילות
                        </div>
                        <div class="drawer-metric-value">
                            ${metrics.activeTasksCount || 0}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Section E: Trends (Weekly Breakdown)
         */
        renderDrawerSectionE(metrics, employee) {
            const dailyBreakdown = metrics.dailyBreakdown;
            if (!dailyBreakdown || !dailyBreakdown.dailyLoads) {
                return `
                    <div class="drawer-section">
                        <div class="drawer-section-title">
                            <i class="fas fa-calendar-week"></i>
                            מגמות שבועיות
                        </div>
                        <p style="color: #64748b; font-size: 0.875rem;">אין נתונים זמינים</p>
                    </div>
                `;
            }

            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;

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
                    load: dailyBreakdown.dailyLoads[dateKey] || 0,
                    dayName: this.getDayName(date)
                });
            }

            const maxLoad = Math.max(...next5Days.map(d => d.load), dailyTarget);

            const chartHtml = next5Days.map(day => {
                const heightPercent = maxLoad > 0 ? (day.load / maxLoad) * 100 : 0;
                const isOverloaded = day.load > dailyTarget;

                return `
                    <div class="drawer-daily-bar-wrapper">
                        <div class="drawer-daily-bar-value">${this.formatHours(day.load)}</div>
                        <div class="drawer-daily-bar ${isOverloaded ? 'overloaded' : ''}"
                             style="height: ${heightPercent}%">
                        </div>
                        <div class="drawer-daily-bar-label">${day.dayName}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-calendar-week"></i>
                        פירוט שבועי
                    </div>
                    <div class="drawer-weekly-chart">
                        ${chartHtml}
                    </div>
                </div>
            `;
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
    // UI/WORKLOAD-DRAWER-2026: Drawer Manager
    // ═══════════════════════════════════════════════════════════════

    /**
     * Global drawer manager for workload details
     */
    window.workloadDrawer = {
        isOpen: false,
        currentEmail: null,

        /**
         * Open drawer for specific employee
         */
        open(employeeEmail) {
            const workloadCard = window.WorkloadCard;
            if (!workloadCard || !workloadCard.employees || !workloadCard.workloadMap) {
                console.error('❌ Workload data not available');
                return;
            }

            // Find employee
            const employee = workloadCard.employees.find(e => e.email === employeeEmail);
            if (!employee) {
                console.error('❌ Employee not found:', employeeEmail);
                return;
            }

            // Get metrics
            const metrics = workloadCard.workloadMap.get(employeeEmail);
            if (!metrics) {
                console.error('❌ Metrics not found for:', employeeEmail);
                return;
            }

            // Render drawer
            const container = document.getElementById('workloadDrawerContainer');
            if (!container) {
                console.error('❌ Drawer container not found');
                return;
            }

            container.innerHTML = workloadCard.renderDrawer(employee, metrics, workloadCard.workloadMap);

            // Activate drawer
            this.currentEmail = employeeEmail;
            this.isOpen = true;

            // Add event listeners
            setTimeout(() => {
                const overlay = document.getElementById('workloadDrawerOverlay');
                const drawer = document.getElementById('workloadDrawer');
                const closeBtn = document.getElementById('drawerCloseBtn');

                if (overlay && drawer) {
                    overlay.classList.add('active');
                    drawer.classList.add('active');

                    // Lock body scroll
                    document.body.style.overflow = 'hidden';
                }

                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.close());
                }

                if (overlay) {
                    overlay.addEventListener('click', () => this.close());
                }

                // Escape key
                document.addEventListener('keydown', this.handleEscapeKey);
            }, 10);

            console.log('✅ Drawer opened for:', employeeEmail);
        },

        /**
         * Close drawer
         */
        close() {
            const overlay = document.getElementById('workloadDrawerOverlay');
            const drawer = document.getElementById('workloadDrawer');

            if (overlay && drawer) {
                overlay.classList.remove('active');
                drawer.classList.remove('active');

                // Unlock body scroll
                document.body.style.overflow = '';
            }

            // Remove escape listener
            document.removeEventListener('keydown', this.handleEscapeKey);

            // Clear after animation
            setTimeout(() => {
                const container = document.getElementById('workloadDrawerContainer');
                if (container) {
                    container.innerHTML = '';
                }
                this.isOpen = false;
                this.currentEmail = null;
            }, 300);

            console.log('✅ Drawer closed');
        },

        /**
         * Handle escape key
         */
        handleEscapeKey(e) {
            if (e.key === 'Escape' && window.workloadDrawer.isOpen) {
                window.workloadDrawer.close();
            }
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
