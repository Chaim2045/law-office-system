/**
 * MATERIALIZATION — write `hoursCapacity` onto every existing client.
 *
 * PR-3b of docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md (product ruling P6).
 *
 * WHY THIS IS NEEDED AT ALL
 *
 * `hoursCapacity` is a PERSISTED derived field, not a computed-on-read one. It
 * appears only when a client is next written for some other reason, and
 * `functions/admin/repair-aggregates.js` states the deliberate policy:
 * "There is intentionally NO batch endpoint — Haim runs repair per-client after
 * reviewing audit output, preventing mass-write incidents."
 *
 * So without this script the field would arrive one client at a time, by
 * accident, indefinitely — and any reader would have to distinguish "not yet
 * computed" from "genuinely nothing available". Those are NOT the same thing:
 * `activeHours: 0` is a legitimate value (every service closed), which is why a
 * reader must branch on PRESENCE, never on `|| 0`.
 *
 * THE ONE DESIGN RULE
 *
 * This script does NOT compute capacity. It re-writes each client through
 * `writeClientWithCanonicalAggregates` with an EMPTY partial update — the
 * canonical writer then derives `hoursCapacity` (and every other aggregate)
 * exactly as a live write would. Introducing a second implementation here would
 * create the very sixth-competing-definition problem this whole plan exists to
 * remove.
 *
 * SAFETY
 *
 *   - DRY-RUN BY DEFAULT. `--apply` is required to write anything.
 *   - No client cap (the 2026-05-14 script's cap of 50 silently truncated a
 *     150-client office).
 *   - One transaction per client — a failure isolates to that client.
 *   - NO auditMeta is passed, deliberately: the canonical writer only stamps
 *     `lastModifiedAt`/`lastModifiedBy` when auditMeta is present, and this is a
 *     system backfill, not a human edit. Polluting "last modified by" on 164
 *     clients would destroy real provenance.
 *   - Aggregates are RECOMPUTED, not preserved: if a client's stored aggregates
 *     had drifted, this corrects them. The dry-run reports every such case
 *     BEFORE anything is written, so a correction is never a surprise.
 *   - A JSON report is written in both modes.
 *
 * Usage:
 *   node scripts/materialize-hours-capacity-2026-08-17.js              # dry-run
 *   node scripts/materialize-hours-capacity-2026-08-17.js --case=2025006
 *   node scripts/materialize-hours-capacity-2026-08-17.js --apply      # writes
 *
 * Project: law-office-system-e4801 (production).
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const caseArg = args.find((a) => a.startsWith('--case='));
const TARGET_CASE = caseArg ? caseArg.split('=')[1] : null;

function log(msg, ...rest) {
  console.log(`[${new Date().toISOString()}] ${msg}`, ...rest);
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Firestore is initialised lazily, inside main() — NOT at module load.
 *
 * Requiring this file must have no side effects: the pure helpers below are
 * unit-tested, and a test that merely imports the module must never try to
 * reach production credentials.
 */
const FIREBASE_CONFIG = Object.freeze({
  projectId: 'law-office-system-e4801'
});

/**
 * 🔴 THERE ARE TWO firebase-admin INSTALLS IN THIS REPO.
 *
 * `node_modules/firebase-admin` (what a script in `scripts/` resolves) and
 * `functions/node_modules/firebase-admin` (what `functions/shared/*` resolves).
 * Node caches modules by resolved path, so these are two separate module
 * instances with two separate app registries.
 *
 * Initialising only the script's copy leaves the shared modules with NO default
 * app. The symptom is quiet: `shared/enforcement-mode.js` calls
 * `admin.firestore()` lazily at read time, the call throws "The default Firebase
 * app does not exist", the catch swallows it and returns the hardcoded default
 * of `enforce`. So the run proceeds under an invariant-enforcement mode nobody
 * selected — announced only in one warning line.
 *
 * Here that default happened to be the STRICTER setting, so nothing was
 * damaged. That is luck, not design.
 *
 * Both registries are therefore initialised below. Any future script that pulls
 * in `functions/shared/*` needs the same treatment.
 *
 * (The PR-0 measurement script is unaffected: it imports only the PURE helpers —
 * aggregates, service-classification, constants — which never touch Firestore.)
 */
const adminForShared = require(
  require.resolve('firebase-admin', { paths: [path.join(__dirname, '..', 'functions')] })
);

let db = null;
let writeClientWithCanonicalAggregates = null;

function initDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      ...FIREBASE_CONFIG,
      credential: admin.credential.applicationDefault()
    });
  }
  // The instance `functions/shared/*` will actually use.
  if (!adminForShared.apps.length) {
    adminForShared.initializeApp({
      ...FIREBASE_CONFIG,
      credential: adminForShared.credential.applicationDefault()
    });
  }
  db = admin.firestore();

  // The canonical writer — the ONLY thing allowed to derive these fields.
  //
  // Required after both registries are initialised.
  ({ writeClientWithCanonicalAggregates } = require('../functions/shared/client-writer'));

  return db;
}

/**
 * Clients this script must NEVER touch.
 *
 * Mirrors `functions/scheduled/reconcile-package-drift.js` SKIP_CLIENTS, which
 * mirrors the offline repair's exemption list — described there as "the
 * authoritative one for THIS write path". The nightly reconciliation loop runs
 * in `enforce` against production and still refuses these.
 *
 * This is not theoretical. The first dry-run showed what would happen without
 * it: `internal_office` would have had `hoursUsed: 620.08 → 0` and
 * `isBlocked: true → false`. 620 hours of recorded usage erased, and the client
 * un-blocked, by a script whose stated purpose is to add one display field.
 * Exactly the mass-write incident the "no batch endpoint" policy exists to
 * prevent — caught because the dry-run reports movements before anything runs.
 */
const SKIP_CLIENTS = ['internal_office', '2025003'];

/** Fields whose movement must be reported before any write is approved. */
const WATCHED = [
  'totalHours',
  'hoursUsed',
  'hoursRemaining',
  'minutesUsed',
  'minutesRemaining',
  'isBlocked',
  'isCritical'
];

function snapshotWatched(data) {
  const out = {};
  for (const k of WATCHED) out[k] = data ? data[k] : undefined;
  return out;
}

function diffWatched(before, after) {
  const moved = {};
  for (const k of WATCHED) {
    const b = before[k];
    const a = after[k];
    const same =
      typeof b === 'number' && typeof a === 'number'
        ? Math.abs(round2(b) - round2(a)) < 0.005
        : b === a;
    if (!same) moved[k] = { before: b ?? null, after: a ?? null };
  }
  return moved;
}

async function processClient(doc) {
  const before = doc.data() || {};
  const caseNumber = before.caseNumber || doc.id;
  const hadField = !!before.hoursCapacity;

  // Exempt clients are reported, never processed — silence here would be the
  // same failure as a silent truncation.
  if (SKIP_CLIENTS.includes(doc.id) || SKIP_CLIENTS.includes(caseNumber)) {
    return { caseNumber, status: 'skipped_exempt', hadField, aggregatesMoved: null };
  }

  const clientRef = db.collection('clients').doc(doc.id);

  // One transaction per client.
  //
  // BOTH gates live INSIDE the transaction and abort it by throwing. A guard
  // that runs after `runTransaction` resolves is worthless in apply mode — by
  // then the write has already committed. (First draft of this function had
  // exactly that defect.)
  const DRY_RUN_ABORT = 'dry_run';
  const WOULD_BLOCK_ABORT = 'would_block';

  let moved = null;
  let abortReason = null;

  try {
    await db.runTransaction(async (tx) => {
      // Reset per attempt — Firestore may retry the transaction body.
      moved = null;
      abortReason = null;

      const result = await writeClientWithCanonicalAggregates(
        tx,
        clientRef,
        {}, // empty partial update — recompute only
        {
          caller: 'materialize-hours-capacity'
          // no auditMeta on purpose — see the header
        }
      );

      // Compare the RAW STORED document against what will be written.
      //
      // NOT `result.previousAggregates` — that is the writer's NORMALISED view
      // of the current document, with `|| 0` / `|| false` defaults already
      // applied. Probed on case 2025007: the stored `hoursUsed` is `undefined`
      // while `previousAggregates.hoursUsed` reads `0`. Comparing the two
      // aggregate objects therefore answers "did the COMPUTATION change?" and
      // reports nothing, while the question this report exists to answer is
      // "what will change in the DOCUMENT?" — which for that client is
      // `undefined → 0` on four fields.
      //
      // Using the wrong basis silently dropped the movement count from 22 to 0.
      // A report that answers the wrong question confidently is worse than no
      // report.
      moved = diffWatched(
        snapshotWatched(before),
        snapshotWatched(result.aggregates || {})
      );

      // NEVER AUTO-BLOCK. Mirrors the reconciliation loop's defer gate and
      // enforces Haim's ruling of 2026-08-17: a client exposed as over-drawn is
      // DISPLAYED as over-drawn, but nothing new blocks automatically. A
      // backfill whose purpose is to add a display field must never be the
      // thing that stops an employee logging hours tomorrow morning.
      if (
        moved.isBlocked
        && moved.isBlocked.before !== true
        && moved.isBlocked.after === true
      ) {
        abortReason = WOULD_BLOCK_ABORT;
        const e = new Error(WOULD_BLOCK_ABORT);
        e.__abort = WOULD_BLOCK_ABORT;
        throw e;
      }

      if (!APPLY) {
        abortReason = DRY_RUN_ABORT;
        const e = new Error(DRY_RUN_ABORT);
        e.__abort = DRY_RUN_ABORT;
        throw e;
      }
    });
  } catch (err) {
    if (!err || !err.__abort) {
      return {
        caseNumber,
        status: 'failed',
        hadField,
        errorCode: err && err.code ? String(err.code) : 'unknown',
        errorMessage: err && err.message ? String(err.message).slice(0, 200) : null
      };
    }
    if (err.__abort === WOULD_BLOCK_ABORT) {
      return {
        caseNumber,
        status: 'deferred_would_block',
        hadField,
        aggregatesMoved: moved
      };
    }
    // dry-run abort — expected, nothing was committed
  }

  const hasMovement = moved && Object.keys(moved).length > 0;

  return {
    caseNumber,
    status: APPLY ? 'written' : 'would_write',
    hadField,
    aggregatesMoved: hasMovement ? moved : null
  };
}

