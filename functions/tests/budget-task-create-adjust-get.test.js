/**
 * CHARACTERIZATION goldens (package 2) — createBudgetTask payload/approval shape,
 * adjustTaskBudget budget-change semantics, and getBudgetTasks query gate.
 *
 * createBudgetTask + adjustTaskBudget ARE exercised by tests/budget-task-idempotency.test.js
 * — but only for the idempotency machinery; their WRITTEN PAYLOADS are never asserted.
 * getBudgetTasks had ZERO tests. This suite pins the CURRENT behavior AS-IS (quirks
 * included) so a future JS→TS rewrite of budget-tasks/index.js can't silently drift
 * the doc shape, the auto-approval record, the adjustment math, or the visibility
 * query. It asserts what the code DOES today, not what it "should" do.
 *
 * Quirks pinned (see inline comments):
 *   - createBudgetTask hardcodes status:'פעיל' and writes an approval record with
 *     status:'auto_approved' / autoApproved:true (no approval is actually required).
 *   - estimate coercion is `||`-based (estimatedMinutes || estimatedHours*60).
 *   - adjustTaskBudget records type:'decrease' when addedMinutes === 0 (a no-op
 *     newEstimate === oldEstimate is logged as a 'decrease').
 *   - adjustTaskBudget reason defaults to 'לא צוין'; updateData never touches
 *     originalEstimate or actualMinutes.
 *   - getBudgetTasks visibility: non-admin is filtered by where('employee','==',email);
 *     admin gets NO employee filter; data.status is applied verbatim (no whitelist).
 *
 * Harness mirrors tests/budget-task-idempotency.test.js (SDK-boundary mock,
 * _collection-tagged write filters) + a chainable query fake for getBudgetTasks.
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

// getBudgetTasks query: records every .where() + returns a configurable snapshot.
const mockQueryWhereCalls = [];
const mockQueryGet = jest.fn(async () => ({ forEach: () => {} }));

function makeCollection(name) {
  const col = {
    _collection: name,
    doc: jest.fn((id) => ({
      id: id || `auto_${name}`,
      _collection: name,
      get: jest.fn(async () => ({ exists: false }))
    })),
    where: jest.fn(function (field, op, val) {
      mockQueryWhereCalls.push({ collection: name, field, op, val });
      return col; // chainable
    }),
    limit: jest.fn(() => col),
    get: (...a) => mockQueryGet(name, ...a)
  };
  return col;
}

const mockDb = {
  collection: jest.fn((name) => makeCollection(name)),
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

jest.mock('../shared/auth', () => ({ checkUserPermissions: jest.fn() }));
jest.mock('../shared/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));
jest.mock('../addTimeToTask_v2', () => ({
  addTimeToTaskWithTransaction: jest.fn().mockResolvedValue({ success: true })
}));

const { createBudgetTask, adjustTaskBudget, getBudgetTasks } = require('../budget-tasks/index');
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

function makeClientDoc(overrides = {}) {
  return { exists: true, data: () => ({ clientName: 'לקוח טסט', caseNumber: '2025001', ...overrides }) };
}

function makeTaskDoc(overrides = {}) {
  const d = { employee: 'user@test', status: 'פעיל', estimatedMinutes: 120, actualMinutes: 60, ...overrides };
  return { exists: true, data: () => d };
}

const baseCreateData = {
  description: 'משימת בדיקה',
  clientId: '2025001',
  branch: 'ראשי',
  serviceId: 'svc1',
  estimatedMinutes: 120
};

function taskCreates() {
  return mockTransaction.set.mock.calls.filter(([ref]) => ref && ref._collection === 'budget_tasks');
}
function approvalCreates() {
  return mockTransaction.set.mock.calls.filter(([ref]) => ref && ref._collection === 'pending_task_approvals');
}
function taskUpdates() {
  return mockTransaction.update.mock.calls.filter(([ref]) => ref && ref._collection === 'budget_tasks');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
  mockQueryWhereCalls.length = 0;
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
  mockQueryGet.mockReset();
  mockQueryGet.mockResolvedValue({ forEach: () => {} });
  checkUserPermissions.mockReset();
  checkUserPermissions.mockResolvedValue({ ...DEFAULT_USER });
});

// ════════════════════════════════════════════════════════════════
// createBudgetTask — payload / approval shape
// ════════════════════════════════════════════════════════════════

describe('createBudgetTask — payload shape (characterization)', () => {

  test('task doc shape: hardcoded status פעיל, snapshotted originalEstimate, zeroed actuals, empty arrays', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc());

    const result = await createBudgetTask({ ...baseCreateData }, makeCtx());
    expect(result.success).toBe(true);

    const creates = taskCreates();
    expect(creates).toHaveLength(1);
    const payload = creates[0][1];
    expect(payload).toMatchObject({
      description: 'משימת בדיקה',
      branch: 'ראשי',
      serviceId: 'svc1',
      clientId: '2025001',
      clientName: 'לקוח טסט',          // clientData.clientName (preferred)
      caseNumber: '2025001',           // clientData.caseNumber
      estimatedMinutes: 120,
      estimatedHours: 2,               // 120/60 via the || coercion
      actualHours: 0,
      actualMinutes: 0,
      originalEstimate: 120,           // snapshot of estimatedMinutes (immutable)
      status: 'פעיל',                  // QUIRK: hardcoded (no approval gate)
      employee: 'user@test',           // EMAIL (security queries)
      lawyer: 'user',
      createdBy: 'user',
      lastModifiedBy: 'user',
      budgetAdjustments: [],
      deadlineExtensions: [],
      timeEntries: []
    });
  });

  test('approval record: auto_approved / autoApproved:true, Hebrew requestedByName', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc());

    await createBudgetTask({ ...baseCreateData }, makeCtx());

    const approvals = approvalCreates();
    expect(approvals).toHaveLength(1);
    const appr = approvals[0][1];
    expect(appr).toMatchObject({
      requestedBy: 'user@test',
      requestedByName: 'שם עובד',      // user.employee.name preferred over username
      requestedMinutes: 120,
      status: 'auto_approved',         // QUIRK: written even though "no approval needed"
      autoApproved: true,
      taskData: { description: 'משימת בדיקה', clientName: 'לקוח טסט', clientId: '2025001', estimatedMinutes: 120 }
    });
  });

  test('estimate coercion from estimatedHours only (|| based): hours 2 → minutes 120', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc());

    // no estimatedMinutes; estimatedHours 2 → estimatedMinutes = 2*60 = 120
    await createBudgetTask({ description: 'בדיקה', clientId: '2025001', branch: 'ראשי', serviceId: 'svc1', estimatedHours: 2 }, makeCtx());

    const payload = taskCreates()[0][1];
    expect(payload.estimatedMinutes).toBe(120);
    expect(payload.estimatedHours).toBe(2);
    expect(payload.originalEstimate).toBe(120);
  });

  test('clientName falls back to data.clientName when the client doc has none', async () => {
    // clientData has caseNumber but no clientName → taskData.clientName = data.clientName
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc({ clientName: undefined }));

    await createBudgetTask({ ...baseCreateData, clientName: 'שם מהבקשה' }, makeCtx());

    const payload = taskCreates()[0][1];
    expect(payload.clientName).toBe('שם מהבקשה');
    expect(payload.caseNumber).toBe('2025001');
  });
});

// ════════════════════════════════════════════════════════════════
// adjustTaskBudget — budget-change semantics
// ════════════════════════════════════════════════════════════════

describe('adjustTaskBudget — budget-change semantics (characterization)', () => {

  test('increase: records adjustment + updateData; does NOT touch originalEstimate/actualMinutes', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ estimatedMinutes: 120, actualMinutes: 60 }));

    const result = await adjustTaskBudget({ taskId: 'task1', newEstimate: 180, reason: 'חריגה' }, makeCtx());

    expect(result).toEqual({
      success: true, taskId: 'task1', oldEstimate: 120, newEstimate: 180, addedMinutes: 60,
      message: 'תקציב עודכן מ-120 ל-180 דקות'
    });

    const updates = taskUpdates();
    expect(updates).toHaveLength(1);
    const payload = updates[0][1];
    expect(payload.estimatedMinutes).toBe(180);
    expect(payload.estimatedHours).toBe(3);            // newEstimate/60
    // immutable fields are NOT in the update payload
    expect(payload).not.toHaveProperty('originalEstimate');
    expect(payload).not.toHaveProperty('actualMinutes');

    // the adjustment object rides inside FieldValue.arrayUnion(...)
    const adjustment = payload.budgetAdjustments._arrayUnion[0];
    expect(adjustment).toMatchObject({
      type: 'increase',
      oldEstimate: 120,
      newEstimate: 180,
      addedMinutes: 60,
      reason: 'חריגה',
      adjustedBy: 'user',
      actualAtTime: 60            // snapshot of taskData.actualMinutes at adjust time
    });
  });

  test('QUIRK: newEstimate === oldEstimate → addedMinutes 0 → recorded as type "decrease"', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ estimatedMinutes: 120 }));

    const result = await adjustTaskBudget({ taskId: 'task1', newEstimate: 120, reason: 'ללא שינוי' }, makeCtx());

    expect(result.addedMinutes).toBe(0);
    const adjustment = taskUpdates()[0][1].budgetAdjustments._arrayUnion[0];
    // addedMinutes > 0 is false when addedMinutes === 0 → 'decrease'
    expect(adjustment.type).toBe('decrease');
  });

  test('reason defaults to לא צוין when none supplied', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ estimatedMinutes: 120 }));

    await adjustTaskBudget({ taskId: 'task1', newEstimate: 180 }, makeCtx());

    const adjustment = taskUpdates()[0][1].budgetAdjustments._arrayUnion[0];
    expect(adjustment.reason).toBe('לא צוין');
  });

  test('already-הושלם task → failed-precondition (cannot adjust a completed task)', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc({ status: 'הושלם' }));
    await expect(adjustTaskBudget({ taskId: 'task1', newEstimate: 180 }, makeCtx())).rejects.toMatchObject({
      code: 'failed-precondition'
    });
    expect(taskUpdates()).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════
// getBudgetTasks — visibility query gate
// ════════════════════════════════════════════════════════════════

describe('getBudgetTasks — query gate (characterization)', () => {

  test('non-admin → query filtered by where(employee == email)', async () => {
    mockQueryGet.mockResolvedValueOnce({
      forEach: (cb) => [{ id: 't1', data: () => ({ description: 'a', employee: 'user@test' }) }].forEach(cb)
    });

    const result = await getBudgetTasks({}, makeCtx());

    expect(result).toEqual({ success: true, tasks: [{ id: 't1', description: 'a', employee: 'user@test' }] });
    // the employee visibility filter WAS applied
    expect(mockQueryWhereCalls).toEqual(
      expect.arrayContaining([{ collection: 'budget_tasks', field: 'employee', op: '==', val: 'user@test' }])
    );
  });

  test('admin → NO employee filter (sees all)', async () => {
    checkUserPermissions.mockResolvedValueOnce({ ...DEFAULT_USER, role: 'admin' });
    mockQueryGet.mockResolvedValueOnce({ forEach: () => {} });

    const result = await getBudgetTasks({}, makeCtx());

    expect(result.success).toBe(true);
    // no employee filter for admins
    expect(mockQueryWhereCalls.some((w) => w.field === 'employee')).toBe(false);
  });

  test('data.status → applied verbatim as where(status == value)', async () => {
    mockQueryGet.mockResolvedValueOnce({ forEach: () => {} });

    await getBudgetTasks({ status: 'פעיל' }, makeCtx());

    expect(mockQueryWhereCalls).toEqual(
      expect.arrayContaining([{ collection: 'budget_tasks', field: 'status', op: '==', val: 'פעיל' }])
    );
  });

  test('return shape: {success, tasks:[{id, ...data}]} across multiple docs', async () => {
    mockQueryGet.mockResolvedValueOnce({
      forEach: (cb) => [
        { id: 't1', data: () => ({ description: 'a' }) },
        { id: 't2', data: () => ({ description: 'b' }) }
      ].forEach(cb)
    });

    const result = await getBudgetTasks({}, makeCtx());
    expect(result.tasks).toEqual([
      { id: 't1', description: 'a' },
      { id: 't2', description: 'b' }
    ]);
  });
});
