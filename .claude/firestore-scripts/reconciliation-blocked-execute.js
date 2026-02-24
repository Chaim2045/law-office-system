/**
 * RECONCILIATION: isBlocked / isCritical / minutesRemaining — EXECUTE
 *
 * PURPOSE: Fix all clients where root-level fields are inconsistent
 *          with the values calculated from services[].
 *
 * USAGE:
 *   node .claude/firestore-scripts/reconciliation-blocked-execute.js              → DRY RUN (default)
 *   node .claude/firestore-scripts/reconciliation-blocked-execute.js --execute    → EXECUTE (write to Firestore)
 *
 * FIELDS FIXED:
 *   - hoursRemaining   (sum from services/stages/packages)
 *   - minutesRemaining (hoursRemaining * 60)
 *   - isBlocked         (hoursRemaining <= 0 && type === 'hours')
 *   - isCritical        (!isBlocked && hoursRemaining <= 5 && type === 'hours')
 *
 * SAFETY:
 *   - Saves backup JSON before any writes
 *   - Each client updated in its own transaction
 *   - Fails fast on any error
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

const EXECUTE = process.argv.includes('--execute');

/**
 * Calculate expected hoursRemaining from services array.
 */
function calculateExpectedHoursRemaining(services) {
  if (!services || !Array.isArray(services) || services.length === 0) {
return 0;
}

  return services.reduce((total, service) => {
    // legal_procedure with stages
    if (service.type === 'legal_procedure' && service.stages && Array.isArray(service.stages)) {
      const stageHours = service.stages.reduce((stageSum, stage) => {
        if (stage.packages && Array.isArray(stage.packages) && stage.packages.length > 0) {
          const pkgHours = stage.packages
            .filter(pkg => pkg.status === 'active' || pkg.status === 'pending' || !pkg.status)
            .reduce((pkgSum, pkg) => pkgSum + (pkg.hoursRemaining || 0), 0);
          return stageSum + pkgHours;
        }
        return stageSum + (stage.hoursRemaining || 0);
      }, 0);
      return total + stageHours;
    }

    // Regular service with packages
    if (service.packages && Array.isArray(service.packages) && service.packages.length > 0) {
      const pkgHours = service.packages
        .filter(pkg => pkg.status === 'active' || !pkg.status)
        .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
      return total + pkgHours;
    }

    // Fallback
    return total + (service.hoursRemaining || 0);
  }, 0);
}

