/**
 * Aggregation Module — Shared immutable functions for service-level deduction
 *
 * These functions are the single source of deduction logic, used by:
 * - Callable functions (createQuickLogEntry, createTimesheetEntry_v2, addTimeToTaskWithTransaction)
 *   → for in-transaction deduction on CREATE
 * - Timesheet trigger (onTimesheetEntryChanged)
 *   → for UPDATE/DELETE delta processing, and as safety net for CREATE without deductedInTransaction
 *
 * IMPORTANT: isOverage / overageMinutes on entries are informational flags only.
 * Source of truth for hours: clients.services[].packages[].hoursRemaining
 */

// ⚠️ isFixedService + calcClientAggregates — single source of truth in shared/aggregates.js
// 2026-05-13: removed local duplicate calcClientAggregates (was missing the
// `billable.length === 0 → isBlocked=false` early-return; caused 20+ fixed-only
// clients to be incorrectly marked blocked when the trigger ran).
const { isFixedService, calcClientAggregates } = require('../../../shared/aggregates');
const { SYSTEM_CONSTANTS } = require('../../../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

/**
 * Round a number to 2 decimal places
 */
function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Canonical pricing-aware selection of a legal_procedure stage's "hours used"
 * figure. A FIXED-pricing stage tracks work in totalHoursWorked (hoursUsed is
 * not the counted field for a fixed stage — see applyLegalProcedureDelta
 * below); an HOURLY stage tracks work in hoursUsed.
 *
 * This is the single rule every stage-hours-used consumer must use.
 * functions/services/index.js (addHoursPackageToStage) imports
 * calcServiceHoursUsedFromStages below instead of hand-copying this ternary —
 * see the PR-STAGE-OWN comment there.
 */
function calcStageEffectiveHoursUsed(stage) {
  return stage.pricingType === PT.FIXED ? (stage.totalHoursWorked || 0) : (stage.hoursUsed || 0);
}

/**
 * Pricing-aware Σ of a legal_procedure service's hoursUsed across its stages.
 * Canonical implementation — see calcStageEffectiveHoursUsed above.
 */
function calcServiceHoursUsedFromStages(stages) {
  return round2((stages || []).reduce((sum, st) => sum + calcStageEffectiveHoursUsed(st), 0));
}

/**
 * PR-STAGE-OWN (2026-07-23), extended: canonical rule for recomputing an
 * HOURLY stage's hoursUsed from its packages while never destroying
 * "orphan" hours — work that was legitimately counted directly on the stage
 * with no package backing at all (applyLegalProcedureDeltaStageOnly, below,
 * increments stage.hoursUsed directly whenever a deduction finds no active
 * package for the stage — addTimeToTask_v2.js "No active package for stage"
 * fallback, also timesheet/index.js + triggers/timesheet-trigger.js).
 *
 * THE FLAW A NAIVE FLOOR HAS (verified by hand before writing this, per the
 * 2026-07-23 review): `hoursUsed = max(Σnewpackages, oldStage.hoursUsed)` —
 * the rule functions/services/index.js originally shipped for
 * addHoursPackageToStage — is WRONG the moment packages themselves can move
 * (this module's applyLegalProcedureDelta applies POSITIVE deltas from
 * ordinary timesheet entries AND NEGATIVE deltas from entry edit/delete, via
 * triggers/timesheet-trigger.js). A naive floor (a) UNDERCOUNTS growth —
 * oldStage.hoursUsed already includes the orphan, so max() silently caps a
 * legitimate increase at the stale total instead of adding to it — and
 * (b) FREEZES forever on any decrease, because oldStage.hoursUsed (which
 * already contains the orphan) is always >= the new Σpackages once the
 * orphan is nonzero, so max() always returns the stale value and a genuine
 * downward correction (edit/delete lowering a package's hoursUsed) can never
 * take effect. Both failure modes were confirmed numerically before this
 * function was written — see the commit message.
 *
 * THE CORRECT RULE — an additive offset, not a floor:
 *   orphan = max(0, oldStage.hoursUsed - Σ(oldStage.packages.hoursUsed))   [captured from the PRE-delta state]
 *   new stage.hoursUsed = orphan + Σ(newPackages.hoursUsed)
 *
 * This preserves the orphan as a constant additive term while letting the
 * package-backed portion move freely in EITHER direction with the packages
 * (so a legitimate edit/delete decrease is never blocked), and is
 * bit-identical to the old plain-Σ(packages) behavior whenever orphan===0
 * (the healthy majority — no regression).
 *
 * Used by BOTH applyLegalProcedureDelta (below, ordinary +/- deltas) and
 * functions/services/index.js addHoursPackageToStage (adding a package,
 * where "newPackages" = the array AFTER the push and "oldStage" is the
 * pre-push snapshot) — the single place this rule lives; do not hand-copy it.
 */
function recomputeStageHoursUsedPreservingOrphan(oldStage, newPackages) {
  const oldPackagesHoursUsed = round2(
    (oldStage.packages || []).reduce((sum, p) => sum + (p.hoursUsed || 0), 0)
  );
  const oldStageHoursUsed = round2(oldStage.hoursUsed || 0);
  const orphan = round2(Math.max(0, oldStageHoursUsed - oldPackagesHoursUsed));

  const newPackagesHoursUsed = round2(
    (newPackages || []).reduce((sum, p) => sum + (p.hoursUsed || 0), 0)
  );

  return { hoursUsed: round2(orphan + newPackagesHoursUsed), orphan };
}

/**
 * Build an updated services array (immutable) after applying a minutes delta
 * to the target package within the target service.
 *
 * Returns { updatedServices, isOverage, overageMinutes } or null if target not found.
 */
function applyHoursDelta(services, serviceId, packageId, minutesDelta) {
  const hoursDelta = minutesDelta / 60;
  let targetFound = false;
  let isOverage = false;
  let overageMinutes = 0;

  const updatedServices = services.map((svc) => {
    if (svc.id !== serviceId) return svc;

    // Found the target service — update packages
    const updatedPackages = (svc.packages || []).map((pkg) => {
      if (pkg.id !== packageId) return pkg;

      targetFound = true;

      const newHoursUsed = round2((pkg.hoursUsed || 0) + hoursDelta);
      const newHoursRemaining = round2((pkg.hours || 0) - newHoursUsed);

      let newStatus = pkg.status || 'active';
      if (newHoursRemaining <= 0) {
        newStatus = 'depleted';
      } else if (newStatus === 'depleted') {
        // Restore if hours freed up (edit/delete)
        newStatus = 'active';
      }

      if (newHoursRemaining < 0) {
        isOverage = true;
        overageMinutes = round2(Math.abs(newHoursRemaining) * 60);
      }

      return {
        ...pkg,
        hoursUsed: newHoursUsed,
        hoursRemaining: newHoursRemaining,
        status: newStatus
      };
    });

    // Recalculate service-level aggregates from packages
    const svcHoursUsed = round2(
      updatedPackages.reduce((sum, p) => sum + (p.hoursUsed || 0), 0)
    );
    const svcHoursRemaining = round2((svc.totalHours || 0) - svcHoursUsed);

    return {
      ...svc,
      packages: updatedPackages,
      hoursUsed: svcHoursUsed,
      hoursRemaining: svcHoursRemaining,
      isBlocked: svcHoursRemaining <= 0 && !svc.overrideActive && !(svc.overdraftResolved?.isResolved),
      isCritical: svcHoursRemaining > 0 && svcHoursRemaining <= 5
    };
  });

  if (!targetFound) return null;

  return { updatedServices, isOverage, overageMinutes };
}

/**
 * Build an updated services array (immutable) for legal_procedure service type.
 * Handles both hourly stages (with packages) and fixed stages (totalHoursWorked).
 *
 * Returns { updatedServices, isOverage, overageMinutes } or null if target not found.
 */
function applyLegalProcedureDelta(services, serviceId, stageId, packageId, minutesDelta) {
  const hoursDelta = minutesDelta / 60;
  let targetFound = false;
  let isOverage = false;
  let overageMinutes = 0;

  const updatedServices = services.map((svc) => {
    if (svc.id !== serviceId) return svc;

    const updatedStages = (svc.stages || []).map((stage) => {
      if (stage.id !== stageId) return stage;

      targetFound = true;

      // ── Fixed pricing: track hours worked, no deduction ──
      if (stage.pricingType === PT.FIXED) {
        const newTotalHoursWorked = round2((stage.totalHoursWorked || 0) + hoursDelta);
        return {
          ...stage,
          totalHoursWorked: newTotalHoursWorked
        };
      }

      // ── Hourly pricing: deduct from package ──
      if (!packageId) return stage;

      const updatedPackages = (stage.packages || []).map((pkg) => {
        if (pkg.id !== packageId) return pkg;

        const newHoursUsed = round2((pkg.hoursUsed || 0) + hoursDelta);
        const newHoursRemaining = round2((pkg.hours || 0) - newHoursUsed);

        let newStatus = pkg.status || 'active';
        if (newHoursRemaining <= 0) {
          newStatus = 'depleted';
        } else if (newStatus === 'depleted') {
          newStatus = 'active';
        }

        if (newHoursRemaining < 0) {
          isOverage = true;
          overageMinutes = round2(Math.abs(newHoursRemaining) * 60);
        }

        return {
          ...pkg,
          hoursUsed: newHoursUsed,
          hoursRemaining: newHoursRemaining,
          status: newStatus
        };
      });

      // PR-STAGE-OWN fix 1c (2026-07-23): recompute stage-level hoursUsed via
      // the canonical orphan-preserving rule (recomputeStageHoursUsedPreservingOrphan
      // above), NOT a plain Σ(updatedPackages.hoursUsed). This path applies
      // BOTH positive deltas (ordinary timesheet entries) and NEGATIVE deltas
      // (entry edit/delete reversal — triggers/timesheet-trigger.js passes
      // -(before.minutes)). A plain Σpackages recompute here silently erases
      // any stage-only-counted orphan hours (same collision #1 as
      // addHoursPackageToStage) the next time ANYONE logs, edits, or deletes
      // time against a package on that stage — no package ADD required. The
      // orphan-preserving rule keeps the orphan intact while still letting a
      // legitimate decrease (edit/delete lowering the package) take effect —
      // see the function doc for why a naive floor would freeze the value
      // instead.
      const { hoursUsed: stageHoursUsed } = recomputeStageHoursUsedPreservingOrphan(stage, updatedPackages);
      const stageHoursRemaining = round2((stage.totalHours || 0) - stageHoursUsed);

      return {
        ...stage,
        packages: updatedPackages,
        hoursUsed: stageHoursUsed,
        hoursRemaining: stageHoursRemaining
      };
    });

    // Recalculate service-level aggregates from stages (canonical pricing-aware rule)
    const svcHoursUsed = calcServiceHoursUsedFromStages(updatedStages);
    const svcHoursRemaining = svc.pricingType === PT.FIXED
      ? null
      : round2((svc.totalHours || 0) - svcHoursUsed);

    return {
      ...svc,
      stages: updatedStages,
      hoursUsed: svcHoursUsed,
      hoursRemaining: svcHoursRemaining
    };
  });

  if (!targetFound) return null;

  return { updatedServices, isOverage, overageMinutes };
}

/**
 * Build an updated services array (immutable) for hours service type
 * when ALL packages are depleted and no packageId is available.
 *
 * Increments service-level hoursUsed/hoursRemaining directly without
 * touching any individual package.
 *
 * Returns { updatedServices, isOverage, overageMinutes } or null if target not found.
 */
function applyHoursDeltaServiceOnly(services, serviceId, minutesDelta) {
  const hoursDelta = minutesDelta / 60;
  let targetFound = false;
  let isOverage = false;
  let overageMinutes = 0;

  const updatedServices = services.map((svc) => {
    if (svc.id !== serviceId) return svc;
    targetFound = true;

    const newHoursUsed = round2((svc.hoursUsed || 0) + hoursDelta);
    const newHoursRemaining = round2((svc.totalHours || 0) - newHoursUsed);

    if (newHoursRemaining < 0) {
      isOverage = true;
      overageMinutes = round2(Math.abs(newHoursRemaining) * 60);
    }

    return {
      ...svc,
      hoursUsed: newHoursUsed,
      hoursRemaining: newHoursRemaining,
      isBlocked: newHoursRemaining <= 0 && !svc.overrideActive && !(svc.overdraftResolved?.isResolved),
      isCritical: newHoursRemaining > 0 && newHoursRemaining <= 5
    };
  });

  if (!targetFound) return null;

  return { updatedServices, isOverage, overageMinutes };
}

/**
 * Build an updated services array (immutable) for legal_procedure service type
 * when ALL stage packages are depleted and no packageId is available.
 *
 * Increments stage-level hoursUsed/hoursRemaining directly without
 * touching any individual package, then recalculates service aggregates.
 *
 * Returns { updatedServices, isOverage, overageMinutes } or null if target not found.
 */
function applyLegalProcedureDeltaStageOnly(services, serviceId, stageId, minutesDelta) {
  const hoursDelta = minutesDelta / 60;
  let targetFound = false;
  let isOverage = false;
  let overageMinutes = 0;

  const updatedServices = services.map((svc) => {
    if (svc.id !== serviceId) return svc;

    const updatedStages = (svc.stages || []).map((stage) => {
      if (stage.id !== stageId) return stage;

      targetFound = true;

      const newHoursUsed = round2((stage.hoursUsed || 0) + hoursDelta);
      const newHoursRemaining = round2((stage.totalHours || 0) - newHoursUsed);

      if (newHoursRemaining < 0) {
        isOverage = true;
        overageMinutes = round2(Math.abs(newHoursRemaining) * 60);
      }

      return {
        ...stage,
        hoursUsed: newHoursUsed,
        hoursRemaining: newHoursRemaining
      };
    });

    // Recalculate service-level aggregates from stages (canonical pricing-aware rule)
    const svcHoursUsed = calcServiceHoursUsedFromStages(updatedStages);
    const svcHoursRemaining = svc.pricingType === PT.FIXED
      ? null
      : round2((svc.totalHours || 0) - svcHoursUsed);

    return {
      ...svc,
      stages: updatedStages,
      hoursUsed: svcHoursUsed,
      hoursRemaining: svcHoursRemaining
    };
  });

  if (!targetFound) return null;

  return { updatedServices, isOverage, overageMinutes };
}

// REMOVED 2026-05-13: local calcClientAggregates duplicate.
// The canonical implementation is in functions/shared/aggregates.js (imported above
// and re-exported below). The local version was missing the
// `billable.length === 0 → isBlocked=false` early-return, which caused
// fixed-only clients to be incorrectly blocked whenever the trigger recalculated.
// See .refactor-backups/aggregation-index-2026-05-13.js for original.

module.exports = {
  round2,
  calcStageEffectiveHoursUsed,
  calcServiceHoursUsedFromStages,
  recomputeStageHoursUsedPreservingOrphan,
  applyHoursDelta,
  applyHoursDeltaServiceOnly,
  applyLegalProcedureDelta,
  applyLegalProcedureDeltaStageOnly,
  calcClientAggregates
};
