/**
 * PR-A — addHoursPackageToStage must resolve its target by EXPLICIT service id.
 *
 * The bug: the CF located its target with
 *   services.findIndex(s => s.type === ST.LEGAL_PROCEDURE)
 * — first match on type alone. The admin dialog knew which procedure was
 * selected but never sent it. A read-only probe of production (2026-08-16)
 * found 9 clients holding 2-3 legal_procedure services, every one with
 * colliding stage ids (stage_a/b/c on each), so the lookup silently succeeded
 * on the WRONG matter.
 *
 * Why no sum check could ever catch it: the stage total and the service total
 * are both recomputed on the same wrong service, so the books still balance —
 * on the wrong page. Only an identity test can pin this. Same failure class as
 * the report-identity bug fixed in #544.
 *
 * The probe also showed the bug had never fired (zero pkg_additional_* on any
 * of the 9), so this PR closes a live landmine rather than repairing damage.
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

const realHelper = jest.requireActual('../shared/client-writer');
const mockHelper = jest.fn(realHelper.writeClientWithCanonicalAggregates);
jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: (...args) => mockHelper(...args),
  RESTRICTED_KEYS: jest.requireActual('../shared/client-writer').RESTRICTED_KEYS
}));

const { addHoursPackageToStage } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── fixtures ───────────────────────────────────────────────────

function makeStage(id, totalHours = 10) {
  return {
    id,
    name: `שלב ${id}`,
    status: 'active',
    pricingType: 'hourly',
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    packages: [{
      id: `${id}_pkg_1`, type: 'initial', hours: totalHours,
      hoursUsed: 0, hoursRemaining: totalHours, status: 'active'
    }]
  };
}

/** Mirrors the real production shape: colliding stage ids across procedures. */
function makeProcedure(id, name, stageIds = ['stage_a']) {
  const stages = stageIds.map(sid => makeStage(sid));
  return {
    id,
    type: ST.LEGAL_PROCEDURE,
    name,
    pricingType: 'hourly',
    status: 'active',
    stages,
    totalHours: stages.reduce((s, st) => s + st.totalHours, 0),
    hoursUsed: 0,
    hoursRemaining: stages.reduce((s, st) => s + st.totalHours, 0)
  };
}

const ctx = () => ({ auth: { uid: 'user1', token: { email: 'user@test' } } });

/**
 * Each transactional read gets an INDEPENDENT deep clone.
 *
 * In production `transaction.get()` returns a fresh snapshot, so the helper's
 * internal re-read sees the PRE-mutation services array. Handing both reads the
 * same object would let the helper observe the CF's own in-place mutation — the
 * suite would then be structurally unable to catch a helper that merges instead
 * of replaces.
 */
function primeReads(services) {
  const snapshot = () => {
    const copy = JSON.parse(JSON.stringify(services));
    return {
      exists: true,
      data: () => ({
        fullName: 'לקוח טסט',
        services: copy,
        totalHours: copy.reduce((s, svc) => s + ((svc && svc.totalHours) || 0), 0)
      })
    };
  };
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(snapshot())   // CF read
    .mockResolvedValueOnce(snapshot());  // helper internal read
}

/** The services array the CF handed the canonical writer. */
function writtenServices() {
  return mockHelper.mock.calls[0][2].services;
}

/**
 * The services array that actually reaches Firestore.
 * `writtenServices()` is the CF's INPUT to the helper; this is the OUTPUT of the
 * whole chain — the bytes that would persist.
 */
