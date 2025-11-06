/**
 * Budget Tasks Module
 * מודול לניהול משימות תקציב - רינדור, מיון, סינון ולידציה
 *
 * @module BudgetTasksModule
 * @version 1.0.0
 * @created 2025-01-15
 */

/* ===========================
   IMPORTS
   =========================== */

import {
  createCaseNumberBadge,
  createServiceBadge,
  createCombinedInfoBadge,
  createStatusBadge
} from './timesheet-constants.js';

import DescriptionTooltips from './description-tooltips.js';

/* ===========================
   FIREBASE OPERATIONS
   =========================== */

/**
 * Load budget tasks from Firebase for a specific employee
 * @param {string} employee - Employee name
 * @returns {Promise<Array>} Array of budget tasks
 */
export async function loadBudgetTasksFromFirebase(employee) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error('Firebase לא מחובר');
    }

    const snapshot = await db
      .collection('budget_tasks')
      .where('employee', '==', employee)
      .limit(50) // ✅ Safety net - prevents loading all tasks
      .get();

    const tasks = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // ⚡ CRITICAL: Convert Firebase Timestamps to JavaScript Date objects
      const taskWithFirebaseId = {
        ...data,
        firebaseDocId: doc.id, // ✅ Always save Firebase document ID
        // Convert Timestamps and strings to Date objects for proper formatting
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : data.updatedAt),
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : data.completedAt),
        deadline: data.deadline?.toDate ? data.deadline.toDate() : (data.deadline ? new Date(data.deadline) : data.deadline)
      };

      // Only set 'id' if it doesn't exist in the data
      if (!taskWithFirebaseId.id) {
        taskWithFirebaseId.id = doc.id;
      }

      tasks.push(taskWithFirebaseId);
    });

    return tasks;
  } catch (error) {
    console.error('Firebase error:', error);
    throw new Error('שגיאה בטעינת משימות: ' + error.message);
  }
}

/**
 * Save budget task to Firebase
 * @param {Object} taskData - Task data to save
 * @returns {Promise<string>} Task ID
 */
export async function saveBudgetTaskToFirebase(taskData) {
  try {
    // Call Firebase Function for secure validation and creation
    const result = await window.callFunction('createBudgetTask', taskData);

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בשמירת משימה');
    }

    return result.taskId;
  } catch (error) {
    console.error('Firebase error:', error);
    throw error;
  }
}

/**
 * Start real-time tasks listener (NEW - Recommended)
 * התחלת מאזין משימות בזמן אמת
 *
 * @param {string} employee - Employee email
 * @param {Function} onUpdate - Callback when tasks update (tasks) => {}
 * @param {Function} onError - Callback on error (error) => {}
 * @returns {Function} Unsubscribe function
 */
