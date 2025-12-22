/**
 * Task Approval Side Panel
 * פאנל צד לאישור משימות
 *
 * Created: 2025-12-17
 * Style: Clean minimal (like tasks panel)
 */

(function() {
    'use strict';

    class TaskApprovalSidePanel {
        constructor() {
            this.isOpen = false;
            this.overlay = null;
            this.panel = null;
            this.approvals = [];
            this.filteredApprovals = [];
            this.currentFilter = 'pending';
            this.searchTerm = '';
            this.realtimeUnsubscribe = null;
            this.approvalDialog = null;
        }

        /**
         * Initialize the side panel
         * אתחול הפאנל
         */
        async init() {
            console.log('📊 Initializing TaskApprovalSidePanel...');

            // Use services from task-approvals.html system (loaded globally)
            try {
                // Check if services are loaded in window
                if (!window.taskApprovalService) {
                    // Load dynamically
                    const serviceModule = await import('../../components/task-approval-system/services/task-approval-service.js');
                    this.taskApprovalService = serviceModule.taskApprovalService;

                    const dialogModule = await import('../../components/task-approval-system/TaskApprovalDialog.js');
                    this.TaskApprovalDialog = dialogModule.TaskApprovalDialog;
                } else {
                    // Use globally loaded services
                    this.taskApprovalService = window.taskApprovalService;
                    this.TaskApprovalDialog = window.TaskApprovalDialog;
                }

                // Initialize service
                const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
                if (window.firebaseDB && currentUser) {
                    console.log('🔧 Initializing taskApprovalService with Firebase DB and user...');
                    this.taskApprovalService.init(window.firebaseDB, currentUser);
                } else {
                    console.warn('⚠️ Firebase DB or currentUser not available yet - will initialize on first use');
                }

                console.log('✅ TaskApprovalSidePanel initialized');
            } catch (error) {
                console.error('❌ Failed to initialize TaskApprovalSidePanel:', error);
                throw error;
            }
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

            console.log('🔓 Opening Task Approval Side Panel...');

            // Create overlay and panel
            this.createPanel();

            // Show panel with animation
            setTimeout(() => {
                this.overlay.classList.add('active');
                this.panel.classList.add('active');
            }, 10);

            this.isOpen = true;

            // Load approvals
            await this.loadApprovals();

            // Start realtime listener
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

            console.log('🔒 Closing Task Approval Side Panel...');

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
                        <h3>אישורי תקציב משימות</h3>
                        <span class="approval-count-badge-panel" id="approvalCountPanelBadge">0</span>
                    </div>
                    <button class="approval-panel-close" id="approvalPanelClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="approval-panel-filters">
                    <button class="approval-filter-btn active" data-filter="pending">
                        <i class="fas fa-clock"></i>
                        <span>ממתין</span>
                    </button>
                    <button class="approval-filter-btn" data-filter="approved">
                        <i class="fas fa-check-circle"></i>
                        <span>אושר</span>
                    </button>
                    <button class="approval-filter-btn" data-filter="rejected">
                        <i class="fas fa-times-circle"></i>
                        <span>נדחה</span>
                    </button>
                    <button class="approval-filter-btn" data-filter="all">
                        <i class="fas fa-list"></i>
                        <span>הכל</span>
                    </button>
                </div>

                <div class="approval-panel-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="approvalSearchInput" placeholder="חיפוש לפי עובד, לקוח או משימה..." />
                </div>

                <div class="approval-panel-body" id="approvalPanelBody">
                    <div class="approval-panel-loading">
                        <div class="spinner-circle"></div>
                        <p>טוען אישורים...</p>
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

            // Filter buttons
            const filterBtns = this.panel.querySelectorAll('.approval-filter-btn');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.currentFilter = e.currentTarget.dataset.filter;

                    // Update realtime listener
                    if (this.realtimeUnsubscribe) {
                        this.realtimeUnsubscribe();
                    }
                    this.startRealtimeListener();

                    this.loadApprovals();
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
         * Load approvals from Firestore
         * טעינת אישורים מ-Firestore
         */
        async loadApprovals() {
            if (!this.taskApprovalService) {
                console.error('❌ taskApprovalService not available');
                return;
            }

            // ✅ Make sure service is initialized with current Firebase state
            if (!this.taskApprovalService.db && window.firebaseDB) {
                const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
                console.log('🔧 Re-initializing taskApprovalService with current Firebase state...');
                this.taskApprovalService.init(window.firebaseDB, currentUser);
            }

            try {
                this.approvals = await this.taskApprovalService.getApprovalsByStatus(this.currentFilter);
                this.applyFiltersAndRender();
            } catch (error) {
                console.error('❌ Error loading approvals:', error);
                this.renderError();
            }
        }

        /**
         * Apply filters and render
         * החל פילטרים ורנדר
         */
        applyFiltersAndRender() {
            let filtered = [...this.approvals];

            // Search filter
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                filtered = filtered.filter(approval => {
                    return (
                        approval.requestedByName?.toLowerCase().includes(term) ||
                        approval.taskData?.clientName?.toLowerCase().includes(term) ||
                        approval.taskData?.description?.toLowerCase().includes(term)
                    );
                });
            }

            // Sort by date (newest first)
            filtered.sort((a, b) => {
                const dateA = a.requestedAt?.toDate?.() || a.requestedAt || 0;
                const dateB = b.requestedAt?.toDate?.() || b.requestedAt || 0;
                return dateB - dateA;
            });

            this.filteredApprovals = filtered;
            this.renderApprovals();
        }

        /**
         * Render approvals list
         * רינדור רשימת אישורים
         */
        renderApprovals() {
            const bodyEl = this.panel.querySelector('#approvalPanelBody');
            if (!bodyEl) {
return;
}

            // Update count badge
            const countBadge = this.panel.querySelector('#approvalCountPanelBadge');
            if (countBadge) {
                countBadge.textContent = this.filteredApprovals.length;
            }

            // Empty state
            if (this.filteredApprovals.length === 0) {
                bodyEl.innerHTML = `
                    <div class="approval-panel-empty">
                        <i class="fas fa-inbox"></i>
                        <p>אין בקשות אישור ${this.currentFilter === 'pending' ? 'ממתינות' : ''}</p>
                    </div>
                `;
                return;
            }

            // Group by user
            const groupedByUser = this.filteredApprovals.reduce((groups, approval) => {
                const user = approval.requestedBy;
                if (!groups[user]) {
                    groups[user] = {
                        name: approval.requestedByName,
                        email: user,
                        requests: []
                    };
                }
                groups[user].requests.push(approval);
                return groups;
            }, {});

            // Render groups
            bodyEl.innerHTML = Object.values(groupedByUser).map(userGroup => `
                <div class="approval-user-group">
                    <div class="approval-user-header">
                        <div class="approval-user-info">
                            <div class="approval-user-avatar">${this.getInitials(userGroup.name)}</div>
                            <div class="approval-user-details">
                                <h4>${this.escapeHTML(userGroup.name)}</h4>
                                <p>${this.escapeHTML(userGroup.email)}</p>
                            </div>
                        </div>
                        <span class="approval-user-count">${userGroup.requests.length}</span>
                    </div>

                    <div class="approval-requests-list">
                        ${userGroup.requests.map(approval => this.renderApprovalCard(approval)).join('')}
                    </div>
                </div>
            `).join('');

            // Attach click handlers
            this.attachApprovalClickHandlers();
        }

        /**
         * Render single approval card
         * רינדור כרטיס אישור בודד
         */
        renderApprovalCard(approval) {
            const statusClass = approval.status;
            // ✅ Check if auto-approved
            const statusText = approval.autoApproved
                ? '✅ אושר אוטומטית'
                : this.getStatusText(approval.status);
            const minutes = approval.taskData?.estimatedMinutes || 0;
            const timeAgo = this.formatRelativeTime(approval.requestedAt);

            return `
                <div class="approval-card" data-id="${approval.id}" data-status="${approval.status}">
                    <div class="approval-card-header">
                        <h5 class="approval-card-task">${this.escapeHTML(approval.taskData?.description || 'ללא תיאור')}</h5>
                        <span class="approval-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="approval-card-body">
                        <div class="approval-card-row">
                            <i class="fas fa-briefcase"></i>
                            <span>${this.escapeHTML(approval.taskData?.clientName || 'לא צוין')}</span>
                        </div>
                        <div class="approval-card-row">
                            <i class="fas fa-clock"></i>
                            <span>${minutes} דקות</span>
                        </div>
                        <div class="approval-card-row">
                            <i class="fas fa-calendar"></i>
                            <span>${timeAgo}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Attach click handlers to approval cards
         * צירוף מאזיני קליק לכרטיסי אישור
         */
        attachApprovalClickHandlers() {
            const cards = this.panel.querySelectorAll('.approval-card');
            cards.forEach(card => {
                card.addEventListener('click', async () => {
                    const id = card.dataset.id;
                    const status = card.dataset.status;

                    // Only allow clicking on pending approvals
                    if (status !== 'pending') {
                        return;
                    }

                    const approval = this.filteredApprovals.find(a => a.id === id);
                    if (approval) {
                        await this.openApprovalDialog(approval);
                    }
                });
            });
        }

        /**
         * Open approval dialog
         * פתיחת דיאלוג אישור
         */
        async openApprovalDialog(approval) {
            if (!this.TaskApprovalDialog) {
                console.error('❌ TaskApprovalDialog not loaded');
                return;
            }

            // Create dialog instance
            const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
            const dialog = new this.TaskApprovalDialog({
                db: window.firebaseDB,
                currentUser: currentUser,
                onApprove: () => this.loadApprovals(),
                onReject: () => this.loadApprovals()
            });

            dialog.show(approval);
        }

        /**
         * Start realtime listener
         * התחל מאזין בזמן אמת
         */
        startRealtimeListener() {
            if (!this.taskApprovalService) {
                return;
            }

            // ✅ Make sure service is initialized with current Firebase state
            if (!this.taskApprovalService.db && window.firebaseDB) {
                const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
                console.log('🔧 Re-initializing taskApprovalService for realtime listener...');
                this.taskApprovalService.init(window.firebaseDB, currentUser);
            }

            this.realtimeUnsubscribe = this.taskApprovalService.listenToAllApprovals(
                (approvals) => {
                    console.log(`🔥 Real-time update: ${approvals.length} approvals`);
                    this.approvals = approvals;
                    this.applyFiltersAndRender();
                },
                this.currentFilter
            );
        }

        /**
         * Render error state
         * רינדור מצב שגיאה
         */
        renderError() {
            const bodyEl = this.panel.querySelector('#approvalPanelBody');
            if (!bodyEl) {
return;
}

            bodyEl.innerHTML = `
                <div class="approval-panel-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>שגיאה בטעינת אישורים</p>
                    <button onclick="window.taskApprovalSidePanel.loadApprovals()">נסה שוב</button>
                </div>
            `;
        }

        // ===== Helper Functions =====

        getStatusText(status) {
            const statusMap = {
                'pending': 'ממתין',
                'approved': 'אושר',
                'rejected': 'נדחה',
                'modified': 'אושר עם שינוי'
            };
            return statusMap[status] || status;
        }

        formatRelativeTime(date) {
            if (!date) {
return '';
}

            const dateObj = date.toDate ? date.toDate() : new Date(date);
            const now = new Date();
            const diff = now - dateObj;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (seconds < 60) {
return 'לפני רגע';
}
            if (minutes < 60) {
return `לפני ${minutes} דקות`;
}
            if (hours < 24) {
return `לפני ${hours} שעות`;
}
            if (days < 7) {
return `לפני ${days} ימים`;
}

            return dateObj.toLocaleDateString('he-IL');
        }

        getInitials(name) {
            if (!name) {
return '?';
}
            const words = name.trim().split(' ');
            if (words.length === 1) {
return words[0].charAt(0).toUpperCase();
}
            return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
        }

        escapeHTML(str) {
            if (!str) {
return '';
}
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    }

    // Create global instance
    window.TaskApprovalSidePanel = TaskApprovalSidePanel;
    window.taskApprovalSidePanel = new TaskApprovalSidePanel();

    console.log('✅ TaskApprovalSidePanel loaded');

})();
