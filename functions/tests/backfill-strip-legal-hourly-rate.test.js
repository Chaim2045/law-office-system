/**
 * backfill-strip-legal-hourly-rate.test.js — H.3 PR1-followup backfill (2026-06-14)
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves the customer scenario of the one-time migration that strips the fabricated
 * `ratePerHour: 800` default from existing legal_procedure HOURLY services so the
 * static Plan reports `pricing_missing` instead of a fabricated 800×hours revenue.
 *
 * The migration's risky logic is the PURE classifier + cleaner (which docs to touch,
 * what to remove) — exercised directly here. The end-to-end plan outcome is asserted
 * against the REAL `computeClientPlan` (the same helper the canonical writer stamps),
 * so the test fails if the strip ever stops yielding `pricing_missing`.
 */

// ─── Defensive SDK mocks (the script under test requires client-writer + audit-critical;
//     requiring those pulls firebase-admin/functions. We never call the SDK in these
//     tests — the classifier/cleaner are pure — but the mocks keep `require` side-effect-free). ───
jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: Object.assign(() => ({}), { FieldValue })
  };
});

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return {
    https: { onCall: jest.fn((fn) => fn), HttpsError },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  };
});

const { classifyServices, buildCleanedServices } = require('../scripts/backfill-strip-legal-hourly-rate');
const { computeClientPlan } = require('../lib/profitability/client-plan');

// Builders for the two service shapes that matter.
function legalHourly(extra = {}) {
  return { id: 's_lh', type: 'legal_procedure', pricingType: 'hourly', status: 'active', totalHours: 10, ...extra };
}
function legalFixed(extra = {}) {
  return { id: 's_lf', type: 'legal_procedure', pricingType: 'fixed', status: 'active', totalPrice: 5000, ...extra };
}
function fixedSvc(extra = {}) {
  return { id: 's_fx', type: 'fixed', status: 'active', totalPrice: 3000, ...extra };
}

