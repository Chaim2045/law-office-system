/**
 * Tests for addServiceToClient CF after PR-B.6 migration.
 *
 * Coverage:
 *   A. Auth + validation (auth-error, missing args, invalid serviceType,
 *      short serviceName, per-type validation)
 *   B. Lookup failures
 *   C. Service construction by type (hours, legal_procedure hourly/fixed, fixed)
 *   D. Append behavior (preserves prior services)
 *   E. Canonical helper integration:
 *      - hours added to empty client → helper derives correct aggregates
 *      - fixed added to empty client → I1 → isBlocked=false
 *   F. Audit log
 *   G. Return shape
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

const { addServiceToClient } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// ─── helpers ────────────────────────────────────────────────────

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
      addServiceToClient(
        { clientId: 'c1', serviceType: 'hours', serviceName: 'X', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('missing clientId → invalid-argument', async () => {
    await expect(
      addServiceToClient(
        { serviceType: 'hours', serviceName: 'X', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('invalid serviceType → invalid-argument', async () => {
    await expect(
      addServiceToClient(
        { clientId: 'c1', serviceType: 'bogus', serviceName: 'X' },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('serviceName too short → invalid-argument', async () => {
    await expect(
      addServiceToClient(
        { clientId: 'c1', serviceType: 'hours', serviceName: 'X', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('hours: missing/zero hours → invalid-argument', async () => {
    await expect(
      addServiceToClient(
        { clientId: 'c1', serviceType: 'hours', serviceName: 'שירות שעות', hours: 0 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('legal_procedure: stages must be array of length 3', async () => {
    await expect(
      addServiceToClient(
        {
          clientId: 'c1',
          serviceType: 'legal_procedure',
          serviceName: 'הליך משפטי',
          pricingType: 'hourly',
          stages: [{ hours: 10 }, { hours: 5 }] // only 2 — invalid
        },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('legal_procedure: invalid pricingType → invalid-argument', async () => {
    await expect(
      addServiceToClient(
        {
          clientId: 'c1',
          serviceType: 'legal_procedure',
          serviceName: 'הליך משפטי',
          pricingType: 'monthly', // invalid
          stages: [{ hours: 5 }, { hours: 5 }, { hours: 5 }]
        },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('fixed: negative fixedPrice → invalid-argument', async () => {
    await expect(
      addServiceToClient(
        {
          clientId: 'c1',
          serviceType: 'fixed',
          serviceName: 'פיקס',
          fixedPrice: -100
        },
        makeCtx()
      )
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
      addServiceToClient(
        { clientId: 'missing', serviceType: 'hours', serviceName: 'שירות', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Service construction by type
// ═══════════════════════════════════════════════════════════════

describe('C. Service construction', () => {
  test('hours: builds with initial package, totalHours/hoursUsed/hoursRemaining', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      { clientId: 'c1', serviceType: 'hours', serviceName: 'תוכנית שעות', hours: 20 },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services[payload.services.length - 1];
    expect(svc.type).toBe('hours');
    expect(svc.totalHours).toBe(20);
    expect(svc.hoursUsed).toBe(0);
    expect(svc.hoursRemaining).toBe(20);
    expect(svc.status).toBe('active');
    expect(svc.packages).toHaveLength(1);
    expect(svc.packages[0]).toMatchObject({
      type: 'initial',
      hours: 20,
      hoursUsed: 0,
      hoursRemaining: 20,
      status: 'active'
    });
  });

  test('legal_procedure hourly: 3 stages with packages, totalHours summed', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      {
        clientId: 'c1',
        serviceType: 'legal_procedure',
        serviceName: 'תביעה',
        pricingType: 'hourly',
        stages: [{ hours: 5 }, { hours: 10 }, { hours: 3 }]
      },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services[payload.services.length - 1];
    expect(svc.type).toBe('legal_procedure');
    expect(svc.pricingType).toBe('hourly');
    expect(svc.stages).toHaveLength(3);
    expect(svc.totalHours).toBe(18); // 5+10+3
    expect(svc.hoursRemaining).toBe(18);
    expect(svc.currentStage).toBe(SYSTEM_CONSTANTS.VALID_STAGE_IDS[0]);
    // First stage active, others pending
    expect(svc.stages[0].status).toBe('active');
    expect(svc.stages[1].status).toBe('pending');
    expect(svc.stages[2].status).toBe('pending');
  });

  test('legal_procedure fixed: 3 stages with fixedPrice + paid:false, totalPrice summed', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      {
        clientId: 'c1',
        serviceType: 'legal_procedure',
        serviceName: 'הליך פיקס',
        pricingType: 'fixed',
        stages: [{ fixedPrice: 1000 }, { fixedPrice: 2000 }, { fixedPrice: 500 }]
      },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services[payload.services.length - 1];
    expect(svc.pricingType).toBe('fixed');
    expect(svc.stages).toHaveLength(3);
    expect(svc.totalPrice).toBe(3500);
    expect(svc.totalPaid).toBe(0);
    svc.stages.forEach(stage => {
      expect(stage.paid).toBe(false);
      expect(stage.fixedPrice).toBeGreaterThan(0);
    });
  });

  test('fixed: builds with fixedPrice, work tracker, completedAt=null', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      {
        clientId: 'c1',
        serviceType: 'fixed',
        serviceName: 'שירות קבוע',
        fixedPrice: 5000
      },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services[payload.services.length - 1];
    expect(svc.type).toBe('fixed');
    expect(svc.fixedPrice).toBe(5000);
    expect(svc.work).toEqual({ totalMinutesWorked: 0, entriesCount: 0 });
    expect(svc.completedAt).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Append behavior
// ═══════════════════════════════════════════════════════════════

describe('D. Append behavior', () => {
  test('preserves prior services + appends new at end', async () => {
    const prior = [
      { id: 'old1', type: 'hours', name: 'ישן 1', status: 'active', totalHours: 10, hoursUsed: 0 },
      { id: 'old2', type: 'fixed', name: 'ישן 2', status: 'active', fixedPrice: 1000 }
    ];
    setupTxMocks(makeClientDoc(prior));
    await addServiceToClient(
      { clientId: 'c1', serviceType: 'fixed', serviceName: 'חדש', fixedPrice: 500 },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.services).toHaveLength(3);
    expect(payload.services[0].id).toBe('old1');
    expect(payload.services[1].id).toBe('old2');
    expect(payload.services[2].name).toBe('חדש');
    expect(payload.totalServices).toBe(3);
    expect(payload.activeServices).toBe(3); // all active
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Canonical helper integration (PR-B.6)
// ═══════════════════════════════════════════════════════════════

describe('E. Canonical helper integration', () => {
  test('hours added to empty client → aggregates derived', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      { clientId: 'c1', serviceType: 'hours', serviceName: 'שירות', hours: 25 },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    // Helper derived totalHours=25, hoursRemaining=25, isBlocked=false
    expect(payload.totalHours).toBe(25);
    expect(payload.hoursRemaining).toBe(25);
    expect(payload.hoursUsed).toBe(0);
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(false);
  });

  test('fixed-only service → I1 → isBlocked=false', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      { clientId: 'c1', serviceType: 'fixed', serviceName: 'פיקס', fixedPrice: 5000 },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    // No billable hours → I1 → isBlocked=false
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(false);
    expect(payload.totalHours).toBe(0); // fixed doesn't contribute to totalHours
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Audit log
// ═══════════════════════════════════════════════════════════════

describe('F. Audit log', () => {
  test('ADD_SERVICE_TO_CLIENT emitted with full payload', async () => {
    setupTxMocks(makeClientDoc([]));
    await addServiceToClient(
      { clientId: 'c1', serviceType: 'hours', serviceName: 'שירות חדש', hours: 10 },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      'ADD_SERVICE_TO_CLIENT',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        caseNumber: 'c1',
        serviceId: expect.stringMatching(/^srv_/),
        serviceType: 'hours',
        serviceName: 'שירות חדש'
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Return value
// ═══════════════════════════════════════════════════════════════

describe('G. Return value', () => {
  test('returns { success, serviceId, service, message }', async () => {
    setupTxMocks(makeClientDoc([]));
    const result = await addServiceToClient(
      { clientId: 'c1', serviceType: 'fixed', serviceName: 'שירות', fixedPrice: 1000 },
      makeCtx()
    );
    expect(result).toMatchObject({
      success: true,
      serviceId: expect.stringMatching(/^srv_/),
      service: expect.objectContaining({
        name: 'שירות',
        type: 'fixed',
        fixedPrice: 1000
      }),
      message: expect.stringContaining('נוסף')
    });
  });
});
