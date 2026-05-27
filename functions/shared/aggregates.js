/**
 * Shared client aggregate calculation.
 * Used by clients/, services/, and any function that modifies services[].
 *
 * SINGLE SOURCE OF TRUTH for client-level aggregates (isBlocked, isCritical,
 * hoursUsed, hoursRemaining, minutesUsed, minutesRemaining).
 *
 * Any code that writes these fields to Firestore MUST obtain them from
 * calcClientAggregates() — never compute them manually. The 2026-05-13 audit
 * found 20+ clients incorrectly blocked due to bypass paths; those have been
 * removed (see CHANGELOG / git log for refs).
 */

const { SYSTEM_CONSTANTS } = require('./constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// isFixedService is now consumed from the canonical service-classification module.
// PR-2.1.1 (2026-05-26): consolidated 4 prior copies into one SOT. Mirror lives
// inside functions/ (in-tree) so Cloud Functions deploy picks it up.
// See shared/business-rules/service-classification.js (canonical) and
// tests/unit/shared/business-rules.sync.test.ts (drift guard).
const { isFixedService } = require('./business-rules/service-classification');

/**
 * Service statuses excluded from client-level aggregates.
 *
 * PR-G.3.14 (2026-05-27): scope narrowed to ['archived'] only after Haim's
 * post-devils-advocate decision. Rationale:
 *   - 'archived' = service definitively closed; hours not part of active capacity
 *   - 'completed' NOT filtered — billing-locked, audit history retained (test
 *     functions/tests/complete-service.test.js:264-280 documents this intent)
 *   - 'on_hold' NOT filtered — temporary pause, may resume; data must persist
 *
 * Lifetime contract value (across all statuses) reachable via:
 *   services.reduce((s, svc) => s + (svc.totalHours || 0), 0)
 *
 * Trigger: client 2025724 in PROD — archived service (42h) was inflating
 * client.totalHours and masking -8.93h overdraft on the active service.
 */
const NON_AGGREGATING_STATUSES = Object.freeze(['archived']);

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Calculate client-level aggregates from services array.
 * Respects overrideActive and overdraftResolved flags for isBlocked.
 *
 * INVARIANTS guaranteed by this function:
 *   I1: billable.length === 0  ⇒  isBlocked === false && isCritical === false
 *   I2: any ACTIVE service has overrideActive=true OR overdraftResolved.isResolved=true
 *       ⇒  isBlocked === false
 *   I3: isBlocked === true  ⇒  hoursRemaining <= 0
 *   I4: isCritical === true  ⇒  isBlocked === false && 0 < hoursRemaining <= 5
 *   I5: archived services excluded from billable AND from totalHours derivation
 *       (PR-G.3.14, 2026-05-27). client.totalHours reflects ACTIVE billable
 *       capacity, not lifetime contract pool. Historical contract pool reachable
 *       via services[].totalHours reduce across all statuses.
 *
 * Choice A (PR-G.3.14): `totalHours` is RETURNED (derived from active billable
 * services only). The `clientTotalHours` parameter is kept for backward-compat
 * but no longer used as the source of truth for hoursRemaining. Callers SHOULD
 * use the returned `totalHours` field; legacy callers reading only hoursUsed/
 * hoursRemaining/isBlocked/isCritical are unaffected by parameter semantics.
 *
 * If you write client.isBlocked / client.isCritical / client.totalHours anywhere
 * OTHER than from this function's return value, you are creating a drift source.
 * Don't.
 *
 * @param {Array} services - client.services array
 * @param {number} clientTotalHours - DEPRECATED in semantic; kept for backward-compat
 * @returns {{hoursUsed:number, hoursRemaining:number, minutesUsed:number,
 *            minutesRemaining:number, isBlocked:boolean, isCritical:boolean,
 *            totalHours:number}}
 */
function calcClientAggregates(services, clientTotalHours) {
  // PR-G.3.14: filter non-aggregating statuses BEFORE the type filter, so
  // archived services drop out of both totalHours derivation AND hoursUsed sum.
  const activeServices = (services || []).filter(svc =>
    !NON_AGGREGATING_STATUSES.includes(svc?.status || 'active')
  );

  const billableServices = activeServices.filter(svc => !isFixedService(svc));

  const hoursUsed = round2(
    billableServices.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0)
  );

  // PR-G.3.14: Choice A — totalHours derived from active billable services only.
  // Replaces prior contract-pool semantic with active-capacity semantic.
  // Historical contract pool: services.reduce((s, svc) => s + (svc.totalHours || 0), 0).
  const totalHours = round2(
    billableServices.reduce((sum, svc) => sum + (svc.totalHours || 0), 0)
  );

  const hoursRemaining = round2(totalHours - hoursUsed);
  const minutesUsed = round2(hoursUsed * 60);
  const minutesRemaining = round2(hoursRemaining * 60);

  let isBlocked;
  let isCritical;

  if (billableServices.length === 0) {
    isBlocked = false;
    isCritical = false;
  } else {
    // PR-G.3.14: override scan limited to active services. Overrides on
    // archived services no longer suppress block — closed service ⇒ closed
    // override. Per devils-advocate: 0 such cases in PROD today, documented
    // behavioral change.
    const hasActiveOverride = activeServices.some(svc =>
      svc.overrideActive === true || svc.overdraftResolved?.isResolved === true
    );
    isBlocked = hoursRemaining <= 0 && !hasActiveOverride;
    isCritical = !isBlocked && hoursRemaining > 0 && hoursRemaining <= 5;
  }

  // Reference clientTotalHours so linters/static-analysis don't flag the unused
  // parameter — kept in signature for backward-compat with pre-PR-G.3.14 callers.
  void clientTotalHours;

  return { hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical, totalHours };
}

