/**
 * סקריפט למחיקת כל המשימות והשעתונים
 *
 * מוחק:
 * - כל המסמכים בקולקציה budget_tasks (משימות)
 * - כל המסמכים בקולקציה timesheet_entries (שעתונים)
 * - כל המסמכים בקולקציה pending_task_approvals (אישורי משימות)
 *
 * שומר:
 * - כל המסמכים בקולקציה clients
 * - כל המסמכים בקולקציה users
 * - שאר הקולקציות
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

/**
 * מוחק את כל המסמכים מקולקציה
 */
async function deleteCollection(collectionName) {
    console.log(`\n🗑️  מתחיל מחיקת קולקציה: ${collectionName}`);

    const collectionRef = db.collection(collectionName);
    const batchSize = 500; // Firestore מאפשר עד 500 מחיקות בבאצ'
    let deletedCount = 0;

    try {
        while (true) {
            // שלוף את הדוקומנטים הראשונים
            const snapshot = await collectionRef.limit(batchSize).get();

            if (snapshot.empty) {
                console.log(`✅ סיימתי למחוק ${deletedCount} מסמכים מ-${collectionName}`);
                break;
            }

            // צור באצ'
            const batch = db.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // בצע את המחיקה
            await batch.commit();
            deletedCount += snapshot.size;

            console.log(`   נמחקו ${deletedCount} מסמכים עד כה...`);

            // המתן קצת כדי לא להעמיס על Firestore
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error(`❌ שגיאה במחיקת ${collectionName}:`, error);
        throw error;
    }
}

/**
 * ספירת מסמכים בקולקציה (לבדיקה)
 */
async function countDocuments(collectionName) {
    try {
        const snapshot = await db.collection(collectionName).count().get();
        return snapshot.data().count;
    } catch (error) {
        console.error(`שגיאה בספירת ${collectionName}:`, error);
        return -1;
    }
}

/**
 * פונקציה ראשית
 */
async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  🗑️  מחיקת כל המשימות והשעתונים                      ║');
    console.log('║  ⚠️  פעולה זו בלתי הפיכה!                           ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    // ספירה לפני המחיקה
    console.log('📊 ספירת מסמכים לפני המחיקה:');
    const budgetTasksCountBefore = await countDocuments('budget_tasks');
    const timesheetEntriesCountBefore = await countDocuments('timesheet_entries');
    const pendingApprovalsCountBefore = await countDocuments('pending_task_approvals');
    const clientsCount = await countDocuments('clients');

    console.log(`   budget_tasks (משימות): ${budgetTasksCountBefore} מסמכים`);
    console.log(`   timesheet_entries (שעתונים): ${timesheetEntriesCountBefore} מסמכים`);
    console.log(`   pending_task_approvals (אישורים): ${pendingApprovalsCountBefore} מסמכים`);
    console.log(`   clients: ${clientsCount} מסמכים (לא יימחקו)`);

    // המתנה של 5 שניות כדי לאפשר ביטול
    console.log('\n⏳ מתחיל מחיקה בעוד 5 שניות...');
    console.log('   (לחץ Ctrl+C כדי לבטל)\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        // מחיקת משימות
        await deleteCollection('budget_tasks');

        // מחיקת שעתונים
        await deleteCollection('timesheet_entries');

        // מחיקת אישורי משימות
        await deleteCollection('pending_task_approvals');

        // ספירה אחרי המחיקה
        console.log('\n📊 ספירת מסמכים אחרי המחיקה:');
        const budgetTasksCountAfter = await countDocuments('budget_tasks');
        const timesheetEntriesCountAfter = await countDocuments('timesheet_entries');
        const pendingApprovalsCountAfter = await countDocuments('pending_task_approvals');
        const clientsCountAfter = await countDocuments('clients');

        console.log(`   budget_tasks: ${budgetTasksCountAfter} מסמכים`);
        console.log(`   timesheet_entries: ${timesheetEntriesCountAfter} מסמכים`);
        console.log(`   pending_task_approvals: ${pendingApprovalsCountAfter} מסמכים`);
        console.log(`   clients: ${clientsCountAfter} מסמכים (נשמרו)`);

        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║  ✅ המחיקה הושלמה בהצלחה!                           ║');
        console.log(`║  🗑️  נמחקו ${budgetTasksCountBefore} משימות (budget_tasks)                   ║`);
        console.log(`║  🗑️  נמחקו ${timesheetEntriesCountBefore} שעתונים (timesheet_entries)              ║`);
        console.log(`║  🗑️  נמחקו ${pendingApprovalsCountBefore} אישורים (pending_task_approvals)        ║`);
        console.log(`║  ✅ נשמרו ${clientsCountAfter} לקוחות                              ║`);
        console.log('╚═══════════════════════════════════════════════════════╝');

    } catch (error) {
        console.error('\n❌ שגיאה במהלך המחיקה:', error);
        process.exit(1);
    }

    process.exit(0);
}

// הרץ את הסקריפט
main().catch(error => {
    console.error('❌ שגיאה קריטית:', error);
    process.exit(1);
});