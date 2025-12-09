const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function checkUserPermissions() {
  try {
    const uid = 'Q0gNBirQoXPEBONXY88AEhYLxul2';

    console.log('\n🔍 בודק הרשאות למשתמש...\n');

    const user = await auth.getUser(uid);

    console.log('📧 Email:', user.email);
    console.log('🎭 Custom Claims:', user.customClaims || 'אין');
    console.log('🔑 UID:', user.uid);

    if (user.customClaims && user.customClaims.role === 'admin') {
      console.log('\n✅ המשתמש הוא ADMIN - אמור לראות הכל!');
    } else {
      console.log('\n❌ המשתמש לא ADMIN - לא יכול לקרוא clients!');
      console.log('💡 פתרון: הרץ את set-admin-claims.js');
    }

  } catch (error) {
    console.error('❌ שגיאה:', error);
  } finally {
    process.exit(0);
  }
}

checkUserPermissions();
