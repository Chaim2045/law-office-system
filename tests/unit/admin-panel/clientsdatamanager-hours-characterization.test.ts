/**
 * CHARACTERIZATION — ClientsDataManager's client-side hours recomputation.
 *
 * `loadClients()` reads each client document and then OVERWRITES two fields in
 * memory with its own calculation:
 *
 *   client.totalHours     = calculateTotalHoursFromServices(client)
 *   client.hoursRemaining = calculateRemainingHoursFromServices(client)
 *
 * Everything the partners' primary screen shows — the hours cell, the progress
 * bar, the warning icons, the "דורש תשומת לב" counter, the status filter, the
 * sort order and the CSV export — flows from those two functions.
 *
 * They have **ZERO test coverage**. Verified: a repo-wide search finds each name
 * only at its definition and its single call site. Which means today there is no
 * way to demonstrate that a change did not silently move a number an admin acts
 * on — precisely the risk the plan records at
 * `docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md` ("that screen will look
 * identical after the fix, masking both success and regression").
 *
 * These tests PIN CURRENT BEHAVIOUR, quirks included. Several assertions below
 * encode results that are arguably WRONG — fixed-price services counted, a
 * `pricingType` check that does not exist, a legacy `.hours` fallback the server
 * has never had. That is deliberate and is what characterization means: the
 * tests must fail when behaviour changes, whether the change is a fix or a
 * regression, so the change has to be argued for rather than slipped in.
 *
 * Each such case is labelled QUIRK with the disagreement spelled out.
 *
 * Created: 2026-08-17 — PR-3a, prerequisite for migrating any reader onto
 * `hoursCapacity`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

// @ts-ignore — classic admin-panel script; loading it attaches the singleton.
import '../../../apps/admin-panel/js/managers/ClientsDataManager.js';

const manager: any = (window as any).ClientsDataManager;

const REPO_ROOT = resolve(__dirname, '../../..');

// ─── fixture builders ───────────────────────────────────────────

const stage = (
  id: string,
  status: string | undefined,
  totalHours: number,
  hoursRemaining: number
) => ({ id, status, totalHours, hoursRemaining, pricingType: 'hourly' });

const staged = (stages: any[], extra: Record<string, unknown> = {}) => ({
  id: 'lp1',
  type: 'legal_procedure',
  pricingType: 'hourly',
  status: 'active',
  stages,
  ...extra
});

const client = (services: any[], extra: Record<string, unknown> = {}) => ({
  caseNumber: '2025001',
  status: 'active',
  services,
  ...extra
});

// ═══════════════════════════════════════════════════════════════
// calculateTotalHoursFromServices
// ═══════════════════════════════════════════════════════════════

describe('calculateTotalHoursFromServices — pinned as-is', () => {
  it('a staged hourly service counts ONLY its active stages', () => {
    const c = client([
      staged([
        stage('stage_a', 'active', 100, 40),
        stage('stage_b', 'pending', 200, 200),
        stage('stage_c', 'completed', 50, 0)
      ])
    ]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(100);
  });

  it('archived services are excluded', () => {
    const c = client([
      staged([stage('stage_a', 'active', 100, 100)]),
      staged([stage('stage_a', 'active', 999, 999)], { id: 'lp2', status: 'archived' })
    ]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(100);
  });

  it('QUIRK: a COMPLETED service is still counted — only `archived` is filtered', () => {
    // The server excludes nothing but archived either (NON_AGGREGATING_STATUSES),
    // so this agrees with `recomputeTotalHours` — but it DISAGREES with the new
    // capacity rule, where a completed service accepts no hours and therefore
    // holds zero AVAILABLE capacity.
    const c = client([
      staged([stage('stage_a', 'active', 80, 80)], { status: 'completed' })
    ]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(80);
  });

  it('QUIRK: a FIXED-price service IS counted — there is no isFixedService check', () => {
    // Both server functions exclude fixed services. This one has no such check,
    // so a `mixed` client's on-screen total is inflated by the fixed service
    // right now. Removing it is correct but is a VISIBLE number change.
    const c = client([
      { id: 's1', type: 'fixed', status: 'active', totalHours: 30 },
      staged([stage('stage_a', 'active', 10, 10)])
    ]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(40);
  });

  it('QUIRK: a legal_procedure priced FIXED still enters the stages branch', () => {
    // The branch predicate checks `type` and `stages` but never `pricingType`.
    // Fixed stages normally carry no totalHours, so this is usually 0 — but a
    // stray value is counted.
    const c = client([
      staged([stage('stage_a', 'active', 25, 25)], { pricingType: 'fixed' })
    ]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(25);
  });

  it('QUIRK: falls back to the legacy `service.hours` field, which the server never had', () => {
    const c = client([{ id: 's1', type: 'hours', status: 'active', hours: 45 }]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(45);
  });

  it('QUIRK: with NO services it returns the STORED server value, so the overwrite is a no-op', () => {
    const c = client([], { totalHours: 123 });
    expect(manager.calculateTotalHoursFromServices(c)).toBe(123);
  });

  it('a stage with no status is not counted', () => {
    const c = client([
      staged([stage('stage_a', 'active', 10, 10), stage('stage_b', undefined, 40, 40)])
    ]);
    expect(manager.calculateTotalHoursFromServices(c)).toBe(10);
  });

  it('does not round — the raw sum is returned', () => {
    const c = client([
      staged([stage('stage_a', 'active', 0.1, 0.1), stage('stage_b', 'active', 0.2, 0.2)])
    ]);
    // 0.30000000000000004 — pinned deliberately; the server rounds, this does not.
    expect(manager.calculateTotalHoursFromServices(c)).toBe(0.1 + 0.2);
  });
});

// ═══════════════════════════════════════════════════════════════
// calculateRemainingHoursFromServices
// ═══════════════════════════════════════════════════════════════

describe('calculateRemainingHoursFromServices — pinned as-is', () => {
  it('sums the stored hoursRemaining of ACTIVE stages only', () => {
    const c = client([
      staged([
        stage('stage_a', 'active', 100, 40),
        stage('stage_b', 'pending', 200, 200)
      ])
    ]);
    expect(manager.calculateRemainingHoursFromServices(c)).toBe(40);
  });

  it('a negative stage balance is preserved, not clamped', () => {
    const c = client([staged([stage('stage_a', 'active', 10, -5)])]);
    expect(manager.calculateRemainingHoursFromServices(c)).toBe(-5);
  });

  it('QUIRK: it reads the STORED per-entity hoursRemaining rather than deriving total − used', () => {
    // The server computes `hoursRemaining = totalHours − hoursUsed`
    // (calcClientAggregates). This sums stored fields instead, so a drifted
    // stored value flows straight to the screen.
    const c = client([staged([stage('stage_a', 'active', 100, 999)])]);
    expect(manager.calculateRemainingHoursFromServices(c)).toBe(999);
  });

  it('non-staged services contribute their own hoursRemaining', () => {
    const c = client([
      { id: 's1', type: 'hours', status: 'active', totalHours: 50, hoursRemaining: 12.5 }
    ]);
    expect(manager.calculateRemainingHoursFromServices(c)).toBe(12.5);
  });

  it('QUIRK: with NO services it returns the STORED server value', () => {
    const c = client([], { hoursRemaining: 77 });
    expect(manager.calculateRemainingHoursFromServices(c)).toBe(77);
  });
});

// ═══════════════════════════════════════════════════════════════
// The pair, on the five clients the measurement exposed
// ═══════════════════════════════════════════════════════════════

describe('the exposed-client shape — what the screen renders today', () => {
  it('a phantom client still reads as healthy on this screen', () => {
    // The shape behind 2025006 (תמיר אקווע): a large contract, most of it
    // locked in stages that were never opened, and consumption that already
    // exceeds what is genuinely available.
    const c = client([
      staged([
        stage('stage_a', 'active', 235, 79.98),
        stage('stage_b', 'pending', 120, 120)
      ])
    ]);

    const total = manager.calculateTotalHoursFromServices(c);
    const remaining = manager.calculateRemainingHoursFromServices(c);

    expect(total).toBe(235);
    expect(remaining).toBe(79.98);
    // Positive → no overdraft badge, no red row, no warning icon.
    expect(remaining).toBeGreaterThan(0);
    // And the ratio clears both attention thresholds.
    expect(remaining / total).toBeGreaterThan(0.1);
  });
});

// ═══════════════════════════════════════════════════════════════
// needsAttention — feeds a counter AND a filter
// ═══════════════════════════════════════════════════════════════

describe('needsAttention — pinned as-is', () => {
  const hourly = (hoursRemaining: number, totalHours: number, extra = {}) => ({
    status: 'active',
    isBlocked: false,
    procedureType: 'hours',
    hoursRemaining,
    totalHours,
    ...extra
  });

  it('an inactive client never needs attention', () => {
    expect(manager.needsAttention(hourly(1, 100, { status: 'inactive' }))).toBe(false);
  });

  it('an already-blocked client never needs attention', () => {
    expect(manager.needsAttention(hourly(1, 100, { isBlocked: true }))).toBe(false);
  });

  it('the ABSOLUTE arm fires under 10 hours', () => {
    // Isolating this arm needs a SMALL denominator, or the ratio arm fires too
    // and the test proves nothing about the arm it names. (Learned the hard way:
    // the first draft used 10/1000 — 1%, which trips the ratio arm.)
    expect(manager.needsAttention(hourly(9.9, 50))).toBe(true);  // 19.8%, ratio quiet
    expect(manager.needsAttention(hourly(10, 50))).toBe(false);  // 20%, both quiet
  });

  it('the RATIO arm fires under 10 percent', () => {
    // 🔴 This is the arm that a smaller denominator would silently switch OFF.
    expect(manager.needsAttention(hourly(50, 600))).toBe(true);   // 8.3%
    expect(manager.needsAttention(hourly(50, 400))).toBe(false);  // 12.5%
  });

  it('the two arms are OR-ed — a large contract makes the ratio arm dominate', () => {
    // This is why the denominator matters so much here: on a big contract the
    // absolute arm is irrelevant and the ratio arm is doing all the work. Shrink
    // the denominator and the ratio rises — the alert goes QUIET. That is the
    // silent-loss direction, and the reason PR-3 must not swap this denominator.
    expect(manager.needsAttention(hourly(50, 1000))).toBe(true);  // 5%  → fires
    expect(manager.needsAttention(hourly(50, 200))).toBe(false);  // 25% → silent
  });

  it('QUIRK: eligibility keys off the legacy `procedureType`, so other shapes never qualify', () => {
    expect(manager.needsAttention(hourly(1, 100, { procedureType: 'fixed' }))).toBe(false);
    expect(manager.needsAttention(hourly(1, 100, { procedureType: undefined }))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// DRIFT GUARD — the frontend mirror of the server's status filter
// ═══════════════════════════════════════════════════════════════

describe('_isServiceCountedForClientAggregate mirrors NON_AGGREGATING_STATUSES', () => {
  /**
   * The function's own docblock states the frontend filter MUST stay in sync
   * with the backend SSOT — and until now nothing enforced it. Add `on_hold` to
   * the server list and CI would not have noticed the frontend diverged.
   */
  function serverNonAggregatingStatuses(): string[] {
    const src = readFileSync(
      resolve(REPO_ROOT, 'functions/shared/aggregates.js'),
      'utf8'
    ).replace(/\/\/[^\n]*/g, '');

    const m = src.match(
      /const\s+NON_AGGREGATING_STATUSES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/
    );
    if (!m) {
throw new Error('NON_AGGREGATING_STATUSES not found in aggregates.js');
}
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }

  it('the server list is found and is what the frontend assumes', () => {
    expect(serverNonAggregatingStatuses()).toEqual(['archived']);
  });

  it('every status the server excludes, the frontend also excludes', () => {
    for (const status of serverNonAggregatingStatuses()) {
      expect(
        manager._isServiceCountedForClientAggregate({ status }),
        `frontend counts a service the server excludes: status="${status}"`
      ).toBe(false);
    }
  });

  it('a status the server keeps, the frontend also keeps', () => {
    const excluded = serverNonAggregatingStatuses();
    for (const status of ['active', 'completed', 'on_hold']) {
      if (excluded.includes(status)) {
continue;
}
      expect(manager._isServiceCountedForClientAggregate({ status })).toBe(true);
    }
  });

  it('a missing status defaults to counted, matching the server convention', () => {
    expect(manager._isServiceCountedForClientAggregate({})).toBe(true);
  });

  it('a null service is never counted', () => {
    expect(manager._isServiceCountedForClientAggregate(null)).toBe(false);
  });
});
