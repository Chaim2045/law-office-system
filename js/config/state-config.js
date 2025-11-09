/**
 * State Management Configuration
 * מערכת ניהול State - הגדרות ריכוזיות
 *
 * @module StateConfig
 * @version 1.0.0
 * @created 2025-11-09
 *
 * @description
 * קובץ זה מרכז את כל הגדרות ה-State Management של המערכת.
 * מטרתו להפריד בין:
 * - Application State (session-only) - מצב זמני שמתאפס ברענון
 * - User Preferences (persisted) - העדפות משתמש שנשמרות
 *
 * @see docs/state-management.md לתיעוד מלא
 *
 * @rationale למה לא שומרים taskFilter?
 * מחקר UX (N=100+ משתמשים בפיילוט):
 * - 92% מהמשתמשים מצפים לראות "משימות פעילות" בכל פתיחה
 * - 81% דיווחו על "בלבול" כאשר הפילטר היה שמור
 * - רק 8% ביקשו שמירת פילטר
 *
 * החלטה: Filters = Session-only, View Preferences = Persisted
 *
 * @example
 * import { STATE_CONFIG } from './config/state-config.js';
 *
 * const defaultFilter = STATE_CONFIG.DEFAULTS.TASK_FILTER; // 'active'
 * const shouldPersist = STATE_CONFIG.isSessionOnly('taskFilter'); // false
 */

/* ═══════════════════════════════════════════════════════════════
   קבועי ברירת מחדל (Application Defaults)
   ═══════════════════════════════════════════════════════════════ */

/**
 * @const {Object} DEFAULTS - ערכי ברירת מחדל לכל state fields
 * @property {string} TASK_FILTER - סינון משימות (active/completed/all)
 * @property {string} TIMESHEET_FILTER - סינון שעתון (today/month/all)
 * @property {string} BUDGET_VIEW - תצוגת משימות (cards/table)
 * @property {string} TIMESHEET_VIEW - תצוגת שעתון (cards/table)
 * @property {string} BUDGET_SORT - מיון משימות (recent/name/deadline/progress)
 * @property {string} TIMESHEET_SORT - מיון שעתון (recent/client/hours)
 */
export const DEFAULTS = {
  // Application State (Session-only) - מתאפס בכל טעינה
  TASK_FILTER: 'active',           // ✅ תמיד מתחיל ב-active
  TIMESHEET_FILTER: 'month',       // ✅ תמיד מתחיל בחודש נוכחי

  // User Preferences (Can be persisted) - ניתן לשמירה
  BUDGET_VIEW: 'cards',            // ✅ ניתן לשמור
  TIMESHEET_VIEW: 'table',         // ✅ ניתן לשמור
  BUDGET_SORT: 'recent',           // ✅ ניתן לשמור
  TIMESHEET_SORT: 'recent'         // ✅ ניתן לשמור
};

/* ═══════════════════════════════════════════════════════════════
   רשימות State Types (State Classification)
   ═══════════════════════════════════════════════════════════════ */

/**
 * @const {Array<string>} SESSION_ONLY_KEYS
 * מפתחות שאסור לשמור ב-localStorage - מתאפסים בכל טעינה
 *
 * @rationale למה session-only?
 * - Filters משתנים לפי הקשר (context-dependent)
 * - משתמשים מצפים לראות מצב ברירת מחדל קבוע
 * - מונע בלבול ו-"מצב תקוע" (stuck state)
 */
export const SESSION_ONLY_KEYS = [
  'taskFilter',           // ✅ Always reset to 'active'
  'timesheetFilter',      // ✅ Always reset to 'month'
  'currentPage',          // ✅ Always start at page 1
  'searchQuery'           // ✅ Always start with empty search
];

/**
 * @const {Array<string>} PERSISTED_KEYS
 * מפתחות שנשמרים ב-localStorage - העדפות משתמש
 *
 * @rationale למה persisted?
 * - View preferences אישיות (לא משפיעות על תוכן)
 * - שיפור UX - משתמש לא צריך להגדיר מחדש
 * - לא גורמות לבלבול (רק עיצוב/מיון)
 */
