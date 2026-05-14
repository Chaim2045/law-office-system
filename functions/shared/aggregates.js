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

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

// ⚠️ Keep in sync: also used by functions/src/modules/aggregation/index.js (imported from here)
function isFixedService(svc) {
  return svc.type === ST.FIXED ||
    (svc.type === ST.LEGAL_PROCEDURE && svc.pricingType === PT.FIXED);
}

/**
 * Calculate client-level aggregates from services array.
 * Respects overrideActive and overdraftResolved flags for isBlocked.
 *
 * INVARIANTS guaranteed by this function:
 *   I1: billable.length === 0  ⇒  isBlocked === false && isCritical === false
 *   I2: any service has overrideActive=true OR overdraftResolved.isResolved=true
 *       ⇒  isBlocked === false
 *   I3: isBlocked === true  ⇒  hoursRemaining <= 0
 *   I4: isCritical === true  ⇒  isBlocked === false && 0 < hoursRemaining <= 5
 *
 * If you write client.isBlocked / client.isCritical anywhere OTHER than from
 * this function's return value, you are creating a drift source. Don't.
 */
function calcClientAggregates(services, clientTotalHours) {
  const safeTotalHours = typeof clientTotalHours === 'number' && !Number.isNaN(clientTotalHours)
    ? clientTotalHours
    : 0;

  const billableServices = (services || []).filter(svc => !isFixedService(svc));

  const hoursUsed = round2(
    billableServices.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0)
  );

  const hoursRemaining = round2(safeTotalHours - hoursUsed);
  const minutesUsed = round2(hoursUsed * 60);
  const minutesRemaining = round2(hoursRemaining * 60);

  let isBlocked;
  let isCritical;

  if (billableServices.length === 0) {
    isBlocked = false;
    isCritical = false;
  } else {
    const hasActiveOverride = (services || []).some(svc =>
      svc.overrideActive === true || svc.overdraftResolved?.isResolved === true
    );
    isBlocked = hoursRemaining <= 0 && !hasActiveOverride;
    isCritical = !isBlocked && hoursRemaining > 0 && hoursRemaining <= 5;
  }

  return { hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical };
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

  const billable = (services || []).filter(svc => !isFixedService(svc));

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

  // I2: active override → must not be blocked
  const hasActiveOverride = (services || []).some(svc =>
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
  isFixedService
};
