/**
 * בדיקת הגדרות WhatsApp של משתמש
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function checkWhatsAppSettings(email) {
    try {
        console.log(`🔍 מחפש משתמש עם המייל: ${email}\n`);

        const snapshot = await db.collection('employees')
            .where('email', '==', email)
            .get();

        if (snapshot.empty) {
            console.log('❌ לא נמצא משתמש עם המייל הזה');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('═══════════════════════════════════');
            console.log('📋 פרטי המשתמש:');
            console.log('═══════════════════════════════════');
            console.log(`שם עברי:          ${data.name || 'לא צוין'}`);
            console.log(`שם משתמש:         ${data.username || 'לא צוין'}`);
            console.log(`אימייל:           ${data.email}`);
            console.log(`תפקיד:            ${data.role || 'לא צוין'}`);
            console.log(`טלפון:            ${data.phone || 'לא צוין'}`);
            console.log(`WhatsApp מופעל:   ${data.whatsappEnabled ? '✅ כן' : '❌ לא'}`);
            console.log('═══════════════════════════════════\n');

            if (!data.whatsappEnabled) {
                console.log('⚠️  WhatsApp לא מופעל עבור משתמש זה!');
                console.log('💡 כדי להפעיל, עדכן את השדה whatsappEnabled ל-true ב-Firestore');
            } else {
                console.log('✅ WhatsApp מופעל - אתה אמור לקבל הודעות!');
            }
        });

    } catch (error) {
        console.error('❌ שגיאה:', error.message);
    }

    process.exit(0);
}

// Run check
const email = process.argv[2] || 'haim5775@gmail.com';
checkWhatsAppSettings(email);
