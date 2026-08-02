/**
 * U1 — BEHAVIORAL: ClientManagementModal displays the STORED service.hoursUsed (SSOT).
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md / docs/WORK-PLAN-MODAL-UNIFICATION.md — PR-U1.
 *
 * Before U1 the management card DERIVED the "נוצלו" figure as `totalHours - hoursRemaining`
 * (ClientManagementModal.getServiceInfo) — the ONLY surface that did. The report modal
 * (ClientReportModal.js:483 `parseFloat(service.hoursUsed)`), the client rollup
 * (functions/shared/aggregates.js:87-88 sums `svc.hoursUsed`), and the unified renderer
 * (service-card-renderer.js `calculateHoursUsed` → `entity.hoursUsed`) all read the STORED
 * `hoursUsed`. U1 moves management onto that same stored SSOT with a legacy-safe fallback:
 *
 *     const hoursUsed = Number.isFinite(service.hoursUsed)
 *         ? service.hoursUsed
 *         : (totalHours - hoursRemaining);
 *
 * This suite is the G4 proof of the DECLARED behavioral change (an admin displayed
 * aggregate moves — apps/admin-panel/CLAUDE.md BEHAVIORAL CHANGE RULE):
 *   - healthy doc (hoursUsed == total − remaining) → displayed number UNCHANGED,
 *   - drifted doc (stored hoursUsed ≠ total − remaining) → management now shows the
 *     STORED value (agreeing with the report, not the old derivation),
 *   - legacy-absent doc (no hoursUsed) → falls back to total − remaining (NO regression),
 *   - stored 0 with drift → the `Number.isFinite` guard respects a real stored 0 (a `|| 0`
 *     style guard would have wrongly fallen back to total − remaining).
 *
 * Harness mirrors modal-unification-report-current-behavior.test.ts: stub the window
 * globals BEFORE importing the IIFE, then drive the real exported instance's getServiceInfo.
 * The constructor is inert (no DOM/side effects); init() is never auto-called.
 */
import { describe, it, expect } from 'vitest';

// getServiceInfo branches on window.SYSTEM_CONSTANTS.SERVICE_TYPES.HOURS — stub BEFORE import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).SYSTEM_CONSTANTS = {
  SERVICE_TYPES: { HOURS: 'hours', LEGAL_PROCEDURE: 'legal_procedure', FIXED: 'fixed' },
  PRICING_TYPES: { HOURLY: 'hourly', FIXED: 'fixed' }
};
// escapeHtml is delegated to the SSOT window global; stub it for the render path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string => (s === null || s === undefined ? '' : String(s));

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/ui/ClientManagementModal.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inst = (window as any).ClientManagementModal;

// Parse getServiceInfo's HTML and read the value of the "נוצלו:" (used-hours) stat.
function usedHoursFor(service: unknown): string {
  const html: string = inst.getServiceInfo(service);
  const box = document.createElement('div');
  box.innerHTML = html;
  const stat = Array.from(box.querySelectorAll('.management-hours-stat')).find(
    (el) => el.querySelector('.management-hours-stat-label')?.textContent?.trim() === 'נוצלו:'
  );
  return stat?.querySelector('.management-hours-stat-value')?.textContent?.trim() ?? '';
}

// The progress-bar percentage (recomputed from the same hoursUsed).
function percentFor(service: unknown): string {
  const html: string = inst.getServiceInfo(service);
  const box = document.createElement('div');
  box.innerHTML = html;
  return box.querySelector('.management-hours-percentage')?.textContent?.trim() ?? '';
}

const hoursService = (over: Record<string, unknown>) => ({
  id: 'srv_hours', name: 'שירות שעות', type: 'hours', pricingType: 'hourly', ...over
});

describe('U1 · management "נוצלו" reads the stored hoursUsed SSOT', () => {
  it('healthy doc (stored hoursUsed == total − remaining): displayed number is UNCHANGED', () => {
    const svc = hoursService({ totalHours: 50, hoursRemaining: 30, hoursUsed: 20 });
    expect(usedHoursFor(svc)).toBe('20.0'); // identical to the old total − remaining
    expect(percentFor(svc)).toBe('40%');
  });

  it('drifted doc (stored hoursUsed ≠ total − remaining): shows the STORED value, agreeing with the report', () => {
    // total − remaining would be 20.0 (the OLD display); the stored SSOT is 26.5.
    const svc = hoursService({ totalHours: 50, hoursRemaining: 30, hoursUsed: 26.5 });
    expect(usedHoursFor(svc)).toBe('26.5');
    expect(usedHoursFor(svc)).not.toBe('20.0'); // the old derivation is gone
    expect(percentFor(svc)).toBe('53%'); // 26.5 / 50 → 53%, recomputed from the stored value
  });

  it('legacy-absent doc (no hoursUsed field): falls back to total − remaining — NO regression', () => {
    const svc = hoursService({ totalHours: 50, hoursRemaining: 30 }); // hoursUsed undefined
    expect(usedHoursFor(svc)).toBe('20.0'); // today's management behavior, preserved
    expect(percentFor(svc)).toBe('40%');
  });

  it('stored 0 with drift: Number.isFinite respects a real stored 0 (a `|| 0` guard would have fallen back)', () => {
    // stored hoursUsed = 0 but total − remaining = 10. The SSOT is 0 (nothing used yet,
    // a stale/hand-edited remaining). Number.isFinite(0) === true → show the stored 0.
    const svc = hoursService({ totalHours: 50, hoursRemaining: 40, hoursUsed: 0 });
    expect(usedHoursFor(svc)).toBe('0.0');
    expect(usedHoursFor(svc)).not.toBe('10.0'); // NOT the total − remaining fallback
    expect(percentFor(svc)).toBe('0%');
  });
});
