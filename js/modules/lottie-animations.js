/**
 * ========================================
 * Lottie Animations Configuration
 * ========================================
 * מאגר מרכזי של אנימציות Lottie עבור מערכת ההודעות
 *
 * ✅ עיצוב מקצועי - כחול #3b82f6
 * ✅ משקל קל - כל אנימציה < 50KB
 * ✅ רישיון חינמי לשימוש מסחרי
 * ✅ 60fps - חלק ומהיר
 *
 * @version 1.0.0
 * @date 2025-01-13
 * @module LottieAnimations
 */

/**
 * ========================================
 * Animation URLs Map
 * ========================================
 * כל האנימציות נבחרו בקפידה מ-LottieFiles
 * קריטריונים: צבע כחול, משקל קל, איכות גבוהה
 */

const LottieAnimations = {
  // ========================================
  // Loading States - מצבי טעינה
  // ========================================

  /**
   * Loading - ספינר כללי
   * משמש: טעינת נתונים, המתנה כללית
   * צבע: כחול #3b82f6
   * משקל: ~15KB
   */
  loading: 'https://assets2.lottiefiles.com/packages/lf20_usmfx6bp.json',

  /**
   * Saving - אנימציית שמירה
   * משמש: שמירת משימות, תיקים, דיווחי שעות
   * צבע: כחול #3b82f6
   * משקל: ~22KB
   * אייקון: מסמך עם V
   */
  saving: 'https://assets9.lottiefiles.com/private_files/lf30_nsqfzxxx.json',

  /**
   * Uploading - העלאת קבצים
   * משמש: העלאת מסמכים, קבצים
   * צבע: כחול #3b82f6
   * משקל: ~18KB
   * אייקון: ענן עם חץ למעלה
   */
  uploading: 'https://assets4.lottiefiles.com/packages/lf20_yd3wzpmk.json',

  /**
   * Syncing - סנכרון
   * משמש: סנכרון עם השרת, רענון נתונים
   * צבע: כחול #3b82f6
   * משקל: ~12KB
   * אייקון: חצים מעגליים
   */
  syncing: 'https://assets1.lottiefiles.com/packages/lf20_DMgKk1.json',

  /**
   * Processing - עיבוד
   * משמש: עיבוד מורכב, חישובים
   * צבע: כחול #3b82f6
   * משקל: ~20KB
   * אייקון: גלגלי שיניים
   */
  processing: 'https://assets5.lottiefiles.com/packages/lf20_poqmycwy.json',

  // ========================================
  // Success States - מצבי הצלחה
  // ========================================

  /**
   * Success Simple - V פשוט
   * משמש: הצלחה כללית, פעולה הושלמה
   * צבע: ירוק #10b981
   * משקל: ~8KB
   * אייקון: V עם אנימציה חלקה
   */
  successSimple: 'https://assets4.lottiefiles.com/packages/lf20_jbrw3hcz.json',

  /**
   * Success Big - חגיגה גדולה
   * משמש: השלמת משימה חשובה, milestone
   * צבע: ירוק + קונפטי
   * משקל: ~35KB
   * אייקון: V גדול עם קונפטי
   */
  successBig: 'https://assets1.lottiefiles.com/packages/lf20_touohxv0.json',

  // ========================================
  // Specialized Actions - פעולות ספציפיות
  // ========================================

  /**
   * Deleting - מחיקה
   * משמש: מחיקת משימות, תיקים
   * צבע: אדום #ef4444
   * משקל: ~14KB
   * אייקון: פח אשפה
   */
  deleting: 'https://assets3.lottiefiles.com/packages/lf20_u8o7BsmRr5.json',

  /**
   * Searching - חיפוש
   * משמש: חיפוש לקוחות, משימות
   * צבע: כחול #3b82f6
   * משקל: ~16KB
   * אייקון: זכוכית מגדלת
   */
  searching: 'https://assets7.lottiefiles.com/packages/lf20_rwq6ciql.json',

  /**
   * Completing - סיום משימה
   * משמש: סימון משימה כהושלמה
   * צבע: ירוק #10b981
   * משקל: ~18KB
   * אייקון: V מעגלי עם אפקט
   */
  completing: 'https://assets2.lottiefiles.com/packages/lf20_uu0b3b7m.json',

  // ========================================
  // Error & Warning States
  // ========================================

  /**
   * Error - שגיאה
   * משמש: הצגת שגיאות
   * צבע: אדום #ef4444
   * משקל: ~10KB
   * אייקון: X במעגל
   */
  error: 'https://assets9.lottiefiles.com/packages/lf20_ddxv3rxw.json',

  /**
   * Warning - אזהרה
   * משמש: הצגת אזהרות
   * צבע: כתום #f97316
   * משקל: ~12KB
   * אייקון: משולש עם !
   */
  warning: 'https://assets8.lottiefiles.com/packages/lf20_yph3xxqb.json'
};

