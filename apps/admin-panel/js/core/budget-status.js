/**
 * budget-status.js — pure render-decision helper for the H.4 task budget meter
 * ("Model A: smart budget meter"). NO DOM, NO Firebase — the LOAD-BEARING
 * display rule (actual-vs-estimated budget → level + Hebrew label + percent) is
 * extracted here so it is unit-tested directly and reused by every surface that
 * renders a task budget signal (the admin "חריגות תקציב" feed, and — aligned to
 * the SAME thresholds — the worker card in PR-b).
 *
 * Mirrors the H.3 canonical pattern `profitability-format.js`
 * (`hoursStatus(actualHours, expectedHours)`): same `{ level, label }` shape,
 * same neutral-when-no-plan rule, dual-export (window + CommonJS).
 *
 * Thresholds (Haim-locked H.4 checkpoint, 2026-06-15):
 *   percent < 85          → success  'בתקציב'
 *   85 <= percent <= 100  → warning  'מתקרב לתקציב'
 *   percent > 100         → danger   'חריגת תקציב'  (isOver:true)
 * No positive finite estimate → neutral 'אין תקציב'.
 *
 * Budget = `estimatedMinutes` (the LIVE budget — it can be raised via
 * adjustTaskBudget; this helper just compares the two numbers it is handed).
 * Actuals = `actualMinutes`. over-budget = actualMinutes > estimatedMinutes.
 */
(function () {
  'use strict';

  function isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /** Minutes to hours, 1 decimal, e.g. 295 -> "4.9". non-finite -> "0.0". */
  function formatHoursFromMinutes(minutes) {
    const m = isFiniteNum(minutes) ? minutes : 0;
    return (Math.round((m / 60) * 10) / 10).toFixed(1);
  }

  /**
   * Budget status — the ONLY color signal for a task budget meter.
   *  - estimatedMinutes not a positive finite number → neutral 'אין תקציב'
   *    (percent:null, isOver:false) — a task with no budget can't be "over".
   *  - percent = round(actualMinutes / estimatedMinutes * 100); actualMinutes
   *    treated as 0 when not finite (a fresh task with no time logged is "בתקציב").
   *  - percent < 85          → success 'בתקציב'
   *  - 85 <= percent <= 100  → warning 'מתקרב לתקציב'
   *  - percent > 100         → danger  'חריגת תקציב' (isOver:true)
   * @param {number} actualMinutes
   * @param {number} estimatedMinutes
   * @returns {{ level:'neutral'|'success'|'warning'|'danger', label:string, percent:number|null, isOver:boolean }}
   */
  function budgetStatus(actualMinutes, estimatedMinutes) {
    if (!isFiniteNum(estimatedMinutes) || estimatedMinutes <= 0) {
      return { level: 'neutral', label: 'אין תקציב', percent: null, isOver: false };
    }
    const actual = isFiniteNum(actualMinutes) ? actualMinutes : 0;
    const percent = Math.round((actual / estimatedMinutes) * 100);
    if (percent > 100) {
      return { level: 'danger', label: 'חריגת תקציב', percent: percent, isOver: true };
    }
    if (percent >= 85) {
      return { level: 'warning', label: 'מתקרב לתקציב', percent: percent, isOver: false };
    }
    return { level: 'success', label: 'בתקציב', percent: percent, isOver: false };
  }

  const api = {
    budgetStatus: budgetStatus,
    formatHoursFromMinutes: formatHoursFromMinutes
  };

  // Expose to window — admin-panel pattern (classic <script> load).
  if (typeof window !== 'undefined') {
    window.BudgetStatus = api;
  }

  // CommonJS export — for vitest tests under Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
