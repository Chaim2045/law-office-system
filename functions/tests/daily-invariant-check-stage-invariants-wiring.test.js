/**
 * PR-IG-C2 (2026-07-26) — tests proving the stage-invariants detector
 * (PR-IG-C1, `functions/shared/stage-invariants.js`) is wired into
 * `dailyInvariantCheck` in DETECT-AND-COUNT-ONLY mode.
 *
 * The single hard guarantee under test: a stage-invariant finding
 *   - DOES appear in `result.stageInvariants.discrepancies`
 *   - does NOT appear in `result.discrepancies`
 *   - does NOT change `status` (an otherwise-PASS run stays PASS)
 *
 * This keeps the outbox trigger + the WhatsApp bot (which key off
 * `discrepancies[]` / `status` / `message`) completely untouched. Mirrors the
 * mock-Firestore harness established in daily-invariant-check-status.test.js.
 */

// ═══════════════════════════════════════════════════════════════
// Controllable in-memory Firestore (must precede require)
// ═══════════════════════════════════════════════════════════════

let MOCK_CLIENTS = [];
let MOCK_TIMESHEET_BY_CLIENT = {};
let MOCK_ALL_ENTRIES = [];
let MOCK_TASKS = [];
let MOCK_CLIENTS_QUERY_ERROR = null;
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
                  return querySnap((entries || []).map((e, i) => ({ id: `entry_${val}_${i}`, data: () => e })));
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
            get: async () => {
              if (MOCK_TASKS === 'THROW') throw new Error('simulated budget_tasks read failure');
              return querySnap(MOCK_TASKS.map((t) => ({ id: t.id, data: () => t })));
            }
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
const { _recomputeTotalHours } = require('../shared/client-writer');
const { calcClientAggregates } = require('../shared/aggregates');

// ─── helpers ────────────────────────────────────────────────────

// A legal_procedure client with ONE `completed` stage whose completedAt is
// months before the entry's date — the exact "February class" shape
// detectStageInvariants exists to catch. `service.hoursUsed` and
// `stage.hoursUsed` are stamped to match the entry's minutes exactly, and
// `stage.packages` is left empty, so NO OTHER existing check (per-service
// hours-comparison, Check 7 package/orphan invariants, Check 2 missing
// fields, Check 6 aggregate drift) fires as a side effect — this fixture is
// isolated to the ONE stage-invariant finding under test.
function makeStageInvariantClient(id, { entryDate = '2026-07-01', minutes = 60 } = {}) {
  const hours = minutes / 60;
  const stage = {
    id: 'stage_a',
    order: 1,
    pricingType: 'hourly',
    status: 'completed',
    completedAt: '2026-01-01T00:00:00.000Z', // months before entryDate
    hoursUsed: hours,
    totalHours: 10,
    hoursRemaining: 10 - hours,
    packages: [] // empty — keeps Check 7's Pass2b orphan-on-legal-stage signal silent
  };
  const svc = {
    id: 'svc_lp',
    type: 'legal_procedure',
    name: 'הליך בדיקה',
    hoursUsed: hours, // matches the entry so the per-service hours-comparison check is clean
    totalHours: 10,
    stages: [stage]
  };
  const services = [svc];
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
      isCritical: canonical.isCritical
    }
  };
}

