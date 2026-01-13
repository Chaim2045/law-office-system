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

            // התחל להקשיב למספר האישורים הממתינים
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
                { id: 'clients', label: 'ניהול לקוחות', icon: 'fa-briefcase', href: 'clients.html' }
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
                        <button class="btn-announcements ${this.currentPage === 'announcements' ? 'active' : ''}" id="navAnnouncementsBtn" title="הודעות מערכת">
                            <i class="fas fa-bullhorn"></i>
                            <span>הודעות מערכת</span>
                        </button>
                        <button class="btn-approvals ${this.currentPage === 'approvals' ? 'active' : ''}" id="navApprovalsBtn" title="אישורי תקציב משימות" style="position: relative;">
                            <span id="approvalCountBadge" class="approval-count-badge" style="display: none;"></span>
                            <i class="fas fa-clipboard-check"></i>
                            <span>אישורי משימות</span>
                        </button>
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
                .btn-announcements,
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

                .btn-announcements:hover,
                .btn-announcements.active {
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    border-color: #f97316;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
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

                .btn-approvals i,
                .btn-announcements i,
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
         * Start polling auto-approved tasks count
         * התחל polling למספר משימות שאושרו אוטומטית ולא נצפו
         */
        startApprovalCountListener() {
            // וודא ש-Firebase זמין
            if (!window.firebaseDB) {
                console.warn('⚠️ Firebase DB not available for approval count');
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

                    // קבל lastViewedAt של המשתמש
                    const userDoc = await window.firebaseDB
                        .collection('employees')
                        .doc(currentUser.email)
                        .get();
                    const lastViewedAt = userDoc.data()?.approvalsPanelLastViewed?.toDate() || new Date(0);

                    // תאריך היום (00:00)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // קבל כל משימות autoApproved מהיום
                    const snapshot = await window.firebaseDB
                        .collection('pending_task_approvals')
                        .where('autoApproved', '==', true)
                        .where('createdAt', '>=', today)
                        .get();

                    // ספור רק משימות שנוצרו אחרי הצפייה האחרונה (ללא task_cancelled)
                    const unviewedCount = snapshot.docs.filter(doc => {
                        const data = doc.data();
                        const createdAt = data.createdAt?.toDate();
                        return createdAt && createdAt > lastViewedAt && data.status !== 'task_cancelled';
                    }).length;

                    this.updateApprovalCountBadge(unviewedCount);
                } catch (error) {
                    console.error('❌ Error getting approval count:', error);
                    this.updateApprovalCountBadge(0);
                }
            };

            // עדכון מיידי
            updateCount();

            // Polling כל 30 שניות
            this.approvalCountInterval = setInterval(updateCount, 30000);

            console.log('✅ Started approval count polling (every 30s)');
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
                console.log('🛑 Stopped approval count polling');
            }
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Announcements button
            const announcementsBtn = document.getElementById('navAnnouncementsBtn');
            if (announcementsBtn) {
                announcementsBtn.addEventListener('click', () => {
                    console.log('📢 Opening System Announcements Modal');
                    if (window.AnnouncementsModal) {
                        window.AnnouncementsModal.open();
                    } else {
                        console.error('❌ AnnouncementsModal not found');
                        alert('מודל הודעות לא נטען כראוי');
                    }
                });
            }

            // Approvals button - open side panel
            const approvalsBtn = document.getElementById('navApprovalsBtn');
            if (approvalsBtn) {
                approvalsBtn.addEventListener('click', async () => {
                    console.log('📋 Opening Task Approval Side Panel');
                    if (window.taskApprovalSidePanel) {
                        // Initialize if not initialized
                        if (!window.taskApprovalSidePanel.taskApprovalService) {
                            await window.taskApprovalSidePanel.init();
                        }
                        window.taskApprovalSidePanel.open();
                    } else {
                        console.error('❌ TaskApprovalSidePanel not found');
                        alert('פאנל אישורים לא נטען כראוי');
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
