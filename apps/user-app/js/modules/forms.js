/**
 * Forms Module
 * מודול לניהול טפסים: ניקוי, ולידציה, עריכה
 *
 * פונקציות:
 * - clearBudgetForm - ניקוי טופס תקציב
 * - clearTimesheetForm - ניקוי טופס שעתון
 * - validateBudgetTaskForm - ולידציה לטופס תקציב
 * - showValidationErrors - הצגת שגיאות ולידציה
 * - showEditTimesheetDialog - דיאלוג עריכת שעתון
 * - searchClientsForEdit - חיפוש לקוחות לעריכה
 * - selectClientForEdit - בחירת לקוח לעריכה
 *
 * @module FormsModule
 * @version 1.1.0
 * @updated 2025-01-19
 *
 * ════════════════════════════════════════════════════════════════════
 * CHANGELOG | יומן שינויים
 * ════════════════════════════════════════════════════════════════════
 *
 * v1.1.0 - 19/01/2025
 * -------------------
 * 🔄 רפקטורינג: ביטול כפילות קוד
 * ✅ REFACTORED: חיפוש לקוחות משתמש ב-ClientSearch.searchClientsUpdateDOM()
 * 📊 השפעה: ביטול 62 שורות קוד כפול (lines 300-321)
 *
 * שינויים:
 * - פונקציית searchClientsForEdit צומצמה מ-75 שורות ל-13 שורות
 * - לוגיקת סינון ו-HTML generation מבוצעות ע"י מודול משותף
 * - תחזוקתיות משופרת - מקום אחד לעדכון לוגיקת חיפוש
 */

import { safeText , formatDate } from './core-utils.js';


/**
 * ניקוי טופס תקציב
 * @param {Object} manager - אובייקט Manager
 */
export function clearBudgetForm(manager) {
  const budgetForm = document.getElementById('budgetForm');
  if (budgetForm) {
budgetForm.reset();
}
}

/**
 * ניקוי טופס שעתון
 * @param {Object} manager - אובייקט Manager
 */
export function clearTimesheetForm(manager) {
  const timesheetForm = document.getElementById('timesheetForm');
  if (timesheetForm) {
timesheetForm.reset();
}

  // Use Flatpickr API instead of direct value assignment
  if (manager && manager.timesheetCalendar) {
    const now = new Date();
    manager.timesheetCalendar.setDate(now, false);
  }
}

/**
 * ולידציה לטופס משימת תקציב
 * @param {Object} manager - אובייקט Manager
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateBudgetTaskForm(manager) {
  const errors = [];

  const description = document
    .getElementById('budgetDescription')
    ?.value?.trim();
  if (!description || description.length < 3) {
    errors.push('תיאור המשימה חייב להכיל לפחות 3 תווים');
  }

  const clientSelect = document.getElementById('budgetClientSelect')?.value;
  if (!clientSelect) {
    errors.push('חובה לבחור לקוח');
  }

  const estimatedTime = parseInt(document.getElementById('estimatedTime')?.value);
  if (!estimatedTime || isNaN(estimatedTime) || estimatedTime < 30) {
    errors.push('זמן משוער חייב להיות לפחות 30 דקות (חצי שעה)');
  }

  const deadline = document.getElementById('budgetDeadline')?.value;
  if (!deadline) {
    errors.push('חובה להגדיר תאריך יעד');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * הצגת שגיאות ולידציה
 * @param {Object} manager - אובייקט Manager
 * @param {string[]} errors - מערך שגיאות
 */
export function showValidationErrors(manager, errors) {
  const errorHtml = errors
    .map((error) => `<li>${safeText(error)}</li>`)
    .join('');
  manager.showNotification(
    `❌ שגיאות בטופס:<ul style="text-align: right; margin: 10px 0;">${errorHtml}</ul>`,
    'error'
  );
}

/**
 * דיאלוג עריכת שעתון מורחב - Linear Style
 * @param {Object} manager - אובייקט Manager
 * @param {string} entryId - מזהה רשומת שעתון
 */
