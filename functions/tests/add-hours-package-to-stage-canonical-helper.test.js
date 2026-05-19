/**
 * Tests for addHoursPackageToStage CF after PR-B.13 migration.
 *
 * Coverage:
 *   A. Helper integration — happy path (package appended to stage)
 *   B. Stage + service nested aggregates recomputed correctly
 *   C. Return values sourced from helperResult (canonical)
 *   D. Validation failures → helper NOT called
 *   E. Completed-stage warning + stageWasCompleted flag
 *   F. Audit log called post-transaction
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
  runTransaction: mockRunTransaction,
  batch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) }))
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
  sanitizeString: jest.fn((s) => s)
}));

// Spy on helper — call-through is critical because the function uses
// helperResult.aggregates in the return value. Wrap real helper.
const realHelper = jest.requireActual('../shared/client-writer');
const mockHelper = jest.fn(realHelper.writeClientWithCanonicalAggregates);
jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: (...args) => mockHelper(...args),
  RESTRICTED_KEYS: jest.requireActual('../shared/client-writer').RESTRICTED_KEYS
}));

const { addHoursPackageToStage } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeLegalProcedureService(stages) {
  return {
    id: 'lp1',
    type: ST.LEGAL_PROCEDURE,
    name: 'הליך משפטי',
    pricingType: 'hourly',
    stages,
    totalHours: stages.reduce((s, st) => s + (st.totalHours || 0), 0),
    hoursUsed: stages.reduce((s, st) => s + (st.hoursUsed || 0), 0),
    hoursRemaining: stages.reduce((s, st) => s + (st.hoursRemaining || 0), 0),
    status: 'active'
  };
}

function makeStage(id, { totalHours = 10, hoursUsed = 0, status = 'active' } = {}) {
  return {
    id,
    name: `שלב ${id}`,
    status,
    pricingType: 'hourly',
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
    ]
  };
}

function makeClientDoc(services, totalHours = null) {
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      services,
      totalHours: totalHours ?? services.reduce((s, svc) => s + (svc.totalHours || 0), 0)
    })
  };
}

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue({
    uid: 'user1',
    email: 'user@test',
    username: 'user',
    role: 'admin'
  });
  mockLogAction.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════
// A. Helper integration — happy path
// ═══════════════════════════════════════════════════════════════

describe('A. Helper integration — happy path', () => {
  test('helper called once with services + caller + auditMeta, no manual aggregates', async () => {
    const stage = makeStage('stage_a', { totalHours: 10, hoursUsed: 3 });
    const lp = makeLegalProcedureService([stage]);
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)     // CF read
      .mockResolvedValueOnce(clientDoc);    // helper internal read

    const result = await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    expect(result.success).toBe(true);
    expect(mockHelper).toHaveBeenCalledTimes(1);

    const [tx, ref, payload, options] = mockHelper.mock.calls[0];
    expect(tx).toBe(mockTransaction);
    expect(ref.id).toBe('c1');

    // Payload: services only — NO manual top-level aggregates
    expect(Array.isArray(payload.services)).toBe(true);
    expect(payload.totalHours).toBeUndefined();
    expect(payload.hoursUsed).toBeUndefined();
    expect(payload.hoursRemaining).toBeUndefined();
    expect(payload.minutesUsed).toBeUndefined();
    expect(payload.minutesRemaining).toBeUndefined();
    expect(payload.isBlocked).toBeUndefined();
    expect(payload.isCritical).toBeUndefined();
    expect(payload.lastModifiedAt).toBeUndefined();  // helper adds via auditMeta
    expect(payload.lastModifiedBy).toBeUndefined();  // helper adds via auditMeta

    // Options
    expect(options.caller).toBe('addHoursPackageToStage');
    expect(options.auditMeta).toEqual({ uid: 'user1', username: 'user' });
    expect(options.mode).toBeUndefined();  // default mode (no soak override)
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Stage + service nested aggregates
// ═══════════════════════════════════════════════════════════════

describe('B. Stage + service nested aggregates', () => {
  test('stage.totalHours = initial + added; service.totalHours = sum of stages', async () => {
    const stageA = makeStage('stage_a', { totalHours: 10, hoursUsed: 3 });
    const stageB = makeStage('stage_b', { totalHours: 5, hoursUsed: 1 });
    const lp = makeLegalProcedureService([stageA, stageB]);
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    const [, , payload] = mockHelper.mock.calls[0];
    const updatedLp = payload.services.find(s => s.id === 'lp1');
    const updatedStageA = updatedLp.stages.find(s => s.id === 'stage_a');
    const updatedStageB = updatedLp.stages.find(s => s.id === 'stage_b');

    // stage_a: initial 10h + new 20h = 30h
    expect(updatedStageA.totalHours).toBe(30);
    expect(updatedStageA.hoursUsed).toBe(3);
    expect(updatedStageA.hoursRemaining).toBe(27);
    expect(updatedStageA.packages).toHaveLength(2);
    expect(updatedStageA.packages[1].hours).toBe(20);
    expect(updatedStageA.packages[1].type).toBe('additional');

    // stage_b unchanged
    expect(updatedStageB.totalHours).toBe(5);

    // service: 30 + 5 = 35
    expect(updatedLp.totalHours).toBe(35);
    expect(updatedLp.hoursUsed).toBe(4);
    expect(updatedLp.hoursRemaining).toBe(31);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Return values from helperResult
// ═══════════════════════════════════════════════════════════════

describe('C. Return values sourced from helperResult', () => {
  test('client.totalHours / hoursUsed / hoursRemaining come from helper canonical aggregates', async () => {
    const stage = makeStage('stage_a', { totalHours: 10, hoursUsed: 3 });
    const lp = makeLegalProcedureService([stage]);
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    // After adding 20h to stage_a: client totalHours = 30, hoursUsed = 3, hoursRemaining = 27
    expect(result.client.totalHours).toBe(30);
    expect(result.client.hoursUsed).toBe(3);
    expect(result.client.hoursRemaining).toBe(27);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Validation failures → helper NOT called
// ═══════════════════════════════════════════════════════════════

describe('D. Validation failures → helper NOT called', () => {
  test('missing caseId throws', async () => {
    await expect(addHoursPackageToStage(
      { stageId: 'stage_a', hours: 10, reason: 'בדיקה' },
      makeCtx()
    )).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('invalid stageId throws', async () => {
    await expect(addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_z', hours: 10, reason: 'בדיקה' },
      makeCtx()
    )).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('hours < 1 throws', async () => {
    await expect(addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 0, reason: 'בדיקה' },
      makeCtx()
    )).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('hours > 500 throws', async () => {
    await expect(addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 501, reason: 'בדיקה' },
      makeCtx()
    )).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('reason too short throws', async () => {
    await expect(addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 10, reason: 'ab' },
      makeCtx()
    )).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockHelper).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Completed-stage warning + stageWasCompleted flag
// ═══════════════════════════════════════════════════════════════

describe('E. Completed-stage warning preserved', () => {
  test('completed stage → still allows package; audit log carries stageWasCompleted: true', async () => {
    const stage = makeStage('stage_a', { totalHours: 10, hoursUsed: 10, status: 'completed' });
    const lp = makeLegalProcedureService([stage]);
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 10, reason: 'דיונים נוספים' },
      makeCtx()
    );

    expect(result.success).toBe(true);
    expect(mockLogAction).toHaveBeenCalledWith(
      'ADD_PACKAGE_TO_STAGE',
      'user1',
      'user',
      expect.objectContaining({ stageStatusWasCompleted: true })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Audit log post-transaction
// ═══════════════════════════════════════════════════════════════

describe('F. Audit log post-transaction', () => {
  test('logAction called once with ADD_PACKAGE_TO_STAGE + full payload', async () => {
    const stage = makeStage('stage_a', { totalHours: 10, hoursUsed: 3 });
    const lp = makeLegalProcedureService([stage]);
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get
      .mockResolvedValueOnce(clientDoc)
      .mockResolvedValueOnce(clientDoc);

    await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    expect(mockLogAction).toHaveBeenCalledWith(
      'ADD_PACKAGE_TO_STAGE',
      'user1',
      'user',
      expect.objectContaining({
        caseId: 'c1',
        stageId: 'stage_a',
        hours: 20,
        reason: 'דיונים נוספים',
        stageStatusWasCompleted: false
      })
    );
  });
});
