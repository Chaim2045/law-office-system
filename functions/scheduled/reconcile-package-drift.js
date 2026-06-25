/**
 * reconcile-package-drift.js — OWN-2: the LIVE reconciliation loop.
 * ─────────────────────────────────────────────────────────────────────────────
 * The "self-healing" half of the single-owner aggregate redesign. Check-7
 * (`dailyInvariantCheck` -> `detectPackageInvariants`) DETECTS package/service
 * hours drift, read-only. This scheduled job is the REPAIR half: for each drifted
 * eligible HOURS service it recomputes the consumption from the ledger by calling
 * the OWN-1 owner (`writeServiceWithCanonicalPackages`) inside a transaction.
 *
 * SAFETY — gated, fail-safe-off, never auto-blocks:
 *   - Reads `system_settings/package_reconciliation` (shared/reconciliation-mode.js).
 *     Default = `off` (does nothing). `dry_run` = computes + LOGS what it WOULD
 *     repair, writes NOTHING. `enforce` = writes via the owner. The PROD-write
 *     opt-in is an admin flipping the flag to `enforce` (a supervised act).
 *   - NEVER auto-blocks: a recompute that would flip a client from
 *     isBlocked:false -> true is DEFERRED (counted + logged + surfaced in the run
 *     audit for human review), never written. Unblocking (true -> false) and pure
 *     number corrections ARE applied. Mirrors the offline repair's
 *     APPROVED_BLOCK_FLIPS gate (repair-package-aggregates.js:364,410) — the gate
 *     lives in THIS caller, not in the owner (the owner stays gate-free for the
 *     OWN-3 live-deduction paths where blocking a depleted client IS correct).
 *   - Per-service transaction with a fresh re-read + A5 updateTime guard + retry;
 *     the block-flip gate is re-evaluated on the SAME fresh snapshot the owner
 *     writes (fail-secure). Per-repair audit (writer-before-audit via the owner's
 *     applyRepairWritesInOrder) + a run-summary audit.
 *
 * This is a NEW scheduled function, separate from `dailyInvariantCheck` — the
 * read-only monitor stays read-only; repair is its own function.
 */
'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const { calcClientAggregates, round2 } = require('../shared/aggregates');
const { _recomputeTotalHours } = require('../shared/client-writer');
const {
  isEligibleService,
  assignEntriesForwardReplay,
  computeRepairedService,
  _internal: pkgInternal
} = require('../shared/package-repair-core');
const { writeServiceWithCanonicalPackages } = require('../shared/service-writer');
const { getReconciliationMode } = require('../shared/reconciliation-mode');
const { logCriticalAction, logCriticalActionInTxn } = require('../lib/audit-critical');

const db = admin.firestore();

// Service-level drift tolerance — LOCKED (SSOT) to the engine's own service
// invariant tolerance (SERVICE_INVARIANT_TOLERANCE = 0.05) so the loop's
// "is this drifted enough to repair?" threshold matches BOTH the recompute's own
// significance bar AND Check-7's package-drift tolerance
// (scheduled/index.js PKG_HOURSUSED_TOLERANCE = 0.05). → a repair the loop makes is
// one Check-7 also flags, so the dry_run smoke cross-checks cleanly against the
// Check-7 report. (NOT dailyInvariantCheck's 0.02 — that is the client-aggregate
// Check-6 tolerance, a different check.)
const TOLERANCE = pkgInternal.SERVICE_INVARIANT_TOLERANCE;
const MAX_RETRIES = 3;
// System actor for audit (matches the `sys:<name>` actorUid grammar of logCriticalAction).
const SYS_ACTOR = 'sys:reconcile-package-drift';
const RUN_AUDIT_ACTION = 'PACKAGE_RECONCILE_RUN';
const REPAIR_AUDIT_ACTION = 'PACKAGE_RECONCILE_REPAIR';
// Clients excluded — mirror repair-package-aggregates.js SKIP_CLIENTS (the offline
// repair's exemption list, the authoritative one for THIS write path).
const SKIP_CLIENTS = ['internal_office', '2025003'];
// Throw (-> Cloud Scheduler failure metric) only when a MAJORITY of write
// attempts failed — a systemic problem, not a single transient/aborted retry.
const SYSTEMIC_FAILURE_RATE = 0.5;

// ── PURE PLANNER (exported via _test) ────────────────────────────────────────

