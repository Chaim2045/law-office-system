/**
 * STAGE CAPACITY — the single definition of "hours actually available".
 *
 * WHY THIS EXISTS
 *
 * `client.totalHours` is presented as available capacity. It is not. For a
 * legal_procedure service, `svc.totalHours` is the sum of ALL its stages —
 * including stages with `status:'pending'` (never opened) and `'completed'`
 * (closed). Neither server-side derivation looks at stage status:
 *   - `shared/client-writer.js` recomputeTotalHours
 *   - `shared/aggregates.js`     calcClientAggregates
 * Both filter only on SERVICE status (`NON_AGGREGATING_STATUSES = ['archived']`)
 * and service type. Neither knows stages exist.
 *
 * A read-only production measurement (2026-08-16, 164 clients) put the gap at
 * **1,804 hours of phantom capacity** across 16 clients, and found 5 clients
 * displayed as solvent whose real balance is negative.
 *
 * Before this module there were FOUR competing definitions in the codebase:
 *   server                              → all stages
 *   ClientsDataManager.js:206           → active only, but does NOT exclude fixed
 *   service-card-renderer.js:98         → active + pending
 *   FluentDataGrid.js:195               → broken (compares type to a Hebrew
 *                                         display label; reads a dead shape)
 * This module is the one definition they will all be migrated onto.
 *
 * THE RULE (Haim, 2026-08-16 — product ruling P3)
 *
 *   Available capacity = an ACTIVE stage on a service that STILL ACCEPTS HOURS.
 *
 * The second half is load-bearing and was not obvious. Stage C is never marked
 * `completed` by any code path (`services/index.js` moveToNextStage refuses at
 * the last stage), and `completeService` / `closeCase` never touch `stages[]`.
 * So a CLOSED service keeps an `active` stage forever — under "active only"
 * its hours would count as available indefinitely. Inheriting
 * HOURS_LOCKED_STATUSES closes that.
 *
 * WHAT THIS MODULE IS NOT
 *
 * It measures CAPACITY (hours sold). `shared/stage-invariants.js` measures
 * CONSUMPTION (hours worked) and owns the pricing-type field convention
 * (`totalHoursWorked` for fixed stages, `hoursUsed` for hourly). Different
 * questions, deliberately different fields — but the same vocabulary, and a
 * drift-guard test pins the two together so they cannot diverge silently.
 *
 * TOTAL BY CONSTRUCTION
 *
 * Every function here is total: malformed input degrades a number, never
 * throws, and never produces NaN or undefined. This is not politeness — the
 * caller in `client-writer.js` runs OUTSIDE every kill switch (the enforcement
 * modes wrap only the invariant assertion), so a throw here would break
 * timesheet entry for the whole office. See the fail-open wrapper at the call
 * site.
 */

'use strict';

const { SYSTEM_CONSTANTS } = require('./constants');
const { isFixedService } = require('./business-rules/service-classification');
const { serviceAcceptsHours } = require('./service-status');
const { NON_AGGREGATING_STATUSES } = require('./aggregates');

const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

/**
 * The rule identifier + version stamped onto every derived figure.
 *
 * No hours aggregate in this system carries provenance today — you cannot read
 * a client document and tell which rule produced its numbers. Bump RULE_VERSION
 * whenever the arithmetic below changes, so a stale document is detectable
 * rather than merely wrong.
 */
const CAPACITY_RULE = 'active_stage_on_hours_accepting_service';
const CAPACITY_RULE_VERSION = 1;
const CAPACITY_SCHEMA_VERSION = 1;

/**
 * Stage statuses that represent open, workable capacity.
 *
 * Strict membership — there is deliberately NO default for a stage carrying no
 * status. A default was considered and rejected: `ClientsDataManager.js:206`
 * (the partners' primary screen) already uses strict `=== 'active'`, so
 * defaulting a status-less stage to active would put the server's number ABOVE
 * what is already on screen and bias the phantom figure downward. The 2026-08-16
 * probe measured ZERO status-less stages in production, and every stage-creating
 * path writes an explicit status — so the shape is unreachable by code today.
 * `unknownStatusStageCount` below is the tripwire in case that ever changes.
 */
