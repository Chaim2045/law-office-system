/**
 * Tests for moveToNextStage CF after PR-B.8 migration to canonical helper.
 *
 * Coverage:
 *   A. Auth + validation (auth-error, missing clientId, missing serviceId)
 *   B. Lookup failures (client / service not found)
 *   C. Service-type guard (only legal_procedure)
 *   D. Preconditions (no stages, no active stage, already at last stage)
 *   E. Canonical helper integration:
 *      - active stage → completed (with completedAt)
 *      - next stage → active (with startedAt)
 *      - currentStage + currentStageName passed through helper
 *      - isLastStage flag (true when next is last; false when more remain)
 *   F. Audit log
 *   G. Return shape
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
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
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

const { moveToNextStage } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// ─── helpers ────────────────────────────────────────────────────

function makeLegalProcedure(id, opts = {}) {
  const {
    pricingType = PT.HOURLY,
    stages = [
      { id: 'stage_a', name: 'שלב א', status: 'active', totalHours: 5 },
      { id: 'stage_b', name: 'שלב ב', status: 'pending', totalHours: 5 },
      { id: 'stage_c', name: 'שלב ג', status: 'pending', totalHours: 5 }
    ],
    totalHours = pricingType === PT.HOURLY ? 15 : 0
  } = opts;
  return {
    id,
    type: ST.LEGAL_PROCEDURE,
    name: `הליך ${id}`,
    pricingType,
    stages,
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    status: 'active'
  };
}

function makeHoursService(id, opts = {}) {
  const { totalHours = 10 } = opts;
  return {
    id,
    type: ST.HOURS,
    name: `שירות ${id}`,
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    status: 'active'
  };
}

function makeClientDoc(services = []) {
  const totalHours = services
    .filter(s => s.type === ST.HOURS || (s.type === ST.LEGAL_PROCEDURE && s.pricingType === PT.HOURLY))
    .reduce((sum, s) => sum + (s.totalHours || 0), 0);
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      services,
      totalHours,
      currentStage: services[0]?.stages?.find(st => st.status === 'active')?.id || null,
      currentStageName: services[0]?.stages?.find(st => st.status === 'active')?.name || null
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

function setupTxMocks(clientDoc) {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(clientDoc)
    .mockResolvedValueOnce(clientDoc);
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
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('missing clientId → invalid-argument', async () => {
    await expect(
      moveToNextStage({ serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('missing serviceId → invalid-argument', async () => {
    await expect(
      moveToNextStage({ clientId: 'c1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Lookup failures
// ═══════════════════════════════════════════════════════════════

describe('B. Lookup failures', () => {
  test('client not found → not-found', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce({ exists: false });
    await expect(
      moveToNextStage({ clientId: 'missing', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('service not found → not-found', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeLegalProcedure('other')])
    );
    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 'missing-svc' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Service-type guard
// ═══════════════════════════════════════════════════════════════

describe('C. Service-type guard', () => {
  test('rejects non-legal_procedure service → invalid-argument', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeHoursService('s_hours')])
    );
    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's_hours' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Preconditions
// ═══════════════════════════════════════════════════════════════

describe('D. Preconditions', () => {
  test('no stages → failed-precondition', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeLegalProcedure('s1', { stages: [] })])
    );
    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('no active stage → failed-precondition', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeLegalProcedure('s1', {
        stages: [
          { id: 'a', name: 'A', status: 'completed' },
          { id: 'b', name: 'B', status: 'pending' }
        ]
      })])
    );
    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('already at last stage → failed-precondition', async () => {
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(
      makeClientDoc([makeLegalProcedure('s1', {
        stages: [
          { id: 'a', name: 'A', status: 'completed' },
          { id: 'b', name: 'B', status: 'completed' },
          { id: 'c', name: 'C', status: 'active' } // last + active = no next
        ]
      })])
    );
    await expect(
      moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Canonical helper integration (PR-B.8)
// ═══════════════════════════════════════════════════════════════

describe('E. Canonical helper integration', () => {
  test('active stage → completed; next stage → active (both transitions)', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]));

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = payload.services.find(s => s.id === 's1');

    // Stage A (was active) → completed with completedAt
    expect(svc.stages[0].status).toBe('completed');
    expect(svc.stages[0].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Stage B (was pending) → active with startedAt
    expect(svc.stages[1].status).toBe('active');
    expect(svc.stages[1].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Stage C unchanged
    expect(svc.stages[2].status).toBe('pending');
    expect(svc.stages[2].startedAt).toBeUndefined();
  });

  test('currentStage + currentStageName passed through helper', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]));

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    const [, payload] = mockTransaction.update.mock.calls[0];
    // Client-level metadata reflects NEW active stage (B)
    expect(payload.currentStage).toBe('stage_b');
    expect(payload.currentStageName).toBe('שלב ב');
  });

  test('isLastStage=true when transitioning to LAST stage', async () => {
    // 3 stages: [completed, active, pending]. Moving makes #2 → active = LAST.
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1', {
      stages: [
        { id: 'a', name: 'A', status: 'completed' },
        { id: 'b', name: 'B', status: 'active', totalHours: 5 },
        { id: 'c', name: 'C', status: 'pending', totalHours: 5 }
      ]
    })]));

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.isLastStage).toBe(true);
    expect(result.toStage.id).toBe('c');
  });

  test('isLastStage=false when more stages remain after transition', async () => {
    // 3 stages: [active, pending, pending]. Moving makes #1 → active. Still one left after.
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]));

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result.isLastStage).toBe(false);
    expect(result.toStage.id).toBe('stage_b');
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Audit log
// ═══════════════════════════════════════════════════════════════

describe('F. Audit log', () => {
  test('MOVE_TO_NEXT_STAGE emitted with full payload', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]));

    await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(mockLogAction).toHaveBeenCalledWith(
      'MOVE_TO_NEXT_STAGE',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        caseNumber: 'c1',
        serviceId: 's1',
        fromStageId: 'stage_a',
        fromStageName: 'שלב א',
        toStageId: 'stage_b',
        toStageName: 'שלב ב',
        serviceName: 'הליך s1'
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Return value
// ═══════════════════════════════════════════════════════════════

describe('G. Return value', () => {
  test('full shape preserved', async () => {
    setupTxMocks(makeClientDoc([makeLegalProcedure('s1')]));

    const result = await moveToNextStage({ clientId: 'c1', serviceId: 's1' }, makeCtx());

    expect(result).toMatchObject({
      success: true,
      serviceId: 's1',
      fromStage: { id: 'stage_a', name: 'שלב א' },
      toStage: { id: 'stage_b', name: 'שלב ב' },
      updatedStages: expect.any(Array),
      isLastStage: false,
      message: expect.stringContaining('שלב ב')
    });
    expect(result.updatedStages).toHaveLength(3);
  });
});
