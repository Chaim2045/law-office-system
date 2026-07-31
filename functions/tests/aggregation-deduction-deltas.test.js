/**
 * CHARACTERIZATION goldens — the shared deduction math in src/modules/aggregation.
 *
 * The four apply*Delta functions are the SSOT deduction primitives every timesheet
 * CREATE path funnels through (createQuickLogEntry / createTimesheetEntry_v2 /
 * addTimeToTaskWithTransaction dispatch to them by service type — timesheet/index.js
 * :340-406 / :921-984 / :1457-1500). They are pure functions: (services[], ids,
 * minutesDelta) → { updatedServices, isOverage, overageMinutes } | null. This is
 * exactly where the historical hours-drift / double-count money bugs live, so a
 * future JS→TS rewrite must not silently drift them. This suite pins the CURRENT
 * behavior AS-IS.
 *
 * SCOPE — deliberately NON-overlapping with tests/pr-stage-own-guard.test.js, which
 * already owns applyLegalProcedureDelta's HOURLY-stage orphan-preservation (its
 * Tests 6/7/8). This file pins the branches that suite does NOT cover:
 *   - applyHoursDelta            — the HOURS package path (status active↔depleted,
 *                                  isOverage, service-level Σ recompute, isBlocked/
 *                                  isCritical, override, null-on-not-found)   [0 prior tests]
 *   - applyHoursDeltaServiceOnly — the depleted/no-package service-level increment  [0 prior tests]
 *   - applyLegalProcedureDelta   — the **FIXED-pricing stage** branch (totalHoursWorked,
 *                                  NO deduction, NO overage) + no-packageId passthrough +
 *                                  package overage + null-on-not-found   [the named "fixed" gap]
 *   - applyLegalProcedureDeltaStageOnly — the stage-level increment + fixed-svc null-remaining  [0 prior tests]
 *
 * Pure functions → no SDK/harness mock; the module is required directly (as
 * pr-stage-own-guard.test.js does). test/setup.js is untouched.
 */

const {
  applyHoursDelta,
  applyHoursDeltaServiceOnly,
  applyLegalProcedureDelta,
  applyLegalProcedureDeltaStageOnly
} = require('../src/modules/aggregation');
const { SYSTEM_CONSTANTS } = require('../shared/constants');

const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// ════════════════════════════════════════════════════════════════
// applyHoursDelta — HOURS service, package-backed deduction
// ════════════════════════════════════════════════════════════════

describe('applyHoursDelta — HOURS package deduction (characterization)', () => {

  function hoursSvc(overrides = {}, pkg = {}) {
    return [{
      id: 's1', type: 'hours', totalHours: 10, hoursUsed: 0, hoursRemaining: 10,
      packages: [{ id: 'p1', hours: 10, hoursUsed: 0, hoursRemaining: 10, status: 'active', ...pkg }],
      ...overrides
    }];
  }

  test('basic +2h: package moves, service-level hoursUsed = Σpackages, remaining = total − used', () => {
    const r = applyHoursDelta(hoursSvc(), 's1', 'p1', 120); // +2h
    expect(r).not.toBeNull();
    const svc = r.updatedServices[0];
    expect(svc.packages[0]).toMatchObject({ hoursUsed: 2, hoursRemaining: 8, status: 'active' });
    expect(svc.hoursUsed).toBe(2);
    expect(svc.hoursRemaining).toBe(8);
    expect(svc.isBlocked).toBe(false);
    expect(svc.isCritical).toBe(false);
    expect(r).toMatchObject({ isOverage: false, overageMinutes: 0 });
  });

  test('status active → depleted when the package hits 0; service isBlocked', () => {
    const r = applyHoursDelta(hoursSvc({ totalHours: 2 }, { hours: 2 }), 's1', 'p1', 120); // fills the 2h package
    const svc = r.updatedServices[0];
    expect(svc.packages[0]).toMatchObject({ hoursUsed: 2, hoursRemaining: 0, status: 'depleted' });
    expect(svc.hoursRemaining).toBe(0);
    expect(svc.isBlocked).toBe(true);
  });

  test('status depleted → active restored when a negative delta frees hours', () => {
    const services = hoursSvc({ totalHours: 10 }, { hoursUsed: 10, hoursRemaining: 0, status: 'depleted' });
    const r = applyHoursDelta(services, 's1', 'p1', -120); // −2h (edit/delete reversal)
    expect(r.updatedServices[0].packages[0]).toMatchObject({ hoursUsed: 8, hoursRemaining: 2, status: 'active' });
  });

  test('isOverage + overageMinutes when the package goes negative', () => {
    const r = applyHoursDelta(hoursSvc({ totalHours: 1 }, { hours: 1 }), 's1', 'p1', 120); // +2h into a 1h package
    expect(r.isOverage).toBe(true);
    expect(r.overageMinutes).toBe(60);               // |−1h| × 60
    expect(r.updatedServices[0].packages[0]).toMatchObject({ hoursRemaining: -1, status: 'depleted' });
  });

  test('isCritical when 0 < serviceRemaining ≤ 5', () => {
    const r = applyHoursDelta(hoursSvc(), 's1', 'p1', 360); // +6h of 10 → remaining 4
    const svc = r.updatedServices[0];
    expect(svc.hoursRemaining).toBe(4);
    expect(svc.isCritical).toBe(true);
    expect(svc.isBlocked).toBe(false);
  });

  test('QUIRK: overrideActive suppresses isBlocked even when depleted (overage still flags)', () => {
    const r = applyHoursDelta(hoursSvc({ totalHours: 1, overrideActive: true }, { hours: 1 }), 's1', 'p1', 120);
    expect(r.updatedServices[0].isBlocked).toBe(false); // override
    expect(r.isOverage).toBe(true);                     // but the package DID overdraw
  });

  test('null when the service or the package is not found', () => {
    expect(applyHoursDelta(hoursSvc(), 'NOPE', 'p1', 60)).toBeNull();  // service miss
    expect(applyHoursDelta(hoursSvc(), 's1', 'NOPE', 60)).toBeNull();  // package miss (targetFound stays false)
  });
});

