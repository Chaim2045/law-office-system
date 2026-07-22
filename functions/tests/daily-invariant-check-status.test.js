/**
 * Tests for PR-IG-A1 (2026-07-22) — truthful-run hardening of
 * `dailyInvariantCheck` (functions/scheduled/index.js).
 *
 * Three defects closed here:
 *   (a) a crashed per-client scan reported PASS (swallowed error, no counter)
 *   (b) a total crash wrote an ERROR doc but returned normally (Cloud
 *       Scheduler never saw the failure)
 *   (c) the outbox trigger only emitted on FAIL-with-discrepancies>0 (covered
 *       separately in system-reports-outbox-trigger.test.js)
 *
 * This suite drives the FULL scheduled handler (not just the pure detector
 * helpers already covered by daily-invariant-check-i1-i4.test.js) against a
 * controllable in-memory Firestore mock, mirroring the pattern established in
 * reconcile-package-drift.test.js.
 */

// ═══════════════════════════════════════════════════════════════
// Controllable in-memory Firestore (must precede require)
// ═══════════════════════════════════════════════════════════════

let MOCK_CLIENTS = [];          // [{ id, data }]
let MOCK_TIMESHEET_BY_CLIENT = {}; // { [clientId]: entries[] | 'THROW' }
let MOCK_ALL_ENTRIES = [];      // for Check 3 (taskId != null query)
let MOCK_TASKS = [];            // budget_tasks
let MOCK_CLIENTS_QUERY_ERROR = null; // set to an Error to simulate total crash
let MOCK_ADDED_HEALTH_CHECKS = [];

jest.mock('firebase-admin', () => {
  // Defined inside the factory — jest.mock factories cannot reference
  // out-of-scope variables (Babel hoists the mock above the imports).
  function querySnap(docs) {
    return { size: docs.length, docs, forEach: (f) => docs.forEach(f) };
  }
  const FieldValue = { serverTimestamp: jest.fn(() => 'TS') };
  const firestore = () => ({
    collection: (name) => {
      if (name === 'clients') {
        return {
          get: async () => {
            if (MOCK_CLIENTS_QUERY_ERROR) throw MOCK_CLIENTS_QUERY_ERROR;
            return querySnap(MOCK_CLIENTS.map((c) => ({ id: c.id, data: () => c.data })));
          }
        };
      }
      if (name === 'timesheet_entries') {
        return {
          where: (field, _op, val) => {
            if (field === 'clientId') {
              return {
                get: async () => {
                  const entries = MOCK_TIMESHEET_BY_CLIENT[val];
                  if (entries === 'THROW') throw new Error(`simulated read failure for client ${val}`);
                  return querySnap((entries || []).map((e) => ({ data: () => e })));
                }
              };
            }
            if (field === 'taskId') {
              return { get: async () => querySnap(MOCK_ALL_ENTRIES.map((e) => ({ data: () => e }))) };
            }
            return { get: async () => querySnap([]) };
          }
        };
      }
      if (name === 'budget_tasks') {
        return {
          where: () => ({
            get: async () => querySnap(MOCK_TASKS.map((t) => ({ id: t.id, data: () => t })))
          })
        };
      }
      if (name === 'system_health_checks') {
        return {
          add: jest.fn(async (doc) => {
            MOCK_ADDED_HEALTH_CHECKS.push(doc);
            return { id: `hc_${MOCK_ADDED_HEALTH_CHECKS.length}` };
          })
        };
      }
      return { doc: () => ({}), add: jest.fn() };
    }
  });
  firestore.FieldValue = FieldValue;
  return { initializeApp: jest.fn(), firestore: Object.assign(firestore, { FieldValue }) };
});

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((config, fn) => fn)
}));

const { dailyInvariantCheck, _test } = require('../scheduled');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const { _recomputeTotalHours } = require('../shared/client-writer');
const { calcClientAggregates } = require('../shared/aggregates');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

