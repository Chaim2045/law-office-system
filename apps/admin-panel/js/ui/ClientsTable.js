/**
 * Clients Table Component
 * קומפוננטת טבלת לקוחות
 *
 * נוצר: 23/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Clients Management
 *
 * תפקיד: הצגת טבלת לקוחות עם פילטרים וחיפוש
 */

(function() {
    'use strict';

    /**
     * ClientsTable Class
     * טבלת לקוחות
     */
    class ClientsTable {
        constructor() {
            this.dataManager = null;
            this.tableBody = null;
            this.paginationContainer = null;

            // DOM Elements
            this.searchInput = null;
            this.statusFilter = null;
            this.typeFilter = null;
            this.agreementFilter = null;
            this.sortSelect = null;

            this.isInitialized = false;
        }

        /**
         * Initialize Table
         * אתחול הטבלה
         */
        async init() {
            try {
                console.log('🎨 ClientsTable: Initializing...');

                // Wait for Data Manager
                if (!window.ClientsDataManager) {
                    console.error('❌ ClientsDataManager not found');
                    return false;
                }

                this.dataManager = window.ClientsDataManager;

                // Get DOM elements
                this.getDOMElements();

                // Setup event listeners
                this.setupEventListeners();

                // Initial render
                this.render();

                this.isInitialized = true;

                console.log('✅ ClientsTable: Initialized successfully');

                return true;

            } catch (error) {
                console.error('❌ ClientsTable: Initialization error:', error);
                return false;
            }
        }

        /**
         * Get DOM elements
         * קבלת אלמנטים מה-DOM
         */
        getDOMElements() {
            this.tableBody = document.getElementById('clientsTableBody');
            this.paginationContainer = document.getElementById('clientsPaginationContainer');
            this.searchInput = document.getElementById('searchInput');
            this.statusFilter = document.getElementById('statusFilter');
            this.typeFilter = document.getElementById('typeFilter');
            this.agreementFilter = document.getElementById('agreementFilter');
            this.sortSelect = document.getElementById('sortSelect');
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Search input
            if (this.searchInput) {
                this.searchInput.addEventListener('input', (e) => {
                    this.dataManager.setSearch(e.target.value);
                });
            }

            // Status filter
            if (this.statusFilter) {
                this.statusFilter.addEventListener('change', (e) => {
                    this.dataManager.setStatusFilter(e.target.value);
                });
            }

            // Type filter
            if (this.typeFilter) {
                this.typeFilter.addEventListener('change', (e) => {
                    this.dataManager.setTypeFilter(e.target.value);
                });
            }

            // Agreement filter
            if (this.agreementFilter) {
                this.agreementFilter.addEventListener('change', (e) => {
                    this.dataManager.setAgreementFilter(e.target.value);
                });
            }

            // Clickable stat card for no agreement
            const noAgreementCard = document.getElementById('noAgreementStatCard');
            if (noAgreementCard) {
                noAgreementCard.addEventListener('click', () => {
                    // הגדר את הפילטר ל"ללא הסכם"
                    if (this.agreementFilter) {
                        this.agreementFilter.value = 'no-agreement';
                        this.dataManager.setAgreementFilter('no-agreement');
                    }
                });
            }

            // Clickable stat card for needs attention
            const needsAttentionCard = document.getElementById('needsAttentionStatCard');
            if (needsAttentionCard) {
                needsAttentionCard.addEventListener('click', () => {
                    // הגדר את הפילטר ל"דורש תשומת לב"
                    if (this.statusFilter) {
                        this.statusFilter.value = 'needs-attention';
                        this.dataManager.setStatusFilter('needs-attention');
                    }
                });
            }

            // Sort
            if (this.sortSelect) {
                this.sortSelect.addEventListener('change', (e) => {
                    this.dataManager.setSort(e.target.value);
                });
            }

            // Listen to data updates
            window.addEventListener('clients:updated', (e) => {
                this.render(e.detail);
            });

            // Listen to pagination events
            window.addEventListener('pagination:changed', (e) => {
                const { type, page, itemsPerPage } = e.detail;

                if (type === 'page') {
                    this.dataManager.setPage(page);
                } else if (type === 'itemsPerPage') {
                    this.dataManager.setItemsPerPage(itemsPerPage);
                }
            });
        }

        /**
         * Render table
         * רינדור הטבלה
         */
        render(data) {
            if (!this.tableBody) {
return;
}

            const paginatedData = data || this.dataManager.getPaginatedClients();
            const clients = paginatedData.clients;

            if (!clients || clients.length === 0) {
                this.renderEmptyState();
                this.renderPagination(paginatedData.pagination);
                return;
            }

            this.tableBody.innerHTML = clients.map(client => this.renderClientRow(client)).join('');

            // Attach event listeners to action buttons
            this.attachRowEventListeners();

            // Render pagination
            this.renderPagination(paginatedData.pagination);
        }

        /**
         * Render pagination
         * רינדור פגינציה
         */
        renderPagination(paginationData) {
            if (!this.paginationContainer || !window.PaginationUI) {
                return;
            }

            window.PaginationUI.render(this.paginationContainer, paginationData);
        }

        /**
         * Render client row
         * רינדור שורה של לקוח
         */
        renderClientRow(client) {
            const statusBadge = this.getStatusBadge(client);
            const typeBadge = this.getTypeBadge(client);
            const hoursDisplay = this.getHoursDisplay(client);
            const creatorName = this.getCreatorName(client);
            const agreementWarning = this.getAgreementWarning(client);

            // ✅ בדיקה אם הלקוח במינוס (חריגה)
            // דלג על שירותים שהחריגה שלהם הוסדרה או שיש להם אישור חריגה
            const hasUnresolvedOverdraft = client.services?.some(s => {
                if (s.overdraftResolved?.isResolved || s.overrideActive) {
                    return false;
                }
                return (s.hoursRemaining || 0) < 0;
            });
            const hasAnyOverride = client.services?.some(s =>
                s.overrideActive === true || s.overdraftResolved?.isResolved === true
            );
            const isOverdraft = hasUnresolvedOverdraft || ((client.hoursRemaining || 0) < 0 && !hasAnyOverride);
            const isApprovedOverdraft = !isOverdraft && (client.hoursRemaining || 0) < 0 && hasAnyOverride;
            const rowClass = isOverdraft ? 'client-row-overdraft' : '';

            // תג חריגה
            let overdraftBadge;
            if (isOverdraft) {
                overdraftBadge = '<span class="status-badge blocked"><i class="fas fa-exclamation-triangle"></i> חריגה</span>';
            } else if (isApprovedOverdraft) {
                overdraftBadge = '<span class="status-badge warning"><i class="fas fa-shield-alt"></i> חריגה מאושרת</span>';
            } else {
                overdraftBadge = '<span class="status-badge active"><i class="fas fa-check-circle"></i> תקין</span>';
            }

            return `
                <tr data-client-id="${client.id}" class="${rowClass}">
                    <td>
                        <div class="client-name">
                            ${agreementWarning}
                            ${isOverdraft ? '<i class="fas fa-exclamation-triangle" style="color: var(--danger-red); margin-left: 0.5rem;" title="לקוח בחריגה"></i>' : ''}
                            <strong>${this.escapeHtml(client.fullName)}</strong>
                        </div>
                    </td>
                    <td>${this.escapeHtml(client.caseNumber || '-')}</td>
                    <td>${typeBadge}</td>
                    <td>${hoursDisplay}</td>
                    <td>${overdraftBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${creatorName}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-action btn-action-primary" data-action="manage" data-client-id="${client.id}">
                                <i class="fas fa-cog"></i>
                                <span>ניהול</span>
                            </button>
                            <button class="btn-action btn-action-secondary" data-action="report" data-client-id="${client.id}">
                                <i class="fas fa-file-alt"></i>
                                <span>דוח</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }

        /**
         * Get status badge
         * קבלת תג סטטוס
         */
        getStatusBadge(client) {
            let statusClass = 'active';
            let statusText = 'פעיל';
            let icon = 'fa-check-circle';
            let title = '';

            const hasActiveOverride = client.services?.some(s =>
                s.type === 'hours' && s.overrideActive === true
            );

            // PR-A.4 (2026-05-16): isOnHold (manual freeze) takes precedence
            // over derived isBlocked. Show both flags distinguishably so admin
            // sees WHY a client is blocked (no hours vs manual freeze).
            // H.6.c-2: pending_signature (created by createClientFromSalesRecord,
            // service status:'pending', activeServices:0) is a lifecycle status —
            // it takes precedence over the derived hours flags (isBlocked would be
            // truthy for a 0-service client, but "חסום (אין שעות)" is the wrong story).
            if (client.status === 'pending_signature') {
                statusClass = 'warning';
                statusText = 'ממתין לחתימה';
                icon = 'fa-hourglass-half';
                title = 'תיק שנוצר מטופס מכר וממתין לאישור חתימה — טרם פעיל';
            } else if (client.isOnHold) {
                statusClass = 'on-hold';
                statusText = 'מוקפא ידנית';
                icon = 'fa-pause';
                title = 'הקפאה ידנית של אדמין — לא קשור ליתרת השעות';
            } else if (client.isBlocked && hasActiveOverride) {
                statusClass = 'warning';
                statusText = 'חריגה מאושרת';
                icon = '';
                title = 'חרגה ליטרת שעות אבל פעיל override';
            } else if (client.isBlocked) {
                statusClass = 'blocked';
                statusText = 'חסום (אין שעות)';
                icon = 'fa-ban';
                title = 'יתרת שעות אפסה — חישוב אוטומטי';
            } else if (client.isCritical) {
                statusClass = 'critical';
                statusText = 'קריטי';
                icon = 'fa-exclamation-triangle';
                title = 'נותרו 5 שעות או פחות';
            } else if (client.status === 'inactive') {
                statusClass = 'inactive';
                statusText = 'לא פעיל';
                icon = 'fa-pause-circle';
            }

            const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
            return `
                <span class="status-badge ${statusClass}" style="white-space:nowrap;"${titleAttr}>
                    ${icon ? `<i class="fas ${icon}"></i>` : ''}
                    ${statusText}
                </span>
            `;
        }

        /**
         * Get type badge
         * קבלת תג סוג
         *
         * Reads from client.typeDisplay (computed by ClientsDataManager from
         * services[] — the canonical source of truth). Supports mixed clients
         * (both hours + fixed active services) and renders a tooltip with
         * per-service breakdown.
         *
         * Refactored 2026-05-14 from binary `client.type === 'hours' ? ...`
         * which was wrong for fixed clients (DataManager defaulted them to
         * 'hours') and unable to represent mixed clients.
         */
        getTypeBadge(client) {
            const td = client.typeDisplay || {
                kind: 'none', label: 'ללא', icon: 'fa-question-circle', breakdown: []
            };

            const tooltipHtml = (window.ClientTypeDisplay && window.ClientTypeDisplay.renderTypeTooltip)
                ? window.ClientTypeDisplay.renderTypeTooltip(td.breakdown)
                : '';

            // Escape tooltip HTML for safe embedding in data attribute
            const tooltipAttr = tooltipHtml
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;');

            return `
                <span class="type-badge type-badge-${td.kind}" data-tooltip-html="${tooltipAttr}">
                    <i class="fas ${td.icon}"></i>
                    ${td.label}
                </span>
            `;
        }

        /**
         * Get hours display
         * קבלת תצוגת שעות
         *
         * Shows hours info for any client with an active billable service
         * (hours or legal_procedure+hourly). Pure-fixed clients return '-'.
         */
        getHoursDisplay(client) {
            const td = client.typeDisplay;
            // Show hours for hours-only OR mixed clients (both have billable hours)
            const hasBillableHours = td && (td.kind === 'hours' || td.kind === 'mixed');
            if (!hasBillableHours) {
                return '<span>-</span>';
            }

            const totalHours = client.totalHours || 0;
            const remaining = client.hoursRemaining || 0;
            const percentage = totalHours > 0 ? (remaining / totalHours) * 100 : 0;

            let progressClass = '';
            if (client.isOnHold) {
                progressClass = 'on-hold';  // PR-A.4: manual freeze shown distinctly
            } else if (client.isBlocked) {
                progressClass = 'blocked';
            } else if (client.isCritical) {
                progressClass = 'critical';
            }

            // Get warning icon based on hours remaining
            const warningIcon = this.getHoursWarningIcon(client);

            return `
                <div class="hours-display">
                    <div class="hours-value">
                        ${warningIcon}${remaining.toFixed(1)} / ${totalHours}
                    </div>
                    <div class="hours-progress">
                        <div class="hours-progress-bar ${progressClass}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }

        /**
         * Get hours warning icon
         * קבלת אייקון התראה לשעות
         *
         * Triggers for clients with active billable services low on hours.
         *
         * Refactored 2026-05-14 to read from services[] (canonical source)
         * instead of legacy `client.procedureType` + `client.pricingType`
         * which weren't reliably maintained for multi-service clients.
         */
        getHoursWarningIcon(client) {
            // Only check active, non-blocked, non-on-hold clients.
            // PR-A.4: isOnHold suppresses the hours warning — admin already
            // saw the freeze badge, no need to also warn about hours.
            if (client.status !== 'active' || client.isBlocked || client.isOnHold) {
                return '';
            }

            const td = client.typeDisplay;
            // No warning for fixed-only or no-services clients
            if (!td || td.kind === 'fixed' || td.kind === 'none') {
                return '';
            }

            const hoursRemaining = client.hoursRemaining || 0;
            const totalHours = client.totalHours || 0;

            // Client-level hours warning (covers 'hours' and 'mixed' kinds)
            if (hoursRemaining < 5 || (totalHours > 0 && (hoursRemaining / totalHours) < 0.05)) {
                return '<span class="hours-warning-icon critical" title="פחות מ-5 שעות">🔴</span>';
            }
            if (hoursRemaining < 10 || (totalHours > 0 && (hoursRemaining / totalHours) < 0.1)) {
                return '<span class="hours-warning-icon warning" title="5-10 שעות">🟡</span>';
            }

            // Additional stage-level warning for active legal_procedure-hourly service
            const services = Array.isArray(client.services) ? client.services : [];
            const legalHourlyService = services.find(s =>
                s.type === 'legal_procedure' &&
                s.pricingType === 'hourly' &&
                (!s.status || s.status === 'active')
            );
            if (legalHourlyService && Array.isArray(legalHourlyService.stages)) {
                const currentStage = legalHourlyService.stages.find(s => s.status === 'active');
                if (currentStage) {
                    const stageRemaining = currentStage.hoursRemaining || 0;
                    if (stageRemaining < 5) {
                        return '<span class="hours-warning-icon critical" title="פחות מ-5 שעות בשלב הנוכחי">🔴</span>';
                    }
                }
            }

            return '';
        }

        /**
         * Get agreement warning icon
         * קבלת אייקון אזהרה להסכם שכר טרחה
         */
        getAgreementWarning(client) {
            // בדיקה מדויקת - האם יש הסכם שכר טרחה?
            const hasAgreement = client.feeAgreements && client.feeAgreements.length > 0;

            if (hasAgreement) {
                return ''; // יש הסכם - אין צורך באזהרה
            }

            // אין הסכם - הצג אייקון אזהרה
            return `
                <span class="agreement-warning-icon" title="חסר הסכם שכר טרחה">
                    <i class="fas fa-exclamation-triangle"></i>
                </span>
            `;
        }

        /**
         * Get creator name
         * קבלת שם היוצר
         */
        getCreatorName(client) {
            if (!client.createdBy) {
                return '<span class="creator-name">-</span>';
            }

            const creatorName = this.dataManager.getEmployeeName(client.createdBy);
            return `<span class="creator-name">${this.escapeHtml(creatorName)}</span>`;
        }

        /**
         * Get team members
         * קבלת חברי צוות
         */
        getTeamMembers(client) {
            if (!client.assignedTo || client.assignedTo.length === 0) {
                return '<span>-</span>';
            }

            const members = client.assignedTo.slice(0, 3); // Show max 3
            const remaining = client.assignedTo.length - 3;

            const membersHtml = members.map(email => {
                const name = this.dataManager.getEmployeeName(email);
                return `<span class="team-member">${this.escapeHtml(name)}</span>`;
            }).join('');

            const remainingHtml = remaining > 0 ? `<span class="team-member">+${remaining}</span>` : '';

            return `<div class="team-members">${membersHtml}${remainingHtml}</div>`;
        }

        /**
         * Get team last login
         * קבלת כניסה אחרונה של חברי הצוות
         * מחזיר את הכניסה האחרונה של העובד שנכנס הכי לאחרונה
         */
        getTeamLastLogin(client) {
            if (!client.assignedTo || client.assignedTo.length === 0) {
                return '-';
            }

            // Get lastLogin for all team members
            let latestLogin = null;

            client.assignedTo.forEach(email => {
                const employeeLogin = this.dataManager.getEmployeeLastLogin(email);
                if (employeeLogin) {
                    const loginTime = employeeLogin.toMillis ? employeeLogin.toMillis() : new Date(employeeLogin).getTime();
                    if (!latestLogin || loginTime > latestLogin) {
                        latestLogin = loginTime;
                    }
                }
            });

            if (!latestLogin) {
                return '-';
            }

            // Convert back to timestamp format and format
            return this.formatDate(new Date(latestLogin));
        }

        /**
         * Format date
         * עיצוב תאריך
         *
         * 🔧 FIX: משווה תאריכים קלנדריים במקום הפרש זמן
         * זה מבטיח שתאריכים מוצגים נכון לפי יום בלוח השנה, לא לפי 24 שעות
         */
        formatDate(timestamp) {
            if (!timestamp) {
return '-';
}

            let date;
            if (timestamp.toDate) {
                date = timestamp.toDate();
            } else if (timestamp instanceof Date) {
                date = timestamp;
            } else {
                date = new Date(timestamp);
            }

            const now = new Date();

            // Reset time to midnight for accurate day comparison
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            // Calculate difference in days (calendar days, not 24-hour periods)
            const diffTime = today - compareDate;
            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (days === 0) {
                return 'היום';
            } else if (days === 1) {
                return 'אתמול';
            } else if (days < 7) {
                return `לפני ${days} ימים`;
            } else {
                return date.toLocaleDateString('he-IL');
            }
        }

        /**
         * Render empty state
         * רינדור מצב ריק
         */
        renderEmptyState() {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>לא נמצאו לקוחות</h3>
                            <p>נסה לשנות את הפילטרים או את החיפוש</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        /**
         * Attach row event listeners
         * צרף מאזיני אירועים לשורות
         */
        attachRowEventListeners() {
            // Manage buttons
            const manageButtons = document.querySelectorAll('[data-action="manage"]');
            manageButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const clientId = btn.getAttribute('data-client-id');
                    this.handleManageClick(clientId);
                });
            });

            // Report buttons
            const reportButtons = document.querySelectorAll('[data-action="report"]');
            reportButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const clientId = btn.getAttribute('data-client-id');
                    this.handleReportClick(clientId);
                });
            });
        }

        /**
         * Handle manage click
         * טיפול בלחיצה על ניהול לקוח
         */
        handleManageClick(clientId) {
            console.log('⚙️ Opening management modal for client:', clientId);

            // Get client data
            const client = this.dataManager.getClientById(clientId);
            if (!client) {
                console.error('❌ Client not found:', clientId);
                if (window.notify) {
                    window.notify.error('לקוח לא נמצא', 'שגיאה');
                }
                return;
            }

            // Open management modal
            if (window.ClientManagementModal) {
                window.ClientManagementModal.open(client, this.dataManager);
            } else {
                console.error('❌ ClientManagementModal not loaded');
                if (window.notify) {
                    window.notify.error('מערכת הניהול לא נטענה', 'שגיאה');
                }
            }
        }

        /**
         * Handle report click
         * טיפול בלחיצה על הפקת דוח
         */
        handleReportClick(clientId) {
            console.log('📄 Opening report modal for client:', clientId);

            if (window.ClientReportModal) {
                window.ClientReportModal.open(clientId);
            } else {
                console.error('❌ ClientReportModal not loaded');
                if (window.notify) {
                    window.notify.error('מערכת הדוחות לא נטענה', 'שגיאה');
                }
            }
        }

        /**
         * Handle details click
         * טיפול בלחיצה על פרטים
         */
        handleDetailsClick(clientId) {
            console.log('👁️ Opening details for client:', clientId);

            const client = this.dataManager.getClientById(clientId);
            if (!client) {
                console.error('❌ Client not found:', clientId);
                return;
            }

            // For now, just show an alert with basic info
            // TODO: Create a proper ClientDetailsModal
            const td = client.typeDisplay || { kind: 'none', label: 'ללא' };
            const hasBillableHours = td.kind === 'hours' || td.kind === 'mixed';
            alert(`
פרטי לקוח:
שם: ${client.fullName}
מספר תיק: ${client.caseNumber || '-'}
סוג: ${td.label}
${hasBillableHours ? `שעות נותרות: ${client.hoursRemaining || 0}` : ''}
סטטוס: ${client.status}
            `.trim());
        }

        /**
         * Export to Excel
         * ייצוא לאקסל
         */
        exportToExcel() {
            if (!this.ensureCsvSafe()) {
                return;
            }

            console.log('📥 Exporting clients to Excel...');

            const clients = this.dataManager.filteredClients;

            if (!clients || clients.length === 0) {
                if (window.notify) {
                    window.notify.error('אין נתונים לייצוא', 'שגיאה');
                }
                return;
            }

            // Convert to CSV
            const headers = ['שם הלקוח', 'מספר תיק', 'סוג', 'שעות נותרות', 'סטטוס', 'צוות', 'כניסה אחרונה'];
            const rows = clients.map(client => {
                const td = client.typeDisplay || { kind: 'none', breakdown: [] };
                const typeLabel = (window.ClientTypeDisplay && window.ClientTypeDisplay.renderTypeForCsv)
                    ? window.ClientTypeDisplay.renderTypeForCsv(td.breakdown)
                    : (td.label || 'ללא');
                const hasBillableHours = td.kind === 'hours' || td.kind === 'mixed';
                return [
                    client.fullName,
                    client.caseNumber || '',
                    typeLabel,
                    hasBillableHours ? (client.hoursRemaining || 0) : '-',
                    client.isOnHold ? 'מוקפא ידנית' : client.isBlocked ? 'חסום (אין שעות)' : client.isCritical ? 'קריטי' : client.status,
                    client.assignedTo ? client.assignedTo.join(', ') : '',
                    this.getTeamLastLogin(client)
                ];
            });

            // RFC-4180 quote-doubling + OWASP CSV/formula-injection neutralization,
            // via the shared SSOT encoder window.CsvSafe.cell (js/core/csv-safe.js).
            // Headers are hardcoded Hebrew labels (no formula trigger) — left as-is.
            let csv = headers.join(',') + '\n';
            csv += rows.map(row => row.map(cell => `"${window.CsvSafe.cell(cell)}"`).join(',')).join('\n');

            // Add BOM for Hebrew support
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            if (window.notify) {
                window.notify.success('הקובץ הורד בהצלחה', 'ייצוא הצליח');
            }
        }

        /**
         * Fail-secure guard for CSV export: the shared CSV/formula-injection
         * encoder (js/core/csv-safe.js → window.CsvSafe.cell) MUST be present
         * before exporting. If missing, abort with a Hebrew message rather than
         * emit un-neutralized cells.
         * @returns {boolean} true if the encoder is available
         */
        ensureCsvSafe() {
            if (window.CsvSafe && typeof window.CsvSafe.cell === 'function') {
                return true;
            }
            console.error('ClientsTable: CsvSafe encoder not loaded (js/core/csv-safe.js must be present on this page)');
            if (window.notify) {
                window.notify.error('שגיאה בייצוא הקובץ — רכיב אבטחה חסר. רענן את הדף ונסה שוב', 'ייצוא נכשל');
            }
            return false;
        }

        /**
         * Escape HTML
         * הימנעות מ-HTML injection
         */
        escapeHtml(text) {
            // Routed to the shared SSOT escaper (js/core/escape-html.js).
            // Behavior change: now also escapes " and ' (the temp-div escaped only & < >);
            // null-guard narrows to null/undefined only — safe in HTML text/attribute contexts.
            // NOTE: the separate data-tooltip-html escape in getTypeBadge() is intentionally
            // NOT routed here (it packs pre-rendered HTML; a 5-entity escape would break it).
            return window.escapeHtml(text);
        }
    }

    // Create global instance
    const clientsTable = new ClientsTable();

    // Make available globally
    window.ClientsTable = clientsTable;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = clientsTable;
    }

})();
