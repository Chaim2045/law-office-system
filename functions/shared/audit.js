/** Audit Utilities — כלי תיעוד פעולות */

const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * רישום לוג ביקורת (Audit Log)
 */
async function logAction(action, userId, username, details = {}) {
  try {
    await db.collection('audit_log').add({
      action,
      userId,
      username,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: details.userAgent || null,
      ipAddress: details.ipAddress || null
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // לא נזרוק שגיאה - logging לא צריך לעצור את הפעולה
  }
}

module.exports = { logAction };
