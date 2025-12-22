/**
 * ========================================
 * Notification Messages Library
 * ========================================
 * ספריית הודעות מרכזית עם Context-Aware messages
 *
 * ✅ עיצוב מקצועי - אייקונים Font Awesome בממשק בלבד
 * ✅ הודעות עם הקשר מלא
 * ✅ אנימציות Lottie ייעודיות
 * ✅ תאימות לאחור מלאה
 *
 * @version 1.0.0
 * @date 2025-01-13
 * @module NotificationMessages
 */

/**
 * ========================================
 * NotificationMessages Class
 * ========================================
 */

class NotificationMessages {
  constructor() {
    // אין צורך ב-emojis - משתמשים ב-Font Awesome icons בממשק בלבד
    if (typeof Logger !== 'undefined') {
      Logger.log('✅ NotificationMessages initialized');
    }
  }

  /**
   * ========================================
   * משימות תקציב (Budget Tasks)
   * ========================================
   */

  tasks = {
    // Loading messages with animation types
    loading: {
      create: (clientName) => ({
        message: `שומר משימה עבור ${clientName}...`,
        animationType: 'saving'
      }),
      complete: () => ({
        message: 'משלים משימה...',
        animationType: 'completing'
      }),
      addTime: () => ({
        message: 'שומר זמן...',
        animationType: 'saving'
      }),
      updateBudget: () => ({
        message: 'מעדכן תקציב...',
        animationType: 'syncing'
      }),
      extendDeadline: () => ({
        message: 'מאריך תאריך יעד...',
        animationType: 'syncing'
      }),
      delete: () => ({
        message: 'מוחק משימה...',
        animationType: 'deleting'
      })
    },

    // Success messages
    success: {
      created: (clientName, taskDescription, estimatedMinutes) =>
        '✅ המשימה נוספה בהצלחה\n\n' +
        `📋 ${taskDescription}\n` +
        `👤 ${clientName}\n` +
        `⏱️ תקציב: ${estimatedMinutes || '---'} דקות\n\n` +
        '🎯 המשימה פעילה - אפשר להתחיל לעבוד מיד',
      completed: (clientName) =>
        `משימה הושלמה: ${clientName}. תוכל לראות אותה בהושלמו`,
      timeAdded: (minutes) =>
        `${minutes} דקות נוספו למשימה ונרשמו בשעתון`,
      budgetUpdated: (hours) =>
        `תקציב עודכן ל-${hours} שעות`,
      deadlineExtended: (newDate) =>
        `תאריך היעד הוארך ל-${newDate}`,
      deleted: () =>
        'המשימה נמחקה בהצלחה'
    },

    // Error messages
    error: {
      notFound: () => 'המשימה לא נמצאה במערכת',
      createFailed: (error) => `שגיאה ביצירת משימה: ${error}`,
      completeFailed: (error) => `שגיאה בהשלמת משימה: ${error}`,
      updateFailed: (error) => `שגיאה בעדכון משימה: ${error}`,
      deleteFailed: (error) => `שגיאה במחיקת משימה: ${error}`
    },

    // Validation messages
    validation: {
      noClient: () => 'חובה לבחור לקוח ותיק',
      noDescription: () => 'חובה להזין תיאור משימה (לפחות 3 תווים)',
      noEstimate: () => 'חובה להזין זמן משוער',
      noDeadline: () => 'חובה לבחור תאריך יעד',
      noBranch: () => 'חובה לבחור סניף מטפל',
      invalidBudget: () => 'אנא הזן תקציב תקין',
      missingFields: () => 'נא למלא את כל השדות'
    }
  };

  /**
   * ========================================
   * שעתון (Timesheet)
   * ========================================
   */

