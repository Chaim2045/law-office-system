/**
 * client-plan — H.3 PR1 (the static Plan layer) unit tests
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) computeServicePlan — per-service revenue/hours derivation over every
 *     service-type × pricing-type permutation (fixed / legal-fixed / hours-hourly
 *     with + without a rate); null-not-0 + never-a-default-rate for un-priced.
 * (b) computeClientPlan — null-aware sums, pricing_missing flag/count, archived
 *     skip, malformed-entry tolerance.
 * (c) Invariants — cost/profit fields are NEVER present (confidential, §7.6 → PR3);
 *     the archived-skip list is drift-guarded to aggregates.NON_AGGREGATING_STATUSES.
 */
import {
  computeServicePlan,
  computeClientPlan,
  PROFITABILITY_PLAN_SCHEMA_VERSION,
  _PLAN_SKIP_STATUSES
} from '../profitability/client-plan';

describe('computeServicePlan', () => {
  it('fixed service → revenue=fixedPrice, expectedHours=null', () => {
    expect(computeServicePlan({ type: 'fixed', fixedPrice: 5000 })).toEqual({
      expectedHours: null, expectedRevenue: 5000, revenueSource: 'fixed_price'
    });
  });

  it('fixedPrice 0 (pro-bono) → revenue=0 (a KNOWN zero, not null)', () => {
    const p = computeServicePlan({ type: 'fixed', fixedPrice: 0 });
    expect(p.expectedRevenue).toBe(0);
    expect(p.revenueSource).toBe('fixed_price');
  });

  it('legal_procedure fixed → revenue from totalFixedPrice (createClient name)', () => {
    expect(computeServicePlan({ type: 'legal_procedure', pricingType: 'fixed', totalFixedPrice: 30000 }))
      .toMatchObject({ expectedHours: null, expectedRevenue: 30000, revenueSource: 'fixed_price' });
  });

  it('legal_procedure fixed → revenue from totalPrice (addServiceToClient name)', () => {
    expect(computeServicePlan({ type: 'legal_procedure', pricingType: 'fixed', totalPrice: 18000 }))
      .toMatchObject({ expectedRevenue: 18000, revenueSource: 'fixed_price' });
  });

  it('hours-hourly WITHOUT a rate → expectedHours kept, revenue null + unknown (the ~90 case)', () => {
    expect(computeServicePlan({ type: 'hours', pricingType: 'hourly', totalHours: 50 })).toEqual({
      expectedHours: 50, expectedRevenue: null, revenueSource: 'unknown'
    });
  });

  it('hourly WITH a stored ratePerHour → revenue = rate × hours', () => {
    expect(computeServicePlan({ type: 'legal_procedure', pricingType: 'hourly', totalHours: 10, ratePerHour: 800 }))
      .toEqual({ expectedHours: 10, expectedRevenue: 8000, revenueSource: 'rate_x_hours' });
  });

  it('hours-FIXED bucket → expectedHours null (fixed pricing), revenue=fixedPrice', () => {
    expect(computeServicePlan({ type: 'hours', pricingType: 'fixed', fixedPrice: 12000, totalHours: 40 }))
      .toEqual({ expectedHours: null, expectedRevenue: 12000, revenueSource: 'fixed_price' });
  });

  it('never silently defaults a rate: hourly, no rate, has hours → revenue stays null (NOT hours×800)', () => {
    const p = computeServicePlan({ type: 'hours', pricingType: 'hourly', totalHours: 25 });
    expect(p.expectedRevenue).toBeNull();
  });

  it('tolerates a malformed/empty service', () => {
    expect(computeServicePlan(null)).toMatchObject({ expectedRevenue: null, revenueSource: 'unknown' });
    expect(computeServicePlan({}).expectedRevenue).toBeNull();
  });
});

describe('computeClientPlan', () => {
  it('mixed (priced fixed + un-priced hours) → partial revenue + pricing_missing flag', () => {
    const plan = computeClientPlan([
      { type: 'fixed', fixedPrice: 5000 },
      { type: 'hours', pricingType: 'hourly', totalHours: 50 }
    ]);
    expect(plan).toEqual({
      expectedHours: 50,
      expectedRevenue: 5000,         // ONLY the known revenue — the 50h are NOT monetized
      pricingComplete: false,
      pricingMissingCount: 1,
      serviceCount: 2,
      schemaVersion: 1
    });
  });

  it('all priced → pricingComplete true, summed revenue + hours', () => {
    const plan = computeClientPlan([
      { type: 'fixed', fixedPrice: 5000 },
      { type: 'legal_procedure', pricingType: 'hourly', totalHours: 10, ratePerHour: 800 }
    ]);
    expect(plan).toMatchObject({
      expectedHours: 10, expectedRevenue: 13000, pricingComplete: true, pricingMissingCount: 0, serviceCount: 2
    });
  });

  it('empty services → zeros, pricingComplete true (nothing missing), schemaVersion 1', () => {
    expect(computeClientPlan([])).toEqual({
      expectedHours: 0, expectedRevenue: 0, pricingComplete: true,
      pricingMissingCount: 0, serviceCount: 0, schemaVersion: 1
    });
    expect(computeClientPlan(undefined)).toMatchObject({ serviceCount: 0 });
  });

  it('skips archived services (mirrors the hours-aggregate filter)', () => {
    const plan = computeClientPlan([
      { type: 'fixed', fixedPrice: 5000, status: 'active' },
      { type: 'fixed', fixedPrice: 9999, status: 'archived' }
    ]);
    expect(plan.expectedRevenue).toBe(5000);
    expect(plan.serviceCount).toBe(1);
  });

  it('filters null/falsy service entries', () => {
    const plan = computeClientPlan([null, undefined, { type: 'fixed', fixedPrice: 5000 }]);
    expect(plan.serviceCount).toBe(1);
    expect(plan.expectedRevenue).toBe(5000);
  });
});

describe('Plan invariants (security + drift)', () => {
  it('NEVER exposes a cost or profit field on the client-stored plan (§7.6 → PR3 CF-only)', () => {
    const plan = computeClientPlan([{ type: 'fixed', fixedPrice: 5000 }]);
    const keys = Object.keys(plan);
    expect(keys).not.toContain('expectedCost');
    expect(keys).not.toContain('expectedProfit');
    expect(keys).not.toContain('actualCost');
  });

  it('archived-skip list is drift-guarded to aggregates.NON_AGGREGATING_STATUSES', () => {

    const { NON_AGGREGATING_STATUSES } = require('../../shared/aggregates');
    expect([..._PLAN_SKIP_STATUSES]).toEqual([...NON_AGGREGATING_STATUSES]);
  });

  it('schemaVersion is pinned to 1', () => {
    expect(PROFITABILITY_PLAN_SCHEMA_VERSION).toBe(1);
    expect(computeClientPlan([]).schemaVersion).toBe(1);
  });
});
