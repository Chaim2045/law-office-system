/**
 * backfill-strip-legal-hourly-rate.js — H.3 PR1-followup one-time backfill
 * ─────────────────────────────────────────────────────────────────────────────
 * Converges EXISTING client docs with the post-#369 semantics: a legal_procedure
 * HOURLY service no longer carries a fabricated `ratePerHour: 800` default. This
 * script REMOVES that un-elected 800 from existing `services[]` and recomputes the
 * static `client.plan` canonically, so the H.3 Plan reports `pricing_missing` for
 * those services instead of a fabricated 800×hours revenue.
 *
 * Background: before PR #369 the ONLY writers of a service `ratePerHour` were
 * createClient (`data.ratePerHour || 800`) + the two case-creation dialogs (which
 * hard-coded `data.ratePerHour = 800`); addServiceToClient wrote none. There was no
 * UI to elect a rate, so EVERY stored rate is the 800 placeholder. The real rate is
 * sourced from the tofes `amountBeforeVat` snapshot at H.6 (MASTER_PLAN §8.2.5 D1).
 * See MASTER_PLAN §8.5 D-B + the seam note in functions/src-ts/profitability/client-plan.ts.
 *
 * ─── Safety (mirrors functions/scripts/backfill-cost-per-hour.js) ─────────────
 *   • DRY-RUN by default. `--apply` to write. NON-interactive (supervised run, §8.4).
 *   • DISCOVERY-FIRST + GLOBAL ANOMALY GATE: a stored rate that is NOT exactly 800
 *     (any other number, incl. 0 / negative, OR a numeric rate on a non-legal-hourly
 *     service) is a deliberately-ELECTED rate to PRESERVE — it aborts the WHOLE run
 *     (zero writes) and is reported as clientId + code, fail-secure. NEVER stripped.
 *   • AGGREGATE-DRIFT GUARD: the canonical writer re-derives ALL hours aggregates on
 *     every write. To keep this migration surgical (touch ONLY plan + the stripped
 *     rate), a client whose STORED hours aggregates already differ from the canonical
 *     recompute is SKIPPED + flagged (`AGGREGATE_DRIFT`) — its block-state / hours are
 *     NOT silently "healed" by the rate strip. Such clients are a separate, audited
 *     decision. (Removing `ratePerHour` itself cannot change any aggregate — it is not
 *     an input to calcClientAggregates — so a clean client's hours stay byte-identical.)
 *   • Canonical write path: writeClientWithCanonicalAggregates (the only mandated
 *     `clients` writer) recomputes `plan` (RESTRICTED_KEY → derived). AWAITED inside
 *     the txn so its internal read+update complete BEFORE the audit set (reads-before-writes).
 *   • Per-client Firestore transaction (the writer is a read-modify-write; a flat
 *     500-batch cannot host it). Cohort is small (~200 clients total). In-txn audit
 *     via logCriticalActionInTxn → audit + mutation commit/abort atomically.
 *   • Concurrency: the cohort is re-verified from the IN-TRANSACTION read (strip set,
 *     anomaly, null-entry, drift). Firestore optimistic concurrency guarantees no torn
 *     write under a concurrent timesheet write — the loser retries against fresh state.
 *     (Prefer a low-activity window for `--apply`, but correctness does not require it.)
 *   • Idempotent: a re-run after `--apply` finds no 800 to strip → no-op.
 *   • Durable local JSON backup of the before-state (clientId + full services[] +
 *     plan + hours aggregates) BEFORE any write. Dir is gitignored (functions/backfill-backups/).
 *     Primary DATA rollback = the project's managed Firestore backup / PITR; this JSON
 *     is the before-state record + audit aid.
 *   • PII / PUBLIC repo: console + audit log carry clientId + errorCode/counts ONLY —
 *     never client names / idNumber / amounts.
 *
 * Usage (from functions/, with Admin SDK credentials, supervised by Haim):
 *   node scripts/backfill-strip-legal-hourly-rate.js            # dry-run (default)
 *   node scripts/backfill-strip-legal-hourly-rate.js --apply    # write (Haim's hands)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const { writeClientWithCanonicalAggregates, _recomputeTotalHours } = require('../shared/client-writer');
const { calcClientAggregates } = require('../shared/aggregates');
const { logCriticalActionInTxn } = require('../lib/audit-critical');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
// Used for the DRY-RUN plan preview only (the actual write derives plan inside the
// canonical writer, which calls the same helper — single source of truth).
const { computeClientPlan } = require('../lib/profitability/client-plan');

const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

const APPLY = process.argv.includes('--apply');
const PAGE = 500;
const DEFAULT_RATE = 800; // the only value the legacy writers ever baked
const CLIENTS_COLLECTION = 'clients';
const ACTOR = 'sys:backfill-rate-h3'; // matches audit-critical SYSTEM_ACTOR_PATTERN
const ACTION = 'BACKFILL_STRIP_LEGAL_HOURLY_RATE';
const CALLER = 'backfill-strip-legal-hourly-rate';
const AUDIT_SCHEMA_VERSION = 1;

// The hours-aggregate keys the canonical writer re-derives on every write. The strip
// must leave ALL of these byte-identical; any pre-existing drift → skip (don't heal).
const AGGREGATE_KEYS = Object.freeze([
  'totalHours', 'hoursUsed', 'hoursRemaining', 'minutesUsed', 'minutesRemaining', 'isBlocked', 'isCritical'
]);

// ─────────────────────────────────────────────────────────────────────────────
// PURE, TESTABLE CORE (no I/O) — exported for the jest suite.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a client's services[] for the strip migration. Does NOT mutate input.
 *
 * @param {Array} services
 * @returns {{
 *   stripIdx: number[],                       // indices of legal-hourly services with ratePerHour===800
 *   anomalies: Array<{index:number, code:string}>, // numeric rate that is NOT a legal-hourly 800 → GLOBAL STOP
 *   hasNullEntry: boolean,                     // a null/non-object slot → skip+flag this client (don't STOP)
 *   nonNumericRate: number                     // count of services whose ratePerHour is present but not a number (left as-is)
 * }}
 */
