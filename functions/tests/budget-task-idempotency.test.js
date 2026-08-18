/**
 * PR-3a — atomic exactly-once idempotency for createBudgetTask + adjustTaskBudget.
 *
 * Mirrors tests/timesheet-entry-v2-idempotency.test.js (PR-2's canonical suite):
 * these two budget-task write paths used to run a bare `db.runTransaction` with
 * NO idempotency protection. On a weak network, FirebaseService.call times out
 * and auto-retries a write whose server-side effect already succeeded → a
 * DUPLICATE task / duplicate budget adjustment.
 *
 * PR-3a moves both onto the SAME atomic, transaction-scoped primitive
 * functions/addTimeToTask_v2.js uses (PR-1), via the shared
 * functions/shared/idempotency.js module. This suite pins, for BOTH functions:
 *
 *   - No idempotencyKey → normal execution (backward compat), no
 *     processed_operations doc created.
 *   - New idempotencyKey → executes the transaction + records
 *     processed_operations via transaction.create() (NOT .set()), in the SAME
 *     transaction as the real writes; the stored doc.result is JSON-safe.
 *   - Existing idempotencyKey (Phase-1 read finds it, AFTER the task/client
 *     read) → returns the stored result, performs NO task/approval/update
 *     write, and skips the post-transaction audit log (no NEW mutation).
 *   - Concurrent already-exists → replays the sibling's stored result (no throw,
 *     no duplicate audit).
 *   - Exhausted already-exists (winner never visible) → Hebrew HttpsError
 *     ('aborted', /נקלט/, NEVER /already exists/), exactly 3 runTransaction
 *     attempts.
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
      id: id || `auto_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      _collection: name,
      get: () => routedDirectGet(name)
    })),
    // adjustTaskBudget uses a plain (non-txn) query nowhere; createBudgetTask's
    // cancel path (not under test) does — keep a no-op where() for safety.
    where: jest.fn(() => ({ limit: jest.fn(() => ({ get: jest.fn(async () => ({ empty: true, docs: [] })) })) }))
  })),
  runTransaction: mockRunTransaction
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
    role: 'employee',
    employee: { name: 'שם עובד', isAdmin: false }
  })
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));

// addTimeToTask path is unrelated to createBudgetTask/adjustTaskBudget; stub it
// so requiring budget-tasks/index.js doesn't drag in the deduction engine.
jest.mock('../addTimeToTask_v2', () => ({
  addTimeToTaskWithTransaction: jest.fn().mockResolvedValue({ success: true })
}));

const { createBudgetTask, adjustTaskBudget } = require('../budget-tasks/index');
const { logAction } = require('../shared/audit');

// ─── fixtures ──────────────────────────────────────────────────

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

function makeClientDoc() {
  return {
    exists: true,
    data: () => ({ clientName: 'לקוח טסט', caseNumber: '2025001' })
  };
}

function makeTaskDoc({ employee = 'user@test', status = 'פעיל', estimatedMinutes = 120, actualMinutes = 60 } = {}) {
  return {
    exists: true,
    data: () => ({ employee, status, estimatedMinutes, actualMinutes })
  };
}

const baseCreateData = {
  description: 'משימת בדיקה',
  clientId: '2025001',
  branch: 'ראשי',
  serviceId: 'svc1',
  estimatedMinutes: 120
};

const baseAdjustData = {
  taskId: 'task1',
  newEstimate: 180,
  reason: 'חריגה'
};

function taskCreates() {
  return mockTransaction.set.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'budget_tasks'
  );
}
function approvalCreates() {
  return mockTransaction.set.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'pending_task_approvals'
  );
}
function taskUpdates() {
  return mockTransaction.update.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'budget_tasks'
  );
}
function idempotencyCreates() {
  return mockTransaction.create.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'processed_operations'
  );
}

// A JSON-safe object must round-trip through JSON without loss and contain no
// admin sentinel markers (serverTimestamp / arrayUnion / Timestamp wrappers).
function assertJsonSafe(obj) {
  const seen = JSON.parse(JSON.stringify(obj));
  expect(seen).toEqual(obj);
  const flat = JSON.stringify(obj);
  expect(flat).not.toContain('SERVER_TIMESTAMP');
  expect(flat).not.toContain('_arrayUnion');
  expect(flat).not.toContain('_increment');
  expect(flat).not.toContain('_ts');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
  mockProcessedOpsGet.mockReset();
  mockProcessedOpsGet.mockResolvedValue({ exists: false });
});

// ════════════════════════════════════════════════════════════════
// createBudgetTask
// ════════════════════════════════════════════════════════════════

describe('createBudgetTask — atomic idempotency (PR-3a)', () => {

  test('no idempotencyKey → executes normally, no processed_operations create', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc()); // client read only

    const result = await createBudgetTask({ ...baseCreateData }, makeCtx());

    expect(result.success).toBe(true);
    expect(result.taskId).toBeTruthy();
    expect(taskCreates()).toHaveLength(1);
    expect(approvalCreates()).toHaveLength(1);
    expect(idempotencyCreates()).toHaveLength(0);
    // A real mutation happened → audit log ran.
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith('CREATE_TASK', 'user1', 'user', expect.any(Object));
  });

  test('new idempotencyKey → executes + records processed_operations via create() (JSON-safe result)', async () => {
    // Phase 1: client read, THEN idempotency read (not yet processed).
    mockTransaction.get
      .mockResolvedValueOnce(makeClientDoc())
      .mockResolvedValueOnce({ exists: false });

    const data = { ...baseCreateData, idempotencyKey: 'create_key_123' };
    const result = await createBudgetTask(data, makeCtx());

    expect(result.success).toBe(true);
    expect(taskCreates()).toHaveLength(1);
    expect(approvalCreates()).toHaveLength(1);

    const creates = idempotencyCreates();
    expect(creates).toHaveLength(1);
    const [ref, doc] = creates[0];
    expect(ref.id).toBe('create_key_123');
    expect(doc.idempotencyKey).toBe('create_key_123');
    expect(doc.status).toBe('completed');
    expect(doc.result).toEqual(result);
    // The stored/returned result must be JSON-safe (no serverTimestamp sentinels).
    assertJsonSafe(doc.result);

    expect(logAction).toHaveBeenCalledTimes(1);
  });

  test('existing idempotencyKey → Phase-1 read short-circuits: stored result, NO writes, NO audit', async () => {
    const cachedResult = {
      success: true,
      taskId: 'cached_task_1',
      task: { id: 'cached_task_1', description: 'משימת בדיקה', status: 'פעיל' }
    };
    // Phase 1: client read, THEN idempotency read (exists → short-circuit).
    mockTransaction.get
      .mockResolvedValueOnce(makeClientDoc())
      .mockResolvedValueOnce({ exists: true, data: () => ({ result: cachedResult }) });

    const data = { ...baseCreateData, idempotencyKey: 'create_already_done' };
    const result = await createBudgetTask(data, makeCtx());

    expect(result).toEqual(cachedResult);
    expect(taskCreates()).toHaveLength(0);
    expect(approvalCreates()).toHaveLength(0);
    expect(idempotencyCreates()).toHaveLength(0);
    // No new mutation → no duplicate audit.
    expect(logAction).not.toHaveBeenCalled();
  });

  test('concurrent already-exists → replays sibling stored result (no throw, no duplicate audit)', async () => {
    const storedResult = {
      success: true,
      taskId: 'task_from_winner',
      task: { id: 'task_from_winner', status: 'פעיל' }
    };

    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeClientDoc())
        .mockResolvedValueOnce({ exists: false }); // idempotency: not visible in-txn yet
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });

    const data = { ...baseCreateData, idempotencyKey: 'create_concurrent' };
    const result = await createBudgetTask(data, makeCtx());

    expect(result).toEqual(storedResult);
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1); // no second attempt
    // We return the winner's result — this call's own audit must not fire.
    expect(logAction).not.toHaveBeenCalled();
  });

  test('already-exists on attempt 1, winner visible on attempt 2 → retries → Phase-1 read returns stored result (no throw)', async () => {
    const storedResult = {
      success: true,
      taskId: 'task_from_winner',
      task: { id: 'task_from_winner', status: 'פעיל' }
    };
    // Attempt 1: body runs, create() throws already-exists at commit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeClientDoc())
        .mockResolvedValueOnce({ exists: false });
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    // Post-catch replay #1: winner not visible yet → fall through to retry.
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: false });
    // Attempt 2: Phase-1 idempotency read now finds the committed doc → short-circuit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeClientDoc())
        .mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });
      return fn(mockTransaction);
    });

    const data = { ...baseCreateData, idempotencyKey: 'create_retry_visible' };
    const result = await createBudgetTask(data, makeCtx());

    expect(result).toEqual(storedResult);
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);   // retried once, then replayed
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);  // one not-visible post-catch read
    // The replayed call returns the winner's result → the post-transaction audit
    // must NOT fire (didWrite=false), so no duplicate CREATE_TASK entry.
    // (attempt-1's queued-then-aborted writes are recorded by the mock but never
    // committed in Firestore — the mock can't distinguish queue from commit.)
    expect(logAction).not.toHaveBeenCalled();
  });

  test('exhausted already-exists (winner never visible) → Hebrew aborted, no raw SDK string, exactly 3 attempts', async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeClientDoc())
        .mockResolvedValueOnce({ exists: false });
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    mockProcessedOpsGet.mockResolvedValue({ exists: false }); // never visible

    const data = { ...baseCreateData, idempotencyKey: 'create_never_visible' };

    let caught;
    try {
      await createBudgetTask(data, makeCtx());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught.code).toBe('aborted');
    expect(caught.message).toMatch(/נקלט/);
    expect(caught.message).not.toMatch(/already exists/);
    expect(mockRunTransaction).toHaveBeenCalledTimes(3);
    expect(logAction).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════
// adjustTaskBudget
// ════════════════════════════════════════════════════════════════

describe('adjustTaskBudget — atomic idempotency (PR-3a)', () => {

  test('no idempotencyKey → executes normally, no processed_operations create', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc()); // task read only

    const result = await adjustTaskBudget({ ...baseAdjustData }, makeCtx());

    expect(result.success).toBe(true);
    expect(result.newEstimate).toBe(180);
    expect(taskUpdates()).toHaveLength(1);
    expect(idempotencyCreates()).toHaveLength(0);
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith('ADJUST_BUDGET', 'user1', 'user', expect.any(Object));
  });

  test('new idempotencyKey → executes + records processed_operations via create() (JSON-safe result)', async () => {
    mockTransaction.get
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce({ exists: false }); // idempotency: not yet processed

    const data = { ...baseAdjustData, idempotencyKey: 'adjust_key_123' };
    const result = await adjustTaskBudget(data, makeCtx());

    expect(result.success).toBe(true);
    expect(taskUpdates()).toHaveLength(1);

    const creates = idempotencyCreates();
    expect(creates).toHaveLength(1);
    const [ref, doc] = creates[0];
    expect(ref.id).toBe('adjust_key_123');
    expect(doc.idempotencyKey).toBe('adjust_key_123');
    expect(doc.status).toBe('completed');
    expect(doc.result).toEqual(result);
    assertJsonSafe(doc.result);

    expect(logAction).toHaveBeenCalledTimes(1);
  });

  test('existing idempotencyKey → Phase-1 read short-circuits: stored result, NO update, NO audit', async () => {
    const cachedResult = {
      success: true,
      taskId: 'task1',
      oldEstimate: 120,
      newEstimate: 180,
      addedMinutes: 60,
      message: 'תקציב עודכן מ-120 ל-180 דקות'
    };
    mockTransaction.get
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce({ exists: true, data: () => ({ result: cachedResult }) });

    const data = { ...baseAdjustData, idempotencyKey: 'adjust_already_done' };
    const result = await adjustTaskBudget(data, makeCtx());

    expect(result).toEqual(cachedResult);
    expect(taskUpdates()).toHaveLength(0);
    expect(idempotencyCreates()).toHaveLength(0);
    expect(logAction).not.toHaveBeenCalled();
  });

  test('concurrent already-exists → replays sibling stored result (no throw, no duplicate audit)', async () => {
    const storedResult = {
      success: true,
      taskId: 'task1',
      oldEstimate: 120,
      newEstimate: 180,
      addedMinutes: 60,
      message: 'תקציב עודכן מ-120 ל-180 דקות'
    };

    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeTaskDoc())
        .mockResolvedValueOnce({ exists: false });
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });

    const data = { ...baseAdjustData, idempotencyKey: 'adjust_concurrent' };
    const result = await adjustTaskBudget(data, makeCtx());

    expect(result).toEqual(storedResult);
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(logAction).not.toHaveBeenCalled();
  });

  test('already-exists on attempt 1, winner visible on attempt 2 → retries → Phase-1 read returns stored result (no throw)', async () => {
    const storedResult = {
      success: true,
      taskId: 'task1',
      oldEstimate: 120,
      newEstimate: 180,
      addedMinutes: 60,
      message: 'תקציב עודכן מ-120 ל-180 דקות'
    };
    // Attempt 1: body runs, create() throws already-exists at commit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeTaskDoc())
        .mockResolvedValueOnce({ exists: false });
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    // Post-catch replay #1: winner not visible yet → fall through to retry.
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: false });
    // Attempt 2: Phase-1 idempotency read now finds the committed doc → short-circuit.
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeTaskDoc())
        .mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });
      return fn(mockTransaction);
    });

    const data = { ...baseAdjustData, idempotencyKey: 'adjust_retry_visible' };
    const result = await adjustTaskBudget(data, makeCtx());

    expect(result).toEqual(storedResult);
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);
    // The replayed call returns the winner's result → the post-transaction audit
    // must NOT fire (didWrite=false), so no duplicate ADJUST_BUDGET entry.
    // (attempt-1's queued-then-aborted writes are recorded by the mock but never
    // committed in Firestore — the mock can't distinguish queue from commit.)
    expect(logAction).not.toHaveBeenCalled();
  });

  test('exhausted already-exists (winner never visible) → Hebrew aborted, no raw SDK string, exactly 3 attempts', async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(makeTaskDoc())
        .mockResolvedValueOnce({ exists: false });
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    mockProcessedOpsGet.mockResolvedValue({ exists: false });

    const data = { ...baseAdjustData, idempotencyKey: 'adjust_never_visible' };

    let caught;
    try {
      await adjustTaskBudget(data, makeCtx());
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught.code).toBe('aborted');
    expect(caught.message).toMatch(/נקלט/);
    expect(caught.message).not.toMatch(/already exists/);
    expect(mockRunTransaction).toHaveBeenCalledTimes(3);
    expect(logAction).not.toHaveBeenCalled();
  });
});
