/**
 * Tests for deleteService CF after PR-B.3 migration to writeClientWithCanonicalAggregates.
 *
 * Coverage:
 *   A. Auth + validation (clientId / serviceId / confirmDelete)
 *   B. Lookup failures (client / service not found)
 *   C. Referential integrity guard (timesheet_entries blocks delete)
 *   D. Canonical helper integration:
 *      - services array filtered (deleted service removed)
 *      - totalServices / activeServices passed through (not in RESTRICTED_KEYS)
 *      - I1 case: removing last billable service → fixed-only → isBlocked=false
 *   E. Audit log preserved
 *   F. Return value shape preserved
 */

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

// Mock collection().where().limit() chain for timesheet_entries query
const mockEntriesLimit = jest.fn(() => 'TIMESHEET_QUERY');
const mockEntriesWhere = jest.fn(() => ({ limit: mockEntriesLimit }));
const mockEntriesCollection = { where: mockEntriesWhere };

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'timesheet_entries') {
      return mockEntriesCollection;
    }
    return {
      doc: jest.fn((id) => ({ id: id || 'auto_id' }))
    };
  }),
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
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

const mockCheckUserPermissions = jest.fn();
jest.mock('../shared/auth', () => ({
  checkUserPermissions: mockCheckUserPermissions
}));

const mockLogAction = jest.fn();
jest.mock('../shared/audit', () => ({
  logAction: mockLogAction
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  isValidIsraeliPhone: jest.fn(() => true),
  isValidEmail: jest.fn(() => true)
}));

const { deleteService } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeHoursService(id, { totalHours = 10, hoursUsed = 3, status = 'active' } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    status
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

function makeClientDoc(services = [], overrides = {}) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
      ...overrides
    })
  };
}

const VALID_USER = {
  uid: 'user1',
  email: 'test@test',
  username: 'testuser',
  role: 'manager'
};

function makeCtx(uid = 'user1') {
  return { auth: { uid, token: { email: 'test@test' } } };
}

// Helper: setup transaction.get to return:
//   1st call (clientRef)        → client doc
//   2nd call (timesheet query)  → entries snapshot (empty by default)
//   3rd call (helper internal)  → client doc again (helper re-reads inside transaction)
function setupTransactionMocks(clientDoc, entriesEmpty = true) {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)
    .mockResolvedValueOnce({ empty: entriesEmpty, docs: [] })
    .mockResolvedValueOnce(clientDoc);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue(VALID_USER);
});

// ═══════════════════════════════════════════════════════════════
// A. Auth + validation
// ═══════════════════════════════════════════════════════════════

