/**
 * Budget Tasks Module
 * מודול לניהול משימות תקציב - רינדור, מיון, סינון ולידציה
 *
 * @module BudgetTasksModule
 * @version 1.0.0
 * @created 2025-01-15
 */

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
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db
      .collection("budget_tasks")
      .where("employee", "==", employee)
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
        deadline: data.deadline?.toDate ? data.deadline.toDate() : (data.deadline ? new Date(data.deadline) : data.deadline),
      };

      // Only set 'id' if it doesn't exist in the data
      if (!taskWithFirebaseId.id) {
        taskWithFirebaseId.id = doc.id;
      }

      tasks.push(taskWithFirebaseId);
    });

    return tasks;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת משימות: " + error.message);
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
    console.error("Firebase error:", error);
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
    .getElementById("budgetDescription")
    ?.value?.trim();
  if (!description || description.length < 3) {
    errors.push("תיאור המשימה חייב להכיל לפחות 3 תווים");
  }

  const caseSelect = document.getElementById("budgetCaseSelect")?.value;
  if (!caseSelect) {
    errors.push("חובה לבחור תיק");
  }

  // ✅ בדיקה אם יש dropdown שירותים (במקרה של מספר שירותים)
  const serviceSelectElement = document.getElementById("budgetServiceSelect");
  if (serviceSelectElement && serviceSelectElement.type === 'select-one') {
    // יש dropdown - בדיקה שנבחר שירות
    const serviceValue = serviceSelectElement.value;
    if (!serviceValue) {
      errors.push("חובה לבחור שירות מהרשימה");
    }
  }

  const estimatedTime = document.getElementById("estimatedTime")?.value;
  if (!estimatedTime || parseInt(estimatedTime) <= 0) {
    errors.push("זמן משוער חייב להיות גדול מ-0");
  }

  return {
    isValid: errors.length === 0,
    errors,
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
      if (t.status !== 'הושלם') return false;
      if (!t.completedAt) return true;
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
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
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
  if (!task) return {};

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
    clientName: task.clientName || "לקוח לא ידוע",
    description:
      task.taskDescription || task.description || "משימה ללא תיאור",
    taskDescription:
      task.taskDescription || task.description || "משימה ללא תיאור",
    // ✅ תמיכה הן ב-Hours והן ב-Minutes
    estimatedHours: Number(task.estimatedHours) || 0,
    actualHours: Number(task.actualHours) || 0,
    estimatedMinutes: Number(task.estimatedMinutes) || (Number(task.estimatedHours) || 0) * 60,
    actualMinutes: Number(task.actualMinutes) || (Number(task.actualHours) || 0) * 60,
    deadline: deadlineConverted,
    status: task.status || "פעיל",
    branch: task.branch || "",
    fileNumber: task.fileNumber || "",
    history: task.history || [],
    createdAt: task.createdAt || null,
    updatedAt: task.updatedAt || null,
    caseId: task.caseId || null,
    caseTitle: task.caseTitle || null,
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
  return Math.min(progress, 100);
}

/**
 * Get progress status text in Hebrew
 * @param {number} progress - Progress percentage
 * @returns {string} Status text
 */
export function getProgressStatusText(progress) {
  if (progress >= 100) return "הושלם";
  if (progress >= 90) return "כמעט סיימת";
  if (progress >= 75) return "קרוב לסיום";
  if (progress >= 50) return "באמצע הדרך";
  if (progress >= 25) return "התחלנו";
  if (progress > 0) return "בתחילת הדרך";
  return "לא התחיל";
}

/**
 * Get active tasks count
 * @param {Array} budgetTasks - All budget tasks
 * @returns {number} Count of active tasks
 */
export function getActiveTasksCount(budgetTasks) {
  return (budgetTasks || []).filter(
    (task) => task && task.status !== "הושלם"
  ).length;
}

/**
 * Get completed tasks count
 * @param {Array} budgetTasks - All budget tasks
 * @returns {number} Count of completed tasks
 */