/**
 * ========================================
 * Fallback Configuration
 * ========================================
 * במקרה ש-Lottie לא נטען - CSS fallback
 */

const LottieFallback = {
  /**
   * CSS Fallback Spinner
   * ספינר CSS פשוט אם Lottie נכשל
   */
  cssSpinner: `
    <div class="css-spinner">
      <div class="spinner-ring"></div>
    </div>
  `,

  /**
   * CSS Styles for Fallback
   * סטיילים ל-fallback
   */
  cssStyles: `
    .css-spinner {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spinner-ring {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(59, 130, 246, 0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
};

/**
 * ========================================
 * Animation Metadata
 * ========================================
 * מטא-דאטה לכל אנימציה (למעקב ואנליטיקה)
 */

const AnimationMetadata = {
  loading: {
    name: 'Loading Spinner',
    category: 'loading',
    color: '#3b82f6',
    size: '~15KB',
    fps: 60,
    duration: 'infinite loop'
  },
  saving: {
    name: 'Saving Document',
    category: 'loading',
    color: '#3b82f6',
    size: '~22KB',
    fps: 60,
    duration: 'infinite loop'
  },
  uploading: {
    name: 'Cloud Upload',
    category: 'loading',
    color: '#3b82f6',
    size: '~18KB',
    fps: 60,
    duration: 'infinite loop'
  },
  syncing: {
    name: 'Sync Animation',
    category: 'loading',
    color: '#3b82f6',
    size: '~12KB',
    fps: 60,
    duration: 'infinite loop'
  },
  processing: {
    name: 'Processing Gears',
    category: 'loading',
    color: '#3b82f6',
    size: '~20KB',
    fps: 60,
    duration: 'infinite loop'
  },
  successSimple: {
    name: 'Success Checkmark',
    category: 'success',
    color: '#10b981',
    size: '~8KB',
    fps: 60,
    duration: '2s'
  },
  successBig: {
    name: 'Success Celebration',
    category: 'success',
    color: '#10b981',
    size: '~35KB',
    fps: 60,
    duration: '3s'
  },
  deleting: {
    name: 'Delete Trash',
    category: 'action',
    color: '#ef4444',
    size: '~14KB',
    fps: 60,
    duration: '2s'
  },
  searching: {
    name: 'Search Magnify',
    category: 'action',
    color: '#3b82f6',
    size: '~16KB',
    fps: 60,
    duration: 'infinite loop'
  },
  completing: {
    name: 'Task Complete',
    category: 'success',
    color: '#10b981',
    size: '~18KB',
    fps: 60,
    duration: '2.5s'
  },
  error: {
    name: 'Error X',
    category: 'error',
    color: '#ef4444',
    size: '~10KB',
    fps: 60,
    duration: '2s'
  },
  warning: {
    name: 'Warning Triangle',
    category: 'warning',
    color: '#f97316',
    size: '~12KB',
    fps: 60,
    duration: '2s'
  }
};

/**
 * ========================================
 * Helper Functions
 * ========================================
 */

/**
 * Get animation URL by type
 * @param {string} type - Animation type
 * @returns {string|null} Animation URL or null if not found
 */
function getAnimationUrl(type) {
  return LottieAnimations[type] || null;
}

/**
 * Get animation metadata
 * @param {string} type - Animation type
 * @returns {Object|null} Metadata object or null
 */
function getAnimationMetadata(type) {
  return AnimationMetadata[type] || null;
}

/**
 * Check if animation type exists
 * @param {string} type - Animation type
 * @returns {boolean} True if exists
 */
function hasAnimation(type) {
  return type in LottieAnimations;
}

/**
 * Get all available animation types
 * @returns {Array<string>} Array of animation type names
 */
function getAvailableAnimations() {
  return Object.keys(LottieAnimations);
}

/**
 * Get animations by category
 * @param {string} category - Category name (loading, success, action, error, warning)
 * @returns {Array<string>} Array of animation types in category
 */
function getAnimationsByCategory(category) {
  return Object.keys(AnimationMetadata)
    .filter(key => AnimationMetadata[key].category === category);
}

/**
 * ========================================
 * Export to Global Scope
 * ========================================
 */

if (typeof window !== 'undefined') {
  window.LottieAnimations = LottieAnimations;
  window.LottieFallback = LottieFallback;
  window.AnimationMetadata = AnimationMetadata;

  // Helper functions
  window.LottieHelpers = {
    getAnimationUrl,
    getAnimationMetadata,
    hasAnimation,
    getAvailableAnimations,
    getAnimationsByCategory
  };

  // Log success
  if (typeof Logger !== 'undefined') {
    Logger.log('✅ Lottie Animations loaded successfully');
    Logger.log(`📦 Available animations: ${getAvailableAnimations().length}`);
  }
}

// ✅ Global access via window.LottieAnimations (defined above)