export function startRealTimeTasks(employee, onUpdate, onError) {
  // Dynamic import to avoid circular dependencies
  import('./real-time-listeners.js').then(({ startTasksListener }) => {
    return startTasksListener(employee, onUpdate, onError);
  }).catch((error) => {
    console.error('❌ Error importing real-time-listeners:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Update budget task (NEW - for admin/manager use)
 * עדכון משימה (לשימוש מנהל)
 *
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result with changes
 */
export async function updateBudgetTask(taskId, updates) {
  try {
    if (!window.callFunction) {
      throw new Error('callFunction לא זמין');
    }

    const result = await window.callFunction('updateBudgetTask', {
      taskId,
      updates
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בעדכון משימה');
    }

    console.log(`✅ Task ${taskId} updated:`, result.changes);

    return result;
  } catch (error) {
    console.error('❌ Error updating task:', error);
    throw error;
  }
}

/* ===========================
   VALIDATION
   =========================== */

/**
 * Validate budget task form
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateBudgetTaskForm() {
  const errors = [];

  const description = document
    .getElementById('budgetDescription')
    ?.value?.trim();
  if (!description || description.length < 3) {
    errors.push('תיאור המשימה חייב להכיל לפחות 3 תווים');
  }

  const caseSelect = document.getElementById('budgetCaseSelect')?.value;
  if (!caseSelect) {
    errors.push('חובה לבחור תיק');
  }

  // ✅ בדיקת סניף מטפל
  const branch = document.getElementById('budgetBranch')?.value;
  if (!branch) {
    errors.push('חובה לבחור סניף מטפל');
  }

  // ✅ בדיקה אם יש dropdown שירותים (במקרה של מספר שירותים)
  const serviceSelectElement = document.getElementById('budgetServiceSelect');
  if (serviceSelectElement && serviceSelectElement.type === 'select-one') {
    // יש dropdown - בדיקה שנבחר שירות
    const serviceValue = serviceSelectElement.value;
    if (!serviceValue) {
      errors.push('חובה לבחור שירות מהרשימה');
    }
  }

  const estimatedTime = document.getElementById('estimatedTime')?.value;
  if (!estimatedTime || parseInt(estimatedTime) <= 0) {
    errors.push('זמן משוער חייב להיות גדול מ-0');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/* ===========================
   FILTERING & SORTING
   =========================== */

/**
 * Filter budget tasks based on selected filter value
 * @param {Array} budgetTasks - All budget tasks
 * @param {string} filterValue - Filter value (active, completed, all)
 * @returns {Array} Filtered tasks
 */
export function filterBudgetTasks(budgetTasks, filterValue) {
  if (!filterValue || filterValue === 'active') {
    // Default: show only active tasks
    return budgetTasks.filter(t => t.status !== 'הושלם');
  } else if (filterValue === 'completed') {
    // Show completed tasks (last month)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return budgetTasks.filter(t => {
      if (t.status !== 'הושלם') {
return false;
}
      if (!t.completedAt) {
return true;
}
      const completedDate = new Date(t.completedAt);
      return completedDate >= oneMonthAgo;
    });
  } else if (filterValue === 'all') {
    // Show all tasks
    return [...budgetTasks];
  } else {
    // Fallback: active tasks
    return budgetTasks.filter(t => t.status !== 'הושלם');
  }
}

/**
 * Sort budget tasks based on sort value
 * @param {Array} tasks - Tasks to sort
 * @param {string} sortValue - Sort value (recent, name, deadline, progress)
 * @returns {Array} Sorted tasks
 */
export function sortBudgetTasks(tasks, sortValue) {
  const sortedTasks = [...tasks];

  sortedTasks.sort((a, b) => {
    switch (sortValue) {
      case 'recent':
        // Sort by last updated - newest first
        const dateA = new Date(a.lastUpdated || a.createdAt || 0).getTime();
        const dateB = new Date(b.lastUpdated || b.createdAt || 0).getTime();
        return dateB - dateA;

      case 'name':
        // Sort by client name - Hebrew A-Z
        const nameA = (a.clientName || '').trim();
        const nameB = (b.clientName || '').trim();
        if (!nameA && !nameB) {
return 0;
}
        if (!nameA) {
return 1;
}
        if (!nameB) {
return -1;
}
        return nameA.localeCompare(nameB, 'he');

      case 'deadline':
        // Sort by deadline - closest first
        const deadlineA = new Date(a.deadline || '9999-12-31').getTime();
        const deadlineB = new Date(b.deadline || '9999-12-31').getTime();
        return deadlineA - deadlineB;

      case 'progress':
        // Sort by progress - highest first
        const progressA = a.estimatedMinutes > 0 ? (a.actualMinutes / a.estimatedMinutes) * 100 : 0;
        const progressB = b.estimatedMinutes > 0 ? (b.actualMinutes / b.estimatedMinutes) * 100 : 0;
        return progressB - progressA;

      default:
        return 0;
    }
  });

  return sortedTasks;
}

/* ===========================
   HELPER FUNCTIONS
   =========================== */

/**
 * Sanitize task data with defaults
 * @param {Object} task - Task data
 * @returns {Object} Sanitized task
 */
export function sanitizeTaskData(task) {
  if (!task) {
return {};
}

  // ✅ המרת Firebase Timestamp לDate נכון
  let deadlineConverted = task.deadline;
  if (task.deadline && window.DatesModule) {
    deadlineConverted = window.DatesModule.convertFirebaseTimestamp(task.deadline);
  }
  if (!deadlineConverted || (deadlineConverted instanceof Date && isNaN(deadlineConverted.getTime()))) {
    deadlineConverted = new Date();
  }

  return {
    id: task.id || Date.now(),
    clientName: task.clientName || 'לקוח לא ידוע',
    description:
      task.taskDescription || task.description || 'משימה ללא תיאור',
    taskDescription:
      task.taskDescription || task.description || 'משימה ללא תיאור',
    // ✅ תמיכה הן ב-Hours והן ב-Minutes
    estimatedHours: Number(task.estimatedHours) || 0,
    actualHours: Number(task.actualHours) || 0,
    estimatedMinutes: Number(task.estimatedMinutes) || (Number(task.estimatedHours) || 0) * 60,
    actualMinutes: Number(task.actualMinutes) || (Number(task.actualHours) || 0) * 60,
    deadline: deadlineConverted,
    status: task.status || 'פעיל',
    branch: task.branch || '',
    fileNumber: task.fileNumber || '',
    history: task.history || [],
    createdAt: task.createdAt || null,
    updatedAt: task.updatedAt || null,
    caseId: task.caseId || null,
    caseTitle: task.caseTitle || null,
    caseNumber: task.caseNumber || null,
    serviceName: task.serviceName || null,
    serviceType: task.serviceType || null,
    parentServiceId: task.parentServiceId || null
  };
}

/**
 * Calculate simple progress percentage
 * @param {Object} task - Task data
 * @returns {number} Progress percentage (0-100)
 */
export function calculateSimpleProgress(task) {
  if (!task.estimatedMinutes || task.estimatedMinutes <= 0) {
    // Keep warning for missing data (only logged once per task)
    if (!task._warnedNoEstimate) {
      console.warn('⚠️ Task missing estimatedMinutes:', task.id);
      task._warnedNoEstimate = true;
    }
    return 0;
  }
  const progress = Math.round(
    ((task.actualMinutes || 0) / task.estimatedMinutes) * 100
  );
  return progress; // ✅ No 100% cap - allows 150%+ for overage visibility
}

/**
 * Get progress status text in Hebrew
 * @param {number} progress - Progress percentage
 * @returns {string} Status text
 */
export function getProgressStatusText(progress) {
  if (progress >= 100) {
return 'הושלם';
}
  if (progress >= 90) {
return 'כמעט סיימת';
}
  if (progress >= 75) {
return 'קרוב לסיום';
}
  if (progress >= 50) {
return 'באמצע הדרך';
}
  if (progress >= 25) {
return 'התחלנו';
}
  if (progress > 0) {
return 'בתחילת הדרך';
}
  return 'לא התחיל';
}

/**
 * Get active tasks count
 * @param {Array} budgetTasks - All budget tasks
 * @returns {number} Count of active tasks
 */
export function getActiveTasksCount(budgetTasks) {
  return (budgetTasks || []).filter(
    (task) => task && task.status !== 'הושלם'
  ).length;
}

/**
 * Get completed tasks count
 * @param {Array} budgetTasks - All budget tasks
 * @returns {number} Count of completed tasks
 */
export function getCompletedTasksCount(budgetTasks) {
  return (budgetTasks || []).filter(
    (task) => task && task.status === 'הושלם'
  ).length;
}

/**
 * Render SVG Rings Section
 * @param {Object} task - Task object
 * @param {number} progress - Progress percentage
 * @param {number} actualHours - Actual hours worked
 * @param {number} estimatedHours - Estimated hours
 * @param {number} originalEstimate - Original estimate (minutes)
 * @param {boolean} wasAdjusted - Was budget adjusted
 * @param {boolean} isOverOriginal - Is over original estimate
 * @param {number} overageMinutes - Overage in minutes
 * @param {number} daysUntilDeadline - Days until deadline
 * @returns {string} SVG Rings HTML
 */
function renderSVGRingsSection(task, progress, actualHours, estimatedHours, originalEstimate, wasAdjusted, isOverOriginal, overageMinutes, daysUntilDeadline) {
  if (!window.SVGRings) {
return '';
}

  const now = new Date();
  const deadline = new Date(task.deadline);
  const createdAt = task.createdAt ? new Date(task.createdAt) : now;
  const totalDays = Math.max(1, (deadline - createdAt) / (1000 * 60 * 60 * 24));
  const elapsedDays = (now - createdAt) / (1000 * 60 * 60 * 24);
  const deadlineProgress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  const isDeadlineOverdue = daysUntilDeadline < 0;
  const overdueDays = Math.abs(Math.min(0, daysUntilDeadline));

  // Budget Ring Config
  const budgetRingConfig = {
    progress, // ✅ No 100% cap - shows 150%+ for overage
    color: isOverOriginal ? 'red' : progress >= 85 ? 'orange' : 'green',
    icon: 'fas fa-clock',
    label: 'תקציב זמן',
    value: `${actualHours}ש / ${estimatedHours}ש`,
    size: 80,
    button: isOverOriginal ? { // ✅ Removed !wasAdjusted - allows repeated budget updates
      text: wasAdjusted ? 'עדכן שוב' : 'עדכן תקציב',
      onclick: `event.stopPropagation(); manager.showAdjustBudgetDialog('${task.id}')`,
      icon: 'fas fa-edit',
      cssClass: 'budget-btn',
      show: true
    } : null
  };

  // Deadline Ring Config
  const wasExtended = task.deadlineExtensions && task.deadlineExtensions.length > 0;
  const deadlineRingConfig = {
    progress: deadlineProgress,
    color: isDeadlineOverdue ? 'red' : deadlineProgress >= 85 ? 'orange' : 'blue',
    icon: 'fas fa-calendar-alt',
    label: 'תאריך יעד',
    value: isDeadlineOverdue
      ? `איחור ${overdueDays} ${overdueDays === 1 ? 'יום' : 'ימים'}`
      : `${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'יום' : 'ימים'} נותרו`,
    size: 80,
    button: isDeadlineOverdue ? { // ✅ Always shows when overdue - allows repeated extensions
      text: wasExtended ? 'הארך שוב' : 'הארך יעד',
      onclick: `event.stopPropagation(); manager.showExtendDeadlineDialog('${task.id}')`,
      icon: 'fas fa-calendar-plus',
      cssClass: 'deadline-btn',
      show: true
    } : null
  };

  let ringsHTML = window.SVGRings.createDualRings(budgetRingConfig, deadlineRingConfig);

  // Add info note if budget was adjusted
  if (wasAdjusted) {
    ringsHTML += `<div class="budget-adjusted-note" style="text-align: center; margin-top: 12px; font-size: 11px; color: #3b82f6;"><i class="fas fa-info-circle"></i> תקציב עודכן ל-${estimatedHours}ש</div>`;
  }

  return ringsHTML;
}

/* ===========================
   RENDER FUNCTIONS
   =========================== */

/**
 * Create task card HTML
 * @param {Object} task - Task data
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function createTaskCard(task, options = {}) {
  const { safeText, formatDate, formatShort } = options;

  const safeTask = sanitizeTaskData(task);
  const progress = calculateSimpleProgress(safeTask);
  const progressClass =
    progress >= 100
      ? 'progress-complete'
      : progress >= 85
      ? 'progress-high'
      : progress >= 50
      ? 'progress-medium'
      : 'progress-low';
  const progressStatus = getProgressStatusText(progress);

  // 🆕 Phase 1: חישוב התקדמות מול תקציב מקורי
  const originalEstimate = safeTask.originalEstimate || safeTask.estimatedMinutes;
  const wasAdjusted = safeTask.estimatedMinutes !== originalEstimate;
  const isOverOriginal = safeTask.actualMinutes > originalEstimate;
  const overageMinutes = Math.max(0, safeTask.actualMinutes - originalEstimate);
  const overagePercent = originalEstimate > 0 ? Math.round((overageMinutes / originalEstimate) * 100) : 0;

  const now = new Date();
  const deadline = new Date(safeTask.deadline);
  const daysUntilDeadline = Math.ceil(
    (deadline - now) / (1000 * 60 * 60 * 24)
  );

  let deadlineClass = '';
  let deadlineIcon = '<i class="fas fa-calendar-alt"></i>';
  if (daysUntilDeadline < 0) {
    deadlineClass = 'overdue';
    deadlineIcon = '<i class="fas fa-exclamation-triangle"></i>';
  } else if (daysUntilDeadline <= 1) {
    deadlineClass = 'urgent';
    deadlineIcon = '<i class="fas fa-exclamation-circle"></i>';
  } else if (daysUntilDeadline <= 3) {
    deadlineClass = 'soon';
    deadlineIcon = '<i class="fas fa-clock"></i>';
  }

  const actualHours = Math.round((safeTask.actualMinutes / 60) * 10) / 10;
  const estimatedHours =
    Math.round((safeTask.estimatedMinutes / 60) * 10) / 10;

  const safeDescription = safeText ? safeText(safeTask.description) : safeTask.description;
  const safeClientName = safeText ? safeText(safeTask.clientName) : safeTask.clientName;
  const clientDisplayName =
    safeTask.clientName.length > 20
      ? (safeText ? safeText(safeTask.clientName.substring(0, 20) + '...') : safeTask.clientName.substring(0, 20) + '...')
      : safeClientName;

  // Check if task is completed
  const isCompleted = safeTask.status === 'הושלם';
  const completedIndicator = isCompleted ? `
    <span class="completed-badge">
      <i class="fas fa-check-circle"></i>
    </span>
  ` : '';

  // 🎯 Combined info badge (case + service)
  const combinedBadge = createCombinedInfoBadge(
    safeTask.caseNumber,
    safeTask.serviceName,
    safeTask.serviceType
  );

  const badgesRow = combinedBadge ? `
    <div class="linear-card-badges">
      ${combinedBadge}
    </div>
  ` : '';

  return `
    <div class="linear-minimal-card" data-task-id="${safeTask.id}">
      ${badgesRow}
      <div class="linear-card-content">
        <h3 class="linear-card-title" title="${safeClientName}">
          ${safeDescription}
          ${completedIndicator}
        </h3>

        <!-- 🎯 SVG RINGS -->
        ${!isCompleted && window.SVGRings ? renderSVGRingsSection(safeTask, progress, actualHours, estimatedHours, originalEstimate, wasAdjusted, isOverOriginal, overageMinutes, daysUntilDeadline) : ''}
      </div>

      <!-- החלק התחתון - מחוץ ל-content -->
      <div class="linear-card-meta">
        <div class="linear-client-row">
          <span class="linear-client-label">לקוח:</span>
          <span class="linear-client-name" title="${safeClientName}">
            ${clientDisplayName}
          </span>
        </div>
        ${safeTask.createdAt ? `
        <div class="creation-date-tag">
          <i class="far fa-clock"></i>
          <span>נוצר ב-${formatDate(safeTask.createdAt)} ${new Date(safeTask.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ` : ''}
      </div>

      <button class="linear-expand-btn" onclick="manager.expandTaskCard('${
        safeTask.id
      }', event)" title="הרחב פרטים">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
}

/**
 * Create table row HTML
 * @param {Object} task - Task data
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function createTableRow(task, options = {}) {
  const { safeText, formatDate, taskActionsManager } = options;

  const safeTask = sanitizeTaskData(task);
  const progress = calculateSimpleProgress(safeTask);

  // Status badge with professional styling
  const isCompleted = safeTask.status === 'הושלם';
  const statusDisplay = createStatusBadge(safeTask.status);

  // 🎯 Combined info badge for table view (same as card view)
  const combinedBadge = createCombinedInfoBadge(
    safeTask.caseNumber,
    safeTask.serviceName,
    safeTask.serviceType
  );

  // 🎨 Create progress bar for time progress column
  const progressBarHtml = window.SVGRings ? window.SVGRings.createTableProgressBar({
    progress: progress,
    actualMinutes: safeTask.actualMinutes || 0,
    estimatedMinutes: safeTask.estimatedMinutes || 1
  }) : `${progress}%`;

  // 🎨 Create compact deadline ring for deadline column
  let deadlineHtml;
  if (window.SVGRings) {
    const now = new Date();
    const deadline = new Date(safeTask.deadline);
    const createdAt = safeTask.createdAt ? new Date(safeTask.createdAt) : now;

    // Calculate days remaining
    const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    // Calculate deadline progress (elapsed time / total time)
    const totalDays = Math.max(1, (deadline - createdAt) / (1000 * 60 * 60 * 24));
    const elapsedDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    const deadlineProgress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

    deadlineHtml = window.SVGRings.createCompactDeadlineRing({
      daysRemaining: daysUntilDeadline,
      progress: deadlineProgress,
      size: 52
    });
  } else {
    deadlineHtml = formatDate ? formatDate(safeTask.deadline) : safeTask.deadline;
  }

  return `
    <tr data-task-id="${safeTask.id}">
      <td>${safeText ? safeText(safeTask.clientName) : safeTask.clientName}</td>
      <td class="td-description">
        <div class="table-description-with-icons">
          <span>${safeText ? safeText(safeTask.description) : safeTask.description}</span>
          ${combinedBadge}
        </div>
      </td>
      <td>${progressBarHtml}</td>
      <td style="text-align: center;">${deadlineHtml}</td>
      <td style="color: #6b7280; font-size: 13px;">${window.DatesModule ? window.DatesModule.getCreationDateTableCell(safeTask) : ''}</td>
      <td>${statusDisplay}</td>
      <td class="actions-column">
        ${taskActionsManager ? taskActionsManager.createTableActionButtons(safeTask, isCompleted) : ''}
      </td>
    </tr>
  `;
}

/**
 * Create empty state HTML
 * @returns {string} HTML string
 */
export function createEmptyTableState() {
  return `
    <div class="empty-state">
      <i class="fas fa-chart-bar"></i>
      <h4>אין משימות להצגה</h4>
      <p>הוסף משימה חדשה כדי להתחיל</p>
    </div>
  `;
}

/**
 * Render budget cards view
 * @param {Array} tasks - Tasks to render
 * @param {Object} options - Rendering options
 */
export function renderBudgetCards(tasks, options = {}) {
  const {
    stats,
    currentTaskFilter,
    paginationStatus,
    currentBudgetSort,
    safeText
  } = options;

  const tasksHtml = tasks.map((task) => createTaskCard(task, options)).join('');

  const statsBar = window.StatisticsModule
    ? window.StatisticsModule.createBudgetStatsBar(stats, currentTaskFilter || 'active')
    : '';

  const loadMoreButton = paginationStatus?.hasMore ? `
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
      </div>
    </div>
  ` : '';

  const html = `
    <div class="modern-cards-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-chart-bar"></i>
          משימות מתוקצבות
        </h3>
      </div>
      <div class="stats-with-sort-row">
        ${statsBar}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks(event)">
            <option value="recent" ${currentBudgetSort === 'recent' ? 'selected' : ''}>עדכון אחרון</option>
            <option value="name" ${currentBudgetSort === 'name' ? 'selected' : ''}>שם (א-ת)</option>
            <option value="deadline" ${currentBudgetSort === 'deadline' ? 'selected' : ''}>תאריך יעד</option>
            <option value="progress" ${currentBudgetSort === 'progress' ? 'selected' : ''}>התקדמות</option>
          </select>
        </div>
      </div>
      <div class="budget-cards-grid">
        ${tasksHtml}
      </div>
      ${loadMoreButton}
    </div>
  `;

  const container = document.getElementById('budgetContainer');
  const tableContainer = document.getElementById('budgetTableContainer');
  if (container) {
    container.innerHTML = html;
    container.classList.remove('hidden');

    // ✅ Initialize description tooltips for cards
    if (window.DescriptionTooltips) {
      window.DescriptionTooltips.refresh(container);
    }
  }
  if (tableContainer) {
    tableContainer.classList.add('hidden');
  }
}

/**
 * Render budget table view
 * @param {Array} tasks - Tasks to render
 * @param {Object} options - Rendering options
 */
export function renderBudgetTable(tasks, options = {}) {
  const {
    stats,
    currentTaskFilter,
    paginationStatus,
    currentBudgetSort
  } = options;

  const statsBar = window.StatisticsModule
    ? window.StatisticsModule.createBudgetStatsBar(stats, currentTaskFilter || 'active')
    : '';

  const loadMoreButton = paginationStatus?.hasMore ? `
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
      </div>
    </div>
  ` : '';

  const html = (!tasks || tasks.length === 0) ? createEmptyTableState() : `
    <div class="modern-table-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-chart-bar"></i>
          משימות מתוקצבות
        </h3>
      </div>
      <div class="stats-with-sort-row">
        ${statsBar}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks(event)">
            <option value="recent" ${currentBudgetSort === 'recent' ? 'selected' : ''}>עדכון אחרון</option>
            <option value="name" ${currentBudgetSort === 'name' ? 'selected' : ''}>שם (א-ת)</option>
            <option value="deadline" ${currentBudgetSort === 'deadline' ? 'selected' : ''}>תאריך יעד</option>
            <option value="progress" ${currentBudgetSort === 'progress' ? 'selected' : ''}>התקדמות</option>
          </select>
        </div>
      </div>
      <table class="modern-budget-table">
        <thead>
          <tr>
            <th>לקוח</th>
            <th>תיאור</th>
            <th>התקדמות</th>
            <th>יעד</th>
            <th>נוצר</th>
            <th>סטטוס</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map((task) => createTableRow(task, options)).join('')}
        </tbody>
      </table>
      ${loadMoreButton}
    </div>
  `;

  const container = document.getElementById('budgetContainer');
  const tableContainer = document.getElementById('budgetTableContainer');
  if (tableContainer) {
    tableContainer.innerHTML = html;
    tableContainer.classList.remove('hidden');

    // ✅ Initialize description tooltips for table
    if (window.DescriptionTooltips) {
      window.DescriptionTooltips.refresh(tableContainer);
    }
  }
  if (container) {
    container.classList.add('hidden');
  }
}

/* ===========================
   FORM OPERATIONS
   =========================== */

/**
 * Clear budget form
 */
export function clearBudgetForm() {
  const budgetForm = document.getElementById('budgetForm');
  if (budgetForm) {
budgetForm.reset();
}
}

/* ===========================
   MODULE EXPORTS
   =========================== */

export default {
  // Firebase operations
  loadBudgetTasksFromFirebase,
  saveBudgetTaskToFirebase,

  // Validation
  validateBudgetTaskForm,

  // Filtering & Sorting
  filterBudgetTasks,
  sortBudgetTasks,

  // Helper functions
  sanitizeTaskData,
  calculateSimpleProgress,
  getProgressStatusText,
  getActiveTasksCount,
  getCompletedTasksCount,

  // Render functions
  createTaskCard,
  createTableRow,
  createEmptyTableState,
  renderBudgetCards,
  renderBudgetTable,

  // Form operations
  clearBudgetForm
};
