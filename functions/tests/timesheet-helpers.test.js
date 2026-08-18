/**
 * CHARACTERIZATION goldens — timesheet/helpers.js reservation + event primitives.
 *
 * helpers.js had ZERO direct tests (it is jest.mocked in every suite that touches
 * timesheet/index.js), so its behavior was entirely unpinned. This suite pins the
 * CURRENT behavior AS-IS (quirks included) of the FOUR LIVE primitives — the ones
 * timesheet/index.js actually calls: createReservation (:731), createTimeEvent
 * (:1169), commitReservation (:1202), rollbackReservation (:1229/:1242). A future
 * JS→TS migration of this leaf module can't silently drift the event/reservation
 * doc shapes or the rollback error-fallback.
 *
 * SCOPE NOTE (deliberate): the fifth export, checkVersionAndLock, is NOT tested
 * here — a repo-wide grep found it has ZERO callers (dead code). Dead code should
 * be removed, not pinned; it was flagged as a separate cleanup task rather than
 * ported into a goldens net.
 *
 * Quirks pinned:
 *   - createTimeEvent / createReservation generate ids via Date.now()+Math.random()
 *     ('evt_'/'rsv_' prefixes) → non-deterministic, so the tests pin the prefix +
 *     the written doc shape, not an exact id.
 *   - rollbackReservation stores `error.message || 'Unknown error'` → an error object
 *     with no `.message` is recorded as the literal string 'Unknown error'.
 *
 * Harness: helpers.js captures `const db = admin.firestore()` at module load, so the
 * firebase-admin mock is installed before require; db.collection().doc() exposes
 * set/update spies. No timesheet CF orchestration here — this is the leaf module.
 */

const mockSet = jest.fn(async () => {});
const mockUpdate = jest.fn(async () => {});

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id,
      _collection: name,
      set: (payload) => mockSet(name, id, payload),
      update: (payload) => mockUpdate(name, id, payload)
    }))
  }))
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n })),
    arrayUnion: jest.fn((...items) => ({ _arrayUnion: items }))
  };
  const Timestamp = {
    now: jest.fn(() => 'NOW'),
    fromDate: jest.fn((d) => ({ _ts: d.toISOString() }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue, Timestamp }),
    auth: jest.fn(() => ({ getUser: jest.fn() }))
  };
});

const {
  createTimeEvent,
  createReservation,
  commitReservation,
  rollbackReservation
} = require('../timesheet/helpers');

beforeEach(() => {
  jest.clearAllMocks();
  mockSet.mockClear();
  mockUpdate.mockClear();
});

// ════════════════════════════════════════════════════════════════
// createTimeEvent — event sourcing (append to time_events)
// ════════════════════════════════════════════════════════════════

describe('createTimeEvent — characterization', () => {

  test('writes a time_events doc with mapped fields + defaults, returns an evt_ id', async () => {
    const id = await createTimeEvent({
      eventType: 'TIME_ADDED',
      caseId: '2025001',
      performedBy: 'user1',
      performedByEmail: 'user@test',
      data: { minutes: 60 }
    });

    expect(typeof id).toBe('string');
    expect(id.startsWith('evt_')).toBe(true);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [coll, docId, event] = mockSet.mock.calls[0];
    expect(coll).toBe('time_events');
    expect(docId).toBe(id);
    expect(event).toMatchObject({
      eventId: id,
      eventType: 'TIME_ADDED',
      caseId: '2025001',
      // optional entity ids default to null
      serviceId: null, stageId: null, packageId: null, taskId: null, timesheetEntryId: null,
      data: { minutes: 60 },
      performedBy: 'user1',
      performedByEmail: 'user@test',
      before: {}, after: {},
      idempotencyKey: null, userAgent: null, ipAddress: null,
      processed: true,
      processingErrors: [],
      timestamp: 'SERVER_TIMESTAMP'
    });
  });

  test('passes through the optional entity ids when provided', async () => {
    await createTimeEvent({
      eventType: 'TIME_UPDATED', caseId: 'c', performedBy: 'u', performedByEmail: 'e',
      serviceId: 's1', stageId: 'st1', packageId: 'p1', taskId: 't1', timesheetEntryId: 'ts1',
      idempotencyKey: 'k1', before: { x: 1 }, after: { x: 2 }, errors: ['e1']
    });

    const event = mockSet.mock.calls[0][2];
    expect(event).toMatchObject({
      serviceId: 's1', stageId: 'st1', packageId: 'p1', taskId: 't1', timesheetEntryId: 'ts1',
      idempotencyKey: 'k1', before: { x: 1 }, after: { x: 2 }, processingErrors: ['e1']
    });
  });
});

// ════════════════════════════════════════════════════════════════
// createReservation — two-phase commit, phase 1 (reserve)
// ════════════════════════════════════════════════════════════════

describe('createReservation — characterization', () => {

  test('writes a reservations doc status pending, returns an rsv_ id', async () => {
    const id = await createReservation({ caseId: '2025001', minutes: 60, performedBy: 'user1' });

    expect(typeof id).toBe('string');
    expect(id.startsWith('rsv_')).toBe(true);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [coll, docId, rsv] = mockSet.mock.calls[0];
    expect(coll).toBe('reservations');
    expect(docId).toBe(id);
    expect(rsv).toMatchObject({
      reservationId: id,
      status: 'pending',
      caseId: '2025001',
      minutes: 60,
      performedBy: 'user1',
      operations: [],            // default
      createdAt: 'SERVER_TIMESTAMP'
    });
    // expiresAt = Timestamp.fromDate(now + 5min) → the fake wraps it as {_ts}
    expect(rsv.expiresAt).toHaveProperty('_ts');
  });

  test('passes through provided operations', async () => {
    await createReservation({ caseId: 'c', minutes: 30, performedBy: 'u', operations: [{ op: 'deduct' }] });
    expect(mockSet.mock.calls[0][2].operations).toEqual([{ op: 'deduct' }]);
  });
});

// ════════════════════════════════════════════════════════════════
// commitReservation / rollbackReservation — phase 2
// ════════════════════════════════════════════════════════════════

describe('commitReservation — characterization', () => {

  test('updates the reservation status to committed', async () => {
    await commitReservation('rsv_x');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [coll, docId, payload] = mockUpdate.mock.calls[0];
    expect(coll).toBe('reservations');
    expect(docId).toBe('rsv_x');
    expect(payload).toEqual({ status: 'committed', committedAt: 'SERVER_TIMESTAMP' });
  });
});

describe('rollbackReservation — characterization', () => {

  test('updates status rolled_back with the error message', async () => {
    await rollbackReservation('rsv_x', new Error('boom'));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [coll, docId, payload] = mockUpdate.mock.calls[0];
    expect(coll).toBe('reservations');
    expect(docId).toBe('rsv_x');
    expect(payload).toMatchObject({
      status: 'rolled_back',
      rolledBackAt: 'SERVER_TIMESTAMP',
      error: 'boom'
    });
  });

  test('QUIRK: an error object with no .message → recorded as "Unknown error"', async () => {
    await rollbackReservation('rsv_x', {}); // no .message property

    expect(mockUpdate.mock.calls[0][2].error).toBe('Unknown error');
  });
});
