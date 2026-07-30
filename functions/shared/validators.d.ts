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
export declare function sanitizeString(str: unknown): unknown;
/**
 * אימות מספר טלפון ישראלי
 */
export declare function isValidIsraeliPhone(phone?: string | null): boolean;
/**
 * אימות אימייל
 */
export declare function isValidEmail(email?: string | null): boolean;
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
export declare function isValidIsraeliId(id: unknown): boolean;
/**
 * שליפת מגבלת תווים לתיאור מתוך system_config (Firestore).
 * Fallback ל-SYSTEM_CONSTANTS אם אין config.
 *
 * @param field
 * @returns
 */
export declare function getDescriptionLimit(field: 'taskDescription' | 'timesheetDescription'): Promise<number>;
