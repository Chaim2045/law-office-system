/**
 * Integration Manager - מנהל אינטגרציה בין Firebase Pagination למערכת
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 09/10/2025
 * גרסה: 1.0.0
 *
 * אחראי על:
 * - Feature Flags
 * - Scroll Preservation
 * - אתחול Firebase Pagination
 * - העברת נתונים בין המודולים
 */

(function() {
  'use strict';

  /* === Feature Configuration === */
  const FEATURE_CONFIG = {
    USE_FIREBASE_PAGINATION: true, // ✅ מופעל - Keyset Pagination
    PAGINATION_PAGE_SIZE: 20,
    SKELETON_DELAY_MS: 800,
    ENABLE_SCROLL_PRESERVATION: true,
    DEBUG_MODE: false // מצב פרודקשן - ללא הדפסות
  };

  /**
   * שמירת והחזרת scroll position
   * מונע קפיצה למעלה כשמוסיפים תוכן לדף
   */
  function preserveScrollPosition(callback) {
    if (!FEATURE_CONFIG.ENABLE_SCROLL_PRESERVATION) {
      callback();
      return;
    }

    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    callback();

    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }

  /**
   * מחלקת IntegrationManager - מנהלת אינטגרציה
   */
  class IntegrationManager {
    constructor() {
      this.firebasePagination = null;
      this.config = FEATURE_CONFIG;
      this.init();
    }

    init() {
      // אתחול Firebase Pagination אם זמין
      if (window.FirebasePaginationModule) {
        this.firebasePagination = window.FirebasePaginationModule.create();
      } else {
        console.warn('⚠️ FirebasePaginationModule not available - using legacy pagination');
      }
    }

    /**
     * טעינת לקוחות (עם או בלי פגינציה)
     */
    async loadClients() {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        const result = await this.firebasePagination.loadClientsPaginated(
          this.config.PAGINATION_PAGE_SIZE,
          false
        );
        return result.items;
      } else {
        return await window.loadClientsFromFirebase();
      }
    }

    /**
     * טעינת משימות תקצוב (עם או בלי פגינציה)
     */
    async loadBudgetTasks(employee) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        const result = await this.firebasePagination.loadBudgetTasksPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          false
        );
        return result.items;
      } else {
        return await window.loadBudgetTasksFromFirebase(employee);
      }
    }

    /**
     * טעינת שעתון (עם או בלי פגינציה)
     */
    async loadTimesheet(employee) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        const result = await this.firebasePagination.loadTimesheetPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          false
        );
        return result.items;
      } else {
        return await window.loadTimesheetFromFirebase(employee);
      }
    }

    /**
     * טעינת עוד משימות תקצוב
     */
    async loadMoreBudgetTasks(employee, currentTasks) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        const result = await this.firebasePagination.loadBudgetTasksPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          true
        );
        return [...currentTasks, ...result.items];
      }
      // אם לא משתמשים ב-Firebase Pagination, המנהל עושה זאת עם pagination.js
      return currentTasks;
    }

    /**
     * טעינת עוד רשומות שעתון
     */
    async loadMoreTimesheet(employee, currentEntries) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        const result = await this.firebasePagination.loadTimesheetPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          true
        );
        return [...currentEntries, ...result.items];
      }
      return currentEntries;
    }

    /**
     * ביצוע callback עם scroll preservation
     */
    executeWithScrollPreservation(callback) {
      preserveScrollPosition(callback);
    }

    /**
     * קבלת delay לskeleton
     */
    getSkeletonDelay() {
      return this.config.SKELETON_DELAY_MS;
    }
  }

  // חשיפה כ-module גלובלי
  window.IntegrationManagerModule = {
    IntegrationManager,
    FEATURE_CONFIG,
    preserveScrollPosition,

    /**
     * יצירת instance חדש
     */
    create() {
      return new IntegrationManager();
    }
  };


})();
