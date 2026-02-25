/**
 * DATA RECONCILIATION CHECK
 *
 * PURPOSE: Read-only script to verify data integrity between:
 * - clients.services[].hoursUsed (aggregated field)
 * - SUM(timesheet_entries.minutes) grouped by clientId + serviceId
 *
 * This script does NOT write to Firestore.
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

async function checkReconciliation() {
  console.log('🔍 Starting Data Reconciliation Check...\n');

  try {
    // Step 1: Get all clients with services
    const clientsSnapshot = await db.collection('clients').get();
    console.log(`📊 Found ${clientsSnapshot.size} clients\n`);

    let totalClientsChecked = 0;
    let totalServicesChecked = 0;
    let totalMismatches = 0;
    const mismatches = [];

    // Step 2: For each client
    for (const clientDoc of clientsSnapshot.docs) {
      const clientData = clientDoc.data();
      const clientId = clientDoc.id;
      const clientName = clientData.name || clientData.caseNumber || clientId;

      // Skip clients without services
      if (!clientData.services || clientData.services.length === 0) {
        continue;
      }

      totalClientsChecked++;

      // Step 3: For each service with hoursUsed > 0
      for (const service of clientData.services) {
        const serviceId = service.id;
        const serviceName = service.name || service.type || serviceId;
        const hoursUsedInCard = service.hoursUsed || 0;

        // Skip services with no hours used
        if (hoursUsedInCard === 0) {
          continue;
        }

        totalServicesChecked++;

        // Step 4: Query timesheet_entries for this clientId + serviceId
        const timesheetQuery = await db.collection('timesheet_entries')
          .where('clientId', '==', clientId)
          .where('serviceId', '==', serviceId)
          .get();

        // Step 5: Calculate SUM(minutes) from timesheet_entries
        let totalMinutes = 0;
        timesheetQuery.forEach(doc => {
          const entry = doc.data();
          totalMinutes += entry.minutes || 0;
        });

        const hoursFromTimesheet = totalMinutes / 60;

        // Step 6: Check for discrepancy
        const difference = Math.abs(hoursUsedInCard - hoursFromTimesheet);
        const tolerance = 0.01; // 1 minute tolerance

        if (difference > tolerance) {
          totalMismatches++;

          const mismatch = {
            clientId,
            clientName,
            serviceId,
            serviceName,
            hoursUsedInCard: hoursUsedInCard.toFixed(2),
            hoursFromTimesheet: hoursFromTimesheet.toFixed(2),
            difference: difference.toFixed(2),
            timesheetEntries: timesheetQuery.size
          };

          mismatches.push(mismatch);

          console.log('❌ MISMATCH FOUND:');
          console.log(`   Client: ${clientName} (${clientId})`);
          console.log(`   Service: ${serviceName} (${serviceId})`);
          console.log(`   hoursUsed in card: ${hoursUsedInCard.toFixed(2)}`);
          console.log(`   SUM(minutes) from timesheet: ${hoursFromTimesheet.toFixed(2)}`);
          console.log(`   Difference: ${difference.toFixed(2)} hours`);
          console.log(`   Timesheet entries: ${timesheetQuery.size}`);
          console.log('');
        }
      }
    }

    // Step 7: Summary Report
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 RECONCILIATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total clients checked: ${totalClientsChecked}`);
    console.log(`Total services checked (with hoursUsed > 0): ${totalServicesChecked}`);
    console.log(`Total mismatches found: ${totalMismatches}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (totalMismatches === 0) {
      console.log('✅ All data is reconciled correctly!');
    } else {
      console.log(`⚠️  Found ${totalMismatches} discrepancies that need investigation.`);
      console.log('\nDetailed mismatches:');
      console.table(mismatches);
    }

  } catch (error) {
    console.error('❌ Error during reconciliation check:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

// Run the check
checkReconciliation()
  .then(() => {
    console.log('\n✅ Reconciliation check completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Reconciliation check failed:', error);
    process.exit(1);
  });
