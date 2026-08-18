/**
 * THE LOAD-BEARING TEST for capacity drift — detect-only separation.
 *
 * Mirrors `daily-invariant-check-stage-invariants-wiring.test.js`, which locks
 * exactly this property for stage invariants. An independent re-grade pointed
 * out that the separation shipped with NO regression lock at all: a future edit
 * merging the two detectors would have passed a fully green suite.
 *
 * WHY THE SEPARATION MATTERS
 *
 * `discrepancies[]` → `discrepanciesCount > 0` → `status = FAIL` → the outbox
 * trigger forwards any non-PASS run to the WhatsApp bot, verbatim. PR-IG-C2
 * established the precedent: a NEW finding type must not arrive on that path by
 * default; it earns its way there in a later, coordinated change.
 *
 * It matters concretely right now, too. The migration ran BEFORE the code
 * shipped, so a crop of clients carry stale-but-harmless capacity values until
 * the post-deploy re-run. Without this separation, day one after merge would
 * have turned the nightly health check red and paged the office over an
 * ordering artefact.
 */

'use strict';

let MOCK_CLIENTS = [];
let MOCK_ADDED_HEALTH_CHECKS = [];

jest.mock('firebase-admin', () => {
  function querySnap(docs) {
    return { size: docs.length, docs, forEach: (f) => docs.forEach(f) };
  }
  const FieldValue = { serverTimestamp: jest.fn(() => 'TS') };
  const firestore = () => ({
    collection: (name) => {
      if (name === 'clients') {
        return {
          get: async () => querySnap(MOCK_CLIENTS.map((c) => ({ id: c.id, data: () => c.data })))
        };
      }
      if (name === 'timesheet_entries' || name === 'budget_tasks') {
        return { where: () => ({ get: async () => querySnap([]) }) };
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

const { dailyInvariantCheck } = require('../scheduled');

// ─── fixture ────────────────────────────────────────────────────

/**
 * A client whose FLAT aggregates are perfectly correct — so `discrepancies[]`
 * has nothing to say — but whose `hoursCapacity` is deliberately wrong.
 *
 * Stage A active (100h) + stage B pending (200h) ⇒ the honest capacity is
 * activeHours 100 / contractHours 300 / phantomHours 200. The stored block
 * below claims all 300 are available: exactly the stale shape the pre-code
 * migration leaves behind.
 */
function makeCapacityDriftClient(id) {
  const services = [{
    id: 'lp1',
    type: 'legal_procedure',
    pricingType: 'hourly',
    status: 'active',
    totalHours: 300,
    hoursUsed: 0,
    hoursRemaining: 300,
    stages: [
      { id: 'stage_a', order: 1, name: 'שלב א', status: 'active', pricingType: 'hourly', totalHours: 100, hoursUsed: 0, hoursRemaining: 100, packages: [] },
      { id: 'stage_b', order: 2, name: 'שלב ב', status: 'pending', pricingType: 'hourly', totalHours: 200, hoursUsed: 0, hoursRemaining: 200, packages: [] }
    ]
  }];

  return {
    id,
    data: {
      fullName: 'לקוח עם קיבולת מיושנת',
      status: 'active',
      services,
      // flat aggregates: correct, so the OLD detector stays silent
      totalHours: 300,
      hoursUsed: 0,
      hoursRemaining: 300,
      minutesUsed: 0,
      minutesRemaining: 18000,
      isBlocked: false,
      isCritical: false,
      // capacity: WRONG on all three figures
      hoursCapacity: {
        activeHours: 300,
        contractHours: 300,
        phantomHours: 0,
        rule: 'active_stage_on_hours_accepting_service',
        ruleVersion: 1,
        schemaVersion: 1
      }
    }
  };
}

const lastHealthCheck = () => MOCK_ADDED_HEALTH_CHECKS[MOCK_ADDED_HEALTH_CHECKS.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  MOCK_CLIENTS = [];
  MOCK_ADDED_HEALTH_CHECKS = [];
});

// ═══════════════════════════════════════════════════════════════

describe('capacity-drift wiring — detect-only separation (THE load-bearing test)', () => {
  test('a capacity finding appears ONLY in capacityDrift, never in discrepancies[], and status stays PASS', async () => {
    MOCK_CLIENTS = [makeCapacityDriftClient('c_cap')];

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc).toBeDefined();

    // 1. It WAS detected — otherwise this test would pass for the wrong reason.
    expect(doc.capacityDrift).toBeDefined();
    expect(doc.capacityDrift.findingsCount).toBeGreaterThan(0);
    expect(doc.capacityDrift.mode).toBe('detect_only');

    const fields = doc.capacityDrift.findings[0].driftFields.map((f) => f.field);
    expect(fields).toContain('hoursCapacity.activeHours');

    // 2. It did NOT reach the alerting path.
    expect(doc.discrepanciesCount).toBe(0);
    expect(doc.discrepancies).toEqual([]);

    // 3. The run is still green — the outbox trigger only fires on non-PASS.
    expect(doc.status).toBe('PASS');
  });

  test('the serialised report contains no capacity field inside discrepancies', async () => {
    // A blunt guard against a future edit that merges the two collectors: the
    // string `hoursCapacity` must not appear anywhere in the alerting payload.
    MOCK_CLIENTS = [makeCapacityDriftClient('c_cap')];

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(JSON.stringify(doc.discrepancies)).not.toContain('hoursCapacity');
  });

  test('a CORRECT capacity block produces no finding at all', async () => {
    const c = makeCapacityDriftClient('c_ok');
    c.data.hoursCapacity = {
      activeHours: 100, contractHours: 300, phantomHours: 200,
      rule: 'active_stage_on_hours_accepting_service', ruleVersion: 1, schemaVersion: 1
    };
    MOCK_CLIENTS = [c];

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.capacityDrift.findingsCount).toBe(0);
    expect(doc.status).toBe('PASS');
  });

  test('a client with NO capacity field is not a finding — absence is by design', async () => {
    const c = makeCapacityDriftClient('c_absent');
    delete c.data.hoursCapacity;
    MOCK_CLIENTS = [c];

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.capacityDrift.findingsCount).toBe(0);
    expect(doc.discrepanciesCount).toBe(0);
    expect(doc.status).toBe('PASS');
  });

  test('real flat-aggregate drift still reaches discrepancies[] and still fails the run', async () => {
    // The separation must not have muted the OLD detector.
    const c = makeCapacityDriftClient('c_flat');
    c.data.totalHours = 999; // genuine drift on the old field
    MOCK_CLIENTS = [c];

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.discrepanciesCount).toBeGreaterThan(0);
    expect(doc.status).toBe('FAIL');
  });
});