export function showEditTimesheetDialog(manager, entryId) {
  const entry = manager.timesheetEntries.find(
    (e) =>
      (e.id && e.id.toString() === entryId.toString()) ||
      (e.entryId && e.entryId.toString() === entryId.toString())
  );

  if (!entry) {
    manager.showNotification('רשומת שעתון לא נמצאה', 'error');
    console.error('❌ רשומה לא נמצאה:', entryId);
    return;
  }

  // מכין את תאריך לפורמט input date
  let entryDateForInput = '';
  try {
    const dateObj = new Date(entry.date);
    entryDateForInput = dateObj.toISOString().split('T')[0];
  } catch (error) {
    entryDateForInput = new Date().toISOString().split('T')[0];
  }

  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';

  overlay.innerHTML = `
    <div class="popup edit-timesheet-popup" style="max-width: 500px;">
      <button class="popup-close-btn" onclick="this.closest('.popup-overlay').remove()" aria-label="סגור">
        <i class="fas fa-times"></i>
      </button>
      <div class="popup-header">
        <i class="fas fa-edit"></i>
        ערוך רשומת שעתון
      </div>
      <div class="popup-content">
        <!-- Original Entry - Compact -->
        <div style="background: rgba(59, 130, 246, 0.05); padding: 12px 16px; border-radius: 8px; border-right: 3px solid #3b82f6; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #6b7280;">
            <strong style="color: #1f2937;">מקורי:</strong>
            ${formatDate(entry.date)} • ${safeText(entry.clientName)} • ${entry.minutes} דקות
          </div>
        </div>

        <form id="editTimesheetForm">
          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label for="editDate">
                תאריך <span class="required">*</span>
                <span class="badge-date today" id="editDateBadge" style="margin-right: 8px;">
                  <i class="fas fa-calendar-day"></i> היום
                </span>
              </label>
              <input type="date" id="editDate" value="${entryDateForInput}" required>
            </div>

            <div class="form-group">
              <label for="editMinutes">
                זמן (דקות) <span class="required">*</span>
                <span class="hint-text"><i class="fas fa-lightbulb"></i> 1 שעה = 60 דקות</span>
              </label>
              <input type="number" id="editMinutes" min="1" max="99999" value="${entry.minutes}" placeholder="60" required>
            </div>
          </div>

          <div class="form-group">
            <label for="editClientName">שם לקוח <span class="required">*</span></label>
            <input
              type="text"
              id="editClientSearch"
              value="${safeText(entry.clientName)}"
              disabled
              readonly
              style="
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                background: #f9fafb;
                cursor: not-allowed;
                color: #6b7280;
              "
            />
            <small class="form-help" style="color: #9ca3af; font-size: 12px;">
              <i class="fas fa-lock"></i> לא ניתן לשינוי
            </small>
          </div>

          <div class="form-group">
            <label for="editReason">סיבת העריכה <span class="required">*</span></label>
            <textarea
              id="editReason"
              rows="3"
              placeholder="הסבר מדוע אתה משנה את הפרטים..."
              required
            ></textarea>
            <small class="form-help" style="color: #9ca3af; font-size: 12px;">
              <i class="fas fa-info-circle"></i> נדרש למעקב
            </small>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitAdvancedTimesheetEdit('${entryId}')">
          <i class="fas fa-save"></i> שמור שינויים
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
  requestAnimationFrame(() => overlay.classList.add('show'));

  // ✅ Dynamic Date Badge - Updates based on selected date
  window.updateEditDateBadge = function() {
    const dateInput = document.getElementById('editDate');
    const badge = document.getElementById('editDateBadge');
    if (!dateInput || !badge) {
return;
}

    const selectedDate = new Date(dateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));

    // Reset classes
    badge.className = 'badge-date';

    if (diffDays === 0) {
      badge.classList.add('today');
      badge.innerHTML = '<i class="fas fa-calendar-day"></i> היום';
    } else if (diffDays === 1) {
      badge.classList.add('yesterday');
      badge.innerHTML = '<i class="fas fa-calendar-minus"></i> אתמול';
    } else if (diffDays === 2) {
      badge.classList.add('yesterday');
      badge.innerHTML = '<i class="fas fa-calendar-alt"></i> שלשום';
    } else if (diffDays > 2 && diffDays <= 7) {
      badge.classList.add('past');
      badge.innerHTML = `<i class="fas fa-calendar-times"></i> לפני ${diffDays} ימים`;
    } else if (diffDays > 7) {
      badge.classList.add('old');
      badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> לפני ${diffDays} ימים`;
    } else if (diffDays === -1) {
      badge.classList.add('tomorrow');
      badge.innerHTML = '<i class="fas fa-calendar-plus"></i> מחר';
    } else if (diffDays < -1) {
      badge.classList.add('future');
      badge.innerHTML = `<i class="fas fa-calendar-plus"></i> בעוד ${Math.abs(diffDays)} ימים`;
    }
  };

  // Add event listeners
  setTimeout(() => {
    const dateInput = document.getElementById('editDate');
    const minutesInput = document.getElementById('editMinutes');
    const reasonField = document.getElementById('editReason');

    // Date badge update
    if (dateInput) {
      dateInput.addEventListener('change', window.updateEditDateBadge);
      window.updateEditDateBadge(); // Initial update
    }

    // Blue focus states
    const editInputs = overlay.querySelectorAll('input:not([disabled]), textarea');
    editInputs.forEach((input) => {
      input.addEventListener('focus', function () {
        this.style.borderColor = '#3b82f6';
        this.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
      });

      input.addEventListener('blur', function () {
        this.style.borderColor = '#e1e5e9';
        this.style.boxShadow = 'none';
      });
    });

    // Clear error on input (for validation feedback)
    if (reasonField) {
      reasonField.addEventListener('input', () => {
        reasonField.classList.remove('error');
        reasonField.style.borderColor = '#e1e5e9';
        reasonField.style.boxShadow = 'none';

        const errorMsg = reasonField.parentElement?.querySelector('.error-message');
        if (errorMsg) {
errorMsg.remove();
}
      });
    }

    if (dateInput) {
      dateInput.addEventListener('input', () => {
        dateInput.classList.remove('error');
        dateInput.style.borderColor = '#e1e5e9';
        dateInput.style.boxShadow = 'none';

        const errorMsg = dateInput.parentElement?.querySelector('.error-message');
        if (errorMsg) {
errorMsg.remove();
}
      });
    }

    if (minutesInput) {
      minutesInput.addEventListener('input', () => {
        minutesInput.classList.remove('error');
        minutesInput.style.borderColor = '#e1e5e9';
        minutesInput.style.boxShadow = 'none';

        const errorMsg = minutesInput.parentElement?.querySelector('.error-message');
        if (errorMsg) {
errorMsg.remove();
}
      });
    }

    // Auto-focus on minutes field
    if (minutesInput) {
      minutesInput.select();
      minutesInput.focus();
    }
  }, 100);
}

