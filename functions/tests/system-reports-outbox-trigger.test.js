/**
 * Tests for onSystemHealthCheckCreated trigger (PR-C.2-fns).
 *
 * Coverage:
 *   A. PASS health check → no outbox write
 *   B. FAIL health check → outbox doc with full payload
 *   C. Outbox doc shape (status: 'pending', attempts: 0, etc.)
 *   D. Source doc never mutated (trigger does not update system_health_checks)
 *   E. Missing snapshot data → no-op
 *   F. discrepanciesCount=0 with status FAIL / status ERROR (PR-IG-A1) → outbox write
 */

const mockOutboxAdd = jest.fn().mockResolvedValue({ id: 'outbox_auto_id' });
const mockOutboxRef = { add: mockOutboxAdd };

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'system_reports_outbox') {
      return mockOutboxRef;
    }
    return {
      doc: jest.fn(() => ({ id: 'x', update: jest.fn(), set: jest.fn() }))
    };
  })
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue })
  };
});

// Capture handler registered via onDocumentCreated
let registeredHandler = null;
jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: jest.fn((config, fn) => {
    registeredHandler = fn;
    return fn;
  })
}));

require('../triggers/system-reports-outbox-trigger');

function makeEvent({ docId = 'hc1', data = null } = {}) {
  return {
    params: { docId },
    data: data ? { data: () => data } : null
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOutboxAdd.mockResolvedValue({ id: 'outbox_auto_id' });
});

// ═══════════════════════════════════════════════════════════════
// A. PASS health check → no outbox write
// ═══════════════════════════════════════════════════════════════

describe('A. PASS health check', () => {
  test('status: PASS → no outbox write', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'PASS',
        discrepanciesCount: 0,
        discrepancies: []
      }
    }));

    expect(mockOutboxAdd).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. FAIL → outbox written with full payload
// ═══════════════════════════════════════════════════════════════

describe('B. FAIL health check', () => {
  test('status: FAIL with discrepancies → outbox doc written with full payload', async () => {
    const discrepancies = [
      {
        type: 'aggregate_drift',
        clientId: 'c1',
        clientName: 'לקוח טסט',
        driftFields: [
          { field: 'isBlocked', current: true, canonical: false }
        ]
      },
      {
        type: 'package_drift',
        clientId: 'c2',
        clientName: 'לקוח שני',
        serviceId: 'svc1',
        totalHours: 10,
        sumPkgHours: 8,
        drift: 2
      }
    ];

    await registeredHandler(makeEvent({
      docId: 'hc_2026_05_18',
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        discrepanciesCount: 2,
        discrepancies
      }
    }));

    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.type).toBe('system_health_check');
    expect(payload.severity).toBe('warning');
    expect(payload.source).toBe('dailyInvariantCheck');
    expect(payload.healthCheckDocId).toBe('hc_2026_05_18');
    expect(payload.discrepanciesCount).toBe(2);
    expect(payload.discrepancies).toEqual(discrepancies);
    expect(payload.status).toBe('pending');
    expect(payload.attempts).toBe(0);
    expect(payload.createdAt).toBe('SERVER_TIMESTAMP');
    expect(payload.sentAt).toBeNull();
    expect(payload.errorMessage).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Outbox doc shape — fields complete
// ═══════════════════════════════════════════════════════════════

describe('C. Outbox doc shape', () => {
  test('all required fields present', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        discrepanciesCount: 1,
        discrepancies: [{ type: 'aggregate_drift', clientId: 'c1' }]
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    const requiredFields = [
      'type', 'severity', 'source', 'healthCheckDocId',
      'discrepanciesCount', 'discrepancies',
      'status', 'attempts', 'createdAt', 'sentAt', 'errorMessage'
    ];
    for (const field of requiredFields) {
      expect(payload).toHaveProperty(field);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Source doc never mutated
// ═══════════════════════════════════════════════════════════════

describe('D. Source doc not mutated', () => {
  test('only writes to system_reports_outbox, never to system_health_checks', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        discrepanciesCount: 1,
        discrepancies: [{ type: 'x' }]
      }
    }));

    // Verify only one collection was accessed for writes
    const writeCollections = mockDb.collection.mock.calls.map(c => c[0]);
    expect(writeCollections).toContain('system_reports_outbox');
    expect(writeCollections).not.toContain('system_health_checks');
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Missing snapshot → no-op
// ═══════════════════════════════════════════════════════════════

describe('E. Missing snapshot', () => {
  test('event.data is null → no outbox write', async () => {
    await registeredHandler({ params: { docId: 'hc1' }, data: null });
    expect(mockOutboxAdd).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Edge — FAIL with count 0
// ═══════════════════════════════════════════════════════════════

describe('F. Edge cases', () => {
  // PR-IG-A1 (2026-07-22) BEHAVIORAL CHANGE: these two scenarios previously
  // asserted "no outbox write" — that was exactly the silent-failure defect
  // this PR closes (a FAIL with 0 discrepancies, and every ERROR, used to be
  // invisible to the WhatsApp channel). Flipped to assert emission.
  test('status FAIL but discrepanciesCount 0 → outbox write (PR-IG-A1: previously silent)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        discrepanciesCount: 0,
        discrepancies: []
      }
    }));
    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.healthCheckStatus).toBe('FAIL');
    expect(payload.severity).toBe('warning');
  });

  test('status ERROR → outbox write with critical severity (PR-IG-A1: previously silent)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'ERROR',
        discrepanciesCount: 0,
        discrepancies: [],
        message: 'שגיאה'
      }
    }));
    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.healthCheckStatus).toBe('ERROR');
    expect(payload.severity).toBe('critical');
    expect(payload.healthCheckMessage).toBe('שגיאה');
  });

  test('status PARTIAL → outbox write with warning severity (PR-IG-A1: new status)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'PARTIAL',
        discrepanciesCount: 0,
        discrepancies: [],
        clientsErrored: 3,
        clientsChecked: 10,
        clientsTotal: 13
      }
    }));
    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.healthCheckStatus).toBe('PARTIAL');
    expect(payload.severity).toBe('warning');
    expect(payload.clientsErrored).toBe(3);
    expect(payload.clientsChecked).toBe(10);
    expect(payload.clientsTotal).toBe(13);
  });

  test('status PASS → no outbox write (unchanged)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'PASS',
        discrepanciesCount: 0,
        discrepancies: []
      }
    }));
    expect(mockOutboxAdd).not.toHaveBeenCalled();
  });

  test('discrepanciesCount missing → falls back to discrepancies.length', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        // discrepanciesCount intentionally missing
        discrepancies: [{ type: 'x' }, { type: 'y' }]
      }
    }));
    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    expect(mockOutboxAdd.mock.calls[0][0].discrepanciesCount).toBe(2);
  });
});
