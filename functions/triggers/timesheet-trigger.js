/**
 * Timesheet Entries Trigger — Phase 1+2: hours + legal_procedure
 *
 * Listens to all writes on timesheet_entries/{entryId} and recalculates
 * client summaries + budget_task actuals using immutable patterns.
 */

const admin = require('firebase-admin');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

const db = admin.firestore();

/**
 * Round a number to 2 decimal places
 */
function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Detect the type of write event
 * @returns {'CREATE'|'UPDATE'|'DELETE'}
 */
function getEventType(before, after) {
  if (!before && after) return 'CREATE';
  if (before && after) return 'UPDATE';
  if (before && !after) return 'DELETE';
  return null;
}

/**
 * Calculate the minutes delta for this event
 */
function getMinutesDelta(eventType, before, after) {
  switch (eventType) {
    case 'CREATE':
      return after.minutes || 0;
    case 'UPDATE':
      return (after.minutes || 0) - (before.minutes || 0);
    case 'DELETE':
      return -(before.minutes || 0);
    default:
      return 0;
  }
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
  const billableServices = services.filter(
    svc => !(svc.type === 'legal_procedure' && svc.pricingType === 'fixed')
  );
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

/**
 * Apply a service transfer: decrement old service, increment new service.
 * Each leg dispatches by its own service type (hours vs legal_procedure).
 *
 * @param {Array} services - The client's services array
 * @param {Object} before - { serviceId, parentServiceId, stageId, packageId, minutes }
 * @param {Object} after  - { serviceId, parentServiceId, stageId, packageId, minutes }
 * @returns {{ updatedServices, isOverage, overageMinutes }} or null if new service not found
 */
function applyServiceTransfer(services, before, after) {
  let currentServices = services;
  let isOverage = false;
  let overageMinutes = 0;

  // ── Leg 1: Reverse from old service (decrement by before.minutes) ──
  const oldLookupId = before.parentServiceId || before.serviceId;
  const oldService = currentServices.find(svc => svc.id === oldLookupId);

  if (oldService) {
    const oldServiceType = oldService.type;
    let leg1Result = null;

    if (oldServiceType === 'hours') {
      if (before.packageId) {
        leg1Result = applyHoursDelta(currentServices, oldLookupId, before.packageId, -(before.minutes));
      } else {
        leg1Result = applyHoursDeltaServiceOnly(currentServices, oldLookupId, -(before.minutes));
      }
    } else if (oldServiceType === 'legal_procedure') {
      const oldStageId = before.stageId || before.serviceId;
      if (before.packageId) {
        leg1Result = applyLegalProcedureDelta(currentServices, oldLookupId, oldStageId, before.packageId, -(before.minutes));
      } else {
        leg1Result = applyLegalProcedureDeltaStageOnly(currentServices, oldLookupId, oldStageId, -(before.minutes));
      }
    }

    if (leg1Result) {
      currentServices = leg1Result.updatedServices;
    } else {
      console.warn(`⚠️ [timesheet-trigger] Service transfer Leg 1: target not found in old service ${oldLookupId} — proceeding with Leg 2 only`);
    }
  } else {
    console.warn(`⚠️ [timesheet-trigger] Service transfer Leg 1: old service ${oldLookupId} not found on client — skipping decrement`);
  }

  // ── Leg 2: Apply to new service (increment by after.minutes) ──
  const newLookupId = after.parentServiceId || after.serviceId;
  const newService = currentServices.find(svc => svc.id === newLookupId);

  if (!newService) {
    console.error(`❌ [timesheet-trigger] Service transfer Leg 2: new service ${newLookupId} not found on client`);
    return null;
  }

  const newServiceType = newService.type;
  let leg2Result = null;

  if (newServiceType === 'hours') {
    if (after.packageId) {
      leg2Result = applyHoursDelta(currentServices, newLookupId, after.packageId, after.minutes);
    } else {
      leg2Result = applyHoursDeltaServiceOnly(currentServices, newLookupId, after.minutes);
    }
  } else if (newServiceType === 'legal_procedure') {
    const newStageId = after.stageId || after.serviceId;
    if (after.packageId) {
      leg2Result = applyLegalProcedureDelta(currentServices, newLookupId, newStageId, after.packageId, after.minutes);
    } else {
      leg2Result = applyLegalProcedureDeltaStageOnly(currentServices, newLookupId, newStageId, after.minutes);
    }
  }

  if (!leg2Result) {
    console.error(`❌ [timesheet-trigger] Service transfer Leg 2: target not found in new service ${newLookupId}`);
    return null;
  }

  return {
    updatedServices: leg2Result.updatedServices,
    isOverage: leg2Result.isOverage || isOverage,
    overageMinutes: Math.max(leg2Result.overageMinutes || 0, overageMinutes)
  };
}

/**
 * Build task update object for budget_tasks
 */
function buildTaskUpdate(eventType, before, after, minutesDelta) {
  const hoursDelta = round2(minutesDelta / 60);

  switch (eventType) {
    case 'CREATE':
      return {
        actualMinutes: admin.firestore.FieldValue.increment(after.minutes || 0),
        actualHours: admin.firestore.FieldValue.increment(round2((after.minutes || 0) / 60)),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };
    case 'UPDATE':
      return {
        actualMinutes: admin.firestore.FieldValue.increment(minutesDelta),
        actualHours: admin.firestore.FieldValue.increment(hoursDelta),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };
    case 'DELETE':
      return {
        actualMinutes: admin.firestore.FieldValue.increment(-((before.minutes || 0))),
        actualHours: admin.firestore.FieldValue.increment(-round2((before.minutes || 0) / 60)),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };
    default:
      return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// Trigger: onTimesheetEntryChanged
// ═══════════════════════════════════════════════════════════════

const onTimesheetEntryChanged = onDocumentWritten({
  document: 'timesheet_entries/{entryId}',
  region: 'us-central1'
}, async (event) => {
  const entryId = event.params.entryId;
  const change = event.data;

  const beforeData = change.before.exists ? change.before.data() : null;
  const afterData = change.after.exists ? change.after.data() : null;

  const eventType = getEventType(beforeData, afterData);
  if (!eventType) {
    console.warn(`⚠️ [timesheet-trigger] Unknown event type for entry ${entryId}`);
    return null;
  }

  // ── Guard: skip self-writes (trigger writing isOverage/overageMinutes back to entry) ──
  if (eventType === 'UPDATE') {
    const triggerFields = ['isOverage', 'overageMinutes'];
    const changedKeys = Object.keys(afterData).filter((key) => {
      return JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key]);
    });
    if (changedKeys.length > 0 && changedKeys.every((key) => triggerFields.includes(key))) {
      console.log(`⏭️ [timesheet-trigger] Trigger self-write detected for entry ${entryId} — skipping`);
      return null;
    }
  }

  // Use after data for CREATE/UPDATE, before data for DELETE
  const entry = afterData || beforeData;

  // ── Guard: clientId required ──
  const clientId = entry.clientId;
  if (!clientId) {
    console.warn(`⚠️ [timesheet-trigger] No clientId on entry ${entryId} — skipping`);
    return null;
  }

  // ── Guard: need serviceId to locate the service ──
  const serviceId = entry.serviceId;
  if (!serviceId) {
    console.warn(`⚠️ [timesheet-trigger] No serviceId on entry ${entryId} — skipping`);
    return null;
  }

  const parentServiceId = entry.parentServiceId || null;
  const stageId = entry.stageId || null;
  const packageId = entry.packageId || null;
  const taskId = entry.taskId || null;
  const minutesDelta = getMinutesDelta(eventType, beforeData, afterData);

  // ── Detect service transfer (serviceId changed on UPDATE) ──
  const isServiceTransfer = eventType === 'UPDATE'
    && beforeData?.serviceId
    && afterData?.serviceId
    && beforeData.serviceId !== afterData.serviceId;

  // Skip no-op updates (0 delta with no other relevant change)
  // Exception: service transfers always proceed even with zero minute delta
  if (eventType === 'UPDATE' && minutesDelta === 0 && !isServiceTransfer) {
    console.log(`⏭️ [timesheet-trigger] Zero delta for entry ${entryId} — skipping`);
    return null;
  }

  console.log(`📊 [timesheet-trigger] ${eventType} entry ${entryId} | client=${clientId} | delta=${minutesDelta}min`);

  // ── Transaction: read client, recalculate, write ──
  const clientRef = db.collection('clients').doc(clientId);

  try {
    await db.runTransaction(async (transaction) => {
      // ── Idempotency guard: prevent double-processing on event re-delivery ──
      const idempotencyRef = db.collection('processed_trigger_events').doc(event.id);
      const idempotencyDoc = await transaction.get(idempotencyRef);
      if (idempotencyDoc.exists) {
        console.log(`⏭️ [timesheet-trigger] Event ${event.id} already processed — skipping (idempotency)`);
        return;
      }

      // ── READS (all reads must precede all writes in Firestore transactions) ──
      const clientDoc = await transaction.get(clientRef);

      let taskDoc = null;
      if (taskId) {
        const taskRef = db.collection('budget_tasks').doc(taskId);
        taskDoc = await transaction.get(taskRef);
      }

      if (!clientDoc.exists) {
        console.error(`❌ [timesheet-trigger] Client ${clientId} not found — skipping`);
        return;
      }

      const clientData = clientDoc.data();
      const services = clientData.services || [];

      let result = null;

      // ── Service transfer: two-legged operation (decrement old, increment new) ──
      if (isServiceTransfer) {
        console.log(`🔄 [timesheet-trigger] Service transfer detected for entry ${entryId}: ${beforeData.serviceId} → ${afterData.serviceId}`);
        result = applyServiceTransfer(
          services,
          {
            serviceId: beforeData.serviceId,
            parentServiceId: beforeData.parentServiceId || null,
            stageId: beforeData.stageId || null,
            packageId: beforeData.packageId || null,
            minutes: beforeData.minutes || 0
          },
          {
            serviceId: afterData.serviceId,
            parentServiceId: afterData.parentServiceId || null,
            stageId: afterData.stageId || null,
            packageId: afterData.packageId || null,
            minutes: afterData.minutes || 0
          }
        );
      } else {
        // ── Normal path: single-service delta ──
        const lookupServiceId = parentServiceId || serviceId;
        const targetService = services.find((svc) => svc.id === lookupServiceId);
        if (!targetService) {
          console.error(`❌ [timesheet-trigger] Service ${serviceId} not found on client ${clientId}`);
          return;
        }

        const serviceType = targetService.type || clientData.procedureType;

        if (serviceType === 'hours') {
          // ── hours: resolve packageId if missing ──
          let resolvedPackageId = packageId;

          if (!resolvedPackageId) {
            // Fallback: find first eligible package (same priority as getActivePackage)
            const fallbackPkg = (targetService.packages || []).find((pkg) => {
              const status = pkg.status || 'active';
              return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
                && (pkg.hoursRemaining || 0) > -10;
            });
            if (fallbackPkg) {
              resolvedPackageId = fallbackPkg.id;
              console.log(`🔧 [timesheet-trigger] Resolved missing packageId → ${resolvedPackageId} for entry ${entryId}`);
            }
          }

          if (resolvedPackageId) {
            result = applyHoursDelta(services, lookupServiceId, resolvedPackageId, minutesDelta);
          } else {
            // All packages depleted — count at service level only
            result = applyHoursDeltaServiceOnly(services, lookupServiceId, minutesDelta);
            console.warn(`⚠️ [timesheet-trigger] No active package for entry ${entryId} — counting at service level`);
          }
        } else if (serviceType === 'legal_procedure') {
          // ── legal_procedure: resolve stageId if missing ──
          let resolvedStageId = stageId;
          if (!resolvedStageId && serviceId && serviceId.startsWith('stage_')) {
            resolvedStageId = serviceId;
            console.log(`🔧 [timesheet-trigger] Resolved stageId from serviceId: ${resolvedStageId} for entry ${entryId}`);
          }

          if (!resolvedStageId) {
            console.error(`❌ [timesheet-trigger] No stageId on entry ${entryId} — required for legal_procedure. Skipping.`);
            return;
          }

          const targetStage = (targetService.stages || []).find((st) => st.id === resolvedStageId);
          if (!targetStage) {
            console.error(`❌ [timesheet-trigger] Stage ${resolvedStageId} not found in service ${serviceId}`);
            return;
          }

          if (targetStage.pricingType !== 'fixed' && !packageId) {
            // Fallback: find first eligible package from stage
            const fallbackStagePkg = (targetStage.packages || []).find((pkg) => {
              const status = pkg.status || 'active';
              return ['active', 'pending', 'overdraft', 'depleted'].includes(status)
                && (pkg.hoursRemaining || 0) > -10;
            });

            if (fallbackStagePkg) {
              console.log(`🔧 [timesheet-trigger] Resolved missing packageId → ${fallbackStagePkg.id} for hourly stage ${resolvedStageId}`);
              result = applyLegalProcedureDelta(services, lookupServiceId, resolvedStageId, fallbackStagePkg.id, minutesDelta);
            } else {
              // All stage packages depleted — count at stage level only
              result = applyLegalProcedureDeltaStageOnly(services, lookupServiceId, resolvedStageId, minutesDelta);
              console.warn(`⚠️ [timesheet-trigger] No active package for stage ${resolvedStageId} — counting at stage level`);
            }
          } else {
            result = applyLegalProcedureDelta(services, lookupServiceId, resolvedStageId, packageId, minutesDelta);
          }
        } else {
          console.warn(`⚠️ [timesheet-trigger] Unknown service type "${serviceType}" for service ${serviceId} — skipping`);
          return;
        }
      }

      if (!result) {
        console.error(`❌ [timesheet-trigger] Target not found on client ${clientId} (service=${serviceId}, stage=${stageId}, package=${packageId})`);
        return;
      }

      const { updatedServices, isOverage: pkgOverage, overageMinutes: pkgOverageMinutes } = result;

      // ── Calculate client-level aggregates ──
      const agg = calcClientAggregates(updatedServices, clientData.totalHours);

      // ── Overage: package-level or client-level (whichever is larger) ──
      const clientOverage = agg.hoursRemaining < 0;
      const clientOverageMinutes = clientOverage ? round2(Math.abs(agg.hoursRemaining) * 60) : 0;
      const isOverage = pkgOverage || clientOverage;
      const overageMinutes = Math.max(pkgOverageMinutes, clientOverageMinutes);

      // ── Write 1: Update client document ──
      transaction.update(clientRef, {
        services: updatedServices,
        hoursUsed: agg.hoursUsed,
        hoursRemaining: agg.hoursRemaining,
        minutesUsed: agg.minutesUsed,
        minutesRemaining: agg.minutesRemaining,
        isBlocked: agg.isBlocked,
        isCritical: agg.isCritical,
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

      // ── Write 2: Update overage flags on entry (CREATE/UPDATE only, not DELETE) ──
      if (afterData) {
        const entryRef = db.collection('timesheet_entries').doc(entryId);
        transaction.update(entryRef, {
          isOverage: isOverage,
          overageMinutes: isOverage ? overageMinutes : 0
        });
      }

      // ── Write 3: Update budget_task if taskId exists ──
      if (taskId && taskDoc) {
        if (!taskDoc.exists) {
          console.warn(`⚠️ [timesheet-trigger] Task ${taskId} not found — skipping task update`);
        } else {
          const taskRef = db.collection('budget_tasks').doc(taskId);
          const taskUpdate = buildTaskUpdate(eventType, beforeData, afterData, minutesDelta);
          if (taskUpdate) {
            transaction.update(taskRef, taskUpdate);
          }
        }
      }

      // ── Write 4: Idempotency record (atomic with all other writes) ──
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours TTL
      transaction.set(idempotencyRef, {
        entryId,
        clientId,
        eventType,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
      });

      console.log(`✅ [timesheet-trigger] ${eventType} processed | client=${clientId} | hoursRemaining=${agg.hoursRemaining} | isBlocked=${agg.isBlocked}`);
    });
  } catch (error) {
    console.error(`❌ [timesheet-trigger] Transaction failed for entry ${entryId}:`, error);
    throw error; // Re-throw to trigger retry
  }

  return null;
});


module.exports = {
  onTimesheetEntryChanged,
  // Exported for unit testing only
  _test: {
    applyHoursDelta,
    applyHoursDeltaServiceOnly,
    applyLegalProcedureDelta,
    applyLegalProcedureDeltaStageOnly,
    applyServiceTransfer,
    calcClientAggregates,
    getEventType,
    getMinutesDelta
  }
};