// NOTE: deliberately NOT type ST.HOURS — a HOURS-typed service with no
// `packages` array trips Check 7's "orphan entries on packageless service"
// signal whenever it has logged minutes (a real, separate, already-existing
// check). Using a neutral type keeps these fixtures isolated to what THIS
// suite tests (census + PASS/FAIL/PARTIAL/ERROR status), without silently
// depending on Check 7 behavior. computeCardHoursUsed() reads `hoursUsed`
// regardless of type (its branches key on FIXED / pricingType FIXED only).
function makeHoursService(id, hoursUsed) {
  return { id, type: 'test_service', name: `שירות ${id}`, hoursUsed, totalHours: hoursUsed, packages: [] };
}

// Builds a client-level aggregate that is CANONICAL for the given services —
// so Check 6 (aggregate_drift) never fires as an unwanted side effect in tests
// that are only exercising the census/status logic, not Check 6 itself.
function makeClient(id, services, overrides = {}) {
  const canonicalTotalHours = _recomputeTotalHours(services);
  const canonical = calcClientAggregates(services, canonicalTotalHours);
  return {
    id,
    data: {
      clientName: `לקוח ${id}`,
      services,
      totalHours: canonicalTotalHours,
      hoursUsed: canonical.hoursUsed,
      hoursRemaining: canonical.hoursRemaining,
      minutesUsed: canonical.minutesUsed,
      minutesRemaining: canonical.minutesRemaining,
      isBlocked: canonical.isBlocked,
      isCritical: canonical.isCritical,
      ...overrides
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  MOCK_CLIENTS = [];
  MOCK_TIMESHEET_BY_CLIENT = {};
  MOCK_ALL_ENTRIES = [];
  MOCK_TASKS = [];
  MOCK_CLIENTS_QUERY_ERROR = null;
  MOCK_ADDED_HEALTH_CHECKS = [];
});

function lastHealthCheck() {
  return MOCK_ADDED_HEALTH_CHECKS[MOCK_ADDED_HEALTH_CHECKS.length - 1];
}

// ═══════════════════════════════════════════════════════════════
// PASS — clean run, zero errors, zero discrepancies
// ═══════════════════════════════════════════════════════════════

describe('clean run', () => {
  test('zero errors, zero discrepancies → PASS', async () => {
    MOCK_CLIENTS = [makeClient('c1', [makeHoursService('svc1', 2)])];
    MOCK_TIMESHEET_BY_CLIENT = { c1: [{ clientId: 'c1', serviceId: 'svc1', minutes: 120 }] };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.status).toBe('PASS');
    expect(doc.discrepanciesCount).toBe(0);
    expect(doc.clientsErrored).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// FAIL — discrepancies present, zero errors
// ═══════════════════════════════════════════════════════════════

describe('discrepancies present', () => {
  test('a real gap between card and timesheet hours → FAIL', async () => {
    MOCK_CLIENTS = [makeClient('c1', [makeHoursService('svc1', 5)])]; // card says 5h
    MOCK_TIMESHEET_BY_CLIENT = { c1: [{ clientId: 'c1', serviceId: 'svc1', minutes: 60 }] }; // timesheet says 1h

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.status).toBe('FAIL');
    expect(doc.discrepanciesCount).toBeGreaterThan(0);
    expect(doc.clientsErrored).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// THE HEADLINE CASE — every client read fails → status is NOT PASS
// ═══════════════════════════════════════════════════════════════

describe('the headline defect — crashed scan must not report green', () => {
  test('every client read fails → status !== PASS (PARTIAL)', async () => {
    MOCK_CLIENTS = [
      makeClient('c1', [makeHoursService('svc1', 2)]),
      makeClient('c2', [makeHoursService('svc2', 3)])
    ];
    // Both clients' per-client timesheet read throws — simulating a scan that
    // examined 0% of the data. Before PR-IG-A1 this reported PASS.
    MOCK_TIMESHEET_BY_CLIENT = { c1: 'THROW', c2: 'THROW' };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.status).not.toBe('PASS');
    expect(doc.status).toBe('PARTIAL');
    expect(doc.clientsErrored).toBe(2);
    expect(doc.clientsChecked).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// PARTIAL — some clients error, zero discrepancies among the rest
// ═══════════════════════════════════════════════════════════════

describe('partial scan', () => {
  test('one client errors, the rest are clean → PARTIAL, never PASS', async () => {
    MOCK_CLIENTS = [
      makeClient('c1', [makeHoursService('svc1', 2)]),
      makeClient('c2', [makeHoursService('svc2', 1)])
    ];
    MOCK_TIMESHEET_BY_CLIENT = {
      c1: 'THROW',
      c2: [{ clientId: 'c2', serviceId: 'svc2', minutes: 60 }] // matches card (1h) — clean
    };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.status).toBe('PARTIAL');
    expect(doc.clientsErrored).toBe(1);
    expect(doc.clientsChecked).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Census fields — populated + internally consistent
// ═══════════════════════════════════════════════════════════════

describe('census fields', () => {
  test('clientsChecked + clientsErrored + skips === clientsTotal', async () => {
    MOCK_CLIENTS = [
      makeClient('2025003', [makeHoursService('svc0', 1)]), // config-skipped
      makeClient('c_empty', []),                             // empty-services-skipped
      makeClient('c_ok', [makeHoursService('svc1', 1)]),     // checked clean
      makeClient('c_err', [makeHoursService('svc2', 1)])     // errors
    ];
    MOCK_TIMESHEET_BY_CLIENT = {
      c_ok: [{ clientId: 'c_ok', serviceId: 'svc1', minutes: 60 }],
      c_err: 'THROW'
    };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.clientsTotal).toBe(4);
    expect(doc.clientsSkippedConfig).toBe(1);
    expect(doc.clientsEmptySkipped).toBe(1);
    expect(doc.clientsChecked).toBe(1);
    expect(doc.clientsErrored).toBe(1);
    expect(doc.clientsChecked + doc.clientsErrored + doc.clientsSkippedConfig + doc.clientsEmptySkipped)
      .toBe(doc.clientsTotal);
    expect(typeof doc.checksRun).toBe('number');
    expect(doc.checksRun).toBeGreaterThan(0);
    expect(typeof doc.entriesRead).toBe('number');
    expect(typeof doc.durationMs).toBe('number');
  });

  test('type=invariant_check and schemaVersion=2 both present', async () => {
    MOCK_CLIENTS = [makeClient('c1', [makeHoursService('svc1', 1)])];
    MOCK_TIMESHEET_BY_CLIENT = { c1: [{ clientId: 'c1', serviceId: 'svc1', minutes: 60 }] };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.type).toBe('invariant_check');
    expect(doc.schemaVersion).toBe(2);
    expect(doc.schemaVersion).toBe(_test.RESULT_SCHEMA_VERSION);
  });

  test('discrepancies array is capped at MAX_EMBEDDED_DISCREPANCIES; discrepanciesCount carries the true total', async () => {
    // Build many clients each with one real gap to exceed the cap.
    const many = [];
    const timesheetMap = {};
    for (let i = 0; i < _test.MAX_EMBEDDED_DISCREPANCIES + 25; i++) {
      const id = `c${i}`;
      many.push(makeClient(id, [makeHoursService(`svc${i}`, 5)]));
      timesheetMap[id] = [{ clientId: id, serviceId: `svc${i}`, minutes: 60 }]; // gap
    }
    MOCK_CLIENTS = many;
    MOCK_TIMESHEET_BY_CLIENT = timesheetMap;

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.discrepanciesCount).toBeGreaterThanOrEqual(_test.MAX_EMBEDDED_DISCREPANCIES + 25);
    expect(doc.discrepancies.length).toBe(_test.MAX_EMBEDDED_DISCREPANCIES);
    expect(doc.discrepancies.length).toBeLessThan(doc.discrepanciesCount);
  });
});

// ═══════════════════════════════════════════════════════════════
// Total failure — ERROR doc written AND the function throws
// ═══════════════════════════════════════════════════════════════

describe('total failure', () => {
  test('a top-level crash writes an ERROR doc and rethrows', async () => {
    MOCK_CLIENTS_QUERY_ERROR = new Error('firestore is down');

    await expect(dailyInvariantCheck()).rejects.toThrow('firestore is down');

    const doc = lastHealthCheck();
    expect(doc.status).toBe('ERROR');
    expect(doc.type).toBe('invariant_check');
    expect(doc.schemaVersion).toBe(2);
  });
});