/**
 * Decide what to do with ONE service, purely (no Firestore). Reuses the OWN-1
 * engine for the recompute + the canonical client aggregator for the block-flip
 * prediction (mirror of repair-package-aggregates.js predictClientEffect).
 *
 * @param {Object} service - the candidate service (from the client's services[])
 * @param {Array} allServices - the client's full services[] (for the client-level
 *   block-flip prediction)
 * @param {Array} entriesForService - the COMPLETE entry set for this service
 *   (effectiveServiceId === service.id), incl. packageId:null orphans
 * @returns {{action:'skip'|'defer'|'repair', reason?:string, serviceId, serviceBefore?,
 *   serviceAfter?, ledgerTruth?, blockFlip?, repairedService?}}
 */
function planServiceReconciliation(service, allServices, entriesForService) {
  const serviceId = service && service.id;

  // Eligibility (D2): non-HOURS / archived / no-packages / override / overdraft-resolved -> skip.
  const elig = isEligibleService(service);
  if (elig.skip) {
    return { action: 'skip', reason: elig.reason, serviceId };
  }

  // Recompute from the ledger (the lift — same engine the owner uses).
  const replay = assignEntriesForwardReplay(service.packages, entriesForService || [], {
    overrideActive: service.overrideActive === true,
    serviceStatus: service.status
  });
  const computed = computeRepairedService(service, replay);
  const { serviceBefore, serviceAfter, ledgerTruth } = computed;

  // Fail-safe: never act on a service whose recompute doesn't match the ledger.
  if (!computed.invariantOk) {
    return { action: 'skip', reason: 'invariant_failed', serviceId, serviceBefore, serviceAfter, ledgerTruth };
  }

  // No drift -> nothing to do (the loop only repairs genuinely drifted services).
  const drift = Math.abs(round2(serviceAfter - serviceBefore));
  if (drift <= TOLERANCE) {
    return { action: 'skip', reason: 'no_drift', serviceId, serviceBefore, serviceAfter, ledgerTruth };
  }

  // Block-flip prediction: client isBlocked before vs after splicing the repaired
  // service. totalHours is intake-derived (unchanged by a consumption recompute),
  // so compute it once and use it for both sides.
  const cleanServices = (Array.isArray(allServices) ? allServices : []).filter(Boolean);
  const totalHours = _recomputeTotalHours(cleanServices);
  const newServices = cleanServices.map((s) => (s.id === serviceId ? computed.repairedService : s));
  const aggBefore = calcClientAggregates(cleanServices, totalHours);
  const aggAfter = calcClientAggregates(newServices, totalHours);
  const blockFlip = aggBefore.isBlocked !== aggAfter.isBlocked;
  const flipToBlocked = aggBefore.isBlocked === false && aggAfter.isBlocked === true;

  // NEVER auto-block. A repair that would block the client is deferred for a human.
  if (flipToBlocked) {
    return { action: 'defer', reason: 'block_flip_to_blocked', serviceId, serviceBefore, serviceAfter, ledgerTruth, blockFlip: true };
  }

  return { action: 'repair', serviceId, serviceBefore, serviceAfter, ledgerTruth, blockFlip, repairedService: computed.repairedService };
}

// ── I/O helpers ──────────────────────────────────────────────────────────────

/**
 * Load a client's timesheet entries grouped by EFFECTIVE service id
 * (parentServiceId || serviceId). Mirror of repair-package-aggregates.js
 * loadEntriesByService — keeps only the fields the replay needs.
 * @returns {Object<string, Array>} { [effectiveServiceId]: entry[] }
 */
async function loadEntriesByService(clientId) {
  const byService = {};
  const snap = await db.collection('timesheet_entries').where('clientId', '==', clientId).get();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const effId = d.parentServiceId || d.serviceId;
    if (!effId) return;
    if (!byService[effId]) byService[effId] = [];
    byService[effId].push({
      id: doc.id,
      minutes: typeof d.minutes === 'number' ? d.minutes : 0,
      createdAt: d.createdAt || null,
      date: d.date || null,
      packageId: d.packageId || null,
      serviceId: d.serviceId || null,
      parentServiceId: d.parentServiceId || null
    });
  });
  return byService;
}

/**
 * ENFORCE a single service repair: fresh re-read (client doc + entries) ->
 * re-plan on the fresh snapshot (the fail-secure block-flip re-check) -> if still
 * 'repair', write via the owner inside a txn with the A5 guard + retry.
 * @returns {Promise<{status:string, reason?:string, serviceBefore?:number, serviceAfter?:number}>}
 */
