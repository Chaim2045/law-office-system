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
      hoursRemaining: svcHoursRemaining
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
    const svcHoursRemaining = round2((svc.totalHours || 0) - svcHoursUsed);

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
  const hoursUsed = round2(
    services.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0)
  );
  const hoursRemaining = round2((clientTotalHours || 0) - hoursUsed);
  const minutesUsed = round2(hoursUsed * 60);
  const minutesRemaining = round2(hoursRemaining * 60);
  const isBlocked = hoursRemaining <= 0;
  const isCritical = !isBlocked && hoursRemaining <= 5;

  return { hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical };
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

  // Skip no-op updates (0 delta with no other relevant change)
  if (eventType === 'UPDATE' && minutesDelta === 0) {
    console.log(`⏭️ [timesheet-trigger] Zero delta for entry ${entryId} — skipping`);
    return null;
  }

  console.log(`📊 [timesheet-trigger] ${eventType} entry ${entryId} | client=${clientId} | delta=${minutesDelta}min`);

  // ── Transaction: read client, recalculate, write ──
  const clientRef = db.collection('clients').doc(clientId);

  try {
    await db.runTransaction(async (transaction) => {
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

      // ── Determine service type from the target service ──
      const lookupServiceId = parentServiceId || serviceId;
      const targetService = services.find((svc) => svc.id === lookupServiceId);
      if (!targetService) {
        console.error(`❌ [timesheet-trigger] Service ${serviceId} not found on client ${clientId}`);
        return;
      }

      const serviceType = targetService.type || clientData.procedureType;
      let result = null;

      if (serviceType === 'hours') {
        // ── hours: requires packageId ──
        if (!packageId) {
          console.error(`❌ [timesheet-trigger] No packageId on entry ${entryId} — required for hours service. Skipping.`);
          return;
        }
        result = applyHoursDelta(services, serviceId, packageId, minutesDelta);
      } else if (serviceType === 'legal_procedure') {
        // ── legal_procedure: requires stageId ──
        if (!stageId) {
          console.error(`❌ [timesheet-trigger] No stageId on entry ${entryId} — required for legal_procedure. Skipping.`);
          return;
        }
        // Find stage to check pricingType for packageId requirement
        const targetStage = (targetService.stages || []).find((st) => st.id === stageId);
        if (!targetStage) {
          console.error(`❌ [timesheet-trigger] Stage ${stageId} not found in service ${serviceId}`);
          return;
        }
        if (targetStage.pricingType !== 'fixed' && !packageId) {
          console.error(`❌ [timesheet-trigger] No packageId on entry ${entryId} — required for hourly legal_procedure. Skipping.`);
          return;
        }
        result = applyLegalProcedureDelta(services, serviceId, stageId, packageId, minutesDelta);
      } else {
        console.warn(`⚠️ [timesheet-trigger] Unknown service type "${serviceType}" for service ${serviceId} — skipping`);
        return;
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

      console.log(`✅ [timesheet-trigger] ${eventType} processed | client=${clientId} | hoursRemaining=${agg.hoursRemaining} | isBlocked=${agg.isBlocked}`);
    });
  } catch (error) {
    console.error(`❌ [timesheet-trigger] Transaction failed for entry ${entryId}:`, error);
    throw error; // Re-throw to trigger retry
  }

  return null;
});


module.exports = {
  onTimesheetEntryChanged
};
