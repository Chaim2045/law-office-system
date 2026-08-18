/**
 * validators.ts — input-validation utilities (כלי בדיקת קלט)
 * ─────────────────────────────────────────────────────────────────────────────
 * Migrated to TypeScript in גל-3ה TS-3 (2026-07-30). 1:1 behavior port — ZERO
 * logic change from the hand-written validators.js.
 *
 * ─── Build mechanism (A′, in-place — see functions/shared/tsconfig.json) ──────
 * This `.ts` is the SOURCE OF TRUTH; it compiles in place to
 * `functions/shared/validators.js` (+ generated `.d.ts`) at the IDENTICAL path,
 * so the legacy `require('../shared/validators')` consumers (admin/auth/
 * budget-tasks/clients/services/timesheet) resolve unchanged.
 *
 * ⚠️ getDescriptionLimit intentionally uses INLINE `require()`, NOT ES imports:
 * `require` is typed as NodeRequire (@types/node) → returns `any`, so the
 * firebase-admin + ./constants dependencies need no `.d.ts` and never trip
 * TS2307 (unlike an ES `import`, which is exactly what tripped logger.ts). Do
 * NOT convert these to `import`.
 *
 * Guarded boundary params (`str`, `id`) are typed `unknown` (not `string`) so
 * the runtime `typeof` guards stay type-necessary — JS callers pass non-strings,
 * and the guards are pinned by functions/tests/israeli-id-validator.test.js.
 *
 * Public-repo safety: no PII, no secrets. getDescriptionLimit reads a config
 * doc but NEVER logs its value (pinned by client-idnumber-pii-guard.test.js).
 */

/**
 * ניקוי HTML (מניעת XSS)
 *
 * ✅ Fixed: רק < ו-> מוחלפים (סיכון XSS אמיתי)
 * ✅ גרשיים (" ו-') ו-/ לא מוחלפים - שמירת data integrity
 *
 * Note: Frontend צריך להשתמש ב-safeText() או textContent בdisplay
 */
export function sanitizeString(str: unknown): unknown {
  if (typeof str !== 'string') { return str; }
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
export function isValidIsraeliPhone(phone?: string | null): boolean {
  if (!phone) { return true; } // אופציונלי
  const cleanPhone = phone.replace(/[-\s]/g, '');
  return /^0(5[0-9]|[2-4]|[7-9])\d{7}$/.test(cleanPhone);
}

/**
 * אימות אימייל
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email) { return true; } // אופציונלי
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
 * @param id מחרוזת ספרות (ללא מקפים/רווחים; מתבצע trim).
 * @returns true אם ת"ז תקינה, אחרת false.
 */
export function isValidIsraeliId(id: unknown): boolean {
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
 * @param field
 * @returns
 */
export async function getDescriptionLimit(
  field: 'taskDescription' | 'timesheetDescription'
): Promise<number> {
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
  } catch {
    // Firestore unavailable — use fallback
  }
  return fallback;
}
