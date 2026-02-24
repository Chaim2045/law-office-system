/** Auth Module — אימות, הרשאות, ניהול משתמשים */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString, isValidEmail } = require('../shared/validators');

const db = admin.firestore();
const auth = admin.auth();

// ===============================
// Authentication Functions
// ===============================

/**
 * יצירת משתמש חדש ב-Firebase Authentication
 * רק למנהלים (admin)
 */
exports.createAuthUser = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    const caller = await checkUserPermissions(context);

    if (caller.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים ליצור משתמשים חדשים'
      );
    }

    // Validation
    if (!data.email || !data.password || !data.displayName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות חובה: email, password, displayName'
      );
    }

    if (!isValidEmail(data.email)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כתובת אימייל לא תקינה'
      );
    }

    if (data.password.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סיסמה חייבת להיות לפחות 6 תווים'
      );
    }

    // בדיקה אם המשתמש כבר קיים
    try {
      await auth.getUserByEmail(data.email);
      throw new functions.https.HttpsError(
        'already-exists',
        `משתמש עם האימייל ${data.email} כבר קיים`
      );
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // יצירת המשתמש
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: sanitizeString(data.displayName),
      emailVerified: false,
      disabled: !data.isActive
    });

    // הגדרת Custom Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: data.role || 'employee',
      oldUsername: data.oldUsername || null
    });

    // יצירת מסמך ב-Firestore (use EMAIL as document ID - industry standard)
    await db.collection('employees').doc(data.email).set({
      authUID: userRecord.uid,
      username: data.oldUsername || data.email.split('@')[0],  // username for display
      displayName: sanitizeString(data.displayName),
      name: sanitizeString(data.displayName),
      email: data.email,
      role: data.role || 'employee',
      isActive: data.isActive !== false,
      mustChangePassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: caller.username,
      lastLogin: null,
      loginCount: 0,
      migratedToAuth: true
    });

    // Audit log
    await logAction('CREATE_USER', caller.uid, caller.username, {
      newUserId: userRecord.uid,
      newUserEmail: data.email,
      role: data.role
    });

    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email
    };

  } catch (error) {
    console.error('Error in createAuthUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת משתמש: ${error.message}`
    );
  }
});

exports.linkAuthToEmployee = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לקשר Auth UID לעובדים'
      );
    }

    // Note: Now using EMAIL as document ID (industry standard)
    if (!data.email || !data.authUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות: email, authUID'
      );
    }

    // עדכון העובד (use EMAIL as document ID)
    await db.collection('employees').doc(data.email).update({
      authUID: data.authUID,
      migratedToAuth: true,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedBy: user.username
    });

    // Audit log
    await logAction('LINK_AUTH_TO_EMPLOYEE', user.uid, user.username, {
      employeeEmail: data.email,
      authUID: data.authUID
    });

    return {
      success: true,
      username: data.username
    };

  } catch (error) {
    console.error('Error in linkAuthToEmployee:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בקישור Auth: ${error.message}`
    );
  }
});

/**
 * setAdminClaim - מגדיר Custom Claim של admin למשתמש
 * מאפשר הרשאות מתקדמות ב-Security Rules
 */
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔐 Starting setAdminClaim...');

    // בדיקת הרשאות - רק מי שכבר admin יכול להריץ
    const employee = await checkUserPermissions(context);
    if (!employee.isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להגדיר הרשאות admin'
      );
    }

    const { email, isAdmin } = data;

    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק email'
      );
    }

    // מצא את המשתמש לפי email
    const userRecord = await auth.getUserByEmail(email);

    // הגדר את ה-custom claim
    await auth.setCustomUserClaims(userRecord.uid, {
      admin: isAdmin === true
    });

    console.log(`✅ Custom claim set for ${email}: admin=${isAdmin}`);

    // רישום פעילות
    await logActivity({
      actionType: 'ADMIN_CLAIM_SET',
      targetType: 'user',
      targetId: userRecord.uid,
      performedBy: employee.name,
      performedByUID: context.auth.uid,
      details: {
        email: email,
        isAdmin: isAdmin
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: `הרשאת admin עודכנה בהצלחה עבור ${email}`,
      email: email,
      isAdmin: isAdmin
    };

  } catch (error) {
    console.error('Error in setAdminClaim:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהגדרת הרשאות: ${error.message}`
    );
  }
});

/**
 * initializeAdminClaims - מאתחל custom claims לכל המנהלים
 * פועל פעם אחת להגדרת ההרשאות הראשונית
 * אין בדיקת הרשאות כי זו הפעם הראשונה
 */
exports.initializeAdminClaims = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔐 Starting initializeAdminClaims...');

    // בדיקה שהמשתמש מחובר (אבל לא בודקים אם הוא admin כי זו הפעם הראשונה)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    // מצא את כל העובדים שמסומנים כ-admin
    const adminsSnapshot = await db.collection('employees')
      .where('isAdmin', '==', true)
      .get();

    const results = [];

    for (const doc of adminsSnapshot.docs) {
      const employeeData = doc.data();
      const email = employeeData.email;

      try {
        const userRecord = await auth.getUserByEmail(email);

        await auth.setCustomUserClaims(userRecord.uid, {
          admin: true
        });

        console.log(`✅ Set admin claim for: ${email}`);
        results.push({
          email: email,
          success: true
        });

      } catch (error) {
        console.error(`❌ Failed to set claim for ${email}:`, error);
        results.push({
          email: email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Initialized admin claims for ${results.filter(r => r.success).length}/${results.length} users`);

    return {
      success: true,
      message: `אותחלו הרשאות admin`,
      results: results,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

  } catch (error) {
    console.error('Error in initializeAdminClaims:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה באתחול הרשאות: ${error.message}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 🔐 SET ADMIN CLAIMS - One-Time Setup Function
// ═══════════════════════════════════════════════════════════════════════
exports.setAdminClaims = functions.https.onRequest(async (req, res) => {
  const adminEmails = [
    'haim@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
  ];

  const results = [];

  for (const email of adminEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { role: 'admin' });
      results.push(`✅ Set admin claims for: ${email}`);
      console.log(`✅ Set admin claims for: ${email}`);
    } catch (error) {
      results.push(`❌ Error setting claims for ${email}: ${error.message}`);
      console.error(`❌ Error setting claims for ${email}:`, error);
    }
  }

  res.json({
    success: true,
    results: results
  });
});