function persistedServices() {
  expect(mockTransaction.update).toHaveBeenCalled();
  const payload = mockTransaction.update.mock.calls[0][1];
  return payload.services;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue({
    uid: 'user1', email: 'user@test', username: 'user', role: 'admin'
  });
  mockLogAction.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════
// THE CORE FIX — hours land on the selected procedure, not the first
// ═══════════════════════════════════════════════════════════════

describe('identity resolution across multiple legal_procedure services', () => {
  test('🔴 the regression this PR exists for: hours go to the SECOND procedure when it is the one selected', async () => {
    // Exactly the production shape found on case 2025994: two hourly procedures,
    // both carrying stage_a. Before the fix, first-match sent these 20h to lp1.
    const lp1 = makeProcedure('lp1', 'תביעה');
    const lp2 = makeProcedure('lp2', 'כתב הגנה - סכסוך שכנים');
    primeReads([lp1, lp2]);

    const result = await addHoursPackageToStage(
      { caseId: '2025994', serviceId: 'lp2', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      ctx()
    );

    expect(result.success).toBe(true);

    const services = writtenServices();
    const written1 = services.find(s => s.id === 'lp1');
    const written2 = services.find(s => s.id === 'lp2');

    // The selected procedure gained the hours...
    expect(written2.totalHours).toBe(30);          // 10 + 20
    expect(written2.stages[0].totalHours).toBe(30);
    expect(written2.stages[0].packages).toHaveLength(2);

    // ...and the untouched one is byte-for-byte unchanged.
    expect(written1.totalHours).toBe(10);
    expect(written1.stages[0].totalHours).toBe(10);
    expect(written1.stages[0].packages).toHaveLength(1);

    // And the same holds for what actually reaches Firestore, not just for the
    // CF's input to the writer. Without this the suite proves intent, not effect.
    const persisted = persistedServices();
    expect(persisted.find(s => s.id === 'lp2').totalHours).toBe(30);
    expect(persisted.find(s => s.id === 'lp1').totalHours).toBe(10);
  });

  test('the audit trail identifies the matter by id, not by name', async () => {
    // The PR's own lesson applied to its own logging: `procedureName` cannot
    // identify a matter (2026066 holds two procedures with the same name) and
    // `packageId` encodes only the stage, whose ids collide. Without serviceId
    // in the audit row, a mis-targeted add leaves no reconstructable trail.
    primeReads([makeProcedure('lp1', 'תביעה'), makeProcedure('lp2', 'כתב הגנה')]);

    await addHoursPackageToStage(
      { caseId: 'c1', serviceId: 'lp2', stageId: 'stage_a', hours: 8, reason: 'תוספת' },
      ctx()
    );

    expect(mockLogAction).toHaveBeenCalledWith(
      'ADD_PACKAGE_TO_STAGE',
      'user1',
      'user',
      expect.objectContaining({ serviceId: 'lp2' })
    );
  });

  test('positive control (passes on the old code too — not regression coverage)', async () => {
    const lp1 = makeProcedure('lp1', 'תביעה');
    const lp2 = makeProcedure('lp2', 'כתב הגנה');
    primeReads([lp1, lp2]);

    await addHoursPackageToStage(
      { caseId: 'c1', serviceId: 'lp1', stageId: 'stage_a', hours: 5, reason: 'תוספת' },
      ctx()
    );

    const services = writtenServices();
    expect(services.find(s => s.id === 'lp1').totalHours).toBe(15);
    expect(services.find(s => s.id === 'lp2').totalHours).toBe(10);
  });

  test('resolves the THIRD procedure — the 2025153/2025364 shape', async () => {
    const procs = [
      makeProcedure('lp1', 'שלום', ['stage_a', 'stage_b', 'stage_c']),
      makeProcedure('lp2', 'ביה"ד לעבודה', ['stage_a', 'stage_b', 'stage_c']),
      makeProcedure('lp3', 'מחוזי', ['stage_a', 'stage_b', 'stage_c'])
    ];
    primeReads(procs);

    await addHoursPackageToStage(
      { caseId: '2025364', serviceId: 'lp3', stageId: 'stage_b', hours: 40, reason: 'הרחבת ההליך' },
      ctx()
    );

    const services = writtenServices();
    expect(services.find(s => s.id === 'lp3').stages.find(s => s.id === 'stage_b').totalHours).toBe(50);
    // Neither sibling moved.
    expect(services.find(s => s.id === 'lp1').totalHours).toBe(30);
    expect(services.find(s => s.id === 'lp2').totalHours).toBe(30);
  });

  test('identically-named procedures are still told apart by id — the 2026066 shape', async () => {
    // This case holds two procedures with the SAME display name. Only the id
    // can distinguish them.
    const lp1 = makeProcedure('lp_a', 'הליך משפטי צו מניעה');
    const lp2 = makeProcedure('lp_b', 'הליך משפטי צו מניעה');
    primeReads([lp1, lp2]);

    await addHoursPackageToStage(
      { caseId: '2026066', serviceId: 'lp_b', stageId: 'stage_a', hours: 12, reason: 'הארכה' },
      ctx()
    );

    const services = writtenServices();
    expect(services.find(s => s.id === 'lp_b').totalHours).toBe(22);
    expect(services.find(s => s.id === 'lp_a').totalHours).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// FAIL-CLOSED — refuse to guess
// ═══════════════════════════════════════════════════════════════

describe('ambiguity is refused, never guessed', () => {
  test('🔴 no serviceId + two procedures → throws instead of silently picking the first', async () => {
    const lp1 = makeProcedure('lp1', 'תביעה');
    const lp2 = makeProcedure('lp2', 'כתב הגנה');
    primeReads([lp1, lp2]);

    await expect(
      addHoursPackageToStage(
        { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'תוספת' },
        ctx()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    // Nothing was written.
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('the ambiguity error is in Hebrew and tells the admin what to do', async () => {
    primeReads([makeProcedure('lp1', 'א'), makeProcedure('lp2', 'ב')]);

    const err = await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'תוספת' },
      ctx()
    ).catch(e => e);

    expect(err.message).toMatch(/[֐-׿]/);   // Hebrew (G5)
    expect(err.message).toMatch(/רענן/);              // next action (G1)
    expect(err.message).not.toMatch(/undefined|null|\[object/);
  });

  test('duplicate service ids are refused rather than resolved', async () => {
    const a = makeProcedure('dup', 'ראשון');
    const b = makeProcedure('dup', 'שני');
    primeReads([a, b]);

    await expect(
      addHoursPackageToStage(
        { caseId: 'c1', serviceId: 'dup', stageId: 'stage_a', hours: 5, reason: 'תוספת' },
        ctx()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('a serviceId that is not on this case is refused', async () => {
    primeReads([makeProcedure('lp1', 'תביעה')]);

    await expect(
      addHoursPackageToStage(
        { caseId: 'c1', serviceId: 'lp_other', stageId: 'stage_a', hours: 5, reason: 'תוספת' },
        ctx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('a service with NO id is not a match candidate, and is refused explicitly', async () => {
    // String(undefined) === 'undefined', so an unguarded coercion would let a
    // caller passing the literal "undefined" match an id-less service — first
    // match restored through a side door. It must be refused, and the refusal
    // must say it is a data defect rather than a wrong selection.
    primeReads([
      { type: ST.LEGAL_PROCEDURE, name: 'ללא מזהה', pricingType: 'hourly', status: 'active',
        stages: [makeStage('stage_a')], totalHours: 10 },
      makeProcedure('lp2', 'תקין')
    ]);

    const err = await addHoursPackageToStage(
      { caseId: 'c1', serviceId: 'lp_missing', stageId: 'stage_a', hours: 5, reason: 'תוספת' },
      ctx()
    ).catch(e => e);

    expect(err.code).toBe('failed-precondition');
    expect(err.message).toMatch(/חסר מזהה/);
    expect(mockHelper).not.toHaveBeenCalled();
  });

  test('null entries in services[] do not break resolution', async () => {
    primeReads([null, makeProcedure('lp1', 'תביעה'), null]);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', serviceId: 'lp1', stageId: 'stage_a', hours: 5, reason: 'תוספת' },
      ctx()
    );
    expect(result.success).toBe(true);
  });

  test.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['a number', 123],
    ['an object', { id: 'lp1' }],
    ['the literal "undefined"', 'undefined'],
    ['the literal "null"', 'null']
  ])('a malformed serviceId (%s) is rejected before the transaction', async (_label, bad) => {
    await expect(
      addHoursPackageToStage(
        { caseId: 'c1', serviceId: bad, stageId: 'stage_a', hours: 5, reason: 'תוספת' },
        ctx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — a cached bundle must not break
// ═══════════════════════════════════════════════════════════════

describe('backward compatibility with a payload that omits serviceId', () => {
  test('one procedure + no serviceId still works — the unambiguous case', async () => {
    primeReads([makeProcedure('lp1', 'תביעה')]);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 25, reason: 'תוספת שעות' },
      ctx()
    );

    expect(result.success).toBe(true);
    expect(writtenServices().find(s => s.id === 'lp1').totalHours).toBe(35);
  });

  test('an explicit null serviceId behaves like an omitted one', async () => {
    primeReads([makeProcedure('lp1', 'תביעה')]);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', serviceId: null, stageId: 'stage_a', hours: 5, reason: 'תוספת' },
      ctx()
    );
    expect(result.success).toBe(true);
  });

  test('a case with no legal_procedure at all still reports not-found', async () => {
    primeReads([
      { id: 'h1', type: ST.HOURS, name: 'שעות', status: 'active', totalHours: 10, packages: [] }
    ]);

    await expect(
      addHoursPackageToStage(
        { caseId: 'c1', serviceId: 'h1', stageId: 'stage_a', hours: 5, reason: 'תוספת' },
        ctx()
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('non-legal_procedure services are never resolution candidates', async () => {
    // A same-id hours service must not shadow the procedure lookup.
    primeReads([
      { id: 'x', type: ST.HOURS, name: 'שעות', status: 'active', totalHours: 10, packages: [] },
      makeProcedure('x', 'הליך')
    ]);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', serviceId: 'x', stageId: 'stage_a', hours: 7, reason: 'תוספת' },
      ctx()
    );

    // Resolves to the procedure, not the hours service.
    expect(result.success).toBe(true);
    const svcs = writtenServices();
    expect(svcs.find(s => s.type === ST.LEGAL_PROCEDURE).totalHours).toBe(17);
    expect(svcs.find(s => s.type === ST.HOURS).totalHours).toBe(10);
  });
});