async function reconcile() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('RECONCILIATION: isBlocked / isCritical / minutesRemaining');
  console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!EXECUTE) {
    console.log('DRY RUN MODE — No changes will be made to Firestore');
    console.log('Run with --execute to apply changes\n');
  }

  const snapshot = await db.collection('clients').get();
  const totalClients = snapshot.size;
  console.log(`Total clients: ${totalClients}\n`);

  const mismatches = [];

  snapshot.forEach(doc => {
    const client = doc.data();
    const name = client.fullName || client.clientName || client.name || doc.id;
    const type = client.type || 'unknown';

    const rootHoursRemaining = client.hoursRemaining ?? null;
    const rootMinutesRemaining = client.minutesRemaining ?? null;
    const rootIsBlocked = client.isBlocked ?? false;
    const rootIsCritical = client.isCritical ?? false;

    const expectedHoursRemaining = calculateExpectedHoursRemaining(client.services);
    const expectedMinutesRemaining = expectedHoursRemaining * 60;
    const expectedIsBlocked = (expectedHoursRemaining <= 0) && (type === 'hours');
    const expectedIsCritical = (!expectedIsBlocked) && (expectedHoursRemaining <= 5) && (expectedHoursRemaining > 0) && (type === 'hours');

    const hrDiff = rootHoursRemaining !== null && Math.abs(rootHoursRemaining - expectedHoursRemaining) > 0.01;
    const minDiff = rootMinutesRemaining !== null && Math.abs(rootMinutesRemaining - expectedMinutesRemaining) > 0.1;
    const blockedDiff = rootIsBlocked !== expectedIsBlocked;
    const criticalDiff = rootIsCritical !== expectedIsCritical;

    if (hrDiff || minDiff || blockedDiff || criticalDiff) {
      mismatches.push({
        docId: doc.id,
        name,
        type,
        current: {
          hoursRemaining: rootHoursRemaining,
          minutesRemaining: rootMinutesRemaining,
          isBlocked: rootIsBlocked,
          isCritical: rootIsCritical
        },
        expected: {
          hoursRemaining: expectedHoursRemaining,
          minutesRemaining: expectedMinutesRemaining,
          isBlocked: expectedIsBlocked,
          isCritical: expectedIsCritical
        }
      });
    }
  });

  if (mismatches.length === 0) {
    console.log('No mismatches found. All clients are consistent.');
    await admin.app().delete();
    process.exit(0);
  }

  console.log(`Found ${mismatches.length} clients with mismatches.\n`);

  // Save backup BEFORE any writes
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const backupDir = path.join(__dirname);
  const backupPath = path.join(backupDir, `reconciliation-blocked-backup-${timestamp}.json`);
  const backupData = {
    timestamp: new Date().toISOString(),
    mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
    totalClients,
    mismatchCount: mismatches.length,
    mismatches
  };
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Backup saved to: ${backupPath}\n`);

  // Process each mismatch
  let fixed = 0;
  let failed = 0;

  for (const m of mismatches) {
    console.log(`${fixed + failed + 1}/${mismatches.length}  ${m.name} (${m.docId}) [${m.type}]`);

    const updates = {};

    if (m.current.hoursRemaining !== null && Math.abs(m.current.hoursRemaining - m.expected.hoursRemaining) > 0.01) {
      console.log(`  hoursRemaining:    ${m.current.hoursRemaining} -> ${m.expected.hoursRemaining}`);
      updates.hoursRemaining = m.expected.hoursRemaining;
    }

    if (m.current.minutesRemaining !== null && Math.abs(m.current.minutesRemaining - m.expected.minutesRemaining) > 0.1) {
      console.log(`  minutesRemaining:  ${m.current.minutesRemaining} -> ${m.expected.minutesRemaining}`);
      updates.minutesRemaining = m.expected.minutesRemaining;
    }

    if (m.current.isBlocked !== m.expected.isBlocked) {
      console.log(`  isBlocked:         ${m.current.isBlocked} -> ${m.expected.isBlocked}`);
      updates.isBlocked = m.expected.isBlocked;
    }

    if (m.current.isCritical !== m.expected.isCritical) {
      console.log(`  isCritical:        ${m.current.isCritical} -> ${m.expected.isCritical}`);
      updates.isCritical = m.expected.isCritical;
    }

    if (Object.keys(updates).length === 0) {
      console.log('  (no fields to update — skipping)');
      continue;
    }

    if (EXECUTE) {
      try {
        const clientRef = db.collection('clients').doc(m.docId);
        await db.runTransaction(async (transaction) => {
          const freshDoc = await transaction.get(clientRef);
          if (!freshDoc.exists) {
            throw new Error(`Client ${m.docId} not found in transaction`);
          }
          transaction.update(clientRef, {
            ...updates,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        console.log('  UPDATED');
        fixed++;
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        failed++;
      }
    } else {
      console.log('  (dry run — no write)');
      fixed++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total clients:         ${totalClients}`);
  console.log(`Mismatches found:      ${mismatches.length}`);
  console.log(`Fixed:                 ${fixed}`);
  console.log(`Failed:                ${failed}`);
  console.log(`Backup:                ${backupPath}`);

  if (EXECUTE) {
    console.log(`\nEXECUTED — ${fixed} clients updated, ${failed} failed.`);
  } else {
    console.log('\nDRY RUN — No changes made to Firestore.');
    console.log('Run with --execute to apply changes.');
  }

  await admin.app().delete();
  process.exit(failed > 0 ? 1 : 0);
}

reconcile().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
