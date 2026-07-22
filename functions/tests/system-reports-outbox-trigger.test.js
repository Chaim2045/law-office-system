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
 *   G. PR-IG-A1-FIX1 workaround REMOVED (2026-07-22 follow-up) — the outbox
 *      `discrepancies` array is now exactly what the health-check document
 *      held, on every status. The deployed bot formatter now reads the
 *      census fields directly (hachnasovitz/system-reports/formatter.js,
 *      live) — no synthetic entry is needed, and this suite asserts its
 *      absence, plus that the fields the live bot depends on are present.
 *   H. PR-IG-A1-FIX6 — healthCheckStatus guard on a missing/undefined status
 *   I. PR-IG-A1-FIX5 — clientsScanErroredIds passthrough (capped, no names)
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
        clientsScanErrored: 3,
        clientsScanChecked: 10,
        clientsTotal: 13
      }
    }));
    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.healthCheckStatus).toBe('PARTIAL');
    expect(payload.severity).toBe('warning');
    expect(payload.clientsScanErrored).toBe(3);
    expect(payload.clientsScanChecked).toBe(10);
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

  test('discrepanciesCount missing, status FAIL → falls back to discrepancies.length (no synthetic entry added on FAIL)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        // discrepanciesCount intentionally missing
        discrepancies: [{ type: 'x' }, { type: 'y' }]
      }
    }));
    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.discrepanciesCount).toBe(2);
    expect(payload.discrepancies.length).toBe(2); // no scan_incomplete appended
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Synthetic scan_incomplete workaround REMOVED (2026-07-22 follow-up)
//
// The bot-side fix (hachnasovitz/system-reports/formatter.js) is deployed
// and reads healthCheckStatus/healthCheckMessage/clientsScanChecked/
// clientsScanErrored/clientsTotal directly, so this trigger no longer needs
// to inject anything into `discrepancies[]` to make a PARTIAL/ERROR run
// render truthfully. These tests assert the ABSENCE of the synthetic entry
// (inverted from the pre-removal versions, which asserted its presence —
// see git history on this file for the prior assertions) and that the
// fields the live bot now depends on are present and correctly populated.
// ═══════════════════════════════════════════════════════════════

