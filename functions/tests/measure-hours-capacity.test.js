/**
 * PR-0 — offline proof of the capacity bucket math.
 *
 * The measurement script freezes the baseline that every later PR in
 * docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md is measured against. If its
 * arithmetic is wrong, every downstream conclusion inherits the error and
 * nobody would notice — so the math is pinned here, with no Firestore.
 *
 * Fixtures deliberately include the shapes the investigation found in the wild:
 * stage C never marked completed, a closed service still holding an active
 * stage, status-less legacy stages, and malformed stage entries.
 */

'use strict';

const {
  splitServiceCapacity,
  stageSumDivergence,
  isBillable,
  acceptsHours,
  isStagedHourly
} = require('../../scripts/measure-hours-capacity-2026-08-16');

const stagedHourly = (stages, status = 'active', totalHours) => ({
  id: 'svc_lp_1',
  name: 'הליך משפטי',
  type: 'legal_procedure',
  pricingType: 'hourly',
  status,
  totalHours: totalHours !== undefined
    ? totalHours
    : stages.reduce((s, st) => s + ((st && st.totalHours) || 0), 0),
  stages
});

describe('capacity buckets — the three-way split', () => {
  test('the canonical phantom shape: stage A active, B and C pending', () => {
    const svc = stagedHourly([
      { id: 'stage_a', status: 'active', totalHours: 20 },
      { id: 'stage_b', status: 'pending', totalHours: 30 },
      { id: 'stage_c', status: 'pending', totalHours: 50 }
    ]);

    const out = splitServiceCapacity(svc);

    expect(out.contract).toBe(100); // today's rule presents all 100 as available
    expect(out.active).toBe(20);    // only stage A is actually open
    expect(out.unknown).toBe(0);
    // 80h of phantom capacity on a single service.
    expect(out.contract - out.active - out.unknown).toBe(80);
  });

  test('completed stages are excluded, not merged into active', () => {
    const svc = stagedHourly([
      { id: 'stage_a', status: 'completed', totalHours: 20 },
      { id: 'stage_b', status: 'active', totalHours: 30 },
      { id: 'stage_c', status: 'pending', totalHours: 50 }
    ]);

    expect(splitServiceCapacity(svc)).toMatchObject({ contract: 100, active: 30, unknown: 0 });
  });

  test('a CLOSED service holds zero available capacity even with an active stage', () => {
    // Verified in code: stage C is never marked completed (services/index.js:1105-1110)
    // and completeService never touches stages[] — so a closed service keeps an
    // active stage forever. Without the service-eligibility condition, its hours
    // would count as available indefinitely. This is the P3 ruling.
    const svc = stagedHourly(
      [{ id: 'stage_c', status: 'active', totalHours: 50 }],
      'completed'
    );

    const out = splitServiceCapacity(svc);
    expect(out.active).toBe(0);
    expect(out.contract).toBe(50); // the contract figure is preserved for the delta
  });

  test('archived service: same rule, zero available', () => {
    const svc = stagedHourly([{ id: 'stage_a', status: 'active', totalHours: 10 }], 'archived');
    expect(splitServiceCapacity(svc).active).toBe(0);
  });

  test('status-less stages land in their own bucket — never silently active', () => {
    // devils-advocate attack 2: defaulting these to active would inflate the
    // number above what the admin screen already shows and bias phantom down.
    const svc = stagedHourly([
      { id: 'stage_a', status: 'active', totalHours: 10 },
      { id: 'stage_b', totalHours: 40 },            // no status at all
      { id: 'stage_c', status: null, totalHours: 5 } // explicit null
    ]);

    const out = splitServiceCapacity(svc);
    expect(out.active).toBe(10);
    expect(out.unknown).toBe(45);
    expect(out.unknownStages).toBe(2);
  });

  test('non-staged shapes are left exactly as today', () => {
    const hours = { id: 's1', type: 'hours', status: 'active', totalHours: 60, packages: [] };
    expect(splitServiceCapacity(hours)).toMatchObject({ contract: 60, active: 60, unknown: 0 });

    const lpNoStages = { id: 's2', type: 'legal_procedure', pricingType: 'hourly', status: 'active', totalHours: 25 };
    expect(splitServiceCapacity(lpNoStages)).toMatchObject({ contract: 25, active: 25 });
  });
});