const ACTIVE_STAGE_STATUSES = Object.freeze(['active']);

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/** Finite number or null. Never NaN, never undefined. Mirrors client-plan.ts. */
function finiteNum(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Does this stage represent open capacity? Strict — unknown status is not active. */
function isActiveStage(stage) {
  if (!stage || typeof stage !== 'object') return false;
  return ACTIVE_STAGE_STATUSES.includes(stage.status);
}

/** A stage carrying no status at all — a data shape no code path produces. */
function hasUnknownStatus(stage) {
  if (!stage || typeof stage !== 'object') return false;
  const s = stage.status;
  return s === undefined || s === null || s === '';
}

/**
 * Is this the one shape where the stage rule changes the answer?
 *
 * Only a legal_procedure priced HOURLY with a non-empty stages array. An
 * ST.HOURS service carries `packages[]` and no `stages` at all; an ST.FIXED
 * service has neither; a legal_procedure priced FIXED carries `fixedPrice` on
 * its stages and no `totalHours` — emitting a capacity figure for it would be
 * fabricated. (Note `services/index.js` records that 87 of 150 production
 * stages are fixed-priced, so this exclusion covers the majority shape.)
 */
function isStagedHourlyService(svc) {
  return !!svc
    && svc.type === ST.LEGAL_PROCEDURE
    && svc.pricingType !== PT.FIXED
    && Array.isArray(svc.stages)
    && svc.stages.length > 0;
}

/**
 * Does this service contribute to client-level billable capacity at all?
 * Mirrors `client-writer.js` recomputeTotalHours exactly — same filter, so the
 * new figure and the existing one are computed over the same population.
 */
function isBillableService(svc) {
  if (!svc || typeof svc !== 'object') return false;
  if (NON_AGGREGATING_STATUSES.includes(svc.status || 'active')) return false;
  return !isFixedService(svc);
}

/**
 * Split ONE service's capacity into its buckets.
 *
 * @param {Object} svc
 * @returns {{contract:number, active:number, unknownStages:number}}
 *   contract — what today's rule presents as available
 *   active   — what is genuinely available under the new rule
 *   unknownStages — count of stages carrying no status (expected 0)
 */
function computeServiceCapacity(svc) {
  const contract = finiteNum(svc && svc.totalHours) ?? 0;

  // Non-staged shapes are untouched by the stage rule: their contract figure
  // already is their available figure.
  if (!isStagedHourlyService(svc)) {
    return { contract, active: contract, unknownStages: 0 };
  }

  // A service that no longer accepts hours holds no available capacity, even
  // though a stage is still flagged active (stage C is never marked completed).
  if (!serviceAcceptsHours(svc)) {
    return { contract, active: 0, unknownStages: 0 };
  }

  let active = 0;
  let unknownStages = 0;

  for (const stage of svc.stages) {
    if (!stage || typeof stage !== 'object') continue;
    if (hasUnknownStatus(stage)) {
      unknownStages += 1;
      continue; // counted in neither bucket
    }
    if (isActiveStage(stage)) {
      active += finiteNum(stage.totalHours) ?? 0;
    }
    // 'pending' and 'completed' fall through — deliberately not counted.
  }

  return { contract: round2(contract), active: round2(active), unknownStages };
}

/**
 * Derive the client-level capacity figure from `services[]`.
 *
 * Total by construction: any malformed service or stage degrades its own
 * contribution and never propagates a throw or a NaN.
 *
 * @param {Array} services
 * @returns {{activeHours:number, contractHours:number, phantomHours:number,
 *            unknownStatusStageCount:number, rule:string, ruleVersion:number,
 *            schemaVersion:number}}
 */
function computeClientCapacity(services) {
  const list = Array.isArray(services) ? services.filter(Boolean) : [];

  let activeHours = 0;
  let contractHours = 0;
  let unknownStatusStageCount = 0;

  for (const svc of list) {
    if (!isBillableService(svc)) continue;
    const split = computeServiceCapacity(svc);
    contractHours += split.contract;
    activeHours += split.active;
    unknownStatusStageCount += split.unknownStages;
  }

  activeHours = round2(activeHours);
  contractHours = round2(contractHours);

  return {
    activeHours,
    contractHours,
    // What the system has been over-presenting as available.
    phantomHours: round2(contractHours - activeHours),
    unknownStatusStageCount,
    rule: CAPACITY_RULE,
    ruleVersion: CAPACITY_RULE_VERSION,
    schemaVersion: CAPACITY_SCHEMA_VERSION
  };
}

module.exports = {
  CAPACITY_RULE,
  CAPACITY_RULE_VERSION,
  CAPACITY_SCHEMA_VERSION,
  ACTIVE_STAGE_STATUSES,
  isActiveStage,
  hasUnknownStatus,
  isStagedHourlyService,
  isBillableService,
  computeServiceCapacity,
  computeClientCapacity
};
