/**
 * בדיקה: מתי נוסף hoursUsed לשירותים?
 * האם זה היה בעבר או שזה שדה חדש?
 */

(async function checkWhenHoursUsedAdded() {
    console.log('🔍 בדיקה: מתי נוסף hoursUsed לשירותים?');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();

        // בדוק כמה לקוחות יש
        const clientsSnapshot = await db.collection('clients').get();
        console.log(`\nסה"כ לקוחות: ${clientsSnapshot.size}`);

        // ספירת לקוחות עם services
        let clientsWithServices = 0;
        let servicesWithHoursUsed = 0;
        let servicesWithoutHoursUsed = 0;
        let mismatchedServices = 0;

        console.log('\n📊 בדיקת כל הלקוחות...\n');

        for (const clientDoc of clientsSnapshot.docs) {
            const clientData = clientDoc.data();

            if (!clientData.services || clientData.services.length === 0) {
                continue;
            }

            clientsWithServices++;

            for (const service of clientData.services) {
                // בדיקה אם יש שדה hoursUsed
                if (service.hasOwnProperty('hoursUsed')) {
                    servicesWithHoursUsed++;

                    // בדיקה אם יש אי-התאמה
                    const tasksSnapshot = await db.collection('timesheet_entries')
                        .where('clientId', '==', clientDoc.id)
                        .where('serviceId', '==', service.id)
                        .get();

                    const actualHoursUsed = tasksSnapshot.docs.reduce((sum, doc) => {
                        return sum + (doc.data().hours || 0);
                    }, 0);

                    const diff = Math.abs((service.hoursUsed || 0) - actualHoursUsed);

                    if (diff > 0.1) {
                        mismatchedServices++;
                        console.log(`⚠️  ${clientData.fullName} - ${service.name}:`);
                        console.log(`   hoursUsed: ${service.hoursUsed}`);
                        console.log(`   נכון: ${actualHoursUsed.toFixed(2)}`);
                        console.log(`   הפרש: ${diff.toFixed(2)}`);
                    }
                } else {
                    servicesWithoutHoursUsed++;
                }
            }
        }

        console.log('\n\n📊 סיכום:');
        console.log('-'.repeat(80));
        console.log('\nלקוחות:');
        console.log(`   סה"כ: ${clientsSnapshot.size}`);
        console.log(`   עם services: ${clientsWithServices}`);

        console.log('\nשירותים:');
        console.log(`   עם hoursUsed: ${servicesWithHoursUsed}`);
        console.log(`   ללא hoursUsed: ${servicesWithoutHoursUsed}`);
        console.log(`   עם אי-התאמה: ${mismatchedServices}`);

        if (mismatchedServices > 0) {
            const percentage = ((mismatchedServices / servicesWithHoursUsed) * 100).toFixed(1);
            console.log(`\n🚨 ${percentage}% מהשירותים לא מסונכרנים!`);
        } else {
            console.log('\n✅ כל השירותים מסונכרנים');
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ בדיקה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
