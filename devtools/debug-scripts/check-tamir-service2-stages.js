/**
 * בדיקה: מה המבנה המדויק של שירות #2 של תמיר אקווע?
 * האם יש stages? מה הסטטוס שלהם?
 */

(async function checkTamirService2Stages() {
    console.log('🔍 בדיקה: שירות #2 של תמיר אקווע');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();
        const clientId = '2025006';

        // שליפת הלקוח
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) {
            console.error('❌ לקוח לא נמצא');
            return;
        }

        const clientData = clientDoc.data();

        if (!clientData.services || clientData.services.length < 2) {
            console.error('❌ אין מספיק שירותים');
            return;
        }

        // שירות #2 (index 1)
        const service2 = clientData.services[1];

        console.log('\n📦 שירות #2: ' + (service2.name || 'ללא שם'));
        console.log('-'.repeat(80));

        // הצגת כל השדות
        console.log('\n🔸 כל השדות בשירות:');
        console.log(JSON.stringify(service2, null, 2));

        console.log('\n\n🔍 בדיקות ספציפיות:');
        console.log('-'.repeat(80));

        console.log('\n1. האם יש stages?');
        if (service2.stages) {
            console.log(`   ✅ כן, יש ${service2.stages.length} שלבים`);

            console.log('\n2. פירוט השלבים:');
            service2.stages.forEach((stage, index) => {
                console.log(`\n   שלב #${index + 1}:`);
                console.log(`      id: ${stage.id || 'לא מוגדר'}`);
                console.log(`      name: ${stage.name || 'לא מוגדר'}`);
                console.log(`      status: ${stage.status || 'לא מוגדר'}`);
                console.log(`      totalHours: ${stage.totalHours || 0}`);
                console.log(`      hoursRemaining: ${stage.hoursRemaining || 0}`);
                console.log(`      order: ${stage.order || 'לא מוגדר'}`);
            });

            console.log('\n3. חישוב לפי ClientsDataManager:');
            let calculatedRemaining = 0;
            let calculatedTotal = 0;
            service2.stages.forEach(stage => {
                if (stage.status === 'active') {
                    calculatedRemaining += (stage.hoursRemaining || 0);
                    calculatedTotal += (stage.totalHours || 0);
                    console.log(`   ✅ שלב ${stage.name} (${stage.status}): +${stage.hoursRemaining || 0} שעות`);
                } else {
                    console.log(`   ⏸️  שלב ${stage.name} (${stage.status}): מדולג`);
                }
            });
            console.log(`   📊 סה"כ (רק פעילים): ${calculatedRemaining} / ${calculatedTotal}`);

        } else {
            console.log('   ❌ אין stages!');
            console.log('   ⚠️  זו בעיה! שירות מסוג legal_procedure חייב להכיל stages');

            console.log('\n   🔧 השדות הקיימים:');
            console.log(`      type: ${service2.type}`);
            console.log(`      pricingType: ${service2.pricingType || 'לא מוגדר'}`);
            console.log(`      totalHours: ${service2.totalHours || 0}`);
            console.log(`      hoursRemaining: ${service2.hoursRemaining || 0}`);
        }

        console.log('\n\n4. השוואה: מה ClientsDataManager יחשב?');
        console.log('-'.repeat(80));

        let cdmCalculation = 0;

        if (service2.type === 'legal_procedure' && service2.stages) {
            console.log('   נכנס לענף: legal_procedure עם stages');
            service2.stages.forEach(stage => {
                if (stage.status === 'active') {
                    cdmCalculation += (stage.hoursRemaining || 0);
                }
            });
        } else {
            console.log('   נכנס לענף: else (תוכנית שעות רגילה)');
            cdmCalculation += (service2.hoursRemaining || 0);
        }

        console.log(`   מחזיר: ${cdmCalculation} שעות`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ בדיקה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
