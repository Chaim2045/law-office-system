/**
 * Tests for addPackageToService CF after PR-B.7 migration.
 *
 * Coverage:
 *   A. Auth + validation
 *   B. Lookup failures
 *   C. Service-type guard (only hours-services accept packages)
 *   D. Service-level drift guard (predates this migration; must remain)
 *   E. Canonical helper integration:
 *      - happy path (package appended, service.totalHours grows, aggregates derived)
 *      - orphan absorption (newPackage.hoursUsed = orphanHours)
 *      - legacy `caseId` alias
 *   F. Audit log
 *   G. Return shape
 */

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

// Orphan query chain: db.collection('timesheet_entries').where().where().get()
const mockOrphanGet = jest.fn();
const mockOrphanQuery = {
  where: jest.fn().mockReturnThis(),
  get: mockOrphanGet
};
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn(async () => {});
const mockBatch = { update: mockBatchUpdate, commit: mockBatchCommit };

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'timesheet_entries') {
      return mockOrphanQuery;
    }
    return {
      doc: jest.fn((id) => ({ id: id || 'auto_id' }))
    };
  }),
  runTransaction: mockRunTransaction,
  batch: jest.fn(() => mockBatch)
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

const { addPackageToService } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeHoursService(id, opts = {}) {
  const { totalHours = 10, packages = null, status = 'active' } = opts;
  const pkg = packages || [
    {
      id: `${id}_pkg_initial`,
      type: 'initial',
      hours: totalHours,
      hoursUsed: 0,
      hoursRemaining: totalHours,
      status: 'active'
    }
  ];
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed: pkg.reduce((s, p) => s + (p.hoursUsed || 0), 0),
    hoursRemaining: totalHours - pkg.reduce((s, p) => s + (p.hoursUsed || 0), 0),
    packages: pkg,
    status
  };
}

