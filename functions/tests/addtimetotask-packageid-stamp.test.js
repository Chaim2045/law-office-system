/**
 * OWN-0(a) — trigger CREATE-fallback packageId stamp + the retained zero-delta
 * no-op pin (was PR-DRIFT-2; the DRIFT-0 `resolveFreshStampPackageId` block was
 * removed when OWN-0(b) replaced the fresh-only stamp with a deduction-target
 * stamp — see add-time-to-task-canonical-helper.test.js "F. OWN-0(b)").
 *
 * OWN-0(a): when the trigger's CREATE-fallback resolves a missing packageId and
 *   deducts into it, Write-2 persists `{ packageId, deductedInTransaction:true }`
 *   on the entry so it is NOT left a package-counted-null orphan, and a coalesced
 *   re-CREATE is skipped by the deductedInTransaction guard.
 *
 * ZERO-DELTA / SELF-WRITE no-op (retained): a packageId-only (minutes-unchanged)
 *   UPDATE produces ZERO hours mutation — either the self-write guard (changed keys
 *   ⊆ {isOverage,overageMinutes,packageId,deductedInTransaction}) or the zero-delta
 *   guard returns before the transaction. Pinned by driving the real handler.
 */
'use strict';

describe('OWN-0(a) — trigger CREATE-fallback stamp + zero-delta no-op', () => {
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

  function makeEvent(before, after, id = 'evt_1') {
    return {
      id,
      params: { entryId: 'entry_1' },
      data: {
        before: { exists: !!before, data: () => before },
        after: { exists: !!after, data: () => after }
      }
    };
  }

  // ── OWN-0(a): CREATE-fallback resolves a missing packageId → Write-2 stamps it ──
  test('CREATE with no packageId on a HOURS service → entry stamped {packageId, deductedInTransaction:true}', async () => {
    writeSpy.mockClear();
    mockTransaction.get.mockReset();
    mockTransaction.update.mockClear();

    const clientData = {
      totalHours: 50,
      services: [{
        id: 's1', type: 'hours', totalHours: 50,
        packages: [{ id: 'p1', hours: 50, hoursUsed: 0, hoursRemaining: 50, status: 'active', purchaseDate: '2026-01-01T00:00:00.000Z' }]
      }]
    };
    // 1st get = idempotency (not processed), 2nd get = client doc. No taskId → no task get.
    mockTransaction.get
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, data: () => clientData });

    // CREATE: before doesn't exist; after has NO packageId and is NOT deductedInTransaction.
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: null };
    await registeredHandler(makeEvent(null, after));

    // Write-1 (client) happened, and Write-2 (entry) carries the stamp.
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const entryUpdate = mockTransaction.update.mock.calls
      .map((c) => c[1])
      .find((p) => p && 'packageId' in p);
    expect(entryUpdate).toBeDefined();
    expect(entryUpdate.packageId).toBe('p1');
    expect(entryUpdate.deductedInTransaction).toBe(true);
  });

  // ── Retained no-op pins ──
  test('pure helpers: getMinutesDelta==0 for a packageId-only UPDATE (minutes unchanged)', () => {
    const { _test } = require('../triggers/timesheet-trigger');
    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: null };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p_assigned', repairStampedAt: 'TS' };
    expect(_test.getEventType(before, after)).toBe('UPDATE');
    expect(_test.getMinutesDelta('UPDATE', before, after)).toBe(0);
  });

  test('packageId-only UPDATE (with repairStampedAt) → zero-delta guard → canonical writer NEVER called', async () => {
    writeSpy.mockClear();
    mockTransaction.update.mockClear();

    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: null };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p_assigned', repairStampedAt: 'TS' };

    const result = await registeredHandler(makeEvent(before, after));
    expect(result).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('OWN-0(a): trigger self-write re-fire (packageId + deductedInTransaction, minutes unchanged) → self-write guard skips', async () => {
    writeSpy.mockClear();
    mockTransaction.update.mockClear();

    // Exactly the fields Write-2 stamps on the CREATE-fallback path.
    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: null, isOverage: false, overageMinutes: 0 };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p1', deductedInTransaction: true, isOverage: false, overageMinutes: 0 };

    const result = await registeredHandler(makeEvent(before, after));
    expect(result).toBeNull();             // skipped at the self-write guard
    expect(writeSpy).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('OWN-0(a) tripwire: a packageId-ONLY change (minutes unchanged) is skipped — pins the future-reassignment trap', async () => {
    writeSpy.mockClear();
    mockTransaction.update.mockClear();
    // changed keys = exactly {packageId}. A FUTURE flow that reassigns packageId and
    // EXPECTS the trigger to move hours would be silently skipped here — by the
    // self-write guard (packageId ∈ triggerFields) and, independently, the zero-delta
    // guard (minutes unchanged). timesheet-trigger.js documents that such a flow MUST
    // revisit the guard; this test makes the behavior a red tripwire, not a surprise.
    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'pA' };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'pB' };
    const result = await registeredHandler(makeEvent(before, after));
    expect(result).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('control: a minutes-CHANGING UPDATE is NOT skipped (proves the guards are delta-based)', async () => {
    writeSpy.mockClear();
    mockTransaction.get.mockReset();
    mockTransaction.get.mockResolvedValue({ exists: false });

    const before = { clientId: 'c1', serviceId: 's1', minutes: 60, packageId: 'p1' };
    const after = { clientId: 'c1', serviceId: 's1', minutes: 90, packageId: 'p1' };

    await registeredHandler(makeEvent(before, after));
    expect(mockTransaction.get).toHaveBeenCalled();   // entered the transaction (not a zero-delta skip)
  });
});
