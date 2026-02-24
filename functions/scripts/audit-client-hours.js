/**
 * READ-ONLY audit script: find clients with inconsistent hours data
 * Run: node functions/scripts/audit-client-hours.js
 */

const admin = require('firebase-admin');
const path = require('path');

try {
  const serviceAccount = require(path.join(__dirname, '../../service-account-key.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  admin.initializeApp();
}

const db = admin.firestore();

function calculateExpectedHoursRemaining(services) {
  if (!services || !Array.isArray(services) || services.length === 0) return 0;

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

async function audit() {
  console.log('=== Client Hours Audit (READ-ONLY) ===\n');

  const snapshot = await db.collection('clients').get();
  const totalClients = snapshot.size;
  const mismatches = [];

  snapshot.forEach(doc => {
    const client = doc.data();
    const name = client.fullName || client.clientName || doc.id;
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
        name,
        docId: doc.id,
        type,
        hoursRemaining: { root: rootHoursRemaining, expected: expectedHoursRemaining },
        minutesRemaining: { root: rootMinutesRemaining, expected: expectedMinutesRemaining },
        isBlocked: { root: rootIsBlocked, expected: expectedIsBlocked },
        isCritical: { root: rootIsCritical, expected: expectedIsCritical },
        flags: [
          hrDiff ? 'hoursRemaining' : null,
          minDiff ? 'minutesRemaining' : null,
          blockedDiff ? 'isBlocked' : null,
          criticalDiff ? 'isCritical' : null,
        ].filter(Boolean)
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
        console.log(`  hoursRemaining:    root=${m.hoursRemaining.root}  expected=${m.hoursRemaining.expected}`);
      }
      if (m.flags.includes('minutesRemaining')) {
        console.log(`  minutesRemaining:  root=${m.minutesRemaining.root}  expected=${m.minutesRemaining.expected}`);
      }
      if (m.flags.includes('isBlocked')) {
        console.log(`  isBlocked:         root=${m.isBlocked.root}  expected=${m.isBlocked.expected}`);
      }
      if (m.flags.includes('isCritical')) {
        console.log(`  isCritical:        root=${m.isCritical.root}  expected=${m.isCritical.expected}`);
      }
      console.log('');
    });
  }

  // Summary
  const blockedWrong = mismatches.filter(m => m.flags.includes('isBlocked')).length;
  const criticalWrong = mismatches.filter(m => m.flags.includes('isCritical')).length;

  console.log('=== SUMMARY ===');
  console.log(`Total clients:          ${totalClients}`);
  console.log(`Clients with mismatch:  ${mismatches.length}`);
  console.log(`Wrong isBlocked:        ${blockedWrong}`);
  console.log(`Wrong isCritical:       ${criticalWrong}`);

  process.exit(0);
}

audit().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
