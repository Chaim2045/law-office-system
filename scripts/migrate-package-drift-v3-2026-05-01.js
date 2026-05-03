/**
 * Migration v3: add missing renewal packages to 7 drifted services.
 *
 * Default DRY-RUN. Pass --execute to write.
 * Optional --target=<caseNumber> to migrate single target.
 *
 * v3 changes from v2 (per devil's advocate + review-strict):
 *   1. Date normalization with type guard (handles Date, Timestamp, string).
 *   2. Sort packages by activity rank — overdraft/active first, depleted last.
 *      Ensures getActivePackage picks the still-eligible package.
 *   3. Tx-level concurrent write detection — assert packages.length unchanged.
 *   4. Orphan post-renewal entries → LAST renewal (still active/overdraft),
 *      not first (which may be depleted after cascade).
 *   5. Tolerance bumped 0.02 → 0.05 for accumulated rounding error.
 *   6. Snapshot mechanism — backup full client doc to migration_backup_2026_05_01.
 *   7. Pre-check: refuse migration if client has non-fixed legal_procedure services
 *      (to avoid breaking client aggregates).
 *
 * Excluded: 2026008 (91h additional drift beyond missing package).
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const { calcClientAggregates, round2 } = require('../functions/src/modules/aggregation');
const { isFixedService } = require('../functions/shared/aggregates');

const EXECUTE = process.argv.includes('--execute');
const TARGET_FLAG = process.argv.find(a => a.startsWith('--target='));
const SINGLE_TARGET = TARGET_FLAG ? TARGET_FLAG.split('=')[1] : null;

const TOLERANCE = 0.05; // bumped from 0.02
const SCRIPT_NAME = 'migrate-package-drift-v3-2026-05-01';
const ACTOR = 'system-migration-2026-05-01';
const BACKUP_COLLECTION = 'migration_backup_2026_05_01';

const TARGETS = [
  { caseNumber: '2025306', serviceId: 'srv_1766393421154', expectedDelta: 30 },
  { caseNumber: '2025011', serviceId: 'srv_1766574628760', expectedDelta: 25 },
  { caseNumber: '2025002', serviceId: 'srv_1764868231167', expectedDelta: 22.3 },
  { caseNumber: '2025002', serviceId: 'srv_1766504727174', expectedDelta: 21 },
  { caseNumber: '2025333', serviceId: 'srv_1766331553598', expectedDelta: 20 },
  { caseNumber: '2026045', serviceId: 'srv_1771499755064', expectedDelta: 20 },
  { caseNumber: '20251000', serviceId: 'srv_1766330741925', expectedDelta: 15 }
];

/* ─── helpers ─────────────────────────────────────────────────────────── */

