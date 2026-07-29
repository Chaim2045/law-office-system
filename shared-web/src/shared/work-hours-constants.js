/**
 * Work-Hours Constants — single source of truth for office work-hours defaults.
 *
 * ⚠️ DUPLICATED FILE — keep byte-identical with the sibling at:
 *     apps/admin-panel/js/shared/work-hours-constants.js
 *
 * Cross-app deploy boundary (Netlify deploys `apps/user-app/` and
 * `apps/admin-panel/` as independent sites) prevents true single-source
 * via runtime imports. This constant rarely changes. When it does,
 * update BOTH copies in the same PR. PR-G.2 (2026-05-20).
 *
 * Why not Firestore: 8.45 is a static fallback, not a configurable
 * global. Firestore would add race-on-first-render + async retrofit
 * across 7+ sites + still require a hardcoded literal for offline
 * fallback. Held off until business need.
 *
 * Why classic script (not ES module): most consumers in this codebase
 * are classic <script> tags assigning to `window`. A single
 * window-attached object reachable by every consumer (classic + module)
 * is the simplest pattern. This file MUST be loaded EARLY in index.html
 * — before any consumer script.
 */

(function () {
  'use strict';

  /**
   * Default daily work-hours target.
   * Derivation: 186 monthly hours / 22 average working days = 8.45 h/day.
   * Used as fallback when an employee has no personal `dailyHoursTarget`
   * value on their profile.
   */
  const DEFAULT_DAILY_TARGET = 8.45;

  /**
   * Default monthly work-hours target — backward-compat for code paths
   * that compute monthly quota from a constant rather than workdays ×
   * dailyTarget. Prefer the latter when possible.
   */
  const DEFAULT_MONTHLY_HOURS = 186;

  /**
   * Half-day target — applied on holiday eves (PR-G.3 future integration).
   * 6h derives from the office's stated "early-close" policy.
   */
  const HOLIDAY_EVE_TARGET = 6;

  /**
   * Resolve an employee's effective daily target from their profile,
   * falling back to the global default when no personal value is set.
   *
   * Single canonical fallback resolution — replaces scattered
   * `employee.dailyHoursTarget || 8.45` patterns across the codebase.
   *
   * @param {Object|null|undefined} employee
   * @returns {number}
   */
  function getEmployeeDailyTarget(employee) {
    if (employee && typeof employee.dailyHoursTarget === 'number' && !Number.isNaN(employee.dailyHoursTarget)) {
      return employee.dailyHoursTarget;
    }
    return DEFAULT_DAILY_TARGET;
  }

  /**
   * Predicate: does the employee have a custom target (not the global default)?
   * Centralizes the `value !== 8.45` comparison so it stays consistent
   * if the default ever changes.
   *
   * @param {number|null|undefined} target
   * @returns {boolean}
   */
  function isCustomDailyTarget(target) {
    return typeof target === 'number' && target !== DEFAULT_DAILY_TARGET;
  }

  // Expose as a single immutable global so both classic scripts AND ES
  // modules can read from one place (modules cannot directly access
  // module-scoped consts of other files without being modules
  // themselves — and most consumers here are classic scripts).
  const WORK_HOURS_CONSTANTS = Object.freeze({
    DEFAULT_DAILY_TARGET,
    DEFAULT_MONTHLY_HOURS,
    HOLIDAY_EVE_TARGET,
    getEmployeeDailyTarget,
    isCustomDailyTarget
  });

  if (typeof window !== 'undefined') {
    window.WORK_HOURS_CONSTANTS = WORK_HOURS_CONSTANTS;
  }
})();
