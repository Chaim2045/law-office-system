/**
 * PR-2 — atomic exactly-once idempotency for createTimesheetEntry_v2.
 *
 * Mirrors tests/quicklog-idempotency.test.js and
 * tests/addtimetotask-idempotency.test.js (PR-1's canonical suite): this
 * function used to call the NON-ATOMIC helpers.checkIdempotency() BEFORE the
 * transaction / helpers.registerIdempotency() AFTER the transaction committed.
 * That gap allowed a lost-ack retry on a weak network to slip between the two
 * calls and re-run the write (a duplicate timesheet entry / duplicate hours).
 *
 * PR-2 moved createTimesheetEntry_v2 onto the SAME atomic, transaction-scoped
 * primitive functions/addTimeToTask_v2.js uses (PR-1), via the shared
 * functions/shared/idempotency.js module. This suite pins:
 *
 *   - No idempotencyKey → normal execution (backward compat), no
 *     processed_operations doc created.
 *   - New idempotencyKey → executes the transaction + records
 *     processed_operations via transaction.create() (NOT .set()), in the
 *     SAME transaction as the real writes.
 *   - Existing idempotencyKey (Phase-1 read finds it, AFTER the client + task
 *     reads) → returns the stored result, performs NO client write / NO task
 *     update / NO timesheet entry / NO cost write, and skips the
 *     post-transaction event-sourcing / reservation-commit / audit-log steps
 *     (no NEW mutation happened on this call, so no new side-effect logging).
 *   - Concurrent already-exists (a sibling call won the transaction.create()
 *     race) → returns the sibling's stored result, does NOT throw, does NOT
 *     retry into a duplicate write, and likewise skips the post-transaction
 *     logging steps.
 */

const mockCallOrder = [];
function mockRecordCall(name, args) {
  mockCallOrder.push({ name, args });
}

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn((...args) => mockRecordCall('transaction.set', args)),
  update: jest.fn((...args) => mockRecordCall('transaction.update', args)),
  create: jest.fn((...args) => mockRecordCall('transaction.create', args))
};

const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockProcessedOpsGet = jest.fn(async () => ({ exists: false }));

function routedDirectGet(collectionName) {
  if (collectionName === 'processed_operations') return mockProcessedOpsGet();
  return Promise.resolve({ exists: false });
}

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id: id || `auto_${Date.now()}`,
      _collection: name,
      get: () => routedDirectGet(name)
    }))
  })),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
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

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return {
    https: { onCall: jest.fn((fn) => fn), HttpsError },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  };
});

jest.mock('../shared/auth', () => ({
  checkUserPermissions: jest.fn().mockResolvedValue({
    uid: 'user1',
    email: 'user@test',
    username: 'user',
    role: 'employee'
  })
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));

// PR-2: no more checkIdempotency/registerIdempotency in ./helpers.
jest.mock('../timesheet/helpers', () => ({
  createTimeEvent: jest.fn().mockResolvedValue(undefined),
  createReservation: jest.fn().mockResolvedValue('reservation1'),
  commitReservation: jest.fn().mockResolvedValue(undefined),
  rollbackReservation: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../timesheet/internal-case', () => ({
  getOrCreateInternalCase: jest.fn().mockResolvedValue({
    clientId: 'internal_office',
    id: 'internal_case_1',
    clientName: 'פנימי'
  })
}));

// Deduction/aggregation modules NOT mocked — real logic runs (mirrors
// tests/create-timesheet-entry-v2-canonical-helper.test.js) so the canonical
// helper's internal transaction.get(clientRef) + aggregate math behave
// exactly as in production.

const { createTimesheetEntry_v2 } = require('../timesheet/index');
const { createTimeEvent, createReservation, commitReservation } = require('../timesheet/helpers');
const { logAction } = require('../shared/audit');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── fixtures ──────────────────────────────────────────────────

function makeHoursService(id, { totalHours = 10, hoursUsed = 0 } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    packages: [{
      id: `${id}_pkg_1`,
      type: 'initial',
      hours: totalHours,
      hoursUsed,
      hoursRemaining: totalHours - hoursUsed,
      status: 'active'
    }],
    status: 'active'
  };
}

function makeClientDoc(services = [], version = 5) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      clientName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
      _version: version
    })
  };
}

