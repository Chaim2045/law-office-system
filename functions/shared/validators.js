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
 * אימות תעודת זהות ישראלית — ספרת ביקורת לפי האלגוריתם הרשמי.
 *
 * Pre-H.1.0: ת"ז הוא מפתח הקישור הצולב לטופס-המכר (MASTER_PLAN §8.2.5).
 *
 * מקבל מחרוזת של עד 9 ספרות (אפסים מובילים משמעותיים — ת"ז בת 8 ספרות
 * מרופדת אוטומטית ל-9). מחזיר true רק אם ספרת הביקורת תקינה.
 *
 * ⚠️ אינו בודק ייחודיות בכוונה: במערכת זו "לקוח" = "תיק", ואותו אדם/ת"ז
 * יכול להופיע על מספר תיקים (many-to-many, §8.2.5 constraint #2). בדיקת
 * תקינות פורמט + ספרת ביקורת בלבד — לא uniqueness.
 *
 * @param {string} id מחרוזת ספרות (ללא מקפים/רווחים; מתבצע trim).
 * @returns {boolean} true אם ת"ז תקינה, אחרת false.
 */
function isValidIsraeliId(id) {
  if (typeof id !== 'string') { return false; }
  const digits = id.trim();
  if (!/^\d{1,9}$/.test(digits)) { return false; }
  const padded = digits.padStart(9, '0');
  if (padded === '000000000') { return false; } // לא ת"ז אמיתית
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let inc = Number(padded[i]) * ((i % 2) + 1); // משקלים 1,2,1,2,...
    if (inc > 9) { inc -= 9; }
    sum += inc;
  }
  return sum % 10 === 0;
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

module.exports = { sanitizeString, isValidIsraeliPhone, isValidEmail, isValidIsraeliId, getDescriptionLimit };
