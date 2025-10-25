/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║                       MODALS MANAGER MODULE                           ║
 * ║                   Law Office Management System                        ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  Centralized modal/popup management system                           ║
 * ║  Author: Development Team                                            ║
 * ║  Version: 1.0.0                                                      ║
 * ║  Created: 2025-10-17                                                 ║
 * ║                                                                       ║
 * ║  📚 Documentation: /docs/modals-manager.md                           ║
 * ║  🧪 Tests: /__tests__/modals-manager.test.js                         ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/* global safeText, formatDate, formatDateTime */

(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // CONSTANTS & CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Z-Index layers
    ZINDEX: {
      OVERLAY: 9999,
      MODAL: 10000,
      LOADING: 10001,
    },

    // Animation durations (ms)
    ANIMATION: {
      FADE_IN: 200,
      SLIDE_UP: 300,
      FADE_OUT: 200,
    },

    // Default sizes
    SIZES: {
      SMALL: '450px',
      MEDIUM: '550px',
      LARGE: '650px',
      XLARGE: '900px',
    },

    // CSS Classes
    CLASSES: {
      OVERLAY: 'popup-overlay',
      MODAL: 'popup',
      HEADER: 'popup-header',
      CONTENT: 'popup-content',
      BUTTONS: 'popup-buttons',
      BTN: 'popup-btn',
      BTN_PRIMARY: 'popup-btn-confirm',
      BTN_SECONDARY: 'popup-btn-cancel',
      BTN_DANGER: 'popup-btn-danger',
      BTN_SUCCESS: 'popup-btn-success',
      HIDDEN: 'hidden',
    },

    // Default icons (Font Awesome)
    ICONS: {
      INFO: 'fa-info-circle',
      SUCCESS: 'fa-check-circle',
      WARNING: 'fa-exclamation-triangle',
      ERROR: 'fa-times-circle',
      QUESTION: 'fa-question-circle',
      LOADING: 'fa-spinner fa-spin',
    },

    // Colors
    COLORS: {
      PRIMARY: '#3b82f6',
      SUCCESS: '#10b981',
      WARNING: '#f59e0b',
      ERROR: '#ef4444',
      INFO: '#0ea5e9',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE STATE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Active modals registry
   * @type {Map<string, {element: HTMLElement, config: Object}>}
   * @private
   */
  const activeModals = new Map();

  /**
   * Event subscribers
   * @type {Map<string, Set<Function>>}
   * @private
   */
  const eventSubscribers = new Map();

  /**
   * Loading overlays counter
   * @type {number}
   * @private
   */
  let loadingCounter = 0;

  /**
   * Unique ID generator
   * @type {number}
   * @private
   */
  let modalIdCounter = 0;

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS (Private)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate unique modal ID
   * @returns {string}
   * @private
   */
  function generateId() {
    return `modal_${Date.now()}_${++modalIdCounter}`;
  }

  /**
   * Sanitize HTML to prevent XSS
   * @param {string} html
   * @returns {string}
   * @private
   */
  function sanitizeHTML(html) {
    if (typeof html !== 'string') return '';

    // Use safeText if available, otherwise basic sanitization
    if (typeof safeText === 'function') {
      return safeText(html);
    }

    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Emit event to subscribers
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  function emit(event, data) {
    const subscribers = eventSubscribers.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Create overlay element
   * @param {Object} options
   * @returns {HTMLElement}
   * @private
   */
  function createOverlay(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = CONFIG.CLASSES.OVERLAY;

    if (!options.persistent) {
      overlay.style.cursor = 'pointer';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          const modalId = overlay.dataset.modalId;
          if (modalId) {
            closeModal(modalId);
          }
        }
      });
    }

    // Animation
    overlay.style.opacity = '0';
    overlay.style.transition = `opacity ${CONFIG.ANIMATION.FADE_IN}ms ease-out`;

    // Force reflow before animation
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    return overlay;
  }

  /**
   * Create modal container
   * @param {Object} config
   * @returns {HTMLElement}
   * @private
   */
  function createModalContainer(config) {
    const modal = document.createElement('div');
    modal.className = CONFIG.CLASSES.MODAL;

    // Size
    const size = config.size || 'medium';
    modal.style.maxWidth = CONFIG.SIZES[size.toUpperCase()] || CONFIG.SIZES.MEDIUM;

    // Animation
    modal.style.opacity = '0';
    modal.style.transform = 'translateY(20px) scale(0.95)';
    modal.style.transition = `all ${CONFIG.ANIMATION.SLIDE_UP}ms cubic-bezier(0.4, 0, 0.2, 1)`;

    // Trigger animation
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'translateY(0) scale(1)';
    });

    return modal;
  }

  /**
   * Create modal header
   * @param {Object} config
   * @returns {HTMLElement}
   * @private
   */
  function createHeader(config) {
    const header = document.createElement('div');
    header.className = CONFIG.CLASSES.HEADER;

    // Icon
    if (config.icon) {
      const icon = document.createElement('i');
      icon.className = `fas ${config.icon}`;
      if (config.iconColor) {
        icon.style.color = config.iconColor;
      }
      header.appendChild(icon);
    }

    // Title
    const title = document.createElement('span');
    title.textContent = config.title || '';
    header.appendChild(title);

    // Close button
    if (!config.persistent) {
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '<i class="fas fa-times"></i>';
      closeBtn.style.cssText = `
        margin-right: auto;
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        transition: all 0.2s;
      `;
      closeBtn.addEventListener('mouseover', () => {
        closeBtn.style.background = '#f1f5f9';
      });
      closeBtn.addEventListener('mouseout', () => {
        closeBtn.style.background = 'none';
      });
      closeBtn.addEventListener('click', () => {
        const modalId = header.closest('[data-modal-id]')?.dataset.modalId;
        if (modalId) closeModal(modalId);
      });
      header.appendChild(closeBtn);
    }

    return header;
  }

  /**
   * Create modal content area
   * @param {string|HTMLElement} content
   * @returns {HTMLElement}
   * @private
   */
  function createContent(content) {
    const contentDiv = document.createElement('div');
    contentDiv.className = CONFIG.CLASSES.CONTENT;

    if (typeof content === 'string') {
      contentDiv.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentDiv.appendChild(content);
    }

    return contentDiv;
  }

  /**
   * Create modal buttons
   * @param {Array<Object>} buttons
   * @returns {HTMLElement}
   * @private
   */
  function createButtons(buttons) {
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = CONFIG.CLASSES.BUTTONS;

    buttons.forEach((btnConfig) => {
      const btn = document.createElement('button');
      btn.className = `${CONFIG.CLASSES.BTN} ${btnConfig.className || ''}`;
      btn.textContent = btnConfig.text;

      if (btnConfig.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${btnConfig.icon}`;
        btn.prepend(icon);
      }

      btn.addEventListener('click', () => {
        if (btnConfig.onClick) {
          btnConfig.onClick();
        }
      });

      buttonsDiv.appendChild(btn);
    });

    return buttonsDiv;
  }

  /**
   * Close modal with animation
   * @param {string} modalId
   * @param {*} result
   * @private
   */
  function closeModal(modalId, result = null) {
    const modalData = activeModals.get(modalId);
    if (!modalData) return;

    const { element, config, resolve } = modalData;

    // Animate out
    const modal = element.querySelector(`.${CONFIG.CLASSES.MODAL}`);
    if (modal) {
      modal.style.opacity = '0';
      modal.style.transform = 'translateY(20px) scale(0.95)';
    }
    element.style.opacity = '0';

    // Remove after animation
    setTimeout(() => {
      element.remove();
      activeModals.delete(modalId);

      // Restore body scroll if no more modals
      if (activeModals.size === 0) {
        document.body.style.overflow = '';
      }

      // Emit close event
      emit('close', { modalId, result });

      // Resolve promise
      if (resolve) {
        resolve(result);
      }

      // Call onClose callback
      if (config.onClose) {
        config.onClose(result);
      }
    }, CONFIG.ANIMATION.FADE_OUT);
  }

  /**
   * Handle Escape key
   * @param {KeyboardEvent} event
   * @private
   */
  function handleEscape(event) {
    if (event.key === 'Escape' && activeModals.size > 0) {
      // Close the most recent modal
      const lastModalId = Array.from(activeModals.keys()).pop();
      const modalData = activeModals.get(lastModalId);

      if (modalData && !modalData.config.persistent) {
        closeModal(lastModalId, null);
      }
    }
  }

  // Setup global escape handler
  document.addEventListener('keydown', handleEscape);

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - CORE MODALS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Show alert modal
   * @param {Object|string} config - Configuration or message string
   * @returns {Promise<void>}
   * @public
   */
  function showAlert(config) {
    // Normalize config
    if (typeof config === 'string') {
      config = { message: config };
    }

    const {
      title = 'התראה',
      message = '',
      type = 'info',
      icon = CONFIG.ICONS[type.toUpperCase()] || CONFIG.ICONS.INFO,
      iconColor = CONFIG.COLORS[type.toUpperCase()] || CONFIG.COLORS.INFO,
      buttonText = 'אישור',
      onClose,
    } = config;

    return new Promise((resolve) => {
      const modalId = generateId();
      const overlay = createOverlay({ persistent: false });
      overlay.dataset.modalId = modalId;

      const modal = createModalContainer({ size: 'small' });
      modal.dataset.modalId = modalId;

      // Header
      const header = createHeader({ title, icon, iconColor, persistent: false });

      // Content
      const content = createContent(`
        <div style="text-align: center; padding: 20px 10px;">
          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0;">
            ${sanitizeHTML(message)}
          </p>
        </div>
      `);

      // Buttons
      const buttons = createButtons([
        {
          text: buttonText,
          className: CONFIG.CLASSES.BTN_PRIMARY,
          icon: 'fa-check',
          onClick: () => {
            closeModal(modalId, true);
          },
        },
      ]);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(content);
      modal.appendChild(buttons);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Disable body scroll
      document.body.style.overflow = 'hidden';

      // Register modal
      activeModals.set(modalId, {
        element: overlay,
        config: { ...config, onClose },
        resolve,
      });

      // Emit open event
      emit('open', { modalId, type: 'alert', config });
    });
  }

  /**
   * Show confirmation dialog
   * @param {Object|string} config - Configuration or message string
   * @returns {Promise<boolean>}
   * @public
   */
  function showConfirm(config) {
    // Normalize config
    if (typeof config === 'string') {
      config = { message: config };
    }

    const {
      title = 'אישור פעולה',
      message = '',
      confirmText = 'אישור',
      cancelText = 'ביטול',
      variant = 'primary',
      icon = CONFIG.ICONS.QUESTION,
      iconColor = CONFIG.COLORS.PRIMARY,
      onConfirm,
      onCancel,
    } = config;

    return new Promise((resolve) => {
      const modalId = generateId();
      const overlay = createOverlay({ persistent: false });
      overlay.dataset.modalId = modalId;

      const modal = createModalContainer({ size: 'small' });
      modal.dataset.modalId = modalId;

      // Header
      const header = createHeader({ title, icon, iconColor, persistent: false });

      // Content
      const content = createContent(`
        <div style="text-align: center; padding: 20px 10px;">
          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0;">
            ${sanitizeHTML(message)}
          </p>
        </div>
      `);

      // Buttons
      const btnClass = variant === 'danger' ? CONFIG.CLASSES.BTN_DANGER : CONFIG.CLASSES.BTN_PRIMARY;

      const buttons = createButtons([
        {
          text: confirmText,
          className: btnClass,
          icon: 'fa-check',
          onClick: () => {
            if (onConfirm) onConfirm();
            closeModal(modalId, true);
          },
        },
        {
          text: cancelText,
          className: CONFIG.CLASSES.BTN_SECONDARY,
          icon: 'fa-times',
          onClick: () => {
            if (onCancel) onCancel();
            closeModal(modalId, false);
          },
        },
      ]);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(content);
      modal.appendChild(buttons);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Disable body scroll
      document.body.style.overflow = 'hidden';

      // Register modal
      activeModals.set(modalId, {
        element: overlay,
        config,
        resolve,
      });

      // Emit open event
      emit('open', { modalId, type: 'confirm', config });
    });
  }

  /**
   * Show loading overlay
   * @param {string} message - Loading message
   * @returns {string} loadingId - Use to hide later
   * @public
   */
  function showLoading(message = 'טוען...') {
    // Check if in welcome screen
    if (global.isInWelcomeScreen) {
      return null;
    }

    const loadingId = generateId();
    const existing = document.getElementById('simple-loading');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'simple-loading';
    overlay.dataset.loadingId = loadingId;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: ${CONFIG.ZINDEX.LOADING};
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity ${CONFIG.ANIMATION.FADE_IN}ms ease-out;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; background: white; color: #333; padding: 30px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1.5s linear infinite; margin: 0 auto 20px;"></div>
        <div style="font-size: 16px; font-weight: 500;">${sanitizeHTML(message)}</div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    loadingCounter++;

    return loadingId;
  }

  /**
   * Hide loading overlay
   * @param {string} [loadingId] - Specific loading ID to hide
   * @public
   */
  function hideLoading(loadingId) {
    const overlay = document.getElementById('simple-loading');
    if (overlay) {
      // Check if this is the right loading instance
      if (loadingId && overlay.dataset.loadingId !== loadingId) {
        return;
      }

      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        loadingCounter = Math.max(0, loadingCounter - 1);

        // Only restore scroll if no more loading overlays
        if (loadingCounter === 0) {
          document.body.style.overflow = '';
        }
      }, CONFIG.ANIMATION.FADE_OUT);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - EVENT SYSTEM
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to modal events
   * @param {string} event - Event name ('open', 'close', 'submit')
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   * @public
   */
  function on(event, callback) {
    if (!eventSubscribers.has(event)) {
      eventSubscribers.set(event, new Set());
    }
    eventSubscribers.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      eventSubscribers.get(event)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from event
   * @param {string} event
   * @param {Function} callback
   * @public
   */
  function off(event, callback) {
    eventSubscribers.get(event)?.delete(callback);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get currently active modals
   * @returns {Array<Object>}
   * @public
   */
  function getActiveModals() {
    return Array.from(activeModals.entries()).map(([id, data]) => ({
      id,
      type: data.config.type || 'unknown',
      config: data.config,
    }));
  }

  /**
   * Close all modals
   * @public
   */
  function closeAll() {
    const modalIds = Array.from(activeModals.keys());
    modalIds.forEach((id) => closeModal(id, null));
  }

  /**
   * Check if any modal is open
   * @returns {boolean}
   * @public
   */
  function isAnyModalOpen() {
    return activeModals.size > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE EXPORTS
  // ═══════════════════════════════════════════════════════════════════════

  const ModalsManager = {
    // Core modals
    showAlert,
    showConfirm,
    showLoading,
    hideLoading,

    // Event system
    on,
    off,

    // State management
    getActiveModals,
    closeAll,
    isAnyModalOpen,

    // Version
    VERSION: '1.0.0',
  };

  // Expose to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalsManager;
  } else {
    global.ModalsManager = ModalsManager;
  }

  Logger.log('✅ ModalsManager v1.0.0 loaded');

})(typeof window !== 'undefined' ? window : global);
