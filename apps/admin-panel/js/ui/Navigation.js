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
                { id: 'workload', label: 'ניתוח עומס', icon: 'fa-chart-line', href: 'workload.html' },
                { id: 'profitability', label: 'רווחיות', icon: 'fa-money-bill-trend-up', href: 'profitability.html' },
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

            // Add CSS
            this.injectStyles();

            // Setup event listeners
            this.setupEventListeners();
        }

        /**
         * Inject styles
         * הזרקת סגנונות
         */
        injectStyles() {
            if (document.getElementById('navigationStyles')) {
return;
}

            const style = document.createElement('style');
            style.id = 'navigationStyles';
            style.textContent = `
                .admin-navigation {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    border-bottom: 1px solid #e5e7eb;
                    padding: 18px 24px;
                    z-index: 1001;
                    display: flex;
                    justify-content: flex-start;
                    align-items: center;
                    height: 76px;
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
                }

                .nav-brand {
                    position: absolute;
                    right: 24px;
                }

                .brand-logo-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .brand-logo {
                    height: 40px;
                    width: auto;
                    object-fit: contain;
                }

                .brand-subtitle {
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .nav-tabs-wrapper {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                }

                .nav-tabs {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    background: #f1f5f9;
                    border-radius: 50px;
                    padding: 6px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                }

                .nav-tab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: transparent;
                    border: none;
                    border-radius: 50px;
                    color: #1e293b;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    white-space: nowrap;
                    text-decoration: none;
                }

                .nav-tab i {
                    font-size: 16px;
                    transition: transform 0.2s ease;
                }

                .nav-tab:hover:not(.active) {
                    background: rgba(255, 255, 255, 0.5);
                }

                .nav-tab:active {
                    transform: scale(0.98);
                }

                .nav-tab.active {
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
                }

                .nav-user {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    position: absolute;
                    left: 24px;
                }

                .btn-approvals,
                .btn-chat,
                .btn-send-message,
                .btn-logout {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: #f8fafc;
                    color: #475569;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 50px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.813rem;
                    font-weight: 500;
                    text-decoration: none;
                }

                .btn-approvals:hover,
                .btn-approvals.active {
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    border-color: #4f46e5;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                }

                .btn-chat:hover {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-color: #10b981;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                }

                .btn-send-message:hover {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    border-color: #3b82f6;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }

                .btn-logout:hover {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    border-color: #ef4444;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
                }

                .btn-settings {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    padding: 0;
                    background: #f8fafc;
                    color: #64748b;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                }

                .btn-settings i {
                    font-size: 15px;
                    transition: transform 0.3s ease;
                }

                .btn-settings:hover {
                    background: #f1f5f9;
                    color: #334155;
                    border-color: #cbd5e1;
                    transform: translateY(-1px);
                }

                .btn-settings:hover i {
                    transform: rotate(90deg);
                }

                .btn-settings.active {
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    border-color: #4f46e5;
                    color: white;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                }

                .btn-approvals i,
                .btn-chat i,
                .btn-send-message i,
                .btn-logout i {
                    font-size: 14px;
                }

                /* Approval Count Badge */
                .approval-count-badge {
                    position: absolute;
                    top: -6px;
                    left: -6px;
                    min-width: 20px;
                    height: 20px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    border-radius: 50px;
                    font-size: 11px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 6px;
                    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
                    border: 2px solid white;
                    z-index: 10;
                    pointer-events: none;
                }

                /* Add margin to main content */
                body {
                    padding-top: 76px;
                }

                @media (max-width: 768px) {
                    .admin-navigation {
                        padding: 10px 16px;
                        height: 58px;
                    }

                    body {
                        padding-top: 58px;
                    }

                    .brand-logo {
                        height: 32px;
                    }

                    .brand-subtitle {
                        font-size: 0.5rem;
                    }

                    .nav-tabs {
                        gap: 6px;
                    }

                    .nav-tab {
                        padding: 7px 16px;
                        font-size: 12px;
                    }

                    .nav-tab i {
                        font-size: 13px;
                    }

                    .btn-approvals,
                    .btn-chat,
                    .btn-send-message,
                    .btn-logout {
                        padding: 7px 14px;
                        font-size: 12px;
                    }
                }
            `;

            document.head.appendChild(style);
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
