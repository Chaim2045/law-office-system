/**
 * H.7.a — Service-overdraft "open debt to collect" reframe (display-only)
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER_PLAN §8.9 (H.7): reframe the overrun mental model from "exception/loss"
 * to "חוב פתוח לגביה מהלקוח" (open debt to collect from the client). The only LIVE
 * surface is the admin ServiceOverdraftResolution modal/warning (the §8.9-named
 * `ExceptionModal.js` + "הפסד למשרד" text never existed — see the PR body).
 *
 * This PR is DISPLAY-ONLY: the persistence (the `setServiceOverdraftResolved` CF,
 * the `resolved:true/false` payload) and the count/filter key
 * (`service.overdraftResolved.isResolved`) are UNCHANGED — so no admin count,
 * filter, or aggregate moves (ADMIN SAFETY RULE). This test proves BOTH halves:
 *   (1) the customer-visible DOM now frames the overrun as a debt to collect, and
 *   (2) the backend persistence + count/filter contract is byte-for-byte intact.
 *
 * Created: 2026-06-25 — feat/h-7a-overdraft-debt-reframe
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll } from 'vitest';

// The module delegates escaping to the SSOT window.escapeHtml (routed in PR2).
// Stub it BEFORE importing the IIFE so render-time calls resolve.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string => (s === null || s === undefined ? '' : String(s));

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/features/ServiceOverdraftResolution.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const SRC = fs.readFileSync(path.resolve(ADMIN, 'js/features/ServiceOverdraftResolution.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inst = (window as any).ServiceOverdraftResolution;

beforeAll(() => {
  // The IIFE auto-runs setup() on import; clear any DOM-polling interval it started.
  if (inst && inst.modalCheckIntervalId) {
    clearInterval(inst.modalCheckIntervalId);
  }
});

describe('H.7.a — overrun is reframed to "open debt to collect" (customer-visible DOM)', () => {
  it('the open-overrun warning frames it as an open debt to collect, not an "exception"', () => {
    const el = inst.createOverdraftUI(
      { id: 'svc-1', hoursRemaining: -5, overdraftResolved: { isResolved: false } },
      'client-1'
    );
    const html = el.innerHTML;
    expect(html, 'must use the debt framing').toContain('חוב פתוח לגביה');
    expect(html, 'collection action label').toContain('סמן כנגבה');
    expect(html, 'old "exception" warning text must be gone').not.toContain('חריגה:');
    expect(html, 'old "mark resolved" label must be gone').not.toContain('סמן כהוסדר');
  });

  it('the settled state reads "the debt was collected", not "exception resolved"', () => {
    const el = inst.createOverdraftUI(
      {
        id: 'svc-1',
        hoursRemaining: -5,
        overdraftResolved: { isResolved: true, resolvedByName: 'גיא', resolvedAt: 1700000000000, note: 'הלקוח שילם' }
      },
      'client-1'
    );
    const html = el.innerHTML;
    expect(html, 'settled = debt collected').toContain('החוב נגבה');
    expect(html, 'old "exception resolved" title must be gone').not.toContain('חריגה הוסדרה');
  });
});

describe('H.7.a — backend persistence + count/filter contract is UNCHANGED (no behavioral change)', () => {
  it('still calls the same CF with the same resolved:true/false payload', () => {
    expect(SRC).toContain("httpsCallable('setServiceOverdraftResolved')");
    expect(SRC).toContain('resolved: true');
    expect(SRC).toContain('resolved: false');
  });

  it('still reads service.overdraftResolved.isResolved (the count/filter key that drives the badge)', () => {
    expect(SRC).toContain('service.overdraftResolved?.isResolved');
  });

  it('the debt vocabulary is applied end-to-end (modal title + toast + placeholder)', () => {
    expect(SRC, 'modal title').toContain('סימון חוב כנגבה');
    expect(SRC, 'success toast').toContain('החוב סומן כנגבה בהצלחה');
    expect(SRC, 'explanation placeholder').toContain('כיצד נגבה החוב');
  });
});
