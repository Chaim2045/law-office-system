/**
 * repair-package-aggregates.js — PR-DRIFT-2 supervised repair script.
 * ─────────────────────────────────────────────────────────────────────────────
 * Repairs package-level consumption drift (design PR-DRIFT-2-DESIGN.md):
 *   - per package: hoursUsed = Σ(forward-replay-assigned entries)/60
 *   - per service: hoursUsed = Σ packages.hoursUsed  (= ledger truth)
 *   - every orphan entry (packageId:null) → stamped with its replay packageId
 *     so the addPackageToService detonator finds nothing to sweep (defused).
 *
 * SAFETY (mirrors functions/scripts/backfill-cost-per-hour.js):
 *   • DRY-RUN by default. `--apply` to write. NON-interactive (supervised run).
 *   • Per-client isolation: one runTransaction per client; retry on `aborted`
 *     with a FRESH read each attempt; reads services INSIDE the txn and applies
 *     only package-level corrections (never blind-overwrites a stale snapshot).
 *   • Client rollup delegated to writeClientWithCanonicalAggregates (the writer
 *     derives client aggregates + plan; the repair sets service.hoursUsed only).
 *   • Audit-FIRST (logCriticalActionInTxn) per client, INSIDE the repair txn so
 *     the audit doc commits ATOMICALLY with the mutation (one audit per committed
 *     mutation — an A5-forced retry never duplicates the audit doc; FIX 2).
 *   • REFUSES any client whose isBlocked would FLIP unless its id is in
 *     `--approve-block-flips=<id,id>`.
 *   • Durable gitignored JSON backup BEFORE any --apply write (services-before +
 *     isBlocked-before + per-stamped-entry {entryId, packageId-before:null}).
 *   • Continue-on-error: one bad client never aborts the run.
 *   • NO PII in logs/audit (ids/counts/hours only — never names/emails).
 *
 * ROLLBACK (design §9):
 *   node scripts/repair-package-aggregates.js --rollback <backupFile> --apply
 *   restores each client's services-before (via the canonical writer) + un-stamps
 *   entries conditionally (only if still == the repaired value AND repairRunId matches).
 *
 * Usage (from functions/, after the H.3 + drift code is deployed):
 *   node scripts/repair-package-aggregates.js                         # dry-run (report only)
 *   node scripts/repair-package-aggregates.js --apply                 # repair (supervised)
 *   node scripts/repair-package-aggregates.js --apply \
 *        --approve-block-flips=2025123,2026007                        # allow named block-flips
 *   node scripts/repair-package-aggregates.js --rollback <file> --apply
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const {
  assignEntriesForwardReplay,
  computeRepairedService,
  isEligibleService,
  isSkippedHoursServiceNeedingStamp,
  detectDuplicatePackageIds,
  detectDanglingEntries
} = require('../shared/package-repair-core');

// The writer derives client rollup + plan; the repair sets service.hoursUsed only.
const { writeClientWithCanonicalAggregates } = require('../shared/client-writer');
// Predict the writer's isBlocked/plan effect in DRY-RUN (same helpers the writer uses).
const { calcClientAggregates } = require('../shared/aggregates');
const { computeClientPlan } = require('../lib/profitability/client-plan');
// Audit-FIRST primitive (Pre-H.0.0.C). System actor per the sys:<name> convention.
// Transactional variant (logCriticalActionInTxn) so the audit commits ATOMICALLY
// with the repair mutation — one audit doc per committed mutation, no duplicate on
// an A5-forced retry (FIX 2).
const { logCriticalActionInTxn } = require('../lib/audit-critical');

// ── Args ─────────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const APPLY = ARGV.includes('--apply');
const ROLLBACK_IDX = ARGV.indexOf('--rollback');
const ROLLBACK_FILE = ROLLBACK_IDX !== -1 ? ARGV[ROLLBACK_IDX + 1] : null;
const APPROVE_FLAG = ARGV.find((a) => a.startsWith('--approve-block-flips='));
const APPROVED_BLOCK_FLIPS = new Set(
  APPROVE_FLAG ? APPROVE_FLAG.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : []
);

const PAGE = 500;
const STAMP_BATCH = 450; // ≤450 per the design (Firestore 500 cap, headroom)
const AUDIT_ACTOR = 'sys:repair-package-aggregates';
const AUDIT_ACTION = 'REPAIR_PACKAGE_AGGREGATES';

// Clients exempted (mirror dailyInvariantCheck / repair-aggregates SKIP_CLIENTS).
const SKIP_CLIENTS = ['internal_office', '2025003'];

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// A unique-but-deterministic-shaped run id (NOT used for replay determinism —
// only to tag stamped entries for conditional rollback).
const RUN_ID = `repair-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Backup dir. `functions/repair-backups/` IS gitignored (root .gitignore — the
 * `functions/repair-backups/` line, alongside `functions/backfill-backups/`), so
 * the durable backup/report JSONs (which contain client ids + per-entry stamp
 * targets) never enter version control. The comment is verified TRUE.
 */
