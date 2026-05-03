/**
 * Investigation — case 2025306 (בן ניסן) — backend rejects hours despite admin showing available.
 * READ ONLY. No writes.
 *
 * Goals:
 * 1. Locate client doc by fileNumber/caseNumber.
 * 2. Print every service: type, pricingType, packages[], stages[], overrideActive.
 * 3. For each package: hoursRemaining, hoursUsed, status. Compute afterDeduction at -10h gate.
 * 4. Show overrideActive status (controls bypass of -10h floor).
 * 5. Cross-check: sum of timesheet_entries minutes vs hoursUsed in package.
 * 6. Identify which path the backend takes for new hours entry (active package vs fallback).
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CASE = '2025306';

function fmt(v) {
  if (v === undefined) return '<undefined>';
  if (v === null) return '<null>';
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function pad(label, val, width = 22) {
  return `${label.padEnd(width)} ${fmt(val)}`;
}

async function findClient() {
  console.log('═'.repeat(80));
  console.log(`🔍 Locating client for case ${CASE}`);
  console.log('═'.repeat(80));

  const queries = [
    ['fileNumber', CASE],
    ['fileNumber', Number(CASE)],
    ['caseNumber', CASE],
    ['caseNumber', Number(CASE)]
  ];

  for (const [field, val] of queries) {
    const snap = await db.collection('clients').where(field, '==', val).get();
    if (!snap.empty) {
      console.log(`✅ Found via ${field}=${val}: ${snap.size} doc(s)`);
      return snap.docs;
    }
  }

  console.log('❌ Client not found');
  return [];
}

function dumpPackage(pkg, idx, prefix = '    ') {
  console.log(`${prefix}package[${idx}] (id=${pkg.id})`);
  console.log(`${prefix}  ${pad('status:', pkg.status, 18)}`);
  console.log(`${prefix}  ${pad('hoursTotal:', pkg.hoursTotal, 18)}`);
  console.log(`${prefix}  ${pad('hoursUsed:', pkg.hoursUsed, 18)}`);
  console.log(`${prefix}  ${pad('hoursRemaining:', pkg.hoursRemaining, 18)}`);
  console.log(`${prefix}  ${pad('createdAt:', pkg.createdAt, 18)}`);
  console.log(`${prefix}  ${pad('depleted/closed?', pkg.depleted ?? pkg.closed, 18)}`);
}

function dumpService(svc, idx) {
  console.log(`\n  ───── service[${idx}] (id=${svc.id}) ─────`);
  console.log(`  ${pad('type:', svc.type)}`);
  console.log(`  ${pad('pricingType:', svc.pricingType)}`);
  console.log(`  ${pad('serviceName:', svc.serviceName || svc.name)}`);
  console.log(`  ${pad('overrideActive:', svc.overrideActive)}`);
  console.log(`  ${pad('hoursTotal:', svc.hoursTotal)}`);
  console.log(`  ${pad('hoursUsed:', svc.hoursUsed)}`);
  console.log(`  ${pad('hoursRemaining:', svc.hoursRemaining)}`);
  console.log(`  ${pad('currentStage:', svc.currentStage)}`);

  // Service-level packages (hourly type)
  if (Array.isArray(svc.packages) && svc.packages.length > 0) {
    console.log(`\n  packages (service-level): ${svc.packages.length}`);
    svc.packages.forEach((p, i) => dumpPackage(p, i));
  }

  // Stages (legal_procedure)
  if (Array.isArray(svc.stages) && svc.stages.length > 0) {
    console.log(`\n  stages: ${svc.stages.length}`);
    svc.stages.forEach((stage, sidx) => {
      console.log(`    ┌─── stage[${sidx}] id=${stage.id} ───`);
      console.log(`    │ ${pad('name:', stage.name)}`);
      console.log(`    │ ${pad('pricingType:', stage.pricingType)}`);
      console.log(`    │ ${pad('hoursTotal:', stage.hoursTotal)}`);
      console.log(`    │ ${pad('hoursUsed:', stage.hoursUsed)}`);
      console.log(`    │ ${pad('hoursRemaining:', stage.hoursRemaining)}`);
      if (Array.isArray(stage.packages) && stage.packages.length > 0) {
        console.log(`    │ stage.packages: ${stage.packages.length}`);
        stage.packages.forEach((p, pi) => dumpPackage(p, pi, '    │   '));
      }
      console.log(`    └───`);
    });
  }
}

function analyzeGuard(client) {
  console.log('\n' + '═'.repeat(80));
  console.log('🛡️  -10h GUARD ANALYSIS');
  console.log('═'.repeat(80));
  console.log('Backend logic (functions/timesheet/index.js):');
  console.log('  1. activePackage = DeductionSystem.getActivePackage(service, true, hasOverride)');
  console.log('  2. afterDeduction = activePackage.hoursRemaining - hoursWorked');
  console.log('  3. if afterDeduction < -10 && !hasOverride → throw ERR-1001');
  console.log('  4. else fallback: find first eligible package (hoursRemaining > -10)');
  console.log('  5. if all packages exhausted → use last package, check -10 again → ERR-1002');
  console.log('');

  const services = Array.isArray(client.services) ? client.services : [];
  if (services.length === 0) {
    console.log('⚠️  No services array — entries get counted at service-level only');
    return;
  }

  services.forEach((svc, idx) => {
    console.log(`\n📊 service[${idx}] gate analysis:`);
    console.log(`   overrideActive: ${svc.overrideActive ? 'TRUE — bypasses guard' : 'FALSE — guard ENFORCED'}`);

    const pkgs = svc.packages || [];
    const eligible = pkgs.filter(p => {
      const status = p.status || 'active';
      return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
        && (svc.overrideActive || (p.hoursRemaining || 0) > -10);
    });

    console.log(`   eligible packages (>−10h or override): ${eligible.length}/${pkgs.length}`);
    if (eligible.length === 0 && pkgs.length > 0) {
      const last = pkgs[pkgs.length - 1];
      console.log(`   ❌ ALL packages exhausted — last package: hoursRemaining=${last.hoursRemaining}`);
      console.log(`      Backend will hit "fallback to last" branch → ERR-1002 if -10 floor still violated`);
    } else if (eligible.length > 0) {
      eligible.forEach((p, i) => {
        console.log(`   ✅ eligible[${i}] id=${p.id} status=${p.status} remaining=${p.hoursRemaining}`);
        const margin = (p.hoursRemaining || 0) + 10;
        console.log(`      max hoursWorked allowed before ERR-1001: ${margin.toFixed(2)}h`);
      });
    }
  });
}

async function main() {
  const docs = await findClient();
  if (docs.length === 0) {
    process.exit(1);
  }

  for (const doc of docs) {
    const client = doc.data();
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 CLIENT DOC: ${doc.id}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`  ${pad('fullName:', client.fullName)}`);
    console.log(`  ${pad('clientName:', client.clientName)}`);
    console.log(`  ${pad('fileNumber:', client.fileNumber)}`);
    console.log(`  ${pad('caseNumber:', client.caseNumber)}`);
    console.log(`  ${pad('status:', client.status)}`);
    console.log(`  ${pad('type:', client.type)}`);
    console.log(`  ${pad('hoursRemaining (top):', client.hoursRemaining)}`);
    console.log(`  ${pad('overrideActive (top):', client.overrideActive)}`);

    const services = Array.isArray(client.services) ? client.services : [];
    console.log(`\n  services count: ${services.length}`);
    services.forEach((svc, i) => dumpService(svc, i));

    analyzeGuard({ services });
  }

  process.exit(0);
}

main().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
