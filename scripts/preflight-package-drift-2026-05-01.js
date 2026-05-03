/**
 * Pre-flight audit for package-drift migration.
 *
 * READ ONLY. No writes.
 *
 * For each of the 8 drifted (clientId, serviceId) pairs:
 *   1. Re-verify drift: service.totalHours - Σ(packages[].hours) > 0.02
 *   2. Verify renewalHistory integrity:
 *      - delta == Σ(renewalHistory.hours) within tolerance
 *      - dates parseable
 *      - sum >0
 *   3. Orphan timesheet_entries:
 *      - WHERE clientId AND serviceId, packageId is null/missing
 *      - report count + total minutes
 *   4. Existing packages snapshot (for backup-aware migration).
 *   5. Active package per current logic — confirms which pkg backend currently picks.
 *
 * Output:
 *   - Per-client report
 *   - GO/STOP verdict per client
 *   - Aggregate: how many GO, how many STOP, what blocks the STOPs
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TOLERANCE = 0.02;

// 8 drifted services from sweep
const TARGETS = [
  { caseNumber: '2025306', serviceId: 'srv_1766393421154', expectedDelta: 30 },
  { caseNumber: '2025011', serviceId: 'srv_1766574628760', expectedDelta: 25 },
  { caseNumber: '2025002', serviceId: 'srv_1764868231167', expectedDelta: 22.3 },
  { caseNumber: '2025002', serviceId: 'srv_1766504727174', expectedDelta: 21 },
  { caseNumber: '2025333', serviceId: 'srv_1766331553598', expectedDelta: 20 },
  { caseNumber: '2026045', serviceId: 'srv_1771499755064', expectedDelta: 20 },
  { caseNumber: '20251000', serviceId: 'srv_1766330741925', expectedDelta: 15 },
  { caseNumber: '2026008', serviceId: 'srv_1767719279651', expectedDelta: 15 }
];

function round2(n) { return Math.round(n * 100) / 100; }

function getActivePackageMimick(packages) {
  // Mimics functions/src/modules/deduction/deduction-logic.js — first eligible
  return packages.find(p => {
    const status = p.status || 'active';
    return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
      && (p.hoursRemaining || 0) > -10;
  });
}

async function auditTarget(t) {
  const cs = await db.collection('clients').where('caseNumber', '==', t.caseNumber).get();
  if (cs.empty) {
    return { ...t, status: 'STOP', reason: 'client not found' };
  }
  const doc = cs.docs[0];
  const c = doc.data();
  const services = Array.isArray(c.services) ? c.services : [];
  const svc = services.find(s => s.id === t.serviceId);
  if (!svc) {
    return { ...t, status: 'STOP', reason: 'service not found' };
  }

  // 1. Re-verify drift
  const packages = svc.packages || [];
  const sumPkgHours = round2(packages.reduce((s, p) => s + (p.hours || 0), 0));
  const totalHours = round2(svc.totalHours || 0);
  const actualDelta = round2(totalHours - sumPkgHours);

  // 2. renewalHistory integrity
  const renewalHistory = svc.renewalHistory || [];
  const renewalSum = round2(renewalHistory.reduce((s, r) => s + (r.hours || 0), 0));

  // 3. Orphan timesheet_entries
  const tsSnap = await db.collection('timesheet_entries')
    .where('clientId', '==', doc.id)
    .where('serviceId', '==', t.serviceId)
    .get();
  const orphans = [];
  let orphanMinutes = 0;
  let totalEntries = 0;
  let totalEntryMinutes = 0;
  tsSnap.forEach(d => {
    const e = d.data();
    totalEntries++;
    totalEntryMinutes += (e.minutes || 0);
    if (!e.packageId) {
      orphans.push({ id: d.id, minutes: e.minutes || 0, date: e.date, action: e.action });
      orphanMinutes += (e.minutes || 0);
    }
  });

  // 4. Active package mimick
  const activePkg = getActivePackageMimick(packages);

  // 5. Verdict
  const issues = [];
  if (Math.abs(actualDelta - t.expectedDelta) > TOLERANCE) {
    issues.push(`drift mismatch: expected ${t.expectedDelta}, actual ${actualDelta}`);
  }
  if (Math.abs(actualDelta - renewalSum) > TOLERANCE) {
    issues.push(`delta(${actualDelta}) != renewalHistorySum(${renewalSum})`);
  }
  if (renewalHistory.length === 0) {
    issues.push('no renewalHistory records');
  }
  // Orphans are OK — we'll handle in migration. Just flag.

  return {
    ...t,
    clientDocId: doc.id,
    fullName: c.fullName || c.clientName,
    actualDelta,
    sumPkgHours,
    totalHours,
    packageCount: packages.length,
    packages: packages.map(p => ({ id: p.id, type: p.type, hours: p.hours, hoursUsed: p.hoursUsed, hoursRemaining: p.hoursRemaining, status: p.status })),
    renewalHistoryCount: renewalHistory.length,
    renewalSum,
    renewalDates: renewalHistory.map(r => r.date),
    activePkgId: activePkg?.id,
    activePkgStatus: activePkg?.status,
    activePkgHoursRemaining: activePkg?.hoursRemaining,
    totalEntries,
    totalEntryMinutes,
    totalEntryHours: round2(totalEntryMinutes / 60),
    orphanCount: orphans.length,
    orphanMinutes,
    orphanHours: round2(orphanMinutes / 60),
    sampleOrphans: orphans.slice(0, 3),
    status: issues.length === 0 ? 'GO' : 'STOP',
    issues,
    serviceCreatedAt: svc.createdAt,
    lastRenewalDate: svc.lastRenewalDate,
    serviceLastActivity: svc.lastActivity
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 PRE-FLIGHT AUDIT — package drift migration');
  console.log(`Targets: ${TARGETS.length}`);
  console.log('═'.repeat(80));

  const results = [];
  for (const t of TARGETS) {
    const r = await auditTarget(t);
    results.push(r);
  }

  // Per-target report
  results.forEach((r, i) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`[${i + 1}/${results.length}] ${r.caseNumber} — ${r.fullName || ''}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`  service:                    ${r.serviceId}`);
    console.log(`  status:                     ${r.status === 'GO' ? '✅ GO' : '❌ STOP'}`);
    if (r.issues && r.issues.length > 0) {
      r.issues.forEach(iss => console.log(`    ⚠️  ${iss}`));
    }
    console.log(`  drift (delta):              ${r.actualDelta}h (expected ${r.expectedDelta})`);
    console.log(`  totalHours:                 ${r.totalHours}`);
    console.log(`  Σ packages.hours:           ${r.sumPkgHours}`);
    console.log(`  package count:              ${r.packageCount}`);
    if (r.packages) {
      r.packages.forEach((p, idx) => {
        console.log(`    pkg[${idx}] ${p.id} | type=${p.type} | hours=${p.hours} | used=${p.hoursUsed} | remaining=${p.hoursRemaining} | status=${p.status}`);
      });
    }
    console.log(`  renewalHistory count:       ${r.renewalHistoryCount}, sum=${r.renewalSum}h`);
    console.log(`  renewal dates:              ${(r.renewalDates || []).join(', ')}`);
    console.log(`  active pkg (current logic): ${r.activePkgId} status=${r.activePkgStatus} remaining=${r.activePkgHoursRemaining}`);
    console.log(`  timesheet entries total:    ${r.totalEntries} (${r.totalEntryHours}h)`);
    console.log(`  orphan entries (no pkgId):  ${r.orphanCount} (${r.orphanHours}h)`);
    if (r.sampleOrphans && r.sampleOrphans.length > 0) {
      r.sampleOrphans.forEach(o => console.log(`    sample orphan: ${o.id} | ${o.minutes}min | date=${o.date}`));
    }
  });

  // Aggregate
  const goCount = results.filter(r => r.status === 'GO').length;
  const stopCount = results.filter(r => r.status === 'STOP').length;
  const totalOrphans = results.reduce((s, r) => s + (r.orphanCount || 0), 0);
  const totalOrphanHours = round2(results.reduce((s, r) => s + (r.orphanHours || 0), 0));

  console.log('\n' + '═'.repeat(80));
  console.log('AGGREGATE');
  console.log('═'.repeat(80));
  console.log(`GO:   ${goCount}/${results.length}`);
  console.log(`STOP: ${stopCount}/${results.length}`);
  console.log(`Total orphan entries across all targets: ${totalOrphans} (${totalOrphanHours}h)`);

  if (totalOrphans > 0) {
    console.log('\n⚠️  Orphans detected — must be backfilled during migration.');
    console.log('   Recommendation: assign orphans to the EXISTING (initial/depleted) package,');
    console.log('   since those entries consumed hours BEFORE the missing renewal would have applied.');
  }

  if (stopCount > 0) {
    console.log('\n❌ Some targets STOP — investigate before migration.');
  } else {
    console.log('\n✅ All targets GO. Migration script can be designed against this data.');
  }

  process.exit(0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });