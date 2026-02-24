/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║                   Fluent Data Grid Component                          ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  Enterprise-grade data grid following Microsoft Fluent Design         ║
 * ║  Features: Virtual scrolling, inline editing, bulk operations         ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

window.FluentDataGrid = {
    // State management
    data: [],
    filteredData: [],
    displayedData: [],
    selectedRows: new Set(),
    currentPage: 1,
    pageSize: 25,
    sortColumn: null,
    sortDirection: 'asc',
    searchTerm: '',
    filters: {},

    // DOM references
    elements: {
        table: null,
        tbody: null,
        selectAllCheckbox: null,
        selectedCount: null,
        pageInfo: null,
        searchInput: null,
        pageSizeSelect: null
    },

    /**
     * Initialize the Fluent Data Grid
     */
    async init() {
        console.log('🎨 Initializing Fluent Data Grid...');

        // Cache DOM elements
        this.cacheElements();

        // Set up event listeners
        this.setupEventListeners();

        // Load initial data
        await this.loadData();

        // Initialize virtual scrolling
        this.initializeVirtualScrolling();

        console.log('✅ Fluent Data Grid initialized');
    },

    /**
     * Cache DOM element references
     */
    cacheElements() {
        this.elements.table = document.getElementById('clientsDataGrid');
        this.elements.tbody = document.getElementById('clientsTableBody');
        this.elements.selectAllCheckbox = document.getElementById('selectAllCheckbox');
        this.elements.selectedCount = document.getElementById('selectedCount');
        this.elements.pageInfo = document.getElementById('pageInfo');
        this.elements.searchInput = document.getElementById('fluentSearchInput');
        this.elements.pageSizeSelect = document.getElementById('pageSizeSelect');

        // KPI elements
        this.elements.totalClientsKPI = document.getElementById('totalClientsKPI');
        this.elements.activeClientsKPI = document.getElementById('activeClientsKPI');
        this.elements.hoursUsedKPI = document.getElementById('hoursUsedKPI');
        this.elements.avgHoursKPI = document.getElementById('avgHoursKPI');
    },

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Select all checkbox
        this.elements.selectAllCheckbox?.addEventListener('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });

        // Search input with debouncing
        let searchTimeout;
        this.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });

        // Clear search button
        document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
            this.elements.searchInput.value = '';
            this.handleSearch('');
        });

        // Page size change
        this.elements.pageSizeSelect?.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.renderTable();
        });

        // Sort column headers
        document.querySelectorAll('.fluent-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.dataset.sort);
            });
        });

        // Pagination controls
        document.getElementById('firstPageBtn')?.addEventListener('click', () => {
            this.goToPage(1);
        });

        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            this.goToPage(this.currentPage - 1);
        });

        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            this.goToPage(this.currentPage + 1);
        });

        document.getElementById('lastPageBtn')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
            this.goToPage(totalPages);
        });

        // Command bar actions
        document.getElementById('refreshCommand')?.addEventListener('click', () => {
            this.refresh();
        });

        document.getElementById('bulkEditCommand')?.addEventListener('click', () => {
            this.handleBulkEdit();
        });

        document.getElementById('bulkDeleteCommand')?.addEventListener('click', () => {
            this.handleBulkDelete();
        });

        // Filter panel toggle
        document.querySelector('.fluent-command-button:has(.fa-filter)')?.addEventListener('click', () => {
            this.toggleFilterPanel();
        });

        // Export button
        document.querySelector('.fluent-command-button:has(.fa-download)')?.addEventListener('click', () => {
            this.exportData();
        });

        // Context menu prevention and custom handling
        this.elements.tbody?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });

        // Click outside to close context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Row double-click for inline editing
        this.elements.tbody?.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('td');
            if (cell && !cell.classList.contains('checkbox-column') && !cell.classList.contains('actions-column')) {
                this.enableInlineEdit(cell);
            }
        });
    },

    /**
     * Load data from Firebase
     */
    async loadData() {
        try {
            this.showLoadingState();

            // Get clients from Firebase
            const clientsSnapshot = await window.firebaseDB.collection('clients').get();

            this.data = [];

            for (const doc of clientsSnapshot.docs) {
                const clientData = doc.data();

                // Get service information
                let serviceType = 'לא מוגדר';
                let hoursRemaining = 0;
                let totalHours = 0;

                if (clientData.services && clientData.services.length > 0) {
                    const service = clientData.services[0];
                    if (service.type === 'הליך משפטי') {
                        serviceType = 'הליך משפטי';
                        // Calculate hours for legal procedure stages
                        ['stage_a', 'stage_b', 'stage_c'].forEach(stage => {
                            if (service[stage]) {
                                totalHours += service[stage].totalHours || 0;
                                hoursRemaining += service[stage].hoursRemaining || 0;
                            }
                        });
                    } else if (service.type === 'תוכנית שעות') {
                        serviceType = 'חבילת שעות';
                        totalHours = service.hours || 0;
                        hoursRemaining = service.hoursRemaining || 0;
                    }
                }

                // Get team members
                const teamMembers = clientData.teamMembers || [];

                // Get last activity
                const lastActivity = clientData.lastActivity
                    ? new Date(clientData.lastActivity.seconds * 1000)
                    : new Date(clientData.createdAt?.seconds * 1000 || Date.now());

                this.data.push({
                    id: doc.id,
                    name: clientData.clientName || clientData.name || 'לא ידוע',
                    caseNumber: clientData.caseNumber || '-',
                    type: serviceType,
                    hoursTotal: totalHours,
                    hoursRemaining: hoursRemaining,
                    hoursUsed: totalHours - hoursRemaining,
                    status: clientData.status || 'active',
                    team: teamMembers,
                    lastActivity: lastActivity,
                    email: clientData.email || '',
                    phone: clientData.phone || '',
                    raw: clientData
                });
            }

            // Apply initial filtering and sorting
            this.filteredData = [...this.data];
            this.sortData('name');

            // Update KPIs
            this.updateKPIs();

            // Render the table
            this.renderTable();

        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.showErrorState();
        }
    },

    /**
     * Update KPI cards
     */
    updateKPIs() {
        // Total clients
        if (this.elements.totalClientsKPI) {
            this.elements.totalClientsKPI.textContent = this.data.length.toString();
        }

        // Active clients
        const activeCount = this.data.filter(c => c.status === 'active').length;
        if (this.elements.activeClientsKPI) {
            this.elements.activeClientsKPI.textContent = activeCount.toString();
        }

        // Total hours used
        const totalHoursUsed = this.data.reduce((sum, c) => sum + (c.hoursUsed || 0), 0);
        if (this.elements.hoursUsedKPI) {
            this.elements.hoursUsedKPI.textContent = totalHoursUsed.toFixed(1);
        }

        // Average hours per client
        const avgHours = this.data.length > 0 ? totalHoursUsed / this.data.length : 0;
        if (this.elements.avgHoursKPI) {
            this.elements.avgHoursKPI.textContent = avgHours.toFixed(1);
        }
    },

    /**
     * Render the data table
     */
    renderTable() {
        if (!this.elements.tbody) return;

        // Calculate pagination
        const totalItems = this.filteredData.length;
        const totalPages = Math.ceil(totalItems / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, totalItems);

        // Get current page data
        this.displayedData = this.filteredData.slice(startIndex, endIndex);

        // Clear table body
        this.elements.tbody.innerHTML = '';

        if (this.displayedData.length === 0) {
            this.showEmptyState();
            return;
        }

        // Render rows
        this.displayedData.forEach(client => {
            const row = this.createTableRow(client);
            this.elements.tbody.appendChild(row);
        });

        // Update pagination info
        this.updatePaginationInfo(startIndex + 1, endIndex, totalItems, totalPages);

        // Update bulk action buttons
        this.updateBulkActionButtons();
    },

    /**
     * Create a table row for a client
     */
    createTableRow(client) {
        const row = document.createElement('tr');
        row.dataset.id = client.id;

        if (this.selectedRows.has(client.id)) {
            row.classList.add('selected');
        }

        // Checkbox column
        const checkboxCell = document.createElement('td');
        checkboxCell.className = 'checkbox-column';
        checkboxCell.innerHTML = `
            <label class="fluent-checkbox">
                <input type="checkbox" data-id="${client.id}" ${this.selectedRows.has(client.id) ? 'checked' : ''}>
                <span class="checkbox-mark"></span>
            </label>
        `;

        // Add checkbox event listener
        const checkbox = checkboxCell.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            this.handleRowSelection(client.id, e.target.checked);
        });

        row.appendChild(checkboxCell);

        // Client name
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `
            <div class="client-name-cell">
                <strong>${this.escapeHtml(client.name)}</strong>
                ${client.email ? `<br><small style="color: var(--fluent-neutral-secondary);">${this.escapeHtml(client.email)}</small>` : ''}
            </div>
        `;
        row.appendChild(nameCell);

        // Case number
        const caseCell = document.createElement('td');
        caseCell.textContent = client.caseNumber;
        row.appendChild(caseCell);

        // Service type
        const typeCell = document.createElement('td');
        typeCell.innerHTML = `
            <span class="service-type-badge" data-type="${client.type}">
                ${client.type === 'הליך משפטי' ? '<i class="fas fa-balance-scale"></i>' : '<i class="fas fa-briefcase"></i>'}
                ${this.escapeHtml(client.type)}
            </span>
        `;
        row.appendChild(typeCell);

        // Hours
        const hoursCell = document.createElement('td');
        const percentage = client.hoursTotal > 0 ? (client.hoursUsed / client.hoursTotal * 100) : 0;
        hoursCell.innerHTML = `
            <div class="hours-cell">
                <div class="hours-text">
                    ${client.hoursUsed.toFixed(1)} / ${client.hoursTotal.toFixed(1)}
                </div>
                <div class="hours-progress" style="margin-top: 4px;">
                    <div class="progress-bar-bg" style="width: 100%; height: 4px; background: var(--fluent-neutral-quaternary); border-radius: 2px;">
                        <div class="progress-bar-fill" style="width: ${percentage}%; height: 100%; background: ${percentage > 80 ? 'var(--fluent-error)' : 'var(--fluent-accent)'}; border-radius: 2px; transition: width 0.3s;"></div>
                    </div>
                </div>
            </div>
        `;
        row.appendChild(hoursCell);

        // Status
        const statusCell = document.createElement('td');
        statusCell.innerHTML = `
            <span class="status-badge ${client.status}">
                ${this.getStatusIcon(client.status)}
                ${this.getStatusText(client.status)}
            </span>
        `;
        row.appendChild(statusCell);

        // Team
        const teamCell = document.createElement('td');
        if (client.team && client.team.length > 0) {
            teamCell.innerHTML = `
                <div class="team-avatars">
                    ${client.team.slice(0, 3).map(member => `
                        <span class="team-avatar" title="${this.escapeHtml(member.name || member)}">
                            ${this.getInitials(member.name || member)}
                        </span>
                    `).join('')}
                    ${client.team.length > 3 ? `<span class="team-more">+${client.team.length - 3}</span>` : ''}
                </div>
            `;
        } else {
            teamCell.innerHTML = '<span style="color: var(--fluent-neutral-tertiary);">לא מוקצה</span>';
        }
        row.appendChild(teamCell);

        // Last activity
        const activityCell = document.createElement('td');
        activityCell.innerHTML = `
            <span title="${client.lastActivity.toLocaleString('he-IL')}">
                ${this.formatRelativeTime(client.lastActivity)}
            </span>
        `;
        row.appendChild(activityCell);

        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-column';
        actionsCell.innerHTML = `
            <div class="action-buttons">
                <button class="action-button" title="הצג פרטים" onclick="FluentDataGrid.viewClient('${client.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-button" title="ערוך" onclick="FluentDataGrid.editClient('${client.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-button" title="הפק דוח" onclick="FluentDataGrid.generateReport('${client.id}')">
                    <i class="fas fa-file-alt"></i>
                </button>
                <button class="action-button" title="עוד פעולות" onclick="FluentDataGrid.showMoreActions(event, '${client.id}')">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;
        row.appendChild(actionsCell);

        return row;
    },

    /**
     * Handle row selection
     */
    handleRowSelection(id, isSelected) {
        const row = this.elements.tbody.querySelector(`tr[data-id="${id}"]`);

        if (isSelected) {
            this.selectedRows.add(id);
            row?.classList.add('selected');
        } else {
            this.selectedRows.delete(id);
            row?.classList.remove('selected');
        }

        this.updateSelectionInfo();
        this.updateBulkActionButtons();
    },

    /**
     * Handle select all
     */
    handleSelectAll(isSelected) {
        this.displayedData.forEach(client => {
            this.handleRowSelection(client.id, isSelected);
        });
    },

    /**
     * Update selection info
     */
    updateSelectionInfo() {
        if (this.elements.selectedCount) {
            this.elements.selectedCount.textContent = this.selectedRows.size.toString();
        }

        // Update select all checkbox state
        if (this.elements.selectAllCheckbox) {
            const allSelected = this.displayedData.length > 0 &&
                                this.displayedData.every(c => this.selectedRows.has(c.id));
            this.elements.selectAllCheckbox.checked = allSelected;
            this.elements.selectAllCheckbox.indeterminate =
                !allSelected && this.displayedData.some(c => this.selectedRows.has(c.id));
        }
    },

    /**
     * Update bulk action buttons
     */
    updateBulkActionButtons() {
        const hasSelection = this.selectedRows.size > 0;

        const bulkEditBtn = document.getElementById('bulkEditCommand');
        const bulkDeleteBtn = document.getElementById('bulkDeleteCommand');

        if (bulkEditBtn) {
            bulkEditBtn.disabled = !hasSelection;
        }

        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = !hasSelection;
        }
    },

    /**
     * Handle search
     */
    handleSearch(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase();

        // Show/hide clear button
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.style.display = searchTerm ? 'block' : 'none';
        }

        // Filter data
        if (this.searchTerm) {
            this.filteredData = this.data.filter(client => {
                return client.name.toLowerCase().includes(this.searchTerm) ||
                       client.caseNumber.toLowerCase().includes(this.searchTerm) ||
                       client.email.toLowerCase().includes(this.searchTerm) ||
                       client.type.toLowerCase().includes(this.searchTerm);
            });
        } else {
            this.filteredData = [...this.data];
        }

        // Reset to first page and render
        this.currentPage = 1;
        this.renderTable();
    },

    /**
     * Handle sorting
     */
    handleSort(column) {
        // Toggle sort direction if same column
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Update header styles
        document.querySelectorAll('.fluent-table th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === column) {
                th.classList.add(`sorted-${this.sortDirection}`);
            }
        });

        // Sort data
        this.sortData(column);

        // Render table
        this.renderTable();
    },

    /**
     * Sort data
     */
    sortData(column) {
        this.filteredData.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle special cases
            if (column === 'lastActivity') {
                aVal = aVal?.getTime() || 0;
                bVal = bVal?.getTime() || 0;
            } else if (column === 'team') {
                aVal = aVal?.length || 0;
                bVal = bVal?.length || 0;
            }

            // Compare values
            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    },

    /**
     * Navigate to page
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);

        if (page < 1 || page > totalPages) return;

        this.currentPage = page;
        this.renderTable();
    },

    /**
     * Update pagination info
     */
    updatePaginationInfo(start, end, total, totalPages) {
        // Update page info text
        if (this.elements.pageInfo) {
            this.elements.pageInfo.textContent = `${start}-${end} מתוך ${total}`;
        }

        // Update page numbers
        const pageNumbersContainer = document.getElementById('pageNumbers');
        if (pageNumbersContainer) {
            pageNumbersContainer.innerHTML = '';

            // Generate page numbers (show max 5 pages)
            const startPage = Math.max(1, this.currentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
                pageBtn.textContent = i.toString();
                pageBtn.addEventListener('click', () => this.goToPage(i));
                pageNumbersContainer.appendChild(pageBtn);
            }
        }

        // Update navigation buttons
        document.getElementById('firstPageBtn').disabled = this.currentPage === 1;
        document.getElementById('prevPageBtn').disabled = this.currentPage === 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage === totalPages;
        document.getElementById('lastPageBtn').disabled = this.currentPage === totalPages;
    },

    /**
     * Initialize virtual scrolling for performance
     */
    initializeVirtualScrolling() {
        // Implement intersection observer for lazy loading if needed
        // This is a placeholder for future enhancement
    },

    /**
     * Enable inline editing
     */
    enableInlineEdit(cell) {
        if (cell.querySelector('input')) return; // Already editing

        const originalContent = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalContent;
        input.className = 'fluent-inline-edit';
        input.style.width = '100%';
        input.style.padding = '4px 8px';
        input.style.border = '2px solid var(--fluent-accent)';
        input.style.borderRadius = 'var(--fluent-border-radius-small)';
        input.style.fontSize = 'inherit';

        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();

        const saveEdit = () => {
            const newValue = input.value;
            cell.textContent = newValue;
            // TODO: Save to Firebase
            console.log('Save edit:', newValue);
        };

        const cancelEdit = () => {
            cell.textContent = originalContent;
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    },

    /**
     * Show context menu
     */
    showContextMenu(e) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        const row = e.target.closest('tr');
        if (!row || !row.dataset.id) return;

        // Position context menu
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;

        // Adjust if menu goes off screen
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = `${e.pageX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = `${e.pageY - rect.height}px`;
        }

        // Store context for actions
        contextMenu.dataset.clientId = row.dataset.id;
    },

    /**
     * Hide context menu
     */
    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    },

    /**
     * Toggle filter panel
     */
    toggleFilterPanel() {
        const filterPanel = document.getElementById('filterPanel');
        if (filterPanel) {
            const isVisible = filterPanel.style.display !== 'none';
            filterPanel.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                // Animate slide down
                filterPanel.style.animation = 'slideDown 0.3s ease-out';
            }
        }
    },

    /**
     * View client details
     */
    viewClient(id) {
        console.log('View client:', id);
        // TODO: Open client details modal or navigate to client page
    },

    /**
     * Edit client
     */
    editClient(id) {
        console.log('Edit client:', id);
        // TODO: Open edit modal
    },

    /**
     * Generate report for client
     */
    generateReport(id) {
        console.log('Generate report for client:', id);
        // Use existing report modal if available
        if (window.ClientReportModal) {
            const client = this.data.find(c => c.id === id);
            if (client) {
                window.ClientReportModal.open(client.raw);
            }
        }
    },

    /**
     * Show more actions menu
     */
    showMoreActions(event, id) {
        event.stopPropagation();
        this.showContextMenu(event);
    },

    /**
     * Handle bulk edit
     */
    handleBulkEdit() {
        if (this.selectedRows.size === 0) return;

        console.log('Bulk edit:', Array.from(this.selectedRows));
        // TODO: Implement bulk edit modal
    },

    /**
     * Handle bulk delete
     */
    handleBulkDelete() {
        if (this.selectedRows.size === 0) return;

        const confirmed = confirm(`האם אתה בטוח שברצונך למחוק ${this.selectedRows.size} לקוחות?`);
        if (confirmed) {
            console.log('Bulk delete:', Array.from(this.selectedRows));
            // TODO: Implement bulk delete
        }
    },

    /**
     * Export data
     */
    exportData() {
        console.log('Export data');
        // TODO: Implement export to Excel/CSV
    },

    /**
     * Refresh data
     */
    async refresh() {
        console.log('🔄 Refreshing data...');
        await this.loadData();
    },

    /**
     * Show loading state
     */
    showLoadingState() {
        if (this.elements.tbody) {
            this.elements.tbody.innerHTML = `
                <tr class="loading-state">
                    <td colspan="9">
                        <div class="fluent-loading">
                            <div class="loading-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <p>טוען נתונים...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Show empty state
     */
    showEmptyState() {
        if (this.elements.tbody) {
            this.elements.tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 48px;">
                        <div style="color: var(--fluent-neutral-secondary);">
                            <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                            <p style="font-size: 16px; margin: 0;">לא נמצאו תוצאות</p>
                            <p style="font-size: 14px; margin: 8px 0 0 0;">נסה לשנות את מילות החיפוש או הסינון</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Show error state
     */
    showErrorState() {
        if (this.elements.tbody) {
            this.elements.tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 48px;">
                        <div style="color: var(--fluent-error);">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                            <p style="font-size: 16px; margin: 0;">שגיאה בטעינת הנתונים</p>
                            <p style="font-size: 14px; margin: 8px 0 0 0;">אנא נסה שוב מאוחר יותר</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Utility: Get status icon
     */
    getStatusIcon(status) {
        const icons = {
            'active': '<i class="fas fa-check-circle"></i>',
            'inactive': '<i class="fas fa-pause-circle"></i>',
            'blocked': '<i class="fas fa-ban"></i>'
        };
        return icons[status] || '';
    },

    /**
     * Utility: Get status text
     */
    getStatusText(status) {
        const texts = {
            'active': 'פעיל',
            'inactive': 'לא פעיל',
            'blocked': 'חסום'
        };
        return texts[status] || status;
    },

    /**
     * Utility: Get initials from name
     */
    getInitials(name) {
        return name.split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    },

    /**
     * Utility: Format relative time
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `לפני ${days} ימים`;
        if (hours > 0) return `לפני ${hours} שעות`;
        if (minutes > 0) return `לפני ${minutes} דקות`;
        return 'עכשיו';
    }
};