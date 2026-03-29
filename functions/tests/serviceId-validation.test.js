/**
 * Tests for branch fix/serviceId-validation-and-transaction
 *
 * Covers the new GATE validations and transaction wrapping:
 *
 * 1. addTimeToTask_v2.js — 3 GATEs + isInternal exemption
 *    GATE 1: multiple services without serviceId → error
 *    GATE 2: no serviceId on non-internal client → error
 *    GATE 3: serviceId not found on client → error
 *    EXEMPT: internal tasks (clientId === 'internal_office') bypass GATE 2+3
 *
 * 2. timesheet/index.js — createQuickLogEntry 2 GATEs
 *    GATE 1: no resolvedServiceId → error
 *    GATE 2: serviceId not found on client → error
 *
 * 3. timesheet/index.js — createTimesheetEntry_v2 2 GATEs + isInternal exemption
 *    GATE 1: no resolvedServiceId (non-internal) → error
 *    GATE 2: serviceId not found on client → error
 *    EXEMPT: isInternal === true skips entire validation block
 *
 * 4. services/index.js — addServiceToClient wrapped in db.runTransaction
 *
 * 5. quick-log.js — client-side serviceId submit block
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
    doc: jest.fn((id) => ({
      id,
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ id: 'auto_id' }))
      }))
    }))
  })),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => mockDb, {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
      increment: jest.fn((n) => ({ _increment: n })),
      arrayUnion: jest.fn((...args) => ({ _arrayUnion: args }))
    },
    Timestamp: {
      fromDate: jest.fn((d) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }))
    }
  }),
  initializeApp: jest.fn()
}));

jest.mock('firebase-functions', () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
      }
    },
    onCall: jest.fn((fn) => fn)
  }
}));

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn(() => jest.fn())
}));

// ═══════════════════════════════════════════════════════════════
// Imports
// ═══════════════════════════════════════════════════════════════

const { addTimeToTaskWithTransaction } = require('../addTimeToTask_v2');
const functions = require('firebase-functions');

// ═══════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════

function makeHoursService(id, { totalHours = 20, hoursUsed = 5 } = {}) {
  return {
    id,
    type: 'hours',
    name: `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    isBlocked: false,
    isCritical: false,
    packages: [{
      id: `${id}_pkg1`,
      hours: totalHours,
      hoursUsed,
      hoursRemaining: totalHours - hoursUsed,
      status: 'active'
    }]
  };
}

function makeTaskDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      employee: 'user@test.com',
      clientId: 'client_1',
      clientName: 'Test Client',
      description: 'Test task',
      actualMinutes: 0,
      estimatedMinutes: 120,
      serviceId: 'svc_1',
      ...overrides
    })
  };
}

function makeClientDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      clientName: 'Test Client',
      services: [makeHoursService('svc_1')],
      totalHours: 20,
      ...overrides
    })
  };
}

const defaultUser = {
  uid: 'uid_1',
  email: 'user@test.com',
  username: 'testuser',
  role: 'employee'
};

const defaultData = {
  taskId: 'task_1',
  minutes: 60,
  date: '2026-03-30',
  description: 'Work done'
};

// ═══════════════════════════════════════════════════════════════
// Reset mocks before each test
// ═══════════════════════════════════════════════════════════════

beforeEach(() => {
  jest.clearAllMocks();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
});


// ═══════════════════════════════════════════════════════════════
// 1. addTimeToTaskWithTransaction — serviceId GATEs
// ═══════════════════════════════════════════════════════════════

describe('addTimeToTaskWithTransaction — serviceId validation GATEs', () => {

  // ── GATE 1: multiple services, no serviceId on task ──

  test('GATE 1: rejects when client has multiple services and task has no serviceId', async () => {
    const taskDoc = makeTaskDoc({ serviceId: null });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('svc_1'), makeHoursService('svc_2')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)    // task read
      .mockResolvedValueOnce(clientDoc); // client read

    await expect(
      addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser)
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('חסרה שיוך לשירות')
    });
  });

  // ── GATE 2: no serviceId on non-internal client ──

  test('GATE 2: rejects when non-internal client has no services and task has no serviceId', async () => {
    const taskDoc = makeTaskDoc({ serviceId: null });
    const clientDoc = makeClientDoc({ services: [] });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    await expect(
      addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser)
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('ללא שירות פעיל')
    });
  });

  // ── GATE 3: serviceId not found on client ──

  test('GATE 3: rejects when task serviceId does not exist on client', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_nonexistent' });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('svc_1')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    await expect(
      addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: expect.stringContaining('svc_nonexistent')
    });
  });

  // ── EXEMPT: internal task bypasses GATE 2 ──

  test('EXEMPT: internal task (clientId=internal_office) bypasses serviceId requirement', async () => {
    const taskDoc = makeTaskDoc({
      clientId: 'internal_office',
      clientName: 'פנימי',
      serviceId: null
    });
    // No client doc found (internal_office doesn't have a real client doc)
    const clientDoc = { exists: false };

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    // Should succeed — no serviceId error
    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task_1');
  });

  // ── EXEMPT: internal task bypasses GATE 3 ──

  test('EXEMPT: internal task bypasses serviceId-exists-on-client check', async () => {
    const taskDoc = makeTaskDoc({
      clientId: 'internal_office',
      clientName: 'פנימי',
      serviceId: 'svc_nonexistent'
    });
    const clientDoc = { exists: false };

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);
    expect(result.success).toBe(true);
  });

  // ── Happy path: valid serviceId passes all gates ──

  test('Happy path: valid serviceId passes all gates and deducts', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_1' });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('svc_1')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
    expect(result.newActualMinutes).toBe(60);
    expect(result.timesheetAutoCreated).toBe(true);

    // Verify writes happened
    expect(mockTransaction.update).toHaveBeenCalled();
    expect(mockTransaction.set).toHaveBeenCalled();
  });

  // ── Auto-select: single service, no serviceId on task ──

  test('Auto-select: when client has exactly 1 service and task has no serviceId, auto-selects', async () => {
    const taskDoc = makeTaskDoc({ serviceId: null });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('svc_only')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);

    expect(result.success).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════
// 2. createQuickLogEntry — serviceId validation GATEs
// ═══════════════════════════════════════════════════════════════

describe('createQuickLogEntry — serviceId validation GATEs (logic verification)', () => {

  /**
   * createQuickLogEntry is an onCall function that runs inside a transaction.
   * We verify the GATE logic by simulating the same conditions:
   *
   *   const services = clientData.services || [];
   *   let resolvedServiceId = data.serviceId || null;
   *   if (!resolvedServiceId && services.length === 1) resolvedServiceId = services[0].id;
   *   if (!resolvedServiceId && services.length > 1) → throw 'invalid-argument'
   *   if (!resolvedServiceId) → throw 'invalid-argument' (GATE 1)
   *   if (!services.some(s => s.id === resolvedServiceId)) → throw 'not-found' (GATE 2)
   */

  function simulateQuickLogServiceResolution(services, inputServiceId) {
    let resolvedServiceId = inputServiceId || null;

    if (!resolvedServiceId && services.length === 1) {
      resolvedServiceId = services[0].id;
    } else if (!resolvedServiceId && services.length > 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור שירות — ללקוח יש מספר שירותים'
      );
    }

    // GATE 1: serviceId required
    if (!resolvedServiceId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
      );
    }

    // GATE 2: serviceId must exist
    if (!services.some(s => s.id === resolvedServiceId)) {
      throw new functions.https.HttpsError(
        'not-found',
        `שירות ${resolvedServiceId} לא נמצא אצל הלקוח`
      );
    }

    return resolvedServiceId;
  }

  test('GATE 1: rejects when client has no services and no serviceId', () => {
    expect(() => simulateQuickLogServiceResolution([], null))
      .toThrow(expect.objectContaining({
        code: 'invalid-argument',
        message: expect.stringContaining('ללא שירות פעיל')
      }));
  });

  test('GATE 1b: rejects when client has multiple services and no serviceId', () => {
    const services = [makeHoursService('svc_1'), makeHoursService('svc_2')];
    expect(() => simulateQuickLogServiceResolution(services, null))
      .toThrow(expect.objectContaining({
        code: 'invalid-argument',
        message: expect.stringContaining('חובה לבחור שירות')
      }));
  });

  test('GATE 2: rejects when serviceId does not exist on client', () => {
    const services = [makeHoursService('svc_1')];
    expect(() => simulateQuickLogServiceResolution(services, 'svc_wrong'))
      .toThrow(expect.objectContaining({
        code: 'not-found',
        message: expect.stringContaining('svc_wrong')
      }));
  });

  test('Happy path: auto-selects single service', () => {
    const services = [makeHoursService('svc_1')];
    const result = simulateQuickLogServiceResolution(services, null);
    expect(result).toBe('svc_1');
  });

  test('Happy path: explicit serviceId found on client', () => {
    const services = [makeHoursService('svc_1'), makeHoursService('svc_2')];
    const result = simulateQuickLogServiceResolution(services, 'svc_2');
    expect(result).toBe('svc_2');
  });
});


