/**
 * PR-DRIFT-1 — tests for Check 7 (package-level consumption drift) + the
 * fixed-service Check-0 false-positive fix, added to dailyInvariantCheck.
 *
 * The cron itself is integration-heavy (Firestore queries, scheduler). Per the
 * house pattern (daily-invariant-check-i1-i4.test.js) we test the PURE detectors
 * exported via `_test`: `detectPackageInvariants` (Check 7) and
 * `computeCardHoursUsed` (the Check-0 card calc, incl. the fixed-service fix).
 * The cron loop is a thin wrapper that builds packageMinutes/orphanMinutes from
 * one read and pushes the detector output into `discrepancies` — verified by
 * reading the code.
 */

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(() => ({ collection: jest.fn() }), {
    FieldValue: { serverTimestamp: jest.fn(), increment: jest.fn() },
    Timestamp: { now: jest.fn() }
  })
}));

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((config, fn) => fn)
}));

const { _test } = require('../scheduled');
const { detectPackageInvariants, computeCardHoursUsed, PKG_HOURSUSED_TOLERANCE } = _test;
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// ─── builders ────────────────────────────────────────────────────
function makePackage(id, { hours = 200, hoursUsed = 0, hoursRemaining, status } = {}) {
  const rem = hoursRemaining === undefined ? round2(hours - hoursUsed) : hoursRemaining;
  return {
    id,
    type: 'additional',
    hours,
    hoursUsed,
    hoursRemaining: rem,
    status: status || (rem > 0 ? 'active' : 'depleted'),
    purchaseDate: '2026-01-01T00:00:00.000Z'
  };
}
function makeHoursService(id, { packages = [], status = 'active' } = {}) {
  return { id, type: ST.HOURS, name: `שירות ${id}`, status, packages };
}
function makeClient(services) {
  return { clientName: 'בדיקה', services };
}
function typesOf(out) {
  return out.map((d) => d.type).sort();
}

// ─── computeCardHoursUsed (Check 0 card calc + Part-C fix) ────────
describe('computeCardHoursUsed', () => {
  it('hours service → service.hoursUsed', () => {
    expect(computeCardHoursUsed({ type: ST.HOURS, hoursUsed: 12.5 })).toBe(12.5);
  });

  it('🔴 fixed service → work.totalMinutesWorked/60 (NOT hoursUsed, which is always 0)', () => {
    // Before the fix this returned service.hoursUsed (0) and false-flagged every
    // fixed service that had logged time. work=575min → 9.583h.
    const svc = { type: ST.FIXED, hoursUsed: 0, work: { totalMinutesWorked: 575, entriesCount: 8 } };
    expect(computeCardHoursUsed(svc)).toBeCloseTo(575 / 60, 5);
  });

  it('fixed service with no work block → 0 (no NaN)', () => {
    expect(computeCardHoursUsed({ type: ST.FIXED })).toBe(0);
    expect(computeCardHoursUsed({ type: ST.FIXED, work: {} })).toBe(0);
  });

  it('legal-procedure-fixed (pricingType=fixed) → Σ stages.totalHoursWorked (branch untouched)', () => {
    const svc = {
      type: ST.LEGAL_PROCEDURE,
      pricingType: PT.FIXED,
      stages: [{ totalHoursWorked: 4 }, { totalHoursWorked: 2.5 }]
    };
    expect(computeCardHoursUsed(svc)).toBe(6.5);
  });

  it('legal-procedure-hourly → service.hoursUsed', () => {
    expect(computeCardHoursUsed({ type: ST.LEGAL_PROCEDURE, pricingType: PT.HOURLY, hoursUsed: 8 })).toBe(8);
  });
});

// ─── detectPackageInvariants (Check 7) ───────────────────────────
describe('detectPackageInvariants — consumption drift (A)', () => {
  it('clean service (pkg.hoursUsed == Σ entries) → no discrepancies', () => {
    const pkg = makePackage('pkg_1', { hours: 50, hoursUsed: 10 });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_1: 600 }, {}); // 600min = 10h
    expect(out).toEqual([]);
  });

  it('🎯 over-count: card 100 vs entries 0.75 → package_hoursUsed_drift (+99.25)', () => {
    const pkg = makePackage('pkg_1', { hours: 200, hoursUsed: 100, hoursRemaining: 100 });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_1: 45 }, {}); // 45min = 0.75h
    const drift = out.find((d) => d.type === 'package_hoursUsed_drift');
    expect(drift).toMatchObject({ serviceId: 'srv_1', packageId: 'pkg_1', card: 100, entries: 0.75, drift: 99.25 });
  });

  it('under-count: card 5 vs entries 10 → drift -5 (sign preserved)', () => {
    const pkg = makePackage('pkg_1', { hours: 50, hoursUsed: 5 });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_1: 600 }, {}); // 10h
    expect(out.find((d) => d.type === 'package_hoursUsed_drift').drift).toBe(-5);
  });

  it('zero matching entries (card>0) → flagged (the dominant phantom shape)', () => {
    const pkg = makePackage('pkg_1', { hours: 100, hoursUsed: 60, hoursRemaining: 40 });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, {}, {}); // no entries at all
    expect(out.find((d) => d.type === 'package_hoursUsed_drift')).toMatchObject({ card: 60, entries: 0, drift: 60 });
  });

  it('tolerance boundary: drift == 0.05 NOT flagged, 0.06 flagged', () => {
    const at = makePackage('pkg_a', { hours: 50, hoursUsed: 1.05, hoursRemaining: 48.95 });
    const over = makePackage('pkg_b', { hours: 50, hoursUsed: 1.06, hoursRemaining: 48.94 });
    const client = makeClient([makeHoursService('srv_1', { packages: [at, over] })]);
    const out = detectPackageInvariants(client, { pkg_a: 60, pkg_b: 60 }, {}); // both 1.0h
    const drifts = out.filter((d) => d.type === 'package_hoursUsed_drift');
    expect(drifts).toHaveLength(1);
    expect(drifts[0].packageId).toBe('pkg_b');
    expect(PKG_HOURSUSED_TOLERANCE).toBe(0.05);
  });

  it('NaN-safety: pkg.hoursUsed undefined → coerced to 0, no spurious flag when entries=0', () => {
    const pkg = { id: 'pkg_1', type: 'additional', hours: 10 }; // no hoursUsed / hoursRemaining
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, {}, {});
    expect(out.filter((d) => d.type === 'package_hoursUsed_drift')).toEqual([]);
  });
});