function backupDir() {
  const dir = path.resolve(__dirname, '../repair-backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Predict the writer's client-level effect (design §8 — compute before/after
 * isBlocked/plan on the corrected services using the SAME helpers the writer uses).
 */
function predictClientEffect(servicesBefore, servicesAfter, totalHours) {
  const aggBefore = calcClientAggregates(servicesBefore, totalHours);
  const aggAfter = calcClientAggregates(servicesAfter, totalHours);
  const planBefore = computeClientPlan(servicesBefore);
  const planAfter = computeClientPlan(servicesAfter);
  return {
    before: {
      isBlocked: aggBefore.isBlocked,
      isCritical: aggBefore.isCritical,
      expectedHours: planBefore.expectedHours,
      expectedRevenue: planBefore.expectedRevenue
    },
    after: {
      isBlocked: aggAfter.isBlocked,
      isCritical: aggAfter.isCritical,
      expectedHours: planAfter.expectedHours,
      expectedRevenue: planAfter.expectedRevenue
    },
    blockFlip: aggBefore.isBlocked !== aggAfter.isBlocked
  };
}

/**
 * Query the client's timesheet_entries (one read per client). Groups by the
 * effective service id (parentServiceId || serviceId) and keeps the fields the
 * replay needs (id, minutes, createdAt, date, packageId, serviceId, parentServiceId).
 * @returns {Map<serviceId, Array<entry>>}
 */
async function loadEntriesByService(clientId) {
  const byService = new Map();
  const snap = await db.collection('timesheet_entries').where('clientId', '==', clientId).get();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const effId = d.parentServiceId || d.serviceId;
    if (!effId) return; // entry with no service → not attributable to a package
    const entry = {
      id: doc.id,
      minutes: typeof d.minutes === 'number' ? d.minutes : 0,
      createdAt: d.createdAt || null,
      date: d.date || null,
      packageId: d.packageId || null,
      serviceId: d.serviceId || null,
      parentServiceId: d.parentServiceId || null
    };
    if (!byService.has(effId)) byService.set(effId, []);
    byService.get(effId).push(entry);
  });
  return byService;
}

/**
 * Build the per-client repair plan (PURE-ish — one Firestore read for entries).
 * Returns a structured object used by BOTH dry-run reporting and --apply.
 */
