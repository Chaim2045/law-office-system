/**
 * Tests for auditClientAggregates + repairClientAggregates (PR-D).
 *
 * Coverage:
 *   A. auditClientAggregates
 *      - non-admin → permission-denied
 *      - empty universe → totalChecked: 0
 *      - clean clients → totalDrifts: 0; drifts: []
 *      - drifted client (isBlocked) → drift reported
 *      - drifted client (numeric field) → drift reported with diff
 *      - multiple drift fields → all reported
 *      - filtered scan (clientIds) → only those checked
 *      - SKIP_CLIENTS exempted
 *      - audit is read-only (no transaction.update / .set ever)
 *   B. repairClientAggregates
 *      - non-admin → permission-denied
 *      - missing clientId → invalid-argument
 *      - SKIP_CLIENTS rejected
 *      - drifted client → helper called with empty partialUpdate; before/after differ; changed: true
 *      - already-canonical → helper called; before/after equal; changed: false; audit logged
 *      - audit logged post-transaction
 */

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

// Collection mocks for `clients` (auditClientAggregates uses .get())
const mockClientsGet = jest.fn();
const mockClientDocGets = new Map();  // clientId → doc snapshot

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'clients') {
      return {
        get: mockClientsGet,
        doc: jest.fn((id) => ({
          id,
          get: async () => mockClientDocGets.get(id) || { exists: false }
        }))
      };
    }
    return {
      doc: jest.fn((id) => ({ id: id || 'auto_id' })),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: false, docs: [] })
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

// Spy on helper — call-through to real implementation
const mockHelper = jest.fn((...args) =>
  jest.requireActual('../shared/client-writer').writeClientWithCanonicalAggregates(...args)
);
jest.mock('../shared/client-writer', () => {
  const actual = jest.requireActual('../shared/client-writer');
  return {
    writeClientWithCanonicalAggregates: (...args) => mockHelper(...args),
    RESTRICTED_KEYS: actual.RESTRICTED_KEYS,
    _recomputeTotalHours: actual._recomputeTotalHours
  };
});

const { auditClientAggregates, repairClientAggregates } = require('../admin/repair-aggregates');
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

function makeClientDocSnapshot(clientId, services, storedOverrides = {}) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  const hoursUsed = services
    .filter(s => s.type === ST.HOURS)
    .reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
  const hoursRemaining = totalHours - hoursUsed;
  const data = {
    fullName: `לקוח ${clientId}`,
    services,
    totalHours,
    hoursUsed,
    hoursRemaining,
    minutesUsed: hoursUsed * 60,
    minutesRemaining: hoursRemaining * 60,
    isBlocked: hoursRemaining <= 0,
    isCritical: hoursRemaining > 0 && hoursRemaining <= 5,
    ...storedOverrides
  };
  return { id: clientId, exists: true, data: () => data };
}

