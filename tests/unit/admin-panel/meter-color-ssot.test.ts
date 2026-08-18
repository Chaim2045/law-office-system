/**
 * PR-2 · meter-color SSOT — the management header (.msc-*) and the report band
 * (.usc-identity-*) must paint the hours meter with ONE palette, so a service reads
 * IDENTICALLY on both tabs of the unified client card (the display half of the
 * modal-unification SSOT). The threshold that PICKS the state is already the one shared
 * meterStatus() (see report-tab.test.ts "PR-2 · meter threshold classes"); this suite
 * pins the COLOR each state maps to, on both tabs, against silent re-divergence.
 *
 * good → --green / --green-dark · high → --orange / --orange-darker · over → --red / --red-dark.
 * (--orange-darker, 5.18:1, is the WCAG-AA text token — NOT --orange-dark, 3.56:1.)
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const CSS = fs.readFileSync(path.resolve(ADMIN, 'css/clients-modals.css'), 'utf8');

function tokenOf(selector: string, prop: 'background' | 'color'): string {
  const idx = CSS.indexOf(selector + ' {');
  expect(idx, `selector not found: ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', idx);
  const body = CSS.slice(open + 1, CSS.indexOf('}', open));
  const m = body.match(new RegExp(prop + '\\s*:\\s*var\\((--[a-z0-9-]+)\\)'));
  expect(m, `${selector} has no ${prop}: var(--token)`).not.toBeNull();
  return (m as RegExpMatchArray)[1];
}

const STATES: Array<{ st: string; fill: string; text: string }> = [
  { st: 'good', fill: '--green', text: '--green-dark' },
  { st: 'high', fill: '--orange', text: '--orange-darker' },
  { st: 'over', fill: '--red', text: '--red-dark' }
];

describe('PR-2 · meter-color SSOT (management .msc-* == report band .usc-identity-*)', () => {
  STATES.forEach(({ st, fill, text }) => {
    it(`${st}: meter fill is ${fill} on BOTH tabs`, () => {
      const mgmt = tokenOf(`.msc-meter-fill--${st}`, 'background');
      const band = tokenOf(`.usc-identity-meter-fill--${st}`, 'background');
      expect(mgmt).toBe(fill);
      expect(band).toBe(fill);
      expect(mgmt).toBe(band);
    });

    it(`${st}: rem text is ${text} on BOTH tabs`, () => {
      const mgmt = tokenOf(`.msc-hours-rem--${st}`, 'color');
      const band = tokenOf(`.usc-identity-rem--${st}`, 'color');
      expect(mgmt).toBe(text);
      expect(band).toBe(text);
      expect(mgmt).toBe(band);
    });
  });

  it('high rem text is the AA-passing token (--orange-darker), never the failing --orange-dark', () => {
    expect(tokenOf('.msc-hours-rem--high', 'color')).toBe('--orange-darker');
    expect(tokenOf('.usc-identity-rem--high', 'color')).toBe('--orange-darker');
  });
});
