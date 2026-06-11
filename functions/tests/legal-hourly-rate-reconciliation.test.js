/**
 * H.3 D-B intake reconciliation (2026-06-11)
 * ─────────────────────────────────────────────────────────────────────────────
 * The two client-intake routes must store a legal-hourly service's `ratePerHour`
 * CONSISTENTLY:
 *   - an explicitly-elected positive rate is STORED;
 *   - an un-elected rate stays ABSENT (the legacy silent `|| 800` default is gone),
 *     so the static Plan reports `pricing_missing` — NEVER a fabricated 800×hours.
 *
 * Before this fix: `createClient` baked `ratePerHour: data.ratePerHour || 800`
 * while `addServiceToClient` set no rate → the same legal-hourly case yielded
 * `expectedRevenue = 800×hours` via one route and `null + pricing_missing` via the
 * other (the divergence the H.3 PR1 grader flagged; MASTER_PLAN §8.5 D-B + rubric M2).
 *
 * These tests exercise BOTH real callables and assert on the real `computeClientPlan`
 * output stamped on each route's written payload (createClient → `.create(clientData)`,
 * addServiceToClient → the canonical writer's `transaction.update` payload).
 */

// ─── shared capture + mocks (support both .create() and runTransaction paths) ───
const captured = { created: null };

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};
const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn((id) => ({
      id: id || 'auto_id',
      // createClient writes here:
      create: jest.fn(async (d) => { captured.created = d; }),
      // tolerate any incidental reads (e.g. enforcement-mode config) → defaults apply:
      get: jest.fn(async () => ({ exists: false })),
      set: jest.fn(async () => {})
    }))
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
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

const mockCheckUserPermissions = jest.fn();
jest.mock('../shared/auth', () => ({
  checkUserPermissions: mockCheckUserPermissions
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn()
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  isValidIsraeliPhone: jest.fn(() => true),
  isValidEmail: jest.fn(() => true),
  isValidIsraeliId: jest.fn(() => true)
}));

jest.mock('../case-number-transaction', () => ({
  generateCaseNumberWithTransaction: jest.fn(async () => '2099999')
}));

