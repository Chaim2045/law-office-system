/**
 * ========================================
 * Admin API - Utils
 * ========================================
 * פונקציות עזר משותפות לכל ה-Admin Functions
 *
 * תפקידים:
 * - בדיקות אבטחה (Authentication & Authorization)
 * - Validation של נתונים
 * - Audit Logging
 * - Error Handling
 *
 * @version 1.0.0
 * @date 2025-10-23
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ==================== Constants ====================

/**
 * רשימת מנהלי המערכת
 * רק emails אלה יכולים לקרוא ל-Admin Functions
 */
const ADMIN_EMAILS = [
  'haim@ghlawoffice.co.il'
];

/**
 * כללי סיסמה חזקה
 */
const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false
};

// ==================== Authentication & Authorization ====================

/**
 * בדיקת הרשאות Admin
 * זורק exception אם המשתמש לא מורשה
 *
 * @param {functions.https.CallableContext} context - Firebase context
 * @throws {functions.https.HttpsError} אם אין הרשאה
 *
 * @example
 * checkAdminAuth(context); // Throws if not admin
 */
function checkAdminAuth(context) {
  // בדיקה 1: האם המשתמש מחובר?
  if (!context.auth) {
    console.warn('🚫 Unauthenticated access attempt');
    throw new functions.https.HttpsError(
      'unauthenticated',
      'יש להתחבר למערכת'
    );
  }

  // בדיקה 2: האם המשתמש הוא admin?
  const userEmail = context.auth.token.email;
  if (!ADMIN_EMAILS.includes(userEmail)) {
    console.warn(`🚫 Unauthorized access attempt by: ${userEmail}`);
    throw new functions.https.HttpsError(
      'permission-denied',
      'אין לך הרשאות מנהל'
    );
  }

  console.log(`✅ Admin authenticated: ${userEmail}`);
}

// ==================== Audit Logging ====================

/**
 * רישום פעולה ליומן ביקורת
 * כל פעולת admin מתועדת אוטומטית
 *
 * @param {Object} params - פרמטרים
 * @param {string} params.action - שם הפעולה (CREATE_USER, BLOCK_USER, וכו')
 * @param {string} params.performedBy - מייל המנהל שביצע
 * @param {Object} [params.data] - נתונים נוספים
 * @param {string} [params.targetUser] - משתמש מטרה (אם רלוונטי)
 * @param {boolean} [params.success=true] - האם הפעולה הצליחה
 * @param {string} [params.error] - שגיאה (אם נכשלה)
 * @returns {Promise<void>}
 *
 * @example
 * await logAudit({
 *   action: 'CREATE_USER',
 *   performedBy: 'haim@ghlawoffice.co.il',
 *   targetUser: 'newuser@example.com',
 *   data: { role: 'employee' }
 * });
 */
async function logAudit({ action, performedBy, data = {}, targetUser = null, success = true, error = null }) {
  try {
    const auditEntry = {
      action,
      performedBy,
      targetUser,
      data,
      success,
      error,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // רישום IP address (אם זמין)
      // ipAddress: context.rawRequest?.ip || null
    };

    await admin.firestore()
      .collection('admin_audit_log')
      .add(auditEntry);

    console.log(`📝 Audit logged: ${action} by ${performedBy}`);
  } catch (auditError) {
    // חשוב! אל תזרוק error אם Audit נכשל
    // כי זה יכשיל את הפעולה המקורית
    console.error('❌ Failed to log audit:', auditError);
  }
}

// ==================== Validation ====================

