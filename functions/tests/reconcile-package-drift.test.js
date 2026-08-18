/**
 * Tests for OWN-2 — the live reconciliation loop (reconcile-package-drift.js) +
 * the package-reconciliation enable-flag (reconciliation-mode.js).
 *
 * Strategy:
 *   - planServiceReconciliation: tested against the REAL OWN-1 engine
 *     (assignEntriesForwardReplay + computeRepairedService + isEligibleService) +
 *     the REAL client aggregator (calcClientAggregates) — only the Firestore SDK
 *     boundary + the owner (service-writer) are mocked.
 *   - runReconciliation: the loop orchestration (off / dry_run / enforce / defer /
 *     systemic-failure) with a controllable in-memory Firestore mock + a mocked
 *     owner (the owner has its own 34-test suite; here we test the LOOP).
 *   - reconciliation-mode: the fail-safe-OFF flag.
 */

// ═══════════════════════════════════════════════════════════════
// Controllable in-memory Firestore + mocks (must precede require)
// ═══════════════════════════════════════════════════════════════

let MOCK_CLIENTS = [];   // [{ id, data, updateTime }]
let MOCK_ENTRIES = {};   // { [clientId]: [entryData] }

function makeUpdateTime(token) {
  return { _t: token, isEqual(o) { return !!o && o._t === token; } };
}

jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: jest.fn(() => 'TS') };
  const querySnap = (docs) => ({ size: docs.length, docs, forEach: (f) => docs.forEach(f) });
  const firestore = () => ({
    collection: (name) => {
      if (name === 'clients') {
        return {
          get: async () => querySnap(MOCK_CLIENTS.map((c) => ({
            id: c.id, exists: true, updateTime: c.updateTime, data: () => c.data
          }))),
          doc: (id) => ({
            id,
            get: async () => {
              const c = MOCK_CLIENTS.find((x) => x.id === id);
              return c
                ? { exists: true, updateTime: c.updateTime, data: () => c.data }
                : { exists: false };
            }
          })
        };
      }
      if (name === 'timesheet_entries') {
        return {
          where: (_field, _op, val) => ({
            get: async () => querySnap((MOCK_ENTRIES[val] || []).map((e) => ({ id: e.id, data: () => e })))
          })
        };
      }
      return { doc: () => ({}), add: jest.fn() };
    },
    runTransaction: (fn) => fn({ get: async () => ({}), update: jest.fn(), set: jest.fn() })
  });
  firestore.FieldValue = FieldValue;
  return { initializeApp: jest.fn(), firestore: Object.assign(firestore, { FieldValue }) };
});