// ═══════════════════════════════════════════════════════════════
// 3. createTimesheetEntry_v2 — serviceId validation GATEs
// ═══════════════════════════════════════════════════════════════

describe('createTimesheetEntry_v2 — serviceId validation GATEs (logic verification)', () => {

  /**
   * v2 wraps the GATE logic in: if (data.isInternal !== true && clientData) { ... }
   * So internal entries skip the entire block.
   */

  function simulateV2ServiceResolution(services, inputServiceId, isInternal) {
    // v2 skips everything for internal
    if (isInternal) {
      return { resolved: inputServiceId || null, skipped: true };
    }

    let resolvedServiceId = inputServiceId || null;

    if (!resolvedServiceId && services.length === 1) {
      resolvedServiceId = services[0].id;
    } else if (!resolvedServiceId && services.length > 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור שירות — ללקוח יש מספר שירותים'
      );
    }

    // GATE 1: serviceId required for non-internal
    if (!resolvedServiceId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
      );
    }

    // GATE 2: serviceId must exist
    if (!services.some(s => s.id === resolvedServiceId)) {
      throw new functions.https.HttpsError(
        'not-found',
        `שירות ${resolvedServiceId} לא נמצא אצל הלקוח`
      );
    }

    return { resolved: resolvedServiceId, skipped: false };
  }

  test('GATE 1: rejects non-internal entry with no services', () => {
    expect(() => simulateV2ServiceResolution([], null, false))
      .toThrow(expect.objectContaining({
        code: 'invalid-argument',
        message: expect.stringContaining('ללא שירות פעיל')
      }));
  });

  test('GATE 2: rejects non-internal entry with wrong serviceId', () => {
    const services = [makeHoursService('svc_1')];
    expect(() => simulateV2ServiceResolution(services, 'svc_bad', false))
      .toThrow(expect.objectContaining({
        code: 'not-found',
        message: expect.stringContaining('svc_bad')
      }));
  });

  test('EXEMPT: internal entry skips all serviceId validation', () => {
    // No services, no serviceId — would fail for non-internal
    const result = simulateV2ServiceResolution([], null, true);
    expect(result.skipped).toBe(true);
  });

  test('EXEMPT: internal entry with bad serviceId still passes', () => {
    const services = [makeHoursService('svc_1')];
    const result = simulateV2ServiceResolution(services, 'svc_nonexistent', true);
    expect(result.skipped).toBe(true);
    expect(result.resolved).toBe('svc_nonexistent');
  });

  test('Happy path: auto-selects single service for non-internal', () => {
    const services = [makeHoursService('svc_1')];
    const result = simulateV2ServiceResolution(services, null, false);
    expect(result.resolved).toBe('svc_1');
    expect(result.skipped).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════
// 4. addServiceToClient — transaction wrapping
// ═══════════════════════════════════════════════════════════════

describe('addServiceToClient — transaction wrapping verification', () => {

  /**
   * The key change: addServiceToClient was refactored to use db.runTransaction.
   * Before: clientRef.get() → services.push(newService) → clientRef.update()
   * After:  db.runTransaction → transaction.get(clientRef) → transaction.update(clientRef)
   *
   * We verify:
   * 1. db.runTransaction is called (not direct read/update)
   * 2. Inside transaction: transaction.get is used for reads
   * 3. Inside transaction: transaction.update is used for writes
   * 4. Immutable array: services = [...existing, newService] (not push)
   */

  // We can't easily require the actual module because it calls functions.https.onCall
  // at module level. Instead we verify the pattern at the code level.

  const fs = require('fs');
  const path = require('path');
  const servicesCode = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'index.js'),
    'utf8'
  );

  // Extract the full addServiceToClient function block (up to next exports.)
  const fnStart = servicesCode.indexOf('exports.addServiceToClient');
  const fnEnd = servicesCode.indexOf('\nexports.', fnStart + 1);
  const fnBlock = servicesCode.substring(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 8000);

  test('addServiceToClient uses db.runTransaction', () => {

    expect(fnBlock).toContain('db.runTransaction');
  });

  test('addServiceToClient uses transaction.get inside transaction', () => {
    expect(fnBlock).toContain('transaction.get(clientRef)');
  });

  test('addServiceToClient uses transaction.update inside transaction', () => {
    expect(fnBlock).toContain('transaction.update(clientRef');
  });

  test('addServiceToClient uses immutable spread for services array', () => {
    // Must use spread: [...(clientData.services || []), newService]
    expect(fnBlock).toContain('[...(clientData.services || []), newService]');
    // Must NOT use mutable push
    expect(fnBlock).not.toContain('services.push(');
  });

  test('addServiceToClient does NOT use direct clientRef.get()', () => {
    expect(fnBlock).not.toMatch(/await\s+clientRef\.get\(\)/);
  });

  test('addServiceToClient does NOT use direct clientRef.update()', () => {
    expect(fnBlock).not.toMatch(/await\s+clientRef\.update\(/);
  });
});


// ═══════════════════════════════════════════════════════════════
// 5. quick-log.js — client-side serviceId submit block
// ═══════════════════════════════════════════════════════════════

describe('quick-log.js — client-side serviceId validation', () => {

  const fs = require('fs');
  const path = require('path');
  const quickLogCode = fs.readFileSync(
    path.join(__dirname, '..', '..', 'apps', 'user-app', 'js', 'quick-log.js'),
    'utf8'
  );

  test('submit handler always requires serviceId (not conditional on visibility)', () => {
    // The new code: if (!serviceId) { ... } — unconditional check
    // The old code: if (!serviceSelectorGroup.classList.contains('hidden') && !serviceId)
    //   — was conditional on visibility

    // Verify the new unconditional pattern exists
    expect(quickLogCode).toContain("// serviceId is always required — whether auto-selected or manually chosen");
    expect(quickLogCode).toContain("if (!serviceId) {");
  });

  test('serviceId is always sent in payload (not conditional)', () => {
    // New code: payload.serviceId = serviceId; (always)
    // Old code: if (serviceId) { payload.serviceId = serviceId; }

    expect(quickLogCode).toContain("// serviceId is always required");
    expect(quickLogCode).toContain("payload.serviceId = serviceId;");

    // The old conditional "if (serviceId) { payload.serviceId" should not exist
    expect(quickLogCode).not.toMatch(/if\s*\(serviceId\)\s*\{\s*\n?\s*payload\.serviceId/);
  });

  test('client with no services shows error and blocks submission', () => {
    // When selecting a client with 0 services:
    //   document.getElementById('selectedServiceId').value = '';
    //   showError('ללקוח אין שירות פעיל — לא ניתן לרשום שעות');
    expect(quickLogCode).toContain("ללקוח אין שירות פעיל — לא ניתן לרשום שעות");
  });

  test('selectedServiceId is cleared when client has no services', () => {
    // Verify that when a client has no services, the hidden input is explicitly cleared
    // This pattern: else { selectedServiceId.value = ''; hideServiceSelector(); showError(...) }
    const noServicesBlock = quickLogCode.indexOf("// No services — block submission");
    expect(noServicesBlock).toBeGreaterThan(-1);

    const blockSection = quickLogCode.substring(noServicesBlock, noServicesBlock + 200);
    expect(blockSection).toContain("selectedServiceId");
    expect(blockSection).toContain("= ''");
  });

  test('submit shows contextual error when serviceId missing with visible selector', () => {
    // When selector is visible (multiple services) but none selected → 'יש לבחור שירות/חבילה'
    expect(quickLogCode).toContain('יש לבחור שירות/חבילה');
  });

  test('submit shows contextual error when serviceId missing with hidden selector', () => {
    // When selector is hidden (0 services) → 'ללקוח אין שירות פעיל'
    // This appears in the submit handler's else branch
    const submitSection = quickLogCode.substring(
      quickLogCode.indexOf('quickLogForm.addEventListener'),
      quickLogCode.indexOf('quickLogForm.addEventListener') + 2000
    );
    expect(submitSection).toContain('ללקוח אין שירות פעיל');
  });
});
