/**
 * Navigation Component — Grouped Sidebar (PR-NAV-2, Approach A)
 *
 * Mobile (<768px): bottom bar, 5 primary + "More" overflow
 * Tablet (768-1023px): icon-only sidebar 68px on right
 * Desktop (>=1024px): full sidebar 220px, collapsible to 68px
 * Groups expand/collapse on click (desktop only)
 */

(function() {
    'use strict';

    const SVG_ICONS = {
        'fa-users': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        'fa-briefcase': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
        'fa-user-clock': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="19" cy="11" r="3"/><path d="M19 9v2l1 1"/></svg>',
        'fa-chart-line': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
        'fa-money-bill-trend-up': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="m5 17 4-8 4 4 6-10"/><path d="M15 3h4v4"/></svg>',
        'fa-scale-balanced': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v19"/><path d="M5 8h14"/><path d="m3 13 2-5 2 5a3 3 0 0 1-4 0Z"/><path d="m17 13 2-5 2 5a3 3 0 0 1-4 0Z"/><circle cx="12" cy="3" r="1"/></svg>',
        'fa-bullhorn': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
        'fa-triangle-exclamation': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
        'fa-history': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
        'fa-cog': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        'fa-chevron-down': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
        'fa-sign-out-alt': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
        'fa-ellipsis': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
        'fa-chevron-left': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'
    };

    function _svgIcon(faClass) {
        return SVG_ICONS[faClass] || '';
    }

    const SUB_PAGE_PARENTS = {
        'employee-costs': 'users',
        'tasks': 'users',
        'timesheet': 'users'
    };

    const PRIMARY_NAV = [
        { id: 'users', label: 'ניהול עובדים', icon: 'fa-users', href: 'index.html' },
        { id: 'clients', label: 'ניהול לקוחות', icon: 'fa-briefcase', href: 'clients.html' },
        { id: 'pending-clients', label: 'לקוחות ממתינים', icon: 'fa-user-clock', href: 'pending-clients.html' },
        { id: 'workload', label: 'ניתוח עומס', icon: 'fa-chart-line', href: 'workload.html' },
        { id: 'profitability', label: 'רווחיות', icon: 'fa-money-bill-trend-up', href: 'profitability.html' },
        { id: 'reconciliation', label: 'סנכרון שעות', icon: 'fa-scale-balanced', href: 'reconciliation.html' },
        { id: 'announcements', label: 'הודעות מערכת', icon: 'fa-bullhorn', href: 'system-announcements.html' }
    ];

    const UTILITY_NAV = [
        { id: 'approvals', label: 'חריגות תקציב', icon: 'fa-triangle-exclamation', type: 'button' },
        { id: 'audit-trail', label: 'לוג פעילות', icon: 'fa-history', href: 'audit-trail.html' },
        { id: 'settings', label: 'הגדרות', icon: 'fa-cog', href: 'settings.html' }
    ];

    const NAV_GROUPS = [
        {
            id: 'employees-group',
            label: 'עובדים',
            icon: 'fa-users',
            children: ['users', 'workload', 'reconciliation'],
            defaultHref: 'index.html'
        },
        {
            id: 'clients-group',
            label: 'לקוחות',
            icon: 'fa-briefcase',
            children: ['clients', 'pending-clients'],
            defaultHref: 'clients.html'
        }
    ];

    const STANDALONE_IDS = ['profitability', 'announcements'];

    const MOBILE_PRIMARY = [
        { id: 'employees-group', label: 'עובדים', icon: 'fa-users', href: 'index.html' },
        { id: 'clients-group', label: 'לקוחות', icon: 'fa-briefcase', href: 'clients.html' },
        { id: 'profitability', label: 'רווחיות', icon: 'fa-money-bill-trend-up', href: 'profitability.html' },
        { id: 'announcements', label: 'הודעות', icon: 'fa-bullhorn', href: 'system-announcements.html' }
    ];

    function _findItem(id) {
        return PRIMARY_NAV.find(item => item.id === id) || UTILITY_NAV.find(item => item.id === id);
    }

    function _groupForPage(pageId) {
        return NAV_GROUPS.find(g => g.children.includes(pageId));
    }

    class Navigation {
        constructor() {
            this.container = null;
            this.currentPage = null;
            this.rawPage = null;
            this.approvalCountInterval = null;
            this._desktopMQ = null;
        }

        init(currentPage = 'users') {
            this.rawPage = currentPage;
            this.currentPage = SUB_PAGE_PARENTS[currentPage] || currentPage;
            this.container = document.getElementById('navigationContainer');

            if (!this.container) {
                console.warn('Navigation container not found');
                return;
            }

            this.render();
            this.setupEventListeners();
            this.setupGroupToggle();
            this.setupCollapseToggle();
            this.setupMobileOverflow();
            this.startApprovalCountListener();
        }

        _isActive(id) {
            return id === this.currentPage;
        }

        _isGroupActive(group) {
            return group.children.includes(this.currentPage);
        }

        _getExpandedGroups() {
            try {
                const stored = localStorage.getItem('admin-nav-expanded');
                return stored ? JSON.parse(stored) : [];
            } catch {
 return [];
}
        }

        _saveExpandedGroups(ids) {
            try {
                localStorage.setItem('admin-nav-expanded', JSON.stringify(ids));
            } catch { /* localStorage unavailable */ }
        }

        render() {
            if (!this.container) {
return;
}

            const expandedGroups = this._getExpandedGroups();
            const activeGroup = _groupForPage(this.currentPage);

            const groupsHTML = NAV_GROUPS.map(group => {
                const isActive = this._isGroupActive(group);
                const isExpanded = isActive || expandedGroups.includes(group.id);

                const childrenHTML = group.children.map(childId => {
                    const item = _findItem(childId);
                    if (!item) {
return '';
}
                    const active = this._isActive(childId);
                    return `<a href="${item.href}" class="nav-sub-item ${active ? 'active' : ''}" data-id="${item.id}" aria-current="${active ? 'page' : 'false'}">
                        ${_svgIcon(item.icon)}
                        <span class="nav-label">${item.label}</span>
                    </a>`;
                }).join('');

                const flyoutItemsHTML = group.children.map(childId => {
                    const item = _findItem(childId);
                    if (!item) {
return '';
}
                    const active = this._isActive(childId);
                    return `<a href="${item.href}" class="nav-flyout-item ${active ? 'active' : ''}">
                        ${_svgIcon(item.icon)}
                        <span>${item.label}</span>
                    </a>`;
                }).join('');

                return `<div class="nav-group ${isActive ? 'group-active' : ''}" data-group="${group.id}">
                    <button class="nav-group-header" id="nav-group-header-${group.id}"
                        role="button" aria-expanded="${isExpanded}" aria-controls="nav-group-${group.id}"
                        data-href="${group.defaultHref}">
                        ${_svgIcon(group.icon)}
                        <span class="nav-label">${group.label}</span>
                        ${_svgIcon('fa-chevron-down').replace('class="nav-icon"', 'class="nav-icon nav-group-chevron"')}
                    </button>
                    <div class="nav-group-children ${isExpanded ? 'expanded' : ''}" id="nav-group-${group.id}"
                        role="group" aria-labelledby="nav-group-header-${group.id}">
                        ${childrenHTML}
                    </div>
                    <div class="nav-flyout" aria-hidden="true">
                        <div class="nav-flyout-header">${group.label}</div>
                        ${flyoutItemsHTML}
                    </div>
                </div>`;
            }).join('');

            const standaloneHTML = STANDALONE_IDS.map(id => {
                const item = _findItem(id);
                if (!item) {
return '';
}
                const active = this._isActive(id);
                return `<a href="${item.href}" class="nav-item ${active ? 'active' : ''}" data-id="${item.id}" aria-current="${active ? 'page' : 'false'}">
                    ${_svgIcon(item.icon)}
                    <span class="nav-label">${item.label}</span>
                </a>`;
            }).join('');

            const utilityHTML = UTILITY_NAV.map(item => {
                const active = this._isActive(item.id);
                if (item.type === 'button') {
                    return `<button class="nav-item ${active ? 'active' : ''}" id="navApprovalsBtn" data-id="${item.id}">
                        <span id="approvalCountBadge" class="approval-count-badge" style="display: none;"></span>
                        ${_svgIcon(item.icon)}
                        <span class="nav-label">${item.label}</span>
                    </button>`;
                }
                return `<a href="${item.href}" class="nav-item ${active ? 'active' : ''}" data-id="${item.id}" aria-current="${active ? 'page' : 'false'}">
                    ${_svgIcon(item.icon)}
                    <span class="nav-label">${item.label}</span>
                </a>`;
            }).join('');

            const overflowGroupChildren = NAV_GROUPS.flatMap(group =>
                group.children.filter(id => !MOBILE_PRIMARY.some(m => m.id === id))
                    .map(childId => {
                        const item = _findItem(childId);
                        if (!item) {
return '';
}
                        return `<a href="${item.href}" class="nav-overflow-item ${this._isActive(childId) ? 'active' : ''}">
                            ${_svgIcon(item.icon)}
                            <span>${item.label}</span>
                        </a>`;
                    })
            ).join('');

            const overflowUtilityHTML = UTILITY_NAV.map(item => {
                if (item.type === 'button') {
                    return `<button class="nav-overflow-item" id="navOverflowApprovalsBtn">
                        ${_svgIcon(item.icon)}
                        <span>${item.label}</span>
                    </button>`;
                }
                return `<a href="${item.href}" class="nav-overflow-item ${this._isActive(item.id) ? 'active' : ''}">
                    ${_svgIcon(item.icon)}
                    <span>${item.label}</span>
                </a>`;
            }).join('');

            const mobileActiveInOverflow = [
                ...NAV_GROUPS.flatMap(g => g.children),
                ...UTILITY_NAV.map(u => u.id)
            ].filter(id => !MOBILE_PRIMARY.some(m => m.id === id || m.id === _groupForPage(id)?.id))
                .includes(this.currentPage);

            const mobilePrimaryHTML = MOBILE_PRIMARY.map(item => {
                const groupMatch = NAV_GROUPS.find(g => g.id === item.id);
                const isActive = groupMatch
                    ? this._isGroupActive(groupMatch)
                    : this._isActive(item.id);
                return `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}" data-id="${item.id}">
                    ${_svgIcon(item.icon)}
                    <span class="nav-label">${item.label}</span>
                </a>`;
            }).join('');

            this.container.innerHTML = `
                <nav class="admin-navigation" role="navigation" aria-label="תפריט ניווט ראשי">
                    <div class="nav-brand">
                        <img src="assets/logo.png" alt="Logo" class="brand-logo" />
                        <span class="brand-text">ניהול המשרד</span>
                    </div>

                    <div class="nav-primary">
                        ${groupsHTML}
                        ${standaloneHTML}
                    </div>

                    <div class="nav-divider"></div>

                    <div class="nav-utility">
                        ${utilityHTML}
                    </div>

                    <button class="nav-item nav-logout" id="navLogoutBtn">
                        ${_svgIcon('fa-sign-out-alt')}
                        <span class="nav-label">יציאה</span>
                    </button>

                    <div class="nav-mobile-bar">
                        ${mobilePrimaryHTML}
                        <button class="nav-item nav-more-btn ${mobileActiveInOverflow ? 'active' : ''}" id="navMoreBtn" aria-expanded="false" aria-controls="navOverflowMenu">
                            ${_svgIcon('fa-ellipsis')}
                            <span class="nav-label">עוד</span>
                        </button>
                    </div>

                    <button class="sidebar-toggle" id="sidebarToggle" aria-label="כווץ/הרחב תפריט">
                        ${_svgIcon('fa-chevron-left')}
                    </button>
                </nav>

                <div class="nav-overflow-backdrop" id="navOverflowBackdrop"></div>
                <div class="nav-overflow-menu" id="navOverflowMenu" role="menu">
                    ${overflowGroupChildren}
                    ${overflowUtilityHTML}
                    <button class="nav-overflow-item logout-item" id="navOverflowLogoutBtn">
                        ${_svgIcon('fa-sign-out-alt')}
                        <span>יציאה</span>
                    </button>
                </div>
            `;
        }

        setupGroupToggle() {
            const headers = this.container.querySelectorAll('.nav-group-header');
            headers.forEach(header => {
                header.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
                    const isTablet = this._desktopMQ && !this._desktopMQ.matches;

                    if (isCollapsed || isTablet) {
                        window.location.href = header.dataset.href;
                        return;
                    }

                    const groupEl = header.closest('.nav-group');
                    const childrenEl = groupEl.querySelector('.nav-group-children');
                    const expanded = header.getAttribute('aria-expanded') === 'true';

                    header.setAttribute('aria-expanded', String(!expanded));
                    childrenEl.classList.toggle('expanded', !expanded);

                    const groupId = groupEl.dataset.group;
                    const expandedGroups = this._getExpandedGroups();
                    if (!expanded) {
                        if (!expandedGroups.includes(groupId)) {
expandedGroups.push(groupId);
}
                    } else {
                        const idx = expandedGroups.indexOf(groupId);
                        if (idx !== -1) {
expandedGroups.splice(idx, 1);
}
                    }
                    this._saveExpandedGroups(expandedGroups);
                });

                header.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        header.click();
                    }
                });
            });
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
                console.error('Error signing out:', error);
            }
        }

        startApprovalCountListener() {
            if (!window.firebaseDB) {
                console.warn('Firebase DB not available for budget overrun count');
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
                    console.error('Error getting budget overrun count:', error?.code || 'unknown');
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
