const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function findTasksAndTimesheets() {
    console.log('🔍 מחפש משימות ושעתונים...\n');

    // בדיקת timesheet_entries
    console.log('📊 timesheet_entries:');
    const timesheetSnapshot = await db.collection('timesheet_entries').limit(3).get();
    timesheetSnapshot.forEach(doc => {
        console.log(`   - ${doc.id}:`, JSON.stringify(doc.data(), null, 2).substring(0, 200));
    });

    // בדיקת budget_tasks
    console.log('\n📊 budget_tasks:');
    const budgetTasksSnapshot = await db.collection('budget_tasks').limit(3).get();
    budgetTasksSnapshot.forEach(doc => {
        console.log(`   - ${doc.id}:`, JSON.stringify(doc.data(), null, 2).substring(0, 200));
    });

    // בדיקת pending_task_approvals
    console.log('\n📊 pending_task_approvals:');
    const pendingSnapshot = await db.collection('pending_task_approvals').limit(3).get();
    pendingSnapshot.forEach(doc => {
        console.log(`   - ${doc.id}:`, JSON.stringify(doc.data(), null, 2).substring(0, 200));
    });

    // בדיקה האם יש subcollections תחת clients או users
    console.log('\n🔍 בדיקת subcollections תחת clients:');
    const clientsSnapshot = await db.collection('clients').limit(1).get();
    if (!clientsSnapshot.empty) {
        const clientDoc = clientsSnapshot.docs[0];
        const collections = await clientDoc.ref.listCollections();
        console.log(`   Client: ${clientDoc.id}`);
        for (const col of collections) {
            const count = await col.count().get();
            console.log(`   - ${col.id}: ${count.data().count} מסמכים`);
        }
    }

    console.log('\n🔍 בדיקת subcollections תחת users:');
    const usersSnapshot = await db.collection('users').limit(1).get();
    if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const collections = await userDoc.ref.listCollections();
        console.log(`   User: ${userDoc.id}`);
        for (const col of collections) {
            const count = await col.count().get();
            console.log(`   - ${col.id}: ${count.data().count} מסמכים`);
        }
    }
}

findTasksAndTimesheets()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ שגיאה:', err);
        process.exit(1);
    });
