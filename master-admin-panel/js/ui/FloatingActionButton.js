/**
 * Floating Action Button (FAB)
 * כפתור פעולה צף
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Phase: UI Enhancement
 *
 * תפקיד: כפתור צף שמשתנה לפי הסקשן (הוסף עובד/לקוח)
 */

(function() {
    'use strict';

    /**
     * FloatingActionButton Class
     * מנהל את הכפתור הצף
     */
    class FloatingActionButton {
        constructor() {
            this.currentPage = null;
            this.button = null;
        }

        /**
         * Initialize FAB
         * אתחול הכפתור הצף
         */
        init(currentPage) {
            this.currentPage = currentPage;
            this.createButton();
            this.setupEventListeners();
            console.log('✅ FloatingActionButton: Initialized for page:', currentPage);
        }

        /**
         * Create button element
         * יצירת אלמנט הכפתור
         */
        createButton() {
            // Check if button already exists
            if (document.getElementById('fabButton')) {
                this.button = document.getElementById('fabButton');
                this.updateButton();
                return;
            }

            // Create button
            const button = document.createElement('button');
            button.id = 'fabButton';
            button.className = 'fab-button';
            button.setAttribute('aria-label', this.getButtonLabel());

            // Set content based on page
            button.innerHTML = `
                <i class="fas fa-plus"></i>
                <span class="fab-tooltip">${this.getButtonLabel()}</span>
            `;

            // Append to body
            document.body.appendChild(button);
            this.button = button;

            // Add styles
            this.injectStyles();

            // Animate entrance
            setTimeout(() => {
                button.classList.add('fab-show');
            }, 300);
        }

        /**
         * Get button label based on page
         * קבלת תווית הכפתור לפי הדף
         */
        getButtonLabel() {
            switch (this.currentPage) {
                case 'users':
                    return 'הוסף עובד חדש';
                case 'clients':
                    return 'הוסף לקוח חדש';
                default:
                    return 'הוסף חדש';
            }
        }

        /**
         * Get button icon based on page
         * קבלת אייקון הכפתור לפי הדף
         */
        getButtonIcon() {
            switch (this.currentPage) {
                case 'users':
                    return 'fa-user-plus';
                case 'clients':
                    return 'fa-user-tie';
                default:
                    return 'fa-plus';
            }
        }

        /**
         * Update button content
         * עדכון תוכן הכפתור
         */
        updateButton() {
            if (!this.button) {
return;
}

            this.button.innerHTML = `
                <i class="fas fa-plus"></i>
                <span class="fab-tooltip">${this.getButtonLabel()}</span>
            `;
            this.button.setAttribute('aria-label', this.getButtonLabel());
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            if (!this.button) {
return;
}

            this.button.addEventListener('click', () => this.handleClick());

            // Add hover effect for label
            this.button.addEventListener('mouseenter', () => {
                this.button.classList.add('fab-hover');
            });

            this.button.addEventListener('mouseleave', () => {
                this.button.classList.remove('fab-hover');
            });
        }

        /**
         * Handle button click
         * טיפול בלחיצה על הכפתור
         */
        handleClick() {
            console.log('🎯 FAB clicked on page:', this.currentPage);

            switch (this.currentPage) {
                case 'users':
                    this.openAddUserModal();
                    break;
                case 'clients':
                    this.openAddClientModal();
                    break;
                default:
                    console.warn('⚠️ FAB: Unknown page type');
            }

            // Add click animation
            this.button.classList.add('fab-clicked');
            setTimeout(() => {
                this.button.classList.remove('fab-clicked');
            }, 300);
        }

        /**
         * Open Add User Modal
         * פתיחת חלון הוספת עובד
         */
        openAddUserModal() {
            // Check if UsersActionsManager is available
            if (window.UsersActionsManager) {
                console.log('📝 Opening Add User Modal...');
                window.UsersActionsManager.addNewUser();
            } else {
                console.error('❌ UsersActionsManager not found');
                alert('מערכת הוספת עובדים לא זמינה');
            }
        }

        /**
         * Open Add Client Modal
         * פתיחת חלון הוספת לקוח
         */
        openAddClientModal() {
            // ✅ Case Creation System v1.0 - Using new organized component
            if (window.CaseCreationSystem?.show) {
                console.log('📝 Opening Case Creation System v1.0...');
                window.CaseCreationSystem.show('new-client');
            } else if (window.caseCreationDialog?.show) {
                // Fallback to global instance
                console.log('📝 Opening Case Creation Dialog (global)...');
                window.caseCreationDialog.show('new-client');
            } else {
                console.error('❌ Case Creation System not found');
                alert('מערכת הוספת לקוחות לא זמינה');
            }
        }

        /**
         * Inject styles
         * הוספת עיצוב
         */
        injectStyles() {
            if (document.getElementById('fabStyles')) {
return;
}

            const style = document.createElement('style');
            style.id = 'fabStyles';
            style.textContent = `
                .fab-button {
                    position: fixed;
                    bottom: 32px;
                    left: 32px;
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    border: none;
                    border-radius: 50%;
                    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
                    cursor: pointer;
                    z-index: 1000;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0;
                    transform: scale(0) translateY(20px);
                    overflow: visible;
                }

                .fab-button.fab-show {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }

                .fab-button i {
                    color: white;
                    font-size: 24px;
                    transition: transform 0.3s ease;
                    margin: 0;
                }

                .fab-button:hover {
                    transform: scale(1.1) translateY(-2px);
                    box-shadow: 0 12px 32px rgba(59, 130, 246, 0.6);
                }

                .fab-button:hover i {
                    transform: rotate(-135deg);
                }

                .fab-button.fab-clicked {
                    transform: scale(0.95);
                }

                .fab-tooltip {
                    position: absolute;
                    left: 80px;
                    top: 50%;
                    transform: translateY(-50%) scale(0.8);
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                    color: white;
                    padding: 10px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    white-space: nowrap;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    z-index: 1001;
                }

                .fab-tooltip::before {
                    content: '';
                    position: absolute;
                    right: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    border: 6px solid transparent;
                    border-right-color: #1e293b;
                }

                .fab-button:hover .fab-tooltip {
                    opacity: 1;
                    transform: translateY(-50%) scale(1);
                    transition-delay: 0.3s;
                }

                .fab-button:active {
                    transform: scale(0.9);
                }

                /* Pulse animation on load */
                @keyframes fab-pulse {
                    0%, 100% {
                        box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
                    }
                    50% {
                        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.7);
                    }
                }

                .fab-button.fab-show {
                    animation: fab-pulse 2s ease-in-out 1;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .fab-button {
                        bottom: 24px;
                        left: 24px;
                        width: 56px;
                        height: 56px;
                    }

                    .fab-button i {
                        font-size: 20px;
                    }

                    .fab-tooltip {
                        left: 70px;
                        font-size: 12px;
                        padding: 8px 12px;
                    }

                    .fab-tooltip::before {
                        border-width: 5px;
                    }
                }

                /* Print */
                @media print {
                    .fab-button {
                        display: none !important;
                    }
                }
            `;

            document.head.appendChild(style);
        }

        /**
         * Hide button
         * הסתרת כפתור
         */
        hide() {
            if (this.button) {
                this.button.classList.remove('fab-show');
            }
        }

        /**
         * Show button
         * הצגת כפתור
         */
        show() {
            if (this.button) {
                this.button.classList.add('fab-show');
            }
        }

        /**
         * Destroy button
         * הרס כפתור
         */
        destroy() {
            if (this.button) {
                this.button.remove();
                this.button = null;
            }
        }
    }

    // Create global instance
    const floatingActionButton = new FloatingActionButton();

    // Make available globally
    window.FloatingActionButton = floatingActionButton;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = floatingActionButton;
    }

})();