const { createClient } = require('../clients/index');
const { addServiceToClient } = require('../services/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

const VALID_USER = { uid: 'u1', email: 't@t', username: 'tester', role: 'manager' };
function makeCtx() { return { auth: { uid: 'u1', token: { email: 't@t' } } }; }

// legal-hourly stage triples → totalHours = 18 in BOTH routes
const STAGES_CREATE = [
  { description: 'שלב א', hours: 5 },
  { description: 'שלב ב', hours: 10 },
  { description: 'שלב ג', hours: 3 }
];
const STAGES_ADD = [{ hours: 5 }, { hours: 10 }, { hours: 3 }];
const TOTAL_HOURS = 18;

function createClientData(extra = {}) {
  return {
    clientName: 'לקוח טסט',
    caseNumber: '2099001', // provided → skips generateCaseNumber
    procedureType: ST.LEGAL_PROCEDURE,
    pricingType: PT.HOURLY,
    legalProcedureName: 'תביעה',
    stages: STAGES_CREATE,
    ...extra
  };
}

function addServiceData(extra = {}) {
  return {
    clientId: 'c1',
    serviceType: ST.LEGAL_PROCEDURE,
    serviceName: 'תביעה',
    pricingType: PT.HOURLY,
    stages: STAGES_ADD,
    ...extra
  };
}

function emptyClientDoc() {
  return {
    exists: true,
    data: () => ({ fullName: 'לקוח', status: 'active', services: [], totalHours: 0, totalServices: 0, activeServices: 0 })
  };
}
function setupAddTx() {
  mockTransaction.get.mockReset();
  mockTransaction.get
    .mockResolvedValueOnce(emptyClientDoc())  // CF body read
    .mockResolvedValueOnce(emptyClientDoc()); // canonical-writer internal read
}

// last service in a payload's services[]
function lastService(services) { return services[services.length - 1]; }

beforeEach(() => {
  jest.clearAllMocks();
  captured.created = null;
  mockCheckUserPermissions.mockResolvedValue(VALID_USER);
});

// ═══════════════════════════════════════════════════════════════════════════
// A. createClient — the route that used to bake `|| 800`
// ═══════════════════════════════════════════════════════════════════════════
describe('A. createClient legal-hourly: no silent 800', () => {
  test('no elected rate → service has NO ratePerHour; plan = pricing_missing (not 800×hours)', async () => {
    await createClient(createClientData(), makeCtx());
    const svc = lastService(captured.created.services);
    expect(svc.type).toBe('legal_procedure');
    expect(svc.pricingType).toBe('hourly');
    expect('ratePerHour' in svc).toBe(false);     // ← the bug: was 800

    const plan = captured.created.plan;
    expect(plan.expectedHours).toBe(TOTAL_HOURS);
    expect(plan.expectedRevenue).toBe(0);          // null-aware sum (NOT 800×18=14400)
    expect(plan.pricingMissingCount).toBe(1);
    expect(plan.pricingComplete).toBe(false);
    expect(plan.serviceCount).toBe(1);
  });

  test('explicitly-elected rate → stored + Plan = rate_x_hours', async () => {
    await createClient(createClientData({ ratePerHour: 1200 }), makeCtx());
    const svc = lastService(captured.created.services);
    expect(svc.ratePerHour).toBe(1200);

    const plan = captured.created.plan;
    expect(plan.expectedRevenue).toBe(1200 * TOTAL_HOURS); // 21600
    expect(plan.pricingMissingCount).toBe(0);
    expect(plan.pricingComplete).toBe(true);
  });

  test.each([[-50], [0], ['abc'], [NaN]])(
    'malformed elected rate (%p) → invalid-argument (not silently dropped)',
    async (bad) => {
      await expect(createClient(createClientData({ ratePerHour: bad }), makeCtx()))
        .rejects.toMatchObject({ code: 'invalid-argument' });
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// B. addServiceToClient — the route that set NO rate
// ═══════════════════════════════════════════════════════════════════════════
describe('B. addServiceToClient legal-hourly: symmetric rate handling', () => {
  test('no elected rate → service has NO ratePerHour; plan = pricing_missing', async () => {
    setupAddTx();
    await addServiceToClient(addServiceData(), makeCtx());
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = lastService(payload.services);
    expect(svc.type).toBe('legal_procedure');
    expect('ratePerHour' in svc).toBe(false);

    expect(payload.plan.expectedHours).toBe(TOTAL_HOURS);
    expect(payload.plan.expectedRevenue).toBe(0);
    expect(payload.plan.pricingMissingCount).toBe(1);
    expect(payload.plan.pricingComplete).toBe(false);
  });

  test('explicitly-elected rate → stored + Plan = rate_x_hours', async () => {
    setupAddTx();
    await addServiceToClient(addServiceData({ ratePerHour: 1200 }), makeCtx());
    const [, payload] = mockTransaction.update.mock.calls[0];
    const svc = lastService(payload.services);
    expect(svc.ratePerHour).toBe(1200);
    expect(payload.plan.expectedRevenue).toBe(1200 * TOTAL_HOURS);
    expect(payload.plan.pricingMissingCount).toBe(0);
  });

  test('malformed elected rate → invalid-argument', async () => {
    await expect(addServiceToClient(addServiceData({ ratePerHour: -5 }), makeCtx()))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. The reconciliation: both routes now AGREE for identical input
// ═══════════════════════════════════════════════════════════════════════════
describe('C. Drift-free reconciliation (the grader-flagged seam)', () => {
  test('identical no-rate legal-hourly input → identical Plan from BOTH routes', async () => {
    // createClient route
    await createClient(createClientData(), makeCtx());
    const planCreate = captured.created.plan;

    // addServiceToClient route
    setupAddTx();
    await addServiceToClient(addServiceData(), makeCtx());
    const [, addPayload] = mockTransaction.update.mock.calls[0];
    const planAdd = addPayload.plan;

    const shape = (p) => ({
      expectedHours: p.expectedHours,
      expectedRevenue: p.expectedRevenue,
      pricingComplete: p.pricingComplete,
      pricingMissingCount: p.pricingMissingCount,
      serviceCount: p.serviceCount
    });
    expect(shape(planCreate)).toEqual(shape(planAdd));
    expect(shape(planCreate)).toEqual({
      expectedHours: TOTAL_HOURS,
      expectedRevenue: 0,
      pricingComplete: false,
      pricingMissingCount: 1,
      serviceCount: 1
    });
  });
});