describe('G. scan_incomplete workaround removed', () => {
  test('PARTIAL run → outbox discrepancies equals the health-check document\'s array exactly (no synthetic entry)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'PARTIAL',
        discrepanciesCount: 0,
        discrepancies: [],
        clientsScanErrored: 3,
        clientsScanChecked: 10,
        clientsTotal: 13,
        message: 'הבדיקה הושלמה חלקית'
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.discrepancies).toEqual([]);
    expect(payload.discrepancies.some((d) => d.type === 'scan_incomplete')).toBe(false);
    expect(payload.discrepanciesCount).toBe(0);

    // Most important: the fields the live bot's formatter reads directly are
    // present and correctly populated — dropping any of these silently
    // breaks the deployed bot.
    expect(payload.healthCheckStatus).toBe('PARTIAL');
    expect(payload.healthCheckMessage).toBe('הבדיקה הושלמה חלקית');
    expect(payload.clientsScanChecked).toBe(10);
    expect(payload.clientsScanErrored).toBe(3);
    expect(payload.clientsTotal).toBe(13);
  });

  test('ERROR run → outbox discrepancies equals the health-check document\'s array exactly (no synthetic entry)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'ERROR',
        discrepanciesCount: 0,
        discrepancies: [],
        message: 'שגיאה בבדיקת תקינות: firestore is down'
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.discrepancies).toEqual([]);
    expect(payload.discrepancies.some((d) => d.type === 'scan_incomplete')).toBe(false);
    expect(payload.discrepanciesCount).toBe(0);

    // Fields the live bot depends on for the ERROR render.
    expect(payload.healthCheckStatus).toBe('ERROR');
    expect(payload.healthCheckMessage).toBe('שגיאה בבדיקת תקינות: firestore is down');
  });

  test('PARTIAL-with-discrepancies → discrepancies array is byte-identical to the source (no injection)', async () => {
    const realDiscrepancies = [
      { type: 'aggregate_drift', clientId: 'c2', clientName: 'לקוח שני', driftFields: [] }
    ];
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'PARTIAL',
        discrepanciesCount: 1,
        discrepancies: realDiscrepancies,
        clientsScanErrored: 1,
        clientsScanChecked: 1,
        clientsTotal: 2
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.discrepanciesCount).toBe(1);
    expect(payload.discrepancies).toEqual(realDiscrepancies);
    expect(payload.discrepancies.length).toBe(1);
  });

  test('genuine FAIL run → outbox payload is UNCHANGED (regression guard on the working path)', async () => {
    const realDiscrepancies = [
      { type: 'aggregate_drift', clientId: 'c1', clientName: 'לקוח טסט', driftFields: [] },
      { type: 'package_drift', clientId: 'c2', clientName: 'לקוח שני', serviceId: 'svc1', totalHours: 10, sumPkgHours: 8, drift: 2 }
    ];
    await registeredHandler(makeEvent({
      docId: 'hc_regression',
      data: {
        type: 'invariant_check',
        status: 'FAIL',
        discrepanciesCount: 2,
        discrepancies: realDiscrepancies
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.discrepancies).toEqual(realDiscrepancies);
    expect(payload.discrepancies.length).toBe(2);
    expect(payload.discrepanciesCount).toBe(2);
  });

  test('discrepanciesCount still carries the true total, unaffected by removal', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'ERROR',
        discrepanciesCount: 0,
        discrepancies: [],
        clientsScanErrored: 5,
        clientsScanChecked: 0,
        clientsTotal: 5
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    // Zero discrepancies is the TRUE total here (the run crashed before
    // finding any data discrepancy) — discrepanciesCount reports it exactly,
    // with no inflation from a synthetic entry.
    expect(payload.discrepanciesCount).toBe(0);
    expect(payload.discrepancies).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// H. PR-IG-A1-FIX6 — healthCheckStatus guard
// ═══════════════════════════════════════════════════════════════

describe('H. FIX6 — healthCheckStatus guard', () => {
  test('a missing/undefined status does not reject the write — guarded to null like its siblings', async () => {
    // status undefined is neither 'PASS' nor 'FAIL', so the trigger proceeds
    // (this mirrors real fail-open behavior — an undefined status is itself
    // an anomaly worth alerting on, not a reason to stay silent).
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        discrepanciesCount: 0,
        discrepancies: []
        // status intentionally omitted
      }
    }));

    expect(mockOutboxAdd).toHaveBeenCalledTimes(1);
    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.healthCheckStatus).toBeNull();
    // The call must not have thrown/rejected — proven by reaching this line
    // and by attempts/status still being written correctly.
    expect(payload.status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════
// I. PR-IG-A1-FIX5 — clientsScanErroredIds passthrough
// ═══════════════════════════════════════════════════════════════

describe('I. FIX5 — clientsScanErroredIds passthrough', () => {
  test('capped id list is forwarded to the outbox doc, ids only, no names', async () => {
    const ids = ['2025001', '2025002', '2025003'];
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'PARTIAL',
        discrepanciesCount: 0,
        discrepancies: [],
        clientsScanErrored: 3,
        clientsScanChecked: 10,
        clientsTotal: 13,
        clientsScanErroredIds: ids
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.clientsScanErroredIds).toEqual(ids);
    // Ids only — every entry is a plain client-id string, never an object
    // carrying a name/email.
    payload.clientsScanErroredIds.forEach((id) => expect(typeof id).toBe('string'));
  });

  test('missing clientsScanErroredIds → defaults to an empty array (does not reject)', async () => {
    await registeredHandler(makeEvent({
      data: {
        type: 'invariant_check',
        status: 'ERROR',
        discrepanciesCount: 0,
        discrepancies: []
      }
    }));

    const payload = mockOutboxAdd.mock.calls[0][0];
    expect(payload.clientsScanErroredIds).toEqual([]);
  });
});
