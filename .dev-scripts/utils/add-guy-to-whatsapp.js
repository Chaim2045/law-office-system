/**
 * הוספת גיא לבוט WhatsApp
 * הרצה: node add-guy-to-whatsapp.js
 */

const admin = require('firebase-admin');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function addGuyToWhatsApp() {
    try {
        console.log('🔍 מחפש את כל המשתמשים במערכת...\n');

        const snapshot = await db.collection('employees').get();

        console.log(`📊 נמצאו ${snapshot.size} משתמשים\n`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                id: doc.id,
                name: data.name || 'לא צוין',
                email: data.email,
                phone: data.phone || 'אין טלפון',
                role: data.role || 'לא צוין',
                whatsappEnabled: data.whatsappEnabled || false
            });
        });

        // הצג את כל המשתמשים
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name}`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   📱 Phone: ${user.phone}`);
            console.log(`   🎭 Role: ${user.role}`);
            console.log(`   💬 WhatsApp: ${user.whatsappEnabled ? '✅ מופעל' : '❌ לא מופעל'}`);
            console.log('');
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📝 כדי להוסיף את גיא לבוט WhatsApp, אני צריך לדעת:\n');
        console.log('1️⃣ מה השם שלו במערכת? (בדוק ברשימה למעלה)');
        console.log('2️⃣ מה מספר הטלפון שלו? (פורמט: +972501234567)\n');
        console.log('💡 דוגמה לשימוש:');
        console.log('   אם השם במערכת הוא "גיא כהן" והטלפון 0501234567');
        console.log('   אז תגיד לי: "גיא כהן, 0501234567"\n');

        // חפש משתמשים בשם גיא
        const guyUsers = users.filter(u =>
            u.name.includes('גיא') ||
            u.name.toLowerCase().includes('guy')
        );

        if (guyUsers.length > 0) {
            console.log('🔍 מצאתי משתמשים עם השם "גיא":\n');
            guyUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.name} (${user.email})`);
                console.log(`   📱 טלפון: ${user.phone}`);
                console.log(`   💬 WhatsApp: ${user.whatsappEnabled ? '✅ כבר מופעל' : '❌ לא מופעל'}`);
                console.log('');
            });

            console.log('💡 אם זה המשתמש הנכון, תגיד לי איזה מספר מהרשימה');
            console.log('   ואני אוסיף לו WhatsApp!\n');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ שגיאה:', error);
        process.exit(1);
    }
}

// הרץ
addGuyToWhatsApp();
