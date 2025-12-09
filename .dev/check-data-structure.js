/**
 * 🔍 Data Structure Checker
 *
 * בודק את מבני הנתונים של הלקוחות במערכת
 * מזהה לקוחות עם מבנה ישן vs חדש
 */

(function() {
  'use strict';

  window.DataStructureChecker = {

    async checkAll() {
      console.log('🔍 בודק מבני נתונים של לקוחות...\n');
      console.log('='.repeat(80));

      try {
        const db = firebase.firestore();
        const clientsSnapshot = await db.collection('clients').get();

        const stats = {
          total: 0,

          // caseNumber
          withCaseNumber: 0,
          withoutCaseNumber: 0,

          // שדה שם
          withClientName: 0,
          withFullName: 0,
          withBothNames: 0,
          withoutName: 0,

          // מבנה שירותים
          withServices: 0,          // מבנה חדש - יש services[]
          withoutServices: 0,       // מבנה ישן - אין services[]

          // מבנה stages ישן
          withLegacyStages: 0,      // stages[] ברמת הלקוח (ישן!)
          withoutLegacyStages: 0,   // אין stages ברמת הלקוח

          // סוג הליך
          legalProcedure: 0,
          hourly: 0,
          fixed: 0,
          unknown: 0,

          // דוגמאות
          examplesLegacy: [],
          examplesNew: [],
          examplesProblematic: []
        };

        clientsSnapshot.forEach(doc => {
          stats.total++;
          const data = doc.data();
          const id = doc.id;

          // בדיקת caseNumber
          if (data.caseNumber) {
            stats.withCaseNumber++;
          } else {
            stats.withoutCaseNumber++;
          }

          // בדיקת שדה שם
          const hasClientName = !!data.clientName;
          const hasFullName = !!data.fullName;

          if (hasClientName && hasFullName) {
            stats.withBothNames++;
          } else if (hasClientName) {
            stats.withClientName++;
          } else if (hasFullName) {
            stats.withFullName++;
          } else {
            stats.withoutName++;
          }

          // בדיקת מבנה שירותים
          const hasServices = data.services && Array.isArray(data.services) && data.services.length > 0;
          const hasLegacyStages = data.stages && Array.isArray(data.stages) && data.stages.length > 0;

          if (hasServices) {
            stats.withServices++;
          } else {
            stats.withoutServices++;
          }

          if (hasLegacyStages) {
            stats.withLegacyStages++;
          } else {
            stats.withoutLegacyStages++;
          }

          // בדיקת סוג
          if (data.procedureType === 'legal_procedure') {
            stats.legalProcedure++;
          } else if (data.procedureType === 'hours') {
            stats.hourly++;
          } else if (data.pricingType === 'fixed') {
            stats.fixed++;
          } else {
            stats.unknown++;
          }

          // איסוף דוגמאות
          const isLegacy = hasLegacyStages && !hasServices;
          const isNew = hasServices && !hasLegacyStages;
          const isProblematic = (hasLegacyStages && hasServices) || (!hasClientName && !hasFullName);

          if (isLegacy && stats.examplesLegacy.length < 3) {
            stats.examplesLegacy.push({
              id,
              name: data.clientName || data.fullName,
              caseNumber: data.caseNumber,
              hasStages: hasLegacyStages,
              hasServices: hasServices
            });
          }

          if (isNew && stats.examplesNew.length < 3) {
            stats.examplesNew.push({
              id,
              name: data.clientName || data.fullName,
              caseNumber: data.caseNumber,
              hasStages: hasLegacyStages,
              hasServices: hasServices,
              servicesCount: hasServices ? data.services.length : 0
            });
          }

          if (isProblematic && stats.examplesProblematic.length < 5) {
            stats.examplesProblematic.push({
              id,
              name: data.clientName || data.fullName,
              caseNumber: data.caseNumber,
              hasStages: hasLegacyStages,
              hasServices: hasServices,
              hasClientName,
              hasFullName,
              reason: (hasLegacyStages && hasServices)
                ? 'יש גם stages וגם services - כפילות!'
                : 'חסר שם לקוח'
            });
          }
        });

        // הדפסת תוצאות
        console.log('\n📊 סטטיסטיקה כללית:');
        console.log('─'.repeat(80));
        console.log(`סה"כ לקוחות: ${stats.total}\n`);

        console.log('🔢 מספר תיק (caseNumber):');
        console.log(`  ✅ עם caseNumber: ${stats.withCaseNumber} (${((stats.withCaseNumber/stats.total)*100).toFixed(1)}%)`);
        console.log(`  ❌ ללא caseNumber: ${stats.withoutCaseNumber} (${((stats.withoutCaseNumber/stats.total)*100).toFixed(1)}%)\n`);

        console.log('👤 שדה שם:');
        console.log(`  ✅ clientName בלבד: ${stats.withClientName}`);
        console.log(`  ⚠️  fullName בלבד: ${stats.withFullName}`);
        console.log(`  🔄 שני השדות: ${stats.withBothNames}`);
        console.log(`  ❌ ללא שם כלל: ${stats.withoutName}\n`);

        console.log('🏗️ מבנה נתונים:');
        console.log(`  ✅ עם services[] (חדש): ${stats.withServices} (${((stats.withServices/stats.total)*100).toFixed(1)}%)`);
        console.log(`  ❌ ללא services[] (ישן): ${stats.withoutServices} (${((stats.withoutServices/stats.total)*100).toFixed(1)}%)`);
        console.log(`  🔴 עם stages[] ברמת לקוח (LEGACY!): ${stats.withLegacyStages} (${((stats.withLegacyStages/stats.total)*100).toFixed(1)}%)`);
        console.log(`  ✅ ללא stages ברמת לקוח: ${stats.withoutLegacyStages}\n`);

        console.log('⚖️ סוג הליך:');
        console.log(`  הליך משפטי: ${stats.legalProcedure}`);
        console.log(`  שעתי: ${stats.hourly}`);
        console.log(`  פיקס: ${stats.fixed}`);
        console.log(`  לא מוגדר: ${stats.unknown}\n`);

        // דוגמאות
        if (stats.examplesLegacy.length > 0) {
          console.log('🔴 דוגמאות למבנה LEGACY (stages ברמת לקוח):');
          stats.examplesLegacy.forEach((ex, i) => {
            console.log(`  ${i+1}. ${ex.id} - ${ex.name || 'ללא שם'}`);
            console.log(`     caseNumber: ${ex.caseNumber || 'אין'}`);
            console.log(`     stages: ${ex.hasStages ? 'כן' : 'לא'} | services: ${ex.hasServices ? 'כן' : 'לא'}`);
          });
          console.log('');
        }

        if (stats.examplesNew.length > 0) {
          console.log('✅ דוגמאות למבנה חדש (services[]):');
          stats.examplesNew.forEach((ex, i) => {
            console.log(`  ${i+1}. ${ex.id} - ${ex.name || 'ללא שם'}`);
            console.log(`     caseNumber: ${ex.caseNumber || 'אין'}`);
            console.log(`     services: ${ex.servicesCount} שירותים`);
          });
          console.log('');
        }

        if (stats.examplesProblematic.length > 0) {
          console.log('⚠️ לקוחות בעייתיים (צריך תיקון!):');
          stats.examplesProblematic.forEach((ex, i) => {
            console.log(`  ${i+1}. ${ex.id} - ${ex.name || 'ללא שם'}`);
            console.log(`     סיבה: ${ex.reason}`);
            console.log(`     stages: ${ex.hasStages ? 'כן' : 'לא'} | services: ${ex.hasServices ? 'כן' : 'לא'}`);
            console.log(`     clientName: ${ex.hasClientName ? 'כן' : 'לא'} | fullName: ${ex.hasFullName ? 'כן' : 'לא'}`);
          });
          console.log('');
        }

        console.log('='.repeat(80));

        // החלטה האם בטוח למחוק קוד legacy
        const isSafeToCleanup = stats.withLegacyStages === 0 && stats.withoutCaseNumber === 0;

        console.log('\n🎯 המלצה:');
        if (isSafeToCleanup) {
          console.log('  ✅ בטוח למחוק קוד Legacy - כל הלקוחות במבנה החדש!');
        } else {
          console.log('  ⚠️ לא בטוח למחוק קוד Legacy!');
          if (stats.withLegacyStages > 0) {
            console.log(`     - יש ${stats.withLegacyStages} לקוחות עם stages ברמת לקוח`);
          }
          if (stats.withoutCaseNumber > 0) {
            console.log(`     - יש ${stats.withoutCaseNumber} לקוחות ללא caseNumber`);
          }
          console.log('\n  💡 הצעה:');
          console.log('     1. הרץ: await FixOldClients.fixAll({ dryRun: true })');
          console.log('     2. אם הכל נראה טוב: await FixOldClients.fixAll()');
          console.log('     3. הרץ שוב: await DataStructureChecker.checkAll()');
        }

        console.log('\n');

        return {
          stats,
          isSafeToCleanup,
          recommendation: isSafeToCleanup
            ? 'SAFE_TO_CLEANUP'
            : 'NEED_MIGRATION'
        };

      } catch (error) {
        console.error('❌ שגיאה:', error.message);
        throw error;
      }
    }
  };

  // הודעת טעינה
  if (!window.PRODUCTION_MODE) {
    console.log(`
🔍 Data Structure Checker Loaded!

Usage:
  await DataStructureChecker.checkAll()  - בדוק את כל מבני הנתונים

Example:
  const result = await DataStructureChecker.checkAll();
  if (result.isSafeToCleanup) {
    console.log('✅ Safe to delete legacy code!');
  }
    `);
  }

})();
