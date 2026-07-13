/**
 * Navigation Component — Adaptive Sidebar (PR-NAV-2)
 * קומפוננטת ניווט — סרגל צד אדפטיבי
 *
 * Mobile (<768px): bottom bar, 5 primary + "More" overflow
 * Tablet (768-1023px): icon-only sidebar 68px on right
 * Desktop (≥1024px): full sidebar 200px, collapsible to 68px
 */

(function() {
    'use strict';

    const SUB_PAGE_PARENTS = {
        'employee-costs': 'users',
        'tasks': 'users',
        'timesheet': 'users'
    };

    const PRIMARY_NAV = [
        { id: 'users', label: 'ניהול עובדים', icon: 'fa-users', href: 'index.html' },
        { id: 'clients', label: 'ניהול לקוחות', icon: 'fa-briefcase', href: 'clients.html' },
        { id: 'pending-clients', label: 'ממתינים', icon: 'fa-user-clock', href: 'pending-clients.html' },
        { id: 'workload', label: 'ניתוח עומס', icon: 'fa-chart-line', href: 'workload.html' },
        { id: 'profitability', label: 'רווחיות', icon: 'fa-money-bill-trend-up', href: 'profitability.html' },
        { id: 'reconciliation', label: 'סנכרון שעות', icon: 'fa-scale-balanced', href: 'reconciliation.html' },
        { id: 'announcements', label: 'הודעות', icon: 'fa-bullhorn', href: 'system-announcements.html' }
    ];

    const MOBILE_PRIMARY_COUNT = 5;

    const UTILITY_NAV = [
        { id: 'approvals', label: 'חריגות תקציב', icon: 'fa-triangle-exclamation', type: 'button' },
        { id: 'audit-trail', label: 'לוג פעילות', icon: 'fa-history', href: 'audit-trail.html' },
        { id: 'settings', label: 'הגדרות', icon: 'fa-cog', href: 'settings.html' }
    ];

    class Navigation {
        constructor() {
            this.container = null;
            this.currentPage = null;
            this.approvalCountInterval = null;
            this._desktopMQ = null;
        }

        init(currentPage = 'users') {
            this.currentPage = SUB_PAGE_PARENTS[currentPage] || currentPage;
            this.container = document.getElementById('navigationContainer');

            if (!this.container) {
                console.warn('⚠️ Navigation container not found');
                return;
            }

            this.render();
            this.setupEventListeners();
            this.setupCollapseToggle();
            this.setupMobileOverflow();
            this.startApprovalCountListener();
        }

        render() {
            if (!this.container) {
return;
}

            const primaryHTML = PRIMARY_NAV.map(item => `
                <a href="${item.href}" class="nav-item ${item.id === this.currentPage ? 'active' : ''}" data-id="${item.id}" aria-current="${item.id === this.currentPage ? 'page' : 'false'}">
                    <i class="fas ${item.icon}"></i>
                    <span class="nav-label">${item.label}</span>
                </a>
            `).join('');

            const utilityHTML = UTILITY_NAV.map(item => {
                const isActive = item.id === this.currentPage ? 'active' : '';
                if (item.type === 'button') {
                    return `
                        <button class="nav-item ${isActive}" id="navApprovalsBtn" data-id="${item.id}">
                            <span id="approvalCountBadge" class="approval-count-badge" style="display: none;"></span>
                            <i class="fas ${item.icon}"></i>
                            <span class="nav-label">${item.label}</span>
                        </button>`;
                }
                return `
                    <a href="${item.href}" class="nav-item ${isActive}" data-id="${item.id}" aria-current="${item.id === this.currentPage ? 'page' : 'false'}">
                        <i class="fas ${item.icon}"></i>
                        <span class="nav-label">${item.label}</span>
                    </a>`;
            }).join('');

            const overflowItems = PRIMARY_NAV.slice(MOBILE_PRIMARY_COUNT);
            const overflowHTML = [
                ...overflowItems.map(item => `
                    <a href="${item.href}" class="nav-overflow-item ${item.id === this.currentPage ? 'active' : ''}">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>`),
                ...UTILITY_NAV.map(item => {
                    if (item.type === 'button') {
                        return `
                            <button class="nav-overflow-item" id="navOverflowApprovalsBtn">
                                <i class="fas ${item.icon}"></i>
                                <span>${item.label}</span>
                            </button>`;
                    }
                    return `
                        <a href="${item.href}" class="nav-overflow-item ${item.id === this.currentPage ? 'active' : ''}">
                            <i class="fas ${item.icon}"></i>
                            <span>${item.label}</span>
                        </a>`;
                }),
                `<button class="nav-overflow-item logout-item" id="navOverflowLogoutBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>יציאה</span>
                </button>`
            ].join('');

            const isOverflowActive = [...overflowItems, ...UTILITY_NAV]
                .some(item => item.id === this.currentPage);

            this.container.innerHTML = `
                <nav class="admin-navigation" role="navigation" aria-label="תפריט ניווט ראשי">
                    <div class="nav-brand">
                        <img src="assets/logo.png" alt="Logo" class="brand-logo" />
                        <span class="brand-text">ניהול המשרד</span>
                    </div>

                    <div class="nav-primary">
                        ${primaryHTML}
                    </div>

                    <div class="nav-divider"></div>

                    <div class="nav-utility">
                        ${utilityHTML}
                    </div>

                    <button class="nav-item nav-logout" id="navLogoutBtn">
                        <i class="fas fa-sign-out-alt"></i>
                        <span class="nav-label">יציאה</span>
                    </button>

                    <button class="nav-item nav-more-btn ${isOverflowActive ? 'active' : ''}" id="navMoreBtn" aria-expanded="false" aria-controls="navOverflowMenu">
                        <i class="fas fa-ellipsis"></i>
                        <span class="nav-label">עוד</span>
                    </button>

                    <button class="sidebar-toggle" id="sidebarToggle" aria-label="כווץ/הרחב תפריט">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </nav>

                <div class="nav-overflow-backdrop" id="navOverflowBackdrop"></div>
                <div class="nav-overflow-menu" id="navOverflowMenu" role="menu">
                    ${overflowHTML}
                </div>
            `;
        }

        setupCollapseToggle() {
            this._desktopMQ = window.matchMedia('(min-width: 1024px)');

            if (this._desktopMQ.matches && localStorage.getItem('admin-sidebar-collapsed') === '1') {
                document.body.classList.add('sidebar-collapsed');
            }

            const toggle = document.getElementById('sidebarToggle');
            if (toggle) {
                toggle.addEventListener('click', () => {
                    if (!this._desktopMQ.matches) {
return;
}

                    document.body.classList.add('sidebar-animating');
                    document.body.classList.toggle('sidebar-collapsed');

                    const collapsed = document.body.classList.contains('sidebar-collapsed');
                    localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0');

                    setTimeout(() => document.body.classList.remove('sidebar-animating'), 300);
                });
            }
        }

        setupMobileOverflow() {
            const moreBtn = document.getElementById('navMoreBtn');
            const backdrop = document.getElementById('navOverflowBackdrop');
            const menu = document.getElementById('navOverflowMenu');

            if (!moreBtn || !backdrop || !menu) {
return;
}

            const open = () => {
                menu.classList.add('visible');
                backdrop.classList.add('visible');
                moreBtn.setAttribute('aria-expanded', 'true');
            };

            const close = () => {
                menu.classList.remove('visible');
                backdrop.classList.remove('visible');
                moreBtn.setAttribute('aria-expanded', 'false');
            };

            moreBtn.addEventListener('click', () => {
                menu.classList.contains('visible') ? close() : open();
            });

            backdrop.addEventListener('click', close);

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && menu.classList.contains('visible')) {
                    close();
                    moreBtn.focus();
                }
            });

            const overflowApprovalsBtn = document.getElementById('navOverflowApprovalsBtn');
            if (overflowApprovalsBtn) {
                overflowApprovalsBtn.addEventListener('click', async () => {
                    close();
                    if (window.taskApprovalSidePanel) {
                        await window.taskApprovalSidePanel.init();
                        window.taskApprovalSidePanel.open();
                    }
                });
            }

            const overflowLogoutBtn = document.getElementById('navOverflowLogoutBtn');
            if (overflowLogoutBtn) {
                overflowLogoutBtn.addEventListener('click', async () => {
                    close();
                    await this._doLogout();
                });
            }
        }

        setupEventListeners() {
            const approvalsBtn = document.getElementById('navApprovalsBtn');
            if (approvalsBtn) {
                approvalsBtn.addEventListener('click', async () => {
                    if (window.taskApprovalSidePanel) {
                        await window.taskApprovalSidePanel.init();
                        window.taskApprovalSidePanel.open();
                    } else {
                        alert('פאנל חריגות התקציב לא נטען כראוי');
                    }
                });
            }

            const logoutBtn = document.getElementById('navLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this._doLogout());
            }
        }

        async _doLogout() {
            if (!window.firebaseAuth) {
return;
}
            try {
                await window.firebaseAuth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('❌ Error signing out:', error);
            }
        }

        startApprovalCountListener() {
            if (!window.firebaseDB) {
                console.warn('⚠️ Firebase DB not available for budget overrun count');
                return;
            }

            const updateCount = async () => {
                try {
                    const currentUser = window.currentUser || window.firebaseAuth?.currentUser;
                    if (!currentUser) {
                        this.updateApprovalCountBadge(0);
                        return;
                    }

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

            updateCount();
            this.approvalCountInterval = setInterval(updateCount, 30000);
        }

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

        stopApprovalCountListener() {
            if (this.approvalCountInterval) {
                clearInterval(this.approvalCountInterval);
                this.approvalCountInterval = null;
            }
        }
    }

    const navigation = new Navigation();
    window.Navigation = navigation;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = navigation;
    }
})();
