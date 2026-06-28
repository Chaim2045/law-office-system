/**
 * Unit tests — ReportGenerator null-aggregate hardening (report toFixed-null fix)
 * ──────────────────────────────────────────────────────────────────────────────
 * The CUSTOMER SCENARIO (G4): an admin generates a report for a client whose
 * stored stage/package hours aggregate is the literal value `null` (a legacy /
 * uninitialised aggregate — confirmed live for client רון פישמן / 2026003). Before
 * this fix the report crashed with `Cannot read properties of null (reading
 * 'toFixed')` because the read used `X !== undefined ? X : fallback` — and
 * `null !== undefined` is `true`, so the `null` slipped past the guard straight
 * into `.toFixed()`.
 *
 * The fix replaced the guard with `Number.isFinite(X)` at the two report sinks:
 *   - resolveServiceHours() stage branch  → renderServiceInfo / renderFinalSummary
 *   - renderPackagesTable() per-row pkgRemaining
 *
 * These tests prove: (a) a stored `null` aggregate now falls through to the
 * numeric recompute (no crash, finite number); (b) a real number is preserved
 * (no regression). The ReportGenerator IIFE dual-exports its singleton instance
 * via `module.exports` (the same pattern budget-status.js / profitability-format.js
 * use), so the real methods are exercised directly here.
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — side-effect: registers window.escapeHtml (the SSOT escaper renderPackagesTable delegates to).
import '../../../apps/admin-panel/js/core/escape-html.js';
// @ts-ignore — side-effect: registers window.ClientTypeDisplay (the canonical isFixedService predicate).
import '../../../apps/admin-panel/js/core/client-type-display.js';
// @ts-ignore — CommonJS default-export (the ReportGenerator singleton) from a TS ESM test.
import reportGenerator from '../../../apps/admin-panel/js/managers/ReportGenerator.js';

describe('resolveServiceHours — stage branch: stored null aggregate must not crash', () => {
  const stageClient = (stage: Record<string, unknown>) => ({
    fullName: 'לקוח בדיקה',
    type: 'legal_procedure',
    services: [{ type: 'legal_procedure', stages: [{ id: 'stage_a', ...stage }] }]
  });
  const formData = { service: 'הליך משפטי - שלב א', stage: 'stage_a' };

  it('hoursRemaining:null + hoursUsed:null → finite numbers, .toFixed() does not throw', () => {
    const client = stageClient({ totalHours: 10, hoursRemaining: null, hoursUsed: null });
    const hours = reportGenerator.resolveServiceHours(client, formData);

    expect(Number.isFinite(hours.remainingHours)).toBe(true);
    expect(Number.isFinite(hours.usedHours)).toBe(true);
    expect(() => hours.remainingHours.toFixed(1)).not.toThrow();
    expect(() => hours.usedHours.toFixed(1)).not.toThrow();
    // null usage → fall through: remaining = total - 0 = 10, used = total - remaining = 0
    expect(hours.remainingHours).toBe(10);
    expect(hours.usedHours).toBe(0);
  });

  it('hoursRemaining:null but hoursUsed:4 → remaining recomputed, used preserved', () => {
    const client = stageClient({ totalHours: 10, hoursRemaining: null, hoursUsed: 4 });
    const hours = reportGenerator.resolveServiceHours(client, formData);
    expect(hours.remainingHours).toBe(6); // 10 - 4
    expect(hours.usedHours).toBe(4);
  });

  it('regression — real numbers are preserved (no behaviour change)', () => {
    const client = stageClient({ totalHours: 10, hoursRemaining: 3, hoursUsed: 7 });
    const hours = reportGenerator.resolveServiceHours(client, formData);
    expect(hours.remainingHours).toBe(3);
    expect(hours.usedHours).toBe(7);
  });

  it('regression — hoursRemaining:0 (a finite zero) is preserved, not treated as missing', () => {
    const client = stageClient({ totalHours: 10, hoursRemaining: 0, hoursUsed: 10 });
    const hours = reportGenerator.resolveServiceHours(client, formData);
    expect(hours.remainingHours).toBe(0);
    expect(hours.usedHours).toBe(10);
  });
});

describe('renderPackagesTable — per-row null aggregate must not crash', () => {
  it('package hoursRemaining:null → renders the recomputed remainder, no throw', () => {
    const packages = [
      { type: 'additional', hours: 10, hoursUsed: 2, hoursRemaining: null, purchaseDate: '2026-01-01', description: 'בדיקה' }
    ];
    let html = '';
    expect(() => {
      html = reportGenerator.renderPackagesTable(packages, 'שירות', null, null);
    }).not.toThrow();
    // recomputed remainder = hours(10) - used(2) = 8.0
    expect(html).toContain('8.0');
    // the totals row remainder is also 8.0
    expect(html).toContain('שעות נותרות');
  });

  it('regression — package with a real hoursRemaining is shown as-is', () => {
    const packages = [
      { type: 'initial', hours: 10, hoursUsed: 5, hoursRemaining: 5, purchaseDate: '2026-01-01', description: 'X' }
    ];
    const html = reportGenerator.renderPackagesTable(packages, 'שירות', null, null);
    expect(html).toContain('5.0');
  });
});

describe('fixed-price legal procedure — report shows price + work-hours, never an hours overdraft', () => {
  const fixedStageClient = (stage: Record<string, unknown> = {}) => ({
    fullName: 'לקוח פיקס',
    type: 'legal_procedure',
    procedureType: 'legal_procedure',
    services: [{
      type: 'legal_procedure',
      pricingType: 'fixed',
      totalFixedPrice: 60000,
      stages: [{ id: 'stage_a', pricingType: 'fixed', fixedPrice: 20000, hoursUsed: 3.77, hoursRemaining: null, status: 'active', ...stage }]
    }]
  });
  const fixedFormData = { service: 'הליך משפטי - שלב א', stage: 'stage_a', reportType: 'full' };

  it('resolveServiceHours flags isFixed + carries the price; no crash on the null hoursRemaining', () => {
    const h = reportGenerator.resolveServiceHours(fixedStageClient(), fixedFormData);
    expect(h.isFixed).toBe(true);
    expect(h.fixedPrice).toBe(20000);
    expect(h.totalFixedPrice).toBe(60000);
    expect(Number.isFinite(h.usedHours)).toBe(true); // 3.77 — the real internal effort
    expect(Number.isFinite(h.remainingHours)).toBe(true);
  });

  it('renderServiceInfo shows מחיר קבוע + ₪ + internal work-hours, and NOT the hours-budget framing', () => {
    const html = reportGenerator.renderServiceInfo(fixedStageClient(), fixedFormData);
    expect(html).toContain('מחיר קבוע (פיקס)');
    expect(html).toContain('₪');
    expect(html).toContain('שעות עבודה (מדידה פנימית)');
    expect(html).toContain('3.8'); // worked hours
    expect(html).not.toContain('שעות שנרכשו'); // no purchased-hours
    expect(html).not.toContain('שעות נותרות'); // no fake remaining
    expect(html).not.toContain('חריגה');       // no fake overdraft
  });

  it('renderFinalSummary shows the fixed-price summary, not a budget/overdraft line', () => {
    const html = reportGenerator.renderFinalSummary(fixedStageClient(), fixedFormData, []);
    expect(html).toContain('תמחור פיקס');
    expect(html).toContain('שעות עבודה (מדידה פנימית)');
    expect(html).not.toContain('תקציב');
    expect(html).not.toContain('חריגה');
  });

  it('renderTimesheetRows suppresses the running-balance columns for fixed-price (4 base cells only)', () => {
    reportGenerator.dataManager = { getEmployeeName: (e: unknown) => String(e) };
    const rows = reportGenerator.renderTimesheetRows(
      [{ date: '2026-01-02', action: 'עבודה', employee: 'x', minutes: 60 }],
      fixedStageClient(),
      fixedFormData
    );
    const tdCount = (rows.join('').match(/<td/g) || []).length;
    expect(tdCount).toBe(4); // date / action / employee / minutes — no accumulated/remaining
  });

  it('regression — an HOURLY stage is NOT flagged fixed and still renders the hours framing', () => {
    const hourlyClient = {
      fullName: 'לקוח שעתי',
      type: 'legal_procedure',
      procedureType: 'legal_procedure',
      services: [{ type: 'legal_procedure', pricingType: 'hourly', stages: [{ id: 'stage_a', pricingType: 'hourly', totalHours: 10, hoursUsed: 4, hoursRemaining: 6, status: 'active' }] }]
    };
    const h = reportGenerator.resolveServiceHours(hourlyClient, fixedFormData);
    expect(h.isFixed).toBe(false);
    const html = reportGenerator.renderServiceInfo(hourlyClient, fixedFormData);
    expect(html).toContain('שעות שנרכשו');
    expect(html).not.toContain('מחיר קבוע (פיקס)');
  });

  it('M2 — fixed stage with hoursUsed:null derives work-hours from the ledger (== SSOT), not a fake 0.0', () => {
    // SSOT: 120 + 120 logged minutes on this stage = 4.0 hours.
    reportGenerator.dataManager = {
      getClientTimesheetEntries: () => [
        { serviceId: 'stage_a', minutes: 120 },
        { serviceId: 'stage_a', minutes: 120 }
      ]
    };
    const html = reportGenerator.renderServiceInfo(fixedStageClient({ hoursUsed: null }), fixedFormData);
    expect(html).toContain('4.0');          // ledger-derived effort (matches the modal SSOT)
    expect(html).not.toContain('0.0 שעות'); // never the fake zero
    expect(html).toContain('מחיר קבוע (פיקס)');
  });
});
