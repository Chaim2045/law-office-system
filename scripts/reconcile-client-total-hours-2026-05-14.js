/**
 * Reconciliation Script: Restore client.totalHours from sum of billable services.
 *
 * Background (2026-05-13 audit):
 *   - Client 2025996 (Binyamingold) was found with `client.totalHours = null`
 *     despite having a billable service "הליך ביהמש עליון" with totalHours=70.
 *   - Root cause: addServiceToClient flow on hybrid clients (fixed-only client
 *     becoming hybrid via second service add) did not propagate the new totalHours
 *     to client root. Likely older variant of the code path.
 *   - Effect: canonical calcClientAggregates computes safeTotalHours=0 (null fallback),
 *     hoursRemaining = 0 - 0 = 0, isBlocked = true → client wrongly blocked.
 *
 * What this script does:
 *   - For each client in production:
 *     - Compute `expectedTotalHours = Σ(svc.totalHours)` for billable services only
 *     - Compare to current `client.totalHours`
 *     - If mismatch AND client has billable services → propose fix
 *
 * Safety:
 *   - DEFAULT MODE: --dry-run (no writes, just reports).
 *   - Live mode requires --confirm flag explicitly.
 *   - Snapshot backup written to scripts/.reconcile-backup-<timestamp>.json before any writes.
 *   - Audit log entry per client (audit_log collection).
 *   - Hard limit: max 50 clients per run (safety cap; raise via --max-clients=N if needed).
 *
 * Usage:
 *   Dry-run:    node scripts/reconcile-client-total-hours-2026-05-14.js
 *   Live:       node scripts/reconcile-client-total-hours-2026-05-14.js --confirm
 *   Single:     node scripts/reconcile-client-total-hours-2026-05-14.js --case=2025996
 *
 * Project: law-office-system-e4801 (production).
 * Author:  Claude (Tomi role) as part of 2026-05-13 audit refactor.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const { calcClientAggregates, isFixedService, assertClientAggregateInvariants } =
  require('../functions/shared/aggregates');

// ===== CLI args =====
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--confirm');
const targetCaseArg = args.find(a => a.startsWith('--case='));
const TARGET_CASE = targetCaseArg ? targetCaseArg.split('=')[1] : null;
const maxClientsArg = args.find(a => a.startsWith('--max-clients='));
const MAX_CLIENTS = maxClientsArg ? parseInt(maxClientsArg.split('=')[1], 10) : 50;

function log(msg, ...rest) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] ${msg}`, ...rest);
}

// ===== Firebase Admin init =====
if (!admin.apps.length) {
  // Uses application default credentials (gcloud auth application-default login).
  admin.initializeApp({
    projectId: 'law-office-system-e4801'
  });
}
const db = admin.firestore();

async function main() {
  log('===== Reconciliation: client.totalHours from billable services =====');
  log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE (--confirm given)'}`);
  if (TARGET_CASE) log(`Target single case: ${TARGET_CASE}`);
  log(`Max clients per run: ${MAX_CLIENTS}`);
  log('');

  let snapshot;
  if (TARGET_CASE) {
    const doc = await db.collection('clients').doc(TARGET_CASE).get();
    if (!doc.exists) {
      log(`❌ Client ${TARGET_CASE} not found`);
      process.exit(1);
    }
    snapshot = { docs: [doc] };
  } else {
    snapshot = await db.collection('clients').get();
  }

  log(`Scanning ${snapshot.docs.length} clients...\n`);

  const proposals = [];
  const skipped = [];
  const errors = [];

  for (const doc of snapshot.docs) {
    try {
      const client = doc.data();
      const caseNumber = client.caseNumber || doc.id;
      const name = client.fullName || client.clientName || '?';
      const services = client.services || [];
      const billable = services.filter(svc => !isFixedService(svc));

      // Skip: fixed-only clients (no billable to sum)
      if (billable.length === 0) {
        skipped.push({ caseNumber, name, reason: 'no_billable_services' });
        continue;
      }

      // Compute expected totalHours
      const expectedTotalHours = billable.reduce((sum, svc) => sum + (svc.totalHours || 0), 0);
      const currentTotalHours = client.totalHours;

      // Skip if already correct (within rounding tolerance)
      const TOLERANCE = 0.01;
      const drift = Math.abs((currentTotalHours || 0) - expectedTotalHours);
      if (drift <= TOLERANCE && currentTotalHours != null) {
        skipped.push({ caseNumber, name, reason: 'already_correct' });
        continue;
      }

      // Compute new aggregates with the corrected totalHours
      const newAgg = calcClientAggregates(services, expectedTotalHours);

      // Validate against invariants (fail-fast if our fix would violate them)
      assertClientAggregateInvariants(services, newAgg, 'reconcile-totalHours');

      proposals.push({
        caseNumber,
        name,
        ref: doc.ref,
        currentTotalHours,
        expectedTotalHours,
        currentIsBlocked: client.isBlocked === true,
        newIsBlocked: newAgg.isBlocked,
        servicesCount: services.length,
        billableCount: billable.length,
        newHoursRemaining: newAgg.hoursRemaining,
        newHoursUsed: newAgg.hoursUsed
      });
    } catch (e) {
      errors.push({ id: doc.id, error: e.message });
    }
  }

  // ===== Report =====
  log(`\nProposals: ${proposals.length}`);
  log(`Skipped:   ${skipped.length}`);
  log(`Errors:    ${errors.length}`);
  log('');

  if (proposals.length === 0) {
    log('No clients require reconciliation.');
    return;
  }

  log('CLIENTS TO RECONCILE:');
  log('─'.repeat(80));
  for (const p of proposals) {
    log(`  ${p.caseNumber} - ${p.name}`);
    log(`    totalHours: ${p.currentTotalHours ?? '(missing)'}  →  ${p.expectedTotalHours}`);
    log(`    isBlocked:  ${p.currentIsBlocked}  →  ${p.newIsBlocked}`);
    log(`    services: ${p.servicesCount} (${p.billableCount} billable)`);
    log('');
  }

  if (errors.length > 0) {
    log('ERRORS:');
    for (const e of errors) {
      log(`  ${e.id}: ${e.error}`);
    }
    log('');
  }

  // ===== Safety cap =====
  if (proposals.length > MAX_CLIENTS) {
    log(`❌ HALTED: ${proposals.length} proposals exceeds safety cap of ${MAX_CLIENTS}.`);
    log(`   Either narrow with --case=N, or raise the cap with --max-clients=N.`);
    process.exit(2);
  }

  // ===== DRY-RUN exit =====
  if (DRY_RUN) {
    log('═'.repeat(80));
    log('DRY-RUN COMPLETE. No writes performed.');
    log(`To execute: rerun with --confirm flag.`);
    log('═'.repeat(80));
    return;
  }

  // ===== Live mode: snapshot backup + write =====
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `.reconcile-backup-${timestamp}.json`);
  const backup = proposals.map(p => ({
    caseNumber: p.caseNumber,
    name: p.name,
    docId: p.ref.id,
    beforeFix: {
      totalHours: p.currentTotalHours,
      isBlocked: p.currentIsBlocked
    }
  }));
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  log(`💾 Backup written: ${backupPath}`);
  log('');

  log('═'.repeat(80));
  log('EXECUTING LIVE WRITES...');
  log('═'.repeat(80));

  let written = 0;
  let writeErrors = 0;

  for (const p of proposals) {
    try {
      await db.runTransaction(async tx => {
        const fresh = await tx.get(p.ref);
        if (!fresh.exists) {
          throw new Error('document_disappeared_during_tx');
        }
        const freshData = fresh.data();
        const freshServices = freshData.services || [];

        // Recompute on fresh data inside transaction (safety against races)
        const freshBillable = freshServices.filter(svc => !isFixedService(svc));
        if (freshBillable.length === 0) {
          throw new Error('billable_services_disappeared_during_tx');
        }
        const freshExpected = freshBillable.reduce((s, svc) => s + (svc.totalHours || 0), 0);
        const freshAgg = calcClientAggregates(freshServices, freshExpected);

        // Final invariant check INSIDE transaction
        assertClientAggregateInvariants(freshServices, freshAgg, 'reconcile-totalHours-tx');

        tx.update(p.ref, {
          totalHours: freshExpected,
          hoursUsed: freshAgg.hoursUsed,
          hoursRemaining: freshAgg.hoursRemaining,
          minutesUsed: freshAgg.minutesUsed,
          minutesRemaining: freshAgg.minutesRemaining,
          isBlocked: freshAgg.isBlocked,
          isCritical: freshAgg.isCritical,
          _reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
          _reconciledBy: 'reconcile-client-total-hours-2026-05-14'
        });

        // Audit log entry (intent + result)
        const auditRef = db.collection('audit_log').doc();
        tx.create(auditRef, {
          type: 'RECONCILIATION_CLIENT_TOTAL_HOURS',
          caseNumber: p.caseNumber,
          clientName: p.name,
          before: {
            totalHours: p.currentTotalHours,
            isBlocked: p.currentIsBlocked
          },
          after: {
            totalHours: freshExpected,
            isBlocked: freshAgg.isBlocked
          },
          script: 'reconcile-client-total-hours-2026-05-14.js',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      log(`✅ ${p.caseNumber} - ${p.name}: reconciled`);
      written++;
    } catch (e) {
      log(`❌ ${p.caseNumber} - ${p.name}: ${e.message}`);
      writeErrors++;
    }
  }

  log('');
  log('═'.repeat(80));
  log(`COMPLETED. Written: ${written}/${proposals.length}. Errors: ${writeErrors}.`);
  log(`Backup: ${backupPath}`);
  log('═'.repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(99);
  });
