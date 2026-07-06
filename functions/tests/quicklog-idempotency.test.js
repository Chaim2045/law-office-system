/**
 * PR-2 — atomic exactly-once idempotency for createQuickLogEntry.
 *
 * Retired: this suite used to test the NON-ATOMIC helpers.checkIdempotency()
 * (read BEFORE the transaction) / helpers.registerIdempotency() (write AFTER
 * the transaction committed) pair. That pattern left a gap — a lost-ack retry
 * on a weak network could slip between the check and the register and re-run
 * the write (a duplicate quick-log entry / duplicate hours).
 *
 * PR-2 moved createQuickLogEntry onto the SAME atomic, transaction-scoped
 * primitive functions/addTimeToTask_v2.js uses (PR-1), via the shared
 * functions/shared/idempotency.js module. This suite now pins:
 *
 * A. Backend — createQuickLogEntry idempotency flow (atomic)
 *    - No idempotencyKey → normal execution (backward compat), no
 *      processed_operations doc created.
 *    - New idempotencyKey → executes transaction + records processed_operations
 *      via transaction.create() (NOT .set()), in the SAME transaction as the
 *      real writes.
 *    - Existing idempotencyKey (Phase-1 read finds it) → returns the stored
 *      result, performs NO client write / NO timesheet entry / NO cost write /
 *      NO audit log.
 *    - Concurrent already-exists (a sibling call won the transaction.create()
 *      race) → returns the sibling's stored result, does NOT throw, does NOT
 *      retry into a duplicate write.
 *
 * B. Frontend — generateQuickLogIdempotencyKey (unchanged — key-generation
 *    algorithm is a pure frontend concern, not touched by PR-2)
 *    - Deterministic: same input → same key
 *    - Different inputs → different keys
 *    - Uses dateValue (YYYY-MM-DD), not dateISO
 *    - Prefix is "quicklog_" (no collision with "timesheet_")
 */

// ═══════════════════════════════════════════════════════════════
// Mocks — must precede require()
// ═══════════════════════════════════════════════════════════════

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

// The post-catch concurrent-replay path does a DIRECT (non-transaction) read
// of processed_operations/{key}. Route .get() by collection so it never
// collides with a queued transaction.get() value.
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
      get: () => routedDirectGet(name),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ id: 'auto_id' }))
      }))
    })),
    where: jest.fn(() => mockWhereChain)
  })),
  runTransaction: mockRunTransaction,
  batch: jest.fn(() => ({
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined)
  }))
};

const mockWhereResult = { get: jest.fn().mockResolvedValue({ empty: true, forEach: jest.fn() }) };
const mockWhereChain = {
  where: jest.fn(() => mockWhereResult),
  orderBy: jest.fn(() => ({ limit: jest.fn(() => mockWhereResult) }))
};

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => mockDb, {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
      increment: jest.fn((n) => ({ _increment: n })),
      arrayUnion: jest.fn((...args) => ({ _arrayUnion: args }))
    },
    Timestamp: {
      fromDate: jest.fn((d) => ({
        seconds: Math.floor(d.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => d
      }))
    }
  }),
  initializeApp: jest.fn()
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
  // PR-B.10: writeClientWithCanonicalAggregates + enforcement-mode call
  // functions.logger.{info,warn,error}. Mock to silence + prevent undefined.
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../shared/auth', () => ({
  checkUserPermissions: jest.fn().mockResolvedValue({
    uid: 'user1',
    email: 'manager@test.com',
    username: 'Manager Test',
    role: 'manager'
  })
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  // getDescriptionLimit added in source 2d88fc3 (config-driven limits).
  // Tests don't exercise length validation; mock returns generous default (500).
  getDescriptionLimit: jest.fn().mockResolvedValue(500)
}));

// PR-2: no more checkIdempotency/registerIdempotency in ./helpers — the atomic
// primitive lives in ../shared/idempotency (used directly by timesheet/index.js).
jest.mock('../timesheet/helpers', () => ({
  createTimeEvent: jest.fn(),
  createReservation: jest.fn().mockResolvedValue(undefined),
  commitReservation: jest.fn().mockResolvedValue(undefined),
  rollbackReservation: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../timesheet/internal-case', () => ({
  getOrCreateInternalCase: jest.fn()
}));

// ═══════════════════════════════════════════════════════════════
// Require the module under test
// (deduction/aggregation modules are NOT mocked — real logic runs, mirroring
// tests/create-quick-log-canonical-helper.test.js, so the canonical helper's
// internal transaction.get(clientRef) + aggregate math behave exactly as in
// production.)
// ═══════════════════════════════════════════════════════════════

