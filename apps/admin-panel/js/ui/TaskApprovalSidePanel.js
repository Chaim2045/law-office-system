/**
 * Budget Overrun Side Panel  ("חריגות תקציב")
 * פאנל צד לחריגות תקציב משימות
 *
 * Created: 2025-12-17 (was the dormant "אישורי משימות" auto-approved feed)
 * Repurposed: 2026-06-15 (H.4 PR-a — "Model A: smart budget meter")
 *
 * DATA SOURCE (documented choice): a LIVE `onSnapshot` on `budget_tasks` where
 * status == 'פעיל' (active). `budget_tasks` is admin-readable (firestore.rules
 * owner-or-admin), so an admin gets the whole active set. We filter CLIENT-SIDE
 * to the over-budget / approaching set (`window.BudgetStatus.budgetStatus` level
 * in ['warning','danger']) and render each as a budget-meter card. onSnapshot was
 * chosen over the `getBudgetTasks` callable because the feed must stay live as
 * employees log time (the overrun state changes on the hot write path) — exactly
 * what the H.4 admin-visibility gap needs. The listener is torn down on close().
 *
 * READ-ONLY: this panel renders an overrun signal only — there is NO approve/
 * reject action (the old auto-approval gate is retired in H.4 PR-a). Cards are
 * informational; the worker fixes an overrun from the User App ("עדכן תקציב").
 *
 * Style: reuses the existing `apps/admin-panel/css/task-approval-side-panel.css`
 * structure (overlay + slide-in panel + filters + search + cards), so the visual
 * shell is unchanged; only the data + labels are budget semantics.
 */