  timesheet = {
    // Loading messages
    loading: {
      createEntry: () => ({
        message: 'שומר דיווח שעות...',
        animationType: 'saving'
      }),
      createInternal: () => ({
        message: 'שומר פעילות פנימית...',
        animationType: 'saving'
      }),
      delete: () => ({
        message: 'מוחק רשומה...',
        animationType: 'deleting'
      })
    },

    // Success messages
    success: {
      entryCreated: (minutes, clientName) =>
        `${minutes} דקות נרשמו עבור ${clientName}`,
      internalCreated: (minutes) =>
        `${minutes} דקות פעילות פנימית נרשמו`,
      deleted: () =>
        'הרשומה נמחקה בהצלחה'
    },

    // Error messages
    error: {
      createFailed: (error) => `שגיאה ברישום זמן: ${error}`,
      deleteFailed: (error) => `שגיאה במחיקת רשומה: ${error}`,
      loadFailed: () => 'שגיאה בטעינת נתוני שעתון'
    },

    // Validation messages
    validation: {
      noDate: () => 'חובה לבחור תאריך',
      noMinutes: () => 'חובה להזין זמן בדקות',
      noAction: () => 'חובה להזין תיאור פעולה (לפחות 3 תווים)',
      noClient: () => 'חובה לבחור לקוח ותיק'
    }
  };

  /**
   * ========================================
   * לקוחות ותיקים (Cases)
   * ========================================
   */

  cases = {
    // Loading messages
    loading: {
      create: () => ({
        message: 'יוצר תיק חדש...',
        animationType: 'saving'
      }),
      addService: () => ({
        message: 'מוסיף שירות...',
        animationType: 'saving'
      }),
      openDialog: () => ({
        message: 'טוען...',
        animationType: 'loading'
      }),
      delete: () => ({
        message: 'מוחק תיק...',
        animationType: 'deleting'
      })
    },

    // Success messages
    success: {
      created: (caseTitle) =>
        `התיק "${caseTitle}" נוצר בהצלחה`,
      serviceAdded: (serviceName) =>
        `השירות "${serviceName}" נוסף בהצלחה`,
      selected: (caseTitle) =>
        `התיק "${caseTitle}" נוסף לרשימה`,
      deleted: () =>
        'התיק נמחק בהצלחה'
    },

    // Error messages
    error: {
      createFailed: (error) => `שגיאה ביצירת תיק: ${error}`,
      serviceAddFailed: (error) => `שגיאה בהוספת שירות: ${error}`,
      dialogFailed: () => 'שגיאה בפתיחת דיאלוג',
      deleteFailed: (error) => `שגיאה במחיקת תיק: ${error}`,
      loadFailed: () => 'שגיאה בטעינת נתוני תיקים'
    },

    // Validation messages
    validation: {
      noServiceName: () => 'אנא הזן שם שירות',
      invalidHours: () => 'אנא הזן כמות שעות תקינה',
      stageNoDescription: (stage) => `שלב ${stage}: חובה להזין תיאור`,
      stageInvalidHours: (stage) => `שלב ${stage}: חובה להזין כמות שעות תקינה`,
      stageInvalidPrice: (stage) => `שלב ${stage}: חובה להזין מחיר תקין`,
      noCaseTitle: () => 'חובה להזין שם תיק'
    }
  };

  /**
   * ========================================
   * Authentication (התחברות והרשאות)
   * ========================================
   */

