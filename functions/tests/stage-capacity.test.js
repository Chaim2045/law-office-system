/**
 * PR-1 — the capacity SSOT and its fail-open wiring into the canonical writer.
 *
 * Two things are proven here:
 *
 *  1. The RULE. "Available" = an active stage on a service that still accepts
 *     hours. Every shape the 2026-08-16 production measurement found is pinned:
 *     the phantom shape (A active, B/C pending), a closed service still holding
 *     an active stage (stage C is never marked completed by any code path), and
 *     the fixed-priced procedures that are the majority of production stages.
 *
 *  2. The FAIL-OPEN property — the load-bearing one. The capacity computation
 *     sits in `client-writer.js` OUTSIDE every kill switch: the enforcement
 *     modes wrap only the invariant assertion, and the timesheet trigger's
 *     `mode:'log_only'` does not reach it. If it could throw, one malformed
 *     stage would stop time entry for the whole office. These tests assert the
 *     write still completes and the aggregates are still correct when the
 *     capacity input is garbage.
 */

'use strict';

const {
  computeClientCapacity,
  computeServiceCapacity,
  isActiveStage,
  isStagedHourlyService,
  isBillableService,
  CAPACITY_RULE,
  CAPACITY_RULE_VERSION
} = require('../shared/stage-capacity');

const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── fixtures ───────────────────────────────────────────────────

const stage = (id, totalHours, status = 'active') => ({
  id, name: `שלב ${id}`, status, pricingType: 'hourly',
  totalHours, hoursUsed: 0, hoursRemaining: totalHours
});

function procedure(stages, { status = 'active', pricingType = 'hourly' } = {}) {
  return {
    id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי',
    pricingType, status, stages,
    // Null-safe: several fixtures deliberately contain malformed stage entries.
    totalHours: stages.reduce(
      (s, st) => s + (st && typeof st.totalHours === 'number' && Number.isFinite(st.totalHours)
        ? st.totalHours
        : 0),
      0
    )
  };
}

// ═══════════════════════════════════════════════════════════════
// THE RULE
// ═══════════════════════════════════════════════════════════════

