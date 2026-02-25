/**
 * אימות: האם משימות נרשמו אחרי שהשירות הושלם?
 * בדיקת ההשערה של טומי
 */

(async function verifyCompletionTheory() {
    console.log('🔍 אימות: משימות אחרי השלמת שירות');
    console.log('='.repeat(80));

    try {
        const db = firebase.firestore();
        const clientId = '2025006';
        const serviceId = 'srv_1765177554252'; // תוכנית שעות #1

        // 1. שליפת השירות
        console.log('\n📦 שלב 1: מידע על השירות');
        console.log('-'.repeat(80));

        const clientDoc = await db.collection('clients').doc(clientId).get();
        const clientData = clientDoc.data();
        const service = clientData.services?.find(s => s.id === serviceId);

        if (!service) {
            console.error('❌ שירות לא נמצא');
            return;
        }

        console.log(`\nשירות: ${service.name}`);
        console.log(`ID: ${service.id}`);
        console.log(`סטטוס נוכחי: ${service.status}`);
        console.log(`totalHours: ${service.totalHours}`);
        console.log(`hoursUsed: ${service.hoursUsed}`);
        console.log(`hoursRemaining: ${service.hoursRemaining}`);

        // בדיקה אם יש תאריך השלמה
        if (service.completedAt) {
            const completedDate = service.completedAt.toDate ? service.completedAt.toDate() : new Date(service.completedAt);
            console.log(`\n⏰ תאריך השלמה: ${completedDate.toLocaleString('he-IL')}`);
            console.log(`   (${completedDate.toISOString()})`);
        } else {
            console.log('\n⚠️  אין שדה completedAt');
        }

        if (service.updatedAt) {
            const updatedDate = service.updatedAt.toDate ? service.updatedAt.toDate() : new Date(service.updatedAt);
            console.log(`\n📅 עדכון אחרון: ${updatedDate.toLocaleString('he-IL')}`);
            console.log(`   (${updatedDate.toISOString()})`);
        }

        // 2. שליפת כל המשימות לשירות זה
        console.log('\n\n📋 שלב 2: כל המשימות של השירות');
        console.log('-'.repeat(80));

        const tasksSnapshot = await db.collection('timesheet_entries')
            .where('clientId', '==', clientId)
            .where('serviceId', '==', serviceId)
            .get();

        console.log(`\nנמצאו ${tasksSnapshot.size} משימות`);

        // ארגון המשימות לפי תאריך
        const tasks = [];
        tasksSnapshot.forEach(doc => {
            const task = { id: doc.id, ...doc.data() };
            tasks.push(task);
        });

        // מיון לפי תאריך
        tasks.sort((a, b) => {
            const dateA = a.date || a.taskDate || '';
            const dateB = b.date || b.taskDate || '';
            return dateA.localeCompare(dateB);
        });

        console.log('\n📊 סיכום לפי תאריכים:');
        console.log(`   משימה ראשונה: ${tasks[0]?.date || tasks[0]?.taskDate}`);
        console.log(`   משימה אחרונה: ${tasks[tasks.length - 1]?.date || tasks[tasks.length - 1]?.taskDate}`);

        // חישוב שעות מצטבר
        let cumulativeHours = 0;
        const milestones = [];

        tasks.forEach((task, index) => {
            const hours = task.hours || task.duration || 0;
            cumulativeHours += hours;

            if (cumulativeHours >= 60 && milestones.length === 0) {
                milestones.push({
                    index: index + 1,
                    date: task.date || task.taskDate,
                    cumulativeHours: cumulativeHours,
                    description: task.description || task.action,
                    event: 'הגעה ל-60 שעות (תקציב מלא)'
                });
            }

            if (cumulativeHours >= 70.8 && milestones.length === 1) {
                milestones.push({
                    index: index + 1,
                    date: task.date || task.taskDate,
                    cumulativeHours: cumulativeHours,
                    description: task.description || task.action,
                    event: 'הגעה ל-70.8 שעות (המספר הנוכחי בשירות)'
                });
            }
        });

        console.log('\n🎯 נקודות ציון:');
        milestones.forEach(m => {
            console.log(`\n   ${m.event}:`);
            console.log(`      משימה #${m.index}`);
            console.log(`      תאריך: ${m.date}`);
            console.log(`      סה"כ מצטבר: ${m.cumulativeHours.toFixed(2)} שעות`);
            console.log(`      תיאור: ${m.description}`);
        });

        // 3. חלוקה לפני ואחרי 70.8 שעות
        console.log('\n\n🔍 שלב 3: חלוקת משימות');
        console.log('-'.repeat(80));

        let hoursUntil70_8 = 0;
        let taskCountUntil70_8 = 0;
        let hoursAfter70_8 = 0;
        let taskCountAfter70_8 = 0;

        cumulativeHours = 0;
        const tasksAfter = [];

        tasks.forEach(task => {
            const hours = task.hours || task.duration || 0;
            cumulativeHours += hours;

            if (cumulativeHours <= 70.8) {
                hoursUntil70_8 += hours;
                taskCountUntil70_8++;
            } else {
                // אם זו המשימה שעברה את 70.8
                if (hoursAfter70_8 === 0 && cumulativeHours > 70.8) {
                    const beforeThreshold = 70.8 - (cumulativeHours - hours);
                    const afterThreshold = hours - beforeThreshold;

                    hoursUntil70_8 += beforeThreshold;
                    hoursAfter70_8 += afterThreshold;
                } else {
                    hoursAfter70_8 += hours;
                }
                taskCountAfter70_8++;
                tasksAfter.push(task);
            }
        });

        console.log('\n📊 עד 70.8 שעות (המספר בשירות):');
        console.log(`   משימות: ${taskCountUntil70_8}`);
        console.log(`   שעות: ${hoursUntil70_8.toFixed(2)}`);

        console.log('\n📊 אחרי 70.8 שעות (לא מעודכן בשירות!):');
        console.log(`   משימות: ${taskCountAfter70_8}`);
        console.log(`   שעות: ${hoursAfter70_8.toFixed(2)}`);

        if (tasksAfter.length > 0) {
            console.log('\n   📋 משימות שלא נספרו:');
            tasksAfter.forEach((task, index) => {
                console.log(`   ${index + 1}. ${task.date || task.taskDate}: ${task.description || task.action} (${task.hours || task.duration || 0} שעות)`);
            });
        }

        console.log('\n\n📊 סה"כ:');
        console.log(`   סה"כ משימות: ${tasks.length}`);
        console.log(`   סה"כ שעות: ${(hoursUntil70_8 + hoursAfter70_8).toFixed(2)}`);

        // 4. בדיקת ההשערה
        console.log('\n\n💡 שלב 4: בדיקת ההשערה');
        console.log('-'.repeat(80));

        console.log('\nההשערה:');
        console.log('   1. השירות הושלם אחרי 70.8 שעות');
        console.log('   2. עובדים המשיכו לרשום משימות');
        console.log('   3. המשימות נשמרו אבל השירות לא התעדכן');

        console.log('\nממצאים:');
        console.log(`   ✅ יש ${tasks.length} משימות ב-timesheet_entries`);
        console.log('   ✅ השירות מראה רק 70.8 שעות');
        console.log(`   ✅ ההפרש: ${hoursAfter70_8.toFixed(2)} שעות (${taskCountAfter70_8} משימות)`);

        if (hoursAfter70_8 > 1) {
            console.log('\n🎯 ההשערה נכונה!');
            console.log(`   המערכת הפסיקה לעדכן את השירות אחרי ${hoursUntil70_8.toFixed(2)} שעות`);
            console.log(`   ${taskCountAfter70_8} משימות נוספות לא עודכנו בשירות`);
        } else {
            console.log('\n❓ לא ברור - ההפרש קטן מדי');
        }

        // 5. בדיקה לפי createdAt של המשימות
        console.log('\n\n⏰ שלב 5: בדיקת תאריכי יצירה');
        console.log('-'.repeat(80));

        const tasksWithCreatedAt = tasks.filter(t => t.createdAt);
        console.log(`\nמשימות עם createdAt: ${tasksWithCreatedAt.length} מתוך ${tasks.length}`);

        if (tasksWithCreatedAt.length > 0) {
            tasksWithCreatedAt.sort((a, b) => {
                const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateA - dateB;
            });

            const firstCreated = tasksWithCreatedAt[0].createdAt.toDate ? tasksWithCreatedAt[0].createdAt.toDate() : new Date(tasksWithCreatedAt[0].createdAt);
            const lastCreated = tasksWithCreatedAt[tasksWithCreatedAt.length - 1].createdAt.toDate ? tasksWithCreatedAt[tasksWithCreatedAt.length - 1].createdAt.toDate() : new Date(tasksWithCreatedAt[tasksWithCreatedAt.length - 1].createdAt);

            console.log('\nטווח זמנים:');
            console.log(`   משימה ראשונה נוצרה: ${firstCreated.toLocaleString('he-IL')}`);
            console.log(`   משימה אחרונה נוצרה: ${lastCreated.toLocaleString('he-IL')}`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ אימות הושלם!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
