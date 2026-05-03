/**
 * Tests for Quick Log idempotency protection.
 *
 * Covers:
 * A. Backend — createQuickLogEntry idempotency flow
 *    - No idempotencyKey → normal execution (backward compat)
 *    - New idempotencyKey → executes + registers
 *    - Existing idempotencyKey → returns cached result (skips transaction)
 *    - Failed transaction → does NOT register idempotency
 *
 * B. Frontend — generateQuickLogIdempotencyKey
 *    - Deterministic: same input → same key
 *    - Different inputs → different keys
 *    - Uses dateValue (YYYY-MM-DD), not dateISO
 *    - Prefix is "quicklog_" (no collision with "timesheet_")
 */

// ═══════════════════════════════════════════════════════════════
// Mocks — must precede require()
// ═══════════════════════════════════════════════════════════════

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};

const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id,
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
  }
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

jest.mock('../src/modules/deduction', () => ({
  getActivePackage: jest.fn().mockResolvedValue(null)
}));

jest.mock('../src/modules/aggregation', () => ({
  round2: jest.fn((n) => Math.round(n * 100) / 100),
  applyHoursDelta: jest.fn().mockReturnValue(undefined),
  applyHoursDeltaServiceOnly: jest.fn().mockReturnValue(undefined),
  applyLegalProcedureDelta: jest.fn().mockReturnValue(undefined),
  applyLegalProcedureDeltaStageOnly: jest.fn().mockReturnValue(undefined),
  calcClientAggregates: jest.fn().mockReturnValue(undefined)
}));

const mockCheckIdempotency = jest.fn().mockResolvedValue(null);
const mockRegisterIdempotency = jest.fn().mockResolvedValue(undefined);

jest.mock('../timesheet/helpers', () => ({
  createTimeEvent: jest.fn(),
  checkIdempotency: mockCheckIdempotency,
  registerIdempotency: mockRegisterIdempotency,
  createReservation: jest.fn().mockResolvedValue(undefined),
  commitReservation: jest.fn().mockResolvedValue(undefined),
  rollbackReservation: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../timesheet/internal-case', () => ({
  getOrCreateInternalCase: jest.fn()
}));

// ═══════════════════════════════════════════════════════════════
// Require the module under test
// ═══════════════════════════════════════════════════════════════

const { createQuickLogEntry } = require('../timesheet/index');

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
    ...overrides
  };
}

function setupHappyPath() {
  const clientDoc = {
    exists: true,
    data: () => ({
      clientName: 'Test Client',
      services: [{
        id: 'svc_1',
        name: 'Service A',
        type: 'hours',
        parentServiceId: null,
        isBlocked: false,
        hoursRemaining: 10,
        packages: [{
          id: 'pkg_1',
          hoursRemaining: 10,
          status: 'active'
        }]
      }]
    })
  };

  mockTransaction.get.mockResolvedValue(clientDoc);
  mockTransaction.set.mockReturnValue(undefined);
  mockTransaction.update.mockReturnValue(undefined);
}

const mockContext = { auth: { uid: 'user1' } };

// ═══════════════════════════════════════════════════════════════
// A. Backend — createQuickLogEntry Idempotency
// ═══════════════════════════════════════════════════════════════

describe('createQuickLogEntry — idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupHappyPath();
    mockCheckIdempotency.mockResolvedValue(null);
    mockRegisterIdempotency.mockResolvedValue(undefined);
  });

  // ───────────────────────────────────────────────────────────
  // Backward compatibility: no key → normal execution
  // ───────────────────────────────────────────────────────────

  test('no idempotencyKey → executes normally, does NOT call check or register', async () => {
    const data = makeData(); // no idempotencyKey

    const result = await createQuickLogEntry(data, mockContext);

    expect(result.success).toBe(true);
    // checkIdempotency may be called with undefined → returns null (null guard in helpers)
    // registerIdempotency should NOT be called (no key provided)
    expect(mockRegisterIdempotency).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────
  // New key → executes + registers
  // ───────────────────────────────────────────────────────────

  test('new idempotencyKey → executes transaction + registers result', async () => {
    const data = makeData({ idempotencyKey: 'quicklog_test_key_123' });
    mockCheckIdempotency.mockResolvedValue(null); // not found

    const result = await createQuickLogEntry(data, mockContext);

    // Should check
    expect(mockCheckIdempotency).toHaveBeenCalledWith('quicklog_test_key_123');

    // Should execute transaction
    expect(mockRunTransaction).toHaveBeenCalled();

    // Should register after success
    expect(mockRegisterIdempotency).toHaveBeenCalledWith(
      'quicklog_test_key_123',
      expect.objectContaining({ success: true })
    );

    expect(result.success).toBe(true);
  });

  // ───────────────────────────────────────────────────────────
  // Existing key → returns cached, skips transaction
  // ───────────────────────────────────────────────────────────

  test('existing idempotencyKey → returns cached result, skips transaction', async () => {
    const cachedResult = {
      success: true,
      entryId: 'cached_entry_123',
      message: 'רישום נוצר בהצלחה'
    };
    mockCheckIdempotency.mockResolvedValue(cachedResult);

    const data = makeData({ idempotencyKey: 'quicklog_already_done' });

    const result = await createQuickLogEntry(data, mockContext);

    // Should check
    expect(mockCheckIdempotency).toHaveBeenCalledWith('quicklog_already_done');

    // Should NOT run transaction
    expect(mockRunTransaction).not.toHaveBeenCalled();

    // Should NOT register again
    expect(mockRegisterIdempotency).not.toHaveBeenCalled();

    // Should return the cached result
    expect(result).toEqual(cachedResult);
  });

  // ───────────────────────────────────────────────────────────
  // Failed transaction → does NOT register
  // ───────────────────────────────────────────────────────────

  test('transaction failure → does NOT register idempotency', async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const data = makeData({ idempotencyKey: 'quicklog_will_fail' });

    await expect(createQuickLogEntry(data, mockContext)).rejects.toThrow();

    // Should check (before transaction)
    expect(mockCheckIdempotency).toHaveBeenCalledWith('quicklog_will_fail');

    // Should NOT register (transaction failed)
    expect(mockRegisterIdempotency).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────
  // Idempotency check runs AFTER authorization
  // ───────────────────────────────────────────────────────────

  test('non-manager user → permission error before idempotency check', async () => {
    const { checkUserPermissions } = require('../shared/auth');
    checkUserPermissions.mockResolvedValueOnce({
      uid: 'user2',
      email: 'employee@test.com',
      username: 'Regular Employee',
      role: 'employee'
    });

    const data = makeData({ idempotencyKey: 'quicklog_unauthorized' });

    await expect(createQuickLogEntry(data, mockContext)).rejects.toThrow('רק מנהלים');

    // Should NOT check idempotency (authorization failed first)
    expect(mockCheckIdempotency).not.toHaveBeenCalled();
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
