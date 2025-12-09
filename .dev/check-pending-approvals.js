/**
 * ═══════════════════════════════════════════════════════════════
 * 🔍 בדיקת משימות ממתינות לאישור
 * ═══════════════════════════════════════════════════════════════
 *
 * הרצה: node check-pending-approvals.js
 */

const admin = require('firebase-admin');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function checkPendingApprovals() {
    try {
        console.log('🔍 בדיקת משימות ממתינות לאישור...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Query 1: כל המסמכים ב-collection
        console.log('📊 Query 1: כל המסמכים ב-pending_task_approvals\n');
        const allSnapshot = await db.collection('pending_task_approvals').get();

        console.log(`סה"כ מסמכים: ${allSnapshot.size}\n`);

        if (allSnapshot.empty) {
            console.log('⚠️ ה-Collection ריק לחלוטין!\n');
            console.log('זה אומר שאין בכלל בקשות אישור במערכת.');
            console.log('נסה ליצור משימה חדשה שדורשת אישור.\n');
            process.exit(0);
            return;
        }

        // הצג את כל המסמכים
        const allTasks = [];
        allSnapshot.forEach(doc => {
            const data = doc.data();
            allTasks.push({
                id: doc.id,
                status: data.status || 'undefined',
                requestedBy: data.requestedByName || data.requestedBy || 'unknown',
                client: data.taskData?.clientName || 'לא צוין',
                description: data.taskData?.description?.substring(0, 50) || 'אין תיאור',
                createdAt: data.createdAt?.toDate()?.toISOString() || 'no timestamp',
                hasCreatedAt: !!data.createdAt
            });
        });

        console.log('📋 כל המשימות:\n');
        console.table(allTasks);

        // Query 2: רק pending
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 Query 2: רק משימות עם status="pending"\n');

        const pendingSnapshot = await db.collection('pending_task_approvals')
            .where('status', '==', 'pending')
            .get();

        console.log(`סה"כ משימות pending: ${pendingSnapshot.size}\n`);

        if (pendingSnapshot.empty) {
            console.log('⚠️ אין משימות עם status="pending"!\n');
            console.log('משימות לפי סטטוס:');

            const statusCount = {};
            allSnapshot.forEach(doc => {
                const status = doc.data().status || 'undefined';
                statusCount[status] = (statusCount[status] || 0) + 1;
            });

            Object.entries(statusCount).forEach(([status, count]) => {
                console.log(`  ${status}: ${count} משימות`);
            });

            console.log('\nייתכן שכל המשימות כבר אושרו/נדחו.');
        } else {
            const pendingTasks = [];
            pendingSnapshot.forEach(doc => {
                const data = doc.data();
                pendingTasks.push({
                    id: doc.id,
                    requestedBy: data.requestedByName || data.requestedBy,
                    client: data.taskData?.clientName || 'לא צוין',
                    description: data.taskData?.description?.substring(0, 50),
                    minutes: data.taskData?.budgetMinutes || 0,
                    createdAt: data.createdAt?.toDate()?.toISOString() || 'no timestamp'
                });
            });

            console.log('📋 משימות ממתינות:\n');
            console.table(pendingTasks);
        }

        // Query 3: עם orderBy (כמו הבוט)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 Query 3: pending + orderBy createdAt (כמו הבוט)\n');

        try {
            const sortedSnapshot = await db.collection('pending_task_approvals')
                .where('status', '==', 'pending')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            console.log(`✅ Query הצליח! נמצאו: ${sortedSnapshot.size} משימות\n`);

            if (!sortedSnapshot.empty) {
                const sortedTasks = [];
                sortedSnapshot.forEach(doc => {
                    const data = doc.data();
                    sortedTasks.push({
                        id: doc.id,
                        requestedBy: data.requestedByName || data.requestedBy,
                        client: data.taskData?.clientName || 'לא צוין',
                        minutes: data.taskData?.budgetMinutes || 0,
                        createdAt: data.createdAt?.toDate()?.toISOString()
                    });
                });

                console.log('📋 משימות (ממוינות לפי תאריך):\n');
                console.table(sortedTasks);
            }

        } catch (indexError) {
            console.error('❌ Query נכשל! צריך Index!\n');
            console.error('שגיאה:', indexError.message);

            if (indexError.message.includes('index')) {
                console.log('\n💡 פתרון:');
                console.log('1. צור Index ב-Firestore');
                console.log('2. או הרץ את הפקודה:');
                console.log('   firebase firestore:indexes\n');
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ בדיקה הושלמה!\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ שגיאה:', error);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// הרץ
checkPendingApprovals();