function classifyServices(services) {
  const list = Array.isArray(services) ? services : [];
  const stripIdx = [];
  const anomalies = [];
  let hasNullEntry = false;
  let nonNumericRate = 0;

  list.forEach((svc, i) => {
    if (!svc || typeof svc !== 'object') {
      hasNullEntry = true;
      return;
    }
    if (!('ratePerHour' in svc)) return; // no stored rate → nothing to do (already-migrated / never had one)
    const rate = svc.ratePerHour;
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      // A present-but-non-numeric rate fabricates no revenue (the Plan helper's
      // positiveNum() yields null → pricing_missing already). Leave it untouched,
      // just surface the count.
      nonNumericRate += 1;
      return;
    }
    const isLegalHourly = svc.type === ST.LEGAL_PROCEDURE && svc.pricingType === PT.HOURLY;
    if (isLegalHourly && rate === DEFAULT_RATE) {
      stripIdx.push(i);
    } else {
      // legal-hourly with a rate !== 800 (an ELECTED rate to preserve), OR a numeric
      // rate on any non-legal-hourly service (an unexpected location). Either way:
      // do NOT strip — flag as an anomaly that aborts the whole run for human review.
      anomalies.push({
        index: i,
        code: isLegalHourly ? 'ELECTED_NON_800_RATE' : 'UNEXPECTED_RATE_LOCATION'
      });
    }
  });

  return { stripIdx, anomalies, hasNullEntry, nonNumericRate };
}

/**
 * Return a copy of services[] with `ratePerHour` removed from exactly the given
 * indices. Every other field of every service (and every other service) is preserved.
 *
 * @param {Array} services
 * @param {number[]} stripIdx
 * @returns {Array}
 */
