/**
 * Announcement Card Component
 * כרטיס הצגת הודעת מערכת
 *
 * Created: 2025-12-11
 * Version: 1.0.0
 */

(function() {
    'use strict';

    class AnnouncementCard {
        /**
         * Render announcement card
         * @param {SystemAnnouncement} announcement
         * @param {Object} handlers - { onEdit, onDelete, onToggle }
         * @returns {string} HTML string
         */
        static render(announcement, handlers = {}) {
            const isActive = announcement.isCurrentlyActive();
            const typeColor = announcement.getTypeColor();
            const typeIcon = announcement.getTypeIcon();

            // Format dates
            const startDate = announcement.startDate ?
                new Date(announcement.startDate).toLocaleDateString('he-IL') : '';
            const endDate = announcement.endDate ?
                new Date(announcement.endDate).toLocaleDateString('he-IL') : 'ללא הגבלה';

            // Target audience label
            const audienceLabels = {
                'all': 'כולם',
                'employees': 'עובדים',
                'admins': 'מנהלים'
            };
            const audienceLabel = audienceLabels[announcement.targetAudience] || 'כולם';

            return `
                <div class="announcement-card ${isActive ? 'active' : 'inactive'}"
                     data-id="${announcement.id}">

                    <!-- Header -->
                    <div class="announcement-card-header">
                        <div class="announcement-card-title-section">
                            <div class="announcement-type-badge" style="background: ${typeColor}20; color: ${typeColor}">
                                <i class="fas ${typeIcon}"></i>
                                <span>${this.getTypeLabel(announcement.type)}</span>
                            </div>
                            <h3 class="announcement-card-title">${this.escapeHtml(announcement.title)}</h3>
                        </div>

                        <div class="announcement-card-actions">
                            <!-- Active Toggle -->
                            <button class="btn-icon ${announcement.active ? 'active' : ''}"
                                    onclick="window.announcementCardHandlers.onToggle('${announcement.id}', ${!announcement.active})"
                                    title="${announcement.active ? 'השבת הודעה' : 'הפעל הודעה'}">
                                <i class="fas ${announcement.active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>

                            <!-- Read Status -->
                            <button class="btn-icon"
                                    onclick="window.announcementCardHandlers.onReadStatus('${announcement.id}')"
                                    title="סטטוס קריאה">
                                <i class="fas fa-eye"></i>
                            </button>

                            <!-- Edit -->
                            <button class="btn-icon"
                                    onclick="window.announcementCardHandlers.onEdit('${announcement.id}')"
                                    title="ערוך הודעה">
                                <i class="fas fa-edit"></i>
                            </button>

                            <!-- Delete -->
                            <button class="btn-icon btn-danger"
                                    onclick="window.announcementCardHandlers.onDelete('${announcement.id}')"
                                    title="מחק הודעה">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Message -->
                    <div class="announcement-card-message">
                        ${this.escapeHtml(announcement.message)}
                    </div>

                    <!-- Meta -->
                    <div class="announcement-card-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${startDate} - ${endDate}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-users"></i>
                            <span>${audienceLabel}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-star"></i>
                            <span>עדיפות ${announcement.priority}</span>
                        </div>
                        ${isActive ?
                            '<div class="meta-item status-active"><i class="fas fa-check-circle"></i><span>פעיל</span></div>' :
                            '<div class="meta-item status-inactive"><i class="fas fa-pause-circle"></i><span>לא פעיל</span></div>'
                        }
                    </div>

                    <!-- Display Settings -->
                    <div class="announcement-card-settings">
                        ${announcement.displaySettings.showOnLogin ?
                            '<span class="setting-badge"><i class="fas fa-sign-in-alt"></i> הצג בכניסה</span>' : ''}
                        ${announcement.displaySettings.showInHeader ?
                            '<span class="setting-badge"><i class="fas fa-window-maximize"></i> הצג בכותרת</span>' : ''}
                        ${announcement.displaySettings.dismissible ?
                            '<span class="setting-badge"><i class="fas fa-times-circle"></i> ניתן לסגירה</span>' : ''}
                    </div>

                    <!-- Read Summary -->
                    <div class="announcement-card-read-summary">
                        <i class="fas fa-eye"></i>
                        <span>נקרא על ידי ${Object.keys(announcement.readBy || {}).length} משתמשים</span>
                    </div>

                    <!-- Footer -->
                    <div class="announcement-card-footer">
                        <small>נוצר על ידי: ${this.escapeHtml(announcement.createdBy)}</small>
                        <small>${new Date(announcement.createdAt).toLocaleString('he-IL')}</small>
                    </div>
                </div>
            `;
        }

        /**
         * Get type label in Hebrew
         */
        static getTypeLabel(type) {
            const labels = {
                'info': 'מידע',
                'success': 'הצלחה',
                'warning': 'אזהרה',
                'error': 'שגיאה'
            };
            return labels[type] || 'מידע';
        }

        /**
         * Escape HTML to prevent XSS
         */
        static escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Inject styles for announcement cards
         */
        static injectStyles() {
            if (document.getElementById('announcementCardStyles')) {
return;
}

            const style = document.createElement('style');
            style.id = 'announcementCardStyles';
            style.textContent = `
                .announcement-card {
                    background: white;
                    border: none;
                    border-radius: 10px;
                    padding: 1.5rem;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
                    transition: all 0.3s ease;
                }

                .announcement-card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }

                .announcement-card.inactive {
                    opacity: 0.6;
                }

                .announcement-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                    gap: 1rem;
                }

                .announcement-card-title-section {
                    flex: 1;
                }

                .announcement-type-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .announcement-card-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                }

                .announcement-card-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    border: none;
                    background: #f1f5f9;
                    color: #64748b;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .btn-icon:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                    transform: scale(1.05);
                }

                .btn-icon.active {
                    background: #10b981;
                    color: white;
                }

                .btn-icon.active:hover {
                    background: #059669;
                }

                .btn-icon.btn-danger:hover {
                    background: #fee2e2;
                    color: #ef4444;
                }

                .announcement-card-message {
                    font-size: 14px;
                    color: #475569;
                    line-height: 1.6;
                    margin-bottom: 1rem;
                    white-space: pre-wrap;
                }

                .announcement-card-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    color: #64748b;
                }

                .meta-item i {
                    color: #94a3b8;
                }

                .meta-item.status-active {
                    color: #10b981;
                    font-weight: 600;
                }

                .meta-item.status-active i {
                    color: #10b981;
                }

                .meta-item.status-inactive {
                    color: #64748b;
                }

                .announcement-card-settings {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .setting-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.75rem;
                    background: #f1f5f9;
                    border-radius: 50px;
                    font-size: 0.75rem;
                    color: #475569;
                }

                .announcement-card-read-summary {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.813rem;
                    color: #6366f1;
                    margin-bottom: 1rem;
                }

                .announcement-card-read-summary i {
                    font-size: 12px;
                }

                .announcement-card-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    color: #94a3b8;
                }

                @media (max-width: 768px) {
                    .announcement-card-header {
                        flex-direction: column;
                    }

                    .announcement-card-actions {
                        width: 100%;
                        justify-content: flex-end;
                    }

                    .announcement-card-meta {
                        flex-direction: column;
                        gap: 0.5rem;
                    }

                    .announcement-card-footer {
                        flex-direction: column;
                        gap: 0.25rem;
                    }
                }
            `;

            document.head.appendChild(style);
        }
    }

    // Export
    window.AnnouncementCard = AnnouncementCard;

    // Inject styles on load
    AnnouncementCard.injectStyles();

    console.log('✅ AnnouncementCard component loaded');

})();
