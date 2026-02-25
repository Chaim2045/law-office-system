/**
 * חקירה: 163 משימות עם serviceId שלא קיים
 * מה קרה לשירותים? האם הם נמחקו?
 */

(async function investigateOrphanedTasks() {
    console.log('🔍 חקירה: משימות יתומות (serviceId לא קיים)');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();

        console.log('\n📊 שלב 1: איתור משימות יתומות');
        console.log('-'.repeat(80));

        const clientsSnapshot = await db.collection('clients').get();
        const orphanedTasks = [];

        for (const clientDoc of clientsSnapshot.docs) {
            const clientData = clientDoc.data();
            const clientId = clientDoc.id;

            // רשימת serviceIds תקינים
            const validServiceIds = new Set((clientData.services || []).map(s => s.id));

            // משימות הלקוח
            const tasksSnapshot = await db.collection('timesheet_entries')
                .where('clientId', '==', clientId)
                .get();

            tasksSnapshot.forEach(taskDoc => {
                const taskData = taskDoc.data();

                // בדיקה: יש serviceId אבל הוא לא קיים בלקוח
                if (taskData.serviceId && !validServiceIds.has(taskData.serviceId)) {
                    orphanedTasks.push({
                        taskId: taskDoc.id,
                        clientId: clientId,
                        clientName: clientData.fullName,
                        serviceId: taskData.serviceId,
                        hours: taskData.hours || taskData.duration || 0,
                        date: taskData.date || taskData.taskDate,
                        createdAt: taskData.createdAt ? (taskData.createdAt.toDate ? taskData.createdAt.toDate() : new Date(taskData.createdAt)) : null,
                        description: taskData.description || taskData.action || ''
                    });
                }
            });
        }

        console.log(`\nנמצאו ${orphanedTasks.length} משימות יתומות`);

        // 2. קיבוץ לפי serviceId
        console.log('\n\n📊 שלב 2: קיבוץ לפי serviceId שנמחק');
        console.log('-'.repeat(80));

        const byServiceId = {};
        orphanedTasks.forEach(task => {
            if (!byServiceId[task.serviceId]) {
                byServiceId[task.serviceId] = [];
            }
            byServiceId[task.serviceId].push(task);
        });

        console.log(`\nמספר שירותים שנמחקו: ${Object.keys(byServiceId).length}`);

        // מיון לפי כמות משימות
        const sortedServices = Object.entries(byServiceId)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 10);

        console.log('\n10 שירותים עם הכי הרבה משימות יתומות:\n');

        sortedServices.forEach(([serviceId, tasks], index) => {
            const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);
            const clients = new Set(tasks.map(t => t.clientName));

            console.log(`${index + 1}. Service ID: ${serviceId}`);
            console.log(`   משימות: ${tasks.length}`);
            console.log(`   סה"כ שעות: ${totalHours.toFixed(2)}`);
            console.log(`   לקוחות: ${Array.from(clients).join(', ')}`);

            // האם זה stage ID? (stage_a, stage_b, stage_c)
            if (serviceId.startsWith('stage_')) {
                console.log('   ⚠️  זה stage ID ולא service ID!');
            }

            console.log('');
        });

        // 3. בדיקת תאריכים
        console.log('\n📊 שלב 3: מתי נוצרו המשימות היתומות?');
        console.log('-'.repeat(80));

        const tasksWithDates = orphanedTasks.filter(t => t.createdAt);
        tasksWithDates.sort((a, b) => a.createdAt - b.createdAt);

        if (tasksWithDates.length > 0) {
            const first = tasksWithDates[0];
            const last = tasksWithDates[tasksWithDates.length - 1];

            console.log('\nטווח תאריכים:');
            console.log(`   ראשונה: ${first.createdAt.toLocaleString('he-IL')}`);
            console.log(`   אחרונה: ${last.createdAt.toLocaleString('he-IL')}`);

            // התפלגות לפי חודש
            const byMonth = {};
            tasksWithDates.forEach(task => {
                const month = task.createdAt.toISOString().substring(0, 7);
                byMonth[month] = (byMonth[month] || 0) + 1;
            });

            console.log('\nהתפלגות לפי חודש:');
            Object.entries(byMonth)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .forEach(([month, count]) => {
                    console.log(`   ${month}: ${count} משימות`);
                });
        }

        // 4. האם יש תבנית משותפת?
        console.log('\n\n📊 שלב 4: ניתוח תבניות');
        console.log('-'.repeat(80));

        // כמה משימות עם stage_a, stage_b, stage_c?
        const stageIds = orphanedTasks.filter(t =>
            t.serviceId === 'stage_a' ||
            t.serviceId === 'stage_b' ||
            t.serviceId === 'stage_c'
        );

        if (stageIds.length > 0) {
            console.log(`\n⚠️  ${stageIds.length} משימות עם stage ID במקום service ID!`);
            console.log('   זו בעיה בקוד - המשימה שמרה stage ID במקום service ID');

            const stageBreakdown = {
                'stage_a': stageIds.filter(t => t.serviceId === 'stage_a').length,
                'stage_b': stageIds.filter(t => t.serviceId === 'stage_b').length,
                'stage_c': stageIds.filter(t => t.serviceId === 'stage_c').length
            };

            console.log(`\n   stage_a: ${stageBreakdown.stage_a}`);
            console.log(`   stage_b: ${stageBreakdown.stage_b}`);
            console.log(`   stage_c: ${stageBreakdown.stage_c}`);
        }

        // כמה serviceIds לא מתחילים ב-srv_?
        const invalidFormat = orphanedTasks.filter(t =>
            t.serviceId &&
            !t.serviceId.startsWith('srv_') &&
            !t.serviceId.startsWith('stage_')
        );

        if (invalidFormat.length > 0) {
            console.log(`\n⚠️  ${invalidFormat.length} משימות עם serviceId בפורמט לא תקין`);
            console.log(`   דוגמאות: ${invalidFormat.slice(0, 5).map(t => t.serviceId).join(', ')}`);
        }

        // 5. מסקנות
        console.log('\n\n💡 מסקנות:');
        console.log('-'.repeat(80));

        console.log(`\n✅ ${orphanedTasks.length} משימות יתומות נמצאו`);
        console.log(`✅ ${Object.keys(byServiceId).length} שירותים נמחקו`);

        if (stageIds.length > 0) {
            console.log(`\n🐛 באג: ${stageIds.length} משימות עם stage ID במקום service ID`);
            console.log('   → זה מסביר למה יש 163 משימות "יתומות"');
            console.log('   → הן לא באמת יתומות - רק ה-serviceId שגוי');
        }

        const totalHoursOrphaned = orphanedTasks.reduce((sum, t) => sum + t.hours, 0);
        console.log(`\n📊 סה"כ ${totalHoursOrphaned.toFixed(2)} שעות "אבודות"`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ חקירה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
