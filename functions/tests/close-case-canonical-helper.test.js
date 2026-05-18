/**
 * Tests for closeCase CF after PR-B.14 migration.
 *
 * Coverage:
 *   A. Helper integration — happy path (no ReferenceError; canonical aggregates returned)
 *   B. Service completion (counters, immutability)
 *   C. Same-state guard (already archived → throws; helper NOT called)
 *   D. Validation (missing clientId → throws; helper NOT called)
 *   E. Behavioral change — overdraft archive: isBlocked computed canonically (true), not forced false
 *   F. Audit log post-transaction
 *
 * This file is also the FIRST test coverage for closeCase — the prior
 * implementation had a latent ReferenceError (clientHoursUsed et al.
 * undefined) that prevented any successful call. PR-B.14 fixes the bug
 * inline with the migration since both touch the same return block.
 */

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

// Active-budget-tasks query chain: db.collection('budget_tasks').where().where().get()
const mockBudgetTasksGet = jest.fn().mockResolvedValue({ size: 0 });
const mockBudgetTasksQuery = {
  where: jest.fn().mockReturnThis(),
  get: mockBudgetTasksGet
};

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'budget_tasks') {
      return mockBudgetTasksQuery;
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

// Spy on helper — call-through is critical since closeCase reads helperResult.aggregates
const mockHelper = jest.fn((...args) =>
  jest.requireActual('../shared/client-writer').writeClientWithCanonicalAggregates(...args)
);
jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: (...args) => mockHelper(...args),
  RESTRICTED_KEYS: jest.requireActual('../shared/client-writer').RESTRICTED_KEYS
}));

const { closeCase } = require('../clients/index');
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
    packages: [],
    status
  };
}

function makeClientDoc(services, overrides = {}) {
  const data = {
    fullName: 'לקוח טסט',
    clientName: 'לקוח טסט',
    status: 'active',
    isArchived: false,
    services,
    totalHours: services.reduce((s, svc) => s + (svc.totalHours || 0), 0),
    ...overrides
  };
  return { exists: true, data: () => data };
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
  mockBudgetTasksGet.mockResolvedValue({ size: 0 });
});

// ═══════════════════════════════════════════════════════════════
// A. Helper integration — happy path
// ═══════════════════════════════════════════════════════════════

