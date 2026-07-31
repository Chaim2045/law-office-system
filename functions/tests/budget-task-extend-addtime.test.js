/**
 * CHARACTERIZATION goldens (package 3, closes budget-tasks) — extendTaskDeadline
 * + the addTimeToTask wrapper.
 *
 * Both had ZERO behavior tests. This suite pins the CURRENT behavior AS-IS
 * (quirks included) so a future JS→TS rewrite of budget-tasks/index.js can't
 * silently drift them. It asserts what the code DOES, not what it "should".
 *
 * extendTaskDeadline is the structural odd-one-out: it is NON-transactional
 * (a direct doc `.get()` then a direct doc `.update()`, no runTransaction), so
 * its harness differs from the other budget-task suites (a configurable direct
 * get + a direct update spy, not `transaction.get`/`transaction.update`).
 *
 * Quirks pinned (see inline comments):
 *   - extendTaskDeadline blocks completed tasks by BOTH statuses: 'הושלם' OR 'completed'.
 *   - originalDeadline = originalDeadline || deadline || newDeadlineDate — a task
 *     with NEITHER prior date gets the NEW deadline stamped as its "original".
 *   - the extension record uses Timestamp.now() (a fixed value), NOT serverTimestamp().
 *   - the audit call is NOT try/caught → a failed audit FAILS the whole call
 *     (throws 'internal') EVEN THOUGH the non-transactional update already
 *     committed — the one CF here where a post-write audit failure surfaces an error.
 *   - addTimeToTask is a thin validation+delegation wrapper: 3 guards, then
 *     forwards (db, data, user) to addTimeToTaskWithTransaction and returns it verbatim.
 */

const mockRunTransaction = jest.fn(async (fn) => fn({ get: jest.fn(), set: jest.fn(), update: jest.fn(), create: jest.fn() }));

// extendTaskDeadline direct (non-txn) doc get + update. Records (collectionName, ...).
const mockDirectGet = jest.fn(async () => ({ exists: false }));
const mockDirectUpdate = jest.fn(async () => {});

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id: id || `auto_${name}`,
      _collection: name,
      get: (...a) => mockDirectGet(name, ...a),
      update: (payload) => mockDirectUpdate(name, id, payload)
    }))
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

jest.mock('../shared/auth', () => ({ checkUserPermissions: jest.fn() }));
jest.mock('../shared/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));
jest.mock('../addTimeToTask_v2', () => ({
  addTimeToTaskWithTransaction: jest.fn().mockResolvedValue({ success: true })
}));

const { extendTaskDeadline, addTimeToTask } = require('../budget-tasks/index');
const { logAction } = require('../shared/audit');
const { checkUserPermissions } = require('../shared/auth');
const { addTimeToTaskWithTransaction } = require('../addTimeToTask_v2');

// ─── fixtures ──────────────────────────────────────────────────

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

const DEFAULT_USER = {
  uid: 'user1', email: 'user@test', username: 'user', role: 'employee',
  employee: { name: 'שם עובד', isAdmin: false }
};

function makeExtendTaskDoc(overrides = {}) {
  const d = { employee: 'user@test', status: 'פעיל', deadline: 'OLD_TS', originalDeadline: 'ORIG_TS', ...overrides };
  return { exists: true, data: () => d };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDirectGet.mockReset();
  mockDirectGet.mockResolvedValue({ exists: false });
  mockDirectUpdate.mockReset();
  mockDirectUpdate.mockResolvedValue(undefined);
  checkUserPermissions.mockReset();
  checkUserPermissions.mockResolvedValue({ ...DEFAULT_USER });
  logAction.mockReset();
  logAction.mockResolvedValue(undefined);
  addTimeToTaskWithTransaction.mockReset();
  addTimeToTaskWithTransaction.mockResolvedValue({ success: true });
});

// ════════════════════════════════════════════════════════════════
// addTimeToTask — validation + delegation wrapper
// ════════════════════════════════════════════════════════════════