async function main() {
  log(APPLY ? '⚠️  APPLY MODE — this WILL write to production.' : 'DRY-RUN — nothing will be written.');

  initDb();

  const snap = TARGET_CASE
    ? await db.collection('clients').where('caseNumber', '==', TARGET_CASE).get()
    : await db.collection('clients').get();

  log(`clients read: ${snap.size}${TARGET_CASE ? ` (scoped to ${TARGET_CASE})` : ''}`);

  const results = [];
  for (const doc of snap.docs) {
     
    results.push(await processClient(doc));
     
  }

  const failed = results.filter((r) => r.status === 'failed');
  const skipped = results.filter((r) => r.status === 'skipped_exempt');
  const deferred = results.filter((r) => r.status === 'deferred_would_block');
  const alreadyHad = results.filter((r) => r.hadField);
  const withMovement = results.filter((r) => r.aggregatesMoved);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry_run',
    scriptVersion: 1,
    scope: TARGET_CASE ? `case ${TARGET_CASE}` : 'all clients',
    clientsScanned: results.length,
    summary: {
      alreadyCarriedField: alreadyHad.length,
      missingField: results.length - alreadyHad.length,
      skippedExempt: skipped.length,
      deferredWouldBlock: deferred.length,
      failed: failed.length,
      aggregatesWouldMove: withMovement.length
    },
    skippedExempt: skipped.map((r) => r.caseNumber),
    deferredWouldBlock: deferred.map((r) => ({
      caseNumber: r.caseNumber,
      moved: r.aggregatesMoved
    })),
    // The list that must be reviewed BEFORE --apply: any client whose stored
    // aggregates disagree with a fresh canonical recompute.
    movements: withMovement.map((r) => ({
      caseNumber: r.caseNumber,
      moved: r.aggregatesMoved
    })),
    failures: failed,
    clients: results
  };

  const out = path.join(
    __dirname,
    `.capacity-materialize-${report.generatedAt.replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');

  log('');
  log(`  scanned                  : ${report.clientsScanned}`);
  log(`  already carried the field: ${report.summary.alreadyCarriedField}`);
  log(`  missing the field        : ${report.summary.missingField}`);
  log(`  skipped (exempt)         : ${report.summary.skippedExempt}  [${report.skippedExempt.join(', ') || '-'}]`);
  log(`  DEFERRED (would block)   : ${report.summary.deferredWouldBlock}  <-- never written, by design`);
  log(`  FAILED                   : ${report.summary.failed}`);
  log(`  aggregates would move    : ${report.summary.aggregatesWouldMove}  <-- review these before --apply`);
  log('');
  log(`report: ${out}`);

  if (!APPLY) {
    log('');
    log('Dry-run only. Review the report, then re-run with --apply.');
  }
}

/**
 * Test seam. `processClient` holds the three guards that make this script safe
 * to point at production — the exemption list, the never-auto-block gate, and
 * the movement-comparison basis. All three are worth pinning, and none of them
 * can be exercised through `main()` without a live database.
 *
 * Mirrors the `_test` export convention used by
 * `functions/scheduled/reconcile-package-drift.js`.
 */
function _setDependencies(deps) {
  if (deps.db !== undefined) db = deps.db;
  if (deps.writer !== undefined) writeClientWithCanonicalAggregates = deps.writer;
}

module.exports = {
  diffWatched,
  WATCHED,
  SKIP_CLIENTS,
  processClient,
  _setDependencies
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[materialize-hours-capacity] FAILED:', err.message);
      process.exit(1);
    });
}
