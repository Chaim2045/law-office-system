/**
 * PR-3b hardening — the three guards that make the materialization script safe
 * to point at production.
 *
 * Every one of these was added because the FIRST dry-run against real data
 * showed what would have happened without it. They are pinned here so a future
 * edit cannot quietly remove them.
 *
 *  1. THE EXEMPTION LIST. Without it, `internal_office` would have had
 *     `hoursUsed: 620.08 → 0` and `isBlocked: true → false` — 620 hours of
 *     recorded usage erased and the client un-blocked, by a script whose stated
 *     purpose is to add one display field.
 *
 *  2. THE NEVER-AUTO-BLOCK GATE, inside the transaction. Enforces Haim's ruling
 *     of 2026-08-17: a client exposed as over-drawn is DISPLAYED as over-drawn,
 *     but nothing new blocks automatically. The first draft placed this check
 *     AFTER `runTransaction` resolved — worthless in apply mode, because by
 *     then the write has committed.
 *
 *  3. THE COMPARISON BASIS. The movement report must compare the RAW STORED
 *     document against what will be written — NOT `previousAggregates`, which
 *     is the writer's normalised view with `|| 0` defaults already applied.
 *     Using the wrong basis dropped the reported movement count from 22 to 0 on
 *     live data. A report that answers the wrong question confidently is worse
 *     than no report.
 */

'use strict';

const script = require('../../scripts/materialize-hours-capacity-2026-08-17');
const { processClient, _setDependencies, SKIP_CLIENTS } = script;

// ─── fakes ──────────────────────────────────────────────────────

/** A doc as returned by a collection scan. */
const makeDoc = (id, data) => ({ id, data: () => data });

function makeDb() {
  const committed = [];
  const db = {
    committed,
    collection: () => ({ doc: (id) => ({ id }) }),
    async runTransaction(fn) {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      await fn(tx);
      // Reaching here means the body did NOT throw → the transaction commits.
      committed.push(true);
    }
  };
  return db;
}

/** A writer that reports the aggregates it "computed", plus a normalised previous. */
function makeWriter(aggregates, previousAggregates) {
  const writer = jest.fn().mockResolvedValue({
    aggregates,
    previousAggregates: previousAggregates || aggregates,
    strippedKeys: [],
    written: true
  });
  return writer;
}

const AGG = {
  totalHours: 100, hoursUsed: 40, hoursRemaining: 60,
  minutesUsed: 2400, minutesRemaining: 3600,
  isBlocked: false, isCritical: false
};

let db;
beforeEach(() => {
  jest.clearAllMocks();
  db = makeDb();
});

// ═══════════════════════════════════════════════════════════════
// GUARD 1 — the exemption list
// ═══════════════════════════════════════════════════════════════

