/** Auth Utilities — כלי אימות והרשאות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * בדיקת הרשאות משתמש
 */
async function checkUserPermissions(context) {
  // בדיקה שהמשתמש מחובר
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'נדרשת התחברות למערכת'
    );
  }

  const uid = context.auth.uid;

  // טעינת פרטי העובד מ-Firestore
  const employeeSnapshot = await db.collection('employees')
    .where('authUID', '==', uid)
    .limit(1)
    .get();

  if (employeeSnapshot.empty) {
    throw new functions.https.HttpsError(
      'not-found',
      'עובד לא נמצא במערכת'
    );
  }

  const employeeDoc = employeeSnapshot.docs[0];
  const employee = employeeDoc.data();

  // בדיקה שהעובד פעיל
  if (!employee.isActive) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'חשבון המשתמש לא פעיל. אנא פנה למנהל המערכת.'
    );
  }

  return {
    uid,
    email: employeeDoc.id, // Document ID is EMAIL (industry standard)
    username: employee.username, // Username for display only
    employee: employee,
    role: employee.role || 'employee'
  };
}

module.exports = { checkUserPermissions };
