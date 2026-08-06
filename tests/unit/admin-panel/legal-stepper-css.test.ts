/**
 * Track-2 PR-3 — legal stages vertical stepper (CSS-contract guard).
 * ─────────────────────────────────────────────────────────────────────────────
 * The management card's legal-stage list was a cramped horizontal 3-dot timeline
 * whose completed marker filled with `var(--success-green)` — a token defined
 * NOWHERE in the admin CSS. The green never applied, so the white `fa-check` sat
 * on the base white circle and was invisible (Haim: "עיגול לבן, ה-V הלבן לא נראה").
 *
 * PR-3 rebuilds it as a calm VERTICAL stepper — numbered pending steps, an
 * accent-ringed current step, a green ✓ done step, joined by a progress rail —
 * entirely in CSS. The markup (and both renderers) are byte-unchanged, so the
 * injector contract is guarded by manage-detail-equality.test.ts; THIS suite pins
 * the CSS side: the undefined-token bug is gone, the ✓ now fills with a real
 * token, and the layout is vertical (not the old horizontal timeline).
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const CSS = fs.readFileSync(path.resolve(ADMIN, 'css/clients-modals.css'), 'utf8');

// The stepper's own CSS region — from the stages block to the hours body that
// follows it. Scoped so this suite guards PR-3's surface only; the info-block +
// hours-body still carry the same orphaned undefined-token family
// (--success-green / --danger-red / --warning-yellow) — tracked for the later
// "calm overdraft" PR, out of the stepper's scope.
const STEP_REGION = (() => {
  const start = CSS.indexOf('.management-stages {');
  const end = CSS.indexOf('.management-hours-progress {');
  expect(start, '.management-stages { not found').toBeGreaterThan(-1);
  expect(end, '.management-hours-progress { not found').toBeGreaterThan(start);
  return CSS.slice(start, end);
})();

// Isolate a single CSS rule body by selector (first match) so assertions are scoped.
function ruleBody(selector: string): string {
  const idx = CSS.indexOf(selector + ' {');
  expect(idx, `selector not found: ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', idx);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

describe('T2-3 · legal stages vertical stepper (CSS contract)', () => {
  it('THE FIX: the stepper no longer references the undefined --success-green token', () => {
    // A functional var(--success-green) use anywhere in the stepper region would mean a
    // marker/name can still fall back to white-on-white. (Comment prose is not a use.)
    expect(STEP_REGION).not.toMatch(/var\(--success-green\)/);
  });

  it('done marker fills with a REAL token (var(--green-dark)), so the ✓ is visible + AA', () => {
    const body = ruleBody('.management-stage.completed .management-stage-icon');
    // --green-dark (#059669), not --green (#10b981): white ✓ is 3.77:1 — clears the
    // 3:1 non-text-icon bar; plain --green (2.54:1) would fail. (devils-advocate Attack 1.)
    expect(body).toMatch(/background:\s*var\(--green-dark\)/);
    expect(body).toMatch(/color:\s*#fff/); // white ✓ on the green fill
  });

  it('the list is VERTICAL + numbers its markers (replaces the horizontal timeline)', () => {
    const body = ruleBody('.management-stages-list');
    expect(body).toMatch(/flex-direction:\s*column/);
    expect(body).toMatch(/counter-reset:\s*usc-step/);
    // the old horizontal spread is gone.
    expect(body).not.toMatch(/justify-content:\s*space-between/);
  });

  it('pending/current markers render the step number via a CSS counter', () => {
    expect(CSS).toMatch(/content:\s*counter\(usc-step\)/);
    // and the ✓ glyph is suppressed on non-completed markers (number instead).
    const hideIcon = /\.management-stage:not\(\.completed\) \.management-stage-icon > i\s*\{[^}]*display:\s*none/;
    expect(CSS).toMatch(hideIcon);
  });

  it('current step is accent-filled (AA) with a soft ring (tokenised, not raw rgba)', () => {
    const body = ruleBody('.management-stage.active .management-stage-icon');
    // --blue-dark (#2563eb): white step-number is 5.17:1 (text ≥ 4.5:1); --blue
    // (#3b82f6) is 3.68:1 and would fail. (devils-advocate Attack 1.)
    expect(body).toMatch(/background:\s*var\(--blue-dark\)/);
    expect(body).toMatch(/box-shadow:\s*0 0 0 4px var\(--cm-active-surface\)/);
  });

  it('a connecting rail joins the markers, greened below completed steps', () => {
    // the rail exists (pseudo-element on the row) …
    expect(CSS).toMatch(/\.management-stage:not\(:last-child\)::before\s*\{/);
    // … and its completed segment uses the real --green token (progress fill).
    const greenRail =
      /\.management-stage\.completed:not\(:last-child\)::before\s*\{[^}]*background:\s*var\(--green-dark\)/;
    expect(CSS).toMatch(greenRail);
  });
});
