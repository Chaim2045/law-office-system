/**
 * Reconciliation Script — 2026-03-16
 *
 * Fixes hours data for 10 clients affected by:
 * - Bug 1: getActivePackage returning null when hoursRemaining <= -10 (override bypass)
 * - Bug 2: totalHoursWorked starting from 0 on fixed stages after reconciliation
 * - Bug 3: stages missing pricingType → trigger skipping
 *
 * Usage:
 *   node scripts/reconciliation-execute-2026-03-16.js           # DRY-RUN (default)
 *   node scripts/reconciliation-execute-2026-03-16.js --execute  # WRITE to Firestore
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const EXECUTE = process.argv.includes('--execute');
const TARGET_CLIENTS = [
  '2025562', '2025916', '2025009', '2026008', '2025366',
  '2025658', '2025153', '2025994', '2025549', '2025006'
];

// Manual service mapping for entries on tasks created without serviceId
// Approved by Tommy 2026-03-16
const MANUAL_SERVICE_MAPPING = {
  'VKMyFxmVeiwAmvcfpJid': 'srv_legal_1765742557141',  // קובי הראל — תביעה
  'YeylDbUa9Dvx9S3eJuM6': 'srv_1772921939885',        // רעות חליבה — ביה"ד לעבודה
  '7Sj6bfaejsbD8gTzG1HP': 'srv_1769776553488',         // תמיר אקווע — תיק מקרקעין
  'GkcmbKLn8QwKDOBNEp4b': 'srv_1769776553488'          // תמיר אקווע — תיק מקרקעין
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  RECONCILIATION — 2026-03-16');
  console.log(`  MODE: ${EXECUTE ? '🔴 EXECUTE (writing to Firestore)' : '🟢 DRY-RUN (read only)'}`);
  console.log(`  CLIENTS: ${TARGET_CLIENTS.length}`);
  console.log(`${'='.repeat(60)}\n`);

  let totalClientsFixed = 0;
  let totalServicesFixed = 0;
  let totalTasksFixed = 0;
  let totalErrors = 0;

  for (const clientId of TARGET_CLIENTS) {
    try {
      console.log(`\n--- Client ${clientId} ---`);

      // Step 1: Read client doc
      const clientRef = db.collection('clients').doc(clientId);
      const clientDoc = await clientRef.get();
      if (!clientDoc.exists) {
        console.log('  ⚠️ Client not found — skipping');
        continue;
      }
      const clientData = clientDoc.data();
      const clientName = clientData.clientName || clientData.name || clientId;
      const services = clientData.services || [];
      console.log(`  Name: ${clientName}`);

      // Step 2: Read all timesheet entries
      const entriesSnap = await db.collection('timesheet_entries')
        .where('clientId', '==', clientId)
        .get();
      console.log(`  Entries: ${entriesSnap.size}`);

      // Step 3: Group entries by effectiveServiceId
      const serviceMinutes = {};
      const stageMinutes = {};  // serviceId -> stageId -> minutes
      let unassignedMinutes = 0;
      let unassignedCount = 0;
      entriesSnap.forEach(doc => {
        const entry = doc.data();
        let effectiveServiceId = entry.parentServiceId || entry.serviceId;
        if (!effectiveServiceId) {
          // Check manual mapping by taskId
          const mappedServiceId = entry.taskId ? MANUAL_SERVICE_MAPPING[entry.taskId] : null;
          if (mappedServiceId) {
            effectiveServiceId = mappedServiceId;
            console.log(`  📌 Mapped entry ${doc.id} (task ${entry.taskId}) → ${mappedServiceId}`);
          } else {
            // Truly unassigned — no serviceId and no manual mapping
            unassignedMinutes += (entry.minutes || 0);
            unassignedCount++;
            return;
          }
        }

        serviceMinutes[effectiveServiceId] = (serviceMinutes[effectiveServiceId] || 0) + (entry.minutes || 0);

        // Track per-stage for legal_procedure
        // Bug 1: stageId = entry.stageId || entry.serviceId (when parentServiceId exists)
        if (entry.parentServiceId) {
          const resolvedStageId = entry.stageId || entry.serviceId;
          if (resolvedStageId) {
            if (!stageMinutes[effectiveServiceId]) {
              stageMinutes[effectiveServiceId] = {};
            }
            stageMinutes[effectiveServiceId][resolvedStageId] =
              (stageMinutes[effectiveServiceId][resolvedStageId] || 0) + (entry.minutes || 0);
          }
        }
      });

      if (unassignedCount > 0) {
        console.log(`  ⚠️ Unassigned entries (no serviceId): ${unassignedCount} entries, ${unassignedMinutes} minutes`);
      }

      // Step 4: Build updated services array
      let clientChanged = false;
      const updatedServices = services.map(svc => {
        const svcId = svc.id;
        if (!svcId) {
return svc;
}

        const totalMinutes = serviceMinutes[svcId] || 0;
        const newHoursUsed = round2(totalMinutes / 60);

        if (svc.type === 'legal_procedure') {
          // Update stages
          const updatedStages = (svc.stages || []).map(stage => {
            const stgMinutes = (stageMinutes[svcId] && stageMinutes[svcId][stage.id]) || 0;

            if (stage.pricingType === 'fixed' || (!stage.pricingType && svc.pricingType === 'fixed')) {
              // Fixed stage: update totalHoursWorked
              const newTotalHoursWorked = round2(stgMinutes / 60);
              const oldTotalHoursWorked = stage.totalHoursWorked || 0;
              if (Math.abs(newTotalHoursWorked - oldTotalHoursWorked) > 0.01) {
                console.log(`  Stage ${stage.id}: totalHoursWorked ${oldTotalHoursWorked} → ${newTotalHoursWorked}`);
                clientChanged = true;
                return { ...stage, totalHoursWorked: newTotalHoursWorked };
              }
              return stage;
            } else {
              // Hourly stage: update hoursUsed on stage
              const stgHoursUsed = round2(stgMinutes / 60);
              const oldStgHoursUsed = stage.hoursUsed || 0;

              // Update packages if they exist
              let updatedPackages = stage.packages;
              if (stage.packages && stage.packages.length > 0) {
                // Recalculate active package hoursUsed
                let remainingMinutes = stgMinutes;
                updatedPackages = stage.packages.map(pkg => {
                  const pkgTotalMinutes = (pkg.totalHours || 0) * 60;
                  const pkgUsedMinutes = Math.min(remainingMinutes, pkgTotalMinutes);
                  remainingMinutes = Math.max(0, remainingMinutes - pkgTotalMinutes);
                  const pkgHoursUsed = round2(pkgUsedMinutes / 60);
                  const pkgHoursRemaining = round2((pkg.totalHours || 0) - pkgHoursUsed);
                  return {
                    ...pkg,
                    hoursUsed: pkgHoursUsed,
                    hoursRemaining: pkgHoursRemaining
                  };
                });
              }

              if (Math.abs(stgHoursUsed - oldStgHoursUsed) > 0.01) {
                console.log(`  Stage ${stage.id}: hoursUsed ${oldStgHoursUsed} → ${stgHoursUsed}`);
                clientChanged = true;
              }

              const stgTotalHours = stage.totalHours || 0;
              return {
                ...stage,
                hoursUsed: stgHoursUsed,
                hoursRemaining: round2(stgTotalHours - stgHoursUsed),
                ...(updatedPackages !== stage.packages ? { packages: updatedPackages } : {})
              };
            }
          });

          // Service-level aggregates: use serviceMinutes as source of truth
          // This includes both stage-assigned entries AND direct-to-service entries (bug 2)
          const svcTotalMinutes = serviceMinutes[svcId] || 0;
          const svcHoursUsed = round2(svcTotalMinutes / 60);
          const oldSvcHoursUsed = svc.hoursUsed || 0;
          const svcTotalHours = svc.totalHours || 0;
          const svcHoursRemaining = round2(svcTotalHours - svcHoursUsed);

          if (Math.abs(svcHoursUsed - oldSvcHoursUsed) > 0.01) {
            console.log(`  Service ${svcId}: hoursUsed ${oldSvcHoursUsed} → ${svcHoursUsed}`);
            clientChanged = true;
            totalServicesFixed++;
          }

          return {
            ...svc,
            stages: updatedStages,
            hoursUsed: svcHoursUsed,
            hoursRemaining: svcHoursRemaining
          };

        } else {
          // hours service
          const oldHoursUsed = svc.hoursUsed || 0;
          const svcTotalHours = svc.totalHours || 0;
          const newHoursRemaining = round2(svcTotalHours - newHoursUsed);

          // Update packages
          let updatedPackages = svc.packages;
          if (svc.packages && svc.packages.length > 0) {
            let remainingMinutes = totalMinutes;
            updatedPackages = svc.packages.map(pkg => {
              const pkgTotalMinutes = (pkg.totalHours || 0) * 60;
              const pkgUsedMinutes = Math.min(remainingMinutes, pkgTotalMinutes);
              remainingMinutes = Math.max(0, remainingMinutes - pkgTotalMinutes);
              const pkgHoursUsed = round2(pkgUsedMinutes / 60);
              const pkgHoursRemaining = round2((pkg.totalHours || 0) - pkgHoursUsed);
              return {
                ...pkg,
                hoursUsed: pkgHoursUsed,
                hoursRemaining: pkgHoursRemaining
              };
            });
          }

          if (Math.abs(newHoursUsed - oldHoursUsed) > 0.01) {
            console.log(`  Service ${svcId}: hoursUsed ${oldHoursUsed} → ${newHoursUsed}`);
            clientChanged = true;
            totalServicesFixed++;
          }

          return {
            ...svc,
            hoursUsed: newHoursUsed,
            hoursRemaining: newHoursRemaining,
            ...(updatedPackages !== svc.packages ? { packages: updatedPackages } : {})
          };
        }
      });

      // Step 5: Compute client root aggregates
      const clientHoursUsed = round2(
        updatedServices.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0)
      );
      const clientTotalHours = clientData.totalHours || 0;
      const clientHoursRemaining = round2(clientTotalHours - clientHoursUsed);
      const clientMinutesUsed = round2(clientHoursUsed * 60);
      const oldClientHoursUsed = clientData.hoursUsed || 0;

      if (Math.abs(clientHoursUsed - oldClientHoursUsed) > 0.01) {
        console.log(`  Client root: hoursUsed ${oldClientHoursUsed} → ${clientHoursUsed} (gap: ${round2(clientHoursUsed - oldClientHoursUsed)})`);
        clientChanged = true;
      } else {
        console.log(`  Client root: hoursUsed ${oldClientHoursUsed} — no change`);
      }

      // Step 6: Fix task.actualMinutes
      const tasksSnap = await db.collection('budget_tasks')
        .where('clientId', '==', clientId)
        .where('status', 'in', ['פעיל', 'הושלם'])
        .get();

      // Group entries by taskId
      const taskMinutes = {};
      entriesSnap.forEach(doc => {
        const entry = doc.data();
        if (entry.taskId) {
          taskMinutes[entry.taskId] = (taskMinutes[entry.taskId] || 0) + (entry.minutes || 0);
        }
      });

      const taskUpdates = [];
      tasksSnap.forEach(doc => {
        const task = doc.data();
        const sumEntries = taskMinutes[doc.id] || 0;
        const oldActual = task.actualMinutes || 0;
        if (Math.abs(oldActual - sumEntries) > 0.5) {
          taskUpdates.push({
            ref: doc.ref,
            taskId: doc.id,
            oldActual,
            newActual: sumEntries,
            description: task.description || ''
          });
          console.log(`  Task ${doc.id}: actualMinutes ${oldActual} → ${sumEntries} (${task.description || ''})`);
        }
      });

      // Step 7: Write if EXECUTE mode
      if (clientChanged || taskUpdates.length > 0) {
        totalClientsFixed++;
        totalTasksFixed += taskUpdates.length;

        if (EXECUTE) {
          // Write client doc
          await clientRef.set({
            services: updatedServices,
            hoursUsed: clientHoursUsed,
            hoursRemaining: clientHoursRemaining,
            minutesUsed: clientMinutesUsed
          }, { merge: true });
          console.log('  ✅ Client doc updated');

          // Write tasks
          for (const tu of taskUpdates) {
            await tu.ref.update({ actualMinutes: tu.newActual });
            console.log(`  ✅ Task ${tu.taskId} updated`);
          }
        } else {
          console.log('  📋 DRY-RUN — no writes');
        }
      } else {
        console.log('  ✅ No changes needed');
      }

    } catch (err) {
      console.error(`  ❌ Error on client ${clientId}:`, err.message);
      totalErrors++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`  Mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`  Clients fixed: ${totalClientsFixed} / ${TARGET_CLIENTS.length}`);
  console.log(`  Services fixed: ${totalServicesFixed}`);
  console.log(`  Tasks fixed: ${totalTasksFixed}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