  auth = {
    // Loading messages
    loading: {
      login: () => ({
        message: 'מתחבר למערכת...',
        animationType: 'loading'
      }),
      logout: () => ({
        message: 'מתנתק מהמערכת...',
        animationType: 'loading'
      }),
      resetPassword: () => ({
        message: 'שולח קישור לאיפוס סיסמה...',
        animationType: 'syncing'
      })
    },

    // Success messages
    success: {
      login: (userName) =>
        `שלום ${userName}, ברוך הבא למערכת`,
      logout: () =>
        'להתראות! התנתקת מהמערכת בהצלחה',
      passwordReset: () =>
        'קישור לאיפוס סיסמה נשלח למייל שלך. בדוק את תיבת הדואר'
    },

    // Info messages
    info: {
      logout: () => 'מתנתק מהמערכת... להתראות'
    },

    // Error messages
    error: {
      userNotFound: () => 'משתמש עם כתובת מייל זו לא נמצא במערכת',
      invalidEmail: () => 'כתובת אימייל לא תקינה',
      invalidPassword: () => 'סיסמה שגויה',
      tooManyRequests: () => 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
      firebaseConfig: () => 'שגיאת הגדרות Firebase - פנה למפתח',
      networkError: () => 'שגיאת רשת - בדוק את החיבור לאינטרנט',
      unauthorized: () => 'אין לך הרשאה לבצע פעולה זו'
    },

    // Validation messages
    validation: {
      noEmail: () => 'חובה להזין כתובת אימייל',
      noPassword: () => 'חובה להזין סיסמה',
      invalidEmailFormat: () => 'פורמט אימייל לא תקין'
    }
  };

  /**
   * ========================================
   * הליכים משפטיים (Legal Procedures)
   * ========================================
   */

  procedures = {
    // Loading messages
    loading: {
      addHours: () => ({
        message: 'מוסיף שעות...',
        animationType: 'saving'
      }),
      nextStage: () => ({
        message: 'עובר לשלב הבא...',
        animationType: 'syncing'
      }),
      create: () => ({
        message: 'יוצר הליך משפטי...',
        animationType: 'saving'
      })
    },

    // Success messages
    success: {
      hoursAdded: (hours) =>
        `נוספו ${hours} שעות בהצלחה`,
      nextStage: () =>
        'עברת לשלב הבא בהצלחה',
      created: (procedureName) =>
        `ההליך "${procedureName}" נוצר בהצלחה`
    },

    // Error messages
    error: {
      addHoursFailed: (error) => `שגיאה בהוספת שעות: ${error}`,
      nextStageFailed: (error) => `שגיאה במעבר לשלב הבא: ${error}`,
      createFailed: (error) => `שגיאה ביצירת הליך: ${error}`,
      loadFailed: () => 'שגיאה בטעינת נתוני הליכים'
    },

    // Validation messages
    validation: {
      noHours: () => 'חובה להזין כמות שעות',
      invalidHours: () => 'כמות שעות לא תקינה',
      noProcedureName: () => 'חובה להזין שם הליך'
    }
  };

  /**
   * ========================================
   * כלליות (General)
   * ========================================
   */

  general = {
    // Loading messages
    loading: {
      refresh: () => ({
        message: 'טוען נתונים מחדש...',
        animationType: 'syncing'
      }),
      save: () => ({
        message: 'שומר...',
        animationType: 'saving'
      }),
      delete: () => ({
        message: 'מוחק...',
        animationType: 'deleting'
      }),
      upload: () => ({
        message: 'מעלה קובץ...',
        animationType: 'uploading'
      }),
      search: () => ({
        message: 'מחפש...',
        animationType: 'searching'
      }),
      process: () => ({
        message: 'מעבד...',
        animationType: 'processing'
      })
    },

    // Success messages
    success: {
      dataRefreshed: () => 'הנתונים עודכנו בהצלחה',
      saved: () => 'נשמר בהצלחה',
      deleted: () => 'נמחק בהצלחה',
      uploaded: () => 'הקובץ הועלה בהצלחה',
      updated: () => 'עודכן בהצלחה'
    },

    // Error messages
    error: {
      dataLoadFailed: () => 'שגיאה בטעינת נתונים',
      tasksLoadFailed: () => 'שגיאה בטעינת משימות',
      moduleNotLoaded: (moduleName) => `מודול ${moduleName} לא נטען`,
      saveFailed: (error) => `שגיאה בשמירה: ${error}`,
      deleteFailed: (error) => `שגיאה במחיקה: ${error}`,
      uploadFailed: (error) => `שגיאה בהעלאת קובץ: ${error}`,
      networkError: () => 'שגיאת רשת - בדוק את החיבור לאינטרנט',
      unknownError: () => 'אירעה שגיאה לא צפויה'
    },

    // Warning messages
    warning: {
      waitForPrevious: () => 'אנא המתן לסיום הפעולה הקודמת',
      unsavedChanges: () => 'יש לך שינויים שלא נשמרו',
      confirmDelete: () => 'האם אתה בטוח שברצונך למחוק?',
      sessionExpired: () => 'פג תוקף ההתחברות - נא להתחבר מחדש'
    },

    // Info messages
    info: {
      tourCompleted: () => 'הסיור הושלם בהצלחה',
      noResults: () => 'לא נמצאו תוצאות',
      dataUpToDate: () => 'הנתונים מעודכנים',
      processing: () => 'מעבד את הבקשה...'
    }
  };

