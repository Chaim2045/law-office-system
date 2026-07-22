/**
 * STAGE-INVARIANTS — pure detector for legal_procedure stage/hours mismatches.
 *
 * PR-IG-C1 (2026-07-22). Part of the Integrity Guard Layer plan:
 *   docs/PLAN-INTEGRITY-GUARD-LAYER-2026-07.md
 *
 * WHY THIS EXISTS
 * ---------------
 * A production measurement found 75 timesheet entries / 101.60 hours across
 * 6 clients deducted from a legal_procedure stage that was already marked
 * `completed`, undetected for five months (earliest: February 2026). The
 * deduction SUCCEEDED — it incremented the closed stage's package and the
 * service total, so every existing aggregate check agreed with the ledger
 * arithmetically. The books balanced perfectly, on the wrong page. Every one
 * of the 8+ nightly checks asks "do the numbers add up" — none asks "did this
 * hour land on the right stage". This module is that missing semantic check.
 *
 * WHAT THIS MODULE IS
 * --------------------
 * A PURE function. No Firestore reads, no writes, no `admin.firestore()`, no
 * async. It receives a client's data plus timesheet entries already read by
 * the caller, and returns discrepancies. Wiring it into the nightly check
 * (calling it, feeding it entries, surfacing its output) is PR-IG-C2 — a
 * separate PR. As of this file landing, NOTHING imports it.
 *
 * TWO VARIANTS (both required per the plan)
 * -------------------------------------------
 * (i) Stage-level hours vs the ledger. Per legal_procedure stage, compares
 *     the stage's stored hours against Σ(entries resolved to that stage).
 *     Catches an hour that landed on a wrong-but-active stage.
 *
 *     ⚠️ FIELD NAME DIFFERS BY PRICING TYPE (verified against
 *     `functions/src/modules/aggregation/index.js` lines 117-123 and 170,
 *     2026-07-22): a `fixed` stage accumulates in `stage.totalHoursWorked`;
 *     an `hourly` stage accumulates in `stage.hoursUsed` (via its packages).
 *     Service-level rollup at line 170 selects the same way:
 *     `st.pricingType === 'fixed' ? totalHoursWorked : hoursUsed`. Using
 *     `totalHoursWorked` for an hourly stage would read `undefined` (→ 0)
 *     and false-flag every hourly stage in production from day one.
 *
 * (ii) Entries dated after a stage closed. For each stage with
 *      `status === 'completed'` and a `completedAt`, flags entries whose
 *      `date` (YYYY-MM-DD) is strictly after the stage's closure date, at
 *      DAY granularity (an entry on the same calendar day as closure is not
 *      flagged — same-day noise must not fire; the real cases are months
 *      apart). Wording is neutral — "entries on a closed stage" — never
 *      "wrong" or "שגוי": on client 2025006 the owner ruled the stage
 *      CLOSURE was the error and the hours were correct. This detector
 *      reports a condition; it does not assign blame.
 *
 * ENTRY → STAGE RESOLUTION
 * -------------------------
 * This is where two independent prior measurements produced wrong counts
 * (68 and 120) before a third measurement established 75. The order below is
 * mandatory, not an optimization — stage ids are NOT unique across services
 * (a client can hold two legal_procedure services each with a `stage_a`), so
 * resolving the stage before anchoring the service is exactly what produced
 * the wrong 120.
 *
 *   1. Service anchor, in precedence order:
 *        a. entry.parentServiceId
 *        b. entry.serviceId, if it names a service directly
 *        c. the service that owns entry.packageId (walking every
 *           legal_procedure service's stages' packages)
 *   2. Stage within that anchored service, in precedence order:
 *        a. entry.stageId
 *        b. entry.serviceId, if it `startsWith('stage_')`
 *        c. the stage within the anchored service that owns entry.packageId
 *
 * Verified against `functions/scheduled/index.js` (dailyInvariantCheck,
 * ~lines 541-565, 2026-07-22): the existing nightly implements ONLY steps
 * 1a/1b (`entry.parentServiceId || entry.serviceId`) for service anchoring,
 * and does not attempt per-stage resolution for Check-8's purposes at all.
 * Nothing in the tree today implements the packageId-owner step (1c/2c) —
 * this module is the first implementation of it.
 *
 * UNRESOLVED ENTRIES ARE COUNTED, NEVER DROPPED
 * -----------------------------------------------
 * An entry this module cannot anchor to a service, or cannot resolve to a
 * stage within an anchored legal_procedure service, is counted in
 * `unresolvedCount` (with a bounded sample in `unresolvedSamples`) and
 * excluded from both variants' sums. It is never silently discarded —
 * dropping it would reproduce, at a new grain, the exact "census that lies"
 * defect a sibling PR (PR-NOW-3 / the counting-canon investigations) is
 * fighting elsewhere in this project.
 *
 * TOLERANCE
 * ---------
 * The plan (§5, "לאחד לא להוסיף") explicitly forbids inventing a new
 * tolerance constant and names the existing nightly's package-grain value
 * (`PKG_HOURSUSED_TOLERANCE = 0.05`, `functions/scheduled/index.js:~700`) as
 * the one to reuse "where per-deduction rounding noise is relevant — same
 * reasoning as Check-7". Variant (i) compares a stage-level sum built from
 * per-entry `minutes / 60` deductions, the same rounding-noise shape as
 * Check-7's package comparison — so this module reuses that same 0.05h
 * value, exported here as `STAGE_HOURS_TOLERANCE` (not a new constant; a
 * same-value re-export so this file has no hidden dependency on
 * `scheduled/index.js`'s module internals). Variant (ii) is a date
 * comparison and does not use a numeric tolerance at all.
 *
 * PII
 * ---
 * Case/service/stage identifiers, dates, and hour counts only. Never a
 * client name, employee email, or task description. This repo is PUBLIC and
 * CI logs are world-readable.
 *
 * DETERMINISM
 * -----------
 * Every internal accumulation is by-key (object), and every returned array
 * is sorted by a stable key before return, so the same inputs in any order
 * produce byte-identical output.
 */

