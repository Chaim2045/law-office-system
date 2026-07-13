/**
 * Navigation Component
 * קומפוננטת ניווט
 *
 * נוצר: 23/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Navigation
 *
 * תפקיד: ניווט בין דפים שונים באדמין פאנל
 */

(function() {
    'use strict';

    /**
     * Navigation Class
     * ניווט
     */
    class Navigation {
        constructor() {
            this.container = null;
            this.currentPage = null;
            this.approvalCountInterval = null; // Polling interval לספירת אישורים
        }

        /**
         * Initialize navigation
         * אתחול ניווט
         */
        init(currentPage = 'users') {
            this.currentPage = currentPage;
            this.container = document.getElementById('navigationContainer');

            if (!this.container) {
                console.warn('⚠️ Navigation container not found');
                return;
            }

            this.render();

            // התחל להקשיב למספר חריגות התקציב הפעילות
            this.startApprovalCountListener();
        }

        /**
         * Render navigation
         * רינדור ניווט
         */
        render() {
            if (!this.container) {
return;
}

            const navItems = [
                { id: 'users', label: 'ניהול עובדים', icon: 'fa-users', href: 'index.html' },
                { id: 'clients', label: 'ניהול לקוחות', icon: 'fa-briefcase', href: 'clients.html' },
                { id: 'pending-clients', label: 'לקוחות ממתינים', icon: 'fa-user-clock', href: 'pending-clients.html' },
                { id: 'workload', label: 'ניתוח עומס', icon: 'fa-chart-line', href: 'workload.html' },
                { id: 'profitability', label: 'רווחיות', icon: 'fa-money-bill-trend-up', href: 'profitability.html' },
                { id: 'reconciliation', label: 'סנכרון שעות', icon: 'fa-scale-balanced', href: 'reconciliation.html' },
                { id: 'announcements', label: 'הודעות מערכת', icon: 'fa-bullhorn', href: 'system-announcements.html' }
            ];

            this.container.innerHTML = `
                <nav class="admin-navigation">
                    <div class="nav-brand">
                        <div class="brand-logo-wrapper">
                            <img src="assets/logo.png" alt="Logo" class="brand-logo" />
                            <span class="brand-subtitle">Admin Panel</span>
                        </div>
                    </div>
                    <div class="nav-tabs-wrapper">
                        <div class="nav-tabs">
                            ${navItems.map(item => `
                                <a href="${item.href}" class="nav-tab ${item.id === this.currentPage ? 'active' : ''}">
                                    <i class="fas ${item.icon}"></i>
                                    <span>${item.label}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                    <div class="nav-user">
                        <button class="btn-approvals ${this.currentPage === 'approvals' ? 'active' : ''}" id="navApprovalsBtn" title="חריגות תקציב משימות" style="position: relative;">
                            <span id="approvalCountBadge" class="approval-count-badge" style="display: none;"></span>
                            <i class="fas fa-triangle-exclamation"></i>
                            <span>חריגות תקציב</span>
                        </button>
                        <a href="audit-trail.html" class="btn-settings ${this.currentPage === 'audit-trail' ? 'active' : ''}" title="לוג פעילות">
                            <i class="fas fa-history"></i>
                        </a>
                        <a href="settings.html" class="btn-settings ${this.currentPage === 'settings' ? 'active' : ''}" title="הגדרות מערכת">
                            <i class="fas fa-cog"></i>
                        </a>
                        <button class="btn-logout" id="navLogoutBtn">
                            <i class="fas fa-sign-out-alt"></i>
                            <span>יציאה</span>
                        </button>
                    </div>
                </nav>
            `;

            // Setup event listeners
            this.setupEventListeners();
        }

        /**
         * Start polling over-budget active tasks count (H.4 PR-a — "חריגות תקציב")
         * התחל polling למספר משימות פעילות בחריגת תקציב
         *
         * Counts budget_tasks where status == 'פעיל' AND actualMinutes >
         * estimatedMinutes (the over-budget set — same as budgetStatus level
         * 'danger'/isOver). budget_tasks is admin-readable. The badge surfaces the
         * urgent overruns; the side panel shows the wider approaching+over set.
         */
        startApprovalCountListener() {
            // וודא ש-Firebase זמין
            if (!window.firebaseDB) {
                console.warn('⚠️ Firebase DB not available for budget overrun count');
                return;
            }

            // פונקציה לעדכון המונה
            const updateCount = async () => {
                try {
                    const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
                    if (!currentUser) {
                        this.updateApprovalCountBadge(0);
                        return;
                    }

                    // קבל את כל המשימות הפעילות (admin-readable) וספור את אלו שבחריגה
                    const snapshot = await window.firebaseDB
                        .collection('budget_tasks')
                        .where('status', '==', 'פעיל')
                        .get();

                    const overBudgetCount = snapshot.docs.filter(doc => {
                        const data = doc.data() || {};
                        const actual = typeof data.actualMinutes === 'number' ? data.actualMinutes : 0;
                        const estimate = typeof data.estimatedMinutes === 'number' ? data.estimatedMinutes : 0;
                        return estimate > 0 && actual > estimate;
                    }).length;

                    this.updateApprovalCountBadge(overBudgetCount);
                } catch (error) {
                    console.error('❌ Error getting budget overrun count:', error?.code || 'unknown');
                    this.updateApprovalCountBadge(0);
                }
            };

            // עדכון מיידי
            updateCount();

            // Polling כל 30 שניות
            this.approvalCountInterval = setInterval(updateCount, 30000);

            console.log('✅ Started budget overrun count polling (every 30s)');
        }

        /**
         * Update approval count badge
         * עדכן מונה אישורים
         */
        updateApprovalCountBadge(count) {
            const badge = document.getElementById('approvalCountBadge');
            if (!badge) {
return;
}

            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        /**
         * Stop approval count polling
         * עצור polling ספירת אישורים
         */
        stopApprovalCountListener() {
            if (this.approvalCountInterval) {
                clearInterval(this.approvalCountInterval);
                this.approvalCountInterval = null;
                console.log('🛑 Stopped budget overrun count polling');
            }
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Budget overrun button - open side panel ("חריגות תקציב")
            const approvalsBtn = document.getElementById('navApprovalsBtn');
            if (approvalsBtn) {
                approvalsBtn.addEventListener('click', async () => {
                    console.log('📋 Opening Budget Overrun Side Panel');
                    if (window.taskApprovalSidePanel) {
                        await window.taskApprovalSidePanel.init();
                        window.taskApprovalSidePanel.open();
                    } else {
                        console.error('❌ Budget Overrun Side Panel not found');
                        alert('פאנל חריגות התקציב לא נטען כראוי');
                    }
                });
            }

            // Logout button
            const logoutBtn = document.getElementById('navLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    if (!window.firebaseAuth) {
                        console.error('❌ Firebase Auth not found');
                        return;
                    }

                    try {
                        await window.firebaseAuth.signOut();
                        window.location.href = 'index.html';
                    } catch (error) {
                        console.error('❌ Error signing out:', error);
                    }
                });
            }
        }


    }

    // Create global instance
    const navigation = new Navigation();

    // Make available globally
    window.Navigation = navigation;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = navigation;
    }

})();
