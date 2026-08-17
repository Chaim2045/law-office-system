/**
 * PR-3b — the materialization script's movement detector.
 *
 * The script re-writes every client through the canonical writer so the
 * persisted `hoursCapacity` field exists everywhere. Re-writing recomputes ALL
 * aggregates, which means a client whose stored figures had drifted gets
 * CORRECTED — desirable, but never as a surprise. `diffWatched` is what makes
 * the dry-run report those corrections before anyone approves `--apply`.
 *
 * A detector that misses a movement turns a supervised backfill into a silent
 * mass edit, so it is pinned here rather than trusted.
 *
 * (Importing this script must have no side effects — Firestore is initialised
 * inside main(), not at module load. If that ever regresses, this file fails to
 * import, which is the intended alarm.)
 */

'use strict';

const { diffWatched, WATCHED } = require('../../scripts/materialize-hours-capacity-2026-08-17');

const base = {
  totalHours: 100,
  hoursUsed: 40,
  hoursRemaining: 60,
  minutesUsed: 2400,
  minutesRemaining: 3600,
  isBlocked: false,
  isCritical: false
};

describe('diffWatched — what the dry-run must surface', () => {
  test('identical figures report no movement', () => {
    expect(diffWatched(base, { ...base })).toEqual({});
  });

  test('a moved number is reported with both values', () => {
    const after = { ...base, hoursRemaining: 12.5 };
    expect(diffWatched(base, after)).toEqual({
      hoursRemaining: { before: 60, after: 12.5 }
    });
  });

  test('a flipped boolean is reported — this is the one an admin must see', () => {
    // isBlocked flipping false→true during a backfill would change who can log
    // hours. It must never pass silently.
    const after = { ...base, isBlocked: true };
    expect(diffWatched(base, after)).toEqual({
      isBlocked: { before: false, after: true }
    });
  });

  test('sub-cent float noise is NOT reported as movement', () => {
    // Otherwise every client looks like it moved and the report becomes noise
    // that nobody reads — the failure mode the plan warns about elsewhere.
    const after = { ...base, hoursRemaining: 60.004 };
    expect(diffWatched(base, after)).toEqual({});
  });

  test('a half-cent difference IS reported', () => {
    const after = { ...base, hoursRemaining: 60.006 };
    expect(diffWatched(base, after)).toHaveProperty('hoursRemaining');
  });

  test('an absent field becoming a number is reported, with null for the before', () => {
    const before = { ...base };
    delete before.hoursUsed;
    const moved = diffWatched(before, { ...base, hoursUsed: 40 });
    expect(moved.hoursUsed).toEqual({ before: null, after: 40 });
  });

  test('every watched field is actually checked', () => {
    // Guards against a field being added to the payload but forgotten here.
    for (const field of WATCHED) {
      const after = { ...base };
      after[field] = typeof base[field] === 'boolean' ? !base[field] : 999;
      expect(Object.keys(diffWatched(base, after))).toContain(field);
    }
  });

  test('the watched set covers every aggregate the canonical writer derives', () => {
    // `hoursCapacity` is deliberately absent: it is the field being ADDED, so
    // it moves on every client by definition and would drown the report.
    expect(WATCHED.sort()).toEqual([
      'hoursRemaining', 'hoursUsed', 'isBlocked', 'isCritical',
      'minutesRemaining', 'minutesUsed', 'totalHours'
    ]);
  });
});
