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
let db = null;
function initDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'law-office-system-e4801',
      credential: admin.credential.applicationDefault()
    });
  }
  db = admin.firestore();
  return db;
}

// The canonical writer — the ONLY thing allowed to derive these fields.
const {
  writeClientWithCanonicalAggregates
} = require('../functions/shared/client-writer');

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

  const clientRef = db.collection('clients').doc(doc.id);

  // One transaction per client. In dry-run we still run the canonical writer in
  // 'disabled' invariant mode to obtain the exact payload it WOULD write, then
  // deliberately abort by throwing a sentinel — nothing is committed.
  const SENTINEL = '__DRY_RUN_ABORT__';
  let produced = null;

  try {
    await db.runTransaction(async (tx) => {
      const result = await writeClientWithCanonicalAggregates(
        tx,
        clientRef,
        {}, // empty partial update — recompute only
        {
          caller: 'materialize-hours-capacity'
          // no auditMeta on purpose — see the header
        }
      );
      produced = result;
      if (!APPLY) {
        const e = new Error(SENTINEL);
        e.__sentinel = true;
        throw e;
      }
    });
  } catch (err) {
    if (!err || !err.__sentinel) {
      return {
        caseNumber,
        status: 'failed',
        hadField,
        errorCode: err && err.code ? String(err.code) : 'unknown',
        errorMessage: err && err.message ? String(err.message).slice(0, 200) : null
      };
    }
    // sentinel — expected in dry-run
  }

  // Re-read only in apply mode; in dry-run the doc is untouched.
  let afterWatched;
  if (APPLY) {
    const fresh = await clientRef.get();
    afterWatched = snapshotWatched(fresh.data());
  } else {
    afterWatched = produced && produced.aggregates
      ? {
        ...snapshotWatched(before),
        ...produced.aggregates
      }
      : snapshotWatched(before);
  }

  const moved = diffWatched(snapshotWatched(before), afterWatched);

  return {
    caseNumber,
    status: APPLY ? 'written' : 'would_write',
    hadField,
    aggregatesMoved: Object.keys(moved).length > 0 ? moved : null
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
      failed: failed.length,
      aggregatesWouldMove: withMovement.length
    },
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
  log(`  FAILED                   : ${report.summary.failed}`);
  log(`  aggregates would move    : ${report.summary.aggregatesWouldMove}  <-- review these before --apply`);
  log('');
  log(`report: ${out}`);

  if (!APPLY) {
    log('');
    log('Dry-run only. Review the report, then re-run with --apply.');
  }
}

module.exports = { diffWatched, WATCHED };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[materialize-hours-capacity] FAILED:', err.message);
      process.exit(1);
    });
}
