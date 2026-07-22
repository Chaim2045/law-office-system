/**
 * CHANGE 3 (2026-07-22, PR-B-2 R3) — detect-only log in createBudgetTask for
 * the creation-time race: a lawyer can open the add-task dialog while the
 * case sits on stage א, an admin advances the case to stage ב, and the
 * lawyer submits — the task is born pointing at an already-CLOSED stage.
 * moveToNextStage's re-point filter never reaches it (that task was never
 * open during any advance).
 *
 * This suite pins:
 *   - stamped stage already `completed` on the resolved parent service ->
 *     ONE console.warn, identifiers only, NO block / NO reject / NO coerce
 *     (the task is still created normally).
 *   - stamped stage still `active` (the normal path) -> NO console.warn.
 *   - ambiguous resolution (no parentServiceId, unknown parentServiceId,
 *     unknown stage id) -> NO console.warn (log nothing rather than guess).
 */

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  create: jest.fn()
};

const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id: id || `auto_${name}_${Math.random().toString(36).slice(2)}`,
      _collection: name
    })),
    where: jest.fn(() => ({ limit: jest.fn(() => ({ get: jest.fn(async () => ({ empty: true, docs: [] })) })) }))
  })),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n })),
    arrayUnion: jest.fn((...items) => ({ _arrayUnion: items }))
  };
  const Timestamp = {
    now: jest.fn(() => 'NOW'),
    fromDate: jest.fn((d) => ({ _ts: d.toISOString() }))
  };
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

jest.mock('../shared/auth', () => ({
  checkUserPermissions: jest.fn().mockResolvedValue({
    uid: 'user1',
    email: 'user@test',
    username: 'user',
    role: 'employee',
    employee: { name: 'שם עובד', isAdmin: false }
  })
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  getDescriptionLimit: jest.fn().mockResolvedValue(1000)
}));

jest.mock('../addTimeToTask_v2', () => ({
  addTimeToTaskWithTransaction: jest.fn().mockResolvedValue({ success: true })
}));

const { createBudgetTask } = require('../budget-tasks/index');

function makeCtx() {
  return { auth: { uid: 'user1', token: { email: 'user@test' } } };
}

function makeClientDoc(services = []) {
  return {
    exists: true,
    data: () => ({ clientName: 'לקוח טסט', caseNumber: '2025001', services })
  };
}

const legalProcedureService = {
  id: 's1',
  type: 'legal_procedure',
  stages: [
    { id: 'stage_a', name: 'שלב א', status: 'completed' },
    { id: 'stage_b', name: 'שלב ב', status: 'active' },
    { id: 'stage_c', name: 'שלב ג', status: 'pending' }
  ]
};

const baseData = {
  description: 'משימת בדיקה',
  clientId: '2025001',
  branch: 'ראשי',
  serviceId: 'stage_b',
  parentServiceId: 's1',
  estimatedMinutes: 120
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.get.mockReset();
  mockRunTransaction.mockImplementation(async (fn) => fn(mockTransaction));
});

describe('createBudgetTask — CHANGE 3 detect-only stale-stage log', () => {
  test('stamped stage already completed on the resolved parent service -> ONE console.warn, identifiers only, task still created', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc([legalProcedureService]));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const data = { ...baseData, serviceId: 'stage_a' }; // stamped stage is CLOSED
    const result = await createBudgetTask(data, makeCtx());

    expect(result.success).toBe(true); // NOT blocked, NOT rejected
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'BUDGET_TASK_CREATED_ON_COMPLETED_STAGE',
      expect.objectContaining({
        taskId: expect.any(String),
        stageId: 'stage_a',
        serviceId: 's1',
        clientId: '2025001'
      })
    );

    warnSpy.mockRestore();
  });

  test('stamped stage is the normal ACTIVE stage -> NO console.warn', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc([legalProcedureService]));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const data = { ...baseData, serviceId: 'stage_b' }; // stamped stage is ACTIVE (normal path)
    const result = await createBudgetTask(data, makeCtx());

    expect(result.success).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('no parentServiceId stamped -> ambiguous, NO console.warn', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc([legalProcedureService]));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const data = { ...baseData, serviceId: 'stage_a', parentServiceId: undefined };
    await createBudgetTask(data, makeCtx());

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('parentServiceId does not resolve to any service on the client -> ambiguous, NO console.warn', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc([legalProcedureService]));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const data = { ...baseData, serviceId: 'stage_a', parentServiceId: 's-UNKNOWN' };
    await createBudgetTask(data, makeCtx());

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('stamped serviceId does not resolve to any stage on the parent service -> ambiguous, NO console.warn', async () => {
    mockTransaction.get.mockResolvedValueOnce(makeClientDoc([legalProcedureService]));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const data = { ...baseData, serviceId: 'stage_UNKNOWN', parentServiceId: 's1' };
    await createBudgetTask(data, makeCtx());

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('client has no services array at all -> ambiguous, NO console.warn, no throw', async () => {
    mockTransaction.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ clientName: 'לקוח טסט', caseNumber: '2025001' }) // no `services` key
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const data = { ...baseData, serviceId: 'stage_a' };
    const result = await createBudgetTask(data, makeCtx());

    expect(result.success).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
