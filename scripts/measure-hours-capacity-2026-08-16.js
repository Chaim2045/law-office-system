/**
 * MEASUREMENT SCRIPT — hours capacity definition (the phantom-capacity baseline).
 *
 * PR-0 of docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md.
 *
 * READ-ONLY BY CONSTRUCTION. This script has no write path at all — no
 * `--confirm`, no `--apply`, no `transaction`, no `.set`/`.update`/`.delete`.
 * It cannot mutate production even by mistake. That is deliberate: it freezes
 * the baseline that every later PR is measured against, so it must be safe to
 * run at any time, by anyone, without a quiet window.
 *
 * WHAT IT MEASURES
 *
 *   contractHours      Σ svc.totalHours over billable non-archived services
 *                      — exactly today's server rule (client-writer.js:86-95).
 *   activeHours        the proposed rule: for a legal_procedure+hourly service
 *                      with stages, Σ totalHours over ACTIVE stages only, and
 *                      only while the service still accepts hours; for every
 *                      other billable shape, svc.totalHours unchanged.
 *   unknownStatusHours stage capacity carrying no status — counted in NEITHER
 *                      bucket. Deliberately not defaulted (devils-advocate
 *                      attack 2): the admin screen already uses strict
 *                      === 'active', so defaulting to active would bias the
 *                      phantom measurement downward.
 *   phantomHours       contractHours − activeHours − unknownStatusHours
 *
 * THREE GATING PROBES (§8.0 of the plan)
 *
 *   A  stages with no `status` field           → is unknownStatusHours real?
 *   B  clients holding TWO legal_procedure     → addHoursPackageToStage locates
 *      services                                  its target with findIndex on
 *                                                type alone (services/index.js:724),
 *                                                ignoring serviceId. If B > 0,
 *                                                hours have been landing on the
 *                                                wrong matter — a live money bug
 *                                                that outranks this whole plan.
 *                                                Same first-match class as #544.
 *   C  legal_procedure+hourly services whose   → separates pre-existing drift
 *      svc.totalHours already diverges from      from drift this change would
 *      Σ its stages (tolerance 0.05)             introduce.
 *
 * Usage:
 *   node scripts/measure-hours-capacity-2026-08-16.js
 *   node scripts/measure-hours-capacity-2026-08-16.js --case=2025897
 *
 * Emits: scripts/.capacity-baseline-<ISO>.json  (gitignored, like the
 *        repair-report pattern in functions/scripts/repair-package-aggregates.js)
 *
 * Project: law-office-system-e4801 (production, read-only).
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const { NON_AGGREGATING_STATUSES } = require('../functions/shared/aggregates');
const { isFixedService } = require('../functions/shared/business-rules/service-classification');
const { HOURS_LOCKED_STATUSES } = require('../functions/shared/service-status');
const { SYSTEM_CONSTANTS } = require('../functions/shared/constants');

const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// Divergence tolerance — the engine's SSOT value, not a fresh number.
const TOLERANCE = 0.05;

const args = process.argv.slice(2);
const targetCaseArg = args.find(a => a.startsWith('--case='));
const TARGET_CASE = targetCaseArg ? targetCaseArg.split('=')[1] : null;

function log(msg, ...rest) {
  console.log(`[${new Date().toISOString()}] ${msg}`, ...rest);
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/** Finite-or-null. Never NaN, never undefined — mirrors client-plan.ts. */
function finiteNum(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ===== Firebase Admin init (ADC, read-only usage) =====
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'law-office-system-e4801',
    credential: admin.credential.applicationDefault()
  });
}
const db = admin.firestore();

/** Today's server rule — mirrors client-writer.js recomputeTotalHours. */
function isBillable(svc) {
  if (!svc) return false;
  if (NON_AGGREGATING_STATUSES.includes(svc.status || 'active')) return false;
  if (svc.type === ST.FIXED) return false;
  if (svc.type === ST.LEGAL_PROCEDURE && svc.pricingType === PT.FIXED) return false;
  return true;
}

/** Does this service still admit hours? Mirrors serviceAcceptsHours. */
function acceptsHours(svc) {
  return !HOURS_LOCKED_STATUSES.includes(svc?.status || 'active');
}

