/**
 * DATA RECONCILIATION FIX - DRY RUN
 *
 * PURPOSE: Show what would change if we fix hoursUsed based on timesheet_entries.
 * This script does NOT write to Firestore.
 *
 * FILTERS:
 * - Only services with timesheet entries > 0
 * - Only services with actual discrepancy
 * - Limit to first 15 matches
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

async function dryRunReconciliationFix() {
  console.log('🔍 DRY RUN - Reconciliation Fix Preview\n');

  try {
    const clientsSnapshot = await db.collection('clients').get();
    console.log(`📊 Found ${clientsSnapshot.size} clients\n`);

    let totalChecked = 0;
    let totalWithEntries = 0;
    let totalWithoutEntries = 0;
    const changesPreview = [];

    for (const clientDoc of clientsSnapshot.docs) {
      const clientData = clientDoc.data();
      const clientId = clientDoc.id;
      const clientName = clientData.name || clientData.caseNumber || clientId;

      if (!clientData.services || clientData.services.length === 0) {
        continue;
      }

      for (const service of clientData.services) {
        const serviceId = service.id;
        const serviceName = service.name || service.type || serviceId;
        const hoursUsedInCard = service.hoursUsed || 0;

        if (hoursUsedInCard === 0) {
          continue;
        }

        totalChecked++;

        const timesheetQuery = await db.collection('timesheet_entries')
          .where('clientId', '==', clientId)
          .where('serviceId', '==', serviceId)
          .get();

        let totalMinutes = 0;
        timesheetQuery.forEach(doc => {
          const entry = doc.data();
          totalMinutes += entry.minutes || 0;
        });

        const hoursFromTimesheet = totalMinutes / 60;
        const difference = Math.abs(hoursUsedInCard - hoursFromTimesheet);
        const tolerance = 0.01;

        // Filter: only services WITH timesheet entries
        if (timesheetQuery.size === 0) {
          totalWithoutEntries++;
          continue;
        }

        // Filter: only services WITH discrepancy
        if (difference <= tolerance) {
          continue;
        }

        totalWithEntries++;

        // Limit to 15
        if (changesPreview.length >= 15) {
          continue;
        }

        changesPreview.push({
          clientId,
          clientName,
          serviceId,
          serviceName,
          currentHoursUsed: hoursUsedInCard.toFixed(2),
          calculatedHoursUsed: hoursFromTimesheet.toFixed(2),
          difference: difference.toFixed(2),
          timesheetEntries: timesheetQuery.size
        });

        console.log('📝 WOULD UPDATE:');
        console.log(`   Client: ${clientName} (${clientId})`);
        console.log(`   Service: ${serviceName}`);
        console.log(`   Current hoursUsed: ${hoursUsedInCard.toFixed(2)}`);
        console.log(`   Calculated hoursUsed: ${hoursFromTimesheet.toFixed(2)}`);
        console.log(`   Difference: ${difference.toFixed(2)} hours`);
        console.log(`   Based on ${timesheetQuery.size} timesheet entries`);
        console.log('');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 DRY RUN SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total services checked: ${totalChecked}`);
    console.log(`Services with mismatches AND entries: ${totalWithEntries}`);
    console.log(`Services with mismatches but NO entries (skipped): ${totalWithoutEntries}`);
    console.log(`Services shown in preview (limit 15): ${changesPreview.length}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (changesPreview.length > 0) {
      console.log('📊 Changes Preview Table:');
      console.table(changesPreview);
    }

    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log(`- ${totalWithoutEntries} services have hoursUsed but NO timesheet entries`);
    console.log('- These require manual investigation before fixing');
    console.log('- This was a DRY RUN - no data was changed');

  } catch (error) {
    console.error('❌ Error during dry run:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

dryRunReconciliationFix()
  .then(() => {
    console.log('\n✅ Dry run completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Dry run failed:', error);
    process.exit(1);
  });