describe('A. Helper integration — happy path', () => {
  test('helper called once with non-aggregate payload + caller + auditMeta; canonical aggregates returned', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const clientDoc = makeClientDoc(services);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)   // CF read
      .mockResolvedValueOnce(clientDoc);  // helper internal read

    const result = await closeCase({ clientId: 'c1', note: 'תיק הסתיים' }, makeCtx());

    expect(result.success).toBe(true);
    expect(mockHelper).toHaveBeenCalledTimes(1);

    const [tx, ref, payload, options] = mockHelper.mock.calls[0];
    expect(tx).toBe(mockTransaction);
    expect(ref.id).toBe('c1');

    // Payload: status/isArchived/archivedAt/services + counts — NO aggregates
    expect(payload.status).toBe('inactive');
    expect(payload.isArchived).toBe(true);
    expect(payload.archivedAt).toBeDefined();
    expect(Array.isArray(payload.services)).toBe(true);
    expect(payload.totalServices).toBe(1);
    expect(payload.activeServices).toBe(0);
    expect(payload.totalHours).toBeUndefined();
    expect(payload.hoursUsed).toBeUndefined();
    expect(payload.hoursRemaining).toBeUndefined();
    expect(payload.minutesRemaining).toBeUndefined();
    expect(payload.isBlocked).toBeUndefined();
    expect(payload.isCritical).toBeUndefined();
    expect(payload.lastModifiedAt).toBeUndefined();  // helper adds via auditMeta
    expect(payload.lastModifiedBy).toBeUndefined();  // helper adds via auditMeta

    expect(options.caller).toBe('closeCase');
    expect(options.auditMeta).toEqual({ uid: 'admin1', username: 'admin' });
    expect(options.mode).toBeUndefined();

    // No ReferenceError — return aggregates block accessible
    expect(result.clientAggregates.totalHours).toBe(10);
    expect(result.clientAggregates.hoursUsed).toBe(3);
    expect(result.clientAggregates.hoursRemaining).toBe(7);
    expect(result.clientAggregates.isBlocked).toBe(false);
    expect(result.clientAggregates.isCritical).toBe(false);
    expect(result.clientAggregates.totalServices).toBe(1);
    expect(result.clientAggregates.activeServices).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Service completion
// ═══════════════════════════════════════════════════════════════

describe('B. Service completion logic', () => {
  test('mixed active + completed services → counters accurate; non-completed set to completed', async () => {
    const services = [
      makeHoursService('svc1', { totalHours: 10, hoursUsed: 3, status: 'active' }),
      makeHoursService('svc2', { totalHours: 5, hoursUsed: 5, status: 'completed' }),
      makeHoursService('svc3', { totalHours: 8, hoursUsed: 2, status: 'active' })
    ];
    const clientDoc = makeClientDoc(services);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await closeCase({ clientId: 'c1' }, makeCtx());

    expect(result.servicesCompleted).toBe(2);
    expect(result.servicesAlreadyCompleted).toBe(1);

    const [, , payload] = mockHelper.mock.calls[0];
    expect(payload.services.every(s => s.status === 'completed')).toBe(true);
    expect(payload.services.filter(s => s.completedAt).length).toBe(2);  // newly completed
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Same-state guard
// ═══════════════════════════════════════════════════════════════

describe('C. Same-state guard', () => {
  test('already inactive + isArchived → throws failed-precondition; helper NOT called', async () => {
    const services = [makeHoursService('svc1')];
    const clientDoc = makeClientDoc(services, { status: 'inactive', isArchived: true });
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(clientDoc);

    await expect(closeCase({ clientId: 'c1' }, makeCtx())).rejects.toMatchObject({
      code: 'failed-precondition'
    });
    expect(mockHelper).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Validation
// ═══════════════════════════════════════════════════════════════

describe('D. Validation', () => {
  test('missing clientId → throws invalid-argument; helper NOT called', async () => {
    await expect(closeCase({}, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument'
    });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('non-string clientId → throws invalid-argument; helper NOT called', async () => {
    await expect(closeCase({ clientId: 123 }, makeCtx())).rejects.toMatchObject({
      code: 'invalid-argument'
    });
    expect(mockHelper).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Behavioral change — overdraft archive
// ═══════════════════════════════════════════════════════════════

describe('E. Behavioral change — overdraft archive', () => {
  test('client in overdraft on archive → isBlocked: true (was forced false pre-PR-B.14)', async () => {
    // Service with hoursUsed > totalHours → overdraft
    const overdraftSvc = makeHoursService('svc1', { totalHours: 10, hoursUsed: 15 });
    const services = [overdraftSvc];
    const clientDoc = makeClientDoc(services);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await closeCase({ clientId: 'c1' }, makeCtx());

    // Canonical: hoursRemaining = -5, no override → isBlocked: true
    expect(result.clientAggregates.hoursRemaining).toBe(-5);
    expect(result.clientAggregates.isBlocked).toBe(true);
    // isCritical only when hoursRemaining > 0 — depleted = not critical
    expect(result.clientAggregates.isCritical).toBe(false);
  });

  test('client with hours remaining on archive → isBlocked: false, isCritical reflects threshold', async () => {
    // 3h remaining → critical threshold (hours > 0 && <= 5)
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 7 })];
    const clientDoc = makeClientDoc(services);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await closeCase({ clientId: 'c1' }, makeCtx());

    expect(result.clientAggregates.hoursRemaining).toBe(3);
    expect(result.clientAggregates.isBlocked).toBe(false);
    expect(result.clientAggregates.isCritical).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Audit log post-transaction
// ═══════════════════════════════════════════════════════════════

describe('F. Audit log post-transaction', () => {
  test('logAction called once with CLOSE_CASE + full payload', async () => {
    const services = [makeHoursService('svc1', { totalHours: 10, hoursUsed: 3 })];
    const clientDoc = makeClientDoc(services);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);
    mockBudgetTasksGet.mockResolvedValueOnce({ size: 2 });

    await closeCase({ clientId: 'c1', note: 'הערה' }, makeCtx());

    expect(mockLogAction).toHaveBeenCalledWith(
      'CLOSE_CASE',
      'admin1',
      'admin',
      expect.objectContaining({
        clientId: 'c1',
        clientName: 'לקוח טסט',
        previousStatus: 'active',
        servicesCompleted: 1,
        servicesAlreadyCompleted: 0,
        activeBudgetTasksRemaining: 2,
        note: 'הערה'
      })
    );
  });
});
