/**
 * idempotency.js — SSOT for atomic, transaction-scoped exactly-once writes.
 * ─────────────────────────────────────────────────────────────────────────────
 * PR-1 (merged) introduced an ATOMIC idempotency pattern inline inside
 * functions/addTimeToTask_v2.js, built on the `processed_operations` collection:
 *
 *   - Phase-1 (reads-before-writes): `transaction.get(idemRef)` — if the doc
 *     already exists, short-circuit and return its stored `result` verbatim
 *     (replay), performing NO further reads/writes for this call.
 *   - Phase-3 (after all other writes, still in the SAME transaction):
 *     `transaction.create(idemRef, {...})` — `.create()` (not `.set()`) so a
 *     truly concurrent duplicate transaction throws `already-exists` at
 *     commit time instead of silently overwriting.
 *   - Retry/catch layer: on `already-exists` for the SAME key, re-read the
 *     stored record directly (outside the transaction) and return its
 *     `result` — the operation already succeeded under a sibling call, so
 *     this is a clean replay, not a failure. If the sibling's doc is not yet
 *     visible, fall through to the normal retry loop (next attempt's Phase-1
 *     read will find it).
 *
 * PR-2 extracts this into a shared module so there is exactly ONE
 * implementation of the processed_operations record shape — consumed by
 * addTimeToTask_v2.js AND both functions/timesheet/index.js create paths
 * (createTimesheetEntry_v2, createQuickLogEntry). Byte-compatible with the
 * shape addTimeToTask_v2.js originally wrote inline, so historical records
 * created by either version read back identically.
 *
 * Record shape (written by writeProcessedOperation, read by
 * readProcessedOperation):
 *   {
 *     idempotencyKey: string,
 *     status: 'completed',
 *     result: <JSON-safe object — no serverTimestamp sentinels inside>,
 *     createdAt: FieldValue.serverTimestamp(),
 *     expiresAt: Timestamp
 *   }
 *
 * Public-repo safety: no PII fields are added by this module — `result` is
 * whatever the caller's write-path result object was (same discipline the
 * caller already applies to its own audit/log calls).
 */
'use strict';

const admin = require('firebase-admin');

/** Firestore collection holding exactly-once idempotency records. */
const PROCESSED_OPERATIONS_COLLECTION = 'processed_operations';

/** Default TTL (hours) for a processed-operation record, matching PR-1. */
const DEFAULT_IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Phase-1 (reads-before-writes): look up an idempotency key INSIDE an active
 * transaction. Call this among the transaction's other `transaction.get(...)`
 * reads, before any `transaction.set/update/create`.
 *
 * @param {FirebaseFirestore.Transaction} transaction - the active transaction
 * @param {FirebaseFirestore.Firestore} db - Firestore instance (for the collection ref)
 * @param {string} idempotencyKey - the caller-supplied idempotency key
 * @returns {Promise<{ref: FirebaseFirestore.DocumentReference, existingResult: *|null}>}
 *   `ref` — the processed_operations doc ref for this key (pass to
 *   writeProcessedOperation later in the SAME transaction).
 *   `existingResult` — the stored `result` if this key was already committed
 *   (caller should return it verbatim and skip all further writes), or `null`
 *   if this is a fresh key.
 */
async function readProcessedOperation(transaction, db, idempotencyKey) {
  const ref = db.collection(PROCESSED_OPERATIONS_COLLECTION).doc(idempotencyKey);
  const snap = await transaction.get(ref);
  if (snap.exists) {
    return { ref, existingResult: snap.data().result };
  }
  return { ref, existingResult: null };
}

/**
 * Phase-3 (after all other writes, still inside the SAME transaction): record
 * the completed operation using `.create()` so a genuinely concurrent
 * duplicate transaction fails atomically with `already-exists` at commit —
 * the desired serialization — instead of silently overwriting.
 *
 * @param {FirebaseFirestore.Transaction} transaction - the active transaction
 * @param {FirebaseFirestore.DocumentReference} ref - the ref returned by readProcessedOperation
 * @param {string} idempotencyKey - same key passed to readProcessedOperation
 * @param {*} result - JSON-safe result object (no serverTimestamp sentinels inside);
 *   this is both returned to the caller AND persisted verbatim for replay.
 * @param {{ttlHours?: number}} [options]
 */
function writeProcessedOperation(transaction, ref, idempotencyKey, result, options = {}) {
  const ttlHours = options.ttlHours || DEFAULT_IDEMPOTENCY_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  transaction.create(ref, {
    idempotencyKey,
    status: 'completed',
    result,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
  });
}

/**
 * Retry/catch-layer helper: on a caught `already-exists` error for a given
 * idempotency key, directly (non-transactionally) re-read the processed
 * operation and return its stored result if now visible. Returns `null` if
 * the winning sibling's doc is not yet visible (caller should fall through
 * to its normal retry loop).
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} idempotencyKey
 * @returns {Promise<*|null>} the stored result, or null if not yet visible
 */
async function replayAlreadyExists(db, idempotencyKey) {
  const doneSnap = await db.collection(PROCESSED_OPERATIONS_COLLECTION)
    .doc(idempotencyKey).get();
  if (doneSnap.exists) {
    return doneSnap.data().result;
  }
  return null;
}

module.exports = {
  PROCESSED_OPERATIONS_COLLECTION,
  DEFAULT_IDEMPOTENCY_TTL_HOURS,
  readProcessedOperation,
  writeProcessedOperation,
  replayAlreadyExists
};