async function buildClientPlan(clientId, clientData, preloadedEntries) {
  const services = Array.isArray(clientData.services) ? clientData.services.filter(Boolean) : [];
  const entriesByService = preloadedEntries || await loadEntriesByService(clientId);
  const allEntries = [];
  for (const arr of entriesByService.values()) allEntries.push(...arr);

  const servicesAfter = [];
  const serviceReports = [];
  const stampPlan = []; // { entryId, packageId, sameDayBoundary? } for orphan entries (packageId:null today)
  const basisCounts = { replay: 0, single_active: 0, pre_package: 0, unresolved: 0 };
  const unresolvedAll = [];
  const phantomReversals = [];
  const sameDayBoundaryFlags = []; // A3: entries routed pre_package/unresolved near a pkg purchaseDate
  let orphansStampedOnSkipped = 0; // A7: orphans stamped on override/overdraftResolved HOURS services

  for (const svc of services) {
    const elig = isEligibleService(svc);
    if (!elig.eligible) {
      // A7: a SKIPPED service is normally pushed unchanged and its orphans never
      // enter stampPlan → the addPackageToService detonator stays armed on them.
      // For skipped-but-HOURS services (override_preserved / overdraft_resolved)
      // that STILL HOLD packages, compute the forward-replay for STAMPING ONLY:
      // add its orphan entries to stampPlan WITHOUT changing its
      // hoursUsed/packages/aggregates. Archived / non-HOURS / no-packages stay
      // fully untouched.
      let stampedHere = 0;
      if (isSkippedHoursServiceNeedingStamp(svc)) {
        const svcEntriesSkip = entriesByService.get(svc.id) || [];
        const replaySkip = assignEntriesForwardReplay(svc.packages, svcEntriesSkip, {
          overrideActive: svc.overrideActive === true,
          serviceStatus: svc.status
        });
        const entryByIdSkip = new Map(svcEntriesSkip.map((e) => [e.id, e]));
        for (const a of replaySkip.assignments) {
          const e = entryByIdSkip.get(a.entryId);
          if (e && !e.packageId) {
            stampPlan.push({
              entryId: a.entryId,
              packageId: a.packageId,
              sameDayBoundary: a.sameDayBoundary === true,
              skippedService: true
            });
            stampedHere += 1;
            orphansStampedOnSkipped += 1;
            if (a.sameDayBoundary === true) {
              sameDayBoundaryFlags.push({ serviceId: svc.id, entryId: a.entryId, basis: a.basis, skippedService: true });
            }
          }
        }
      }
      serviceReports.push({
        serviceId: svc.id,
        skip: true,
        reason: elig.reason,
        orphansStampedOnSkipped: stampedHere
      });
      servicesAfter.push(svc); // unchanged — hoursUsed/packages/aggregates frozen
      continue;
    }
    const svcEntries = entriesByService.get(svc.id) || [];
    const replay = assignEntriesForwardReplay(svc.packages, svcEntries, {
      overrideActive: svc.overrideActive === true,
      serviceStatus: svc.status // A1: select Branch A vs B faithfully
    });
    const repaired = computeRepairedService(svc, replay);
    servicesAfter.push(repaired.repairedService);

    // Basis counts + unresolved.
    for (const a of replay.assignments) {
      if (basisCounts[a.basis] !== undefined) basisCounts[a.basis] += 1;
      // A3: flag pre_package assignments that excluded a package within ±1 day.
      if (a.sameDayBoundary === true) {
        sameDayBoundaryFlags.push({ serviceId: svc.id, entryId: a.entryId, basis: a.basis });
      }
    }
    for (const u of replay.unresolved) {
      basisCounts.unresolved += 1;
      unresolvedAll.push({ serviceId: svc.id, ...u });
      if (u.sameDayBoundary === true) {
        sameDayBoundaryFlags.push({ serviceId: svc.id, entryId: u.entryId, basis: 'unresolved' });
      }
    }
    for (const ph of repaired.phantomReversals) {
      phantomReversals.push({ serviceId: svc.id, ...ph });
    }

    // Stamp plan: orphan entries (no packageId today) that got a replay assignment.
    const entryById = new Map(svcEntries.map((e) => [e.id, e]));
    for (const a of replay.assignments) {
      const e = entryById.get(a.entryId);
      if (e && !e.packageId) {
        stampPlan.push({ entryId: a.entryId, packageId: a.packageId, sameDayBoundary: a.sameDayBoundary === true });
      }
    }

    serviceReports.push({
      serviceId: svc.id,
      skip: false,
      packageDiffs: repaired.packageDiffs,
      serviceBefore: repaired.serviceBefore,
      serviceAfter: repaired.serviceAfter,
      ledgerTruth: repaired.ledgerTruth,
      invariantOk: repaired.invariantOk
    });
  }

  // Client-level prediction (the writer's effect).
  const clientEffect = predictClientEffect(services, servicesAfter, clientData.totalHours);

  // Defensive signals (0 in PROD).
  const duplicatePackageIds = detectDuplicatePackageIds(clientData);
  const danglingEntries = detectDanglingEntries(clientData, allEntries);

  return {
    clientId,
    servicesBefore: services,
    servicesAfter,
    serviceReports,
    stampPlan,
    basisCounts,
    unresolved: unresolvedAll,
    phantomReversals,
    sameDayBoundaryFlags,       // A3
    orphansStampedOnSkipped,    // A7
    clientEffect,
    duplicatePackageIds,
    danglingEntries,
    isBlockedBefore: clientEffect.before.isBlocked
  };
}

