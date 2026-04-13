/**
 * ========================================
 * Dialogs & Modals Module
 * ========================================
 * מערכת מרכזית לניהול דיאלוגים, פופאפים ו-modals
 *
 * תאריך חילוץ: 2025-10-15
 * גרסה: 4.35.0
 * עדכון אחרון: 19/01/2025
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
 *
 * ════════════════════════════════════════════════════════════════════
 * CHANGELOG | יומן שינויים
 * ════════════════════════════════════════════════════════════════════
 *
 * v4.35.0 - 19/01/2025
 * --------------------
 * 🔄 רפקטורינג: שיפור fallback ל-safeText
 * ✅ IMPROVED: הוספת אזהרת console כאשר fallback מופעל (lines 31-47)
 * 🎯 מטרה: זיהוי בעיות אם core-utils.js לא נטען
 *
 * שינויים:
 * - Fallback עדיין קיים לבטיחות
 * - אבל עכשיו מזהיר במפורש שזה לא צריך לקרות
 * - עוזר באיתור בעיות בסדר טעינת מודולים
 * ========================================
 */

/* global safeText, formatDate */

/**
 * ========================================
 * Utility Functions Fallbacks
 * ========================================
 */

// ✅ REFACTORED (v5.3.0): safeText is now globally available from core-utils.js
// Fallback kept for backward compatibility but should never trigger
if (typeof window.safeText === 'undefined') {
  console.warn('⚠️ safeText fallback triggered - core-utils.js may not be loaded');
  window.safeText = function(text) {
    if (text === null || text === undefined) {
return '';
}
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

// ✅ Single Source of Truth: window.safeText and date functions from core-utils.js
// These are exposed globally after main.js loads (which imports core-utils.js)

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
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';

  const clientNameDiv = document.createElement('div');
  clientNameDiv.className = 'client-name';
  clientNameDiv.textContent = clientName;

  const actionBlockedDiv = document.createElement('div');
  actionBlockedDiv.className = 'action-blocked';
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

  // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
  requestAnimationFrame(() => overlay.classList.add('show'));

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
    manager.showNotification('המשימה לא נמצאה', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup" style="max-width: 500px;">
      <button class="popup-close-btn" onclick="this.closest('.popup-overlay').remove()" aria-label="סגור">
        <i class="fas fa-times"></i>
      </button>
      <div class="popup-header">
        <i class="fas fa-clock"></i>
        הוספת זמן למשימה
      </div>
      <div class="popup-content">
        <form id="advancedTimeForm">
          <div class="form-group">
            <label for="workDate">
              תאריך העבודה
              <span class="badge-date today" id="dateBadge">
                <i class="fas fa-calendar-day"></i> היום
              </span>
            </label>
            <input type="date" id="workDate" required value="${
              new Date().toISOString().split('T')[0]
            }">
          </div>
          <div class="form-group">
            <label for="workMinutes">
              דקות עבודה
              <span class="hint-text"><i class="fas fa-lightbulb"></i> 1 שעה = 60 דקות</span>
            </label>
            <input type="number" id="workMinutes" min="1" max="99999" placeholder="60" required>
            <small class="helper-text">לדוגמה: 30, 60, 120</small>
          </div>
          <div class="form-group full-width">
            <label for="workDescriptionGuided">
              <i class="fas fa-align-right"></i> תיאור העבודה
              <span class="category-required">*</span>
            </label>
            <div id="workDescriptionGuided"></div>
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

  // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
  requestAnimationFrame(() => overlay.classList.add('show'));

  // ✅ Dynamic Date Badge - Updates based on selected date
  window.updateDateBadge = function() {
    const dateInput = document.getElementById('workDate');
    const badge = document.getElementById('dateBadge');
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

  // Add event listener for date changes
  setTimeout(() => {
    const dateInput = document.getElementById('workDate');
    if (dateInput) {
      dateInput.addEventListener('change', window.updateDateBadge);
    }

    // Auto-focus on minutes field
    const minutesInput = document.getElementById('workMinutes');
    if (minutesInput) {
      minutesInput.focus();
    }

    // ✅ NEW: Clear error state on input
    const clearErrorOnInput = (input) => {
      if (input) {
        input.addEventListener('input', () => {
          input.classList.remove('error');
          const errorMsg = input.parentElement?.querySelector('.error-message');
          if (errorMsg) {
            errorMsg.remove();
          }
        });
      }
    };

    clearErrorOnInput(dateInput);
    clearErrorOnInput(minutesInput);

    // Clear error on GuidedTextInput textarea (once, not every keystroke)
    const guidedTextarea = document.querySelector('.guided-textarea');
    if (guidedTextarea) {
      guidedTextarea.addEventListener('input', () => {
        if (guidedTextarea.classList.contains('error')) {
          guidedTextarea.classList.remove('error');
          const errorMsg = guidedTextarea.closest('.guided-input-wrapper')?.querySelector('.error-message');
          if (errorMsg) {
            errorMsg.remove();
          }
        }
      });
    }
  }, 150);

  // ✅ NEW: Initialize GuidedTextInput instead of SmartComboSelector
  setTimeout(() => {
    try {
      if (window.GuidedTextInput) {
        const tsDescLimit = (window.SYSTEM_CONFIG?.descriptionLimits?.timesheetDescription)
          || (window.SYSTEM_CONSTANTS?.DESCRIPTION_LIMITS?.TIMESHEET_DESCRIPTION)
          || 50;
        const guidedInput = new window.GuidedTextInput('workDescriptionGuided', {
          maxChars: tsDescLimit,
          placeholder: 'תאר את העבודה שביצעת היום...',
          required: true,
          showQuickSuggestions: true,
          showRecentItems: true,
          taskContext: task.description || null
        });

        // Store for cleanup and later use
        overlay.guidedInput = guidedInput;
        window._currentGuidedInput = guidedInput;

        Logger.log(`✅ GuidedTextInput initialized for task ${taskId}`);
      } else {
        Logger.log('❌ GuidedTextInput not loaded - falling back to simple input');
      }
    } catch (error) {
      Logger.log('❌ Error initializing GuidedTextInput:', error);
    }
  }, 100);
}

/**
 * 🆕 Phase 1: Dialog לעדכון תקציב משימה
 * @param {string} taskId - Task ID
 * @param {Object} manager - Manager instance
 */
function showAdjustBudgetDialog(taskId, manager) {
  const task = manager.budgetTasks.find((t) => t.id === taskId);
  if (!task) {
    manager.showNotification('המשימה לא נמצאה', 'error');
    return;
  }

  const originalEstimate = task.originalEstimate || task.estimatedMinutes;
  const currentEstimate = task.estimatedMinutes;
  const actualMinutes = task.actualMinutes || 0;
  const overageMinutes = Math.max(0, actualMinutes - originalEstimate);

  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup" style="max-width: 550px;">
      <div class="popup-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
        <i class="fas fa-edit"></i>
        עדכון תקציב משימה
      </div>
      <div class="popup-content">
        <!-- Task Info -->
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <h4 style="margin: 0 0 8px 0; color: #1f2937;">${window.safeText(task.taskDescription || task.description)}</h4>
          <div style="font-size: 13px; color: #6b7280;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <i class="fas fa-building" style="color: #3b82f6;"></i>
              <span>${window.safeText(task.clientName)}</span>
            </div>
          </div>
        </div>

        <!-- Current Status -->
        <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #fca5a5;">
          <div style="font-size: 14px; color: #991b1b; margin-bottom: 12px;">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>מצב נוכחי:</strong>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div>
              <div style="color: #6b7280; margin-bottom: 4px;">תקציב מקורי:</div>
              <div style="font-weight: 600; color: #1f2937;">${Math.round(originalEstimate / 60 * 10) / 10}h (${originalEstimate} דק')</div>
            </div>
            <div>
              <div style="color: #6b7280; margin-bottom: 4px;">עבדת בפועל:</div>
              <div style="font-weight: 600; color: #dc2626;">${Math.round(actualMinutes / 60 * 10) / 10}h (${actualMinutes} דק')</div>
            </div>
            <div>
              <div style="color: #6b7280; margin-bottom: 4px;">תקציב נוכחי:</div>
              <div style="font-weight: 600; color: #1f2937;">${Math.round(currentEstimate / 60 * 10) / 10}h (${currentEstimate} דק')</div>
            </div>
            <div>
              <div style="color: #6b7280; margin-bottom: 4px;">חריגה:</div>
              <div style="font-weight: 600; color: #dc2626;">+${Math.round(overageMinutes / 60 * 10) / 10}h (+${overageMinutes} דק')</div>
            </div>
          </div>
        </div>

        <!-- New Budget Form -->
        <form id="adjustBudgetForm">
          <div class="form-group">
            <label for="newBudgetMinutes">
              <i class="fas fa-calculator"></i>
              תקציב חדש (דקות)
            </label>
            <input
              type="number"
              id="newBudgetMinutes"
              min="${actualMinutes}"
              value="${Math.max(actualMinutes + 30, currentEstimate + 30)}"
              required
              style="font-size: 16px; padding: 12px; font-weight: 600;"
            >
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              = <span id="newBudgetHours">${Math.round((Math.max(actualMinutes + 30, currentEstimate + 30)) / 60 * 10) / 10}</span> שעות
            </div>
            <div style="font-size: 12px; color: #059669; margin-top: 8px; font-weight: 500;">
              <i class="fas fa-lightbulb"></i> מומלץ: ${Math.max(actualMinutes + 30, currentEstimate + 30)} דק' (הנוכחי + 30 דק')
            </div>
          </div>

          <div class="form-group">
            <label for="adjustReason">
              <i class="fas fa-pen"></i>
              סיבה לעדכון (אופציונלי)
            </label>
            <textarea
              id="adjustReason"
              rows="3"
              placeholder="למשל: המשימה מורכבת מהצפוי, נדרשו מסמכים נוספים..."
              style="resize: vertical;"
            ></textarea>
          </div>
        </form>

        <!-- Info Box -->
        <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px; margin-top: 15px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <i class="fas fa-info-circle" style="color: #3b82f6; margin-top: 2px;"></i>
            <div style="font-size: 12px; color: #1e40af; line-height: 1.5;">
              <strong>שים לב:</strong> התקציב המקורי יישמר למעקב. העדכון יירשם בהיסטוריה ויוצג בכרטיסייה.
            </div>
          </div>
        </div>
      </div>

      <div class="popup-buttons">
        <button
          class="popup-btn popup-btn-confirm"
          onclick="manager.submitBudgetAdjustment('${taskId}')"
          style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
          <i class="fas fa-check"></i> עדכן תקציב
        </button>
        <button
          class="popup-btn popup-btn-cancel"
          onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `;

  // Update hours display when minutes change
  const minutesInput = overlay.querySelector('#newBudgetMinutes');
  const hoursDisplay = overlay.querySelector('#newBudgetHours');

  minutesInput.addEventListener('input', () => {
    const minutes = parseInt(minutesInput.value) || 0;
    const hours = Math.round((minutes / 60) * 10) / 10;
    hoursDisplay.textContent = hours;
  });

  document.body.appendChild(overlay);

  // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
  requestAnimationFrame(() => overlay.classList.add('show'));
}

/**
 * הצגת modal סיום משימה מקצועי
 * @param {Object} task - אובייקט המשימה
 * @param {Object} manager - מופע ה-Manager
 */
function showTaskCompletionModal(task, manager) {
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.style.zIndex = '10000';

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

  let deadlineStatus = '';
  let deadlineClass = '';
  let deadlineIconClass = '';
  let deadlineColor = '';

  if (deadline) {
    const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      deadlineStatus = `איחור של ${Math.abs(daysRemaining)} ימים`;
      deadlineClass = 'deadline-late';
      deadlineIconClass = 'fa-exclamation-triangle';
      deadlineColor = '#ef4444';
    } else if (daysRemaining === 0) {
      deadlineStatus = 'בדיוק בזמן!';
      deadlineClass = 'deadline-ontime';
      deadlineIconClass = 'fa-check-circle';
      deadlineColor = '#3b82f6';
    } else {
      deadlineStatus = `${daysRemaining} ימים לפני המועד`;
      deadlineClass = 'deadline-early';
      deadlineIconClass = 'fa-flag-checkered';
      deadlineColor = '#10b981';
    }

    if (wasExtended && originalDeadline) {
      const extensionDays = Math.ceil(
        (deadline - originalDeadline) / (1000 * 60 * 60 * 24)
      );
      deadlineStatus += ` (הוארך ב-${extensionDays} ימים)`;
    }
  } else {
    deadlineStatus = 'ללא תאריך יעד';
    deadlineClass = 'deadline-none';
    deadlineIconClass = 'fa-calendar';
    deadlineColor = '#9ca3af';
  }

  // Time status
  let timeStatus = '';
  let timeClass = '';
  let timeIconClass = '';
  let timeColor = '';

  if (timeDiff < 0) {
    timeStatus = `חסכת ${Math.abs(timeDiff)} דקות!`;
    timeClass = 'time-saved';
    timeIconClass = 'fa-bolt';
    timeColor = '#10b981';
  } else if (timeDiff === 0) {
    timeStatus = 'בדיוק לפי התקציב!';
    timeClass = 'time-exact';
    timeIconClass = 'fa-check-circle';
    timeColor = '#3b82f6';
  } else {
    timeStatus = `חרגת ב-${timeDiff} דקות`;
    timeClass = 'time-over';
    timeIconClass = 'fa-clock';
    timeColor = '#ef4444';
  }

  overlay.innerHTML = `
    <div class="popup completion-modal" style="max-width: 500px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">

      <!-- Header -->
      <div class="popup-header" style="background: white; color: #0f172a; padding: 24px 32px 20px; border-bottom: 1px solid #e2e8f0; position: relative;">
        <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
          <i class="fas fa-check-circle" style="color: #3b82f6; font-size: 20px;"></i>
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">סיום משימה</h2>
        </div>
        <button
          onclick="this.closest('.popup-overlay').remove()"
          style="position: absolute; left: 20px; top: 24px; background: none; border: none; color: #64748b; font-size: 16px; cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"
          onmouseover="this.style.background='#f1f5f9'; this.style.color='#334155'"
          onmouseout="this.style.background='none'; this.style.color='#64748b'">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="popup-content" style="padding: 32px;">

        <!-- Task Info -->
        <div style="background: rgba(59, 130, 246, 0.05); padding: 16px; border-radius: 8px; border-right: 3px solid #3b82f6; margin-bottom: 24px;">
          <div style="font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">
            ${window.safeText(task.taskDescription || task.description || '')}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; color: #6b7280;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-building" style="color: #3b82f6;"></i>
              <span>${window.safeText(task.clientName || '')}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-folder" style="color: #3b82f6;"></i>
              <span>${window.safeText(task.fileNumber || task.caseNumber || '')}</span>
            </div>
            ${task.serviceName ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-briefcase" style="color: #3b82f6;"></i>
              <span>${window.safeText(task.serviceName)}</span>
            </div>
            ` : ''}
            ${task.serviceType ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-tag" style="color: #3b82f6;"></i>
              <span>${window.safeText(task.serviceType === 'hours' ? 'תוכנית שעות' : task.serviceType === 'legal_procedure' ? 'הליך משפטי' : task.serviceType === 'fixed' ? 'מחיר קבוע' : task.serviceType)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">

          <!-- Time Stat -->
          <div style="padding: 16px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e5e5;">
            <div style="font-size: 12px; color: #737373; margin-bottom: 8px; font-weight: 500;">תקציב זמן</div>
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="font-size: 20px; font-weight: 700; color: #171717;">${actualMinutes}</span><span style="font-size: 14px; color: #a3a3a3; font-weight: 400;">/${estimatedMinutes}</span><span style="font-size: 11px; color: #a3a3a3;">דקות</span>
            </div>
          </div>

          <!-- Deadline Stat -->
          <div style="padding: 16px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e5e5;">
            <div style="font-size: 12px; color: #737373; margin-bottom: 8px; font-weight: 500;">תאריך יעד</div>
            <div style="font-size: 13px; font-weight: 600; color: #171717; margin-bottom: 4px;">
              ${deadline ? window.formatDate(deadline) : 'לא הוגדר'}
            </div>
            ${deadline ? `<div style="font-size: 11px; color: #a3a3a3;">נוצר: ${window.formatDate(createdAt)}</div>` : ''}
          </div>
        </div>

        <!-- Status Messages -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="padding: 10px 12px; background: ${timeColor}08; border-radius: 6px; border: 1px solid ${timeColor}20;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas ${timeIconClass}" style="color: ${timeColor}; font-size: 13px;"></i>
              <span style="font-size: 13px; font-weight: 500; color: #374151;">${timeStatus}</span>
            </div>
          </div>
          ${deadline ? `
          <div style="padding: 10px 12px; background: ${deadlineColor}08; border-radius: 6px; border: 1px solid ${deadlineColor}20;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas ${deadlineIconClass}" style="color: ${deadlineColor}; font-size: 13px;"></i>
              <span style="font-size: 13px; font-weight: 500; color: #374151;">${deadlineStatus}</span>
            </div>
          </div>
          ` : ''}
        </div>

        <!-- Notes Field -->
        <div>
          <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #374151;">
            הערות סיום (אופציונלי)
          </label>
          <textarea
            id="completionNotes"
            rows="3"
            placeholder="תאר את התוצאות או לקחים..."
            style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.2s; background: white;"
            onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'; this.style.outline='none'"
            onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
          ></textarea>
        </div>

      </div>

      <!-- Footer - Clean Buttons -->
      <div style="padding: 20px 32px 32px 32px; display: flex; gap: 12px;">
        <button
          class="popup-btn popup-btn-cancel"
          onclick="this.closest('.popup-overlay').remove()"
          style="padding: 12px 24px; background: white; color: #6b7280; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;"
          onmouseover="this.style.background='#f9fafb'; this.style.borderColor='#9ca3af'"
          onmouseout="this.style.background='white'; this.style.borderColor='#d1d5db'">
          ביטול
        </button>
        <button
          class="popup-btn popup-btn-confirm"
          id="confirmCompleteBtn"
          onclick="manager.submitTaskCompletion('${task.id}')"
          style="flex: 1; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
          onmouseover="this.style.background='#2563eb'"
          onmouseout="this.style.background='#3b82f6'">
          <i class="fas fa-check" style="margin-left: 8px;"></i> אישור
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
  requestAnimationFrame(() => overlay.classList.add('show'));
}

/**
 * ========================================
 * Form Management
 * ========================================
 */

/**
 * פתיחה/סגירה של טופס חכם (Smart Form)
 * מחליף בין טופס תקציב לשעתון לפי הטאב הפעיל
 *
 * ✅ v2.0: תמיכה במערכת המאורגנת החדשה עם fallback לישן
 */
function openSmartForm() {
  const plusButton = document.getElementById('smartPlusBtn');
  const activeTab = document.querySelector('.tab-button.active');
  if (!activeTab) {
    return;
  }

  // ✅ NEW v2.0: אם זה טאב תקציב, נסה את המערכת החדשה תחילה
  if (activeTab.onclick && activeTab.onclick.toString().includes('budget')) {
    // ✅ נסה את המערכת החדשה המאורגנת
    if (window.AddTaskSystem && window.AddTaskSystem.show) {
      try {
        window.AddTaskSystem.show();
        console.log('✅ Using new Add Task System v2.0');
        return; // הצלחנו - לא צריך את הקוד הישן
      } catch (error) {
        console.warn('⚠️ New system failed, falling back to old:', error);
        // נמשיך לקוד הישן למטה
      }
    }

    // ⚠️ FALLBACK: אם המערכת החדשה לא זמינה - חזור לישן
    console.log('ℹ️ Using legacy budget form (fallback)');
    const currentForm = document.getElementById('budgetFormContainer');
    if (currentForm) {
      if (currentForm.classList.contains('hidden')) {
        currentForm.classList.remove('hidden');
        if (plusButton) {
plusButton.classList.add('active');
}
      } else {
        currentForm.classList.add('hidden');
        if (plusButton) {
plusButton.classList.remove('active');
}
      }
    }
    return;
  }

  // ✅ Timesheet - הקוד הישן נשאר בדיוק כמו שהיא
  if (activeTab.onclick && activeTab.onclick.toString().includes('timesheet')) {
    const currentForm = document.getElementById('timesheetFormContainer');
    if (currentForm) {
      if (currentForm.classList.contains('hidden')) {
        currentForm.classList.remove('hidden');
        if (plusButton) {
plusButton.classList.add('active');
}
      } else {
        currentForm.classList.add('hidden');
        if (plusButton) {
plusButton.classList.remove('active');
}
      }
    }
  }
}

/**
 * ========================================
 * Module Exports
 * ========================================
 */

// Export to global scope for backward compatibility
if (typeof window !== 'undefined') {
  window.DialogsModule = {
    // ✅ Loading functions removed - use NotificationSystem.showLoading() instead
    showBlockedClientDialog,
    showAdvancedTimeDialog,
    showAdjustBudgetDialog,  // 🆕 Phase 1
    showTaskCompletionModal,
    // ✅ Client form functions removed
    openSmartForm
  };
}

// Legacy global functions (for backward compatibility)
// ✅ showSimpleLoading, hideSimpleLoading removed - handled by backward compatibility wrapper in index.html
// ✅ showClientForm, openClientForm, hideClientForm removed
window.openSmartForm = openSmartForm;
