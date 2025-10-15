/**
 * Pagination Module - מודול עימוד וטעינה חכמה
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 10/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - טעינת 20 רשומות ראשונות
 * - כפתור "טען עוד" - 20 נוספים
 * - פילטר תאריכים - עד שנה אחורה
 * - אופטימיזציה למאות/אלפי רשומות
 */

(function() {
  'use strict';

  /**
   * מחלקת Pagination - מנהלת עימוד חכם
   */
  class PaginationManager {
    constructor(options = {}) {
      this.pageSize = options.pageSize || 20;
      this.currentPage = 1;
      this.totalItems = 0;
      this.items = [];
      this.filteredItems = [];
      this.maxDateRange = options.maxDateRange || 365; // ימים (שנה)
      this.containerId = options.containerId;
      this.loadMoreButtonId = options.loadMoreButtonId;
    }

    /**
     * טעינת נתונים ראשונית
     * @param {Array} items - כל הפריטים
     */
    setItems(items) {
      this.items = items || [];
      this.totalItems = this.items.length;
      this.currentPage = 1;
      this.filteredItems = [...this.items];
      return this.getCurrentPageItems();
    }

    /**
     * עדכון פריטים בלי לאפס את העמוד הנוכחי
     * @param {Array} items - כל הפריטים
     */
    updateItems(items) {
      this.items = items || [];
      this.totalItems = this.items.length;
      // ✅ לא מאפס את currentPage
      this.filteredItems = [...this.items];
      return this.getCurrentPageItems();
    }

    /**
     * קבלת פריטים לעמוד הנוכחי
     * @returns {Array} פריטים לעמוד
     */
    getCurrentPageItems() {
      const startIndex = 0;
      const endIndex = this.currentPage * this.pageSize;
      return this.filteredItems.slice(startIndex, endIndex);
    }

    /**
     * טעינת עמוד הבא
     * @returns {Object} { items, hasMore }
     */
    loadMore() {
      this.currentPage++;
      const items = this.getCurrentPageItems();
      const hasMore = this.hasMorePages();

      return {
        items,
        hasMore,
        currentCount: items.length,
        totalCount: this.filteredItems.length
      };
    }

    /**
     * בדיקה אם יש עוד עמודים
     * @returns {boolean}
     */
    hasMorePages() {
      return this.currentPage * this.pageSize < this.filteredItems.length;
    }

    /**
     * פילטר לפי טווח תאריכים
     * @param {Date} startDate - תאריך התחלה
     * @param {Date} endDate - תאריך סיום (ברירת מחדל: היום)
     * @param {string} dateField - שדה התאריך באובייקט (ברירת מחדל: 'createdAt')
     */
    filterByDateRange(startDate, endDate = new Date(), dateField = 'createdAt') {
      this.filteredItems = this.items.filter(item => {
        const itemDate = this.extractDate(item[dateField]);
        if (!itemDate) return true; // אם אין תאריך, כלול

        return itemDate >= startDate && itemDate <= endDate;
      });

      this.currentPage = 1;
      this.totalItems = this.filteredItems.length;
      return this.getCurrentPageItems();
    }

    /**
     * פילטר - שנה אחרונה בלבד
     * @param {string} dateField - שדה התאריך
     */
    filterLastYear(dateField = 'createdAt') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      return this.filterByDateRange(oneYearAgo, new Date(), dateField);
    }

    /**
     * חילוץ תאריך מאובייקט (תומך ב-Firebase Timestamp)
     * @param {any} dateValue
     * @returns {Date|null}
     */
    extractDate(dateValue) {
      if (!dateValue) return null;

      // Firebase Timestamp
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }

      // Date object
      if (dateValue instanceof Date) {
        return dateValue;
      }

      // String
      if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }

      return null;
    }

    /**
     * איפוס לעמוד הראשון
     */
    reset() {
      this.currentPage = 1;
      this.filteredItems = [...this.items];
      return this.getCurrentPageItems();
    }

    /**
     * קבלת מידע על המצב הנוכחי
     * @returns {Object}
     */
    getStatus() {
      return {
        currentPage: this.currentPage,
        pageSize: this.pageSize,
        totalItems: this.totalItems,
        filteredItems: this.filteredItems.length,
        displayedItems: this.getCurrentPageItems().length,
        hasMore: this.hasMorePages()
      };
    }

    /**
     * יצירת כפתור "טען עוד"
     * @param {Function} onLoadMore - callback כשלוחצים
     * @returns {string} HTML
     */
    createLoadMoreButton(onLoadMore) {
      if (!this.hasMorePages()) {
        return '';
      }

      const remaining = this.filteredItems.length - (this.currentPage * this.pageSize);

      return `
        <div class="pagination-controls">
          <button class="load-more-btn" onclick="${onLoadMore}">
            <i class="fas fa-chevron-down"></i>
            טען עוד (${remaining} רשומות נוספות)
          </button>
          <div class="pagination-info">
            מציג ${this.currentPage * this.pageSize} מתוך ${this.filteredItems.length} רשומות
          </div>
        </div>
      `;
    }
  }

  // חשיפה כ-module גלובלי
  window.PaginationModule = {
    PaginationManager,

    /**
     * יצירת instance חדש
     * @param {Object} options
     * @returns {PaginationManager}
     */
    create(options) {
      return new PaginationManager(options);
    }
  };

})();