  /**
   * ========================================
   * Helper Methods
   * ========================================
   */

  /**
   * Get message with context
   * Helper method for getting context-aware messages
   * @param {string} category - Message category (tasks, timesheet, cases, etc.)
   * @param {string} type - Message type (loading, success, error, validation)
   * @param {string} key - Message key
   * @param {...any} params - Parameters to pass to the message function
   * @returns {string|Object} Message string or object with message and animationType
   */
  get(category, type, key, ...params) {
    try {
      const categoryObj = this[category];
      if (!categoryObj) {
        console.warn(`⚠️ Unknown message category: ${category}`);
        return 'הודעה לא זמינה';
      }

      const typeObj = categoryObj[type];
      if (!typeObj) {
        console.warn(`⚠️ Unknown message type: ${type} in category ${category}`);
        return 'הודעה לא זמינה';
      }

      const messageFunc = typeObj[key];
      if (!messageFunc) {
        console.warn(`⚠️ Unknown message key: ${key} in ${category}.${type}`);
        return 'הודעה לא זמינה';
      }

      return messageFunc(...params);
    } catch (error) {
      console.error('❌ Error getting message:', error);
      return 'הודעה לא זמינה';
    }
  }

  /**
   * Get loading message with animation
   * Helper method specifically for loading messages
   * @param {string} category - Message category
   * @param {string} key - Message key
   * @param {...any} params - Parameters
   * @returns {Object} Object with message and animationType
   */
  getLoading(category, key, ...params) {
    return this.get(category, 'loading', key, ...params);
  }

  /**
   * Get success message
   * @param {string} category - Message category
   * @param {string} key - Message key
   * @param {...any} params - Parameters
   * @returns {string} Success message
   */
  getSuccess(category, key, ...params) {
    return this.get(category, 'success', key, ...params);
  }

  /**
   * Get error message
   * @param {string} category - Message category
   * @param {string} key - Message key
   * @param {...any} params - Parameters
   * @returns {string} Error message
   */
  getError(category, key, ...params) {
    return this.get(category, 'error', key, ...params);
  }

  /**
   * Get validation message
   * @param {string} category - Message category
   * @param {string} key - Message key
   * @param {...any} params - Parameters
   * @returns {string} Validation message
   */
  getValidation(category, key, ...params) {
    return this.get(category, 'validation', key, ...params);
  }
}

/**
 * ========================================
 * Create Global Instance
 * ========================================
 */

const notificationMessages = new NotificationMessages();

/**
 * ========================================
 * Export to Global Scope
 * ========================================
 */

if (typeof window !== 'undefined') {
  window.NotificationMessages = notificationMessages;

  // Log success
  if (typeof Logger !== 'undefined') {
    Logger.log('✅ NotificationMessages ready');
    Logger.log('📋 Available categories: tasks, timesheet, cases, auth, procedures, general');
  }
}

// ✅ Global access via window.NotificationMessages (defined above)