const { createQuickLogEntry } = require('../timesheet/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function makeData(overrides = {}) {
  return {
    clientId: 'client_1',
    clientName: 'Test Client',
    date: '2026-04-02T00:00:00.000Z',
    minutes: 30,
    description: 'Test entry',
    serviceId: 'svc_1',
    ...overrides
  };
}

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

function makeClientDoc(services = [makeHoursService('svc_1')]) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      clientName: 'Test Client',
      status: 'active',
      services,
      totalHours,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length
    })
  };
}

const mockContext = { auth: { uid: 'user1', token: { email: 'manager@test.com', role: 'manager' } } };

// Count only the writes that constitute the "real" mutation (client helper
// write happens via transaction.update in the canonical helper; the timesheet
// entry + cost doc + audit log are transaction.set calls on distinct collections).
function timesheetEntryWrites() {
  return mockTransaction.set.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'timesheet_entries'
  );
}
function auditLogWrites() {
  return mockTransaction.set.mock.calls.filter(
    ([ref]) => ref && ref._collection === 'audit_log'
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

// ═══════════════════════════════════════════════════════════════
// A. Backend — createQuickLogEntry Idempotency (ATOMIC, PR-2)
// ═══════════════════════════════════════════════════════════════

describe('createQuickLogEntry — atomic idempotency (PR-2)', () => {

  // ───────────────────────────────────────────────────────────
  // Backward compatibility: no key → normal execution
  // ───────────────────────────────────────────────────────────

  test('no idempotencyKey → executes normally, no processed_operations doc created', async () => {
    const clientDoc = makeClientDoc();
    // Phase 1: client read (no idempotency read — no key supplied). The
    // canonical writeClientWithCanonicalAggregates helper does its OWN
    // internal transaction.get(clientRef) in Phase 3 (cache hit in prod;
    // mocked here as a second resolved value).
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const data = makeData(); // no idempotencyKey
    const result = await createQuickLogEntry(data, mockContext);

    expect(result.success).toBe(true);
    expect(timesheetEntryWrites()).toHaveLength(1);
    expect(idempotencyCreates()).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────
  // New key → executes transaction + records via transaction.create()
  // ───────────────────────────────────────────────────────────

  test('new idempotencyKey → executes transaction + records processed_operations via create()', async () => {
    const clientDoc = makeClientDoc();
    // Phase 1: client read, THEN idempotency read (not found → fresh key).
    // Phase 3: canonical helper's internal client re-read (cache hit in prod).
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce(clientDoc);

    const data = makeData({ idempotencyKey: 'quicklog_test_key_123' });
    const result = await createQuickLogEntry(data, mockContext);

    expect(result.success).toBe(true);
    expect(mockRunTransaction).toHaveBeenCalled();
    expect(timesheetEntryWrites()).toHaveLength(1);
    expect(auditLogWrites()).toHaveLength(1);

    const creates = idempotencyCreates();
    expect(creates).toHaveLength(1);
    const [ref, doc] = creates[0];
    expect(ref.id).toBe('quicklog_test_key_123');
    expect(doc.idempotencyKey).toBe('quicklog_test_key_123');
    expect(doc.status).toBe('completed');
    expect(doc.result).toEqual(result); // same object persisted verbatim
  });

  // ───────────────────────────────────────────────────────────
  // Existing key (Phase-1 read finds it) → returns cached, skips ALL writes
  // ───────────────────────────────────────────────────────────

  test('existing idempotencyKey → Phase-1 read finds it, returns stored result, NO writes', async () => {
    const cachedResult = {
      success: true,
      entryId: 'cached_entry_123',
      message: 'רישום נוצר בהצלחה'
    };
    const clientDoc = makeClientDoc();

    // Phase 1: client read, THEN idempotency read (found → short-circuit).
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce({ exists: true, data: () => ({ result: cachedResult }) });

    const data = makeData({ idempotencyKey: 'quicklog_already_done' });
    const result = await createQuickLogEntry(data, mockContext);

    expect(result).toEqual(cachedResult);
    // No mutation at all — the duplicate is blocked inside the transaction.
    expect(timesheetEntryWrites()).toHaveLength(0);
    expect(auditLogWrites()).toHaveLength(0);
    expect(idempotencyCreates()).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────
  // Transaction failure (non-idempotency error) → propagates, no partial state
  // ───────────────────────────────────────────────────────────

  test('transaction failure (non already-exists) → propagates error, no retry', async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const data = makeData({ idempotencyKey: 'quicklog_will_fail' });

    await expect(createQuickLogEntry(data, mockContext)).rejects.toThrow();
    expect(mockRunTransaction).toHaveBeenCalledTimes(1); // no retry for a generic error
  });

  // ───────────────────────────────────────────────────────────
  // Concurrent already-exists → post-catch read finds winner doc → replay
  // ───────────────────────────────────────────────────────────

  test('concurrent already-exists → post-catch read finds winner doc → returns stored result (no throw)', async () => {
    const storedResult = {
      success: true,
      entryId: 'entry_from_winner',
      message: 'רישום נוצר בהצלחה'
    };
    const clientDoc = makeClientDoc();

    // The transaction runs (idempotency read = not-yet-present), does its
    // writes, then transaction.create throws ALREADY_EXISTS at commit
    // (sibling won the race).
    mockRunTransaction.mockImplementationOnce(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce({ exists: false }) // idempotency: not visible in-txn yet
        .mockResolvedValueOnce(clientDoc); // helper's internal client re-read
      await fn(mockTransaction); // runs the body (writes recorded)
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err; // commit-time race loss
    });

    // Post-catch direct read: the winner's committed doc is now visible.
    mockProcessedOpsGet.mockResolvedValueOnce({ exists: true, data: () => ({ result: storedResult }) });

    const data = makeData({ idempotencyKey: 'quicklog_concurrent' });
    const result = await createQuickLogEntry(data, mockContext);

    expect(result).toEqual(storedResult);
    expect(mockProcessedOpsGet).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1); // no second attempt
  });

  // ───────────────────────────────────────────────────────────
  // Exhausted retries on already-exists (winner never visible) → Hebrew abort
  // (G1: never leak the raw English SDK 'already exists' string; never surface
  // a false failure that would push a fresh-key re-submit = a real duplicate)
  // ───────────────────────────────────────────────────────────

  test('exhausted already-exists retries (winner never visible) → Hebrew aborted error, no raw SDK string', async () => {
    const clientDoc = makeClientDoc();

    // EVERY attempt: body runs, create() throws already-exists at commit, and
    // the winner's committed doc is NEVER visible to the post-catch replay read.
    mockRunTransaction.mockImplementation(async (fn) => {
      mockTransaction.get
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce(clientDoc);
      await fn(mockTransaction);
      const err = new Error('already exists');
      err.code = 'already-exists';
      throw err;
    });
    mockProcessedOpsGet.mockResolvedValue({ exists: false }); // never visible

    const data = makeData({ idempotencyKey: 'quicklog_never_visible' });

    let caught;
    try {
      await createQuickLogEntry(data, mockContext);
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

  // ───────────────────────────────────────────────────────────
  // Idempotency check runs AFTER authorization
  // ───────────────────────────────────────────────────────────

  test('non-manager user → permission error before any transaction / idempotency check', async () => {
    const { checkUserPermissions } = require('../shared/auth');
    checkUserPermissions.mockResolvedValueOnce({
      uid: 'user2',
      email: 'employee@test.com',
      username: 'Regular Employee',
      role: 'employee'
    });

    const data = makeData({ idempotencyKey: 'quicklog_unauthorized' });

    await expect(createQuickLogEntry(data, mockContext)).rejects.toThrow('רק מנהלים');

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Frontend — Key Generation (unit tests for the algorithm)
// ═══════════════════════════════════════════════════════════════

describe('Quick Log idempotency key generation', () => {

  // Replicate the frontend functions for testing
  function quickLogSimpleHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36).slice(0, 8);
  }

  function generateQuickLogIdempotencyKey({ email, date, description, minutes, clientId, serviceId }) {
    const descHash = quickLogSimpleHash(description || '');
    const contextHash = quickLogSimpleHash([clientId || '', serviceId || ''].join('|'));
    return `quicklog_${email}_${date}_${descHash}_${minutes}_${contextHash}`;
  }

  // Also replicate the v2 adapter's function for collision test
  function simpleHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36).slice(0, 8);
  }

  function generateV2IdempotencyKey(entryData) {
    const employee = entryData.employee || 'unknown';
    const date = entryData.date;
    const actionHash = simpleHash(entryData.action || '');
    const minutes = entryData.minutes;
    const contextString = [
      entryData.clientId || '',
      entryData.serviceId || '',
      entryData.stageId || '',
      entryData.taskId || '',
      entryData.isInternal ? '1' : '0'
    ].join('|');
    const contextHash = simpleHash(contextString);
    return `timesheet_${employee}_${date}_${actionHash}_${minutes}_${contextHash}`;
  }

  // ───────────────────────────────────────────────────────────
  // Deterministic
  // ───────────────────────────────────────────────────────────

  test('same input → same key (deterministic)', () => {
    const input = {
      email: 'manager@test.com',
      date: '2026-04-02',
      description: 'ייעוץ משפטי ללקוח',
      minutes: 45,
      clientId: 'client_1',
      serviceId: 'svc_1'
    };

    const key1 = generateQuickLogIdempotencyKey(input);
    const key2 = generateQuickLogIdempotencyKey(input);

    expect(key1).toBe(key2);
  });

  // ───────────────────────────────────────────────────────────
  // Different inputs → different keys
  // ───────────────────────────────────────────────────────────

  test('different description → different key', () => {
    const base = {
      email: 'manager@test.com',
      date: '2026-04-02',
      minutes: 45,
      clientId: 'client_1',
      serviceId: 'svc_1'
    };

    const key1 = generateQuickLogIdempotencyKey({ ...base, description: 'ייעוץ משפטי' });
    const key2 = generateQuickLogIdempotencyKey({ ...base, description: 'פגישה עם לקוח' });

    expect(key1).not.toBe(key2);
  });

  test('different minutes → different key', () => {
    const base = {
      email: 'manager@test.com',
      date: '2026-04-02',
      description: 'ייעוץ',
      clientId: 'client_1',
      serviceId: 'svc_1'
    };

    const key1 = generateQuickLogIdempotencyKey({ ...base, minutes: 30 });
    const key2 = generateQuickLogIdempotencyKey({ ...base, minutes: 60 });

    expect(key1).not.toBe(key2);
  });

  test('different client → different key', () => {
    const base = {
      email: 'manager@test.com',
      date: '2026-04-02',
      description: 'ייעוץ',
      minutes: 45,
      serviceId: 'svc_1'
    };

    const key1 = generateQuickLogIdempotencyKey({ ...base, clientId: 'client_1' });
    const key2 = generateQuickLogIdempotencyKey({ ...base, clientId: 'client_2' });

    expect(key1).not.toBe(key2);
  });

  test('different date → different key', () => {
    const base = {
      email: 'manager@test.com',
      description: 'ייעוץ',
      minutes: 45,
      clientId: 'client_1',
      serviceId: 'svc_1'
    };

    const key1 = generateQuickLogIdempotencyKey({ ...base, date: '2026-04-02' });
    const key2 = generateQuickLogIdempotencyKey({ ...base, date: '2026-04-03' });

    expect(key1).not.toBe(key2);
  });

  // ───────────────────────────────────────────────────────────
  // Prefix: "quicklog_" — no collision with v2 "timesheet_"
  // ───────────────────────────────────────────────────────────

  test('key starts with "quicklog_" prefix', () => {
    const key = generateQuickLogIdempotencyKey({
      email: 'manager@test.com',
      date: '2026-04-02',
      description: 'test',
      minutes: 30,
      clientId: 'c1',
      serviceId: 's1'
    });

    expect(key.startsWith('quicklog_')).toBe(true);
  });

  test('no collision with v2 adapter key for identical data', () => {
    const quickLogKey = generateQuickLogIdempotencyKey({
      email: 'manager@test.com',
      date: '2026-04-02',
      description: 'ייעוץ משפטי',
      minutes: 45,
      clientId: 'client_1',
      serviceId: 'svc_1'
    });

    const v2Key = generateV2IdempotencyKey({
      employee: 'manager@test.com',
      date: '2026-04-02',
      action: 'ייעוץ משפטי',
      minutes: 45,
      clientId: 'client_1',
      serviceId: 'svc_1',
      stageId: '',
      taskId: '',
      isInternal: false
    });

    // Different prefix → never collide in processed_operations
    expect(quickLogKey).not.toBe(v2Key);
    expect(quickLogKey.startsWith('quicklog_')).toBe(true);
    expect(v2Key.startsWith('timesheet_')).toBe(true);
  });

  // ───────────────────────────────────────────────────────────
  // Uses dateValue (YYYY-MM-DD), not dateISO — timezone safe
  // ───────────────────────────────────────────────────────────

  test('uses date as-is (YYYY-MM-DD) — embedded directly in key', () => {
    const key = generateQuickLogIdempotencyKey({
      email: 'test@test.com',
      date: '2026-04-02',
      description: 'x',
      minutes: 1,
      clientId: 'c',
      serviceId: 's'
    });

    // The date should appear verbatim in the key
    expect(key).toContain('_2026-04-02_');
  });

  // ───────────────────────────────────────────────────────────
  // Hash function consistency
  // ───────────────────────────────────────────────────────────

  test('quickLogSimpleHash is identical to timesheet-adapter simpleHash', () => {
    const testStrings = ['hello', 'ייעוץ משפטי', '', '   ', 'client_1|svc_1'];

    testStrings.forEach(str => {
      expect(quickLogSimpleHash(str)).toBe(simpleHash(str));
    });
  });
});
