/**
 * אבחון: אי-התאמה בשעות תמיר אקווע
 *
 * מציג: 49.2 / 120
 * אבל יש 2 שירותים: 60 שעות + 180 שעות = 240 שעות
 *
 * השאלה: מאיפה מגיעים 49.2 ו-120?
 */

(async function diagnoseTamirHoursMismatch() {
    console.log('🔍 אבחון: אי-התאמה בשעות תמיר אקווע');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();
        const clientId = '2025006';

        // 1. קבל את נתוני הלקוח מ-Firestore
        console.log('\n📊 שלב 1: נתוני הלקוח מ-Firestore');
        console.log('-'.repeat(80));

        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) {
            console.error('❌ לקוח לא נמצא');
            return;
        }

        const clientData = clientDoc.data();

        console.log('\n🔸 שדות ברמת הלקוח:');
        console.log(`   totalHours: ${clientData.totalHours}`);
        console.log(`   hoursRemaining: ${clientData.hoursRemaining}`);
        console.log(`   type: "${clientData.type}"`);
        console.log(`   procedureType: "${clientData.procedureType}"`);

        // 2. בדוק את מערך השירותים
        console.log('\n🔸 מערך השירותים (services):');

        if (!clientData.services || clientData.services.length === 0) {
            console.log('   ⚠️  אין שירותים!');
        } else {
            console.log(`   מספר שירותים: ${clientData.services.length}\n`);

            let servicesTotalHours = 0;
            let servicesRemainingHours = 0;

            clientData.services.forEach((service, index) => {
                const total = service.totalHours || 0;
                const remaining = service.hoursRemaining || 0;
                const used = total - remaining;

                console.log(`   שירות #${index + 1}: ${service.name || service.serviceName || 'ללא שם'}`);
                console.log(`      סטטוס: ${service.status || 'לא מוגדר'}`);
                console.log(`      totalHours: ${total}`);
                console.log(`      hoursRemaining: ${remaining}`);
                console.log(`      בוצעו: ${used}`);
                console.log(`      סוג: ${service.type || 'לא מוגדר'}`);

                servicesTotalHours += total;
                servicesRemainingHours += remaining;
            });

            const servicesUsedHours = servicesTotalHours - servicesRemainingHours;

            console.log('\n   📊 סיכום שירותים:');
            console.log(`      סה"כ תקציב: ${servicesTotalHours}`);
            console.log(`      בוצעו: ${servicesUsedHours}`);
            console.log(`      יתרה: ${servicesRemainingHours}`);
        }

        // 3. השוואה
        console.log('\n\n🔍 שלב 2: השוואת נתונים');
        console.log('-'.repeat(80));

        const clientTotal = clientData.totalHours || 0;
        const clientRemaining = clientData.hoursRemaining || 0;
        const clientUsed = clientTotal - clientRemaining;

        console.log('\n📌 מה מוצג בטבלה (מנתוני הלקוח):');
        console.log(`   ${clientRemaining} / ${clientTotal}`);
        console.log(`   (${clientUsed} בוצעו)`);

        if (clientData.services && clientData.services.length > 0) {
            let servicesTotalHours = 0;
            let servicesRemainingHours = 0;

            clientData.services.forEach(service => {
                servicesTotalHours += (service.totalHours || 0);
                servicesRemainingHours += (service.hoursRemaining || 0);
            });

            const servicesUsedHours = servicesTotalHours - servicesRemainingHours;

            console.log('\n📌 מה אמור להיות (מסכום השירותים):');
            console.log(`   ${servicesRemainingHours} / ${servicesTotalHours}`);
            console.log(`   (${servicesUsedHours} בוצעו)`);

            // זיהוי אי-התאמה
            console.log('\n\n⚠️  אי-התאמות שנמצאו:');
            console.log('-'.repeat(80));

            if (clientTotal !== servicesTotalHours) {
                console.log('\n❌ תקציב כולל:');
                console.log(`   ברמת הלקוח: ${clientTotal}`);
                console.log(`   סכום שירותים: ${servicesTotalHours}`);
                console.log(`   הפרש: ${servicesTotalHours - clientTotal}`);
            }

            if (clientRemaining !== servicesRemainingHours) {
                console.log('\n❌ יתרה:');
                console.log(`   ברמת הלקוח: ${clientRemaining}`);
                console.log(`   סכום שירותים: ${servicesRemainingHours}`);
                console.log(`   הפרש: ${servicesRemainingHours - clientRemaining}`);
            }

            if (clientUsed !== servicesUsedHours) {
                console.log('\n❌ שעות ששומשו:');
                console.log(`   מחושב מהלקוח: ${clientUsed}`);
                console.log(`   מחושב מהשירותים: ${servicesUsedHours}`);
                console.log(`   הפרש: ${servicesUsedHours - clientUsed}`);
            }
        }

        // 4. בדוק מה ClientsDataManager מחשב
        console.log('\n\n🔍 שלב 3: מה ClientsDataManager מחשב?');
        console.log('-'.repeat(80));

        if (window.ClientsDataManager) {
            const client = { id: clientId, ...clientData };

            // סימולציה של calculateRemainingHoursFromServices
            let calculatedRemaining = 0;
            if (client.services && client.services.length > 0) {
                client.services.forEach(service => {
                    if (service.type === 'legal_procedure' && service.stages) {
                        service.stages.forEach(stage => {
                            if (stage.status === 'active') {
                                calculatedRemaining += (stage.hoursRemaining || 0);
                            }
                        });
                    } else {
                        calculatedRemaining += (service.hoursRemaining || 0);
                    }
                });
            }

            console.log('\n📊 ClientsDataManager.calculateRemainingHoursFromServices():');
            console.log(`   מחזיר: ${calculatedRemaining}`);
            console.log('   (זה מה שאמור להיות ב-hoursRemaining)');
        } else {
            console.log('   ⚠️  ClientsDataManager לא זמין');
        }

        // 5. תאריכי עדכון
        console.log('\n\n📅 שלב 4: תאריכי עדכון');
        console.log('-'.repeat(80));

        console.log('\nלקוח:');
        if (clientData.updatedAt) {
            const date = clientData.updatedAt.toDate();
            console.log(`   עודכן לאחרונה: ${date.toLocaleString('he-IL')}`);
        }
        if (clientData.createdAt) {
            const date = clientData.createdAt.toDate();
            console.log(`   נוצר: ${date.toLocaleString('he-IL')}`);
        }

        if (clientData.services && clientData.services.length > 0) {
            console.log('\nשירותים:');
            clientData.services.forEach((service, index) => {
                console.log(`   שירות #${index + 1}: ${service.name || 'ללא שם'}`);
                if (service.createdAt) {
                    const date = service.createdAt.toDate ? service.createdAt.toDate() : new Date(service.createdAt);
                    console.log(`      נוצר: ${date.toLocaleString('he-IL')}`);
                }
            });
        }

        // 6. המלצות
        console.log('\n\n💡 המלצות לפתרון:');
        console.log('-'.repeat(80));

        const clientTotal2 = clientData.totalHours || 0;
        const clientRemaining2 = clientData.hoursRemaining || 0;

        if (clientData.services && clientData.services.length > 0) {
            let servicesTotalHours = 0;
            let servicesRemainingHours = 0;

            clientData.services.forEach(service => {
                servicesTotalHours += (service.totalHours || 0);
                servicesRemainingHours += (service.hoursRemaining || 0);
            });

            if (clientTotal2 !== servicesTotalHours || clientRemaining2 !== servicesRemainingHours) {
                console.log('\n✅ הנתונים הנכונים הם מהשירותים (services):');
                console.log(`   תקציב: ${servicesTotalHours} שעות`);
                console.log(`   יתרה: ${servicesRemainingHours} שעות`);
                console.log(`   בוצעו: ${servicesTotalHours - servicesRemainingHours} שעות`);

                console.log('\n🔧 נדרש לעדכן את הלקוח:');
                console.log(`   client.totalHours: ${clientTotal2} → ${servicesTotalHours}`);
                console.log(`   client.hoursRemaining: ${clientRemaining2} → ${servicesRemainingHours}`);

                console.log('\n📝 אפשרויות תיקון:');
                console.log('   1. עדכון ידני של הלקוח בממשק');
                console.log('   2. סקריפט לסנכרון אוטומטי');
                console.log('   3. תיקון ClientsDataManager לחשב תמיד מהשירותים');
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ אבחון הושלם!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