describe('total by construction — malformed input degrades, never throws', () => {
  test('null and non-object stage entries are skipped', () => {
    const svc = stagedHourly([
      null,
      undefined,
      'not-an-object',
      { id: 'stage_a', status: 'active', totalHours: 10 }
    ], 'active', 10);

    expect(() => splitServiceCapacity(svc)).not.toThrow();
    expect(splitServiceCapacity(svc).active).toBe(10);
  });

  test('non-numeric totalHours never produces NaN', () => {
    const svc = stagedHourly([
      { id: 'stage_a', status: 'active', totalHours: '5' },      // string
      { id: 'stage_b', status: 'active', totalHours: undefined }, // missing
      { id: 'stage_c', status: 'active', totalHours: NaN },       // already NaN
      { id: 'stage_d', status: 'active', totalHours: 7 }
    ], 'active', 7);

    const out = splitServiceCapacity(svc);
    expect(Number.isFinite(out.active)).toBe(true);
    expect(Number.isFinite(out.contract)).toBe(true);
    expect(out.active).toBe(7); // only the genuine number counts
  });

  test('a service with no fields at all does not throw', () => {
    expect(() => splitServiceCapacity({})).not.toThrow();
    expect(() => splitServiceCapacity(null)).not.toThrow();
    expect(splitServiceCapacity({}).contract).toBe(0);
  });
});

describe('probe C — stored totalHours vs the sum of its stages', () => {
  test('agreement reports no divergence', () => {
    const svc = stagedHourly([
      { id: 'stage_a', status: 'active', totalHours: 20 },
      { id: 'stage_b', status: 'pending', totalHours: 30 }
    ]);
    expect(stageSumDivergence(svc)).toBeNull();
  });

  test('divergence beyond tolerance is reported with both figures', () => {
    const svc = stagedHourly(
      [{ id: 'stage_a', status: 'active', totalHours: 20 }],
      'active',
      75 // stored disagrees with the 20h of stages
    );
    const div = stageSumDivergence(svc);
    expect(div).not.toBeNull();
    expect(div.stored).toBe(75);
    expect(div.stageSum).toBe(20);
    expect(div.delta).toBe(55);
  });

  test('rounding noise inside tolerance is not reported', () => {
    const svc = stagedHourly(
      [{ id: 'stage_a', status: 'active', totalHours: 20 }],
      'active',
      20.02
    );
    expect(stageSumDivergence(svc)).toBeNull();
  });

  test('non-staged services are out of scope — they would otherwise report drift forever', () => {
    // devils-advocate attack 3: an ST.HOURS service has no stages array at all,
    // so an unscoped check reports drift on every hours service in the office.
    expect(stageSumDivergence({ type: 'hours', totalHours: 60 })).toBeNull();
    expect(stageSumDivergence({ type: 'fixed' })).toBeNull();
    expect(stageSumDivergence({ type: 'legal_procedure', pricingType: 'fixed', stages: [{ id: 'a' }] })).toBeNull();
  });
});

describe('the billable filter mirrors the current server rule', () => {
  test('archived, fixed, and legal_procedure+fixed are excluded', () => {
    expect(isBillable({ type: 'hours', status: 'archived' })).toBe(false);
    expect(isBillable({ type: 'fixed', status: 'active' })).toBe(false);
    expect(isBillable({ type: 'legal_procedure', pricingType: 'fixed', status: 'active' })).toBe(false);
  });

  test('completed services stay billable — matching aggregates.js NON_AGGREGATING_STATUSES', () => {
    // Deliberate: NON_AGGREGATING_STATUSES is ['archived'] only. The capacity
    // rule handles completed services via acceptsHours, not via this filter.
    expect(isBillable({ type: 'hours', status: 'completed' })).toBe(true);
    expect(acceptsHours({ status: 'completed' })).toBe(false);
  });

  test('a service with no status defaults to active, per the house convention', () => {
    expect(isBillable({ type: 'hours' })).toBe(true);
    expect(acceptsHours({})).toBe(true);
  });
});

describe('isStagedHourly — the only shape where the new rule differs', () => {
  test.each([
    ['hourly LP with stages', { type: 'legal_procedure', pricingType: 'hourly', stages: [{}] }, true],
    ['LP with empty stages', { type: 'legal_procedure', pricingType: 'hourly', stages: [] }, false],
    ['LP without stages', { type: 'legal_procedure', pricingType: 'hourly' }, false],
    ['fixed-priced LP', { type: 'legal_procedure', pricingType: 'fixed', stages: [{}] }, false],
    ['plain hours service', { type: 'hours', stages: [{}] }, false]
  ])('%s', (_label, svc, expected) => {
    expect(isStagedHourly(svc)).toBe(expected);
  });
});
