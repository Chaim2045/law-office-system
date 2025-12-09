/**
 * תיקון מהיר - עדכון מספר טלפון ל-admin
 * הרץ: node fix-phone-admin.js
 */

const admin = require('firebase-admin');

// Initialize Firebase
admin.initializeApp({
    projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

async function fixPhoneAdmin() {
    try {
        console.log('🔍 מחפש את כל המשתמשים...\n');

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
            console.log(`   💬 WhatsApp: ${user.whatsappEnabled ? '✅' : '❌'}`);
            console.log('');
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // חפש משתמש עם המספר +972549539238
        const phoneToFind = '549539238';
        const foundUser = users.find(u => {
            const cleanPhone = (u.phone || '').replace(/\D/g, '');
            return cleanPhone.includes(phoneToFind) || phoneToFind.includes(cleanPhone);
        });

        if (foundUser) {
            console.log(`✅ נמצא משתמש עם המספר!`);
            console.log(`   שם: ${foundUser.name}`);
            console.log(`   Email: ${foundUser.email}`);
            console.log(`   Role: ${foundUser.role}`);
            console.log('');

            if (foundUser.role !== 'admin') {
                console.log('⚠️  המשתמש לא admin - מעדכן...');

                await db.collection('employees').doc(foundUser.id).update({
                    role: 'admin',
                    whatsappEnabled: true,
                    phone: '+972549539238'
                });

                console.log('✅ עודכן בהצלחה!');
            } else {
                console.log('✅ המשתמש כבר admin!');

                // עדכן את המספר והגדרות WhatsApp למקרה שחסרים
                await db.collection('employees').doc(foundUser.id).update({
                    whatsappEnabled: true,
                    phone: '+972549539238'
                });

                console.log('✅ עדכנתי את ההגדרות');
            }
        } else {
            console.log('❌ המספר +972549539238 לא נמצא במערכת!');
            console.log('');
            console.log('💡 אפשרויות:');
            console.log('');

            // הצג משתמשים אדמינים
            const admins = users.filter(u => u.role === 'admin');
            if (admins.length > 0) {
                console.log('👥 משתמשים עם תפקיד Admin:');
                admins.forEach((admin, i) => {
                    console.log(`   ${i + 1}. ${admin.name} (${admin.email})`);
                });
                console.log('');
                console.log('📝 אם אחד מהם זה אתה, ספר לי איזה (המספר) ואני אעדכן את הטלפון שלו');
            }
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ שגיאה:', error);
        process.exit(1);
    }
}

// הרץ
fixPhoneAdmin();
