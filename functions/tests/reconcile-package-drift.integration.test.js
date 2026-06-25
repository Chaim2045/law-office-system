/**
 * OWN-2 integration test — the LIVE seam: loop → REAL owner → REAL client-writer
 * → REAL engine/aggregator. Only the Firestore SDK boundary + the flag + the audit
 * are mocked; service-writer, client-writer, package-repair-core, aggregates run
 * for real. This is the machine-level coverage of the exact thing OWN-2 makes live
 * (the unit suite mocks the owner) and it pins the devils-advocate's equivalence
 * concern: the number the owner ACTUALLY writes (incl. isBlocked) equals the gate's
 * prediction on the same snapshot.
 */

let mockClientDoc = null;     // { services: [...] }
let mockUpdateTime = null;    // a fake Timestamp with isEqual
let mockEntries = [];          // entry docs for the client
let mockCaptured = null;       // the tx.update payload the client-writer produced

function makeUpdateTime(token) {
  return { _t: token, isEqual(o) { return !!o && o._t === token; } };
}

jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: jest.fn(() => 'TS') };
  const querySnap = (docs) => ({ size: docs.length, docs, forEach: (f) => docs.forEach(f) });
  const clientSnap = () => ({ exists: true, updateTime: mockUpdateTime, data: () => mockClientDoc });
  const firestore = () => ({
    collection: (name) => {
      if (name === 'clients') {
        return {
          get: async () => querySnap([{ id: '2025900', exists: true, updateTime: mockUpdateTime, data: () => mockClientDoc }]),
          doc: () => ({ id: '2025900', path: 'clients/2025900', get: async () => clientSnap() })
        };
      }
      if (name === 'timesheet_entries') {
        return { where: () => ({ get: async () => querySnap(mockEntries.map((e) => ({ id: e.id, data: () => e }))) }) };
      }
      // clientInvariantViolations (client-writer's default violation logger)
      return { add: jest.fn().mockResolvedValue({}), doc: () => ({}) };
    },
    // The owner reads the client doc in-txn (A5) then the client-writer reads it
    // again + updates → capture the update payload. Both gets return the same doc.
    runTransaction: async (fn) => {
      const tx = {
        get: async () => clientSnap(),
        update: (_ref, payload) => { mockCaptured = payload; },
        set: jest.fn()
      };
      return fn(tx);
    }
  });
  firestore.FieldValue = FieldValue;
  return { initializeApp: jest.fn(), firestore: Object.assign(firestore, { FieldValue }) };
});

jest.mock('firebase-functions', () => {
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  return { https: { HttpsError }, logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } };
});

jest.mock('../shared/reconciliation-mode', () => ({ getReconciliationMode: jest.fn().mockResolvedValue('enforce') }));
jest.mock('../lib/audit-critical', () => ({
  logCriticalAction: jest.fn().mockResolvedValue('audit-id'),
  logCriticalActionInTxn: jest.fn()
}));

// NOTE: service-writer / client-writer / package-repair-core / aggregates are NOT
// mocked — the whole point is to exercise the real chain.
const { _test } = require('../scheduled/reconcile-package-drift');
const { calcClientAggregates } = require('../shared/aggregates');
const { _recomputeTotalHours } = require('../shared/client-writer');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

function hoursService(id, { totalHours = 10, storedHoursUsed = 0, pkgHoursUsed = storedHoursUsed, pkgStatus = 'active', pkgRemaining = totalHours - pkgHoursUsed } = {}) {
  return {
    id, type: ST.HOURS, name: 'שירות שעתי', totalHours, hoursUsed: storedHoursUsed,
    hoursRemaining: totalHours - storedHoursUsed, status: 'active',
    packages: [{ id: `${id}_p1`, hours: totalHours, hoursUsed: pkgHoursUsed, hoursRemaining: pkgRemaining, status: pkgStatus, purchaseDate: '2026-01-01T00:00:00.000Z' }]
  };
}

function entry(id, minutes) {
  return { id, minutes, packageId: 's1_p1', createdAt: '2026-02-01T10:00:00.000Z', serviceId: 's1' };
}

beforeEach(() => {
  mockCaptured = null;
  mockUpdateTime = makeUpdateTime('v1');
  mockEntries = [];
});

describe('OWN-2 integration — loop drives the REAL owner + client-writer', () => {
  test('drifted service (8h stored, 3h real) → owner writes the corrected 3h through the client-writer', async () => {
    mockClientDoc = { services: [hoursService('s1', { totalHours: 10, storedHoursUsed: 8 })] };
    mockEntries = [entry('e1', 60), entry('e2', 60), entry('e3', 60)];

    const res = await _test.runReconciliation();

    expect(res.repaired).toBe(1);
    expect(res.failed).toBe(0);
    // The REAL client-writer produced the payload — corrected package + service + client aggregates.
    expect(mockCaptured).toBeTruthy();
    expect(mockCaptured.services[0].packages[0].hoursUsed).toBe(3); // 8 → 3 (ledger truth, via the real engine)
    expect(mockCaptured.services[0].hoursUsed).toBe(3);
    expect(mockCaptured.hoursUsed).toBe(3);                          // client roll-up
    expect(mockCaptured.totalHours).toBe(10);                       // intake preserved
  });

  test('block-flip equivalence: the isBlocked the owner WRITES == the gate prediction (no surprise auto-block)', async () => {
    mockClientDoc = { services: [hoursService('s1', { totalHours: 10, storedHoursUsed: 8 })] };
    mockEntries = [entry('e1', 60), entry('e2', 60), entry('e3', 60)];

    // Independently compute the gate's prediction on the repaired snapshot.
    const plan = _test.planServiceReconciliation(mockClientDoc.services[0], mockClientDoc.services, mockEntries);
    const predictedServices = mockClientDoc.services.map((s) => (s.id === 's1' ? plan.repairedService : s));
    const predictedIsBlocked = calcClientAggregates(predictedServices, _recomputeTotalHours(predictedServices)).isBlocked;

    await _test.runReconciliation();

    // What the REAL client-writer actually wrote must equal the gate's prediction.
    expect(mockCaptured.isBlocked).toBe(predictedIsBlocked);
    expect(mockCaptured.isBlocked).toBe(false); // 3h of 10h → not blocked
  });

  test('phantom-block correction: a wrongly-blocked client (12h stored) is UNBLOCKED by the real write (true→false)', async () => {
    // stored 12h (remaining -2 → blocked); real entries 3h → remaining 7 → unblock.
    mockClientDoc = { services: [hoursService('s1', { totalHours: 10, storedHoursUsed: 12, pkgHoursUsed: 12, pkgStatus: 'depleted', pkgRemaining: -2 })] };
    mockEntries = [entry('e1', 60), entry('e2', 60), entry('e3', 60)];

    const res = await _test.runReconciliation();

    expect(res.repaired).toBe(1);
    expect(mockCaptured.services[0].hoursUsed).toBe(3);
    expect(mockCaptured.isBlocked).toBe(false); // the real client-writer cleared the phantom block
  });
});
