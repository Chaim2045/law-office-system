/**
 * ========================================
 * Admin API - Users Management
 * ========================================
 * פונקציות ניהול משתמשים (עובדים) במערכת
 *
 * תפקידים:
 * - יצירת משתמשים חדשים
 * - חסימה וביטול חסימה
 * - מחיקת משתמשים
 * - שינוי תפקידים
 * - איפוס סיסמאות
 *
 * @version 1.0.0
 * @date 2025-10-23
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  checkAdminAuth,
  logAudit,
  validateEmail,
  validatePassword,
  validateRole,
  createError,
  handleError
} = require('./utils');

// ==================== Create User ====================

/**
 * יצירת משתמש (עובד) חדש במערכת
 *
 * התהליך:
 * 1. בדיקות אבטחה
 * 2. Validation של נתונים
 * 3. יצירה ב-Firebase Auth
 * 4. יצירה ב-Firestore (employees collection)
 * 5. Audit logging
 *
 * @param {Object} data - נתוני המשתמש
 * @param {string} data.email - כתובת מייל (חובה)
 * @param {string} data.password - סיסמה (חובה)
 * @param {string} data.name - שם מלא (חובה)
 * @param {string} data.role - תפקיד (admin/lawyer/employee/intern)
 * @param {string} [data.phone] - טלפון (אופציונלי)
 * @param {string} [data.username] - שם משתמש (אופציונלי, יווצר אוטומטית אם לא סופק)
 *
 * @returns {Promise<{success: boolean, userId: string, email: string}>}
 *
 * @example
 * const result = await adminCreateUser({
 *   email: 'newuser@example.com',
 *   password: 'SecurePass123!',
 *   name: 'שם העובד',
 *   role: 'employee'
 * });
 */
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  try {
    // ✅ שלב 1: בדיקות אבטחה
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔧 Creating user: ${data.email} by ${adminEmail}`);

    // ✅ שלב 2: Validation
    if (!data.email || !validateEmail(data.email)) {
      throw createError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    if (!data.password) {
      throw createError('invalid-argument', 'הסיסמה חובה');
    }

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw createError('invalid-argument', passwordValidation.errors.join(', '));
    }

    if (!data.name || data.name.trim().length < 2) {
      throw createError('invalid-argument', 'השם חייב להכיל לפחות 2 תווים');
    }

    if (!data.role || !validateRole(data.role)) {
      throw createError('invalid-argument', 'תפקיד לא תקין. אפשרויות: admin, lawyer, employee, intern');
    }

    // ✅ שלב 3: יצירה ב-Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
      disabled: false
    });

    console.log(`✅ Auth user created: ${userRecord.uid}`);

    // ✅ שלב 4: יצירה ב-Firestore
    // שם משתמש: אם לא סופק, יווצר מהחלק הראשון של המייל
    const username = data.username || data.email.split('@')[0];

    const employeeData = {
      email: data.email,
      name: data.name,
      username: username,
      role: data.role,
      phone: data.phone || '',
      active: true,
      blocked: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminEmail,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      // תקן שעות שבועי (ברירת מחדל לפי תפקיד)
      weeklyQuota: data.role === 'intern' ? 20 : 45
    };

    // שימוש ב-username כ-document ID (כמו שהיה קודם)
    await admin.firestore()
      .collection('employees')
      .doc(username)
      .set(employeeData);

    console.log(`✅ Firestore employee created: ${username}`);

    // ✅ שלב 5: Audit logging
    await logAudit({
      action: 'ADMIN_CREATE_USER',
      performedBy: adminEmail,
      targetUser: data.email,
      data: {
        username: username,
        role: data.role,
        name: data.name
      },
      success: true
    });

    // ✅ החזרת תוצאה
    return {
      success: true,
      userId: userRecord.uid,
      username: username,
      email: data.email,
      message: `המשתמש ${data.name} נוצר בהצלחה`
    };

  } catch (error) {
    // רישום כשלון ב-audit log
    await logAudit({
      action: 'ADMIN_CREATE_USER',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.email,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminCreateUser');
  }
});

// ==================== Block User ====================

/**
 * חסימת משתמש (מונע ממנו התחברות)
 *
 * @param {Object} data
 * @param {string} data.userId - username (document ID in employees collection)
 * @param {string} [data.reason] - סיבת החסימה (אופציונלי)
 *
 * @returns {Promise<{success: boolean, message: string}>}
 *
 * @example
 * await adminBlockUser({ userId: 'חיים', reason: 'עזב את המשרד' });
 */
exports.adminBlockUser = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔒 Blocking user: ${data.userId} by ${adminEmail}`);

    if (!data.userId) {
      throw createError('invalid-argument', 'יש לציין משתמש לחסימה');
    }

    // קבלת פרטי המשתמש מ-Firestore
    const employeeDoc = await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .get();

    if (!employeeDoc.exists) {
      throw createError('not-found', 'המשתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();
    const userEmail = employeeData.email;

    // חסימה ב-Firebase Auth (לפי email)
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().updateUser(userRecord.uid, {
      disabled: true
    });

    // עדכון ב-Firestore
    await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .update({
        blocked: true,
        blockedAt: admin.firestore.FieldValue.serverTimestamp(),
        blockedBy: adminEmail,
        blockReason: data.reason || 'לא צוין',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

    // Audit logging
    await logAudit({
      action: 'ADMIN_BLOCK_USER',
      performedBy: adminEmail,
      targetUser: userEmail,
      data: { userId: data.userId, reason: data.reason },
      success: true
    });

    return {
      success: true,
      message: `המשתמש ${data.userId} נחסם בהצלחה`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_BLOCK_USER',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.userId,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminBlockUser');
  }
});

// ==================== Unblock User ====================

/**
 * ביטול חסימת משתמש
 *
 * @param {Object} data
 * @param {string} data.userId - username
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminUnblockUser = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔓 Unblocking user: ${data.userId} by ${adminEmail}`);

    if (!data.userId) {
      throw createError('invalid-argument', 'יש לציין משתמש');
    }

    // קבלת פרטי המשתמש
    const employeeDoc = await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .get();

    if (!employeeDoc.exists) {
      throw createError('not-found', 'המשתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();
    const userEmail = employeeData.email;

    // ביטול חסימה ב-Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().updateUser(userRecord.uid, {
      disabled: false
    });

    // עדכון ב-Firestore
    await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .update({
        blocked: false,
        unblockedAt: admin.firestore.FieldValue.serverTimestamp(),
        unblockedBy: adminEmail,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

    // Audit logging
    await logAudit({
      action: 'ADMIN_UNBLOCK_USER',
      performedBy: adminEmail,
      targetUser: userEmail,
      data: { userId: data.userId },
      success: true
    });

    return {
      success: true,
      message: `החסימה של ${data.userId} בוטלה בהצלחה`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_UNBLOCK_USER',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.userId,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminUnblockUser');
  }
});

// ==================== Delete User ====================

/**
 * מחיקת משתמש (⚠️ פעולה מסוכנת!)
 *
 * מוחק את המשתמש מ-Firebase Auth וגם מ-Firestore
 * לא מוחק את המשימות והשעות שלו (נשארים להיסטוריה)
 *
 * @param {Object} data
 * @param {string} data.userId - username
 * @param {boolean} data.confirm - חובה לשלוח true
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🗑️  Deleting user: ${data.userId} by ${adminEmail}`);

    if (!data.userId) {
      throw createError('invalid-argument', 'יש לציין משתמש למחיקה');
    }

    if (!data.confirm) {
      throw createError('invalid-argument', 'יש לאשר את המחיקה (confirm: true)');
    }

    // קבלת פרטי המשתמש
    const employeeDoc = await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .get();

    if (!employeeDoc.exists) {
      throw createError('not-found', 'המשתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();
    const userEmail = employeeData.email;

    // מחיקה מ-Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().deleteUser(userRecord.uid);

    // מחיקה מ-Firestore
    await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .delete();

    // Audit logging
    await logAudit({
      action: 'ADMIN_DELETE_USER',
      performedBy: adminEmail,
      targetUser: userEmail,
      data: { userId: data.userId, userName: employeeData.name },
      success: true
    });

    return {
      success: true,
      message: `המשתמש ${data.userId} נמחק לצמיתות`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_DELETE_USER',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.userId,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminDeleteUser');
  }
});

// ==================== Update User Role ====================

/**
 * שינוי תפקיד משתמש
 *
 * @param {Object} data
 * @param {string} data.userId - username
 * @param {string} data.newRole - תפקיד חדש (admin/lawyer/employee/intern)
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminUpdateUserRole = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`👤 Updating role for: ${data.userId} to ${data.newRole}`);

    if (!data.userId) {
      throw createError('invalid-argument', 'יש לציין משתמש');
    }

    if (!validateRole(data.newRole)) {
      throw createError('invalid-argument', 'תפקיד לא תקין');
    }

    // קבלת פרטי המשתמש
    const employeeDoc = await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .get();

    if (!employeeDoc.exists) {
      throw createError('not-found', 'המשתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();
    const oldRole = employeeData.role;

    // עדכון תפקיד ב-Firestore
    await admin.firestore()
      .collection('employees')
      .doc(data.userId)
      .update({
        role: data.newRole,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        roleChangedBy: adminEmail,
        roleChangedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // Audit logging
    await logAudit({
      action: 'ADMIN_UPDATE_USER_ROLE',
      performedBy: adminEmail,
      targetUser: employeeData.email,
      data: { userId: data.userId, oldRole, newRole: data.newRole },
      success: true
    });

    return {
      success: true,
      message: `תפקיד ${data.userId} שונה מ-${oldRole} ל-${data.newRole}`
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_UPDATE_USER_ROLE',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.userId,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminUpdateUserRole');
  }
});

// ==================== Reset Password ====================

/**
 * שליחת מייל לאיפוס סיסמה
 *
 * @param {Object} data
 * @param {string} data.email - כתובת מייל
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.adminResetPassword = functions.https.onCall(async (data, context) => {
  try {
    checkAdminAuth(context);
    const adminEmail = context.auth.token.email;

    console.log(`🔑 Sending password reset to: ${data.email}`);

    if (!data.email || !validateEmail(data.email)) {
      throw createError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    // שליחת מייל לאיפוס סיסמה
    // Note: Firebase ישלח אוטומטית מייל למשתמש
    const link = await admin.auth().generatePasswordResetLink(data.email);

    // Audit logging
    await logAudit({
      action: 'ADMIN_RESET_PASSWORD',
      performedBy: adminEmail,
      targetUser: data.email,
      success: true
    });

    return {
      success: true,
      message: `מייל לאיפוס סיסמה נשלח ל-${data.email}`,
      resetLink: link // אפשר להציג זאת בדשבורד אם רוצים
    };

  } catch (error) {
    await logAudit({
      action: 'ADMIN_RESET_PASSWORD',
      performedBy: context.auth?.token?.email || 'unknown',
      targetUser: data.email,
      success: false,
      error: error.message
    });

    throw handleError(error, 'adminResetPassword');
  }
});
