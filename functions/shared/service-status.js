/**
 * service-status.js — SSOT for "does this service accept new hours?"
 *
 * A service whose status is CLOSED (archived or completed) must NOT accept new
 * timesheet hours or new hour packages. This is enforced SERVER-SIDE at every
 * hour-admitting write path: the Cloud Functions use the Admin SDK and bypass
 * firestore.rules, so a frontend-only gate is bypassable.
 *
 * SCOPE — this is a SEPARATE concern from aggregation. Do NOT conflate the two:
 *   - HOURS_LOCKED_STATUSES (['archived','completed']) governs WRITE ADMISSION
 *     (may this service accept NEW hours?).
 *   - NON_AGGREGATING_STATUSES (['archived'], shared/aggregates.js) governs
 *     AGGREGATION MATH (does this service count toward client totals?).
 *   They are DELIBERATELY different sets and must NOT be merged: a 'completed'
 *   service is still aggregated (billing-locked history is retained) but must
 *   not accept new hours; an 'on_hold' service is a temporary pause that stays
 *   OPEN to new hours. Do NOT reuse or modify NON_AGGREGATING_STATUSES here.
 *
 * DEFAULT-ACTIVE: a service with no `status` field defaults to 'active' →
 *   accepts. Mirrors the `svc?.status || 'active'` convention in aggregates.js.
 *
 * OVERRIDE DOES NOT BYPASS: the status gate is checked REGARDLESS of
 *   `overrideActive`. `overrideActive` only ever bypassed the `hoursRemaining
 *   <= 0` gate; a CLOSED service is closed. To add hours to a closed service an
 *   admin must first change its status back to active.
 *
 * @module functions/shared/service-status
 */
'use strict';

/**
 * Statuses that LOCK a service against new hours. NEW, separate constant —
 * intentionally NOT NON_AGGREGATING_STATUSES (that one is aggregation-only).
 */
const HOURS_LOCKED_STATUSES = Object.freeze(['archived', 'completed']);

/**
 * Firebase HttpsError code used by the DEFAULT thrown error. Matches the sibling
 * "service blocked" gates across the callers — they all throw
 * `functions.https.HttpsError('failed-precondition', ...)`.
 */
const HOURS_LOCKED_CODE = 'failed-precondition';

/**
 * Customer-facing Hebrew message (G1/G5). Contains NO PII — never interpolate a
 * client/service name, id, or amount into this string.
 */
const HOURS_LOCKED_MESSAGE =
  'לא ניתן להוסיף שעות לשירות סגור (בארכיון או שהושלם). ' +
  'כדי להוסיף שעות, יש לשנות את סטטוס השירות ל"פעיל" תחילה.';

/**
 * Does this service (or stage — anything carrying a `status`) accept new hours?
 *
 * @param {Object} service - a service/stage object with an optional `status`.
 * @returns {boolean} true when the object may accept new hours.
 */
function serviceAcceptsHours(service) {
  const status = service && service.status ? service.status : 'active';
  return !HOURS_LOCKED_STATUSES.includes(status);
}

/**
 * Throw the codebase's standard customer-facing error when `service` is closed.
 *
 * By design this module does NOT hard-depend on a specific HttpsError class:
 *   - pass `makeError(code, message)` to build the error the caller's own way
 *     (e.g. a v2 file that uses HttpsError from firebase-functions/v2/https);
 *   - omit it, and the DEFAULT lazily builds `functions.https.HttpsError` —
 *     exactly what every current caller (v1 onCall) already throws for the
 *     sibling "service blocked" gate, so callers just call this with one arg.
 *
 * A throw here, placed inside a Firestore transaction before any deduction/entry
 * write, aborts the transaction cleanly (no mutation reaches Firestore).
 *
 * @param {Object} service
 * @param {(code: string, message: string) => Error} [makeError] optional error factory.
 * @throws when `!serviceAcceptsHours(service)`.
 */
function assertServiceAcceptsHours(service, makeError) {
  if (serviceAcceptsHours(service)) {
    return;
  }
  if (typeof makeError === 'function') {
    throw makeError(HOURS_LOCKED_CODE, HOURS_LOCKED_MESSAGE);
  }
  // Lazy require so this module carries no top-level firebase-functions
  // dependency (honours "no hard-dependency on a specific HttpsError class").
  // NOTE: the default builds a v1 `functions.https.HttpsError`, which matches
  // every current caller (all v1 onCall). A FUTURE v2 caller (ENGINEERING_BAR
  // mandates v2 for new endpoints) MUST pass `makeError` that builds the v2
  // `HttpsError` from 'firebase-functions/v2/https' — the v1 class would be wrong.
  const functions = require('firebase-functions');
  throw new functions.https.HttpsError(HOURS_LOCKED_CODE, HOURS_LOCKED_MESSAGE);
}

module.exports = {
  HOURS_LOCKED_STATUSES,
  HOURS_LOCKED_CODE,
  HOURS_LOCKED_MESSAGE,
  serviceAcceptsHours,
  assertServiceAcceptsHours
};
