const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkOldUID() {
  try {
    console.log('\n=== בדיקת UID הישן ===\n');

    const oldUID = 'MljNwI8IK9dnd3p8mC0cxTp3yUD3';
    const currentUID = 'Chh0wGc6EZZyOytdISQEq29Yo7v2';

    console.log(`UID ישן (ב-Firestore authUID): ${oldUID}`);
    console.log(`UID נוכחי (ב-Auth): ${currentUID}\n`);

    // Try to get user by old UID
    console.log('1️⃣ ניסיון למצוא משתמש Auth עם ה-UID הישן:\n');
    try {
      const oldUser = await admin.auth().getUser(oldUID);
      console.log('   ✅ נמצא משתמש!');
      console.log(`   Email: ${oldUser.email}`);
      console.log(`   UID: ${oldUser.uid}`);
      console.log(`   Created: ${oldUser.metadata.creationTime}`);
      console.log(`   Last Sign-In: ${oldUser.metadata.lastSignInTime}`);
      console.log(`   Disabled: ${oldUser.disabled}`);
      console.log(`   Providers: ${oldUser.providerData.map(p => p.providerId).join(', ')}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('   ❌ לא נמצא משתמש Auth עם ה-UID הישן');
        console.log('   → המשתמש נמחק או ה-UID שונה');
      } else {
        throw error;
      }
    }

    // Check current UID
    console.log('\n2️⃣ בדיקת המשתמש עם ה-UID הנוכחי:\n');
    const currentUser = await admin.auth().getUser(currentUID);
    console.log('   ✅ נמצא משתמש!');
    console.log(`   Email: ${currentUser.email}`);
    console.log(`   UID: ${currentUser.uid}`);
    console.log(`   Created: ${currentUser.metadata.creationTime}`);
    console.log(`   Last Sign-In: ${currentUser.metadata.lastSignInTime}`);
    console.log(`   Providers: ${currentUser.providerData.map(p => p.providerId).join(', ')}`);

    // Check if there are TWO marva users
    console.log('\n3️⃣ חיפוש כל משתמשי marva@ghlawoffice.co.il:\n');
    const listResult = await admin.auth().listUsers(1000);
    const marvaUsers = listResult.users.filter(u => u.email === 'marva@ghlawoffice.co.il');

    console.log(`   נמצאו ${marvaUsers.length} משתמש/ים עם האימייל marva@ghlawoffice.co.il\n`);

    marvaUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. UID: ${user.uid}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Created: ${user.metadata.creationTime}`);
      console.log(`      Providers: ${user.providerData.map(p => p.providerId).join(', ')}`);
      console.log('');
    });

  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkOldUID();
