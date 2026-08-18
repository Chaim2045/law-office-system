"use strict";
/**
 * client-plan.ts — Phase 2 H.3 PR1 (the static "Plan" layer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure derivation of a case's STATIC "Plan" (the expectation locked at intake)
 * from its `services[]` array. Computed at client-create + on every service
 * change through the canonical write path, so the two intake routes
 * (`createClient`'s direct `.create()` + `addServiceToClient`'s
 * `writeClientWithCanonicalAggregates`) never drift (the H.3 investigation
 * flagged that drift risk).
 *
 * ─── What this stores, and what it deliberately does NOT ────────────────────
 * The client-level `plan{}` written by this helper holds ONLY the NON-confidential
 * inputs — `expectedHours` + `expectedRevenue` (hours and fees are already on the
 * world-readable `clients` doc). **`expectedCost` and `expectedProfit` are
 * DELIBERATELY OMITTED**: they are cost-derived (confidential, MASTER_PLAN §7.6 —
 * a single-employee case's cost÷hours = that employee's exact rate), so they live
 * in the CF-only `client_profitability` collection introduced in H.3 PR3, NEVER on
 * the `clients` doc. See MASTER_PLAN §8.5 D-A.
 *
 * ─── Revenue rules (D-B, Haim-approved 2026-06-10) ──────────────────────────
 * Per service: an explicit fixed price wins; else a stored hourly rate × budgeted
 * hours; else `null` + a `pricing_missing` signal. NEVER 0-for-unknown and NEVER a
 * silently-defaulted rate (e.g. the deduction-time 800) — that would fabricate
 * revenue for the ~90 un-priced `hours` services and poison expectedProfit (the
 * exact drift the profitability layer exists to surface). The authoritative tofes
 * `amountBeforeVat` source is swapped in at H.6 (§8.2.5 D1); this leaves the seam.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports._PLAN_SKIP_STATUSES = exports.PROFITABILITY_PLAN_SCHEMA_VERSION = void 0;
exports.computeServicePlan = computeServicePlan;
exports.computeClientPlan = computeClientPlan;
const SCHEMA_VERSION = 1;
/**
 * Service statuses excluded from the Plan — mirrors `aggregates.NON_AGGREGATING_STATUSES`
 * (`['archived']`) so Plan and the hours aggregates sum the SAME active subset. A
 * drift-guard test pins this to the aggregates constant.
 */
const PLAN_SKIP_STATUSES = ['archived'];
function finiteNum(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function positiveNum(v) {
    const n = finiteNum(v);
    return n !== null && n > 0 ? n : null;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
/**
 * A service is "hourly" (budgets billable hours) unless it is a `fixed`-type
 * service or carries `pricingType === 'fixed'` (a fixed-price hours/legal bucket).
 */
function isHourlyService(svc) {
    if (!svc || typeof svc !== 'object')
        return false;
    if (svc.type === 'fixed')
        return false;
    if (svc.pricingType === 'fixed')
        return false;
    return true;
}
/** Derives one service's Plan snapshot (raw intake values; no re-derivation). */
function computeServicePlan(svc) {
    const hourly = isHourlyService(svc);
    const expectedHours = hourly ? finiteNum(svc?.totalHours) : null;
    // Revenue priority: an explicit fixed price (any of the 3 field names seen in the
    // wild) → else a stored hourly rate × budgeted hours → else unknown.
    const fixedPrice = finiteNum(svc?.fixedPrice) ??
        finiteNum(svc?.totalFixedPrice) ??
        finiteNum(svc?.totalPrice);
    if (fixedPrice !== null) {
        return { expectedHours, expectedRevenue: round2(fixedPrice), revenueSource: 'fixed_price' };
    }
    const rate = positiveNum(svc?.ratePerHour);
    if (hourly && rate !== null && expectedHours !== null) {
        return { expectedHours, expectedRevenue: round2(rate * expectedHours), revenueSource: 'rate_x_hours' };
    }
    // No derivable price — the `pricing_missing` case (never 0, never a default rate).
    return { expectedHours, expectedRevenue: null, revenueSource: 'unknown' };
}
/**
 * Derives the client-level Plan from `services[]`. Skips archived services (mirrors
 * the hours-aggregate filter). Null-aware sums: an un-priced service contributes 0 to
 * the revenue sum but increments `pricingMissingCount` and flips `pricingComplete`.
 */
function computeClientPlan(services) {
    const list = Array.isArray(services) ? services.filter(Boolean) : [];
    let expectedHours = 0;
    let expectedRevenue = 0;
    let pricingMissingCount = 0;
    let serviceCount = 0;
    for (const svc of list) {
        const status = String((svc && typeof svc === 'object' ? svc.status : undefined) ?? 'active');
        if (PLAN_SKIP_STATUSES.includes(status))
            continue;
        serviceCount += 1;
        const plan = computeServicePlan(svc);
        if (plan.expectedHours !== null)
            expectedHours += plan.expectedHours;
        if (plan.expectedRevenue !== null)
            expectedRevenue += plan.expectedRevenue;
        else
            pricingMissingCount += 1;
    }
    return {
        expectedHours: round2(expectedHours),
        expectedRevenue: round2(expectedRevenue),
        pricingComplete: pricingMissingCount === 0,
        pricingMissingCount,
        serviceCount,
        schemaVersion: SCHEMA_VERSION
    };
}
exports.PROFITABILITY_PLAN_SCHEMA_VERSION = SCHEMA_VERSION;
/** Exposed for the drift-guard test (pins it to aggregates.NON_AGGREGATING_STATUSES). */
exports._PLAN_SKIP_STATUSES = PLAN_SKIP_STATUSES;
//# sourceMappingURL=client-plan.js.map