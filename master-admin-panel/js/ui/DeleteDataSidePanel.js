/**
 * Delete Data Side Panel
 * פאנל צד למחיקת נתונים סלקטיבית
 *
 * Created: 2025-12-24
 * Style: Clean minimal (like TaskApprovalSidePanel)
 *
 * 🔒 Phase 3: Limited Delete (50 items max)
 */

(function() {
    'use strict';

    class DeleteDataSidePanel {
        constructor() {
            this.isOpen = false;
            this.overlay = null;
            this.panel = null;

            // User data
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

            // Active tab
            this.activeTab = 'tasks';

            // Phase 3 limit
            this.PHASE_3_MAX_ITEMS = 50;
        }

        /**
         * Open the side panel
         * פתיחת הפאנל
         */
        async open(userData) {
            if (this.isOpen) {
                console.log('⚠️ Panel already open');
                return;
            }

            console.log('🗑️ Opening DeleteDataSidePanel for:', userData.email);

            this.userData = userData;
            this.userEmail = userData.email;

            // Reset state
            this.resetState();

            // Create overlay and panel
            this.createPanel();

            // Show panel with animation
            setTimeout(() => {
                this.overlay.classList.add('active');
                this.panel.classList.add('active');
            }, 10);

            this.isOpen = true;

            // Load data
            await this.loadUserData();
        }

        /**
         * Close the side panel
         * סגירת הפאנל
         */
        close() {
            if (!this.isOpen) {
                return;
            }

            console.log('🔒 Closing DeleteDataSidePanel...');

            // Hide with animation
            this.overlay.classList.remove('active');
            this.panel.classList.remove('active');

            // Remove from DOM after animation
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                if (this.panel && this.panel.parentNode) {
                    this.panel.parentNode.removeChild(this.panel);
                }
                this.overlay = null;
                this.panel = null;
            }, 300);

            this.isOpen = false;
            this.resetState();
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
         * Create panel
         * יצירת הפאנל
         */
        createPanel() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'delete-panel-overlay';
            this.overlay.addEventListener('click', () => this.close());
            document.body.appendChild(this.overlay);

            // Create panel
            this.panel = document.createElement('div');
            this.panel.className = 'delete-slide-in-panel';
            this.panel.innerHTML = this.renderPanelHTML();
            document.body.appendChild(this.panel);

            // Attach event listeners
            this.attachEventListeners();
        }

        /**
         * Render panel HTML
         * רינדור HTML של הפאנל
         */
        renderPanelHTML() {
            const displayName = this.userData.displayName || this.userData.email;

            return `
                <!-- Header -->
                <div class="delete-panel-header">
                    <div class="delete-panel-title-row">
                        <h3><i class="fas fa-trash-alt"></i> מחיקת נתונים: ${displayName}</h3>
                    </div>
                    <button class="delete-panel-close" id="deletePanelClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Phase 3 Warning -->
                <div class="delete-phase-warning">
                    <i class="fas fa-info-circle"></i>
                    <span><strong>🚀 Phase 3: Limited Delete</strong> - מקסימום ${this.PHASE_3_MAX_ITEMS} פריטים למחיקה</span>
                </div>

                <!-- Tabs -->
                <div class="delete-panel-tabs">
                    <button class="delete-tab-btn active" data-tab="tasks">
                        <i class="fas fa-tasks"></i>
                        <span>משימות</span>
                        <span class="delete-tab-count" id="tasksTabCount">0</span>
                    </button>
                    <button class="delete-tab-btn" data-tab="timesheets">
                        <i class="fas fa-clock"></i>
                        <span>שעתונים</span>
                        <span class="delete-tab-count" id="timesheetsTabCount">0</span>
                    </button>
                    <button class="delete-tab-btn" data-tab="approvals">
                        <i class="fas fa-check-circle"></i>
                        <span>אישורים</span>
                        <span class="delete-tab-count" id="approvalsTabCount">0</span>
                    </button>
                </div>

                <!-- Content Area -->
                <div class="delete-panel-content" id="deletePanelContent">
                    ${this.renderLoadingState()}
                </div>

                <!-- Footer -->
                <div class="delete-panel-footer">
                    <div class="delete-selection-summary">
                        <span id="deleteSelectionCount">נבחרו: 0/${this.PHASE_3_MAX_ITEMS}</span>
                    </div>
                    <div class="delete-panel-actions">
                        <button class="btn btn-secondary" id="deleteCancelBtn">
                            <i class="fas fa-times"></i>
                            <span>ביטול</span>
                        </button>
                        <button class="btn btn-primary" id="deletePreviewBtn" disabled>
                            <i class="fas fa-eye"></i>
                            <span>תצוגה מקדימה</span>
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Render loading state
         * רינדור מצב טעינה
         */
        renderLoadingState() {
            return `
                <div class="delete-loading-state">
                    <div class="spinner"></div>
                    <p>טוען נתונים...</p>
                </div>
            `;
        }

        /**
         * Load user data
         * טעינת נתוני משתמש
         */
        async loadUserData() {
            try {
                console.log('📥 Loading user data for:', this.userEmail);

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

                // Update tab counts
                this.updateTabCounts();

                // Render active tab content
                this.renderTabContent();

            } catch (error) {
                console.error('❌ Error loading user data:', error);
                this.showError('שגיאה בטעינת נתונים');
            }
        }

        /**
         * Fetch user tasks
         * שליפת משימות משתמש
         */
        async fetchUserTasks() {
            try {
                const snapshot = await window.firebaseDB.collection('budget_tasks')
                    .where('employee', '==', this.userEmail)
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
                    .where('employee', '==', this.userEmail)
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
                    .orderBy('createdAt', 'desc')
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
         * Update tab counts
         * עדכון מספרים בטאבים
         */
        updateTabCounts() {
            const tasksCount = document.getElementById('tasksTabCount');
            const timesheetsCount = document.getElementById('timesheetsTabCount');
            const approvalsCount = document.getElementById('approvalsTabCount');

            if (tasksCount) {
tasksCount.textContent = this.allTasks.length;
}
            if (timesheetsCount) {
timesheetsCount.textContent = this.allTimesheets.length;
}
            if (approvalsCount) {
approvalsCount.textContent = this.allApprovals.length;
}
        }

        /**
         * Render tab content
         * רינדור תוכן טאב
         */
        renderTabContent() {
            const contentEl = document.getElementById('deletePanelContent');
            if (!contentEl) {
return;
}

            let html = '';

            switch (this.activeTab) {
                case 'tasks':
                    html = this.renderTasksTab();
                    break;
                case 'timesheets':
                    html = this.renderTimesheetsTab();
                    break;
                case 'approvals':
                    html = this.renderApprovalsTab();
                    break;
            }

            contentEl.innerHTML = html;
            this.attachTabEventListeners();
        }

        /**
         * Render tasks tab
         * רינדור טאב משימות
         */
        renderTasksTab() {
            if (this.allTasks.length === 0) {
                return `
                    <div class="delete-empty-state">
                        <i class="fas fa-tasks"></i>
                        <p>אין משימות למשתמש זה</p>
                    </div>
                `;
            }

            return `
                <div class="delete-tab-content">
                    <div class="delete-select-all">
                        <label>
                            <input type="checkbox" id="selectAllTasks">
                            <span>בחר הכל (${this.allTasks.length})</span>
                        </label>
                    </div>
                    <div class="delete-items-list">
                        ${this.allTasks.map(task => this.renderTaskItem(task)).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Render task item
         * רינדור פריט משימה
         */
        renderTaskItem(task) {
            const isSelected = this.selectedTaskIds.has(task.id);
            const isDisabled = !isSelected && this.getTotalSelected() >= this.PHASE_3_MAX_ITEMS;

            return `
                <div class="delete-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}">
                    <label>
                        <input
                            type="checkbox"
                            class="task-checkbox"
                            data-id="${task.id}"
                            ${isSelected ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                        >
                        <div class="delete-item-content">
                            <div class="delete-item-title">${this.escapeHtml(task.serviceName || 'ללא שם')}</div>
                            <div class="delete-item-meta">
                                <span><i class="fas fa-user"></i> ${this.escapeHtml(task.clientName || 'N/A')}</span>
                                <span><i class="fas fa-calendar"></i> ${this.formatDate(task.createdAt)}</span>
                            </div>
                        </div>
                    </label>
                </div>
            `;
        }

        /**
         * Render timesheets tab
         * רינדור טאב שעתונים
         */
        renderTimesheetsTab() {
            if (this.allTimesheets.length === 0) {
                return `
                    <div class="delete-empty-state">
                        <i class="fas fa-clock"></i>
                        <p>אין שעתונים למשתמש זה</p>
                    </div>
                `;
            }

            return `
                <div class="delete-tab-content">
                    <div class="delete-select-all">
                        <label>
                            <input type="checkbox" id="selectAllTimesheets">
                            <span>בחר הכל (${this.allTimesheets.length})</span>
                        </label>
                    </div>
                    <div class="delete-items-list">
                        ${this.allTimesheets.map(timesheet => this.renderTimesheetItem(timesheet)).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Render timesheet item
         * רינדור פריט שעתון
         */
        renderTimesheetItem(timesheet) {
            const isSelected = this.selectedTimesheetIds.has(timesheet.id);
            const isDisabled = !isSelected && this.getTotalSelected() >= this.PHASE_3_MAX_ITEMS;

            return `
                <div class="delete-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}">
                    <label>
                        <input
                            type="checkbox"
                            class="timesheet-checkbox"
                            data-id="${timesheet.id}"
                            ${isSelected ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                        >
                        <div class="delete-item-content">
                            <div class="delete-item-title">${this.escapeHtml(timesheet.action || timesheet.taskDescription || 'ללא תיאור')}</div>
                            <div class="delete-item-meta">
                                <span><i class="fas fa-user"></i> ${this.escapeHtml(timesheet.clientName || 'N/A')}</span>
                                <span><i class="fas fa-calendar"></i> ${this.formatDate(timesheet.date)}</span>
                                <span><i class="fas fa-clock"></i> ${timesheet.hours || 0} שעות</span>
                            </div>
                        </div>
                    </label>
                </div>
            `;
        }

        /**
         * Render approvals tab
         * רינדור טאב אישורים
         */
        renderApprovalsTab() {
            if (this.allApprovals.length === 0) {
                return `
                    <div class="delete-empty-state">
                        <i class="fas fa-check-circle"></i>
                        <p>אין אישורים למשתמש זה</p>
                    </div>
                `;
            }

            return `
                <div class="delete-tab-content">
                    <div class="delete-select-all">
                        <label>
                            <input type="checkbox" id="selectAllApprovals">
                            <span>בחר הכל (${this.allApprovals.length})</span>
                        </label>
                    </div>
                    <div class="delete-items-list">
                        ${this.allApprovals.map(approval => this.renderApprovalItem(approval)).join('')}
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
            const isDisabled = !isSelected && this.getTotalSelected() >= this.PHASE_3_MAX_ITEMS;

            const statusText = approval.status === 'pending' ? 'ממתין' :
                              approval.status === 'approved' ? 'אושר' : 'נדחה';
            const statusClass = approval.status === 'pending' ? 'warning' :
                               approval.status === 'approved' ? 'success' : 'danger';

            return `
                <div class="delete-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}">
                    <label>
                        <input
                            type="checkbox"
                            class="approval-checkbox"
                            data-id="${approval.id}"
                            ${isSelected ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                        >
                        <div class="delete-item-content">
                            <div class="delete-item-title">
                                אישור: ${approval.requestedMinutes || 0} דקות
                                <span class="badge badge-${statusClass}">${statusText}</span>
                            </div>
                            <div class="delete-item-meta">
                                <span><i class="fas fa-calendar"></i> ${this.formatDate(approval.createdAt)}</span>
                            </div>
                        </div>
                    </label>
                </div>
            `;
        }

        /**
         * Attach event listeners
         * חיבור מאזיני אירועים
         */
        attachEventListeners() {
            // Close button
            const closeBtn = document.getElementById('deletePanelClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // Cancel button
            const cancelBtn = document.getElementById('deleteCancelBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.close());
            }

            // Preview button
            const previewBtn = document.getElementById('deletePreviewBtn');
            if (previewBtn) {
                previewBtn.addEventListener('click', () => this.showPreview());
            }

            // Tab buttons
            const tabBtns = this.panel.querySelectorAll('.delete-tab-btn');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.currentTarget.dataset.tab;
                    this.switchTab(tab);
                });
            });
        }

        /**
         * Attach tab event listeners
         * חיבור מאזיני אירועים לטאב
         */
        attachTabEventListeners() {
            // Select all checkboxes
            const selectAllTasks = document.getElementById('selectAllTasks');
            if (selectAllTasks) {
                selectAllTasks.addEventListener('change', (e) => {
                    this.toggleSelectAll('tasks', e.target.checked);
                });
            }

            const selectAllTimesheets = document.getElementById('selectAllTimesheets');
            if (selectAllTimesheets) {
                selectAllTimesheets.addEventListener('change', (e) => {
                    this.toggleSelectAll('timesheets', e.target.checked);
                });
            }

            const selectAllApprovals = document.getElementById('selectAllApprovals');
            if (selectAllApprovals) {
                selectAllApprovals.addEventListener('change', (e) => {
                    this.toggleSelectAll('approvals', e.target.checked);
                });
            }

            // Individual checkboxes
            const taskCheckboxes = this.panel.querySelectorAll('.task-checkbox');
            taskCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    this.toggleTask(e.target.dataset.id, e.target.checked);
                });
            });

            const timesheetCheckboxes = this.panel.querySelectorAll('.timesheet-checkbox');
            timesheetCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    this.toggleTimesheet(e.target.dataset.id, e.target.checked);
                });
            });

            const approvalCheckboxes = this.panel.querySelectorAll('.approval-checkbox');
            approvalCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    this.toggleApproval(e.target.dataset.id, e.target.checked);
                });
            });
        }

        /**
         * Switch tab
         * החלפת טאב
         */
        switchTab(tab) {
            this.activeTab = tab;

            // Update active state on buttons
            const tabBtns = this.panel.querySelectorAll('.delete-tab-btn');
            tabBtns.forEach(btn => {
                if (btn.dataset.tab === tab) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Render content
            this.renderTabContent();
        }

        /**
         * Toggle select all
         * בחירה/ביטול הכל
         */
        toggleSelectAll(type, checked) {
            const totalSelected = this.getTotalSelected();
            const remaining = this.PHASE_3_MAX_ITEMS - totalSelected;

            if (type === 'tasks') {
                if (checked) {
                    const itemsToSelect = this.allTasks.slice(0, remaining);
                    itemsToSelect.forEach(task => {
                        if (!this.selectedTaskIds.has(task.id)) {
                            this.selectedTaskIds.add(task.id);
                        }
                    });
                } else {
                    this.selectedTaskIds.clear();
                }
            } else if (type === 'timesheets') {
                if (checked) {
                    const itemsToSelect = this.allTimesheets.slice(0, remaining);
                    itemsToSelect.forEach(timesheet => {
                        if (!this.selectedTimesheetIds.has(timesheet.id)) {
                            this.selectedTimesheetIds.add(timesheet.id);
                        }
                    });
                } else {
                    this.selectedTimesheetIds.clear();
                }
            } else if (type === 'approvals') {
                if (checked) {
                    const itemsToSelect = this.allApprovals.slice(0, remaining);
                    itemsToSelect.forEach(approval => {
                        if (!this.selectedApprovalIds.has(approval.id)) {
                            this.selectedApprovalIds.add(approval.id);
                        }
                    });
                } else {
                    this.selectedApprovalIds.clear();
                }
            }

            this.updateUI();
        }

        /**
         * Toggle task selection
         * בחירה/ביטול משימה
         */
        toggleTask(taskId, checked) {
            if (checked) {
                if (this.getTotalSelected() < this.PHASE_3_MAX_ITEMS) {
                    this.selectedTaskIds.add(taskId);
                }
            } else {
                this.selectedTaskIds.delete(taskId);
            }
            this.updateUI();
        }

        /**
         * Toggle timesheet selection
         * בחירה/ביטול שעתון
         */
        toggleTimesheet(timesheetId, checked) {
            if (checked) {
                if (this.getTotalSelected() < this.PHASE_3_MAX_ITEMS) {
                    this.selectedTimesheetIds.add(timesheetId);
                }
            } else {
                this.selectedTimesheetIds.delete(timesheetId);
            }
            this.updateUI();
        }

        /**
         * Toggle approval selection
         * בחירה/ביטול אישור
         */
        toggleApproval(approvalId, checked) {
            if (checked) {
                if (this.getTotalSelected() < this.PHASE_3_MAX_ITEMS) {
                    this.selectedApprovalIds.add(approvalId);
                }
            } else {
                this.selectedApprovalIds.delete(approvalId);
            }
            this.updateUI();
        }

        /**
         * Get total selected items
         * קבלת סה"כ פריטים נבחרים
         */
        getTotalSelected() {
            return this.selectedTaskIds.size + this.selectedTimesheetIds.size + this.selectedApprovalIds.size;
        }

        /**
         * Update UI
         * עדכון ממשק
         */
        updateUI() {
            const totalSelected = this.getTotalSelected();
            const overLimit = totalSelected > this.PHASE_3_MAX_ITEMS;

            // Update selection count
            const countEl = document.getElementById('deleteSelectionCount');
            if (countEl) {
                countEl.textContent = `נבחרו: ${totalSelected}/${this.PHASE_3_MAX_ITEMS}`;
                if (overLimit) {
                    countEl.classList.add('over-limit');
                } else {
                    countEl.classList.remove('over-limit');
                }
            }

            // Update preview button
            const previewBtn = document.getElementById('deletePreviewBtn');
            if (previewBtn) {
                if (totalSelected === 0 || overLimit) {
                    previewBtn.disabled = true;
                    if (overLimit) {
                        previewBtn.querySelector('span').textContent = `❌ מקסימום ${this.PHASE_3_MAX_ITEMS} פריטים`;
                    } else {
                        previewBtn.querySelector('span').textContent = 'תצוגה מקדימה';
                    }
                } else {
                    previewBtn.disabled = false;
                    previewBtn.querySelector('span').textContent = `תצוגה מקדימה (${totalSelected})`;
                }
            }

            // Re-render current tab to update disabled state
            this.renderTabContent();
        }

        /**
         * Show preview
         * הצגת תצוגה מקדימה
         */
        async showPreview() {
            const totalSelected = this.getTotalSelected();

            if (totalSelected === 0) {
                window.notify.warning('לא נבחרו פריטים למחיקה');
                return;
            }

            if (totalSelected > this.PHASE_3_MAX_ITEMS) {
                window.notify.error(`מקסימום ${this.PHASE_3_MAX_ITEMS} פריטים למחיקה`);
                return;
            }

            console.log('🔍 Showing preview for deletion...');
            window.notify.info('שולח בקשה לשרת...');

            try {
                const deleteFunction = window.firebaseFunctions.httpsCallable('deleteUserDataSelective');

                const result = await deleteFunction({
                    userEmail: this.userEmail,
                    taskIds: Array.from(this.selectedTaskIds),
                    timesheetIds: Array.from(this.selectedTimesheetIds),
                    approvalIds: Array.from(this.selectedApprovalIds),
                    dryRun: true
                });

                console.log('✅ Preview result:', result.data);
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
            const modalId = window.ModalManager.create({
                title: '<i class="fas fa-eye"></i> תצוגה מקדימה - מה ימחק?',
                content: `
                    <div class="preview-modal">
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

                        ${result.dryRun && result.deletionEnabled ? `
                            <div class="preview-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>אזהרה:</strong> פעולה זו תמחק את הפריטים לצמיתות ולא ניתן לשחזר אותם!
                            </div>
                        ` : ''}
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" data-modal-close>
                        <i class="fas fa-times"></i>
                        <span>ביטול</span>
                    </button>
                    ${result.dryRun && result.deletionEnabled ? `
                        <button class="btn btn-danger" id="confirmRealDeleteBtn">
                            <i class="fas fa-trash"></i>
                            <span>⚠️ אני בטוח - מחק ${result.deletedCounts.total} פריטים</span>
                        </button>
                    ` : ''}
                `,
                size: 'medium',
                closeOnBackdrop: false
            });

            // Attach confirm button
            setTimeout(() => {
                const confirmBtn = document.getElementById('confirmRealDeleteBtn');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', async () => {
                        window.ModalManager.close(modalId);
                        await this.executeRealDeletion();
                    });
                }
            }, 100);
        }

        /**
         * Execute real deletion
         * ביצוע מחיקה אמיתית
         */
        async executeRealDeletion() {
            console.log('🗑️ Executing real deletion...');
            window.notify.info('מוחק נתונים...');

            try {
                const deleteFunction = window.firebaseFunctions.httpsCallable('deleteUserDataSelective');

                const result = await deleteFunction({
                    userEmail: this.userEmail,
                    taskIds: Array.from(this.selectedTaskIds),
                    timesheetIds: Array.from(this.selectedTimesheetIds),
                    approvalIds: Array.from(this.selectedApprovalIds),
                    dryRun: false
                });

                console.log('✅ Deletion result:', result.data);

                window.notify.success(`✅ נמחקו ${result.data.deletedCounts.total} פריטים בהצלחה!`);

                // Close panel
                this.close();

            } catch (error) {
                console.error('❌ Error executing deletion:', error);
                window.notify.error(error.message || 'שגיאה במחיקת נתונים');
            }
        }

        /**
         * Show error
         * הצגת שגיאה
         */
        showError(message) {
            const contentEl = document.getElementById('deletePanelContent');
            if (contentEl) {
                contentEl.innerHTML = `
                    <div class="delete-error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                    </div>
                `;
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
            } else if (typeof date === 'string') {
                dateObj = new Date(date);
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
    window.DeleteDataSidePanel = new DeleteDataSidePanel();

    console.log('✅ DeleteDataSidePanel loaded (Phase 3: Limited Delete - 50 items max)');

})();
