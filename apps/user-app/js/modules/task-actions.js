/**
 * Task Actions Module - מודול פעולות על משימות
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 10/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - ניהול כפתורי פעולות על משימות (הוספת זמן, הארכת יעד, סיום, היסטוריה)
 * - הסתרת כפתורים לא רלוונטיים במשימות שהושלמו
 * - תמיכה בתצוגת טבלה וכרטיסיות
 * - אינטגרציה מלאה עם ActivityLogger
 */

(function() {
  'use strict';

  /**
   * מחלקת TaskActionsManager - מנהלת כפתורי פעולות על משימות
   */
  class TaskActionsManager {
    constructor() {
      this.manager = null; // Reference to main manager
    }

    /**
     * הגדרת ה-manager הראשי
     * @param {Object} manager
     */
    setManager(manager) {
      this.manager = manager;
    }

    /**
     * יצירת כפתורי פעולות לתצוגת טבלה
     * @param {Object} task - המשימה
     * @param {boolean} isCompleted - האם המשימה הושלמה
     * @returns {string} HTML של כפתורי הפעולות
     */
    createTableActionButtons(task, isCompleted) {
      const taskId = task.id;

      // Lucide icons — Claude.ai-style outlined strokes, 1.5-1.75px weight.
      // <i data-lucide="..."> placeholders are hydrated into <svg> by
      // lucide.createIcons() after the row is inserted into the DOM.
      if (isCompleted) {
        return `
          <button class="action-btn history-btn" onclick="manager.showTaskHistory('${taskId}')" title="היסטוריה" aria-label="היסטוריה">
            <i data-lucide="rotate-ccw"></i>
          </button>
        `;
      }

      const canCancel = Number(task.actualMinutes || 0) === 0;
      const originalEstimate = task.originalEstimate || task.estimatedMinutes || 0;
      const actualMinutes = Number(task.actualMinutes || 0);
      const isOverBudget = actualMinutes > originalEstimate;

      return `
        <button class="action-btn time-btn" onclick="manager.showAdvancedTimeDialog('${taskId}')" title="הוסף זמן" aria-label="הוסף זמן">
          <i data-lucide="clock"></i>
        </button>
        ${isOverBudget ? `
        <button class="action-btn budget-btn" onclick="manager.showAdjustBudgetDialog('${taskId}')" title="עדכן תקציב" aria-label="עדכן תקציב">
          <i data-lucide="pencil"></i>
        </button>
        ` : ''}
        <button class="action-btn extend-btn" onclick="manager.showExtendDeadlineDialog('${taskId}')" title="האריך יעד" aria-label="האריך יעד">
          <i data-lucide="calendar-plus"></i>
        </button>
        <button class="action-btn history-btn" onclick="manager.showTaskHistory('${taskId}')" title="היסטוריה" aria-label="היסטוריה">
          <i data-lucide="rotate-ccw"></i>
        </button>
        ${canCancel ? `
        <button class="action-btn cancel-btn" onclick="manager.showCancelTaskDialog('${taskId}')" title="בטל משימה" aria-label="בטל משימה">
          <i data-lucide="ban"></i>
        </button>
        ` : ''}
        <button class="action-btn complete-btn" onclick="manager.completeTask('${taskId}')" title="סיים משימה" aria-label="סיים משימה">
          <i data-lucide="check"></i>
        </button>
      `;
    }

    /**
     * יצירת כפתורי פעולות לתצוגת כרטיסיות
     * @param {Object} task - המשימה
     * @param {boolean} isCompleted - האם המשימה הושלמה
     * @returns {string} HTML של כפתורי הפעולות
     */
    createCardActionButtons(task, isCompleted) {
      const taskId = task.id;

      // אם המשימה הושלמה - רק כפתור היסטוריה
      if (isCompleted) {
        return `
          <div class="linear-actions" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <button class="linear-action-btn info" onclick="manager.showTaskHistory('${taskId}')" style="margin: 0;">
              <i class="fas fa-history"></i> היסטוריה
            </button>
            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #10b981; color: white; border-radius: 6px; font-weight: 500; font-size: 13px; white-space: nowrap;">
              <i class="fas fa-check-circle"></i> משימה הושלמה
            </span>
          </div>
        `;
      }

      // 🆕 Phase 1: בדיקה אם יש חריגה
      const originalEstimate = task.originalEstimate || task.estimatedMinutes || 0;
      const actualMinutes = Number(task.actualMinutes || 0);
      const isOverBudget = actualMinutes > originalEstimate;
      const canCancel = actualMinutes === 0;

      // משימה פעילה - כל הכפתורים + עדכן תקציב אם יש חריגה
      return `
        <div class="linear-actions">
          <button class="linear-action-btn primary" onclick="manager.showAdvancedTimeDialog('${taskId}')">
            <i class="fas fa-clock"></i> הוסף זמן
          </button>
          <button class="linear-action-btn info" onclick="manager.showTaskHistory('${taskId}')">
            <i class="fas fa-history"></i> היסטוריה
          </button>
          ${isOverBudget ? `
          <button class="linear-action-btn budget-adjust" onclick="manager.showAdjustBudgetDialog('${taskId}')">
            <i class="fas fa-edit"></i> עדכן תקציב
          </button>
          ` : ''}
          <button class="linear-action-btn warning" onclick="manager.showExtendDeadlineDialog('${taskId}')">
            <i class="fas fa-calendar-plus"></i> האריך יעד
          </button>
          ${canCancel ? `
          <button class="linear-action-btn danger" onclick="manager.showCancelTaskDialog('${taskId}')">
            <i class="fas fa-ban"></i> בטל משימה
          </button>
          ` : ''}
          <button class="linear-action-btn success" onclick="manager.completeTask('${taskId}')">
            <i class="fas fa-check"></i> סיים משימה
          </button>
        </div>
      `;
    }

    /**
     * יצירת כפתורי פעולות לתצוגת רשימה (Phase 2a).
     * כפתורי אייקון קומפקטיים, ללא טקסט — מכוסים ב-tooltip native.
     * כוללים רק פעולות primary; "סיים משימה" יופיע ב-expand panel (Phase 2b).
     *
     * @param {Object} task - המשימה
     * @param {boolean} isCompleted - האם המשימה הושלמה
     * @returns {string} HTML של כפתורי הפעולות (wrapped in .list-row-actions)
     */
    createListActionButtons(task, isCompleted) {
      const taskId = task.id;

      // משימה שהושלמה — רק היסטוריה
      if (isCompleted) {
        return `
          <div class="list-row-actions" role="toolbar" aria-label="פעולות משימה">
            <button
              type="button"
              class="list-row-action"
              onclick="event.stopPropagation(); manager.showTaskHistory('${taskId}')"
              aria-label="היסטוריה"
              title="היסטוריה"
            >
              <i class="fas fa-history" aria-hidden="true"></i>
            </button>
          </div>
        `;
      }

      // Conditional flags (logic matches table/cards views exactly)
      const originalEstimate = task.originalEstimate || task.estimatedMinutes || 0;
      const actualMinutes = Number(task.actualMinutes || 0);
      const isOverBudget = actualMinutes > originalEstimate;
      const canCancel = actualMinutes === 0;

      // Primary actions: זמן · הארכה · היסטוריה
      // Conditional: ✏️ תקציב (אם חריגה), ❌ בטל (אם 0 שעות)
      const budgetBtn = isOverBudget ? `
        <button
          type="button"
          class="list-row-action list-row-action--budget"
          onclick="event.stopPropagation(); manager.showAdjustBudgetDialog('${taskId}')"
          aria-label="עדכן תקציב"
          title="עדכן תקציב"
        >
          <i class="fas fa-edit" aria-hidden="true"></i>
        </button>
      ` : '';

      const cancelBtn = canCancel ? `
        <button
          type="button"
          class="list-row-action list-row-action--danger"
          onclick="event.stopPropagation(); manager.showCancelTaskDialog('${taskId}')"
          aria-label="בטל משימה"
          title="בטל משימה"
        >
          <i class="fas fa-ban" aria-hidden="true"></i>
        </button>
      ` : '';

      return `
        <div class="list-row-actions" role="toolbar" aria-label="פעולות משימה">
          <button
            type="button"
            class="list-row-action list-row-action--primary"
            onclick="event.stopPropagation(); manager.showAdvancedTimeDialog('${taskId}')"
            aria-label="הוסף זמן"
            title="הוסף זמן"
          >
            <i class="fas fa-clock" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="list-row-action"
            onclick="event.stopPropagation(); manager.showExtendDeadlineDialog('${taskId}')"
            aria-label="האריך יעד"
            title="האריך יעד"
          >
            <i class="fas fa-calendar-plus" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="list-row-action"
            onclick="event.stopPropagation(); manager.showTaskHistory('${taskId}')"
            aria-label="היסטוריה"
            title="היסטוריה"
          >
            <i class="fas fa-history" aria-hidden="true"></i>
          </button>
          ${budgetBtn}
          ${cancelBtn}
        </div>
      `;
    }

    /**
     * בדיקה האם כפתור מסוים זמין למשימה
     * @param {string} actionType - סוג הפעולה (time/extend/complete/history)
     * @param {Object} task - המשימה
     * @returns {boolean}
     */
    isActionAvailable(actionType, task) {
      const isActive = task.status === 'פעיל';

      switch (actionType) {
        case 'time':
          return isActive; // הוספת זמן רק למשימות פעילות

        case 'extend':
          return isActive; // הארכת יעד רק למשימות פעילות

        case 'complete':
          return isActive; // סיום משימה רק למשימות פעילות

        case 'cancel':
          return isActive && (Number(task.actualMinutes || 0) === 0); // ביטול רק למשימות פעילות ללא זמן

        case 'history':
          return true; // היסטוריה תמיד זמינה

        default:
          return false;
      }
    }

    /**
     * יצירת סטטוס ויזואלי למשימה מושלמת
     * @param {Object} task - המשימה
     * @returns {string} HTML של הסטטוס
     */
    createCompletedStatusBadge(task) {
      if (task.status !== 'הושלם') {
        return '';
      }

      const completedAt = task.completedAt ? new Date(task.completedAt).toLocaleDateString('he-IL') : 'לא ידוע';
      const completedBy = task.completedBy || 'לא ידוע';

      return `
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #10b981; color: white; border-radius: 6px; font-size: 12px; font-weight: 500;">
          <i class="fas fa-check-circle"></i>
          <span>הושלם ב-${completedAt}</span>
        </div>
      `;
    }

    /**
     * בדיקה האם ניתן לבצע פעולה על משימה
     * @param {string} actionType - סוג הפעולה
     * @param {Object} task - המשימה
     * @returns {Object} {allowed: boolean, reason: string}
     */
    canPerformAction(actionType, task) {
      const isCompleted = task.status === 'הושלם';

      if (isCompleted && actionType !== 'history') {
        return {
          allowed: false,
          reason: `לא ניתן לבצע פעולה "${actionType}" על משימה שכבר הושלמה. משימה זו הושלמה ב-${task.completedAt ? new Date(task.completedAt).toLocaleDateString('he-IL') : 'תאריך לא ידוע'}.`
        };
      }

      return {
        allowed: true,
        reason: ''
      };
    }

    /**
     * הוספת אינדיקטור ויזואלי למשימה מושלמת בטבלה
     * @param {Object} task - המשימה
     * @returns {string} HTML של האינדיקטור
     */
    createCompletedIndicatorForTable(task) {
      if (task.status !== 'הושלם') {
        return '';
      }

      return `
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #10b981; border-radius: 50%; margin-left: 8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;
    }

    /**
     * יצירת טקסט הסבר למשימה מושלמת
     * @param {Object} task - המשימה
     * @returns {string} טקסט ההסבר
     */
    getCompletedTaskTooltip(task) {
      if (task.status !== 'הושלם') {
        return '';
      }

      const completedAt = task.completedAt ? new Date(task.completedAt).toLocaleDateString('he-IL') : 'תאריך לא ידוע';
      const completedBy = task.completedBy || 'לא ידוע';
      const notes = task.completionNotes || 'אין הערות';

      return `משימה הושלמה ב-${completedAt} על ידי ${completedBy}. הערות: ${notes}`;
    }
  }

  // חשיפה כ-module גלובלי
  window.TaskActionsModule = {
    TaskActionsManager,

    /**
     * יצירת instance חדש
     * @returns {TaskActionsManager}
     */
    create() {
      return new TaskActionsManager();
    }
  };


})();
