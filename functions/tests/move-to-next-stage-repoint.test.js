/**
 * Tests for moveToNextStage's budget_tasks RE-POINT logic (PR-B-2, 2026-07-21).
 *
 * ROOT-CAUSE FIX under test: a budget_task for a legal_procedure stores the
 * STAGE id in `serviceId` and the SERVICE id in `parentServiceId`, stamped
 * once at creation (functions/budget-tasks/index.js:175-178). Nothing used to
 * refresh that pointer when the case advanced a stage, so an open task
 * created during stage א kept deducting hours from stage א's package forever
 * — even after stage א closed (measured PROD 2026-07-21: 75 entries / 101.60h
 * across 6 clients on an already-completed stage).
 *
 * moveToNextStage now re-points OPEN tasks still pointing at the closing
 * stage to the newly-active stage, in the SAME transaction, audited
 * atomically via logCriticalActionInTxn. Re-point, NEVER close (completing a
 * task is irreversible and completeTask refuses on actualMinutes===0).
 *
 * Coverage (mirrors the PR-B-2 brief's mandatory list):
 *   A. Open task on the closing stage IS re-pointed to the new stage
 *   B. A COMPLETED task ('הושלם') is NOT touched
 *   C. A CANCELLED task ('בוטל') is NOT touched
 *   D. A task on a DIFFERENT service (same client) is NOT touched
 *   E. A task already pointing at a LATER stage is NOT touched
 *   F. Zero open tasks on the closing stage -> zero task writes (no-op case)
 *   G. actualMinutes / timeEntries / status provably unchanged on a
 *      re-pointed task (only serviceId + lastModified* change)
 *   H. Reads precede writes (mock transaction call-order assertion, so a
 *      future refactor that reorders reads/writes fails here, not in PROD)
 *   I. Audit-in-txn is called once per re-pointed task, and not at all when
 *      no task matches
 *
 * ── PR-B-2 R2 (2026-07-22, adversarial-review fixes) ──────────────────────
 *   J. FIX 1 — a task stranded on an EARLIER completed stage (not just the
 *      one closing right now) IS re-pointed on a later advance
 *   K. FIX 1 — a task on a `pending` (future) stage is NOT touched
 *   L. FIX 2 — `lastModifiedBy` is OMITTED when user.username is falsy, and
 *      PRESENT (exact key set) when it is set
 *   M. FIX 3 — exceeding MAX_REPOINT_TASKS throws `failed-precondition` with
 *      a Hebrew message, and performs ZERO writes
 *   N. FIX 4 — a failing task update produces an error naming the taskId,
 *      and does not swallow / continue past the failure
 *   O. FIX 5 — the skipped-for-missing-parentServiceId counter
 */

// ─── Mock transaction + Firestore db ───────────────────────────────────────

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

// budget_tasks is queried via `transaction.get(db.collection('budget_tasks').where(...))`
// — the mock just needs a chainable `.where()`; the ACTUAL returned snapshot
// is controlled by the `mockTransaction.get` sequencing below (Firestore's
// transaction.get() ignores the query object shape in this mock — only the
// call ORDER + resolved values matter for these tests).
const mockBudgetTasksQuery = {
  where: jest.fn().mockReturnThis()
};

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'budget_tasks') {
      return mockBudgetTasksQuery;
    }
    // 'clients' / 'system_settings' / any other collection
    return { doc: jest.fn((id) => ({ id: id || 'auto_id' })) };
  }),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  const Timestamp = { now: jest.fn(() => 'NOW') };
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

const mockCheckUserPermissions = jest.fn();
jest.mock('../shared/auth', () => ({
  checkUserPermissions: mockCheckUserPermissions
}));

const mockLogAction = jest.fn();
jest.mock('../shared/audit', () => ({
  logAction: mockLogAction
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  isValidIsraeliPhone: jest.fn(() => true),
  isValidEmail: jest.fn(() => true)
}));

