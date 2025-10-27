/**
 * מערכת לוגים מרכזית - Production Ready
 * ============================================
 * מערכת לוגים שמכבדת מצב פרודקשן ומפחיתה רעש בקונסול
 */

// מצב פרודקשן - TRUE = מערכת ייצור (לוגים מינימליים), FALSE = מצב פיתוח (לוגים מלאים)
window.PRODUCTION_MODE = false; // ברירת מחדל: מצב פיתוח (כדי לאפשר דיבאג)

/**
 * Logger מרכזי
 */
class ProductionLogger {
  /**
   * לוג רגיל - מודפס רק במצב פיתוח
   */
  static log(...args) {
    if (!window.PRODUCTION_MODE) {
      console.log(...args);
    }
  }

  /**
   * לוג מידע - מודפס רק במצב פיתוח
   */
  static info(...args) {
    if (!window.PRODUCTION_MODE) {
      console.info(...args);
    }
  }

  /**
   * לוג ניפוי באגים - מודפס רק במצב פיתוח
   */
  static debug(...args) {
    if (!window.PRODUCTION_MODE) {
      console.debug(...args);
    }
  }

  /**
   * אזהרה - מודפסת תמיד
   */
  static warn(...args) {
    console.warn(...args);
  }

  /**
   * שגיאה - מודפסת תמיד
   */
  static error(...args) {
    console.error(...args);
  }

  /**
   * הפעלת מצב פיתוח
   */
  static enableDevMode() {
    window.PRODUCTION_MODE = false;
    console.log('🔧 מצב פיתוח הופעל - לוגים מלאים זמינים');
  }

  /**
   * הפעלת מצב ייצור
   */
  static enableProductionMode() {
    window.PRODUCTION_MODE = true;
    console.log('🚀 מצב ייצור הופעל - לוגים מינימליים בלבד');
  }
}

// ייצוא גלובלי
window.Logger = ProductionLogger;
window.logger = ProductionLogger;

// פונקציות קיצור גלובליות
window.devLog = ProductionLogger.log;
window.devInfo = ProductionLogger.info;
window.devDebug = ProductionLogger.debug;