async function repairOneService(clientId, serviceId) {
  const clientRef = db.collection('clients').doc(clientId);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const freshDoc = await clientRef.get();
    if (!freshDoc.exists) return { status: 'client_vanished' };
    const clientUpdateTimeAtRead = freshDoc.updateTime;
    const freshData = freshDoc.data() || {};
    const freshServices = Array.isArray(freshData.services) ? freshData.services.filter(Boolean) : [];
    const service = freshServices.find((s) => s.id === serviceId);
    if (!service) return { status: 'service_vanished' };

    // Fresh entries for THIS service (read after the fresh client get → consistent).
    // eslint-disable-next-line no-await-in-loop
    const entriesByService = await loadEntriesByService(clientId);
    const entriesForService = entriesByService[serviceId] || [];

    // Re-plan on the fresh snapshot — the authoritative gate. A new entry that
    // arrived since the bulk scan could change the verdict (e.g. to a block-flip
    // that must defer, or to no-drift). We honor the FRESH verdict, not the scan's.
    const plan = planServiceReconciliation(service, freshServices, entriesForService);
    if (plan.action !== 'repair') {
      return { status: plan.action, reason: plan.reason, serviceBefore: plan.serviceBefore, serviceAfter: plan.serviceAfter };
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await db.runTransaction((tx) => writeServiceWithCanonicalPackages(
        tx,
        clientRef,
        { serviceId, entriesForService, clientUpdateTimeAtRead },
        {
          caller: 'reconcilePackageDrift',
          mode: 'enforce',
          auditFn: (t) => logCriticalActionInTxn(t, REPAIR_AUDIT_ACTION, SYS_ACTOR, {
            clientId,
            serviceId,
            serviceBefore: plan.serviceBefore,
            serviceAfter: plan.serviceAfter,
            netDelta: round2(plan.serviceAfter - plan.serviceBefore),
            schemaVersion: 1
          })
        }
      ));
      // Defensive: if the owner itself skipped (it independently re-checks
      // eligibility in-txn), DON'T count it as a repair — surface the skip.
      if (result && result.skipped) {
        return { status: 'skipped', reason: result.reason };
      }
      return { status: 'ok', serviceBefore: result.serviceBefore, serviceAfter: result.serviceAfter };
    } catch (err) {
      // A5 concurrency abort (or Firestore contention) → retry with a fresh read.
      if (err && err.code === 'aborted' && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }
  }
  return { status: 'aborted_max_retries' };
}

// ── THE SCHEDULED LOOP ───────────────────────────────────────────────────────

/**
 * The reconciliation loop body — extracted (and exported via _test) so it can be
 * unit-tested with an injected client list. Pure-of-the-onSchedule-wrapper.
 */
