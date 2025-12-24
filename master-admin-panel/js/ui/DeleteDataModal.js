/**
 * Delete Data Modal Component
 * קומפוננטת מודאל מחיקת נתונים סלקטיבית
 *
 * 🔒 Security Features:
 * - Read-only preview mode (Phase 1)
 * - Multi-confirmation flow
 * - Ownership verification on server
 * - Full audit logging
 *
 * Created: 2025-01-09
 * Version: 1.0.0 (Phase 1: Read-Only)
 */

(function() {
    'use strict';

    /**
     * DeleteDataModal Class
     * מנהל מודאל מחיקה סלקטיבית
     */
    class DeleteDataModal {
        constructor() {
            this.modalId = null;
            this.userData = null;
            this.userEmail = null;

            // Data state
            this.allTasks = [];
            this.allTimesheets = [];
            this.allApprovals = [];

            // Selection state
            this.selectedTaskIds = new Set();
            this.selectedTimesheetIds = new Set();
            this.selectedApprovalIds = new Set();

            // Filters
            this.taskFilters = {
                client: 'all',
                dateFrom: null,
                dateTo: null,
                search: ''
            };
            this.timesheetFilters = {
                client: 'all',
                month: 'all',
                search: ''
            };

            // Current view
            this.activeTab = 'tasks'; // tasks | timesheets | approvals

            // Phase 3 limit
            this.PHASE_3_MAX_ITEMS = 50;
        }

        /**
         * Open modal for user
         * פתיחת מודאל למשתמש
         */
        async open(user) {
            if (!user || !user.email) {
                console.error('❌ DeleteDataModal: Invalid user data');
                window.notify.error('נתוני משתמש לא תקינים');
                return;
            }

            this.userData = user;
            this.userEmail = user.email;

            console.log(`🗑️ Opening DeleteDataModal for: ${user.email}`);

            // Reset state
            this.resetState();

            // Create modal
            this.modalId = window.ModalManager.create({
                title: `<i class="fas fa-trash-alt"></i> מחיקת נתונים: ${user.displayName || user.email}`,
                content: this.renderLoadingState(),
                footer: this.renderFooter(),
                size: 'xlarge',
                closeOnBackdrop: false,
                onOpen: async () => {
                    await this.loadUserData();
                },
                onClose: () => {
                    this.resetState();
                }
            });
        }

        /**
         * Reset state
         * איפוס מצב
         */
        resetState() {
            this.allTasks = [];
            this.allTimesheets = [];
            this.allApprovals = [];
            this.selectedTaskIds.clear();
            this.selectedTimesheetIds.clear();
            this.selectedApprovalIds.clear();
            this.activeTab = 'tasks';
        }

        /**
         * Load user data
         * טעינת נתוני משתמש
         */
        async loadUserData() {
            try {
                console.log('📥 Loading user data...');

                const modal = window.ModalManager.getElement(this.modalId);
                if (!modal) {
return;
}

                // Load in parallel
                const [tasks, timesheets, approvals] = await Promise.all([
                    this.fetchUserTasks(),
                    this.fetchUserTimesheets(),
                    this.fetchUserApprovals()
                ]);

                this.allTasks = tasks;
                this.allTimesheets = timesheets;
                this.allApprovals = approvals;

                console.log(`✅ Loaded: ${tasks.length} tasks, ${timesheets.length} timesheets, ${approvals.length} approvals`);

                // Re-render with data
                this.updateContent();
                this.attachEventListeners();

            } catch (error) {
                console.error('❌ Error loading user data:', error);
                window.notify.error('שגיאה בטעינת נתונים');
            }
        }

        /**
         * Fetch user tasks
         * שליפת משימות משתמש
         */
        async fetchUserTasks() {
            try {
                const snapshot = await window.firebaseDB.collection('budget_tasks')
                    .where('employeeEmail', '==', this.userEmail)
                    .orderBy('createdAt', 'desc')
                    .get();

                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('❌ Error fetching tasks:', error);
                return [];
            }
        }

        /**
         * Fetch user timesheets
         * שליפת שעתונים של משתמש
         */
        async fetchUserTimesheets() {
            try {
                const snapshot = await window.firebaseDB.collection('timesheet_entries')
                    .where('employeeEmail', '==', this.userEmail)
                    .orderBy('date', 'desc')
                    .get();

                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('❌ Error fetching timesheets:', error);
                return [];
            }
        }

        /**
         * Fetch user approvals
         * שליפת אישורים של משתמש
         */
        async fetchUserApprovals() {
            try {
                const snapshot = await window.firebaseDB.collection('pending_task_approvals')
                    .where('requestedBy', '==', this.userEmail)
                    .orderBy('requestedAt', 'desc')
                    .get();

                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('❌ Error fetching approvals:', error);
                return [];
            }
        }

        /**
         * Render loading state
         * רינדור מצב טעינה
         */
        renderLoadingState() {
            return `
                <div class="delete-data-modal loading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>טוען נתונים...</p>
                    </div>
                </div>
            `;
        }

        /**
         * Render main content
         * רינדור תוכן ראשי
         */
        renderContent() {
            const totalSelected = this.selectedTaskIds.size + this.selectedTimesheetIds.size + this.selectedApprovalIds.size;

            return `
                <div class="delete-data-modal">
                    <!-- Phase 3 Warning -->
                    <div class="phase-warning">
                        <i class="fas fa-info-circle"></i>
                        <span><strong>🚀 Phase 3: Limited Delete Mode</strong> - מקסימום 50 פריטים למחיקה</span>
                    </div>

                    <!-- User Info -->
                    <div class="user-info-bar">
                        <span class="user-name">${this.escapeHtml(this.userData.displayName || this.userEmail)}</span>
                        <span class="user-email">${this.escapeHtml(this.userEmail)}</span>
                        <span class="selection-count ${totalSelected > 0 ? 'has-selection' : ''}">
                            נבחרו: ${totalSelected} פריטים
                        </span>
                    </div>

                    <!-- Tabs -->
                    <div class="delete-data-tabs">
                        ${this.renderTab('tasks', 'fas fa-tasks', `משימות (${this.allTasks.length})`)}
                        ${this.renderTab('timesheets', 'fas fa-clock', `שעתונים (${this.allTimesheets.length})`)}
                        ${this.renderTab('approvals', 'fas fa-check-circle', `אישורים (${this.allApprovals.length})`)}
                    </div>

                    <!-- Tab Content -->
                    <div class="delete-data-content">
                        ${this.renderTabContent()}
                    </div>
                </div>
            `;
        }

        /**
         * Render tab button
         * רינדור כפתור טאב
         */
        renderTab(tabId, icon, label) {
            const active = this.activeTab === tabId ? 'active' : '';
            const count = tabId === 'tasks' ? this.selectedTaskIds.size :
                         tabId === 'timesheets' ? this.selectedTimesheetIds.size :
                         this.selectedApprovalIds.size;

            return `
                <button class="tab-btn ${active}" data-tab="${tabId}">
                    <i class="${icon}"></i>
                    <span>${label}</span>
                    ${count > 0 ? `<span class="tab-badge">${count}</span>` : ''}
                </button>
            `;
        }

        /**
         * Render tab content
         * רינדור תוכן טאב
         */
        renderTabContent() {
            switch (this.activeTab) {
                case 'tasks':
                    return this.renderTasksTab();
                case 'timesheets':
                    return this.renderTimesheetsTab();
                case 'approvals':
                    return this.renderApprovalsTab();
                default:
                    return '<p>טאב לא נמצא</p>';
            }
        }

        /**
         * Render tasks tab
         * רינדור טאב משימות
         */
        renderTasksTab() {
            const filteredTasks = this.getFilteredTasks();

            return `
                <div class="tab-panel tab-tasks">
                    <!-- Filters -->
                    ${this.renderTaskFilters()}

                    <!-- Select All -->
                    <div class="select-all-bar">
                        <label class="checkbox-label">
                            <input type="checkbox" id="selectAllTasks" ${this.selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0 ? 'checked' : ''}>
                            <span>בחר הכל (${filteredTasks.length} משימות)</span>
                        </label>
                    </div>

                    <!-- Tasks List -->
                    <div class="items-list">
                        ${filteredTasks.length === 0 ?
                            '<p class="no-items">אין משימות להצגה</p>' :
                            filteredTasks.map(task => this.renderTaskItem(task)).join('')
                        }
                    </div>
                </div>
            `;
        }

        /**
         * Render task filters
         * רינדור פילטרים למשימות
         */
        renderTaskFilters() {
            // Get unique clients
            const clients = [...new Set(this.allTasks.map(t => t.clientName))].filter(Boolean);

            return `
                <div class="filters-bar">
                    <select class="filter-select" id="taskClientFilter">
                        <option value="all">כל הלקוחות</option>
                        ${clients.map(client => `<option value="${this.escapeHtml(client)}">${this.escapeHtml(client)}</option>`).join('')}
                    </select>
                    <input type="text" class="filter-search" id="taskSearchFilter" placeholder="חיפוש...">
                </div>
            `;
        }

        /**
         * Get filtered tasks
         * קבלת משימות מסוננות
         */
        getFilteredTasks() {
            return this.allTasks.filter(task => {
                // Client filter
                if (this.taskFilters.client !== 'all' && task.clientName !== this.taskFilters.client) {
                    return false;
                }

                // Search filter
                if (this.taskFilters.search) {
                    const searchLower = this.taskFilters.search.toLowerCase();
                    const taskStr = `${task.description || ''} ${task.clientName || ''}`.toLowerCase();
                    if (!taskStr.includes(searchLower)) {
                        return false;
                    }
                }

                return true;
            });
        }

        /**
         * Render task item
         * רינדור פריט משימה
         */
        renderTaskItem(task) {
            const isSelected = this.selectedTaskIds.has(task.id);

            return `
                <div class="item-row ${isSelected ? 'selected' : ''}" data-item-id="${task.id}" data-item-type="task">
                    <label class="item-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''}>
                    </label>
                    <div class="item-content">
                        <div class="item-title">${this.escapeHtml(task.description || 'ללא תיאור')}</div>
                        <div class="item-meta">
                            <span class="item-client"><i class="fas fa-briefcase"></i> ${this.escapeHtml(task.clientName || 'N/A')}</span>
                            <span class="item-date"><i class="fas fa-calendar"></i> ${this.formatDate(task.createdAt)}</span>
                            ${task.hours ? `<span class="item-hours"><i class="fas fa-clock"></i> ${task.hours}h</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render timesheets tab
         * רינדור טאב שעתונים
         */
        renderTimesheetsTab() {
            const filteredTimesheets = this.getFilteredTimesheets();

            return `
                <div class="tab-panel tab-timesheets">
                    <!-- Filters -->
                    ${this.renderTimesheetFilters()}

                    <!-- Select All -->
                    <div class="select-all-bar">
                        <label class="checkbox-label">
                            <input type="checkbox" id="selectAllTimesheets" ${this.selectedTimesheetIds.size === filteredTimesheets.length && filteredTimesheets.length > 0 ? 'checked' : ''}>
                            <span>בחר הכל (${filteredTimesheets.length} שעתונים)</span>
                        </label>
                    </div>

                    <!-- Timesheets List -->
                    <div class="items-list">
                        ${filteredTimesheets.length === 0 ?
                            '<p class="no-items">אין שעתונים להצגה</p>' :
                            filteredTimesheets.map(ts => this.renderTimesheetItem(ts)).join('')
                        }
                    </div>
                </div>
            `;
        }

        /**
         * Render timesheet filters
         * רינדור פילטרים לשעתונים
         */
        renderTimesheetFilters() {
            const clients = [...new Set(this.allTimesheets.map(t => t.clientName))].filter(Boolean);

            return `
                <div class="filters-bar">
                    <select class="filter-select" id="timesheetClientFilter">
                        <option value="all">כל הלקוחות</option>
                        ${clients.map(client => `<option value="${this.escapeHtml(client)}">${this.escapeHtml(client)}</option>`).join('')}
                    </select>
                    <input type="text" class="filter-search" id="timesheetSearchFilter" placeholder="חיפוש...">
                </div>
            `;
        }

        /**
         * Get filtered timesheets
         * קבלת שעתונים מסוננים
         */
        getFilteredTimesheets() {
            return this.allTimesheets.filter(ts => {
                if (this.timesheetFilters.client !== 'all' && ts.clientName !== this.timesheetFilters.client) {
                    return false;
                }

                if (this.timesheetFilters.search) {
                    const searchLower = this.timesheetFilters.search.toLowerCase();
                    const tsStr = `${ts.serviceName || ''} ${ts.clientName || ''}`.toLowerCase();
                    if (!tsStr.includes(searchLower)) {
                        return false;
                    }
                }

                return true;
            });
        }

        /**
         * Render timesheet item
         * רינדור פריט שעתון
         */
        renderTimesheetItem(ts) {
            const isSelected = this.selectedTimesheetIds.has(ts.id);

            return `
                <div class="item-row ${isSelected ? 'selected' : ''}" data-item-id="${ts.id}" data-item-type="timesheet">
                    <label class="item-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''}>
                    </label>
                    <div class="item-content">
                        <div class="item-title">${this.escapeHtml(ts.serviceName || 'ללא שם')}</div>
                        <div class="item-meta">
                            <span class="item-client"><i class="fas fa-briefcase"></i> ${this.escapeHtml(ts.clientName || 'N/A')}</span>
                            <span class="item-date"><i class="fas fa-calendar"></i> ${this.formatDate(ts.date)}</span>
                            ${ts.hours ? `<span class="item-hours"><i class="fas fa-clock"></i> ${ts.hours}h</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render approvals tab
         * רינדור טאב אישורים
         */
        renderApprovalsTab() {
            return `
                <div class="tab-panel tab-approvals">
                    <!-- Select All -->
                    <div class="select-all-bar">
                        <label class="checkbox-label">
                            <input type="checkbox" id="selectAllApprovals" ${this.selectedApprovalIds.size === this.allApprovals.length && this.allApprovals.length > 0 ? 'checked' : ''}>
                            <span>בחר הכל (${this.allApprovals.length} אישורים)</span>
                        </label>
                    </div>

                    <!-- Approvals List -->
                    <div class="items-list">
                        ${this.allApprovals.length === 0 ?
                            '<p class="no-items">אין אישורים ממתינים</p>' :
                            this.allApprovals.map(approval => this.renderApprovalItem(approval)).join('')
                        }
                    </div>
                </div>
            `;
        }

        /**
         * Render approval item
         * רינדור פריט אישור
         */
        renderApprovalItem(approval) {
            const isSelected = this.selectedApprovalIds.has(approval.id);

            return `
                <div class="item-row ${isSelected ? 'selected' : ''}" data-item-id="${approval.id}" data-item-type="approval">
                    <label class="item-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''}>
                    </label>
                    <div class="item-content">
                        <div class="item-title">אישור משימה</div>
                        <div class="item-meta">
                            <span class="item-date"><i class="fas fa-calendar"></i> ${this.formatDate(approval.requestedAt)}</span>
                            <span class="item-status"><i class="fas fa-hourglass-half"></i> ${approval.status || 'ממתין'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render footer
         * רינדור תחתית
         */
        renderFooter() {
            return `
                <button class="btn btn-secondary" id="cancelDeleteBtn">
                    <i class="fas fa-times"></i>
                    <span>ביטול</span>
                </button>
                <button class="btn btn-primary" id="previewDeleteBtn" disabled>
                    <i class="fas fa-eye"></i>
                    <span>תצוגה מקדימה (0)</span>
                </button>
            `;
        }

        /**
         * Update content
         * עדכון תוכן
         */
        updateContent() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            const contentEl = modal.querySelector('.modal-body');
            if (contentEl) {
                contentEl.innerHTML = this.renderContent();
            }

            this.updateFooter();
        }

        /**
         * Update footer
         * עדכון תחתית
         */
        updateFooter() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            const previewBtn = modal.querySelector('#previewDeleteBtn');
            if (previewBtn) {
                const totalSelected = this.selectedTaskIds.size + this.selectedTimesheetIds.size + this.selectedApprovalIds.size;

                // Phase 3: בדיקת מגבלה
                const overLimit = totalSelected > this.PHASE_3_MAX_ITEMS;

                previewBtn.disabled = totalSelected === 0 || overLimit;

                if (overLimit) {
                    previewBtn.querySelector('span').textContent = `❌ מקסימום ${this.PHASE_3_MAX_ITEMS} פריטים (נבחרו ${totalSelected})`;
                    previewBtn.classList.add('btn-danger');
                } else {
                    previewBtn.querySelector('span').textContent = `תצוגה מקדימה (${totalSelected})`;
                    previewBtn.classList.remove('btn-danger');
                }
            }
        }

        /**
         * Switch tab
         * החלפת טאב
         */
        switchTab(tabId) {
            this.activeTab = tabId;
            this.updateContent();
            this.attachEventListeners();
        }

        /**
         * Attach event listeners
         * צירוף מאזיני אירועים
         */
        attachEventListeners() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            // Tab buttons
            modal.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchTab(btn.dataset.tab);
                });
            });

            // Cancel button
            const cancelBtn = modal.querySelector('#cancelDeleteBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    window.ModalManager.close(this.modalId);
                });
            }

            // Preview button
            const previewBtn = modal.querySelector('#previewDeleteBtn');
            if (previewBtn) {
                previewBtn.addEventListener('click', () => {
                    this.showPreview();
                });
            }

            // Select all checkboxes
            this.attachSelectAllListeners(modal);

            // Item checkboxes
            this.attachItemCheckboxListeners(modal);

            // Filters
            this.attachFilterListeners(modal);
        }

        /**
         * Attach select all listeners
         * צירוף מאזינים לבחירת הכל
         */
        attachSelectAllListeners(modal) {
            const selectAllTasks = modal.querySelector('#selectAllTasks');
            if (selectAllTasks) {
                selectAllTasks.addEventListener('change', (e) => {
                    const filteredTasks = this.getFilteredTasks();
                    if (e.target.checked) {
                        filteredTasks.forEach(task => this.selectedTaskIds.add(task.id));
                    } else {
                        filteredTasks.forEach(task => this.selectedTaskIds.delete(task.id));
                    }
                    this.updateContent();
                    this.attachEventListeners();
                });
            }

            const selectAllTimesheets = modal.querySelector('#selectAllTimesheets');
            if (selectAllTimesheets) {
                selectAllTimesheets.addEventListener('change', (e) => {
                    const filteredTimesheets = this.getFilteredTimesheets();
                    if (e.target.checked) {
                        filteredTimesheets.forEach(ts => this.selectedTimesheetIds.add(ts.id));
                    } else {
                        filteredTimesheets.forEach(ts => this.selectedTimesheetIds.delete(ts.id));
                    }
                    this.updateContent();
                    this.attachEventListeners();
                });
            }

            const selectAllApprovals = modal.querySelector('#selectAllApprovals');
            if (selectAllApprovals) {
                selectAllApprovals.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.allApprovals.forEach(approval => this.selectedApprovalIds.add(approval.id));
                    } else {
                        this.selectedApprovalIds.clear();
                    }
                    this.updateContent();
                    this.attachEventListeners();
                });
            }
        }

        /**
         * Attach item checkbox listeners
         * צירוף מאזינים ל-checkboxes של פריטים
         */
        attachItemCheckboxListeners(modal) {
            modal.querySelectorAll('.item-row').forEach(row => {
                const checkbox = row.querySelector('input[type="checkbox"]');
                const itemId = row.dataset.itemId;
                const itemType = row.dataset.itemType;

                checkbox.addEventListener('change', (e) => {
                    if (itemType === 'task') {
                        if (e.target.checked) {
                            this.selectedTaskIds.add(itemId);
                        } else {
                            this.selectedTaskIds.delete(itemId);
                        }
                    } else if (itemType === 'timesheet') {
                        if (e.target.checked) {
                            this.selectedTimesheetIds.add(itemId);
                        } else {
                            this.selectedTimesheetIds.delete(itemId);
                        }
                    } else if (itemType === 'approval') {
                        if (e.target.checked) {
                            this.selectedApprovalIds.add(itemId);
                        } else {
                            this.selectedApprovalIds.delete(itemId);
                        }
                    }

                    this.updateFooter();
                    row.classList.toggle('selected', e.target.checked);
                });
            });
        }

        /**
         * Attach filter listeners
         * צירוף מאזינים לפילטרים
         */
        attachFilterListeners(modal) {
            const taskClientFilter = modal.querySelector('#taskClientFilter');
            if (taskClientFilter) {
                taskClientFilter.addEventListener('change', (e) => {
                    this.taskFilters.client = e.target.value;
                    this.updateContent();
                    this.attachEventListeners();
                });
            }

            const taskSearchFilter = modal.querySelector('#taskSearchFilter');
            if (taskSearchFilter) {
                taskSearchFilter.addEventListener('input', (e) => {
                    this.taskFilters.search = e.target.value;
                    this.updateContent();
                    this.attachEventListeners();
                });
            }

            const timesheetClientFilter = modal.querySelector('#timesheetClientFilter');
            if (timesheetClientFilter) {
                timesheetClientFilter.addEventListener('change', (e) => {
                    this.timesheetFilters.client = e.target.value;
                    this.updateContent();
                    this.attachEventListeners();
                });
            }

            const timesheetSearchFilter = modal.querySelector('#timesheetSearchFilter');
            if (timesheetSearchFilter) {
                timesheetSearchFilter.addEventListener('input', (e) => {
                    this.timesheetFilters.search = e.target.value;
                    this.updateContent();
                    this.attachEventListeners();
                });
            }
        }

        /**
         * Show preview
         * הצגת תצוגה מקדימה
         */
        async showPreview() {
            const totalSelected = this.selectedTaskIds.size + this.selectedTimesheetIds.size + this.selectedApprovalIds.size;

            if (totalSelected === 0) {
                window.notify.warning('לא נבחרו פריטים למחיקה');
                return;
            }

            console.log('🔍 Showing preview for deletion...');

            try {
                // Call Cloud Function with dryRun: true
                const deleteFunction = window.firebaseFunctions.httpsCallable('deleteUserDataSelective');

                const loadingId = window.notify.loading('טוען תצוגה מקדימה...');

                const result = await deleteFunction({
                    userEmail: this.userEmail,
                    taskIds: Array.from(this.selectedTaskIds),
                    timesheetIds: Array.from(this.selectedTimesheetIds),
                    approvalIds: Array.from(this.selectedApprovalIds),
                    dryRun: true // ← Preview mode
                });

                window.notify.hide(loadingId);

                console.log('✅ Preview result:', result.data);

                // Show preview modal
                this.showPreviewModal(result.data);

            } catch (error) {
                console.error('❌ Error getting preview:', error);
                window.notify.error(error.message || 'שגיאה בקבלת תצוגה מקדימה');
            }
        }

        /**
         * Show preview modal
         * הצגת מודאל תצוגה מקדימה
         */
        showPreviewModal(result) {
            const self = this;
            const previewModalId = window.ModalManager.create({
                title: '<i class="fas fa-eye"></i> תצוגה מקדימה - מה ימחק?',
                content: `
                    <div class="preview-modal">
                        <!-- Phase 3 Notice -->
                        <div class="phase-notice ${result.dryRun ? 'info' : 'warning'}">
                            <i class="fas fa-${result.dryRun ? 'shield-alt' : 'exclamation-triangle'}"></i>
                            <div>
                                <strong>${result.dryRun ? '🔒 Phase 3: Preview Mode' : '⚠️ מחיקה אמיתית!'}</strong>
                                <p>${result.message}</p>
                                <p class="phase-status">Max Items: 50 | Deletion Enabled: ${result.deletionEnabled ? 'Yes' : 'No'}</p>
                            </div>
                        </div>

                        <!-- Summary -->
                        <div class="preview-summary">
                            <h3>סיכום:</h3>
                            <ul>
                                <li><strong>משימות:</strong> ${result.deletedCounts.tasks} פריטים</li>
                                <li><strong>שעתונים:</strong> ${result.deletedCounts.timesheets} פריטים</li>
                                <li><strong>אישורים:</strong> ${result.deletedCounts.approvals} פריטים</li>
                                ${result.deletedCounts.orphanedApprovals ? `<li class="orphaned"><strong>Orphaned Approvals:</strong> ${result.deletedCounts.orphanedApprovals} (cascade)</li>` : ''}
                                <li class="total"><strong>סה"כ:</strong> ${result.deletedCounts.total} פריטים</li>
                            </ul>
                        </div>

                        <!-- Execution Time -->
                        <p class="execution-time">זמן ביצוע: ${result.executionTime}</p>

                        <!-- Phase Info -->
                        <p class="phase-info">Phase: ${result.phase}</p>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" id="closePreviewBtn">
                        <i class="fas fa-times"></i>
                        <span>סגור</span>
                    </button>
                    ${result.dryRun && result.deletionEnabled ? `
                        <button class="btn btn-danger" id="confirmRealDeleteBtn">
                            <i class="fas fa-trash"></i>
                            <span>⚠️ אני בטוח - מחק ${result.deletedCounts.total} פריטים</span>
                        </button>
                    ` : ''}
                `,
                size: 'medium',
                onOpen: () => {
                    const previewModal = window.ModalManager.getElement(previewModalId);

                    const closeBtn = previewModal.querySelector('#closePreviewBtn');
                    closeBtn.addEventListener('click', () => {
                        window.ModalManager.close(previewModalId);
                    });

                    // Real delete button
                    const confirmBtn = previewModal.querySelector('#confirmRealDeleteBtn');
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', async () => {
                            await self.executeRealDeletion();
                            window.ModalManager.close(previewModalId);
                        });
                    }
                }
            });
        }

        /**
         * Execute real deletion
         * ביצוע מחיקה אמיתית
         */
        async executeRealDeletion() {
            const totalSelected = this.selectedTaskIds.size + this.selectedTimesheetIds.size + this.selectedApprovalIds.size;

            if (totalSelected === 0) {
                window.notify.warning('לא נבחרו פריטים למחיקה');
                return;
            }

            if (totalSelected > this.PHASE_3_MAX_ITEMS) {
                window.notify.error(`מקסימום ${this.PHASE_3_MAX_ITEMS} פריטים. נבחרו ${totalSelected}`);
                return;
            }

            console.log('🗑️ Executing REAL deletion...');

            try {
                const deleteFunction = window.firebaseFunctions.httpsCallable('deleteUserDataSelective');

                const loadingId = window.notify.loading(`מוחק ${totalSelected} פריטים...`);

                const result = await deleteFunction({
                    userEmail: this.userEmail,
                    taskIds: Array.from(this.selectedTaskIds),
                    timesheetIds: Array.from(this.selectedTimesheetIds),
                    approvalIds: Array.from(this.selectedApprovalIds),
                    dryRun: false // ← REAL DELETION!
                });

                window.notify.hide(loadingId);

                console.log('✅ Real deletion result:', result.data);

                if (result.data.success) {
                    window.notify.success(`✅ נמחקו ${result.data.deletedCounts.total} פריטים`);

                    // Close modal
                    window.ModalManager.close(this.modalId);

                    // Optional: refresh user data
                    if (window.DataManager && window.DataManager.refreshUsers) {
                        await window.DataManager.refreshUsers();
                    }
                }

            } catch (error) {
                console.error('❌ Error executing real deletion:', error);
                window.notify.error(error.message || 'שגיאה במחיקת נתונים');
            }
        }

        /**
         * Helper: Escape HTML
         * עזר: escape HTML
         */
        escapeHtml(text) {
            if (!text) {
return '';
}
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Helper: Format date
         * עזר: פורמט תאריך
         */
        formatDate(date) {
            if (!date) {
return 'N/A';
}

            let dateObj;
            if (date.toDate && typeof date.toDate === 'function') {
                dateObj = date.toDate();
            } else if (date instanceof Date) {
                dateObj = date;
            } else {
                return 'N/A';
            }

            return dateObj.toLocaleDateString('he-IL', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
    }

    // Create global instance
    window.DeleteDataModal = new DeleteDataModal();

    console.log('✅ DeleteDataModal loaded (Phase 3: Limited Delete - 50 items max)');

})();

