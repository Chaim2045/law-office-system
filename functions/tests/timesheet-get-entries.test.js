/**
 * CHARACTERIZATION goldens — getTimesheetEntries visibility / query gate
 * (timesheet/index.js:1269).
 *
 * getTimesheetEntries had ZERO direct tests. It is a pure READ callable: it
 * builds a `timesheet_entries` query, applies an admin-vs-employee visibility
 * filter + optional clientId/date filters, and returns {success, entries}.
 * This suite pins the CURRENT behavior AS-IS so a future JS→TS rewrite of
 * timesheet/index.js can't silently drift the visibility gate (the security-
 * critical `where('employee','==',email)` line), the filter set, the return
 * shape, or the catch-rethrow-vs-wrap error contract. It asserts what the code
 * DOES today, not what it "should" do.
 *
 * Quirks pinned (see inline comments):
 *   - non-admin is scoped by where('employee','==', user.email) (by EMAIL);
 *     admin gets NO employee filter (sees every employee's entries).
 *   - data.clientId / data.startDate / data.endDate are applied verbatim as
 *     where('clientId','==',v) / where('date','>=',start) / where('date','<=',end)
 *     — no whitelist, no validation, no normalization at this layer.
 *   - a thrown HttpsError is rethrown verbatim; any OTHER error is wrapped as
 *     HttpsError('internal', `שגיאה בטעינת רישומי שעות: ${error.message}`).
 *
 * Harness: mounts the whole timesheet/index.js require graph the way
 * tests/update-guard.test.js does (same SDK-boundary mock set — the rest of the
 * graph loads as real modules), plus a chainable query fake (mirrors
 * tests/budget-task-create-adjust-get.test.js) that RECORDS every .where() so
 * the visibility gate is assertable. test/setup.js is untouched.
 */

// ═══════════════════════════════════════════════════════════════
// Mocks — must precede require()
// ═══════════════════════════════════════════════════════════════

const mockWhereCalls = [];
const mockQueryGet = jest.fn(async () => ({ forEach: () => {} }));

const mockTransaction = { get: jest.fn(), set: jest.fn(), update: jest.fn() };

// Chainable query fake: .where() records + returns itself; .get() is configurable.
function makeQuery(name) {
  const q = {
    _collection: name,
    where: jest.fn((field, op, val) => {
      mockWhereCalls.push({ collection: name, field, op, val });
      return q; // chainable — getTimesheetEntries stacks up to 4 .where() calls
    }),
    get: (...a) => mockQueryGet(name, ...a),
    limit: jest.fn(() => q),
    orderBy: jest.fn(() => q),
    doc: jest.fn((id) => ({
      id: id || `auto_${name}`,
      _collection: name,
      get: jest.fn(async () => ({ exists: false })),
      set: jest.fn(),
      update: jest.fn(),
      collection: jest.fn(() => makeQuery(`${name}_sub`))
    }))
  };
  return q;
}

const mockDb = {
  collection: jest.fn((name) => makeQuery(name)),
  runTransaction: jest.fn(async (fn) => fn(mockTransaction))
};

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(() => mockDb, {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
      increment: jest.fn((n) => ({ _increment: n })),
      arrayUnion: jest.fn((...args) => ({ _arrayUnion: args }))
    },
    Timestamp: {
      now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0 })),
      fromDate: jest.fn((d) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }))
    }
  })
}));

jest.mock('firebase-functions', () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
      }
    },
    onCall: jest.fn((fn) => fn)
  },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn(() => jest.fn())
}));

