/**
 * Tests for createTimesheetEntry_v2 CF after PR-B.11 migration.
 *
 * Coverage:
 *   A. Helper integration (with deduction)
 *   B. Helper integration (no deduction)
 *   C. Internal-case path bypasses helper
 *   D. `_version` pass-through (NOT in RESTRICTED_KEYS)
 *   E. lastActivity / _lastModified / _modifiedBy pass-through
 */

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn((id) => ({ id: id || 'auto_id' }))
  })),
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

jest.mock('../shared/auth', () => ({
  checkUserPermissions: jest.fn().mockResolvedValue({
    uid: 'user1',
    email: 'user@test',
    username: 'user',
    role: 'employee'
  })
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));

jest.mock('../timesheet/helpers', () => ({
  createTimeEvent: jest.fn().mockResolvedValue(undefined),
  checkIdempotency: jest.fn().mockResolvedValue(null),
  registerIdempotency: jest.fn().mockResolvedValue(undefined),
  createReservation: jest.fn().mockResolvedValue('reservation1'),
  commitReservation: jest.fn().mockResolvedValue(undefined),
  rollbackReservation: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../timesheet/internal-case', () => ({
  getOrCreateInternalCase: jest.fn().mockResolvedValue({
    clientId: 'internal_office',
    id: 'internal_case_1',
    clientName: 'פנימי'
  })
}));

const { createTimesheetEntry_v2 } = require('../timesheet/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeHoursService(id, { totalHours = 10, hoursUsed = 0 } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    packages: [
      {
        id: `${id}_pkg_1`,
        type: 'initial',
        hours: totalHours,
        hoursUsed,
        hoursRemaining: totalHours - hoursUsed,
        status: 'active'
      }
    ],
    status: 'active'
  };
}

function makeClientDoc(services = [], version = 5) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      clientName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
      _version: version
    })
  };
}

function makeTaskDoc() {
  return {
    exists: true,
    data: () => ({
      title: 'משימה',
      actualMinutes: 0,
      actualHours: 0
    })
  };
}

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

function setupTxMocks(clientDoc, taskDoc = makeTaskDoc()) {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)   // CF Phase 1 reads client
    .mockResolvedValueOnce(taskDoc)     // CF Phase 1 reads task
    .mockResolvedValueOnce(clientDoc);  // helper reads client (cached)
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// A. Helper integration — with deduction
// ═══════════════════════════════════════════════════════════════

describe('A. Helper integration (with deduction)', () => {
  test('hours service: helper payload includes services + _version + canonical aggregates', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('svc1', { totalHours: 10 })], 5));

    const result = await createTimesheetEntry_v2(
      {
        clientId: 'c1',
        date: '2026-05-18',
        minutes: 60,
        action: 'work',
        taskId: 'task1',
        serviceId: 'svc1'
      },
      makeCtx()
    );

    expect(result.success).toBe(true);
    expect(result.version).toBe(6);  // 5 + 1

    const clientUpdates = mockTransaction.update.mock.calls.filter(
      ([, payload]) => payload && Array.isArray(payload.services)
    );
    expect(clientUpdates).toHaveLength(1);
    const [, payload] = clientUpdates[0];

    // services + _version + audit fields
    expect(payload.services).toBeDefined();
    expect(payload._version).toBe(6);
    expect(payload._modifiedBy).toBe('user');
    expect(payload._lastModified).toBe('SERVER_TIMESTAMP');
    expect(payload.lastActivity).toBe('SERVER_TIMESTAMP');

    // Canonical aggregates from helper
    expect(payload.hoursUsed).toBe(1);
    expect(payload.hoursRemaining).toBe(9);
    expect(payload.isBlocked).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Helper integration — no deduction
// ═══════════════════════════════════════════════════════════════

