/**
 * בדיקת חישוב דוח - פשוט ומהיר
 *
 * העתק את הקוד הזה לקונסול בדפדפן (F12) בעמוד הדוח עצמו
 */

(async function checkReportCalculation() {
    console.log('🔍 בדיקת חישוב דוח לקוח');
    console.log('='.repeat(60));

    try {
        // 1. בדיקה איזה לקוח פתוח כרגע
        console.log('\n1️⃣ בדיקת לקוח נוכחי...\n');

        // נסה למצוא את שם הלקוח בדף
        const clientNameElement = document.querySelector('.client-name') ||
                                 document.querySelector('[data-client-name]') ||
                                 document.querySelector('h2');

        if (clientNameElement) {
            console.log(`📋 לקוח: ${clientNameElement.textContent}`);
        }

        // 2. בדיקת הנתונים שנטענו לדוח
        console.log('\n2️⃣ בדיקת נתונים שנטענו...\n');

        if (window.ClientReportModal && window.ClientReportModal.currentData) {
            const data = window.ClientReportModal.currentData;

            console.log('📊 נתוני הדוח:');
            console.log(`   רשומות שעתון: ${data.timesheetEntries?.length || 0}`);
            console.log(`   משימות: ${data.budgetTasks?.length || 0}`);

            // בדיקת סיכום שעות
            if (data.timesheetEntries && data.timesheetEntries.length > 0) {
                console.log('\n3️⃣ חישוב סיכום שעות:\n');

                let totalMinutes = 0;
                const byService = {};

                data.timesheetEntries.forEach(entry => {
                    const minutes = entry.minutes || 0;
                    totalMinutes += minutes;

                    const serviceName = entry.serviceName || '❌ ללא שירות';
                    if (!byService[serviceName]) {
                        byService[serviceName] = 0;
                    }
                    byService[serviceName] += minutes;
                });

                console.log('📈 סיכום לפי שירות:');
                Object.keys(byService).forEach(service => {
                    const hours = (byService[service] / 60).toFixed(2);
                    console.log(`   ${service}: ${hours} שעות`);
                });

                console.log(`\n📊 סה"כ שעות: ${(totalMinutes / 60).toFixed(2)}`);

                // בדיקה אם יש רשומות ללא serviceName
                const entriesWithoutService = data.timesheetEntries.filter(e => !e.serviceName);
                if (entriesWithoutService.length > 0) {
                    console.log(`\n⚠️  ${entriesWithoutService.length} רשומות ללא serviceName!`);
                    console.log('   זה עלול לגרום לבעיה בסיכום הדוח');
                }
            }

            // בדיקת טווח תאריכים
            if (data.startDate && data.endDate) {
                console.log('\n4️⃣ טווח תאריכים:\n');
                console.log(`   מ: ${new Date(data.startDate).toLocaleDateString('he-IL')}`);
                console.log(`   עד: ${new Date(data.endDate).toLocaleDateString('he-IL')}`);
            }

        } else {
            console.log('⚠️  לא נמצאו נתוני דוח. האם הדוח פתוח?');
            console.log('💡 פתח דוח ללקוח ואז רוץ את הסקריפט שוב');
        }

        // 3. בדיקת HTML של הדוח
        console.log('\n5️⃣ בדיקת תצוגת הדוח:\n');

        const reportContainer = document.querySelector('.report-container') ||
                               document.querySelector('[data-report]');

        if (reportContainer) {
            // חפש את הסיכום
            const summaryElement = reportContainer.querySelector('.summary') ||
                                  reportContainer.querySelector('[data-summary]') ||
                                  reportContainer.querySelector('.total-hours');

            if (summaryElement) {
                console.log('✅ נמצא אלמנט סיכום:');
                console.log(`   תוכן: ${summaryElement.textContent}`);
            } else {
                console.log('⚠️  לא נמצא אלמנט סיכום בדוח');
                console.log('   זו עשויה להיות הבעיה!');
            }

            // חפש טבלת שעות
            const hoursTable = reportContainer.querySelector('table');
            if (hoursTable) {
                const rows = hoursTable.querySelectorAll('tbody tr');
                console.log(`\n📋 טבלת שעות: ${rows.length} שורות`);
            }
        } else {
            console.log('⚠️  לא נמצא מיכל הדוח');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ בדיקה הושלמה!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
    }
})();