function makeTaskDoc() {
  return {
    exists: true,
    data: () => ({
      title: 'משימה',
      actualMinutes: 0,
      actualHours: 0
    })
  };
}

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

const baseData = {
  clientId: 'c1',
  date: '2026-05-18',
  minutes: 60,
  action: 'work',
  taskId: 'task1',
  serviceId: 'svc1'
};

function timesheetEntryWrites() {
  return mockTransaction.set.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'timesheet_entries'
  );
}
function clientHelperUpdates() {
  return mockTransaction.update.mock.calls.filter(
    ([, payload]) => payload && Array.isArray(payload.services)
  );
}
function taskUpdates() {
  return mockTransaction.update.mock.calls.filter(
    ([, payload]) => payload && 'actualMinutes' in payload && !('services' in payload)
  );
}
function idempotencyCreates() {
  return mockTransaction.create.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'processed_operations'
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
  mockProcessedOpsGet.mockReset();
  mockProcessedOpsGet.mockResolvedValue({ exists: false });
});

describe('createTimesheetEntry_v2 — atomic idempotency (PR-2)', () => {

  // ───────────────────────────────────────────────────────────
  // No key → normal execution
  // ───────────────────────────────────────────────────────────

  test('no idempotencyKey → executes normally, no processed_operations doc created', async () => {
    const clientDoc = makeClientDoc([makeHoursService('svc1')], 5);
    const taskDoc = makeTaskDoc();
    // Phase 1: client, task. Phase 3: helper's internal client re-read (cache hit).
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await createTimesheetEntry_v2(baseData, makeCtx());

    expect(result.success).toBe(true);
    expect(timesheetEntryWrites()).toHaveLength(1);
    expect(idempotencyCreates()).toHaveLength(0);
    // Post-transaction logging steps ran (a real mutation happened).
    expect(createTimeEvent).toHaveBeenCalledTimes(1);
    expect(commitReservation).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(1);
  });

  // ───────────────────────────────────────────────────────────
  // New key → executes transaction + records via transaction.create()
  // ───────────────────────────────────────────────────────────

  test('new idempotencyKey → executes transaction + records processed_operations via create()', async () => {
    const clientDoc = makeClientDoc([makeHoursService('svc1')], 5);
    const taskDoc = makeTaskDoc();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce({ exists: false })  // idempotency: not yet processed
      .mockResolvedValueOnce(clientDoc);          // helper internal re-read

    const data = { ...baseData, idempotencyKey: 'timesheet_test_key_123' };
    const result = await createTimesheetEntry_v2(data, makeCtx());

    expect(result.success).toBe(true);
    expect(timesheetEntryWrites()).toHaveLength(1);
    expect(clientHelperUpdates()).toHaveLength(1);
    expect(taskUpdates()).toHaveLength(1);

    const creates = idempotencyCreates();
    expect(creates).toHaveLength(1);
    const [ref, doc] = creates[0];
    expect(ref.id).toBe('timesheet_test_key_123');
    expect(doc.idempotencyKey).toBe('timesheet_test_key_123');
    expect(doc.status).toBe('completed');
    expect(doc.result).toEqual(result);

    // A real mutation happened → post-transaction logging steps ran.
    expect(createTimeEvent).toHaveBeenCalledTimes(1);
    expect(commitReservation).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(1);
  });

  // ───────────────────────────────────────────────────────────
  // Existing key → Phase-1 read finds it, returns stored result, NO writes,
  // NO extra logging.
  // ───────────────────────────────────────────────────────────

  test('existing idempotencyKey → Phase-1 read finds it, returns stored result, NO writes, NO extra logging', async () => {
    const cachedResult = {
      success: true,
      entryId: 'cached_entry_1',
      entry: { id: 'cached_entry_1', clientId: 'c1' },
      version: 6
    };
    const clientDoc = makeClientDoc([makeHoursService('svc1')], 5);
    const taskDoc = makeTaskDoc();

    // Phase 1: client, task, THEN idempotency (exists → short-circuit).
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce({ exists: true, data: () => ({ result: cachedResult }) });

    const data = { ...baseData, idempotencyKey: 'timesheet_already_done' };
    const result = await createTimesheetEntry_v2(data, makeCtx());

    expect(result).toEqual(cachedResult);
    // No mutation at all.
    expect(timesheetEntryWrites()).toHaveLength(0);
    expect(clientHelperUpdates()).toHaveLength(0);
    expect(taskUpdates()).toHaveLength(0);
    expect(idempotencyCreates()).toHaveLength(0);

    // No NEW mutation happened on this call → skip event sourcing / commit / audit log.
    expect(createTimeEvent).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
    // Reservation was still created before the transaction (STEP 3 runs
    // unconditionally) but must NOT be committed for a replay (no new work).
    expect(createReservation).toHaveBeenCalledTimes(1);
    expect(commitReservation).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────
  // Concurrent already-exists → post-catch read finds winner doc → replay
  // ───────────────────────────────────────────────────────────

  test('concurrent already-exists → post-catch read finds winner doc → returns stored result (no throw, no extra logging)', async () => {
    const storedResult = {
      success: true,
      entryId: 'entry_from_winner',
      entry: { id: 'entry_from_winner', clientId: 'c1' },
      version: 6
    };
    const clientDoc = makeClientDoc([makeHoursService('svc1')], 5);
    const taskDoc = makeTaskDoc();

    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce({ exists: false })  // idempotency: not visible in-txn yet
        .mockResolvedValueOnce(clientDoc);          // helper internal re-read
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });

    mockProcessedOpsGet.mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });

    const data = { ...baseData, idempotencyKey: 'timesheet_concurrent' };
    const result = await createTimesheetEntry_v2(data, makeCtx());

    expect(result).toEqual(storedResult);
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1); // no second attempt

    // The transaction DID write (before losing the create() race) — but since
    // we return the WINNER's result (not this call's own), this call's own
    // post-transaction logging must not double up either.
    expect(createTimeEvent).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
    expect(commitReservation).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────
  // already-exists, winner not visible yet → retries → Phase-1 read replays
  // ───────────────────────────────────────────────────────────

  test('already-exists, winner not visible yet → retries → Phase-1 read returns stored result', async () => {
    const storedResult = {
      success: true,
      entryId: 'entry_from_winner',
      entry: { id: 'entry_from_winner', clientId: 'c1' },
      version: 6
    };
    const clientDoc = makeClientDoc([makeHoursService('svc1')], 5);
    const taskDoc = makeTaskDoc();

    // Attempt 1: body runs, create() throws already-exists at commit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce(clientDoc);
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    // Post-catch read #1: winner not visible yet → fall through to retry.
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: false });

    // Attempt 2: Phase-1 idempotency read now finds the committed doc.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });
      return fn(mockTransaction);
    });

    const data = { ...baseData, idempotencyKey: 'timesheet_concurrent_slow' };
    const result = await createTimesheetEntry_v2(data, makeCtx());

    expect(result).toEqual(storedResult);
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    expect(createTimeEvent).not.toHaveBeenCalled();
    expect(commitReservation).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────
  // Exhausted retries on already-exists (winner never visible) → Hebrew abort
  // (G1: never leak the raw English SDK 'already exists' string; never surface
  // a false failure that would push a fresh-key re-submit = a real duplicate)
  // ───────────────────────────────────────────────────────────

  test('exhausted already-exists retries (winner never visible) → Hebrew aborted error, no raw SDK string', async () => {
    const clientDoc = makeClientDoc([makeHoursService('svc1')], 5);
    const taskDoc = makeTaskDoc();

    // EVERY attempt: body runs, create() throws already-exists at commit, and
    // the winner's committed doc is NEVER visible to the post-catch replay read.
    mockRunTransaction.mockImplementation(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce(clientDoc);
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    mockProcessedOpsGet.mockResolvedValue({ exists: false }); // never visible

    const data = { ...baseData, idempotencyKey: 'timesheet_never_visible' };

    let caught;
    try {
      await createTimesheetEntry_v2(data, makeCtx());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught.code).toBe('aborted');
    expect(caught.message).toMatch(/נקלט/);        // Hebrew "was recorded"
    expect(caught.message).not.toMatch(/already exists/); // no raw SDK leak
    // Exactly MAX_IDEMPOTENCY_RETRIES (3) attempts before giving up.
    expect(mockRunTransaction).toHaveBeenCalledTimes(3);
  });
});