'use strict';

const { SYSTEM_CONSTANTS } = require('./constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

/** Reused from the nightly's Check-7 package-grain tolerance (see file header). */
const STAGE_HOURS_TOLERANCE = 0.05;

/** Discrepancy `type` values this module emits. */
const DISCREPANCY_TYPE = Object.freeze({
  STAGE_HOURS_MISMATCH: 'stage_hours_ledger_mismatch',
  ENTRY_ON_CLOSED_STAGE: 'entry_on_closed_stage',
});

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Extract the YYYY-MM-DD portion of an ISO-ish timestamp string.
 * `completedAt` is written as `new Date().toISOString()` (services/index.js)
 * — e.g. "2026-02-22T19:25:49.531Z". Returns null if not parseable to a
 * plain 10-char YMD prefix.
 */
function toYmd(value) {
  if (typeof value !== 'string' || value.length < 10) return null;
  const prefix = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(prefix) ? prefix : null;
}

/**
 * Build a lookup of every legal_procedure service on the client, each with
 * an index of its stages and, per stage, an index of its packages.
 *
 * @param {object} clientData
 * @returns {Map<string, {service: object, stages: Map<string, object>, packageOwner: Map<string, string>}>}
 *   keyed by serviceId. `packageOwner` maps packageId -> stageId within that service.
 */
function indexLegalProcedureServices(clientData) {
  const services = Array.isArray(clientData && clientData.services)
    ? clientData.services.filter(Boolean)
    : [];

  const byServiceId = new Map();

  for (const svc of services) {
    if (!svc || svc.type !== ST.LEGAL_PROCEDURE || !svc.id) continue;

    const stages = Array.isArray(svc.stages) ? svc.stages.filter(Boolean) : [];
    const stagesById = new Map();
    const packageOwner = new Map();

    for (const stage of stages) {
      if (!stage || !stage.id) continue;
      stagesById.set(stage.id, stage);

      const packages = Array.isArray(stage.packages) ? stage.packages.filter(Boolean) : [];
      for (const pkg of packages) {
        if (pkg && pkg.id) {
          packageOwner.set(pkg.id, stage.id);
        }
      }
    }

    byServiceId.set(svc.id, { service: svc, stages: stagesById, packageOwner });
  }

  return byServiceId;
}

/**
 * Resolve one entry to { serviceId, stageId } within the client's
 * legal_procedure services, following the precedence order documented in
 * the file header. Returns null if no legal_procedure service/stage could
 * be resolved (the entry is then counted as unresolved by the caller).
 *
 * Pure. Does not look at non-legal_procedure services — this module only
 * concerns itself with the legal_procedure stage invariant.
 *
 * @param {object} entry
 * @param {Map} servicesById  output of indexLegalProcedureServices
 * @returns {{serviceId: string, stageId: string} | null}
 */
function resolveEntryToStage(entry, servicesById) {
  if (!entry) return null;

  // ── Step 1: service anchor ──
  let serviceId = null;

  if (entry.parentServiceId && servicesById.has(entry.parentServiceId)) {
    serviceId = entry.parentServiceId;
  } else if (entry.serviceId && servicesById.has(entry.serviceId)) {
    serviceId = entry.serviceId;
  } else if (entry.packageId) {
    // 1c: the service that owns entry.packageId.
    for (const [sid, indexed] of servicesById) {
      if (indexed.packageOwner.has(entry.packageId)) {
        serviceId = sid;
        break;
      }
    }
  }

  if (!serviceId) return null;
  const anchored = servicesById.get(serviceId);
  if (!anchored) return null;

  // ── Step 2: stage within the anchored service ──
  let stageId = null;

  if (entry.stageId && anchored.stages.has(entry.stageId)) {
    stageId = entry.stageId;
  } else if (
    typeof entry.serviceId === 'string' &&
    entry.serviceId.startsWith('stage_') &&
    anchored.stages.has(entry.serviceId)
  ) {
    stageId = entry.serviceId;
  } else if (entry.packageId && anchored.packageOwner.has(entry.packageId)) {
    stageId = anchored.packageOwner.get(entry.packageId);
  }

  if (!stageId) return null;

  return { serviceId, stageId };
}

/**
 * Composite key for a (serviceId, stageId) pair. Stage ids are NOT unique
 * across services (a client can hold two legal_procedure services each with
 * a `stage_a`) — every per-stage accumulation map in this module MUST be
 * keyed by this composite, never by bare stageId, or two same-named stages
 * on different services collide into one sum (the exact class of bug that
 * produced the wrong "120" measurement documented in the file header).
 */
function stageKey(serviceId, stageId) {
  return `${serviceId}::${stageId}`;
}

/**
 * (i) Stage-level hours vs the ledger — per legal_procedure stage, compares
 * the stage's stored hours (field selected by pricingType — see file
 * header) against Σ(minutes/60) of entries resolved to that stage.
 *
 * @param {Map} servicesById   output of indexLegalProcedureServices
 * @param {Map<string, number>} stageMinutes  stageKey(serviceId,stageId) -> summed minutes (resolved entries only)
 * @returns {object[]} discrepancies, sorted by (serviceId, stageId)
 */
function detectStageHoursMismatch(servicesById, stageMinutes) {
  const out = [];

  for (const [serviceId, { service, stages }] of servicesById) {
    for (const [stageId, stage] of stages) {
      // ⚠️ Field selection is pricingType-dependent — see file header (V12).
      const storedHours = stage.pricingType === PT.FIXED
        ? (stage.totalHoursWorked || 0)
        : (stage.hoursUsed || 0);

      const ledgerMinutes = stageMinutes.get(stageKey(serviceId, stageId)) || 0;
      const ledgerHours = round2(ledgerMinutes / 60);
      const gap = round2(Math.abs(round2(storedHours) - ledgerHours));

      if (gap > STAGE_HOURS_TOLERANCE) {
        out.push({
          type: DISCREPANCY_TYPE.STAGE_HOURS_MISMATCH,
          serviceId,
          serviceName: service.name || service.type || serviceId,
          stageId,
          stageStatus: stage.status || null,
          pricingType: stage.pricingType || null,
          storedHours: round2(storedHours),
          ledgerHours,
          gap,
        });
      }
    }
  }

  out.sort((a, b) => (a.serviceId + a.stageId).localeCompare(b.serviceId + b.stageId));
  return out;
}

/**
 * (ii) Entries dated after a stage closed — for each `completed` stage with
 * a `completedAt`, sums (at day granularity) the hours of resolved entries
 * dated strictly after the closure date, and flags the stage if any exist.
 *
 * @param {Map} servicesById  output of indexLegalProcedureServices
 * @param {Map<string, Array<{date: string, minutes: number}>>} stageEntryDates
 *   stageKey(serviceId,stageId) -> array of { date, minutes } for every entry resolved to that stage.
 * @returns {object[]} discrepancies, sorted by (serviceId, stageId)
 */
function detectEntriesOnClosedStage(servicesById, stageEntryDates) {
  const out = [];

  for (const [serviceId, { service, stages }] of servicesById) {
    for (const [stageId, stage] of stages) {
      if (stage.status !== 'completed') continue;

      const closedYmd = toYmd(stage.completedAt);
      if (!closedYmd) continue; // no usable completedAt — nothing to compare against

      const dated = stageEntryDates.get(stageKey(serviceId, stageId)) || [];
      let lateMinutes = 0;
      let lateCount = 0;
      let latestDate = null;

      for (const { date, minutes } of dated) {
        const entryYmd = toYmd(date) || (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);
        if (!entryYmd) continue;
        // Strictly-after, day granularity — same-day is NOT flagged.
        if (entryYmd > closedYmd) {
          lateMinutes += (minutes || 0);
          lateCount += 1;
          if (!latestDate || entryYmd > latestDate) latestDate = entryYmd;
        }
      }

      if (lateCount > 0) {
        out.push({
          type: DISCREPANCY_TYPE.ENTRY_ON_CLOSED_STAGE,
          serviceId,
          serviceName: service.name || service.type || serviceId,
          stageId,
          stageCompletedAt: stage.completedAt,
          entriesCount: lateCount,
          hours: round2(lateMinutes / 60),
          latestEntryDate: latestDate,
        });
      }
    }
  }

  out.sort((a, b) => (a.serviceId + a.stageId).localeCompare(b.serviceId + b.stageId));
  return out;
}

/**
 * Entry point — detect both stage-invariant classes for one client from its
 * data plus the caller-supplied entries already read for that client. Pure;
 * no I/O.
 *
 * @param {object} clientData   the client document body (services[] etc.)
 * @param {object[]} entries    timesheet entries for this client, each with
 *   at minimum { minutes, date }, and any of
 *   { parentServiceId, serviceId, stageId, packageId } used for resolution.
 *   Only entries relevant to a legal_procedure service are used; entries
 *   that resolve to a non-legal_procedure service are silently ignored (not
 *   counted as unresolved — this module's scope is legal_procedure only),
 *   determined by whether the entry's service anchor names a
 *   legal_procedure service at all.
 * @returns {{
 *   discrepancies: object[],
 *   unresolvedCount: number,
 *   unresolvedSamples: object[],
 * }}
 */
function detectStageInvariants(clientData, entries) {
  const servicesById = indexLegalProcedureServices(clientData);
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];

  const stageMinutes = new Map();
  const stageEntryDates = new Map();
  let unresolvedCount = 0;
  const unresolvedSamples = [];
  const MAX_SAMPLES = 20;

  for (const entry of list) {
    // Only entries that anchor to SOME service at all are in scope for this
    // module's unresolved accounting — an entry with neither
    // parentServiceId/serviceId/packageId naming anything is not a
    // legal_procedure concern (e.g. a plain hours-service entry) and is
    // silently out of scope, not "unresolved".
    const hasAnyAnchorCandidate = Boolean(
      entry.parentServiceId || entry.serviceId || entry.packageId
    );
    if (!hasAnyAnchorCandidate) continue;

    // Fast pre-check: does the anchor candidate even POINT at a
    // legal_procedure service? If the entry unambiguously belongs to a
    // different (non-legal_procedure) service, it's out of scope, not
    // unresolved. We detect that by checking whether any candidate id
    // matches ANY known service on the client at all (legal_procedure or
    // not) — if it matches a non-legal_procedure service, skip silently;
    // if it matches nothing recognizable there, or matches a
    // legal_procedure service but we can't pin the stage, it's unresolved.
    const allServices = Array.isArray(clientData && clientData.services)
      ? clientData.services.filter(Boolean)
      : [];
    const candidateServiceId = entry.parentServiceId || entry.serviceId || null;
    if (candidateServiceId) {
      const namedService = allServices.find((s) => s && s.id === candidateServiceId);
      if (namedService && namedService.type !== ST.LEGAL_PROCEDURE) {
        continue; // belongs to a different service type — out of scope
      }
    } else if (entry.packageId && !servicesById.size) {
      // No legal_procedure services on this client at all, and the entry
      // only has a packageId to go on — cannot possibly be a
      // legal_procedure concern.
      continue;
    }

    const resolved = resolveEntryToStage(entry, servicesById);

    if (!resolved) {
      // Only count as unresolved if there's at least a plausible
      // legal_procedure service in play (otherwise this entry was never a
      // Check-8 concern to begin with).
      const plausibleLegalProcedure =
        (candidateServiceId && servicesById.has(candidateServiceId)) ||
        (entry.packageId && servicesById.size > 0);

      if (plausibleLegalProcedure) {
        unresolvedCount += 1;
        if (unresolvedSamples.length < MAX_SAMPLES) {
          unresolvedSamples.push({
            entryId: entry.id || null,
            parentServiceId: entry.parentServiceId || null,
            serviceId: entry.serviceId || null,
            stageId: entry.stageId || null,
            packageId: entry.packageId || null,
          });
        }
      }
      continue;
    }

    const { serviceId: resolvedServiceId, stageId } = resolved;
    const key = stageKey(resolvedServiceId, stageId);
    stageMinutes.set(key, (stageMinutes.get(key) || 0) + (entry.minutes || 0));

    if (!stageEntryDates.has(key)) stageEntryDates.set(key, []);
    stageEntryDates.get(key).push({ date: entry.date, minutes: entry.minutes || 0 });
  }

  const discrepancies = [
    ...detectStageHoursMismatch(servicesById, stageMinutes),
    ...detectEntriesOnClosedStage(servicesById, stageEntryDates),
  ].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return (a.serviceId + a.stageId).localeCompare(b.serviceId + b.stageId);
  });

  unresolvedSamples.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );

  return {
    discrepancies,
    unresolvedCount,
    unresolvedSamples,
  };
}

module.exports = {
  DISCREPANCY_TYPE,
  STAGE_HOURS_TOLERANCE,
  indexLegalProcedureServices,
  resolveEntryToStage,
  detectStageHoursMismatch,
  detectEntriesOnClosedStage,
  detectStageInvariants,
};
