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
    USE_FIREBASE_PAGINATION: false, // כבוי כברירת מחדל
    PAGINATION_PAGE_SIZE: 20,
    SKELETON_DELAY_MS: 800,
    ENABLE_SCROLL_PRESERVATION: true,
    DEBUG_MODE: true
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
        console.log('✅ Firebase Pagination Manager initialized');
      } else {
        console.warn('⚠️ FirebasePaginationModule not available - using legacy pagination');
      }
    }

    /**
     * טעינת לקוחות (עם או בלי פגינציה)
     */
    async loadClients() {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        console.log('🔥 Using Firebase Pagination for clients');
        const result = await this.firebasePagination.loadClientsPaginated(
          this.config.PAGINATION_PAGE_SIZE,
          false
        );
        console.log(`📄 Loaded ${result.items.length} clients from Firebase (hasMore: ${result.hasMore})`);
        return result.items;
      } else {
        console.log('📦 Using legacy loadClientsFromFirebase');
        return await window.loadClientsFromFirebase();
      }
    }

    /**
     * טעינת משימות תקצוב (עם או בלי פגינציה)
     */
    async loadBudgetTasks(employee) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        console.log('🔥 Using Firebase Pagination for budget tasks');
        const result = await this.firebasePagination.loadBudgetTasksPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          false
        );
        console.log(`📄 Loaded ${result.items.length} budget tasks from Firebase (hasMore: ${result.hasMore})`);
        return result.items;
      } else {
        console.log('📦 Using legacy loadBudgetTasksFromFirebase');
        return await window.loadBudgetTasksFromFirebase(employee);
      }
    }

    /**
     * טעינת שעתון (עם או בלי פגינציה)
     */
    async loadTimesheet(employee) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        console.log('🔥 Using Firebase Pagination for timesheet');
        const result = await this.firebasePagination.loadTimesheetPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          false
        );
        console.log(`📄 Loaded ${result.items.length} timesheet entries from Firebase (hasMore: ${result.hasMore})`);
        return result.items;
      } else {
        console.log('📦 Using legacy loadTimesheetFromFirebase');
        return await window.loadTimesheetFromFirebase(employee);
      }
    }

    /**
     * טעינת עוד משימות תקצוב
     */
    async loadMoreBudgetTasks(employee, currentTasks) {
      if (this.config.USE_FIREBASE_PAGINATION && this.firebasePagination) {
        console.log('🔥 Loading more budget tasks from Firebase');
        const result = await this.firebasePagination.loadBudgetTasksPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          true
        );
        console.log(`📄 Loaded ${result.items.length} more budget tasks (hasMore: ${result.hasMore})`);
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
        console.log('🔥 Loading more timesheet entries from Firebase');
        const result = await this.firebasePagination.loadTimesheetPaginated(
          employee,
          this.config.PAGINATION_PAGE_SIZE,
          true
        );
        console.log(`📄 Loaded ${result.items.length} more timesheet entries (hasMore: ${result.hasMore})`);
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

  console.log('✅ IntegrationManagerModule loaded successfully');

})();
