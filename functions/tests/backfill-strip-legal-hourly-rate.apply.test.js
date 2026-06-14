/**
 * backfill-strip-legal-hourly-rate.apply.test.js — apply-path integration (2026-06-14)
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers the PRODUCTION write path of the migration — `migrateClientInTxn` — which
 * the pure-core suite cannot reach. The load-bearing assertion: the canonical writer
 * is AWAITED so its internal read+update complete BEFORE the audit `tx.set`
 * (Firestore requires all reads before all writes). A missing `await` would reorder
 * these — this test fails loudly if it regresses.
 *
 * Also exercises the in-txn re-verification branches: idempotent no-op, anomaly,
 * aggregate-drift, and a vanished doc. The SDK boundary (writer / audit / aggregates)
 * is mocked; the migration's own control flow is real.
 */

jest.mock('firebase-admin', () => ({ apps: [], initializeApp: jest.fn(), firestore: () => ({}) }));

jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: jest.fn(),
  _recomputeTotalHours: jest.fn()
}));
jest.mock('../shared/aggregates', () => ({
  calcClientAggregates: jest.fn(),
  NON_AGGREGATING_STATUSES: ['archived']
}));
jest.mock('../lib/audit-critical', () => ({
  logCriticalActionInTxn: jest.fn()
}));

const { migrateClientInTxn } = require('../scripts/backfill-strip-legal-hourly-rate');
const clientWriter = require('../shared/client-writer');
const aggregates = require('../shared/aggregates');
const audit = require('../lib/audit-critical');

const REF = { id: '2099001' };

// Stored aggregates that match the default recompute below (so no drift by default).
const HEALTHY_AGG = { totalHours: 10, hoursUsed: 0, hoursRemaining: 10, minutesUsed: 0, minutesRemaining: 600, isBlocked: false, isCritical: false };

function legalHourly(extra = {}) {
  return { id: 's_lh', type: 'legal_procedure', pricingType: 'hourly', status: 'active', totalHours: 10, ...extra };
}

/** A mock transaction that records the ORDER of get/update/set across the whole txn. */
function makeTx(docData, exists = true) {
  const order = [];
  const tx = {
    get: jest.fn(async () => { order.push('read'); return { exists, data: () => docData }; }),
    update: jest.fn(() => order.push('writer-update')),
    set: jest.fn(() => order.push('audit-set'))
  };
  return { tx, order };
}

beforeEach(() => {
  jest.clearAllMocks();
  clientWriter._recomputeTotalHours.mockReturnValue(10);
  aggregates.calcClientAggregates.mockReturnValue({ hoursUsed: 0, hoursRemaining: 10, minutesUsed: 0, minutesRemaining: 600, isBlocked: false, isCritical: false });
  // The real writer awaits an internal read then updates. Simulate that async gap.
  clientWriter.writeClientWithCanonicalAggregates.mockImplementation(async (tx) => {
    await Promise.resolve();
    tx.update();
  });
  audit.logCriticalActionInTxn.mockImplementation((tx) => { tx.set(); });
});

describe('migrateClientInTxn — write ordering (the missing-await regression guard)', () => {
  test('AWAITS the writer BEFORE the audit set → order is read, writer-update, audit-set', async () => {
    const { tx, order } = makeTx({ services: [legalHourly({ ratePerHour: 800 })], ...HEALTHY_AGG });
    const result = await migrateClientInTxn(tx, REF);

    expect(result).toBe('written');
    expect(order).toEqual(['read', 'writer-update', 'audit-set']); // NOT ['read','audit-set','writer-update']
    expect(clientWriter.writeClientWithCanonicalAggregates).toHaveBeenCalledTimes(1);
    expect(audit.logCriticalActionInTxn).toHaveBeenCalledTimes(1);
  });

  test('passes the cleaned services (ratePerHour stripped) + enforce mode to the writer', async () => {
    const { tx } = makeTx({ services: [legalHourly({ ratePerHour: 800 })], ...HEALTHY_AGG });
    await migrateClientInTxn(tx, REF);

    const [, ref, payload, opts] = clientWriter.writeClientWithCanonicalAggregates.mock.calls[0];
    expect(ref).toBe(REF);
    expect('ratePerHour' in payload.services[0]).toBe(false);
    expect(opts).toMatchObject({ mode: 'enforce' });
    expect('auditMeta' in opts).toBe(false); // do not overwrite human lastModified*
  });
});

describe('migrateClientInTxn — in-txn re-verification branches', () => {
  test('no 800 to strip (migrated concurrently) → noop, no writer/audit', async () => {
    const { tx, order } = makeTx({ services: [legalHourly()], ...HEALTHY_AGG }); // no ratePerHour
    const result = await migrateClientInTxn(tx, REF);
    expect(result).toBe('noop');
    expect(order).toEqual(['read']);
    expect(clientWriter.writeClientWithCanonicalAggregates).not.toHaveBeenCalled();
    expect(audit.logCriticalActionInTxn).not.toHaveBeenCalled();
  });

  test('an elected rate appeared since discovery → throws ANOMALY_APPEARED, no write', async () => {
    const { tx } = makeTx({ services: [legalHourly({ ratePerHour: 1200 })], ...HEALTHY_AGG });
    await expect(migrateClientInTxn(tx, REF)).rejects.toMatchObject({ code: 'ANOMALY_APPEARED' });
    expect(clientWriter.writeClientWithCanonicalAggregates).not.toHaveBeenCalled();
  });

  test('stored aggregates drift from canonical → throws AGGREGATE_DRIFT_APPEARED, no write', async () => {
    // Recompute says isBlocked:true, but the stored doc says false → drift.
    aggregates.calcClientAggregates.mockReturnValue({ hoursUsed: 0, hoursRemaining: 10, minutesUsed: 0, minutesRemaining: 600, isBlocked: true, isCritical: false });
    const { tx } = makeTx({ services: [legalHourly({ ratePerHour: 800 })], ...HEALTHY_AGG }); // stored isBlocked:false
    await expect(migrateClientInTxn(tx, REF)).rejects.toMatchObject({ code: 'AGGREGATE_DRIFT_APPEARED' });
    expect(clientWriter.writeClientWithCanonicalAggregates).not.toHaveBeenCalled();
  });

  test('doc vanished between discovery and apply → throws CLIENT_VANISHED', async () => {
    const { tx } = makeTx(null, false);
    await expect(migrateClientInTxn(tx, REF)).rejects.toMatchObject({ code: 'CLIENT_VANISHED' });
  });

  test('null service slot in the live doc → throws NULL_ENTRY_APPEARED, no write', async () => {
    const { tx } = makeTx({ services: [null, legalHourly({ ratePerHour: 800 })], ...HEALTHY_AGG });
    await expect(migrateClientInTxn(tx, REF)).rejects.toMatchObject({ code: 'NULL_ENTRY_APPEARED' });
    expect(clientWriter.writeClientWithCanonicalAggregates).not.toHaveBeenCalled();
  });
});
