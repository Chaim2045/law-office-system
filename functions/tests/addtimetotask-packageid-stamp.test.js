/**
 * PR-DRIFT-0 — fresh-only packageId stamp on the timesheet entry +
 * PR-DRIFT-2 — trigger-no-op regression pin (design §6 / §13).
 *
 * DRIFT-0 (design §10): the package id STAMPED on a timesheet entry must be the
 *   FRESH-resolved one (active/pending AND hoursRemaining>0), and `null` when the
 *   deduction fell to the depleted/overdraft fallback. Scoped to HOURS-only.
 *   Tested via the pure helper `resolveFreshStampPackageId` exported on `_test`.
 *     - fresh → stamped
 *     - depleted-fallback → null
 *     - non-HOURS (legal_procedure / "FIXED-stage") → keeps serviceIds.packageId
 *
 * TRIGGER NO-OP (design §6, fold 2-C/X-2): a packageId-only (+ repairStampedAt)
 *   UPDATE must produce ZERO hours mutation — the stamp's UPDATE leaves `minutes`
 *   unchanged → getMinutesDelta==0 → the zero-delta guard returns early →
 *   no re-deduction. Pinned here as the mandatory regression test, both at the
 *   pure-helper level (`getMinutesDelta`/`getEventType`) AND by driving the real
 *   trigger handler with a packageId-only UPDATE and asserting the canonical
 *   writer is NEVER invoked (no hours mutation).
 */
'use strict';

// ── Mock firebase-admin + firebase-functions for the addTimeToTask import ──────
jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n })),
    delete: jest.fn(() => 'DELETE_SENTINEL')
  };
  const Timestamp = {
    now: jest.fn(() => 'NOW'),
    fromDate: jest.fn((d) => ({ _date: d.toISOString() }))
  };
  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: Object.assign(() => ({ collection: jest.fn() }), { FieldValue, Timestamp })
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// DRIFT-0 — resolveFreshStampPackageId
// ═══════════════════════════════════════════════════════════════════════════
const { _test: addTimeTest } = require('../addTimeToTask_v2');
const { resolveFreshStampPackageId } = addTimeTest;

function pkg(id, { hours = 100, hoursUsed = 0, hoursRemaining, status, purchaseDate } = {}) {
  const rem = hoursRemaining === undefined ? Math.round((hours - hoursUsed) * 100) / 100 : hoursRemaining;
  return {
    id, hours, hoursUsed, hoursRemaining: rem,
    status: status || (rem > 0 ? 'active' : 'depleted'),
    purchaseDate: purchaseDate || '2026-01-01T00:00:00.000Z'
  };
}

