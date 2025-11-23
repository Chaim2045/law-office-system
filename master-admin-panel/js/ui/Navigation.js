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
        }

        /**
         * Render navigation
         * רינדור ניווט
         */
        render() {
            if (!this.container) return;

            const navItems = [
                { id: 'users', label: 'ניהול עובדים', icon: 'fa-users', href: 'index.html' },
                { id: 'clients', label: 'ניהול לקוחות', icon: 'fa-briefcase', href: 'clients.html' },
                { id: 'tasks', label: 'ניהול משימות', icon: 'fa-tasks', href: 'tasks.html' },
                { id: 'timesheet', label: 'ניהול שעות', icon: 'fa-clock', href: 'timesheet.html' },
            ];

            this.container.innerHTML = `
                <nav class="admin-navigation">
                    <div class="nav-brand">
                        <i class="fas fa-shield-halved"></i>
                        <span>Admin Panel</span>
                    </div>
                    <ul class="nav-menu">
                        ${navItems.map(item => `
                            <li class="nav-item ${item.id === this.currentPage ? 'active' : ''}">
                                <a href="${item.href}" class="nav-link">
                                    <i class="fas ${item.icon}"></i>
                                    <span>${item.label}</span>
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="nav-user">
                        <button class="btn-logout" id="navLogoutBtn">
                            <i class="fas fa-sign-out-alt"></i>
                            <span>יציאה</span>
                        </button>
                    </div>
                </nav>
            `;

            // Add CSS
            this.injectStyles();

            // Setup logout
            this.setupLogout();
        }

        /**
         * Inject styles
         * הזרקת סגנונות
         */
        injectStyles() {
            if (document.getElementById('navigationStyles')) return;

            const style = document.createElement('style');
            style.id = 'navigationStyles';
            style.textContent = `
                .admin-navigation {
                    background: linear-gradient(135deg, #1877F2 0%, #0A66C2 100%);
                    padding: 1rem 2rem;
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .nav-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: white;
                    font-weight: 600;
                    font-size: 1.25rem;
                }

                .nav-menu {
                    display: flex;
                    gap: 0.5rem;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    flex: 1;
                }

                .nav-item {
                    margin: 0;
                }

                .nav-link {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    color: rgba(255, 255, 255, 0.8);
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.2s;
                    font-size: 0.875rem;
                }

                .nav-link:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .nav-item.active .nav-link {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    font-weight: 600;
                }

                .nav-user {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .btn-logout {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.875rem;
                }

                .btn-logout:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                @media (max-width: 768px) {
                    .admin-navigation {
                        flex-direction: column;
                        padding: 1rem;
                        gap: 1rem;
                    }

                    .nav-menu {
                        flex-direction: column;
                        width: 100%;
                    }

                    .nav-link {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `;

            document.head.appendChild(style);
        }

        /**
         * Setup logout
         * הגדרת יציאה
         */
        setupLogout() {
            const logoutBtn = document.getElementById('navLogoutBtn');
            if (!logoutBtn) return;

            logoutBtn.addEventListener('click', async () => {
                if (!window.firebaseAuth) {
                    console.error('❌ Firebase Auth not found');
                    return;
                }

                try {
                    await window.firebaseAuth.signOut();
                    console.log('✅ User signed out');
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('❌ Error signing out:', error);
                }
            });
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
