/**
 * System Announcements Panel
 * פאנל ניהול הודעות מערכת - FULL VERSION
 *
 * Created: 2025-12-11
 * Updated: 2025-12-15 (Full implementation)
 * Version: 2.0.0
 */

(function() {
    'use strict';

    class SystemAnnouncementsPanel {
        constructor() {
            this.container = null;
            this.service = null;
            this.announcements = [];
            this.editor = null;
        }

        /**
         * Initialize the panel
         * @param {string} containerId - ID of container element
         */
        async init(containerId = 'dashboardContent') {
            console.log('📢 Initializing System Announcements Panel...');

            this.container = document.getElementById(containerId);

            if (!this.container) {
                console.error('❌ Container not found:', containerId);
                return;
            }

            // Initialize service
            if (!window.firebaseDB) {
                console.error('❌ Firebase DB not available');
                return;
            }

            this.service = new window.AnnouncementService(window.firebaseDB);
            this.editor = new window.AnnouncementEditor();

            // Render initial UI
            this.render();

            // Load announcements
            await this.loadAnnouncements();

            console.log('✅ System Announcements Panel initialized');
        }

        /**
         * Load announcements from Firestore
         */
        async loadAnnouncements() {
            try {
                console.log('📥 Loading announcements...');

                this.announcements = await this.service.list({ active: true });

                console.log(`✅ Loaded ${this.announcements.length} announcements`);

                this.renderAnnouncementsList();

            } catch (error) {
                console.error('❌ Error loading announcements:', error);
                this.showError('שגיאה בטעינת הודעות: ' + error.message);
            }
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
                                <p class="panel-subtitle">ניהול הודעות גלובליות למשתמשים - News Ticker</p>
                            </div>
                        </div>
                        <button class="btn-create-announcement" id="btnCreateAnnouncement">
                            <i class="fas fa-plus"></i>
                            <span>הודעה חדשה</span>
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="panel-content">
                        <div id="announcementsList" class="announcements-list">
                            <div class="loading-state">
                                <div class="spinner"></div>
                                <p>טוען הודעות...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.injectStyles();
            this.setupEventListeners();
        }

        /**
         * Render announcements list
         */
        renderAnnouncementsList() {
            const listContainer = document.getElementById('announcementsList');
            if (!listContainer) {
return;
}

            if (this.announcements.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-bullhorn"></i>
                        </div>
                        <h3>אין הודעות פעילות</h3>
                        <p>צור הודעה חדשה כדי להתחיל</p>
                        <button class="btn-primary" onclick="document.getElementById('btnCreateAnnouncement').click()">
                            <i class="fas fa-plus"></i>
                            הודעה חדשה
                        </button>
                    </div>
                `;
                return;
            }

            // Render announcements using AnnouncementCard
            const cardsHTML = this.announcements.map(announcement => {
                return window.AnnouncementCard.render(announcement, {
                    onEdit: this.handleEdit.bind(this),
                    onDelete: this.handleDelete.bind(this),
                    onToggle: this.handleToggle.bind(this)
                });
            }).join('');

            listContainer.innerHTML = cardsHTML;

            // Setup global handlers for card buttons
            this.setupCardHandlers();
        }

        /**
         * Setup card event handlers
         */
        setupCardHandlers() {
            window.announcementCardHandlers = {
                onEdit: (id) => this.handleEdit(id),
                onDelete: (id) => this.handleDelete(id),
                onToggle: (id, active) => this.handleToggle(id, active)
            };
        }

        /**
         * Setup event listeners
         */
        setupEventListeners() {
            // Create announcement button
            const createBtn = document.getElementById('btnCreateAnnouncement');
            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    this.handleCreate();
                });
            }
        }

        /**
         * Handle create announcement
         */
        handleCreate() {
            console.log('➕ Creating new announcement');

            this.editor.open(null, {
                onSave: async (announcement, mode) => {
                    try {
                        const id = await this.service.create(announcement);
                        console.log('✅ Announcement created:', id);

                        // Show success notification
                        if (window.Notifications) {
                            window.Notifications.show('ההודעה נוצרה בהצלחה!', 'success');
                        }

                        // Reload list
                        await this.loadAnnouncements();

                    } catch (error) {
                        console.error('❌ Error creating announcement:', error);
                        if (window.Notifications) {
                            window.Notifications.show('שגיאה ביצירת הודעה: ' + error.message, 'error');
                        }
                    }
                },
                onCancel: () => {
                    console.log('❌ Canceled creating announcement');
                }
            });
        }

        /**
         * Handle edit announcement
         */
        async handleEdit(id) {
            console.log('✏️ Editing announcement:', id);

            try {
                const announcement = await this.service.read(id);

                if (!announcement) {
                    throw new Error('הודעה לא נמצאה');
                }

                this.editor.open(announcement, {
                    onSave: async (updatedAnnouncement, mode) => {
                        try {
                            await this.service.update(id, updatedAnnouncement.toFirestore());
                            console.log('✅ Announcement updated:', id);

                            if (window.Notifications) {
                                window.Notifications.show('ההודעה עודכנה בהצלחה!', 'success');
                            }

                            await this.loadAnnouncements();

                        } catch (error) {
                            console.error('❌ Error updating announcement:', error);
                            if (window.Notifications) {
                                window.Notifications.show('שגיאה בעדכון הודעה: ' + error.message, 'error');
                            }
                        }
                    },
                    onCancel: () => {
                        console.log('❌ Canceled editing announcement');
                    }
                });

            } catch (error) {
                console.error('❌ Error loading announcement for edit:', error);
                if (window.Notifications) {
                    window.Notifications.show('שגיאה בטעינת הודעה: ' + error.message, 'error');
                }
            }
        }

        /**
         * Handle delete announcement
         */
        async handleDelete(id) {
            console.log('🗑️ Deleting announcement:', id);

            const confirmed = confirm('האם אתה בטוח שברצונך למחוק את ההודעה?');

            if (!confirmed) {
                return;
            }

            try {
                await this.service.delete(id);
                console.log('✅ Announcement deleted:', id);

                if (window.Notifications) {
                    window.Notifications.show('ההודעה נמחקה בהצלחה!', 'success');
                }

                await this.loadAnnouncements();

            } catch (error) {
                console.error('❌ Error deleting announcement:', error);
                if (window.Notifications) {
                    window.Notifications.show('שגיאה במחיקת הודעה: ' + error.message, 'error');
                }
            }
        }

        /**
         * Handle toggle announcement active status
         */
        async handleToggle(id, active) {
            console.log(`🔄 Toggling announcement ${id} to ${active ? 'active' : 'inactive'}`);

            try {
                await this.service.toggleActive(id, active);
                console.log('✅ Announcement toggled:', id);

                if (window.Notifications) {
                    window.Notifications.show(
                        active ? 'ההודעה הופעלה!' : 'ההודעה הושבתה!',
                        'success'
                    );
                }

                await this.loadAnnouncements();

            } catch (error) {
                console.error('❌ Error toggling announcement:', error);
                if (window.Notifications) {
                    window.Notifications.show('שגיאה בשינוי סטטוס: ' + error.message, 'error');
                }
            }
        }

        /**
         * Show error message
         */
        showError(message) {
            const listContainer = document.getElementById('announcementsList');
            if (!listContainer) {
return;
}

            listContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>שגיאה</h3>
                    <p>${message}</p>
                    <button class="btn-secondary" onclick="location.reload()">
                        <i class="fas fa-refresh"></i>
                        רענן דף
                    </button>
                </div>
            `;
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
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 2rem;
                }

                .panel-header-content {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    flex: 1;
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

                .btn-create-announcement {
                    background: white;
                    color: #f97316;
                    border: none;
                    padding: 0.875rem 1.5rem;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .btn-create-announcement:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
                }

                .btn-create-announcement i {
                    font-size: 16px;
                }

                .panel-content {
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    min-height: 400px;
                }

                .announcements-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                /* Loading State */
                .loading-state {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f4f6;
                    border-top: 4px solid #f97316;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Empty State */
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
                    margin: 0 0 2rem 0;
                }

                /* Error State */
                .error-state {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .error-icon {
                    width: 120px;
                    height: 120px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 2rem;
                    font-size: 48px;
                    color: white;
                    box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
                }

                .error-state h3 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #991b1b;
                    margin: 0 0 1rem 0;
                }

                .error-state p {
                    font-size: 1rem;
                    color: #64748b;
                    margin: 0 0 2rem 0;
                }

                /* Buttons */
                .btn-primary {
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    color: white;
                    border: none;
                    padding: 0.875rem 1.5rem;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
                }

                .btn-secondary {
                    background: white;
                    color: #64748b;
                    border: 2px solid #e2e8f0;
                    padding: 0.875rem 1.5rem;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s ease;
                }

                .btn-secondary:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }

                @media (max-width: 768px) {
                    .panel-container {
                        padding: 1rem;
                    }

                    .panel-header {
                        flex-direction: column;
                        align-items: stretch;
                        padding: 1.5rem;
                    }

                    .panel-title {
                        font-size: 1.5rem;
                    }

                    .btn-create-announcement {
                        width: 100%;
                        justify-content: center;
                    }

                    .panel-content {
                        padding: 1rem;
                    }
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
            if (this.editor) {
                this.editor.cleanup();
            }
        }
    }

    // Export globally
    window.SystemAnnouncementsPanel = SystemAnnouncementsPanel;

    console.log('✅ SystemAnnouncementsPanel class loaded (FULL VERSION)');

})();