/** A staged hourly service is the only shape where the new rule differs. */
function isStagedHourly(svc) {
  return svc
    && svc.type === ST.LEGAL_PROCEDURE
    && svc.pricingType !== PT.FIXED
    && Array.isArray(svc.stages)
    && svc.stages.length > 0;
}

/**
 * Split one service's capacity into the three buckets.
 * Total by construction — a malformed stage degrades a bucket, never throws.
 */
function splitServiceCapacity(svc) {
  const contract = finiteNum(svc?.totalHours) ?? 0;

  if (!isStagedHourly(svc)) {
    // No stages to reason about — the new rule leaves these untouched.
    return { contract, active: contract, unknown: 0, unknownStages: 0 };
  }

  if (!acceptsHours(svc)) {
    // Service is completed/archived: it holds no available capacity, even if a
    // stage is still flagged active (stage C is never marked completed by any
    // code path — services/index.js:1105-1110).
    return { contract, active: 0, unknown: 0, unknownStages: 0 };
  }

  let active = 0;
  let unknown = 0;
  let unknownStages = 0;

  for (const stage of svc.stages) {
    if (!stage || typeof stage !== 'object') continue;
    const hours = finiteNum(stage.totalHours) ?? 0;
    const status = stage.status;

    if (status === undefined || status === null || status === '') {
      unknown += hours;
      unknownStages += 1;
    } else if (status === 'active') {
      active += hours;
    }
    // 'pending' and 'completed' fall through — counted in neither.
  }

  return { contract, active, unknown, unknownStages };
}

/** Probe C — does svc.totalHours already disagree with Σ its stages? */
function stageSumDivergence(svc) {
  if (!isStagedHourly(svc)) return null;
  const sum = svc.stages.reduce((s, st) => s + (finiteNum(st?.totalHours) ?? 0), 0);
  const stored = finiteNum(svc.totalHours) ?? 0;
  const delta = round2(stored - sum);
  return Math.abs(delta) > TOLERANCE
    ? { serviceId: svc.id || null, serviceName: svc.name || null, stored: round2(stored), stageSum: round2(sum), delta }
    : null;
}

