/**
 * Tests for writeServiceWithCanonicalPackages — the LIVE single-owner for a
 * HOURS service's package aggregates (OWN-1).
 *
 * Strategy: integration-style. The REAL owner drives the REAL forward-replay
 * engine (package-repair-core) and the REAL client owner (client-writer); only
 * the Firestore SDK boundary (firebase-admin / firebase-functions) is mocked —
 * exactly the boundary writeClientWithCanonicalAggregates is tested against.
 * This exercises the full owner → engine → client-owner → transaction.update
 * path (G4: proves the customer scenario, not just a helper in isolation).
 *
 * Contract under test (see service-writer.js header):
 *   - ONE in-txn read (transaction.get(clientRef)); entries supplied from outside.
 *   - Recompute-from-ledger (never +=Δ): a drifted package.hoursUsed is corrected
 *     to Σ assigned-entry-minutes/60, orphans (packageId:null) included.
 *   - D2: override / overdraft-resolved services are SKIPPED (no write).
 *   - A5 optimistic guard aborts on a concurrent client-doc write.
 *   - Invariant fail-safe: refuse to write if serviceAfter ≠ ledgerTruth.
 *   - Delegates the single write to the client owner; auditFn runs AFTER
 *     (writer-before-audit / reads-before-writes).
 *   - DEAD CODE: no live module require()s it.
 */

// ═══════════════════════════════════════════════════════════════
// Mocks — must precede require()
// ═══════════════════════════════════════════════════════════════

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => ({ collection: jest.fn() }), { FieldValue })
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
    https: { HttpsError },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

// Wrap the engine so a single test can force an invariant failure. Default = the
// real implementation (every other test exercises the genuine ledger-truth math).
jest.mock('../shared/package-repair-core', () => {
  const actual = jest.requireActual('../shared/package-repair-core');
  return {
    ...actual,
    computeRepairedService: jest.fn(actual.computeRepairedService)
  };
});

// ═══════════════════════════════════════════════════════════════
// Requires — after mocks
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { writeServiceWithCanonicalPackages } = require('../shared/service-writer');
const repairCore = require('../shared/package-repair-core');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ═══════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════

const clientRef = { id: 'c1', path: 'clients/c1' };

/** A fake Firestore Timestamp with a value-based isEqual (for the A5 guard). */
function makeUpdateTime(token) {
  return { _t: token, isEqual(o) { return !!o && o._t === token; } };
}

/**
 * A single-package HOURS service. The package starts with a (possibly drifted)
 * stored hoursUsed so tests can prove the owner recomputes-from-ledger.
 */
function makeHoursService(id, {
  totalHours = 10,
  storedHoursUsed = 0,
  status = 'active',
  overrideActive = false,
  overdraftResolved = null,
  packages = null
} = {}) {
  const pkgs = packages || [{
    id: `${id}_p1`,
    hours: totalHours,
    hoursUsed: storedHoursUsed,
    hoursRemaining: totalHours - storedHoursUsed,
    status: 'active',
    purchaseDate: '2026-01-01T00:00:00.000Z'
  }];
  const svc = {
    id,
    type: ST.HOURS,
    name: 'שירות שעתי',
    totalHours,
    hoursUsed: storedHoursUsed,
    hoursRemaining: totalHours - storedHoursUsed,
    status,
    packages: pkgs
  };
  if (overrideActive) svc.overrideActive = true;
  if (overdraftResolved) svc.overdraftResolved = overdraftResolved;
  return svc;
}

function makeFixedService(id) {
  return { id, type: ST.FIXED, name: 'שירות קבוע', fixedPrice: 5000, status: 'active' };
}

function makeClientDoc(services, { updateTimeToken = 'v1', exists = true } = {}) {
  return {
    exists,
    updateTime: makeUpdateTime(updateTimeToken),
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      services,
      totalHours: 0,
      hoursUsed: 0,
      hoursRemaining: 0
    })
  };
}

function makeEntry(id, minutes, { packageId = null, createdAt = '2026-02-01T10:00:00.000Z', serviceId = 's1' } = {}) {
  return { id, minutes, packageId, createdAt, serviceId };
}

