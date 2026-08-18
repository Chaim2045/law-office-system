/**
 * service-writer.js — the LIVE single-owner for a HOURS service's package
 * aggregates (OWN-1 of the single-owner-aggregate redesign).
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS ON LANDING: DEAD CODE. This module is wired to NOTHING — no live caller
 * `require`s it. It ships fully built + unit-tested so the hot write-path logic
 * lands, is reviewed, and is provable in isolation, with ZERO live-write risk.
 * The reroute of the ~11 incremental writers onto this owner is OWN-3; the
 * reconciliation loop that calls it from Check-7 is OWN-2. Until then it does not
 * execute in production. (Q5: no runtime flag is needed precisely because it is
 * not reachable — the enable-flag belongs to OWN-2/3.)
 *
 * WHAT THIS IS (design §4–§5, the single-owner architecture):
 *   The package/service level is the ONLY level of the hours-aggregate hierarchy
 *   without a single canonical owner. `package.hoursUsed` is written INCREMENTALLY
 *   (`+= Δ/60`) by ≥6 live paths, each invoking the shared delta fn independently,
 *   with no live recompute-from-ledger — that is the drift origin. The client
 *   level already HAS its owner (`writeClientWithCanonicalAggregates`,
 *   `client-writer.js`): it recomputes-from-children on every write, strips
 *   caller-set aggregates, and asserts invariants. This module is the equivalent
 *   owner ONE level down: it recomputes a HOURS service's per-package consumption
 *   from the LEDGER (timesheet entries), never from an incremental delta, and
 *   then delegates the client roll-up to the existing client owner.
 *
 *   Result: `service.hoursUsed` (→ client roll-up → billing/blocking) becomes a
 *   pure function of the entries, exactly like the offline DRIFT-2 repair — but
 *   live, in one transaction.
 *
 * THE LIFT (zero engine changes):
 *   The ledger-truth math already exists, pure and tested, in
 *   `package-repair-core.js`. This owner is a THIN WRAPPER:
 *     • `assignEntriesForwardReplay(packages, entries, opts)` — attributes every
 *       entry (including packageId:null orphans) to a package via the live
 *       getActivePackage selection priority, time-aware (FIFO by purchaseDate).
 *     • `computeRepairedService(service, replay)` — returns a ready-to-write
 *       `repairedService` ({...service, packages:[{...pkg, hoursUsed, hoursRemaining,
 *       status}], hoursUsed:Σpackages, hoursRemaining}) PLUS a service-level
 *       invariant (|serviceAfter − ledgerTruth| ≤ 0.05).
 *     • `isEligibleService(service)` — the D2 skip predicate.
 *     • `applyRepairWritesInOrder(tx, …)` — the writer-before-audit ordering
 *       primitive (the DRIFT-2.2 reads-before-writes lesson).
 *   This module adds: the in-transaction single read, the A5 optimistic guard,
 *   service selection by id, the invariant fail-safe, and the delegation to the
 *   client owner. It mirrors the WRITE-ORDERING + reads-before-writes of the
 *   DRIFT-2 `applyClient` flow (`repair-package-aggregates.js:343-448`),
 *   generalized to ONE service inside a transaction with entries supplied from
 *   outside. It deliberately does NOT carry `applyClient`'s `APPROVED_BLOCK_FLIPS`
 *   human-approval gate (`repair-package-aggregates.js:364,410`): that gate existed
 *   because a bulk overnight repair flipping many clients to `isBlocked` silently
 *   was operationally dangerous. For a LIVE per-write path a true `false→true`
 *   block flip is the CORRECT surfacing of a depleted client (the same recompute
 *   the existing deduction paths already do via the client owner). Whether any
 *   recompute-driven block flip needs a per-call-site gate is an OWN-3 wiring
 *   decision (see the rubric's OWN-3 prerequisites) — NOT a property baked into
 *   this primitive.
 *
 * WHY JS, NOT TS (deliberate, design-approved exception to the src-ts default):
 *   This owner mirrors `client-writer.js` (JS) and lifts `package-repair-core.js`
 *   (JS) — both canonical, both in `functions/shared/`. A TS module would either
 *   have to model the entire loosely-typed engine surface or escape-hatch around
 *   it, and would sit apart from the two siblings it is one continuous thought
 *   with. The functions/CLAUDE.md rule explicitly preserves existing-JS modules;
 *   this owner is tightly coupled to two of them. The approved OWN-1 design locks
 *   JS in `functions/shared/`.
 *
 * CONTRACT — reads-before-writes, single-service, entries-from-outside:
 *   - The ONLY in-transaction READ is `transaction.get(clientRef)`. Firestore
 *     transactions cannot run collection queries (only doc gets), so the service's
 *     entries are read OUTSIDE the transaction by the caller (exactly like the
 *     repair script + Check-7) and PASSED IN via `data.entriesForService`.
 *   - The caller MUST pass the COMPLETE entry set for this service (every entry
 *     whose `serviceId === data.serviceId`, INCLUDING packageId:null orphans) and
 *     NOTHING else. The owner attributes every passed entry to a package of THIS
 *     service — extra entries would be mis-assigned; missing entries would
 *     under-count. The owner cannot verify completeness (it does not query).
 *   - Optimistic concurrency (A5): if the caller passes the client doc's
 *     `updateTime` from its outside-the-txn read as `data.clientUpdateTimeAtRead`,
 *     the owner aborts (code `aborted`, retryable) when the CLIENT DOC changed in
 *     the read→write window — so the client doc the owner writes matches the one
 *     the caller read. SCOPE: A5 guards the CLIENT DOC only; timesheet entries
 *     live in a separate collection, so an entry INSERT / EDIT / DELETE in that
 *     window does NOT bump the client doc's `updateTime` and is NOT caught. That
 *     is the consciously-accepted D1 residual: the recompute can run on a slightly
 *     stale entry set and write a number that is internally consistent (passes the
 *     invariant on the passed set) but momentarily off. It is healed by OWN-2's
 *     reconciliation loop = "eventual ledger-truth, not per-write linearizability"
 *     (max staleness = one OWN-2 cycle; affected metric = billing hours). There is
 *     no Firestore mechanism to close it inside one transaction (txns cannot query
 *     the entry collection). OWN-3 MUST read `entriesForService` AFTER its own
 *     entry write (read-your-write) so the common single-writer case is fresh.
 *   - Writes NOTHING on the client directly. It splices the repaired service back
 *     into `services[]` and delegates the single `transaction.update` to
 *     `writeClientWithCanonicalAggregates({ services, ...extraClientFields })`,
 *     which recomputes client aggregates + the static Plan, strips RESTRICTED_KEYS,
 *     and asserts. The injected `auditFn` runs AFTER the write (writer-before-audit).
 *
 * READ-ONLY INTAKE (Q4): the owner writes ONLY the consumption aggregates
 *   (package/service hoursUsed/hoursRemaining/status). `totalHours`, `ratePerHour`,
 *   `fixedPrice`, `pricingType`, `status` are intake fields other layers depend on
 *   (Plan, recomputeTotalHours, forecast) — the engine's `{...service}` spread
 *   never touches them, so they pass through untouched.
 *
 * BC-2 NESTED LOCK: the repaired service is RECONSTRUCTED by
 *   `computeRepairedService` — its `{...service}`/`{...pkg}` spreads put the
 *   recomputed `hoursUsed/hoursRemaining/status` LAST, so any drifted nested
 *   aggregate that a caller might pass on the service object is unconditionally
 *   overwritten. The owner never trusts a caller's nested payload.
 *
 * D2 OVERRIDE (APPROVED = SKIP): the owner REFUSES to recompute a service with
 *   `overrideActive === true` or `overdraftResolved.isResolved === true` — the
 *   partner's intentional override/resolution is preserved, exactly like the
 *   repair. It returns `{ written:false, skipped:true, reason }` with no write.
 *   (`options.overrideServicePolicy:'recompute'` is a reserved escape hatch for a
 *   future reconciliation caller; it defaults to 'skip' = the D2 behavior.)
 */