// The audit-FIRST-in-txn primitive (functions/src-ts/audit-critical.ts,
// compiled to functions/lib/audit-critical.js). Mocked so tests assert the
// call happened without depending on the real actorUid regex / Firestore.
const mockLogCriticalActionInTxn = jest.fn(() => 'audit-doc-id');
jest.mock('../lib/audit-critical', () => ({
  logCriticalActionInTxn: (...args) => mockLogCriticalActionInTxn(...args)
}));

const { moveToNextStage } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeLegalProcedure(id, opts = {}) {
  const {
    pricingType = PT.HOURLY,
    stages = [
      { id: 'stage_a', name: 'שלב א', status: 'active', totalHours: 5 },
      { id: 'stage_b', name: 'שלב ב', status: 'pending', totalHours: 5 },
      { id: 'stage_c', name: 'שלב ג', status: 'pending', totalHours: 5 }
    ],
    totalHours = pricingType === PT.HOURLY ? 15 : 0
  } = opts;
  return {
    id,
    type: ST.LEGAL_PROCEDURE,
    name: `הליך ${id}`,
    pricingType,
    stages,
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    status: 'active'
  };
}

function makeClientDoc(services = []) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS || (s.type === ST.LEGAL_PROCEDURE && s.pricingType === PT.HOURLY))
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      currentStage: services[0]?.stages?.find(st => st.status === 'active')?.id || null,
      currentStageName: services[0]?.stages?.find(st => st.status === 'active')?.name || null
    })
  };
}

/** Builds a fake budget_tasks doc (query-result shape: {id, ref, data()}). */
function makeTaskDoc(id, overrides = {}) {
  const task = {
    clientId: 'c1',
    parentServiceId: 's1',
    serviceId: 'stage_a',
    status: 'פעיל',
    actualMinutes: 120,
    estimatedMinutes: 300,
    timeEntries: [{ id: 'te1', minutes: 120 }],
    lastModifiedBy: 'someone-else',
    ...overrides
  };
  return {
    id,
    ref: { id, __isTaskRef: true },
    data: () => task
  };
}

const VALID_USER = {
  uid: 'user1',
  email: 'test@test',
  username: 'testuser',
  role: 'manager'
};

function makeCtx(uid = 'user1') {
  return { auth: { uid, token: { email: 'test@test' } } };
}

/**
 * Queues the 3-read sequence moveToNextStage now performs inside the
 * transaction, IN ORDER:
 *   1. transaction.get(clientRef)                      — 3a, outer client read
 *   2. transaction.get(budget_tasks query)              — PR-B-2 task lookup
 *   3. transaction.get(clientRef)                        — internal re-read
 *      inside writeClientWithCanonicalAggregates (shared/client-writer.js
 *      "2. Transactional read")
 *
 * All three are READS — this queuing itself is what test H (reads-precede-
 * writes) exploits: if a future refactor moved the budget_tasks read to
 * AFTER the client write, the real Firestore SDK would throw at runtime;
 * here the call-order assertion on mockTransaction.get vs mockTransaction.update
 * catches the same class of regression without a live Firestore.
 */
function setupTxMocks(clientDoc, taskDocs = []) {
  mockTransaction.get.mockReset();
  const tasksSnapshot = { docs: taskDocs };
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)
    .mockResolvedValueOnce(tasksSnapshot)
    .mockResolvedValueOnce(clientDoc);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue(VALID_USER);
});

// ═══════════════════════════════════════════════════════════════
// A. Open task IS re-pointed
// ═══════════════════════════════════════════════════════════════