/**
 * בדיקת תקינות email
 *
 * @param {string} email - כתובת מייל
 * @returns {boolean} - תקין או לא
 *
 * @example
 * if (!validateEmail('test@example.com')) {
 *   throw new Error('Invalid email');
 * }
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Regex פשוט למייל תקין
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * בדיקת תקינות סיסמה לפי כללים
 *
 * @param {string} password - סיסמה
 * @returns {Object} - { valid: boolean, errors: string[] }
 *
 * @example
 * const result = validatePassword('Test123!');
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 */
function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['הסיסמה חובה'] };
  }

  // בדיקת אורך מינימלי
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`הסיסמה חייבת להכיל לפחות ${PASSWORD_RULES.minLength} תווים`);
  }

  // בדיקת אות גדולה
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
  }

  // בדיקת אות קטנה
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית');
  }

  // בדיקת מספרים
  if (PASSWORD_RULES.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות ספרה אחת');
  }

  // בדיקת תווים מיוחדים (אופציונלי)
  if (PASSWORD_RULES.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות תו מיוחד אחד');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * בדיקת תקינות role
 *
 * @param {string} role - תפקיד
 * @returns {boolean} - תקין או לא
 */
function validateRole(role) {
  const validRoles = ['admin', 'lawyer', 'employee', 'intern'];
  return validRoles.includes(role);
}

// ==================== Error Handling ====================

/**
 * יצירת Error מסוג HttpsError עם הודעה בעברית
 *
 * @param {string} code - קוד שגיאה (invalid-argument, internal, וכו')
 * @param {string} message - הודעת שגיאה בעברית
 * @param {Object} [details] - פרטים נוספים
 * @returns {functions.https.HttpsError}
 *
 * @example
 * throw createError('invalid-argument', 'האימייל לא תקין', { email: 'bad-email' });
 */
function createError(code, message, details = null) {
  return new functions.https.HttpsError(code, message, details);
}

/**
 * טיפול בשגיאות כלליות
 * ממיר שגיאות לפורמט אחיד
 *
 * @param {Error} error - שגיאה מקורית
 * @param {string} context - הקשר (לדוגמה: "createUser")
 * @returns {functions.https.HttpsError}
 */
function handleError(error, context) {
  console.error(`❌ Error in ${context}:`, error);

  // אם זו כבר HttpsError - זרוק אותה כמו שהיא
  if (error instanceof functions.https.HttpsError) {
    return error;
  }

  // אם זו שגיאת Firebase Auth - תרגם לעברית
  if (error.code) {
    const authErrors = {
      'auth/email-already-exists': 'כתובת המייל כבר קיימת במערכת',
      'auth/invalid-email': 'כתובת מייל לא תקינה',
      'auth/invalid-password': 'סיסמה לא תקינה',
      'auth/user-not-found': 'המשתמש לא נמצא',
      'auth/weak-password': 'הסיסמה חלשה מדי'
    };

    const hebrewMessage = authErrors[error.code] || error.message;
    return createError('internal', hebrewMessage);
  }

  // שגיאה כללית
  return createError('internal', 'אירעה שגיאה במערכת. נסה שוב מאוחר יותר');
}

// ==================== Helpers ====================

/**
 * המתנה (sleep)
 * שימושי לבדיקות ו-rate limiting
 *
 * @param {number} ms - מילישניות
 * @returns {Promise<void>}
 *
 * @example
 * await sleep(1000); // Wait 1 second
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * בדיקה אם ערך ריק
 *
 * @param {*} value - ערך לבדיקה
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === null ||
         value === undefined ||
         value === '' ||
         (Array.isArray(value) && value.length === 0) ||
         (typeof value === 'object' && Object.keys(value).length === 0);
}

/**
 * ניקוי אובייקט מערכים ריקים
 *
 * @param {Object} obj - אובייקט
 * @returns {Object} - אובייקט מנוקה
 */
function cleanObject(obj) {
  const cleaned = {};
  for (const key in obj) {
    if (!isEmpty(obj[key])) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

// ==================== Exports ====================

module.exports = {
  // Authentication & Authorization
  checkAdminAuth,
  ADMIN_EMAILS,

  // Audit Logging
  logAudit,

  // Validation
  validateEmail,
  validatePassword,
  validateRole,
  PASSWORD_RULES,

  // Error Handling
  createError,
  handleError,

  // Helpers
  sleep,
  isEmpty,
  cleanObject
};