describe('guard 1 — exempt clients are never processed', () => {
  test('the list mirrors the reconciliation loop, which calls itself authoritative', () => {
    expect(SKIP_CLIENTS).toEqual(['internal_office', '2025003']);
  });

  test('internal_office is skipped, and the writer is never even called', () => {
    const writer = makeWriter(AGG);
    _setDependencies({ db, writer });

    return processClient(
      makeDoc('internal_office', { caseNumber: 'internal_office', hoursUsed: 620.08, isBlocked: true })
    ).then((r) => {
      expect(r.status).toBe('skipped_exempt');
      expect(writer).not.toHaveBeenCalled();
      expect(db.committed).toHaveLength(0);
    });
  });

  test('the exemption matches on the document id OR the caseNumber', async () => {
    const writer = makeWriter(AGG);
    _setDependencies({ db, writer });

    // id matches
    expect((await processClient(makeDoc('2025003', { caseNumber: 'other' }))).status)
      .toBe('skipped_exempt');
    // caseNumber matches
    expect((await processClient(makeDoc('some-doc-id', { caseNumber: '2025003' }))).status)
      .toBe('skipped_exempt');

    expect(writer).not.toHaveBeenCalled();
  });

  test('a skipped client is REPORTED, not silently dropped', async () => {
    _setDependencies({ db, writer: makeWriter(AGG) });
    const r = await processClient(makeDoc('internal_office', { caseNumber: 'internal_office' }));
    expect(r.caseNumber).toBe('internal_office');
    expect(r).toHaveProperty('status');
  });

  test('an ordinary client is NOT skipped', async () => {
    const writer = makeWriter(AGG);
    _setDependencies({ db, writer });
    const r = await processClient(makeDoc('c1', { caseNumber: '2025007' }));
    expect(r.status).not.toBe('skipped_exempt');
    expect(writer).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// GUARD 2 — never auto-block, INSIDE the transaction
// ═══════════════════════════════════════════════════════════════

describe('guard 2 — a write that would newly block a client is refused', () => {
  test('false → true is deferred, and the transaction does NOT commit', async () => {
    const writer = makeWriter({ ...AGG, isBlocked: true, hoursRemaining: -5 });
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025010', isBlocked: false }));

    expect(r.status).toBe('deferred_would_block');
    // The load-bearing assertion: nothing was committed. A guard that runs
    // after runTransaction resolves would fail this.
    expect(db.committed).toHaveLength(0);
    expect(r.aggregatesMoved.isBlocked).toEqual({ before: false, after: true });
  });

  test('an ABSENT isBlocked becoming true is also a new block', async () => {
    const writer = makeWriter({ ...AGG, isBlocked: true });
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025011' })); // no isBlocked
    expect(r.status).toBe('deferred_would_block');
    expect(db.committed).toHaveLength(0);
  });

  test('a client ALREADY blocked and staying blocked is not deferred', async () => {
    // Only NEW blocking is refused. Preserving an existing block is correct.
    const writer = makeWriter({ ...AGG, isBlocked: true });
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025012', isBlocked: true }));
    expect(r.status).not.toBe('deferred_would_block');
  });

  test('UN-blocking is never deferred — the gate is one-directional', async () => {
    const writer = makeWriter({ ...AGG, isBlocked: false });
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025013', isBlocked: true }));
    expect(r.status).not.toBe('deferred_would_block');
  });
});

// ═══════════════════════════════════════════════════════════════
// GUARD 3 — the comparison basis
// ═══════════════════════════════════════════════════════════════

describe('guard 3 — movements are measured against the STORED document', () => {
  test('an absent stored field becoming 0 IS reported', async () => {
    // The exact shape that exposed the bug: on case 2025007 the stored
    // `hoursUsed` is undefined while the writer's `previousAggregates` reports
    // 0. Comparing the two aggregate objects reports nothing; comparing against
    // the stored document reports the truth.
    const writer = makeWriter(
      { ...AGG, hoursUsed: 0, minutesUsed: 0 },
      { ...AGG, hoursUsed: 0, minutesUsed: 0 } // normalised — deliberately equal to `after`
    );
    _setDependencies({ db, writer });

    const r = await processClient(
      makeDoc('c1', { caseNumber: '2025007', totalHours: 100, hoursRemaining: 60, minutesRemaining: 3600 })
    );

    expect(r.aggregatesMoved).not.toBeNull();
    expect(r.aggregatesMoved.hoursUsed).toEqual({ before: null, after: 0 });
  });

  test('a document already matching the recompute reports NO movement', async () => {
    const writer = makeWriter(AGG);
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025014', ...AGG }));
    expect(r.aggregatesMoved).toBeNull();
  });

  test('a real numeric correction is reported with both values', async () => {
    const writer = makeWriter({ ...AGG, hoursUsed: 55, hoursRemaining: 45 });
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025015', ...AGG }));
    expect(r.aggregatesMoved.hoursUsed).toEqual({ before: 40, after: 55 });
    expect(r.aggregatesMoved.hoursRemaining).toEqual({ before: 60, after: 45 });
  });
});

// ═══════════════════════════════════════════════════════════════
// Dry-run and failure isolation
// ═══════════════════════════════════════════════════════════════

describe('dry-run and failure handling', () => {
  test('dry-run runs the writer but never commits', async () => {
    const writer = makeWriter(AGG);
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025016' }));

    expect(writer).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('would_write');
    expect(db.committed).toHaveLength(0); // the sentinel aborted it
  });

  test('a writer failure isolates to that client and records a code, not a stack', async () => {
    const writer = jest.fn().mockRejectedValue(
      Object.assign(new Error('invariant_violation:I1_no_billable_but_blocked'), { code: 'failed-precondition' })
    );
    _setDependencies({ db, writer });

    const r = await processClient(makeDoc('c1', { caseNumber: '2025017' }));

    expect(r.status).toBe('failed');
    expect(r.errorCode).toBe('failed-precondition');
    expect(r.errorMessage).toContain('invariant_violation');
    expect(db.committed).toHaveLength(0);
  });

  test('the report records whether the client already carried the field', async () => {
    _setDependencies({ db, writer: makeWriter(AGG) });

    const without = await processClient(makeDoc('c1', { caseNumber: '2025018' }));
    const with_ = await processClient(makeDoc('c2', { caseNumber: '2025019', hoursCapacity: { activeHours: 1 } }));

    expect(without.hadField).toBe(false);
    expect(with_.hadField).toBe(true);
  });
});