function makeCtx() {
  return { auth: { uid: 'admin1', token: { email: 'admin@test' } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue({
    uid: 'admin1',
    email: 'admin@test',
    username: 'admin',
    role: 'admin'
  });
  mockLogAction.mockResolvedValue(undefined);
  mockClientDocGets.clear();
});

// ═══════════════════════════════════════════════════════════════
// A. auditClientAggregates
// ═══════════════════════════════════════════════════════════════

describe('A. auditClientAggregates', () => {
  test('non-admin → permission-denied', async () => {
    mockCheckUserPermissions.mockResolvedValueOnce({
      uid: 'u1', email: 'u@test', username: 'u', role: 'employee'
    });
    await expect(auditClientAggregates({}, makeCtx())).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(mockClientsGet).not.toHaveBeenCalled();
  });

  test('empty universe → totalChecked: 0, totalDrifts: 0', async () => {
    mockClientsGet.mockResolvedValueOnce({ docs: [] });
    const result = await auditClientAggregates({}, makeCtx());
    expect(result.success).toBe(true);
    expect(result.totalChecked).toBe(0);
    expect(result.totalDrifts).toBe(0);
    expect(result.drifts).toEqual([]);
    expect(result.scannedAt).toBeDefined();
  });

  test('clean client (canonical aggregates match) → no drift', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const doc = makeClientDocSnapshot('c1', services);
    mockClientsGet.mockResolvedValueOnce({ docs: [doc] });

    const result = await auditClientAggregates({}, makeCtx());
    expect(result.totalChecked).toBe(1);
    expect(result.totalDrifts).toBe(0);
    expect(result.drifts).toEqual([]);
  });

  test('client with isBlocked drift → reported', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    // Override: stored isBlocked: true (incorrect — canonical = false since 7h remain)
    const doc = makeClientDocSnapshot('c1', services, { isBlocked: true });
    mockClientsGet.mockResolvedValueOnce({ docs: [doc] });

    const result = await auditClientAggregates({}, makeCtx());
    expect(result.totalDrifts).toBe(1);
    expect(result.drifts[0].clientId).toBe('c1');
    const isBlockedDrift = result.drifts[0].driftFields.find(d => d.field === 'isBlocked');
    expect(isBlockedDrift).toEqual({ field: 'isBlocked', current: true, canonical: false });
  });

  test('client with numeric drift → reported with diff', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    // Override: stored hoursUsed: 5 (incorrect — canonical = 3)
    const doc = makeClientDocSnapshot('c1', services, { hoursUsed: 5 });
    mockClientsGet.mockResolvedValueOnce({ docs: [doc] });

    const result = await auditClientAggregates({}, makeCtx());
    expect(result.totalDrifts).toBe(1);
    const hoursUsedDrift = result.drifts[0].driftFields.find(d => d.field === 'hoursUsed');
    expect(hoursUsedDrift).toEqual({
      field: 'hoursUsed',
      current: 5,
      canonical: 3,
      diff: 2
    });
  });

  test('multiple drift fields on same client → all reported', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const doc = makeClientDocSnapshot('c1', services, {
      isBlocked: true,
      isCritical: true,
      hoursUsed: 8
    });
    mockClientsGet.mockResolvedValueOnce({ docs: [doc] });

    const result = await auditClientAggregates({}, makeCtx());
    expect(result.totalDrifts).toBe(1);
    const fields = result.drifts[0].driftFields.map(d => d.field);
    expect(fields).toContain('isBlocked');
    expect(fields).toContain('isCritical');
    expect(fields).toContain('hoursUsed');
  });

  test('filtered scan with clientIds → only those checked', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const driftedDoc = makeClientDocSnapshot('c2', services, { isBlocked: true });
    mockClientDocGets.set('c2', driftedDoc);

    const result = await auditClientAggregates({ clientIds: ['c2'] }, makeCtx());
    expect(result.totalChecked).toBe(1);
    expect(result.totalDrifts).toBe(1);
    expect(result.drifts[0].clientId).toBe('c2');
    expect(mockClientsGet).not.toHaveBeenCalled();  // full scan NOT used
  });

  test('SKIP_CLIENTS exempted from scan', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const internalDoc = makeClientDocSnapshot('internal_office', services, { isBlocked: true });
    const otherDoc = makeClientDocSnapshot('c1', services);
    mockClientsGet.mockResolvedValueOnce({ docs: [internalDoc, otherDoc] });

    const result = await auditClientAggregates({}, makeCtx());
    expect(result.totalChecked).toBe(1);  // internal_office skipped
    expect(result.totalDrifts).toBe(0);
  });

  test('audit is read-only (no writes)', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const doc = makeClientDocSnapshot('c1', services, { isBlocked: true });
    mockClientsGet.mockResolvedValueOnce({ docs: [doc] });

    await auditClientAggregates({}, makeCtx());

    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. repairClientAggregates
// ═══════════════════════════════════════════════════════════════

describe('B. repairClientAggregates', () => {
  test('non-admin → permission-denied', async () => {
    mockCheckUserPermissions.mockResolvedValueOnce({
      uid: 'u1', email: 'u@test', username: 'u', role: 'employee'
    });
    await expect(repairClientAggregates({ clientId: 'c1' }, makeCtx())).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('missing clientId → invalid-argument', async () => {
    await expect(repairClientAggregates({}, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument'
    });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('SKIP_CLIENTS rejected', async () => {
    await expect(repairClientAggregates({ clientId: 'internal_office' }, makeCtx())).rejects.toMatchObject({
      code: 'failed-precondition'
    });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('drifted client → helper called with empty partialUpdate; before/after differ; changed: true', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    // Stored: isBlocked=true (wrong), hoursUsed=8 (wrong). Canonical: isBlocked=false, hoursUsed=3.
    const doc = makeClientDocSnapshot('c1', services, { isBlocked: true, hoursUsed: 8 });
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(doc);

    const result = await repairClientAggregates({ clientId: 'c1' }, makeCtx());

    expect(mockHelper).toHaveBeenCalledTimes(1);
    const [, , partialUpdate, options] = mockHelper.mock.calls[0];
    expect(partialUpdate).toEqual({});
    expect(options.caller).toBe('repairClientAggregates');
    expect(options.auditMeta).toEqual({ uid: 'admin1', username: 'admin' });

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.before.isBlocked).toBe(true);
    expect(result.before.hoursUsed).toBe(8);
    expect(result.after.isBlocked).toBe(false);
    expect(result.after.hoursUsed).toBe(3);
  });

  test('already-canonical client → helper still called; changed: false; audit logged', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const doc = makeClientDocSnapshot('c1', services);  // no overrides — fully canonical
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(doc);

    const result = await repairClientAggregates({ clientId: 'c1' }, makeCtx());

    expect(mockHelper).toHaveBeenCalledTimes(1);
    expect(result.changed).toBe(false);
    expect(result.before.isBlocked).toBe(false);
    expect(result.after.isBlocked).toBe(false);
    expect(result.before.hoursUsed).toBe(3);
    expect(result.after.hoursUsed).toBe(3);
  });

  test('audit logged post-transaction with full before/after/changed', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const doc = makeClientDocSnapshot('c1', services, { isBlocked: true });
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(doc);

    await repairClientAggregates({ clientId: 'c1' }, makeCtx());

    expect(mockLogAction).toHaveBeenCalledTimes(1);
    expect(mockLogAction).toHaveBeenCalledWith(
      'REPAIR_CLIENT_AGGREGATES',
      'admin1',
      'admin',
      expect.objectContaining({
        clientId: 'c1',
        changed: true,
        before: expect.objectContaining({ isBlocked: true }),
        after: expect.objectContaining({ isBlocked: false })
      })
    );
  });
});
