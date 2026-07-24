/**
 * PR-STAGE-OWN — tests for the two aggregate-ownership collisions fixed in
 * addHoursPackageToStage (functions/services/index.js):
 *
 *   Fix 1 (stage level):   hoursUsed counted only at stage level (no package,
 *                          or Σpackages < stage.hoursUsed) must SURVIVE the
 *                          next package add — never be silently recomputed
 *                          down to Σ(packages.hoursUsed).
 *   Fix 1b (fixed stage):  a FIXED-pricing stage's totalHoursWorked must never
 *                          be touched here, and hoursRemaining must stay
 *                          null — never 0.
 *   Fix 2 (service level):  the service-level hoursUsed/hoursRemaining
 *                          recompute must be pricing-aware (mirrors
 *                          src/modules/aggregation.calcServiceHoursUsedFromStages)
 *                          instead of a plain Σ(stage.hoursUsed).
 *
 * Harness mirrors tests/add-hours-package-to-stage-canonical-helper.test.js
 * (same mocks) so this file exercises the REAL addHoursPackageToStage code,
 * not a re-implementation.
 *
 * TEST-STRENGTH SUMMARY (corrected 2026-07-23, second review round):
 * Weak (pass against both pre- and post-change code — non-regression /
 * ordering checks, prove nothing about the fix itself): Test 3, Test 5,
 * Test 8. Test 4-hourly was ALSO weak until this correction (its only
 * assertion compared the code's output against the very helper the code
 * calls, calcServiceHoursUsedFromStages — tautological, passes even if the
 * helper is wrong) and is now a real test via a hand-derived hard-coded
 * literal (see the comment at that assertion). Every other test (1, 2,
 * 4-fixed, 6, 7) genuinely fails against pre-change code — verified by
 * stashing each fix in turn and re-running.
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

// Real helper (call-through) — the CF's return value depends on it.
const realHelper = jest.requireActual('../shared/client-writer');
const mockHelper = jest.fn(realHelper.writeClientWithCanonicalAggregates);
jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: (...args) => mockHelper(...args),
  RESTRICTED_KEYS: jest.requireActual('../shared/client-writer').RESTRICTED_KEYS
}));

const { addHoursPackageToStage } = require('../services/index');
const { calcServiceHoursUsedFromStages } = require('../src/modules/aggregation');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ─── helpers ────────────────────────────────────────────────────

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
// Test 1 — orphan stage-level hours survive a package add
//   (real measured shape: client 2025366/stage_a, 67.58h stage-level vs
//    65.58h in packages)
// ═══════════════════════════════════════════════════════════════

describe('Test 1 — stage-only-counted hoursUsed survives addHoursPackageToStage', () => {
  test('stage.hoursUsed=67.58 with Σpackages.hoursUsed=65.58 → hoursUsed preserved at 67.58 after adding an empty package', async () => {
    const stage = {
      id: 'stage_a',
      name: 'שלב א',
      status: 'active',
      pricingType: 'hourly',
      totalHours: 100,
      hoursUsed: 67.58,        // stage-level total (includes 2h counted with no package backing)
      hoursRemaining: 32.42,
      packages: [
        { id: 'pkg_1', type: 'initial', hours: 100, hoursUsed: 65.58, hoursRemaining: 34.42, status: 'active' }
      ]
    };
    const lp = {
      id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי', pricingType: 'hourly',
      stages: [stage], totalHours: 100, hoursUsed: 67.58, hoursRemaining: 32.42, status: 'active'
    };
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(clientDoc).mockResolvedValueOnce(clientDoc);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await addHoursPackageToStage(
      { caseId: '2025366', stageId: 'stage_a', hours: 5, reason: 'חבילה נוספת' },
      makeCtx()
    );

    expect(result.success).toBe(true);

    const [, , payload] = mockHelper.mock.calls[0];
    const updatedLp = payload.services.find(s => s.id === 'lp1');
    const updatedStageA = updatedLp.stages.find(s => s.id === 'stage_a');

    // The 2h stage-only-counted work MUST survive — this is the assertion
    // that FAILS against pre-change code (which recomputed hoursUsed as a
    // pure Σ(packages.hoursUsed) = 65.58, silently dropping the 2h).
    expect(updatedStageA.hoursUsed).toBe(67.58);
    expect(updatedStageA.totalHours).toBe(105); // 100 + 5 new package
    expect(updatedStageA.hoursRemaining).toBe(37.42); // 105 - 67.58

    // The guard actually engaged — observability requirement.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[OWN-STAGE-GUARD]'));

    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 2 — fixed stage: totalHoursWorked untouched, hoursRemaining stays null
// ═══════════════════════════════════════════════════════════════

describe('Test 2 — FIXED stage is never zeroed / never given hoursRemaining:0', () => {
  test('adding a package to a fixed stage leaves totalHoursWorked untouched and hoursRemaining null (not 0)', async () => {
    const stage = {
      id: 'stage_a',
      name: 'שלב א',
      status: 'active',
      pricingType: 'fixed',
      fixedPrice: 5000,
      paid: false,
      totalHoursWorked: 12.5   // hours worked so far, tracked separately from packages
      // hoursUsed / hoursRemaining intentionally ABSENT — matches real fixed-stage shape
    };
    const lp = {
      id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי', pricingType: 'fixed',
      stages: [stage], totalPrice: 5000, totalPaid: 0, status: 'active'
    };
    const clientDoc = makeClientDoc([lp], 0);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(clientDoc).mockResolvedValueOnce(clientDoc);

    const result = await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 5, reason: 'חבילה נוספת' },
      makeCtx()
    );

    expect(result.success).toBe(true);

    const [, , payload] = mockHelper.mock.calls[0];
    const updatedLp = payload.services.find(s => s.id === 'lp1');
    const updatedStageA = updatedLp.stages.find(s => s.id === 'stage_a');

    // MUST NOT zero totalHoursWorked. This assertion FAILS against
    // pre-change code only if pre-change code touched totalHoursWorked at
    // all — it did not (pre-change never branched on pricingType), so this
    // specific field was accidentally safe before too. Kept as a named
    // invariant so a future edit cannot regress it silently.
    expect(updatedStageA.totalHoursWorked).toBe(12.5);

    // MUST be null, not 0. This assertion FAILS against pre-change code,
    // which unconditionally recomputed hoursRemaining = Σ(packages.hoursRemaining)
    // = 5 (the one new empty package) — never null.
    expect(updatedStageA.hoursRemaining).toBeNull();

    // Service-level hoursRemaining must also be null for a fixed procedure
    // (Fix 2). FAILS against pre-change code, which computed a plain
    // Σ(stage.hoursRemaining) with no pricing-type branch at all.
    expect(updatedLp.hoursRemaining).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 3 — hourly stage fully accounted by packages: no regression
// ═══════════════════════════════════════════════════════════════

describe('Test 3 — hourly stage where packages fully account for hours: unchanged behavior', () => {
  test('Σpackages.hoursUsed === stage.hoursUsed → guard is a no-op, numbers match today\'s behavior', async () => {
    const stage = {
      id: 'stage_a', name: 'שלב א', status: 'active', pricingType: 'hourly',
      totalHours: 10, hoursUsed: 3, hoursRemaining: 7,
      packages: [{ id: 'pkg_1', type: 'initial', hours: 10, hoursUsed: 3, hoursRemaining: 7, status: 'active' }]
    };
    const lp = {
      id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי', pricingType: 'hourly',
      stages: [stage], totalHours: 10, hoursUsed: 3, hoursRemaining: 7, status: 'active'
    };
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(clientDoc).mockResolvedValueOnce(clientDoc);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    const [, , payload] = mockHelper.mock.calls[0];
    const updatedLp = payload.services.find(s => s.id === 'lp1');
    const updatedStageA = updatedLp.stages.find(s => s.id === 'stage_a');

    // Identical to the pre-existing add-hours-package-to-stage-canonical-helper
    // test's "B" case — this is a NON-REGRESSION check. It is WEAK: it
    // passes against both pre- and post-change code (there is no orphan
    // here, so the guard never engages), and only proves the healthy
    // majority path is untouched — it proves nothing about the fix itself.
    expect(updatedStageA.hoursUsed).toBe(3);
    expect(updatedStageA.totalHours).toBe(30);
    expect(updatedStageA.hoursRemaining).toBe(27);
    expect(updatedLp.hoursUsed).toBe(3);
    expect(updatedLp.hoursRemaining).toBe(27);

    // Guard must NOT fire when there's nothing to protect.
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('[OWN-STAGE-GUARD]'));

    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 4 — service-level totals agree with the canonical aggregation helper
// ═══════════════════════════════════════════════════════════════

describe('Test 4 — service-level hoursUsed matches calcServiceHoursUsedFromStages', () => {
  test('hourly procedure: legalProcedure.hoursUsed === calcServiceHoursUsedFromStages(stages)', async () => {
    const stageA = {
      id: 'stage_a', name: 'שלב א', status: 'active', pricingType: 'hourly',
      totalHours: 10, hoursUsed: 3, hoursRemaining: 7,
      packages: [{ id: 'a_pkg', type: 'initial', hours: 10, hoursUsed: 3, hoursRemaining: 7, status: 'active' }]
    };
    const stageB = {
      id: 'stage_b', name: 'שלב ב', status: 'pending', pricingType: 'hourly',
      totalHours: 5, hoursUsed: 1, hoursRemaining: 4,
      packages: [{ id: 'b_pkg', type: 'initial', hours: 5, hoursUsed: 1, hoursRemaining: 4, status: 'active' }]
    };
    const lp = {
      id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי', pricingType: 'hourly',
      stages: [stageA, stageB], totalHours: 15, hoursUsed: 4, hoursRemaining: 11, status: 'active'
    };
    const clientDoc = makeClientDoc([lp]);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(clientDoc).mockResolvedValueOnce(clientDoc);

    await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    const [, , payload] = mockHelper.mock.calls[0];
    const updatedLp = payload.services.find(s => s.id === 'lp1');

    // WEAK test (2026-07-23 review correction): pre-change code computed a
    // plain Σ(stage.hoursUsed) which, in this all-hourly fixture, happens to
    // equal the pricing-aware sum too (no fixed stages present) — so this
    // case does NOT fail pre-change. It still proves the two implementations
    // (services/index.js and src/modules/aggregation) cannot silently drift,
    // since one calls the other.
    //
    // Hard-coded anchor (2026-07-23 fix — this line alone was tautological:
    // comparing the code's output against the very helper the code calls
    // passes even if the helper itself is wrong). Derived by hand from the
    // fixture: stage_a starts hoursUsed=3 with ONE package at hoursUsed=3
    // (orphan=0 — no stage-only surplus). Adding a 20h package pushes an
    // EMPTY package (hoursUsed=0), so Σpackages stays 3 → orphan-preserving
    // recompute gives stage_a.hoursUsed = 0 + 3 = 3 (unchanged — only
    // totalHours/hoursRemaining grow). stage_b is untouched (hoursUsed=1).
    // Service-level Σ = calcStageEffectiveHoursUsed(stage_a) + (stage_b) =
    // 3 + 1 = 4 (both hourly, so each is just stage.hoursUsed).
    expect(updatedLp.hoursUsed).toBe(4);
    // Kept alongside the hard literal: proves the two implementations agree
    // on THIS input, not just that the number happens to be right.
    expect(updatedLp.hoursUsed).toBe(calcServiceHoursUsedFromStages(updatedLp.stages));
  });

  test('fixed procedure: legalProcedure.hoursUsed/hoursRemaining match the pricing-aware rule, not a plain stage.hoursUsed sum', async () => {
    const stage = {
      id: 'stage_a', name: 'שלב א', status: 'active', pricingType: 'fixed',
      fixedPrice: 5000, paid: false, totalHoursWorked: 8
    };
    const lp = {
      id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי', pricingType: 'fixed',
      stages: [stage], totalPrice: 5000, totalPaid: 0, status: 'active'
    };
    const clientDoc = makeClientDoc([lp], 0);
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValueOnce(clientDoc).mockResolvedValueOnce(clientDoc);

    await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 3, reason: 'חבילה נוספת' },
      makeCtx()
    );

    const [, , payload] = mockHelper.mock.calls[0];
    const updatedLp = payload.services.find(s => s.id === 'lp1');

    // FAILS against pre-change code: the old plain Σ(stage.hoursUsed) reads
    // stage.hoursUsed (undefined on a real fixed stage → 0, or in this test
    // whatever the packages recompute produced), NOT totalHoursWorked=8, and
    // never forces hoursRemaining to null.
    expect(updatedLp.hoursUsed).toBe(calcServiceHoursUsedFromStages(updatedLp.stages));
    expect(updatedLp.hoursUsed).toBe(8);
    expect(updatedLp.hoursRemaining).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Test 5 — reads precede writes inside the transaction
// ═══════════════════════════════════════════════════════════════

describe('Test 5 — all transaction reads happen before any transaction write', () => {
  test('transaction.get is called before transaction.update (via the canonical helper)', async () => {
    const stage = {
      id: 'stage_a', name: 'שלב א', status: 'active', pricingType: 'hourly',
      totalHours: 10, hoursUsed: 3, hoursRemaining: 7,
      packages: [{ id: 'pkg_1', type: 'initial', hours: 10, hoursUsed: 3, hoursRemaining: 7, status: 'active' }]
    };
    const lp = {
      id: 'lp1', type: ST.LEGAL_PROCEDURE, name: 'הליך משפטי', pricingType: 'hourly',
      stages: [stage], totalHours: 10, hoursUsed: 3, hoursRemaining: 7, status: 'active'
    };
    const clientDoc = makeClientDoc([lp]);

    const callOrder = [];
    mockTransaction.get.mockReset();
    mockTransaction.get.mockImplementation(async () => {
      callOrder.push('get');
      return clientDoc;
    });
    mockTransaction.update.mockReset();
    mockTransaction.update.mockImplementation(() => {
      callOrder.push('update');
    });

    await addHoursPackageToStage(
      { caseId: 'c1', stageId: 'stage_a', hours: 20, reason: 'דיונים נוספים' },
      makeCtx()
    );

    // This test is WEAK as a general ordering proof: it only observes THIS
    // transaction's own get/update pair (2 gets: the CF's own read + the
    // helper's internal read, both before the helper's single update). It
    // does not — and cannot, from a unit test — prove no OTHER write path in
    // the codebase reorders reads/writes; it only proves this function's own
    // added logic (the guard) is pure in-memory computation that does not
    // introduce any new Firestore call between the existing get and update.
    expect(callOrder).toEqual(['get', 'get', 'update']);
  });
});

// ═══════════════════════════════════════════════════════════════
// EXTENSION (2026-07-23 review round) — the SECOND door: ordinary
// package-backed timesheet deductions (applyLegalProcedureDelta), which
// apply BOTH positive deltas (new entries) and NEGATIVE deltas (entry
// edit/delete reversal via triggers/timesheet-trigger.js). These tests call
// the real pure function directly — no callable harness needed.
// ═══════════════════════════════════════════════════════════════

const { applyLegalProcedureDelta } = require('../src/modules/aggregation');

function makeOrphanLegalProcedure() {
  // Mirrors the measured client 2025366/stage_a shape: stage.hoursUsed=67.58,
  // one package hoursUsed=65.58 (2h orphan, stage-only-counted, no package
  // backing).
  return [
    {
      id: 'lp1',
      type: 'legal_procedure',
      pricingType: 'hourly',
      totalHours: 100,
      hoursUsed: 67.58,
      hoursRemaining: 32.42,
      stages: [
        {
          id: 'stage_a',
          pricingType: 'hourly',
          totalHours: 100,
          hoursUsed: 67.58,
          hoursRemaining: 32.42,
          packages: [
            { id: 'pkg_1', hours: 100, hoursUsed: 65.58, hoursRemaining: 34.42, status: 'active' }
          ]
        }
      ]
    }
  ];
}

describe('Test 6 — orphan hours survive an ORDINARY package-backed deduction (no package add involved)', () => {
  test('logging +5h against the orphan-carrying stage preserves the 2h orphan AND applies the new hours correctly', () => {
    const services = makeOrphanLegalProcedure();

    // +5h logged (300 minutes) against pkg_1 on stage_a — the everyday path,
    // NOT addHoursPackageToStage. This is what silently destroyed the orphan
    // pre-fix: a plain Σ(packages.hoursUsed) recompute would have produced
    // 65.58+5=70.58, dropping the 2h orphan. FAILS against pre-change code
    // (which would assert 70.58, not 72.58).
    const result = applyLegalProcedureDelta(services, 'lp1', 'stage_a', 'pkg_1', 300);

    expect(result).not.toBeNull();
    const updatedStage = result.updatedServices[0].stages[0];
    const updatedPkg = updatedStage.packages[0];

    expect(updatedPkg.hoursUsed).toBe(70.58); // package itself moved correctly
    // Orphan (2h) preserved AND the +5h landed: 67.58 + 5 = 72.58, NOT 70.58.
    expect(updatedStage.hoursUsed).toBe(72.58);
    expect(updatedStage.hoursRemaining).toBe(27.42); // 100 - 72.58

    const updatedService = result.updatedServices[0];
    expect(updatedService.hoursUsed).toBe(72.58);
  });
});

describe('Test 7 — a LEGITIMATE decrease (entry edit/delete) still decreases — the guard must not freeze', () => {
  test('a negative delta (edit lowering logged time) lowers stage.hoursUsed by the same amount, orphan still intact', () => {
    const services = makeOrphanLegalProcedure();

    // Entry edit reduces logged time by 3h (-180 minutes) against pkg_1 —
    // mirrors triggers/timesheet-trigger.js's `-(before.minutes)` reversal
    // pattern for edit/delete. A NAIVE max(Σpackages, oldStageHoursUsed)
    // floor would freeze this at 67.58 forever (verified by hand before
    // writing the fix — see the commit message). FAILS against a
    // hypothetical naive-floor implementation; the orphan-preserving rule
    // must let it drop to 64.58.
    const result = applyLegalProcedureDelta(services, 'lp1', 'stage_a', 'pkg_1', -180);

    expect(result).not.toBeNull();
    const updatedStage = result.updatedServices[0].stages[0];
    const updatedPkg = updatedStage.packages[0];

    expect(updatedPkg.hoursUsed).toBe(62.58); // 65.58 - 3
    // The stage-level total must ALSO decrease by exactly 3h: 67.58 - 3 = 64.58.
    // A frozen/never-shrinks guard would incorrectly report 67.58 here.
    expect(updatedStage.hoursUsed).toBe(64.58);
    expect(updatedStage.hoursRemaining).toBe(35.42); // 100 - 64.58

    // Applying a SECOND negative delta proves it keeps moving (not a one-time
    // unfreeze) — a genuinely frozen guard would report 67.58 again here too.
    const result2 = applyLegalProcedureDelta(result.updatedServices, 'lp1', 'stage_a', 'pkg_1', -60);
    const stage2 = result2.updatedServices[0].stages[0];
    expect(stage2.hoursUsed).toBe(63.58); // 64.58 - 1
  });
});

describe('Test 8 — healthy majority (no orphan): applyLegalProcedureDelta behaves identically to before', () => {
  test('no orphan present → stage.hoursUsed is a plain Σ(packages.hoursUsed), both directions', () => {
    const services = [
      {
        id: 'lp2', type: 'legal_procedure', pricingType: 'hourly',
        totalHours: 10, hoursUsed: 3, hoursRemaining: 7,
        stages: [{
          id: 'stage_a', pricingType: 'hourly', totalHours: 10, hoursUsed: 3, hoursRemaining: 7,
          packages: [{ id: 'pkg_1', hours: 10, hoursUsed: 3, hoursRemaining: 7, status: 'active' }]
        }]
      }
    ];

    // This test is WEAK as a fix-proof: it is a NON-REGRESSION check that
    // passes against both pre- and post-change code whenever no orphan
    // exists (the healthy majority) — it proves the common path is
    // untouched, nothing about the fix itself.
    const plus = applyLegalProcedureDelta(services, 'lp2', 'stage_a', 'pkg_1', 120); // +2h
    expect(plus.updatedServices[0].stages[0].hoursUsed).toBe(5);

    const minus = applyLegalProcedureDelta(plus.updatedServices, 'lp2', 'stage_a', 'pkg_1', -300); // -5h
    expect(minus.updatedServices[0].stages[0].hoursUsed).toBe(0);
  });
});
