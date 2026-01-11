/**
 * UserAlertsPanel
 * פאנל התראות משתמש - מציג התראות והודעות מהירות
 *
 * Created: 2025-12-01
 * Phase: UI Layer
 *
 * זה הקומפוננטה שמציגה התראות למנהל על העובד
 * ונותנת לו אפשרות לשלוח הודעות מהירות
 */

(function() {
    'use strict';

    class UserAlertsPanel {
        constructor(containerElement) {
            this.container = containerElement;
            this.userId = null;
            this.userData = null;
            this.alerts = [];

            // References to managers
            this.alertsAnalyticsService = window.alertsAnalyticsService;
            this.alertEngine = window.alertEngine; // For getMessageTemplate utility
            this.contextMessageManager = window.contextMessageManager;
            this.threadManager = window.threadManager;
        }

        /**
         * Initialize panel with user data
         * @param {string} userId - User ID
         * @param {Object} userData - Full user data
         */
        async init(userId, userData) {
            console.log('🚀 UserAlertsPanel: Initializing for user', userId);

            this.userId = userId;
            this.userData = userData;

            // Calculate alerts via central analytics service
            const result = this.alertsAnalyticsService.computeAlertsAnalytics(userData);

            if (!result.ok) {
                // Analytics failed - show error banner, no partial data
                console.error('❌ UserAlertsPanel: Analytics unavailable:', result.error.code);
                this.renderError(result.error.message);
                return;
            }

            // Success - render alerts
            this.alerts = result.data;
            this.render();

            console.log('✅ UserAlertsPanel: Initialized successfully');
        }

        /**
         * Render the panel
         */
        render() {
            if (this.alerts.length === 0) {
                this.renderEmpty();
                return;
            }

            const html = `
                <div class="user-alerts-panel">
                    <div class="alerts-header">
                        <h3>
                            <i class="fas fa-exclamation-triangle"></i>
                            התראות (${this.alerts.length})
                        </h3>
                        <button class="refresh-alerts-btn" onclick="window.userAlertsPanel?.refresh()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>

                    <div class="alerts-list">
                        ${this.alerts.map(alert => this.renderAlert(alert)).join('')}
                    </div>
                </div>
            `;

            this.container.innerHTML = html;

            // Attach event listeners
            this.attachEventListeners();
        }

        /**
         * Render single alert
         */
        renderAlert(alert) {
            const severityClass = `alert-${alert.severity}`;
            const iconClass = alert.icon || 'fa-exclamation-circle';

            return `
                <div class="user-alert ${severityClass}" data-alert-type="${alert.type}">
                    <div class="alert-header">
                        <div class="alert-icon">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="alert-content">
                            <h4 class="alert-title">${this.escapeHTML(alert.title)}</h4>
                            <p class="alert-description">${this.escapeHTML(alert.description)}</p>
                        </div>
                    </div>

                    ${alert.actionable ? this.renderAlertActions(alert) : ''}
                </div>
            `;
        }

        /**
         * Render alert actions
         */
        renderAlertActions(alert) {
            if (!alert.actions || alert.actions.length === 0) {
                return '';
            }

            const actionsHTML = alert.actions.map(action => {
                const btnClass = this.getActionButtonClass(action.type);
                const icon = this.getActionIcon(action.type);

                return `
                    <button
                        class="alert-action-btn ${btnClass}"
                        data-action-type="${action.type}"
                        data-alert-type="${alert.type}"
                        data-action-data='${JSON.stringify(action)}'
                    >
                        <i class="fas ${icon}"></i>
                        ${this.escapeHTML(action.label)}
                    </button>
                `;
            }).join('');

            return `
                <div class="alert-actions">
                    ${actionsHTML}
                </div>
            `;
        }

        /**
         * Render empty state
         */
        renderEmpty() {
            const html = `
                <div class="user-alerts-panel empty">
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <h3>אין התראות</h3>
                        <p>כל המשימות והפעילויות תקינות</p>
                    </div>
                </div>
            `;

            this.container.innerHTML = html;
        }

        /**
         * Render error state
         */
        renderError(message) {
            const html = `
                <div class="user-alerts-panel error">
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>${this.escapeHTML(message)}</h3>
                        <button class="retry-btn" onclick="window.userAlertsPanel?.refresh()">
                            נסה שוב
                        </button>
                    </div>
                </div>
            `;

            this.container.innerHTML = html;
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            const actionButtons = this.container.querySelectorAll('.alert-action-btn');

            actionButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const actionType = btn.getAttribute('data-action-type');
                    const alertType = btn.getAttribute('data-alert-type');
                    const actionData = JSON.parse(btn.getAttribute('data-action-data'));

                    this.handleAction(actionType, alertType, actionData);
                });
            });
        }

        /**
         * Handle action button click
         */
        async handleAction(actionType, alertType, actionData) {
            try {
                console.log('🎯 UserAlertsPanel: Action triggered:', actionType);

                switch (actionType) {
                    case 'send_reminder':
                    case 'send_message':
                        await this.handleSendMessage(alertType, actionData);
                        break;

                    case 'create_thread':
                        await this.handleCreateThread(alertType, actionData);
                        break;

                    case 'view_tasks':
                        this.handleViewTasks();
                        break;

                    case 'edit_profile':
                        this.handleEditProfile();
                        break;

                    case 'assign_tasks':
                        this.handleAssignTasks();
                        break;

                    default:
                        console.warn('Unknown action type:', actionType);
                }

            } catch (error) {
                console.error('❌ UserAlertsPanel: Action failed:', error);
                this.showError('שגיאה בביצוע הפעולה');
            }
        }

        /**
         * Handle send message
         */
        async handleSendMessage(alertType, actionData) {
            console.log('📤 Sending message for alert:', alertType);

            // Find the alert
            const alert = this.alerts.find(a => a.type === alertType);
            if (!alert) {
                console.error('Alert not found:', alertType);
                return;
            }

            // Get message template
            const template = actionData.template || alertType;
            const templateData = actionData.templateData || alert.contextData;
            const messageBody = this.alertEngine.getMessageTemplate(template, templateData);

            // Show quick message dialog
            if (window.quickMessageDialog) {
                await window.quickMessageDialog.show({
                    userId: this.userId,
                    userName: this.userData.displayName || this.userData.email,
                    alertType: alertType,
                    alertTitle: alert.title,
                    messageBody: messageBody,
                    alert: alert
                });
            } else {
                console.error('QuickMessageDialog not available');
                this.showError('דיאלוג הודעות לא זמין');
            }
        }

        /**
         * Handle create thread
         */
        async handleCreateThread(alertType, actionData) {
            console.log('📋 Creating thread for alert:', alertType);

            // Find the alert
            const alert = this.alerts.find(a => a.type === alertType);
            if (!alert) {
                console.error('Alert not found:', alertType);
                return;
            }

            // Create thread
            try {
                const thread = await this.threadManager.createThread({
                    title: actionData.threadTitle || alert.title,
                    category: THREAD_CATEGORIES.ADMIN,
                    priority: alert.isCritical() ? THREAD_PRIORITY.URGENT : THREAD_PRIORITY.NORMAL,
                    participants: [this.userId],
                    relatedTo: {
                        type: 'alert',
                        id: alert.type,
                        name: alert.title
                    }
                });

                console.log('✅ Thread created:', thread.id);

                // Show success
                this.showSuccess('דיון נוצר בהצלחה');

                // Optionally open thread UI
                if (window.threadUI) {
                    window.threadUI.openThread(thread.id);
                }

            } catch (error) {
                console.error('❌ Failed to create thread:', error);
                this.showError('שגיאה ביצירת דיון');
            }
        }

        /**
         * Handle view tasks
         */
        handleViewTasks() {
            console.log('👁️ View tasks clicked');
            // Switch to tasks tab in UserDetailsModal
            if (window.UserDetailsModal) {
                window.UserDetailsModal.switchTab('tasks');
            }
        }

        /**
         * Handle edit profile
         */
        handleEditProfile() {
            console.log('✏️ Edit profile clicked');
            // Switch to general tab in UserDetailsModal
            if (window.UserDetailsModal) {
                window.UserDetailsModal.switchTab('general');
            }
        }

        /**
         * Handle assign tasks
         */
        handleAssignTasks() {
            console.log('📝 Assign tasks clicked');
            // TODO: Open task assignment dialog
            this.showInfo('פתח מסך הקצאת משימות');
        }

        /**
         * Refresh alerts
         */
        async refresh() {
            console.log('🔄 Refreshing alerts...');

            // Clear cache
            this.alertsAnalyticsService.clearCache(this.userId);

            // Recalculate via central analytics service
            const result = this.alertsAnalyticsService.computeAlertsAnalytics(this.userData);

            if (!result.ok) {
                // Analytics failed - show error banner, no partial data
                console.error('❌ UserAlertsPanel: Analytics unavailable on refresh:', result.error.code);
                this.renderError(result.error.message);
                return;
            }

            // Success - update and re-render
            this.alerts = result.data;
            this.render();

            this.showSuccess('התראות עודכנו');
        }

        /**
         * Update with new user data
         */
        update(userData) {
            this.userData = userData;
            this.refresh();
        }

        /**
         * Destroy panel
         */
        destroy() {
            this.container.innerHTML = '';
            this.userId = null;
            this.userData = null;
            this.alerts = [];
        }

        // =====================
        // UTILITY METHODS
        // =====================

        /**
         * Get action button class
         */
        getActionButtonClass(actionType) {
            const classes = {
                'send_reminder': 'btn-primary',
                'send_message': 'btn-primary',
                'create_thread': 'btn-secondary',
                'view_tasks': 'btn-secondary',
                'edit_profile': 'btn-secondary',
                'assign_tasks': 'btn-secondary'
            };

            return classes[actionType] || 'btn-secondary';
        }

        /**
         * Get action icon
         */
        getActionIcon(actionType) {
            const icons = {
                'send_reminder': 'fa-paper-plane',
                'send_message': 'fa-envelope',
                'create_thread': 'fa-comments',
                'view_tasks': 'fa-tasks',
                'edit_profile': 'fa-user-edit',
                'assign_tasks': 'fa-clipboard-list'
            };

            return icons[actionType] || 'fa-arrow-right';
        }

        /**
         * Escape HTML
         */
        escapeHTML(str) {
            if (!str) {
return '';
}
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        /**
         * Show success message
         */
        showSuccess(message) {
            this.showNotification(message, 'success');
        }

        /**
         * Show error message
         */
        showError(message) {
            this.showNotification(message, 'error');
        }

        /**
         * Show info message
         */
        showInfo(message) {
            this.showNotification(message, 'info');
        }

        /**
         * Show notification
         */
        showNotification(message, type = 'info') {
            // Use existing notification system if available
            if (window.showNotification) {
                window.showNotification(message, type);
            } else if (window.showMessage) {
                window.showMessage(message, type);
            } else {
                // Fallback to alert
                alert(message);
            }
        }
    }

    // Make available globally
    window.UserAlertsPanel = UserAlertsPanel;

    console.log('✅ UserAlertsPanel loaded');

})();