describe('the capacity rule — active stage on an hours-accepting service', () => {
  test('the canonical phantom shape: only the open stage counts', () => {
    // The production shape: 3 stages declared at intake, work happens on the
    // first. Today the system presents all 300h as available.
    const svc = procedure([
      stage('stage_a', 100, 'active'),
      stage('stage_b', 100, 'pending'),
      stage('stage_c', 100, 'pending')
    ]);

    const out = computeClientCapacity([svc]);

    expect(out.contractHours).toBe(300); // what is presented today
    expect(out.activeHours).toBe(100);   // what is actually available
    expect(out.phantomHours).toBe(200);
  });

  test('completed stages are excluded, not folded into active', () => {
    const svc = procedure([
      stage('stage_a', 20, 'completed'),
      stage('stage_b', 30, 'active'),
      stage('stage_c', 50, 'pending')
    ]);

    expect(computeClientCapacity([svc])).toMatchObject({
      contractHours: 100, activeHours: 30, phantomHours: 70
    });
  });

  test('a CLOSED service holds zero available capacity despite an active stage', () => {
    // Load-bearing. moveToNextStage refuses at the last stage, and
    // completeService/closeCase never touch stages[] — so a closed service keeps
    // an `active` stage forever. Without the service-eligibility half of the
    // rule, its hours would count as available indefinitely.
    for (const closed of ['completed', 'archived']) {
      const svc = procedure([stage('stage_c', 50, 'active')], { status: closed });
      const out = computeClientCapacity([svc]);
      expect(out.activeHours).toBe(0);
    }
  });

  test('an archived service leaves the contract figure too — it is not billable at all', () => {
    const svc = procedure([stage('stage_a', 50, 'active')], { status: 'archived' });
    // Mirrors recomputeTotalHours: archived drops out of BOTH figures.
    expect(computeClientCapacity([svc])).toMatchObject({
      contractHours: 0, activeHours: 0, phantomHours: 0
    });
  });

  test('fixed-priced procedures are excluded entirely — they have no hours contract', () => {
    // services/index.js records that 87 of 150 production stages are
    // fixed-priced. Emitting a phantom figure for them would be fabricated drift.
    const svc = procedure([stage('stage_a', 0, 'active')], { pricingType: 'fixed' });
    expect(computeClientCapacity([svc])).toMatchObject({
      contractHours: 0, activeHours: 0, phantomHours: 0
    });
  });

  test('non-staged shapes pass through untouched — the rule changes nothing for them', () => {
    const hours = { id: 'h1', type: ST.HOURS, status: 'active', totalHours: 60, packages: [] };
    const out = computeClientCapacity([hours]);
    expect(out.contractHours).toBe(60);
    expect(out.activeHours).toBe(60);
    expect(out.phantomHours).toBe(0);
  });

  test('a mixed client sums both shapes correctly', () => {
    const out = computeClientCapacity([
      { id: 'h1', type: ST.HOURS, status: 'active', totalHours: 40, packages: [] },
      procedure([stage('stage_a', 10, 'active'), stage('stage_b', 90, 'pending')])
    ]);
    expect(out.contractHours).toBe(140);
    expect(out.activeHours).toBe(50);
    expect(out.phantomHours).toBe(90);
  });

  test('status-less stages are counted in NEITHER bucket, and tripped as a signal', () => {
    // Measured zero in production, and no code path creates the shape — but a
    // silent disappearance of hours would be the worst possible failure, so it
    // is surfaced rather than defaulted either way.
    const svc = procedure([
      stage('stage_a', 10, 'active'),
      { id: 'stage_b', totalHours: 40 } // no status at all
    ]);

    const out = computeClientCapacity([svc]);
    expect(out.activeHours).toBe(10);
    expect(out.unknownStatusStageCount).toBe(1);
  });

  test('every derived figure carries a rule + version stamp', () => {
    // No hours aggregate carried provenance before this. Without it there is no
    // way to read a document and know which rule produced its numbers.
    const out = computeClientCapacity([procedure([stage('stage_a', 10)])]);
    expect(out.rule).toBe(CAPACITY_RULE);
    expect(out.ruleVersion).toBe(CAPACITY_RULE_VERSION);
    expect(out.schemaVersion).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// TOTAL BY CONSTRUCTION
// ═══════════════════════════════════════════════════════════════

describe('total by construction — garbage degrades, never throws, never NaN', () => {
  const garbage = [
    ['null services', null],
    ['undefined services', undefined],
    ['a string instead of an array', 'not-an-array'],
    ['an array of nulls', [null, undefined]],
    ['a service with no fields', [{}]],
    ['a procedure with null stages', [procedure([]), { type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', stages: [null, undefined] }]],
    ['string totalHours', [procedure([stage('stage_a', '50')])]],
    ['NaN totalHours', [procedure([stage('stage_a', NaN)])]],
    ['a stages array of primitives', [{ type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', stages: [1, 'x', true], totalHours: 5 }]]
  ];

  test.each(garbage)('%s does not throw and yields finite numbers', (_label, services) => {
    let out;
    expect(() => { out = computeClientCapacity(services); }).not.toThrow();
    expect(Number.isFinite(out.activeHours)).toBe(true);
    expect(Number.isFinite(out.contractHours)).toBe(true);
    expect(Number.isFinite(out.phantomHours)).toBe(true);
  });

  test('a single malformed stage does not poison its siblings', () => {
    const svc = procedure([
      stage('stage_a', 10, 'active'),
      null,
      stage('stage_b', 25, 'active'),
      { id: 'stage_c', status: 'active', totalHours: 'nonsense' }
    ]);
    expect(computeClientCapacity([svc]).activeHours).toBe(35);
  });
});

// ═══════════════════════════════════════════════════════════════
// PREDICATES
// ═══════════════════════════════════════════════════════════════

describe('predicates', () => {
  test.each([
    ['active', 'active', true],
    ['pending', 'pending', false],
    ['completed', 'completed', false],
    ['missing', undefined, false],
    ['empty string', '', false],
    ['ACTIVE (wrong case)', 'ACTIVE', false]
  ])('isActiveStage — %s', (_l, status, expected) => {
    expect(isActiveStage({ status })).toBe(expected);
  });

  test('isActiveStage is strict — no default for a status-less stage', () => {
    expect(isActiveStage({})).toBe(false);
    expect(isActiveStage(null)).toBe(false);
  });

  test.each([
    ['hourly procedure with stages', { type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', stages: [{}] }, true],
    ['procedure with empty stages', { type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', stages: [] }, false],
    ['procedure with no stages key', { type: ST.LEGAL_PROCEDURE, pricingType: 'hourly' }, false],
    ['fixed-priced procedure', { type: ST.LEGAL_PROCEDURE, pricingType: 'fixed', stages: [{}] }, false],
    ['plain hours service', { type: ST.HOURS, stages: [{}] }, false]
  ])('isStagedHourlyService — %s', (_l, svc, expected) => {
    expect(isStagedHourlyService(svc)).toBe(expected);
  });

  test('isBillableService mirrors the existing recomputeTotalHours filter', () => {
    expect(isBillableService({ type: ST.HOURS, status: 'active' })).toBe(true);
    expect(isBillableService({ type: ST.HOURS, status: 'completed' })).toBe(true); // only archived drops
    expect(isBillableService({ type: ST.HOURS, status: 'archived' })).toBe(false);
    expect(isBillableService({ type: ST.FIXED, status: 'active' })).toBe(false);
    expect(isBillableService({ type: ST.LEGAL_PROCEDURE, pricingType: 'fixed' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// SERVICE-LEVEL SPLIT
// ═══════════════════════════════════════════════════════════════

describe('computeServiceCapacity — the per-service split', () => {
  test('preserves the contract figure while zeroing availability', () => {
    const svc = procedure([stage('stage_a', 80, 'pending')]);
    const out = computeServiceCapacity(svc);
    // The contract number survives so the delta stays measurable in the document.
    expect(out.contract).toBe(80);
    expect(out.active).toBe(0);
  });

  test('rounds to two places, matching the rest of the aggregate chain', () => {
    const svc = procedure([
      stage('stage_a', 0.005, 'active'),
      stage('stage_b', 10.126, 'active')
    ]);
    expect(computeServiceCapacity(svc).active).toBe(10.13);
  });
});