// ── DRY-RUN report ───────────────────────────────────────────────────────────

function summarizeForReport(plan) {
  const changedServices = plan.serviceReports.filter((s) => !s.skip);
  const bigReversals = plan.phantomReversals.filter((p) => (p.beforeHoursUsed || 0) >= 20);
  const invariantFailures = changedServices.filter((s) => s.invariantOk === false);
  return {
    clientId: plan.clientId,
    eligibleServices: changedServices.length,
    skippedServices: plan.serviceReports.length - changedServices.length,
    orphansToStamp: plan.stampPlan.length,
    orphansStampedOnSkipped: plan.orphansStampedOnSkipped, // A7
    basisCounts: plan.basisCounts,
    unresolvedCount: plan.unresolved.length,
    // A3: entries routed to pre_package/unresolved within ±1 day of a package's
    // purchaseDate — a same-day renewal knife-edge the operator should eyeball.
    sameDayBoundaryFlags: plan.sameDayBoundaryFlags,
    phantomReversalsOver20h: bigReversals,
    blockFlip: plan.clientEffect.blockFlip,
    clientEffect: plan.clientEffect,
    invariantFailures: invariantFailures.map((s) => ({
      serviceId: s.serviceId, serviceAfter: s.serviceAfter, ledgerTruth: s.ledgerTruth
    })),
    duplicatePackageIds: plan.duplicatePackageIds,
    danglingEntries: plan.danglingEntries
  };
}

// ── APPLY a single client (one transaction, retry on aborted, fresh read) ─────