function makeMigrationId(caseNumber, serviceId, sourceRef, sourceDate) {
  return crypto.createHash('sha1')
    .update(`${SCRIPT_NAME}|${caseNumber}|${serviceId}|${sourceRef}|${sourceDate}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * v3 fix #1: Date type guard.
 * Coerces Firestore Timestamp, JS Date, or ISO string to ISO string.
 * Returns null if not parseable.
 */
function toIsoString(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch (e) {
      return null;
    }
  }
  // Firestore Timestamp may be plain object { _seconds, _nanoseconds }
  if (typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000 + (val._nanoseconds || 0) / 1e6).toISOString();
  }
  return null;
}

function deriveStatus(pkg) {
  const cap = pkg.hours || 0;
  const used = pkg.hoursUsed || 0;
  if (used > cap) return 'overdraft';
  if (used === cap && cap > 0) return 'depleted';
  return 'active';
}

/**
 * v3 fix #2: Activity rank for sort.
 * Lower rank = earlier in array = picked first by getActivePackage.
 *   0 = active with positive remaining (truly available)
 *   1 = overdraft (still eligible per filter, hoursRemaining > -10)
 *   2 = depleted (rem == 0)
 *   3 = exhausted (rem <= -10, excluded by filter anyway)
 */
function packageActivityRank(pkg) {
  const remaining = pkg.hoursRemaining || 0;
  const status = pkg.status;
  if (remaining > 0) return 0;
  if (status === 'overdraft' || (remaining > -10 && remaining < 0)) return 1;
  if (remaining === 0) return 2;
  return 3;
}

function makeRenewalPackage({ caseNumber, serviceId, renewalRecord, idx }) {
  const hours = renewalRecord.hours || 0;
  const date = renewalRecord.date;
  const sourceRef = `renewalHistory[${idx}]`;
  const migrationId = makeMigrationId(caseNumber, serviceId, sourceRef, date);
  return {
    id: `pkg_mig_${migrationId}`,
    type: 'renewal',
    hours,
    hoursUsed: 0,
    hoursRemaining: hours,
    status: 'active',
    purchaseDate: date,
    description: 'חידוש שעות',
    source: SCRIPT_NAME,
    sourceRef,
    sourceDate: date,
    migrationId,
    addedBy: renewalRecord.addedBy || 'admin'
  };
}

/* ─── core compute ────────────────────────────────────────────────────── */

function computeNewPackages(svc, target) {
  const oldPackages = Array.isArray(svc.packages) ? [...svc.packages] : [];
  const renewalHistory = svc.renewalHistory || [];

  // total overdraft from ALL old packages
  const totalOverdraft = round2(oldPackages.reduce((s, p) => {
    const cap = p.hours || 0;
    const used = p.hoursUsed || 0;
    return s + Math.max(0, used - cap);
  }, 0));

  // dedup by migrationId (stable hash)
  const existingMigrationIds = new Set(
    oldPackages.filter(p => p.migrationId).map(p => p.migrationId)
  );
  const renewalsToAdd = renewalHistory.filter((r, i) => {
    const sourceRef = `renewalHistory[${i}]`;
    const mid = makeMigrationId(target.caseNumber, target.serviceId, sourceRef, r.date);
    return !existingMigrationIds.has(mid);
  });

  if (renewalsToAdd.length === 0) {
    throw new Error('No renewal records to add — all already migrated');
  }

  // sort by date ascending
  renewalsToAdd.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const indexedRenewals = renewalsToAdd.map(r => ({ rec: r, origIdx: renewalHistory.indexOf(r) }));

  let newRenewalPackages = indexedRenewals.map(({ rec, origIdx }) =>
    makeRenewalPackage({
      caseNumber: target.caseNumber,
      serviceId: target.serviceId,
      renewalRecord: rec,
      idx: origIdx
    })
  );

  // cascade overdraft chronologically
  let remainingOverdraft = totalOverdraft;
  newRenewalPackages = newRenewalPackages.map(pkg => {
    if (remainingOverdraft <= 0) return pkg;
    const cap = pkg.hours || 0;
    const absorb = Math.min(cap, remainingOverdraft);
    const newUsed = round2(absorb);
    const newRemaining = round2(cap - newUsed);
    remainingOverdraft = round2(remainingOverdraft - absorb);
    const updated = { ...pkg, hoursUsed: newUsed, hoursRemaining: newRemaining };
    updated.status = deriveStatus(updated);
    return updated;
  });

  // tail: any leftover overdraft → last renewal
  if (remainingOverdraft > 0) {
    const last = newRenewalPackages[newRenewalPackages.length - 1];
    last.hoursUsed = round2((last.hoursUsed || 0) + remainingOverdraft);
    last.hoursRemaining = round2((last.hours || 0) - last.hoursUsed);
    last.status = deriveStatus(last);
  }

  // normalize all old packages: hoursUsed = hours, depleted
  const normalizedOldPackages = oldPackages.map(p => ({
    ...p,
    hoursUsed: round2(p.hours || 0),
    hoursRemaining: 0,
    status: 'depleted',
    _migrationNote: `Normalized by ${SCRIPT_NAME}: original hoursUsed=${p.hoursUsed}, overdraft transferred to renewal`,
    _migratedBy: SCRIPT_NAME,
    _originalHoursUsed: p.hoursUsed // forensic preservation (per devil's review B)
  }));

  // v3 fix #2: sort final array by activity rank
  // Result: still-eligible (overdraft/active with hours) first, depleted last.
  // Ensures getActivePackage picks correctly even after cascade.
  const allPackages = [...newRenewalPackages, ...normalizedOldPackages];
  allPackages.sort((a, b) => packageActivityRank(a) - packageActivityRank(b));

  // identify last active renewal for orphan backfill
  const lastActiveRenewal = [...newRenewalPackages].reverse().find(
    p => p.status === 'active' || p.status === 'overdraft'
  ) || newRenewalPackages[newRenewalPackages.length - 1];

  // invariant: sum hoursUsed == old service.hoursUsed
  const newSumHoursUsed = round2(allPackages.reduce((s, p) => s + (p.hoursUsed || 0), 0));
  const oldServiceHoursUsed = round2(svc.hoursUsed || 0);

  return {
    newPackages: allPackages,
    totalOverdraft,
    newRenewalPackages,
    normalizedOldPackages,
    lastActiveRenewal,
    newSumHoursUsed,
    oldServiceHoursUsed,
    invariantHoldsHoursUsed: Math.abs(newSumHoursUsed - oldServiceHoursUsed) <= TOLERANCE
  };
}

/* ─── per-target migration ────────────────────────────────────────────── */

async function migrateOne(target) {
  const log = (msg) => console.log(`  ${msg}`);
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`▶  ${target.caseNumber} | service ${target.serviceId}`);
  console.log('═'.repeat(80));

  const cs = await db.collection('clients').where('caseNumber', '==', target.caseNumber).get();
  if (cs.empty) return { ...target, status: 'STOP', reason: 'client not found' };
  const clientRef = cs.docs[0].ref;
  const clientId = cs.docs[0].id;

  const beforeSnap = (await clientRef.get()).data();
  const beforeServices = Array.isArray(beforeSnap.services) ? beforeSnap.services : [];

  // v3 fix #7: pre-check — refuse if client has non-fixed legal_procedure
  // (would change semantics of calcClientAggregates).
  const nonFixedLegalProc = beforeServices.find(s =>
    (s.type === 'legal_procedure' || s.serviceType === 'legal_procedure') && !isFixedService(s)
  );
  if (nonFixedLegalProc) {
    return {
      ...target,
      status: 'STOP',
      reason: `client has non-fixed legal_procedure service (${nonFixedLegalProc.id}) — migration excluded for safety`
    };
  }

  const svcIndex = beforeServices.findIndex(s => s.id === target.serviceId);
  if (svcIndex === -1) return { ...target, status: 'STOP', reason: 'service not found' };
  const beforeSvc = beforeServices[svcIndex];

  log(`client doc:           ${clientId} (${beforeSnap.fullName || beforeSnap.clientName})`);
  log(`service before:`);
  log(`  totalHours:         ${beforeSvc.totalHours}`);
  log(`  hoursUsed:          ${beforeSvc.hoursUsed}`);
  log(`  hoursRemaining:     ${beforeSvc.hoursRemaining}`);
  log(`  packages count:     ${(beforeSvc.packages || []).length}`);

  let computed;
  try {
    computed = computeNewPackages(beforeSvc, target);
  } catch (e) {
    return { ...target, status: 'STOP', reason: 'compute failed: ' + e.message };
  }

  log(`total overdraft transferred: ${computed.totalOverdraft}h`);
  log(`renewal packages added: ${computed.newRenewalPackages.length}`);
  computed.newRenewalPackages.forEach((p, i) => {
    log(`  renewal[${i}]: id=${p.id} hours=${p.hours} used=${p.hoursUsed} rem=${p.hoursRemaining} status=${p.status}`);
  });
  log(`final array order (by activity rank):`);
  computed.newPackages.forEach((p, i) => {
    log(`  [${i}] ${p.id} type=${p.type} status=${p.status} rem=${p.hoursRemaining} (rank=${packageActivityRank(p)})`);
  });
  log(`last active renewal (orphan backfill target post-renewal): ${computed.lastActiveRenewal.id}`);
  log(`packages invariant (sum hoursUsed = old service.hoursUsed): ${computed.invariantHoldsHoursUsed ? '✅' : '❌'}`);
  log(`  new sum: ${computed.newSumHoursUsed}, old service: ${computed.oldServiceHoursUsed}`);

  if (!computed.invariantHoldsHoursUsed) {
    return { ...target, status: 'STOP', reason: 'invariant fail' };
  }

  const totalHoursVal = round2(beforeSvc.totalHours || 0);
  const newSvcHoursUsed = computed.newSumHoursUsed;
  const newSvcHoursRemaining = round2(totalHoursVal - newSvcHoursUsed);
  const newSvc = {
    ...beforeSvc,
    packages: computed.newPackages,
    hoursUsed: newSvcHoursUsed,
    hoursRemaining: newSvcHoursRemaining
  };
  const newServices = beforeServices.slice();
  newServices[svcIndex] = newSvc;

  const clientTotalHours = round2(newServices.reduce((sum, s) => sum + (s.totalHours || 0), 0));
  const newClientAgg = calcClientAggregates(newServices, clientTotalHours);

  log(`service after: hoursUsed=${newSvc.hoursUsed} hoursRemaining=${newSvc.hoursRemaining} packages=${newSvc.packages.length}`);
  log(`client aggregates: total=${clientTotalHours} used=${newClientAgg.hoursUsed} rem=${newClientAgg.hoursRemaining} blocked=${newClientAgg.isBlocked} critical=${newClientAgg.isCritical}`);

  // orphan backfill assignment with v3 fixes (#1 date, #4 last renewal)
  const renewalDates = (beforeSvc.renewalHistory || [])
    .map(r => toIsoString(r.date))
    .filter(Boolean)
    .sort();
  const earliestRenewalDate = renewalDates[0];

  const initialPkg = computed.normalizedOldPackages.find(p => p.type === 'initial')
    || computed.normalizedOldPackages[0];
  const lastRenewal = computed.lastActiveRenewal;

  const orphanQuery = await db.collection('timesheet_entries')
    .where('clientId', '==', clientId)
    .where('serviceId', '==', target.serviceId)
    .get();
  const orphanAssignments = [];
  orphanQuery.forEach(d => {
    const e = d.data();
    if (e.packageId) return;
    const entryDate = toIsoString(e.date) || toIsoString(e.createdAt);
    let assignTo;
    if (!entryDate || !earliestRenewalDate) {
      assignTo = initialPkg.id;
    } else if (entryDate < earliestRenewalDate) {
      assignTo = initialPkg.id;
    } else {
      assignTo = lastRenewal.id; // v3 fix #4: last active renewal
    }
    orphanAssignments.push({ ref: d.ref, packageId: assignTo, entryDate });
  });
  const initialBackfillCount = orphanAssignments.filter(o => o.packageId === initialPkg.id).length;
  const renewalBackfillCount = orphanAssignments.filter(o => o.packageId === lastRenewal.id).length;
  log(`orphan entries to backfill: ${orphanAssignments.length}`);
  log(`  → initial pkg (${initialPkg.id}): ${initialBackfillCount}`);
  log(`  → last renewal (${lastRenewal.id}): ${renewalBackfillCount}`);

  if (!EXECUTE) {
    log('🟢 DRY-RUN — no writes performed.');
    return {
      ...target,
      status: 'DRY_OK',
      plan: {
        addedPackageIds: computed.newRenewalPackages.map(p => p.id),
        orphanCount: orphanAssignments.length,
        finalArrayOrder: computed.newPackages.map(p => `${p.id}(${p.status})`)
      }
    };
  }

  // ─── EXECUTE ───
  log('🔴 EXECUTE — writing...');

  // v3 fix #6: snapshot full client doc to backup collection BEFORE any write
  const backupRef = db.collection(BACKUP_COLLECTION).doc(`${target.caseNumber}_${target.serviceId}_${Date.now()}`);
  await backupRef.set({
    snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
    script: SCRIPT_NAME,
    target,
    fullClientDoc: beforeSnap,
    note: 'Full client doc snapshot before migration. Use for rollback.'
  });
  log(`  📦 backup snapshot: ${BACKUP_COLLECTION}/${backupRef.id}`);

  // INTENT audit
  const intentRef = db.collection('audit_log').doc();
  await intentRef.set({
    action: 'MIGRATION_ADD_MISSING_PACKAGE_v3',
    phase: 'INTENT',
    userId: ACTOR,
    username: ACTOR,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    details: {
      caseNumber: target.caseNumber,
      clientId,
      serviceId: target.serviceId,
      script: SCRIPT_NAME,
      addedPackageIds: computed.newRenewalPackages.map(p => p.id),
      totalOverdraftTransferred: computed.totalOverdraft,
      orphanBackfillPlan: { initial: initialBackfillCount, renewal: renewalBackfillCount },
      backupRef: backupRef.path,
      finalArrayOrder: computed.newPackages.map(p => p.id)
    }
  });
  log(`  audit INTENT: ${intentRef.id}`);

  let txnError = null;
  let inTxResult = null;
  try {
    inTxResult = await db.runTransaction(async txn => {
      const fresh = await txn.get(clientRef);
      const freshSvcs = (fresh.data().services || []);
      const freshIdx = freshSvcs.findIndex(s => s.id === target.serviceId);
      if (freshIdx === -1) throw new Error('service vanished');
      const freshSvc = freshSvcs[freshIdx];

      // v3 fix #3: concurrent write detection
      const beforePkgCount = (beforeSvc.packages || []).length;
      const freshPkgCount = (freshSvc.packages || []).length;
      if (freshPkgCount !== beforePkgCount) {
        throw new Error(`Concurrent change detected: packages.length changed from ${beforePkgCount} to ${freshPkgCount}`);
      }
      // also detect renewalHistory change
      const beforeRenewalCount = (beforeSvc.renewalHistory || []).length;
      const freshRenewalCount = (freshSvc.renewalHistory || []).length;
      if (freshRenewalCount !== beforeRenewalCount) {
        throw new Error(`Concurrent change: renewalHistory.length changed ${beforeRenewalCount}→${freshRenewalCount}`);
      }

      const recomputed = computeNewPackages(freshSvc, target);
      if (!recomputed.invariantHoldsHoursUsed) {
        throw new Error('invariant violated on fresh read');
      }

      const finalTotal = round2(freshSvc.totalHours || 0);
      const finalSvcHoursUsed = recomputed.newSumHoursUsed;
      const finalSvcHoursRemaining = round2(finalTotal - finalSvcHoursUsed);
      const finalSvc = {
        ...freshSvc,
        packages: recomputed.newPackages,
        hoursUsed: finalSvcHoursUsed,
        hoursRemaining: finalSvcHoursRemaining
      };
      const finalSvcs = freshSvcs.slice();
      finalSvcs[freshIdx] = finalSvc;

      const finalClientTotal = round2(finalSvcs.reduce((sum, s) => sum + (s.totalHours || 0), 0));
      const finalClientAgg = calcClientAggregates(finalSvcs, finalClientTotal);

      txn.update(clientRef, {
        services: finalSvcs,
        totalHours: finalClientTotal,
        hoursUsed: finalClientAgg.hoursUsed,
        hoursRemaining: finalClientAgg.hoursRemaining,
        minutesUsed: finalClientAgg.minutesUsed,
        minutesRemaining: finalClientAgg.minutesRemaining,
        isBlocked: finalClientAgg.isBlocked,
        isCritical: finalClientAgg.isCritical,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: ACTOR,
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        addedPackageIds: recomputed.newRenewalPackages.map(p => p.id),
        totalOverdraftTransferred: recomputed.totalOverdraft,
        finalSvcHoursUsed,
        finalSvcHoursRemaining,
        finalClientAgg
      };
    });
    log(`  ✅ transaction committed`);
  } catch (e) {
    txnError = e;
    log(`  ❌ transaction failed: ${e.message}`);
  }

  // orphan backfill (post-tx, batch)
  let backfilledCount = 0;
  if (!txnError && orphanAssignments.length > 0) {
    for (let i = 0; i < orphanAssignments.length; i += 500) {
      const chunk = orphanAssignments.slice(i, i + 500);
      const batch = db.batch();
      chunk.forEach(o => batch.update(o.ref, {
        packageId: o.packageId,
        _migratedBy: SCRIPT_NAME
      }));
      await batch.commit();
      backfilledCount += chunk.length;
    }
    log(`  ✅ orphans backfilled: ${backfilledCount}`);
  }

  // RESULT audit (in-tx values, not intent values)
  const resultRef = db.collection('audit_log').doc();
  await resultRef.set({
    action: 'MIGRATION_ADD_MISSING_PACKAGE_v3',
    phase: 'RESULT',
    userId: ACTOR,
    username: ACTOR,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    details: {
      caseNumber: target.caseNumber,
      clientId,
      serviceId: target.serviceId,
      script: SCRIPT_NAME,
      success: !txnError,
      error: txnError?.message || null,
      intentAuditId: intentRef.id,
      backupRef: backupRef.path,
      orphanBackfilledCount: backfilledCount,
      inTxResult: inTxResult || null
    }
  });
  log(`  audit RESULT: ${resultRef.id}`);

  return {
    ...target,
    status: txnError ? 'ERROR' : 'DONE',
    error: txnError?.message,
    intentAuditId: intentRef.id,
    resultAuditId: resultRef.id,
    backupPath: backupRef.path
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔧 PACKAGE-DRIFT MIGRATION v3');
  console.log(`Mode:    ${EXECUTE ? '🔴 EXECUTE' : '🟢 DRY-RUN'}`);
  console.log(`Target:  ${SINGLE_TARGET || 'ALL'}`);
  console.log(`Script:  ${SCRIPT_NAME}`);
  console.log('═'.repeat(80));

  const targetsToRun = SINGLE_TARGET
    ? TARGETS.filter(t => `${t.caseNumber}:${t.serviceId}` === SINGLE_TARGET || t.caseNumber === SINGLE_TARGET)
    : TARGETS;

  if (targetsToRun.length === 0) {
    console.log(`❌ No matching target for "${SINGLE_TARGET}"`);
    process.exit(1);
  }

  console.log(`Running ${targetsToRun.length} target(s)\n`);

  const results = [];
  for (const t of targetsToRun) {
    const r = await migrateOne(t);
    results.push(r);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('FINAL REPORT');
  console.log('═'.repeat(80));

  const counts = {};
  results.forEach(r => {
    counts[r.status] = (counts[r.status] || 0) + 1;
    console.log(`  ${r.status.padEnd(8)} ${r.caseNumber} ${r.serviceId} ${r.error || r.reason || ''}`);
  });

  console.log('\nCounts:', counts);
  if (!EXECUTE) {
    console.log('\n🟢 DRY-RUN complete. Review final array orders carefully.');
    console.log('   Then run: --target=<caseNum> --execute (single client first).');
  } else {
    if (counts.ERROR > 0) {
      console.log('\n❌ Errors detected. Review audit_log + backup collection.');
    } else {
      console.log('\n✅ All targets migrated. Run validate-strict before declaring done.');
    }
  }
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});