/** Recording mock transaction (jest.fn ops — for call-order + payload capture). */
function recordingTxn(doc) {
  return {
    get: jest.fn().mockResolvedValue(doc),
    update: jest.fn(),
    set: jest.fn()
  };
}

/**
 * Strict mock transaction that ENFORCES Firestore reads-before-writes: a get
 * after any write throws, exactly as the production SDK does. Mirrors the
 * package-repair-core.test.js strictTxn used to pin applyRepairWritesInOrder.
 */
function strictTxn(doc) {
  let wrote = false;
  const ops = [];
  return {
    ops,
    get: jest.fn(() => {
      if (wrote) {
        throw new Error('Firestore transactions require all reads to be executed before all writes.');
      }
      ops.push('get');
      return Promise.resolve(doc);
    }),
    update: jest.fn(() => { wrote = true; ops.push('update'); }),
    set: jest.fn(() => { wrote = true; ops.push('set'); })
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // restore the real engine impl after any mockImplementationOnce
  repairCore.computeRepairedService.mockImplementation(
    jest.requireActual('../shared/package-repair-core').computeRepairedService
  );
});

// ═══════════════════════════════════════════════════════════════
// A. Input validation
// ═══════════════════════════════════════════════════════════════

describe('A. Input validation', () => {
  test('throws when transaction is missing', async () => {
    await expect(
      writeServiceWithCanonicalPackages(null, clientRef, { serviceId: 's1' }, { caller: 't' })
    ).rejects.toThrow(/transaction/i);
  });

  test('throws when clientRef is missing', async () => {
    await expect(
      writeServiceWithCanonicalPackages({}, null, { serviceId: 's1' }, { caller: 't' })
    ).rejects.toThrow(/clientRef/i);
  });

  test('throws when data is null', async () => {
    await expect(
      writeServiceWithCanonicalPackages({}, clientRef, null, { caller: 't' })
    ).rejects.toThrow(/data/i);
  });

  test('throws when options.caller is missing', async () => {
    await expect(
      writeServiceWithCanonicalPackages({}, clientRef, { serviceId: 's1' }, {})
    ).rejects.toThrow(/caller/i);
  });

  test('throws when data.serviceId is missing', async () => {
    await expect(
      writeServiceWithCanonicalPackages({}, clientRef, { entriesForService: [] }, { caller: 't' })
    ).rejects.toThrow(/serviceId/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Read + not-found + service-not-found
// ═══════════════════════════════════════════════════════════════

describe('B. Read semantics', () => {
  test('reads the client via transaction.get(clientRef)', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1')]));
    await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't', mode: 'enforce' }
    );
    expect(tx.get).toHaveBeenCalledWith(clientRef);
  });

  test('throws not_found when the client does not exist', async () => {
    const tx = recordingTxn({ exists: false });
    await expect(
      writeServiceWithCanonicalPackages(
        tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't' }
      )
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('throws service_not_found when the serviceId is absent', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1')]));
    await expect(
      writeServiceWithCanonicalPackages(
        tx, clientRef, { serviceId: 'NOPE', entriesForService: [] }, { caller: 't' }
      )
    ).rejects.toMatchObject({ code: 'service_not_found' });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// C. A5 optimistic-concurrency guard
// ═══════════════════════════════════════════════════════════════

describe('C. A5 optimistic-concurrency guard', () => {
  test('aborts (code=aborted) when the client doc changed since the entries were read', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1')], { updateTimeToken: 'v2' }));
    await expect(
      writeServiceWithCanonicalPackages(
        tx, clientRef,
        { serviceId: 's1', entriesForService: [], clientUpdateTimeAtRead: makeUpdateTime('v1') },
        { caller: 't' }
      )
    ).rejects.toMatchObject({ code: 'aborted' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('proceeds when updateTime matches', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1')], { updateTimeToken: 'v1' }));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [], clientUpdateTimeAtRead: makeUpdateTime('v1') },
      { caller: 't', mode: 'enforce' }
    );
    expect(result.written).toBe(true);
  });

  test('proceeds without the guard when clientUpdateTimeAtRead is omitted', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1')]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't', mode: 'enforce' }
    );
    expect(result.written).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Eligibility — D2 skips (override / overdraft-resolved / structural)
// ═══════════════════════════════════════════════════════════════

describe('D. Eligibility / D2 skip', () => {
  test('overrideActive service is SKIPPED (no write) — partner override preserved', async () => {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { overrideActive: true, storedHoursUsed: 8 })
    ]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
      { caller: 't' }
    );
    expect(result).toMatchObject({ written: false, skipped: true, reason: 'override_preserved' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('overdraftResolved service is SKIPPED (no write)', async () => {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { overdraftResolved: { isResolved: true } })
    ]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't' }
    );
    expect(result).toMatchObject({ written: false, skipped: true, reason: 'overdraft_resolved' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('non-HOURS service is SKIPPED (reason not_hours)', async () => {
    const tx = recordingTxn(makeClientDoc([makeFixedService('s1')]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't' }
    );
    expect(result).toMatchObject({ written: false, skipped: true, reason: 'not_hours' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('HOURS service with zero packages is SKIPPED (reason no_packages) — DRIFT-3 surface, not OWN-1', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1', { packages: [] })]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't' }
    );
    expect(result).toMatchObject({ written: false, skipped: true, reason: 'no_packages' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('archived service is SKIPPED (reason archived)', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1', { status: 'archived' })]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't' }
    );
    expect(result).toMatchObject({ written: false, skipped: true, reason: 'archived' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test('overrideServicePolicy:"recompute" FORCES recompute of an override service', async () => {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { overrideActive: true, storedHoursUsed: 8 })
    ]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce', overrideServicePolicy: 'recompute' }
    );
    expect(result.written).toBe(true);
    expect(result.serviceAfter).toBe(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  test('overrideServicePolicy:"recompute" does NOT resurrect a structural skip (non-hours stays skipped)', async () => {
    const tx = recordingTxn(makeClientDoc([makeFixedService('s1')]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] },
      { caller: 't', overrideServicePolicy: 'recompute' }
    );
    expect(result).toMatchObject({ written: false, skipped: true, reason: 'not_hours' });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Recompute-from-ledger (the heart of OWN-1)
// ═══════════════════════════════════════════════════════════════

describe('E. Recompute-from-ledger', () => {
  // Drifted package (stored 8h) + 3h of real entries, ONE of them a packageId:null
  // orphan → the owner corrects 8h → 3h AND counts the orphan (else it would be 2h).
  function setup() {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { totalHours: 10, storedHoursUsed: 8 })
    ]));
    const entries = [
      makeEntry('e1', 60, { packageId: 's1_p1' }),
      makeEntry('e2', 60, { packageId: null }),       // orphan — MUST be attributed
      makeEntry('e3', 60, { packageId: 's1_p1' })
    ];
    return { tx, entries };
  }

  test('corrects the drifted package.hoursUsed to the ledger truth (8h → 3h)', async () => {
    const { tx, entries } = setup();
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: entries }, { caller: 't', mode: 'enforce' }
    );
    expect(result).toMatchObject({
      written: true, skipped: false, reason: null,
      serviceBefore: 8, serviceAfter: 3, ledgerTruth: 3, invariantOk: true
    });
  });

  test('orphan (packageId:null) is counted (serviceAfter=3 includes e2, not 2)', async () => {
    const { tx, entries } = setup();
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: entries }, { caller: 't', mode: 'enforce' }
    );
    expect(result.ledgerTruth).toBe(3); // 3×60min, the null entry included
    expect(result.unresolved).toEqual([]);
  });

  test('writes the corrected aggregates through the client owner (single update)', async () => {
    const { tx, entries } = setup();
    await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: entries }, { caller: 't', mode: 'enforce' }
    );
    expect(tx.update).toHaveBeenCalledTimes(1);
    const [, payload] = tx.update.mock.calls[0];
    // service-level (recomputed)
    expect(payload.services[0].hoursUsed).toBe(3);
    expect(payload.services[0].hoursRemaining).toBe(7);
    // package-level (recomputed — the drifted 8 is gone)
    expect(payload.services[0].packages[0].hoursUsed).toBe(3);
    expect(payload.services[0].packages[0].hoursRemaining).toBe(7);
    expect(payload.services[0].packages[0].status).toBe('active');
    // client-level roll-up (the client owner recomputed it)
    expect(payload.hoursUsed).toBe(3);
    expect(payload.hoursRemaining).toBe(7);
    expect(payload.totalHours).toBe(10);
    expect(payload.isBlocked).toBe(false);
  });

  test('read-only intake fields (totalHours/type) pass through untouched (Q4)', async () => {
    const { tx, entries } = setup();
    await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: entries }, { caller: 't', mode: 'enforce' }
    );
    const [, payload] = tx.update.mock.calls[0];
    expect(payload.services[0].totalHours).toBe(10); // intake — never written by the owner
    expect(payload.services[0].type).toBe(ST.HOURS);
  });

  test('BC-2 nested lock: an absurdly drifted stored package.hoursUsed is overwritten, never trusted', async () => {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', {
        totalHours: 10,
        packages: [{
          id: 's1_p1', hours: 10, hoursUsed: 999, hoursRemaining: -989, status: 'depleted',
          purchaseDate: '2026-01-01T00:00:00.000Z'
        }]
      })
    ]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 120, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce' }
    );
    expect(result.serviceAfter).toBe(2);
    const [, payload] = tx.update.mock.calls[0];
    expect(payload.services[0].packages[0].hoursUsed).toBe(2); // 999 → 2 (ledger truth)
    expect(payload.services[0].packages[0].status).toBe('active');
  });

  test('other services on the client pass through byte-identical (single-owner: per-service)', async () => {
    const other = makeFixedService('s2');
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { totalHours: 10, storedHoursUsed: 8 }),
      other
    ]));
    await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce' }
    );
    const [, payload] = tx.update.mock.calls[0];
    const s2 = payload.services.find((s) => s.id === 's2');
    expect(s2).toEqual(other); // untouched
  });

  test('extraClientFields are written atomically (non-aggregate) on the client', async () => {
    const { tx, entries } = setup();
    await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: entries, extraClientFields: { status: 'active', note: 'x' } },
      { caller: 't', mode: 'enforce' }
    );
    const [, payload] = tx.update.mock.calls[0];
    expect(payload.note).toBe('x');
  });

  test('extraClientFields CANNOT clobber the recomputed services[] (single-owner un-bypassable)', async () => {
    const { tx, entries } = setup();
    await writeServiceWithCanonicalPackages(
      tx, clientRef,
      {
        serviceId: 's1',
        entriesForService: entries,
        // a buggy/malicious caller tries to bypass the recompute via extraClientFields
        extraClientFields: { note: 'x', services: [{ id: 'BOGUS', type: ST.HOURS, totalHours: 999, hoursUsed: 999, packages: [] }] }
      },
      { caller: 't', mode: 'enforce' }
    );
    const [, payload] = tx.update.mock.calls[0];
    // the recomputed service wins; the bogus injected service is gone
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].id).toBe('s1');
    expect(payload.services[0].hoursUsed).toBe(3); // ledger truth, NOT 999
    expect(payload.note).toBe('x');                // the non-aggregate field still lands
  });

  test('empty entry set zeroes the package (phantom reversal) when the service truly has no entries', async () => {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { totalHours: 10, storedHoursUsed: 5 })
    ]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't', mode: 'enforce' }
    );
    expect(result.serviceAfter).toBe(0);
    expect(result.phantomReversals.length).toBe(1);
    const [, payload] = tx.update.mock.calls[0];
    expect(payload.services[0].packages[0].hoursUsed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Invariant fail-safe
// ═══════════════════════════════════════════════════════════════

describe('F. Invariant fail-safe', () => {
  test('refuses to write (throws invariant_violation) when serviceAfter ≠ ledgerTruth', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1')]));
    repairCore.computeRepairedService.mockImplementationOnce(() => ({
      invariantOk: false, serviceAfter: 5, ledgerTruth: 3,
      repairedService: {}, packageDiffs: [], phantomReversals: [], serviceBefore: 0
    }));
    await expect(
      writeServiceWithCanonicalPackages(
        tx, clientRef,
        { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
        { caller: 't', mode: 'enforce' }
      )
    ).rejects.toMatchObject({ code: 'invariant_violation' });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Writer-before-audit ordering + audit injection
// ═══════════════════════════════════════════════════════════════

describe('G. Writer-before-audit ordering', () => {
  test('auditFn runs AFTER the client write, and the write happens once', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1', { storedHoursUsed: 8 })]));
    const auditFn = jest.fn((t) => t.set({ path: 'audit_log/x' }, { action: 'OWN1' }));
    await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce', auditFn }
    );
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(auditFn).toHaveBeenCalledTimes(1);
    expect(auditFn).toHaveBeenCalledWith(tx);
    // ordering: the client write (update) precedes the audit (set)
    const updateOrder = tx.update.mock.invocationCallOrder[0];
    const auditOrder = tx.set.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(auditOrder);
  });

  test('reads-before-writes is respected on a STRICT transaction (no read-after-write abort)', async () => {
    const tx = strictTxn(makeClientDoc([makeHoursService('s1', { storedHoursUsed: 8 })]));
    const auditFn = (t) => t.set({}, {});
    await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce', auditFn }
    );
    // both reads (owner + client-owner) precede both writes (update + audit set)
    expect(tx.ops).toEqual(['get', 'get', 'update', 'set']);
  });

  test('no auditFn → still writes once, no throw', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1', { storedHoursUsed: 8 })]));
    await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 60, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce' }
    );
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.set).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Return value
// ═══════════════════════════════════════════════════════════════

describe('H. Return value', () => {
  test('recompute returns the full structured result', async () => {
    const tx = recordingTxn(makeClientDoc([makeHoursService('s1', { storedHoursUsed: 8 })]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef,
      { serviceId: 's1', entriesForService: [makeEntry('e1', 120, { packageId: 's1_p1' })] },
      { caller: 't', mode: 'enforce' }
    );
    expect(result).toMatchObject({
      written: true, skipped: false, reason: null, serviceId: 's1',
      serviceBefore: 8, serviceAfter: 2, ledgerTruth: 2, invariantOk: true
    });
    expect(Array.isArray(result.packageDiffs)).toBe(true);
    expect(Array.isArray(result.phantomReversals)).toBe(true);
    expect(result.clientWriteResult).toBeTruthy();
  });

  test('skip returns a minimal result with the reason + serviceBefore', async () => {
    const tx = recordingTxn(makeClientDoc([
      makeHoursService('s1', { overrideActive: true, storedHoursUsed: 7 })
    ]));
    const result = await writeServiceWithCanonicalPackages(
      tx, clientRef, { serviceId: 's1', entriesForService: [] }, { caller: 't' }
    );
    expect(result).toEqual({
      written: false, skipped: true, reason: 'override_preserved', serviceId: 's1', serviceBefore: 7
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// I. OWN-1 is DEAD CODE — wired to nothing (the safety invariant)
// ═══════════════════════════════════════════════════════════════

describe('I. Dead-code invariant', () => {
  function walkJs(dir, acc) {
    for (const name of fs.readdirSync(dir)) {
      if (['node_modules', 'lib', 'coverage', '.git'].includes(name)) continue;
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch (_e) { continue; }
      if (st.isDirectory()) walkJs(full, acc);
      else if (name.endsWith('.js')) acc.push(full);
    }
    return acc;
  }

  test('no live functions module require()s service-writer (it must stay unwired until OWN-2/3)', () => {
    const functionsRoot = path.join(__dirname, '..');
    const files = walkJs(functionsRoot, []);
    const requireRe = /require\(\s*['"][^'"]*service-writer['"]\s*\)/;
    const offenders = [];
    for (const f of files) {
      const base = path.basename(f);
      if (base === 'service-writer.js') continue;           // the module itself
      if (base.endsWith('.test.js')) continue;              // test files
      if (f.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(f, 'utf8');
      if (requireRe.test(src)) offenders.push(path.relative(functionsRoot, f));
    }
    expect(offenders).toEqual([]);
  });
});
