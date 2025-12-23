/**
 * System Announcements Modal
 * Modal for managing system announcements
 *
 * Created: 2025-12-15
 * Version: 1.0.0
 *
 * @description Full-screen modal for viewing and managing system announcements
 */

(function() {
    'use strict';

    class AnnouncementsModal {
        constructor() {
            this.isOpen = false;
            this.announcements = [];
            this.service = null;
            this.editor = null;
            this.modal = null;
        }

        /**
         * Initialize the modal
         */
        init() {
            console.log('🎨 Initializing AnnouncementsModal...');

            // Initialize service and editor
            if (window.AnnouncementService && window.firebaseDB) {
                this.service = new window.AnnouncementService(window.firebaseDB);
            }

            if (window.AnnouncementEditor) {
                this.editor = new window.AnnouncementEditor();
            }

            // Inject styles
            this.injectStyles();

            console.log('✅ AnnouncementsModal initialized');
        }

        /**
         * Open the modal
         */
        async open() {
            if (this.isOpen) {
return;
}

            console.log('📢 Opening Announcements Modal...');

            // Create modal DOM
            this.render();

            // Load announcements
            await this.loadAnnouncements();

            // Show modal
            this.show();

            this.isOpen = true;
        }

        /**
         * Close the modal
         */
        close() {
            if (!this.isOpen) {
return;
}

            console.log('✅ Closing Announcements Modal...');

            // Hide modal with animation
            if (this.modal) {
                this.modal.classList.add('closing');
                setTimeout(() => {
                    if (this.modal && this.modal.parentNode) {
                        this.modal.remove();
                    }
                    this.modal = null;
                }, 300);
            }

            this.isOpen = false;
        }

        /**
         * Render modal DOM
         */
        render() {
            // Remove existing modal if any
            const existing = document.getElementById('announcementsModal');
            if (existing) {
                existing.remove();
            }

            const html = `
                <div id="announcementsModal" class="announcements-modal">
                    <!-- Backdrop -->
                    <div class="modal-backdrop" id="modalBackdrop"></div>

                    <!-- Modal Content -->
                    <div class="modal-content">
                        <!-- Header -->
                        <div class="modal-header">
                            <div class="modal-title-section">
                                <div class="modal-icon">
                                    <i class="fas fa-bullhorn"></i>
                                </div>
                                <div>
                                    <h2 class="modal-title">הודעות מערכת</h2>
                                    <p class="modal-subtitle">ניהול הודעות גלובליות למשתמשים</p>
                                </div>
                            </div>
                            <button class="modal-close-btn" id="modalCloseBtn" title="סגור">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>

                        <!-- Actions Bar -->
                        <div class="modal-actions">
                            <button class="btn-new-announcement" id="btnNewAnnouncement">
                                <i class="fas fa-plus"></i>
                                <span>הודעה חדשה</span>
                            </button>
                            <div class="announcements-count" id="announcementsCount">
                                <i class="fas fa-list"></i>
                                <span>טוען...</span>
                            </div>
                        </div>

                        <!-- Announcements List -->
                        <div class="modal-body" id="modalBody">
                            <div class="loading-state">
                                <i class="fas fa-spinner fa-spin"></i>
                                <p>טוען הודעות...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', html);

            // Cache DOM elements
            this.modal = document.getElementById('announcementsModal');

            // Setup event listeners
            this.setupEventListeners();
        }

        /**
         * Setup event listeners
         */
        setupEventListeners() {
            // Close button
            const closeBtn = document.getElementById('modalCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // Backdrop click
            const backdrop = document.getElementById('modalBackdrop');
            if (backdrop) {
                backdrop.addEventListener('click', () => this.close());
            }

            // ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            // New announcement button
            const newBtn = document.getElementById('btnNewAnnouncement');
            if (newBtn) {
                newBtn.addEventListener('click', () => this.handleCreate());
            }
        }

        /**
         * Load announcements from Firestore
         */
        async loadAnnouncements() {
            if (!this.service) {
                this.showError('שירות הודעות לא זמין');
                return;
            }

            try {
                console.log('📊 Loading announcements...');
                this.announcements = await this.service.list();
                console.log(`✅ Loaded ${this.announcements.length} announcements`);

                this.renderAnnouncementsList();
                this.updateCount();
            } catch (error) {
                console.error('❌ Error loading announcements:', error);
                this.showError('שגיאה בטעינת הודעות: ' + error.message);
            }
        }

        /**
         * Render announcements list
         */
        renderAnnouncementsList() {
            const body = document.getElementById('modalBody');
            if (!body) {
return;
}

            if (this.announcements.length === 0) {
                body.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-bullhorn"></i>
                        <h3>אין הודעות פעילות</h3>
                        <p>לחץ על "הודעה חדשה" כדי ליצור הודעה ראשונה</p>
                    </div>
                `;
                return;
            }

            // Sort by priority and date
            const sorted = [...this.announcements].sort((a, b) => {
                if (b.priority !== a.priority) {
return b.priority - a.priority;
}
                return b.startDate - a.startDate;
            });

            body.innerHTML = `
                <div class="announcements-grid">
                    ${sorted.map(announcement => this.renderAnnouncementCard(announcement)).join('')}
                </div>
            `;

            // Add event listeners to cards
            this.setupCardListeners();
        }

        /**
         * Render a single announcement card
         */
        renderAnnouncementCard(announcement) {
            const typeColors = {
                'info': '#3b82f6',
                'success': '#10b981',
                'warning': '#f59e0b',
                'error': '#ef4444'
            };

            const typeIcons = {
                'info': 'fa-info-circle',
                'success': 'fa-check-circle',
                'warning': 'fa-exclamation-triangle',
                'error': 'fa-times-circle'
            };

            const color = typeColors[announcement.type] || typeColors.info;
            const icon = typeIcons[announcement.type] || typeIcons.info;
            const isActive = announcement.active;
            const isExpired = announcement.endDate && new Date() > announcement.endDate;

            return `
                <div class="announcement-card ${!isActive ? 'inactive' : ''}" data-id="${announcement.id}">
                    <!-- Header -->
                    <div class="card-header" style="border-left: 4px solid ${color};">
                        <div class="card-type">
                            <i class="fas ${icon}" style="color: ${color};"></i>
                            <span>${this.getTypeLabel(announcement.type)}</span>
                        </div>
                        <div class="card-status">
                            ${isActive ? '<span class="badge badge-success">פעיל</span>' : '<span class="badge badge-inactive">לא פעיל</span>'}
                            ${isExpired ? '<span class="badge badge-expired">פג תוקף</span>' : ''}
                        </div>
                    </div>

                    <!-- Body -->
                    <div class="card-body">
                        ${announcement.title ? `<h4 class="card-title">${announcement.title}</h4>` : ''}
                        <p class="card-message">${announcement.message}</p>
                    </div>

                    <!-- Meta -->
                    <div class="card-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${this.formatDate(announcement.startDate)}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-star"></i>
                            <span>עדיפות ${announcement.priority}</span>
                        </div>
                        ${announcement.displaySettings?.showInHeader ?
                            '<div class="meta-item"><i class="fas fa-eye"></i><span>מוצג בטיקר</span></div>' :
                            ''}
                    </div>

                    <!-- Actions -->
                    <div class="card-actions">
                        <button class="btn-card-action btn-toggle" data-id="${announcement.id}" data-active="${isActive}" title="${isActive ? 'השבת' : 'הפעל'}">
                            <i class="fas fa-${isActive ? 'eye-slash' : 'eye'}"></i>
                        </button>
                        <button class="btn-card-action btn-edit" data-id="${announcement.id}" title="ערוך">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-card-action btn-delete" data-id="${announcement.id}" title="מחק">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Setup card event listeners
         */
        setupCardListeners() {
            // Toggle buttons
            document.querySelectorAll('.btn-toggle').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const isActive = btn.dataset.active === 'true';
                    this.handleToggle(id, !isActive);
                });
            });

            // Edit buttons
            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    this.handleEdit(id);
                });
            });

            // Delete buttons
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    this.handleDelete(id);
                });
            });
        }

        /**
         * Handle create new announcement
         */
        handleCreate() {
            if (!this.editor) {
                alert('עורך הודעות לא זמין');
                return;
            }

            this.editor.open(null, {
                onSave: async (announcement, mode) => {
                    try {
                        await this.service.create(announcement);
                        await this.loadAnnouncements();
                        this.showNotification('ההודעה נוצרה בהצלחה', 'success');
                    } catch (error) {
                        console.error('Error creating announcement:', error);
                        this.showNotification('שגיאה ביצירת הודעה', 'error');
                    }
                }
            });
        }

        /**
         * Handle edit announcement
         */
        handleEdit(id) {
            const announcement = this.announcements.find(a => a.id === id);
            if (!announcement || !this.editor) {
return;
}

            this.editor.open(announcement, {
                onSave: async (updatedAnnouncement, mode) => {
                    try {
                        await this.service.update(id, updatedAnnouncement.toFirestore());
                        await this.loadAnnouncements();
                        this.showNotification('ההודעה עודכנה בהצלחה', 'success');
                    } catch (error) {
                        console.error('Error updating announcement:', error);
                        this.showNotification('שגיאה בעדכון הודעה', 'error');
                    }
                }
            });
        }

        /**
         * Handle toggle announcement
         */
        async handleToggle(id, newActiveState) {
            try {
                await this.service.update(id, { active: newActiveState });
                await this.loadAnnouncements();
                this.showNotification(
                    newActiveState ? 'ההודעה הופעלה' : 'ההודעה הושבתה',
                    'success'
                );
            } catch (error) {
                console.error('Error toggling announcement:', error);
                this.showNotification('שגיאה בעדכון הודעה', 'error');
            }
        }

        /**
         * Handle delete announcement
         */
        async handleDelete(id) {
            if (!confirm('האם אתה בטוח שברצונך למחוק את ההודעה?')) {
                return;
            }

            try {
                await this.service.delete(id);
                await this.loadAnnouncements();
                this.showNotification('ההודעה נמחקה בהצלחה', 'success');
            } catch (error) {
                console.error('Error deleting announcement:', error);
                this.showNotification('שגיאה במחיקת הודעה', 'error');
            }
        }

        /**
         * Update announcements count
         */
        updateCount() {
            const countEl = document.getElementById('announcementsCount');
            if (!countEl) {
return;
}

            const active = this.announcements.filter(a => a.active).length;
            const total = this.announcements.length;

            countEl.innerHTML = `
                <i class="fas fa-list"></i>
                <span>${active} פעילות מתוך ${total}</span>
            `;
        }

        /**
         * Show error state
         */
        showError(message) {
            const body = document.getElementById('modalBody');
            if (!body) {
return;
}

            body.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>שגיאה</h3>
                    <p>${message}</p>
                </div>
            `;
        }

        /**
         * Show notification
         */
        showNotification(message, type = 'info') {
            if (window.Notifications) {
                window.Notifications.show(message, type);
            } else {
                alert(message);
            }
        }

        /**
         * Show modal with animation
         */
        show() {
            if (!this.modal) {
return;
}

            // Force reflow
            void this.modal.offsetWidth;

            // Add show class
            this.modal.classList.add('show');
        }

        /**
         * Get type label in Hebrew
         */
        getTypeLabel(type) {
            const labels = {
                'info': 'מידע',
                'success': 'הצלחה',
                'warning': 'אזהרה',
                'error': 'שגיאה'
            };
            return labels[type] || 'מידע';
        }

        /**
         * Format date to Hebrew
         */
        formatDate(date) {
            if (!date) {
return '';
}
            const d = date instanceof Date ? date : date.toDate();
            return d.toLocaleDateString('he-IL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        /**
         * Inject modal styles
         */
        injectStyles() {
            if (document.getElementById('announcementsModalStyles')) {
return;
}

            const style = document.createElement('style');
            style.id = 'announcementsModalStyles';
            style.textContent = `
                /* Modal Container */
                .announcements-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                }

                .announcements-modal.show {
                    opacity: 1;
                    visibility: visible;
                }

                .announcements-modal.closing {
                    opacity: 0;
                }

                /* Backdrop */
                .modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                }

                /* Modal Content */
                .modal-content {
                    position: relative;
                    width: 90%;
                    max-width: 1200px;
                    height: 85vh;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    display: flex;
                    flex-direction: column;
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                }

                .announcements-modal.show .modal-content {
                    transform: scale(1);
                }

                /* Modal Header */
                .announcements-modal .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 32px;
                    border-bottom: 2px solid #e5e7eb;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-radius: 16px 16px 0 0;
                }

                .announcements-modal .modal-title-section {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .announcements-modal .modal-icon {
                    width: 56px;
                    height: 56px;
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }

                .announcements-modal .modal-title {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 700;
                    color: #1e293b;
                }

                .announcements-modal .modal-subtitle {
                    margin: 4px 0 0;
                    font-size: 14px;
                    color: #64748b;
                }

                .announcements-modal .modal-close-btn {
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: #f1f5f9;
                    border-radius: 50%;
                    color: #64748b;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .announcements-modal .modal-close-btn:hover {
                    background: #ef4444;
                    color: white;
                    transform: rotate(90deg);
                }

                /* Actions Bar */
                .announcements-modal .modal-actions {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 32px;
                    border-bottom: 1px solid #e5e7eb;
                    background: white;
                }

                .announcements-modal .btn-new-announcement {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
                }

                .announcements-modal .btn-new-announcement:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                }

                .announcements-modal .announcements-count {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                    font-size: 14px;
                    font-weight: 500;
                }

                /* Modal Body */
                .announcements-modal .modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 32px;
                    background: #f8fafc;
                }

                /* Loading/Empty/Error States */
                .loading-state,
                .empty-state,
                .error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #64748b;
                    text-align: center;
                    gap: 16px;
                }

                .loading-state i,
                .empty-state i,
                .error-state i {
                    font-size: 64px;
                    opacity: 0.3;
                }

                .empty-state h3,
                .error-state h3 {
                    margin: 0;
                    font-size: 20px;
                    color: #1e293b;
                }

                .empty-state p,
                .error-state p {
                    margin: 0;
                    font-size: 14px;
                    max-width: 400px;
                }

                /* Announcements Grid */
                .announcements-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }

                /* Announcement Card */
                .announcement-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s ease;
                    overflow: hidden;
                }

                .announcement-card:hover {
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                    transform: translateY(-2px);
                }

                .announcement-card.inactive {
                    opacity: 0.6;
                }

                .card-header {
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: #f8fafc;
                }

                .card-type {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #1e293b;
                }

                .card-status {
                    display: flex;
                    gap: 6px;
                }

                .badge {
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .badge-success {
                    background: #d1fae5;
                    color: #065f46;
                }

                .badge-inactive {
                    background: #e5e7eb;
                    color: #6b7280;
                }

                .badge-expired {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .card-body {
                    padding: 16px;
                }

                .card-title {
                    margin: 0 0 8px;
                    font-size: 16px;
                    font-weight: 700;
                    color: #1e293b;
                }

                .card-message {
                    margin: 0;
                    font-size: 14px;
                    color: #475569;
                    line-height: 1.6;
                }

                .card-meta {
                    padding: 12px 16px;
                    background: #f8fafc;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: #64748b;
                }

                .card-actions {
                    padding: 12px;
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    border-top: 1px solid #e5e7eb;
                }

                .btn-card-action {
                    width: 36px;
                    height: 36px;
                    border: none;
                    border-radius: 8px;
                    background: #f1f5f9;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }

                .btn-card-action:hover {
                    transform: scale(1.1);
                }

                .btn-toggle:hover {
                    background: #dbeafe;
                    color: #1e40af;
                }

                .btn-edit:hover {
                    background: #fef3c7;
                    color: #92400e;
                }

                .btn-delete:hover {
                    background: #fee2e2;
                    color: #991b1b;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .modal-content {
                        width: 95%;
                        height: 90vh;
                    }

                    .announcements-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `;

            document.head.appendChild(style);
        }
    }

    // Create global instance
    window.AnnouncementsModal = new AnnouncementsModal();

})();
