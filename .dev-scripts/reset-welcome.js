const admin = require('firebase-admin');

// Initialize Firebase Admin with project ID
admin.initializeApp({
  projectId: 'law-office-system-e4801'
});

const db = admin.firestore();

async function resetWelcomeMessage() {
  try {
    const email = 'haim@ghlawoffice.co.il';

    console.log(`מוחק רשומת whatsapp_users עבור: ${email}`);

    await db.collection('whatsapp_users').doc(email).delete();

    console.log('✅ הרשומה נמחקה בהצלחה!');
    console.log('עכשיו תוכל לשלוח הודעה לבוט ולקבל את הודעת הברוכים הבאים המלאה 🎉');

    process.exit(0);
  } catch (error) {
    console.error('❌ שגיאה:', error);
    process.exit(1);
  }
}

resetWelcomeMessage();
