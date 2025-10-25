/**
 * כלי מיגרציה למנהלים
 *
 * להריץ דרך Console:
 * 1. פתח את index.html והתחבר כמנהל
 * 2. פתח Console (F12)
 * 3. הקלד: MigrationTools.runDryRun()
 * או: MigrationTools.runMigration()
 */

window.MigrationTools = {
  /**
   * הרצת בדיקה (ללא שינויים)
   */
  async runDryRun() {
    console.log('🔍 מתחיל בדיקת מיגרציה (Dry Run)...');

    try {
      const migrateFn = firebase.functions().httpsCallable('migrateCasesToClients');
      const result = await migrateFn({
        dryRun: true,
        skipExisting: true
      });

      console.log('\n✅ בדיקה הושלמה בהצלחה!\n');
      console.log('📊 סטטיסטיקות:');
      console.log(`   • סה"כ תיקים: ${result.data.totalCases}`);
      console.log(`   • ייווצרו: ${result.data.created}`);
      console.log(`   • יעודכנו: ${result.data.updated}`);
      console.log(`   • ידולגו: ${result.data.skipped}`);
      console.log(`   • שגיאות: ${result.data.errors}`);

      if (result.data.errorDetails && result.data.errorDetails.length > 0) {
        console.warn('\n⚠️ שגיאות שנמצאו:');
        result.data.errorDetails.forEach(err => console.warn(`   • ${err}`));
      }

      if (result.data.migratedClients && result.data.migratedClients.length > 0) {
        console.log('\n📋 תיקים שיועברו:');
        result.data.migratedClients.slice(0, 10).forEach(client => {
          console.log(`   ${client.action === 'create' ? '✅' : '🔄'} ${client.clientId}: ${client.clientName}`);
        });
        if (result.data.migratedClients.length > 10) {
          console.log(`   ... ועוד ${result.data.migratedClients.length - 10} תיקים`);
        }
      }

      console.log('\n💡 זוהי בדיקה בלבד - לא בוצעו שינויים!');
      console.log('להרצת מיגרציה אמיתית: MigrationTools.runMigration()');

      return result.data;

    } catch (error) {
      console.error('\n❌ שגיאה בבדיקת מיגרציה:', error.message);
      throw error;
    }
  },

  /**
   * הרצת מיגרציה אמיתית
   */
  async runMigration() {
    const confirmed = confirm(
      '⚠️ האם אתה בטוח שאתה רוצה להריץ מיגרציה אמיתית?\n\n' +
      'פעולה זו תעתיק את כל התיקים מ-cases ל-clients collection.\n\n' +
      'מומלץ להריץ קודם: MigrationTools.runDryRun()'
    );

    if (!confirmed) {
      console.log('❌ מיגרציה בוטלה');
      return;
    }

    console.log('🚀 מתחיל מיגרציה אמיתית...');

    try {
      const migrateFn = firebase.functions().httpsCallable('migrateCasesToClients');
      const result = await migrateFn({
        dryRun: false,
        skipExisting: true
      });

      console.log('\n✅ מיגרציה הושלמה בהצלחה!\n');
      console.log('📊 סטטיסטיקות:');
      console.log(`   • סה"כ תיקים: ${result.data.totalCases}`);
      console.log(`   • נוצרו: ${result.data.created}`);
      console.log(`   • עודכנו: ${result.data.updated}`);
      console.log(`   • דולגו: ${result.data.skipped}`);
      console.log(`   • שגיאות: ${result.data.errors}`);

      if (result.data.errorDetails && result.data.errorDetails.length > 0) {
        console.warn('\n⚠️ שגיאות שנמצאו:');
        result.data.errorDetails.forEach(err => console.warn(`   • ${err}`));
      }

      console.log('\n🎉 המיגרציה הושלמה!');
      console.log('✅ כל התיקים הועברו ל-clients collection');

      return result.data;

    } catch (error) {
      console.error('\n❌ שגיאה במיגרציה:', error.message);
      throw error;
    }
  },

  /**
   * בדיקת מצב - כמה תיקים יש ב-cases וב-clients
   */
  async checkStatus() {
    console.log('📊 בודק מצב נוכחי...\n');

    try {
      const db = firebase.firestore();

      const casesSnapshot = await db.collection('cases').get();
      const clientsSnapshot = await db.collection('clients').get();

      console.log(`📁 cases collection (LEGACY): ${casesSnapshot.size} מסמכים`);
      console.log(`📁 clients collection (NEW - Client=Case): ${clientsSnapshot.size} מסמכים`);

      // ספירת clients עם caseNumber
      let clientsWithCaseNumber = 0;
      clientsSnapshot.forEach(doc => {
        if (doc.data().caseNumber) {
          clientsWithCaseNumber++;
        }
      });

      console.log(`   • מתוכם ${clientsWithCaseNumber} עם caseNumber (הועברו ממיגרציה)`);

      return {
        casesCount: casesSnapshot.size,
        clientsCount: clientsSnapshot.size,
        migratedCount: clientsWithCaseNumber
      };

    } catch (error) {
      console.error('❌ שגיאה בבדיקת מצב:', error.message);
      throw error;
    }
  }
};

// הדפסת הוראות שימוש
console.log(`
🔧 כלי מיגרציה זמינים:

1️⃣ בדיקת מצב:
   MigrationTools.checkStatus()

2️⃣ בדיקת מיגרציה (ללא שינויים):
   MigrationTools.runDryRun()

3️⃣ הרצת מיגרציה אמיתית:
   MigrationTools.runMigration()

💡 מומלץ להריץ בסדר הזה!
`);
