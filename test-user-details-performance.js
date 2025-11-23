// ═══════════════════════════════════════════════════════════════════════
// 🚀 User Details Performance Test - מדידת זמן טעינת פרטי משתמש
// ═══════════════════════════════════════════════════════════════════════
// הדבק את הסקריפט הזה בקונסול באדמין פאנל
// השתמש: testUserDetailsPerformance('user@email.com')
// ═══════════════════════════════════════════════════════════════════════

window.testUserDetailsPerformance = async function(userEmail) {
    console.clear();
    console.log('%c🎯 בדיקת ביצועים - טעינת פרטי משתמש', 'font-size: 20px; font-weight: bold; color: #667eea;');
    console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');

    const db = window.firebaseDB;
    if (!db) {
        console.log('%c❌ Firebase לא מאותחל', 'color: #dc3545; font-weight: bold;');
        return;
    }

    console.log(`%c📧 בודק משתמש: ${userEmail}`, 'color: #667eea;');
    console.log('');

    const startTotal = performance.now();
    const timings = {};

    try {
        // ════════════════════════════════════════════════════════════
        // Step 1: מציאת המשתמש
        // ════════════════════════════════════════════════════════════
        let start = performance.now();
        console.log('%c⏳ 1️⃣ מחפש משתמש...', 'color: #667eea;');

        const usersSnapshot = await db.collection('users')
            .where('email', '==', userEmail)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            console.log('%c❌ משתמש לא נמצא', 'color: #dc3545; font-weight: bold;');
            return;
        }

        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        timings['מציאת משתמש'] = performance.now() - start;
        console.log(`%c✅ נמצא: ${userData.displayName || userEmail}`, 'color: #28a745;');
        console.log(`   └─ ⏱️  ${timings['מציאת משתמש'].toFixed(2)}ms`, 'color: #999;');
        console.log('');

        // ════════════════════════════════════════════════════════════
        // Step 2: טעינת נתונים מפורטים (Cloud Function או Firestore)
        // ════════════════════════════════════════════════════════════
        start = performance.now();
        console.log('%c⏳ 2️⃣ טוען נתוני משתמש מפורטים...', 'color: #667eea;');

        let fullUserData = null;
        try {
            const getUserDetails = window.firebaseFunctions.httpsCallable('getUserDetails');
            const result = await getUserDetails({ userId });
            fullUserData = result.data.user;
            timings['Cloud Function'] = performance.now() - start;
            console.log('%c✅ נתונים נטענו מ-Cloud Function', 'color: #28a745;');
        } catch (error) {
            timings['Cloud Function (נכשל)'] = performance.now() - start;
            console.log('%c⚠️  Cloud Function נכשל, טוען מ-Firestore...', 'color: #ffc107;');

            start = performance.now();
            const userDocDirect = await db.collection('users').doc(userId).get();
            fullUserData = { id: userDocDirect.id, ...userDocDirect.data() };
            timings['Firestore Fallback'] = performance.now() - start;
            console.log('%c✅ נתונים נטענו מ-Firestore', 'color: #28a745;');
        }

        console.log(`   └─ ⏱️  ${Object.values(timings).slice(-1)[0].toFixed(2)}ms`, 'color: #999;');
        console.log('');

        // ════════════════════════════════════════════════════════════
        // Step 3: טעינת לקוחות
        // ════════════════════════════════════════════════════════════
        start = performance.now();
        console.log('%c⏳ 3️⃣ טוען לקוחות...', 'color: #667eea;');

        const clientsSnapshot = await db.collection('clients')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        timings['טעינת לקוחות'] = performance.now() - start;

        console.log(`%c✅ נמצאו ${clients.length} לקוחות`, 'color: #28a745;');
        console.log(`   └─ ⏱️  ${timings['טעינת לקוחות'].toFixed(2)}ms`, 'color: #999;');
        console.log('');

        // ════════════════════════════════════════════════════════════
        // Step 4: טעינת משימות
        // ════════════════════════════════════════════════════════════
        start = performance.now();
        console.log('%c⏳ 4️⃣ טוען משימות...', 'color: #667eea;');

        const tasksSnapshot = await db.collection('tasks')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        timings['טעינת משימות'] = performance.now() - start;

        console.log(`%c✅ נמצאו ${tasks.length} משימות`, 'color: #28a745;');
        console.log(`   └─ ⏱️  ${timings['טעינת משימות'].toFixed(2)}ms`, 'color: #999;');
        console.log('');

        // ════════════════════════════════════════════════════════════
        // Step 5: טעינת לוג פעילות
        // ════════════════════════════════════════════════════════════
        start = performance.now();
        console.log('%c⏳ 5️⃣ טוען לוג פעילות...', 'color: #667eea;');

        const activitySnapshot = await db.collection('activityLogs')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const activity = activitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        timings['טעינת לוג פעילות'] = performance.now() - start;

        console.log(`%c✅ נמצאו ${activity.length} פעולות`, 'color: #28a745;');
        console.log(`   └─ ⏱️  ${timings['טעינת לוג פעילות'].toFixed(2)}ms`, 'color: #999;');
        console.log('');

        // ════════════════════════════════════════════════════════════
        // Step 6: טעינת רשומות שעות
        // ════════════════════════════════════════════════════════════
        start = performance.now();
        console.log('%c⏳ 6️⃣ טוען רשומות שעות...', 'color: #667eea;');

        const timesheetSnapshot = await db.collection('timesheets')
            .where('userId', '==', userId)
            .orderBy('date', 'desc')
            .get();

        const timesheet = timesheetSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        timings['טעינת רשומות שעות'] = performance.now() - start;

        console.log(`%c✅ נמצאו ${timesheet.length} רשומות שעות`, 'color: #28a745;');
        console.log(`   └─ ⏱️  ${timings['טעינת רשומות שעות'].toFixed(2)}ms`, 'color: #999;');
        console.log('');

        // ════════════════════════════════════════════════════════════
        // סיכום
        // ════════════════════════════════════════════════════════════
        const totalTime = performance.now() - startTotal;

        console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');
        console.log('%c📊 סיכום ביצועים', 'font-size: 18px; font-weight: bold; color: #667eea;');
        console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');
        console.log('');

        // מיון לפי זמן (הכי איטי ראשון)
        const sortedTimings = Object.entries(timings).sort((a, b) => b[1] - a[1]);

        sortedTimings.forEach(([name, time]) => {
            const percentage = ((time / totalTime) * 100).toFixed(1);
            let color = '#28a745'; // green
            let icon = '🟢';

            if (time > 100) { color = '#ffc107'; icon = '🟡'; }
            if (time > 300) { color = '#fd7e14'; icon = '🟠'; }
            if (time > 1000) { color = '#dc3545'; icon = '🔴'; }

            console.log(
                `%c${icon} ${name}:%c ${time.toFixed(2)}ms %c(${percentage}%)`,
                'color: #333; font-weight: bold;',
                `color: ${color}; font-weight: bold; font-size: 14px;`,
                'color: #999;'
            );
        });

        console.log('');
        console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');
        console.log(`%c⏱️  סה"כ זמן טעינה: %c${totalTime.toFixed(2)}ms`, 'color: #333; font-weight: bold;', 'color: #667eea; font-weight: bold; font-size: 18px;');

        // דירוג
        let rating = '';
        let ratingColor = '';
        if (totalTime < 500) {
            rating = '🟢 מהיר מאוד - חוויית משתמש מצוינת!';
            ratingColor = '#28a745';
        } else if (totalTime < 1000) {
            rating = '🟡 טוב - זמן סביר';
            ratingColor = '#ffc107';
        } else if (totalTime < 2000) {
            rating = '🟠 בינוני - כדאי לשפר';
            ratingColor = '#fd7e14';
        } else {
            rating = '🔴 איטי - דרוש שיפור';
            ratingColor = '#dc3545';
        }

        console.log(`%c${rating}`, `color: ${ratingColor}; font-weight: bold; font-size: 14px;`);
        console.log('%c════════════════════════════════════════════════════════════════', 'color: #999;');
        console.log('');

        // החזר אובייקט עם כל הנתונים לניתוח נוסף
        return {
            userId,
            userEmail,
            displayName: userData.displayName,
            totalTime,
            timings,
            counts: {
                clients: clients.length,
                tasks: tasks.length,
                activity: activity.length,
                timesheet: timesheet.length
            }
        };

    } catch (error) {
        console.log('%c❌ שגיאה בבדיקה:', 'color: #dc3545; font-weight: bold;');
        console.error(error);
        return null;
    }
};

// הדפסת הוראות שימוש
console.log('%c════════════════════════════════════════════════════════════════', 'color: #667eea;');
console.log('%c🎯 סקריפט מדידת ביצועים נטען בהצלחה!', 'color: #28a745; font-weight: bold;');
console.log('%c════════════════════════════════════════════════════════════════', 'color: #667eea;');
console.log('');
console.log('%cשימוש:', 'font-weight: bold; font-size: 14px;');
console.log('%ctestUserDetailsPerformance("haim@ghlawoffice.co.il")', 'background: #f0f0f0; padding: 5px; border-radius: 3px; font-family: monospace;');
console.log('');
console.log('%cאו בחר משתמש מהרשימה והעתק את המייל', 'color: #999;');
console.log('%c════════════════════════════════════════════════════════════════', 'color: #667eea;');
console.log('');
