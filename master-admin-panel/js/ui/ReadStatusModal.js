/**
 * Read Status Modal
 * @version 2.0.0
 * @created 2026-02-09
 */

(function() {
    'use strict';

    class ReadStatusModal {
        constructor(db) {
            this.db = db;
            this.overlay = null;
        }

        /**
         * Open modal for a specific announcement
         * @param {SystemAnnouncement} announcement
         */
        async open(announcement) {
            this.close();

            const readBy = announcement.readBy || {};
            const dismissedBy = announcement.dismissedBy || [];
            const targetAudience = announcement.targetAudience || 'all';

            // Query employees
            let allEmployees = [];
            try {
                const employeesSnapshot = await this.db.collection('employees')
                    .where('isActive', '==', true)
                    .get();

                allEmployees = employeesSnapshot.docs.map(doc => ({
                    email: doc.id,
                    displayName: doc.data().displayName || doc.data().name || doc.id,
                    role: doc.data().role || 'employee'
                }));
            } catch (error) {
                console.error('[ReadStatusModal] Error fetching employees:', error);
            }

            // Filter by target audience
            const relevantEmployees = allEmployees.filter(emp => {
                if (targetAudience === 'specific' && announcement.targetEmail) {
                    return emp.email === announcement.targetEmail;
                }
                if (targetAudience === 'admins') {
                    return emp.role === 'admin';
                }
                return true;
            });

            // Build status list
            const statusList = relevantEmployees.map(emp => {
                const readEntry = readBy[emp.email];
                const legacyDismissed = dismissedBy.includes(emp.email);
                return {
                    email: emp.email,
                    displayName: emp.displayName,
                    hasRead: !!readEntry || legacyDismissed,
                    readAt: readEntry?.readAt?.toDate ? readEntry.readAt.toDate() :
                            readEntry?.readAt ? new Date(readEntry.readAt) : null
                };
            });

            // Sort: read first (by date desc), then unread (alphabetical)
            statusList.sort((a, b) => {
                if (a.hasRead && !b.hasRead) {
return -1;
}
                if (!a.hasRead && b.hasRead) {
return 1;
}
                if (a.hasRead && b.hasRead) {
                    if (a.readAt && b.readAt) {
return b.readAt - a.readAt;
}
                    return 0;
                }
                return a.displayName.localeCompare(b.displayName, 'he');
            });

            const readCount = statusList.filter(s => s.hasRead).length;
            const totalCount = statusList.length;
            const percent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

            const overlay = document.createElement('div');
            overlay.className = 'read-status-overlay';

            overlay.innerHTML = `
                <div class="read-status-modal">
                    <div class="read-status-header">
                        <h3><i class="fas fa-eye"></i> סטטוס קריאה</h3>
                        <button class="read-status-close" title="סגור">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="read-status-body">
                        <div class="read-status-summary">
                            <span class="read-status-count">${readCount} / ${totalCount}</span>
                            <span>קראו (${percent}%)</span>
                        </div>
                        ${totalCount === 0
                            ? '<p class="read-status-empty">לא נמצאו עובדים רלוונטיים</p>'
                            : `<ul class="read-status-list">
                                ${statusList.map(s => {
                                    const dateStr = s.readAt
                                        ? s.readAt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + s.readAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                        : '';
                                    if (s.hasRead) {
                                        return `
                                            <li class="read-status-item read-status-item-read">
                                                <div class="read-status-user">
                                                    <i class="fas fa-check-circle read-status-icon-read"></i>
                                                    <span class="read-status-name">${this.escapeHtml(s.displayName)}</span>
                                                </div>
                                                <span class="read-status-date">${dateStr}</span>
                                            </li>`;
                                    } else {
                                        return `
                                            <li class="read-status-item read-status-item-unread">
                                                <div class="read-status-user">
                                                    <i class="fas fa-times-circle read-status-icon-unread"></i>
                                                    <span class="read-status-name">${this.escapeHtml(s.displayName)}</span>
                                                </div>
                                                <span class="read-status-date read-status-unread-label">טרם קרא</span>
                                            </li>`;
                                    }
                                }).join('')}
                            </ul>`
                        }
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            this.overlay = overlay;

            // Close button
            overlay.querySelector('.read-status-close').addEventListener('click', () => this.close());

            // Overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });

            // Escape key
            this._escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close();
                }
            };
            document.addEventListener('keydown', this._escapeHandler);
        }

        /**
         * Close modal
         */
        close() {
            if (this._escapeHandler) {
                document.removeEventListener('keydown', this._escapeHandler);
                this._escapeHandler = null;
            }
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
            }
        }

        /**
         * Escape HTML
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }

        /**
         * Inject styles
         */
        static injectStyles() {
            if (document.getElementById('readStatusModalStyles')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'readStatusModalStyles';
            style.textContent = `
                .read-status-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    direction: rtl;
                }

                .read-status-modal {
                    background: #fff;
                    border-radius: 16px;
                    max-width: 480px;
                    width: 100%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                }

                .read-status-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .read-status-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #1e293b;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .read-status-header h3 i {
                    color: #6366f1;
                }

                .read-status-close {
                    width: 32px;
                    height: 32px;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    color: #9ca3af;
                    font-size: 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }

                .read-status-close:hover {
                    background: #f3f4f6;
                    color: #1f2937;
                }

                .read-status-body {
                    padding: 20px 24px;
                    overflow-y: auto;
                }

                .read-status-summary {
                    text-align: center;
                    margin-bottom: 20px;
                    font-size: 15px;
                    color: #4b5563;
                }

                .read-status-count {
                    display: inline-block;
                    background: #6366f1;
                    color: #fff;
                    font-weight: 700;
                    font-size: 16px;
                    padding: 4px 14px;
                    border-radius: 20px;
                    text-align: center;
                    margin-left: 8px;
                }

                .read-status-empty {
                    text-align: center;
                    color: #9ca3af;
                    font-size: 14px;
                    padding: 20px 0;
                }

                .read-status-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }

                .read-status-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    border-radius: 10px;
                    background: #f9fafb;
                    margin-bottom: 8px;
                    transition: background 0.15s ease;
                }

                .read-status-item:hover {
                    background: #f3f4f6;
                }

                .read-status-user {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                    color: #1e293b;
                }

                .read-status-icon-read {
                    color: #10b981;
                    font-size: 14px;
                }

                .read-status-icon-unread {
                    color: #ef4444;
                    font-size: 14px;
                }

                .read-status-name {
                    font-size: 14px;
                }

                .read-status-date {
                    font-size: 12px;
                    color: #9ca3af;
                }

                .read-status-unread-label {
                    color: #ef4444;
                    font-weight: 500;
                }

                @media (max-width: 480px) {
                    .read-status-modal {
                        max-width: 95%;
                    }
                }
            `;

            document.head.appendChild(style);
        }
    }

    // Export
    window.ReadStatusModal = ReadStatusModal;

    // Inject styles on load
    ReadStatusModal.injectStyles();

})();
