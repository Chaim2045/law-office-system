/**
 * Shared client aggregate calculation.
 * Used by clients/, services/, and any function that modifies services[].
 */

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

function isFixedService(svc) {
  return svc.type === 'legal_procedure' && svc.pricingType === 'fixed';
}

/**
 * Calculate client-level aggregates from services array.
 * Respects overrideActive and overdraftResolved flags for isBlocked.
 */
function calcClientAggregates(services, clientTotalHours) {
  const safeTotalHours = typeof clientTotalHours === 'number' && !Number.isNaN(clientTotalHours)
    ? clientTotalHours
    : 0;

  const billableServices = (services || []).filter(svc => !isFixedService(svc));

  const hoursUsed = round2(
    billableServices.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0)
  );

  const hoursRemaining = round2(safeTotalHours - hoursUsed);
  const minutesUsed = round2(hoursUsed * 60);
  const minutesRemaining = round2(hoursRemaining * 60);

  let isBlocked;
  let isCritical;

  if (billableServices.length === 0) {
    isBlocked = false;
    isCritical = false;
  } else {
    const hasActiveOverride = (services || []).some(svc =>
      svc.overrideActive === true || svc.overdraftResolved?.isResolved === true
    );
    isBlocked = hoursRemaining <= 0 && !hasActiveOverride;
    isCritical = !isBlocked && hoursRemaining <= 5;
  }

  return { hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical };
}

module.exports = { calcClientAggregates, round2, isFixedService };
