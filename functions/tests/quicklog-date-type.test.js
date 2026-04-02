/**
 * Tests for Quick Log date type mismatch fix.
 *
 * Covers:
 * A. createQuickLogEntry date parsing (lines 115-152 in timesheet/index.js)
 *    - ISO string → "YYYY-MM-DD"
 *    - {seconds, nanoseconds} map → "YYYY-MM-DD"
 *    - Timestamp object (.toDate()) → "YYYY-MM-DD"
 *    - Invalid / missing date → HttpsError
 *
 * B. WhatsApp Bot query format (WhatsAppBot.js)
 *    - showAllEmployeesTimesheets queries with "YYYY-MM-DD" string
 *    - showEmployeeTimesheets queries with "YYYY-MM-DD" string
 *    - Display defensive handling: entry.date as Timestamp, string, or missing
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
  sanitizeString: jest.fn((s) => s)
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
  checkIdempotency: jest.fn().mockResolvedValue(false),
  registerIdempotency: jest.fn().mockResolvedValue(undefined),
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

// ═══════════════════════════════════════════════════════════════
// B. WhatsApp Bot — Query & Display Tests
// ═══════════════════════════════════════════════════════════════

describe('WhatsApp Bot — date query and display', () => {
  let WhatsAppBot;
  let bot;
  let mockBotDb;

  beforeEach(() => {
    jest.clearAllMocks();

    // Build a mock DB for the bot
    mockBotDb = {
      collection: jest.fn()
    };

    // Use a minimal constructor — WhatsAppBot needs db, twilioClient, etc.
    // We'll require the class fresh and inject our mock
    jest.isolateModules(() => {
      // Mock twilio before requiring WhatsAppBot
      jest.mock('twilio', () => jest.fn(() => ({
        messages: { create: jest.fn() }
      })));

      WhatsAppBot = require('../src/whatsapp-bot/WhatsAppBot');
    });

    bot = Object.create(WhatsAppBot.prototype);
    bot.db = mockBotDb;
  });

  // ───────────────────────────────────────────────────────────
  // Query format: showAllEmployeesTimesheets
  // ───────────────────────────────────────────────────────────

  test('showAllEmployeesTimesheets queries date with "YYYY-MM-DD" string', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);

    const mockGet = jest.fn().mockResolvedValue({ empty: true, forEach: jest.fn() });
    const mockWhere = jest.fn().mockReturnValue({ get: mockGet });
    mockBotDb.collection.mockReturnValue({ where: mockWhere });

    await bot.showAllEmployeesTimesheets();

    // Verify collection target
    expect(mockBotDb.collection).toHaveBeenCalledWith('timesheet_entries');

    // Verify query uses string, not Date object
    expect(mockWhere).toHaveBeenCalledWith('date', '==', todayStr);

    // Confirm format is YYYY-MM-DD string
    const queryValue = mockWhere.mock.calls[0][2];
    expect(typeof queryValue).toBe('string');
    expect(queryValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ───────────────────────────────────────────────────────────
  // Query format: showEmployeeTimesheets
  // ───────────────────────────────────────────────────────────

  test('showEmployeeTimesheets queries date with "YYYY-MM-DD" string', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);

    const mockGet = jest.fn().mockResolvedValue({ empty: true, forEach: jest.fn() });
    const mockWhere2 = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });
    mockBotDb.collection.mockReturnValue({ where: mockWhere1 });

    const employee = { email: 'emp@test.com', name: 'Test Employee' };
    await bot.showEmployeeTimesheets(employee);

    // First where: employeeEmail
    expect(mockWhere1).toHaveBeenCalledWith('employeeEmail', '==', 'emp@test.com');

    // Second where: date as string
    expect(mockWhere2).toHaveBeenCalledWith('date', '==', todayStr);

    const queryValue = mockWhere2.mock.calls[0][2];
    expect(typeof queryValue).toBe('string');
    expect(queryValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ───────────────────────────────────────────────────────────
  // Display defensive handling
  // ───────────────────────────────────────────────────────────

  test('showEmployeeTimesheets handles entry.date as "YYYY-MM-DD" string', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const entries = [{
      data: () => ({
        minutes: 60,
        isClientWork: true,
        createdAt: { toDate: () => new Date('2026-04-02T10:00:00Z') },
        date: '2026-04-02', // string format (new)
        clientName: 'Client A',
        action: 'Consultation'
      })
    }];

    const mockGet = jest.fn().mockResolvedValue({
      empty: false,
      forEach: (cb) => entries.forEach(cb)
    });
    const mockWhere2 = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });
    mockBotDb.collection.mockReturnValue({ where: mockWhere1 });

    const employee = { email: 'emp@test.com', name: 'Test Employee' };
    const response = await bot.showEmployeeTimesheets(employee);

    // Should not throw, should produce readable output
    expect(response).toContain('Test Employee');
    expect(response).toContain('Client A');
    expect(response).toContain('Consultation');
  });

  test('showEmployeeTimesheets handles entry.date as legacy Timestamp', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const entries = [{
      data: () => ({
        minutes: 45,
        isClientWork: false,
        createdAt: null, // no createdAt — fallback to date.toDate()
        date: { toDate: () => new Date('2026-04-02T14:30:00Z') }, // legacy Timestamp
        clientName: null,
        action: 'Internal work'
      })
    }];

    const mockGet = jest.fn().mockResolvedValue({
      empty: false,
      forEach: (cb) => entries.forEach(cb)
    });
    const mockWhere2 = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });
    mockBotDb.collection.mockReturnValue({ where: mockWhere1 });

    const employee = { email: 'emp@test.com', name: 'Test Employee' };
    const response = await bot.showEmployeeTimesheets(employee);

    // Should not throw — uses date.toDate() fallback
    expect(response).toContain('Test Employee');
    expect(response).toContain('Internal work');
  });

  test('showEmployeeTimesheets handles entry with createdAt Timestamp (preferred path)', async () => {
    const entries = [{
      data: () => ({
        minutes: 30,
        isClientWork: true,
        createdAt: { toDate: () => new Date('2026-04-02T09:15:00Z') }, // preferred
        date: '2026-04-02', // string — no toDate method
        clientName: 'Client B',
        action: 'Draft contract'
      })
    }];

    const mockGet = jest.fn().mockResolvedValue({
      empty: false,
      forEach: (cb) => entries.forEach(cb)
    });
    const mockWhere2 = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });
    mockBotDb.collection.mockReturnValue({ where: mockWhere1 });

    const employee = { email: 'emp@test.com', name: 'Test Employee' };
    const response = await bot.showEmployeeTimesheets(employee);

    // Should use createdAt.toDate() for time display (not date field)
    expect(response).toContain('Client B');
    expect(response).toContain('Draft contract');
  });

  test('display handles entry with no createdAt and string date (uses new Date(string))', async () => {
    const entries = [{
      data: () => ({
        minutes: 20,
        isClientWork: true,
        createdAt: null,
        date: '2026-04-02', // string, no toDate
        clientName: 'Client C',
        action: 'Research'
      })
    }];

    const mockGet = jest.fn().mockResolvedValue({
      empty: false,
      forEach: (cb) => entries.forEach(cb)
    });
    const mockWhere2 = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });
    mockBotDb.collection.mockReturnValue({ where: mockWhere1 });

    const employee = { email: 'emp@test.com', name: 'Test Employee' };
    const response = await bot.showEmployeeTimesheets(employee);

    // Falls through to new Date(entry.date) — should not throw
    expect(response).toContain('Client C');
    expect(response).toContain('Research');
  });
});
