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
            const teamMembers = this.getTeamMembers(client);
            const agreementWarning = this.getAgreementWarning(client);

            // ✅ בדיקת חריגה חכמה
            const overdraftInfo = this.getOverdraftInfo(client);
            const rowClass = overdraftInfo.isOverdraft ? 'client-row-overdraft' : '';

            return `
                <tr data-client-id="${client.id}" class="${rowClass}">
                    <td>
                        <div class="client-name">
                            ${agreementWarning}
                            ${overdraftInfo.icon}
                            <strong>${this.escapeHtml(client.fullName)}</strong>
                        </div>
                    </td>
                    <td>${this.escapeHtml(client.caseNumber || '-')}</td>
                    <td>${typeBadge}</td>
                    <td>${hoursDisplay}</td>
                    <td>${overdraftInfo.badge}</td>
                    <td>${statusBadge}</td>
                    <td>${teamMembers}</td>
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
         * Get overdraft info (smart logic)
         * מידע על חריגה - לוגיקה חכמה
         */
        getOverdraftInfo(client) {
            // בדיקת שירותים במינוס
            const overdraftServices = (client.services || []).filter(s => {
                const remaining = s.hoursRemaining || 0;
                return remaining < 0;
            });

            const hasOverdraft = overdraftServices.length > 0 || (client.hoursRemaining || 0) < 0;

            if (!hasOverdraft) {
                return {
                    isOverdraft: false,
                    icon: '',
                    badge: '<span class="badge badge-success"><i class="fas fa-check"></i> תקין</span>'
                };
            }

            // חישוב סה"כ חריגה
            const totalOverdraft = overdraftServices.reduce((sum, s) => sum + Math.abs(s.hoursRemaining || 0), 0);

            // מציאת השירות בחריגה הגבוהה ביותר
            const worstService = overdraftServices.reduce((worst, s) => {
                const remaining = s.hoursRemaining || 0;
                return remaining < (worst?.hoursRemaining || 0) ? s : worst;
            }, null);

            const worstOverdraft = Math.abs(worstService?.hoursRemaining || 0);

            // קביעת רמת חומרה
            let severity = 'warning'; // צהוב
            let severityText = 'חריגה קלה';

            if (worstOverdraft > 20) {
                severity = 'critical'; // אדום כהה
                severityText = 'חריגה חמורה';
            } else if (worstOverdraft > 10) {
                severity = 'danger'; // אדום
                severityText = 'חריגה משמעותית';
            }

            // יצירת tooltip מפורט
            const tooltipLines = [];
            tooltipLines.push(`סה"כ חריגה: ${totalOverdraft.toFixed(1)} שעות`);
            if (overdraftServices.length > 1) {
                tooltipLines.push(`${overdraftServices.length} שירותים במינוס`);
            }
            if (worstService) {
                tooltipLines.push(`החמור ביותר: ${worstService.name || 'שירות'} (${worstOverdraft.toFixed(1)} שעות)`);
            }
            const tooltip = tooltipLines.join('&#10;');

            return {
                isOverdraft: true,
                icon: `<i class="fas fa-exclamation-triangle" style="color: var(--danger-red); margin-left: 0.5rem;" title="${tooltip}"></i>`,
                badge: `<span class="badge badge-${severity}" title="${tooltip}">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${severityText} (-${worstOverdraft.toFixed(1)} שעות)
                </span>`
            };
        }

        /**
         * Get status badge
         * קבלת תג סטטוס
         */
        getStatusBadge(client) {
            let statusClass = 'active';
            let statusText = 'פעיל';
            let icon = 'fa-check-circle';

            if (client.isBlocked) {
                statusClass = 'blocked';
                statusText = 'חסום';
                icon = 'fa-ban';
            } else if (client.isCritical) {
                statusClass = 'critical';
                statusText = 'קריטי';
                icon = 'fa-exclamation-triangle';
            } else if (client.status === 'inactive') {
                statusClass = 'inactive';
                statusText = 'לא פעיל';
                icon = 'fa-pause-circle';
            }

            return `
                <span class="status-badge ${statusClass}">
                    <i class="fas ${icon}"></i>
                    ${statusText}
                </span>
            `;
        }

        /**
         * Get type badge
         * קבלת תג סוג
         */
        getTypeBadge(client) {
            const typeText = client.type === 'hours' ? 'שעות' : 'קבוע';
            const icon = client.type === 'hours' ? 'fa-clock' : 'fa-file-invoice-dollar';

            return `
                <span class="type-badge">
                    <i class="fas ${icon}"></i>
                    ${typeText}
                </span>
            `;
        }

        /**
         * Get hours display
         * קבלת תצוגת שעות
         */
        getHoursDisplay(client) {
            if (client.type !== 'hours') {
                return '<span>-</span>';
            }

            const totalHours = client.totalHours || 0;
            const remaining = client.hoursRemaining || 0;
            const percentage = totalHours > 0 ? (remaining / totalHours) * 100 : 0;

            let progressClass = '';
            if (client.isBlocked) {
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
         */
        getHoursWarningIcon(client) {
            // Only check active, non-blocked clients
            if (client.status !== 'active' || client.isBlocked) {
                return '';
            }

            const hoursRemaining = client.hoursRemaining || 0;
            const totalHours = client.totalHours || 0;

            // Regular hourly client
            if (client.procedureType === 'hours') {
                if (hoursRemaining < 5 || (totalHours > 0 && (hoursRemaining / totalHours) < 0.05)) {
                    return '<span class="hours-warning-icon critical" title="פחות מ-5 שעות">🔴</span>';
                }
                if (hoursRemaining < 10 || (totalHours > 0 && (hoursRemaining / totalHours) < 0.1)) {
                    return '<span class="hours-warning-icon warning" title="5-10 שעות">🟡</span>';
                }
            }

            // Legal procedure - hourly pricing
            if (client.procedureType === 'legal_procedure' && client.pricingType === 'hourly') {
                // Check total hours remaining
                if (hoursRemaining < 5) {
                    return '<span class="hours-warning-icon critical" title="פחות מ-5 שעות נותרו בהליך">🔴</span>';
                }
                if (hoursRemaining < 10) {
                    return '<span class="hours-warning-icon warning" title="5-10 שעות נותרו בהליך">🟡</span>';
                }

                // Check current stage hours remaining
                if (client.services && client.services.length > 0) {
                    const legalService = client.services.find(s => s.type === 'legal_procedure');
                    if (legalService && legalService.stages) {
                        const currentStage = legalService.stages.find(s => s.status === 'active');
                        if (currentStage) {
                            const stageRemaining = currentStage.hoursRemaining || 0;
                            if (stageRemaining < 5) {
                                return '<span class="hours-warning-icon critical" title="פחות מ-5 שעות בשלב הנוכחי">🔴</span>';
                            }
                        }
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
            alert(`
פרטי לקוח:
שם: ${client.fullName}
מספר תיק: ${client.caseNumber || '-'}
סוג: ${client.type === 'hours' ? 'שעות' : 'קבוע'}
${client.type === 'hours' ? `שעות נותרות: ${client.hoursRemaining || 0}` : ''}
סטטוס: ${client.status}
            `.trim());
        }

        /**
         * Export to Excel
         * ייצוא לאקסל
         */
        exportToExcel() {
            console.log('📥 Exporting clients to Excel...');

            const clients = this.dataManager.filteredClients;

            if (!clients || clients.length === 0) {
                if (window.notify) {
                    window.notify.error('אין נתונים לייצוא', 'שגיאה');
                }
                return;
            }

            // Convert to CSV
            const headers = ['שם הלקוח', 'מספר תיק', 'סוג', 'שעות נותרות', 'חריגה', 'סטטוס', 'צוות'];
            const rows = clients.map(client => {
                const overdraftInfo = this.getOverdraftInfo(client);
                const overdraftText = overdraftInfo.isOverdraft
                    ? `כן (${overdraftInfo.badge.includes('חריגה קלה') ? 'קלה' : overdraftInfo.badge.includes('חריגה משמעותית') ? 'משמעותית' : 'חמורה'})`
                    : 'לא';

                return [
                    client.fullName,
                    client.caseNumber || '',
                    client.type === 'hours' ? 'שעות' : 'קבוע',
                    client.type === 'hours' ? client.hoursRemaining || 0 : '-',
                    overdraftText,
                    client.isBlocked ? 'חסום' : client.isCritical ? 'קריטי' : client.status,
                    client.assignedTo ? client.assignedTo.join(', ') : ''
                ];
            });

            let csv = headers.join(',') + '\n';
            csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

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
         * Escape HTML
         * הימנעות מ-HTML injection
         */
        escapeHtml(text) {
            if (!text) {
return '';
}
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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
