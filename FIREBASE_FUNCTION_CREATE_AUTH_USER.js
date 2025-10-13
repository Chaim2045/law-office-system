/**
 * Firebase Cloud Function - יצירת משתמש ב-Firebase Authentication
 *
 * קובץ זה צריך להיות ב-functions/index.js בפרויקט Firebase
 *
 * כיצד להוסיף:
 * 1. פתח Firebase Console
 * 2. Functions → קוד
 * 3. הוסף את הפונקציה הזו
 * 4. Deploy
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// אתחול Admin SDK (פעם אחת בלבד!)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * יצירת משתמש חדש ב-Firebase Authentication
 *
 * @param {Object} data
 * @param {string} data.email - אימייל המשתמש
 * @param {string} data.password - סיסמה (זמנית)
 * @param {string} data.displayName - שם מלא
 * @param {string} data.role - תפקיד (admin/employee/manager)
 * @param {boolean} data.isActive - האם המשתמש פעיל
 * @param {string} data.oldUsername - שם המשתמש הישן (לקישור)
 */
exports.createAuthUser = functions.https.onCall(async (data, context) => {
  try {
    // 1. וידוא שהמשתמש הנוכחי הוא admin
    // (רק admin יכול ליצור משתמשים חדשים)
    if (context.auth) {
      const callerToken = await admin.auth().getUser(context.auth.uid);
      const customClaims = callerToken.customClaims || {};

      if (customClaims.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'רק מנהל יכול ליצור משתמשים'
        );
      }
    }

    // 2. Validation של נתונים
    if (!data.email || !data.password || !data.displayName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות חובה: email, password, displayName'
      );
    }

    // 3. בדיקה אם המשתמש כבר קיים
    try {
      await admin.auth().getUserByEmail(data.email);
      // אם הגענו לכאן, המשתמש כבר קיים
      throw new functions.https.HttpsError(
        'already-exists',
        `משתמש עם האימייל ${data.email} כבר קיים`
      );
    } catch (error) {
      // אם השגיאה היא "user not found" - זה טוב! נמשיך
      if (error.code !== 'auth/user-not-found' && error.code !== 'already-exists') {
        throw error;
      }
      if (error.code === 'already-exists') {
        throw error;
      }
    }

    // 4. יצירת המשתמש ב-Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      emailVerified: false, // יצטרך לאמת אימייל
      disabled: !data.isActive // אם לא פעיל - חסום
    });

    console.log(`✅ Created user: ${userRecord.uid} (${data.email})`);

    // 5. הגדרת Custom Claims (roles)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: data.role || 'employee',
      oldUsername: data.oldUsername || null
    });

    console.log(`✅ Set custom claims for: ${userRecord.uid}`);

    // 6. יצירת/עדכון מסמך המשתמש ב-Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: data.email,
      displayName: data.displayName,
      role: data.role || 'employee',
      isActive: data.isActive !== false,
      oldUsername: data.oldUsername || null,
      mustChangePassword: true, // יכריח שינוי סיסמה בכניסה ראשונה
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth ? context.auth.uid : 'system',
      metadata: {
        loginCount: 0,
        lastLogin: null,
        lastIP: null,
        lastUserAgent: null
      }
    });

    console.log(`✅ Created Firestore doc for: ${userRecord.uid}`);

    // 7. אם יש oldUsername, עדכן את ה-employee הישן
    if (data.oldUsername) {
      try {
        await admin.firestore()
          .collection('employees')
          .doc(data.oldUsername)
          .update({
            authUID: userRecord.uid,
            migratedToAuth: true,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });

        console.log(`✅ Updated old employee record: ${data.oldUsername}`);
      } catch (error) {
        console.error(`⚠️ Failed to update old employee: ${error.message}`);
        // לא נזרוק שגיאה - זה לא קריטי
      }
    }

    // 8. החזרת תוצאה
    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    };

  } catch (error) {
    console.error('❌ Error creating user:', error);

    // זריקת שגיאה ידידותית למשתמש
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת משתמש: ${error.message}`
    );
  }
});

/**
 * מחיקת משתמש מ-Firebase Authentication
 * (רק למנהלים)
 */
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'לא מחובר');
    }

    const callerToken = await admin.auth().getUser(context.auth.uid);
    const customClaims = callerToken.customClaims || {};

    if (customClaims.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהל יכול למחוק משתמשים'
      );
    }

    // מחיקת המשתמש
    await admin.auth().deleteUser(data.uid);

    // מחיקת המסמך מ-Firestore
    await admin.firestore().collection('users').doc(data.uid).delete();

    return { success: true };

  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * עדכון תפקיד משתמש (role)
 * (רק למנהלים)
 */
exports.updateUserRole = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'לא מחובר');
    }

    const callerToken = await admin.auth().getUser(context.auth.uid);
    const customClaims = callerToken.customClaims || {};

    if (customClaims.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהל יכול לעדכן תפקידים'
      );
    }

    // עדכון Custom Claims
    await admin.auth().setCustomUserClaims(data.uid, {
      role: data.role
    });

    // עדכון ב-Firestore
    await admin.firestore().collection('users').doc(data.uid).update({
      role: data.role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * חסימה/ביטול חסימה של משתמש
 * (רק למנהלים)
 */
exports.toggleUserActive = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'לא מחובר');
    }

    const callerToken = await admin.auth().getUser(context.auth.uid);
    const customClaims = callerToken.customClaims || {};

    if (customClaims.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהל יכול לחסום משתמשים'
      );
    }

    // עדכון סטטוס
    await admin.auth().updateUser(data.uid, {
      disabled: !data.isActive
    });

    // עדכון ב-Firestore
    await admin.firestore().collection('users').doc(data.uid).update({
      isActive: data.isActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
