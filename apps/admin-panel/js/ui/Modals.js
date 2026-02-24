/**
 * Modals System
 * מערכת מודאלים
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 3 - User Management Logic
 *
 * תפקיד: מערכת מודאלים מרכזית לכל הדיאלוגים במערכת
 */

(function() {
    'use strict';

    /**
     * ModalManager Class
     * מנהל את המודאלים במערכת
     */
    class ModalManager {
        constructor() {
            this.activeModals = new Map(); // Track all open modals
            this.modalCounter = 0; // Unique ID for each modal
            this.setupGlobalListeners();
        }

        /**
         * Setup global event listeners
         * הגדרת מאזינים גלובליים
         */
        setupGlobalListeners() {
            // ESC key to close topmost modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeTopModal();
                }
            });

            console.log('✅ ModalManager: Global listeners initialized');
        }

        /**
         * Create and show modal
         * יצירת והצגת מודאל
         *
         * @param {Object} options - Modal configuration
         * @returns {string} modalId - Unique modal ID
         */
        create(options) {
            const modalId = `modal-${++this.modalCounter}`;

            const config = {
                id: modalId,
                title: options.title || 'כותרת',
                content: options.content || '',
                size: options.size || 'medium', // small, medium, large, xlarge
                showCloseButton: options.showCloseButton !== false,
                closeOnBackdrop: options.closeOnBackdrop !== false,
                closeOnEsc: options.closeOnEsc !== false,
                footer: options.footer || null,
                className: options.className || '',
                onClose: options.onClose || null,
                onOpen: options.onOpen || null
            };

            // Create modal HTML
            const modalHTML = this.createModalHTML(config);

            // Add to DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Get modal element
            const modalElement = document.getElementById(modalId);

            // Setup event listeners
            this.setupModalListeners(modalElement, config);

            // Store in active modals
            this.activeModals.set(modalId, {
                element: modalElement,
                config: config
            });

            // Trigger open animation
            requestAnimationFrame(() => {
                modalElement.classList.add('modal-show');

                // Trigger onOpen callback
                if (config.onOpen) {
                    config.onOpen(modalId);
                }
            });

            console.log(`✅ Modal created: ${modalId} (${config.title})`);

            return modalId;
        }

        /**
         * Create modal HTML structure
         * יצירת מבנה HTML למודאל
         */
        createModalHTML(config) {
            const sizeClass = `modal-${config.size}`;
            const customClass = config.className ? ` ${config.className}` : '';

            return `
                <div class="modal-overlay" id="${config.id}">
                    <div class="modal-backdrop"></div>
                    <div class="modal-container ${sizeClass}${customClass}">
                        <!-- Modal Header -->
                        <div class="modal-header">
                            <h2 class="modal-title">${config.title}</h2>
                            ${config.showCloseButton ? `
                                <button class="modal-close-btn" data-modal-close>
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Modal Body -->
                        <div class="modal-body">
                            ${config.content}
                        </div>

                        ${config.footer ? `
                            <!-- Modal Footer -->
                            <div class="modal-footer">
                                ${config.footer}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        /**
         * Setup modal event listeners
         * הגדרת מאזיני אירועים למודאל
         */
        setupModalListeners(modalElement, config) {
            // Close button
            if (config.showCloseButton) {
                const closeBtn = modalElement.querySelector('[data-modal-close]');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        this.close(config.id);
                    });
                }
            }

            // Backdrop click
            if (config.closeOnBackdrop) {
                const backdrop = modalElement.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.addEventListener('click', () => {
                        this.close(config.id);
                    });
                }

                // Also close on overlay click (outside container)
                modalElement.addEventListener('click', (e) => {
                    if (e.target === modalElement) {
                        this.close(config.id);
                    }
                });
            }
        }

        /**
         * Close modal by ID
         * סגירת מודאל לפי ID
         */
        close(modalId) {
            const modal = this.activeModals.get(modalId);

            if (!modal) {
                console.warn(`⚠️ Modal not found: ${modalId}`);
                return;
            }

            const { element, config } = modal;

            // Trigger close animation
            element.classList.remove('modal-show');
            element.classList.add('modal-hide');

            // Wait for animation, then remove from DOM
            setTimeout(() => {
                // Trigger onClose callback
                if (config.onClose) {
                    config.onClose(modalId);
                }

                // Remove from DOM
                element.remove();

                // Remove from active modals
                this.activeModals.delete(modalId);

                console.log(`✅ Modal closed: ${modalId}`);
            }, 300); // Match animation duration
        }

        /**
         * Close topmost modal (for ESC key)
         * סגירת המודאל העליון
         */
        closeTopModal() {
            if (this.activeModals.size === 0) return;

            // Get last modal ID
            const modalIds = Array.from(this.activeModals.keys());
            const topModalId = modalIds[modalIds.length - 1];

            const modal = this.activeModals.get(topModalId);

            // Only close if ESC is allowed
            if (modal && modal.config.closeOnEsc) {
                this.close(topModalId);
            }
        }

        /**
         * Close all modals
         * סגירת כל המודאלים
         */
        closeAll() {
            const modalIds = Array.from(this.activeModals.keys());
            modalIds.forEach(id => this.close(id));
        }

        /**
         * Update modal content
         * עדכון תוכן מודאל
         */
        updateContent(modalId, newContent) {
            const modal = this.activeModals.get(modalId);

            if (!modal) {
                console.warn(`⚠️ Modal not found: ${modalId}`);
                return;
            }

            const bodyElement = modal.element.querySelector('.modal-body');
            if (bodyElement) {
                bodyElement.innerHTML = newContent;
            }
        }

        /**
         * Update modal title
         * עדכון כותרת מודאל
         */
        updateTitle(modalId, newTitle) {
            const modal = this.activeModals.get(modalId);

            if (!modal) {
                console.warn(`⚠️ Modal not found: ${modalId}`);
                return;
            }

            const titleElement = modal.element.querySelector('.modal-title');
            if (titleElement) {
                titleElement.textContent = newTitle;
            }
        }

        /**
         * Update modal footer
         * עדכון פוטר מודאל
         */
        updateFooter(modalId, newFooter) {
            const modal = this.activeModals.get(modalId);

            if (!modal) {
                console.warn(`⚠️ Modal not found: ${modalId}`);
                return;
            }

            let footerElement = modal.element.querySelector('.modal-footer');

            if (!footerElement && newFooter) {
                // Create footer if doesn't exist
                const container = modal.element.querySelector('.modal-container');
                footerElement = document.createElement('div');
                footerElement.className = 'modal-footer';
                container.appendChild(footerElement);
            }

            if (footerElement) {
                footerElement.innerHTML = newFooter;
            }
        }

        /**
         * Check if modal is open
         * בדיקה אם מודאל פתוח
         */
        isOpen(modalId) {
            return this.activeModals.has(modalId);
        }

        /**
         * Get modal element
         * קבלת אלמנט המודאל
         */
        getElement(modalId) {
            const modal = this.activeModals.get(modalId);
            return modal ? modal.element : null;
        }

        /**
         * Get number of open modals
         * קבלת מספר מודאלים פתוחים
         */
        getOpenCount() {
            return this.activeModals.size;
        }
    }

    /**
     * Helper Functions for Quick Modals
     * פונקציות עזר למודאלים מהירים
     */

    /**
     * Confirm Dialog
     * דיאלוג אישור
     */
    function confirm(options) {
        return new Promise((resolve) => {
            const modalId = window.ModalManager.create({
                title: options.title || 'אישור פעולה',
                content: `
                    <div class="modal-confirm-content">
                        ${options.icon ? `<i class="fas fa-${options.icon} modal-confirm-icon ${options.iconClass || ''}"></i>` : ''}
                        <p class="modal-confirm-message">${options.message || 'האם אתה בטוח?'}</p>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" data-action="cancel">
                        <i class="fas fa-times"></i>
                        <span>${options.cancelText || 'ביטול'}</span>
                    </button>
                    <button class="btn ${options.confirmClass || 'btn-primary'}" data-action="confirm">
                        <i class="fas fa-check"></i>
                        <span>${options.confirmText || 'אישור'}</span>
                    </button>
                `,
                size: 'small',
                closeOnBackdrop: options.closeOnBackdrop !== false,
                onOpen: () => {
                    const modal = window.ModalManager.getElement(modalId);

                    // Confirm button
                    const confirmBtn = modal.querySelector('[data-action="confirm"]');
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', () => {
                            window.ModalManager.close(modalId);
                            resolve(true);
                        });
                    }

                    // Cancel button
                    const cancelBtn = modal.querySelector('[data-action="cancel"]');
                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', () => {
                            window.ModalManager.close(modalId);
                            resolve(false);
                        });
                    }
                },
                onClose: () => {
                    resolve(false);
                }
            });
        });
    }

    /**
     * Alert Dialog
     * דיאלוג התראה
     */
    function alert(options) {
        return new Promise((resolve) => {
            const modalId = window.ModalManager.create({
                title: options.title || 'הודעה',
                content: `
                    <div class="modal-alert-content">
                        ${options.icon ? `<i class="fas fa-${options.icon} modal-alert-icon ${options.iconClass || ''}"></i>` : ''}
                        <p class="modal-alert-message">${options.message || ''}</p>
                    </div>
                `,
                footer: `
                    <button class="btn btn-primary" data-action="ok">
                        <i class="fas fa-check"></i>
                        <span>${options.okText || 'אישור'}</span>
                    </button>
                `,
                size: options.size || 'small',
                onOpen: () => {
                    const modal = window.ModalManager.getElement(modalId);

                    // OK button
                    const okBtn = modal.querySelector('[data-action="ok"]');
                    if (okBtn) {
                        okBtn.addEventListener('click', () => {
                            window.ModalManager.close(modalId);
                            resolve(true);
                        });
                    }
                },
                onClose: () => {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Loading Dialog
     * דיאלוג טעינה
     */
    function loading(options) {
        const modalId = window.ModalManager.create({
            title: options.title || 'מעבד...',
            content: `
                <div class="modal-loading-content">
                    <div class="loading-spinner-modal">
                        <div class="spinner-circle-modal"></div>
                    </div>
                    <p class="modal-loading-message">${options.message || 'אנא המתן...'}</p>
                </div>
            `,
            size: 'small',
            showCloseButton: false,
            closeOnBackdrop: false,
            closeOnEsc: false
        });

        return {
            close: () => window.ModalManager.close(modalId),
            updateMessage: (message) => {
                const modal = window.ModalManager.getElement(modalId);
                if (modal) {
                    const messageEl = modal.querySelector('.modal-loading-message');
                    if (messageEl) {
                        messageEl.textContent = message;
                    }
                }
            }
        };
    }

    // Create global instance
    const modalManager = new ModalManager();

    // Make ModalManager and helpers available globally
    window.ModalManager = modalManager;
    window.ModalHelpers = {
        confirm,
        alert,
        loading
    };

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { modalManager, confirm, alert, loading };
    }

})();
