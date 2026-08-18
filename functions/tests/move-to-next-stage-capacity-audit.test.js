/**
 * PR-2 — a stage advance is recorded as a capacity movement, not just a status flip.
 *
 * Under the capacity rule (PR-1), advancing a stage MOVES available hours
 * without anyone adding or removing a single one: the closing stage's unused
 * balance stops being available, and the opening stage's budget starts. That is
 * the moment money moves.
 *
 * Before this PR the audit row named which stage closed and which opened, and
 * nothing else. `docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md` (F8) records that
 * nobody is notified on stage advance at all. These tests pin the delta into
 * the trail.
 *
 * NOT tested here (and deliberately so): staleness of the client-level
 * `hoursCapacity` field. An earlier draft of the plan claimed the field would
 * go stale at this exact moment; a review disproved it — `moveToNextStage`
 * routes through `writeClientWithCanonicalAggregates`, which re-derives the
 * field from the services array it is handed. That is covered by
 * `client-writer-capacity.test.js`.
 */

'use strict';

const mockTransaction = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn((id) => ({ id: id || 'auto_id' })),
    where: jest.fn(function () { return this; })
  })),
  runTransaction: mockRunTransaction,
  batch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) }))
};

jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') };
  const Timestamp = { now: jest.fn(() => 'NOW') };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue, Timestamp }),
    auth: jest.fn(() => ({ getUser: jest.fn() }))
  };
});

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return {
    https: { onCall: jest.fn((fn) => fn), HttpsError },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

const mockCheckUserPermissions = jest.fn();
jest.mock('../shared/auth', () => ({ checkUserPermissions: mockCheckUserPermissions }));

const mockLogAction = jest.fn();
jest.mock('../shared/audit', () => ({ logAction: mockLogAction }));

jest.mock('../shared/validators', () => ({ sanitizeString: jest.fn((s) => s) }));

jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: jest.fn().mockResolvedValue({ aggregates: {} }),
  RESTRICTED_KEYS: jest.requireActual('../shared/client-writer').RESTRICTED_KEYS
}));

jest.mock('../lib/audit-critical', () => ({
  logCriticalActionInTxn: jest.fn()
}), { virtual: true });

const { moveToNextStage } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

const stage = (id, totalHours, hoursUsed, status) => ({
  id, name: `שלב ${id}`, status, pricingType: 'hourly',
  totalHours, hoursUsed, hoursRemaining: totalHours - hoursUsed
});

function primeClient(stages) {
  const service = {
    id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי',
    pricingType: 'hourly', status: 'active', stages,
    totalHours: stages.reduce((s, st) => s + st.totalHours, 0),
    hoursUsed: stages.reduce((s, st) => s + st.hoursUsed, 0)
  };
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce({
      exists: true,
      data: () => ({ fullName: 'לקוח', services: [service] })
    })
    .mockResolvedValue({ docs: [], empty: true, forEach: () => {} });
}

const ctx = () => ({ auth: { uid: 'u1', token: { email: 'a@b' } } });

function auditPayload() {
  const call = mockLogAction.mock.calls.find(c => c[0] === 'MOVE_TO_NEXT_STAGE');
  if (!call) throw new Error('MOVE_TO_NEXT_STAGE audit was not written');
  return call[3];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue({
    uid: 'u1', email: 'a@b', username: 'admin', role: 'admin'
  });
  mockLogAction.mockResolvedValue(undefined);
});

describe('the audit records what the advance did to AVAILABLE capacity', () => {
  test('unused hours on the closing stage are recorded as a capacity LOSS', async () => {
    // Stage A: 100h budget, only 30 used → 70h still unused when it closes.
    // Stage B opens with 50h. Available goes 100 → 50.
    primeClient([
      stage('stage_a', 100, 30, 'active'),
      stage('stage_b', 50, 0, 'pending'),
      stage('stage_c', 80, 0, 'pending')
    ]);

    await moveToNextStage({ clientId: '2025994', serviceId: 'lp1' }, ctx());

    expect(auditPayload()).toMatchObject({
      availableHoursBefore: 100,
      availableHoursAfter: 50,
      availableHoursDelta: -50
    });
  });

  test('a larger next stage records a capacity GAIN', async () => {
    primeClient([
      stage('stage_a', 20, 20, 'active'),
      stage('stage_b', 120, 0, 'pending')
    ]);

    await moveToNextStage({ clientId: 'c1', serviceId: 'lp1' }, ctx());

    expect(auditPayload()).toMatchObject({
      availableHoursBefore: 20,
      availableHoursAfter: 120,
      availableHoursDelta: 100
    });
  });

  test('the existing audit fields are preserved, not replaced', async () => {
    primeClient([
      stage('stage_a', 10, 0, 'active'),
      stage('stage_b', 10, 0, 'pending')
    ]);

    await moveToNextStage({ clientId: 'c1', serviceId: 'lp1' }, ctx());

    const payload = auditPayload();
    expect(payload).toMatchObject({
      fromStageId: 'stage_a',
      toStageId: 'stage_b',
      serviceId: 'lp1'
    });
    // and the new ones ride alongside
    expect(payload).toHaveProperty('availableHoursDelta');
  });

  test('capacity figures are finite even when stage hours are malformed', async () => {
    // The capacity split is total by construction; the audit must never carry
    // NaN into a permanent record.
    primeClient([
      { id: 'stage_a', name: 'א', status: 'active', pricingType: 'hourly', totalHours: 'x', hoursUsed: 0 },
      { id: 'stage_b', name: 'ב', status: 'pending', pricingType: 'hourly', totalHours: undefined, hoursUsed: 0 }
    ]);

    await moveToNextStage({ clientId: 'c1', serviceId: 'lp1' }, ctx());

    const payload = auditPayload();
    for (const k of ['availableHoursBefore', 'availableHoursAfter', 'availableHoursDelta']) {
      expect({ field: k, finite: Number.isFinite(payload[k]) }).toEqual({ field: k, finite: true });
    }
  });
});
