/**
 * Tests for changeServiceStatus CF after PR-B.5 migration.
 *
 * Coverage:
 *   A. Auth + validation (auth-error, missing args, invalid newStatus)
 *   B. Lookup failures
 *   C. Same-status guard
 *   D. Canonical helper integration:
 *      - active → completed (sets completedAt, helper called)
 *      - completed → active (does NOT erase completedAt)
 *      - active → on_hold (activeServices decrements)
 *      - statusChangeHistory append preserves prior entries
 *   E. Audit log
 *   F. Return value shape
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

const { changeServiceStatus } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeHoursService(id, opts = {}) {
  const {
    totalHours = 10,
    hoursUsed = 3,
    status = 'active',
    completedAt = null,
    statusChangeHistory = []
  } = opts;
  const svc = {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    status
  };
  if (completedAt) svc.completedAt = completedAt;
  if (statusChangeHistory.length) svc.statusChangeHistory = statusChangeHistory;
  return svc;
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

function setupTxMocks(clientDoc) {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)  // CF body
    .mockResolvedValueOnce(clientDoc); // helper internal
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
      changeServiceStatus(
        { clientId: 'c1', serviceId: 's1', newStatus: 'completed' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('missing clientId → invalid-argument', async () => {
    await expect(
      changeServiceStatus({ serviceId: 's1', newStatus: 'completed' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('missing serviceId → invalid-argument', async () => {
    await expect(
      changeServiceStatus({ clientId: 'c1', newStatus: 'completed' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('invalid newStatus → invalid-argument', async () => {
    await expect(
      changeServiceStatus(
        { clientId: 'c1', serviceId: 's1', newStatus: 'bogus' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('accepts all 4 valid statuses', async () => {
    const statuses = ['active', 'completed', 'on_hold', 'archived'];
    for (const newStatus of statuses) {
      setupTxMocks(makeClientDoc([
        // service is in a DIFFERENT status so same-status guard passes
        makeHoursService('s1', { status: newStatus === 'active' ? 'on_hold' : 'active' })
      ]));
      await expect(
        changeServiceStatus(
          { clientId: 'c1', serviceId: 's1', newStatus },
          makeCtx()
        )
      ).resolves.toMatchObject({ success: true, newStatus });
    }
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
      changeServiceStatus(
        { clientId: 'missing', serviceId: 's1', newStatus: 'completed' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found → not-found', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeHoursService('s_other')])
    );
    await expect(
      changeServiceStatus(
        { clientId: 'c1', serviceId: 'missing', newStatus: 'completed' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Same-status guard
// ═══════════════════════════════════════════════════════════════

describe('C. Same-status guard', () => {
  test('throws failed-precondition; transaction.update NOT called', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeHoursService('s1', { status: 'active' })])
    );
    await expect(
      changeServiceStatus(
        { clientId: 'c1', serviceId: 's1', newStatus: 'active' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Canonical helper integration (PR-B.5)
// ═══════════════════════════════════════════════════════════════

describe('D. Canonical helper integration', () => {
  test('active → completed: sets completedAt, helper called', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('s1', { status: 'active' })]));
    await changeServiceStatus(
      { clientId: 'c1', serviceId: 's1', newStatus: 'completed' },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services.find(s => s.id === 's1');
    expect(svc.status).toBe('completed');
    expect(svc.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(svc.statusChangedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(svc.previousStatus).toBe('active');
  });

  test('completed → active: does NOT erase completedAt', async () => {
    const priorCompletedAt = '2026-04-01T10:00:00.000Z';
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { status: 'completed', completedAt: priorCompletedAt })
    ]));
    await changeServiceStatus(
      { clientId: 'c1', serviceId: 's1', newStatus: 'active' },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services.find(s => s.id === 's1');
    expect(svc.status).toBe('active');
    // Critical: prior completedAt preserved (NOT overwritten)
    expect(svc.completedAt).toBe(priorCompletedAt);
  });

  test('active → on_hold: activeServices count decrements', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { status: 'active' }),
      makeHoursService('s2', { status: 'active' }),
      makeHoursService('s3', { status: 'active' })
    ]));
    await changeServiceStatus(
      { clientId: 'c1', serviceId: 's2', newStatus: 'on_hold' },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.totalServices).toBe(3);
    expect(payload.activeServices).toBe(2); // was 3, one → on_hold
  });

  test('statusChangeHistory APPENDS — preserves prior entries', async () => {
    const priorHistory = [
      { from: 'active', to: 'on_hold', changedAt: '2026-04-01T00:00:00.000Z', changedBy: 'admin', note: 'first' }
    ];
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { status: 'on_hold', statusChangeHistory: priorHistory })
    ]));
    await changeServiceStatus(
      { clientId: 'c1', serviceId: 's1', newStatus: 'active', note: 'second' },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services.find(s => s.id === 's1');
    expect(svc.statusChangeHistory).toHaveLength(2);
    expect(svc.statusChangeHistory[0]).toEqual(priorHistory[0]);
    expect(svc.statusChangeHistory[1]).toMatchObject({
      from: 'on_hold',
      to: 'active',
      note: 'second'
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Audit log
// ═══════════════════════════════════════════════════════════════

describe('E. Audit log', () => {
  test('CHANGE_SERVICE_STATUS emitted with full payload', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('s1', { status: 'active' })]));
    await changeServiceStatus(
      { clientId: 'c1', serviceId: 's1', newStatus: 'on_hold', note: 'reason' },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      'CHANGE_SERVICE_STATUS',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        serviceId: 's1',
        serviceName: 'שירות s1',
        serviceType: 'hours',
        previousStatus: 'active',
        newStatus: 'on_hold',
        note: 'reason'
      })
    );
  });

  test('note trimmed to 500 chars', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('s1', { status: 'active' })]));
    const longNote = 'x'.repeat(600);
    await changeServiceStatus(
      { clientId: 'c1', serviceId: 's1', newStatus: 'completed', note: longNote },
      makeCtx()
    );
    const noteArg = mockLogAction.mock.calls[0][3].note;
    expect(noteArg.length).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Return value
// ═══════════════════════════════════════════════════════════════

describe('F. Return value', () => {
  test('full shape preserved', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { status: 'active' }),
      makeHoursService('s2', { status: 'active' })
    ]));
    const result = await changeServiceStatus(
      { clientId: 'c1', serviceId: 's1', newStatus: 'completed' },
      makeCtx()
    );
    expect(result).toMatchObject({
      success: true,
      serviceId: 's1',
      serviceName: expect.any(String),
      previousStatus: 'active',
      newStatus: 'completed',
      statusChangedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      clientAggregates: expect.objectContaining({
        totalHours: expect.any(Number),
        hoursUsed: expect.any(Number),
        hoursRemaining: expect.any(Number),
        minutesRemaining: expect.any(Number),
        isBlocked: expect.any(Boolean),
        isCritical: expect.any(Boolean),
        totalServices: expect.any(Number),
        activeServices: expect.any(Number)
      })
    });
  });
});
