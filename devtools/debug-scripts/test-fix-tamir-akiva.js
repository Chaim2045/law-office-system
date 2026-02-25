/**
 * סקריפט בדיקה: וידוא שהתיקון פועל
 *
 * הפעל את זה בקונסול Admin Panel (לפני הפקת דוח)
 */

(async function testFix() {
    console.log('🧪 בדיקת תיקון: סיכום דוח');
    console.log('='.repeat(70));

    try {
        const db = firebase.firestore();

        // 1. בדוק את תמיר אקווע
        const clientId = '2025006';
        const clientDoc = await db.collection('clients').doc(clientId).get();

        if (!clientDoc.exists) {
            console.error('❌ לקוח לא נמצא');
            return;
        }

        const client = { id: clientDoc.id, ...clientDoc.data() };

        console.log('\n📊 נתוני הלקוח:');
        console.log(`   ID: ${client.id}`);
        console.log(`   שם: ${client.fullName}`);
        console.log(`   type: "${client.type}"`);
        console.log(`   procedureType: "${client.procedureType}"`);

        // 2. סימולציה של התנאי המתוקן
        console.log('\n🔧 סימולציה של התנאי המתוקן:');

        // התנאי הישן (לא עבד):
        const oldCondition = !(
            client.type !== 'hours' &&
            client.type !== 'legal_procedure' &&
            client.procedureType !== 'legal_procedure'
        );

        console.log(`\n   תנאי ישן: shouldShowSummary = ${oldCondition}`);
        console.log(`   ${oldCondition ? '✅' : '❌'} ${oldCondition ? 'היה מציג סיכום' : 'לא היה מציג סיכום'}`);

        // התנאי החדש (אחרי התיקון):
        const newCondition = !(
            client.type !== 'hours' &&
            client.procedureType !== 'hours' &&
            client.type !== 'legal_procedure' &&
            client.procedureType !== 'legal_procedure'
        );

        console.log(`\n   תנאי חדש: shouldShowSummary = ${newCondition}`);
        console.log(`   ${newCondition ? '✅' : '❌'} ${newCondition ? 'יציג סיכום' : 'לא יציג סיכום'}`);

        // 3. תוצאה
        console.log('\n📈 תוצאה:');
        if (oldCondition === false && newCondition === true) {
            console.log('   ✅ התיקון עובד! הסיכום יוצג עכשיו!');
        } else if (oldCondition === newCondition) {
            console.log('   ⚠️  אין שינוי בתוצאה (אולי הבעיה אחרת?)');
        } else {
            console.log('   ❌ משהו לא בסדר...');
        }

        // 4. חישוב הסיכום שאמור להיות
        console.log('\n💰 סיכום שאמור להיות:');

        let serviceTotalHours = 0;
        let serviceRemainingHours = 0;

        if (client.services && client.services.length > 0) {
            client.services.forEach(service => {
                serviceTotalHours += (service.totalHours || service.hours || 0);
                serviceRemainingHours += (service.hoursRemaining || service.remainingHours || 0);
            });
        }

        const serviceUsedHours = serviceTotalHours - serviceRemainingHours;

        console.log(`   תקציב: ${serviceTotalHours.toFixed(1)} שעות`);
        console.log(`   בוצעו: ${serviceUsedHours.toFixed(1)} שעות`);
        console.log(`   יתרה: ${serviceRemainingHours.toFixed(1)} שעות`);

        if (serviceRemainingHours < 0) {
            console.log(`   ⚠️  חריגה: ${Math.abs(serviceRemainingHours).toFixed(1)} שעות`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ בדיקה הושלמה!');
        console.log('\n💡 עכשיו הפק דוח לתמיר אקווע ובדוק שהסיכום מוצג.');

    } catch (error) {
        console.error('❌ שגיאה:', error);
    }
})();
