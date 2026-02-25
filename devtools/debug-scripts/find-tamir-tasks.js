/**
 * חקירה: איפה השעות שעבדו על תמיר אקווע?
 * מה מקור האמת? איך זה מסתכם?
 */

(async function findTamirTasks() {
    console.log('🔍 חקירה: משימות ושעות של תמיר אקווע');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();
        const clientId = '2025006';

        // 1. שליפת הלקוח
        console.log('\n📊 שלב 1: נתוני הלקוח מ-Firestore');
        console.log('-'.repeat(80));

        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) {
            console.error('❌ לקוח לא נמצא');
            return;
        }

        const clientData = clientDoc.data();

        console.log(`\nלקוח: ${clientData.fullName}`);
        console.log(`מספר שירותים: ${clientData.services?.length || 0}`);

        // 2. שליפת כל המשימות של הלקוח
        console.log('\n\n📋 שלב 2: כל המשימות מ-timesheet_entries');
        console.log('-'.repeat(80));

        const tasksSnapshot = await db.collection('timesheet_entries')
            .where('clientId', '==', clientId)
            .get();

        console.log(`\nנמצאו ${tasksSnapshot.size} משימות`);

        if (tasksSnapshot.empty) {
            console.log('⚠️  אין משימות עבור לקוח זה!');
            console.log('   זה מסביר למה hoursRemaining שווה ל-totalHours');
            return;
        }

        // 3. קיבוץ משימות לפי שירות
        const tasksByService = {};
        const allTasks = [];

        tasksSnapshot.forEach(doc => {
            const task = { id: doc.id, ...doc.data() };
            allTasks.push(task);

            const serviceId = task.serviceId || 'ללא שירות';
            if (!tasksByService[serviceId]) {
                tasksByService[serviceId] = [];
            }
            tasksByService[serviceId].push(task);
        });

        // 4. הצגת משימות לפי שירות
        console.log('\n\n📦 שלב 3: קיבוץ משימות לפי שירות');
        console.log('-'.repeat(80));

        let totalHoursWorked = 0;

        for (const [serviceId, tasks] of Object.entries(tasksByService)) {
            console.log(`\n🔹 שירות: ${serviceId}`);

            // מצא את שם השירות
            const service = clientData.services?.find(s => s.id === serviceId);
            if (service) {
                console.log(`   שם: ${service.name}`);
                console.log(`   סוג: ${service.type}`);
            } else {
                console.log('   ⚠️  שירות לא נמצא בלקוח!');
            }

            // סיכום שעות לשירות זה
            let serviceHours = 0;
            console.log(`\n   משימות (${tasks.length}):`);

            tasks.forEach((task, index) => {
                const hours = task.hours || task.duration || 0;
                serviceHours += hours;
                console.log(`   ${index + 1}. ${task.description || task.taskDescription || 'ללא תיאור'}`);
                console.log(`      שעות: ${hours}`);
                console.log(`      תאריך: ${task.date || task.taskDate || 'לא מוגדר'}`);
                console.log(`      עובד: ${task.employeeName || task.employeeId || 'לא מוגדר'}`);
            });

            console.log(`\n   📊 סה"כ שעות לשירות זה: ${serviceHours}`);
            totalHoursWorked += serviceHours;
        }

        console.log(`\n\n📊 סה"כ שעות שעבדו (כל השירותים): ${totalHoursWorked}`);

        // 5. השוואה לנתוני השירותים
        console.log('\n\n🔍 שלב 4: השוואה לנתוני השירותים');
        console.log('-'.repeat(80));

        clientData.services?.forEach((service, index) => {
            console.log(`\n🔹 שירות #${index + 1}: ${service.name}`);
            console.log(`   ID: ${service.id}`);

            // חישוב מה אמור להיות
            const tasksForService = tasksByService[service.id] || [];
            const hoursWorkedFromTasks = tasksForService.reduce((sum, t) => sum + (t.hours || t.duration || 0), 0);

            console.log('\n   📋 ממשימות (timesheet_entries):');
            console.log(`      שעות שעבדו: ${hoursWorkedFromTasks}`);

            console.log('\n   💾 משירות (client.services):');
            console.log(`      totalHours: ${service.totalHours || 0}`);
            console.log(`      hoursUsed: ${service.hoursUsed || 0}`);
            console.log(`      hoursRemaining: ${service.hoursRemaining || 0}`);

            // בדיקת התאמה
            const calculatedRemaining = (service.totalHours || 0) - hoursWorkedFromTasks;
            console.log('\n   🧮 חישוב:');
            console.log(`      totalHours - hoursWorkedFromTasks = ${service.totalHours} - ${hoursWorkedFromTasks} = ${calculatedRemaining}`);

            if (Math.abs((service.hoursRemaining || 0) - calculatedRemaining) > 0.01) {
                console.log('\n   ⚠️  אי-התאמה!');
                console.log(`      hoursRemaining בשירות: ${service.hoursRemaining}`);
                console.log(`      אמור להיות: ${calculatedRemaining}`);
                console.log(`      הפרש: ${Math.abs((service.hoursRemaining || 0) - calculatedRemaining)}`);
            } else {
                console.log('\n   ✅ התאמה מלאה!');
            }

            // בדיקת hoursUsed
            if (Math.abs((service.hoursUsed || 0) - hoursWorkedFromTasks) > 0.01) {
                console.log('\n   ⚠️  אי-התאמה ב-hoursUsed!');
                console.log(`      hoursUsed בשירות: ${service.hoursUsed}`);
                console.log(`      אמור להיות: ${hoursWorkedFromTasks}`);
            }
        });

        // 6. מקור האמת
        console.log('\n\n💡 שלב 5: מהו מקור האמת?');
        console.log('-'.repeat(80));

        console.log('\n🎯 מקור האמת הוא: timesheet_entries');
        console.log('   - כל משימה מתועדת בקולקשן timesheet_entries');
        console.log('   - כל משימה משויכת ל-serviceId');
        console.log('   - השדות בשירות (hoursUsed, hoursRemaining) צריכים להתעדכן אוטומטית');
        console.log('   - אם יש אי-התאמה = בעיית סנכרון!');

        console.log('\n📝 המלצות:');
        console.log('   1. Cloud Function שמתעדכן כשמוסיפים/מוחקים משימה');
        console.log('   2. סקריפט סנכרון שרץ מדי פעם לתקן אי-התאמות');
        console.log('   3. תמיד להסתמך על timesheet_entries + totalHours (לא על hoursRemaining ישן)');

        console.log('\n' + '='.repeat(80));
        console.log('✅ חקירה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
