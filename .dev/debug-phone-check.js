/**
 * בדיקת מספר טלפון במערכת
 * הרץ עם: node debug-phone-check.js
 */

// קוד לבדיקה מהירה - הדבק בקונסול של Firebase:
console.log(`
📋 הדבק את הקוד הזה בקונסול של דפדפן (F12) באדמין פאנל שלך:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(async function() {
    const phoneToCheck = '549539238'; // המספר שלך ללא +972

    console.log('🔍 מחפש את המספר:', phoneToCheck);

    const snapshot = await window.firebaseDB.collection('employees').get();

    const users = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const userPhone = (data.phone || '').replace(/\\D/g, '');

        users.push({
            id: doc.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            phoneClean: userPhone,
            role: data.role,
            whatsappEnabled: data.whatsappEnabled
        });
    });

    console.log('📊 סך הכל משתמשים:', users.length);
    console.table(users);

    // חפש את המספר שלך
    const myUser = users.find(u => {
        const clean = u.phoneClean;
        return clean.endsWith(phoneToCheck) || phoneToCheck.endsWith(clean);
    });

    if (myUser) {
        console.log('✅ נמצא!', myUser);

        if (myUser.role !== 'admin') {
            console.warn('⚠️ אתה לא admin! התפקיד שלך:', myUser.role);
            console.log('💡 כדי לתקן, הרץ:');
            console.log(\`
                await window.firebaseDB.collection('employees').doc('\${myUser.id}').update({
                    role: 'admin',
                    whatsappEnabled: true,
                    phone: '+972549539238'
                });
                console.log('✅ עודכן!');
            \`);
        } else {
            console.log('✅ אתה admin! הכל בסדר!');
        }
    } else {
        console.error('❌ המספר לא נמצא במערכת!');
        console.log('👥 כל המספרים במערכת:');
        users.forEach(u => {
            console.log(\`- \${u.name}: \${u.phone} (role: \${u.role})\`);
        });
    }
})();

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 הוראות:
1. פתח את האדמין פאנל שלך בדפדפן
2. לחץ F12 (DevTools)
3. עבור ללשונית Console
4. העתק והדבק את הקוד שלמעלה
5. לחץ Enter

זה יראה לך את כל הפרטים ויעזור לתקן אם צריך!
`);