jest.mock('firebase-functions', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Control the flag.
jest.mock('../shared/reconciliation-mode', () => ({
  getReconciliationMode: jest.fn()
}));

// Stub the audit primitive.
jest.mock('../lib/audit-critical', () => ({
  logCriticalAction: jest.fn().mockResolvedValue('audit-id'),
  logCriticalActionInTxn: jest.fn()
}));

// Mock the OWN-1 owner — the LOOP is the unit under test; the owner has its own
// 34-test suite. Default: a successful write echoing before/after.
jest.mock('../shared/service-writer', () => ({
  writeServiceWithCanonicalPackages: jest.fn()
}));

// Wrap the engine so a single test can force an invariant failure (default = real).
jest.mock('../shared/package-repair-core', () => {
  const actual = jest.requireActual('../shared/package-repair-core');
  return { ...actual, computeRepairedService: jest.fn(actual.computeRepairedService) };
});

// ═══════════════════════════════════════════════════════════════
// Requires (after mocks)
// ═══════════════════════════════════════════════════════════════

const { getReconciliationMode } = require('../shared/reconciliation-mode');
const repairCore = require('../shared/package-repair-core');
const { writeServiceWithCanonicalPackages } = require('../shared/service-writer');
const { logCriticalAction } = require('../lib/audit-critical');
const { _test } = require('../scheduled/reconcile-package-drift');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

const { planServiceReconciliation, runReconciliation } = _test;

// ═══════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════

function hoursService(id, { totalHours = 10, storedHoursUsed = 0, status = 'active', overrideActive = false, overdraftResolved = null, packages = null } = {}) {
  const pkgs = packages || [{
    id: `${id}_p1`, hours: totalHours, hoursUsed: storedHoursUsed, hoursRemaining: totalHours - storedHoursUsed,
    status: 'active', purchaseDate: '2026-01-01T00:00:00.000Z'
  }];
  const svc = {
    id, type: ST.HOURS, name: 'שירות שעתי', totalHours, hoursUsed: storedHoursUsed,
    hoursRemaining: totalHours - storedHoursUsed, status, packages: pkgs
  };
  if (overrideActive) svc.overrideActive = true;
  if (overdraftResolved) svc.overdraftResolved = overdraftResolved;
  return svc;
}

function entry(id, minutes, { packageId = null, createdAt = '2026-02-01T10:00:00.000Z', serviceId = 's1' } = {}) {
  // serviceId is REQUIRED for loadEntriesByService grouping (effId = parentServiceId || serviceId).
  return { id, minutes, packageId, createdAt, serviceId };
}

beforeEach(() => {
  jest.clearAllMocks();
  MOCK_CLIENTS = [];
  MOCK_ENTRIES = {};
  repairCore.computeRepairedService.mockImplementation(
    jest.requireActual('../shared/package-repair-core').computeRepairedService
  );
  writeServiceWithCanonicalPackages.mockImplementation(async (_tx, _ref, data) => ({
    written: true, skipped: false, serviceId: data.serviceId, serviceBefore: 8, serviceAfter: 3
  }));
});

// ═══════════════════════════════════════════════════════════════
// A. planServiceReconciliation (real engine)
// ═══════════════════════════════════════════════════════════════

describe('A. planServiceReconciliation', () => {
  test('drifted eligible service → repair', () => {
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 8 });
    const entries = [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: null }), entry('e3', 60, { packageId: 's1_p1' })];
    const plan = planServiceReconciliation(svc, [svc], entries);
    expect(plan).toMatchObject({ action: 'repair', serviceId: 's1', serviceBefore: 8, serviceAfter: 3, ledgerTruth: 3 });
    expect(plan.repairedService.hoursUsed).toBe(3);
  });

  test('no drift → skip (no_drift)', () => {
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 3 });
    const entries = [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: 's1_p1' }), entry('e3', 60, { packageId: 's1_p1' })];
    const plan = planServiceReconciliation(svc, [svc], entries);
    expect(plan).toMatchObject({ action: 'skip', reason: 'no_drift', serviceAfter: 3 });
  });

  test('override service → skip (override_preserved), never recomputed', () => {
    const svc = hoursService('s1', { storedHoursUsed: 8, overrideActive: true });
    const plan = planServiceReconciliation(svc, [svc], [entry('e1', 60, { packageId: 's1_p1' })]);
    expect(plan).toMatchObject({ action: 'skip', reason: 'override_preserved' });
  });

  test('overdraft-resolved service → skip (overdraft_resolved)', () => {
    const svc = hoursService('s1', { storedHoursUsed: 8, overdraftResolved: { isResolved: true } });
    const plan = planServiceReconciliation(svc, [svc], []);
    expect(plan).toMatchObject({ action: 'skip', reason: 'overdraft_resolved' });
  });

  test('zero-package HOURS service → skip (no_packages)', () => {
    const svc = hoursService('s1', { packages: [] });
    const plan = planServiceReconciliation(svc, [svc], []);
    expect(plan).toMatchObject({ action: 'skip', reason: 'no_packages' });
  });

  test('block-flip to BLOCKED → defer (never auto-blocks)', () => {
    // stored hoursUsed 5 (remaining 5 → not blocked); real entries 12h → remaining -2 → blocked.
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 5 });
    const entries = Array.from({ length: 12 }, (_, i) => entry(`e${i}`, 60, { packageId: 's1_p1' }));
    const plan = planServiceReconciliation(svc, [svc], entries);
    expect(plan).toMatchObject({ action: 'defer', reason: 'block_flip_to_blocked', blockFlip: true, serviceAfter: 12 });
  });

  test('block-flip to UNBLOCKED (true→false) → repair (correcting a phantom block)', () => {
    // stored hoursUsed 12 (remaining -2 → blocked); real entries 3h → remaining 7 → unblocked.
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 12, packages: [{ id: 's1_p1', hours: 10, hoursUsed: 12, hoursRemaining: -2, status: 'depleted', purchaseDate: '2026-01-01T00:00:00.000Z' }] });
    const entries = [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: 's1_p1' }), entry('e3', 60, { packageId: 's1_p1' })];
    const plan = planServiceReconciliation(svc, [svc], entries);
    expect(plan.action).toBe('repair');
    expect(plan.blockFlip).toBe(true);
    expect(plan.serviceAfter).toBe(3);
  });

  test('invariant failure → skip (invariant_failed), never repaired', () => {
    const svc = hoursService('s1', { storedHoursUsed: 8 });
    repairCore.computeRepairedService.mockImplementationOnce(() => ({
      invariantOk: false, serviceBefore: 8, serviceAfter: 5, ledgerTruth: 3, repairedService: {}, packageDiffs: [], phantomReversals: []
    }));
    const plan = planServiceReconciliation(svc, [svc], [entry('e1', 60, { packageId: 's1_p1' })]);
    expect(plan).toMatchObject({ action: 'skip', reason: 'invariant_failed' });
  });

  // [fix: own-2 unresolved silent under-count] END-TO-END with the REAL engine:
  // an overdrawn service the replay cannot fully attribute (past the -10h floor,
  // no override) yields unresolved entries → ledgerTruth > serviceAfter →
  // invariantOk FALSE → the loop SKIPS it, instead of writing a silent under-count.
  test('REAL engine: overdrawn service with unresolved entries → skip(invariant_failed), no under-count write', () => {
    const svc = hoursService('s1', {
      totalHours: 1,
      packages: [{ id: 's1_p1', hours: 1, hoursUsed: 0, hoursRemaining: 1, status: 'active', purchaseDate: '2026-01-01T00:00:00.000Z' }]
    });
    const entries = [
      entry('e1', 660, { createdAt: '2026-02-01T10:00:00.000Z' }), // 11h → package to -10 (assigned)
      entry('e2', 60, { createdAt: '2026-02-02T10:00:00.000Z' })   // live remaining -10, NOT > -10 → unresolved
    ];
    const plan = planServiceReconciliation(svc, [svc], entries);
    expect(plan).toMatchObject({ action: 'skip', reason: 'invariant_failed' });
  });
});

