/**
 * RECONCILIATION FIX - EXECUTE
 *
 * PURPOSE: Fix hoursUsed in 12 client services based on timesheet_entries
 *
 * USAGE:
 *   node reconciliation-fix-execute.js              → DRY RUN (default)
 *   node reconciliation-fix-execute.js --execute    → EXECUTE (write to Firestore)
 *
 * SCOPE: Only fixes services[].hoursUsed at top level
 *        Does NOT touch stages or packages
 *
 * CLIENTS: 12 clients with discrepancies
 */

const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

// Execution mode
const EXECUTE = process.argv.includes('--execute');

// The 12 clients with discrepancies
const CLIENT_IDS = [
  '2025006',
  '2025011',
  '2025430',
  '2025549',
  '2025634',
  '2025863',
  '2025998',
  '2026008',
  '2026018',
  '2026019',
  '2026022',
  '2026030'
];

async function fixReconciliation() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 RECONCILIATION FIX - ${EXECUTE ? 'EXECUTE MODE' : 'DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!EXECUTE) {
    console.log('⚠️  DRY RUN MODE - No changes will be made to Firestore');
    console.log('   Run with --execute to apply changes\n');
  }

  const backups = [];
  let servicesFixed = 0;
  let servicesSkipped = 0;

  try {
    for (const clientId of CLIENT_IDS) {
      console.log(`\n📋 Processing client: ${clientId}`);

      // Step 1: Read client doc
      const clientRef = db.collection('clients').doc(clientId);
      const clientDoc = await clientRef.get();

      if (!clientDoc.exists) {
        console.log(`   ⚠️  Client ${clientId} not found - SKIP`);
        continue;
      }

      const clientData = clientDoc.data();
      const clientName = clientData.name || clientData.caseNumber || clientId;

      if (!clientData.services || clientData.services.length === 0) {
        console.log(`   ℹ️  Client ${clientName} has no services - SKIP`);
        continue;
      }

      // Step 2: Read all timesheet entries for this client
      const timesheetQuery = await db.collection('timesheet_entries')
        .where('clientId', '==', clientId)
        .get();

      console.log(`   📊 Found ${timesheetQuery.size} timesheet entries`);

      // Step 3: Group by serviceId and calculate SUM(minutes)
      const serviceMinutes = {};
      timesheetQuery.forEach(doc => {
        const entry = doc.data();
        const serviceId = entry.serviceId;

        if (serviceId) {
          if (!serviceMinutes[serviceId]) {
            serviceMinutes[serviceId] = 0;
          }
          serviceMinutes[serviceId] += entry.minutes || 0;
        }
      });

      // Step 4: Check each service for discrepancies
      let hasChanges = false;
      const updatedServices = clientData.services.map(service => {
        const serviceId = service.id;
        const currentHoursUsed = service.hoursUsed || 0;
        const timesheetMinutes = serviceMinutes[serviceId] || 0;
        const calculatedHoursUsed = timesheetMinutes / 60;
        const difference = Math.abs(currentHoursUsed - calculatedHoursUsed);
        const tolerance = 0.01;

        // SKIP: If service has hoursUsed > 0 but 0 timesheet entries - needs manual review
        if (currentHoursUsed > 0 && timesheetMinutes === 0) {
          console.log(`   ⚠️  SKIP (manual review): ${service.name || serviceId} | hoursUsed: ${currentHoursUsed.toFixed(2)} | 0 timesheet entries`);
          servicesSkipped++;
          return service;
        }

        if (difference > tolerance) {
          // Found discrepancy - prepare backup and fix
          const backup = {
            clientId,
            clientName,
            serviceId,
            serviceName: service.name || service.type || serviceId,
            oldHoursUsed: currentHoursUsed.toFixed(2),
            newHoursUsed: calculatedHoursUsed.toFixed(2),
            difference: difference.toFixed(2),
            timesheetEntries: timesheetQuery.size
          };

          backups.push(backup);
          servicesFixed++;
          hasChanges = true;

          console.log(`   🔄 WILL FIX: ${service.name || serviceId}`);
          console.log(`      Old hoursUsed: ${currentHoursUsed.toFixed(2)}`);
          console.log(`      New hoursUsed: ${calculatedHoursUsed.toFixed(2)}`);
          console.log(`      Difference: ${difference.toFixed(2)}`);

          // Return updated service (immutable pattern)
          return {
            ...service,
            hoursUsed: calculatedHoursUsed
          };
        } else {
          // No discrepancy - skip
          servicesSkipped++;
          return service;
        }
      });

      // Step 5: Update client doc if there are changes
      if (hasChanges) {
        if (EXECUTE) {
          // Use transaction for atomic update
          await db.runTransaction(async (transaction) => {
            // Re-read client doc in transaction
            const freshClientDoc = await transaction.get(clientRef);

            if (!freshClientDoc.exists) {
              throw new Error(`Client ${clientId} disappeared during transaction`);
            }

            // Update only services array
            transaction.update(clientRef, {
              services: updatedServices,
              lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });

          console.log(`   ✅ UPDATED client ${clientName}`);
        } else {
          console.log(`   📝 DRY RUN - would update client ${clientName}`);
        }
      } else {
        console.log(`   ✅ No discrepancies found for client ${clientName}`);
      }
    }

    // Summary Report
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Clients processed: ${CLIENT_IDS.length}`);
    console.log(`Services with discrepancies: ${servicesFixed}`);
    console.log(`Services without discrepancies (skipped): ${servicesSkipped}`);

    if (backups.length > 0) {
      console.log(`\n📋 BACKUP DATA (${backups.length} services):`);
      console.table(backups);

      // Save backup to file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const backupPath = `.claude/firestore-scripts/reconciliation-backup-${timestamp}.json`;
      const backupData = {
        timestamp: new Date().toISOString(),
        mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
        clientsProcessed: CLIENT_IDS.length,
        servicesFixed,
        servicesSkipped,
        backups
      };
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      console.log(`💾 Backup saved to: ${backupPath}`);
    }

    if (EXECUTE) {
      console.log(`\n✅ EXECUTED — ${servicesFixed} services updated`);
    } else {
      console.log('\n⚠️  DRY RUN — No changes made to Firestore');
      console.log('   Run with --execute to apply changes');
    }

  } catch (error) {
    console.error('\n❌ Error during reconciliation fix:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

fixReconciliation()
  .then(() => {
    console.log(`\n✅ Reconciliation fix ${EXECUTE ? 'executed' : 'dry run'} completed.\n`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Reconciliation fix failed:', error);
    process.exit(1);
  });
