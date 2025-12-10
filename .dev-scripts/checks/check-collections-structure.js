const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function checkStructure() {
    console.log('🔍 בודק את מבנה המסמכים...\n');

    // בדיקת משתמש אחד
    const usersSnapshot = await db.collection('users').limit(1).get();

    if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        console.log(`📌 משתמש לדוגמה: ${userDoc.id}`);
        console.log(`   נתונים:`, userDoc.data());

        // בדיקת subcollections
        const collections = await userDoc.ref.listCollections();
        console.log('\n📂 Subcollections תחת המשתמש:');
        for (const collection of collections) {
            const snapshot = await collection.limit(1).get();
            console.log(`   - ${collection.id}: ${snapshot.size > 0 ? 'יש מסמכים' : 'ריק'}`);
        }
    }

    // בדיקת קולקציות ברמה עליונה
    console.log('\n📊 קולקציות ברמה העליונה:');
    const collections = await db.listCollections();
    for (const collection of collections) {
        const count = await collection.count().get();
        console.log(`   - ${collection.id}: ${count.data().count} מסמכים`);
    }
}

checkStructure()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ שגיאה:', err);
        process.exit(1);
    });