async function main() {
  log('READ-ONLY measurement. This script has no write path.');

  let query = db.collection('clients');
  const snap = TARGET_CASE
    ? await query.where('caseNumber', '==', TARGET_CASE).get()
    : await query.get();

  log(`clients read: ${snap.size}`);

  const clients = [];
  const probeA = { stagesWithoutStatus: 0, hoursAffected: 0, samples: [] };
  const probeB = { clientsWithMultipleLegalProcedures: 0, samples: [] };
  const probeC = { servicesDiverging: 0, samples: [] };

  const office = { contractHours: 0, activeHours: 0, phantomHours: 0, unknownStatusHours: 0 };

  snap.forEach(doc => {
    const c = doc.data() || {};
    const services = Array.isArray(c.services) ? c.services.filter(Boolean) : [];
    const caseNumber = c.caseNumber || doc.id;

    let contract = 0, active = 0, unknown = 0, unknownStages = 0;

    // --- Probe B: two legal_procedure services on one client ---
    const lpServices = services.filter(s => s && s.type === ST.LEGAL_PROCEDURE);
    if (lpServices.length > 1) {
      probeB.clientsWithMultipleLegalProcedures += 1;
      probeB.samples.push({
        caseNumber,
        count: lpServices.length,
        services: lpServices.map(s => ({
          id: s.id || null,
          name: s.name || null,
          pricingType: s.pricingType || null,
          stageIds: Array.isArray(s.stages) ? s.stages.map(st => st?.id || null) : []
        }))
      });
    }

    for (const svc of services) {
      if (!isBillable(svc)) continue;

      const split = splitServiceCapacity(svc);
      contract += split.contract;
      active += split.active;
      unknown += split.unknown;
      unknownStages += split.unknownStages;

      // --- Probe C: stored totalHours vs Σ stages ---
      const div = stageSumDivergence(svc);
      if (div) {
        probeC.servicesDiverging += 1;
        if (probeC.samples.length < 40) probeC.samples.push({ caseNumber, ...div });
      }
    }

    // --- Probe A: status-less stages (all services, billable or not) ---
    for (const svc of services) {
      if (!Array.isArray(svc?.stages)) continue;
      for (const stage of svc.stages) {
        if (!stage || typeof stage !== 'object') continue;
        const st = stage.status;
        if (st === undefined || st === null || st === '') {
          probeA.stagesWithoutStatus += 1;
          probeA.hoursAffected += finiteNum(stage.totalHours) ?? 0;
          if (probeA.samples.length < 40) {
            probeA.samples.push({
              caseNumber,
              serviceId: svc.id || null,
              stageId: stage.id || null,
              totalHours: finiteNum(stage.totalHours)
            });
          }
        }
      }
    }

    const phantom = round2(contract - active - unknown);

    office.contractHours += contract;
    office.activeHours += active;
    office.unknownStatusHours += unknown;
    office.phantomHours += phantom;

    clients.push({
      caseNumber,
      clientName: c.fullName || null,
      storedTotalHours: finiteNum(c.totalHours),
      storedHoursUsed: finiteNum(c.hoursUsed),
      storedHoursRemaining: finiteNum(c.hoursRemaining),
      storedIsBlocked: c.isBlocked === true,
      contractHours: round2(contract),
      activeHours: round2(active),
      unknownStatusHours: round2(unknown),
      unknownStatusStageCount: unknownStages,
      phantomHours: phantom,
      // What the client's remaining balance becomes under the new rule, IF the
      // denominator were moved too. Reported for sizing only — phase 1 is
      // display-only and does not change hoursRemaining (P4).
      projectedRemainingIfContracted: round2(active - (finiteNum(c.hoursUsed) ?? 0)),
      serviceCount: services.length,
      legalProcedureCount: lpServices.length
    });
  });

  for (const k of Object.keys(office)) office[k] = round2(office[k]);
  probeA.hoursAffected = round2(probeA.hoursAffected);

  const withPhantom = clients.filter(c => Math.abs(c.phantomHours) > TOLERANCE);
  const newlyNegative = clients.filter(
    c => (c.storedHoursRemaining ?? 0) >= 0 && c.projectedRemainingIfContracted < 0
  );

  const report = {
    generatedAt: new Date().toISOString(),
    scriptVersion: 1,
    ruleUnderTest: 'active_stage_on_hours_accepting_service',
    readOnly: true,
    tolerance: TOLERANCE,
    scope: TARGET_CASE ? `single case ${TARGET_CASE}` : 'all clients',
    clientsScanned: clients.length,
    office,
    summary: {
      clientsWithPhantomCapacity: withPhantom.length,
      clientsThatWouldTurnNegative: newlyNegative.length,
      probeA_statusLessStages: probeA.stagesWithoutStatus,
      probeB_clientsWithTwoLegalProcedures: probeB.clientsWithMultipleLegalProcedures,
      probeC_servicesDivergingFromStageSum: probeC.servicesDiverging
    },
    probes: { A: probeA, B: probeB, C: probeC },
    clients: clients.sort((a, b) => b.phantomHours - a.phantomHours)
  };

  const out = path.join(__dirname, `.capacity-baseline-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');

  log('');
  log('=== OFFICE-WIDE ===');
  log(`  contract (today's rule) : ${office.contractHours}h`);
  log(`  active   (new rule)     : ${office.activeHours}h`);
  log(`  PHANTOM                 : ${office.phantomHours}h`);
  log(`  unknown-status stages   : ${office.unknownStatusHours}h`);
  log('');
  log('=== PROBES ===');
  log(`  A  status-less stages            : ${probeA.stagesWithoutStatus} (${probeA.hoursAffected}h)`);
  log(`  B  clients w/ 2+ legal_procedure : ${probeB.clientsWithMultipleLegalProcedures}  <-- if >0, read the plan §8.0`);
  log(`  C  services diverging from Σstages: ${probeC.servicesDiverging}`);
  log('');
  log(`  clients with phantom capacity    : ${withPhantom.length}`);
  log(`  clients that would turn negative : ${newlyNegative.length}`);
  log('');
  log(`report: ${out}`);
}

// Pure helpers exported for the offline test — the bucket math is provable
// without touching Firestore, and must be, since this script freezes the
// baseline every later PR is measured against.
module.exports = {
  splitServiceCapacity,
  stageSumDivergence,
  isBillable,
  acceptsHours,
  isStagedHourly,
  TOLERANCE
};

// Only hit the network when invoked directly, never when required by a test.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[measure-hours-capacity] FAILED:', err.message);
      process.exit(1);
    });
}