// ═══════════════════════════════════════════════════════════════
// B. runReconciliation (the loop)
// ═══════════════════════════════════════════════════════════════

describe('B. runReconciliation', () => {
  function seedDriftedClient(clientId = '2025100') {
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 8 });
    MOCK_CLIENTS = [{ id: clientId, updateTime: makeUpdateTime('v1'), data: { services: [svc] } }];
    MOCK_ENTRIES = { [clientId]: [
      entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: null }), entry('e3', 60, { packageId: 's1_p1' })
    ] };
  }

  test('mode=off → inert (no client read, no write, skippedRun)', async () => {
    getReconciliationMode.mockResolvedValue('off');
    seedDriftedClient();
    const res = await runReconciliation();
    expect(res).toMatchObject({ mode: 'off', skippedRun: true });
    expect(writeServiceWithCanonicalPackages).not.toHaveBeenCalled();
    expect(logCriticalAction).not.toHaveBeenCalled(); // no run audit when off
  });

  test('mode=dry_run → counts wouldRepair, writes NOTHING', async () => {
    getReconciliationMode.mockResolvedValue('dry_run');
    seedDriftedClient();
    const res = await runReconciliation();
    expect(res.wouldRepair).toBe(1);
    expect(res.repaired).toBe(0);
    expect(writeServiceWithCanonicalPackages).not.toHaveBeenCalled();
    expect(logCriticalAction).toHaveBeenCalledTimes(1); // run-summary audit still written
  });

  test('mode=enforce → calls the owner, counts repaired', async () => {
    getReconciliationMode.mockResolvedValue('enforce');
    seedDriftedClient();
    const res = await runReconciliation();
    expect(writeServiceWithCanonicalPackages).toHaveBeenCalledTimes(1);
    expect(res.repaired).toBe(1);
    expect(res.failed).toBe(0);
    const [, , data, options] = writeServiceWithCanonicalPackages.mock.calls[0];
    expect(data.serviceId).toBe('s1');
    expect(data.clientUpdateTimeAtRead).toBeTruthy(); // A5 token passed
    expect(options.caller).toBe('reconcilePackageDrift');
    expect(options.mode).toBe('enforce');
    expect(typeof options.auditFn).toBe('function'); // per-repair audit injected
  });

  test('mode=enforce, block-flip-to-blocked → DEFERRED, owner NOT called', async () => {
    getReconciliationMode.mockResolvedValue('enforce');
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 5 });
    MOCK_CLIENTS = [{ id: '2025101', updateTime: makeUpdateTime('v1'), data: { services: [svc] } }];
    MOCK_ENTRIES = { 2025101: Array.from({ length: 12 }, (_, i) => entry(`e${i}`, 60, { packageId: 's1_p1' })) };
    const res = await runReconciliation();
    expect(res.blockFlipsDeferred).toBe(1);
    expect(res.repaired).toBe(0);
    expect(writeServiceWithCanonicalPackages).not.toHaveBeenCalled();
  });

  test('mode=enforce, no-drift client → nothing repaired, owner not called', async () => {
    getReconciliationMode.mockResolvedValue('enforce');
    const svc = hoursService('s1', { totalHours: 10, storedHoursUsed: 3 });
    MOCK_CLIENTS = [{ id: '2025102', updateTime: makeUpdateTime('v1'), data: { services: [svc] } }];
    MOCK_ENTRIES = { 2025102: [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: 's1_p1' }), entry('e3', 60, { packageId: 's1_p1' })] };
    const res = await runReconciliation();
    expect(res.repaired).toBe(0);
    expect(res.skipped).toBe(1);
    expect(writeServiceWithCanonicalPackages).not.toHaveBeenCalled();
  });

  test('SKIP_CLIENTS are excluded', async () => {
    getReconciliationMode.mockResolvedValue('enforce');
    const svc = hoursService('s1', { storedHoursUsed: 8 });
    MOCK_CLIENTS = [{ id: '2025003', updateTime: makeUpdateTime('v1'), data: { services: [svc] } }];
    MOCK_ENTRIES = { 2025003: [entry('e1', 60, { packageId: 's1_p1' })] };
    const res = await runReconciliation();
    expect(res.clientsScanned).toBe(0);
    expect(writeServiceWithCanonicalPackages).not.toHaveBeenCalled();
  });

  test('systemic write-failure → throws (Cloud Scheduler metric)', async () => {
    getReconciliationMode.mockResolvedValue('enforce');
    // two drifted clients; the owner throws on every write → 100% failure rate.
    const mk = (id) => ({ id, updateTime: makeUpdateTime('v1'), data: { services: [hoursService('s1', { storedHoursUsed: 8 })] } });
    MOCK_CLIENTS = [mk('2025201'), mk('2025202'), mk('2025203')];
    MOCK_ENTRIES = { 2025201: [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: 's1_p1' }), entry('e3', 60, { packageId: 's1_p1' })], 2025202: [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: 's1_p1' }), entry('e3', 60, { packageId: 's1_p1' })], 2025203: [entry('e1', 60, { packageId: 's1_p1' }), entry('e2', 60, { packageId: 's1_p1' }), entry('e3', 60, { packageId: 's1_p1' })] };
    writeServiceWithCanonicalPackages.mockRejectedValue(Object.assign(new Error('boom'), { code: 'internal' }));
    await expect(runReconciliation()).rejects.toThrow(/systemic failure/i);
    // run-summary audit is written BEFORE the throw (so the failure is recorded)
    expect(logCriticalAction).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. reconciliation-mode flag (fail-safe OFF)
