/**
 * Tests for the I1-I4 aggregate-drift detector added to dailyInvariantCheck
 * in PR-C.1.
 *
 * The cron itself is integration-heavy (Firestore queries, time scheduler).
 * To keep the unit-test surface small we test the pure detector exported via
 * `_test.detectAggregateDrift`. The cron loop is a thin wrapper that pushes
 * the detector's output into `discrepancies` — verified by reading the code.
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
const { detectAggregateDrift, AGG_DRIFT_TOLERANCE } = _test;
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeHoursService(id, { totalHours = 10, hoursUsed = 0 } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    packages: [],
    status: 'active'
  };
}

function makeClientData(services, overrides = {}) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  const hoursUsed = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
  const hoursRemaining = totalHours - hoursUsed;
  return {
    fullName: 'לקוח טסט',
    services,
    totalHours,
    hoursUsed,
    hoursRemaining,
    minutesUsed: hoursUsed * 60,
    minutesRemaining: hoursRemaining * 60,
    isBlocked: hoursRemaining <= 0,
    isCritical: hoursRemaining > 0 && hoursRemaining <= 5,
    ...overrides
  };
}

// ═══════════════════════════════════════════════════════════════
// detectAggregateDrift
// ═══════════════════════════════════════════════════════════════

describe('detectAggregateDrift (PR-C.1)', () => {
  test('AGG_DRIFT_TOLERANCE matches PR-D + cron baseline (0.02)', () => {
    expect(AGG_DRIFT_TOLERANCE).toBe(0.02);
  });

  test('clean client → empty drift array', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const data = makeClientData(services);
    expect(detectAggregateDrift(data)).toEqual([]);
  });

  test('client with isBlocked drift → reported', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const data = makeClientData(services, { isBlocked: true });  // canonical: false
    const drifts = detectAggregateDrift(data);
    expect(drifts).toHaveLength(1);
    expect(drifts[0]).toEqual({ field: 'isBlocked', current: true, canonical: false });
  });

  test('client with numeric drift → reported with diff', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const data = makeClientData(services, { hoursUsed: 5 });  // canonical: 3
    const drifts = detectAggregateDrift(data);
    const hoursUsedDrift = drifts.find(d => d.field === 'hoursUsed');
    expect(hoursUsedDrift).toEqual({
      field: 'hoursUsed',
      current: 5,
      canonical: 3,
      diff: 2
    });
  });

  test('multiple drift fields → all reported', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const data = makeClientData(services, {
      isBlocked: true,
      isCritical: true,
      hoursUsed: 8
    });
    const drifts = detectAggregateDrift(data);
    const fields = drifts.map(d => d.field);
    expect(fields).toContain('isBlocked');
    expect(fields).toContain('isCritical');
    expect(fields).toContain('hoursUsed');
  });

  test('empty-services client → no drift (different bug class)', () => {
    const data = makeClientData([], {
      // Stale stored values shouldn't be flagged for empty-services
      totalHours: 50,
      hoursUsed: 30,
      isBlocked: true
    });
    expect(detectAggregateDrift(data)).toEqual([]);
  });

  test('missing services array → treated as empty → no drift', () => {
    const data = { fullName: 'x', totalHours: 5 };  // services field absent
    expect(detectAggregateDrift(data)).toEqual([]);
  });

  test('drift below tolerance (0.01) → not flagged', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const data = makeClientData(services, { hoursUsed: 3.01 });  // diff = 0.01 ≤ 0.02
    expect(detectAggregateDrift(data)).toEqual([]);
  });

  test('drift just above tolerance (0.03) → flagged', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const data = makeClientData(services, { hoursUsed: 3.03 });  // diff = 0.03 > 0.02
    const drifts = detectAggregateDrift(data);
    expect(drifts.find(d => d.field === 'hoursUsed')).toBeDefined();
  });

  test('fixed service: hoursUsed nonzero stored but canonical excludes fixed → drift flagged', () => {
    const fixedSvc = {
      id: 'fxd1',
      type: ST.FIXED,
      totalHours: 0,
      hoursUsed: 5,
      hoursRemaining: 0,
      work: { totalMinutesWorked: 300, entriesCount: 3 }
    };
    const hoursSvc = makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 });
    // Stored hoursUsed sums both (8); canonical excludes fixed → 3
    const data = makeClientData([hoursSvc, fixedSvc], { hoursUsed: 8 });
    const drifts = detectAggregateDrift(data);
    const hoursUsedDrift = drifts.find(d => d.field === 'hoursUsed');
    expect(hoursUsedDrift).toEqual({
      field: 'hoursUsed',
      current: 8,
      canonical: 3,
      diff: 5
    });
  });

  test('returns numeric drift values rounded to 2 decimals', () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3.123 })];
    const data = makeClientData(services, { hoursUsed: 5.789 });
    const drifts = detectAggregateDrift(data);
    const d = drifts.find(x => x.field === 'hoursUsed');
    expect(d.current).toBe(5.79);
    expect(d.canonical).toBe(3.12);
    expect(typeof d.diff).toBe('number');
  });
});
