/**
 * Migration: backfill `isOnHold: false` on every existing client.
 *
 * Why this exists (PR-A series, systemic treatment):
 *   - The 2026-05-13 audit identified that `client.isBlocked` is used for
 *     TWO orthogonal concerns mixed into one field:
 *       (a) DERIVED: "client has no remaining billable hours" — computed by
 *           calcClientAggregates, should be the only source.
 *       (b) MANUAL: "admin paused this client for business reasons (unpaid,
 *           dispute, on hold)" — needs a separate flag so the derived value
 *           doesn't drift on the next aggregate recompute.
 *
 *   The fix is splitting them:
 *       isBlocked   = DERIVED ONLY (PR-A.4 enforces — caller-supplied
 *                     isBlocked is stripped by writeClientWithCanonicalAggregates)
 *       isOnHold    = MANUAL ONLY (this script ensures the field exists on
 *                     every client; PR-A.4 wires it through changeClientStatus
 *                     callable + admin UI)
 *
 *   User App guard becomes: block time entry if (isBlocked || isOnHold).
 *
 * What this script does:
 *   - For each client in the `clients` collection:
 *     - If `isOnHold` is undefined → write `{ isOnHold: false }`
 *     - If already a boolean → skip (idempotent)
 *     - If a non-boolean value exists → log warning, do not overwrite
 *
 * Safety:
 *   - DEFAULT MODE: --dry-run (no writes, just reports).
 *   - Live mode requires --confirm flag explicitly.
 *   - Snapshot backup written to scripts/.add-isOnHold-backup-<timestamp>.json
 *     before any writes (lists clients that lacked the field — for rollback).
 *   - Each write logged to audit_log collection with action ADD_ISONHOLD_FIELD.
 *   - Single batched commit per chunk of 100 docs (atomic per chunk).
 *
 * Idempotency:
 *   Running this script twice has no effect after the first run — clients
 *   that already have `isOnHold: false` are skipped.
 *
 * Usage:
 *   Dry-run (default):  node scripts/add-isOnHold-field-2026-05-16.js
 *   Live:               node scripts/add-isOnHold-field-2026-05-16.js --confirm
 *   Single client:      node scripts/add-isOnHold-field-2026-05-16.js --case=2026069
 *
 * Project: law-office-system-e4801 (production).
 * Auth:    Application default credentials. Run after
 *          `gcloud auth application-default login` and a `gcloud config set project`.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ===== CLI args =====
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--confirm');
const targetCaseArg = args.find((a) => a.startsWith('--case='));
const TARGET_CASE = targetCaseArg ? targetCaseArg.split('=')[1] : null;

function log(msg, ...rest) {
  const stamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${stamp}] ${msg}`, ...rest);
}

// ===== Firebase Admin init =====
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'law-office-system-e4801' });
}
const db = admin.firestore();

async function main() {
  log('===== Migration: add isOnHold field to clients =====');
  log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE (--confirm given)'}`);
  if (TARGET_CASE) log(`Target single case: ${TARGET_CASE}`);
  log('');

  // ─── 1. Load clients ──────────────────────────────────────────────
  let snapshot;
  if (TARGET_CASE) {
    const doc = await db.collection('clients').doc(TARGET_CASE).get();
    if (!doc.exists) {
      log(`ERROR: Client ${TARGET_CASE} not found`);
      process.exit(1);
    }
    snapshot = { docs: [doc], size: 1 };
  } else {
    snapshot = await db.collection('clients').get();
  }

  log(`Loaded ${snapshot.size} clients`);
  log('');

  // ─── 2. Classify ──────────────────────────────────────────────────
  const needsUpdate = []; // clients missing isOnHold
  const alreadySet = []; // clients with isOnHold already boolean
  const malformed = []; // clients with isOnHold present but non-boolean

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const value = data.isOnHold;
    if (value === undefined) {
      needsUpdate.push({ id: doc.id, fullName: data.fullName || data.clientName });
    } else if (typeof value === 'boolean') {
      alreadySet.push(doc.id);
    } else {
      malformed.push({ id: doc.id, currentValue: value, type: typeof value });
    }
  }

  log(`Classification:`);
  log(`  needs update (no isOnHold):     ${needsUpdate.length}`);
  log(`  already set (boolean):          ${alreadySet.length}`);
  log(`  malformed (non-boolean value):  ${malformed.length}`);
  log('');

  if (malformed.length > 0) {
    log('WARNING: clients with non-boolean isOnHold (will NOT be overwritten):');
    for (const m of malformed) {
      log(`  ${m.id}: ${JSON.stringify(m.currentValue)} (${m.type})`);
    }
    log('');
  }

  if (needsUpdate.length === 0) {
    log('Nothing to do. All clients already have isOnHold field set.');
    log('===== DONE =====');
    return;
  }

  // ─── 3. Snapshot backup ───────────────────────────────────────────
  const backupPath = path.join(
    __dirname,
    `.add-isOnHold-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: DRY_RUN ? 'dry-run' : 'live',
        targetCase: TARGET_CASE,
        affectedClients: needsUpdate,
        malformed
      },
      null,
      2
    )
  );
  log(`Backup written: ${backupPath}`);
  log('');

  // ─── 4. Dry-run report ────────────────────────────────────────────
  if (DRY_RUN) {
    log('DRY-RUN: would update the following clients (no writes performed):');
    for (const c of needsUpdate.slice(0, 20)) {
      log(`  ${c.id}  ${c.fullName || '(no name)'}`);
    }
    if (needsUpdate.length > 20) {
      log(`  ... +${needsUpdate.length - 20} more`);
    }
    log('');
    log('To execute live: re-run with --confirm flag.');
    log('===== DONE (dry-run) =====');
    return;
  }

  // ─── 5. Live writes ───────────────────────────────────────────────
  log('LIVE MODE: writing updates...');
  let success = 0;
  let failed = 0;
  const CHUNK = 100;

  for (let i = 0; i < needsUpdate.length; i += CHUNK) {
    const slice = needsUpdate.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const c of slice) {
      const ref = db.collection('clients').doc(c.id);
      batch.update(ref, {
        isOnHold: false,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: 'migration:add-isOnHold-2026-05-16'
      });
    }
    try {
      await batch.commit();
      success += slice.length;
      log(`  chunk ${i / CHUNK + 1}: ${slice.length} clients updated`);
    } catch (err) {
      failed += slice.length;
      log(`  chunk ${i / CHUNK + 1}: FAILED — ${err.message}`);
    }
  }

  // ─── 6. Audit log ─────────────────────────────────────────────────
  await db.collection('audit_log').add({
    action: 'ADD_ISONHOLD_FIELD',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    actor: 'migration-script',
    targetCount: needsUpdate.length,
    successCount: success,
    failureCount: failed,
    backupPath: path.basename(backupPath),
    targetCase: TARGET_CASE || 'ALL'
  });

  log('');
  log(`Final: ${success} succeeded, ${failed} failed (of ${needsUpdate.length} planned)`);
  log('Audit log entry written to audit_log collection.');
  log('===== DONE (live) =====');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    process.exit(1);
  });
