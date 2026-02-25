/**
 * חקירה: איתור הנקודה המדויקת שבה המערכת הפסיקה לעדכן services
 */

(async function findBreakingPoint() {
    console.log('🔍 חקירה: איתור נקודת השבירה');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();

        console.log('\n📊 שלב 1: איסוף נתונים מ-27 השירותים הלא מסונכרנים');
        console.log('-'.repeat(80));

        const clientsSnapshot = await db.collection('clients').get();
        const mismatchedServices = [];

        for (const clientDoc of clientsSnapshot.docs) {
            const clientData = clientDoc.data();

            if (!clientData.services || clientData.services.length === 0) {
                continue;
            }

            for (const service of clientData.services) {
                if (!service.hasOwnProperty('hoursUsed')) {
continue;
}

                // חישוב הנכון
                const tasksSnapshot = await db.collection('timesheet_entries')
                    .where('clientId', '==', clientDoc.id)
                    .where('serviceId', '==', service.id)
                    .get();

                const tasks = [];
                tasksSnapshot.forEach(doc => {
                    const data = doc.data();
                    tasks.push({
                        id: doc.id,
                        hours: data.hours || data.duration || 0,
                        date: data.date || data.taskDate || '',
                        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null,
                        description: data.description || data.action || ''
                    });
                });

                const actualHoursUsed = tasks.reduce((sum, t) => sum + t.hours, 0);
                const diff = Math.abs((service.hoursUsed || 0) - actualHoursUsed);

                if (diff > 0.1) {
                    // מיון משימות לפי תאריך
                    tasks.sort((a, b) => {
                        if (!a.createdAt || !b.createdAt) {
return 0;
}
                        return a.createdAt - b.createdAt;
                    });

                    // מצא נקודת ההפסקה
                    let cumulativeHours = 0;
                    let breakPointIndex = -1;

                    for (let i = 0; i < tasks.length; i++) {
                        cumulativeHours += tasks[i].hours;

                        // האם הגענו למספר ששמור בשירות?
                        if (Math.abs(cumulativeHours - (service.hoursUsed || 0)) < 0.1) {
                            breakPointIndex = i;
                            break;
                        }
                    }

                    mismatchedServices.push({
                        clientName: clientData.fullName,
                        clientId: clientDoc.id,
                        serviceName: service.name,
                        serviceId: service.id,
                        serviceCreatedAt: service.createdAt,
                        storedHoursUsed: service.hoursUsed || 0,
                        actualHoursUsed: actualHoursUsed,
                        diff: diff,
                        totalTasks: tasks.length,
                        tasks: tasks,
                        breakPointIndex: breakPointIndex,
                        breakPointDate: breakPointIndex >= 0 && tasks[breakPointIndex]?.createdAt
                    });
                }
            }
        }

        console.log(`\nנמצאו ${mismatchedServices.length} שירותים לא מסונכרנים\n`);

        // מיון לפי הפרש (הכי גדול קודם)
        mismatchedServices.sort((a, b) => b.diff - a.diff);

        // 2. ניתוח נקודות השבירה
        console.log('\n📊 שלב 2: ניתוח נקודות השבירה');
        console.log('-'.repeat(80));

        const breakDates = [];

        mismatchedServices.forEach((item, index) => {
            console.log(`\n${index + 1}. ${item.clientName} - ${item.serviceName}`);
            console.log(`   שמור: ${item.storedHoursUsed.toFixed(2)} | נכון: ${item.actualHoursUsed.toFixed(2)} | הפרש: ${item.diff.toFixed(2)}`);
            console.log(`   משימות: ${item.totalTasks}`);

            if (item.breakPointIndex >= 0) {
                console.log(`   💥 הפסיק לעדכן אחרי משימה #${item.breakPointIndex + 1}`);
                if (item.breakPointDate) {
                    console.log(`   📅 תאריך: ${item.breakPointDate.toLocaleString('he-IL')}`);
                    breakDates.push(item.breakPointDate);
                }

                const tasksAfter = item.totalTasks - (item.breakPointIndex + 1);
                if (tasksAfter > 0) {
                    console.log(`   ❌ ${tasksAfter} משימות לא נספרו`);
                }
            } else {
                console.log('   ⚠️  לא מצאתי נקודת שבירה מדויקת');
                console.log('   (יכול להיות שהמספר ששמור לא תואם לשום נקודה)');
            }
        });

        // 3. מציאת תבנית משותפת
        console.log('\n\n📊 שלב 3: חיפוש תבנית משותפת');
        console.log('-'.repeat(80));

        if (breakDates.length > 0) {
            // מיון תאריכים
            breakDates.sort((a, b) => a - b);

            const firstBreak = breakDates[0];
            const lastBreak = breakDates[breakDates.length - 1];

            console.log('\nטווח תאריכי שבירה:');
            console.log(`   ראשון: ${firstBreak.toLocaleString('he-IL')}`);
            console.log(`   אחרון: ${lastBreak.toLocaleString('he-IL')}`);

            // התפלגות לפי חודש
            const byMonth = {};
            breakDates.forEach(date => {
                const month = date.toISOString().substring(0, 7);
                byMonth[month] = (byMonth[month] || 0) + 1;
            });

            console.log('\nהתפלגות לפי חודש:');
            Object.entries(byMonth)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .forEach(([month, count]) => {
                    console.log(`   ${month}: ${count} שירותים נשברו`);
                });

            // האם יש צביר?
            const clusters = [];
            let currentCluster = [breakDates[0]];

            for (let i = 1; i < breakDates.length; i++) {
                const diff = (breakDates[i] - breakDates[i-1]) / (1000 * 60 * 60 * 24); // ימים

                if (diff <= 7) {
                    currentCluster.push(breakDates[i]);
                } else {
                    if (currentCluster.length >= 3) {
                        clusters.push([...currentCluster]);
                    }
                    currentCluster = [breakDates[i]];
                }
            }

            if (currentCluster.length >= 3) {
                clusters.push(currentCluster);
            }

            if (clusters.length > 0) {
                console.log('\n🎯 צבירים (3+ שירותים נשברו תוך שבוע):');
                clusters.forEach((cluster, index) => {
                    console.log(`\n   צביר #${index + 1}: ${cluster.length} שירותים`);
                    console.log(`      ${cluster[0].toLocaleDateString('he-IL')} - ${cluster[cluster.length-1].toLocaleDateString('he-IL')}`);
                });
            }
        }

        // 4. בדיקה: האם יש קשר ל-deployments?
        console.log('\n\n📊 שלב 4: קורלציה ל-git deployments');
        console.log('-'.repeat(80));

        console.log('\nכדי למצוא deployments, הרץ:');
        console.log('   git log --since="2025-12-01" --oneline --all');

        console.log('\n💡 מסקנות:');
        console.log('-'.repeat(80));

        console.log(`\n✅ סה"כ ${mismatchedServices.length} שירותים לא מסונכרנים`);
        console.log(`✅ ${breakDates.length} מהם עם נקודת שבירה מזוהה`);

        if (breakDates.length > 0) {
            const avgBreakDate = new Date(breakDates.reduce((sum, d) => sum + d.getTime(), 0) / breakDates.length);
            console.log(`✅ תאריך ממוצע: ${avgBreakDate.toLocaleString('he-IL')}`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ חקירה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
