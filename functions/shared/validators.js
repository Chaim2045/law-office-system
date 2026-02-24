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

module.exports = { sanitizeString, isValidIsraeliPhone, isValidEmail };
