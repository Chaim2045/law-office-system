/**
 * Unit tests — ReportGenerator stage IDENTITY (the wrong-matter bug)
 *
 * Stage ids (`stage_a`/`stage_b`/`stage_c`) are POSITION LABELS that every legal
 * procedure reuses — they are NOT unique within a client. The previous stage lookup
 * scanned `services[]` and took the FIRST service that owned a matching id, ignoring
 * `formData.serviceId` entirely. On a client with two procedures that produced a
 * client-facing report carrying the OTHER matter's pricing type, price and hours.
 *
 * Live case that exposed it (2026-08-11): case 2025009 has two procedures —
 * `הליך משפטי דיני עבודה` (pricingType fixed, stage_b fixedPrice 40000) created
 * three minutes BEFORE `הליך בוררות` (pricingType hourly, stage_b 59.5h/-8.24h).
 * A report on the ARBITRATION's stage_b rendered "שירות פיקס" + ₪40,000 + 2.2h —
 * the employment matter's figures — because the employment service came first.
 *
 * These tests pin the fix: resolution is scoped to the selected service, and an
 * ambiguous stage id with no serviceId is REFUSED (never guessed).
 *
 * Created: 2026-08-11 — fix/report-stage-identity
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// `_isFixedService` delegates to window.ClientTypeDisplay.isFixedService and is
// fail-safe: with the helper ABSENT it returns false for everything, so an
// `isFixed === false` assertion would pass even with the bug present. Import the
// CANONICAL predicate (never a hand-copied mirror — client-type-display.js carries a
// "DO NOT EDIT... the sync test enforces parity" contract; a local copy would drift
// out of that net). Same import the sibling report-generator-null-aggregate suite uses.
// @ts-ignore — side-effect: registers window.ClientTypeDisplay
import '../../../apps/admin-panel/js/core/client-type-display.js';
// @ts-ignore — side-effect: registers window.escapeHtml (renderServiceInfo delegates to it)
import '../../../apps/admin-panel/js/core/escape-html.js';
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/managers/ReportGenerator.js';

const reportGenerator: any = (window as any).ReportGenerator;

describe('test harness self-check', () => {
  it('the CANONICAL fixed-price classifier is live (otherwise every isFixed assertion is vacuous)', () => {
    expect(typeof (window as any).ClientTypeDisplay?.isFixedService).toBe('function');
    expect(reportGenerator._isFixedService({ type: 'legal_procedure', pricingType: 'fixed' })).toBe(true);
    expect(reportGenerator._isFixedService({ type: 'legal_procedure', pricingType: 'hourly' })).toBe(false);
  });
});

// --- fixtures: the live 2025009 shape (two procedures sharing stage_b) -------

function employmentFixedProcedure() {
  return {
    id: 'srv_legal_employment',
    type: 'legal_procedure',
    pricingType: 'fixed',
    name: 'הליך משפטי דיני עבודה',
    status: 'active',
    totalPrice: 80001,
    totalPaid: 0,
    hoursUsed: 37.24,
    stages: [
      { id: 'stage_a', name: "שלב א'", status: 'completed', pricingType: 'fixed', fixedPrice: 40000, hoursUsed: 0, totalHoursWorked: 0, paid: false },
      { id: 'stage_b', name: "שלב ב'", status: 'active', pricingType: 'fixed', fixedPrice: 40000, hoursUsed: 2.17, totalHoursWorked: 37.24, paid: false },
      { id: 'stage_c', name: "שלב ג'", status: 'pending', pricingType: 'fixed', fixedPrice: 1, hoursUsed: 0, totalHoursWorked: 0, paid: false }
    ]
  };
}

function arbitrationHourlyProcedure() {
  return {
    id: 'srv_legal_arbitration',
    type: 'legal_procedure',
    pricingType: 'hourly',
    name: 'הליך בוררות',
    status: 'active',
    totalHours: 120.5,
    hoursUsed: 75.07,
    hoursRemaining: 45.43,
    stages: [
      { id: 'stage_a', name: "שלב א'", status: 'completed', pricingType: 'hourly', totalHours: 60, hoursUsed: 7.33, hoursRemaining: 52.67 },
      { id: 'stage_b', name: "שלב ב'", status: 'active', pricingType: 'hourly', totalHours: 59.5, hoursUsed: 67.74, hoursRemaining: -8.24 },
      { id: 'stage_c', name: "שלב ג'", status: 'pending', pricingType: 'hourly', totalHours: 1, hoursUsed: 0, hoursRemaining: 1 }
    ]
  };
}

/** Employment (fixed) FIRST — the ordering that produced the live wrong report. */
function twoProcedureClient() {
  return {
    id: '2025009',
    totalHours: 150.5,
    hoursRemaining: 38.01,
    services: [employmentFixedProcedure(), arbitrationHourlyProcedure()]
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveServiceHours — stage identity across two procedures', () => {
  it('THE BUG: a stage_b report on the ARBITRATION returns the arbitration stage, not the employment one', () => {
    const hours = reportGenerator.resolveServiceHours(twoProcedureClient(), {
      serviceId: 'srv_legal_arbitration',
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(hours.matchType).toBe('stage');
    expect(hours.isFixed).toBe(false);          // was TRUE — "שירות פיקס" on an hourly matter
    expect(hours.totalHours).toBe(59.5);
    expect(hours.usedHours).toBe(67.74);
    expect(hours.remainingHours).toBe(-8.24);
    expect(hours.fixedPrice).toBeNull();        // was 40000 — the OTHER matter's price
  });

  it('the fixed procedure still resolves correctly when IT is the selected service', () => {
    const hours = reportGenerator.resolveServiceHours(twoProcedureClient(), {
      serviceId: 'srv_legal_employment',
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(hours.matchType).toBe('stage');
    expect(hours.isFixed).toBe(true);
    expect(hours.fixedPrice).toBe(40000);
    expect(hours.usedHours).toBe(2.17);
  });

  it('stage_a of the arbitration returns the closed stage, not the employment stage_a', () => {
    const hours = reportGenerator.resolveServiceHours(twoProcedureClient(), {
      serviceId: 'srv_legal_arbitration',
      service: "שלב א'",
      stage: 'stage_a'
    });

    expect(hours.isFixed).toBe(false);
    expect(hours.totalHours).toBe(60);
    expect(hours.remainingHours).toBe(52.67);
  });

  it('REFUSES to guess when the stage id is ambiguous and no serviceId was supplied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hours = reportGenerator.resolveServiceHours(twoProcedureClient(), {
      service: "שלב ב'",
      stage: 'stage_b'
      // no serviceId
    });

    // 'none' is the pre-existing SAFE branch: the caller derives used-hours from this
    // service's own timesheet entries and never borrows another matter's total.
    expect(hours.matchType).toBe('none');
    expect(hours.totalHours).toBe(0);
    expect(hours.isFixed).toBe(false);
    expect(hours.fixedPrice).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('NO REGRESSION: a single-procedure client still resolves without a serviceId', () => {
    const client = { id: '2026001', services: [arbitrationHourlyProcedure()] };

    const hours = reportGenerator.resolveServiceHours(client, {
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(hours.matchType).toBe('stage');
    expect(hours.totalHours).toBe(59.5);
    expect(hours.remainingHours).toBe(-8.24);
  });

  it('a stale serviceId does not silently fall back to another matter\'s stage', () => {
    const hours = reportGenerator.resolveServiceHours(twoProcedureClient(), {
      serviceId: 'srv_deleted_long_ago',
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(hours.matchType).not.toBe('stage');
    expect(hours.fixedPrice).toBeNull();
  });
});

describe('renderServiceInfo — the rendered report, not just the resolver', () => {
  // The resolver is the documented SSOT for all three report sections, but the bug
  // Haim saw was in the RENDERED document: "מחיר קבוע" + 40,000 on an hourly matter.
  // One render-level assertion closes G4 in its own words (no helper-only coverage).
  it('an arbitration stage_b report renders NO fixed-price framing and NOT the other matter\'s price', () => {
    const html: string = reportGenerator.renderServiceInfo(twoProcedureClient(), {
      serviceId: 'srv_legal_arbitration',
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(html).not.toContain('40,000');
    expect(html).not.toContain('40000');
    expect(html).not.toContain('פיקס');
    expect(html).toContain('59.5');   // the arbitration stage's own purchased hours
  });

  it('the employment stage_b report DOES render its fixed price (the fixed path still works)', () => {
    const html: string = reportGenerator.renderServiceInfo(twoProcedureClient(), {
      serviceId: 'srv_legal_employment',
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(html).toContain('40,000');
  });
});

describe('findServiceByFormData — the same stage-id ambiguity (packages breakdown)', () => {
  it('resolves by serviceId when supplied', () => {
    const svc = reportGenerator.findServiceByFormData(twoProcedureClient(), {
      serviceId: 'srv_legal_arbitration',
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(svc?.id).toBe('srv_legal_arbitration');
  });

  it('returns null instead of the first owner when the stage id is ambiguous', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const svc = reportGenerator.findServiceByFormData(twoProcedureClient(), {
      service: "שלב ב'",
      stage: 'stage_b'
    });

    expect(svc).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('NO REGRESSION: an unambiguous stage id still resolves without a serviceId', () => {
    const svc = reportGenerator.findServiceByFormData(
      { id: '2026001', services: [arbitrationHourlyProcedure()] },
      { service: "שלב ב'", stage: 'stage_b' }
    );

    expect(svc?.id).toBe('srv_legal_arbitration');
  });
});