describe('PR-DRIFT-0 — resolveFreshStampPackageId (fresh-only stamp)', () => {
  test('HOURS + fresh package → stamps the fresh package id', () => {
    const svc = { id: 's1', type: 'hours', packages: [pkg('p_fresh', { hours: 50, hoursUsed: 10 })] };
    // serviceIds.packageId came from the allowOverdraft=true lookup — here same id.
    expect(resolveFreshStampPackageId(svc, 'p_fresh')).toBe('p_fresh');
  });

  test('HOURS + ONLY depleted/overdraft fallback → stamps NULL (the fresh-only rule)', () => {
    // The only package is depleted (overdraft). lookupServiceIds (allowOverdraft=true)
    // would have returned it as serviceIds.packageId, but the FRESH-only stamp must be null.
    const svc = {
      id: 's1', type: 'hours',
      packages: [pkg('p_dep', { hours: 10, hoursUsed: 15, hoursRemaining: -5, status: 'overdraft' })]
    };
    expect(resolveFreshStampPackageId(svc, 'p_dep')).toBeNull();
  });

  test('HOURS + fresh AND depleted both present → stamps the FRESH one (not the fallback)', () => {
    const svc = {
      id: 's1', type: 'hours',
      packages: [
        pkg('p_dep', { hours: 10, hoursUsed: 15, hoursRemaining: -5, status: 'depleted', purchaseDate: '2026-01-01T00:00:00.000Z' }),
        pkg('p_fresh', { hours: 50, hoursUsed: 0, status: 'active', purchaseDate: '2026-02-01T00:00:00.000Z' })
      ]
    };
    // Even if serviceIds.packageId was the depleted one, the fresh-only resolve picks p_fresh.
    expect(resolveFreshStampPackageId(svc, 'p_dep')).toBe('p_fresh');
  });

  test('legal_procedure service ("FIXED-stage" path) → keeps serviceIds.packageId unchanged', () => {
    const svc = { id: 's1', type: 'legal_procedure', stages: [] };
    expect(resolveFreshStampPackageId(svc, 'pkg_from_lookup')).toBe('pkg_from_lookup');
    // and null stays null
    expect(resolveFreshStampPackageId(svc, null)).toBeNull();
  });

  test('fixed service → keeps serviceIds.packageId (non-HOURS scope)', () => {
    const svc = { id: 's1', type: 'fixed', work: { totalMinutesWorked: 0 } };
    expect(resolveFreshStampPackageId(svc, 'whatever')).toBe('whatever');
  });

  test('no target service → falls back to serviceIds.packageId (or null)', () => {
    expect(resolveFreshStampPackageId(null, 'x')).toBe('x');
    expect(resolveFreshStampPackageId(null, null)).toBeNull();
  });

  test('HOURS + overrideActive lets a deep-overdraft package still NOT count as fresh', () => {
    // override affects the deduction FLOOR, not freshness. A negative-remaining package
    // is never "fresh" → stamp is null even with override.
    const svc = {
      id: 's1', type: 'hours', overrideActive: true,
      packages: [pkg('p', { hours: 5, hoursUsed: 50, hoursRemaining: -45, status: 'depleted' })]
    };
    expect(resolveFreshStampPackageId(svc, 'p')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PR-DRIFT-2 — trigger no-op regression (packageId-only UPDATE → zero mutation)
// ═══════════════════════════════════════════════════════════════════════════
describe('PR-DRIFT-2 — trigger no-op on packageId-only UPDATE', () => {
  // Reset modules so the trigger gets its OWN admin + functions mocks below.
  let registeredHandler;
  let writeSpy;
  let mockTransaction;

  beforeAll(() => {
    jest.resetModules();

    mockTransaction = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
    const mockDb = {
      collection: jest.fn(() => ({ doc: jest.fn((id) => ({ id: id || 'auto_id' })) })),
      runTransaction: jest.fn(async (fn) => fn(mockTransaction))
    };

    jest.doMock('firebase-admin', () => {
      const FieldValue = { serverTimestamp: jest.fn(() => 'TS'), increment: jest.fn((n) => ({ _inc: n })) };
      const Timestamp = { now: jest.fn(() => 'NOW'), fromDate: jest.fn((d) => ({ _d: d.toISOString() })) };
      return { initializeApp: jest.fn(), firestore: Object.assign(() => mockDb, { FieldValue, Timestamp }) };
    });

    jest.doMock('firebase-functions/v2/firestore', () => ({
      onDocumentWritten: jest.fn((config, fn) => { registeredHandler = fn; return fn; })
    }));

    // Spy on the canonical writer — if it's called, hours WOULD be mutated.
    writeSpy = jest.fn(async () => ({}));
    jest.doMock('../shared/client-writer', () => ({
      writeClientWithCanonicalAggregates: writeSpy
    }));

    require('../triggers/timesheet-trigger');
  });

  afterAll(() => {
    jest.dontMock('firebase-admin');
    jest.dontMock('firebase-functions/v2/firestore');
    jest.dontMock('../shared/client-writer');
    jest.resetModules();
  });

  function makeEvent(before, after) {
    return {
      id: 'evt_1',
      params: { entryId: 'entry_1' },
      data: {
        before: { exists: !!before, data: () => before },
        after: { exists: !!after, data: () => after }
      }
    };
  }

  test('pure helpers: getMinutesDelta==0 for a packageId-only UPDATE (minutes unchanged)', () => {
    const { _test } = require('../triggers/timesheet-trigger');
    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: null };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p_assigned', repairStampedAt: 'TS' };
    expect(_test.getEventType(before, after)).toBe('UPDATE');
    expect(_test.getMinutesDelta('UPDATE', before, after)).toBe(0);
  });

  test('packageId-only UPDATE → zero-delta guard returns early → canonical writer NEVER called', async () => {
    writeSpy.mockClear();
    mockTransaction.update.mockClear();

    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: null };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p_assigned', repairStampedAt: 'TS' };

    const result = await registeredHandler(makeEvent(before, after));

    // Zero-delta, non-transfer UPDATE → handler returns null BEFORE the transaction.
    expect(result).toBeNull();
    // The canonical writer (the only path that mutates hours) was never reached.
    expect(writeSpy).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('control: a minutes-CHANGING UPDATE is NOT skipped (proves the guard is delta-based)', async () => {
    writeSpy.mockClear();
    // For this control we only need to prove the handler does NOT early-return on a
    // non-zero delta. We stub the transaction reads so the handler proceeds far enough
    // to attempt the client read (then bails on the mocked missing client) — the key
    // assertion is that it did NOT return at the zero-delta guard.
    mockTransaction.get.mockResolvedValue({ exists: false });

    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p1' };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 90, packageId: 'p1' };

    await registeredHandler(makeEvent(before, after));
    // It entered the transaction (idempotency + client read attempted) — not a zero-delta skip.
    expect(mockTransaction.get).toHaveBeenCalled();
  });
});
