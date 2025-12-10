/**
 * סקריפט בדיקה מקיף לוודא האם קולקציית users קיימת
 * ומה ההבדל בינה לבין employees
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        // Try to load service account from multiple possible locations
        let serviceAccount;
        try {
            serviceAccount = require('./serviceAccountKey.json');
        } catch (e) {
            try {
                serviceAccount = require('./service-account-key.json');
            } catch (e2) {
                console.error('❌ לא נמצא קובץ Service Account');
                console.log('נסה אחד מהבאים:');
                console.log('  - serviceAccountKey.json');
                console.log('  - service-account-key.json');
                process.exit(1);
            }
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'law-office-system-e4801'
        });
        console.log('✅ Firebase initialized successfully\n');
    } catch (error) {
        console.error('❌ Error initializing Firebase:', error.message);
        process.exit(1);
    }
}

const db = admin.firestore();

async function checkCollections() {
    console.log('🔍 בודק קולקציות ב-Firestore...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // 1. בדיקה: האם users קיימת?
        console.log('📌 בדיקה 1: האם קולקציית users קיימת?\n');

        let usersExists = false;
        let usersCount = 0;
        let usersSample = null;

        try {
            const usersSnapshot = await db.collection('users').limit(1).get();
            usersExists = !usersSnapshot.empty;

            if (usersExists) {
                const countSnapshot = await db.collection('users').count().get();
                usersCount = countSnapshot.data().count;
                usersSample = usersSnapshot.docs[0];

                console.log('   ✅ קולקציית users קיימת');
                console.log(`   📊 מספר מסמכים: ${usersCount}`);
                console.log(`   🔑 מסמך לדוגמה ID: ${usersSample.id}`);
                console.log('   📄 שדות:', Object.keys(usersSample.data()).join(', '));
                console.log('   📝 דוגמת נתונים:');
                console.log(JSON.stringify(usersSample.data(), null, 2));
            } else {
                console.log('   ❌ קולקציית users לא קיימת או ריקה');
            }
        } catch (error) {
            console.log('   ❌ שגיאה בגישה ל-users:', error.message);
        }

        console.log('\n───────────────────────────────────────────────────────────\n');

        // 2. בדיקה: האם employees קיימת?
        console.log('📌 בדיקה 2: האם קולקציית employees קיימת?\n');

        let employeesExists = false;
        let employeesCount = 0;
        let employeesSample = null;

        try {
            const employeesSnapshot = await db.collection('employees').limit(1).get();
            employeesExists = !employeesSnapshot.empty;

            if (employeesExists) {
                const countSnapshot = await db.collection('employees').count().get();
                employeesCount = countSnapshot.data().count;
                employeesSample = employeesSnapshot.docs[0];

                console.log('   ✅ קולקציית employees קיימת');
                console.log(`   📊 מספר מסמכים: ${employeesCount}`);
                console.log(`   🔑 מסמך לדוגמה ID: ${employeesSample.id}`);
                console.log('   📄 שדות:', Object.keys(employeesSample.data()).join(', '));
                console.log('   📝 דוגמת נתונים:');
                console.log(JSON.stringify(employeesSample.data(), null, 2));
            } else {
                console.log('   ❌ קולקציית employees לא קיימת או ריקה');
            }
        } catch (error) {
            console.log('   ❌ שגיאה בגישה ל-employees:', error.message);
        }

        console.log('\n───────────────────────────────────────────────────────────\n');

        // 3. השוואה
        console.log('📌 בדיקה 3: השוואה בין הקולקציות\n');

        if (usersExists && employeesExists) {
            console.log('   ⚠️  שתי הקולקציות קיימות!');
            console.log(`   - users: ${usersCount} מסמכים`);
            console.log(`   - employees: ${employeesCount} מסמכים`);

            // בדיקה אם יש חפיפה
            if (usersSample && employeesSample) {
                const usersFields = Object.keys(usersSample.data()).sort();
                const employeesFields = Object.keys(employeesSample.data()).sort();

                console.log('\n   📋 השוואת שדות:');
                console.log('   users שדות:', usersFields.join(', '));
                console.log('   employees שדות:', employeesFields.join(', '));

                // בדיקת חפיפה במזהים
                console.log('\n   🔍 בדיקת חפיפה במזהים...');
                try {
                    const employeeDoc = await db.collection('employees').doc(usersSample.id).get();
                    if (employeeDoc.exists) {
                        console.log(`   ⚠️  אותו ID (${usersSample.id}) קיים בשתי הקולקציות!`);
                        console.log('   זה אומר שכנראה זו אותה קולקציה (או שיש כפילות)');
                    } else {
                        console.log(`   ℹ️  ID ${usersSample.id} קיים רק ב-users`);
                        console.log('   זה אומר שאלו קולקציות שונות');
                    }
                } catch (e) {
                    console.log('   ⚠️  לא הצלחתי לבדוק חפיפה:', e.message);
                }
            }
        } else if (usersExists && !employeesExists) {
            console.log('   ⚠️  רק users קיימת (employees לא קיימת)');
            console.log('   זה אומר שצריך להשתמש ב-users');
        } else if (!usersExists && employeesExists) {
            console.log('   ✅ רק employees קיימת (users לא קיימת)');
            console.log('   זה אומר שצריך להחליף את כל users ל-employees');
        } else {
            console.log('   ❌ אף אחת מהקולקציות לא קיימת!');
        }

        console.log('\n───────────────────────────────────────────────────────────\n');

        // 4. בדיקת subcollections
        console.log('📌 בדיקה 4: בדיקת subcollections תחת users\n');

        if (usersExists && usersSample) {
            try {
                const subcollections = await usersSample.ref.listCollections();
                if (subcollections.length > 0) {
                    console.log(`   ✅ נמצאו ${subcollections.length} subcollections תחת users/${usersSample.id}:`);
                    for (const col of subcollections) {
                        const snapshot = await col.limit(1).get();
                        console.log(`   - ${col.id}: ${snapshot.size > 0 ? 'יש מסמכים ✅' : 'ריק ⚠️'}`);
                    }
                } else {
                    console.log('   ℹ️  אין subcollections תחת users');
                }
            } catch (error) {
                console.log('   ⚠️  שגיאה בבדיקת subcollections:', error.message);
            }
        }

        console.log('\n───────────────────────────────────────────────────────────\n');

        // 5. רשימת כל הקולקציות
        console.log('📌 בדיקה 5: כל הקולקציות ברמה העליונה\n');

        try {
            const collections = await db.listCollections();
            console.log(`   📚 נמצאו ${collections.length} קולקציות:\n`);

            for (const collection of collections) {
                try {
                    const count = await collection.count().get();
                    const docCount = count.data().count;
                    console.log(`   - ${collection.id.padEnd(30)} | ${docCount.toString().padStart(6)} מסמכים`);
                } catch (e) {
                    console.log(`   - ${collection.id.padEnd(30)} | שגיאה בספירה`);
                }
            }
        } catch (error) {
            console.log('   ❌ שגיאה בקבלת רשימת קולקציות:', error.message);
        }

        console.log('\n═══════════════════════════════════════════════════════════\n');

        // 6. המלצה סופית
        console.log('💡 המלצה סופית:\n');

        if (!usersExists && employeesExists) {
            console.log('   ✅ המלצה: החלף את כל users ל-employees');
            console.log('   סיבה: users לא קיימת, employees היא הקולקציה הרשמית');
        } else if (usersExists && !employeesExists) {
            console.log('   ⚠️  המלצה: השאר את users, אל תשנה כלום');
            console.log('   סיבה: employees לא קיימת');
        } else if (usersExists && employeesExists) {
            console.log('   ⚠️  המלצה: דרוש מחקר נוסף');
            console.log('   סיבה: שתי הקולקציות קיימות - צריך להבין למה');
        } else {
            console.log('   ❌ בעיה: אף קולקציה לא קיימת!');
        }

        console.log('\n═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ שגיאה כללית:', error);
        process.exit(1);
    }
}

// Run the check
checkCollections()
    .then(() => {
        console.log('✅ הבדיקה הושלמה בהצלחה\n');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ הבדיקה נכשלה:', err);
        process.exit(1);
    });
