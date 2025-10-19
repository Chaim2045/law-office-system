/**
 * ========================================
 * Dialogs & Modals Module
 * ========================================
 * מערכת מרכזית לניהול דיאלוגים, פופאפים ו-modals
 *
 * תאריך חילוץ: 2025-10-15
 * גרסה: 4.34.0
 *
 * פונקציות שחולצו מ-script.js:
 * - showSimpleLoading (שורות 91-115)
 * - hideSimpleLoading (שורות 120-126)
 * - showBlockedClientDialog (שורות 986-1032)
 * - showAdvancedTimeDialog (שורות 3246-3290)
 * - showTaskCompletionModal (שורות 3493-3710)
 * - openSmartForm (שורות 4272-4295)
 *
 * ✅ REMOVED - Client form functions (now handled by cases.js):
 * - showPasswordDialog, showClientForm, openClientForm, hideClientForm
 * ========================================
 */

/* global safeText, formatDate */

/**
 * ========================================
 * Loading Overlays - REMOVED
 * ========================================
 * ✅ showSimpleLoading & hideSimpleLoading removed - use NotificationSystem instead
 * Old calls automatically redirect to new system via backward compatibility wrapper in index.html
 */

/**
 * ========================================
 * Client-Related Dialogs
 * ========================================
 */

/**
 * הצגת דיאלוג לקוח חסום
 * @param {string} clientName - שם הלקוח
 * @param {string} action - הפעולה שנחסמה
 */
