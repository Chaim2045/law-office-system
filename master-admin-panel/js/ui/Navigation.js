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
                        <button class="btn-chat" id="navChatBtn" title="צ'אטים עם עובדים">
                            <i class="fas fa-comments"></i>
                            <span>צ'אטים</span>
                        </button>
                        <button class="btn-send-message" id="navSendMessageBtn" title="שלח הודעה לעובדים">
                            <i class="fas fa-envelope"></i>
                            <span>שלח הודעה</span>
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

            // Setup logout
            this.setupLogout();

            // Setup send message button
            this.setupSendMessage();

            // Setup chat button
            this.setupChatButton();
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

                .btn-chat i,
                .btn-send-message i,
                .btn-logout i {
                    font-size: 14px;
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
         * Setup logout
         * הגדרת יציאה
         */
        setupLogout() {
            const logoutBtn = document.getElementById('navLogoutBtn');
            if (!logoutBtn) {
return;
}

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

        /**
         * Setup send message button
         * הגדרת כפתור שליחת הודעה
         */
        setupSendMessage() {
            const sendMessageBtn = document.getElementById('navSendMessageBtn');
            if (!sendMessageBtn) {
return;
}

            sendMessageBtn.addEventListener('click', () => {
                if (!window.MessagingTabUI) {
                    console.error('❌ MessagingTabUI not initialized');
                    return;
                }

                // Show messaging tab with Inbox view
                window.MessagingTabUI.show('inbox');
            });
        }

        /**
         * Setup chat button
         * הגדרת כפתור צ'אט
         */
        setupChatButton() {
            const chatBtn = document.getElementById('navChatBtn');
            if (!chatBtn) {
return;
}

            chatBtn.addEventListener('click', () => {
                if (!window.MessagingTabUI) {
                    console.error('❌ MessagingTabUI not initialized');
                    return;
                }

                // Show messaging tab with Threads view
                window.MessagingTabUI.show('threads');
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
