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
 * be crossed). This PR (a) raises both caps 5000 -> 20000 with headroom, and
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

  it('exists as a callable guard on the singleton', () => {
    expect(typeof manager.warnIfTruncated).toBe('function');
  });

  it('does NOT emit a truncation error when fewer docs than the limit are returned', () => {
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(4962), 20000);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('DOES emit a console.error (not log/warn) naming the collection when the count equals the limit', () => {
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(20000), 20000);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0];
    expect(message).toContain('timesheet_entries');
    expect(message).toContain('20000');
    expect(message).toMatch(/incomplete/i);
    expect(message).toMatch(/oldest/i);
    // Must be console.error specifically, never console.log/warn for this class of failure.
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('TRUNCATION'));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('names the correct collection for budget_tasks independently of timesheet_entries', () => {
    manager.warnIfTruncated('budget_tasks', fakeSnapshot(20000), 20000);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0];
    expect(message).toContain('budget_tasks');
    expect(message).not.toContain('timesheet_entries');
  });

  it('never throws when the snapshot is empty', () => {
    expect(() => manager.warnIfTruncated('timesheet_entries', fakeSnapshot(0), 20000)).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never throws when the snapshot is undefined, null, or malformed (no .docs array)', () => {
    expect(() => manager.warnIfTruncated('timesheet_entries', undefined, 20000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', null, 20000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', {}, 20000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', { docs: 'not-an-array' }, 20000)).not.toThrow();
    expect(() => manager.warnIfTruncated('timesheet_entries', { docs: null }, 20000)).not.toThrow();

    // None of these malformed inputs should be treated as "hit the limit".
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never throws even if the guard is called with a limit of 0 or a negative count mismatch', () => {
    expect(() => manager.warnIfTruncated('timesheet_entries', fakeSnapshot(0), 0)).not.toThrow();
  });

  it('contains no PII (client names, employee emails, entry descriptions) in the emitted message', () => {
    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(20000), 20000);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0];
    expect(message).not.toMatch(/@/); // no email addresses
    expect(message).not.toMatch(/[֐-׿]/); // no Hebrew (client/employee names are Hebrew in this system)
    // Only the collection name + numeric limit + a fixed English diagnostic sentence.
    expect(message).toMatch(/^🔴 TRUNCATION: collection="(timesheet_entries|budget_tasks)" hit its query limit/);
  });

  it('best-effort surfaces to window.notify.error when the app toast system is loaded, without throwing if it is not', () => {
    const notifyError = vi.fn();
    (window as any).notify = { error: notifyError };

    manager.warnIfTruncated('timesheet_entries', fakeSnapshot(20000), 20000);
    expect(notifyError).toHaveBeenCalledTimes(1);

    delete (window as any).notify;
    expect(() => manager.warnIfTruncated('timesheet_entries', fakeSnapshot(20000), 20000)).not.toThrow();
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
  function fakeDb(snapshot: ReturnType<typeof fakeSnapshot>) {
    const chain: any = {
      orderBy: () => chain,
      limit: () => chain,
      get: async () => snapshot
    };
    return { collection: () => chain };
  }

  it('loadTimesheetEntries triggers the truncation error when the query hits its limit', async () => {
    manager.db = fakeDb(fakeSnapshot(20000));

    await manager.loadTimesheetEntries();

    const truncationCalls = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('TRUNCATION')
    );
    expect(truncationCalls.length).toBe(1);
    expect(truncationCalls[0][0]).toContain('timesheet_entries');
  });

  it('loadBudgetTasks ALSO triggers the truncation error when its query hits its limit (guards both loaders)', async () => {
    manager.db = fakeDb(fakeSnapshot(20000));

    await manager.loadBudgetTasks();

    const truncationCalls = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('TRUNCATION')
    );
    expect(truncationCalls.length).toBe(1);
    expect(truncationCalls[0][0]).toContain('budget_tasks');
  });

  it('neither loader emits a truncation error when under the limit', async () => {
    manager.db = fakeDb(fakeSnapshot(704));

    await manager.loadTimesheetEntries();
    await manager.loadBudgetTasks();

    const truncationCalls = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('TRUNCATION')
    );
    expect(truncationCalls.length).toBe(0);
  });
});
