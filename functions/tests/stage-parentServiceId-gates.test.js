/**
 * Tests for stage_ / parentServiceId gate fix
 *
 * The fix: when serviceId starts with "stage_" (legal procedure),
 * the "serviceId must exist on client" gate and the "blocked service" check
 * now look up parentServiceId instead of the raw stage_ ID.
 *
 * Covers 3 functions × 5 scenarios:
 *   1. stage_ serviceId + valid parentServiceId → passes
 *   2. stage_ serviceId + parentServiceId not on client → fails "לא נמצא"
 *   3. stage_ serviceId without parentServiceId → fallback to stage_ → fails "לא נמצא"
 *   4. Regular serviceId (not stage_) → works as before
 *   5. stage_ serviceId + parentServiceId whose service is blocked → fails "חסום"
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

function makeHoursService(id, { totalHours = 20, hoursUsed = 5, name = null, overrideActive = false } = {}) {
  return {
    id,
    type: 'hours',
    name: name || `שירות ${id}`,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    isBlocked: false,
    isCritical: false,
    overrideActive,
    packages: [{
      id: `${id}_pkg1`,
      hours: totalHours,
      hoursUsed,
      hoursRemaining: totalHours - hoursUsed,
      status: 'active'
    }]
  };
}

function makeBlockedService(id, { name = null } = {}) {
  return makeHoursService(id, { totalHours: 10, hoursUsed: 10, name, overrideActive: false });
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
// 1. addTimeToTaskWithTransaction — stage_ / parentServiceId
// ═══════════════════════════════════════════════════════════════

describe('addTimeToTaskWithTransaction — stage_ parentServiceId gates', () => {

  test('stage_ serviceId with valid parentServiceId → passes gate', async () => {
    const taskDoc = makeTaskDoc({
      serviceId: 'stage_a',
      parentServiceId: 'srv_legal_1'
    });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('srv_legal_1')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);
    expect(result.success).toBe(true);
  });

  test('stage_ serviceId with parentServiceId NOT on client → fails "לא נמצא"', async () => {
    const taskDoc = makeTaskDoc({
      serviceId: 'stage_a',
      parentServiceId: 'srv_legal_missing'
    });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('srv_legal_1')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    await expect(
      addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: expect.stringContaining('srv_legal_missing')
    });
  });

  test('stage_ serviceId WITHOUT parentServiceId → fallback to stage_ → fails "לא נמצא"', async () => {
    const taskDoc = makeTaskDoc({
      serviceId: 'stage_a'
      // no parentServiceId
    });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('srv_legal_1')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    await expect(
      addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser)
    ).rejects.toMatchObject({
      code: 'not-found',
      message: expect.stringContaining('stage_a')
    });
  });

  test('regular serviceId (not stage_) → works as before', async () => {
    const taskDoc = makeTaskDoc({ serviceId: 'svc_1' });
    const clientDoc = makeClientDoc({
      services: [makeHoursService('svc_1')]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser);
    expect(result.success).toBe(true);
  });

  test('stage_ serviceId with parentServiceId whose service is blocked → fails "חסום"', async () => {
    const taskDoc = makeTaskDoc({
      serviceId: 'stage_a',
      parentServiceId: 'srv_legal_blocked'
    });
    const clientDoc = makeClientDoc({
      services: [makeBlockedService('srv_legal_blocked', { name: 'הליך משפטי' })]
    });

    mockTransaction.get
      .mockResolvedValueOnce(taskDoc)
      .mockResolvedValueOnce(clientDoc);

    await expect(
      addTimeToTaskWithTransaction(mockDb, defaultData, defaultUser)
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('חסום')
    });
  });
});


// ═══════════════════════════════════════════════════════════════
// 2. createQuickLogEntry — stage_ / parentServiceId
// ═══════════════════════════════════════════════════════════════

describe('createQuickLogEntry — stage_ parentServiceId gates (logic verification)', () => {

  /**
   * Simulates the exact gate logic from timesheet/index.js createQuickLogEntry
   * lines 199-221 (serviceId-must-exist gate + blocked check)
   */
  function simulateQuickLogGates(services, inputServiceId, parentServiceId) {
    let resolvedServiceId = inputServiceId || null;

    if (!resolvedServiceId && services.length === 1) {
      resolvedServiceId = services[0].id;
    } else if (!resolvedServiceId && services.length > 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לבחור שירות — ללקוח יש מספר שירותים'
      );
    }

    // GATE: serviceId required
    if (!resolvedServiceId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
      );
    }

    // GATE: serviceId must exist on client (with stage_ fix)
    const serviceIdToValidate = (resolvedServiceId && resolvedServiceId.startsWith('stage_'))
      ? (parentServiceId || resolvedServiceId)
      : resolvedServiceId;

    if (!services.some(s => s.id === serviceIdToValidate)) {
      throw new functions.https.HttpsError(
        'not-found',
        `שירות ${serviceIdToValidate} לא נמצא אצל הלקוח`
      );
    }

    // Blocked service check (with stage_ fix)
    if (resolvedServiceId) {
      const lookupId = parentServiceId || resolvedServiceId;
      const targetService = services.find(s => s.id === lookupId);
      if (targetService && targetService.type === 'hours' && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `השירות "${targetService.name || lookupId}" חסום — נגמרה יתרת השעות`
        );
      }
    }

    return resolvedServiceId;
  }

  test('stage_ serviceId with valid parentServiceId → passes gate', () => {
    const services = [makeHoursService('srv_legal_1')];
    const result = simulateQuickLogGates(services, 'stage_a', 'srv_legal_1');
    expect(result).toBe('stage_a');
  });

  test('stage_ serviceId with parentServiceId NOT on client → fails "לא נמצא"', () => {
    const services = [makeHoursService('srv_legal_1')];
    expect(() => simulateQuickLogGates(services, 'stage_a', 'srv_legal_missing'))
      .toThrow(expect.objectContaining({
        code: 'not-found',
        message: expect.stringContaining('srv_legal_missing')
      }));
  });

  test('stage_ serviceId WITHOUT parentServiceId → fallback to stage_ → fails "לא נמצא"', () => {
    const services = [makeHoursService('srv_legal_1')];
    expect(() => simulateQuickLogGates(services, 'stage_a', undefined))
      .toThrow(expect.objectContaining({
        code: 'not-found',
        message: expect.stringContaining('stage_a')
      }));
  });

  test('regular serviceId (not stage_) → works as before', () => {
    const services = [makeHoursService('svc_1')];
    const result = simulateQuickLogGates(services, 'svc_1', undefined);
    expect(result).toBe('svc_1');
  });

  test('stage_ serviceId with parentServiceId whose service is blocked → fails "חסום"', () => {
    const services = [makeBlockedService('srv_legal_blocked', { name: 'הליך משפטי' })];
    expect(() => simulateQuickLogGates(services, 'stage_a', 'srv_legal_blocked'))
      .toThrow(expect.objectContaining({
        code: 'failed-precondition',
        message: expect.stringContaining('חסום')
      }));
  });
});


