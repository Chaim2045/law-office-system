/**
 * PR-1 — exactly-once idempotency for addTimeToTask.
 *
 * The User App auto-retries addTimeToTask up to 3x on a slow network. If the
 * server's first (slow) call already succeeded, a retry used to re-run the write
 * → a DUPLICATE time entry. This suite pins the fix:
 *
 *   (1) same idempotencyKey where processed_operations already has the doc →
 *       returns the STORED result and performs NO task update / NO cost write /
 *       NO arrayUnion (the duplicate is blocked, hours not double-counted).
 *   (2) first call WITH a key → writes processed_operations via transaction.create()
 *       (and performs the real task/entry writes).
 *   (3) NO key → behaves exactly as before (still writes; no processed_operations doc).
 *   (4) a malformed key → HttpsError('invalid-argument') before any write.
 *
 * Mock style mirrors add-time-to-task-canonical-helper.test.js (SDK boundary
 * mocked; the transaction is a plain object recording get/set/update/create).
 */

'use strict';

// ── invocation recorder ──
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

// Two DIRECT (non-transaction) doc.get() call sites exist in this flow:
//   1. resolveEmployeeCost() reads employee_costs/{email} BEFORE the txn (H.2).
//   2. the post-catch concurrent-replay path reads processed_operations/{key}.
// They must not share a stub, or (1) would consume a value a test queued for (2).
// So the .get() is routed by collection:
//   - employee_costs        → always {exists:false} (cost=null; irrelevant here)
//   - processed_operations  → mockProcessedOpsGet (tests queue the winner doc)
const mockProcessedOpsGet = jest.fn(async () => ({ exists: false }));

function routedDirectGet(collectionName) {
  if (collectionName === 'processed_operations') return mockProcessedOpsGet();
  return Promise.resolve({ exists: false }); // employee_costs + any other direct read
}

// Track which collections .doc() is asked for, so we can assert "no cost write".
// The doc handle also carries a `.get()` (used ONLY by direct, non-txn reads).
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
    increment: jest.fn((n) => ({ _increment: n })),
    arrayUnion: jest.fn((v) => ({ _arrayUnion: v }))
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

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  isValidIsraeliPhone: jest.fn(() => true),
  isValidEmail: jest.fn(() => true)
}));

// Spy on the canonical writer — if it runs, hours WOULD be mutated.
const mockHelperSpy = jest.fn();
jest.mock('../shared/client-writer', () => {
  const actual = jest.requireActual('../shared/client-writer');
  return {
    ...actual,
    writeClientWithCanonicalAggregates: jest.fn(async (transaction, ref, payload, opts) => {
      mockHelperSpy(transaction, ref, payload, opts);
      return actual.writeClientWithCanonicalAggregates(transaction, ref, payload, opts);
    })
  };
});

const { addTimeToTaskWithTransaction } = require('../addTimeToTask_v2');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ── fixtures ──
function makeTaskDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      employee: 'user@test.com',
      clientId: 'c1',
      serviceId: 'svc_1',
      description: 'מטלה',
      actualMinutes: 0,
      estimatedMinutes: 60,
      ...overrides
    })
  };
}

function makeHoursService(id, { totalHours = 10 } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    packages: [{
      id: `${id}_pkg_initial`,
      type: 'initial',
      hours: totalHours,
      hoursUsed: 0,
      hoursRemaining: totalHours,
      status: 'active'
    }],
    status: 'active'
  };
}

function makeClientDoc(services = []) {
  const totalHours = services.reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length
    })
  };
}

const defaultUser = { uid: 'user1', email: 'user@test.com', username: 'testuser', role: 'manager' };
const baseData = { taskId: 'task1', minutes: 60, date: '2026-05-18', description: 'work' };

