/**
 * Sweep — package drift detection (READ ONLY).
 *
 * Detects clients where:
 *   service.totalHours > Σ(service.packages[].hours)
 *
 * Indicates: renewServiceHours bug pre-2026-02-19 (commit 974152d) — totalHours
 * was incremented but the renewal package was not created.
 *
 * Reports per service:
 *   - service.totalHours
 *   - sum of package.hours
 *   - delta (missing hours)
 *   - renewalHistory entries (if any) — confirms attempted renewals
 *
 * READ ONLY. NO writes.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TOLERANCE = 0.02; // hours

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 PACKAGE DRIFT SWEEP — service.totalHours vs Σ(package.hours)');
  console.log('═'.repeat(80));

  const snap = await db.collection('clients').get();
  console.log(`Total clients scanned: ${snap.size}\n`);

  const drifted = [];
  let scannedServices = 0;

  snap.forEach(doc => {
    const c = doc.data();
    const services = Array.isArray(c.services) ? c.services : [];

    services.forEach((svc, sIdx) => {
      // Only hours-type services with packages
      const isHours = svc.type === 'hours' || svc.serviceType === 'hours';
      if (!isHours) return;

      scannedServices++;

      const packages = Array.isArray(svc.packages) ? svc.packages : [];
      const sumPkgHours = round2(packages.reduce((s, p) => s + (p.hours || 0), 0));
      const totalHours = round2(svc.totalHours || 0);
      const delta = round2(totalHours - sumPkgHours);

      if (delta > TOLERANCE) {
        const renewalHistory = svc.renewalHistory || [];
        const renewalHoursSum = round2(renewalHistory.reduce((s, r) => s + (r.hours || 0), 0));

        drifted.push({
          clientId: doc.id,
          fullName: c.fullName || c.clientName || '<no-name>',
          status: c.status,
          serviceId: svc.id,
          serviceName: svc.name || svc.serviceName,
          totalHours,
          sumPkgHours,
          delta,
          packageCount: packages.length,
          renewalHistoryCount: renewalHistory.length,
          renewalHistorySum: renewalHoursSum,
          renewalDates: renewalHistory.map(r => r.date?.substring(0, 10)).join(', '),
          lastRenewalDate: svc.lastRenewalDate?.substring(0, 10),
          serviceCreatedAt: svc.createdAt?.substring(0, 10),
          clientUpdatedAt: c.updatedAt?.substring?.(0, 10) || c.updatedAt?.toDate?.()?.toISOString().substring(0, 10),
          lastModifiedBy: c.lastModifiedBy
        });
      }
    });
  });

  console.log(`Scanned services: ${scannedServices}`);
  console.log(`Drifted services: ${drifted.length}\n`);

  if (drifted.length === 0) {
    console.log('✅ No drift detected — all hours services have package.hours summing to totalHours.');
    process.exit(0);
  }

  // Sort by delta desc
  drifted.sort((a, b) => b.delta - a.delta);

  console.log('═'.repeat(80));
  console.log('DRIFTED SERVICES (sorted by missing hours)');
  console.log('═'.repeat(80));

  drifted.forEach((d, i) => {
    console.log(`\n[${i + 1}] ${d.clientId} | ${d.fullName}`);
    console.log(`    service:           ${d.serviceId} (${d.serviceName})`);
    console.log(`    totalHours:        ${d.totalHours}`);
    console.log(`    Σ package.hours:   ${d.sumPkgHours}`);
    console.log(`    🔴 missing hours:  ${d.delta}`);
    console.log(`    package count:     ${d.packageCount}`);
    console.log(`    renewal records:   ${d.renewalHistoryCount} (sum=${d.renewalHistorySum}h)`);
    if (d.renewalHistoryCount > 0) {
      console.log(`    renewal dates:     ${d.renewalDates}`);
    }
    console.log(`    lastRenewalDate:   ${d.lastRenewalDate || '-'}`);
    console.log(`    service createdAt: ${d.serviceCreatedAt}`);
    console.log(`    lastModifiedBy:    ${d.lastModifiedBy || '-'}`);
  });

  // Summary
  const totalMissing = round2(drifted.reduce((s, d) => s + d.delta, 0));
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total drifted services:    ${drifted.length}`);
  console.log(`Total missing hours (sum): ${totalMissing}`);
  console.log(`Services with renewal records: ${drifted.filter(d => d.renewalHistoryCount > 0).length}`);
  console.log(`Services touched by reconcile-full: ${drifted.filter(d => d.lastModifiedBy === 'reconcile-full-2026-03-29').length}`);

  // Match check: for services with renewalHistory, does delta == renewalHistorySum?
  console.log('\n' + '═'.repeat(80));
  console.log('CONFIRMATION CHECK — does delta match renewalHistorySum?');
  console.log('═'.repeat(80));
  const withHistory = drifted.filter(d => d.renewalHistoryCount > 0);
  withHistory.forEach(d => {
    const match = Math.abs(d.delta - d.renewalHistorySum) <= TOLERANCE;
    console.log(`  ${match ? '✅' : '⚠️'} ${d.clientId} | delta=${d.delta} | history=${d.renewalHistorySum} | match=${match}`);
  });

  console.log('\nDone. READ ONLY — no writes performed.');
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});