// ════════════════════════════════════════════════════════════════
// applyHoursDeltaServiceOnly — depleted / no-package service-level increment
// ════════════════════════════════════════════════════════════════

describe('applyHoursDeltaServiceOnly — service-level increment (characterization)', () => {

  const svcOnly = (o = {}) => [{ id: 's1', type: 'hours', totalHours: 10, hoursUsed: 3, hoursRemaining: 7, ...o }];

  test('increments service hoursUsed directly; isCritical in the 0–5 band', () => {
    const r = applyHoursDeltaServiceOnly(svcOnly(), 's1', 120); // +2h → used 5, remaining 5
    const svc = r.updatedServices[0];
    expect(svc).toMatchObject({ hoursUsed: 5, hoursRemaining: 5, isCritical: true, isBlocked: false });
    expect(r.isOverage).toBe(false);
  });

  test('isOverage + isBlocked when it drives remaining below 0', () => {
    const r = applyHoursDeltaServiceOnly(svcOnly({ totalHours: 1, hoursUsed: 0, hoursRemaining: 1 }), 's1', 120);
    expect(r.isOverage).toBe(true);
    expect(r.overageMinutes).toBe(60);
    expect(r.updatedServices[0]).toMatchObject({ hoursUsed: 2, hoursRemaining: -1, isBlocked: true });
  });

  test('null when the service is not found', () => {
    expect(applyHoursDeltaServiceOnly(svcOnly(), 'NOPE', 60)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════
// applyLegalProcedureDelta — the FIXED-stage branch + edges
// (the HOURLY-stage orphan behavior is owned by pr-stage-own-guard.test.js)
// ════════════════════════════════════════════════════════════════

describe('applyLegalProcedureDelta — fixed stage + edges (characterization)', () => {

  test('FIXED-pricing stage: tracks totalHoursWorked, NO package deduction, NO overage; fixed svc → hoursRemaining null', () => {
    const services = [{
      id: 'lp1', type: 'legal_procedure', pricingType: PT.FIXED, totalHours: 0,
      stages: [{ id: 'stage_a', pricingType: PT.FIXED, totalHoursWorked: 5 }]
    }];
    const r = applyLegalProcedureDelta(services, 'lp1', 'stage_a', null, 180); // +3h
    expect(r).not.toBeNull();
    expect(r.updatedServices[0].stages[0].totalHoursWorked).toBe(8); // 5 + 3, no deduction
    expect(r.updatedServices[0].hoursRemaining).toBeNull();          // svc.pricingType === FIXED
    expect(r).toMatchObject({ isOverage: false, overageMinutes: 0 });
  });

  test('hourly stage with NO packageId → the stage is returned UNCHANGED (still resolves, not null)', () => {
    const services = [{
      id: 'lp1', type: 'legal_procedure', pricingType: 'hourly', totalHours: 10,
      stages: [{
        id: 'stage_a', pricingType: 'hourly', totalHours: 10, hoursUsed: 2, hoursRemaining: 8,
        packages: [{ id: 'pkg_1', hours: 10, hoursUsed: 2, hoursRemaining: 8, status: 'active' }]
      }]
    }];
    const r = applyLegalProcedureDelta(services, 'lp1', 'stage_a', null, 120);
    expect(r).not.toBeNull();                                             // targetFound = true
    expect(r.updatedServices[0].stages[0].packages[0].hoursUsed).toBe(2); // unchanged (no packageId)
    expect(r.isOverage).toBe(false);
  });

  test('hourly stage package overage flags isOverage + overageMinutes', () => {
    const services = [{
      id: 'lp1', type: 'legal_procedure', pricingType: 'hourly', totalHours: 1,
      stages: [{
        id: 'stage_a', pricingType: 'hourly', totalHours: 1, hoursUsed: 0, hoursRemaining: 1,
        packages: [{ id: 'pkg_1', hours: 1, hoursUsed: 0, hoursRemaining: 1, status: 'active' }]
      }]
    }];
    const r = applyLegalProcedureDelta(services, 'lp1', 'stage_a', 'pkg_1', 120); // +2h into a 1h package
    expect(r.isOverage).toBe(true);
    expect(r.overageMinutes).toBe(60);
    expect(r.updatedServices[0].stages[0].packages[0].hoursUsed).toBe(2);
  });

  test('null when the service or the stage is not found', () => {
    const services = [{ id: 'lp1', type: 'legal_procedure', pricingType: 'hourly', stages: [{ id: 'stage_a', pricingType: 'hourly', packages: [] }] }];
    expect(applyLegalProcedureDelta(services, 'NOPE', 'stage_a', 'pkg_1', 60)).toBeNull(); // service miss
    expect(applyLegalProcedureDelta(services, 'lp1', 'NOPE', 'pkg_1', 60)).toBeNull();     // stage miss
  });
});

// ════════════════════════════════════════════════════════════════
// applyLegalProcedureDeltaStageOnly — stage-level increment
// ════════════════════════════════════════════════════════════════

describe('applyLegalProcedureDeltaStageOnly — stage-level increment (characterization)', () => {

  test('increments stage hoursUsed directly (hourly svc → remaining = total − used)', () => {
    const services = [{
      id: 'lp1', type: 'legal_procedure', pricingType: 'hourly', totalHours: 10,
      stages: [{ id: 'stage_a', pricingType: 'hourly', totalHours: 10, hoursUsed: 3, hoursRemaining: 7 }]
    }];
    const r = applyLegalProcedureDeltaStageOnly(services, 'lp1', 'stage_a', 120); // +2h
    expect(r).not.toBeNull();
    expect(r.updatedServices[0].stages[0]).toMatchObject({ hoursUsed: 5, hoursRemaining: 5 });
    expect(r.isOverage).toBe(false);
  });

  test('isOverage + overageMinutes when the stage goes negative', () => {
    const services = [{
      id: 'lp1', type: 'legal_procedure', pricingType: 'hourly', totalHours: 1,
      stages: [{ id: 'stage_a', pricingType: 'hourly', totalHours: 1, hoursUsed: 0, hoursRemaining: 1 }]
    }];
    const r = applyLegalProcedureDeltaStageOnly(services, 'lp1', 'stage_a', 120); // +2h
    expect(r.isOverage).toBe(true);
    expect(r.overageMinutes).toBe(60);
    expect(r.updatedServices[0].stages[0].hoursUsed).toBe(2);
  });

  test('fixed-pricing service → service hoursRemaining is null (not a negative number)', () => {
    const services = [{
      id: 'lp1', type: 'legal_procedure', pricingType: PT.FIXED,
      stages: [{ id: 'stage_a', pricingType: PT.FIXED, totalHours: 0, hoursUsed: 0 }]
    }];
    const r = applyLegalProcedureDeltaStageOnly(services, 'lp1', 'stage_a', 120);
    expect(r.updatedServices[0].hoursRemaining).toBeNull();
    expect(r.updatedServices[0].stages[0].hoursUsed).toBe(2);
  });

  test('null when the service or the stage is not found', () => {
    const services = [{ id: 'lp1', type: 'legal_procedure', pricingType: 'hourly', stages: [{ id: 'stage_a' }] }];
    expect(applyLegalProcedureDeltaStageOnly(services, 'NOPE', 'stage_a', 60)).toBeNull();
    expect(applyLegalProcedureDeltaStageOnly(services, 'lp1', 'NOPE', 60)).toBeNull();
  });
});