// ═══════════════════════════════════════════════════════════════

describe('C. reconciliation-mode flag', () => {
  // requireActual bypasses the top-level jest.mock of this module. normalizeMode
  // is pure (only firebase-functions.logger.warn, which is mocked) — no real
  // Firestore needed; readModeFromFirestore's I/O path is exercised live in PROD
  // via the supervised dry_run smoke.
  const realReconMode = jest.requireActual('../shared/reconciliation-mode');
  const { normalizeMode } = realReconMode._test;
  const { DEFAULT_MODE, VALID_MODES } = realReconMode;

  test('DEFAULT_MODE is off (fail-safe — writer disabled unless enabled)', () => {
    expect(DEFAULT_MODE).toBe('off');
    expect(VALID_MODES).toEqual(['off', 'dry_run', 'enforce']);
  });

  test('normalizeMode accepts the 3 valid modes', () => {
    expect(normalizeMode('off')).toBe('off');
    expect(normalizeMode('dry_run')).toBe('dry_run');
    expect(normalizeMode('enforce')).toBe('enforce');
  });

  test('normalizeMode coerces an invalid value to off', () => {
    expect(normalizeMode('on')).toBe('off');
    expect(normalizeMode(undefined)).toBe('off');
    expect(normalizeMode(true)).toBe('off');
    expect(normalizeMode('ENFORCE')).toBe('off'); // case-sensitive
  });
});
