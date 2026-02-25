/**
 * RECONCILIATION FIX - REMAINING (ALL CLIENTS)
 *
 * PURPOSE: Recalculate hoursUsed, hoursRemaining for all services + root fields
 *
 * USAGE:
 *   node reconciliation-fix-remaining.js              → DRY RUN (default)
 *   node reconciliation-fix-remaining.js --execute    → EXECUTE (write to Firestore)
 *
 * SCOPE:
 *   - services[].hoursUsed (from timesheet_entries)
 *   - services[].hoursRemaining (totalHours - hoursUsed)
 *   - root hoursUsed, hoursRemaining, minutesUsed, minutesRemaining
 *   - Does NOT touch stages or packages
 *
 * SKIP: Client 2025003 (test client)
 */

const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

const EXECUTE = process.argv.includes('--execute');
const SKIP_CLIENTS = ['2025003'];
const TOLERANCE = 0.01;

async function fixAllClients() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 RECONCILIATION FIX (ALL CLIENTS) - ${EXECUTE ? 'EXECUTE MODE' : 'DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!EXECUTE) {
    console.log('⚠️  DRY RUN MODE - No changes will be made to Firestore\n');
  }

  const backups = [];
  let clientsChanged = 0;
  let clientsUnchanged = 0;
  let servicesChanged = 0;
  let servicesSkippedManual = 0;

  try {
    // Read all clients
    const clientsSnapshot = await db.collection('clients').get();
    console.log(`📊 Found ${clientsSnapshot.size} clients\n`);

    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;

      // Skip test client
      if (SKIP_CLIENTS.includes(clientId)) {
        continue;
      }

      const clientData = clientDoc.data();
      const clientName = clientData.clientName || clientData.name || clientId;
      const services = clientData.services || [];

      if (services.length === 0) {
        continue;
      }

      // Read all timesheet entries for this client
      const timesheetSnapshot = await db.collection('timesheet_entries')
        .where('clientId', '==', clientId)
        .get();

      // Group minutes by serviceId
      const serviceMinutes = {};
      const serviceEntryCount = {};
      timesheetSnapshot.forEach(doc => {
        const entry = doc.data();
        const serviceId = entry.serviceId;
        if (serviceId) {
          serviceMinutes[serviceId] = (serviceMinutes[serviceId] || 0) + (entry.minutes || 0);
          serviceEntryCount[serviceId] = (serviceEntryCount[serviceId] || 0) + 1;
        }
      });

      // Process each service
      let clientHasChanges = false;
      const clientBackup = {
        clientId,
        clientName,
        services: [],
        root: {}
      };

      const updatedServices = services.map(service => {
        const serviceId = service.id;
        const currentHoursUsed = service.hoursUsed || 0;
        const currentHoursRemaining = service.hoursRemaining || 0;
        const totalHours = service.totalHours || service.hours || 0;
        const timesheetMins = serviceMinutes[serviceId] || 0;
        const entryCount = serviceEntryCount[serviceId] || 0;
        const calculatedHoursUsed = timesheetMins / 60;

        // SKIP: hoursUsed > 0 but 0 timesheet entries - needs manual review
        if (currentHoursUsed > 0 && entryCount === 0) {
          console.log(`   ⚠️  SKIP (manual review): ${clientId} - ${service.name || serviceId} | hoursUsed: ${currentHoursUsed.toFixed(2)} | 0 timesheet entries`);
          servicesSkippedManual++;
          return service; // Return unchanged - will be included in root calculation as-is
        }

        const calculatedHoursRemaining = totalHours - calculatedHoursUsed;
        const diffUsed = Math.abs(currentHoursUsed - calculatedHoursUsed);
        const diffRemaining = Math.abs(currentHoursRemaining - calculatedHoursRemaining);

        if (diffUsed > TOLERANCE || diffRemaining > TOLERANCE) {
          clientHasChanges = true;
          servicesChanged++;

          clientBackup.services.push({
            serviceId,
            serviceName: service.name || service.type || serviceId,
            oldHoursUsed: currentHoursUsed.toFixed(2),
            newHoursUsed: calculatedHoursUsed.toFixed(2),
            oldHoursRemaining: currentHoursRemaining.toFixed(2),
            newHoursRemaining: calculatedHoursRemaining.toFixed(2),
            totalHours,
            timesheetEntries: entryCount
          });

          console.log(`  Service: ${service.name || serviceId} | hoursUsed: ${currentHoursUsed.toFixed(2)}→${calculatedHoursUsed.toFixed(2)} | hoursRemaining: ${currentHoursRemaining.toFixed(2)}→${calculatedHoursRemaining.toFixed(2)}`);

          // Immutable update
          return {
            ...service,
            hoursUsed: calculatedHoursUsed,
            hoursRemaining: calculatedHoursRemaining
          };
        }

        return service;
      });

      // Calculate root fields from updated services
      const newRootHoursUsed = updatedServices.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
      const newRootHoursRemaining = updatedServices.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);
      const newRootMinutesUsed = newRootHoursUsed * 60;
      const newRootMinutesRemaining = newRootHoursRemaining * 60;

      const oldRootHoursUsed = clientData.hoursUsed || 0;
      const oldRootHoursRemaining = clientData.hoursRemaining || 0;
      const oldRootMinutesUsed = clientData.minutesUsed || 0;
      const oldRootMinutesRemaining = clientData.minutesRemaining || 0;

      const rootDiffUsed = Math.abs(oldRootHoursUsed - newRootHoursUsed);
      const rootDiffRemaining = Math.abs(oldRootHoursRemaining - newRootHoursRemaining);

      if (rootDiffUsed > TOLERANCE || rootDiffRemaining > TOLERANCE) {
        clientHasChanges = true;
      }

      if (clientHasChanges) {
        clientsChanged++;

        clientBackup.root = {
          oldHoursUsed: oldRootHoursUsed.toFixed(2),
          newHoursUsed: newRootHoursUsed.toFixed(2),
          oldHoursRemaining: oldRootHoursRemaining.toFixed(2),
          newHoursRemaining: newRootHoursRemaining.toFixed(2),
          oldMinutesUsed: oldRootMinutesUsed.toFixed(0),
          newMinutesUsed: newRootMinutesUsed.toFixed(0),
          oldMinutesRemaining: oldRootMinutesRemaining.toFixed(0),
          newMinutesRemaining: newRootMinutesRemaining.toFixed(0)
        };

        console.log(`[${clientId}] ${clientName}`);
        if (clientBackup.services.length === 0) {
          // Only root changed
          console.log('  (services unchanged, root recalculated)');
        }
        console.log(`  ROOT: hoursUsed: ${oldRootHoursUsed.toFixed(2)}→${newRootHoursUsed.toFixed(2)} | hoursRemaining: ${oldRootHoursRemaining.toFixed(2)}→${newRootHoursRemaining.toFixed(2)}`);

        backups.push(clientBackup);

        if (EXECUTE) {
          const clientRef = db.collection('clients').doc(clientId);
          await db.runTransaction(async (transaction) => {
            const freshDoc = await transaction.get(clientRef);
            if (!freshDoc.exists) {
              throw new Error(`Client ${clientId} disappeared during transaction`);
            }

            transaction.update(clientRef, {
              services: updatedServices,
              hoursUsed: newRootHoursUsed,
              hoursRemaining: newRootHoursRemaining,
              minutesUsed: newRootMinutesUsed,
              minutesRemaining: newRootMinutesRemaining,
              lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });
          console.log('  ✅ UPDATED\n');
        } else {
          console.log('  📝 DRY RUN\n');
        }
      } else {
        clientsUnchanged++;
      }
    }

    // Summary
    console.log(`${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Clients unchanged: ${clientsUnchanged}`);
    console.log(`Clients with changes: ${clientsChanged}`);
    console.log(`Services changed: ${servicesChanged}`);
    console.log(`Services skipped (manual review): ${servicesSkippedManual}`);

    // Save backup
    if (backups.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const backupPath = `.claude/firestore-scripts/reconciliation-remaining-backup-${timestamp}.json`;
      const backupData = {
        timestamp: new Date().toISOString(),
        mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
        clientsChanged,
        clientsUnchanged,
        servicesChanged,
        servicesSkippedManual,
        backups
      };
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      console.log(`\n💾 Backup saved to: ${backupPath}`);
    }

    if (EXECUTE) {
      console.log(`\n✅ EXECUTED — ${clientsChanged} clients, ${servicesChanged} services updated`);
    } else {
      console.log('\n⚠️  DRY RUN — No changes made to Firestore');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

fixAllClients()
  .then(() => {
    console.log('\n✅ Completed.\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
