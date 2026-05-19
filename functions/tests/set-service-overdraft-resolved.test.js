/**
 * Tests for setServiceOverdraftResolved CF after PR-B.2 migration.
 * Twin of set-service-override.test.js (PR-B.1 pattern).
 *
 * Coverage:
 *   - Auth: non-admin → permission-denied
 *   - Validation: missing args
 *   - Lookup: client / service not found
 *   - Happy path resolved=true: helper called, services[i].overdraftResolved
 *     object set, aggregates derived (I2: depleted+resolved → not blocked)
 *   - Happy path resolved=false: services[i] NO LONGER has overdraftResolved
 *     key (destructured out), aggregates derived (depleted+no-resolution →
 *     blocked again)
 *   - Audit log: both action names with correct payload
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

jest.mock('../case-number-transaction', () => ({
  generateCaseNumberWithTransaction: jest.fn(() => 'AUTO-2026000')
}));

const { setServiceOverdraftResolved } = require('../clients/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

function makeHoursService(id, opts = {}) {
  const { totalHours = 10, hoursUsed = 10, overdraftResolved = null } = opts;
  const svc = {
    id,
    type: ST.HOURS,
    name: 'שירות שעתי',
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    status: 'active'
  };
  if (overdraftResolved !== null) {
    svc.overdraftResolved = overdraftResolved;
  }
  return svc;
}

function makeClientDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      services: [],
      totalHours: 10,
      ...overrides
    })
  };
}

function makeCtx(uid = 'admin1') {
  return { auth: { uid, token: { email: 'admin@test', role: 'admin' } } };
}

const ADMIN_USER = {
  uid: 'admin1',
  email: 'admin@test',
  displayName: 'Admin User',
  username: 'admin',
  role: 'admin'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue(ADMIN_USER);
});

// ═══════════════════════════════════════════════════════════════

describe('A. Authorization', () => {
  test('non-admin → permission-denied', async () => {
    mockCheckUserPermissions.mockResolvedValue({ ...ADMIN_USER, role: 'employee' });
    await expect(
      setServiceOverdraftResolved(
        { clientId: 'c1', serviceId: 's1', resolved: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('B. Argument validation', () => {
  test('missing clientId → invalid-argument', async () => {
    await expect(
      setServiceOverdraftResolved({ serviceId: 's1', resolved: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('missing serviceId → invalid-argument', async () => {
    await expect(
      setServiceOverdraftResolved({ clientId: 'c1', resolved: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('non-boolean resolved → invalid-argument', async () => {
    await expect(
      setServiceOverdraftResolved(
        { clientId: 'c1', serviceId: 's1', resolved: 'yes' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('C. Lookup failures', () => {
  test('client not found → not-found', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false });
    await expect(
      setServiceOverdraftResolved(
        { clientId: 'missing', serviceId: 's1', resolved: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found → not-found', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('other')] })
    );
    await expect(
      setServiceOverdraftResolved(
        { clientId: 'c1', serviceId: 'wrong', resolved: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('D. Canonical helper integration (PR-B.2)', () => {
  test('resolved=true → overdraftResolved object set, helper unblocks (I2)', async () => {
    // Depleted service (10/10) without resolution would be blocked.
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10 })],
        totalHours: 10
      })
    );

    await setServiceOverdraftResolved(
      { clientId: 'c1', serviceId: 's1', resolved: true, note: 'admin OK' },
      makeCtx()
    );

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];

    // Service carries the resolution object
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].overdraftResolved).toMatchObject({
      isResolved: true,
      resolvedBy: 'admin@test',
      resolvedByName: 'Admin User',
      note: 'admin OK'
    });

    // Helper derived isBlocked=false thanks to I2 (resolution active)
    expect(payload.isBlocked).toBe(false);
    expect(payload.lastModifiedBy).toBe('admin');
  });

  test('resolved=false → overdraftResolved field REMOVED (destructured out), helper re-blocks', async () => {
    // Service was resolved (currently unblocked); unresolving must re-block.
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [
          makeHoursService('s1', {
            totalHours: 10,
            hoursUsed: 10,
            overdraftResolved: { isResolved: true, resolvedBy: 'old', note: '' }
          })
        ],
        totalHours: 10
      })
    );

    await setServiceOverdraftResolved(
      { clientId: 'c1', serviceId: 's1', resolved: false },
      makeCtx()
    );

    const [, payload] = mockTransaction.update.mock.calls[0];

    // The field is GONE from services[0] (destructured out)
    expect(payload.services[0]).not.toHaveProperty('overdraftResolved');

    // Helper derived isBlocked=true (depleted, no resolution)
    expect(payload.isBlocked).toBe(true);
    expect(payload.hoursRemaining).toBe(0);
  });

  test('healthy client toggle: aggregates remain false either way', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 3 })],
        totalHours: 10
      })
    );

    await setServiceOverdraftResolved(
      { clientId: 'c1', serviceId: 's1', resolved: true },
      makeCtx()
    );

    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
    expect(payload.hoursRemaining).toBe(7);
  });
});

describe('E. Audit log', () => {
  test('resolved=true → RESOLVE_SERVICE_OVERDRAFT', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    await setServiceOverdraftResolved(
      { clientId: 'c1', serviceId: 's1', resolved: true, note: 'reason' },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      'RESOLVE_SERVICE_OVERDRAFT',
      'admin1',
      'admin',
      expect.objectContaining({
        clientId: 'c1',
        serviceId: 's1',
        resolved: true,
        note: 'reason'
      })
    );
  });

  test('resolved=false → UNRESOLVE_SERVICE_OVERDRAFT', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [
          makeHoursService('s1', {
            overdraftResolved: { isResolved: true, resolvedBy: 'old' }
          })
        ]
      })
    );
    await setServiceOverdraftResolved(
      { clientId: 'c1', serviceId: 's1', resolved: false },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      'UNRESOLVE_SERVICE_OVERDRAFT',
      'admin1',
      'admin',
      expect.objectContaining({ resolved: false })
    );
  });
});

describe('F. Return value', () => {
  test('returns { success, serviceId, resolved }', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    const result = await setServiceOverdraftResolved(
      { clientId: 'c1', serviceId: 's1', resolved: true },
      makeCtx()
    );
    expect(result).toEqual({
      success: true,
      serviceId: 's1',
      resolved: true
    });
  });
});
