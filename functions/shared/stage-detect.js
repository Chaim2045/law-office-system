/**
 * STAGE-DETECT — detect-only observability for legal_procedure stage resolution.
 *
 * PR-NOW-1 (2026-07-21). Part of the Hours–Stage Integrity plan:
 *   docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md
 *
 * WHY THIS EXISTS
 * ---------------
 * A read-only production measurement (2026-07-21) found 75 timesheet entries /
 * 101.60 hours across 6 clients logged against a legal_procedure stage that was
 * already marked `completed`. Two mechanisms produce that outcome:
 *
 *   1. A task's stage pointer (`budget_tasks.serviceId`) is stamped once at
 *      creation and is NEVER refreshed when the case advances a stage.
 *   2. When nothing resolves, every deduction path falls back to the hardcoded
 *      first stage id ('stage_a') with no error and no flag.
 *
 * Nothing in the system currently reports either condition. This module makes
 * both VISIBLE without changing any behaviour.
 *
 * WHAT THIS MODULE IS NOT
 * -----------------------
 * It does NOT block, throw, alter a deduction target, or change a return value.
 * It emits log lines. That restraint is deliberate and load-bearing:
 * `docs/FINDINGS-INTERNAL-OFFICE-BILLING-LEAK-2026-07.md` documents a lawyer who,
 * when the system blocked a legitimate entry, logged the hours under
 * `internal_office` instead — and the client was never billed. A block without a
 * working escape route moves the defect somewhere nobody looks. The escape route
 * (reopen-stage + the blocking modal) is a later, separate increment; enforcement
 * only ships after it works.
 *
 * Also note: a `completed` stage does NOT prove the entry is misfiled. On client
 * 2025006 the owner ruled the opposite — the 51 entries were correct and the
 * stage closure was the error. Hence "would have blocked", never "wrong".
 *
 * PII: case/service/stage identifiers only. Never a client name, employee email,
 * task description, or hours amount. This repo is PUBLIC and CI logs are
 * world-readable.
 */

'use strict';

/** Marker prefix so every emitted line is greppable in Cloud Logging. */
const LOG_PREFIX = '[STAGE-DETECT]';

/**
 * How the target stage id was arrived at, at the call site.
 * Ordered from most trustworthy to least.
 */
const RESOLUTION_SOURCE = Object.freeze({
  /** An explicit stage id supplied by the caller / stored on the task. */
  EXPLICIT: 'explicit',
  /** Read from `service.currentStage` — known to be frozen at creation (F2). */
  SERVICE_CURRENT_STAGE: 'service_current_stage',
  /** Hardcoded first-stage fallback. Nothing resolved. This is the silent one. */
  HARDCODED_FALLBACK: 'hardcoded_fallback',
});

/** Anomalies this module can report. */
const ANOMALY = Object.freeze({
  /** Nothing resolved; the hardcoded first stage was used. */
  SILENT_FALLBACK: 'silent_stage_fallback',
  /** The resolved stage exists but is already `completed`. */
  WOULD_HAVE_BLOCKED: 'would_have_blocked_closed_stage',
  /** The resolved stage id matches no stage on the service. */
  STAGE_NOT_FOUND: 'stage_not_found',
});

/**
 * Classify a stage resolution. Pure — no I/O, no throw.
 *
 * Exported separately from the reporter so it is unit-testable without
 * capturing console output.
 *
 * @param {object} params
 * @param {object|null} params.stage   The resolved stage object, or null/undefined if none matched.
 * @param {string} params.resolutionSource One of RESOLUTION_SOURCE.
 * @returns {string[]} zero or more ANOMALY values.
 */
function classifyStageResolution({ stage, resolutionSource }) {
  const anomalies = [];

  if (resolutionSource === RESOLUTION_SOURCE.HARDCODED_FALLBACK) {
    anomalies.push(ANOMALY.SILENT_FALLBACK);
  }

  if (!stage) {
    anomalies.push(ANOMALY.STAGE_NOT_FOUND);
    return anomalies;
  }

  if (stage.status === 'completed') {
    anomalies.push(ANOMALY.WOULD_HAVE_BLOCKED);
  }

  return anomalies;
}

/**
 * Report anomalies for one stage resolution. Never throws, never blocks.
 *
 * Call this AFTER the target stage has been resolved and BEFORE or AFTER the
 * deduction — position does not matter, because it has no effect on either.
 *
 * @param {object} params
 * @param {object|null} params.stage       Resolved stage object (or null).
 * @param {string} params.resolvedStageId  The stage id that was resolved to.
 * @param {string} params.resolutionSource One of RESOLUTION_SOURCE.
 * @param {string} params.path             Which write path is reporting (e.g. 'addTimeToTask').
 * @param {string} [params.caseNumber]     Client/case id. NOT a name.
 * @param {string} [params.serviceId]      Parent service id.
 * @returns {string[]} the anomalies that were reported (for tests/callers; ignored in prod).
 */
function reportStageResolution(params) {
  try {
    const {
      stage,
      resolvedStageId,
      resolutionSource,
      path,
      caseNumber,
      serviceId,
    } = params || {};

    const anomalies = classifyStageResolution({ stage, resolutionSource });
    if (anomalies.length === 0) return [];

    for (const anomaly of anomalies) {
      // Structured single-line payload — parseable by log search (G3).
      console.warn(`${LOG_PREFIX} ${anomaly}`, JSON.stringify({
        anomaly,
        path: path || 'unknown',
        caseNumber: caseNumber || null,
        serviceId: serviceId || null,
        stageId: resolvedStageId || null,
        stageStatus: stage ? (stage.status || null) : null,
        stageCompletedAt: stage ? (stage.completedAt || null) : null,
        resolutionSource: resolutionSource || 'unknown',
      }));
    }

    return anomalies;
  } catch (_err) {
    // Detect-only must never affect the write path. Swallow deliberately:
    // a logging failure is not a reason to fail a lawyer's time entry.
    return [];
  }
}

module.exports = {
  LOG_PREFIX,
  RESOLUTION_SOURCE,
  ANOMALY,
  classifyStageResolution,
  reportStageResolution,
};
