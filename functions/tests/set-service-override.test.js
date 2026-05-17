/**
 * Tests for setServiceOverride CF after PR-B.1 migration to
 * writeClientWithCanonicalAggregates.
 *
 * Coverage:
 *   - Auth: non-admin → permission-denied
 *   - Validation: missing args → invalid-argument
 *   - Service not found → not-found
 *   - Service type != HOURS → invalid-argument
 *   - Happy path active=true: override flag set + helper called +
 *     aggregates recomputed + write payload includes services
 *   - Happy path active=false: override cleared + same flow
 *   - Audit log emitted with correct action + payload
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

// ═══════════════════════════════════════════════════════════════
// Requires — after mocks
// ═══════════════════════════════════════════════════════════════

const { setServiceOverride } = require('../clients/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ═══════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════

function makeHoursService(id, { totalHours = 10, hoursUsed = 8, overrideActive = false } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: 'שירות שעתי',
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    overrideActive,
    status: 'active'
  };
}

function makeFixedService(id) {
  return {
    id,
    type: ST.FIXED,
    name: 'שירות קבוע',
    fixedPrice: 5000,
    status: 'active'
  };
}

function makeClientDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      isOnHold: false,
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
  username: 'admin',
  role: 'admin'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue(ADMIN_USER);
});

// ═══════════════════════════════════════════════════════════════
// A. Authorization
// ═══════════════════════════════════════════════════════════════

describe('A. Authorization', () => {
  test('non-admin user → permission-denied', async () => {
    mockCheckUserPermissions.mockResolvedValue({
      ...ADMIN_USER,
      role: 'employee'
    });
    await expect(
      setServiceOverride(
        { clientId: 'c1', serviceId: 's1', active: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Argument validation
// ═══════════════════════════════════════════════════════════════

describe('B. Argument validation', () => {
  test('missing clientId → invalid-argument', async () => {
    await expect(
      setServiceOverride({ serviceId: 's1', active: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('missing serviceId → invalid-argument', async () => {
    await expect(
      setServiceOverride({ clientId: 'c1', active: true }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('non-boolean active → invalid-argument', async () => {
    await expect(
      setServiceOverride(
        { clientId: 'c1', serviceId: 's1', active: 'true' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Lookup failures
// ═══════════════════════════════════════════════════════════════

describe('C. Lookup failures', () => {
  test('client not found → not-found', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false });
    await expect(
      setServiceOverride(
        { clientId: 'missing', serviceId: 's1', active: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found in client → not-found', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('other-id')] })
    );
    await expect(
      setServiceOverride(
        { clientId: 'c1', serviceId: 'missing-svc', active: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service type != HOURS → invalid-argument', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeFixedService('s1')] })
    );
    await expect(
      setServiceOverride(
        { clientId: 'c1', serviceId: 's1', active: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Migration verified — write through helper
// ═══════════════════════════════════════════════════════════════

describe('D. Canonical helper integration (PR-B.1)', () => {
  test('active=true: helper invoked, services array carries override flag, aggregates derived', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10, overrideActive: false })],
        totalHours: 10
      })
    );

    const result = await setServiceOverride(
      { clientId: 'c1', serviceId: 's1', active: true, note: 'admin approved' },
      makeCtx()
    );

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];

    // services[0] now carries the override flag
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].overrideActive).toBe(true);
    expect(payload.services[0].overrideApprovedBy).toBe('admin');
    expect(payload.services[0].overrideNote).toBe('admin approved');

    // Aggregates derived by the helper (I2: depleted but override active → not blocked)
    expect(payload.isBlocked).toBe(false);
    expect(payload.hoursUsed).toBe(10);
    expect(payload.hoursRemaining).toBe(0);

    // Audit metadata from auditMeta
    expect(payload.lastModifiedBy).toBe('admin');

    // Return value preserved
    expect(result).toEqual({
      success: true,
      serviceId: 's1',
      overrideActive: true
    });
  });

  test('active=false: override cleared, aggregates derived (no override → block at depletion)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10, overrideActive: true })],
        totalHours: 10
      })
    );

    await setServiceOverride(
      { clientId: 'c1', serviceId: 's1', active: false },
      makeCtx()
    );

    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.services[0].overrideActive).toBe(false);

    // No override + depleted → blocked
    expect(payload.isBlocked).toBe(true);
  });

  test('healthy client (not depleted) toggle: aggregates remain false', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 3 })],
        totalHours: 10
      })
    );

    await setServiceOverride(
      { clientId: 'c1', serviceId: 's1', active: true },
      makeCtx()
    );

    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(false);
    expect(payload.hoursRemaining).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Audit log
// ═══════════════════════════════════════════════════════════════

describe('E. Audit log', () => {
  test('active=true → action SET_SERVICE_OVERRIDE', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    await setServiceOverride(
      { clientId: 'c1', serviceId: 's1', active: true, note: 'reason' },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      'SET_SERVICE_OVERRIDE',
      'admin1',
      'admin',
      expect.objectContaining({
        clientId: 'c1',
        serviceId: 's1',
        overrideActive: true,
        note: 'reason'
      })
    );
  });

  test('active=false → action REMOVE_SERVICE_OVERRIDE', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1', { overrideActive: true })] })
    );
    await setServiceOverride(
      { clientId: 'c1', serviceId: 's1', active: false },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      'REMOVE_SERVICE_OVERRIDE',
      'admin1',
      'admin',
      expect.objectContaining({ overrideActive: false })
    );
  });
});
