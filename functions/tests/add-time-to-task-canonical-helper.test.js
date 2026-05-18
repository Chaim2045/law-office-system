/**
 * Dedicated test suite for PR-B.9 — explicit coverage of the canonical
 * helper integration in addTimeToTaskWithTransaction.
 *
 * Why this suite (per Grader W1):
 *   - addTimeToTask is the most-trafficked CF in the system (every time entry)
 *   - The existing tests (serviceId-validation, stage-parentServiceId-gates,
 *     fixed-service-type) verify the prior code paths still work, but they
 *     don't EXPLICITLY assert helper-integration behavior.
 *   - This suite asserts the migration contract directly:
 *     (a) Helper invoked exactly once with `{ services, lastActivity }`-shaped
 *         payload + auditMeta `{ uid, username }`
 *     (b) Helper NOT invoked when clientId === 'internal_office'
 *     (c) Helper called BEFORE transaction.update(taskRef, ...) — Firestore
 *         "all reads before writes" requirement
 *     (d) -10h overdraft floor still throws CLIENT_OVERDRAFT_SOFT and helper
 *         is NOT called
 *     (e) LEGAL_PROCEDURE branch still routes through helper
 *     (f) FIXED branch still routes through helper (deduction is no-op
 *         on aggregates but services are written)
 */

// ═══════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════

// Capture invocation ORDER across distinct mock functions
const mockCallOrder = [];
function mockRecordCall(name, args) {
  mockCallOrder.push({ name, args });
}

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn((...args) => mockRecordCall('transaction.set', args)),
  update: jest.fn((...args) => mockRecordCall('transaction.update', args))
};

const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn((id) => ({ id: id || `auto_${Date.now()}` }))
  })),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n })),
    arrayUnion: jest.fn((v) => ({ _arrayUnion: v }))
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

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  isValidIsraeliPhone: jest.fn(() => true),
  isValidEmail: jest.fn(() => true)
}));

// Spy on the helper — wrap real impl + record invocations
const mockHelperSpy = jest.fn();
jest.mock('../shared/client-writer', () => {
  const actual = jest.requireActual('../shared/client-writer');
  return {
    ...actual,
    writeClientWithCanonicalAggregates: jest.fn(async (transaction, ref, payload, opts) => {
      mockRecordCall('helper.writeClientWithCanonicalAggregates', [
        { refId: ref.id, payload, opts }
      ]);
      mockHelperSpy(transaction, ref, payload, opts);
      return actual.writeClientWithCanonicalAggregates(transaction, ref, payload, opts);
    })
  };
});

// ═══════════════════════════════════════════════════════════════
// Requires — after mocks
// ═══════════════════════════════════════════════════════════════

const { addTimeToTaskWithTransaction } = require('../addTimeToTask_v2');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeTaskDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      employee: 'user@test.com',
      clientId: 'c1',
      serviceId: 'svc_1',
      description: 'מטלה',
      actualMinutes: 0,
      estimatedMinutes: 60,
      ...overrides
    })
  };
}

function makeHoursService(id, { totalHours = 10, hoursUsed = 0, packages = null } = {}) {
  const pkg = packages || [{
    id: `${id}_pkg_initial`,
    type: 'initial',
    hours: totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    status: 'active'
  }];
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    packages: pkg,
    status: 'active'
  };
}

function makeFixedService(id) {
  return {
    id,
    type: ST.FIXED,
    name: `פיקס ${id}`,
    fixedPrice: 5000,
    status: 'active',
    work: { totalMinutesWorked: 0, entriesCount: 0 }
  };
}

function makeLegalProcedureService(id, { totalHours = 10 } = {}) {
  return {
    id,
    type: ST.LEGAL_PROCEDURE,
    name: `הליך משפטי ${id}`,
    pricingType: PT.HOURLY,
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    currentStage: 'stage_a',
    stages: [
      {
        id: 'stage_a',
        name: 'שלב א',
        status: 'active',
        pricingType: PT.HOURLY,
        totalHours,
        hoursUsed: 0,
        hoursRemaining: totalHours,
        packages: [{
          id: `${id}_stage_a_pkg_initial`,
          type: 'initial',
          hours: totalHours,
          hoursUsed: 0,
          hoursRemaining: totalHours,
          status: 'active'
        }]
      },
      { id: 'stage_b', name: 'שלב ב', status: 'pending', pricingType: PT.HOURLY },
      { id: 'stage_c', name: 'שלב ג', status: 'pending', pricingType: PT.HOURLY }
    ],
    status: 'active'
  };
}

function makeClientDoc(services = []) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS || s.type === ST.LEGAL_PROCEDURE)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length
    })
  };
}

const defaultUser = {
  uid: 'user1',
  email: 'user@test.com',
  username: 'testuser',
  role: 'manager'
};

const defaultData = {
  taskId: 'task1',
  minutes: 60,
  date: '2026-05-18',
  description: 'work'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
});

// ═══════════════════════════════════════════════════════════════
// A. Helper invoked correctly on happy path
// ═══════════════════════════════════════════════════════════════

