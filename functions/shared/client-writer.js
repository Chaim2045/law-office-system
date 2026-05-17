/**
 * Canonical write helper for the `clients` collection.
 *
 * Single mandated entry point for any code that mutates client documents.
 * Enforces that client aggregate fields (isBlocked, isCritical, hoursUsed,
 * hoursRemaining, minutesUsed, minutesRemaining, totalHours) are derived
 * EXCLUSIVELY from calcClientAggregates — callers cannot set them directly.
 *
 * Why this exists:
 *   The 2026-05-13 audit identified 14 production callsites that write
 *   client aggregates, and 23 historically-corrupted clients (`isBlocked=true`
 *   incorrectly) traced to a duplicate calcClientAggregates that set
 *   `isBlocked` as a side effect (fixed in PR #266). The root architectural
 *   gap was the lack of a single canonical write path: each CF computed
 *   aggregates independently, and any drift in any path silently corrupted
 *   the document.
 *
 *   This helper closes that gap. All 14 callsites will be migrated to use
 *   it (PR-A.4 + PR-B). After migration, the buggy-write class of bug
 *   becomes architecturally impossible.
 *
 * Contract:
 *   - Runs inside an active Firestore transaction (caller starts it).
 *   - Reads current client BEFORE any update (transaction semantics).
 *   - Strips caller-supplied RESTRICTED_KEYS — they cannot be set by callers.
 *   - Recomputes totalHours from services[] (derived, not trusted).
 *   - Calls calcClientAggregates on the merged services + recomputed totalHours.
 *   - Calls assertClientAggregateInvariants before transaction.update —
 *     fail-fast so invalid writes never reach Firestore.
 *   - Tolerates malformed services (null entries, missing fields, legacy
 *     shapes) — filtering + falling through to calcClientAggregates which
 *     is itself tolerant.
 *
 * Usage:
 *   await db.runTransaction(async (tx) => {
 *     return writeClientWithCanonicalAggregates(tx, clientRef, {
 *       status: 'inactive',          // arbitrary non-aggregate field
 *       // isBlocked: true           // ← would be stripped (won't error, won't apply)
 *     }, {
 *       caller: 'changeClientStatus',  // for assert violation messages
 *       auditMeta: { uid, username }   // optional — adds lastModified*
 *     });
 *   });
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calcClientAggregates, assertClientAggregateInvariants } = require('./aggregates');
const { SYSTEM_CONSTANTS } = require('./constants');

const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

/**
 * Fields callers MUST NOT set directly. Derived from canonical aggregates.
 * Any of these in partialUpdate is silently stripped and reported in the
 * `strippedKeys` array of the return value (no error — the canonical
 * path simply overrides).
 */
const RESTRICTED_KEYS = Object.freeze([
  'isBlocked',
  'isCritical',
  'hoursUsed',
  'hoursRemaining',
  'minutesUsed',
  'minutesRemaining',
  'totalHours' // derived: sum of billable services' totalHours
]);

/**
 * Recompute totalHours from services array.
 * Billable = not fixed (ST.FIXED) and not legal_procedure+fixed.
 *
 * @param {Array} services
 * @returns {number}
 */
function recomputeTotalHours(services) {
  return services.reduce((sum, svc) => {
    if (!svc) return sum;
    if (svc.type === ST.FIXED) return sum;
    if (svc.type === ST.LEGAL_PROCEDURE && svc.pricingType === PT.FIXED) return sum;
    return sum + (typeof svc.totalHours === 'number' ? svc.totalHours : 0);
  }, 0);
}

/**
 * Default violation logger — fire-and-forget write to clientInvariantViolations.
 * Runs OUTSIDE the failing transaction, so the violation persists even when
 * the transaction aborts. Errors writing the violation are themselves logged
 * (we don't want logging to mask the original assertion error).
 *
 * @param {Object} violation - structured violation document
 */
function defaultViolationLogger(violation) {
  // Use admin.firestore() (not the transaction!) so this is a new
  // operation, independent of the doomed transaction.
  admin.firestore()
    .collection('clientInvariantViolations')
    .add(violation)
    .catch((logErr) => {
      functions.logger.error(
        '[client-writer] failed to write clientInvariantViolations entry',
        { error: logErr.message, violation }
      );
    });
}

/**
 * @param {FirebaseFirestore.Transaction} transaction
 * @param {FirebaseFirestore.DocumentReference} clientRef
 * @param {Object} partialUpdate - fields to update; RESTRICTED_KEYS stripped
 * @param {Object} options
 * @param {string} options.caller - short label for assert violation messages
 * @param {Object} [options.auditMeta] - optional { uid, username } → adds
 *   lastModifiedAt (serverTimestamp) + lastModifiedBy
 * @param {Function} [options.violationLogger] - optional override of the
 *   violation logger (for tests). Defaults to firestore write +
 *   functions.logger.error.
 * @returns {Promise<{aggregates, previousAggregates, strippedKeys, written}>}
 */