function makeStageInvariantEntry(clientId, { entryDate = '2026-07-01', minutes = 60 } = {}) {
  return {
    clientId,
    parentServiceId: 'svc_lp',
    stageId: 'stage_a',
    minutes,
    date: entryDate
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
// THE LOAD-BEARING TEST — detect-only separation
// ═══════════════════════════════════════════════════════════════

describe('stage-invariants wiring — detect-only separation (THE load-bearing test)', () => {
  test('a stage-invariant finding appears ONLY in stageInvariants.discrepancies, never in discrepancies[], and status stays PASS', async () => {
    const client = makeStageInvariantClient('c_lp');
    MOCK_CLIENTS = [client];
    MOCK_TIMESHEET_BY_CLIENT = {
      c_lp: [makeStageInvariantEntry('c_lp', { entryDate: '2026-07-01', minutes: 60 })]
    };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();

    // (1) the finding DOES appear in stageInvariants.discrepancies, with the
    // right count.
    expect(doc.stageInvariants).toBeDefined();
    expect(doc.stageInvariants.discrepanciesCount).toBe(1);
    expect(doc.stageInvariants.discrepancies).toHaveLength(1);
    expect(doc.stageInvariants.discrepancies[0]).toMatchObject({
      type: 'entry_on_closed_stage',
      serviceId: 'svc_lp',
      stageId: 'stage_a'
    });

    // (1b) Adversarial-review FIX 1 (MAJOR, clientId-actionability): every
    // stage-invariant finding MUST carry the clientId it belongs to (else the
    // written array cannot be located to a client) — but MUST NOT carry
    // clientName (PII guard; this new path stays PII-clean, the repo is
    // PUBLIC). Locks the fix so it can't silently regress.
    for (const d of doc.stageInvariants.discrepancies) {
      expect(d.clientId).toBe('c_lp');
      expect(d).not.toHaveProperty('clientName');
    }

    // (2) THE LOAD-BEARING ASSERTION: the SAME finding does NOT appear in
    // discrepancies[], and does NOT change status — a run that is otherwise
    // clean stays PASS despite a stage finding.
    expect(doc.discrepanciesCount).toBe(0);
    expect(doc.discrepancies).toHaveLength(0);
    expect(
      doc.discrepancies.some((d) => d.type === 'entry_on_closed_stage')
    ).toBe(false);
    expect(doc.status).toBe('PASS');

    // (3) mode is detect_only.
    expect(doc.stageInvariants.mode).toBe('detect_only');
    expect(doc.stageInvariants.schemaVersion).toBe(1);
  });

  test('census arithmetic still holds (checked + errored + skips === total) with a stage finding present', async () => {
    const client = makeStageInvariantClient('c_lp');
    MOCK_CLIENTS = [client];
    MOCK_TIMESHEET_BY_CLIENT = {
      c_lp: [makeStageInvariantEntry('c_lp', { entryDate: '2026-07-01', minutes: 60 })]
    };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(
      doc.clientsScanChecked + doc.clientsScanErrored + doc.clientsSkippedConfig + doc.clientsEmptySkipped
    ).toBe(doc.clientsTotal);
  });

  test('checksExecuted reflects the new count — per-client +3, MAX_POSSIBLE_CHECKS is 9', async () => {
    const client = makeStageInvariantClient('c_lp');
    MOCK_CLIENTS = [client];
    MOCK_TIMESHEET_BY_CLIENT = {
      c_lp: [makeStageInvariantEntry('c_lp', { entryDate: '2026-07-01', minutes: 60 })]
    };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(_test.MAX_POSSIBLE_CHECKS).toBe(9);
    // clientsScanChecked=1 (>0) → +3 (hours-comparison, Check 7,
    // stage-invariants), plus the 6 unconditional checks = 9.
    expect(doc.checksExecuted).toBe(9);
  });
});

// ═══════════════════════════════════════════════════════════════
// A clean legal_procedure client (no stage finding) contributes zero
// ═══════════════════════════════════════════════════════════════

describe('stage-invariants wiring — clean client contributes nothing', () => {
  test('a legal_procedure client with an active (non-completed) stage produces no stage finding', async () => {
    // Same shape as makeStageInvariantClient but status stays 'active' —
    // detectEntriesOnClosedStage only ever looks at status==='completed'.
    const stage = {
      id: 'stage_a',
      order: 1,
      pricingType: 'hourly',
      status: 'active',
      completedAt: null,
      hoursUsed: 1,
      totalHours: 10,
      hoursRemaining: 9,
      packages: []
    };
    const svc = {
      id: 'svc_lp',
      type: 'legal_procedure',
      name: 'הליך בדיקה',
      hoursUsed: 1,
      totalHours: 10,
      stages: [stage]
    };
    const services = [svc];
    const canonicalTotalHours = _recomputeTotalHours(services);
    const canonical = calcClientAggregates(services, canonicalTotalHours);
    MOCK_CLIENTS = [{
      id: 'c_clean',
      data: {
        clientName: 'לקוח נקי',
        services,
        totalHours: canonicalTotalHours,
        hoursUsed: canonical.hoursUsed,
        hoursRemaining: canonical.hoursRemaining,
        minutesUsed: canonical.minutesUsed,
        minutesRemaining: canonical.minutesRemaining,
        isBlocked: canonical.isBlocked,
        isCritical: canonical.isCritical
      }
    }];
    MOCK_TIMESHEET_BY_CLIENT = {
      c_clean: [{ clientId: 'c_clean', parentServiceId: 'svc_lp', stageId: 'stage_a', minutes: 60, date: '2026-07-01' }]
    };

    await dailyInvariantCheck();

    const doc = lastHealthCheck();
    expect(doc.stageInvariants.discrepanciesCount).toBe(0);
    expect(doc.stageInvariants.discrepancies).toHaveLength(0);
    expect(doc.status).toBe('PASS');
  });
});
