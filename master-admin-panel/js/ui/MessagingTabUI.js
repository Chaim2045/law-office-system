/**
 * MessagingTabUI
 * קומפוננטת טאב הודעות בדשבורד
 *
 * Created: 2025-12-04
 * Purpose: משולב במסך הראשי של האדמין פאנל
 */

(function() {
    'use strict';

    class MessagingTabUI {
        constructor() {
            this.container = null;
            this.isActive = false;
        }

        /**
         * Initialize
         * אתחול
         */
        init(containerElement) {
            this.container = containerElement;

            // Listen for tab changes
            window.addEventListener('admin-tab-change', (e) => {
                if (e.detail.tabId === 'messages') {
                    this.show();
                } else {
                    this.hide();
                }
            });
        }

        /**
         * Show messaging tab
         * הצג טאב הודעות
         */
        show() {
            if (this.isActive) {
return;
}

            this.isActive = true;

            // Hide dashboard content
            const dashboardInner = this.container.querySelector('.dashboard-inner');
            if (dashboardInner) {
                dashboardInner.style.display = 'none';
            }

            // Create or show messaging container
            let messagingContainer = this.container.querySelector('#messagingTabContainer');

            if (!messagingContainer) {
                messagingContainer = document.createElement('div');
                messagingContainer.id = 'messagingTabContainer';
                messagingContainer.className = 'messaging-tab-container';
                messagingContainer.innerHTML = `
                    <!-- Messaging Center Container -->
                    <div id="messagingCenter" class="messaging-center-wrapper"></div>
                `;
                this.container.appendChild(messagingContainer);
            } else {
                messagingContainer.style.display = 'block';
            }

            // Initialize MessagingCenterUI
            if (window.MessagingCenterUI) {
                setTimeout(() => {
                    window.MessagingCenterUI.init();
                }, 100);
            } else {
                console.error('❌ MessagingCenterUI not loaded');
            }
        }

        /**
         * Hide messaging tab
         * הסתר טאב הודעות
         */
        hide() {
            if (!this.isActive) {
return;
}

            this.isActive = false;

            // Show dashboard content
            const dashboardInner = this.container.querySelector('.dashboard-inner');
            if (dashboardInner) {
                dashboardInner.style.display = 'block';
            }

            // Hide messaging container
            const messagingContainer = this.container.querySelector('#messagingTabContainer');
            if (messagingContainer) {
                messagingContainer.style.display = 'none';
            }
        }
    }

    // Create global instance
    const messagingTabUI = new MessagingTabUI();
    window.MessagingTabUI = messagingTabUI;

})();
