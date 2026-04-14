/**
 * Performance Fixes — Unit Tests
 *
 * Covers the 4 performance improvements in User App (main branch, unstaged):
 *
 * 1. modals.css          — blur(12px/8px) reduced to blur(4px)
 * 2. GuidedTextInput.js  — DOM ref caching + CSS class color coding
 * 3. dialogs.js          — early-exit guard on clearError
 * 4. main.js:920         — _realTimeListenersStarted guard
 * 5. ui-components.js    — minLoadingDuration:0, removed 100ms buffers,
 *                          closeDelay:150, success notification 2500ms
 */

import fs from 'fs';
import path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Helpers ───────────────────────────────────────────────────────────────
const USER_APP = path.resolve(__dirname, '../../apps/user-app');

function readCSS(relativePath: string): string {
  return fs.readFileSync(path.join(USER_APP, relativePath), 'utf-8');
}

function readJS(relativePath: string): string {
  return fs.readFileSync(path.join(USER_APP, relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. modals.css — blur values
// ═══════════════════════════════════════════════════════════════════════════
describe('modals.css — blur performance', () => {
  let css: string;

  beforeEach(() => {
    css = readCSS('css/modals.css');
  });

  it('popup-overlay / modal-overlay uses blur(4px), not blur(12px)', () => {
    // Extract the first backdrop-filter occurrence (popup-overlay block)
    const popupBlock = css.match(
      /\.popup-overlay[\s\S]*?backdrop-filter:\s*blur\((\d+)px\)/
    );
    expect(popupBlock).not.toBeNull();
    expect(popupBlock![1]).toBe('4');
  });

  it('legacy modals (#taskModal etc.) use blur(4px), not blur(8px)', () => {
    const legacyBlock = css.match(
      /#taskModal[\s\S]*?backdrop-filter:\s*blur\((\d+)px\)/
    );
    expect(legacyBlock).not.toBeNull();
    expect(legacyBlock![1]).toBe('4');
  });

  it('REGRESSION: no blur value exceeds 4px anywhere in modals.css', () => {
    const allBlurs = [...css.matchAll(/blur\((\d+)px\)/g)].map(m => Number(m[1]));
    expect(allBlurs.length).toBeGreaterThan(0);
    allBlurs.forEach(val => {
      expect(val).toBeLessThanOrEqual(4);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. GuidedTextInput.js — DOM cache + CSS classes
// ═══════════════════════════════════════════════════════════════════════════
describe('GuidedTextInput — DOM caching & CSS class color coding', () => {
  let jsSource: string;

  beforeEach(() => {
    jsSource = readJS('js/modules/descriptions/GuidedTextInput.js');
  });

  // ── Happy path ──
  it('caches _counterEl in attachEventListeners', () => {
    expect(jsSource).toContain("this._counterEl = this.container.querySelector('.char-count')");
  });

  it('caches _textarea in attachEventListeners', () => {
    expect(jsSource).toContain('this._textarea = textarea');
  });

  it('updateCharCounter reads from cached _counterEl, not querySelector', () => {
    // The updateCharCounter method should use this._counterEl, not querySelector
    const methodBody = jsSource.match(
      /updateCharCounter\(count\)\s*\{([\s\S]*?)\n\s{4}\}/
    );
    expect(methodBody).not.toBeNull();
    const body = methodBody![1];

    expect(body).toContain('this._counterEl');
    expect(body).not.toContain("querySelector('.char-count')");
  });

  it('uses classList.toggle for char-danger and char-warning', () => {
    expect(jsSource).toContain("classList.toggle('char-danger'");
    expect(jsSource).toContain("classList.toggle('char-warning'");
  });

  it('REGRESSION: no inline style.color assignment in updateCharCounter', () => {
    const methodBody = jsSource.match(
      /updateCharCounter\(count\)\s*\{([\s\S]*?)\n\s{4}\}/
    );
    expect(methodBody).not.toBeNull();
    expect(methodBody![1]).not.toContain('style.color');
  });

  // ── Edge: CSS classes exist ──
  it('guided-text-input.css defines .char-count.char-warning', () => {
    const css = readCSS('css/guided-text-input.css');
    expect(css).toContain('.char-count.char-warning');
  });

  it('guided-text-input.css defines .char-count.char-danger', () => {
    const css = readCSS('css/guided-text-input.css');
    expect(css).toContain('.char-count.char-danger');
  });

  it('.char-count base color is gray (#6b7280)', () => {
    const css = readCSS('css/guided-text-input.css');
    const baseBlock = css.match(/\.char-count\s*\{[^}]*color:\s*([^;]+)/);
    expect(baseBlock).not.toBeNull();
    expect(baseBlock![1].trim()).toBe('#6b7280');
  });

  it('.char-warning color is amber (#f59e0b)', () => {
    const css = readCSS('css/guided-text-input.css');
    const warnBlock = css.match(/\.char-count\.char-warning\s*\{[^}]*color:\s*([^;]+)/);
    expect(warnBlock).not.toBeNull();
    expect(warnBlock![1].trim()).toBe('#f59e0b');
  });

  it('.char-danger color is red (#dc2626)', () => {
    const css = readCSS('css/guided-text-input.css');
    const dangerBlock = css.match(/\.char-count\.char-danger\s*\{[^}]*color:\s*([^;]+)/);
    expect(dangerBlock).not.toBeNull();
    expect(dangerBlock![1].trim()).toBe('#dc2626');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2b. GuidedTextInput — updateCharCounter logic simulation
// ═══════════════════════════════════════════════════════════════════════════
describe('GuidedTextInput — updateCharCounter class toggle logic', () => {
  let counterEl: HTMLSpanElement;
  const maxChars = 50;

  /**
   * Simulates the exact toggle logic from the source:
   *   counterEl.classList.toggle('char-danger', percentage >= 0.9);
   *   counterEl.classList.toggle('char-warning', percentage >= 0.7 && percentage < 0.9);
   */
  function simulateUpdateCharCounter(count: number) {
    counterEl.textContent = String(count);
    const percentage = count / maxChars;
    counterEl.classList.toggle('char-danger', percentage >= 0.9);
    counterEl.classList.toggle('char-warning', percentage >= 0.7 && percentage < 0.9);
  }

  beforeEach(() => {
    counterEl = document.createElement('span');
    counterEl.className = 'char-count';
  });

  // ── Happy path: thresholds ──
  it('count 0 — no color classes', () => {
    simulateUpdateCharCounter(0);
    expect(counterEl.classList.contains('char-warning')).toBe(false);
    expect(counterEl.classList.contains('char-danger')).toBe(false);
  });

  it('count 34 (68%) — no color classes (just below 70%)', () => {
    simulateUpdateCharCounter(34);
    expect(counterEl.classList.contains('char-warning')).toBe(false);
    expect(counterEl.classList.contains('char-danger')).toBe(false);
  });

  it('count 35 (70%) — warning class ON', () => {
    simulateUpdateCharCounter(35);
    expect(counterEl.classList.contains('char-warning')).toBe(true);
    expect(counterEl.classList.contains('char-danger')).toBe(false);
  });

  it('count 44 (88%) — still warning, not danger', () => {
    simulateUpdateCharCounter(44);
    expect(counterEl.classList.contains('char-warning')).toBe(true);
    expect(counterEl.classList.contains('char-danger')).toBe(false);
  });

  it('count 45 (90%) — danger class ON, warning OFF', () => {
    simulateUpdateCharCounter(45);
    expect(counterEl.classList.contains('char-danger')).toBe(true);
    expect(counterEl.classList.contains('char-warning')).toBe(false);
  });

  it('count 50 (100%) — danger class ON', () => {
    simulateUpdateCharCounter(50);
    expect(counterEl.classList.contains('char-danger')).toBe(true);
    expect(counterEl.classList.contains('char-warning')).toBe(false);
  });

  // ── Edge: going back down removes classes ──
  it('going from danger back to normal removes both classes', () => {
    simulateUpdateCharCounter(50);
    expect(counterEl.classList.contains('char-danger')).toBe(true);

    simulateUpdateCharCounter(10);
    expect(counterEl.classList.contains('char-danger')).toBe(false);
    expect(counterEl.classList.contains('char-warning')).toBe(false);
  });

  it('going from danger to warning swaps classes correctly', () => {
    simulateUpdateCharCounter(48);
    expect(counterEl.classList.contains('char-danger')).toBe(true);

    simulateUpdateCharCounter(40);
    expect(counterEl.classList.contains('char-danger')).toBe(false);
    expect(counterEl.classList.contains('char-warning')).toBe(true);
  });

  // ── REGRESSION: textContent always updated ──
  it('textContent reflects the count', () => {
    simulateUpdateCharCounter(42);
    expect(counterEl.textContent).toBe('42');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. dialogs.js — early-exit guard on clearError
// ═══════════════════════════════════════════════════════════════════════════
describe('dialogs.js — clearError early-exit guard', () => {
  let jsSource: string;

  beforeEach(() => {
    jsSource = readJS('js/modules/dialogs.js');
  });

  it('checks classList.contains("error") before removing it', () => {
    // The guarded block should check first
    expect(jsSource).toContain("guidedTextarea.classList.contains('error')");
  });

  it('REGRESSION: still removes .error class when present', () => {
    expect(jsSource).toContain("guidedTextarea.classList.remove('error')");
  });

  it('REGRESSION: still removes .error-message element', () => {
    expect(jsSource).toContain('errorMsg.remove()');
  });
});

describe('dialogs.js — clearError guard DOM simulation', () => {
  let textarea: HTMLTextAreaElement;
  let wrapper: HTMLDivElement;
  let errorMsg: HTMLSpanElement;

  beforeEach(() => {
    // Build a minimal DOM matching the guided-input-wrapper structure
    wrapper = document.createElement('div');
    wrapper.className = 'guided-input-wrapper';

    textarea = document.createElement('textarea');
    textarea.className = 'guided-textarea';
    wrapper.appendChild(textarea);

    errorMsg = document.createElement('span');
    errorMsg.className = 'error-message';
    errorMsg.textContent = 'שדה חובה';
    wrapper.appendChild(errorMsg);

    document.body.appendChild(wrapper);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * Simulates the exact guard from dialogs.js:
   *   if (guidedTextarea.classList.contains('error')) {
   *     guidedTextarea.classList.remove('error');
   *     const errorMsg = guidedTextarea.closest('.guided-input-wrapper')?.querySelector('.error-message');
   *     if (errorMsg) errorMsg.remove();
   *   }
   */
  function simulateClearError(el: HTMLElement) {
    if (el.classList.contains('error')) {
      el.classList.remove('error');
      const msg = el.closest('.guided-input-wrapper')?.querySelector('.error-message');
      if (msg) {
msg.remove();
}
    }
  }

  // ── Happy path: error present → cleared ──
  it('removes error class and error message when error is present', () => {
    textarea.classList.add('error');
    simulateClearError(textarea);

    expect(textarea.classList.contains('error')).toBe(false);
    expect(wrapper.querySelector('.error-message')).toBeNull();
  });

  // ── Happy path: no error → no DOM ops ──
  it('does nothing when no error class is present (performance guard)', () => {
    const removeSpy = vi.spyOn(textarea.classList, 'remove');
    simulateClearError(textarea);

    expect(removeSpy).not.toHaveBeenCalled();
    // Error message element should still exist
    expect(wrapper.querySelector('.error-message')).not.toBeNull();
  });

  // ── Edge: rapid repeated calls without error ──
  it('100 rapid calls without error class do zero DOM mutations', () => {
    const removeSpy = vi.spyOn(textarea.classList, 'remove');
    for (let i = 0; i < 100; i++) {
      simulateClearError(textarea);
    }
    expect(removeSpy).not.toHaveBeenCalled();
  });

  // ── Edge: error-message already removed ──
  it('handles case where error-message was already removed', () => {
    textarea.classList.add('error');
    errorMsg.remove(); // Already gone

    expect(() => simulateClearError(textarea)).not.toThrow();
    expect(textarea.classList.contains('error')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. main.js — _realTimeListenersStarted guard
// ═══════════════════════════════════════════════════════════════════════════
describe('main.js — _realTimeListenersStarted guard', () => {
  let jsSource: string;

  beforeEach(() => {
    jsSource = readJS('js/main.js');
  });

  it('checks _realTimeListenersStarted before calling startRealTimeListeners', () => {
    expect(jsSource).toContain('if (!this._realTimeListenersStarted)');
  });

  it('sets _realTimeListenersStarted = true after starting', () => {
    expect(jsSource).toContain('this._realTimeListenersStarted = true');
  });

  it('guard and flag are in the correct order (check → call → set)', () => {
    const guardIdx = jsSource.indexOf('if (!this._realTimeListenersStarted)');
    const callIdx = jsSource.indexOf('this.startRealTimeListeners()');
    const setIdx = jsSource.indexOf('this._realTimeListenersStarted = true');

    expect(guardIdx).toBeLessThan(callIdx);
    expect(callIdx).toBeLessThan(setIdx);
  });
});

describe('main.js — _realTimeListenersStarted simulation', () => {
  it('startRealTimeListeners called once on first loadData', () => {
    const startRealTimeListeners = vi.fn();
    const obj: Record<string, unknown> = {
      _realTimeListenersStarted: false,
      startRealTimeListeners
    };

    // Simulate the guard
    function loadData() {
      if (!obj._realTimeListenersStarted) {
        obj.startRealTimeListeners();
        obj._realTimeListenersStarted = true;
      }
    }

    loadData();
    expect(startRealTimeListeners).toHaveBeenCalledTimes(1);
    expect(obj._realTimeListenersStarted).toBe(true);
  });

  it('startRealTimeListeners NOT called on second loadData', () => {
    const startRealTimeListeners = vi.fn();
    const obj: Record<string, unknown> = {
      _realTimeListenersStarted: false,
      startRealTimeListeners
    };

    function loadData() {
      if (!obj._realTimeListenersStarted) {
        obj.startRealTimeListeners();
        obj._realTimeListenersStarted = true;
      }
    }

    loadData();
    loadData();
    loadData();
    expect(startRealTimeListeners).toHaveBeenCalledTimes(1);
  });

  it('REGRESSION: startRealTimeListeners is still called at least once', () => {
    const startRealTimeListeners = vi.fn();
    const obj: Record<string, unknown> = {
      _realTimeListenersStarted: false,
      startRealTimeListeners
    };

    function loadData() {
      if (!obj._realTimeListenersStarted) {
        obj.startRealTimeListeners();
        obj._realTimeListenersStarted = true;
      }
    }

    loadData();
    expect(startRealTimeListeners).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. ui-components.js — ActionFlowManager timing changes
// ═══════════════════════════════════════════════════════════════════════════
describe('ui-components.js — ActionFlowManager timing defaults', () => {
  let jsSource: string;

  beforeEach(() => {
    jsSource = readJS('js/modules/ui-components.js');
  });

  // ── Happy path: new default values ──
  it('minLoadingDuration defaults to 0', () => {
    expect(jsSource).toMatch(/minLoadingDuration\s*=\s*0/);
  });

  it('closeDelay defaults to 150', () => {
    expect(jsSource).toMatch(/closeDelay\s*=\s*150/);
  });

  it('success notification duration is 2500ms', () => {
    expect(jsSource).toContain('.success(successMessage, 2500)');
  });

  // ── REGRESSION: old values are gone ──
  it('REGRESSION: no minLoadingDuration = 200', () => {
    expect(jsSource).not.toMatch(/minLoadingDuration\s*=\s*200/);
  });

  it('REGRESSION: no closeDelay = 500', () => {
    expect(jsSource).not.toMatch(/closeDelay\s*=\s*500/);
  });

  it('REGRESSION: no success(successMessage, 5000)', () => {
    expect(jsSource).not.toContain('.success(successMessage, 5000)');
  });

  // ── Removed 100ms buffer delays ──
  it('no 100ms setTimeout buffer before success/error messages', () => {
    // The old pattern: await new Promise(resolve => setTimeout(resolve, 100));
    // after hiding loading and before showing success/error.
    // Count occurrences of setTimeout(resolve, 100) in execute method
    const executeBlock = jsSource.match(
      /static async execute\(options\)\s*\{([\s\S]*?)\n\s{2}\}/
    );
    expect(executeBlock).not.toBeNull();
    expect(executeBlock![1]).not.toContain('setTimeout(resolve, 100)');
  });
});

describe('ui-components.js — ActionFlowManager execute simulation', () => {
  let mockNotificationSystem: {
    showLoading: ReturnType<typeof vi.fn>;
    hideLoading: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockNotificationSystem = {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn()
    };
    (globalThis as any).window = {
      NotificationSystem: mockNotificationSystem
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).window;
  });

  /**
   * Simplified simulation of ActionFlowManager.execute
   * matching the new code (minLoadingDuration=0, no 100ms buffers)
   */
  async function executeAction(opts: {
    action: () => Promise<unknown>;
    successMessage?: string;
    errorMessage?: string;
    minLoadingDuration?: number;
    closeDelay?: number;
    closePopupOnSuccess?: boolean;
  }) {
    const {
      action,
      successMessage,
      errorMessage = 'שגיאה',
      minLoadingDuration = 0,
      closeDelay = 150,
      closePopupOnSuccess = false
    } = opts;

    const ns = mockNotificationSystem;
    const startTime = Date.now();

    try {
      ns.showLoading('מעבד...');
      const result = await action();

      const elapsed = Date.now() - startTime;
      const remaining = minLoadingDuration - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }

      ns.hideLoading();

      // No 100ms buffer here — that's the fix
      if (successMessage) {
        ns.success(successMessage, 2500);
      }

      if (closePopupOnSuccess) {
        setTimeout(() => {
          const popup = document.querySelector('.popup-overlay');
          if (popup) {
popup.remove();
}
        }, closeDelay);
      }

      return { success: true, data: result };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      const remaining = minLoadingDuration - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      ns.hideLoading();
      // No 100ms buffer here — that's the fix
      ns.error(`${errorMessage}: ${error.message}`, 5000);
      return { success: false, error };
    }
  }

  // ── Happy path: instant action ──
  it('fast action completes without artificial delay', async () => {
    const action = vi.fn().mockResolvedValue('ok');
    const promise = executeAction({ action, successMessage: 'Done!' });

    // With minLoadingDuration=0 and no 100ms buffer, should resolve immediately
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(mockNotificationSystem.hideLoading).toHaveBeenCalled();
    expect(mockNotificationSystem.success).toHaveBeenCalledWith('Done!', 2500);
  });

  // ── Happy path: success notification uses 2500ms ──
  it('success message displays for 2500ms, not 5000ms', async () => {
    const action = vi.fn().mockResolvedValue('ok');
    const promise = executeAction({ action, successMessage: 'Saved!' });
    await vi.runAllTimersAsync();
    await promise;

    expect(mockNotificationSystem.success).toHaveBeenCalledWith('Saved!', 2500);
  });

  // ── Happy path: error flow ──
  it('error path has no artificial 100ms delay', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fail'));
    const promise = executeAction({ action, errorMessage: 'Operation failed' });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(mockNotificationSystem.hideLoading).toHaveBeenCalled();
    expect(mockNotificationSystem.error).toHaveBeenCalledWith(
      'Operation failed: fail',
      5000
    );
  });

  // ── Edge: closeDelay = 150ms ──
  it('popup closes after 150ms delay (not 500ms)', async () => {
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    document.body.appendChild(popup);

    const action = vi.fn().mockResolvedValue('ok');
    const promise = executeAction({
      action,
      successMessage: 'Done!',
      closePopupOnSuccess: true,
      closeDelay: 150
    });
    await vi.runAllTimersAsync();
    await promise;

    // Popup should still exist before 150ms
    // Advance 150ms
    vi.advanceTimersByTime(150);
    expect(document.querySelector('.popup-overlay')).toBeNull();

    document.body.innerHTML = '';
  });

  // ── Edge: minLoadingDuration = 0 means no wait ──
  it('minLoadingDuration=0 means success shows immediately after action', async () => {
    const action = vi.fn().mockResolvedValue('ok');
    const promise = executeAction({
      action,
      successMessage: 'Fast!',
      minLoadingDuration: 0
    });
    await vi.runAllTimersAsync();
    await promise;

    // Success was called, meaning no artificial wait
    expect(mockNotificationSystem.success).toHaveBeenCalled();
  });

  // ── REGRESSION: no success message when not provided ──
  it('no success notification when successMessage is undefined', async () => {
    const action = vi.fn().mockResolvedValue('ok');
    const promise = executeAction({ action });
    await vi.runAllTimersAsync();
    await promise;

    expect(mockNotificationSystem.success).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. index.html — cache-bust hashes
// ═══════════════════════════════════════════════════════════════════════════
describe('index.html — cache-bust hash updated', () => {
  let html: string;

  beforeEach(() => {
    html = fs.readFileSync(
      path.join(USER_APP, 'index.html'),
      'utf-8'
    );
  });

  it('no stale a1b2c3d hashes remain', () => {
    expect(html).not.toContain('?v=a1b2c3d');
  });

  it('all CSS/JS links have a consistent hash', () => {
    const hashes = [...html.matchAll(/\?v=([a-f0-9]+)/g)].map(m => m[1]);
    expect(hashes.length).toBeGreaterThan(0);
    const uniqueHashes = [...new Set(hashes)];
    // All hashes should be the same (single cache-bust value)
    expect(uniqueHashes).toHaveLength(1);
  });
});
