/**
 * חקירה: 432 משימות ללא serviceId
 * מתי נוצרו? למה אין להן serviceId?
 */

(async function investigateMissingServiceId() {
    console.log('🔍 חקירה: משימות ללא serviceId');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();

        // 1. שליפת כל המשימות
        const allEntries = await db.collection('timesheet_entries').get();

        const withServiceId = [];
        const withoutServiceId = [];

        allEntries.forEach(doc => {
            const data = doc.data();
            if (data.serviceId) {
                withServiceId.push({
                    id: doc.id,
                    clientId: data.clientId,
                    serviceId: data.serviceId,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null,
                    date: data.date || data.taskDate
                });
            } else {
                withoutServiceId.push({
                    id: doc.id,
                    clientId: data.clientId,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null,
                    date: data.date || data.taskDate,
                    hours: data.hours || data.duration || 0
                });
            }
        });

        console.log('\n📊 סיכום:');
        console.log(`   עם serviceId: ${withServiceId.length} (${((withServiceId.length/allEntries.size)*100).toFixed(1)}%)`);
        console.log(`   ללא serviceId: ${withoutServiceId.length} (${((withoutServiceId.length/allEntries.size)*100).toFixed(1)}%)`);

        // 2. התפלגות לפי תאריך יצירה
        console.log('\n\n📊 התפלגות לפי תאריך יצירה:');
        console.log('-'.repeat(80));

        const byMonth = {
            with: {},
            without: {}
        };

        withServiceId.forEach(task => {
            if (task.createdAt) {
                const month = task.createdAt.toISOString().substring(0, 7);
                byMonth.with[month] = (byMonth.with[month] || 0) + 1;
            }
        });

        withoutServiceId.forEach(task => {
            if (task.createdAt) {
                const month = task.createdAt.toISOString().substring(0, 7);
                byMonth.without[month] = (byMonth.without[month] || 0) + 1;
            }
        });

        // כל החודשים
        const allMonths = new Set([
            ...Object.keys(byMonth.with),
            ...Object.keys(byMonth.without)
        ]);

        const sortedMonths = Array.from(allMonths).sort();

        console.log('\n   חודש      | עם serviceId | ללא serviceId | סה"כ');
        console.log('   ' + '-'.repeat(60));

        sortedMonths.forEach(month => {
            const withCount = byMonth.with[month] || 0;
            const withoutCount = byMonth.without[month] || 0;
            const total = withCount + withoutCount;
            const percentage = withoutCount > 0 ? ((withoutCount/total)*100).toFixed(0) : 0;

            console.log(`   ${month}  |     ${withCount.toString().padStart(4)}     |      ${withoutCount.toString().padStart(4)}     | ${total.toString().padStart(4)} (${percentage}%)`);
        });

        // 3. בדיקה: האם יש נקודת מעבר?
        console.log('\n\n📊 איתור נקודת מעבר:');
        console.log('-'.repeat(80));

        // מיון לפי תאריך
        const allTasks = [...withServiceId, ...withoutServiceId]
            .filter(t => t.createdAt)
            .sort((a, b) => a.createdAt - b.createdAt);

        // מצא את המשימה הראשונה עם serviceId
        const firstWithServiceId = allTasks.find(t => t.serviceId);
        // מצא את המשימה האחרונה ללא serviceId
        const lastWithoutServiceId = [...allTasks].reverse().find(t => !t.serviceId);

        if (firstWithServiceId) {
            console.log('\n   משימה ראשונה עם serviceId:');
            console.log(`      תאריך: ${firstWithServiceId.createdAt.toLocaleString('he-IL')}`);
            console.log(`      Client: ${firstWithServiceId.clientId}`);
            console.log(`      Service: ${firstWithServiceId.serviceId}`);
        }

        if (lastWithoutServiceId) {
            console.log('\n   משימה אחרונה ללא serviceId:');
            console.log(`      תאריך: ${lastWithoutServiceId.createdAt.toLocaleString('he-IL')}`);
            console.log(`      Client: ${lastWithoutServiceId.clientId}`);
        }

        // 4. בדיקה: האם משימות ללא serviceId שייכות ללקוחות ישנים?
        console.log('\n\n📊 ניתוח לפי לקוחות:');
        console.log('-'.repeat(80));

        const clientsWithoutServiceId = {};
        withoutServiceId.forEach(task => {
            if (task.clientId) {
                clientsWithoutServiceId[task.clientId] = (clientsWithoutServiceId[task.clientId] || 0) + 1;
            }
        });

        const sortedClients = Object.entries(clientsWithoutServiceId)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        console.log('\n   10 לקוחות עם הכי הרבה משימות ללא serviceId:');
        for (const [clientId, count] of sortedClients) {
            // קבל שם לקוח
            const clientDoc = await db.collection('clients').doc(clientId).get();
            const clientName = clientDoc.exists ? clientDoc.data().fullName : 'לא נמצא';

            console.log(`      ${clientName} (${clientId}): ${count} משימות`);
        }

        // 5. בדיקה: האם הלקוחות האלה יש להם services?
        console.log('\n\n📊 האם ללקוחות האלה יש services?');
        console.log('-'.repeat(80));

        for (const [clientId, count] of sortedClients.slice(0, 5)) {
            const clientDoc = await db.collection('clients').doc(clientId).get();
            if (clientDoc.exists) {
                const clientData = clientDoc.data();
                const servicesCount = clientData.services?.length || 0;

                console.log(`\n   ${clientData.fullName}:`);
                console.log(`      משימות ללא serviceId: ${count}`);
                console.log(`      יש services: ${servicesCount > 0 ? 'כן' : 'לא'}`);

                if (servicesCount > 0) {
                    console.log(`      שירותים (${servicesCount}):`);
                    clientData.services.forEach((s, i) => {
                        console.log(`         ${i+1}. ${s.name} (${s.id})`);
                    });
                }

                // בדוק אם יש ארכיטקטורה ישנה
                if (clientData.type) {
                    console.log(`      ⚠️  ארכיטקטורה ישנה: type = ${clientData.type}`);
                }
            }
        }

        // 6. מסקנות
        console.log('\n\n💡 מסקנות:');
        console.log('-'.repeat(80));

        const conclusions = [];

        if (lastWithoutServiceId && firstWithServiceId) {
            const daysDiff = (firstWithServiceId.createdAt - lastWithoutServiceId.createdAt) / (1000 * 60 * 60 * 24);

            if (daysDiff < 0) {
                conclusions.push('⚠️  יש משימות ללא serviceId גם אחרי שהארכיטקטורה החדשה התחילה!');
            } else {
                conclusions.push(`✅ המעבר לארכיטקטורה חדשה היה ב-${firstWithServiceId.createdAt.toLocaleDateString('he-IL')}`);
            }
        }

        const recentWithout = withoutServiceId.filter(t =>
            t.createdAt && t.createdAt > new Date('2026-01-01')
        );

        if (recentWithout.length > 0) {
            conclusions.push(`🚨 ${recentWithout.length} משימות חדשות (2026) ללא serviceId!`);
        }

        conclusions.forEach(c => console.log(`\n   ${c}`));

        console.log('\n' + '='.repeat(80));
        console.log('✅ חקירה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