export function getCompletedTasksCount(budgetTasks) {
  return (budgetTasks || []).filter(
    (task) => task && task.status === "הושלם"
  ).length;
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
      ? "progress-complete"
      : progress >= 85
      ? "progress-high"
      : progress >= 50
      ? "progress-medium"
      : "progress-low";
  const progressStatus = getProgressStatusText(progress);

  const now = new Date();
  const deadline = new Date(safeTask.deadline);
  const daysUntilDeadline = Math.ceil(
    (deadline - now) / (1000 * 60 * 60 * 24)
  );

  let deadlineClass = "";
  let deadlineIcon = '<i class="fas fa-calendar-alt"></i>';
  if (daysUntilDeadline < 0) {
    deadlineClass = "overdue";
    deadlineIcon = '<i class="fas fa-exclamation-triangle"></i>';
  } else if (daysUntilDeadline <= 1) {
    deadlineClass = "urgent";
    deadlineIcon = '<i class="fas fa-exclamation-circle"></i>';
  } else if (daysUntilDeadline <= 3) {
    deadlineClass = "soon";
    deadlineIcon = '<i class="fas fa-clock"></i>';
  }

  const actualHours = Math.round((safeTask.actualMinutes / 60) * 10) / 10;
  const estimatedHours =
    Math.round((safeTask.estimatedMinutes / 60) * 10) / 10;

  const safeDescription = safeText ? safeText(safeTask.description) : safeTask.description;
  const safeClientName = safeText ? safeText(safeTask.clientName) : safeTask.clientName;
  const clientDisplayName =
    safeTask.clientName.length > 20
      ? (safeText ? safeText(safeTask.clientName.substring(0, 20) + "...") : safeTask.clientName.substring(0, 20) + "...")
      : safeClientName;

  // Check if task is completed
  const isCompleted = safeTask.status === 'הושלם';
  const completedIndicator = isCompleted ? `
    <span class="completed-badge">
      <i class="fas fa-check-circle"></i>
    </span>
  ` : '';

  return `
    <div class="linear-minimal-card" data-task-id="${safeTask.id}">
      ${window.DatesModule ? window.DatesModule.getCreationDateCorner(safeTask) : ''}
      <div class="linear-card-content">
        <h3 class="linear-card-title" title="${safeClientName}" style="display: flex; align-items: center;">
          <span style="flex: 1;">${safeDescription}</span>
          ${completedIndicator}
        </h3>
        <div class="linear-progress-section">
          <div class="linear-visual-progress">
            <div class="linear-progress-text">
              <span class="progress-percentage">${progress}%</span>
              <span class="progress-status">${safeText ? safeText(progressStatus) : progressStatus}</span>
            </div>
            <div class="linear-progress-bar">
              <div class="linear-progress-fill ${progressClass}" style="width: ${Math.min(
    progress,
    100
  )}%"></div>
            </div>
          </div>
          <div class="linear-time-info">
            <div class="time-item actual">
              <span class="time-value">${actualHours}h</span>
              <span class="time-label">בפועל</span>
            </div>
            <div class="time-item estimated">
              <span class="time-value">${estimatedHours}h</span>
              <span class="time-label">מתוכנן</span>
            </div>
          </div>
        </div>
        <div class="linear-card-meta">
          <div class="linear-client-row">
            <span class="linear-client-label">לקוח:</span>
            <span class="linear-client-name" title="${safeClientName}">
              ${clientDisplayName}
            </span>
          </div>
          <div class="linear-deadline-row">
            <span class="linear-progress-label">יעד:</span>
            <span class="deadline-info ${deadlineClass}" title="${formatDate(
    safeTask.deadline
  )}">
              ${deadlineIcon} ${formatShort(safeTask.deadline)}
            </span>
          </div>
        </div>
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

  // Visual indicator for completed tasks
  const isCompleted = safeTask.status === 'הושלם';
  const statusDisplay = isCompleted ? `
    <div style="display: flex; align-items: center; gap: 6px;">
      <i class="fas fa-check-circle" style="color: #10b981; font-size: 16px;"></i>
      <span>${safeText ? safeText(safeTask.status) : safeTask.status}</span>
    </div>
  ` : (safeText ? safeText(safeTask.status) : safeTask.status);

  return `
    <tr data-task-id="${safeTask.id}">
      <td>${safeText ? safeText(safeTask.clientName) : safeTask.clientName}</td>
      <td>${safeText ? safeText(safeTask.description) : safeTask.description}</td>
      <td>${progress}%</td>
      <td>${formatDate ? formatDate(safeTask.deadline) : safeTask.deadline}</td>
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

  const tasksHtml = tasks.map((task) => createTaskCard(task, options)).join("");

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
          ${tasks.map((task) => createTableRow(task, options)).join("")}
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
  const budgetForm = document.getElementById("budgetForm");
  if (budgetForm) budgetForm.reset();
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