// Count only the entry-cost + timesheet writes (transaction.set on non-idempotency docs).
function costWrites() {
  return mockTransaction.set.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'timesheet_entry_costs'
  );
}
function taskUpdates() {
  // The task update carries actualMinutes/timeEntries; the client helper is separate.
  return mockTransaction.update.mock.calls.filter(
    ([, payload]) => payload && ('actualMinutes' in payload || 'timeEntries' in payload)
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
  // Default: the post-catch processed_operations read resolves to "not found".
  // Concurrent-replay tests queue an explicit .mockResolvedValueOnce(winner doc).
  mockProcessedOpsGet.mockReset();
  mockProcessedOpsGet.mockResolvedValue({ exists: false });
});

// ═══════════════════════════════════════════════════════════════
describe('PR-1 — addTimeToTask idempotency', () => {
  // (1) DUPLICATE blocked: key present + processed_operations doc exists
  test('replay: existing processed_operations doc → returns stored result, NO writes', async () => {
    const storedResult = { success: true, taskId: 'task1', newActualMinutes: 60, timesheetAutoCreated: true };
    const taskDoc = makeTaskDoc();
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);

    // reads in Phase 1: task, client, THEN idempotency (exists → short-circuit).
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });

    const result = await addTimeToTaskWithTransaction(
      mockDb, { ...baseData, idempotencyKey: 'key-abc-123' }, defaultUser
    );

    expect(result).toEqual(storedResult);
    // No mutation at all.
    expect(mockHelperSpy).not.toHaveBeenCalled();           // no client hours write
    expect(taskUpdates()).toHaveLength(0);                  // no arrayUnion / actualMinutes
    expect(costWrites()).toHaveLength(0);                   // no cost doc write
    expect(mockTransaction.create).not.toHaveBeenCalled();  // no new idempotency doc
  });

  // (2) FIRST call with a key → writes processed_operations via transaction.create()
  test('first call with key → performs writes AND records processed_operations via create()', async () => {
    const taskDoc = makeTaskDoc();
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce({ exists: false })  // idempotency: not yet processed
      .mockResolvedValueOnce(clientDoc);         // helper internal read

    const result = await addTimeToTaskWithTransaction(
      mockDb, { ...baseData, idempotencyKey: 'key-first-run' }, defaultUser
    );

    expect(result.success).toBe(true);
    expect(taskUpdates()).toHaveLength(1);   // real task write happened
    expect(costWrites()).toHaveLength(1);    // real cost write happened

    // processed_operations recorded via .create() (NOT .set()), with the SAME result.
    expect(mockTransaction.create).toHaveBeenCalledTimes(1);
    const [ref, doc] = mockTransaction.create.mock.calls[0];
    expect(ref._collection).toBe('processed_operations');
    expect(ref.id).toBe('key-first-run');
    expect(doc.idempotencyKey).toBe('key-first-run');
    expect(doc.status).toBe('completed');
    expect(doc.result).toEqual(result);      // same object persisted verbatim
    expect(doc.result.newActualMinutes).toBe(60);
  });

  // (5) CONCURRENT idempotent double: a sibling call with the SAME key won the
  // transaction.create() race → our create throws ALREADY_EXISTS. The post-catch
  // direct read of processed_operations sees the winner's doc → return its stored
  // result (clean replay), NOT a failure, NOT a second write.
  test('concurrent already-exists → post-catch read finds winner doc → returns stored result (no throw)', async () => {
    const storedResult = { success: true, taskId: 'task1', newActualMinutes: 60, timesheetAutoCreated: true };
    const taskDoc = makeTaskDoc();
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);

    // The transaction runs (idempotency read = not-yet-present), does its writes,
    // then transaction.create throws ALREADY_EXISTS at commit (sibling won the race).
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce({ exists: false })  // idempotency: not visible in-txn yet
        .mockResolvedValueOnce(clientDoc);         // helper internal read
      await fn(mockTransaction);                    // runs the body (writes recorded)
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;                                    // commit-time race loss
    });

    // Post-catch direct read: the winner's committed doc is now visible.
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });

    const result = await addTimeToTaskWithTransaction(
      mockDb, { ...baseData, idempotencyKey: 'key-concurrent' }, defaultUser
    );

    // Clean replay — returns the winner's stored result, does NOT throw.
    expect(result).toEqual(storedResult);
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);   // the post-catch direct read happened
    // No SECOND attempt (we returned from the catch, did not retry into a new txn).
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  // (5b) already-exists but the winner's doc is NOT visible yet → the catch falls
  // through to a RETRY; on the retry the Phase-1 idempotency read finds the committed
  // doc and short-circuits with the stored result (still no duplicate, still no throw).
  test('already-exists, winner not visible yet → retries → Phase-1 read returns stored result', async () => {
    const storedResult = { success: true, taskId: 'task1', newActualMinutes: 60, timesheetAutoCreated: true };
    const taskDoc = makeTaskDoc();
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);

    // Attempt 1: body runs, create throws already-exists at commit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce(clientDoc);
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    // Post-catch read #1: winner not visible yet → fall through to retry.
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: false });

    // Attempt 2: the Phase-1 idempotency read now finds the committed doc → short-circuit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });
      return fn(mockTransaction);
    });

    const result = await addTimeToTaskWithTransaction(
      mockDb, { ...baseData, idempotencyKey: 'key-concurrent-slow' }, defaultUser
    );

    expect(result).toEqual(storedResult);
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);  // it retried
  });

  // (3) NO key → behaves as before (writes, but no processed_operations doc)
  test('no key → still writes, no processed_operations create, entry _idempotencyKey null', async () => {
    const taskDoc = makeTaskDoc();
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);

    // Only 3 reads now: task, client, helper internal (no idempotency get).
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, { ...baseData }, defaultUser);

    expect(result.success).toBe(true);
    expect(taskUpdates()).toHaveLength(1);
    expect(costWrites()).toHaveLength(1);
    expect(mockTransaction.create).not.toHaveBeenCalled();

    // The timeEntry (arrayUnion'd onto the task) carries _idempotencyKey: null.
    const arrayUnionArg = mockTransaction.update.mock.calls
      .map(([, p]) => p && p.timeEntries && p.timeEntries._arrayUnion)
      .find(Boolean);
    expect(arrayUnionArg).toBeDefined();
    expect(arrayUnionArg._idempotencyKey).toBeNull();
  });

  // (2b) the entry carries the forensic key when supplied
  test('first call with key → timeEntry stamped with _idempotencyKey', async () => {
    const taskDoc = makeTaskDoc();
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce(clientDoc);

    await addTimeToTaskWithTransaction(mockDb, { ...baseData, idempotencyKey: 'key-stamp' }, defaultUser);

    const arrayUnionArg = mockTransaction.update.mock.calls
      .map(([, p]) => p && p.timeEntries && p.timeEntries._arrayUnion)
      .find(Boolean);
    expect(arrayUnionArg._idempotencyKey).toBe('key-stamp');
  });

  // (4) malformed key → HttpsError before any write / any transaction
  describe('key validation', () => {
    const bad = [
      ['spaces', 'has space'],
      ['symbols', 'key@!#'],
      ['too long', 'x'.repeat(201)],
      ['non-string', 12345]
    ];
    test.each(bad)('rejects a malformed key (%s) with invalid-argument, no transaction', async (_label, key) => {
      await expect(
        addTimeToTaskWithTransaction(mockDb, { ...baseData, idempotencyKey: key }, defaultUser)
      ).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    test('accepts a crypto.randomUUID-shaped key', async () => {
      const taskDoc = makeTaskDoc();
      const clientDoc = makeClientDoc([makeHoursService('svc_1')]);
      mockTransaction.get
        .mockResolvedValueOnce(taskDoc)
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce(clientDoc);

      const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
      const result = await addTimeToTaskWithTransaction(mockDb, { ...baseData, idempotencyKey: uuid }, defaultUser);
      expect(result.success).toBe(true);
      expect(mockTransaction.create.mock.calls[0][0].id).toBe(uuid);
    });
  });
});