function makeFixedService(id) {
  return {
    id,
    type: ST.FIXED,
    name: `פיקס ${id}`,
    fixedPrice: 5000,
    status: 'active'
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
      totalHours
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

function setupTxMocks(clientDoc, orphans = []) {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)  // CF body
    .mockResolvedValueOnce(clientDoc); // helper internal

  // Orphan query response
  mockOrphanGet.mockReset();
  const docs = orphans.map((o, i) => ({
    ref: { id: `entry${i}` },
    data: () => o
  }));
  mockOrphanGet.mockResolvedValue({
    forEach: (cb) => docs.forEach(cb)
  });
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
      addPackageToService(
        { clientId: 'c1', serviceId: 's1', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('missing clientId AND caseId → invalid-argument', async () => {
    await expect(
      addPackageToService({ serviceId: 's1', hours: 10 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('missing serviceId → invalid-argument', async () => {
    await expect(
      addPackageToService({ clientId: 'c1', hours: 10 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('hours <= 0 → invalid-argument', async () => {
    await expect(
      addPackageToService(
        { clientId: 'c1', serviceId: 's1', hours: 0 },
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
    setupTxMocks({ exists: false }, []);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce({ exists: false });
    await expect(
      addPackageToService(
        { clientId: 'missing', serviceId: 's1', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found → not-found', async () => {
    setupTxMocks(makeClientDoc([makeHoursService('s_other')]), []);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeHoursService('s_other')])
    );
    await expect(
      addPackageToService(
        { clientId: 'c1', serviceId: 'missing-svc', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Service-type guard
// ═══════════════════════════════════════════════════════════════

describe('C. Service-type guard', () => {
  test('rejects fixed service → invalid-argument', async () => {
    setupTxMocks(makeClientDoc([makeFixedService('s_fixed')]), []);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeFixedService('s_fixed')])
    );
    await expect(
      addPackageToService(
        { clientId: 'c1', serviceId: 's_fixed', hours: 10 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Service-level drift guard (predates this migration; preserved)
// ═══════════════════════════════════════════════════════════════

describe('D. Service-level drift guard', () => {
  test('drift > 0.05 → failed-precondition + no write', async () => {
    // Build a service with intentional drift:
    // service.totalHours = 10
    // service.packages = [{ hours: 5 }]   ← Σ = 5, not 10 → drift = 5
    const driftedService = {
      id: 's1',
      type: ST.HOURS,
      name: 'שירות drifted',
      totalHours: 10,
      hoursUsed: 0,
      hoursRemaining: 10,
      packages: [{ id: 'p1', hours: 5, hoursUsed: 0, hoursRemaining: 5, status: 'active' }],
      status: 'active'
    };
    setupTxMocks(makeClientDoc([driftedService]), []);

    await expect(
      addPackageToService(
        { clientId: 'c1', serviceId: 's1', hours: 5 },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    // No write attempted on client doc
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Canonical helper integration (PR-B.7)
// ═══════════════════════════════════════════════════════════════

describe('E. Canonical helper integration', () => {
  test('happy path: package appended, service.totalHours grows, aggregates derived', async () => {
    setupTxMocks(makeClientDoc([
      makeHoursService('s1', { totalHours: 10 })
    ]), []);

    await addPackageToService(
      { clientId: 'c1', serviceId: 's1', hours: 5 },
      makeCtx()
    );

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services.find(s => s.id === 's1');

    // Service-level: package appended, totals grow
    expect(svc.packages).toHaveLength(2); // initial + new
    const newPkg = svc.packages.find(p => p.type === 'additional');
    expect(newPkg.hours).toBe(5);
    expect(svc.totalHours).toBe(15); // 10 + 5
    expect(svc.hoursRemaining).toBe(15);

    // Client-level: helper-derived aggregates
    expect(payload.totalHours).toBe(15);
    expect(payload.hoursUsed).toBe(0);
    expect(payload.hoursRemaining).toBe(15);
    expect(payload.isBlocked).toBe(false);
  });

  test('orphan absorption: orphan entries assigned to newPackage, hoursUsed reflects them', async () => {
    setupTxMocks(
      makeClientDoc([makeHoursService('s1', { totalHours: 10 })]),
      // 2 orphan entries — 60 + 30 = 90 minutes = 1.5h
      [
        { minutes: 60, clientId: 'c1', serviceId: 's1' },
        { minutes: 30, clientId: 'c1', serviceId: 's1' }
      ]
    );

    await addPackageToService(
      { clientId: 'c1', serviceId: 's1', hours: 5 },
      makeCtx()
    );

    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services.find(s => s.id === 's1');
    const newPkg = svc.packages.find(p => p.type === 'additional');

    // newPackage absorbs orphan hours
    expect(newPkg.hoursUsed).toBe(1.5);
    expect(newPkg.hoursRemaining).toBe(3.5); // 5 - 1.5

    // Service totals reflect: 10 initial (unused) + 5 new (1.5 used) = 15 total, 1.5 used
    expect(svc.totalHours).toBe(15);
    expect(svc.hoursUsed).toBe(1.5);
    expect(svc.hoursRemaining).toBe(13.5);

    // Backfill: orphan entries got packageId
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  test('legacy caseId alias works same as clientId', async () => {
    setupTxMocks(
      makeClientDoc([makeHoursService('s1', { totalHours: 10 })]),
      []
    );

    const result = await addPackageToService(
      { caseId: 'c1', serviceId: 's1', hours: 5 },
      makeCtx()
    );

    expect(result.success).toBe(true);
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Audit log
// ═══════════════════════════════════════════════════════════════

describe('F. Audit log', () => {
  test('ADD_PACKAGE_TO_SERVICE emitted with full payload', async () => {
    setupTxMocks(
      makeClientDoc([makeHoursService('s1', { totalHours: 10 })]),
      []
    );

    await addPackageToService(
      { clientId: 'c1', serviceId: 's1', hours: 7 },
      makeCtx()
    );

    expect(mockLogAction).toHaveBeenCalledWith(
      'ADD_PACKAGE_TO_SERVICE',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        caseNumber: 'c1',
        serviceId: 's1',
        packageId: expect.stringMatching(/^pkg_/),
        hours: 7,
        serviceName: 'שירות s1'
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Return value
// ═══════════════════════════════════════════════════════════════

describe('G. Return value', () => {
  test('returns { success, packageId, package, service: { id, name, totalHours, hoursRemaining, packagesCount }, message }', async () => {
    setupTxMocks(
      makeClientDoc([makeHoursService('s1', { totalHours: 10 })]),
      []
    );

    const result = await addPackageToService(
      { clientId: 'c1', serviceId: 's1', hours: 5 },
      makeCtx()
    );

    expect(result).toMatchObject({
      success: true,
      packageId: expect.stringMatching(/^pkg_/),
      package: expect.objectContaining({
        type: 'additional',
        hours: 5
      }),
      service: expect.objectContaining({
        id: 's1',
        name: 'שירות s1',
        totalHours: 15,
        hoursRemaining: 15,
        packagesCount: 2
      }),
      message: expect.any(String)
    });
  });
});
