/**
 * profitability-format.js — pure render-decision helpers for the Profitability
 * dashboard (H.3 PR4). NO DOM, NO Firebase — the LOAD-BEARING display rules
 * (null≠0, coverage badge, hours-vs-Plan status) are extracted here so they are
 * unit-tested directly (the customer scenario: "actualCost=null shows
 * 'עלות לא זמינה', NEVER ₪0"). Dual-export: window.ProfitabilityFormat +
 * CommonJS (so tests/unit/admin-panel/profitability-format.test.ts can require it).
 *
 * 🔴 PII (§7.6, PUBLIC repo): these helpers RETURN display strings for the
 * admin-only page; the cost VALUE they format must never be logged / stored /
 * url'd / put in a toast by the caller. This module itself only transforms.
 *
 * Backend contract (PR3, LIVE — do not re-derive): the client_profitability doc
 * carries actualHours, actualCost (number|null — null = un-costed/unknown,
 * NEVER 0), costedEntryCount, totalEntryCount, unCostedCoveragePercent
 * (number|null), paidRevenue:null, projectedProfit:null (H.6 seams). The Plan
 * side (client.plan) carries expectedHours, expectedRevenue, pricingComplete,
 * pricingMissingCount.
 */
(function () {
  'use strict';

  const COST_UNAVAILABLE = 'עלות לא זמינה';

  function isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /** Integer-grouped ILS, e.g. 40000 -> "₪40,000". null/non-finite -> ''. */
  function formatShekel(v) {
    if (!isFiniteNum(v)) {
      return '';
    }
    const rounded = Math.round(v);
    const sign = rounded < 0 ? '-' : '';
    const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '₪' + digits;
  }

  /** Hours to 1 decimal, e.g. 4.92 -> "4.9". null -> '—'. (0 is a REAL value -> "0.0".) */
  function formatHours(v) {
    if (!isFiniteNum(v)) {
      return '—';
    }
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  /**
   * actualCost render — the #1 rule. A finite number -> formatted ₪ (INCLUDING a
   * real 0 -> "₪0", a KNOWN free cost). null/undefined (un-costed/unknown) ->
   * "עלות לא זמינה", NEVER ₪0 (a 0 would fabricate a "this case costs nothing"
   * signal — the exact false reading the profitability layer exists to prevent).
   * @returns {{ text:string, available:boolean }}
   */
  function formatActualCost(actualCost) {
    if (isFiniteNum(actualCost)) {
      return { text: formatShekel(actualCost), available: true };
    }
    return { text: COST_UNAVAILABLE, available: false };
  }

  /**
   * Coverage badge from unCostedCoveragePercent (% of in-scope entries with an
   * UNKNOWN cost) + totalEntryCount.
   *  - no entries (totalEntryCount===0 or pct null) -> neutral 'אין רישומים'
   *  - pct <= 0   (fully costed)                    -> success 'מתומחר מלא'
   *  - 0 < pct < 100                                -> warning 'X% לא מתומחר'
   *  - pct >= 100 (nothing costed — TODAY's state)  -> danger  'עלות טרם הוזנה'
   * @returns {{ level:'neutral'|'success'|'warning'|'danger', label:string }}
   */
  function coverageBadge(unCostedCoveragePercent, totalEntryCount) {
    if (totalEntryCount === 0 || !isFiniteNum(unCostedCoveragePercent)) {
      return { level: 'neutral', label: 'אין רישומים' };
    }
    const pct = Math.round(unCostedCoveragePercent);
    if (pct <= 0) {
      return { level: 'success', label: 'מתומחר מלא' };
    }
    if (pct >= 100) {
      return { level: 'danger', label: 'עלות טרם הוזנה' };
    }
    return { level: 'warning', label: pct + '% לא מתומחר' };
  }

  /**
   * Hours-vs-Plan status — the ONLY color signal in PR4. actualCost is system-
   * wide null today, so NO cost/profit alert is computed; we color the HOURS
   * burn-rate vs the Plan's expectedHours (the locked PR4 checkpoint decision —
   * the X% profit threshold is deferred to when costs exist).
   *  - expectedHours not a positive number (e.g. fixed-price → 0) -> neutral 'אין תכנון'
   *  - ratio <= 0.85       -> success 'בתכנון'
   *  - 0.85 < ratio <= 1.0 -> warning 'מתקרב לתקרה'
   *  - ratio > 1.0         -> danger  'חריגה משעות התכנון'
   * @returns {{ level:string, label:string, ratio:number|null }}
   */
  function hoursStatus(actualHours, expectedHours) {
    if (!isFiniteNum(expectedHours) || expectedHours <= 0) {
      return { level: 'neutral', label: 'אין תכנון', ratio: null };
    }
    const actual = isFiniteNum(actualHours) ? actualHours : 0;
    const ratio = actual / expectedHours;
    if (ratio <= 0.85) {
      return { level: 'success', label: 'בתכנון', ratio: ratio };
    }
    if (ratio <= 1.0) {
      return { level: 'warning', label: 'מתקרב לתקרה', ratio: ratio };
    }
    return { level: 'danger', label: 'חריגה משעות התכנון', ratio: ratio };
  }

  /**
   * Expected-revenue display from client.plan. An un-priced case
   * (pricingComplete===false / pricingMissingCount>0) is FLAGGED 'תמחור חסר',
   * never shown as a bare ₪0.
   * @returns {{ text:string, flag:boolean, flagLabel:string }}
   */
  function planRevenue(plan) {
    if (!plan || typeof plan !== 'object') {
      return { text: '—', flag: false, flagLabel: '' };
    }
    const hasMissing = plan.pricingComplete === false ||
      (isFiniteNum(plan.pricingMissingCount) && plan.pricingMissingCount > 0);
    const text = isFiniteNum(plan.expectedRevenue) ? formatShekel(plan.expectedRevenue) : '—';
    if (hasMissing) {
      const n = isFiniteNum(plan.pricingMissingCount) ? plan.pricingMissingCount : 0;
      return { text: text, flag: true, flagLabel: n > 0 ? ('תמחור חסר (' + n + ')') : 'תמחור חלקי' };
    }
    return { text: text, flag: false, flagLabel: '' };
  }

  const api = {
    formatShekel: formatShekel,
    formatHours: formatHours,
    formatActualCost: formatActualCost,
    coverageBadge: coverageBadge,
    hoursStatus: hoursStatus,
    planRevenue: planRevenue,
    COST_UNAVAILABLE: COST_UNAVAILABLE
  };

  // Expose to window — admin-panel pattern (classic <script> load).
  if (typeof window !== 'undefined') {
    window.ProfitabilityFormat = api;
  }

  // CommonJS export — for vitest tests under Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
