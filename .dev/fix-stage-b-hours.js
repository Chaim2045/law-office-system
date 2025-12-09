/**
 * תיקון ידני: קיזוז שעות רטרואקטיבי לשלב ב'
 *
 * הבעיה: timesheet_entries נוצרו אבל hoursUsed לא התעדכן
 * בגלל באג ב-getActivePackage
 *
 * התיקון: סכום את כל ה-timesheet_entries של stage_b
 * ועדכן את hoursUsed/hoursRemaining בחבילה
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixStageB() {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔧 תיקון קיזוז שעות רטרואקטיבי לשלב ב\'');
    console.log('═══════════════════════════════════════════════════════\n');

    // קרא את הלקוח
    const clientDoc = await db.collection('clients').doc('2025001').get();

    if (!clientDoc.exists) {
      console.log('❌ לקוח לא נמצא');
      process.exit(1);
    }

    const clientData = clientDoc.data();
    const service = clientData.services[0]; // srv_legal_1764619302834
    const stageB = service.stages.find(s => s.id === 'stage_b');

    console.log('📊 מצב נוכחי של שלב ב\':');
    console.log(`   Hours Used: ${stageB.hoursUsed || 0}`);
    console.log(`   Hours Remaining: ${stageB.hoursRemaining || 0}`);
    console.log(`   Package Hours Used: ${stageB.packages[0].hoursUsed || 0}`);
    console.log(`   Package Hours Remaining: ${stageB.packages[0].hoursRemaining || 0}\n`);

    // קרא את כל ה-timesheet entries של stage_b
    const timesheetSnapshot = await db.collection('timesheet_entries')
      .where('clientId', '==', '2025001')
      .where('serviceId', '==', 'stage_b')
      .get();

    console.log(`🔍 נמצאו ${timesheetSnapshot.size} רשומות שעתון לשלב ב'\n`);

    let totalMinutes = 0;
    timesheetSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   • ${data.minutes} דקות (${(data.minutes / 60).toFixed(2)} שעות)`);
      totalMinutes += data.minutes;
    });

    const totalHours = totalMinutes / 60;
    console.log(`\n📊 סה"כ: ${totalMinutes} דקות = ${totalHours.toFixed(2)} שעות\n`);

    // חשב את השעות החדשות
    const packageTotalHours = stageB.packages[0].hours || 22;
    const newHoursRemaining = packageTotalHours - totalHours;

    console.log('✅ עדכון מתוכנן:');
    console.log(`   Hours Used: ${totalHours.toFixed(2)}`);
    console.log(`   Hours Remaining: ${newHoursRemaining.toFixed(2)}`);
    console.log(`   Minutes Used: ${totalMinutes}`);
    console.log(`   Minutes Remaining: ${(newHoursRemaining * 60).toFixed(0)}\n`);

    // עדכן את ה-client
    const updatedPackage = {
      ...stageB.packages[0],
      hoursUsed: totalHours,
      hoursRemaining: newHoursRemaining
    };

    const updatedStage = {
      ...stageB,
      packages: [updatedPackage],
      hoursUsed: totalHours,
      hoursRemaining: newHoursRemaining,
      minutesUsed: totalMinutes,
      minutesRemaining: Math.floor(newHoursRemaining * 60)
    };

    const updatedStages = service.stages.map(s =>
      s.id === 'stage_b' ? updatedStage : s
    );

    const updatedService = {
      ...service,
      stages: updatedStages,
      hoursUsed: (service.hoursUsed || 0) + totalHours, // נוסיף את השעות של שלב ב' לסה"כ
      hoursRemaining: (service.hoursRemaining || service.totalHours || 66) - totalHours
    };

    const updatedServices = clientData.services.map(s =>
      s.id === service.id ? updatedService : s
    );

    await clientDoc.ref.update({
      services: updatedServices,
      lastActivity: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ עדכון הושלם בהצלחה!\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 מצב אחרי התיקון:');
    console.log('═══════════════════════════════════════════════════════');

    // קרא שוב את הנתונים
    const updatedClientDoc = await db.collection('clients').doc('2025001').get();
    const updatedClientData = updatedClientDoc.data();
    const updatedServiceData = updatedClientData.services[0];
    const updatedStageData = updatedServiceData.stages.find(s => s.id === 'stage_b');

    console.log('\nשלב ב\':');
    console.log(`   Hours Used: ${updatedStageData.hoursUsed || 0}`);
    console.log(`   Hours Remaining: ${updatedStageData.hoursRemaining || 0}`);
    console.log(`   Package Hours Used: ${updatedStageData.packages[0].hoursUsed || 0}`);
    console.log(`   Package Hours Remaining: ${updatedStageData.packages[0].hoursRemaining || 0}`);
    console.log('');

  } catch (error) {
    console.error('❌ שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

fixStageB();