describe('detectPackageInvariants — orphan signal (B)', () => {
  it('entries with no packageId on a packaged service → orphan_entries_on_packaged_service', () => {
    const pkg = makePackage('pkg_1', { hours: 50, hoursUsed: 0 });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, {}, { srv_1: 120 }); // 2h orphaned
    expect(out.find((d) => d.type === 'orphan_entries_on_packaged_service')).toMatchObject({
      serviceId: 'srv_1', orphanMinutes: 120, orphanHours: 2
    });
  });

  it('no orphan signal when the service has no packages', () => {
    const client = makeClient([makeHoursService('srv_1', { packages: [] })]);
    const out = detectPackageInvariants(client, {}, { srv_1: 120 });
    expect(out.filter((d) => d.type === 'orphan_entries_on_packaged_service')).toEqual([]);
  });
});

describe('detectPackageInvariants — internal consistency (full scope)', () => {
  it('hoursRemaining != hours - hoursUsed → package_hoursRemaining_arithmetic', () => {
    const pkg = makePackage('pkg_1', { hours: 10, hoursUsed: 3, hoursRemaining: 5 }); // should be 7
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_1: 180 }, {}); // 3h → hoursUsed clean
    expect(out.find((d) => d.type === 'package_hoursRemaining_arithmetic')).toMatchObject({
      stored: 5, expected: 7, drift: -2
    });
  });

  it('status=depleted but hoursRemaining>0 → package_status_incoherent', () => {
    const pkg = makePackage('pkg_1', { hours: 50, hoursUsed: 10, hoursRemaining: 40, status: 'depleted' });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_1: 600 }, {}); // 10h clean
    expect(out.find((d) => d.type === 'package_status_incoherent')).toMatchObject({ status: 'depleted', hoursRemaining: 40 });
  });

  it('active package within the -10h overdraft floor → NOT status-incoherent', () => {
    const pkg = makePackage('pkg_1', { hours: 10, hoursUsed: 15, hoursRemaining: -5, status: 'active' });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_1: 900 }, {}); // 15h clean
    expect(out.filter((d) => d.type === 'package_status_incoherent')).toEqual([]);
  });

  it('duplicate package id on the same client → duplicate_package_id + value compare skipped', () => {
    const a = makeHoursService('srv_1', { packages: [makePackage('pkg_dup', { hours: 50, hoursUsed: 10 })] });
    const b = makeHoursService('srv_2', { packages: [makePackage('pkg_dup', { hours: 50, hoursUsed: 99 })] });
    const client = makeClient([a, b]);
    const out = detectPackageInvariants(client, { pkg_dup: 60 }, {}); // ambiguous bucket
    expect(out.filter((d) => d.type === 'duplicate_package_id')).toHaveLength(2);
    expect(out.filter((d) => d.type === 'package_hoursUsed_drift')).toEqual([]); // skipped
  });

  it('dangling packageId: entry points to a package that exists nowhere → dangling_packageId', () => {
    const pkg = makePackage('pkg_real', { hours: 50, hoursUsed: 10 });
    const client = makeClient([makeHoursService('srv_1', { packages: [pkg] })]);
    const out = detectPackageInvariants(client, { pkg_real: 600, pkg_ghost: 120 }, {});
    expect(out.find((d) => d.type === 'dangling_packageId')).toMatchObject({ packageId: 'pkg_ghost', entries: 2 });
  });

  it('legal-procedure STAGE package id is catalogued → entries to it are NOT dangling (deferred to PR-DRIFT-3)', () => {
    const legal = {
      id: 'srv_legal', type: ST.LEGAL_PROCEDURE, status: 'active',
      stages: [{ id: 'stage_a', pricingType: PT.HOURLY, packages: [makePackage('pkg_stage', { hours: 30, hoursUsed: 5 })] }]
    };
    const client = makeClient([legal]);
    const out = detectPackageInvariants(client, { pkg_stage: 300 }, {}); // 5h on a stage pkg
    expect(out.filter((d) => d.type === 'dangling_packageId')).toEqual([]); // known, not dangling
    expect(out.filter((d) => d.type === 'package_hoursUsed_drift')).toEqual([]); // stages not drift-checked here
  });
});

describe('detectPackageInvariants — scope guards', () => {
  it('🔴 archived service is SKIPPED (no false-positive flood; NON_AGGREGATING_STATUSES)', () => {
    const pkg = makePackage('pkg_1', { hours: 50, hoursUsed: 100, hoursRemaining: -50 }); // grossly drifted
    const client = makeClient([makeHoursService('srv_1', { status: 'archived', packages: [pkg] })]);
    const out = detectPackageInvariants(client, {}, { srv_1: 60 });
    expect(out).toEqual([]); // archived → nothing flagged
  });

  it('empty / missing services → [] (no throw)', () => {
    expect(detectPackageInvariants({}, {}, {})).toEqual([]);
    expect(detectPackageInvariants({ services: null }, {}, {})).toEqual([]);
    expect(detectPackageInvariants(null, null, null)).toEqual([]);
  });
});