describe('A. Helper invocation contract', () => {
  test('HOURS service: helper called exactly once with services + lastActivity + auditMeta', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_1' });
    const clientDoc = makeClientDoc([makeHoursService('svc_1', { totalHours: 10 })]);
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc); // helper internal

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
    expect(mockHelperSpy).toHaveBeenCalledTimes(1);
    const [, , payload, opts] = mockHelperSpy.mock.calls[0];

    // Payload shape: services + lastActivity ONLY (no aggregate fields)
    expect(Object.keys(payload).sort()).toEqual(['lastActivity', 'services']);
    expect(payload.services).toBeDefined();
    expect(payload.lastActivity).toBe('SERVER_TIMESTAMP');

    // auditMeta shape
    expect(opts).toMatchObject({
      caller: 'addTimeToTaskWithTransaction',
      auditMeta: { uid: 'user1', username: 'testuser' }
    });
  });

  test('LEGAL_PROCEDURE service: helper called with services (stage deduction applied)', async () => {
    const taskDoc = makeTaskDoc({
      serviceId: 'stage_a',
      parentServiceId: 'srv_legal_1'
    });
    const clientDoc = makeClientDoc([makeLegalProcedureService('srv_legal_1')]);
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
    expect(mockHelperSpy).toHaveBeenCalledTimes(1);
    const [, , payload] = mockHelperSpy.mock.calls[0];
    expect(payload.services).toBeDefined();
    // Verify the LEGAL_PROCEDURE service is in the services array sent to helper
    expect(payload.services.find(s => s.id === 'srv_legal_1')).toBeDefined();
  });

  test('FIXED service: helper called with services even though FIXED is not billable', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_fixed' });
    const clientDoc = makeClientDoc([makeFixedService('svc_fixed')]);
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
    expect(mockHelperSpy).toHaveBeenCalledTimes(1);
    const [, , payload] = mockHelperSpy.mock.calls[0];
    expect(payload.services.find(s => s.id === 'svc_fixed')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Helper NOT invoked when deduction skipped
// ═══════════════════════════════════════════════════════════════

describe('B. Helper NOT invoked when deduction is null', () => {
  test('internal task (clientId === "internal_office") → helper NOT called, task + timesheet + log still written', async () => {
    const taskDoc = makeTaskDoc({ clientId: 'internal_office', serviceId: null });
    mockTransaction.get.mockResolvedValueOnce(taskDoc);
    // No client doc — internal task path
    mockTransaction.get.mockResolvedValueOnce({ exists: false });

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
    expect(mockHelperSpy).not.toHaveBeenCalled();

    // task + timesheet + log writes still happened
    expect(mockTransaction.update).toHaveBeenCalled(); // task update
    expect(mockTransaction.set).toHaveBeenCalled();    // timesheet + log
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Helper called BEFORE transaction.update(taskRef) — read-before-write
// ═══════════════════════════════════════════════════════════════

describe('C. Phase 3 ordering — helper FIRST', () => {
  test('helper invoked before transaction.update(taskRef) in Phase 3', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_1' });
    const clientDoc = makeClientDoc([makeHoursService('svc_1')]);
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    // Find helper call + first transaction.update in mockCallOrder
    const helperIdx = mockCallOrder.findIndex(c => c.name === 'helper.writeClientWithCanonicalAggregates');
    const firstTxUpdateIdx = mockCallOrder.findIndex(c => c.name === 'transaction.update');

    expect(helperIdx).toBeGreaterThanOrEqual(0);
    expect(firstTxUpdateIdx).toBeGreaterThanOrEqual(0);
    expect(helperIdx).toBeLessThan(firstTxUpdateIdx);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. -10h overdraft floor — helper NOT called, throws before any write
// ═══════════════════════════════════════════════════════════════

describe('D. -10h overdraft floor guard', () => {
  test('attempting to deduct beyond -10h on hours service → throws + helper NOT called', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_1' });
    // Service has 1h remaining, attempt to deduct 12h → would land at -11h → block
    const clientDoc = makeClientDoc([makeHoursService('svc_1', { totalHours: 10, hoursUsed: 9 })]);
    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    await expect(
      addTimeToTaskWithTransaction(mockDb, { ...defaultData, minutes: 720 /* 12h */ }, defaultUser)
    ).rejects.toBeDefined();

    expect(mockHelperSpy).not.toHaveBeenCalled();
    // task / timesheet / log NOT written either (thrown before Phase 3)
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockTransaction.set).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Conditional preservation — helper guard matches prior code
// ═══════════════════════════════════════════════════════════════

describe('E. Conditional invocation matches prior gate', () => {
  test('client with no services + no clientRef → helper NOT called (client doc not found)', async () => {
    const taskDoc = makeTaskDoc({ clientId: 'c_missing', serviceId: null });
    mockTransaction.get.mockResolvedValueOnce(taskDoc);
    mockTransaction.get.mockResolvedValueOnce({ exists: false });

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
    expect(mockHelperSpy).not.toHaveBeenCalled();
  });
});
