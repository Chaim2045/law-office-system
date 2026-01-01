/**
 * WelcomeScreen Component
 *
 * Displays welcome message after successful login with:
 * - User name
 * - Last login timestamp
 * - Auto-redirect for employees
 * - Choice screen for admins (personal area vs admin panel)
 *
 * Features:
 * - Different screens for employees vs admins
 * - Auto-redirect with progress bar for employees
 * - Choice cards for admins
 * - Smooth animations
 * - Saves admin choice preference
 *
 * Usage:
 *   const welcomeScreen = new WelcomeScreen(
 *       document.getElementById('welcomeContainer'),
 *       {
 *           autoRedirectDelay: 2500,
 *           onNavigate: (destination) => { ... }
 *       }
 *   );
 *
 *   // For employee:
 *   welcomeScreen.showEmployeeWelcome('חיים', lastLoginTimestamp);
 *
 *   // For admin:
 *   welcomeScreen.showAdminWelcome('גיא', lastLoginTimestamp);
 */

class WelcomeScreen {
    /**
     * @param {HTMLElement} containerElement - Container element for welcome screen
     * @param {Object} options - Configuration options
     * @param {number} options.autoRedirectDelay - Delay before auto-redirect in ms (default: 2500)
     * @param {Function} options.onNavigate - Callback when navigation is triggered (default: null)
     */
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = {
            autoRedirectDelay: 2500,
            onNavigate: null,
            ...options
        };
    }

    /**
     * Show welcome screen for regular employee
     * Auto-redirects to index.html after delay
     *
     * @param {string} userName - User's display name
     * @param {Object|Date|number} lastLogin - Last login timestamp (Firestore Timestamp, Date, or ms)
     */
    showEmployeeWelcome(userName, lastLogin) {
        this.container.innerHTML = this.renderEmployeeWelcome(userName, lastLogin);
        this.container.classList.add('show');

        // ═══════════════════════════════════════════════════════════
        // 🔑 CRITICAL: Call onNavigate IMMEDIATELY for unified login
        // ═══════════════════════════════════════════════════════════
        // Set sessionStorage flags immediately, then navigate.
        // This ensures flags are set before page transition.
        // ═══════════════════════════════════════════════════════════
        if (this.options.onNavigate) {
            // Show animation briefly then navigate
            setTimeout(() => {
                this.options.onNavigate('employee');
            }, this.options.autoRedirectDelay);
        } else {
            // Fallback: direct navigation
            setTimeout(() => {
                window.location.href = 'index.html';
            }, this.options.autoRedirectDelay);
        }
    }

    /**
     * Show welcome screen with choice for admin
     * Displays two choice cards: personal area vs admin panel
     *
     * @param {string} userName - User's display name
     * @param {Object|Date|number} lastLogin - Last login timestamp
     */
    showAdminWelcome(userName, lastLogin) {
        this.container.innerHTML = this.renderAdminWelcome(userName, lastLogin);
        this.container.classList.add('show');

        // Attach click listeners to choice cards
        this.attachChoiceListeners();
    }

    /**
     * Render employee welcome HTML
     * @param {string} userName - User's display name
     * @param {Object|Date|number} lastLogin - Last login timestamp
     * @returns {string} HTML string
     */
    renderEmployeeWelcome(userName, lastLogin) {
        const formattedDate = this.formatDate(lastLogin);

        return `
            <div class="welcome-content">
                <h2 class="welcome-title">ברוך הבא, ${this.escapeHtml(userName)}!</h2>
                <p class="welcome-subtitle">כניסה אחרונה: ${formattedDate}</p>
                <div class="progress-section">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <p class="progress-message">טוען את המערכת...</p>
                </div>
            </div>
        `;
    }

    /**
     * Render admin welcome HTML with choice cards
     * @param {string} userName - User's display name
     * @param {Object|Date|number} lastLogin - Last login timestamp
     * @returns {string} HTML string
     */
    renderAdminWelcome(userName, lastLogin) {
        const formattedDate = this.formatDate(lastLogin);

        return `
            <div class="welcome-content">
                <h2 class="welcome-title">ברוך הבא, ${this.escapeHtml(userName)}!</h2>
                <p class="welcome-subtitle">כניסה אחרונה: ${formattedDate}</p>

                <div class="choice-section">
                    <h3 class="choice-title">לאן תרצה להיכנס?</h3>

                    <div class="choice-cards">
                        <!-- Personal Area Card -->
                        <div class="choice-card employee" data-destination="employee">
                            <div class="choice-card-header">
                                <div class="choice-card-icon">
                                    <i class="fas fa-user-circle"></i>
                                </div>
                                <div class="choice-card-title">האזור האישי שלי</div>
                            </div>
                            <div class="choice-card-description">
                                <i class="fas fa-clock"></i> שעתון
                                • <i class="fas fa-tasks"></i> משימות
                                • <i class="fas fa-chart-bar"></i> דוחות
                            </div>
                        </div>

                        <!-- Admin Panel Card -->
                        <div class="choice-card admin" data-destination="admin">
                            <div class="choice-card-header">
                                <div class="choice-card-icon">
                                    <i class="fas fa-shield-alt"></i>
                                </div>
                                <div class="choice-card-title">
                                    דשבורד מנהלים
                                    <span class="choice-badge">ADMIN</span>
                                </div>
                            </div>
                            <div class="choice-card-description">
                                <i class="fas fa-users-cog"></i> ניהול עובדים
                                • <i class="fas fa-briefcase"></i> לקוחות
                                • <i class="fas fa-key"></i> הרשאות
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach click listeners to choice cards
     */
    attachChoiceListeners() {
        const cards = this.container.querySelectorAll('.choice-card');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                const destination = card.dataset.destination;
                this.navigate(destination);
            });

            // Add keyboard support
            card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const destination = card.dataset.destination;
                    this.navigate(destination);
                }
            });
        });
    }

    /**
     * Navigate to selected destination
     * @param {string} destination - 'employee' or 'admin'
     */
    navigate(destination) {
        // Save user preference
        localStorage.setItem('lastDashboardChoice', destination);

        // ═══════════════════════════════════════════════════════════
        // 🔑 CRITICAL: Call onNavigate IMMEDIATELY (before setTimeout)
        // ═══════════════════════════════════════════════════════════
        // This ensures sessionStorage flags are set BEFORE navigation
        // happens, not after the animation delay.
        //
        // onNavigate callback in login-v2.html sets:
        // - sessionStorage.setItem('unifiedLoginComplete', 'true')
        // - sessionStorage.setItem('unifiedLoginTime', Date.now())
        //
        // These flags must be set BEFORE window.location.href changes,
        // otherwise the destination page won't detect unified login.
        // ═══════════════════════════════════════════════════════════
        if (this.options.onNavigate) {
            this.options.onNavigate(destination);
            return; // onNavigate handles navigation, no need to continue
        }

        // Show loading state (fallback if no onNavigate callback)
        this.container.innerHTML = `
            <div class="welcome-content">
                <div class="progress-section">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <p class="progress-message">טוען את המערכת...</p>
                </div>
            </div>
        `;

        // Navigate after animation (fallback path)
        setTimeout(() => {
            const url = destination === 'admin'
                ? 'master-admin-panel/index.html'
                : 'index.html';
            window.location.href = url;
        }, this.options.autoRedirectDelay);
    }

    /**
     * Format date for display
     * Supports Firestore Timestamp, Date object, or milliseconds
     *
     * @param {Object|Date|number} timestamp - Timestamp to format
     * @returns {string} Formatted date string
     */
    formatDate(timestamp) {
        if (!timestamp) {
return 'לא ידוע';
}

        let date;

        // Handle Firestore Timestamp
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            // Handle Date object
            date = timestamp;
        } else if (typeof timestamp === 'number') {
            // Handle milliseconds
            date = new Date(timestamp);
        } else {
            return 'לא ידוע';
        }

        // Format in Hebrew locale
        return date.toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Hide welcome screen
     */
    hide() {
        this.container.classList.remove('show');
    }

    /**
     * Clear container
     */
    clear() {
        this.container.innerHTML = '';
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WelcomeScreen;
}