function buildCleanedServices(services, stripIdx) {
  const idxSet = new Set(stripIdx);
  return services.map((svc, i) => {
    if (!idxSet.has(i)) return svc;
    const copy = { ...svc };
    delete copy.ratePerHour;
    return copy;
  });
}

/** Normalized stored hours aggregates from a client doc (matches the writer's reads). */
function storedAggregates(data) {
  const d = data || {};
  return {
    totalHours: d.totalHours || 0,
    hoursUsed: d.hoursUsed || 0,
    hoursRemaining: d.hoursRemaining || 0,
    minutesUsed: d.minutesUsed || 0,
    minutesRemaining: d.minutesRemaining || 0,
    isBlocked: d.isBlocked === true,
    isCritical: d.isCritical === true
  };
}

/** Canonical recompute of the hours aggregates from services[] (what the writer will write). */
function recomputeAggregates(services) {
  const list = Array.isArray(services) ? services.filter(Boolean) : [];
  const totalHours = _recomputeTotalHours(list);
  const agg = calcClientAggregates(list, totalHours);
  return {
    totalHours,
    hoursUsed: agg.hoursUsed,
    hoursRemaining: agg.hoursRemaining,
    minutesUsed: agg.minutesUsed,
    minutesRemaining: agg.minutesRemaining,
    isBlocked: agg.isBlocked === true,
    isCritical: agg.isCritical === true
  };
}

/** Names of the aggregate keys that differ between stored and recomputed (empty = no drift). */
function aggregatesDiff(stored, recomputed) {
  return AGGREGATE_KEYS.filter((k) => stored[k] !== recomputed[k]);
}