async function runReconciliation() {
  const mode = await getReconciliationMode();
  if (mode === 'off') {
    functions.logger.info('[reconcile-package-drift] mode=off — skipping (no read, no write)');
    return { mode, skippedRun: true };
  }

  const counters = {
    mode,
    clientsScanned: 0,
    servicesScanned: 0,
    repaired: 0,
    wouldRepair: 0,
    skipped: 0,
    blockFlipsDeferred: 0,
    invariantFailures: 0,
    failed: 0,       // WRITE failures only (feeds the systemic-failure throw ratio)
    scanErrors: 0,   // per-client read/scan errors (NOT a write failure → excluded from the ratio)
    netHoursDelta: 0
  };
  const deferrals = []; // non-PII: { clientId, serviceId, serviceBefore, serviceAfter }

  const clientsSnapshot = await db.collection('clients').get();
  functions.logger.info(`[reconcile-package-drift] mode=${mode} — scanning ${clientsSnapshot.size} clients`);

  for (const clientDoc of clientsSnapshot.docs) {
    const clientId = clientDoc.id;
    if (SKIP_CLIENTS.includes(clientId)) continue;

    try {
      const clientData = clientDoc.data() || {};
      const services = Array.isArray(clientData.services) ? clientData.services.filter(Boolean) : [];
      if (services.length === 0) continue;
      counters.clientsScanned += 1;

      // eslint-disable-next-line no-await-in-loop
      const entriesByService = await loadEntriesByService(clientId);

      for (const service of services) {
        if (!service.id) continue;
        counters.servicesScanned += 1;

        const plan = planServiceReconciliation(service, services, entriesByService[service.id] || []);

        if (plan.action === 'skip') {
          counters.skipped += 1;
          if (plan.reason === 'invariant_failed') {
            counters.invariantFailures += 1;
            functions.logger.warn('[reconcile-package-drift] invariant_failed — service not repaired', {
              clientId, serviceId: plan.serviceId, serviceBefore: plan.serviceBefore, serviceAfter: plan.serviceAfter, ledgerTruth: plan.ledgerTruth
            });
          }
          continue;
        }

        if (plan.action === 'defer') {
          counters.blockFlipsDeferred += 1;
          deferrals.push({ clientId, serviceId: plan.serviceId, serviceBefore: plan.serviceBefore, serviceAfter: plan.serviceAfter });
          functions.logger.warn('[reconcile-package-drift] block-flip DEFERRED (would block client — needs human review)', {
            clientId, serviceId: plan.serviceId, serviceBefore: plan.serviceBefore, serviceAfter: plan.serviceAfter
          });
          continue;
        }

        // plan.action === 'repair'
        if (mode === 'dry_run') {
          counters.wouldRepair += 1;
          counters.netHoursDelta = round2(counters.netHoursDelta + (plan.serviceAfter - plan.serviceBefore));
          functions.logger.info('[reconcile-package-drift] DRY-RUN would repair', {
            clientId, serviceId: plan.serviceId, serviceBefore: plan.serviceBefore, serviceAfter: plan.serviceAfter, blockFlip: plan.blockFlip
          });
          continue;
        }

        // mode === 'enforce'
        try {
          // eslint-disable-next-line no-await-in-loop
          const res = await repairOneService(clientId, service.id);
          if (res.status === 'ok') {
            counters.repaired += 1;
            counters.netHoursDelta = round2(counters.netHoursDelta + ((res.serviceAfter || 0) - (res.serviceBefore || 0)));
            functions.logger.info('[reconcile-package-drift] repaired', {
              clientId, serviceId: service.id, serviceBefore: res.serviceBefore, serviceAfter: res.serviceAfter
            });
          } else if (res.status === 'defer') {
            // The fresh re-plan flipped to defer — honor it (fail-secure).
            counters.blockFlipsDeferred += 1;
            deferrals.push({ clientId, serviceId: service.id, serviceBefore: res.serviceBefore, serviceAfter: res.serviceAfter });
          } else {
            // no_drift / invariant_failed / vanished on the fresh re-plan → count as skipped.
            counters.skipped += 1;
          }
        } catch (repairErr) {
          counters.failed += 1;
          functions.logger.error('[reconcile-package-drift] repair FAILED', {
            clientId, serviceId: service.id, errorCode: (repairErr && repairErr.code) || 'unknown'
          });
        }
      }
    } catch (clientErr) {
      counters.scanErrors += 1; // a READ/scan error — not a write failure
      functions.logger.error('[reconcile-package-drift] client scan error', {
        clientId, errorCode: (clientErr && clientErr.code) || 'unknown'
      });
    }
  }

  // Run-summary audit (non-PII: ids + hours + counts only; never clientName).
  try {
    await logCriticalAction(RUN_AUDIT_ACTION, SYS_ACTOR, {
      ...counters,
      // Cap the embedded array so the audit doc stays well under Firestore's 1 MiB
      // limit even in a high-deferral cycle; deferralsCount carries the true total
      // and every deferral is also emitted as an individual logger.warn.
      deferrals: deferrals.slice(0, 200),
      deferralsCount: deferrals.length,
      schemaVersion: 1
    });
  } catch (auditErr) {
    functions.logger.error('[reconcile-package-drift] run-summary audit failed', { errorCode: (auditErr && auditErr.code) || 'unknown' });
  }

  functions.logger.info('[reconcile-package-drift] run complete', counters);

  // Throw (Cloud Scheduler failure metric) only on a SYSTEMIC write-failure rate.
  const attempted = counters.repaired + counters.failed;
  if (attempted > 0 && (counters.failed / attempted) >= SYSTEMIC_FAILURE_RATE) {
    throw new Error(`[reconcile-package-drift] systemic failure: ${counters.failed}/${attempted} repairs failed`);
  }

  return counters;
}

// Scheduled at 07:00 Asia/Jerusalem — AFTER the 06:00 dailyInvariantCheck detector
// and the 06:30 aggregateClientProfitability job (staggered).
const reconcilePackageDrift = onSchedule({
  schedule: '0 7 * * *',
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async () => {
  await runReconciliation();
});

module.exports = {
  reconcilePackageDrift,
  // Promoted to a first-class export (OWN-3 admin control): the `runReconciliationNow`
  // callable invokes this on demand. It reads getReconciliationMode() itself, so a
  // manual run respects the CURRENT mode (off → no-op, dry_run → logs, enforce → writes).
  runReconciliation,
  _test: {
    planServiceReconciliation,
    runReconciliation,
    repairOneService,
    loadEntriesByService,
    TOLERANCE,
    SYSTEMIC_FAILURE_RATE
  }
};
