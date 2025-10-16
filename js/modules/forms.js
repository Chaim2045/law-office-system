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
 */

import { safeText } from './core-utils.js';
import { formatDate } from './core-utils.js';

/**
 * ניקוי טופס תקציב
 * @param {Object} manager - אובייקט Manager
 */
export function clearBudgetForm(manager) {
  const budgetForm = document.getElementById("budgetForm");
  if (budgetForm) budgetForm.reset();
}

/**
 * ניקוי טופס שעתון
 * @param {Object} manager - אובייקט Manager
 */
export function clearTimesheetForm(manager) {
  const timesheetForm = document.getElementById("timesheetForm");
  if (timesheetForm) timesheetForm.reset();
  const actionDate = document.getElementById("actionDate");
  if (actionDate) {
    actionDate.value = new Date().toISOString().split("T")[0];
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
    .getElementById("budgetDescription")
    ?.value?.trim();
  if (!description || description.length < 3) {
    errors.push("תיאור המשימה חייב להכיל לפחות 3 תווים");
  }

  const clientSelect = document.getElementById("budgetClientSelect")?.value;
  if (!clientSelect) {
    errors.push("חובה לבחור לקוח");
  }

  const estimatedTime = parseInt(document.getElementById("estimatedTime")?.value);
  if (!estimatedTime || isNaN(estimatedTime) || estimatedTime < 30) {
    errors.push("זמן משוער חייב להיות לפחות 30 דקות (חצי שעה)");
  }

  const deadline = document.getElementById("budgetDeadline")?.value;
  if (!deadline) {
    errors.push("חובה להגדיר תאריך יעד");
  }

  return {
    isValid: errors.length === 0,
    errors,
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
    .join("");
  manager.showNotification(
    `❌ שגיאות בטופס:<ul style="text-align: right; margin: 10px 0;">${errorHtml}</ul>`,
    "error"
  );
}

/**
 * דיאלוג עריכת שעתון מורחב
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
    manager.showNotification("רשומת שעתון לא נמצאה", "error");
    console.error("❌ רשומה לא נמצאה:", entryId);
    return;
  }

  // מכין את תאריך לפורמט input date
  let entryDateForInput = "";
  try {
    const dateObj = new Date(entry.date);
    entryDateForInput = dateObj.toISOString().split("T")[0];
  } catch (error) {
    entryDateForInput = new Date().toISOString().split("T")[0];
  }

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup edit-timesheet-popup" style="max-width: 600px;">
      <div class="popup-header">
        <i class="fas fa-edit"></i>
        ערוך רשומת שעתון
      </div>
      <div class="popup-content">
        <div class="task-overview">
          <h3>
            <i class="fas fa-info-circle"></i>
            רשומה מקורית
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; color: #6b7280; background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>תאריך מקורי:</strong> ${formatDate(entry.date)}</p>
            <p><strong>לקוח מקורי:</strong> ${safeText(entry.clientName)}</p>
            <p><strong>זמן מקורי:</strong> ${entry.minutes} דקות</p>
            <p><strong>פעולה:</strong> ${safeText(entry.action)}</p>
          </div>
        </div>

        <form id="editTimesheetForm">
          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label for="editDate">תאריך <span class="required">*</span></label>
              <input
                type="date"
                id="editDate"
                value="${entryDateForInput}"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  transition: all 0.2s ease;
                "
              >
            </div>

            <div class="form-group">
              <label for="editMinutes">זמן (דקות) <span class="required">*</span></label>
              <input
                type="number"
                id="editMinutes"
                min="1"
                max="999"
                value="${entry.minutes}"
                required
                placeholder="60"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  text-align: center;
                  transition: all 0.2s ease;
                "
              >
            </div>
          </div>

          <div class="form-group">
            <label for="editClientName">שם לקוח <span class="required">*</span></label>
            <div class="modern-client-search">
              <input
                type="text"
                class="search-input"
                id="editClientSearch"
                placeholder="התחל להקליד שם לקוח..."
                value="${safeText(entry.clientName)}"
                autocomplete="off"
                oninput="manager.searchClientsForEdit(this.value)"
                style="
                  width: 100%;
                  padding: 12px 16px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                "
              />
              <div
                class="search-results"
                id="editClientSearchResults"
                style="
                  position: absolute;
                  top: 100%;
                  left: 0;
                  right: 0;
                  background: white;
                  border: 1px solid #d1d5db;
                  border-top: none;
                  border-radius: 0 0 8px 8px;
                  max-height: 200px;
                  overflow-y: auto;
                  z-index: 1000;
                  display: none;
                "
              ></div>
              <input
                type="hidden"
                id="editClientSelect"
                value="${safeText(entry.clientName)}"
                required
              />
            </div>
            <small class="form-help">
              <i class="fas fa-search"></i>
              התחל להקליד לחיפוש לקוחות קיימים
            </small>
          </div>

          <div class="form-group">
            <label for="editReason">סיבת העריכה <span class="required">*</span></label>
            <textarea
              id="editReason"
              rows="3"
              placeholder="הסבר מדוע אתה משנה את הפרטים (חובה למעקב)"
              required
              style="
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                resize: vertical;
                transition: all 0.2s ease;
              "
            ></textarea>
            <small class="form-help">
              <i class="fas fa-exclamation-circle"></i>
              סיבת העריכה נדרשת למעקב ובקרה
            </small>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitAdvancedTimesheetEdit('${entryId}')" style="min-width: 140px;">
          <i class="fas fa-save"></i> שמור שינויים
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // הוספת עיצוב focus למקומות שנערכים
  setTimeout(() => {
    const editInputs = overlay.querySelectorAll("input, textarea");
    editInputs.forEach((input) => {
      input.addEventListener("focus", function () {
        this.style.borderColor = "#3b82f6";
        this.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
      });

      input.addEventListener("blur", function () {
        this.style.borderColor = "#e1e5e9";
        this.style.boxShadow = "none";
      });
    });

    // פוקוס על שדה הזמן
    const minutesInput = document.getElementById("editMinutes");
    if (minutesInput) {
      minutesInput.select();
      minutesInput.focus();
    }
  }, 100);
}

/**
 * חיפוש לקוחות לעריכת שעתון
 * @param {Object} manager - אובייקט Manager
 * @param {string} searchTerm - מונח חיפוש
 */
export function searchClientsForEdit(manager, searchTerm) {
  const resultsContainer = document.getElementById("editClientSearchResults");
  const hiddenInput = document.getElementById("editClientSelect");

  if (!resultsContainer) return;

  if (!searchTerm || searchTerm.length < 1) {
    resultsContainer.style.display = "none";
    return;
  }

  // סינון לקוחות
  const filteredClients = manager.clients.filter(
    (client) =>
      client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.fileNumber.includes(searchTerm) ||
      client.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredClients.length === 0) {
    resultsContainer.innerHTML = `
      <div style="padding: 12px; color: #6b7280; text-align: center;">
        <i class="fas fa-search"></i> לא נמצאו לקוחות תואמים
      </div>
    `;
    resultsContainer.style.display = "block";
    return;
  }

  const resultsHtml = filteredClients
    .slice(0, 8)
    .map(
      (client) => `
    <div class="client-result" onclick="manager.selectClientForEdit('${
      client.fullName
    }', '${client.fileNumber}')"
         style="
           padding: 10px 12px;
           cursor: pointer;
           border-bottom: 1px solid #f3f4f6;
           display: flex;
           justify-content: space-between;
           align-items: center;
           transition: background 0.2s ease;
         "
         onmouseover="this.style.background='#f8fafc'"
         onmouseout="this.style.background='white'">
      <div>
        <div style="font-weight: 600; color: #374151;">${safeText(
          client.fullName
        )}</div>
        ${
          client.description
            ? `<div style="font-size: 12px; color: #6b7280;">${safeText(
                client.description
              )}</div>`
            : ""
        }
      </div>
      <div style="font-size: 12px; color: #9ca3af; font-weight: 500;">${
        client.fileNumber
      }</div>
    </div>
  `
    )
    .join("");

  resultsContainer.innerHTML = resultsHtml;
  resultsContainer.style.display = "block";
}

/**
 * בחירת לקוח לעריכה
 * @param {Object} manager - אובייקט Manager
 * @param {string} clientName - שם לקוח
 * @param {string} fileNumber - מספר תיק
 */
export function selectClientForEdit(manager, clientName, fileNumber) {
  const searchInput = document.getElementById("editClientSearch");
  const hiddenInput = document.getElementById("editClientSelect");
  const resultsContainer = document.getElementById("editClientSearchResults");

  if (searchInput && hiddenInput && resultsContainer) {
    searchInput.value = clientName;
    hiddenInput.value = clientName;
    resultsContainer.style.display = "none";

    // אנימציה קצרה להצגת הבחירה
    searchInput.style.background = "#ecfdf5";
    searchInput.style.borderColor = "#10b981";
    setTimeout(() => {
      searchInput.style.background = "white";
      searchInput.style.borderColor = "#e1e5e9";
    }, 500);
  }
}