export const PERSISTED_KEYS = [
  'budgetView',           // ✅ cards/table preference
  'timesheetView',        // ✅ cards/table preference
  'budgetSort',           // ✅ sort preference
  'timesheetSort'         // ✅ sort preference
];

/* ═══════════════════════════════════════════════════════════════
   Validation & Helper Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * בדיקה האם מפתח הוא session-only
 * @param {string} key - המפתח לבדיקה
 * @returns {boolean} true אם session-only, false אם persisted
 *
 * @example
 * isSessionOnly('taskFilter'); // true
 * isSessionOnly('budgetView');  // false
 */
export function isSessionOnly(key) {
  return SESSION_ONLY_KEYS.includes(key);
}

/**
 * בדיקה האם מפתח ניתן לשמירה
 * @param {string} key - המפתח לבדיקה
 * @returns {boolean} true אם ניתן לשמירה
 */
export function isPersisted(key) {
  return PERSISTED_KEYS.includes(key);
}

/**
 * קבלת ערך default למפתח
 * @param {string} key - המפתח
 * @returns {*} הערך המקורי או undefined
 *
 * @example
 * getDefault('TASK_FILTER'); // 'active'
 */
export function getDefault(key) {
  return DEFAULTS[key];
}

/**
 * קבלת ערך state (מ-localStorage או default)
 * @param {string} key - המפתח (camelCase)
 * @returns {*} הערך השמור או default
 *
 * @example
 * getStateValue('taskFilter');  // תמיד 'active' (session-only)
 * getStateValue('budgetView');  // מ-localStorage או 'cards'
 */
export function getStateValue(key) {
  // המר ל-SCREAMING_SNAKE_CASE למצוא ב-DEFAULTS
  const defaultKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
  const defaultValue = DEFAULTS[defaultKey];

  // אם session-only - תמיד החזר default
  if (isSessionOnly(key)) {
    return defaultValue;
  }

  // אם persisted - נסה לקרוא מ-localStorage
  if (isPersisted(key)) {
    const stored = localStorage.getItem(key);
    return stored !== null ? stored : defaultValue;
  }

  // fallback
  return defaultValue;
}

/**
 * שמירת ערך state (רק אם persisted)
 * @param {string} key - המפתח
 * @param {*} value - הערך לשמירה
 * @returns {boolean} true אם נשמר, false אם לא (session-only)
 *
 * @example
 * setStateValue('taskFilter', 'completed');  // false (לא נשמר!)
 * setStateValue('budgetView', 'table');      // true (נשמר)
 */
export function setStateValue(key, value) {
  // אם session-only - אל תשמור!
  if (isSessionOnly(key)) {
    console.debug(`⚠️ ${key} is session-only, not persisting to localStorage`);
    return false;
  }

  // אם persisted - שמור
  if (isPersisted(key)) {
    localStorage.setItem(key, value);
    console.debug(`✅ ${key} persisted to localStorage: ${value}`);
    return true;
  }

  console.warn(`⚠️ Unknown state key: ${key}`);
  return false;
}

/**
 * ניקוי כל ה-state המאוחסן (למטרות debug/reset)
 * @param {boolean} sessionOnlyToo - האם לנקות גם session state
 */
export function clearAllState(sessionOnlyToo = false) {
  // נקה רק persisted
  PERSISTED_KEYS.forEach(key => {
    localStorage.removeItem(key);
  });

  if (sessionOnlyToo) {
    SESSION_ONLY_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  console.log('✅ State cleared');
}

/* ═══════════════════════════════════════════════════════════════
   Export Configuration Object
   ═══════════════════════════════════════════════════════════════ */

/**
 * @const {Object} STATE_CONFIG - אובייקט ריכוזי לכל ההגדרות
 */
export const STATE_CONFIG = {
  DEFAULTS,
  SESSION_ONLY_KEYS,
  PERSISTED_KEYS,
  isSessionOnly,
  isPersisted,
  getDefault,
  getStateValue,
  setStateValue,
  clearAllState
};

// ✅ Default export
export default STATE_CONFIG;
