/**
 * RECONCILIATION: isBlocked / isCritical / minutesRemaining — DRY RUN
 *
 * PURPOSE: Find all clients where root-level fields are inconsistent
 *          with the values calculated from services[].
 *          This script does NOT write to Firestore.
 *
 * FIELDS CHECKED:
 *   - hoursRemaining  (sum from services/stages/packages)
 *   - minutesRemaining (hoursRemaining * 60)
 *   - isBlocked        (hoursRemaining <= 0 && type === 'hours')
 *   - isCritical       (!isBlocked && hoursRemaining <= 5 && type === 'hours')
 *
 * RUN:
 *   node .claude/firestore-scripts/reconciliation-blocked-dry-run.js
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

/**
 * Calculate expected hoursRemaining from services array.
 * Handles: legal_procedure with stages → packages, regular services with packages, fallback.
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

async function dryRun() {
  console.log('=== RECONCILIATION DRY RUN: isBlocked / isCritical / minutesRemaining ===\n');
  console.log('This script is READ-ONLY. No data will be changed.\n');

  const snapshot = await db.collection('clients').get();
  const totalClients = snapshot.size;
  const mismatches = [];

  snapshot.forEach(doc => {
    const client = doc.data();
    const name = client.fullName || client.clientName || client.name || doc.id;
    const type = client.type || 'unknown';

    // Current root-level values
    const rootHoursRemaining = client.hoursRemaining ?? null;
    const rootMinutesRemaining = client.minutesRemaining ?? null;
    const rootIsBlocked = client.isBlocked ?? false;
    const rootIsCritical = client.isCritical ?? false;

    // Expected values calculated from services[]
    const expectedHoursRemaining = calculateExpectedHoursRemaining(client.services);
    const expectedMinutesRemaining = expectedHoursRemaining * 60;
    const expectedIsBlocked = (expectedHoursRemaining <= 0) && (type === 'hours');
    const expectedIsCritical = (!expectedIsBlocked) && (expectedHoursRemaining <= 5) && (expectedHoursRemaining > 0) && (type === 'hours');

    // Compare
    const hrDiff = rootHoursRemaining !== null && Math.abs(rootHoursRemaining - expectedHoursRemaining) > 0.01;
    const minDiff = rootMinutesRemaining !== null && Math.abs(rootMinutesRemaining - expectedMinutesRemaining) > 0.1;
    const blockedDiff = rootIsBlocked !== expectedIsBlocked;
    const criticalDiff = rootIsCritical !== expectedIsCritical;

    if (hrDiff || minDiff || blockedDiff || criticalDiff) {
      const flags = [
        hrDiff ? 'hoursRemaining' : null,
        minDiff ? 'minutesRemaining' : null,
        blockedDiff ? 'isBlocked' : null,
        criticalDiff ? 'isCritical' : null
      ].filter(Boolean);

      mismatches.push({
        docId: doc.id,
        name,
        type,
        flags,
        hoursRemaining: { current: rootHoursRemaining, expected: expectedHoursRemaining },
        minutesRemaining: { current: rootMinutesRemaining, expected: expectedMinutesRemaining },
        isBlocked: { current: rootIsBlocked, expected: expectedIsBlocked },
        isCritical: { current: rootIsCritical, expected: expectedIsCritical }
      });
    }
  });

  // Print results
  if (mismatches.length === 0) {
    console.log('No mismatches found. All clients are consistent.');
  } else {
    console.log(`Found ${mismatches.length} clients with mismatches:\n`);
    mismatches.forEach((m, i) => {
      console.log(`--- ${i + 1}. ${m.name} (${m.docId}) [type: ${m.type}] ---`);
      console.log(`  Flags: ${m.flags.join(', ')}`);
      if (m.flags.includes('hoursRemaining')) {
        console.log(`  hoursRemaining:    current=${m.hoursRemaining.current}  expected=${m.hoursRemaining.expected}`);
      }
      if (m.flags.includes('minutesRemaining')) {
        console.log(`  minutesRemaining:  current=${m.minutesRemaining.current}  expected=${m.minutesRemaining.expected}`);
      }
      if (m.flags.includes('isBlocked')) {
        console.log(`  isBlocked:         current=${m.isBlocked.current}  expected=${m.isBlocked.expected}`);
      }
      if (m.flags.includes('isCritical')) {
        console.log(`  isCritical:        current=${m.isCritical.current}  expected=${m.isCritical.expected}`);
      }
      console.log('');
    });
  }

  // Summary
  const blockedWrong = mismatches.filter(m => m.flags.includes('isBlocked')).length;
  const criticalWrong = mismatches.filter(m => m.flags.includes('isCritical')).length;
  const hrWrong = mismatches.filter(m => m.flags.includes('hoursRemaining')).length;
  const minWrong = mismatches.filter(m => m.flags.includes('minutesRemaining')).length;

  console.log('=== SUMMARY ===');
  console.log(`Total clients:              ${totalClients}`);
  console.log(`Clients with mismatch:      ${mismatches.length}`);
  console.log(`Wrong hoursRemaining:       ${hrWrong}`);
  console.log(`Wrong minutesRemaining:     ${minWrong}`);
  console.log(`Wrong isBlocked:            ${blockedWrong}`);
  console.log(`Wrong isCritical:           ${criticalWrong}`);
  console.log('\nThis was a DRY RUN — no data was changed.');

  await admin.app().delete();
  process.exit(0);
}

dryRun().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