/**
 * Assert that a proposed client write does not violate invariants I1–I4.
 *
 * Use this BEFORE any `transaction.update(clientRef, { isBlocked, isCritical, ... })`
 * to fail-fast when bypass code paths emerge again. Throws on violation so the
 * bad write never reaches Firestore.
 *
 * @param {Object} services - client.services array (after the proposed change)
 * @param {Object} proposed - the fields about to be written; must include isBlocked + isCritical
 * @param {string} caller   - short label for error messages (function name)
 * @throws {Error} with explicit "invariant_violation:<which>" message
 */
function assertClientAggregateInvariants(services, proposed, caller = 'unknown') {
  if (!proposed || typeof proposed !== 'object') {
    throw new Error(`invariant_violation:missing_proposed [caller=${caller}]`);
  }

  // PR-G.3.14: align with calcClientAggregates — filter archived BEFORE type filter.
  // Without this alignment, archived-with-override scenarios would spuriously fire
  // I2_override_active_but_blocked while calcClientAggregates correctly blocks.
  const activeServices = (services || []).filter(svc =>
    !NON_AGGREGATING_STATUSES.includes(svc?.status || 'active')
  );
  const billable = activeServices.filter(svc => !isFixedService(svc));

  // I1: no billable services → must not be blocked or critical
  if (billable.length === 0) {
    if (proposed.isBlocked === true) {
      throw new Error(
        `invariant_violation:I1_no_billable_but_blocked [caller=${caller}] ` +
        `services=${services?.length || 0} billable=0 proposed.isBlocked=true`
      );
    }
    if (proposed.isCritical === true) {
      throw new Error(
        `invariant_violation:I1_no_billable_but_critical [caller=${caller}]`
      );
    }
  }

  // I2: active override (on an active service) → must not be blocked.
  // PR-G.3.14: scan limited to activeServices, matching calcClientAggregates.
  const hasActiveOverride = activeServices.some(svc =>
    svc.overrideActive === true || svc.overdraftResolved?.isResolved === true
  );
  if (hasActiveOverride && proposed.isBlocked === true) {
    throw new Error(
      `invariant_violation:I2_override_active_but_blocked [caller=${caller}]`
    );
  }

  // I4: critical and blocked mutually exclusive
  if (proposed.isBlocked === true && proposed.isCritical === true) {
    throw new Error(
      `invariant_violation:I4_blocked_and_critical [caller=${caller}]`
    );
  }
}

module.exports = {
  calcClientAggregates,
  assertClientAggregateInvariants,
  round2,
  isFixedService,
  NON_AGGREGATING_STATUSES // PR-G.3.14: exported so client-writer.recomputeTotalHours
                            // applies the same status filter (alignment guarantee).
};
