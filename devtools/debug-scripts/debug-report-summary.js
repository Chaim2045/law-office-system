/**
 * בדיקת סיכום דוח - Debug מפורט
 *
 * העתק את הקוד הזה **בדיוק אחרי** שהדוח נפתח
 */

(async function debugReportSummary() {
    console.log('🐛 Debug: בדיקת סיכום דוח');
    console.log('='.repeat(70));

    try {
        const db = firebase.firestore();

        // 1. קבל את תמיר אקווע
        const clientId = '2025006';
        const clientDoc = await db.collection('clients').doc(clientId).get();

        if (!clientDoc.exists) {
            console.error('❌ לקוח לא נמצא');
            return;
        }

        const client = { id: clientDoc.id, ...clientDoc.data() };

        console.log('\n1️⃣ נתוני הלקוח:');
        console.log(`   ID: ${client.id}`);
        console.log(`   שם: ${client.fullName}`);
        console.log(`   type: "${client.type}"`);
        console.log(`   procedureType: "${client.procedureType || 'undefined'}"`);
        console.log(`   שירותים: ${client.services?.length || 0}`);

        // 2. בדיקת תנאי renderFinalSummary
        console.log('\n2️⃣ בדיקת תנאי renderFinalSummary:');

        const condition1 = client.type === 'hours';
        const condition2 = client.type === 'legal_procedure';
        const condition3 = client.procedureType === 'legal_procedure';

        console.log(`   client.type === 'hours': ${condition1}`);
        console.log(`   client.type === 'legal_procedure': ${condition2}`);
        console.log(`   client.procedureType === 'legal_procedure': ${condition3}`);

        const shouldShowSummary = condition1 || condition2 || condition3;
        console.log(`   \n   ✅ האם אמור להציג סיכום? ${shouldShowSummary ? 'כן' : 'לא'}`);

        if (!shouldShowSummary) {
            console.log('\n   ⚠️  זו הבעיה! הסיכום לא יוצג כי התנאי לא מתקיים!');
            return;
        }

        // 3. חישוב שעות שירותים
        console.log('\n3️⃣ חישוב שעות שירותים:');

        let serviceTotalHours = 0;
        let serviceUsedHours = 0;
        let serviceRemainingHours = 0;

        if (client.services && client.services.length > 0) {
            console.log(`   יש ${client.services.length} שירותים:\n`);

            client.services.forEach((service, index) => {
                const totalHours = service.totalHours || service.hours || 0;
                const remainingHours = service.hoursRemaining || service.remainingHours || 0;
                const usedHours = totalHours - remainingHours;

                console.log(`   שירות #${index + 1}: ${service.name || service.serviceName}`);
                console.log(`      totalHours: ${totalHours}`);
                console.log(`      hoursRemaining: ${remainingHours}`);
                console.log(`      usedHours: ${usedHours}`);

                serviceTotalHours += totalHours;
                serviceRemainingHours += remainingHours;
                serviceUsedHours += usedHours;
            });

            console.log('\n   📊 סיכום כולל:');
            console.log(`      סה"כ תקציב: ${serviceTotalHours.toFixed(1)} שעות`);
            console.log(`      שעות ששוש: ${serviceUsedHours.toFixed(1)} שעות`);
            console.log(`      יתרה: ${serviceRemainingHours.toFixed(1)} שעות`);

        } else {
            console.log('   ⚠️  אין שירותים מוגדרים!');

            // Fallback
            serviceTotalHours = client.totalHours || 0;
            serviceUsedHours = (client.totalHours || 0) - (client.hoursRemaining || 0);
            serviceRemainingHours = client.hoursRemaining || 0;

            console.log('   Fallback מ-client:');
            console.log(`      totalHours: ${serviceTotalHours}`);
            console.log(`      hoursRemaining: ${serviceRemainingHours}`);
        }

        // 4. בדיקה אם הסיכום מוצג ב-HTML
        console.log('\n4️⃣ בדיקת HTML:');

        const summaryElements = document.querySelectorAll('[style*="border-top"]');
        console.log(`   נמצאו ${summaryElements.length} אלמנטים עם border-top`);

        summaryElements.forEach((el, index) => {
            const text = el.textContent.trim();
            if (text.includes('סיכום')) {
                console.log(`\n   ✅ נמצא סיכום #${index + 1}:`);
                console.log(`      ${text.substring(0, 200)}`);
            }
        });

        // חיפוש ספציפי לסיכום
        const allText = document.body.innerText;
        if (allText.includes('תקציב') && allText.includes('בוצעו') && allText.includes('יתרה')) {
            console.log('\n   ✅ מצאתי את הסיכום בדף!');

            // נסה למצוא את השורה המדויקת
            const lines = allText.split('\n');
            const summaryLine = lines.find(line =>
                line.includes('תקציב') && line.includes('בוצעו') && line.includes('יתרה')
            );

            if (summaryLine) {
                console.log(`   טקסט: "${summaryLine.trim()}"`);
            }
        } else {
            console.log('\n   ❌ הסיכום לא נמצא בדף!');
            console.log('   זו הבעיה - הסיכום אמור להיות שם אבל הוא לא!');
        }

        // 5. בדיקה אם זה `formData.service` שגורם לבעיה
        console.log('\n5️⃣ בדיקת formData:');

        if (window.ClientReportModal && window.ClientReportModal.currentData) {
            const formData = window.ClientReportModal.currentData.formData;
            console.log(`   formData.service: "${formData.service}"`);
            console.log(`   formData.reportFormat: "${formData.reportFormat}"`);
            console.log(`   formData.reportType: "${formData.reportType}"`);
        } else {
            console.log('   ⚠️  formData לא זמין (הדוח לא פתוח?)');
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ Debug הושלם!');

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('Stack:', error.stack);
    }
})();
