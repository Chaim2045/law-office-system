/**
 * backfill-cost-per-hour.js — Phase 2 H.2 one-time backfill
 * ─────────────────────────────────────────────────────────────────────────────
 * Stamps a cost snapshot into the CF-only `timesheet_entry_costs/{entryId}`
 * collection for HISTORICAL timesheet entries that don't already have one.
 *
 * ⚠️ APPROXIMATION BY DESIGN: `employee_costs` is single-doc (no per-date history,
 * MASTER_PLAN §10), so historical entries are stamped with the employee's CURRENT
 * cost. Every backfilled doc is marked `costSource: 'backfill_approx'` so H.3 (and
 * a future reconciliation) can distinguish an at-write snapshot from a backfilled
 * approximation. Entries whose employee has no cost doc get `costPerHour: null`
 * (NEVER 0 — a 0 would silently understate H.3's Σ(cost × hours)).
 *
 * Safety (mirrors functions/migrations/003 internals; NON-interactive per §8.4):
 *   • DRY-RUN by default. `--apply` to write. (No interactive prompt — works under
 *     the supervised non-interactive run pattern.)
 *   • Idempotent: skips any entry that already has a timesheet_entry_costs doc.
 *   • Durable local JSON backup of the write-plan BEFORE any --apply write.
 *   • Batched (≤450/commit), per-record-safe (one bad entry never aborts the run).
 *   • Cost VALUES are never console-logged (PII) — only counts.
 *
 * Usage (from functions/, after a deploy of the H.2 rules + helper):
 *   node scripts/backfill-cost-per-hour.js            # dry-run (default)
 *   node scripts/backfill-cost-per-hour.js --apply    # write
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const {
  buildEntryCostDoc,
  TIMESHEET_ENTRY_COSTS_COLLECTION
} = require('../lib/employee-costs/resolve-employee-cost');
const { EMPLOYEE_COSTS_COLLECTION } = require('../lib/schemas/employee-cost');

const APPLY = process.argv.includes('--apply');
const PAGE = 500;
const COMMIT = 450;

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Load ALL employee_costs once into a Map<email, costPerHour|null> (≈10 docs). */
async function loadCostMap() {
  const map = new Map();
  const snap = await db.collection(EMPLOYEE_COSTS_COLLECTION).get();
  snap.forEach((doc) => {
    const cph = (doc.data() || {}).costPerHour;
    map.set(doc.id, (typeof cph === 'number' && Number.isFinite(cph) && cph > 0) ? cph : null);
  });
  return map;
}

async function main() {
  console.log(`\n[backfill-cost-per-hour] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);
  const costMap = await loadCostMap();
  console.log(`[backfill] loaded ${costMap.size} employee_costs docs`);

  const counts = { scanned: 0, alreadyStamped: 0, toStamp: 0, noCostDoc: 0, errors: 0, committed: 0 };
  const plan = []; // { entryId, employee, costSource } — NO cost value (PII)
  let batch = db.batch();
  let pending = 0;
  let cursor = null;

  // Paginate timesheet_entries by document id (stable cursor).
  for (;;) {
    let q = db.collection('timesheet_entries').orderBy('__name__').limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    cursor = page.docs[page.docs.length - 1];

    for (const entry of page.docs) {
      counts.scanned += 1;
      try {
        const costRef = db.collection(TIMESHEET_ENTRY_COSTS_COLLECTION).doc(entry.id);
        const existing = await costRef.get();
        if (existing.exists) { counts.alreadyStamped += 1; continue; }

        const email = String((entry.data() || {}).employee || '').toLowerCase().trim();
        const has = email && costMap.has(email) && costMap.get(email) !== null;
        const costPerHour = has ? costMap.get(email) : null;
        if (!has) counts.noCostDoc += 1;
        counts.toStamp += 1;
        plan.push({ entryId: entry.id, employee: email, costSource: 'backfill_approx', hasCost: has });

        if (APPLY) {
          batch.set(costRef, buildEntryCostDoc(entry.id, email, { costPerHour, costSource: 'backfill_approx' }));
          pending += 1;
          if (pending >= COMMIT) {
            await batch.commit();
            counts.committed += pending;
            batch = db.batch();
            pending = 0;
          }
        }
      } catch (err) {
        counts.errors += 1;
        console.error(`[backfill] entry ${entry.id} failed: ${err && err.code ? err.code : 'error'}`);
      }
    }
    console.log(`[backfill] …scanned ${counts.scanned} (toStamp ${counts.toStamp}, already ${counts.alreadyStamped})`);
  }

  // Durable local backup of the write-plan (BEFORE the final commit is "trusted").
  const backupDir = path.resolve(__dirname, '../backfill-backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `cost-per-hour-plan-${counts.scanned}-entries.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', counts, plan }, null, 2));

  if (APPLY && pending > 0) {
    await batch.commit();
    counts.committed += pending;
  }

  console.log(`\n[backfill] DONE — ${JSON.stringify(counts)}`);
  console.log(`[backfill] plan written to ${backupFile}`);
  if (!APPLY) console.log('[backfill] DRY-RUN — no writes. Re-run with --apply to stamp.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[backfill] FATAL:', err && err.message ? err.message : err);
  process.exit(1);
});
