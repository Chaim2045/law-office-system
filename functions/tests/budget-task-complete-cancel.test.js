/**
 * CHARACTERIZATION goldens — completeTask + cancelBudgetTask (budget-tasks/index.js).
 *
 * These two task state-transition CFs had ZERO behavior tests (the existing
 * budget-task suites cover only createBudgetTask/adjustTaskBudget idempotency).
 * This suite PINS THE CURRENT BEHAVIOR AS-IS — quirks included — so any future
 * change (e.g. a JS→TS rewrite of this module) that silently alters the
 * transition logic, the gap math, the alert/approval side-effects, the auth
 * gates, or the money-protection blocks is caught. It asserts what the code
 * DOES today, NOT what it "should" do.
 *
 * Quirks deliberately pinned (see inline comments):
 *   - completeTask has NO already-completed guard → it is fully RE-RUNNABLE.
 *   - completeTask writes a critical-gap alert ONLY when gapPercent >= 50.
 *   - completeTask gapPercent = est>0 ? abs((actual-est)/est*100) : 0 (0 when est<=0).
 *   - cancelBudgetTask dual auth: employee.isAdmin===true OR role==='admin' OR owner.
 *   - cancelBudgetTask blocks cancel when actualMinutes>0 (money protection).
 *   - cancelBudgetTask return.cancelledAt is a fresh JS ISO string, NOT the
 *     serverTimestamp sentinel persisted on the doc (they diverge).
 *
 * Harness mirrors tests/budget-task-idempotency.test.js (the module's canonical
 * fake): mocked SDK boundary, order-keyed transaction.get, _collection-tagged
 * write filters. Extensions vs that suite: a configurable non-txn approval query
 * (cancel's pending_task_approvals lookup) and a collection().add() spy (complete's
 * task_completion_alerts create).
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

// cancelBudgetTask's NON-transactional approval query
// (db.collection('pending_task_approvals').where(...).limit(1).get()). Default: none.
const mockApprovalGet = jest.fn(async () => ({ empty: true, docs: [] }));
// completeTask's NON-transactional alert create
// (db.collection('task_completion_alerts').add(...)). Records (collectionName, payload).
const mockAlertAdd = jest.fn(async () => ({ id: 'alert_auto' }));

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id: id || `auto_${name}`,
      _collection: name,
      // completeTask/cancelBudgetTask read via transaction.get, never ref.get() —
      // this stub exists only so ref creation never throws.
      get: jest.fn(async () => ({ exists: false }))
    })),
    where: jest.fn(() => ({ limit: jest.fn(() => ({ get: (...a) => mockApprovalGet(...a) })) })),
    add: jest.fn((payload) => mockAlertAdd(name, payload))
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
  checkUserPermissions: jest.fn()
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));

jest.mock('../addTimeToTask_v2', () => ({
  addTimeToTaskWithTransaction: jest.fn().mockResolvedValue({ success: true })
}));

const { completeTask, cancelBudgetTask } = require('../budget-tasks/index');
const { logAction } = require('../shared/audit');
const { checkUserPermissions } = require('../shared/auth');

// ─── fixtures ──────────────────────────────────────────────────

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

const DEFAULT_USER = {
  uid: 'user1',
  email: 'user@test',
  username: 'user',
  role: 'employee',
  employee: { name: 'שם עובד', isAdmin: false }
};

function makeTaskDoc(overrides = {}) {
  const d = {
    employee: 'user@test',
    status: 'פעיל',
    estimatedMinutes: 120,
    actualMinutes: 60,
    clientId: '2025001',
    clientName: 'לקוח טסט',
    description: 'משימת בדיקה',
    ...overrides
  };
  return { exists: true, data: () => d };
}

function taskUpdates() {
  return mockTransaction.update.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'budget_tasks'
  );
}
function approvalUpdates() {
  return mockTransaction.update.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'pending_task_approvals'
  );
}

// A returned object must round-trip through JSON with no admin sentinel markers.
function assertJsonSafe(obj) {
  const seen = JSON.parse(JSON.stringify(obj));
  expect(seen).toEqual(obj);
  const flat = JSON.stringify(obj);
  expect(flat).not.toContain('SERVER_TIMESTAMP');
  expect(flat).not.toContain('_arrayUnion');
  expect(flat).not.toContain('_ts');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
  mockApprovalGet.mockReset();
  mockApprovalGet.mockResolvedValue({ empty: true, docs: [] });
  mockAlertAdd.mockReset();
  mockAlertAdd.mockResolvedValue({ id: 'alert_auto' });
  checkUserPermissions.mockReset();
  checkUserPermissions.mockResolvedValue({ ...DEFAULT_USER });
  logAction.mockReset();
  logAction.mockResolvedValue(undefined);
});

// ════════════════════════════════════════════════════════════════
// completeTask
// ════════════════════════════════════════════════════════════════

describe('completeTask — characterization', () => {

  test('missing taskId → invalid-argument (Hebrew)', async () => {
    await expect(completeTask({}, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'חסר מזהה משימה'
    });
    expect(taskUpdates()).toHaveLength(0);
  });

  test('task not found → not-found (Hebrew)', async () => {
    mockTransaction.get.mockResolvedValueOnce({ exists: false });
    await expect(completeTask({ taskId: 'task1' }, makeCtx())).rejects.toMatchObject({
      code: 'not-found',
      message: 'משימה לא נמצאה'
    });
  });

  test('not owner and not admin → permission-denied', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ employee: 'other@test' }));
    await expect(completeTask({ taskId: 'task1' }, makeCtx())).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'אין הרשאה לסמן משימה זו כהושלמה'
    });
    expect(taskUpdates()).toHaveLength(0);
  });

  test('no time entries (actualMinutes 0) → failed-precondition, blocks completion', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ actualMinutes: 0 }));
    // the exact text is a quirk-heavy multi-line message; the lead line is the
    // stable contract to pin.
    await expect(completeTask({ taskId: 'task1' }, makeCtx())).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('לא ניתן לסיים משימה ללא רישומי זמן')
    });
    expect(taskUpdates()).toHaveLength(0);
  });

  test('under-budget non-critical (est 120 / actual 100) → completes, gapPercent 17, no alert', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ estimatedMinutes: 120, actualMinutes: 100 }));

    const result = await completeTask({ taskId: 'task1' }, makeCtx());

    // gapMinutes = 100-120 = -20; gapPercent = abs(-20/120*100) = 16.67 → round 17; isCritical=false
    expect(result).toEqual({ success: true, taskId: 'task1', gapPercent: 17, isCritical: false });
    assertJsonSafe(result);

    const updates = taskUpdates();
    expect(updates).toHaveLength(1);
    const payload = updates[0][1];
    expect(payload.status).toBe('הושלם');
    expect(payload.completedBy).toBe('user');
    expect(payload.completion).toMatchObject({
      gapPercent: 17,
      gapMinutes: 20,        // Math.abs(-20)
      estimatedMinutes: 120,
      actualMinutes: 100,
      isOver: false,
      isUnder: true,
      requiresReview: false  // = isCritical
    });

    // NOT critical → NO admin alert.
    expect(mockAlertAdd).not.toHaveBeenCalled();

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith('COMPLETE_TASK', 'user1', 'user', {
      taskId: 'task1', actualMinutes: 100, gapPercent: 17, isCritical: false
    });
  });

  test('over-budget critical (est 120 / actual 200) → completes + writes a task_completion_alert', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ estimatedMinutes: 120, actualMinutes: 200 }));

    const result = await completeTask({ taskId: 'task1' }, makeCtx());

    // gap = 80; gapPercent = abs(80/120*100) = 66.67 → round 67; isCritical (>=50) = true
    expect(result).toEqual({ success: true, taskId: 'task1', gapPercent: 67, isCritical: true });

    const payload = taskUpdates()[0][1];
    expect(payload.completion).toMatchObject({ isOver: true, isUnder: false, requiresReview: true, gapPercent: 67 });

    // Critical → exactly one alert into task_completion_alerts, status 'pending'.
    expect(mockAlertAdd).toHaveBeenCalledTimes(1);
    const [collName, alert] = mockAlertAdd.mock.calls[0];
    expect(collName).toBe('task_completion_alerts');
    expect(alert).toMatchObject({
      taskId: 'task1',
      status: 'pending',
      gapPercent: 67,
      gapMinutes: 80,          // Math.abs(Math.abs(200) - 120)
      isOver: true,
      estimatedMinutes: 120,
      actualMinutes: 200
    });
  });

  test('estimatedMinutes 0 → gapPercent 0 branch (no divide), non-critical, no alert', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ estimatedMinutes: 0, actualMinutes: 60 }));

    const result = await completeTask({ taskId: 'task1' }, makeCtx());

    // est<=0 → gapPercent forced to 0 (not NaN/Infinity); isCritical=false
    expect(result).toEqual({ success: true, taskId: 'task1', gapPercent: 0, isCritical: false });
    expect(mockAlertAdd).not.toHaveBeenCalled();
  });

  test('QUIRK: no already-completed guard → completeTask is RE-RUNNABLE on a הושלם task', async () => {
    // Pin the ABSENCE of a status guard: an already-'הושלם' task with time entries
    // re-completes with NO rejection (contrast adjustTaskBudget/cancelBudgetTask,
    // which block by status). est 120 / actual 60 → gapPercent 50 → critical → 2nd alert.
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ status: 'הושלם', estimatedMinutes: 120, actualMinutes: 60 }));

    const result = await completeTask({ taskId: 'task1' }, makeCtx());

    expect(result.success).toBe(true);        // NOT rejected as already-completed
    expect(taskUpdates()).toHaveLength(1);    // writes status:'הושלם' again
    expect(taskUpdates()[0][1].status).toBe('הושלם');
    expect(mockAlertAdd).toHaveBeenCalledTimes(1); // and fires another alert
  });

  test('admin may complete another employee\'s task', async () => {
    checkUserPermissions.mockResolvedValueOnce({ ...DEFAULT_USER, role: 'admin' });
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ employee: 'other@test', estimatedMinutes: 120, actualMinutes: 100 }));

    const result = await completeTask({ taskId: 'task1' }, makeCtx());
    expect(result.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// cancelBudgetTask
// ════════════════════════════════════════════════════════════════

describe('cancelBudgetTask — characterization', () => {

  const baseCancel = { taskId: 'task1', reason: 'שינוי בתיק' };

  test('missing taskId → invalid-argument', async () => {
    await expect(cancelBudgetTask({ reason: 'x' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'חסר מזהה משימה'
    });
  });

  test('missing / blank reason → invalid-argument (חובה לספק סיבת ביטול)', async () => {
    await expect(cancelBudgetTask({ taskId: 'task1' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'חובה לספק סיבת ביטול'
    });
    await expect(cancelBudgetTask({ taskId: 'task1', reason: '   ' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'חובה לספק סיבת ביטול'
    });
  });

  test('task not found → not-found', async () => {
    mockTransaction.get.mockResolvedValueOnce({ exists: false });
    await expect(cancelBudgetTask({ ...baseCancel }, makeCtx())).rejects.toMatchObject({
      code: 'not-found',
      message: 'משימה לא נמצאה'
    });
  });

  test('not owner and not admin → permission-denied', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ employee: 'other@test', actualMinutes: 0 }));
    await expect(cancelBudgetTask({ ...baseCancel }, makeCtx())).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(taskUpdates()).toHaveLength(0);
  });

  test('status not פעיל → failed-precondition (can only cancel active tasks)', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ status: 'הושלם', actualMinutes: 0 }));
    await expect(cancelBudgetTask({ ...baseCancel }, makeCtx())).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('לא ניתן לבטל משימה עם סטטוס')
    });
  });

  test('QUIRK: actualMinutes>0 → money-protection block (failed-precondition, hours in message)', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ status: 'פעיל', actualMinutes: 90 }));
    await expect(cancelBudgetTask({ ...baseCancel }, makeCtx())).rejects.toMatchObject({
      code: 'failed-precondition',
      // (90/60).toFixed(2) = '1.50'
      message: expect.stringContaining('1.50')
    });
    expect(taskUpdates()).toHaveLength(0);
  });

  test('happy path, no approval record → single task update to בוטל, ISO cancelledAt return', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ status: 'פעיל', actualMinutes: 0 }));
    // mockApprovalGet default: empty → no 2nd write.

    const result = await cancelBudgetTask({ ...baseCancel }, makeCtx());

    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task1');
    // QUIRK: return.cancelledAt is a fresh JS ISO string, NOT the serverTimestamp
    // sentinel persisted on the doc — pin the divergence.
    expect(typeof result.cancelledAt).toBe('string');
    expect(result.cancelledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.cancelledAt).not.toBe('SERVER_TIMESTAMP');
    assertJsonSafe(result);

    const updates = taskUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0][1]).toMatchObject({
      status: 'בוטל',
      cancelReason: 'שינוי בתיק',
      cancelledBy: 'user',
      cancelledByEmail: 'user@test',
      cancelledByUid: 'user1',
      cancelledAt: 'SERVER_TIMESTAMP'   // persisted sentinel (≠ the returned ISO)
    });
    expect(approvalUpdates()).toHaveLength(0);

    expect(logAction).toHaveBeenCalledWith('CANCEL_TASK', 'user1', 'user', {
      taskId: 'task1', reason: 'שינוי בתיק', clientId: '2025001', clientName: 'לקוח טסט'
    });
  });

  test('happy path WITH approval record → task update + approval update (task_cancelled)', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ status: 'פעיל', actualMinutes: 0 }));
    mockApprovalGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ ref: { _collection: 'pending_task_approvals', id: 'appr1' } }]
    });

    const result = await cancelBudgetTask({ ...baseCancel }, makeCtx());

    expect(result.success).toBe(true);
    expect(taskUpdates()).toHaveLength(1);

    const apprUpdates = approvalUpdates();
    expect(apprUpdates).toHaveLength(1);
    expect(apprUpdates[0][1]).toMatchObject({
      status: 'task_cancelled',
      cancelledBy: 'user',
      cancelledByEmail: 'user@test'
    });
  });

  test('QUIRK: admin (employee.isAdmin) may cancel another employee\'s active task', async () => {
    checkUserPermissions.mockResolvedValueOnce({
      ...DEFAULT_USER, role: 'employee', employee: { name: 'מנהל', isAdmin: true }
    });
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ employee: 'other@test', status: 'פעיל', actualMinutes: 0 }));

    const result = await cancelBudgetTask({ ...baseCancel }, makeCtx());
    expect(result.success).toBe(true);
    expect(taskUpdates()).toHaveLength(1);
  });
});
