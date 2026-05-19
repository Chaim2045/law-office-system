/**
 * Tests for onTimesheetEntryChanged trigger after PR-B.12 migration.
 *
 * Coverage:
 *   A. Helper integration on UPDATE (most common trigger fire)
 *   B. Helper integration on DELETE
 *   C. CREATE with deductedInTransaction: true → helper NOT called
 *   D. Self-write (only isOverage/overageMinutes changed) → helper NOT called
 *   E. Missing clientId / serviceId → helper NOT called
 *   F. `mode: 'log_only'` override + caller label
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
  const Timestamp = {
    now: jest.fn(() => 'NOW'),
    fromDate: jest.fn((d) => ({ _date: d.toISOString() }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue, Timestamp })
  };
});

// Capture handler registered via onDocumentWritten
let registeredHandler = null;
jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn((config, fn) => {
    registeredHandler = fn;
    return fn;
  })
}));

// Spy on the helper
const mockHelper = jest.fn().mockResolvedValue({
  aggregates: { hoursUsed: 1, hoursRemaining: 9, isBlocked: false, isCritical: false },
  previousAggregates: {},
  strippedKeys: [],
  written: {},
  mode: 'log_only'
});

jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: mockHelper,
  RESTRICTED_KEYS: []
}));

require('../triggers/timesheet-trigger');
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

function makeClientDoc(services = []) {
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
      totalHours
    })
  };
}

function makeTaskDoc() {
  return { exists: true, data: () => ({ title: 'משימה' }) };
}

function makeEvent({ before = null, after = null, entryId = 'entry1', eventId = 'event1' } = {}) {
  return {
    params: { entryId },
    id: eventId,
    data: {
      before: { exists: !!before, data: () => before },
      after: { exists: !!after, data: () => after }
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHelper.mockClear();
});

// ═══════════════════════════════════════════════════════════════
// A. Helper integration on UPDATE
// ═══════════════════════════════════════════════════════════════

describe('A. Helper integration on UPDATE', () => {
  test('UPDATE with minutes delta → helper called with services + lastActivity, no manual aggregates', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce({ exists: false })                                    // idempotency (not processed)
      .mockResolvedValueOnce(makeClientDoc([makeHoursService('svc1', { totalHours: 10 })]))  // client
      .mockResolvedValueOnce(makeTaskDoc())                                        // task
      .mockResolvedValueOnce(makeClientDoc([makeHoursService('svc1', { totalHours: 10 })])); // helper re-read

    await registeredHandler(makeEvent({
      before: { clientId: 'c1', serviceId: 'svc1', packageId: 'svc1_pkg_1', minutes: 30, taskId: 'task1' },
      after:  { clientId: 'c1', serviceId: 'svc1', packageId: 'svc1_pkg_1', minutes: 90, taskId: 'task1' }
    }));

    expect(mockHelper).toHaveBeenCalledTimes(1);
    const [tx, ref, payload, options] = mockHelper.mock.calls[0];
    expect(tx).toBe(mockTransaction);
    expect(ref.id).toBe('c1');

    // Payload: services + lastActivity only — NO manual aggregate fields
    expect(payload.services).toBeDefined();
    expect(Array.isArray(payload.services)).toBe(true);
    expect(payload.lastActivity).toBe('SERVER_TIMESTAMP');
    expect(payload.hoursUsed).toBeUndefined();
    expect(payload.hoursRemaining).toBeUndefined();
    expect(payload.minutesUsed).toBeUndefined();
    expect(payload.minutesRemaining).toBeUndefined();
    expect(payload.isBlocked).toBeUndefined();
    expect(payload.isCritical).toBeUndefined();

    // Options: caller + log_only override
    expect(options.caller).toBe('onTimesheetEntryChanged');
    expect(options.mode).toBe('log_only');
    expect(options.auditMeta).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Helper integration on DELETE
// ═══════════════════════════════════════════════════════════════

describe('B. Helper integration on DELETE', () => {
  test('DELETE → helper called; no entry overage write (no afterData)', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce({ exists: false })  // idempotency
      .mockResolvedValueOnce(makeClientDoc([makeHoursService('svc1', { totalHours: 10, hoursUsed: 1 })]))  // client
      .mockResolvedValueOnce(makeClientDoc([makeHoursService('svc1', { totalHours: 10, hoursUsed: 1 })])); // helper re-read

    await registeredHandler(makeEvent({
      before: { clientId: 'c1', serviceId: 'svc1', packageId: 'svc1_pkg_1', minutes: 60 },
      after: null
    }));

    expect(mockHelper).toHaveBeenCalledTimes(1);
    const [, , payload, options] = mockHelper.mock.calls[0];
    expect(payload.services).toBeDefined();
    expect(options.caller).toBe('onTimesheetEntryChanged');
    expect(options.mode).toBe('log_only');

    // No entry overage write on DELETE (afterData is null)
    const entryWrites = mockTransaction.update.mock.calls.filter(
      ([ref]) => ref && ref.id === 'entry1'
    );
    expect(entryWrites).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. CREATE with deductedInTransaction: true → helper NOT called
// ═══════════════════════════════════════════════════════════════

describe('C. CREATE with deductedInTransaction: true', () => {
  test('callable already deducted → trigger skips entirely; helper NOT called', async () => {
    mockTransaction.get.mockReset();

    await registeredHandler(makeEvent({
      before: null,
      after: {
        clientId: 'c1',
        serviceId: 'svc1',
        minutes: 60,
        deductedInTransaction: true,
        taskId: 'task1'
      }
    }));

    expect(mockHelper).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Self-write guard
// ═══════════════════════════════════════════════════════════════

describe('D. Self-write guard (only isOverage/overageMinutes changed)', () => {
  test('UPDATE that only flips isOverage → trigger skips; helper NOT called', async () => {
    mockTransaction.get.mockReset();

    await registeredHandler(makeEvent({
      before: { clientId: 'c1', serviceId: 'svc1', minutes: 60, isOverage: false, overageMinutes: 0 },
      after:  { clientId: 'c1', serviceId: 'svc1', minutes: 60, isOverage: true,  overageMinutes: 15 }
    }));

    expect(mockHelper).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Missing clientId / serviceId
// ═══════════════════════════════════════════════════════════════

describe('E. Missing required fields', () => {
  test('missing clientId → helper NOT called', async () => {
    mockTransaction.get.mockReset();

    await registeredHandler(makeEvent({
      before: null,
      after: { serviceId: 'svc1', minutes: 60 }
    }));

    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('missing serviceId → helper NOT called', async () => {
    mockTransaction.get.mockReset();

    await registeredHandler(makeEvent({
      before: null,
      after: { clientId: 'c1', minutes: 60 }
    }));

    expect(mockHelper).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Idempotency early-return
// ═══════════════════════════════════════════════════════════════

describe('F. Idempotency early-return', () => {
  test('event already processed → helper NOT called', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce({ exists: true });  // idempotency: already processed

    await registeredHandler(makeEvent({
      before: null,
      after: { clientId: 'c1', serviceId: 'svc1', packageId: 'svc1_pkg_1', minutes: 60 }
    }));

    expect(mockHelper).not.toHaveBeenCalled();
  });
});
