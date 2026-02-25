/**
 * חקירה: האם timesheet_entries מהימן כמקור אמת?
 * בדיקת שלמות הנתונים
 */

(async function verifyTimesheetEntriesIntegrity() {
    console.log('🔍 חקירה: שלמות timesheet_entries');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();

        console.log('\n📊 שלב 1: בדיקות בסיסיות');
        console.log('-'.repeat(80));

        // 1. כמה משימות יש סה"כ
        const allEntries = await db.collection('timesheet_entries').get();
        console.log(`\nסה"כ משימות במערכת: ${allEntries.size}`);

        // 2. משימות עם שדות חובה
        let entriesWithClientId = 0;
        let entriesWithServiceId = 0;
        let entriesWithHours = 0;
        let entriesWithDate = 0;
        let entriesWithCreatedAt = 0;

        allEntries.forEach(doc => {
            const data = doc.data();
            if (data.clientId) {
entriesWithClientId++;
}
            if (data.serviceId) {
entriesWithServiceId++;
}
            if (data.hours || data.duration) {
entriesWithHours++;
}
            if (data.date || data.taskDate) {
entriesWithDate++;
}
            if (data.createdAt) {
entriesWithCreatedAt++;
}
        });

        console.log('\nשדות חובה:');
        console.log(`   עם clientId: ${entriesWithClientId} (${((entriesWithClientId/allEntries.size)*100).toFixed(1)}%)`);
        console.log(`   עם serviceId: ${entriesWithServiceId} (${((entriesWithServiceId/allEntries.size)*100).toFixed(1)}%)`);
        console.log(`   עם hours: ${entriesWithHours} (${((entriesWithHours/allEntries.size)*100).toFixed(1)}%)`);
        console.log(`   עם date: ${entriesWithDate} (${((entriesWithDate/allEntries.size)*100).toFixed(1)}%)`);
        console.log(`   עם createdAt: ${entriesWithCreatedAt} (${((entriesWithCreatedAt/allEntries.size)*100).toFixed(1)}%)`);

        // 3. בדוק אם יש משימות יתומות (client לא קיים)
        console.log('\n\n📊 שלב 2: בדיקת משימות יתומות');
        console.log('-'.repeat(80));

        const clientsSnapshot = await db.collection('clients').get();
        const clientIds = new Set(clientsSnapshot.docs.map(d => d.id));

        let orphanedTasks = 0;
        const orphanedClients = new Set();

        allEntries.forEach(doc => {
            const data = doc.data();
            if (data.clientId && !clientIds.has(data.clientId)) {
                orphanedTasks++;
                orphanedClients.add(data.clientId);
            }
        });

        console.log(`\nמשימות יתומות (client נמחק): ${orphanedTasks}`);
        if (orphanedTasks > 0) {
            console.log(`לקוחות שנמחקו: ${Array.from(orphanedClients).join(', ')}`);
        }

        // 4. בדוק אם יש משימות עם serviceId שלא קיים
        console.log('\n\n📊 שלב 3: בדיקת משימות עם שירות לא קיים');
        console.log('-'.repeat(80));

        let tasksWithInvalidService = 0;
        const invalidServiceIds = new Set();

        for (const clientDoc of clientsSnapshot.docs) {
            const clientData = clientDoc.data();
            const clientId = clientDoc.id;
            const serviceIds = new Set((clientData.services || []).map(s => s.id));

            const clientTasks = await db.collection('timesheet_entries')
                .where('clientId', '==', clientId)
                .get();

            clientTasks.forEach(taskDoc => {
                const taskData = taskDoc.data();
                if (taskData.serviceId && !serviceIds.has(taskData.serviceId)) {
                    tasksWithInvalidService++;
                    invalidServiceIds.add(taskData.serviceId);
                }
            });
        }

        console.log(`\nמשימות עם serviceId לא תקין: ${tasksWithInvalidService}`);
        if (tasksWithInvalidService > 0) {
            console.log(`שירותים לא קיימים: ${Array.from(invalidServiceIds).slice(0, 10).join(', ')}...`);
        }

        // 5. בדוק התפלגות תאריכים
        console.log('\n\n📊 שלב 4: התפלגות תאריכים');
        console.log('-'.repeat(80));

        const dateRanges = {
            '2025-01': 0,
            '2025-02': 0,
            '2025-03': 0,
            '2025-04': 0,
            '2025-05': 0,
            '2025-06': 0,
            '2025-07': 0,
            '2025-08': 0,
            '2025-09': 0,
            '2025-10': 0,
            '2025-11': 0,
            '2025-12': 0,
            '2026-01': 0,
            '2026-02': 0,
            'other': 0
        };

        allEntries.forEach(doc => {
            const data = doc.data();
            const date = data.date || data.taskDate || '';
            if (date) {
                const yearMonth = date.substring(0, 7);
                if (dateRanges.hasOwnProperty(yearMonth)) {
                    dateRanges[yearMonth]++;
                } else {
                    dateRanges['other']++;
                }
            }
        });

        console.log('\nהתפלגות לפי חודש:');
        Object.entries(dateRanges).forEach(([month, count]) => {
            if (count > 0) {
                console.log(`   ${month}: ${count} משימות`);
            }
        });

        // 6. בדוק אם יש duplicates
        console.log('\n\n📊 שלב 5: בדיקת duplicates');
        console.log('-'.repeat(80));

        const taskSignatures = new Map();
        let duplicates = 0;

        allEntries.forEach(doc => {
            const data = doc.data();
            const signature = `${data.clientId}_${data.serviceId}_${data.date}_${data.hours}_${data.description}`;

            if (taskSignatures.has(signature)) {
                duplicates++;
            } else {
                taskSignatures.set(signature, doc.id);
            }
        });

        console.log(`\nמשימות כפולות (אותם נתונים בדיוק): ${duplicates}`);

        // 7. בדוק עדכונים אחרונים
        console.log('\n\n📊 שלב 6: משימות אחרונות שנוצרו');
        console.log('-'.repeat(80));

        const recentTasks = [];
        allEntries.forEach(doc => {
            const data = doc.data();
            if (data.createdAt) {
                recentTasks.push({
                    id: doc.id,
                    createdAt: data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    clientId: data.clientId,
                    serviceId: data.serviceId,
                    hours: data.hours || data.duration || 0
                });
            }
        });

        recentTasks.sort((a, b) => b.createdAt - a.createdAt);

        console.log('\n10 משימות אחרונות:');
        recentTasks.slice(0, 10).forEach((task, index) => {
            console.log(`   ${index + 1}. ${task.createdAt.toLocaleString('he-IL')}`);
            console.log(`      Client: ${task.clientId}`);
            console.log(`      Service: ${task.serviceId}`);
            console.log(`      Hours: ${task.hours}`);
        });

        // 8. סיכום
        console.log('\n\n💡 מסקנות:');
        console.log('-'.repeat(80));

        const issues = [];

        if (orphanedTasks > 0) {
            issues.push(`⚠️  ${orphanedTasks} משימות יתומות (client נמחק)`);
        }

        if (tasksWithInvalidService > 0) {
            issues.push(`⚠️  ${tasksWithInvalidService} משימות עם service לא קיים`);
        }

        if (duplicates > 0) {
            issues.push(`⚠️  ${duplicates} משימות כפולות`);
        }

        if (entriesWithServiceId < allEntries.size * 0.95) {
            issues.push(`⚠️  ${allEntries.size - entriesWithServiceId} משימות ללא serviceId`);
        }

        if (issues.length === 0) {
            console.log('\n✅ timesheet_entries נראה תקין!');
            console.log('   → ניתן להסתמך עליו כמקור אמת');
        } else {
            console.log('\n🚨 נמצאו בעיות:');
            issues.forEach(issue => console.log(`   ${issue}`));
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ בדיקה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