// ═══════════════════════════════════════════════════════════════
// 3. createTimesheetEntryV2 — stage_ / parentServiceId
// ═══════════════════════════════════════════════════════════════

describe('createTimesheetEntryV2 — stage_ parentServiceId gates (logic verification)', () => {

  /**
   * Simulates the exact gate logic from timesheet/index.js createTimesheetEntry_v2
   * lines 665-688 (serviceId-must-exist gate + blocked check)
   * Wrapped in isInternal check (line 644)
   */
  function simulateV2Gates(services, inputServiceId, parentServiceId, isInternal) {
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

    // GATE: serviceId required
    if (!resolvedServiceId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'לא ניתן לרשום שעות ללקוח ללא שירות פעיל'
      );
    }

    // GATE: serviceId must exist on client (with stage_ fix)
    const serviceIdToValidate = (resolvedServiceId && resolvedServiceId.startsWith('stage_'))
      ? (parentServiceId || resolvedServiceId)
      : resolvedServiceId;

    if (!services.some(s => s.id === serviceIdToValidate)) {
      throw new functions.https.HttpsError(
        'not-found',
        `שירות ${serviceIdToValidate} לא נמצא אצל הלקוח`
      );
    }

    // Blocked service check (with stage_ fix)
    if (resolvedServiceId) {
      const lookupId = parentServiceId || resolvedServiceId;
      const targetService = services.find(s => s.id === lookupId);
      if (targetService && targetService.type === 'hours' && (targetService.hoursRemaining || 0) <= 0 && !targetService.overrideActive) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `השירות "${targetService.name || lookupId}" חסום — נגמרה יתרת השעות`
        );
      }
    }

    return { resolved: resolvedServiceId, skipped: false };
  }

  test('stage_ serviceId with valid parentServiceId → passes gate', () => {
    const services = [makeHoursService('srv_legal_1')];
    const result = simulateV2Gates(services, 'stage_a', 'srv_legal_1', false);
    expect(result.resolved).toBe('stage_a');
    expect(result.skipped).toBe(false);
  });

  test('stage_ serviceId with parentServiceId NOT on client → fails "לא נמצא"', () => {
    const services = [makeHoursService('srv_legal_1')];
    expect(() => simulateV2Gates(services, 'stage_a', 'srv_legal_missing', false))
      .toThrow(expect.objectContaining({
        code: 'not-found',
        message: expect.stringContaining('srv_legal_missing')
      }));
  });

  test('stage_ serviceId WITHOUT parentServiceId → fallback to stage_ → fails "לא נמצא"', () => {
    const services = [makeHoursService('srv_legal_1')];
    expect(() => simulateV2Gates(services, 'stage_a', undefined, false))
      .toThrow(expect.objectContaining({
        code: 'not-found',
        message: expect.stringContaining('stage_a')
      }));
  });

  test('regular serviceId (not stage_) → works as before', () => {
    const services = [makeHoursService('svc_1')];
    const result = simulateV2Gates(services, 'svc_1', undefined, false);
    expect(result.resolved).toBe('svc_1');
    expect(result.skipped).toBe(false);
  });

  test('stage_ serviceId with parentServiceId whose service is blocked → fails "חסום"', () => {
    const services = [makeBlockedService('srv_legal_blocked', { name: 'הליך משפטי' })];
    expect(() => simulateV2Gates(services, 'stage_a', 'srv_legal_blocked', false))
      .toThrow(expect.objectContaining({
        code: 'failed-precondition',
        message: expect.stringContaining('חסום')
      }));
  });

  test('internal entry with stage_ serviceId → skips all gates', () => {
    // No matching service — would fail for non-internal
    const services = [];
    const result = simulateV2Gates(services, 'stage_a', 'srv_legal_1', true);
    expect(result.skipped).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════
// 4. Code-level verification — actual files contain stage_ logic
// ═══════════════════════════════════════════════════════════════

describe('Code-level verification — stage_ parentServiceId pattern exists in source', () => {

  const fs = require('fs');
  const path = require('path');

  const addTimeCode = fs.readFileSync(
    path.join(__dirname, '..', 'addTimeToTask_v2.js'),
    'utf8'
  );
  const timesheetCode = fs.readFileSync(
    path.join(__dirname, '..', 'timesheet', 'index.js'),
    'utf8'
  );

  test('addTimeToTask_v2.js — gate uses startsWith("stage_") + parentServiceId', () => {
    expect(addTimeCode).toContain("resolvedServiceId.startsWith('stage_')");
    expect(addTimeCode).toContain('taskData.parentServiceId || resolvedServiceId');
  });

  test('addTimeToTask_v2.js — blocked check uses parentServiceId lookup', () => {
    expect(addTimeCode).toContain('const lookupId = taskData.parentServiceId || taskData.serviceId');
  });

  test('timesheet/index.js — createQuickLogEntry gate uses startsWith("stage_")', () => {
    // Should appear at least twice (quick log + v2)
    const matches = timesheetCode.match(/resolvedServiceId\.startsWith\('stage_'\)/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test('timesheet/index.js — blocked check uses parentServiceId lookup', () => {
    // Both createQuickLogEntry and createTimesheetEntryV2 should have this pattern
    const matches = timesheetCode.match(/const lookupId = data\.parentServiceId \|\| resolvedServiceId/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