async function writeClientWithCanonicalAggregates(
  transaction,
  clientRef,
  partialUpdate,
  options
) {
  // ─── 1. Input validation ─────────────────────────────────────────
  if (!transaction) {
    throw new Error('writeClientWithCanonicalAggregates: transaction is required');
  }
  if (!clientRef) {
    throw new Error('writeClientWithCanonicalAggregates: clientRef is required');
  }
  if (!partialUpdate || typeof partialUpdate !== 'object') {
    throw new Error('writeClientWithCanonicalAggregates: partialUpdate must be an object');
  }
  if (!options || typeof options !== 'object' || !options.caller) {
    throw new Error('writeClientWithCanonicalAggregates: options.caller is required');
  }

  const { caller, auditMeta } = options;
  const violationLogger = typeof options.violationLogger === 'function'
    ? options.violationLogger
    : defaultViolationLogger;

  // ─── 2. Transactional read ───────────────────────────────────────
  const doc = await transaction.get(clientRef);
  if (!doc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      `client document not found [caller=${caller}]`
    );
  }
  const currentData = doc.data() || {};

  // Capture previous aggregate state for return value
  const previousAggregates = {
    isBlocked: currentData.isBlocked === true,
    isCritical: currentData.isCritical === true,
    hoursUsed: currentData.hoursUsed || 0,
    hoursRemaining: currentData.hoursRemaining || 0,
    minutesUsed: currentData.minutesUsed || 0,
    minutesRemaining: currentData.minutesRemaining || 0,
    totalHours: currentData.totalHours || 0
  };

  // ─── 3. Strip restricted keys from caller input ──────────────────
  const sanitized = { ...partialUpdate };
  const strippedKeys = [];
  for (const key of RESTRICTED_KEYS) {
    if (key in sanitized) {
      strippedKeys.push(key);
      delete sanitized[key];
    }
  }

  if (strippedKeys.length > 0) {
    // Not an error — but flag it. Tracks any callsite that hasn't been
    // migrated yet, and any UI bug that tries to set these fields directly.
    functions.logger.warn(
      `[client-writer] stripped restricted keys [caller=${caller}]: ${strippedKeys.join(', ')}`
    );
  }

  // ─── 4. Merge + filter services ──────────────────────────────────
  // Caller's partialUpdate.services (if present) wholesale replaces current.
  const merged = { ...currentData, ...sanitized };
  const services = Array.isArray(merged.services)
    ? merged.services.filter(Boolean)
    : [];

  // ─── 5. Recompute derived totalHours from services ───────────────
  const totalHours = recomputeTotalHours(services);

  // ─── 6. Canonical aggregates ─────────────────────────────────────
  const aggregates = calcClientAggregates(services, totalHours);

  // ─── 7. Build final write payload ────────────────────────────────
  const finalPayload = {
    ...sanitized,
    services, // ensure services in payload reflects filtered list
    totalHours,
    hoursUsed: aggregates.hoursUsed,
    hoursRemaining: aggregates.hoursRemaining,
    minutesUsed: aggregates.minutesUsed,
    minutesRemaining: aggregates.minutesRemaining,
    isBlocked: aggregates.isBlocked,
    isCritical: aggregates.isCritical
  };

  if (auditMeta && typeof auditMeta === 'object') {
    finalPayload.lastModifiedAt = admin.firestore.FieldValue.serverTimestamp();
    if (auditMeta.username) {
      finalPayload.lastModifiedBy = auditMeta.username;
    }
  }

  // ─── 8. Defensive invariant assertion ────────────────────────────
  // Should never throw if calcClientAggregates is correct. If it does,
  // calcClientAggregates has drifted from the documented invariants —
  // fail fast so the bad write never lands in Firestore.
  //
  // PR-A.5 (2026-05-17): on assertion failure, ALSO write a structured
  // violation record to clientInvariantViolations + emit a Cloud Logging
  // entry. This survives the transaction abort because the violation
  // writer uses admin.firestore() directly (not the transaction).
  try {
    assertClientAggregateInvariants(services, finalPayload, caller);
  } catch (assertErr) {
    const violation = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      caller,
      clientId: clientRef.id,
      error: assertErr.message,
      proposedAggregates: {
        isBlocked: finalPayload.isBlocked,
        isCritical: finalPayload.isCritical,
        totalHours: finalPayload.totalHours,
        hoursRemaining: finalPayload.hoursRemaining
      },
      servicesSummary: services.map((s) => ({
        id: s.id || null,
        type: s.type || null,
        pricingType: s.pricingType || null,
        totalHours: typeof s.totalHours === 'number' ? s.totalHours : null,
        status: s.status || null
      })),
      auditMeta: auditMeta || null
    };

    // Fire-and-forget: do not await, do not let logging block the throw.
    // Errors writing the violation are caught inside the logger.
    try {
      violationLogger(violation);
    } catch (loggerErr) {
      // Logger threw synchronously (shouldn't happen for default, possible
      // for test mocks). Don't let it mask the original assertion error.
      functions.logger.error(
        '[client-writer] violationLogger threw synchronously',
        { error: loggerErr.message }
      );
    }

    // Structured Cloud Logging entry (independent of the violation collection)
    functions.logger.error('invariant_violation', {
      type: 'invariant_violation',
      caller,
      clientId: clientRef.id,
      error: assertErr.message
    });

    throw assertErr;
  }

  // ─── 9. Write ────────────────────────────────────────────────────
  transaction.update(clientRef, finalPayload);

  return {
    aggregates,
    previousAggregates,
    strippedKeys,
    written: finalPayload
  };
}

module.exports = {
  writeClientWithCanonicalAggregates,
  RESTRICTED_KEYS,
  // exported for unit tests
  _recomputeTotalHours: recomputeTotalHours
};
