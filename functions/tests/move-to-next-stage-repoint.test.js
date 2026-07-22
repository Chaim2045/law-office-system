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
 *   J. [INVERTED in R3 — see below] originally asserted FIX 1's WIDENED
 *      write-selection (a task stranded on an earlier completed stage WAS
 *      re-pointed). R3 reverted the write-widening after an independent
 *      product-owner review (the 2025006 stage-closure ruling + the
 *      2026057 pre-emption risk — see functions/services/index.js 3f2 for
 *      the full rationale). J now asserts the OPPOSITE: such a task is NOT
 *      re-pointed, and is instead counted + detect-logged (CHANGE 2).
 *   K. FIX 1 — a task on a `pending` (future) stage is NOT touched
 *   L. FIX 2 — `lastModifiedBy` is OMITTED when user.username is falsy, and
 *      PRESENT (exact key set) when it is set
 *   M. FIX 3 — exceeding MAX_REPOINT_TASKS throws `failed-precondition` with
 *      a Hebrew message, and performs ZERO writes
 *   N. FIX 4 — a failing task update produces an error naming the taskId,
 *      and does not swallow / continue past the failure
 *   O. FIX 5 — the skipped-for-missing-parentServiceId counter
 *
 * ── PR-B-2 R3 (2026-07-22, filter reverted to narrow + detect-only added) ──
 *   P. CHANGE 1 — the write-selection filter is narrow again: only a task
 *      pointing at the EXACT stage closing right now is re-pointed. A task
 *      stranded on an EARLIER completed stage is NOT re-pointed (J,
 *      inverted) but IS counted (`strandedOnEarlierStageCount`) and
 *      detect-logged, and the counter is 0 when no such task exists.
 *   Q. CHANGE 5 — pins that the audit payload carries a `fromStageId` key
 *      sourced from the task's OWN snapshot (read before the update), not a
 *      literal. NOTE (FIX C, R4, honest re-label): under the narrow
 *      write-selection filter a written task always has
 *      `serviceId === currentStage.id` by construction, so `fromStageId`
 *      and `currentStage.id` are provably equal for every fixture this
 *      filter can ever select — no fixture can discriminate "read from the
 *      snapshot" from "hardcoded to currentStage.id" without violating the
 *      filter itself. This test therefore proves the field is WIRED
 *      (sourced from the task doc, present under the expected key), not
 *      that it is CURRENTLY OBSERVABLE-DIFFERENT-FROM-a-hardcode. It is
 *      future-proofing for a later loosened filter, not a live behavioral
 *      guarantee today.
 *
 * ── PR-B-2 R4 (2026-07-22, final review-fix pass — devils-advocate +
 *    outcomes-grader) ──────────────────────────────────────────────────────
 *   N is RE-FIXTURED below: the original synchronous `NOT_FOUND` throw from
 *   `transaction.update` does not model the real Firestore SDK (real
 *   `transaction.update`/`transaction.set` BUFFER their write; a missing
 *   document fails at COMMIT, outside this try/catch). N now injects a
 *   synchronous throw from `logCriticalActionInTxn` (mirroring a
 *   `validateActorUid` rejection) — a failure class that genuinely can
 *   throw synchronously inside the callback, which is exactly what the
 *   per-task try/catch defends against.
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
// J. [INVERTED R3] a task stranded on an EARLIER completed stage is NOT
//    re-pointed — it is counted + detect-logged instead (CHANGE 1 + 2)
// ═══════════════════════════════════════════════════════════════

