/**
 * Cases Integration Module
 * מודול אינטגרציה חכם למערכת התיקים
 *
 * תכונות:
 * - בחירה אוטומטית של תיק יחיד
 * - הצגת בחירה רק כשיש מספר תיקים
 * - Progressive Disclosure - UX מתקדם
 */

(function() {
  'use strict';

  /**
   * מחלקת CasesIntegration - אינטגרציה חכמה
   */
  class CasesIntegration {
    constructor() {
      this.clientsCasesCache = new Map(); // Cache: clientId -> cases[]
      this.initialized = false;
    }

    /**
     * אתחול המודול
     */
    async init() {
      if (this.initialized) return;

      console.log('📂 Initializing Cases Integration...');

      // וודא ש-casesManager זמין
      if (!window.casesManager) {
        console.error('❌ casesManager not found!');
        return;
      }

      this.initialized = true;
      console.log('✅ Cases Integration initialized');
    }

    /**
     * טעינת תיקים של לקוח מסוים
     * @param {string} clientId - מזהה הלקוח
     * @returns {Promise<Array>} רשימת התיקים
     */
    async loadClientCases(clientId) {
      try {
        // בדוק ב-cache
        if (this.clientsCasesCache.has(clientId)) {
          return this.clientsCasesCache.get(clientId);
        }

        // טען מה-Firebase
        const result = await firebase.functions().httpsCallable('getCasesByClient')({ clientId });

        if (result.data && result.data.success) {
          const cases = result.data.cases || [];
          this.clientsCasesCache.set(clientId, cases);
          return cases;
        }

        return [];
      } catch (error) {
        console.error('❌ Error loading client cases:', error);
        return [];
      }
    }

    /**
     * לוגיקה חכמה - האם להצגת בחירת תיק?
     * @param {string} clientId - מזהה הלקוח
     * @param {HTMLElement} container - קונטיינר להצגת הבחירה
     * @returns {Promise<Object>} { shouldShow: boolean, selectedCase: object|null, cases: array }
     */
    async shouldShowCaseSelection(clientId, container) {
      const cases = await this.loadClientCases(clientId);

      // אין תיקים בכלל - צור תיק דיפולטי (נטפל בזה בהמשך)
      if (cases.length === 0) {
        return {
          shouldShow: false,
          selectedCase: null,
          cases: [],
          needsDefaultCase: true
        };
      }

      // תיק אחד בלבד - בחר אוטומטית!
      if (cases.length === 1) {
        return {
          shouldShow: false,
          selectedCase: cases[0],
          cases: cases
        };
      }

      // מספר תיקים - הצג בחירה
      return {
        shouldShow: true,
        selectedCase: null,
        cases: cases
      };
    }

    /**
     * רינדור בחירת תיק (רק אם יש מספר תיקים)
     * @param {Array} cases - רשימת התיקים
     * @param {HTMLElement} container - הקונטיינר
     * @param {Function} onSelect - callback לבחירת תיק
     */
    renderCaseSelection(cases, container, onSelect) {
      if (!container) return;

      // יצירת HTML לבחירה
      const html = `
        <div class="case-selection-row" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
            <i class="fas fa-folder"></i> תיק:
          </label>
          <select id="caseSelector" class="form-control" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            background: white;
          " required>
            <option value="">בחר תיק...</option>
            ${cases.map(c => `
              <option value="${c.id}" data-case='${JSON.stringify(c)}'>
                ${this.escapeHtml(c.caseTitle)}
                ${c.procedureType === 'hours' ? `(${this.formatHours(c.hoursRemaining)} נותרות)` : ''}
              </option>
            `).join('')}
          </select>
        </div>
      `;

      container.innerHTML = html;

      // Event listener לבחירה
      const selector = document.getElementById('caseSelector');
      if (selector && onSelect) {
        selector.addEventListener('change', (e) => {
          const selectedOption = e.target.options[e.target.selectedIndex];
          if (selectedOption && selectedOption.dataset.case) {
            try {
              const caseData = JSON.parse(selectedOption.dataset.case);
              onSelect(caseData);
            } catch (error) {
              console.error('Error parsing case data:', error);
            }
          }
        });
      }
    }

    /**
     * רינדור מידע על תיק שנבחר אוטומטית (UI feedback)
     * @param {Object} caseItem - התיק שנבחר
     * @param {HTMLElement} container - הקונטיינר
     */
    renderAutoSelectedCase(caseItem, container) {
      if (!container || !caseItem) return;

      const html = `
        <div class="auto-selected-case" style="
          margin-bottom: 16px;
          padding: 12px;
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        ">
          <i class="fas fa-folder-open" style="color: #22c55e; font-size: 18px;"></i>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">
              ${this.escapeHtml(caseItem.caseTitle)}
            </div>
            <div style="font-size: 13px; color: #15803d;">
              ${caseItem.procedureType === 'hours' ? `${this.formatHours(caseItem.hoursRemaining)} שעות נותרות` : 'מחיר קבוע'}
            </div>
          </div>
          <div style="color: #22c55e; font-size: 12px;">
            <i class="fas fa-check-circle"></i> נבחר אוטומטית
          </div>
        </div>
      `;

      container.innerHTML = html;
    }

    /**
     * ניקוי cache (לאחר יצירת תיק חדש)
     * @param {string} clientId - מזהה הלקוח (אופציונלי - אם לא מסופק מנקה הכל)
     */
    clearCache(clientId = null) {
      if (clientId) {
        this.clientsCasesCache.delete(clientId);
      } else {
        this.clientsCasesCache.clear();
      }
    }

    // ==================== Helper Functions ====================

    formatHours(hours) {
      if (!hours) return '0 שעות';
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      if (m === 0) return `${h} שעות`;
      return `${h}:${m.toString().padStart(2, '0')} שעות`;
    }

    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // ==================== חשיפה כ-Module גלובלי ====================

  window.casesIntegration = new CasesIntegration();

  // אתחול אוטומטי כשהדף נטען
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.casesIntegration.init();
    });
  } else {
    window.casesIntegration.init();
  }

  console.log('📂 Cases Integration Module loaded');

})();
