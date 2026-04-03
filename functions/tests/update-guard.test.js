/**
 * Tests for -10h overdraft guard on UPDATE path.
 *
 * updateTimesheetEntry callable (timesheet/index.js)
 * — when minutes INCREASE, guard checks if delta would push
 *   the package below -10h and throws resource-exhausted.
 * — when minutes DECREASE or stay the same, guard is skipped.
 *
 * Covers:
 *   1. hours service — increase blocked when afterDeduction < -10
 *   2. hours service — increase allowed when afterDeduction >= -10
 *   3. hours service — decrease always allowed (no guard)
 *   4. hours service — boundary at exactly -10 (passes)
 *   5. legal_procedure service — increase blocked
 *   6. legal_procedure service — fixed pricing skips guard
 *   7. no client doc — guard skipped gracefully
 *   8. no packageId on entry — falls back to active package
 *   9. same minutes (no change) — guard skipped
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
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id,
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ id: 'auto_id' }))
      }))
    })),
    where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ forEach: jest.fn() }) }))
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
      now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0 })),
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

jest.mock('../shared/auth', () => ({
  checkUserPermissions: jest.fn(() => ({
    uid: 'uid_1',
    email: 'user@test.com',
    username: 'testuser',
    role: 'admin'
  }))
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s)
}));

// ═══════════════════════════════════════════════════════════════
// Imports
// ═══════════════════════════════════════════════════════════════

const { updateTimesheetEntry } = require('../timesheet/index');

// ═══════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════

function makeEntryDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      clientId: 'C001',
      serviceId: 'svc_1',
      parentServiceId: null,
      stageId: null,
      packageId: 'pkg_1',
      date: '2026-04-01',
      minutes: 60,
      hours: 1,
      action: 'עבודה',
      employee: 'user@test.com',
      ...overrides
    })
  };
}

/**
 * Build a client doc with hours service.
 * IMPORTANT: The blocked-service check (line 1139) fires when
 * service-level hoursRemaining <= 0. To test the -10h guard
 * specifically, we keep service-level hoursRemaining > 0
 * but set the package-level hoursRemaining to the desired value.
 */
function makeHoursClientDoc(pkgHoursRemaining, opts = {}) {
  const { serviceHoursRemaining, overrideActive } = opts;
  // Service-level hoursRemaining defaults to 1 (above 0)
  // so the blocked-service check doesn't fire
  const svcRemaining = serviceHoursRemaining !== undefined
    ? serviceHoursRemaining
    : Math.max(pkgHoursRemaining, 1);

  return {
    exists: true,
    data: () => ({
      clientName: 'Test Client',
      caseNumber: 'C001',
      services: [{
        id: 'svc_1',
        type: 'hours',
        name: 'שירות שעות',
        totalHours: 20,
        hoursUsed: 15,
        hoursRemaining: svcRemaining,
        ...(overrideActive ? { overrideActive: true } : {}),
        packages: [{
          id: 'pkg_1',
          hours: 20,
          hoursUsed: 20 - pkgHoursRemaining,
          hoursRemaining: pkgHoursRemaining,
          status: pkgHoursRemaining <= 0 ? 'overdraft' : 'active'
        }]
      }]
    })
  };
}

function makeLegalClientDoc(stageOpts = {}) {
  const { stageId = 'stage_a', pricingType = 'hourly', pkgHoursRemaining = 5 } = stageOpts;
  return {
    exists: true,
    data: () => ({
      clientName: 'Test Client',
      caseNumber: 'C001',
      services: [{
        id: 'svc_legal',
        type: 'legal_procedure',
        name: 'הליך משפטי',
        hoursRemaining: 10,  // service-level, not checked for legal_procedure
        stages: [{
          id: stageId,
          pricingType,
          status: 'active',
          packages: [{
            id: 'pkg_stage_1',
            hoursRemaining: pkgHoursRemaining,
            status: pkgHoursRemaining <= 0 ? 'overdraft' : 'active'
          }]
        }]
      }]
    })
  };
}

