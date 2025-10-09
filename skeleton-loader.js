/**
 * Skeleton Loader Module - מודול טעינת שלד (Skeleton UI)
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 10/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - אפקט shimmer מתקדם (כמו Facebook, Claude, LinkedIn)
 * - תמיכה בטבלאות וכרטיסיות
 * - אנימציה חלקה ומקצועית
 * - התאמה אוטומטית למבנה התוכן
 */

(function() {
  'use strict';

  /**
   * מחלקת SkeletonLoader - מנהלת אפקטי טעינה מתקדמים
   */
  class SkeletonLoader {
    constructor(options = {}) {
      this.duration = options.duration || 1500; // משך אנימציה במילישניות
      this.count = options.count || 3; // כמה שלדים להציג
      this.type = options.type || 'card'; // card / row / custom
    }

    /**
     * יצירת CSS לאנימציה (רק פעם אחת)
     */
    static injectStyles() {
      if (document.getElementById('skeleton-styles')) {
        return; // כבר קיים
      }

      const styleSheet = document.createElement('style');
      styleSheet.id = 'skeleton-styles';
      styleSheet.textContent = `
        /* Skeleton Base */
        .skeleton-wrapper {
          padding: 16px;
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Skeleton Element */
        .skeleton {
          background: linear-gradient(
            90deg,
            #f0f0f0 0%,
            #f0f0f0 40%,
            #e8e8e8 50%,
            #f0f0f0 60%,
            #f0f0f0 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        /* Shimmer Animation - הגל המבריק */
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .skeleton {
            background: linear-gradient(
              90deg,
              #2a2a2a 0%,
              #2a2a2a 40%,
              #333333 50%,
              #2a2a2a 60%,
              #2a2a2a 100%
            );
          }
        }

        /* Skeleton Card - כרטיסייה */
        .skeleton-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .skeleton-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .skeleton-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
        }

        .skeleton-card-title {
          flex: 1;
        }

        .skeleton-line {
          height: 12px;
          margin-bottom: 8px;
        }

        .skeleton-line.title {
          height: 16px;
          width: 70%;
        }

        .skeleton-line.subtitle {
          height: 12px;
          width: 50%;
        }

        .skeleton-line.full {
          width: 100%;
        }

        .skeleton-line.medium {
          width: 80%;
        }

        .skeleton-line.short {
          width: 60%;
        }

        /* Skeleton Table Row */
        .skeleton-table-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 16px;
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
          background: white;
        }

        .skeleton-table-cell {
          height: 20px;
        }

        /* Loading Container */
        .skeleton-loading-container {
          text-align: center;
          padding: 24px;
          color: #666;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .skeleton-loading-text {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .skeleton-loading-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;

      document.head.appendChild(styleSheet);
    }

    /**
     * יצירת skeleton לכרטיסייה (Linear Card Style)
     * @returns {string} HTML
     */
    createCardSkeleton() {
      return `
        <div class="skeleton-card">
          <div class="skeleton-card-header">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton-card-title">
              <div class="skeleton skeleton-line title"></div>
              <div class="skeleton skeleton-line subtitle"></div>
            </div>
          </div>
          <div class="skeleton skeleton-line full"></div>
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      `;
    }

    /**
     * יצירת skeleton לשורת טבלה
     * @param {number} columns - מספר עמודות
     * @returns {string} HTML
     */
    createRowSkeleton(columns = 6) {
      const cells = Array(columns)
        .fill(0)
        .map(() => '<div class="skeleton skeleton-table-cell"></div>')
        .join('');

      return `
        <div class="skeleton-table-row">
          ${cells}
        </div>
      `;
    }

    /**
     * יצירת מספר skeletons
     * @param {number} count - כמות
     * @param {string} type - card/row
     * @param {number} columns - מספר עמודות (לטבלה)
     * @returns {string} HTML
     */
    createMultiple(count, type = 'card', columns = 6) {
      const items = [];
      for (let i = 0; i < count; i++) {
        if (type === 'card') {
          items.push(this.createCardSkeleton());
        } else if (type === 'row') {
          items.push(this.createRowSkeleton(columns));
        }
      }
      return `<div class="skeleton-wrapper">${items.join('')}</div>`;
    }

    /**
     * הצגת skeleton במיקום מסוים
     * @param {string} containerId - ID של הקונטיינר
     * @param {Object} options - אפשרויות
     */
    show(containerId, options = {}) {
      SkeletonLoader.injectStyles(); // ודא שה-CSS קיים

      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Skeleton: Container #${containerId} not found`);
        return;
      }

      const count = options.count || this.count;
      const type = options.type || this.type;
      const columns = options.columns || 6;

      // הסתרת כפתור "טען עוד" אם קיים
      const loadMoreBtn = container.querySelector('.load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
      }

      // יצירת div זמני לskeleton
      const skeletonDiv = document.createElement('div');
      skeletonDiv.id = `skeleton-${containerId}`;
      skeletonDiv.innerHTML = this.createMultiple(count, type, columns);

      // הוספה לקונטיינר
      container.appendChild(skeletonDiv);

      return skeletonDiv;
    }

    /**
     * הסרת skeleton מהמיקום
     * @param {string} containerId - ID של הקונטיינר
     */
    hide(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const skeletonDiv = document.getElementById(`skeleton-${containerId}`);
      if (skeletonDiv) {
        // אנימציית fadeOut
        skeletonDiv.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          skeletonDiv.remove();
        }, 300);
      }

      // הצגת כפתור "טען עוד" מחדש אם קיים
      const loadMoreBtn = container.querySelector('.load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.style.display = '';
      }
    }

    /**
     * הצגת אינדיקטור טעינה פשוט (עם טקסט)
     * @param {string} containerId
     * @param {string} text - טקסט להציג
     */
    showLoadingIndicator(containerId, text = 'טוען נתונים...') {
      SkeletonLoader.injectStyles();

      const container = document.getElementById(containerId);
      if (!container) return;

      const loadingDiv = document.createElement('div');
      loadingDiv.id = `loading-${containerId}`;
      loadingDiv.className = 'skeleton-loading-container';
      loadingDiv.innerHTML = `
        <div class="skeleton-loading-text">
          <i class="fas fa-circle-notch skeleton-loading-icon"></i>
          <span>${text}</span>
        </div>
      `;

      container.appendChild(loadingDiv);

      return loadingDiv;
    }

    /**
     * הסרת אינדיקטור טעינה
     * @param {string} containerId
     */
    hideLoadingIndicator(containerId) {
      const loadingDiv = document.getElementById(`loading-${containerId}`);
      if (loadingDiv) {
        loadingDiv.remove();
      }
    }

    /**
     * Wrapper להצגה והסרה אוטומטית
     * @param {string} containerId
     * @param {Function} asyncFunction - פונקציה אסינכרונית שטוענת נתונים
     * @param {Object} options
     */
    async wrap(containerId, asyncFunction, options = {}) {
      this.show(containerId, options);

      try {
        const result = await asyncFunction();
        return result;
      } catch (error) {
        console.error('Skeleton: Error during loading', error);
        throw error;
      } finally {
        this.hide(containerId);
      }
    }
  }

  // חשיפה כ-module גלובלי
  window.SkeletonLoaderModule = {
    SkeletonLoader,

    /**
     * יצירת instance חדש
     * @param {Object} options
     * @returns {SkeletonLoader}
     */
    create(options) {
      return new SkeletonLoader(options);
    },

    /**
     * שימוש מהיר - הצגת skeleton
     * @param {string} containerId
     * @param {Object} options
     */
    show(containerId, options) {
      const loader = new SkeletonLoader(options);
      return loader.show(containerId, options);
    },

    /**
     * שימוש מהיר - הסתרת skeleton
     * @param {string} containerId
     */
    hide(containerId) {
      const loader = new SkeletonLoader();
      loader.hide(containerId);
    }
  };

  console.log('✅ SkeletonLoaderModule loaded successfully');

})();
