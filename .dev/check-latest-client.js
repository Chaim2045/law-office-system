/**
 * בדיקת הלקוח האחרון שנוצר
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkLatestClient() {
  try {
    console.log('🔍 מחפש את הלקוח האחרון...\n');

    const snapshot = await db.collection('clients')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('❌ לא נמצאו לקוחות');
      process.exit(1);
    }

    const clientDoc = snapshot.docs[0];
    const clientData = clientDoc.data();

    console.log('═══════════════════════════════════════════════════');
    console.log('📋 LATEST CLIENT');
    console.log('═══════════════════════════════════════════════════');
    console.log('ID:', clientDoc.id);
    console.log('Name:', clientData.fullName);
    console.log('Procedure Type:', clientData.procedureType);
    console.log('\n');

    // בדיקת services
    if (clientData.services && Array.isArray(clientData.services)) {
      console.log('═══════════════════════════════════════════════════');
      console.log('🎯 SERVICES');
      console.log('═══════════════════════════════════════════════════');
      console.log('Total services:', clientData.services.length);

      clientData.services.forEach((service, idx) => {
        console.log(`\n[Service ${idx + 1}]`);
        console.log('  ID:', service.id);
        console.log('  Type:', service.type);
        console.log('  Name:', service.name || 'N/A');
        console.log('  Current Stage:', service.currentStage || 'N/A');

        // בדיקת stages
        if (service.stages && Array.isArray(service.stages)) {
          console.log('\n  📌 STAGES:');
          service.stages.forEach((stage, sIdx) => {
            console.log(`\n    [Stage ${sIdx + 1}] ${stage.id}`);
            console.log('      Status:', stage.status);
            console.log('      Total Hours:', stage.totalHours || 0);
            console.log('      Hours Used:', stage.hoursUsed || 0);
            console.log('      Hours Remaining:', stage.hoursRemaining || 0);

            // בדיקת packages
            if (stage.packages && Array.isArray(stage.packages)) {
              console.log('      \n      📦 PACKAGES:');
              stage.packages.forEach((pkg, pIdx) => {
                console.log(`\n        [Package ${pIdx + 1}]`);
                console.log('          Hours:', pkg.hours || 0);
                console.log('          Hours Used:', pkg.hoursUsed || 0);
                console.log('          Hours Remaining:', pkg.hoursRemaining || 0);
                console.log('          Status:', pkg.status || 'N/A');
              });
            }
          });
        }
      });
    }

    // בדיקת timesheet entries
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('⏰ TIMESHEET ENTRIES');
    console.log('═══════════════════════════════════════════════════');

    const timesheetSnapshot = await db.collection('timesheet_entries')
      .where('clientId', '==', clientDoc.id)
      .orderBy('date', 'desc')
      .get();

    console.log('Total entries:', timesheetSnapshot.size);

    timesheetSnapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n[Entry ${idx + 1}]`);
      console.log('  Service ID:', data.serviceId || 'N/A');
      console.log('  Service Name:', data.serviceName || 'N/A');
      console.log('  Parent Service ID:', data.parentServiceId || 'N/A');
      console.log('  Minutes:', data.minutes || 0);
      console.log('  Hours:', (data.minutes / 60).toFixed(2) || 0);
      console.log('  Date:', data.date || 'N/A');
    });

    console.log('\n═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkLatestClient();
