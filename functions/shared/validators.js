/** Validation Utilities — כלי בדיקת קלט */

/**
 * ניקוי HTML (מניעת XSS)
 *
 * ✅ Fixed: רק < ו-> מוחלפים (סיכון XSS אמיתי)
 * ✅ גרשיים (" ו-') ו-/ לא מוחלפים - שמירת data integrity
 *
 * Note: Frontend צריך להשתמש ב-safeText() או textContent בdisplay
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    // Removed: .replace(/"/g, '&quot;') - causes data corruption
    // Removed: .replace(/'/g, '&#x27;') - causes data corruption
    // Removed: .replace(/\//g, '&#x2F;') - not an XSS risk
}

/**
 * אימות מספר טלפון ישראלי
 */
function isValidIsraeliPhone(phone) {
  if (!phone) return true; // אופציונלי
  const cleanPhone = phone.replace(/[-\s]/g, '');
  return /^0(5[0-9]|[2-4]|[7-9])\d{7}$/.test(cleanPhone);
}

/**
 * אימות אימייל
 */
function isValidEmail(email) {
  if (!email) return true; // אופציונלי
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * שליפת מגבלת תווים לתיאור מתוך system_config (Firestore).
 * Fallback ל-SYSTEM_CONSTANTS אם אין config.
 *
 * @param {'taskDescription'|'timesheetDescription'} field
 * @returns {Promise<number>}
 */
async function getDescriptionLimit(field) {
  const { SYSTEM_CONSTANTS } = require('./constants');
  const keyMap = {
    taskDescription: 'TASK_DESCRIPTION',
    timesheetDescription: 'TIMESHEET_DESCRIPTION'
  };
  const fallback = SYSTEM_CONSTANTS.DESCRIPTION_LIMITS[keyMap[field]] || 50;

  try {
    const admin = require('firebase-admin');
    const doc = await admin.firestore().collection('_system').doc('system_config').get();
    if (doc.exists && doc.data().descriptionLimits && doc.data().descriptionLimits[field]) {
      return doc.data().descriptionLimits[field];
    }
  } catch (_) {
    // Firestore unavailable — use fallback
  }
  return fallback;
}

module.exports = { sanitizeString, isValidIsraeliPhone, isValidEmail, getDescriptionLimit };
