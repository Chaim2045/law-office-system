/**
 * Truncation-loudness guard for ClientsDataManager's two capped Firestore loaders.
 *
 * apps/admin-panel/js/managers/ClientsDataManager.js loads `timesheet_entries`
 * and `budget_tasks` client-side with a `.limit(N)` cap. Firestore returns
 * EXACTLY N docs when the true collection size is >= N, with no error and no
 * indication anything was dropped. Because `timesheet_entries` is sorted
 * `date desc`, the docs silently dropped are always the OLDEST ones - so every
 * client-side computation in the admin panel would start reporting numbers
 * missing historical entries, invisibly.
 *
 * PROD measured 2026-07-22: 4,962 of 5,000 timesheet_entries (cap was about to
 * be crossed). This PR (a) raises both caps 5000 -> 10000 with headroom, and
 * (b) makes hitting the cap LOUD via `warnIfTruncated` - a structured
 * `console.error` (never `.log`/`.warn`) naming the collection + limit +
 * "INCOMPLETE" + "oldest records missing", plus a best-effort admin-facing
 * toast via the app's existing `window.notify` if it's loaded.
 *
 * These tests prove the customer scenario (G4):
 *   - fewer docs than the limit -> silent, no truncation error (the normal case)
 *   - exactly the limit -> LOUD console.error naming the collection (the trap)
 *   - the guard never throws on empty / malformed / undefined snapshots
 *   - BOTH loaders are guarded independently (a test that fails if only one is)
 *   - no PII (client names, employee emails, entry descriptions) in the message
 *
 * Created: 2026-07-22 — fix/admin-entry-limit-guard
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// @ts-ignore — classic admin-panel script, no type declarations. Loading it
// executes `(function(){ ... })()` and attaches the singleton to window.
import '../../../apps/admin-panel/js/managers/ClientsDataManager.js';

const manager: any = (window as any).ClientsDataManager;

// Build a fake Firestore QuerySnapshot with N docs.
function fakeSnapshot(count: number) {
  return {
    docs: Array.from({ length: count }, (_, i) => ({
      id: `doc-${i}`,
      data: () => ({ minutes: 60, someField: 'x' })
    }))
  };
}

describe('ClientsDataManager.warnIfTruncated — the loudness guard (G4)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    delete (window as any).notify;
  });

  it('does NOT emit a truncation error when fewer docs than the limit are returned', () => {
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(4962), 10000);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('DOES emit a console.error (not log/warn) naming the collection when the count equals the limit', () => {
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(10000), 10000);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0];
    expect(message).toContain('timesheet_entries');
    expect(message).toContain('10000');
    expect(message).toMatch(/incomplete/i);
    expect(message).toMatch(/oldest/i);
    // Must be console.error specifically, never console.log/warn for this class of failure.
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('TRUNCATION'));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('names the correct collection for budget_tasks independently of timesheet_entries', () => {
    manager.warnIfTruncated('budget_tasks', fakeSnapshot(10000), 10000);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0];
    expect(message).toContain('budget_tasks');
    expect(message).not.toContain('timesheet_entries');
  });

  it('never throws when the snapshot is empty', () => {
    expect(() => manager.warnIfTruncated('timesheet_entries', fakeSnapshot(0), 10000)).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never throws when the snapshot is undefined, null, or malformed (no .docs array)', () => {
    expect(() => manager.warnIfTruncated('timesheet_entries', undefined, 10000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', null, 10000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', {}, 10000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', { docs: 'not-an-array' }, 10000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', { docs: null }, 10000)).not.toThrow();

    // None of these malformed inputs should be treated as "hit the limit".
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('treats a non-positive limit as not-applicable and does NOT fire a false-positive when docs.length also happens to be 0', () => {
    // fakeSnapshot(0) + limit:0 satisfies the naive docs.length===limit check, but a
    // limit of 0 is never a real query cap (both call sites hardcode 10000) - it can only
    // mean "not applicable". The guard explicitly requires limit > 0, so this must NOT
    // be treated as truncation. (Previously this test only asserted .not.toThrow() and
    // silently accepted the false positive without ever naming it - see PR body.)
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(0), 0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never throws when called with a negative limit', () => {
    expect(() => manager.warnIfTruncated('timesheet_entries', fakeSnapshot(5), -1)).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('contains no PII (client names, employee emails, entry descriptions) in the emitted message', () => {
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(10000), 10000);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0];
    expect(message).not.toMatch(/@/); // no email addresses
    expect(message).not.toMatch(/[֐-׿]/); // no Hebrew (client/employee names are Hebrew in this system)
    // Only the collection name + numeric limit + a fixed English diagnostic sentence.
    expect(message).toMatch(/^🔴 TRUNCATION: collection="(timesheet_entries|budget_tasks)" hit its query limit/);
  });

  it('best-effort surfaces to window.notify.show with a non-auto-hiding duration (0) when the app toast system is loaded, without throwing if it is not', () => {
    const notifyShow = vi.fn();
    (window as any).notify = { show: notifyShow };

    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(10000), 10000);
    expect(notifyShow).toHaveBeenCalledTimes(1);

    const [config] = notifyShow.mock.calls[0];
    // MUST NOT auto-hide: this fires during the initial load, while the admin is still
    // watching a loading table. A regression back to a 6-second toast (e.g. calling the
    // notify.error() shorthand instead of show()) must fail this assertion.
    expect(config.duration).toBe(0);
    expect(config.type).toBe('error');
    expect(config.message).toMatch(/חלק מהנתונים ההיסטוריים/);

    delete (window as any).notify;
    expect(() => manager.warnIfTruncated('timesheet_entries', fakeSnapshot(10000), 10000)).not.toThrow();
  });
});

describe('ClientsDataManager loaders — both loaders are independently guarded', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // A minimal fake Firestore chain: collection().orderBy().limit().get() and
  // collection().limit().get() both resolve to the given snapshot.
  //
  // `limit` is a spy (not a no-op) that RECORDS its argument. This closes a coupling
  // gap: without it, someone could regress a loader back to `.limit(5000)` while leaving
  // `warnIfTruncated(..., 10000)` untouched, and every test in this file would still pass
  // (docs.length=5000 would just never equal the untouched limit=10000 - the guard would
  // silently stop firing forever, and PROD would truncate at 5000 again). See PR body.
  function fakeDb(snapshot: ReturnType<typeof fakeSnapshot>) {
    const limitSpy = vi.fn(() => chain);
    const chain: any = {
      orderBy: () => chain,
      limit: limitSpy,
      get: async () => snapshot
    };
    return { collection: () => chain, limitSpy };
  }

  it('loadTimesheetEntries triggers the truncation error when the query hits its limit, AND calls .limit() with the SAME value passed to warnIfTruncated (coupling)', async () => {
    const warnSpy = vi.spyOn(manager, 'warnIfTruncated');
    const { collection, limitSpy } = fakeDb(fakeSnapshot(10000));
    manager.db = { collection };

    await manager.loadTimesheetEntries();

    const truncationCalls = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('TRUNCATION')
    );
    expect(truncationCalls.length).toBe(1);
    expect(truncationCalls[0][0]).toContain('timesheet_entries');

    // The coupling assertion: whatever the loader passed to .limit() must be the exact
    // same value it passed as warnIfTruncated's 3rd arg. If a future edit changes one
    // without the other, this fails (see the self-check note in the PR body).
    expect(limitSpy).toHaveBeenCalledTimes(1);
    const limitArgUsed = limitSpy.mock.calls[0][0];
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnLimitArgUsed = warnSpy.mock.calls[0][2];
    expect(limitArgUsed).toBe(warnLimitArgUsed);
    expect(limitArgUsed).toBe(10000);

    warnSpy.mockRestore();
  });

  it('loadBudgetTasks ALSO triggers the truncation error when its query hits its limit (guards both loaders), AND calls .limit() with the SAME value passed to warnIfTruncated (coupling)', async () => {
    const warnSpy = vi.spyOn(manager, 'warnIfTruncated');
    const { collection, limitSpy } = fakeDb(fakeSnapshot(10000));
    manager.db = { collection };

    await manager.loadBudgetTasks();

    const truncationCalls = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('TRUNCATION')
    );
    expect(truncationCalls.length).toBe(1);
    expect(truncationCalls[0][0]).toContain('budget_tasks');

    expect(limitSpy).toHaveBeenCalledTimes(1);
    const limitArgUsed = limitSpy.mock.calls[0][0];
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnLimitArgUsed = warnSpy.mock.calls[0][2];
    expect(limitArgUsed).toBe(warnLimitArgUsed);
    expect(limitArgUsed).toBe(10000);

    warnSpy.mockRestore();
  });

  it('neither loader emits a truncation error when under the limit', async () => {
    const { collection } = fakeDb(fakeSnapshot(704));
    manager.db = { collection };

    await manager.loadTimesheetEntries();
    await manager.loadBudgetTasks();

    const truncationCalls = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('TRUNCATION')
    );
    expect(truncationCalls.length).toBe(0);
  });
});
