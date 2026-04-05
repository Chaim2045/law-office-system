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

// ⚠️ isFixedService — single source of truth in shared/aggregates.js
const { isFixedService } = require('../../../shared/aggregates');

/**
 * Round a number to 2 decimal places
 */
function round2(n) {
  return Math.round((n || 0) * 100) / 100;
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
      if (stage.pricingType === 'fixed') {
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

      // Recalculate stage-level aggregates from packages
      const stageHoursUsed = round2(
        updatedPackages.reduce((sum, p) => sum + (p.hoursUsed || 0), 0)
      );
      const stageHoursRemaining = round2((stage.totalHours || 0) - stageHoursUsed);

      return {
        ...stage,
        packages: updatedPackages,
        hoursUsed: stageHoursUsed,
        hoursRemaining: stageHoursRemaining
      };
    });

    // Recalculate service-level aggregates from stages
    const svcHoursUsed = round2(
      updatedStages.reduce((sum, st) => sum + (st.pricingType === 'fixed' ? (st.totalHoursWorked || 0) : (st.hoursUsed || 0)), 0)
    );
    const svcHoursRemaining = svc.pricingType === 'fixed'
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

    // Recalculate service-level aggregates from stages
    const svcHoursUsed = round2(
      updatedStages.reduce((sum, st) => sum + (st.pricingType === 'fixed' ? (st.totalHoursWorked || 0) : (st.hoursUsed || 0)), 0)
    );
    const svcHoursRemaining = svc.pricingType === 'fixed'
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
 * Calculate client-level aggregates from services array
 */
function calcClientAggregates(services, clientTotalHours) {
  // ⚠️ isFixedService imported from shared/aggregates.js — covers type=fixed AND legal_procedure+fixed
  const billableServices = services.filter(svc => !isFixedService(svc));
  const hoursUsed = round2(
    billableServices.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0)
  );
  const hoursRemaining = round2((clientTotalHours || 0) - hoursUsed);
  const minutesUsed = round2(hoursUsed * 60);
  const minutesRemaining = round2(hoursRemaining * 60);
  const hasActiveOverride = services.some(svc =>
    svc.overrideActive === true || svc.overdraftResolved?.isResolved === true
  );
  const isBlocked = hoursRemaining <= 0 && !hasActiveOverride;
  const isCritical = !isBlocked && hoursRemaining <= 5;
  return { hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical };
}

module.exports = {
  round2,
  applyHoursDelta,
  applyHoursDeltaServiceOnly,
  applyLegalProcedureDelta,
  applyLegalProcedureDeltaStageOnly,
  calcClientAggregates
};