'use strict';

const {
  assignEntriesForwardReplay,
  computeRepairedService,
  isEligibleService,
  applyRepairWritesInOrder
} = require('./package-repair-core');
const { writeClientWithCanonicalAggregates } = require('./client-writer');

// isEligibleService skip reasons that mean "HOURS service WITH packages, but
// intentionally frozen by a partner" (override / overdraft-resolved) — as opposed
// to the structural skips (not_hours / archived / no_packages). Only these are
// eligible for the `overrideServicePolicy:'recompute'` escape hatch.
const FROZEN_SKIP_REASONS = Object.freeze(['override_preserved', 'overdraft_resolved']);

/** Build an Error carrying a `.code` (mirrors the repair script's `e.code`). */
function ownerError(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * Recompute a single HOURS service's package aggregates from the ledger and write
 * the client doc through the canonical client owner. See the file header for the
 * full contract.
 *
 * @param {FirebaseFirestore.Transaction} transaction - an ACTIVE transaction
 *   (caller starts it). The owner performs exactly one read on it (`get(clientRef)`)
 *   before any write, satisfying Firestore reads-before-writes.
 * @param {FirebaseFirestore.DocumentReference} clientRef - the client document.
 * @param {Object} data
 * @param {string} data.serviceId - id of the service on `client.services[]` to
 *   recompute.
 * @param {Array} data.entriesForService - the COMPLETE set of timesheet entries
 *   for this service (read OUTSIDE the txn), each {id, minutes, createdAt?, date?,
 *   packageId?}. Orphans (packageId:null) MUST be included.
 * @param {*} [data.clientUpdateTimeAtRead] - the client doc's `updateTime` from
 *   the caller's outside-the-txn read. When provided, enables the A5 guard.
 * @param {Object} [data.extraClientFields] - extra NON-aggregate client fields to
 *   write atomically (RESTRICTED_KEYS are stripped by the client owner).
 * @param {Object} options
 * @param {string} options.caller - short label for audit/violation messages.
 * @param {Function} [options.auditFn] - `(tx) => void`, the forensic audit write
 *   (e.g. logCriticalActionInTxn). Runs AFTER the client write (writer-before-audit).
 * @param {string} [options.mode] - invariant enforcement mode passed through to
 *   the client owner ('enforce' | 'log_only' | 'disabled').
 * @param {Object} [options.auditMeta] - optional { uid, username } passed through
 *   to the client owner (adds lastModifiedAt/By on the client doc).
 * @param {string} [options.overrideServicePolicy] - 'skip' (default, D2) or
 *   'recompute' (reserved: force-recompute an override/overdraft-resolved service).
 * @returns {Promise<Object>} result. When recomputed:
 *   { written:true, skipped:false, reason:null, serviceId, serviceBefore,
 *     serviceAfter, ledgerTruth, invariantOk, packageDiffs, phantomReversals,
 *     unresolved, clientWriteResult }.
 *   When skipped: { written:false, skipped:true, reason, serviceId, serviceBefore }.
 */
async function writeServiceWithCanonicalPackages(transaction, clientRef, data, options) {
  // ─── 1. Input validation ─────────────────────────────────────────
  if (!transaction) {
    throw ownerError('writeServiceWithCanonicalPackages: transaction is required', 'invalid_argument');
  }
  if (!clientRef) {
    throw ownerError('writeServiceWithCanonicalPackages: clientRef is required', 'invalid_argument');
  }
  if (!data || typeof data !== 'object') {
    throw ownerError('writeServiceWithCanonicalPackages: data must be an object', 'invalid_argument');
  }
  if (!options || typeof options !== 'object' || !options.caller) {
    throw ownerError('writeServiceWithCanonicalPackages: options.caller is required', 'invalid_argument');
  }

  const { serviceId, entriesForService, clientUpdateTimeAtRead, extraClientFields } = data;
  if (!serviceId) {
    throw ownerError('writeServiceWithCanonicalPackages: data.serviceId is required', 'invalid_argument');
  }
  const entries = Array.isArray(entriesForService) ? entriesForService : [];

  const { caller, auditFn, mode, auditMeta } = options;
  const overrideServicePolicy = options.overrideServicePolicy === 'recompute' ? 'recompute' : 'skip';

  // ─── 2. The ONLY in-transaction read ─────────────────────────────
  const doc = await transaction.get(clientRef);
  if (!doc.exists) {
    throw ownerError(
      `writeServiceWithCanonicalPackages: client document not found [caller=${caller}]`,
      'not_found'
    );
  }

  // ─── 3. A5 optimistic-concurrency guard (opt-in) ─────────────────
  // If the caller captured the client doc's updateTime at the outside-the-txn
  // entry read, assert the doc is STILL at that version. A concurrent write in
  // the read→write window means the entries may no longer match the doc → abort
  // (retryable). Mirrors repair-package-aggregates.js:398-402.
  if (clientUpdateTimeAtRead) {
    const cur = doc.updateTime;
    const stillSame = !!cur && typeof cur.isEqual === 'function' && cur.isEqual(clientUpdateTimeAtRead);
    if (!stillSame) {
      throw ownerError(
        `writeServiceWithCanonicalPackages: client changed since the entries were read ` +
        `(A5 concurrency guard) [caller=${caller}]`,
        'aborted'
      );
    }
  }

  // ─── 4. Locate the target service ────────────────────────────────
  const currentData = doc.data() || {};
  const services = Array.isArray(currentData.services) ? currentData.services : [];
  const idx = services.findIndex((s) => s && s.id === serviceId);
  if (idx === -1) {
    throw ownerError(
      `writeServiceWithCanonicalPackages: service ${serviceId} not found on client [caller=${caller}]`,
      'service_not_found'
    );
  }
  const service = services[idx];

  // ─── 5. Eligibility (D2 — preserve partner override/resolution) ──
  const elig = isEligibleService(service);
  if (elig.skip) {
    const forceRecompute = overrideServicePolicy === 'recompute'
      && FROZEN_SKIP_REASONS.includes(elig.reason);
    if (!forceRecompute) {
      // Structural (not_hours/archived/no_packages) OR frozen (override/resolved):
      // no recompute, no write. The other services + the client doc are untouched.
      return {
        written: false,
        skipped: true,
        reason: elig.reason,
        serviceId,
        serviceBefore: typeof service.hoursUsed === 'number' ? service.hoursUsed : 0
      };
    }
  }

  // ─── 6. Recompute from the ledger (the lift) ─────────────────────
  // ATTRIBUTION IS FORWARD-REPLAY-DERIVED, NOT a group-by `entry.packageId`. The
  // engine re-derives each entry's package from the live getActivePackage priority
  // (time-aware FIFO) — the entry's recorded `packageId` is ADVISORY and is NOT
  // read here. This is deliberate (design BC-1/D1): a naive Σ-by-`packageId` would
  // DROP packageId:null overage orphans and under-bill. Do NOT "simplify" this to
  // group entries by their stored packageId. The service-level total (what
  // billing/blocking reads) equals the ledger truth either way; only the
  // per-package split is a current-logic-correct reconstruction.
  const replay = assignEntriesForwardReplay(service.packages, entries, {
    overrideActive: service.overrideActive === true,
    serviceStatus: service.status
  });
  const computed = computeRepairedService(service, replay);

  // Fail-safe: never write a service whose recomputed hoursUsed does not match
  // the ledger truth (Σ assigned minutes / 60). In practice serviceAfter and
  // ledgerTruth are the same sum grouped two ways, so this holds within rounding
  // tolerance — a violation means a real defect, so refuse the write entirely
  // (the transaction aborts; the client owner's own assert is a second layer).
  if (!computed.invariantOk) {
    throw ownerError(
      `writeServiceWithCanonicalPackages: service-level invariant failed for ${serviceId} ` +
      `(serviceAfter=${computed.serviceAfter} vs ledgerTruth=${computed.ledgerTruth}) — ` +
      `refusing to write [caller=${caller}]`,
      'invariant_violation'
    );
  }

  // ─── 7. Splice the repaired service back into services[] ─────────
  // ONLY the target service is recomputed; every other service passes through
  // byte-identical (single-owner: each service stands on its own). The client
  // owner then recomputes the client-level roll-up over the full array.
  const newServices = services.map((s, i) => (i === idx ? computed.repairedService : s));

  // ─── 8. Delegate the write to the client owner, audit AFTER ──────
  // applyRepairWritesInOrder pins reads-before-writes: the client owner's
  // internal transaction.get (READ) must precede the auditFn (pure WRITE).
  let clientWriteResult = null;

  // The recomputed services[] is the owner's AUTHORITATIVE output and must not be
  // clobbered by a caller's extraClientFields. `services` is NOT in the client
  // owner's RESTRICTED_KEYS, so a `extraClientFields:{services:[…]}` would otherwise
  // bypass the single-owner recompute entirely. Defense-in-depth: strip `services`
  // out of extra AND spread the recomputed payload LAST. extraClientFields is for
  // NON-aggregate fields only; client-level aggregate keys are already stripped by
  // the client owner's RESTRICTED_KEYS.
  const extra = {};
  if (extraClientFields && typeof extraClientFields === 'object') {
    for (const k of Object.keys(extraClientFields)) {
      if (k !== 'services') extra[k] = extraClientFields[k];
    }
  }
  const clientWriteOptions = { caller, mode };
  if (auditMeta && typeof auditMeta === 'object') clientWriteOptions.auditMeta = auditMeta;

  await applyRepairWritesInOrder(transaction, {
    clientRef,
    services: newServices,
    // applyRepairWritesInOrder calls writeFn(tx, ref, { services }); merge the
    // caller's extra non-aggregate fields UNDER the recomputed payload (payload
    // wins on `services`) and capture the canonical result.
    writeFn: async (tx, ref, payload) => {
      clientWriteResult = await writeClientWithCanonicalAggregates(
        tx, ref, { ...extra, ...payload }, clientWriteOptions
      );
    },
    auditFn: typeof auditFn === 'function' ? auditFn : () => {}
  });

  return {
    written: true,
    skipped: false,
    reason: null,
    serviceId,
    serviceBefore: computed.serviceBefore,
    serviceAfter: computed.serviceAfter,
    ledgerTruth: computed.ledgerTruth,
    invariantOk: computed.invariantOk,
    packageDiffs: computed.packageDiffs,
    phantomReversals: computed.phantomReversals,
    unresolved: replay.unresolved,
    clientWriteResult
  };
}

module.exports = {
  writeServiceWithCanonicalPackages,
  // exported for unit tests
  _internal: {
    FROZEN_SKIP_REASONS,
    ownerError
  }
};