describe('A. Auth + validation', () => {
  test('propagates auth errors', async () => {
    const functions = require('firebase-functions');
    mockCheckUserPermissions.mockRejectedValue(
      new functions.https.HttpsError('unauthenticated', 'אין הרשאה')
    );
    await expect(
      deleteService({ clientId: 'c1', serviceId: 's1', confirmDelete: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('throws invalid-argument when clientId missing', async () => {
    await expect(
      deleteService({ serviceId: 's1', confirmDelete: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when serviceId missing', async () => {
    await expect(
      deleteService({ clientId: 'c1', confirmDelete: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when confirmDelete is missing', async () => {
    await expect(
      deleteService({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when confirmDelete is not exactly true', async () => {
    await expect(
      deleteService({ clientId: 'c1', serviceId: 's1', confirmDelete: 'yes' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Lookup failures
// ═══════════════════════════════════════════════════════════════

describe('B. Lookup failures', () => {
  test('client not found → not-found', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce({ exists: false });
    await expect(
      deleteService({ clientId: 'missing', serviceId: 's1', confirmDelete: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found → not-found', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc([makeHoursService('s_other')]));
    await expect(
      deleteService({ clientId: 'c1', serviceId: 'missing-svc', confirmDelete: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Referential integrity — timesheet_entries guard
// ═══════════════════════════════════════════════════════════════

describe('C. Referential integrity', () => {
  test('throws failed-precondition when timesheet_entries reference the service', async () => {
    const clientDoc = makeClientDoc([makeHoursService('s1')]);
    // Setup: client doc, then NON-empty entries snapshot
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce({ empty: false, docs: [{ id: 'entry1' }] });
    await expect(
      deleteService({ clientId: 'c1', serviceId: 's1', confirmDelete: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    // Update should NOT have been called
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Canonical helper integration (PR-B.3)
// ═══════════════════════════════════════════════════════════════

describe('D. Canonical helper integration', () => {
  test('happy path: service removed, helper called, aggregates derived', async () => {
    const services = [
      makeHoursService('s1', { totalHours: 10, hoursUsed: 3 }),
      makeHoursService('s2', { totalHours: 20, hoursUsed: 5 })
    ];
    const clientDoc = makeClientDoc(services);
    setupTransactionMocks(clientDoc);

    const result = await deleteService(
      { clientId: 'c1', serviceId: 's1', confirmDelete: true },
      makeCtx()
    );

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];

    // s1 removed
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].id).toBe('s2');

    // totalServices / activeServices passed through (NOT in RESTRICTED_KEYS)
    expect(payload.totalServices).toBe(1);
    expect(payload.activeServices).toBe(1);

    // Helper derived correct aggregates from remaining service (s2: 20/5)
    expect(payload.totalHours).toBe(20);
    expect(payload.hoursUsed).toBe(5);
    expect(payload.hoursRemaining).toBe(15);
    expect(payload.isBlocked).toBe(false);

    // Return value
    expect(result).toMatchObject({
      success: true,
      serviceId: 's1',
      serviceName: 'שירות s1',
      clientAggregates: {
        totalHours: 20,
        hoursUsed: 5,
        hoursRemaining: 15,
        isBlocked: false,
        totalServices: 1,
        activeServices: 1
      }
    });
  });

  test('I1 case: removing last billable service leaves fixed-only → isBlocked=false', async () => {
    const services = [
      makeHoursService('s_hours', { totalHours: 10, hoursUsed: 10 }), // depleted
      makeFixedService('s_fixed')
    ];
    const clientDoc = makeClientDoc(services);
    setupTransactionMocks(clientDoc);

    await deleteService(
      { clientId: 'c1', serviceId: 's_hours', confirmDelete: true },
      makeCtx()
    );

    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].id).toBe('s_fixed');
    // I1: no billable → isBlocked must be false
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(false);
  });

  test('deletedServiceSnapshot captured before filter', async () => {
    const targetService = makeHoursService('s1', { totalHours: 10, hoursUsed: 3 });
    const clientDoc = makeClientDoc([targetService, makeHoursService('s2')]);
    setupTransactionMocks(clientDoc);

    const result = await deleteService(
      { clientId: 'c1', serviceId: 's1', confirmDelete: true },
      makeCtx()
    );

    // Snapshot has the FULL pre-delete service
    expect(result.deletedService).toMatchObject({
      id: 's1',
      type: 'hours',
      totalHours: 10,
      hoursUsed: 3
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Audit log
// ═══════════════════════════════════════════════════════════════

describe('E. Audit log', () => {
  test('DELETE_SERVICE emitted with full snapshot for recovery', async () => {
    const target = makeHoursService('s1', { totalHours: 10, hoursUsed: 3 });
    setupTransactionMocks(makeClientDoc([target, makeHoursService('s2')]));

    await deleteService(
      { clientId: 'c1', serviceId: 's1', confirmDelete: true },
      makeCtx()
    );

    expect(mockLogAction).toHaveBeenCalledWith(
      'DELETE_SERVICE',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        serviceId: 's1',
        serviceName: 'שירות s1',
        serviceType: 'hours',
        deletedServiceSnapshot: expect.objectContaining({ id: 's1' })
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Return value
// ═══════════════════════════════════════════════════════════════

describe('F. Return value', () => {
  test('full shape preserved (success + serviceId + clientAggregates + message)', async () => {
    setupTransactionMocks(makeClientDoc([
      makeHoursService('s1'),
      makeHoursService('s2')
    ]));
    const result = await deleteService(
      { clientId: 'c1', serviceId: 's1', confirmDelete: true },
      makeCtx()
    );
    expect(result).toMatchObject({
      success: true,
      serviceId: 's1',
      serviceName: expect.any(String),
      deletedService: expect.any(Object),
      clientAggregates: expect.objectContaining({
        totalHours: expect.any(Number),
        hoursUsed: expect.any(Number),
        hoursRemaining: expect.any(Number),
        isBlocked: expect.any(Boolean),
        isCritical: expect.any(Boolean),
        totalServices: expect.any(Number),
        activeServices: expect.any(Number)
      }),
      message: expect.stringContaining('נמחק')
    });
  });
});
