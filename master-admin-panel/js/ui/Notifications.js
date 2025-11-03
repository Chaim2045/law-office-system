/**
 * Notifications System (Toast)
 * מערכת התראות
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 3 - User Management Logic
 *
 * תפקיד: הצגת התראות Toast למשובי פעולות
 */

(function() {
    'use strict';

    /**
     * NotificationManager Class
     * מנהל את ההתראות במערכת
     */
    class NotificationManager {
        constructor() {
            this.notifications = new Map(); // Track all active notifications
            this.notificationCounter = 0; // Unique ID for each notification
            this.maxNotifications = 5; // Maximum simultaneous notifications
            this.defaultDuration = 5000; // 5 seconds
            this.container = null;

            this.init();
        }

        /**
         * Initialize notifications system
         * אתחול מערכת ההתראות
         */
        init() {
            // Create container if doesn't exist
            if (!document.getElementById('notificationsContainer')) {
                const container = document.createElement('div');
                container.id = 'notificationsContainer';
                container.className = 'notifications-container';
                document.body.appendChild(container);
                this.container = container;
            } else {
                this.container = document.getElementById('notificationsContainer');
            }

            console.log('✅ NotificationManager: Initialized');
        }

        /**
         * Show notification
         * הצגת התראה
         *
         * @param {Object} options - Notification configuration
         * @returns {string} notificationId - Unique notification ID
         */
        show(options) {
            // Check if we've reached max notifications
            if (this.notifications.size >= this.maxNotifications) {
                // Remove oldest notification
                const oldestId = Array.from(this.notifications.keys())[0];
                this.hide(oldestId);
            }

            const notificationId = `notification-${++this.notificationCounter}`;

            const config = {
                id: notificationId,
                type: options.type || 'info', // success, error, warning, info
                title: options.title || '',
                message: options.message || '',
                duration: options.duration !== undefined ? options.duration : this.defaultDuration,
                showProgress: options.showProgress !== false,
                closeable: options.closeable !== false,
                onClick: options.onClick || null,
                onClose: options.onClose || null
            };

            // Create notification HTML
            const notificationHTML = this.createNotificationHTML(config);

            // Add to container
            this.container.insertAdjacentHTML('beforeend', notificationHTML);

            // Get notification element
            const notificationElement = document.getElementById(notificationId);

            // Setup event listeners
            this.setupNotificationListeners(notificationElement, config);

            // Store in active notifications
            this.notifications.set(notificationId, {
                element: notificationElement,
                config: config,
                timer: null
            });

            // Trigger show animation
            requestAnimationFrame(() => {
                notificationElement.classList.add('notification-show');
            });

            // Auto-hide after duration (if duration > 0)
            if (config.duration > 0) {
                const timer = setTimeout(() => {
                    this.hide(notificationId);
                }, config.duration);

                this.notifications.get(notificationId).timer = timer;

                // Update progress bar if enabled
                if (config.showProgress) {
                    this.animateProgress(notificationId, config.duration);
                }
            }

            console.log(`✅ Notification shown: ${notificationId} (${config.type})`);

            return notificationId;
        }

        /**
         * Create notification HTML
         * יצירת HTML להתראה
         */
        createNotificationHTML(config) {
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-times-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            const icon = icons[config.type] || icons.info;

            return `
                <div class="notification notification-${config.type}" id="${config.id}">
                    <div class="notification-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="notification-content">
                        ${config.title ? `<div class="notification-title">${config.title}</div>` : ''}
                        ${config.message ? `<div class="notification-message">${config.message}</div>` : ''}
                    </div>
                    ${config.closeable ? `
                        <button class="notification-close" data-notification-close>
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    ${config.showProgress ? `
                        <div class="notification-progress">
                            <div class="notification-progress-bar"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        /**
         * Setup notification event listeners
         * הגדרת מאזיני אירועים להתראה
         */
        setupNotificationListeners(notificationElement, config) {
            // Close button
            if (config.closeable) {
                const closeBtn = notificationElement.querySelector('[data-notification-close]');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.hide(config.id);
                    });
                }
            }

            // Click handler
            if (config.onClick) {
                notificationElement.style.cursor = 'pointer';
                notificationElement.addEventListener('click', () => {
                    config.onClick(config.id);
                });
            }
        }

        /**
         * Animate progress bar
         * אנימציית פס התקדמות
         */
        animateProgress(notificationId, duration) {
            const notification = this.notifications.get(notificationId);
            if (!notification) return;

            const progressBar = notification.element.querySelector('.notification-progress-bar');
            if (!progressBar) return;

            // CSS animation
            progressBar.style.transition = `width ${duration}ms linear`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }

        /**
         * Hide notification
         * הסתרת התראה
         */
        hide(notificationId) {
            const notification = this.notifications.get(notificationId);

            if (!notification) {
                return;
            }

            const { element, config, timer } = notification;

            // Clear timer
            if (timer) {
                clearTimeout(timer);
            }

            // Trigger hide animation
            element.classList.remove('notification-show');
            element.classList.add('notification-hide');

            // Wait for animation, then remove from DOM
            setTimeout(() => {
                // Trigger onClose callback
                if (config.onClose) {
                    config.onClose(notificationId);
                }

                // Remove from DOM
                element.remove();

                // Remove from active notifications
                this.notifications.delete(notificationId);

                console.log(`✅ Notification hidden: ${notificationId}`);
            }, 300); // Match animation duration
        }

        /**
         * Hide all notifications
         * הסתרת כל ההתראות
         */
        hideAll() {
            const notificationIds = Array.from(this.notifications.keys());
            notificationIds.forEach(id => this.hide(id));
        }

        /**
         * Update notification
         * עדכון התראה
         */
        update(notificationId, options) {
            const notification = this.notifications.get(notificationId);

            if (!notification) {
                console.warn(`⚠️ Notification not found: ${notificationId}`);
                return;
            }

            const { element, config } = notification;

            // Update title
            if (options.title !== undefined) {
                const titleElement = element.querySelector('.notification-title');
                if (titleElement) {
                    titleElement.textContent = options.title;
                }
                config.title = options.title;
            }

            // Update message
            if (options.message !== undefined) {
                const messageElement = element.querySelector('.notification-message');
                if (messageElement) {
                    messageElement.textContent = options.message;
                }
                config.message = options.message;
            }

            // Update type
            if (options.type !== undefined && options.type !== config.type) {
                element.classList.remove(`notification-${config.type}`);
                element.classList.add(`notification-${options.type}`);
                config.type = options.type;

                // Update icon
                const icons = {
                    success: 'fa-check-circle',
                    error: 'fa-times-circle',
                    warning: 'fa-exclamation-triangle',
                    info: 'fa-info-circle'
                };
                const iconElement = element.querySelector('.notification-icon i');
                if (iconElement) {
                    iconElement.className = `fas ${icons[options.type]}`;
                }
            }
        }

        /**
         * Quick notification methods
         * שיטות התראה מהירות
         */

        success(message, title = 'הצלחה') {
            return this.show({
                type: 'success',
                title: title,
                message: message,
                duration: 4000
            });
        }

        error(message, title = 'שגיאה') {
            return this.show({
                type: 'error',
                title: title,
                message: message,
                duration: 6000
            });
        }

        warning(message, title = 'אזהרה') {
            return this.show({
                type: 'warning',
                title: title,
                message: message,
                duration: 5000
            });
        }

        info(message, title = 'מידע') {
            return this.show({
                type: 'info',
                title: title,
                message: message,
                duration: 4000
            });
        }

        /**
         * Loading notification (persistent until manually closed)
         * התראת טעינה (נשארת עד סגירה ידנית)
         */
        loading(message, title = 'טוען...') {
            return this.show({
                type: 'info',
                title: title,
                message: message,
                duration: 0, // Don't auto-hide
                closeable: false,
                showProgress: false
            });
        }

        /**
         * Confirm dialog
         * דיאלוג אישור
         *
         * @param {string} message - Message to display
         * @param {Function} onConfirm - Callback when confirmed
         * @param {Function} onCancel - Callback when cancelled
         * @param {Object} options - Additional options (title, confirmText, cancelText, type)
         * @returns {void}
         */
        confirm(message, onConfirm, onCancel, options = {}) {
            const config = {
                title: options.title || 'אישור פעולה',
                confirmText: options.confirmText || 'אישור',
                cancelText: options.cancelText || 'ביטול',
                type: options.type || 'warning' // warning, error, info
            };

            // Icon based on type
            const icons = {
                warning: 'fa-exclamation-triangle',
                error: 'fa-times-circle',
                info: 'fa-info-circle',
                success: 'fa-check-circle'
            };

            const iconClass = icons[config.type] || icons.warning;

            // Color based on type
            const colors = {
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#3b82f6',
                success: '#10b981'
            };

            const iconColor = colors[config.type] || colors.warning;

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-header">
                        <div class="confirm-icon" style="color: ${iconColor};">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <h3 class="confirm-title">${config.title}</h3>
                    </div>
                    <div class="confirm-body">
                        <p class="confirm-message">${message.replace(/\n/g, '<br>')}</p>
                    </div>
                    <div class="confirm-footer">
                        <button class="confirm-btn confirm-btn-cancel" data-action="cancel">
                            <i class="fas fa-times"></i>
                            <span>${config.cancelText}</span>
                        </button>
                        <button class="confirm-btn confirm-btn-confirm" data-action="confirm">
                            <i class="fas fa-check"></i>
                            <span>${config.confirmText}</span>
                        </button>
                    </div>
                </div>
            `;

            // Add to body
            document.body.appendChild(overlay);

            // Show animation
            requestAnimationFrame(() => {
                overlay.classList.add('show');
            });

            // Close function
            const closeDialog = (action) => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                }, 300);

                if (action === 'confirm' && onConfirm) {
                    onConfirm();
                } else if (action === 'cancel' && onCancel) {
                    onCancel();
                }
            };

            // Event listeners
            const confirmBtn = overlay.querySelector('[data-action="confirm"]');
            const cancelBtn = overlay.querySelector('[data-action="cancel"]');

            confirmBtn.addEventListener('click', () => closeDialog('confirm'));
            cancelBtn.addEventListener('click', () => closeDialog('cancel'));

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog('cancel');
                }
            });

            // ESC key to cancel
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeDialog('cancel');
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            console.log('✅ Confirm dialog shown');
        }

        /**
         * Get number of active notifications
         * קבלת מספר התראות פעילות
         */
        getCount() {
            return this.notifications.size;
        }

        /**
         * Check if notification exists
         * בדיקה אם התראה קיימת
         */
        exists(notificationId) {
            return this.notifications.has(notificationId);
        }
    }

    // Create global instance
    const notificationManager = new NotificationManager();

    // Make NotificationManager available globally
    window.NotificationManager = notificationManager;

    // Also create shorthand alias
    window.notify = {
        show: (options) => notificationManager.show(options),
        success: (message, title) => notificationManager.success(message, title),
        error: (message, title) => notificationManager.error(message, title),
        warning: (message, title) => notificationManager.warning(message, title),
        info: (message, title) => notificationManager.info(message, title),
        loading: (message, title) => notificationManager.loading(message, title),
        confirm: (message, onConfirm, onCancel, options) => notificationManager.confirm(message, onConfirm, onCancel, options),
        hide: (id) => notificationManager.hide(id),
        hideAll: () => notificationManager.hideAll()
    };

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = notificationManager;
    }

})();
