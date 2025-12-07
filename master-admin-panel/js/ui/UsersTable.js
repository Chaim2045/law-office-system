/**
 * Users Table Component
 * קומפוננטת טבלת משתמשים
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 2 - Dashboard UI
 *
 * תפקיד: תצוגת טבלת משתמשים עם Actions
 */

(function() {
    'use strict';

    /**
     * UsersTable Class
     * מנהל את טבלת המשתמשים
     */
    class UsersTable {
        constructor() {
            this.columns = [
                { key: 'avatar', title: '', sortable: false, width: '60px' },
                { key: 'displayName', title: 'שם', sortable: true },
                { key: 'email', title: 'אימייל', sortable: true },
                { key: 'role', title: 'תפקיד', sortable: true },
                { key: 'status', title: 'סטטוס', sortable: true },
                { key: 'clientsCount', title: 'לקוחות', sortable: true },
                { key: 'tasksCount', title: 'משימות', sortable: true },
                { key: 'hoursThisMonth', title: 'שעות (חודש)', sortable: true },
                { key: 'lastLogin', title: 'כניסה אחרונה', sortable: true },
                { key: 'messages', title: 'הודעות', sortable: false, width: '90px' },
                { key: 'actions', title: 'פעולות', sortable: false, width: '120px' }
            ];

            this.currentSort = {
                field: 'displayName',
                order: 'asc'
            };

            // Store response counts
            this.responseCounts = new Map();

            // Load response counts on init
            this.loadResponseCounts();
        }

        /**
         * Load response counts from AlertCommunicationManager
         * טעינת ספירת תגובות מהמערכת
         */
        async loadResponseCounts() {
            try {
                if (window.alertCommManager && typeof window.alertCommManager.getUserResponseCounts === 'function') {
                    this.responseCounts = await window.alertCommManager.getUserResponseCounts();
                    console.log(`✅ UsersTable: Loaded response counts for ${this.responseCounts.size} users`);

                    // Refresh table if already rendered
                    this.refreshMessageBadges();
                }
            } catch (error) {
                console.error('❌ Failed to load response counts:', error);
            }
        }

        /**
         * Refresh message badges in table
         * רענון תגי ההודעות בטבלה
         */
        refreshMessageBadges() {
            this.responseCounts.forEach((count, email) => {
                const row = document.querySelector(`tr[data-user-id="${email}"]`);
                if (row) {
                    const messageTd = row.querySelector('.user-messages-badge-cell');
                    if (messageTd) {
                        messageTd.innerHTML = this.renderMessageBadge(email);
                    }
                }
            });
        }

        /**
         * Render users table
         * רינדור טבלת משתמשים
         */
        render(container, users) {
            if (!container) {
                console.error('❌ UsersTable: Container not found');
                return;
            }

            if (!users || users.length === 0) {
                container.innerHTML = this.renderEmptyState();
                return;
            }

            const html = `
                <div class="table-wrapper">
                    <table class="users-table">
                        ${this.renderTableHeader()}
                        ${this.renderTableBody(users)}
                    </table>
                </div>
            `;

            container.innerHTML = html;

            // Setup event listeners
            this.setupTableEvents();

            console.log(`✅ UsersTable: Rendered ${users.length} users`);
        }

        /**
         * Render table header
         * רינדור כותרות הטבלה
         */
        renderTableHeader() {
            return `
                <thead>
                    <tr>
                        ${this.columns.map(col => this.renderHeaderCell(col)).join('')}
                    </tr>
                </thead>
            `;
        }

        /**
         * Render header cell
         * רינדור תא כותרת
         */
        renderHeaderCell(column) {
            const width = column.width ? `style="width: ${column.width}"` : '';
            const sortable = column.sortable ? 'sortable' : '';
            const sorted = this.currentSort.field === column.key ? 'sorted' : '';
            const sortIcon = this.getSortIcon(column.key);

            if (!column.sortable) {
                return `<th ${width}>${column.title}</th>`;
            }

            return `
                <th ${width} class="${sortable} ${sorted}" data-sort="${column.key}">
                    <div class="th-content">
                        <span>${column.title}</span>
                        ${sortIcon}
                    </div>
                </th>
            `;
        }

        /**
         * Get sort icon
         * קבלת אייקון מיון
         */
        getSortIcon(field) {
            if (this.currentSort.field !== field) {
                return '<i class="fas fa-sort sort-icon"></i>';
            }

            if (this.currentSort.order === 'asc') {
                return '<i class="fas fa-sort-up sort-icon active"></i>';
            } else {
                return '<i class="fas fa-sort-down sort-icon active"></i>';
            }
        }

        /**
         * Render table body
         * רינדור גוף הטבלה
         */
        renderTableBody(users) {
            return `
                <tbody>
                    ${users.map(user => this.renderTableRow(user)).join('')}
                </tbody>
            `;
        }

        /**
         * Render table row
         * רינדור שורת משתמש
         */
        renderTableRow(user) {
            return `
                <tr data-user-id="${user.email}" class="user-row">
                    <td>${this.renderAvatar(user)}</td>
                    <td><strong>${this.escapeHtml(user.displayName)}</strong></td>
                    <td>${this.escapeHtml(user.email)}</td>
                    <td>${this.renderRole(user.role)}</td>
                    <td>${this.renderStatus(user.status)}</td>
                    <td>${user.clientsCount || 0}</td>
                    <td>${user.tasksCount || 0}</td>
                    <td>${this.renderHours(user.hoursThisMonth)}</td>
                    <td>${this.renderDate(user.lastLogin)}</td>
                    <td class="user-messages-badge-cell">${this.renderMessageBadge(user.email)}</td>
                    <td>${this.renderActions(user)}</td>
                </tr>
            `;
        }

        /**
         * Render avatar
         * רינדור אווטר
         */
        renderAvatar(user) {
            if (user.photoURL) {
                return `<img src="${user.photoURL}" alt="${user.displayName}" class="user-avatar">`;
            }

            const initials = this.getInitials(user.displayName || user.username);
            const colorClass = this.getAvatarColor(user.email);

            return `
                <div class="user-avatar avatar-initials ${colorClass}">
                    ${initials}
                </div>
            `;
        }

        /**
         * Get initials from name
         * קבלת ראשי תיבות
         */
        getInitials(name) {
            if (!name) {
return '?';
}

            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        /**
         * Get avatar color based on email
         * קבלת צבע אווטר לפי אימייל
         */
        getAvatarColor(email) {
            const colors = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-orange', 'avatar-red'];
            const index = email.charCodeAt(0) % colors.length;
            return colors[index];
        }

        /**
         * Render role badge
         * רינדור תג תפקיד
         */
        renderRole(role) {
            const roleMap = {
                'admin': { text: 'מנהל', class: 'badge-admin' },
                'user': { text: 'משתמש', class: 'badge-user' }
            };

            const roleData = roleMap[role] || { text: role, class: 'badge-default' };

            return `<span class="badge ${roleData.class}">${roleData.text}</span>`;
        }

        /**
         * Render status badge
         * רינדור תג סטטוס
         */
        renderStatus(status) {
            const statusMap = {
                'active': { text: 'פעיל', class: 'badge-success' },
                'blocked': { text: 'חסום', class: 'badge-danger' },
                'pending': { text: 'ממתין', class: 'badge-warning' }
            };

            const statusData = statusMap[status] || { text: status, class: 'badge-default' };

            return `<span class="badge ${statusData.class}">${statusData.text}</span>`;
        }

        /**
         * Render hours
         * רינדור שעות
         */
        renderHours(hours) {
            if (!hours || hours === 0) {
return '-';
}
            return `${hours.toFixed(1)} ש'`;
        }

        /**
         * Render message badge
         * רינדור תג הודעות
         */
        renderMessageBadge(userEmail) {
            const count = this.responseCounts.get(userEmail) || 0;

            if (count === 0) {
                return '-';
            }

            return `
                <button class="user-message-badge"
                        data-user-email="${userEmail}"
                        data-action="view-messages"
                        title="לחץ לצפייה בהודעות">
                    <i class="fas fa-envelope"></i>
                    <span class="badge-count">${count}</span>
                </button>
            `;
        }

        /**
         * Render date
         * רינדור תאריך
         */
        renderDate(date) {
            if (!date) {
return '-';
}

            try {
                const dateObj = date.toDate ? date.toDate() : new Date(date);
                return this.formatDate(dateObj);
            } catch (error) {
                return '-';
            }
        }

        /**
         * Format date
         * פורמט תאריך
         *
         * 🔧 FIX: משווה תאריכים קלנדריים במקום הפרש זמן
         * זה מבטיח שתאריכים מוצגים נכון לפי יום בלוח השנה, לא לפי 24 שעות
         */
        formatDate(date) {
            const now = new Date();

            // Reset time to midnight for accurate day comparison
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            // Calculate difference in days (calendar days, not 24-hour periods)
            const diffTime = today - compareDate;
            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (days === 0) {
                return 'היום';
            } else if (days === 1) {
                return 'אתמול';
            } else if (days < 7) {
                return `לפני ${days} ימים`;
            } else if (days < 30) {
                const weeks = Math.floor(days / 7);
                return `לפני ${weeks} שבועות`;
            } else if (days < 365) {
                const months = Math.floor(days / 30);
                return `לפני ${months} חודשים`;
            } else {
                return date.toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        }

        /**
         * Render actions menu
         * רינדור תפריט פעולות
         */
        renderActions(user) {
            return `
                <div class="actions-dropdown">
                    <button class="btn-actions" data-user-email="${user.email}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="actions-menu" style="display: none;">
                        <button class="action-item" data-action="view" data-user-email="${user.email}">
                            <i class="fas fa-eye"></i>
                            <span>צפה בפרטים</span>
                        </button>
                        <button class="action-item" data-action="edit" data-user-email="${user.email}">
                            <i class="fas fa-edit"></i>
                            <span>ערוך</span>
                        </button>
                        ${user.whatsappEnabled && user.phone ? `
                        <button class="action-item whatsapp-action" data-action="whatsapp" data-user-email="${user.email}" data-user-name="${user.name || user.email}">
                            <i class="fab fa-whatsapp"></i>
                            <span>שלח הודעת WhatsApp</span>
                        </button>
                        ` : ''}
                        <button class="action-item" data-action="block" data-user-email="${user.email}">
                            <i class="fas fa-ban"></i>
                            <span>${user.status === window.ADMIN_PANEL_CONSTANTS.USER_STATUS.BLOCKED ? 'הסר חסימה' : 'חסום'}</span>
                        </button>
                        <button class="action-item danger" data-action="delete" data-user-email="${user.email}">
                            <i class="fas fa-trash"></i>
                            <span>מחק</span>
                        </button>
                    </div>
                </div>
            `;
        }

        /**
         * Render empty state
         * רינדור מצב ריק
         */
        renderEmptyState() {
            return `
                <div class="empty-state">
                    <i class="fas fa-users-slash empty-icon"></i>
                    <h3>לא נמצאו משתמשים</h3>
                    <p>נסה לשנות את הפילטרים או להוסיף משתמשים חדשים</p>
                </div>
            `;
        }

        /**
         * Setup table event listeners
         * הגדרת מאזיני אירועים לטבלה
         */
        setupTableEvents() {
            // Sort headers
            document.querySelectorAll('th.sortable').forEach(th => {
                th.addEventListener('click', () => {
                    const field = th.getAttribute('data-sort');
                    this.handleSort(field);
                });
            });

            // Actions buttons
            document.querySelectorAll('.btn-actions').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleActionsMenu(btn);
                });
            });

            // Action items
            document.querySelectorAll('.action-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const action = item.getAttribute('data-action');
                    const userEmail = item.getAttribute('data-user-email');
                    const userName = item.getAttribute('data-user-name');
                    this.handleAction(action, userEmail, userName);
                });
            });

            // Message badge buttons
            document.querySelectorAll('.user-message-badge').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const userEmail = btn.getAttribute('data-user-email');
                    this.handleMessageBadgeClick(userEmail);
                });
            });

            // Close menus on outside click
            document.addEventListener('click', () => {
                this.closeAllMenus();
            });
        }

        /**
         * Handle sort
         * טיפול במיון
         */
        handleSort(field) {
            // Toggle order if same field
            if (this.currentSort.field === field) {
                this.currentSort.order = this.currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentSort.field = field;
                this.currentSort.order = 'asc';
            }

            // Emit event
            window.dispatchEvent(new CustomEvent('filter:changed', {
                detail: {
                    type: 'sort',
                    sortBy: field,
                    sortOrder: this.currentSort.order
                }
            }));
        }

        /**
         * Toggle actions menu
         * החלפת מצב תפריט פעולות
         */
        toggleActionsMenu(button) {
            // Close all other menus
            this.closeAllMenus();

            // Toggle this menu
            const menu = button.nextElementSibling;
            if (menu) {
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            }
        }

        /**
         * Close all menus
         * סגירת כל התפריטים
         */
        closeAllMenus() {
            document.querySelectorAll('.actions-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }

        /**
         * Handle action
         * טיפול בפעולה
         */
        handleAction(action, userEmail, userName = null) {
            console.log(`🔧 Action: ${action} for ${userEmail}`);

            // Close menu
            this.closeAllMenus();

            // Emit event
            window.dispatchEvent(new CustomEvent('user:action', {
                detail: {
                    action,
                    userEmail,
                    userName
                }
            }));
        }

        /**
         * Handle message badge click
         * טיפול בלחיצה על תג הודעות
         */
        handleMessageBadgeClick(userEmail) {
            console.log(`📧 Opening messages for: ${userEmail}`);

            // Find the user in DataManager
            if (window.DataManager && window.DataManager.allUsers) {
                const user = window.DataManager.allUsers.find(u => u.email === userEmail);
                if (user && window.userDetailsModal) {
                    // Open user details modal with messages tab
                    window.userDetailsModal.open(user);
                    // TODO: Switch to messages tab automatically
                } else {
                    console.error('User or userDetailsModal not found');
                }
            }
        }

        /**
         * Escape HTML to prevent XSS
         * בריחה מ-HTML למניעת XSS
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // Create global instance
    const usersTable = new UsersTable();

    // Make UsersTable available globally
    window.UsersTable = usersTable;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = usersTable;
    }

})();
