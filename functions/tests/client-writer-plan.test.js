/**
 * client-writer — Plan stamping (H.3 PR1) integration test.
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves the customer scenario at the canonical write path (the route every
 * service-mutating callsite takes): a client write stamps `plan` (computeClientPlan
 * over services[]) into the written payload, and a caller can NEVER inject `plan`
 * (it is a RESTRICTED_KEY — derived-only, like the hours aggregates).
 *
 * The helper runs with `mode:'disabled'` so the invariant-enforcement config read is
 * skipped; calcClientAggregates + computeClientPlan run for real (only the SDK
 * boundary is mocked).
 */
'use strict';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    () => ({ collection: () => ({ add: jest.fn().mockResolvedValue({}) }) }),
    { FieldValue: { serverTimestamp: jest.fn(() => 'TS') } }
  )
}));

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return { https: { HttpsError }, logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } };
});

const { writeClientWithCanonicalAggregates, RESTRICTED_KEYS } = require('../shared/client-writer');
const { computeClientPlan } = require('../lib/profitability/client-plan');

function makeTx(currentData) {
  const captured = {};
  const tx = {
    get: jest.fn(async () => ({ exists: true, data: () => currentData })),
    update: jest.fn((_ref, payload) => { captured.payload = payload; })
  };
  return { tx, captured };
}

const SERVICES = [
  { id: 's1', type: 'fixed', fixedPrice: 5000, status: 'active' },
  { id: 's2', type: 'hours', pricingType: 'hourly', totalHours: 50, status: 'active' }
];

describe('client-writer — Plan stamping (H.3 PR1)', () => {
  it("'plan' is a RESTRICTED_KEY (derived-only)", () => {
    expect(RESTRICTED_KEYS).toContain('plan');
  });

  it('stamps plan = computeClientPlan(services) into the written payload', async () => {
    const { tx, captured } = makeTx({ services: [] });
    await writeClientWithCanonicalAggregates(tx, { id: 'c1' }, { services: SERVICES }, { caller: 'test', mode: 'disabled' });
    expect(captured.payload.plan).toEqual(computeClientPlan(SERVICES));
    // the 50 un-priced hours are NOT monetized; only the 5000 fixed price is known
    expect(captured.payload.plan).toMatchObject({
      expectedHours: 50, expectedRevenue: 5000, pricingComplete: false, pricingMissingCount: 1
    });
  });

  it('strips a caller-supplied plan and recomputes it (no injection)', async () => {
    const { tx, captured } = makeTx({ services: [] });
    const res = await writeClientWithCanonicalAggregates(
      tx,
      { id: 'c1' },
      { services: SERVICES, plan: { expectedRevenue: 999999, hacked: true } },
      { caller: 'test', mode: 'disabled' }
    );
    expect(res.strippedKeys).toContain('plan');
    expect(captured.payload.plan.expectedRevenue).toBe(5000); // recomputed, NOT the injected 999999
    expect(captured.payload.plan.hacked).toBeUndefined();
  });

  it('never writes a cost/profit field onto the client doc (§7.6 → PR3 CF-only)', async () => {
    const { tx, captured } = makeTx({ services: [] });
    await writeClientWithCanonicalAggregates(tx, { id: 'c1' }, { services: SERVICES }, { caller: 'test', mode: 'disabled' });
    expect(captured.payload.plan.expectedCost).toBeUndefined();
    expect(captured.payload.plan.expectedProfit).toBeUndefined();
    expect(captured.payload).not.toHaveProperty('actualCost');
  });
});