/**
 * ✅ REFACTORED: חיפוש לקוחות לעריכת שעתון (v2.0.0)
 *
 * Single Source of Truth: js/modules/ui/client-search.js
 * This is now a thin wrapper around the shared ClientSearch module
 *
 * @param {Object} manager - אובייקט Manager
 * @param {string} searchTerm - מונח חיפוש
 */
export function searchClientsForEdit(manager, searchTerm) {
  const resultsContainer = document.getElementById('editClientSearchResults');
  const hiddenInput = document.getElementById('editClientSelect');

  // ✅ Use shared client search module (Single Source of Truth)
  window.ClientSearch.searchClientsUpdateDOM(
    manager.clients,
    searchTerm,
    { resultsContainer, hiddenInput },
    'manager.selectClientForEdit',
    { fileNumberColor: '#9ca3af' } // Gray color for forms
  );
}

/**
 * בחירת לקוח לעריכה
 * @param {Object} manager - אובייקט Manager
 * @param {string} clientName - שם לקוח
 * @param {string} fileNumber - מספר תיק
 */
export function selectClientForEdit(manager, clientName, fileNumber) {
  const searchInput = document.getElementById('editClientSearch');
  const hiddenInput = document.getElementById('editClientSelect');
  const resultsContainer = document.getElementById('editClientSearchResults');

  if (searchInput && hiddenInput && resultsContainer) {
    searchInput.value = clientName;
    hiddenInput.value = clientName;
    resultsContainer.style.display = 'none';

    // אנימציה קצרה להצגת הבחירה
    searchInput.style.background = '#ecfdf5';
    searchInput.style.borderColor = '#10b981';
    setTimeout(() => {
      searchInput.style.background = 'white';
      searchInput.style.borderColor = '#e1e5e9';
    }, 500);
  }
}
