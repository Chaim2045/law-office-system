/**
 * חקירת בעיית דוח תמיר אקווה
 *
 * בעיה:
 * - לקוח היה בחריגה, סגרת את התיק (מושלם)
 * - פתחת תיק חדש
 * - משתמשים אחרים המשיכו להוסיף משימות על התיק הישן
 * - בדוח רואים את השעות אבל לא את הסיכום
 *
 * מטרה:
 * - למצוא את תמיר אקווה ב-Firestore
 * - לבדוק את מבנה השירותים (services)
 * - לבדוק את רשומות השעתון (timesheet_entries)
 * - לבדוק את המשימות (budget_tasks)
 * - לזהות למה הסיכום לא מחושב
 */

(async function investigateTamirAkiva() {
    console.log('🔍 חקירת בעיית דוח תמיר אקווה');
    console.log('='.repeat(80));

    try {
        // בדיקה שיש גישה ל-Firestore
        if (!firebase || !firebase.firestore) {
            console.error('❌ Firebase לא זמין. וודא שאתה בדף Admin Panel');
            return;
        }

        const db = firebase.firestore();

        // 1️⃣ חיפוש הלקוח "תמיר אקווה"
        console.log('\n1️⃣ מחפש לקוח: תמיר אקווה...');
        console.log('-'.repeat(80));

        const clientsSnapshot = await db.collection('clients')
            .where('fullName', '>=', 'תמיר')
            .where('fullName', '<=', 'תמיר\uf8ff')
            .get();

        console.log(`📊 נמצאו ${clientsSnapshot.size} לקוחות עם שם דומה לתמיר`);

        let tamirClient = null;

        clientsSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`\n  📄 ${doc.id}`);
            console.log(`     שם: ${data.fullName || data.clientName}`);
            console.log(`     מספר תיק: ${data.caseNumber || 'אין'}`);
            console.log(`     סטטוס: ${data.status}`);
            console.log(`     חסום: ${data.isBlocked ? 'כן' : 'לא'}`);

            // נניח שזה הלקוח הנכון אם השם מכיל "אקווה" או קרוב
            if ((data.fullName || data.clientName || '').includes('אקווה') ||
                (data.fullName || data.clientName || '').includes('תמיר')) {
                tamirClient = { id: doc.id, ...data };
            }
        });

        if (!tamirClient) {
            console.log('\n⚠️  לא נמצא לקוח בשם "תמיר אקווה"');
            console.log('💡 אנא העתק את מזהה הלקוח (Client ID) ורוץ:');
            console.log('   investigateTamirAkivaById("CLIENT_ID_HERE")');
            return;
        }

        console.log('\n✅ נמצא הלקוח:');
        console.log(`   ID: ${tamirClient.id}`);
        console.log(`   שם: ${tamirClient.fullName || tamirClient.clientName}`);
        console.log(`   מספר תיק: ${tamirClient.caseNumber || 'אין'}`);

        // 2️⃣ בדיקת מבנה השירותים (services)
        console.log('\n2️⃣ בדיקת מבנה השירותים (services):');
        console.log('-'.repeat(80));

        if (!tamirClient.services || tamirClient.services.length === 0) {
            console.log('⚠️  אין שירותים מוגדרים ללקוח זה');
        } else {
            console.log(`📦 סה"כ שירותים: ${tamirClient.services.length}\n`);

            tamirClient.services.forEach((service, index) => {
                console.log(`\n  📋 שירות #${index + 1}:`);
                console.log(`     שם: ${service.name || service.serviceName || 'ללא שם'}`);
                console.log(`     סוג: ${service.type}`);
                console.log(`     סטטוס: ${service.status || 'לא מוגדר'}`);
                console.log(`     שעות כוללות: ${service.totalHours || service.hours || 0}`);
                console.log(`     שעות נותרות: ${service.hoursRemaining || 0}`);
                console.log(`     תאריך יצירה: ${service.createdAt?.toDate?.() || 'לא ידוע'}`);

                // אם זה הליך משפטי עם שלבים
                if (service.type === 'legal_procedure' && service.stages) {
                    console.log(`\n     🔸 שלבים (${service.stages.length}):`);
                    service.stages.forEach((stage, stageIndex) => {
                        console.log(`        ${stageIndex + 1}. ${stage.name}`);
                        console.log(`           סטטוס: ${stage.status}`);
                        console.log(`           שעות: ${stage.hoursRemaining || 0} / ${stage.totalHours || 0}`);
                    });
                }

                // בדיקת חריגה
                const isOverdraft = (service.hoursRemaining || 0) < 0;
                const isResolved = service.overdraftResolved?.isResolved;

                if (isOverdraft) {
                    console.log(`\n     ⚠️  חריגה: ${Math.abs(service.hoursRemaining || 0).toFixed(1)} שעות`);
                    console.log(`     הוסדר: ${isResolved ? 'כן ✅' : 'לא ❌'}`);
                    if (isResolved) {
                        console.log(`     הערה: ${service.overdraftResolved.note || 'אין'}`);
                    }
                }
            });
        }

        // 3️⃣ בדיקת רשומות שעתון
        console.log('\n\n3️⃣ בדיקת רשומות שעתון (timesheet_entries):');
        console.log('-'.repeat(80));

        const clientName = tamirClient.fullName || tamirClient.clientName;

        const timesheetSnapshot = await db.collection('timesheet_entries')
            .where('clientName', '==', clientName)
            .orderBy('date', 'desc')
            .limit(100)
            .get();

        console.log(`📊 נמצאו ${timesheetSnapshot.size} רשומות שעתון\n`);

        let totalMinutes = 0;
        const entriesByService = {};

        timesheetSnapshot.forEach(doc => {
            const entry = doc.data();
            const minutes = entry.minutes || 0;
            totalMinutes += minutes;

            const serviceName = entry.serviceName || 'ללא שירות';
            if (!entriesByService[serviceName]) {
                entriesByService[serviceName] = { count: 0, minutes: 0 };
            }
            entriesByService[serviceName].count++;
            entriesByService[serviceName].minutes += minutes;
        });

        console.log('📈 סיכום לפי שירות:');
        Object.keys(entriesByService).forEach(serviceName => {
            const data = entriesByService[serviceName];
            const hours = (data.minutes / 60).toFixed(2);
            console.log(`   ${serviceName}: ${data.count} רשומות, ${hours} שעות`);
        });

        console.log(`\n📊 סה"כ שעות שתועדו: ${(totalMinutes / 60).toFixed(2)}`);

        // הצגת 5 רשומות אחרונות
        console.log('\n📋 5 רשומות אחרונות:');
        let count = 0;
        timesheetSnapshot.forEach(doc => {
            if (count >= 5) {
return;
}
            const entry = doc.data();
            const date = entry.date?.toDate?.() || 'לא ידוע';
            const hours = ((entry.minutes || 0) / 60).toFixed(2);
            console.log(`   ${count + 1}. ${date.toLocaleDateString?.('he-IL') || date} - ${hours} שעות - ${entry.serviceName || 'ללא שירות'}`);
            console.log(`      תיאור: ${entry.description || 'אין'}`);
            console.log(`      עובד: ${entry.employeeEmail || 'לא ידוע'}`);
            count++;
        });

        // 4️⃣ בדיקת משימות פתוחות
        console.log('\n\n4️⃣ בדיקת משימות פתוחות (budget_tasks):');
        console.log('-'.repeat(80));

        const tasksSnapshot = await db.collection('budget_tasks')
            .where('clientName', '==', clientName)
            .get();

        console.log(`📊 נמצאו ${tasksSnapshot.size} משימות\n`);

        const tasksByStatus = { 'פעיל': 0, 'הושלם': 0, 'אחר': 0 };
        const tasksByService = {};

        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const status = task.status || 'אחר';
            if (status === 'פעיל') {
tasksByStatus['פעיל']++;
} else if (status === 'הושלם') {
tasksByStatus['הושלם']++;
} else {
tasksByStatus['אחר']++;
}

            const serviceName = task.serviceName || 'ללא שירות';
            if (!tasksByService[serviceName]) {
                tasksByService[serviceName] = { פעיל: 0, הושלם: 0 };
            }
            if (status === 'פעיל') {
tasksByService[serviceName].פעיל++;
} else if (status === 'הושלם') {
tasksByService[serviceName].הושלם++;
}
        });

        console.log('📈 סיכום לפי סטטוס:');
        Object.keys(tasksByStatus).forEach(status => {
            console.log(`   ${status}: ${tasksByStatus[status]} משימות`);
        });

        console.log('\n📈 סיכום לפי שירות:');
        Object.keys(tasksByService).forEach(serviceName => {
            const data = tasksByService[serviceName];
            console.log(`   ${serviceName}:`);
            console.log(`      פעיל: ${data.פעיל}, הושלם: ${data.הושלם}`);
        });

        // משימות פתוחות על שירותים סגורים
        console.log('\n⚠️  משימות פתוחות על שירותים סגורים:');
        let foundOpenTasksOnClosedService = false;

        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            if (task.status !== 'פעיל') {
return;
}

            const serviceName = task.serviceName;
            const service = tamirClient.services?.find(s =>
                (s.name || s.serviceName) === serviceName
            );

            if (service && (service.status === 'completed' || service.status === 'הושלם')) {
                foundOpenTasksOnClosedService = true;
                console.log(`   🔴 משימה: ${task.description}`);
                console.log(`      שירות: ${serviceName} (סטטוס: ${service.status})`);
                console.log(`      נוצר: ${task.createdAt?.toDate?.().toLocaleDateString?.('he-IL') || 'לא ידוע'}`);
                console.log(`      עובד: ${task.employee || 'לא ידוע'}`);
            }
        });

        if (!foundOpenTasksOnClosedService) {
            console.log('   ✅ לא נמצאו משימות פתוחות על שירותים סגורים');
        }

        // 5️⃣ אבחון הבעיה
        console.log('\n\n5️⃣ אבחון הבעיה:');
        console.log('='.repeat(80));

        console.log('\n🔍 בדיקת תנאים לסיכום דוח:\n');

        // בדיקה 1: האם יש serviceName ברשומות שעתון?
        let entriesWithoutService = 0;
        timesheetSnapshot.forEach(doc => {
            const entry = doc.data();
            if (!entry.serviceName) {
                entriesWithoutService++;
            }
        });

        console.log(`1️⃣ רשומות שעתון ללא serviceName: ${entriesWithoutService}/${timesheetSnapshot.size}`);
        if (entriesWithoutService > 0) {
            console.log('   ⚠️  ייתכן שהדוח לא יכלול רשומות אלה בסיכום');
        }

        // בדיקה 2: האם serviceName תואם לשירות קיים?
        console.log('\n2️⃣ בדיקת התאמת שמות שירותים:');
        const serviceNames = new Set(tamirClient.services?.map(s => s.name || s.serviceName) || []);
        const timesheetServices = new Set();

        timesheetSnapshot.forEach(doc => {
            const entry = doc.data();
            if (entry.serviceName) {
                timesheetServices.add(entry.serviceName);
            }
        });

        console.log(`   שירותים בלקוח: ${Array.from(serviceNames).join(', ')}`);
        console.log(`   שירותים בשעתון: ${Array.from(timesheetServices).join(', ')}`);

        timesheetServices.forEach(tsService => {
            if (!serviceNames.has(tsService)) {
                console.log(`   ⚠️  "${tsService}" - קיים בשעתון אבל לא בלקוח!`);
            }
        });

        // בדיקה 3: האם יש בעיה עם clientName?
        console.log('\n3️⃣ בדיקת שם לקוח:');
        console.log(`   שם בלקוח: "${clientName}"`);
        console.log(`   אורך: ${clientName.length} תווים`);

        const uniqueClientNames = new Set();
        timesheetSnapshot.forEach(doc => {
            uniqueClientNames.add(doc.data().clientName);
        });

        if (uniqueClientNames.size > 1) {
            console.log(`   ⚠️  נמצאו ${uniqueClientNames.size} שמות שונים ברשומות שעתון:`);
            uniqueClientNames.forEach(name => {
                console.log(`      - "${name}" (אורך: ${name.length})`);
            });
        } else {
            console.log('   ✅ שם לקוח עקבי בכל הרשומות');
        }

        // 6️⃣ המלצות
        console.log('\n\n6️⃣ המלצות לפתרון:');
        console.log('='.repeat(80));

        if (entriesWithoutService > 0) {
            console.log('\n❗ רשומות שעתון ללא serviceName:');
            console.log('   הבעיה: רשומות שעתון לא משוייכות לשירות');
            console.log('   פתרון: עדכן את הרשומות עם serviceName נכון');
        }

        if (timesheetServices.size > serviceNames.size) {
            console.log('\n❗ אי-התאמה בשמות שירותים:');
            console.log('   הבעיה: יש שירותים בשעתון שלא קיימים בלקוח');
            console.log('   פתרון אפשרי 1: עדכן serviceName ברשומות השעתון');
            console.log('   פתרון אפשרי 2: הוסף את השירותים החסרים ללקוח');
        }

        if (foundOpenTasksOnClosedService) {
            console.log('\n❗ משימות פתוחות על שירותים סגורים:');
            console.log('   הבעיה: עובדים ממשיכים להוסיף משימות על שירות שנסגר');
            console.log('   פתרון: סגור את המשימות הפתוחות או העבר אותן לשירות חדש');
        }

        console.log('\n\n✅ חקירה הושלמה!');
        console.log('='.repeat(80));

        // החזר את הנתונים לצורך בדיקה נוספת
        return {
            client: tamirClient,
            timesheetCount: timesheetSnapshot.size,
            tasksCount: tasksSnapshot.size,
            totalHours: (totalMinutes / 60).toFixed(2),
            entriesWithoutService,
            serviceNames: Array.from(serviceNames),
            timesheetServices: Array.from(timesheetServices)
        };

    } catch (error) {
        console.error('❌ שגיאה בחקירה:', error);
        console.error('Stack trace:', error.stack);
        return { error: error.message };
    }
})();

/**
 * פונקציה עזר: חקירה לפי Client ID
 *
 * שימוש:
 * investigateTamirAkivaById("CLIENT_ID_HERE")
 */
window.investigateTamirAkivaById = async function(clientId) {
    console.log(`🔍 חקירה ללקוח: ${clientId}`);
    console.log('='.repeat(80));

    const db = firebase.firestore();
    const doc = await db.collection('clients').doc(clientId).get();

    if (!doc.exists) {
        console.error('❌ לקוח לא נמצא');
        return;
    }

    // רוץ את אותה לוגיקה עם הלקוח הספציפי
    console.log('✅ לקוח נמצא, מריץ חקירה...');
    // כאן תוכל להעתיק את הלוגיקה מהפונקציה הראשית
};
