const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkClientData() {
  try {
    console.log('🔍 Checking client data for "חיים פרץ"...\n');

    // Find client by name
    const clientsSnapshot = await db.collection('clients')
      .where('fullName', '==', 'חיים פרץ')
      .limit(1)
      .get();

    if (clientsSnapshot.empty) {
      console.log('❌ Client not found!');
      return;
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientData = clientDoc.data();

    console.log('═══════════════════════════════════════════════════');
    console.log('📋 CLIENT DATA');
    console.log('═══════════════════════════════════════════════════');
    console.log('ID:', clientDoc.id);
    console.log('Name:', clientData.fullName);
    console.log('Procedure Type:', clientData.procedureType);
    console.log('\n');

    // Check services array
    if (clientData.services && Array.isArray(clientData.services)) {
      console.log('═══════════════════════════════════════════════════');
      console.log('🎯 SERVICES ARRAY');
      console.log('═══════════════════════════════════════════════════');
      console.log('Total services:', clientData.services.length);

      clientData.services.forEach((service, idx) => {
        console.log(`\n[Service ${idx + 1}]`);
        console.log('  ID:', service.id);
        console.log('  Type:', service.type);
        console.log('  Name:', service.name || 'N/A');
        console.log('  Status:', service.status);
        console.log('  Current Stage:', service.currentStage || 'N/A');

        // Check stages
        if (service.stages && Array.isArray(service.stages)) {
          console.log('\n  📌 STAGES:');
          service.stages.forEach((stage, sIdx) => {
            console.log(`\n    [Stage ${sIdx + 1}]`);
            console.log('      ID:', stage.id);
            console.log('      Status:', stage.status);
            console.log('      Total Hours:', stage.totalHours || 0);
            console.log('      Hours Used:', stage.hoursUsed || 0);
            console.log('      Hours Remaining:', stage.hoursRemaining || 0);

            // Check packages
            if (stage.packages && Array.isArray(stage.packages)) {
              console.log('      Packages:', stage.packages.length);
              stage.packages.forEach((pkg, pIdx) => {
                console.log(`\n        [Package ${pIdx + 1}]`);
                console.log('          Hours:', pkg.hours || 0);
                console.log('          Hours Used:', pkg.hoursUsed || 0);
                console.log('          Hours Remaining:', pkg.hoursRemaining || 0);
                console.log('          Status:', pkg.status || 'N/A');
              });
            } else {
              console.log('      Packages: NONE');
            }
          });
        } else {
          console.log('  Stages: NONE');
        }
      });
    } else {
      console.log('❌ No services array found!');
    }

    // Check timesheet entries
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('⏰ TIMESHEET ENTRIES');
    console.log('═══════════════════════════════════════════════════');

    const timesheetSnapshot = await db.collection('timesheet_entries')
      .where('clientName', '==', 'חיים פרץ')
      .orderBy('date', 'desc')
      .limit(5)
      .get();

    console.log('Total entries found:', timesheetSnapshot.size);

    timesheetSnapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n[Entry ${idx + 1}]`);
      console.log('  ID:', doc.id);
      console.log('  Service ID:', data.serviceId || 'N/A');
      console.log('  Service Name:', data.serviceName || 'N/A');
      console.log('  Service Type:', data.serviceType || 'N/A');
      console.log('  Parent Service ID:', data.parentServiceId || 'N/A');
      console.log('  Minutes:', data.minutes || 0);
      console.log('  Date:', data.date || 'N/A');
    });

    console.log('\n═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkClientData();