function makeTaskDoc() {
  return {
    exists: true,
    data: () => ({
      lastActivity: null,
      timeEntries: [
        { entryId: 'entry_1', minutes: 60, hours: 1 }
      ]
    })
  };
}

const defaultData = {
  entryId: 'entry_1',
  clientId: 'C001',
  serviceId: 'svc_1',
  taskId: 'task_1',
  autoGenerated: true,
  date: '2026-04-01',
  minutes: 120,
  action: 'עבודה מעודכנת',
  editHistory: [{ editedAt: new Date().toISOString(), editedBy: 'testuser', reason: 'תיקון' }]
};

const defaultContext = { auth: { uid: 'uid_1' } };

// ═══════════════════════════════════════════════════════════════
// Reset
// ═══════════════════════════════════════════════════════════════

beforeEach(() => {
  jest.clearAllMocks();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
});

// ═══════════════════════════════════════════════════════════════
// Tests — Hours Service
// ═══════════════════════════════════════════════════════════════

describe('updateTimesheetEntry — -10h overdraft guard (hours)', () => {

  test('increase within limit → passes', async () => {
    // Package has 5h remaining, delta = +1h → afterDeduction = 4 → passes
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(5));

    const result = await updateTimesheetEntry(
      { ...defaultData, minutes: 120 },  // 60→120 = +1h
      defaultContext
    );
    expect(result.success).toBe(true);
  });

  test('increase blocked when afterDeduction < -10', async () => {
    // Package at -8h, delta = +3h → afterDeduction = -11 → blocked
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(-8, { overrideActive: true }));

    await expect(
      updateTimesheetEntry(
        { ...defaultData, minutes: 240 },  // 60→240 = +3h
        defaultContext
      )
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: expect.stringContaining('חריגה')
    });
  });

  test('boundary: afterDeduction exactly -10 → passes', async () => {
    // Package at -8h, delta = +2h → afterDeduction = -10 → NOT < -10 → passes
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(-8, { overrideActive: true }));

    const result = await updateTimesheetEntry(
      { ...defaultData, minutes: 180 },  // 60→180 = +2h, after = -8-2 = -10
      defaultContext
    );
    expect(result.success).toBe(true);
  });

  test('decrease always allowed — no guard fires', async () => {
    // Package at -9.5h, decreasing from 60→30 = -0.5h delta (negative)
    // Guard MUST NOT fire — delta is negative
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(-9.5, { overrideActive: true }));

    const result = await updateTimesheetEntry(
      { ...defaultData, minutes: 30 },  // decrease
      defaultContext
    );
    expect(result.success).toBe(true);
  });

  test('same minutes (no change) → passes even with deeply negative package', async () => {
    // Package at -15h but minutesDiff = 0 → guard not triggered
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(-15, { overrideActive: true }));

    const result = await updateTimesheetEntry(
      { ...defaultData, minutes: 60 },  // same as entry's 60
      defaultContext
    );
    expect(result.success).toBe(true);
  });

  test('error details include currentRemaining, requestedHoursDelta, wouldBe', async () => {
    // Package at -8h, delta = +3h → blocked
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(-8, { overrideActive: true }));

    try {
      await updateTimesheetEntry(
        { ...defaultData, minutes: 240 },  // +3h
        defaultContext
      );
      fail('should have thrown');
    } catch (err) {
      expect(err.code).toBe('resource-exhausted');
      expect(err.details).toEqual({
        clientId: 'C001',
        currentRemaining: -8,
        requestedHoursDelta: 3,
        wouldBe: -11
      });
    }
  });

  test('no packageId on entry → falls back to DeductionSystem.getActivePackage', async () => {
    // Entry has no packageId. DeductionSystem.getActivePackage will find the
    // package with status=active/overdraft and hoursRemaining > -10.
    // Package at -8h, delta = +3h → -11 → blocked
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc({ packageId: null }))
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(makeHoursClientDoc(-8, { overrideActive: true }));

    await expect(
      updateTimesheetEntry(
        { ...defaultData, minutes: 240 },  // +3h, after = -8-3 = -11
        defaultContext
      )
    ).rejects.toMatchObject({
      code: 'resource-exhausted'
    });
  });

  test('no client doc → guard skipped, update succeeds', async () => {
    // clientId is undefined → clientRef2 is null → transaction.get is NOT called for client
    // Only 2 gets: entry + task
    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc())
      .mockResolvedValueOnce(makeTaskDoc());

    const result = await updateTimesheetEntry(
      { ...defaultData, clientId: undefined, minutes: 9999 },
      defaultContext
    );
    expect(result.success).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════
// Tests — Legal Procedure Service
// ═══════════════════════════════════════════════════════════════

describe('updateTimesheetEntry — -10h overdraft guard (legal_procedure)', () => {

  test('hourly stage — increase blocked when afterDeduction < -10', async () => {
    // Stage package at -7h, delta = +4h → -11 → blocked
    const clientDoc = makeLegalClientDoc({ pkgHoursRemaining: -7 });

    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc({
        serviceId: 'stage_a',
        parentServiceId: 'svc_legal',
        stageId: 'stage_a',
        packageId: 'pkg_stage_1'
      }))
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(clientDoc);

    await expect(
      updateTimesheetEntry(
        { ...defaultData, serviceId: 'stage_a', parentServiceId: 'svc_legal', minutes: 300 },
        // 60→300 = +240min = +4h, after = -7-4 = -11 → blocked
        defaultContext
      )
    ).rejects.toMatchObject({
      code: 'resource-exhausted'
    });
  });

  test('fixed pricing stage → guard skipped', async () => {
    // Fixed pricing stage — guard should not fire regardless of hours
    const clientDoc = makeLegalClientDoc({ pricingType: 'fixed', pkgHoursRemaining: -20 });

    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc({
        serviceId: 'stage_a',
        parentServiceId: 'svc_legal',
        stageId: 'stage_a',
        packageId: 'pkg_stage_1'
      }))
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(clientDoc);

    const result = await updateTimesheetEntry(
      { ...defaultData, serviceId: 'stage_a', parentServiceId: 'svc_legal', minutes: 600 },
      defaultContext
    );
    expect(result.success).toBe(true);
  });

  test('hourly stage — increase within limit → passes', async () => {
    // Stage package at -5h, delta = +2h → -7 → passes
    const clientDoc = makeLegalClientDoc({ pkgHoursRemaining: -5 });

    mockTransaction.get
      .mockResolvedValueOnce(makeEntryDoc({
        serviceId: 'stage_a',
        parentServiceId: 'svc_legal',
        stageId: 'stage_a',
        packageId: 'pkg_stage_1'
      }))
      .mockResolvedValueOnce(makeTaskDoc())
      .mockResolvedValueOnce(clientDoc);

    const result = await updateTimesheetEntry(
      { ...defaultData, serviceId: 'stage_a', parentServiceId: 'svc_legal', minutes: 180 },
      // 60→180 = +2h, after = -5-2 = -7 → passes
      defaultContext
    );
    expect(result.success).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════
// Code-level verification — guard exists in source
// ═══════════════════════════════════════════════════════════════

describe('Code-level verification — UPDATE guard in source', () => {
  const fs = require('fs');
  const path = require('path');

  const timesheetCode = fs.readFileSync(
    path.join(__dirname, '..', 'timesheet', 'index.js'),
    'utf8'
  );

  test('updateTimesheetEntry contains UPDATE GUARD comment', () => {
    expect(timesheetCode).toContain('UPDATE GUARD');
  });

  test('updateTimesheetEntry checks minutesDiff > 0 before guard', () => {
    expect(timesheetCode).toContain('minutesDiff > 0');
  });

  test('updateTimesheetEntry has afterDeduction < -10 check (6+ occurrences total)', () => {
    // Original 4 from CREATE + 2 new from UPDATE = 6
    const matches = timesheetCode.match(/afterDeduction < -10/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(6);
  });

  test('UPDATE guard section throws resource-exhausted', () => {
    const updateGuardSection = timesheetCode.substring(
      timesheetCode.indexOf('UPDATE GUARD'),
      timesheetCode.indexOf('Fix editHistory')
    );
    expect(updateGuardSection).toContain("'resource-exhausted'");
  });
});