// ═══════════════════════════════════════════════════════════════════════════
// A. classifyServices — cohort detection
// ═══════════════════════════════════════════════════════════════════════════
describe('A. classifyServices — strip cohort', () => {
  test('legal-hourly with ratePerHour===800 → marked for strip', () => {
    const r = classifyServices([legalHourly({ ratePerHour: 800 })]);
    expect(r.stripIdx).toEqual([0]);
    expect(r.anomalies).toEqual([]);
    expect(r.hasNullEntry).toBe(false);
  });

  test('multiple legal-hourly 800 services → all marked for strip', () => {
    const r = classifyServices([
      legalHourly({ id: 'a', ratePerHour: 800 }),
      fixedSvc(),
      legalHourly({ id: 'b', ratePerHour: 800 })
    ]);
    expect(r.stripIdx).toEqual([0, 2]);
    expect(r.anomalies).toEqual([]);
  });

  test('legal-hourly with NO ratePerHour → nothing to strip (idempotent / already-migrated)', () => {
    const r = classifyServices([legalHourly()]);
    expect(r.stripIdx).toEqual([]);
    expect(r.anomalies).toEqual([]);
  });

  test('fixed-price services never match (no ratePerHour concept)', () => {
    const r = classifyServices([legalFixed(), fixedSvc()]);
    expect(r.stripIdx).toEqual([]);
    expect(r.anomalies).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. classifyServices — anomalies (a non-800 rate aborts the whole run)
// ═══════════════════════════════════════════════════════════════════════════
describe('B. classifyServices — non-800 anomalies (PRESERVE, never strip)', () => {
  test.each([[1200], [0], [-50], [799.99]])(
    'legal-hourly with elected rate %p → ELECTED_NON_800_RATE anomaly, not stripped',
    (rate) => {
      const r = classifyServices([legalHourly({ ratePerHour: rate })]);
      expect(r.stripIdx).toEqual([]);
      expect(r.anomalies).toEqual([{ index: 0, code: 'ELECTED_NON_800_RATE' }]);
    }
  );

  test('numeric ratePerHour on a NON-legal-hourly service → UNEXPECTED_RATE_LOCATION anomaly', () => {
    const r = classifyServices([fixedSvc({ ratePerHour: 800 })]);
    expect(r.stripIdx).toEqual([]);
    expect(r.anomalies).toEqual([{ index: 0, code: 'UNEXPECTED_RATE_LOCATION' }]);
  });

  test('legal-FIXED carrying a numeric rate → UNEXPECTED_RATE_LOCATION (pricingType!==hourly)', () => {
    const r = classifyServices([legalFixed({ ratePerHour: 800 })]);
    expect(r.anomalies).toEqual([{ index: 0, code: 'UNEXPECTED_RATE_LOCATION' }]);
  });

  test('mix of a strippable 800 AND an elected 1200 → BOTH surfaced; the elected one is an anomaly', () => {
    const r = classifyServices([
      legalHourly({ id: 'a', ratePerHour: 800 }),
      legalHourly({ id: 'b', ratePerHour: 1200 })
    ]);
    expect(r.stripIdx).toEqual([0]);
    expect(r.anomalies).toEqual([{ index: 1, code: 'ELECTED_NON_800_RATE' }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. classifyServices — defensive edges
// ═══════════════════════════════════════════════════════════════════════════
describe('C. classifyServices — defensive edges', () => {
  test('null / non-object service slot → hasNullEntry true (client skipped, not stripped)', () => {
    const r = classifyServices([null, legalHourly({ ratePerHour: 800 })]);
    expect(r.hasNullEntry).toBe(true);
    expect(r.stripIdx).toEqual([1]);
  });

  test('non-numeric ratePerHour (e.g. "800") → counted, left as-is, never stripped/anomaly', () => {
    const r = classifyServices([legalHourly({ ratePerHour: '800' })]);
    expect(r.stripIdx).toEqual([]);
    expect(r.anomalies).toEqual([]);
    expect(r.nonNumericRate).toBe(1);
  });

  test('non-array / empty input → empty result', () => {
    expect(classifyServices(undefined).stripIdx).toEqual([]);
    expect(classifyServices([]).stripIdx).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D. buildCleanedServices — surgical removal, no collateral mutation
// ═══════════════════════════════════════════════════════════════════════════
describe('D. buildCleanedServices', () => {
  test('removes ratePerHour ONLY from the targeted indices; preserves every other field/service', () => {
    const services = [
      legalHourly({ id: 'a', ratePerHour: 800, totalHours: 10, name: 'תביעה' }),
      fixedSvc({ id: 'b' }),
      legalHourly({ id: 'c', ratePerHour: 800, totalHours: 4 })
    ];
    const cleaned = buildCleanedServices(services, [0, 2]);
    expect('ratePerHour' in cleaned[0]).toBe(false);
    expect('ratePerHour' in cleaned[2]).toBe(false);
    expect(cleaned[0]).toMatchObject({ id: 'a', type: 'legal_procedure', pricingType: 'hourly', totalHours: 10, name: 'תביעה' });
    expect(cleaned[1]).toBe(services[1]); // untouched service returned by reference
    expect(cleaned[2].totalHours).toBe(4);
  });

  test('does NOT mutate the input array/objects', () => {
    const services = [legalHourly({ ratePerHour: 800 })];
    buildCleanedServices(services, [0]);
    expect(services[0].ratePerHour).toBe(800); // original intact
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E. END-TO-END plan outcome — the customer scenario (G4)
//    strip 800 → computeClientPlan reports pricing_missing, NOT 800×hours; hours intact.
// ═══════════════════════════════════════════════════════════════════════════
describe('E. plan outcome after strip (real computeClientPlan)', () => {
  test('single legal-hourly 800 service: before = 800×hours; after-strip = pricing_missing', () => {
    const before = [legalHourly({ ratePerHour: 800, totalHours: 10 })];
    const planBefore = computeClientPlan(before);
    expect(planBefore.expectedRevenue).toBe(8000);   // 800 × 10 (the fabricated revenue)
    expect(planBefore.pricingMissingCount).toBe(0);

    const { stripIdx } = classifyServices(before);
    const cleaned = buildCleanedServices(before, stripIdx);
    const planAfter = computeClientPlan(cleaned);

    expect(planAfter.expectedRevenue).toBe(0);        // null-aware sum, NOT 8000
    expect(planAfter.pricingMissingCount).toBe(1);
    expect(planAfter.pricingComplete).toBe(false);
    expect(planAfter.expectedHours).toBe(10);          // hours preserved
    expect(planAfter.serviceCount).toBe(1);
  });

  test('a co-existing fixed-price service keeps its revenue; only the stripped legal-hourly goes missing', () => {
    const before = [
      legalHourly({ id: 'a', ratePerHour: 800, totalHours: 10 }),
      fixedSvc({ id: 'b', fixedPrice: 5000 })
    ];
    const { stripIdx } = classifyServices(before);
    const cleaned = buildCleanedServices(before, stripIdx);
    const planAfter = computeClientPlan(cleaned);

    expect(planAfter.expectedRevenue).toBe(5000);     // fixed survives; legal-hourly contributes 0
    expect(planAfter.pricingMissingCount).toBe(1);
    expect(planAfter.pricingComplete).toBe(false);
  });

  test('idempotency: re-classifying the cleaned services finds nothing to strip', () => {
    const before = [legalHourly({ ratePerHour: 800 })];
    const cleaned = buildCleanedServices(before, classifyServices(before).stripIdx);
    expect(classifyServices(cleaned).stripIdx).toEqual([]);
    expect(classifyServices(cleaned).anomalies).toEqual([]);
  });
});
