/**
 * Deletion Validators Module
 * מודול וולידציות למחיקה מאובטחת
 *
 * 🔒 Security Layer 2: Input Validation
 * כל input נבדק לפני כל דבר אחר
 */

const functions = require('firebase-functions');

/**
 * Validate email format
 * בדיקת פורמט אימייל
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'אימייל חסר או לא תקין'
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'פורמט אימייל לא תקין'
    );
  }

  return email.toLowerCase().trim();
}

/**
 * Validate array of IDs
 * בדיקת מערך של IDs
 */
function validateIds(ids, fieldName, maxCount = 500) {
  // אם לא נשלח או ריק - זה OK (אומר שלא רוצים למחוק מסוג זה)
  if (!ids || ids.length === 0) {
    return [];
  }

  // חייב להיות array
  if (!Array.isArray(ids)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${fieldName} חייב להיות רשימה`
    );
  }

  // בדיקת מקסימום פריטים (מניעת DoS)
  if (ids.length > maxCount) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `מקסימום ${maxCount} פריטים למחיקה בפעם אחת. ${fieldName} מכיל ${ids.length} פריטים`
    );
  }

  // בדיקה שכל ID הוא string לא ריק
  const validIds = ids.filter(id => {
    return id && typeof id === 'string' && id.trim().length > 0;
  });

  if (validIds.length !== ids.length) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${fieldName} מכיל IDs לא תקינים`
    );
  }

  return validIds;
}

/**
 * Validate deletion request data
 * בדיקת נתוני בקשת מחיקה
 */
function validateDeletionRequest(data) {
  const errors = [];

  // 1. בדיקת email
  let userEmail;
  try {
    userEmail = validateEmail(data.userEmail);
  } catch (error) {
    errors.push(`Email: ${error.message}`);
  }

  // 2. בדיקת taskIds
  let taskIds = [];
  try {
    taskIds = validateIds(data.taskIds, 'taskIds', 500);
  } catch (error) {
    errors.push(`Tasks: ${error.message}`);
  }

  // 3. בדיקת timesheetIds
  let timesheetIds = [];
  try {
    timesheetIds = validateIds(data.timesheetIds, 'timesheetIds', 500);
  } catch (error) {
    errors.push(`Timesheets: ${error.message}`);
  }

  // 4. בדיקת approvalIds
  let approvalIds = [];
  try {
    approvalIds = validateIds(data.approvalIds, 'approvalIds', 500);
  } catch (error) {
    errors.push(`Approvals: ${error.message}`);
  }

  // 5. בדיקה שיש לפחות משהו למחוק
  const totalItems = taskIds.length + timesheetIds.length + approvalIds.length;
  if (totalItems === 0) {
    errors.push('לא נבחרו פריטים למחיקה');
  }

  // 6. בדיקת dryRun flag
  const dryRun = data.dryRun === true;

  // אם יש שגיאות - זרוק אותן
  if (errors.length > 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `שגיאות בוולידציה:\n${errors.join('\n')}`
    );
  }

  return {
    userEmail,
    taskIds,
    timesheetIds,
    approvalIds,
    dryRun,
    totalItems
  };
}

/**
 * Validate rate limiting
 * בדיקת rate limiting - מניעת שימוש לרעה
 */
async function checkRateLimit(db, adminEmail) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // ספירת מחיקות של המנהל ב-5 דקות האחרונות
  const recentDeletions = await db.collection('audit_log')
    .where('adminEmail', '==', adminEmail)
    .where('action', '==', 'delete_user_data_selective')
    .where('timestamp', '>', fiveMinutesAgo)
    .where('dryRun', '==', false) // רק מחיקות אמיתיות
    .get();

  const deletionCount = recentDeletions.size;

  // מקסימום 10 מחיקות ב-5 דקות
  if (deletionCount >= 10) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `חרגת ממגבלת המחיקות (10 מחיקות ב-5 דקות). נסה שוב בעוד כמה דקות.`
    );
  }

  // בדיקת cooldown - 30 שניות בין מחיקות
  if (recentDeletions.size > 0) {
    const lastDeletion = recentDeletions.docs[0].data();
    const lastDeletionTime = lastDeletion.timestamp.toDate();
    const timeSinceLastDeletion = now.getTime() - lastDeletionTime.getTime();

    if (timeSinceLastDeletion < 30000) { // 30 שניות
      const waitSeconds = Math.ceil((30000 - timeSinceLastDeletion) / 1000);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `יש להמתין ${waitSeconds} שניות בין מחיקות`
      );
    }
  }

  return {
    allowed: true,
    deletionCount,
    remainingInWindow: 10 - deletionCount
  };
}

module.exports = {
  validateEmail,
  validateIds,
  validateDeletionRequest,
  checkRateLimit
};