function showBlockedClientDialog(clientName, action) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const clientNameDiv = document.createElement("div");
  clientNameDiv.className = "client-name";
  clientNameDiv.textContent = clientName;

  const actionBlockedDiv = document.createElement("div");
  actionBlockedDiv.className = "action-blocked";
  actionBlockedDiv.textContent = `לא ניתן לבצע ${action} עבור לקוח זה`;

  overlay.innerHTML = `
    <div class="popup blocked-client-popup">
      <div class="popup-header" style="color: #ef4444;">
        <i class="fas fa-ban"></i>
        לקוח חסום
      </div>
      <div class="blocked-client-message">
        ${clientNameDiv.outerHTML}
        <div class="reason">נגמרה יתרת השעות</div>
        ${actionBlockedDiv.outerHTML}
      </div>
      <div class="solutions">
        <h4>פתרונות אפשריים:</h4>
        <ul>
          <li><i class="fas fa-phone"></i> צור קשר עם הלקוח לרכישת שעות נוספות</li>
          <li><i class="fas fa-dollar-sign"></i> עדכן את מערכת הביליטס</li>
          <li><i class="fas fa-user-tie"></i> פנה למנהל המשרד</li>
        </ul>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-check"></i>
          הבנתי
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    if (document.body.contains(overlay)) {
      overlay.remove();
    }
  }, 10000);
}

// ✅ Client form functions REMOVED
// Removed: showPasswordDialog, checkAdminPassword, showClientForm, openClientForm, hideClientForm
// Use casesManager.showCreateCaseDialog() instead

/**
 * ========================================
 * Task-Related Dialogs
 * ========================================
 */

/**
 * הצגת דיאלוג מתקדם להוספת זמן למשימה
 * @param {string} taskId - מזהה המשימה
 * @param {Object} manager - מופע ה-Manager
 */
function showAdvancedTimeDialog(taskId, manager) {
  const task = manager.budgetTasks.find((t) => t.id === taskId);
  if (!task) {
    manager.showNotification("המשימה לא נמצאה", "error");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup" style="max-width: 500px;">
      <div class="popup-header">
        <i class="fas fa-clock"></i>
        הוספת זמן למשימה
      </div>
      <div class="popup-content">
        <form id="advancedTimeForm">
          <div class="form-group">
            <label for="workDate">תאריך העבודה</label>
            <input type="date" id="workDate" required value="${
              new Date().toISOString().split("T")[0]
            }">
          </div>
          <div class="form-group">
            <label for="workMinutes">דקות עבודה</label>
            <input type="number" id="workMinutes" min="1" max="999" placeholder="60" required>
          </div>
          <div class="form-group">
            <label for="workDescription">תיאור העבודה</label>
            <textarea id="workDescription" rows="3" placeholder="תיאור מפורט..." required></textarea>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitTimeEntry('${taskId}')">
          <i class="fas fa-save"></i> שמור
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * הצגת modal סיום משימה מקצועי
 * @param {Object} task - אובייקט המשימה
 * @param {Object} manager - מופע ה-Manager
 */
function showTaskCompletionModal(task, manager) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.style.zIndex = "10000";

  // Calculate statistics
  const estimatedMinutes = task.estimatedMinutes || 0;
  const actualMinutes = task.actualMinutes || 0;
  const timeDiff = actualMinutes - estimatedMinutes;
  const timePercentage =
    estimatedMinutes > 0
      ? ((actualMinutes / estimatedMinutes) * 100).toFixed(0)
      : 0;

  // Deadline statistics
  const now = new Date();
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const createdAt = task.createdAt ? new Date(task.createdAt) : now;
  const originalDeadline = task.originalDeadline
    ? new Date(task.originalDeadline)
    : deadline;
  const wasExtended =
    task.deadlineExtensions && task.deadlineExtensions.length > 0;

  let deadlineStatus = "";
  let deadlineClass = "";
  let deadlineIconClass = "";
  let deadlineColor = "";

  if (deadline) {
    const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      deadlineStatus = `איחור של ${Math.abs(daysRemaining)} ימים`;
      deadlineClass = "deadline-late";
      deadlineIconClass = "fa-exclamation-triangle";
      deadlineColor = "#ef4444";
    } else if (daysRemaining === 0) {
      deadlineStatus = "בדיוק בזמן!";
      deadlineClass = "deadline-ontime";
      deadlineIconClass = "fa-check-circle";
      deadlineColor = "#3b82f6";
    } else {
      deadlineStatus = `${daysRemaining} ימים לפני המועד`;
      deadlineClass = "deadline-early";
      deadlineIconClass = "fa-flag-checkered";
      deadlineColor = "#10b981";
    }

    if (wasExtended && originalDeadline) {
      const extensionDays = Math.ceil(
        (deadline - originalDeadline) / (1000 * 60 * 60 * 24)
      );
      deadlineStatus += ` (הוארך ב-${extensionDays} ימים)`;
    }
  } else {
    deadlineStatus = "ללא תאריך יעד";
    deadlineClass = "deadline-none";
    deadlineIconClass = "fa-calendar";
    deadlineColor = "#9ca3af";
  }

  // Time status
  let timeStatus = "";
  let timeClass = "";
  let timeIconClass = "";
  let timeColor = "";

  if (timeDiff < 0) {
    timeStatus = `חסכת ${Math.abs(timeDiff)} דקות!`;
    timeClass = "time-saved";
    timeIconClass = "fa-bolt";
    timeColor = "#10b981";
  } else if (timeDiff === 0) {
    timeStatus = "בדיוק לפי התקציב!";
    timeClass = "time-exact";
    timeIconClass = "fa-check-circle";
    timeColor = "#3b82f6";
  } else {
    timeStatus = `חרגת ב-${timeDiff} דקות`;
    timeClass = "time-over";
    timeIconClass = "fa-clock";
    timeColor = "#ef4444";
  }

  overlay.innerHTML = `
    <div class="popup completion-modal" style="max-width: 650px; animation: slideInUp 0.3s ease-out;">
      <!-- Header -->
      <div class="popup-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; position: relative;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-check-circle" style="font-size: 24px;"></i>
          <span style="font-size: 18px; font-weight: 600;">סיום משימה</span>
        </div>
        <button
          onclick="this.closest('.popup-overlay').remove()"
          style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;"
          onmouseover="this.style.background='rgba(255,255,255,0.3)'"
          onmouseout="this.style.background='rgba(255,255,255,0.2)'"
          title="סגור">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="popup-content" style="padding: 30px;">
        <!-- Task Info -->
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
            ${safeText(task.taskDescription || task.description || "")}
          </h3>
          <div style="color: #6b7280; font-size: 14px; display: flex; align-items: center; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-building" style="color: #3b82f6;"></i>
              <span>${safeText(task.clientName || "")}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-folder" style="color: #8b5cf6;"></i>
              <span>${safeText(task.fileNumber || "")}</span>
            </div>
          </div>
        </div>

        <!-- Statistics Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">

          <!-- Time Budget Card -->
          <div class="stat-card ${timeClass}" style="background: white; border: 2px solid ${timeColor}; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: ${timeColor}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
              <i class="fas ${timeIconClass}" style="font-size: 24px; color: ${timeColor};"></i>
            </div>
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">תקציב זמן</div>
            <div style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
              ${actualMinutes} <span style="font-size: 18px; color: #9ca3af;">/</span> ${estimatedMinutes}
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">דקות</div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 14px; font-weight: 600; color: ${timeColor};">
                ${timeStatus}
              </div>
              <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
                ${timePercentage}% מהתקציב
              </div>
            </div>
          </div>

          <!-- Deadline Card -->
          <div class="stat-card ${deadlineClass}" style="background: white; border: 2px solid ${deadlineColor}; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: ${deadlineColor}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
              <i class="fas ${deadlineIconClass}" style="font-size: 24px; color: ${deadlineColor};"></i>
            </div>
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">תאריך יעד</div>
            <div style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
              ${deadline ? formatDate(deadline) : "לא הוגדר"}
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">
              ${deadline ? `יצירה: ${formatDate(createdAt)}` : ""}
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 14px; font-weight: 600; color: ${deadlineColor};">
                ${deadlineStatus}
              </div>
            </div>
          </div>
        </div>

        <!-- Completion Notes -->
        <div style="margin-bottom: 0;">
          <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #374151; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-pen" style="color: #10b981;"></i>
            הערות סיום (אופציונלי)
          </label>
          <textarea
            id="completionNotes"
            rows="4"
            placeholder="תאר את התוצאות, לקחים, או כל מידע רלוונטי אחר..."
            style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
            onfocus="this.style.borderColor='#10b981'; this.style.boxShadow='0 0 0 3px rgba(16, 185, 129, 0.1)'"
            onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'"
          ></textarea>
          <div style="text-align: left; font-size: 12px; color: #9ca3af; margin-top: 6px;">
            <span id="notesCounter">0</span> תווים
          </div>
        </div>

      </div>

      <div class="popup-buttons" style="padding: 20px 30px; background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%); border-top: 1px solid #e5e7eb; display: flex; gap: 12px;">
        <button
          class="popup-btn popup-btn-confirm"
          id="confirmCompleteBtn"
          onclick="manager.submitTaskCompletion('${task.id}')"
          style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); flex: 1; padding: 15px; font-size: 16px; font-weight: 600; border-radius: 10px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">
          <i class="fas fa-check"></i> אשר סיום משימה
        </button>
        <button
          class="popup-btn popup-btn-cancel"
          onclick="this.closest('.popup-overlay').remove()"
          style="flex: 0.4; padding: 15px; border-radius: 10px; transition: all 0.2s;"
          onmouseover="this.style.transform='translateY(-1px)'"
          onmouseout="this.style.transform='translateY(0)'">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `;

  // Add character counter
  const textarea = overlay.querySelector("#completionNotes");
  const counter = overlay.querySelector("#notesCounter");
  if (textarea && counter) {
    textarea.addEventListener("input", () => {
      counter.textContent = textarea.value.length;
    });
  }

  document.body.appendChild(overlay);
}

/**
 * ========================================
 * Form Management
 * ========================================
 */

/**
 * פתיחה/סגירה של טופס חכם (Smart Form)
 * מחליף בין טופס תקציב לשעתון לפי הטאב הפעיל
 */
function openSmartForm() {
  const plusButton = document.getElementById("smartPlusBtn");
  const activeTab = document.querySelector(".tab-button.active");
  if (!activeTab) return;

  let currentForm;
  if (activeTab.onclick && activeTab.onclick.toString().includes("budget")) {
    currentForm = document.getElementById("budgetFormContainer");
  } else if (
    activeTab.onclick &&
    activeTab.onclick.toString().includes("timesheet")
  ) {
    currentForm = document.getElementById("timesheetFormContainer");
  }

  if (!currentForm) return;
  if (currentForm.classList.contains("hidden")) {
    currentForm.classList.remove("hidden");
    if (plusButton) plusButton.classList.add("active");
  } else {
    currentForm.classList.add("hidden");
    if (plusButton) plusButton.classList.remove("active");
  }
}

/**
 * ========================================
 * Module Exports
 * ========================================
 */

// Export to global scope for backward compatibility
if (typeof window !== "undefined") {
  window.DialogsModule = {
    // ✅ Loading functions removed - use NotificationSystem.showLoading() instead
    showBlockedClientDialog,
    showAdvancedTimeDialog,
    showTaskCompletionModal,
    // ✅ Client form functions removed
    openSmartForm,
  };
}

// Legacy global functions (for backward compatibility)
// ✅ showSimpleLoading, hideSimpleLoading removed - handled by backward compatibility wrapper in index.html
// ✅ showClientForm, openClientForm, hideClientForm removed
window.openSmartForm = openSmartForm;