describe('A. Open task on the closing stage IS re-pointed', () => {
  test('serviceId flips from the closing stage to the new active stage', async () => {
    const openTask = makeTaskDoc('task-open-1');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    // Exactly one task update (the open task) + one client update (the helper).
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);

    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === openTask.ref
    );
    expect(taskUpdateCall).toBeDefined();
    expect(taskUpdateCall[1]).toMatchObject({
      serviceId: 'stage_b', // the NEW active stage (currentStage was stage_a)
      lastModifiedAt: 'SERVER_TIMESTAMP',
      lastModifiedBy: 'testuser'
    });

    expect(result.repointedTaskCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Completed task NOT touched
// ═══════════════════════════════════════════════════════════════

describe('B. A COMPLETED task is NOT touched', () => {
  test('status הושלם is excluded from re-pointing', async () => {
    const completedTask = makeTaskDoc('task-completed', { status: 'הושלם' });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [completedTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    // Only the client update — no task update.
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === completedTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Cancelled task NOT touched
// ═══════════════════════════════════════════════════════════════

describe('C. A CANCELLED task is NOT touched', () => {
  test('status בוטל is excluded from re-pointing', async () => {
    const cancelledTask = makeTaskDoc('task-cancelled', { status: 'בוטל' });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [cancelledTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === cancelledTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Different service (same client) NOT touched
// ═══════════════════════════════════════════════════════════════

describe('D. A task belonging to a DIFFERENT service on the same client is NOT touched', () => {
  test('parentServiceId mismatch excludes the task', async () => {
    const otherServiceTask = makeTaskDoc('task-other-service', {
      parentServiceId: 's-OTHER',
      serviceId: 'stage_a' // same stage id, but different service entirely
    });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [otherServiceTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === otherServiceTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Task already on a later stage NOT touched
// ═══════════════════════════════════════════════════════════════

describe('E. A task already pointing at a LATER stage is NOT touched', () => {
  test('serviceId already equal to a later stage is excluded', async () => {
    // Same service, but the task already points at stage_b (not the closing
    // stage_a) — e.g. it was already re-pointed by a prior advance, or was
    // created directly against stage_b.
    const laterStageTask = makeTaskDoc('task-later-stage', { serviceId: 'stage_b' });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [laterStageTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === laterStageTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Zero open tasks -> zero task writes (no-op case)
// ═══════════════════════════════════════════════════════════════

describe('F. Zero open tasks on the closing stage -> zero task writes', () => {
  test('no budget_tasks docs at all: only the client update happens', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), []);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    // Byte-identical to pre-PR-B-2 behavior: exactly one update call (the
    // client write via writeClientWithCanonicalAggregates). No task writes.
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    expect(result.repointedTaskCount).toBe(0);
    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();
  });

  test('mixed non-matching tasks (completed + cancelled + other-service + later-stage): still zero task writes', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [
      makeTaskDoc('t1', { status: 'הושלם' }),
      makeTaskDoc('t2', { status: 'בוטל' }),
      makeTaskDoc('t3', { parentServiceId: 's-OTHER' }),
      makeTaskDoc('t4', { serviceId: 'stage_b' })
    ]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // client only
    expect(result.repointedTaskCount).toBe(0);
    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// G. actualMinutes / timeEntries / status provably unchanged
// ═══════════════════════════════════════════════════════════════

describe('G. actualMinutes / timeEntries / status are provably unchanged on a re-pointed task', () => {
  test('the task update payload contains ONLY serviceId + lastModified* — no budget/completion fields', async () => {
    const openTask = makeTaskDoc('task-open-2', {
      actualMinutes: 245,
      estimatedMinutes: 300,
      timeEntries: [{ id: 'te1', minutes: 120 }, { id: 'te2', minutes: 125 }]
    });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === openTask.ref
    );
    expect(taskUpdateCall).toBeDefined();
    const payload = taskUpdateCall[1];

    // Exactly the 3 allowed keys — nothing else was written.
    expect(Object.keys(payload).sort()).toEqual(
      ['lastModifiedAt', 'lastModifiedBy', 'serviceId'].sort()
    );
    expect(payload).not.toHaveProperty('actualMinutes');
    expect(payload).not.toHaveProperty('estimatedMinutes');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('timeEntries');
    expect(payload).not.toHaveProperty('serviceName');
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Reads precede writes
// ═══════════════════════════════════════════════════════════════

describe('H. Reads precede writes (Firestore transaction ordering)', () => {
  test('all transaction.get calls happen before any transaction.update call', async () => {
    const openTask = makeTaskDoc('task-open-3');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    const getCallOrders = [];
    const updateCallOrders = [];

    // Use jest's invocationCallOrder (available on every jest.fn()) to prove
    // ordering without relying on call count alone — this is what would
    // catch a future refactor that interleaves a read after a write.
    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    mockTransaction.get.mock.invocationCallOrder.forEach((order) => getCallOrders.push(order));
    mockTransaction.update.mock.invocationCallOrder.forEach((order) => updateCallOrders.push(order));

    expect(getCallOrders.length).toBeGreaterThanOrEqual(3); // client + tasks + internal re-read
    expect(updateCallOrders.length).toBeGreaterThanOrEqual(1); // task + client updates

    const lastGetOrder = Math.max(...getCallOrders);
    const firstUpdateOrder = Math.min(...updateCallOrders);
    expect(lastGetOrder).toBeLessThan(firstUpdateOrder);
  });
});

// ═══════════════════════════════════════════════════════════════
// I. Audit-in-txn called once per re-pointed task, not called for no-ops
// ═══════════════════════════════════════════════════════════════

describe('I. Audit-in-txn (logCriticalActionInTxn) called exactly once per re-pointed task', () => {
  test('two open tasks on the closing stage -> two audit calls, with the right payload shape', async () => {
    const taskA = makeTaskDoc('task-A');
    const taskB = makeTaskDoc('task-B');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [taskA, taskB]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.repointedTaskCount).toBe(2);
    expect(mockLogCriticalActionInTxn).toHaveBeenCalledTimes(2);

    expect(mockLogCriticalActionInTxn).toHaveBeenCalledWith(
      mockTransaction,
      'REPOINT_BUDGET_TASK_STAGE',
      'user1',
      expect.objectContaining({
        clientId: 'c1',
        taskId: 'task-A',
        parentServiceId: 's1',
        fromStageId: 'stage_a',
        toStageId: 'stage_b'
      })
    );
    expect(mockLogCriticalActionInTxn).toHaveBeenCalledWith(
      mockTransaction,
      'REPOINT_BUDGET_TASK_STAGE',
      'user1',
      expect.objectContaining({
        clientId: 'c1',
        taskId: 'task-B',
        parentServiceId: 's1',
        fromStageId: 'stage_a',
        toStageId: 'stage_b'
      })
    );
  });

  test('no matching tasks -> zero audit calls', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [
      makeTaskDoc('t1', { status: 'הושלם' })
    ]);

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// J. FIX 1 — task stranded on an EARLIER completed stage IS re-pointed
// ═══════════════════════════════════════════════════════════════

describe('J. FIX 1 — a task stranded on an EARLIER completed stage IS re-pointed', () => {
  test('service advancing stage_b -> stage_c re-points a task still on stage_a', async () => {
    // stage_a already completed (a prior advance closed it and — pre-FIX-1 —
    // failed to catch this task), stage_b is the ACTIVE stage now closing,
    // stage_c is the incoming active stage.
    const strandedTask = makeTaskDoc('task-stranded', { serviceId: 'stage_a' });
    const service = makeLegalProcedure('s1', {
      stages: [
        { id: 'stage_a', name: 'שלב א', status: 'completed', totalHours: 5 },
        { id: 'stage_b', name: 'שלב ב', status: 'active', totalHours: 5 },
        { id: 'stage_c', name: 'שלב ג', status: 'pending', totalHours: 5 }
      ]
    });
    setupTxMocks(makeClientDoc([service]), [strandedTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === strandedTask.ref
    );
    expect(taskUpdateCall).toBeDefined();
    expect(taskUpdateCall[1]).toMatchObject({ serviceId: 'stage_c' });
    expect(result.repointedTaskCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// K. FIX 1 — task on a PENDING (future) stage is NOT touched
// ═══════════════════════════════════════════════════════════════

describe('K. FIX 1 — a task on a PENDING (future) stage is NOT touched', () => {
  test('a task on stage_c (still pending after stage_a -> stage_b advance) is excluded', async () => {
    const futureStageTask = makeTaskDoc('task-future', { serviceId: 'stage_c' });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [futureStageTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // client only
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === futureStageTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// L. FIX 2 — lastModifiedBy guarded against a falsy user.username
// ═══════════════════════════════════════════════════════════════

describe('L. FIX 2 — lastModifiedBy is guarded against a falsy user.username', () => {
  test('username falsy -> lastModifiedBy key is OMITTED from the payload', async () => {
    mockCheckUserPermissions.mockResolvedValue({ ...VALID_USER, username: '' });
    const openTask = makeTaskDoc('task-no-username');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === openTask.ref
    );
    expect(taskUpdateCall).toBeDefined();
    const payload = taskUpdateCall[1];
    expect(Object.keys(payload).sort()).toEqual(['lastModifiedAt', 'serviceId'].sort());
    expect(payload).not.toHaveProperty('lastModifiedBy');
  });

  test('username set -> lastModifiedBy key is PRESENT with the exact 3-key shape', async () => {
    mockCheckUserPermissions.mockResolvedValue({ ...VALID_USER, username: 'testuser' });
    const openTask = makeTaskDoc('task-with-username');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === openTask.ref
    );
    expect(taskUpdateCall).toBeDefined();
    const payload = taskUpdateCall[1];
    expect(Object.keys(payload).sort()).toEqual(
      ['lastModifiedAt', 'lastModifiedBy', 'serviceId'].sort()
    );
    expect(payload.lastModifiedBy).toBe('testuser');
  });
});

// ═══════════════════════════════════════════════════════════════
// M. FIX 3 — write ceiling
// ═══════════════════════════════════════════════════════════════

describe('M. FIX 3 — exceeding the safe re-point ceiling throws failed-precondition', () => {
  test('201 matching open tasks -> HttpsError failed-precondition, Hebrew message, zero writes', async () => {
    const tooManyTasks = Array.from({ length: 201 }, (_, i) => makeTaskDoc(`task-${i}`));
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), tooManyTasks);

    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringMatching(/[א-ת]/) // contains Hebrew characters
    });

    // No task write and no client write happened — the throw occurs before
    // writeClientWithCanonicalAggregates is even called.
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();
  });

  test('exactly 200 matching open tasks -> does NOT throw (boundary is inclusive)', async () => {
    const exactlyAtCeiling = Array.from({ length: 200 }, (_, i) => makeTaskDoc(`task-${i}`));
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), exactlyAtCeiling);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.repointedTaskCount).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// N. FIX 4 — enriched, re-thrown error on a per-task failure
// ═══════════════════════════════════════════════════════════════

describe('N. FIX 4 — a failing task update produces an error naming the taskId', () => {
  test('transaction.update throwing for one task aborts with a taskId-naming error, no swallow', async () => {
    const failingTask = makeTaskDoc('task-boom');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [failingTask]);

    mockTransaction.update.mockImplementation((ref) => {
      if (ref === failingTask.ref) {
        throw new Error('NOT_FOUND: no entity to update');
      }
    });

    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({
      message: expect.stringContaining('task-boom')
    });

    // The audit call for THIS task must not have happened either (audit
    // follows the update inside the same try, and the throw aborts before
    // it) — the failure is not partially applied.
    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// O. FIX 5 — skipped-for-missing-parentServiceId counter
// ═══════════════════════════════════════════════════════════════

describe('O. FIX 5 — skippedForMissingParentServiceIdCount observability counter', () => {
  test('an open task on a completed stage with a NULL parentServiceId is counted, not re-pointed', async () => {
    const orphanTask = makeTaskDoc('task-orphan', { parentServiceId: null });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [orphanTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.repointedTaskCount).toBe(0);
    expect(result.skippedForMissingParentServiceIdCount).toBe(1);
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === orphanTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
  });

  test('zero matching tasks -> counter is 0', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), []);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.skippedForMissingParentServiceIdCount).toBe(0);
  });

  test('an open task on a completed stage with a mismatched (non-null) parentServiceId is NOT counted', async () => {
    const otherServiceTask = makeTaskDoc('task-other', { parentServiceId: 's-OTHER' });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [otherServiceTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.repointedTaskCount).toBe(0);
    expect(result.skippedForMissingParentServiceIdCount).toBe(0);
  });
});
