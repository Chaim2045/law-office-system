/**
 * ═══════════════════════════════════════════════════════════════
 * budget-crossing.js — task-budget threshold-crossing detector (H.4 PR-b)
 * ═══════════════════════════════════════════════════════════════
 *
 * Pure, DOM-free, Firebase-free helper for the "Model A: smart budget meter"
 * (MASTER_PLAN §8.6). It answers ONE question at the moment a worker logs time:
 * did this time entry push the task ACROSS a canonical budget threshold?
 *
 * It is the worker-side mirror of the admin canonical helper
 * `apps/admin-panel/js/core/budget-status.js` (H.4 PR-a). The two are kept in
 * lock-step by `tests/unit/user-app/budget-crossing-drift-guard.test.ts`, which
 * pins these thresholds + Hebrew labels to `budgetStatus()`'s verdicts so the
 * worker toast, the admin "חריגות תקציב" feed, and the task card all speak the
 * SAME 85% / 100% language. (Same SSOT-mirror pattern as israeli-id.js ↔ the
 * backend validator.)
 *
 * Thresholds (Haim-locked H.4 checkpoint, 2026-06-15), identical to budgetStatus:
 *   percent < 85          → "בתקציב"        (no crossing)
 *   85 <= percent <= 100  → "מתקרב לתקציב"   (approaching)
 *   percent > 100         → "חריגת תקציב"    (over)
 *
 * "Once per crossing" is STATELESS by construction: the caller hands us the
 * authoritative BEFORE (pre-entry actual) and AFTER (post-entry actual, from the
 * addTimeToTask transaction's newActualMinutes), and we only report a level that
 * is NEWLY entered (before below it, after at/above it). A subsequent entry that
 * stays above the line reports null — no per-task flag needed.
 *
 * PII discipline (repo is PUBLIC): this module logs nothing. Budget figures and
 * client names never pass through a raw console here.
 */

export const BUDGET_CROSSING_THRESHOLDS = Object.freeze({
  // percent at/above which a task is "approaching" its budget
  APPROACHING_PERCENT: 85,
  // percent ABOVE which a task is "over" its budget (strictly greater, matching
  // budgetStatus's `percent > 100` — exactly 100% is still "approaching")
  OVER_PERCENT: 100
});

// Hebrew labels — byte-identical to budgetStatus()'s warning/danger labels so the
// worker toast, admin feed, and card never diverge. Pinned by the drift-guard.
export const BUDGET_CROSSING_LABELS = Object.freeze({
  approaching: 'מתקרב לתקציב',
  over: 'חריגת תקציב'
});

function isFiniteNum(v) {
  return typeof v === 'number' && isFinite(v);
}

/** Rounded percent of budget, matching budgetStatus / calculateSimpleProgress. */
function percentOfBudget(minutes, estimatedMinutes) {
  return Math.round((minutes / estimatedMinutes) * 100);
}

/**
 * Detect the HIGHEST budget threshold a time entry NEWLY crosses.
 *
 * @param {number} beforeMinutes - actual minutes on the task BEFORE this entry
 * @param {number} afterMinutes  - actual minutes AFTER this entry (authoritative:
 *                                  the addTimeToTask txn's `newActualMinutes`)
 * @param {number} estimatedMinutes - the task budget (estimatedMinutes)
 * @returns {'over'|'approaching'|null} the newly-crossed level, or null when no
 *          positive budget, no forward progress, or no new threshold was crossed
 */
export function detectBudgetCrossing(beforeMinutes, afterMinutes, estimatedMinutes) {
  // No budget → a task with no estimate can't be "over". (Mirrors budgetStatus
  // neutral 'אין תקציב'.)
  if (!isFiniteNum(estimatedMinutes) || estimatedMinutes <= 0) {
    return null;
  }
  const before = isFiniteNum(beforeMinutes) ? Math.max(0, beforeMinutes) : 0;
  const after = isFiniteNum(afterMinutes) ? afterMinutes : 0;
  // No forward progress (or correction) → nothing newly crossed.
  if (after <= before) {
    return null;
  }

  const beforePct = percentOfBudget(before, estimatedMinutes);
  const afterPct = percentOfBudget(after, estimatedMinutes);

  // Over budget — checked first so a jump straight past both lines reports 'over'.
  if (beforePct <= BUDGET_CROSSING_THRESHOLDS.OVER_PERCENT &&
      afterPct > BUDGET_CROSSING_THRESHOLDS.OVER_PERCENT) {
    return 'over';
  }
  // Approaching budget.
  if (beforePct < BUDGET_CROSSING_THRESHOLDS.APPROACHING_PERCENT &&
      afterPct >= BUDGET_CROSSING_THRESHOLDS.APPROACHING_PERCENT) {
    return 'approaching';
  }
  return null;
}

/**
 * Hebrew label for a crossing level ('over' / 'approaching'), or null.
 * @param {'over'|'approaching'|null} level
 * @returns {string|null}
 */
export function budgetCrossingLabel(level) {
  if (level === 'over') {
    return BUDGET_CROSSING_LABELS.over;
  }
  if (level === 'approaching') {
    return BUDGET_CROSSING_LABELS.approaching;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Window mirror — for any non-module (classic <script>) consumer, mirroring
// the israeli-id.js / budget-status.js dual-export pattern.
// ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.BudgetCrossing = {
    detectBudgetCrossing,
    budgetCrossingLabel,
    BUDGET_CROSSING_THRESHOLDS,
    BUDGET_CROSSING_LABELS
  };
}
