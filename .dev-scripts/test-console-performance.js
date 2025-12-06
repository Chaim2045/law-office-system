// ═══════════════════════════════════════════════════════════════════════
// 🚀 Admin Panel Performance Test - Console Script
// ═══════════════════════════════════════════════════════════════════════
// הדבק את הסקריפט הזה בקונסול של הדפדפן באדמין פאנל
// ═══════════════════════════════════════════════════════════════════════

(async function() {
    console.clear();
    console.log('%c🚀 Admin Performance Test', 'font-size: 20px; font-weight: bold; color: #667eea;');
    console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');

    // Wait for Firebase to be initialized
    console.log('%c⏳ ממתין ל-Firebase...', 'color: #667eea;');

    let attempts = 0;
    while (!window.firebaseDB && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.firebaseDB) {
        console.log('%c❌ Firebase לא מאותחל. וודא שאתה באדמין פאנל ושהדף נטען לגמרי.', 'color: #dc3545; font-weight: bold;');
        console.log('%c💡 טיפ: רענן את הדף (Ctrl+R) והמתן שהדף ייטען לגמרי לפני הרצת הסקריפט', 'color: #ffc107;');
        return null;
    }

    console.log('%c✅ Firebase מחובר! (Admin Panel Instance)', 'color: #28a745;');

    // Wait for user authentication
    console.log('%c⏳ בודק אימות משתמש...', 'color: #667eea;');

    const auth = window.firebaseAuth;
    let currentUser = auth.currentUser;

    // If not authenticated yet, wait for auth state change
    if (!currentUser) {
        attempts = 0;
        while (!auth.currentUser && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        currentUser = auth.currentUser;
    }

    if (!currentUser) {
        console.log('%c❌ משתמש לא מחובר. נא להתחבר תחילה.', 'color: #dc3545; font-weight: bold;');
        console.log('%c💡 טיפ: התחבר לאדמין פאנל ואז הרץ את הסקריפט', 'color: #ffc107;');
        return null;
    }

    console.log(`%c✅ משתמש מחובר: ${currentUser.email}`, 'color: #28a745;');

    // Use the Admin Panel's Firestore instance (named app: 'master-admin-panel')
    const db = window.firebaseDB;
    const metrics = {};

    // Helper function to measure time
    async function measure(name, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const end = performance.now();
            const duration = (end - start).toFixed(2);
            metrics[name] = parseFloat(duration);

            // Color coding based on speed
            let color = '#28a745'; // green
            let status = '🟢 מעולה';
            if (duration > 100) { color = '#ffc107'; status = '🟡 טוב'; }
            if (duration > 300) { color = '#fd7e14'; status = '🟠 בינוני'; }
            if (duration > 1000) { color = '#dc3545'; status = '🔴 איטי'; }

            console.log(
                `%c✓ ${name}%c ${duration}ms %c${status}`,
                'color: #333; font-weight: bold;',
                `color: ${color}; font-weight: bold; font-size: 14px;`,
                `color: ${color}; font-size: 12px;`
            );

            return result;
        } catch (error) {
            const end = performance.now();
            const duration = (end - start).toFixed(2);
            console.log(
                `%c✗ ${name}%c ${duration}ms %c❌ נכשל: ${error.message}`,
                'color: #333; font-weight: bold;',
                'color: #dc3545; font-weight: bold;',
                'color: #dc3545;'
            );
            throw error;
        }
    }

    try {
        console.log('\n%c📊 מריץ בדיקות ביצועים...', 'font-size: 14px; color: #667eea;');
        console.log('');

        // Test 1: Fetch Users List
        const users = await measure('1️⃣ טעינת רשימת משתמשים (50)', async () => {
            const snapshot = await db.collection('users').limit(50).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        if (users.length === 0) {
            console.log('%c⚠️ אין משתמשים במערכת', 'color: #ffc107;');
            return;
        }

        const firstUser = users[0];
        console.log(`   └─ נמצאו ${users.length} משתמשים`);

        // Test 2: Fetch Single User Details
        await measure('2️⃣ טעינת פרטי משתמש בודד', async () => {
            const doc = await db.collection('users').doc(firstUser.id).get();
            return { id: doc.id, ...doc.data() };
        });

        // Test 3: Fetch Activity Logs
        const activity = await measure('3️⃣ טעינת לוג פעילות (100 אחרונות)', async () => {
            const snapshot = await db.collection('activityLogs')
                .where('userId', '==', firstUser.id)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
        console.log(`   └─ נמצאו ${activity.length} פעולות`);

        // Test 4: Complex Query
        const activeUsers = await measure('4️⃣ שאילתה מורכבת (משתמשים פעילים)', async () => {
            const snapshot = await db.collection('users')
                .where('isBlocked', '==', false)
                .limit(50)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
        console.log(`   └─ נמצאו ${activeUsers.length} משתמשים פעילים`);

        // Test 5: Batch Read (5 users in parallel)
        await measure('5️⃣ קריאת 5 משתמשים במקביל (batch)', async () => {
            const userIds = users.slice(0, 5).map(u => u.id);
            const promises = userIds.map(id => db.collection('users').doc(id).get());
            const docs = await Promise.all(promises);
            return docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        // Test 6: Count All Users
        const totalUsers = await measure('6️⃣ ספירת סה"כ משתמשים', async () => {
            const snapshot = await db.collection('users').get();
            return snapshot.size;
        });
        console.log(`   └─ סה"כ ${totalUsers} משתמשים במערכת`);

        // Test 7: Fetch User's Clients
        await measure('7️⃣ טעינת לקוחות של משתמש', async () => {
            const snapshot = await db.collection('clients')
                .where('userId', '==', firstUser.id)
                .limit(20)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        // Test 8: Fetch User's Tasks
        await measure('8️⃣ טעינת משימות של משתמש', async () => {
            const snapshot = await db.collection('tasks')
                .where('userId', '==', firstUser.id)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        console.log('\n%c════════════════════════════════════════════════════════════════', 'color: #999;');
        console.log('%c📈 סיכום תוצאות', 'font-size: 16px; font-weight: bold; color: #667eea;');
        console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');

        // Calculate summary
        const times = Object.values(metrics);
        const total = times.reduce((a, b) => a + b, 0);
        const avg = total / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);

        console.log(`\n📊 סה"כ בדיקות:     %c${times.length}`, 'color: #667eea; font-weight: bold;');
        console.log(`⏱️  זמן כולל:        %c${total.toFixed(2)}ms`, 'color: #667eea; font-weight: bold;');
        console.log(`📏 ממוצע:            %c${avg.toFixed(2)}ms`, 'color: #667eea; font-weight: bold;');
        console.log(`⚡ הכי מהיר:        %c${min.toFixed(2)}ms`, 'color: #28a745; font-weight: bold;');
        console.log(`🐌 הכי איטי:        %c${max.toFixed(2)}ms`, 'color: #dc3545; font-weight: bold;');

        // Performance rating
        console.log('\n%c🎯 דירוג ביצועים:', 'font-size: 14px; font-weight: bold;');
        if (avg < 100) {
            console.log('%c   🟢 מעולה - המערכת מהירה מאוד!', 'color: #28a745; font-weight: bold;');
        } else if (avg < 300) {
            console.log('%c   🟡 טוב - ביצועים סבירים', 'color: #ffc107; font-weight: bold;');
        } else if (avg < 1000) {
            console.log('%c   🟠 בינוני - כדאי לשפר', 'color: #fd7e14; font-weight: bold;');
        } else {
            console.log('%c   🔴 איטי - דרוש שיפור', 'color: #dc3545; font-weight: bold;');
        }

        console.log('\n%c════════════════════════════════════════════════════════════════', 'color: #999;');
        console.log('%c✅ הבדיקה הושלמה בהצלחה!', 'font-size: 14px; color: #28a745; font-weight: bold;');
        console.log('%c════════════════════════════════════════════════════════════════\n', 'color: #999;');

        // Return metrics for further analysis
        return {
            metrics,
            summary: { total, avg, min, max, count: times.length },
            users: users.length,
            activity: activity.length
        };

    } catch (error) {
        console.log('\n%c❌ שגיאה בבדיקת ביצועים:', 'color: #dc3545; font-weight: bold;');
        console.error(error);
        return null;
    }
})();