describe('B. Helper integration (no deduction)', () => {
  test('legal_procedure non-matching stage → no deduction → helper called with metadata only', async () => {
    // Set up legal_procedure service that won't deduct (stage not found)
    const legalService = {
      id: 'legal1',
      type: ST.LEGAL_PROCEDURE,
      name: 'הליך',
      pricingType: 'hourly',
      stages: [],  // empty stages → no stage match → no deduction
      currentStage: 'stage_nonexistent',
      status: 'active'
    };
    setupTxMocks(makeClientDoc([legalService], 3));

    await createTimesheetEntry_v2(
      {
        clientId: 'c1',
        date: '2026-05-18',
        minutes: 30,
        action: 'work',
        taskId: 'task1',
        serviceId: 'legal1'
      },
      makeCtx()
    );

    const clientUpdates = mockTransaction.update.mock.calls.filter(
      ([, payload]) => payload && payload._version !== undefined
    );
    expect(clientUpdates.length).toBeGreaterThan(0);
    const [, payload] = clientUpdates[0];

    // Helper writes current services unchanged (no deduction) — services
    // come from currentData via helper's merge step. The legal_procedure
    // service is still in payload but unchanged.
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].id).toBe('legal1');
    // Version + metadata still written
    expect(payload._version).toBe(4);
    expect(payload._modifiedBy).toBe('user');
    expect(payload.lastActivity).toBe('SERVER_TIMESTAMP');
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Internal-case bypass
// ═══════════════════════════════════════════════════════════════

describe('C. Internal-case path bypasses helper', () => {
  test('isInternal: true → helper NOT called on internal_office client', async () => {
    mockTransaction.get.mockReset();
    // Only task get (no client read for internal)
    mockTransaction.get.mockResolvedValueOnce(makeTaskDoc());

    await createTimesheetEntry_v2(
      {
        isInternal: true,
        date: '2026-05-18',
        minutes: 15,
        action: 'internal work',
        taskId: 'task_internal'
      },
      makeCtx()
    );

    // No transaction.update call on a clientRef (no helper invocation)
    const clientUpdates = mockTransaction.update.mock.calls.filter(
      ([, payload]) => payload && (payload._version !== undefined || Array.isArray(payload.services))
    );
    expect(clientUpdates).toHaveLength(0);

    // Timesheet entry still created
    expect(mockTransaction.set).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. _version pass-through
// ═══════════════════════════════════════════════════════════════

describe('D. _version pass-through (NOT in RESTRICTED_KEYS)', () => {
  test('expectedVersion mismatch → aborted (validation runs before helper)', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('svc1')], 5));

    await expect(
      createTimesheetEntry_v2(
        {
          clientId: 'c1',
          date: '2026-05-18',
          minutes: 60,
          action: 'work',
          taskId: 'task1',
          serviceId: 'svc1',
          expectedVersion: 99   // wrong
        },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'aborted' });

    // Helper NOT called
    const clientUpdates = mockTransaction.update.mock.calls.filter(
      ([, payload]) => payload && payload._version !== undefined
    );
    expect(clientUpdates).toHaveLength(0);
  });

  test('expectedVersion match → helper writes nextVersion', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('svc1')], 7));

    await createTimesheetEntry_v2(
      {
        clientId: 'c1',
        date: '2026-05-18',
        minutes: 60,
        action: 'work',
        taskId: 'task1',
        serviceId: 'svc1',
        expectedVersion: 7
      },
      makeCtx()
    );

    const clientUpdates = mockTransaction.update.mock.calls.filter(
      ([, payload]) => payload && Array.isArray(payload.services)
    );
    const [, payload] = clientUpdates[0];
    expect(payload._version).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. lastModifiedAt from helper auditMeta
// ═══════════════════════════════════════════════════════════════

describe('E. Helper writes lastModifiedAt + lastModifiedBy via auditMeta', () => {
  test('auditMeta lastModifiedBy + lastModifiedAt added by helper', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('svc1')], 5));

    await createTimesheetEntry_v2(
      {
        clientId: 'c1',
        date: '2026-05-18',
        minutes: 60,
        action: 'work',
        taskId: 'task1',
        serviceId: 'svc1'
      },
      makeCtx()
    );

    const clientUpdates = mockTransaction.update.mock.calls.filter(
      ([, payload]) => payload && Array.isArray(payload.services)
    );
    const [, payload] = clientUpdates[0];

    // Helper-added fields (from auditMeta)
    expect(payload.lastModifiedAt).toBe('SERVER_TIMESTAMP');
    expect(payload.lastModifiedBy).toBe('user');

    // CF-set fields (preserved through helper)
    expect(payload._modifiedBy).toBe('user');
    expect(payload._lastModified).toBe('SERVER_TIMESTAMP');
    expect(payload.lastActivity).toBe('SERVER_TIMESTAMP');
  });
});
