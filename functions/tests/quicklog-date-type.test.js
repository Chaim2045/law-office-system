/**
 * Tests for Quick Log date type mismatch fix.
 *
 * Covers:
 * A. createQuickLogEntry date parsing (lines 115-152 in timesheet/index.js)
 *    - ISO string → "YYYY-MM-DD"
 *    - {seconds, nanoseconds} map → "YYYY-MM-DD"
 *    - Timestamp object (.toDate()) → "YYYY-MM-DD"
 *    - Invalid / missing date → HttpsError
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

jest.mock('../src/modules/deduction', () => ({
  getActivePackage: jest.fn().mockResolvedValue(null)
}));

jest.mock('../src/modules/aggregation', () => ({
  round2: jest.fn((n) => Math.round(n * 100) / 100),
  applyHoursDelta: jest.fn().mockResolvedValue(undefined),
  applyHoursDeltaServiceOnly: jest.fn().mockResolvedValue(undefined),
  applyLegalProcedureDelta: jest.fn().mockResolvedValue(undefined),
  applyLegalProcedureDeltaStageOnly: jest.fn().mockResolvedValue(undefined),
  calcClientAggregates: jest.fn().mockResolvedValue(undefined)
}));

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
// ═══════════════════════════════════════════════════════════════

const { createQuickLogEntry } = require('../timesheet/index');
const functions = require('firebase-functions');

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Build minimal valid data for createQuickLogEntry */
function makeData(dateOverride) {
  return {
    clientId: 'client_1',
    clientName: 'Test Client',
    date: dateOverride,
    minutes: 30,
    description: 'Test entry'
  };
}

/** Set up mocks so the transaction gets past client/service/package lookups */
function setupHappyPath() {
  // Client doc exists, has one service, one package
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
// A. createQuickLogEntry — Date Parsing Tests
// ═══════════════════════════════════════════════════════════════

describe('createQuickLogEntry — date parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupHappyPath();
  });

  // ───────────────────────────────────────────────────────────
  // Format 1: ISO string
  // ───────────────────────────────────────────────────────────

  test('ISO string with time → stores "YYYY-MM-DD" string', async () => {
    const data = makeData('2026-04-02T00:00:00.000Z');

    const result = await createQuickLogEntry(data, mockContext);

    // Find the set() call that writes the entry
    const setCalls = mockTransaction.set.mock.calls;
    const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];

    expect(entryData).toBeDefined();
    expect(entryData.date).toBe('2026-04-02');
    expect(typeof entryData.date).toBe('string');
  });

  test('short ISO string "YYYY-MM-DD" → stores same string', async () => {
    const data = makeData('2026-03-15');

    const result = await createQuickLogEntry(data, mockContext);

    const setCalls = mockTransaction.set.mock.calls;
    const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];

    expect(entryData.date).toBe('2026-03-15');
  });

  test('ISO string with timezone offset → extracts date from input prefix', async () => {
    // The code does data.date.substring(0,10) to avoid timezone shift
    const data = makeData('2026-04-02T23:59:59.999Z');

    const result = await createQuickLogEntry(data, mockContext);

    const setCalls = mockTransaction.set.mock.calls;
    const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];

    expect(entryData.date).toBe('2026-04-02');
  });

  // ───────────────────────────────────────────────────────────
  // Format 2: {seconds, nanoseconds} map (Callable serialization)
  // ───────────────────────────────────────────────────────────

  test('{seconds, nanoseconds} map → stores "YYYY-MM-DD" string', async () => {
    // 2026-04-02 00:00:00 UTC → 1774915200 seconds
    const epochSeconds = Math.floor(new Date('2026-04-02T00:00:00.000Z').getTime() / 1000);
    const data = makeData({ seconds: epochSeconds, nanoseconds: 0 });

    const result = await createQuickLogEntry(data, mockContext);

    const setCalls = mockTransaction.set.mock.calls;
    const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];

    expect(entryData.date).toBe('2026-04-02');
    expect(typeof entryData.date).toBe('string');
  });

  test('{seconds, nanoseconds} with non-zero nanos → still correct date', async () => {
    const epochSeconds = Math.floor(new Date('2026-01-15T12:30:00.000Z').getTime() / 1000);
    const data = makeData({ seconds: epochSeconds, nanoseconds: 500000000 });

    const result = await createQuickLogEntry(data, mockContext);

    const setCalls = mockTransaction.set.mock.calls;
    const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];

    expect(entryData.date).toBe('2026-01-15');
  });

  // ───────────────────────────────────────────────────────────
  // Format 3: Timestamp object with .toDate()
  // ───────────────────────────────────────────────────────────

  test('Timestamp object (.toDate()) → stores "YYYY-MM-DD" string', async () => {
    const fakeTimestamp = {
      toDate: () => new Date('2026-04-02T00:00:00.000Z')
    };
    const data = makeData(fakeTimestamp);

    const result = await createQuickLogEntry(data, mockContext);

    const setCalls = mockTransaction.set.mock.calls;
    const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];

    expect(entryData.date).toBe('2026-04-02');
    expect(typeof entryData.date).toBe('string');
  });

  // ───────────────────────────────────────────────────────────
  // Invalid / missing date → HttpsError
  // ───────────────────────────────────────────────────────────

  test('null date → throws invalid-argument', async () => {
    const data = makeData(null);

    await expect(createQuickLogEntry(data, mockContext))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('number date → throws invalid-argument', async () => {
    const data = makeData(12345);

    await expect(createQuickLogEntry(data, mockContext))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('invalid string date → throws invalid-argument', async () => {
    const data = makeData('not-a-date');

    await expect(createQuickLogEntry(data, mockContext))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('empty object (no seconds, no toDate) → throws invalid-argument', async () => {
    const data = makeData({});

    await expect(createQuickLogEntry(data, mockContext))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  // ───────────────────────────────────────────────────────────
  // Output format consistency
  // ───────────────────────────────────────────────────────────

  test('all 3 formats produce identical date for same day', async () => {
    const targetDate = '2026-06-15';
    const epochSeconds = Math.floor(new Date('2026-06-15T00:00:00.000Z').getTime() / 1000);

    const formats = [
      '2026-06-15T00:00:00.000Z',                            // ISO string
      { seconds: epochSeconds, nanoseconds: 0 },             // {seconds, nanoseconds}
      { toDate: () => new Date('2026-06-15T00:00:00.000Z') } // Timestamp
    ];

    const results = [];

    for (const dateInput of formats) {
      jest.clearAllMocks();
      setupHappyPath();

      await createQuickLogEntry(makeData(dateInput), mockContext);

      const setCalls = mockTransaction.set.mock.calls;
      const entryData = setCalls.find(c => c[1] && c[1].date)?.[1];
      results.push(entryData.date);
    }

    // All three must produce the same "YYYY-MM-DD" string
    expect(results).toEqual([targetDate, targetDate, targetDate]);
    results.forEach(r => expect(typeof r).toBe('string'));
  });
});
