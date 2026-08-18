/**
 * Modal scroll-confine (CSS-contract guard).
 * ─────────────────────────────────────────────────────────────────────────────
 * The base `.modal` overlay is itself a scroll container (`overflow-y: auto`) and centers a
 * `max-height: 90vh` box under `2rem` padding — 90vh + 4rem > 100vh, so the WHOLE overlay
 * scrolled (a "whole-screen" scroll) on top of the box's own inner scroll.
 *
 * The fix is SCOPED to `#clientManagementModal` (id-specificity beats the base `.modal` /
 * `.modal-content`): the overlay stops scrolling and the box is capped to fit the padded
 * viewport, so only the inner `.modal-content` / `.cm-detail` content scrolls. This suite pins
 * that the fix is present AND scoped — the base `.modal` rule + `#addServiceModal` are untouched.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const CSS = fs.readFileSync(path.resolve(ADMIN, 'css/clients-modals.css'), 'utf8');

function ruleBody(selector: string): string {
  const idx = CSS.indexOf(selector + ' {');
  expect(idx, `selector not found: ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', idx);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

describe('modal scroll-confine — the overlay no longer scrolls (scoped to #clientManagementModal)', () => {
  it('THE FIX: the client modal overlay is overflow:hidden (no whole-screen scroll)', () => {
    expect(ruleBody('#clientManagementModal')).toMatch(/overflow:\s*hidden/);
  });

  it('the content box is capped to fit the padded viewport (calc(100vh - 4rem)) so it never clips', () => {
    const desktopCap =
      /#clientManagementModal \.modal-content\.modal-large\s*\{[^}]*max-height:\s*calc\(100vh - 4rem\)/;
    expect(CSS).toMatch(desktopCap);
  });

  it('mobile mirror — the ≤768px block caps to calc(100vh - 2rem) (1rem overlay padding there)', () => {
    const mobileCap =
      /#clientManagementModal \.modal-content\.modal-large\s*\{[^}]*max-height:\s*calc\(100vh - 2rem\)/;
    expect(CSS).toMatch(mobileCap);
  });

  it('SCOPED, no base ripple: the base .modal overlay keeps overflow-y:auto (other modals untouched)', () => {
    // The fix must NOT change the shared base `.modal` rule — #addServiceModal etc. rely on it.
    expect(ruleBody('.modal')).toMatch(/overflow-y:\s*auto/);
    // and the overflow:hidden override is id-scoped, never applied to the bare `.modal` or #addServiceModal.
    expect(CSS).not.toMatch(/#addServiceModal\s*\{[^}]*overflow:\s*hidden/);
  });
});