(function() {
    'use strict';

    class TaskApprovalSidePanel {
        constructor() {
            this.isOpen = false;
            this.overlay = null;
            this.panel = null;
            this.tasks = [];            // over-budget/approaching active budget_tasks
            this.filteredTasks = [];
            this.currentFilter = 'all'; // 'all' | 'over' | 'approaching'
            this.searchTerm = '';
            this.realtimeUnsubscribe = null;
        }

        /**
         * Initialize the side panel
         * אתחול הפאנל — no external service needed (reads budget_tasks directly).
         */
        async init() {
            console.log('📊 Initializing Budget Overrun Side Panel...');
            // Nothing to wire — the panel reads budget_tasks via window.firebaseDB on open().
            // Kept async so the existing nav call site (await ...init()) is unchanged.
            console.log('✅ Budget Overrun Side Panel initialized');
        }

        /**
         * Open the side panel
         * פתיחת הפאנל
         */
        async open() {
            if (this.isOpen) {
                console.log('⚠️ Panel already open');
                return;
            }

            console.log('🔓 Opening Budget Overrun Side Panel...');

            // Update lastViewedAt timestamp (drives the nav badge "viewed" baseline)
            const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
            if (currentUser && window.firebaseDB) {
                try {
                    await window.firebaseDB
                        .collection('employees')
                        .doc(currentUser.email)
                        .set({
                            approvalsPanelLastViewed: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                } catch (error) {
                    console.error('❌ Error updating lastViewedAt:', error?.code || 'unknown');
                }
            }

            // Create overlay and panel
            this.createPanel();

            // Show panel with animation
            setTimeout(() => {
                this.overlay.classList.add('active');
                this.panel.classList.add('active');
            }, 10);

            this.isOpen = true;

            // Start the live listener (it also performs the first render)
            this.startRealtimeListener();
        }

        /**
         * Close the side panel
         * סגירת הפאנל
         */
        close() {
            if (!this.isOpen) {
                return;
            }

            console.log('🔒 Closing Budget Overrun Side Panel...');

            // Stop realtime listener
            if (this.realtimeUnsubscribe) {
                this.realtimeUnsubscribe();
                this.realtimeUnsubscribe = null;
            }

            // Hide panel with animation
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
            }, 400);

            this.isOpen = false;
        }

        /**
         * Create panel HTML
         * יצירת HTML של הפאנל
         */
        createPanel() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'approval-panel-overlay';
            this.overlay.addEventListener('click', () => this.close());
            document.body.appendChild(this.overlay);

            // Create panel
            this.panel = document.createElement('div');
            this.panel.className = 'approval-slide-in-panel';
            this.panel.innerHTML = `
                <div class="approval-panel-header">
                    <div class="approval-panel-title-row">
                        <h3>חריגות תקציב</h3>
                        <span class="approval-count-badge-panel" id="approvalCountPanelBadge">0</span>
                    </div>
                    <button class="approval-panel-close" id="approvalPanelClose" aria-label="סגור פאנל">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="approval-panel-filters">
                    <button class="approval-filter-btn active" data-filter="all">
                        <i class="fas fa-list"></i>
                        <span>הכל</span>
                    </button>
                    <button class="approval-filter-btn" data-filter="over">
                        <i class="fas fa-triangle-exclamation"></i>
                        <span>חריגה</span>
                    </button>
                    <button class="approval-filter-btn" data-filter="approaching">
                        <i class="fas fa-gauge-high"></i>
                        <span>מתקרב</span>
                    </button>
                </div>

                <div class="approval-panel-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="approvalSearchInput" placeholder="חיפוש לפי לקוח או משימה..." aria-label="חיפוש חריגות תקציב" />
                </div>

                <div class="approval-panel-body" id="approvalPanelBody">
                    <div class="approval-panel-loading">
                        <div class="spinner-circle"></div>
                        <p>טוען חריגות תקציב...</p>
                    </div>
                </div>
            `;

            document.body.appendChild(this.panel);

            // Attach event listeners
            this.attachEventListeners();
        }

        /**
         * Attach event listeners
         * צירוף מאזיני אירועים
         */
        attachEventListeners() {
            // Close button
            const closeBtn = this.panel.querySelector('#approvalPanelClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // Filter buttons (client-side filter only — no re-query needed)
            const filterBtns = this.panel.querySelectorAll('.approval-filter-btn');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.currentFilter = e.currentTarget.dataset.filter;
                    this.applyFiltersAndRender();
                });
            });

            // Search input
            const searchInput = this.panel.querySelector('#approvalSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchTerm = e.target.value.trim();
                    this.applyFiltersAndRender();
                });
            }
        }

        /**
         * Start live listener on active budget tasks.
         * התחל מאזין בזמן אמת על משימות תקציב פעילות.
         *
         * Reads ALL active tasks (admin scope), then filters client-side to those
         * whose budgetStatus level is 'warning' or 'danger' (approaching / over).
         */
        startRealtimeListener() {
            if (!window.firebaseDB) {
                console.error('❌ Firebase DB not available for budget overrun feed');
                this.renderError();
                return;
            }

            try {
                this.realtimeUnsubscribe = window.firebaseDB
                    .collection('budget_tasks')
                    .where('status', '==', 'פעיל')
                    .onSnapshot(
                        (snapshot) => {
                            const overruns = [];
                            snapshot.forEach((doc) => {
                                const data = doc.data() || {};
                                const status = this._statusFor(data);
                                // Keep only approaching/over (warning|danger). Skip
                                // success/neutral (within budget / no budget set).
                                if (status.level === 'warning' || status.level === 'danger') {
                                    overruns.push({
                                        id: doc.id,
                                        clientName: data.clientName || '',
                                        description: data.description || '',
                                        actualMinutes: this._num(data.actualMinutes),
                                        estimatedMinutes: this._num(data.estimatedMinutes),
                                        status
                                    });
                                }
                            });
                            this.tasks = overruns;
                            this.applyFiltersAndRender();
                        },
                        (error) => {
                            console.error('❌ Budget overrun listener error:', error?.code || 'unknown');
                            this.renderError();
                        }
                    );
            } catch (error) {
                console.error('❌ Failed to start budget overrun listener:', error?.code || 'unknown');
                this.renderError();
            }
        }

        /**
         * Apply the current tab + search filter, then render.
         * החל פילטר (טאב + חיפוש) ורנדר.
         */
        applyFiltersAndRender() {
            let filtered = [...this.tasks];

            // Tab filter
            if (this.currentFilter === 'over') {
                filtered = filtered.filter(t => t.status.level === 'danger');
            } else if (this.currentFilter === 'approaching') {
                filtered = filtered.filter(t => t.status.level === 'warning');
            }

            // Search filter (client + task description)
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                filtered = filtered.filter(t =>
                    (t.clientName || '').toLowerCase().includes(term) ||
                    (t.description || '').toLowerCase().includes(term)
                );
            }

            // Sort: most-over first (highest percent), then by client name.
            filtered.sort((a, b) => {
                const pa = a.status.percent || 0;
                const pb = b.status.percent || 0;
                if (pb !== pa) {
                    return pb - pa;
                }
                return (a.clientName || '').localeCompare(b.clientName || '', 'he');
            });

            this.filteredTasks = filtered;
            this.renderTasks();
        }

        /**
         * Render the overrun cards.
         * רינדור כרטיסי החריגות.
         */
        renderTasks() {
            const bodyEl = this.panel && this.panel.querySelector('#approvalPanelBody');
            if (!bodyEl) {
                return;
            }

            // Update count badge
            const countBadge = this.panel.querySelector('#approvalCountPanelBadge');
            if (countBadge) {
                countBadge.textContent = this.filteredTasks.length;
            }

            // Empty state
            if (this.filteredTasks.length === 0) {
                bodyEl.innerHTML = `
                    <div class="approval-panel-empty">
                        <i class="fas fa-circle-check"></i>
                        <p>אין משימות ${this._escapeHtml(this._filterEmptyText())}</p>
                    </div>
                `;
                return;
            }

            const cards = this.filteredTasks.map(task => this.renderCard(task)).join('');
            bodyEl.innerHTML = `<div class="approval-requests-list">${cards}</div>`;
        }

        /**
         * Render a single overrun card.
         * רינדור כרטיס חריגה בודד.
         */
        renderCard(task) {
            const actualH = this._formatHours(task.actualMinutes);
            const estH = this._formatHours(task.estimatedMinutes);
            const level = task.status.level; // 'warning' | 'danger'
            const label = task.status.label;
            const percent = task.status.percent;
            const percentText = (typeof percent === 'number') ? `${percent}%` : '';

            return `
                <div class="approval-card budget-overrun-card budget-level-${this._escapeHtml(level)}">
                    <div class="approval-card-header">
                        <h5 class="approval-card-task">${this._escapeHtml(task.description || 'ללא תיאור')}</h5>
                        <span class="budget-status-badge budget-level-${this._escapeHtml(level)}">${this._escapeHtml(label)}${percentText ? ' · ' + this._escapeHtml(percentText) : ''}</span>
                    </div>
                    <div class="approval-card-body">
                        <div class="approval-card-row">
                            <i class="fas fa-briefcase"></i>
                            <span>${this._escapeHtml(task.clientName || 'לא צוין')}</span>
                        </div>
                        <div class="approval-card-row">
                            <i class="fas fa-clock"></i>
                            <span class="budget-hours">${this._escapeHtml(actualH)} / ${this._escapeHtml(estH)} שעות</span>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render error state
         * רינדור מצב שגיאה
         */
        renderError() {
            const bodyEl = this.panel && this.panel.querySelector('#approvalPanelBody');
            if (!bodyEl) {
                return;
            }

            bodyEl.innerHTML = `
                <div class="approval-panel-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>שגיאה בטעינת חריגות תקציב</p>
                    <button onclick="window.taskApprovalSidePanel.startRealtimeListener()">נסה שוב</button>
                </div>
            `;
        }

        // ===== Helper Functions =====

        /** budgetStatus via the canonical window.BudgetStatus (fallback inline). */
        _statusFor(data) {
            const actual = this._num(data.actualMinutes);
            const est = this._num(data.estimatedMinutes);
            if (window.BudgetStatus && typeof window.BudgetStatus.budgetStatus === 'function') {
                return window.BudgetStatus.budgetStatus(actual, est);
            }
            // Defensive fallback (BudgetStatus should always be loaded before this panel).
            if (!(est > 0)) {
                return { level: 'neutral', label: 'אין תקציב', percent: null, isOver: false };
            }
            const percent = Math.round((actual / est) * 100);
            if (percent > 100) {
                return { level: 'danger', label: 'חריגת תקציב', percent, isOver: true };
            }
            if (percent >= 85) {
                return { level: 'warning', label: 'מתקרב לתקציב', percent, isOver: false };
            }
            return { level: 'success', label: 'בתקציב', percent, isOver: false };
        }

        _formatHours(minutes) {
            if (window.BudgetStatus && typeof window.BudgetStatus.formatHoursFromMinutes === 'function') {
                return window.BudgetStatus.formatHoursFromMinutes(minutes);
            }
            const m = (typeof minutes === 'number' && isFinite(minutes)) ? minutes : 0;
            return (Math.round((m / 60) * 10) / 10).toFixed(1);
        }

        _num(v) {
            return (typeof v === 'number' && isFinite(v)) ? v : 0;
        }

        _filterEmptyText() {
            switch (this.currentFilter) {
                case 'over':
                    return 'בחריגת תקציב';
                case 'approaching':
                    return 'שמתקרבות לתקציב';
                case 'all':
                default:
                    return 'בחריגת תקציב';
            }
        }

        _escapeHtml(str) {
            if (str === null || str === undefined) {
                return '';
            }
            const div = document.createElement('div');
            div.textContent = String(str);
            return div.innerHTML;
        }
    }

    // Create global instance (keep the existing window names so the nav wiring is unchanged)
    window.TaskApprovalSidePanel = TaskApprovalSidePanel;
    window.taskApprovalSidePanel = new TaskApprovalSidePanel();

    console.log('✅ Budget Overrun Side Panel loaded');

})();
