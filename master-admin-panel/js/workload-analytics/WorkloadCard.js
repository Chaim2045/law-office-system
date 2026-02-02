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

                <!-- KEYBOARD NAVIGATION - 2026: Hints Bar -->
                <div class="keyboard-hints-bar">
                    <div class="keyboard-hint">
                        <span class="keyboard-hint-key">↑↓</span>
                        <span class="keyboard-hint-label">ניווט</span>
                    </div>
                    <div class="keyboard-hint">
                        <span class="keyboard-hint-key">Enter</span>
                        <span class="keyboard-hint-label">פתיחה</span>
                    </div>
                    <div class="keyboard-hint">
                        <span class="keyboard-hint-key">Esc</span>
                        <span class="keyboard-hint-label">סגירה</span>
                    </div>
                    <div class="keyboard-hint">
                        <span class="keyboard-hint-key">/</span>
                        <span class="keyboard-hint-label">חיפוש</span>
                    </div>
                    <div class="keyboard-hint">
                        <span class="keyboard-hint-key">1-3</span>
                        <span class="keyboard-hint-label">סינון</span>
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
         * GITHUB-PROJECTS-STYLE: Group employees by status
         */
        groupEmployeesByStatus(employees, workloadMap) {
            const groups = {
                critical: { title: 'עומס קריטי', icon: 'fa-exclamation-triangle', employees: [] },
                high: { title: 'דורש תשומת לב', icon: 'fa-exclamation-circle', employees: [] },
                medium: { title: 'עומס בינוני', icon: 'fa-info-circle', employees: [] },
                low: { title: 'תקין', icon: 'fa-check-circle', employees: [] }
            };

            employees.forEach(emp => {
                const metrics = workloadMap.get(emp.email);
                if (!metrics) {
return;
}

                const status = metrics.managerRisk?.level || metrics.workloadLevel;
                if (groups[status]) {
                    groups[status].employees.push({ employee: emp, metrics });
                }
            });

            return groups;
        }

        /**
         * GITHUB-PROJECTS-STYLE: Render grouped table
         */
        renderEmployeesGrid(employees, workloadMap) {
            const groups = this.groupEmployeesByStatus(employees, workloadMap);

            const groupsHtml = Object.entries(groups)
                .filter(([_, group]) => group.employees.length > 0)
                .map(([status, group]) => {
                    return this.renderEmployeeGroup(status, group);
                }).join('');

            return `<div class="workload-employees-table" id="workloadEmployeesList">${groupsHtml}</div>`;
        }

        /**
         * GITHUB-PROJECTS-STYLE: Render single group with collapse
         */
        renderEmployeeGroup(status, group) {
            const groupId = `group-${status}`;
            const count = group.employees.length;

            const rowsHtml = group.employees.map(({ employee, metrics }) => {
                return this.renderEmployeeListRow(employee, metrics);
            }).join('');

            return `
                <div class="employee-group" data-status="${status}" data-collapsed="false">
                    <div class="group-header" onclick="window.toggleEmployeeGroup('${groupId}')">
                        <i class="fas fa-chevron-down group-chevron" id="${groupId}-chevron"></i>
                        <i class="fas ${group.icon} group-icon"></i>
                        <span class="group-title">${group.title}</span>
                        <span class="group-count">${count}</span>
                    </div>
                    <div class="group-rows" id="${groupId}">
                        ${rowsHtml}
                    </div>
                </div>
            `;
        }

        /**
         * NARRATIVE-DATA-GRID-2026: Generate status sentence (headline + why line)
         */
        generateStatusSentence(metrics) {
            const status = metrics.managerRisk?.level || metrics.workloadLevel;

            // Critical: עומס חריג
            if (status === 'critical') {
                const hasOverdueFiles = metrics.overdueFiles > 0;
                const hasHighUrgent = metrics.next5DaysUrgent >= 5;
                const hasLowAvailability = (metrics.next5DaysAvailable || 0) < 20;

                if (hasOverdueFiles && hasHighUrgent) {
                    return {
                        headline: 'חריג השבוע',
                        why: 'הצטברות תיקים דחופים עם איחורים קיימים'
                    };
                }
                if (hasHighUrgent && hasLowAvailability) {
                    return {
                        headline: 'דורש תשומת לב',
                        why: 'בעיקר בגלל דדליינים קרובים וזמינות נמוכה'
                    };
                }
                if (hasOverdueFiles) {
                    return {
                        headline: 'חריג השבוע',
                        why: 'יש תיקים באיחור שדורשים טיפול מיידי'
                    };
                }
                return {
                    headline: 'דורש תשומת לב',
                    why: 'עומס גבוה עם מספר גורמים מצטברים'
                };
            }

            // High: דורש תשומת לב
            if (status === 'high') {
                const peakMultiplier = metrics.dailyBreakdown?.peakMultiplier || 0;
                const hasHighUrgent = metrics.next5DaysUrgent >= 3;

                if (peakMultiplier >= 1.5 && hasHighUrgent) {
                    return {
                        headline: 'דורש תשומת לב',
                        why: 'שיא עומס זמני עם התחייבויות קרובות'
                    };
                }
                if (hasHighUrgent) {
                    return {
                        headline: 'דורש תשומת לב',
                        why: 'בעיקר בגלל ריכוז דדליינים בטווח הקרוב'
                    };
                }
                return {
                    headline: 'דורש תשומת לב',
                    why: 'עומס מעל הממוצע אך ניתן לניהול'
                };
            }

            // Medium: תקין עם הערות
            if (status === 'medium') {
                const hasNoData = (metrics.reportingDaysRatio || 0) < 0.5;
                if (hasNoData) {
                    return {
                        headline: 'תקין',
                        why: 'אך קשה להעריך בדיוק בגלל חוסר בנתונים'
                    };
                }
                return {
                    headline: 'תקין',
                    why: 'כמות תיקים גבוהה אך ללא חריגות'
                };
            }

            // Low: תקין או תת-תפוסה
            if (metrics.workloadScore < 30) {
                return {
                    headline: 'תקין',
                    why: 'מתחת לתפוסה הרגילה באופן ניכר'
                };
            }

            return {
                headline: 'תקין',
                why: 'מצב מאוזן ללא התראות משמעותיות'
            };
        }

        /**
         * GITHUB-PROJECTS-STYLE: Render table row with pills & progress
         */
        renderNarrativeGridRow(employee, metrics) {
            const status = metrics.managerRisk?.level || metrics.workloadLevel;
            const sentence = this.generateStatusSentence(metrics);

            // Pills & badges
            const statusPill = this.renderStatusPill(status);
            const rolePill = this.renderRolePill(employee.role);

            // Progress bar for workload
            const workloadPercent = metrics.workloadScore || 0;
            const progressBar = this.renderInlineProgress(workloadPercent, status);

            // Key metrics
            const deadlines = metrics.next5DaysUrgent || 0;
            const availability = Math.round(metrics.next5DaysAvailable || 0);

            return `
                <div class="narrative-grid-row"
                     data-status="${status}"
                     data-email="${this.sanitize(employee.email)}"
                     onclick="window.workloadDrawer.open('${this.sanitize(employee.email)}')">

                    <!-- Column 1: Employee + Role Pill -->
                    <div class="grid-col-employee">
                        <div class="grid-employee-name">${this.sanitize(employee.displayName || employee.username)}</div>
                        ${rolePill}
                    </div>

                    <!-- Column 2: Task/Description -->
                    <div class="grid-col-task">
                        <div class="grid-task-title">${sentence.why}</div>
                    </div>

                    <!-- Column 3: Status Pill -->
                    <div class="grid-col-status-pill">
                        ${statusPill}
                    </div>

                    <!-- Column 4: Workload Progress -->
                    <div class="grid-col-progress">
                        ${progressBar}
                    </div>

                    <!-- Column 5: Assignee (avatar would go here) -->
                    <div class="grid-col-assignee">
                        <div class="assignee-avatar">${this.getInitials(employee.displayName || employee.username)}</div>
                    </div>
                </div>
            `;
        }

        /**
         * GITHUB-PROJECTS-STYLE: Render status pill
         */
        renderStatusPill(status) {
            const statusConfig = {
                critical: { label: 'פיגור', icon: 'fa-exclamation-triangle', class: 'status-behind' },
                high: { label: 'סיכון', icon: 'fa-exclamation-circle', class: 'status-at-risk' },
                medium: { label: 'תקין', icon: 'fa-circle', class: 'status-on-track' },
                low: { label: 'הושלם', icon: 'fa-check-circle', class: 'status-complete' }
            };

            const config = statusConfig[status] || statusConfig.low;

            return `
                <span class="status-pill ${config.class}">
                    <i class="fas ${config.icon}"></i>
                    ${config.label}
                </span>
            `;
        }

        /**
         * GITHUB-PROJECTS-STYLE: Render role pill
         */
        renderRolePill(role) {
            const roleIcons = {
                lawyer: 'fa-briefcase',
                paralegal: 'fa-file-alt',
                admin: 'fa-user-cog'
            };

            const icon = roleIcons[role] || 'fa-user';

            return `<span class="role-pill"><i class="fas ${icon}"></i> ${this.getRoleLabel(role)}</span>`;
        }

        /**
         * GITHUB-PROJECTS-STYLE: Render inline progress bar
         */
        renderInlineProgress(percent, status) {
            const isCritical = status === 'critical' || status === 'high';
            const barClass = isCritical ? 'progress-critical' : 'progress-normal';

            return `
                <div class="inline-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${barClass}" style="width: ${percent}%"></div>
                    </div>
                    <span class="progress-label">${percent}%</span>
                </div>
            `;
        }

        /**
         * Helper: Get initials for avatar
         */
        getInitials(name) {
            if (!name) {
return '?';
}
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return parts[0][0] + parts[1][0];
            }
            return name.substring(0, 2);
        }

        /**
         * DEPRECATED: Old list row - kept for reference during migration
         */
        renderEmployeeListRow(employee, metrics) {
            return this.renderNarrativeGridRow(employee, metrics);
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
                    icon: 'fa-circle',
                    critical: isCritical
                });
                if (metrics.managerRisk.reasons.length > 1) {
                    chips.push({
                        text: metrics.managerRisk.reasons[1],
                        icon: 'fa-circle',
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
                        icon: 'fa-circle',
                        critical: true
                    });
                    if (criticalAlerts.length > 1) {
                        chips.push({
                            text: criticalAlerts[1].message,
                            icon: 'fa-circle',
                            critical: true
                        });
                        return chips;
                    }
                }

                if (highAlerts.length > 0 && chips.length < 2) {
                    chips.push({
                        text: highAlerts[0].message,
                        icon: 'fa-circle',
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
                icon: 'fa-circle',
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

            // Today
            if (diffDays === 0) {
return 'היום';
}

            // Tomorrow
            if (diffDays === 1) {
return 'מחר';
}

            // Future (next 6 days)
            if (diffDays > 1 && diffDays < 7) {
return `בעוד ${diffDays} ימים`;
}

            // Yesterday
            if (diffDays === -1) {
return 'אתמול';
}

            // Past (last 6 days)
            if (diffDays < 0 && diffDays >= -6) {
return `לפני ${Math.abs(diffDays)} ימים`;
}

            // All other dates: show DD/MM format
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
         * NARRATIVE-DATA-GRID-2026: Get severity hint (textual only)
         */
        getSeverityHint(metrics) {
            const status = metrics.managerRisk?.level || metrics.workloadLevel;

            if (status === 'critical') {
                const hasOverdueFiles = metrics.overdueFiles > 0;
                if (hasOverdueFiles) {
                    return 'דורש תשומת לב';
                }
                return 'לטפל בטווח הקרוב';
            }

            if (status === 'high') {
                return 'לטפל בטווח הקרוב';
            }

            if (status === 'medium') {
                const hasNoData = (metrics.reportingDaysRatio || 0) < 0.5;
                if (hasNoData) {
                    return 'מעקב - נתונים חסרים';
                }
                return 'מעקב';
            }

            if (metrics.workloadScore < 30) {
                return 'מעקב - תת תפוסה';
            }

            return 'מעקב';
        }

        /**
         * NARRATIVE-DATA-GRID-2026: Render drawer with insight-first top section
         */
        renderDrawer(employee, metrics, workloadMap) {
            const sentence = this.generateStatusSentence(metrics);
            const severityHint = this.getSeverityHint(metrics);

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

                        <!-- Insight-First Section -->
                        <div class="drawer-insight-section">
                            <div class="drawer-insight-headline">${sentence.headline}</div>
                            <div class="drawer-insight-why">${sentence.why}</div>
                            <div class="drawer-severity-hint">${severityHint}</div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="drawer-content">
                        ${this.renderDrawerStatusExplanation(metrics)}
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
         * Status Explanation Section - explains WHY the employee has this status
         */
        renderDrawerStatusExplanation(metrics) {
            const status = metrics.managerRisk?.level || metrics.workloadLevel;
            const reasons = metrics.managerRisk?.reasons || [];

            // If status is good (תקין/הושלם), no need for detailed explanation
            if (status === 'medium' || status === 'low') {
                return '';
            }

            // Status configuration
            const statusConfig = {
                critical: {
                    label: 'פיגור',
                    icon: 'fa-exclamation-triangle',
                    color: '#dc2626',
                    bgColor: '#fef2f2',
                    title: 'למה העובד בפיגור?'
                },
                high: {
                    label: 'סיכון',
                    icon: 'fa-exclamation-circle',
                    color: '#ea580c',
                    bgColor: '#fff7ed',
                    title: 'למה העובד בסיכון?'
                }
            };

            const config = statusConfig[status];
            if (!config || reasons.length === 0) {
                return '';
            }

            // Build reasons list
            const reasonsHtml = reasons.map(reason => `
                <div class="drawer-explanation-item">
                    <i class="fas fa-circle" style="font-size: 0.375rem; color: ${config.color}; margin-top: 6px;"></i>
                    <span>${this.sanitize(reason)}</span>
                </div>
            `).join('');

            return `
                <div class="drawer-explanation-section" style="--status-color: ${config.color}; --status-bg: ${config.bgColor};">
                    <div class="drawer-explanation-header">
                        <i class="fas ${config.icon}"></i>
                        <span>${config.title}</span>
                    </div>
                    <div class="drawer-explanation-content">
                        ${reasonsHtml}
                    </div>
                    <div class="drawer-explanation-footer">
                        <i class="fas fa-lightbulb"></i>
                        הנתונים המפורטים להלן מסבירים את הסיבות המדוייקות למצב זה
                    </div>
                </div>
            `;
        }

        /**
         * Section A: Workload Overview
         */
        renderDrawerSectionA(metrics) {
            const status = metrics.managerRisk?.level || metrics.workloadLevel;
            const statusPill = this.renderStatusPill(status);
            const score = metrics.workloadScore;
            const activeTasks = metrics.activeTasksCount || 0;
            const backlogHours = metrics.totalBacklogHours || 0;
            const availableHours = metrics.availableHoursThisWeek || 0;

            // Behavioral insight based on score
            let scoreInsight = '';
            if (score <= 50) {
                scoreInsight = `<div class="drawer-metric-insight"><i class="fas fa-check-circle"></i><span><strong>תת-ניצול:</strong> ${activeTasks} משימות פעילות, ${this.formatHours(availableHours)} זמינות השבוע</span></div>`;
            } else if (score <= 85) {
                scoreInsight = `<div class="drawer-metric-insight"><i class="fas fa-check-circle"></i><span><strong>ניצול טוב:</strong> ${activeTasks} משימות פעילות בטווח מאוזן</span></div>`;
            } else if (score <= 110) {
                scoreInsight = `<div class="drawer-metric-insight"><i class="fas fa-info-circle"></i><span><strong>עומס גבוה:</strong> ניצול ${score}% - ${activeTasks} משימות פעילות, ${this.formatHours(backlogHours)} שעות עבודה ממתינות</span></div>`;
            } else {
                const overload = score - 100;
                scoreInsight = `<div class="drawer-metric-insight"><i class="fas fa-exclamation-triangle"></i><span><strong>עומס יתר:</strong> חריגה של ${overload}% מעל 100% קיבולת שבועית - ${activeTasks} משימות פעילות</span></div>`;
            }

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-gauge-high"></i>
                        מצב עומס כללי
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-percent"></i>
                            ניצול קיבולת
                        </div>
                        <div class="drawer-metric-value">
                            ${score}%
                            <div class="drawer-metric-context">100% = ניצול מלא של זמן פנוי</div>
                        </div>
                    </div>
                    ${scoreInsight}
                    <div class="drawer-metric" style="margin-top: 12px;">
                        <div class="drawer-metric-label">
                            <i class="fas fa-signal"></i>
                            סטטוס כללי
                        </div>
                        <div class="drawer-metric-value">
                            ${statusPill}
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

            const urgentCount = metrics.overduePlusDueSoon || 0;
            const isCritical = urgentCount >= 3;
            const activeTasks = metrics.activeTasksCount || 0;
            const taskQuality = metrics.taskQuality || {};
            const shouldBeClosed = taskQuality.shouldBeClosedCount || 0;
            const nearComplete = taskQuality.nearCompleteCount || 0;

            // Behavioral insights
            let urgentInsight = '';
            if (urgentCount === 0) {
                urgentInsight = `<div class="drawer-metric-insight"><i class="fas fa-check-circle"></i><span><strong>מצוין:</strong> 0 משימות דחופות מתוך ${activeTasks} פעילות</span></div>`;
            } else if (urgentCount <= 2) {
                const qualityNote = shouldBeClosed > 0 ? ` (${shouldBeClosed} משימות עברו deadline ב-80%+ תקציב)` : '';
                urgentInsight = `<div class="drawer-metric-insight"><i class="fas fa-info-circle"></i><span><strong>דחיפות נמוכה:</strong> ${urgentCount} משימות דחופות מתוך ${activeTasks} פעילות${qualityNote}</span></div>`;
            } else {
                const percent = activeTasks > 0 ? Math.round((urgentCount / activeTasks) * 100) : 0;
                const qualityNote = shouldBeClosed > 0 ? ` | ${shouldBeClosed} משימות צריכות סגירה` : '';
                urgentInsight = `<div class="drawer-metric-insight"><i class="fas fa-exclamation-triangle"></i><span><strong>דחיפות גבוהה:</strong> ${urgentCount} משימות דחופות (${percent}% מכלל המשימות)${qualityNote}</span></div>`;
            }

            let coverageInsight = '';
            if (coverageRatio !== null) {
                if (coverageRatio >= 100) {
                    coverageInsight = '<div class="drawer-metric-insight"><i class="fas fa-shield-check"></i><span><strong>כיסוי מלא:</strong> יש מספיק זמן לכל המשימות ב-5 הימים הקרובים</span></div>';
                } else if (coverageRatio >= 70) {
                    coverageInsight = `<div class="drawer-metric-insight"><i class="fas fa-info-circle"></i><span><strong>כיסוי ${coverageRatio}%:</strong> חסר ${this.formatHours(gap)} ב-5 ימים הקרובים</span></div>`;
                } else {
                    coverageInsight = `<div class="drawer-metric-insight"><i class="fas fa-exclamation-triangle"></i><span><strong>כיסוי ${coverageRatio}%:</strong> חסר ${this.formatHours(gap)} ב-5 ימים הקרובים</span></div>`;
                }
            }

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-calendar-exclamation"></i>
                        דחיפות ולחץ זמן
                    </div>
                    <div class="drawer-metric ${isCritical ? 'critical' : ''}">
                        <div class="drawer-metric-label">
                            <i class="fas fa-fire"></i>
                            משימות דחופות
                        </div>
                        <div class="drawer-metric-value">
                            ${urgentCount}
                            <div class="drawer-metric-context">באיחור או דדליין ב-3 ימים הקרובים</div>
                        </div>
                    </div>
                    ${urgentInsight}
                    <div class="drawer-metric" style="margin-top: 12px;">
                        <div class="drawer-metric-label">
                            <i class="fas fa-hourglass-half"></i>
                            כיסוי זמן - 5 ימים
                        </div>
                        <div class="drawer-metric-value">
                            ${coverageRatio !== null ? `${coverageRatio}%` : '—'}
                            ${gapText ? `<div class="drawer-metric-context">${gapText}</div>` : ''}
                        </div>
                    </div>
                    ${coverageInsight}
                </div>
            `;
        }

        /**
         * Section C: Capacity Context
         */
        renderDrawerSectionC(metrics) {
            const peakMultiplier = metrics.dailyBreakdown?.peakMultiplier;
            const peakDisplay = peakMultiplier ? `×${peakMultiplier.toFixed(2)}` : '—';
            const backlogHours = metrics.totalBacklogHours || 0;
            const availableHours = metrics.availableHoursThisWeek || 0;
            const activeTasks = metrics.activeTasksCount || 0;

            // Backlog behavioral insight
            let backlogInsight = '';
            if (backlogHours === 0) {
                backlogInsight = '<div class="drawer-metric-insight"><i class="fas fa-check-circle"></i><span><strong>אין עבודה ממתינה:</strong> כל המשימות בוצעו או מתוזמנות</span></div>';
            } else if (backlogHours <= 40) {
                const weeksToComplete = availableHours > 0 ? (backlogHours / availableHours).toFixed(1) : '?';
                backlogInsight = `<div class="drawer-metric-insight"><i class="fas fa-info-circle"></i><span><strong>עבודה ממתינה ${this.formatHours(backlogHours)}:</strong> ${activeTasks} משימות פעילות, הערכה לסיום: ~${weeksToComplete} שבועות</span></div>`;
            } else if (backlogHours <= 80) {
                const weeksToComplete = availableHours > 0 ? (backlogHours / availableHours).toFixed(1) : '?';
                backlogInsight = `<div class="drawer-metric-insight"><i class="fas fa-exclamation-circle"></i><span><strong>עבודה ממתינה ${this.formatHours(backlogHours)}:</strong> ${activeTasks} משימות פעילות, הערכה לסיום: ~${weeksToComplete} שבועות</span></div>`;
            } else {
                const weeksToComplete = availableHours > 0 ? (backlogHours / availableHours).toFixed(1) : '?';
                backlogInsight = `<div class="drawer-metric-insight"><i class="fas fa-exclamation-triangle"></i><span><strong>עבודה ממתינה ${this.formatHours(backlogHours)}:</strong> ${activeTasks} משימות פעילות, הערכה לסיום: ~${weeksToComplete} שבועות</span></div>`;
            }

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-chart-line"></i>
                        נתח עבודה וקיבולת
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-clipboard-list"></i>
                            עבודה ממתינה (Backlog)
                        </div>
                        <div class="drawer-metric-value">
                            ${this.formatHours(backlogHours)}
                            <div class="drawer-metric-context">שעות עבודה שנותרו לביצוע</div>
                        </div>
                    </div>
                    ${backlogInsight}
                    <div class="drawer-metric" style="margin-top: 12px;">
                        <div class="drawer-metric-label">
                            <i class="fas fa-business-time"></i>
                            זמן פנוי השבוע
                        </div>
                        <div class="drawer-metric-value">
                            ${this.formatHours(metrics.availableHoursThisWeek)}
                            <div class="drawer-metric-context">שעות זמינות להקצאה חדשה</div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Section D: Data Quality (v6.0 - Enhanced with breakdown)
         */
        renderDrawerSectionD(metrics) {
            const dataReliability = metrics.dataConfidence;
            const score = dataReliability?.score;
            const level = dataReliability?.level;
            const components = dataReliability?.components || {};

            const confidenceDisplay = score !== undefined && score !== null
                ? `${Math.round(score)}%`
                : '—';

            // קביעת טקסט רמה ותובנה
            let levelText = '';
            let levelClass = '';
            let confidenceInsight = '';

            if (level === 'high') {
                levelText = 'גבוהה';
                levelClass = 'status-success';
                confidenceInsight = '<div class="drawer-metric-insight"><i class="fas fa-check-circle"></i><span><strong>נתונים אמינים:</strong> ניתן לסמוך על הנתונים לקבלת החלטות</span></div>';
            } else if (level === 'medium') {
                levelText = 'בינונית';
                levelClass = 'status-warning';
                const mediumDetails = (dataReliability?.details || []).find(d => d.type === 'temporal') || {};
                const reportingDays = mediumDetails.reportingDays || 0;
                const workDays = mediumDetails.workDaysPassed || 0;
                confidenceInsight = `<div class="drawer-metric-insight"><i class="fas fa-info-circle"></i><span><strong>נתונים חלקיים:</strong> דיווח ב-${reportingDays} מתוך ${workDays} ימים</span></div>`;
            } else if (level === 'low') {
                levelText = 'נמוכה';
                levelClass = 'status-behind';
                const lowDetails = (dataReliability?.details || []).find(d => d.type === 'coverage') || {};
                const tasksWithReporting = lowDetails.tasksWithReporting || 0;
                const totalTasks = lowDetails.totalActiveTasks || 0;
                confidenceInsight = `<div class="drawer-metric-insight"><i class="fas fa-exclamation-triangle"></i><span><strong>נתונים לא מספיקים:</strong> ${tasksWithReporting}/${totalTasks} משימות עם דיווח</span></div>`;
            } else if (level === 'critical') {
                levelText = 'קריטית';
                levelClass = 'status-critical';
                confidenceInsight = '<div class="drawer-metric-insight critical"><i class="fas fa-times-circle"></i><span><strong>אין נתונים!</strong> לא ניתן להסתמך על המספרים</span></div>';
            }

            // בניית פירוט החישוב
            const breakdownHTML = this.renderReliabilityBreakdown(components, dataReliability?.details || []);

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-database"></i>
                        מהימנות הנתונים
                    </div>
                    <div class="drawer-metric">
                        <div class="drawer-metric-label">
                            <i class="fas fa-chart-pie"></i>
                            רמת אמינות
                        </div>
                        <div class="drawer-metric-value">
                            ${confidenceDisplay} <span class="${levelClass}" style="font-size: 0.875rem; font-weight: 500;">(${levelText})</span>
                            <div class="drawer-metric-context">מבוסס על 3 פרמטרים</div>
                        </div>
                    </div>
                    ${confidenceInsight}

                    ${breakdownHTML}

                    <div class="drawer-metric" style="margin-top: 12px;">
                        <div class="drawer-metric-label">
                            <i class="fas fa-tasks"></i>
                            משימות פעילות
                        </div>
                        <div class="drawer-metric-value">
                            ${metrics.activeTasksCount || 0}
                            <div class="drawer-metric-context">משימות שהעובד עובד עליהן כעת</div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * v6.0: Render detailed reliability breakdown
         * הסבר מפורט בשפה מובנת למנהל
         */
        renderReliabilityBreakdown(components, details) {
            const temporal = components.temporalReporting || 0;
            const coverage = components.taskCoverage || 0;
            const quality = components.qualityScore || 0;

            // חילוץ פרטים מספריים מ-details
            const temporalDetails = details.find(d => d.type === 'temporal') || {};
            const coverageDetails = details.find(d => d.type === 'coverage') || {};
            const qualityDetails = details.find(d => d.type === 'quality') || {};

            // בניית טקסטים מפורטים
            const temporalText = temporalDetails.reportingDays !== undefined
                ? `דיווח ב-${temporalDetails.reportingDays} מתוך ${temporalDetails.workDaysPassed} ימי עבודה השבוע`
                : 'האם העובד דיווח שעות עבודה ברוב ימי השבוע?';

            const coverageText = coverageDetails.tasksWithReporting !== undefined
                ? `${coverageDetails.tasksWithReporting} מתוך ${coverageDetails.totalActiveTasks} משימות עם דיווח שעות`
                : 'על כמה אחוזים מהמשימות הפעילות יש דיווחי זמן?';

            let qualityText;
            if (qualityDetails.overdueNoReportCount > 0) {
                qualityText = `${qualityDetails.overdueNoReportCount} משימות באיחור ללא דיווח`;
            } else if (qualityDetails.staleCount > 0) {
                qualityText = `${qualityDetails.staleCount} משימות ללא עדכון 30+ ימים`;
            } else {
                // אין בעיות - מציג 0
                qualityText = '0 משימות באיחור, כל המשימות מעודכנות';
            }

            return `
                <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; border-right: 3px solid #3b82f6;">
                    <div style="font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                        <i class="fas fa-calculator" style="margin-left: 6px; color: #3b82f6;"></i>
                        איך הגענו ל-${Math.round(components.temporalReporting * 0.3 + components.taskCoverage * 0.35 + components.qualityScore * 0.35)}%?
                    </div>
                    <div class="reliability-calculation" style="font-size: 0.7rem; color: #64748b; margin-bottom: 12px; padding-right: 22px; direction: ltr; text-align: left;">
                        (${Math.round(temporal)}×30% + ${Math.round(coverage)}×35% + ${Math.round(quality)}×35% = ${Math.round(temporal * 0.3 + coverage * 0.35 + quality * 0.35)}%)
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.8125rem;">
                        <!-- דיווח יומי -->
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #64748b;">
                                    <i class="fas fa-calendar-day" style="width: 16px; margin-left: 6px; color: #64748b;"></i>
                                    דיווח יומי (30%)
                                </span>
                                <span style="font-weight: 600; color: ${temporal >= 70 ? '#10b981' : temporal >= 30 ? '#f59e0b' : '#ef4444'};">
                                    ${Math.round(temporal)}%
                                </span>
                            </div>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; padding-right: 22px;">
                                ${temporalText}
                            </div>
                        </div>

                        <!-- כיסוי משימות -->
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #64748b;">
                                    <i class="fas fa-list-check" style="width: 16px; margin-left: 6px; color: #64748b;"></i>
                                    כיסוי משימות (35%)
                                </span>
                                <span style="font-weight: 600; color: ${coverage >= 80 ? '#10b981' : coverage >= 50 ? '#f59e0b' : '#ef4444'};">
                                    ${Math.round(coverage)}%
                                </span>
                            </div>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; padding-right: 22px;">
                                ${coverageText}
                            </div>
                        </div>

                        <!-- איכות ניהול -->
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #64748b;">
                                    <i class="fas fa-clipboard-check" style="width: 16px; margin-left: 6px; color: #64748b;"></i>
                                    איכות ניהול (35%)
                                </span>
                                <span style="font-weight: 600; color: ${quality >= 80 ? '#10b981' : quality >= 50 ? '#f59e0b' : '#ef4444'};">
                                    ${Math.round(quality)}%
                                </span>
                            </div>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; padding-right: 22px;">
                                ${qualityText}
                            </div>
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
                const reason = !dailyBreakdown
                    ? 'לא קיים dailyBreakdown'
                    : 'לא קיים dailyLoads';
                console.warn('⚠️ [Section E] אין נתונים:', reason);

                return `
                    <div class="drawer-section">
                        <div class="drawer-section-title">
                            <i class="fas fa-calendar-week"></i>
                            פירוט שבועי
                        </div>
                        <div style="padding: 16px 0; color: #64748b; font-size: 0.875rem; text-align: center;">
                            <i class="fas fa-info-circle" style="display: block; font-size: 2rem; margin-bottom: 8px; opacity: 0.3;"></i>
                            <p style="margin: 0;">אין נתונים שבועיים זמינים</p>
                            <p style="margin: 4px 0 0; font-size: 0.75rem; color: #94a3b8;">העובד לא דיווח על משימות השבוע</p>
                        </div>
                    </div>
                `;
            }

            const dailyTarget = employee.dailyHoursTarget || this.DEFAULT_DAILY_HOURS;

            // Peak day info (needed before rendering chart)
            const tasksByDay = dailyBreakdown.tasksByDay || {};
            const peakDay = dailyBreakdown.peakDay;
            const peakDayLoad = dailyBreakdown.peakDayLoad;

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

            const chartHtml = next5Days.map((day, index) => {
                const heightPercent = maxLoad > 0 ? (day.load / maxLoad) * 100 : 0;
                const isOverloaded = day.load > dailyTarget;
                const isPeakDay = day.dateKey === peakDay;

                return `
                    <div class="drawer-daily-bar-wrapper"
                         data-date-key="${day.dateKey}"
                         data-day-name="${day.dayName}"
                         data-day-load="${day.load}"
                         ${isPeakDay ? 'data-is-peak="true"' : ''}>
                        <div class="drawer-daily-bar-value">${this.formatHours(day.load)}</div>
                        <div class="drawer-daily-bar ${isOverloaded ? 'overloaded' : ''}"
                             style="height: ${heightPercent}%">
                        </div>
                        <div class="drawer-daily-bar-label">${day.dayName}</div>
                    </div>
                `;
            }).join('');

            // Count overloaded days and calculate peak day details
            const overloadedDaysCount = next5Days.filter(d => d.load > dailyTarget).length;
            const peakDayHours = peakDayLoad || Math.max(...next5Days.map(d => d.load));
            const peakPercent = dailyTarget > 0 ? Math.round((peakDayHours / dailyTarget) * 100) : 0;

            let weeklyInsight = '';
            if (overloadedDaysCount === 0) {
                weeklyInsight = '<div class="drawer-metric-insight"><i class="fas fa-check-circle"></i><span><strong>שבוע מאוזן:</strong> 0 מתוך 5 ימים מעל 8 שעות ביום - כל הימים מתחת ל-' + this.formatHours(dailyTarget) + '</span></div>';
            } else if (overloadedDaysCount <= 2) {
                weeklyInsight = '<div class="drawer-metric-insight"><i class="fas fa-info-circle"></i><span><strong>עומס מרוכז:</strong> ' + overloadedDaysCount + ' מתוך 5 ימים מעל 8 שעות ביום - יום שיא ' + this.formatHours(peakDayHours) + ' (' + peakPercent + '%)</span></div>';
            } else {
                weeklyInsight = '<div class="drawer-metric-insight"><i class="fas fa-exclamation-triangle"></i><span><strong>עומס רב-יומי:</strong> ' + overloadedDaysCount + ' מתוך 5 ימים מעל 8 שעות ביום - יום שיא ' + this.formatHours(peakDayHours) + ' (' + peakPercent + '%)</span></div>';
            }

            // Peak day tasks rendering
            let peakDayTasksHtml = '';
            if (peakDay && tasksByDay[peakDay]) {
                const peakDayTasks = tasksByDay[peakDay];
                const peakDayDate = this.formatDateFromString(peakDay);

                const tasksListHtml = peakDayTasks.slice(0, 5).map(item => {
                    const task = item.task;
                    const hours = item.hoursForThisDay;
                    const deadline = this.parseDeadlineForDisplay(task.deadline);
                    const isOverdue = deadline && deadline < today;

                    return `
                        <div class="drawer-task-item ${isOverdue ? 'overdue' : ''}">
                            <div class="drawer-task-header">
                                <i class="fas fa-briefcase"></i>
                                <span class="drawer-task-client">${this.sanitize(task.clientName || 'ללא לקוח')}</span>
                                <span class="drawer-task-hours">${this.formatHours(hours)}</span>
                            </div>
                            <div class="drawer-task-description">${this.sanitize(task.description || task.taskName || 'ללא תיאור')}</div>
                            ${deadline ? `<div class="drawer-task-deadline"><i class="fas fa-calendar"></i> ${this.formatDate(deadline.toISOString())}</div>` : ''}
                        </div>
                    `;
                }).join('');

                const showingCount = Math.min(5, peakDayTasks.length);
                const totalCount = peakDayTasks.length;

                peakDayTasksHtml = `
                    <div id="drawerSelectedDayTasks" style="margin-top: 20px;">
                        <div style="font-size: 0.875rem; font-weight: 600; color: #475569; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-fire" style="color: #ef4444;"></i>
                            <span id="drawerSelectedDayTitle">משימות ביום השיא (${peakDayDate} - ${this.formatHours(peakDayLoad)})</span>
                        </div>
                        <div class="drawer-tasks-list" id="drawerTasksList">
                            ${tasksListHtml}
                        </div>
                        ${totalCount > 5 ? `<div style="font-size: 0.75rem; color: #94a3b8; margin-top: 8px; text-align: center;">מציג ${showingCount} מתוך ${totalCount} משימות</div>` : ''}
                    </div>
                `;
            }

            return `
                <div class="drawer-section">
                    <div class="drawer-section-title">
                        <i class="fas fa-calendar-week"></i>
                        פירוט 5 ימים קרובים
                    </div>
                    <div style="font-size: 0.813rem; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-hand-pointer" style="font-size: 0.75rem;"></i>
                        לחץ על יום כדי לראות את המשימות שלו
                    </div>
                    <div class="drawer-weekly-chart" id="drawerWeeklyChart" data-has-tasks-by-day="${Object.keys(tasksByDay).length > 0}">
                        ${chartHtml}
                    </div>
                    ${weeklyInsight}
                    ${peakDayTasksHtml}
                </div>
            `;
        }

        formatHours(hours) {
            if (hours === undefined || hours === null || hours === '') {
                return '0h';
            }

            // Convert to number if string
            const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;

            if (isNaN(numHours) || numHours === 0) {
                return '0h';
            }

            // אם זה מספר שלם, הצג בלי נקודה עשרונית
            if (numHours === Math.floor(numHours)) {
                return `${numHours}h`;
            }

            // אחרת, הצג עם נקודה עשרונית אחת
            return `${numHours.toFixed(1)}h`;
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

                // Weekly chart day selection - Event delegation
                this.attachWeeklyChartListeners(metrics);
            }, 10);

            console.log('✅ Drawer opened for:', employeeEmail);
        },

        /**
         * Attach event listeners for weekly chart day selection
         */
        attachWeeklyChartListeners(metrics) {
            const chart = document.getElementById('drawerWeeklyChart');
            if (!chart) {
                return;
            }

            const hasTasksByDay = chart.dataset.hasTasksByDay === 'true';
            if (!hasTasksByDay) {
                console.log('ℹ️ No tasks by day - skipping chart interaction');
                return;
            }

            // Store handler as property for stable reference
            if (!this._chartClickHandler) {
                this._chartClickHandler = (e) => {
                    // Find closest bar wrapper
                    const barWrapper = e.target.closest('.drawer-daily-bar-wrapper');
                    if (!barWrapper) {
                        return;
                    }

                    const dateKey = barWrapper.dataset.dateKey;
                    const dayName = barWrapper.dataset.dayName;
                    const dayLoad = barWrapper.dataset.dayLoad;

                    console.log('📅 Day clicked:', dateKey, dayName);

                    // Update selected state
                    const chartEl = document.getElementById('drawerWeeklyChart');
                    if (chartEl) {
                        chartEl.querySelectorAll('.drawer-daily-bar-wrapper').forEach(bar => {
                            bar.classList.remove('selected');
                        });
                    }
                    barWrapper.classList.add('selected');

                    // Reset expanded state when selecting a new day
                    const tasksList = document.getElementById('drawerTasksList');
                    if (tasksList) {
                        tasksList.classList.remove('expanded');
                    }

                    // Update tasks display - metrics will be captured from closure
                    this.updateDrawerTasks(dateKey, dayName, dayLoad, this._currentMetrics);
                };
            }

            // Store metrics for handler
            this._currentMetrics = metrics;

            // Remove existing listener (if any) before adding new one
            chart.removeEventListener('click', this._chartClickHandler);

            // Add single listener
            chart.addEventListener('click', this._chartClickHandler);

            // Mark peak day as selected by default
            const peakBar = chart.querySelector('[data-is-peak="true"]');
            if (peakBar) {
                peakBar.classList.add('selected');
            }

            console.log('✅ Weekly chart listeners attached');
        },

        /**
         * Update drawer tasks for selected day
         */
        updateDrawerTasks(dateKey, dayName, dayLoad, metrics) {
            const workloadCard = window.WorkloadCard;
            const tasksList = document.getElementById('drawerTasksList');
            const titleEl = document.getElementById('drawerSelectedDayTitle');

            if (!tasksList || !titleEl) {
                return;
            }

            const dailyBreakdown = metrics.dailyBreakdown;
            if (!dailyBreakdown || !dailyBreakdown.tasksByDay) {
                return;
            }

            const tasksByDay = dailyBreakdown.tasksByDay;
            const dayTasks = tasksByDay[dateKey];

            if (!dayTasks || dayTasks.length === 0) {
                tasksList.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 0.875rem;">
                        <i class="fas fa-info-circle" style="display: block; font-size: 1.5rem; margin-bottom: 8px; opacity: 0.5;"></i>
                        אין משימות מתוזמנות ליום זה
                    </div>
                `;
                titleEl.textContent = `משימות ב${dayName} - אין משימות`;
                return;
            }

            // Render tasks
            const today = new Date();
            const dateFormatted = workloadCard.formatDateFromString(dateKey);

            // Check if already showing all tasks (from expand button click)
            const isExpanded = tasksList.classList.contains('expanded');
            const tasksToShow = isExpanded ? dayTasks : dayTasks.slice(0, 5);

            const tasksHtml = tasksToShow.map(item => {
                const task = item.task;
                const hours = item.hoursForThisDay;
                const deadline = workloadCard.parseDeadlineForDisplay(task.deadline);
                const isOverdue = deadline && deadline < today;

                // Calculate days overdue
                let overdueBadge = '';
                if (isOverdue) {
                    const daysOverdue = Math.floor((today - deadline) / (1000 * 60 * 60 * 24));
                    if (daysOverdue === 0) {
                        overdueBadge = '<span class="drawer-task-overdue-badge">באיחור - היום</span>';
                    } else if (daysOverdue === 1) {
                        overdueBadge = '<span class="drawer-task-overdue-badge">באיחור - יום</span>';
                    } else {
                        overdueBadge = `<span class="drawer-task-overdue-badge">באיחור - ${daysOverdue} ימים</span>`;
                    }
                }

                return `
                    <div class="drawer-task-item ${isOverdue ? 'overdue' : ''}">
                        <div class="drawer-task-header">
                            <i class="fas fa-briefcase"></i>
                            <span class="drawer-task-client">${workloadCard.sanitize(task.clientName || 'ללא לקוח')}</span>
                            ${overdueBadge}
                            <span class="drawer-task-hours">${workloadCard.formatHours(hours)}</span>
                        </div>
                        <div class="drawer-task-description">${workloadCard.sanitize(task.description || task.taskName || 'ללא תיאור')}</div>
                        ${deadline ? `<div class="drawer-task-deadline"><i class="fas fa-calendar"></i> ${workloadCard.formatDate(deadline.toISOString())}</div>` : ''}
                    </div>
                `;
            }).join('');

            // Add "Show All" button if needed
            const showingCount = tasksToShow.length;
            const totalCount = dayTasks.length;
            const needsExpandButton = totalCount > 5 && !isExpanded;

            const expandButtonHtml = needsExpandButton ? `
                <div class="drawer-tasks-expand-btn" data-date-key="${dateKey}" data-day-name="${dayName}" data-day-load="${dayLoad}">
                    <i class="fas fa-chevron-down"></i>
                    הצג את כל המשימות (${totalCount - 5} נוספות)
                </div>
            ` : '';

            tasksList.innerHTML = tasksHtml + expandButtonHtml;

            // Attach expand button listener if exists
            if (needsExpandButton) {
                const expandBtn = tasksList.querySelector('.drawer-tasks-expand-btn');
                if (expandBtn) {
                    expandBtn.addEventListener('click', () => {
                        this.expandTasks(dateKey, dayName, dayLoad, metrics);
                    });
                }
            }

            titleEl.innerHTML = `משימות ב${dayName} (${dateFormatted} - ${workloadCard.formatHours(dayLoad)})`;

            console.log('✅ Tasks updated for:', dayName, `(${dayTasks.length} tasks)`);
        },

        /**
         * Expand tasks to show all
         */
        expandTasks(dateKey, dayName, dayLoad, metrics) {
            const tasksList = document.getElementById('drawerTasksList');
            if (!tasksList) {
                return;
            }

            // Mark as expanded
            tasksList.classList.add('expanded');

            // Re-render with all tasks
            this.updateDrawerTasks(dateKey, dayName, dayLoad, metrics);

            console.log('✅ Expanded tasks view');
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
    // KEYBOARD NAVIGATION MANAGER - 2026
    // ═══════════════════════════════════════════════════════════════

    class KeyboardNavigationManager {
        constructor() {
            this.selectedIndex = -1;
            this.rows = [];
            this.isEnabled = false;
        }

        init() {
            this.attachGlobalKeyboardListeners();
            this.isEnabled = true;
        }

        attachGlobalKeyboardListeners() {
            document.addEventListener('keydown', (e) => {
                // Don't intercept if user is typing in input field
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }

                // Don't intercept if drawer is open (let drawer handle Escape)
                if (window.workloadDrawer?.isOpen) {
                    return;
                }

                this.handleKeyPress(e);
            });
        }

        handleKeyPress(e) {
            const key = e.key;

            // Update rows list
            this.refreshRowsList();

            if (this.rows.length === 0) {
return;
}

            // Arrow Down or 'j' (vim-style)
            if (key === 'ArrowDown' || key === 'j') {
                e.preventDefault();
                this.selectNext();
            } else if (key === 'ArrowUp' || key === 'k') {
                // Arrow Up or 'k' (vim-style)
                e.preventDefault();
                this.selectPrevious();
            } else if (key === 'Enter') {
                // Enter - open drawer
                e.preventDefault();
                this.openSelected();
            } else if (key === '/') {
                // Forward slash - focus search
                e.preventDefault();
                this.focusSearch();
            } else if (key === '1' || key === '2' || key === '3') {
                // Number keys 1-3 for quick filter
                e.preventDefault();
                this.quickFilter(key);
            }
        }

        refreshRowsList() {
            this.rows = Array.from(document.querySelectorAll('.narrative-grid-row, .employee-list-row'));
        }

        selectNext() {
            if (this.selectedIndex < this.rows.length - 1) {
                this.selectedIndex++;
                this.updateSelection();
            }
        }

        selectPrevious() {
            if (this.selectedIndex > 0) {
                this.selectedIndex--;
                this.updateSelection();
            } else if (this.selectedIndex === -1 && this.rows.length > 0) {
                this.selectedIndex = 0;
                this.updateSelection();
            }
        }

        updateSelection() {
            // Remove previous selection
            this.rows.forEach(row => row.classList.remove('keyboard-selected'));

            // Add new selection
            if (this.selectedIndex >= 0 && this.selectedIndex < this.rows.length) {
                const selectedRow = this.rows[this.selectedIndex];
                selectedRow.classList.add('keyboard-selected');

                // Scroll into view if needed
                selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        openSelected() {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.rows.length) {
                const selectedRow = this.rows[this.selectedIndex];
                const email = selectedRow.dataset.email;

                if (email && window.workloadDrawer) {
                    window.workloadDrawer.open(email);
                }
            }
        }

        focusSearch() {
            const searchInput = document.querySelector('#workloadSearchInput, input[type="search"]');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        quickFilter(key) {
            // Simulate filter click based on number
            const filterButtons = document.querySelectorAll('[data-filter]');
            if (!filterButtons || filterButtons.length === 0) {
return;
}

            // 1 = All, 2 = Needs Attention, 3 = Critical
            const filterMap = {
                '1': 'all',
                '2': 'high',
                '3': 'critical'
            };

            const targetFilter = filterMap[key];
            const targetButton = Array.from(filterButtons).find(btn => btn.dataset.filter === targetFilter);

            if (targetButton) {
                targetButton.click();
            }
        }

        reset() {
            this.selectedIndex = -1;
            this.rows.forEach(row => row.classList.remove('keyboard-selected'));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GITHUB-PROJECTS-STYLE: Group Toggle Function
    // ═══════════════════════════════════════════════════════════════

    window.toggleEmployeeGroup = function(groupId) {
        const groupRows = document.getElementById(groupId);
        const chevron = document.getElementById(`${groupId}-chevron`);
        const groupEl = groupRows?.closest('.employee-group');

        if (!groupRows || !chevron || !groupEl) {
return;
}

        const isCollapsed = groupEl.dataset.collapsed === 'true';

        if (isCollapsed) {
            // Expand
            groupRows.style.display = '';
            chevron.classList.remove('fa-chevron-right');
            chevron.classList.add('fa-chevron-down');
            groupEl.dataset.collapsed = 'false';
        } else {
            // Collapse
            groupRows.style.display = 'none';
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-right');
            groupEl.dataset.collapsed = 'true';
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // Global Export
    // ═══════════════════════════════════════════════════════════════

    // Export both Class and Instance
    window.WorkloadCardClass = WorkloadCard;

    const workloadCard = new WorkloadCard();
    window.WorkloadCard = workloadCard;

    // Initialize Keyboard Navigation
    const keyboardNav = new KeyboardNavigationManager();
    keyboardNav.init();
    window.workloadKeyboardNav = keyboardNav;

    console.log('✅ WorkloadCard v5.2.0 loaded - Fail-Fast Error Handling');
    console.log('⌨️  Keyboard Navigation enabled - Use ↑↓ j/k, Enter, /, 1-3');
    console.log('📁 GitHub Projects Style - Grouped Table');

})();