describe('J. [R3 inverted] a task stranded on an EARLIER completed stage is NOT re-pointed', () => {
  test('service advancing stage_b -> stage_c does NOT touch a task still on stage_a; counts + logs it instead', async () => {
    // stage_a already completed, stage_b is the ACTIVE stage now closing,
    // stage_c is the incoming active stage. Under the narrow (reverted)
    // write filter, only a task pointing at stage_b (the stage closing
    // RIGHT NOW) is eligible for re-pointing — a task still on stage_a is
    // deliberately left alone (the 2025006 ruling: the stage closure, not
    // the task's pointer, was the error).
    const strandedTask = makeTaskDoc('task-stranded', { serviceId: 'stage_a' });
    const service = makeLegalProcedure('s1', {
      stages: [
        { id: 'stage_a', name: 'שלב א', status: 'completed', totalHours: 5 },
        { id: 'stage_b', name: 'שלב ב', status: 'active', totalHours: 5 },
        { id: 'stage_c', name: 'שלב ג', status: 'pending', totalHours: 5 }
      ]
    });
    setupTxMocks(makeClientDoc([service]), [strandedTask]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    // NOT re-pointed: only the client update happened.
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === strandedTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();

    // Counted instead.
    expect(result.strandedOnEarlierStageCount).toBe(1);

    // Detect-logged — identifiers only.
    expect(warnSpy).toHaveBeenCalledWith(
      'STRANDED_BUDGET_TASK_EARLIER_STAGE',
      expect.objectContaining({
        taskId: 'task-stranded',
        stageId: 'stage_a',
        serviceId: 's1',
        clientId: 'c1'
      })
    );

    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════
// P. CHANGE 1/2 — the stranded-earlier-stage counter is 0 when no such
//    task exists (and the narrow filter still re-points the exact-stage task)
// ═══════════════════════════════════════════════════════════════

describe('P. CHANGE 2 — strandedOnEarlierStageCount is 0 when no such task exists', () => {
  test('a normal exact-stage re-point produces zero stranded count', async () => {
    const openTask = makeTaskDoc('task-open-normal');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.repointedTaskCount).toBe(1);
    expect(result.strandedOnEarlierStageCount).toBe(0);
  });

  test('zero tasks at all -> zero stranded count', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), []);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.strandedOnEarlierStageCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Q. CHANGE 5 — pins that the audit payload's fromStageId is sourced from
//    the task's own snapshot and carries the expected key/value shape.
//
// HONEST SCOPE (FIX C, R4): this does NOT prove "not a hardcoded stage" —
// under the narrow write-selection filter, every task this filter can ever
// select has serviceId === currentStage.id, so fromStageId and
// currentStage.id are equal BY CONSTRUCTION in any fixture reachable
// through this filter. A hardcoded `fromStageId: currentStage.id` would
// pass this exact assertion too. What this test DOES pin: the field exists,
// is read off the task doc (not omitted, not undefined), and travels
// through to the audit call — useful future-proofing if the write filter
// is ever loosened again (R2 FIX 1's history), at which point this test
// would need a fixture where the two values diverge to mean what its name
// used to claim.
// ═══════════════════════════════════════════════════════════════

describe('Q. CHANGE 5 — logCriticalActionInTxn fromStageId is sourced from the task snapshot', () => {
  test('a service starting on stage_b (not stage_a) repoints with fromStageId=stage_b (equal to currentStage.id by construction under the narrow filter)', async () => {
    const openTask = makeTaskDoc('task-from-b', { serviceId: 'stage_b' });
    const service = makeLegalProcedure('s1', {
      stages: [
        { id: 'stage_a', name: 'שלב א', status: 'completed', totalHours: 5 },
        { id: 'stage_b', name: 'שלב ב', status: 'active', totalHours: 5 },
        { id: 'stage_c', name: 'שלב ג', status: 'pending', totalHours: 5 }
      ]
    });
    setupTxMocks(makeClientDoc([service]), [openTask]);

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockLogCriticalActionInTxn).toHaveBeenCalledWith(
      mockTransaction,
      'REPOINT_BUDGET_TASK_STAGE',
      'user1',
      expect.objectContaining({
        taskId: 'task-from-b',
        fromStageId: 'stage_b',
        toStageId: 'stage_c'
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// R. FIX E (R4) — unresolvedStageForServiceCount: an open task explicitly
//    owned by this service (parentServiceId matches) whose serviceId is not
//    any stage of this service at all is counted, never re-pointed, and the
//    counter is 0 when no such task exists.
// ═══════════════════════════════════════════════════════════════

describe('R. FIX E — unresolvedStageForServiceCount', () => {
  test('parentServiceId matches this service but serviceId matches no stage on it -> counted, not re-pointed', async () => {
    const unresolvedTask = makeTaskDoc('task-unresolved', {
      parentServiceId: 's1',
      serviceId: 'stage_GARBAGE'
    });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [unresolvedTask]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // client only
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === unresolvedTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
    expect(result.repointedTaskCount).toBe(0);
    expect(result.unresolvedStageForServiceCount).toBe(1);
    expect(mockLogCriticalActionInTxn).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledWith(
      'BUDGET_TASK_UNRESOLVED_STAGE_FOR_SERVICE',
      expect.objectContaining({
        taskId: 'task-unresolved',
        stageId: 'stage_GARBAGE',
        serviceId: 's1',
        clientId: 'c1'
      })
    );

    warnSpy.mockRestore();
  });

  test('zero unresolved tasks -> counter is 0', async () => {
    const openTask = makeTaskDoc('task-normal');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [openTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.unresolvedStageForServiceCount).toBe(0);
  });

  test('serviceId matches no stage but parentServiceId is FALSY -> deliberately NOT counted (ambiguous attribution)', async () => {
    const ambiguousTask = makeTaskDoc('task-ambiguous', {
      parentServiceId: null,
      serviceId: 'stage_GARBAGE'
    });
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [ambiguousTask]);

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    // Not counted by the new counter (attribution would be a guess), not
    // re-pointed, and not counted by the pre-existing counters either.
    expect(result.unresolvedStageForServiceCount).toBe(0);
    expect(result.strandedOnEarlierStageCount).toBe(0);
    expect(result.skippedForMissingParentServiceIdCount).toBe(0);
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

describe('N. FIX 4 (re-fixtured R4) — a SYNCHRONOUS throw while buffering a task write aborts the advance with a taskId-naming error', () => {
  // R4 NOTE (FIX D): the previous fixture made `transaction.update` throw a
  // synchronous `NOT_FOUND` — that does NOT model the real Firestore SDK.
  // The real `transaction.update`/`transaction.set` BUFFER their write; a
  // missing-document failure surfaces at COMMIT time, which is OUTSIDE this
  // callback and OUTSIDE this try/catch entirely (see the corrected comment
  // at functions/services/index.js, the try/catch around the repoint
  // writes). This test now injects a failure class that CAN genuinely throw
  // synchronously inside the callback — a `validateActorUid` rejection
  // surfacing from `logCriticalActionInTxn` (post-FIX-B, this call runs
  // BEFORE `transaction.update` for each task, audit-FIRST) — which is
  // exactly what the per-task try/catch is built to catch and enrich.
  //
  // IMPORTANT: this does NOT cover a concurrent delete (that fails at
  // commit, outside this try/catch) — see the comment in
  // functions/services/index.js for what is and is not caught here.
  test('logCriticalActionInTxn throwing synchronously for one task aborts with a taskId-naming error, no swallow', async () => {
    const failingTask = makeTaskDoc('task-boom');
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]), [failingTask]);

    mockLogCriticalActionInTxn.mockImplementation((tx, action, actorUid) => {
      if (actorUid && failingTask) {
        throw new Error('actorUid failed validateActorUid: malformed uid');
      }
      return 'audit-doc-id';
    });

    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({
      message: expect.stringContaining('task-boom')
    });

    // The task update for THIS task must not have happened either — the
    // audit call throws BEFORE transaction.update runs (audit-FIRST,
    // post-FIX-B), so the failure is not partially applied.
    const taskUpdateCall = mockTransaction.update.mock.calls.find(
      ([ref]) => ref === failingTask.ref
    );
    expect(taskUpdateCall).toBeUndefined();
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