describe('addTimeToTask — wrapper (characterization)', () => {

  test('missing taskId → invalid-argument', async () => {
    await expect(addTimeToTask({ minutes: 30, date: '2026-01-01' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'חסר מזהה משימה'
    });
    expect(addTimeToTaskWithTransaction).not.toHaveBeenCalled();
  });

  test('minutes not a positive number → invalid-argument', async () => {
    await expect(addTimeToTask({ taskId: 't1', minutes: 0, date: '2026-01-01' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'דקות חייבות להיות מספר חיובי'
    });
    // a string is not `typeof === 'number'` → same reject
    await expect(addTimeToTask({ taskId: 't1', minutes: '30', date: '2026-01-01' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'דקות חייבות להיות מספר חיובי'
    });
  });

  test('missing date → invalid-argument', async () => {
    await expect(addTimeToTask({ taskId: 't1', minutes: 30 }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'חסר תאריך'
    });
  });

  test('valid → forwards (db, data, user) to addTimeToTaskWithTransaction and returns it verbatim', async () => {
    addTimeToTaskWithTransaction.mockResolvedValueOnce({ success: true, newActualMinutes: 90, tag: 'from-delegate' });

    const data = { taskId: 't1', minutes: 30, date: '2026-01-01' };
    const result = await addTimeToTask(data, makeCtx());

    // returned unchanged from the delegate
    expect(result).toEqual({ success: true, newActualMinutes: 90, tag: 'from-delegate' });
    // called once with (db, data, resolved-user)
    expect(addTimeToTaskWithTransaction).toHaveBeenCalledTimes(1);
    const [dbArg, dataArg, userArg] = addTimeToTaskWithTransaction.mock.calls[0];
    expect(dbArg).toBe(mockDb);
    expect(dataArg).toBe(data);
    expect(userArg).toMatchObject({ uid: 'user1', email: 'user@test' });
  });
});

// ════════════════════════════════════════════════════════════════
// extendTaskDeadline — non-transactional direct get/update
// ════════════════════════════════════════════════════════════════

describe('extendTaskDeadline — characterization', () => {

  const baseExtend = { taskId: 't1', newDeadline: '2026-12-31', reason: 'דחיית דיון' };

  test('missing taskId → invalid-argument', async () => {
    await expect(extendTaskDeadline({ newDeadline: '2026-12-31', reason: 'x1' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'חסר מזהה משימה'
    });
  });

  test('missing newDeadline → invalid-argument', async () => {
    await expect(extendTaskDeadline({ taskId: 't1', reason: 'x1' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'חסר תאריך יעד חדש'
    });
  });

  test('reason missing or < 2 chars → invalid-argument', async () => {
    await expect(extendTaskDeadline({ taskId: 't1', newDeadline: '2026-12-31' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: expect.stringContaining('חובה לספק סיבה להארכה')
    });
    await expect(extendTaskDeadline({ taskId: 't1', newDeadline: '2026-12-31', reason: 'x' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: expect.stringContaining('חובה לספק סיבה להארכה')
    });
  });

  test('task not found → not-found', async () => {
    mockDirectGet.mockResolvedValueOnce({ exists: false });
    await expect(extendTaskDeadline({ ...baseExtend }, makeCtx())).rejects.toMatchObject({
      code: 'not-found', message: 'משימה לא נמצאה'
    });
  });

  test('not owner and not admin → permission-denied', async () => {
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc({ employee: 'other@test' }));
    await expect(extendTaskDeadline({ ...baseExtend }, makeCtx())).rejects.toMatchObject({
      code: 'permission-denied', message: 'אין הרשאה להאריך יעד למשימה זו'
    });
    expect(mockDirectUpdate).not.toHaveBeenCalled();
  });

  test('QUIRK: completed task blocked by BOTH הושלם and completed statuses', async () => {
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc({ status: 'הושלם' }));
    await expect(extendTaskDeadline({ ...baseExtend }, makeCtx())).rejects.toMatchObject({ code: 'failed-precondition' });

    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc({ status: 'completed' }));
    await expect(extendTaskDeadline({ ...baseExtend }, makeCtx())).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('unparseable newDeadline → invalid-argument', async () => {
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc());
    await expect(extendTaskDeadline({ taskId: 't1', newDeadline: 'לא-תאריך', reason: 'סיבה' }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument', message: 'תאריך היעד החדש אינו תקין'
    });
    expect(mockDirectUpdate).not.toHaveBeenCalled();
  });

  test('happy path → direct update with the extension record (Timestamp.now, not serverTimestamp)', async () => {
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc({ deadline: 'OLD_TS', originalDeadline: 'ORIG_TS' }));

    const result = await extendTaskDeadline({ ...baseExtend }, makeCtx());

    expect(result).toEqual({ success: true, taskId: 't1', newDeadline: '2026-12-31' });

    expect(mockDirectUpdate).toHaveBeenCalledTimes(1);
    const [coll, id, payload] = mockDirectUpdate.mock.calls[0];
    expect(coll).toBe('budget_tasks');
    expect(id).toBe('t1');
    expect(payload.deadline).toEqual({ _ts: new Date('2026-12-31').toISOString() });
    expect(payload.originalDeadline).toBe('ORIG_TS');           // existing original preserved
    expect(payload.lastModifiedBy).toBe('user');
    expect(payload.lastModifiedAt).toBe('SERVER_TIMESTAMP');

    // the extension rides inside arrayUnion
    const extension = payload.deadlineExtensions._arrayUnion[0];
    expect(extension).toMatchObject({
      oldDeadline: 'OLD_TS',
      newDeadline: { _ts: new Date('2026-12-31').toISOString() },
      reason: 'דחיית דיון',
      extendedBy: 'user',
      extendedAt: 'NOW'          // QUIRK: Timestamp.now(), NOT serverTimestamp()
    });
  });

  test('QUIRK: task with no original/deadline → the NEW deadline becomes its originalDeadline', async () => {
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc({ deadline: undefined, originalDeadline: undefined }));

    await extendTaskDeadline({ ...baseExtend }, makeCtx());

    const payload = mockDirectUpdate.mock.calls[0][2];
    // originalDeadline = originalDeadline || deadline || newDeadlineDate → the raw new Date
    expect(payload.originalDeadline).toBeInstanceOf(Date);
    expect(payload.originalDeadline.toISOString()).toBe(new Date('2026-12-31').toISOString());
  });

  test('QUIRK: a failed audit FAILS the call (throws internal) even after the update committed', async () => {
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc());
    logAction.mockRejectedValueOnce(new Error('audit down'));

    await expect(extendTaskDeadline({ ...baseExtend }, makeCtx())).rejects.toMatchObject({ code: 'internal' });

    // the non-transactional update already ran before the audit threw — it is NOT rolled back
    expect(mockDirectUpdate).toHaveBeenCalledTimes(1);
  });

  test('admin may extend another employee\'s task', async () => {
    checkUserPermissions.mockResolvedValueOnce({ ...DEFAULT_USER, role: 'admin' });
    mockDirectGet.mockResolvedValueOnce(makeExtendTaskDoc({ employee: 'other@test' }));

    const result = await extendTaskDeadline({ ...baseExtend }, makeCtx());
    expect(result.success).toBe(true);
    expect(mockDirectUpdate).toHaveBeenCalledTimes(1);
  });
});