// Tiny helper: build an Error carrying a safe `.code` (never a raw message in logs).
function coded(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

/**
 * Migrate ONE client inside an active transaction. Re-verifies the cohort against the
 * FRESH in-txn read (TOCTOU + drift), then strips via the canonical writer (AWAITED so
 * its read+update finish before the audit set), then audits atomically.
 *
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} ref
 * @returns {Promise<'written'|'noop'>}  'noop' = nothing to strip (migrated concurrently)
 * @throws coded('CLIENT_VANISHED' | 'ANOMALY_APPEARED' | 'NULL_ENTRY_APPEARED' | 'AGGREGATE_DRIFT_APPEARED')
 */
async function migrateClientInTxn(tx, ref) {
  const snap = await tx.get(ref); // read #1 (all reads precede all writes)
  if (!snap.exists) throw coded('CLIENT_VANISHED');
  const data = snap.data() || {};
  const services = Array.isArray(data.services) ? data.services : [];
  const { stripIdx, anomalies, hasNullEntry } = classifyServices(services);

  // Re-assert safety against the LIVE doc (it may have changed since discovery).
  if (anomalies.length > 0) throw coded('ANOMALY_APPEARED');        // a rate was elected meanwhile
  if (hasNullEntry) throw coded('NULL_ENTRY_APPEARED');
  if (stripIdx.length === 0) return 'noop';                         // already migrated concurrently → idempotent

  const cleaned = buildCleanedServices(services, stripIdx);

  // Surgical guarantee: the writer re-derives all hours aggregates; refuse to proceed
  // if the live doc's stored aggregates already drift from canonical (would be a silent
  // heal/flip unrelated to the rate strip).
  if (aggregatesDiff(storedAggregates(data), recomputeAggregates(cleaned)).length > 0) {
    throw coded('AGGREGATE_DRIFT_APPEARED');
  }

  // Canonical write — recomputes plan + hours aggregates; strips RESTRICTED_KEYS.
  // AWAITED: the writer's internal read + update must complete before the audit set.
  // mode:'enforce' = deterministic fail-fast, independent of the live invariant config.
  // No auditMeta → human lastModifiedBy/At on the client doc is NOT overwritten.
  await writeClientWithCanonicalAggregates(tx, ref, { services: cleaned }, { caller: CALLER, mode: 'enforce' });

  // Audit AFTER the writer's update (txn.set — a write; all reads already done).
  // clientId + count only — no names / amounts (PUBLIC repo).
  logCriticalActionInTxn(tx, ACTION, ACTOR, {
    clientId: ref.id,
    servicesStripped: stripIdx.length,
    schemaVersion: AUDIT_SCHEMA_VERSION
  });
  return 'written';
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT BODY (SDK / I/O) — only runs when invoked as a script, not on require.
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const db = admin.firestore();
  console.log(`\n[backfill-strip-rate] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  const counts = {
    scanned: 0,
    affectedClients: 0,
    servicesToStrip: 0,
    skippedNullEntry: 0,
    skippedAggregateDrift: 0,
    anomalyClients: 0,
    servicesWithNonNumericRate: 0,
    committed: 0,
    noopConcurrent: 0,
    errors: 0
  };
  // Affected clients (LOCAL gitignored backup + the apply work-list):
  //   { clientId, strippedIndices, beforeServices, beforePlan, afterPlanPreview, beforeAggregates }
  const affected = [];
  const anomalies = [];       // { clientId, code } — clientId + code ONLY (no PII)
  const skipped = [];         // { clientId, code, fields? } — skipped clients (flagged, not migrated)
  const failures = [];        // { clientId, code } — per-client apply failures
  let cursor = null;

  // ─── Phase 1: full read-only discovery (always, both modes) ───
  for (;;) {
    let q = db.collection(CLIENTS_COLLECTION).orderBy('__name__').limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    cursor = page.docs[page.docs.length - 1];

    for (const doc of page.docs) {
      counts.scanned += 1;
      try {
        const data = doc.data() || {};
        const services = Array.isArray(data.services) ? data.services : [];
        const { stripIdx, anomalies: svcAnoms, hasNullEntry, nonNumericRate } = classifyServices(services);
        counts.servicesWithNonNumericRate += nonNumericRate;

        if (svcAnoms.length > 0) {
          counts.anomalyClients += 1;
          for (const a of svcAnoms) anomalies.push({ clientId: doc.id, code: a.code });
          continue; // anomalies → global STOP gate below; never strip
        }
        if (stripIdx.length === 0) continue; // idempotent: nothing to strip
        if (hasNullEntry) {
          // Conservative: the canonical writer drops null slots (.filter(Boolean)).
          // Don't conflate a structural change with the rate strip — skip + flag.
          counts.skippedNullEntry += 1;
          skipped.push({ clientId: doc.id, code: 'NULL_SERVICE_ENTRY' });
          continue;
        }

        const cleaned = buildCleanedServices(services, stripIdx);
        const before = storedAggregates(data);
        const after = recomputeAggregates(cleaned);
        const drift = aggregatesDiff(before, after);
        if (drift.length > 0) {
          // Stored hours aggregates already diverge from canonical — the strip would
          // silently re-derive (possibly flip block-state). Surface, do not migrate.
          counts.skippedAggregateDrift += 1;
          skipped.push({ clientId: doc.id, code: 'AGGREGATE_DRIFT', fields: drift }); // field NAMES only
          continue;
        }

        counts.affectedClients += 1;
        counts.servicesToStrip += stripIdx.length;
        affected.push({
          clientId: doc.id,
          strippedIndices: stripIdx,
          beforeServices: services,
          beforePlan: data.plan || null,
          afterPlanPreview: computeClientPlan(cleaned), // dry-run review: what plan BECOMES
          beforeAggregates: before                       // == after (drift-free); for rollback/audit
        });
      } catch (err) {
        counts.errors += 1;
        console.error(`[backfill-strip-rate] discovery error client=${doc.id} code=${(err && err.code) || 'error'}`);
      }
    }
    console.log(`[backfill-strip-rate] …scanned ${counts.scanned} (affected ${counts.affectedClients}, toStrip ${counts.servicesToStrip})`);
  }

  // ─── Durable local backup of the before-state (BEFORE any write) ───
  const backupDir = path.resolve(__dirname, '../backfill-backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `strip-legal-hourly-rate-${counts.scanned}clients-${process.pid}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', counts, affected, skipped, anomalies }, null, 2)
  );
  console.log(`[backfill-strip-rate] before-state backup written to ${backupFile}`);

  // ─── GLOBAL ANOMALY GATE — fail-secure: any non-800 stored rate aborts the run ───
  if (anomalies.length > 0) {
    console.error(`\n[backfill-strip-rate] ⛔ STOP — ${anomalies.length} non-800 (elected/unexpected) rate(s) found. NO writes performed.`);
    for (const a of anomalies) console.error(`  client=${a.clientId} code=${a.code}`);
    console.error('[backfill-strip-rate] A non-800 stored rate is a DELIBERATELY-ELECTED rate to PRESERVE. Review each manually before re-running.');
    console.log(`[backfill-strip-rate] SUMMARY — ${JSON.stringify(counts)}`);
    process.exit(2);
  }

  // ─── Report ───
  console.log(
    `\n[backfill-strip-rate] DISCOVERY: ${counts.affectedClients} client(s), ${counts.servicesToStrip} service(s) to strip; ` +
    `skipped ${counts.skippedNullEntry} null-entry + ${counts.skippedAggregateDrift} aggregate-drift; ` +
    `${counts.servicesWithNonNumericRate} non-numeric rate(s) left as-is.`
  );
  for (const s of skipped) {
    const extra = s.fields ? ` fields=${s.fields.join(',')}` : '';
    console.warn(`[backfill-strip-rate] SKIPPED client=${s.clientId} code=${s.code}${extra} (resolve manually, then re-run)`);
  }

  if (!APPLY) {
    console.log('[backfill-strip-rate] DRY-RUN — no writes. Review the backup JSON, then re-run with --apply (supervised).');
    console.log(`[backfill-strip-rate] SUMMARY — ${JSON.stringify(counts)}`);
    return;
  }

  // ─── Phase 2: APPLY — per-client transaction via the canonical writer + in-txn audit ───
  for (const item of affected) {
    const ref = db.collection(CLIENTS_COLLECTION).doc(item.clientId);
    try {
      const result = await db.runTransaction((tx) => migrateClientInTxn(tx, ref));
      if (result === 'noop') counts.noopConcurrent += 1;
      else counts.committed += 1;
    } catch (err) {
      counts.errors += 1;
      const code = (err && err.code) || 'WRITE_FAILED';
      failures.push({ clientId: item.clientId, code });
      console.error(`[backfill-strip-rate] APPLY error client=${item.clientId} code=${code}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[backfill-strip-rate] ${failures.length} client(s) FAILED apply (left un-migrated; re-run after resolving):`);
    for (const f of failures) console.error(`  client=${f.clientId} code=${f.code}`);
  }
  console.log(`\n[backfill-strip-rate] APPLY DONE — committed ${counts.committed}, no-op(concurrent) ${counts.noopConcurrent}, errors ${counts.errors}`);
  console.log(`[backfill-strip-rate] SUMMARY — ${JSON.stringify(counts)}`);
  if (counts.errors > 0) process.exitCode = 1;
}

// Export the pure + txn core for tests; only run main() when invoked directly.
module.exports = {
  classifyServices,
  buildCleanedServices,
  storedAggregates,
  recomputeAggregates,
  aggregatesDiff,
  migrateClientInTxn
};

if (require.main === module) {
  if (!admin.apps.length) admin.initializeApp();
  main()
    .then(() => process.exit(process.exitCode || 0))
    .catch((err) => {
      console.error('[backfill-strip-rate] FATAL:', (err && err.code) || 'error');
      process.exit(1);
    });
}
