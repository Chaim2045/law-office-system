/**
 * stage-hours.js — the ONE frontend rule for "how many hours were worked on this
 * stage". NO DOM, NO Firebase. Pure functions over a stage object.
 *
 * THE RULE (mirrors the backend SSOT `calcStageEffectiveHoursUsed`,
 * `functions/src/modules/aggregation/index.js:41-43`, whose docblock states:
 * "This is the single rule every stage-hours-used consumer must use."):
 *
 *     pricingType === 'fixed'  ->  totalHoursWorked
 *     anything else            ->  hoursUsed
 *
 * WHY THE BRANCH IS LOAD-BEARING, NOT COSMETIC
 *
 * For a FIXED-price stage the backend maintains ONLY `totalHoursWorked`.
 * `applyLegalProcedureDelta`'s FIXED branch returns `{...stage, totalHoursWorked}`
 * and `functions/services/index.js:899-909` says so outright — "totalHoursWorked
 * and hoursUsed are intentionally left untouched here". Meanwhile stages are
 * created with `hoursUsed: 0` (`functions/clients/index.js:301,310,369`).
 *
 * So on a fixed stage `hoursUsed` is a finite `0` that never moves. A consumer
 * that reads `hoursUsed` directly does not fall through to any fallback — it
 * reads 0 and renders 0, confidently and wrongly. Measured against live
 * production data (2026-08-18): 87 of 150 stages are fixed, and 26 of them had
 * real work recorded that a `hoursUsed`-only read would have reported as a
 * smaller number or as zero — e.g. 120.09h worked shown as 22.5h, and 30.5h
 * worked shown as 0.0h, on the report a partner sends to the client.
 *
 * WHY NOT `business-rules/service-classification.js`
 *
 * That module's `isFixedService` returns false for anything without a `.type`
 * field (see its line 31-33), and a STAGE has no `type` — it is a SERVICE
 * predicate and cannot classify a stage. Stage-level pricing is a distinct
 * concept, so this file is its SSOT. The literal `'fixed'` comparison is
 * therefore confined here plus the documented inline fallbacks that exist so
 * each consumer stays unit-testable with no page globals loaded; every copy is
 * pinned by `tests/unit/admin-panel/stage-hours-fixed-price.test.ts`.
 *
 * Dual-export (window + CommonJS), same as `budget-status.js`.
 */
(function () {
  'use strict';

  const FIXED = 'fixed';

  function finite(value) {
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  /**
   * Worked hours for one stage, per pricingType.
   *
   * Returns a number, never null: a stage with neither counter populated has
   * genuinely had no hours recorded against it, and 0 is the honest answer.
   * Callers that must distinguish "no work" from "nothing stored" should ask
   * `stageHasStoredWorkedHours` first.
   *
   * @param {object} stage - a stage object carrying `pricingType` plus
   *   `totalHoursWorked` (fixed) and/or `hoursUsed` (hourly).
   * @returns {number}
   */
  function stageEffectiveHoursUsed(stage) {
    if (!stage || typeof stage !== 'object') {
      return 0;
    }
    if (stage.pricingType === FIXED) {
      const worked = finite(stage.totalHoursWorked);
      if (worked !== null) {
        return worked;
      }
      // `totalHoursWorked` ABSENT (not zero) on a fixed stage: prefer whatever
      // `hoursUsed` holds over reporting 0. A live probe (2026-08-18) found ZERO
      // such stages in production — 33 fixed stages carry totalHoursWorked and 54
      // have no work at all — so this never fires on real data. It exists so a
      // legacy or hand-built stage degrades to the older number instead of
      // silently losing it. The check is on ABSENCE: a fixed stage that genuinely
      // worked 0 hours still reports 0, it does not fall through to a stale value.
      return finite(stage.hoursUsed) || 0;
    }
    return finite(stage.hoursUsed) || 0;
  }

  /**
   * True when the stage stores a usable worked-hours counter — even one holding 0.
   * False means nothing is stored, so a caller may derive the figure another way
   * (e.g. total minus remaining) rather than accept a 0 that means "unknown".
   *
   * @param {object} stage
   * @returns {boolean}
   */
  function stageHasStoredWorkedHours(stage) {
    if (!stage || typeof stage !== 'object') {
      return false;
    }
    if (stage.pricingType === FIXED) {
      return finite(stage.totalHoursWorked) !== null || finite(stage.hoursUsed) !== null;
    }
    return finite(stage.hoursUsed) !== null;
  }

  /**
   * Remaining hours for one stage: the stored aggregate when present, otherwise
   * total minus the pricing-aware worked figure.
   *
   * The fallback previously subtracted `hoursUsed` unconditionally, which on a
   * fixed stage subtracted 0 and reported the stage as untouched.
   *
   * @param {object} stage
   * @param {number} totalHours - the stage's capacity, already resolved by the caller.
   * @returns {number}
   */
  function stageRemainingHours(stage, totalHours) {
    const stored = finite(stage && stage.hoursRemaining);
    if (stored !== null) {
      return stored;
    }
    const total = finite(totalHours) || 0;
    return total - stageEffectiveHoursUsed(stage);
  }

  const api = {
    FIXED_PRICING_TYPE: FIXED,
    stageEffectiveHoursUsed: stageEffectiveHoursUsed,
    stageHasStoredWorkedHours: stageHasStoredWorkedHours,
    stageRemainingHours: stageRemainingHours
  };

  // Expose to window — admin-panel pattern (classic <script> load).
  if (typeof window !== 'undefined') {
    window.StageHours = api;
  }

  // CommonJS export — for vitest tests under Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
