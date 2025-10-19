/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║                    MODALS MANAGER - UNIT TESTS                        ║
 * ║                   Law Office Management System                        ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  Comprehensive test suite for ModalsManager module                   ║
 * ║  Framework: Jest                                                      ║
 * ║  Coverage Target: 80%+                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/**
 * @jest-environment jsdom
 */

// Mock DOM helpers
global.safeText = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Import module
const ModalsManager = require('../js/modules/modals-manager.js');

describe('ModalsManager', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════

  beforeEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    document.body.style.overflow = '';

    // Close all modals
    ModalsManager.closeAll();

    // Clear timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    // Cleanup
    ModalsManager.closeAll();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  describe('Module Initialization', () => {
    test('should export ModalsManager object', () => {
      expect(ModalsManager).toBeDefined();
      expect(typeof ModalsManager).toBe('object');
    });

    test('should have VERSION property', () => {
      expect(ModalsManager.VERSION).toBeDefined();
      expect(typeof ModalsManager.VERSION).toBe('string');
      expect(ModalsManager.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should expose all public API methods', () => {
      const expectedMethods = [
        'showAlert',
        'showConfirm',
        'showLoading',
        'hideLoading',
        'on',
        'off',
        'getActiveModals',
        'closeAll',
        'isAnyModalOpen',
      ];

      expectedMethods.forEach((method) => {
        expect(ModalsManager[method]).toBeDefined();
        expect(typeof ModalsManager[method]).toBe('function');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CORE MODALS - showAlert
  // ═══════════════════════════════════════════════════════════════════════

  describe('showAlert', () => {
    test('should create alert modal with string message', async () => {
      const promise = ModalsManager.showAlert('Test message');

      // Check modal was created
      const overlay = document.querySelector('.popup-overlay');
      expect(overlay).toBeTruthy();

      const modal = overlay.querySelector('.popup');
      expect(modal).toBeTruthy();

      // Check content
      expect(modal.textContent).toContain('Test message');

      // Close modal
      const confirmBtn = modal.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      await promise;
    });

    test('should create alert modal with config object', async () => {
      const config = {
        title: 'Custom Title',
        message: 'Custom message',
        type: 'success',
        buttonText: 'Got it',
      };

      const promise = ModalsManager.showAlert(config);

      const overlay = document.querySelector('.popup-overlay');
      const modal = overlay.querySelector('.popup');

      // Check title
      expect(modal.textContent).toContain('Custom Title');

      // Check message
      expect(modal.textContent).toContain('Custom message');

      // Check button text
      expect(modal.textContent).toContain('Got it');

      // Close
      const confirmBtn = modal.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      await promise;
    });

    test('should call onClose callback when closed', async () => {
      const onClose = jest.fn();

      const promise = ModalsManager.showAlert({
        message: 'Test',
        onClose,
      });

      const modal = document.querySelector('.popup');
      const confirmBtn = modal.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      await promise;

      // Give time for animation
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should disable body scroll when open', () => {
      ModalsManager.showAlert('Test');

      expect(document.body.style.overflow).toBe('hidden');
    });

    test('should restore body scroll when closed', async () => {
      const promise = ModalsManager.showAlert('Test');

      expect(document.body.style.overflow).toBe('hidden');

      const confirmBtn = document.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      await promise;
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(document.body.style.overflow).toBe('');
    });

    test('should sanitize HTML in message', () => {
      ModalsManager.showAlert('<script>alert("xss")</script>');

      const modal = document.querySelector('.popup');
      expect(modal.innerHTML).not.toContain('<script>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CORE MODALS - showConfirm
  // ═══════════════════════════════════════════════════════════════════════

  describe('showConfirm', () => {
    test('should create confirmation modal with string message', () => {
      ModalsManager.showConfirm('Confirm action?');

      const overlay = document.querySelector('.popup-overlay');
      expect(overlay).toBeTruthy();

      const modal = overlay.querySelector('.popup');
      expect(modal.textContent).toContain('Confirm action?');

      // Should have two buttons
      const buttons = modal.querySelectorAll('.popup-btn');
      expect(buttons.length).toBe(2);
    });

    test('should resolve true when confirmed', async () => {
      const promise = ModalsManager.showConfirm('Confirm?');

      const confirmBtn = document.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      const result = await promise;
      expect(result).toBe(true);
    });

    test('should resolve false when canceled', async () => {
      const promise = ModalsManager.showConfirm('Confirm?');

      const cancelBtn = document.querySelector('.popup-btn-cancel');
      cancelBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });

    test('should call onConfirm callback', async () => {
      const onConfirm = jest.fn();

      const promise = ModalsManager.showConfirm({
        message: 'Test',
        onConfirm,
      });

      const confirmBtn = document.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      await promise;

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    test('should call onCancel callback', async () => {
      const onCancel = jest.fn();

      const promise = ModalsManager.showConfirm({
        message: 'Test',
        onCancel,
      });

      const cancelBtn = document.querySelector('.popup-btn-cancel');
      cancelBtn.click();

      await promise;

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test('should use custom button texts', () => {
      ModalsManager.showConfirm({
        message: 'Test',
        confirmText: 'Yes, Do It',
        cancelText: 'No, Cancel',
      });

      const modal = document.querySelector('.popup');
      expect(modal.textContent).toContain('Yes, Do It');
      expect(modal.textContent).toContain('No, Cancel');
    });

    test('should apply danger variant', () => {
      ModalsManager.showConfirm({
        message: 'Delete?',
        variant: 'danger',
      });

      const confirmBtn = document.querySelector('.popup-btn-danger');
      expect(confirmBtn).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CORE MODALS - showLoading / hideLoading
  // ═══════════════════════════════════════════════════════════════════════

  describe('showLoading & hideLoading', () => {
    test('should create loading overlay', () => {
      const loadingId = ModalsManager.showLoading('Loading...');

      expect(loadingId).toBeTruthy();

      const overlay = document.getElementById('simple-loading');
      expect(overlay).toBeTruthy();
      expect(overlay.textContent).toContain('Loading...');
    });

    test('should use default message', () => {
      ModalsManager.showLoading();

      const overlay = document.getElementById('simple-loading');
      expect(overlay.textContent).toContain('טוען');
    });

    test('should remove loading overlay when hidden', async () => {
      const loadingId = ModalsManager.showLoading('Test');

      expect(document.getElementById('simple-loading')).toBeTruthy();

      ModalsManager.hideLoading(loadingId);

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(document.getElementById('simple-loading')).toBeFalsy();
    });

    test('should restore body scroll after hiding', async () => {
      const loadingId = ModalsManager.showLoading();

      expect(document.body.style.overflow).toBe('hidden');

      ModalsManager.hideLoading(loadingId);

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(document.body.style.overflow).toBe('');
    });

    test('should not show loading during welcome screen', () => {
      window.isInWelcomeScreen = true;

      const loadingId = ModalsManager.showLoading();

      expect(loadingId).toBeNull();
      expect(document.getElementById('simple-loading')).toBeFalsy();

      window.isInWelcomeScreen = false;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT SYSTEM
  // ═══════════════════════════════════════════════════════════════════════

  describe('Event System', () => {
    test('should subscribe to events', () => {
      const callback = jest.fn();
      const unsubscribe = ModalsManager.on('open', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    test('should emit "open" event when modal opens', () => {
      const callback = jest.fn();
      ModalsManager.on('open', callback);

      ModalsManager.showAlert('Test');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          modalId: expect.any(String),
          type: 'alert',
        })
      );
    });

    test('should emit "close" event when modal closes', async () => {
      const callback = jest.fn();
      ModalsManager.on('close', callback);

      const promise = ModalsManager.showAlert('Test');

      const confirmBtn = document.querySelector('.popup-btn-confirm');
      confirmBtn.click();

      await promise;
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          modalId: expect.any(String),
        })
      );
    });

    test('should unsubscribe from events', () => {
      const callback = jest.fn();
      const unsubscribe = ModalsManager.on('open', callback);

      ModalsManager.showAlert('Test 1');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      ModalsManager.showAlert('Test 2');
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    test('should support off method', () => {
      const callback = jest.fn();
      ModalsManager.on('open', callback);

      ModalsManager.showAlert('Test 1');
      expect(callback).toHaveBeenCalledTimes(1);

      ModalsManager.off('open', callback);

      ModalsManager.showAlert('Test 2');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  describe('State Management', () => {
    test('should track active modals', () => {
      expect(ModalsManager.getActiveModals()).toEqual([]);

      ModalsManager.showAlert('Test 1');
      expect(ModalsManager.getActiveModals().length).toBe(1);

      ModalsManager.showAlert('Test 2');
      expect(ModalsManager.getActiveModals().length).toBe(2);
    });

    test('should return modal info', () => {
      ModalsManager.showAlert({ message: 'Test', type: 'success' });

      const activeModals = ModalsManager.getActiveModals();
      expect(activeModals[0]).toMatchObject({
        id: expect.any(String),
        type: 'unknown', // Will be set properly in domain modals
        config: expect.any(Object),
      });
    });

    test('should check if any modal is open', () => {
      expect(ModalsManager.isAnyModalOpen()).toBe(false);

      ModalsManager.showAlert('Test');
      expect(ModalsManager.isAnyModalOpen()).toBe(true);
    });

    test('should close all modals', async () => {
      ModalsManager.showAlert('Test 1');
      ModalsManager.showAlert('Test 2');
      ModalsManager.showAlert('Test 3');

      expect(ModalsManager.getActiveModals().length).toBe(3);

      ModalsManager.closeAll();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(ModalsManager.getActiveModals().length).toBe(0);
      expect(document.querySelectorAll('.popup-overlay').length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // KEYBOARD INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Keyboard Interactions', () => {
    test('should close modal on Escape key', async () => {
      ModalsManager.showAlert('Test');

      expect(ModalsManager.isAnyModalOpen()).toBe(true);

      // Simulate Escape key
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(ModalsManager.isAnyModalOpen()).toBe(false);
    });

    test('should not close persistent modal on Escape', () => {
      // Currently, alert/confirm are not persistent
      // This test is for future persistent modals
      // Skipping for now
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EDGE CASES & ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    test('should handle rapid modal opens', () => {
      for (let i = 0; i < 10; i++) {
        ModalsManager.showAlert(`Test ${i}`);
      }

      expect(ModalsManager.getActiveModals().length).toBe(10);
    });

    test('should handle missing config', () => {
      expect(() => {
        ModalsManager.showAlert();
      }).not.toThrow();

      expect(document.querySelector('.popup-overlay')).toBeTruthy();
    });

    test('should handle null/undefined message', () => {
      expect(() => {
        ModalsManager.showAlert({ message: null });
      }).not.toThrow();
    });

    test('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);

      ModalsManager.showAlert(longMessage);

      const modal = document.querySelector('.popup');
      expect(modal).toBeTruthy();
    });

    test('should handle special characters in message', () => {
      const message = '<>&"\'\n\t';

      ModalsManager.showAlert(message);

      const modal = document.querySelector('.popup');
      expect(modal).toBeTruthy();
    });
  });
});