jest.mock('../shared/auth', () => ({ checkUserPermissions: jest.fn() }));
jest.mock('../shared/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));

// ═══════════════════════════════════════════════════════════════
// Imports
// ═══════════════════════════════════════════════════════════════

const { getTimesheetEntries } = require('../timesheet/index');
const { checkUserPermissions } = require('../shared/auth');
const { https } = require('firebase-functions');

// ─── fixtures ──────────────────────────────────────────────────

const EMPLOYEE_USER = { uid: 'u1', email: 'user@test.com', username: 'user', role: 'employee' };
const ADMIN_USER = { uid: 'a1', email: 'admin@test.com', username: 'admin', role: 'admin' };

function snapshotOf(docs) {
  return { forEach: (cb) => docs.forEach(cb) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWhereCalls.length = 0;
  mockQueryGet.mockReset();
  mockQueryGet.mockResolvedValue({ forEach: () => {} });
  checkUserPermissions.mockReset();
  checkUserPermissions.mockReturnValue({ ...EMPLOYEE_USER }); // default: non-admin
});

// ════════════════════════════════════════════════════════════════
// getTimesheetEntries — visibility query gate (characterization)
// ════════════════════════════════════════════════════════════════

describe('getTimesheetEntries — visibility query gate (characterization)', () => {

  test('non-admin → query scoped by where(employee == user.email); reads timesheet_entries', async () => {
    mockQueryGet.mockResolvedValueOnce(snapshotOf([
      { id: 'e1', data: () => ({ minutes: 60, employee: 'user@test.com' }) }
    ]));

    const result = await getTimesheetEntries({}, {});

    expect(result).toEqual({ success: true, entries: [{ id: 'e1', minutes: 60, employee: 'user@test.com' }] });
    expect(mockDb.collection).toHaveBeenCalledWith('timesheet_entries');
    // the security-critical employee-scoping filter WAS applied
    expect(mockWhereCalls).toEqual(
      expect.arrayContaining([{ collection: 'timesheet_entries', field: 'employee', op: '==', val: 'user@test.com' }])
    );
  });

  test('admin → NO employee filter (sees every employee\'s entries)', async () => {
    checkUserPermissions.mockReturnValueOnce({ ...ADMIN_USER });
    mockQueryGet.mockResolvedValueOnce(snapshotOf([]));

    const result = await getTimesheetEntries({}, {});

    expect(result.success).toBe(true);
    expect(mockWhereCalls.some((w) => w.field === 'employee')).toBe(false);
  });

  test('data.clientId → where(clientId == value) applied verbatim', async () => {
    mockQueryGet.mockResolvedValueOnce(snapshotOf([]));

    await getTimesheetEntries({ clientId: '2025001' }, {});

    expect(mockWhereCalls).toEqual(
      expect.arrayContaining([{ collection: 'timesheet_entries', field: 'clientId', op: '==', val: '2025001' }])
    );
  });

  test('data.startDate / endDate → where(date >= start) + where(date <= end)', async () => {
    mockQueryGet.mockResolvedValueOnce(snapshotOf([]));

    await getTimesheetEntries({ startDate: '2026-01-01', endDate: '2026-01-31' }, {});

    expect(mockWhereCalls).toEqual(expect.arrayContaining([
      { collection: 'timesheet_entries', field: 'date', op: '>=', val: '2026-01-01' },
      { collection: 'timesheet_entries', field: 'date', op: '<=', val: '2026-01-31' }
    ]));
  });

  test('admin + all filters → clientId + both date bounds, still NO employee filter', async () => {
    checkUserPermissions.mockReturnValueOnce({ ...ADMIN_USER });
    mockQueryGet.mockResolvedValueOnce(snapshotOf([]));

    await getTimesheetEntries({ clientId: 'C9', startDate: '2026-02-01', endDate: '2026-02-28' }, {});

    const fields = mockWhereCalls.map((w) => w.field);
    expect(fields).toEqual(expect.arrayContaining(['clientId', 'date', 'date']));
    expect(fields).not.toContain('employee');
  });

  test('return shape: {success, entries:[{id, ...data}]} across multiple docs', async () => {
    mockQueryGet.mockResolvedValueOnce(snapshotOf([
      { id: 'e1', data: () => ({ minutes: 30 }) },
      { id: 'e2', data: () => ({ minutes: 90 }) }
    ]));

    const result = await getTimesheetEntries({}, {});

    expect(result.entries).toEqual([
      { id: 'e1', minutes: 30 },
      { id: 'e2', minutes: 90 }
    ]);
  });

  test('QUIRK: a thrown HttpsError is rethrown verbatim (not re-wrapped as internal)', async () => {
    checkUserPermissions.mockImplementationOnce(() => {
      throw new https.HttpsError('unauthenticated', 'לא מחובר');
    });

    await expect(getTimesheetEntries({}, {})).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'לא מחובר'
    });
  });

  test('QUIRK: a non-HttpsError is wrapped as HttpsError(internal) with a Hebrew message', async () => {
    mockQueryGet.mockRejectedValueOnce(new Error('boom'));

    await expect(getTimesheetEntries({}, {})).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining('שגיאה בטעינת רישומי שעות')
    });
  });
});
