/**
 * TypeScript type definitions for ModalsManager
 * @module modals-manager
 * @version 1.0.0
 */

declare module 'modals-manager' {
  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION TYPES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Modal alert types
   */
  export type AlertType = 'info' | 'success' | 'warning' | 'error';

  /**
   * Modal sizes
   */
  export type ModalSize = 'small' | 'medium' | 'large' | 'xlarge';

  /**
   * Button variants
   */
  export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'info';

  // ═══════════════════════════════════════════════════════════════════════
  // ALERT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  export interface AlertConfig {
    /**
     * Modal title
     */
    title?: string;

    /**
     * Alert message (supports HTML)
     */
    message: string;

    /**
     * Alert type (affects icon and color)
     * @default 'info'
     */
    type?: AlertType;

    /**
     * Custom Font Awesome icon class
     * @example 'fa-check-circle'
     */
    icon?: string;

    /**
     * Icon color (CSS color value)
     * @example '#10b981'
     */
    iconColor?: string;

    /**
     * Button text
     * @default 'אישור'
     */
    buttonText?: string;

    /**
     * Callback when modal closes
     */
    onClose?: () => void;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIRM CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  export interface ConfirmConfig {
    /**
     * Modal title
     * @default 'אישור פעולה'
     */
    title?: string;

    /**
     * Confirmation message (supports HTML)
     */
    message: string;

    /**
     * Confirm button text
     * @default 'אישור'
     */
    confirmText?: string;

    /**
     * Cancel button text
     * @default 'ביטול'
     */
    cancelText?: string;

    /**
     * Button style variant
     * @default 'primary'
     */
    variant?: 'primary' | 'danger';

    /**
     * Custom icon
     */
    icon?: string;

    /**
     * Icon color
     */
    iconColor?: string;

    /**
     * Callback when user confirms
     */
    onConfirm?: () => void;

    /**
     * Callback when user cancels
     */
    onCancel?: () => void;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT SYSTEM TYPES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Modal event types
   */
  export type ModalEvent = 'open' | 'close' | 'submit';

  /**
   * Event data for 'open' event
   */
  export interface ModalOpenEventData {
    modalId: string;
    type: string;
    config: any;
  }

  /**
   * Event data for 'close' event
   */
  export interface ModalCloseEventData {
    modalId: string;
    result: any;
  }

  /**
   * Event data for 'submit' event
   */
  export interface ModalSubmitEventData {
    modalId: string;
    data: any;
  }

  /**
   * Event listener callback
   */
  export type EventCallback<T = any> = (data: T) => void;

  /**
   * Unsubscribe function
   */
  export type UnsubscribeFunction = () => void;

  // ═══════════════════════════════════════════════════════════════════════
  // MODAL INSTANCE TYPES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Active modal information
   */
  export interface ActiveModalInfo {
    id: string;
    type: string;
    config: any;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN MODULE INTERFACE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * ModalsManager - Centralized modal management system
   */
  export interface ModalsManager {
    /**
     * Module version
     */
    readonly VERSION: string;

    // ─────────────────────────────────────────────────────────────────────
    // CORE MODALS
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Show alert modal
     *
     * @param config - Alert configuration or message string
     * @returns Promise that resolves when modal is closed
     *
     * @example
     * // Simple alert
     * await ModalsManager.showAlert('Operation completed!');
     *
     * @example
     * // Configured alert
     * await ModalsManager.showAlert({
     *   title: 'Success',
     *   message: 'Data saved successfully',
     *   type: 'success',
     *   onClose: () => console.log('Alert closed')
     * });
     */
    showAlert(config: AlertConfig | string): Promise<void>;

    /**
     * Show confirmation dialog
     *
     * @param config - Confirmation configuration or message string
     * @returns Promise that resolves to true if confirmed, false if canceled
     *
     * @example
     * // Simple confirm
     * const result = await ModalsManager.showConfirm('Delete this item?');
     * if (result) {
     *   deleteItem();
     * }
     *
     * @example
     * // Configured confirm
     * const result = await ModalsManager.showConfirm({
     *   title: 'Confirm Deletion',
     *   message: 'Are you sure you want to delete this?',
     *   variant: 'danger',
     *   confirmText: 'Yes, Delete',
     *   cancelText: 'No, Keep It',
     *   onConfirm: () => console.log('Confirmed'),
     *   onCancel: () => console.log('Canceled')
     * });
     */
    showConfirm(config: ConfirmConfig | string): Promise<boolean>;

    /**
     * Show loading overlay
     *
     * @param message - Loading message
     * @returns Loading ID (use to hide later)
     *
     * @example
     * const loadingId = ModalsManager.showLoading('Saving data...');
     * await saveData();
     * ModalsManager.hideLoading(loadingId);
     */
    showLoading(message?: string): string | null;

    /**
     * Hide loading overlay
     *
     * @param loadingId - Optional specific loading ID to hide
     *
     * @example
     * ModalsManager.hideLoading(); // Hide any loading
     * ModalsManager.hideLoading(loadingId); // Hide specific loading
     */
    hideLoading(loadingId?: string): void;

    // ─────────────────────────────────────────────────────────────────────
    // EVENT SYSTEM
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Subscribe to modal events
     *
     * @param event - Event name
     * @param callback - Callback function
     * @returns Unsubscribe function
     *
     * @example
     * const unsubscribe = ModalsManager.on('open', (data) => {
     *   console.log('Modal opened:', data.modalId);
     * });
     *
     * // Later...
     * unsubscribe();
     */
    on(event: 'open', callback: EventCallback<ModalOpenEventData>): UnsubscribeFunction;
    on(event: 'close', callback: EventCallback<ModalCloseEventData>): UnsubscribeFunction;
    on(event: 'submit', callback: EventCallback<ModalSubmitEventData>): UnsubscribeFunction;
    on(event: ModalEvent, callback: EventCallback): UnsubscribeFunction;

    /**
     * Unsubscribe from event
     *
     * @param event - Event name
     * @param callback - Callback function to remove
     *
     * @example
     * ModalsManager.off('open', myCallback);
     */
    off(event: ModalEvent, callback: EventCallback): void;

    // ─────────────────────────────────────────────────────────────────────
    // STATE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Get currently active modals
     *
     * @returns Array of active modal information
     *
     * @example
     * const activeModals = ModalsManager.getActiveModals();
     * console.log(`${activeModals.length} modals open`);
     */
    getActiveModals(): ActiveModalInfo[];

    /**
     * Close all modals
     *
     * @example
     * ModalsManager.closeAll();
     */
    closeAll(): void;

    /**
     * Check if any modal is currently open
     *
     * @returns true if at least one modal is open
     *
     * @example
     * if (ModalsManager.isAnyModalOpen()) {
     *   console.log('A modal is open');
     * }
     */
    isAnyModalOpen(): boolean;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DEFAULT EXPORT
  // ═══════════════════════════════════════════════════════════════════════

  const ModalsManager: ModalsManager;
  export default ModalsManager;
}

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL DECLARATION (for non-module usage)
// ═══════════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    ModalsManager: import('modals-manager').ModalsManager;
  }

  const ModalsManager: import('modals-manager').ModalsManager;
}