// IMPORTANT (operational): `--apply` MUST run in a maintenance window. The
// A5 optimistic-concurrency guard below forces a retry (and re-backup) if a live
// deduction lands between the pre-txn read and the txn, but minimizing concurrent
// writers keeps the run fast and the audit/backup trail clean.
async function applyClient(clientId) {
  const MAX_RETRIES = 3;
  const clientRef = db.collection('clients').doc(clientId);

  // Entries are dormant (0 created in 30d) → load once, reuse across retries.
  const entriesByService = await loadEntriesByService(clientId);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const freshDoc = await clientRef.get();
    if (!freshDoc.exists) return { clientId, status: 'not_found' };
    // A5: capture the pre-txn read's updateTime. The txn below asserts the doc
    // is STILL at this version; if a live deduction wrote in between, the txn
    // aborts → we retry with a FRESH read (so backup + gate + write all agree on
    // ONE snapshot, never a mix of pre-txn backup and a different txn-write).
    const preReadUpdateTime = freshDoc.updateTime;
    // prePlan (pre-txn read) drives the backup/audit/stamp targets AND a FIRST
    // block-flip gate. The gate is RE-EVALUATED inside the txn on the txn-read
    // services (fail-secure) so a concurrent write can't sneak a flip past it.
    const plan = await buildClientPlan(clientId, freshDoc.data() || {}, entriesByService);

    // Block-flip gate #1 (pre-txn, cheap refuse before we write a backup/audit).
    if (plan.clientEffect.blockFlip && !APPROVED_BLOCK_FLIPS.has(clientId)) {
      return { clientId, status: 'refused_block_flip', blockFlip: true };
    }

    // Backup BEFORE any write (per client services-before + isBlocked-before + stamp plan).
    // SAFE to take from the pre-txn `plan`: the A5 updateTime guard guarantees the
    // txn writes from the SAME snapshot this backup captured, else it retries.
    // IDEMPOTENT on retry: same path (repair-<clientId>-<RUN_ID>.json) → an A5-forced
    // retry overwrites the SAME file with the re-read snapshot (no duplicate backup).
    const backup = {
      clientId,
      runId: RUN_ID,
      servicesBefore: plan.servicesBefore,
      isBlockedBefore: plan.isBlockedBefore,
      stampedEntries: plan.stampPlan.map((s) => ({ entryId: s.entryId, packageIdBefore: null, packageId: s.packageId, runId: RUN_ID }))
    };
    const backupFile = path.join(backupDir(), `repair-${clientId}-${RUN_ID}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    // A flag set INSIDE the txn when the txn-read services would flip isBlocked
    // and the client isn't approved → we abort the txn and surface refusal.
    let refusedInTxn = false;
    try {
      await db.runTransaction(async (tx) => {
        // 2-G: re-read INSIDE the txn and REBUILD servicesAfter from the CURRENT
        // services (never write a snapshot built from the pre-txn read). Entries are
        // dormant, so the replay is reused; only the services array is re-derived
        // from the txn-read client → a concurrent live deduction is not clobbered.
        const doc = await tx.get(clientRef);
        if (!doc.exists) throw new Error('client vanished mid-repair');

        // A5 guard: if the doc changed since the pre-txn read (a concurrent live
        // deduction), the backup/gate/audit no longer match this snapshot → abort
        // and retry with a fresh read so all three realign.
        if (!doc.updateTime || !doc.updateTime.isEqual(preReadUpdateTime)) {
          const e = new Error('client changed since pre-txn read (A5 concurrency guard)');
          e.code = 'aborted';
          throw e;
        }

        const txnPlan = await buildClientPlan(clientId, doc.data() || {}, entriesByService);

        // Block-flip gate #2 (INSIDE the txn, fail-secure): re-evaluate on the
        // txn-read services. If it flips and the client isn't approved → abort
        // WITHOUT writing (so the writer can't silently recompute isBlocked past
        // the human gate). Marked non-retryable: this is a real refusal, not a race.
        if (txnPlan.clientEffect.blockFlip && !APPROVED_BLOCK_FLIPS.has(clientId)) {
          refusedInTxn = true;
          const e = new Error('block-flip refused inside txn');
          e.code = 'repair_refused_block_flip';
          throw e;
        }

        // FIX 2 — Audit-FIRST, INSIDE the txn (logCriticalActionInTxn). Previously
        // the audit was a bare logCriticalAction().add() BEFORE runTransaction, so an
        // A5-forced retry wrote a SECOND REPAIR_PACKAGE_AGGREGATES doc for the same
        // client+RUN_ID while only ONE mutation committed → duplicate audit docs.
        // Setting it INSIDE the txn makes the audit commit ATOMICALLY with the
        // mutation: an A5 abort rolls BOTH back together (one audit per committed
        // mutation), and the audit `tx.set` is enqueued BEFORE the writer's mutation
        // set below — audit-FIRST/backup-FIRST semantics preserved. Computed from
        // txnPlan (the snapshot actually being written), not the pre-txn plan.
        const netDeltaHours = txnPlan.serviceReports
          .filter((s) => !s.skip)
          .reduce((sum, s) => sum + (s.serviceAfter - s.serviceBefore), 0);
        logCriticalActionInTxn(tx, AUDIT_ACTION, AUDIT_ACTOR, {
          clientId,
          runId: RUN_ID,
          packagesRepaired: txnPlan.serviceReports
            .filter((s) => !s.skip)
            .reduce((n, s) => n + (s.packageDiffs ? s.packageDiffs.length : 0), 0),
          orphansStamped: txnPlan.stampPlan.length,
          orphansStampedOnSkipped: txnPlan.orphansStampedOnSkipped, // A7
          netDeltaHours: Math.round(netDeltaHours * 100) / 100,
          blockFlip: txnPlan.clientEffect.blockFlip,
          schemaVersion: 1
        });

        // The writer reads services from partialUpdate.services as-is (sets
        // service.hoursUsed), derives client aggregates + plan, strips RESTRICTED_KEYS.
        await writeClientWithCanonicalAggregates(
          tx,
          clientRef,
          { services: txnPlan.servicesAfter },
          { caller: 'repairPackageAggregates', auditMeta: { uid: AUDIT_ACTOR } }
        );
      });
    } catch (err) {
      if (refusedInTxn || (err && err.code === 'repair_refused_block_flip')) {
        return { clientId, status: 'refused_block_flip', blockFlip: true };
      }
      if (err && err.code === 'aborted' && attempt < MAX_RETRIES) {
        continue; // retry with a fresh read (A5 guard or Firestore contention)
      }
      throw err;
    }

    // Stamp orphan entries (conditional, batched ≤450). The packageId-only +
    // repairStampedAt UPDATE is the zero-delta trigger no-op (design §6).
    let stamped = 0;
    for (let i = 0; i < plan.stampPlan.length; i += STAMP_BATCH) {
      const slice = plan.stampPlan.slice(i, i + STAMP_BATCH);
      // Re-read each entry to honor the conditional (`if (!entry.packageId)`).
      const batch = db.batch();
      let inBatch = 0;
      for (const s of slice) {
        const ref = db.collection('timesheet_entries').doc(s.entryId);
        // eslint-disable-next-line no-await-in-loop
        const esnap = await ref.get();
        if (!esnap.exists) continue;
        if ((esnap.data() || {}).packageId) continue; // never overwrite a non-null packageId
        batch.update(ref, {
          packageId: s.packageId,
          repairStampedAt: admin.firestore.FieldValue.serverTimestamp(),
          repairRunId: RUN_ID
        });
        inBatch += 1;
      }
      if (inBatch > 0) {
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        stamped += inBatch;
      }
    }

    // FIX 3 — A6 partial-stamp visibility. The stamp loop is post-commit + NON-
    // transactional (self-healing on re-run: a future run re-stamps anything that
    // didn't take). Surface the actually-stamped-vs-planned delta + the unresolved
    // residue so a supervised operator SEES a partial stamp / unresolved tail. No
    // behavior change — the conditional re-stamp already self-heals on re-run.
    const orphansPlanned = plan.stampPlan.length;
    const partialStamp = stamped < orphansPlanned; // < means some orphans didn't stamp this run
    const unresolvedCount = plan.unresolved.length;
    return {
      clientId,
      status: 'repaired',
      orphansPlanned,                 // A6: orphans the plan TARGETED for stamping
      orphansStamped: stamped,        // A6: orphans ACTUALLY stamped this run
      partialStamp,                   // A6: true → a residue remains (re-run self-heals)
      unresolvedCount,                // A6: entries with NO eligible package (operator review)
      orphansStampedOnSkipped: plan.orphansStampedOnSkipped, // A7
      blockFlip: plan.clientEffect.blockFlip
    };
  }
  return { clientId, status: 'aborted_max_retries' };
}

// ── ROLLBACK (design §9) ──────────────────────────────────────────────────────

async function rollback(backupFileGlobOrSingle) {
  // Accept either a single backup file or a directory of per-client backups.
  const target = path.resolve(process.cwd(), backupFileGlobOrSingle);
  const files = [];
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const f of fs.readdirSync(target)) {
      if (f.endsWith('.json')) files.push(path.join(target, f));
    }
  } else {
    files.push(target);
  }

  const counts = { clientsRestored: 0, entriesUnstamped: 0, errors: 0 };
  for (const file of files) {
    try {
      const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
      const clientRef = db.collection('clients').doc(backup.clientId);
      if (APPLY) {
        // Restore services-before via the canonical writer (it re-derives aggregates+plan).
        // eslint-disable-next-line no-await-in-loop
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(clientRef);
          if (!doc.exists) throw new Error('client not found on rollback');
          await writeClientWithCanonicalAggregates(
            tx,
            clientRef,
            { services: backup.servicesBefore },
            { caller: 'repairPackageAggregates:rollback', auditMeta: { uid: AUDIT_ACTOR } }
          );
        });
        counts.clientsRestored += 1;

        // Un-stamp entries CONDITIONALLY: only if packageId still == repaired value
        // AND repairRunId matches this run (never clobber a concurrent legit write).
        for (const e of (backup.stampedEntries || [])) {
          const ref = db.collection('timesheet_entries').doc(e.entryId);
          // eslint-disable-next-line no-await-in-loop
          const snap = await ref.get();
          if (!snap.exists) continue;
          const d = snap.data() || {};
          if (d.packageId === e.packageId && d.repairRunId === e.runId) {
            // eslint-disable-next-line no-await-in-loop
            await ref.update({
              packageId: e.packageIdBefore === undefined ? null : e.packageIdBefore,
              repairStampedAt: admin.firestore.FieldValue.delete(),
              repairRunId: admin.firestore.FieldValue.delete()
            });
            counts.entriesUnstamped += 1;
          }
        }
      } else {
        // Dry-run rollback: report what WOULD be restored.
        console.log(`[rollback DRY-RUN] would restore client ${backup.clientId} + un-stamp ${(backup.stampedEntries || []).length} entries`);
      }
    } catch (err) {
      counts.errors += 1;
      console.error(`[rollback] ${path.basename(file)} failed: ${err && err.code ? err.code : 'error'}`);
    }
  }
  console.log(`\n[rollback] DONE (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${JSON.stringify(counts)}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (ROLLBACK_FILE) {
    console.log(`\n[repair] ROLLBACK mode (${APPLY ? 'APPLY' : 'DRY-RUN'}) — file=${ROLLBACK_FILE}\n`);
    await rollback(ROLLBACK_FILE);
    return;
  }

  console.log(`\n[repair-package-aggregates] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} runId=${RUN_ID}\n`);

  const counts = {
    clientsScanned: 0, clientsWithDrift: 0, clientsRepaired: 0,
    clientsRefusedBlockFlip: 0, clientsErrored: 0,
    orphansPlanned: 0, orphansStamped: 0, orphansStampedOnSkipped: 0, // A6 planned-vs-stamped + A7
    clientsWithPartialStamp: 0,                     // A6: clients where stamped < planned (re-run self-heals)
    unresolvedEntries: 0,                           // A6: entries with no eligible package (operator review)
    sameDayBoundaryFlags: 0,                        // A3
    blockFlips: 0, invariantFailures: 0
  };
  const partialStampClients = []; // A6: {clientId, orphansPlanned, orphansStamped, unresolvedCount}
  const report = [];
  let cursor = null;

  for (;;) {
    let q = db.collection('clients').orderBy('__name__').limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    // eslint-disable-next-line no-await-in-loop
    const page = await q.get();
    if (page.empty) break;
    cursor = page.docs[page.docs.length - 1];

    for (const doc of page.docs) {
      const clientId = doc.id;
      if (SKIP_CLIENTS.includes(clientId)) continue;
      counts.clientsScanned += 1;
      try {
        const clientData = doc.data() || {};
        // eslint-disable-next-line no-await-in-loop
        const plan = await buildClientPlan(clientId, clientData);
        const summary = summarizeForReport(plan);

        const hasWork = summary.orphansToStamp > 0
          || plan.serviceReports.some((s) => !s.skip && (s.packageDiffs || []).some((d) => Math.abs(d.delta) > 0.05 || d.statusFlip));
        if (hasWork) counts.clientsWithDrift += 1;
        if (summary.blockFlip) counts.blockFlips += 1;
        if (summary.invariantFailures.length > 0) counts.invariantFailures += 1;
        counts.sameDayBoundaryFlags += (summary.sameDayBoundaryFlags || []).length; // A3
        if (hasWork || summary.blockFlip || summary.invariantFailures.length > 0
            || summary.duplicatePackageIds.length > 0 || summary.danglingEntries.length > 0
            || (summary.sameDayBoundaryFlags || []).length > 0) {
          report.push(summary);
        }

        if (APPLY && hasWork) {
          // eslint-disable-next-line no-await-in-loop
          const res = await applyClient(clientId);
          if (res.status === 'repaired') {
            counts.clientsRepaired += 1;
            counts.orphansPlanned += res.orphansPlanned || 0;   // A6
            counts.orphansStamped += res.orphansStamped || 0;
            counts.unresolvedEntries += res.unresolvedCount || 0; // A6
            counts.orphansStampedOnSkipped += res.orphansStampedOnSkipped || 0; // A7
            // A6: a partial stamp (stamped < planned) OR any unresolved residue is
            // a tail a supervised operator must SEE. The re-run self-heals stamps,
            // but unresolved entries need a human decision — surface both.
            if (res.partialStamp || (res.unresolvedCount || 0) > 0) {
              counts.clientsWithPartialStamp += res.partialStamp ? 1 : 0;
              partialStampClients.push({
                clientId,
                orphansPlanned: res.orphansPlanned || 0,
                orphansStamped: res.orphansStamped || 0,
                unresolvedCount: res.unresolvedCount || 0
              });
            }
          } else if (res.status === 'refused_block_flip') {
            counts.clientsRefusedBlockFlip += 1;
          }
        }
      } catch (err) {
        counts.clientsErrored += 1;
        console.error(`[repair] client ${clientId} failed: ${err && err.code ? err.code : 'error'}`);
      }
    }
    console.log(`[repair] …scanned ${counts.clientsScanned} (withDrift ${counts.clientsWithDrift}, blockFlips ${counts.blockFlips})`);
  }

  // Durable report (gitignored). Counts + per-client structured summary (no PII).
  // A6: include the partial-stamp / unresolved residue (apply mode) so a
  // supervised operator can eyeball which clients still have a stamp tail.
  const reportFile = path.join(backupDir(), `repair-report-${RUN_ID}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run', runId: RUN_ID, counts, report, partialStampClients
  }, null, 2));

  console.log(`\n[repair] DONE — ${JSON.stringify(counts)}`);
  console.log(`[repair] report written to ${reportFile}`);
  if (counts.blockFlips > 0) {
    console.log(`[repair] ⚠️  ${counts.blockFlips} client(s) would FLIP isBlocked — review the report; --apply REFUSES them unless in --approve-block-flips`);
  }
  if (counts.sameDayBoundaryFlags > 0) {
    console.log(`[repair] ⚠️  ${counts.sameDayBoundaryFlags} entry(ies) routed pre_package/unresolved within ±1 day of a package purchaseDate (A3 same_day_boundary) — eyeball the report's sameDayBoundaryFlags`);
  }
  if (counts.orphansStampedOnSkipped > 0) {
    console.log(`[repair] ℹ️  ${counts.orphansStampedOnSkipped} orphan(s) stamped on SKIPPED (override/overdraftResolved) HOURS services — detonator defused, hoursUsed untouched (A7)`);
  }
  // A6: partial-stamp / unresolved residue (apply mode only — the stamp loop is
  // post-commit + non-transactional and self-heals on re-run; unresolved entries
  // need a human decision).
  if (APPLY && counts.orphansStamped < counts.orphansPlanned) {
    console.log(`[repair] ⚠️  PARTIAL STAMP: ${counts.orphansStamped}/${counts.orphansPlanned} planned orphans stamped across ${counts.clientsWithPartialStamp} client(s) — re-run self-heals the remainder; see report.partialStampClients (A6)`);
  }
  if (APPLY && counts.unresolvedEntries > 0) {
    console.log(`[repair] ⚠️  ${counts.unresolvedEntries} UNRESOLVED entry(ies) (no eligible package) — NOT auto-fixable by re-run; needs operator review; see report.partialStampClients (A6)`);
  }
  if (!APPLY) console.log('[repair] DRY-RUN — no writes. Review the report, then re-run with --apply.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[repair] FATAL:', err && err.message ? err.message : err);
  process.exit(1);
});
