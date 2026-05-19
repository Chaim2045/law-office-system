/**
 * Tests for completeService CF after PR-B.4 migration to writeClientWithCanonicalAggregates.
 *
 * Coverage:
 *   A. Auth + validation (auth-error, missing clientId, missing serviceId)
 *   B. Lookup failures (client / service not found)
 *   C. Guard (already-completed → failed-precondition, no write)
 *   D. Canonical helper integration (happy path, activeServices count, I1)
 *   E. Audit log preserved
 *   F. Return value shape preserved
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

const { completeService } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

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

function makeFixedService(id, { status = 'active' } = {}) {
  return {
    id,
    type: ST.FIXED,
    name: `פיקס ${id}`,
    fixedPrice: 5000,
    status,
    work: { totalMinutesWorked: 0, entriesCount: 0 }
  };
}

function makeClientDoc(services = []) {
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
      activeServices: services.filter(s => s.status === 'active').length
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

// completeService calls transaction.get ONCE for client; helper calls it AGAIN
// internally (Firestore caches within transaction). Wire both calls to same doc.
function setupTxMocks(clientDoc) {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)  // 1st: completeService body
    .mockResolvedValueOnce(clientDoc); // 2nd: helper internal
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
      completeService({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('throws invalid-argument when clientId missing', async () => {
    await expect(
      completeService({ serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when serviceId missing', async () => {
    await expect(
      completeService({ clientId: 'c1' }, makeCtx())
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
      completeService({ clientId: 'missing', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found → not-found', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeHoursService('s_other')])
    );
    await expect(
      completeService({ clientId: 'c1', serviceId: 'missing-svc' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Already-completed guard
// ═══════════════════════════════════════════════════════════════

describe('C. Already-completed guard', () => {
  test('throws failed-precondition; transaction.update NOT called', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeHoursService('s1', { status: 'completed' })])
    );
    await expect(
      completeService({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Canonical helper integration (PR-B.4)
// ═══════════════════════════════════════════════════════════════

describe('D. Canonical helper integration', () => {
  test('happy path: service marked completed, completedAt set, helper called', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { totalHours: 10, hoursUsed: 3 }),
      makeHoursService('s2', { totalHours: 20, hoursUsed: 5 })
    ]));

    const result = await completeService(
      { clientId: 'c1', serviceId: 's1' },
      makeCtx()
    );

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];

    // services array carries the mutated service
    const completedSvc = payload.services.find(s => s.id === 's1');
    expect(completedSvc.status).toBe('completed');
    expect(completedSvc.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // counts updated: totalServices unchanged (2), activeServices -1 (was 2 → 1)
    expect(payload.totalServices).toBe(2);
    expect(payload.activeServices).toBe(1);

    // helper derived aggregates from remaining active (s2: 20/5)
    expect(payload.hoursUsed).toBe(8); // both still in totalHours sum (s1.hoursUsed=3 + s2.hoursUsed=5)
    expect(payload.isBlocked).toBe(false);

    // Return value
    expect(result).toMatchObject({
      success: true,
      serviceId: 's1',
      serviceName: 'שירות s1',
      serviceType: 'hours',
      completedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    });
  });

  test('activeServices count drops by exactly 1 when one of N completes', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { status: 'active' }),
      makeHoursService('s2', { status: 'active' }),
      makeHoursService('s3', { status: 'active' })
    ]));

    await completeService({ clientId: 'c1', serviceId: 's2' }, makeCtx());

    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.totalServices).toBe(3);
    expect(payload.activeServices).toBe(2); // was 3, completed 1
  });

  test('completing service does NOT remove it from billable accounting (status-agnostic)', async () => {
    // calcClientAggregates classifies billable by TYPE, not STATUS — a completed
    // hours service still counts in totalHours / hoursUsed. This documents the
    // canonical behavior: completing ≠ deleting from the books.
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { totalHours: 10, hoursUsed: 10 }) // depleted hours
    ]));

    await completeService({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    const [, payload] = mockTransaction.update.mock.calls[0];
    // Even after completion, the hours service is in billable → I3 fires → isBlocked=true.
    expect(payload.isBlocked).toBe(true);
    expect(payload.hoursRemaining).toBe(0);
    // But status correctly flipped to 'completed' in services array.
    expect(payload.services[0].status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Audit log
// ═══════════════════════════════════════════════════════════════

describe('E. Audit log', () => {
  test('COMPLETE_SERVICE emitted with clientId/caseNumber/serviceId/serviceName/serviceType', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1'),
      makeHoursService('s2')
    ]));

    await completeService({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    // Audit payload omits completedAt (separately surfaced in return value).
    expect(mockLogAction).toHaveBeenCalledWith(
      'COMPLETE_SERVICE',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        caseNumber: 'c1',
        serviceId: 's1',
        serviceName: 'שירות s1',
        serviceType: 'hours'
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Return value
// ═══════════════════════════════════════════════════════════════

describe('F. Return value', () => {
  test('full shape preserved', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1'),
      makeHoursService('s2')
    ]));

    const result = await completeService(
      { clientId: 'c1', serviceId: 's1' },
      makeCtx()
    );

    expect(result).toMatchObject({
      success: true,
      serviceId: 's1',
      serviceName: expect.any(String),
      serviceType: expect.any(String),
      completedAt: expect.any(String),
      clientAggregates: expect.objectContaining({
        totalHours: expect.any(Number),
        hoursRemaining: expect.any(Number),
        minutesRemaining: expect.any(Number),
        isBlocked: expect.any(Boolean),
        isCritical: expect.any(Boolean),
        totalServices: expect.any(Number),
        activeServices: expect.any(Number)
      }),
      message: expect.stringContaining('הושלם')
    });
  });
});
