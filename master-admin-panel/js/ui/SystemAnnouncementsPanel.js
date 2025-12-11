/**
 * System Announcements Panel
 * פאנל ניהול הודעות מערכת
 *
 * Created: 2025-12-11
 * Version: 1.0.0
 */

(function() {
    'use strict';

    class SystemAnnouncementsPanel {
        constructor() {
            this.container = null;
        }

        /**
         * Initialize the panel
         * @param {string} containerId - ID of container element
         */
        init(containerId = 'dashboardContent') {
            console.log('📢 Initializing System Announcements Panel...');

            this.container = document.getElementById(containerId);

            if (!this.container) {
                console.error('❌ Container not found:', containerId);
                return;
            }

            this.render();
            console.log('✅ System Announcements Panel initialized');
        }

        /**
         * Render the panel content
         */
        render() {
            if (!this.container) {
return;
}

            this.container.innerHTML = `
                <div class="panel-container">
                    <!-- Header -->
                    <div class="panel-header">
                        <div class="panel-header-content">
                            <div class="panel-icon">
                                <i class="fas fa-bullhorn"></i>
                            </div>
                            <div class="panel-title-section">
                                <h1 class="panel-title">הודעות מערכת</h1>
                                <p class="panel-subtitle">ניהול הודעות גלובליות למשתמשים</p>
                            </div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="panel-content">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <i class="fas fa-bullhorn"></i>
                            </div>
                            <h3>מערכת הודעות מערכת</h3>
                            <p>התכונה הזו תפותח בקרוב</p>
                            <p class="empty-state-note">כאן יהיה ניתן לשלוח הודעות גלובליות לכל המשתמשים במערכת</p>
                        </div>
                    </div>
                </div>
            `;

            this.injectStyles();
        }

        /**
         * Inject panel styles
         */
        injectStyles() {
            if (document.getElementById('systemAnnouncementsPanelStyles')) {
return;
}

            const style = document.createElement('style');
            style.id = 'systemAnnouncementsPanelStyles';
            style.textContent = `
                .panel-container {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .panel-header {
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    border-radius: 16px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
                }

                .panel-header-content {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .panel-icon {
                    width: 64px;
                    height: 64px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 28px;
                    color: white;
                }

                .panel-title-section {
                    flex: 1;
                }

                .panel-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: white;
                    margin: 0 0 0.5rem 0;
                }

                .panel-subtitle {
                    font-size: 1rem;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0;
                }

                .panel-content {
                    background: white;
                    border-radius: 16px;
                    padding: 3rem;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }

                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .empty-state-icon {
                    width: 120px;
                    height: 120px;
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 2rem;
                    font-size: 48px;
                    color: white;
                    box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3);
                }

                .empty-state h3 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 0 0 1rem 0;
                }

                .empty-state p {
                    font-size: 1rem;
                    color: #64748b;
                    margin: 0.5rem 0;
                }

                .empty-state-note {
                    font-size: 0.875rem;
                    color: #94a3b8;
                    font-style: italic;
                }
            `;

            document.head.appendChild(style);
        }

        /**
         * Cleanup
         */
        cleanup() {
            if (this.container) {
                this.container.innerHTML = '';
            }
        }
    }

    // Export globally
    window.SystemAnnouncementsPanel = SystemAnnouncementsPanel;

    console.log('✅ SystemAnnouncementsPanel class loaded');

})();
