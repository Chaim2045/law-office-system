/**
 * Budget Tasks Module
 * מודול לניהול משימות תקציב - רינדור, מיון, סינון ולידציה
 *
 * @module BudgetTasksModule
 * @version 1.1.0
 * @created 2025-01-15
 * @updated 2025-01-19
 *
 * ════════════════════════════════════════════════════════════════════
 * CHANGELOG | יומן שינויים
 * ════════════════════════════════════════════════════════════════════
 *
 * v1.1.0 - 19/01/2025
 * -------------------
 * 🔄 רפקטורינג: סטנדרטיזציה של המרת timestamps
 * ✅ REFACTORED: שימוש ב-DatesModule.convertTimestampFields() (lines 92-97)
 * 📊 השפעה: ביטול 3 שורות קוד ידני לטובת פונקציה משותפת
 *
 * שינויים:
 * - המרת Firebase Timestamps אוטומטית עבור 4 שדות
 * - תמיכה ב-createdAt, updatedAt, completedAt, deadline
 * - טיפול בטוח בשגיאות עם fallbacks
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
   CONSTANTS
   =========================== */

/**
 * Default limit for loading budget tasks from Firestore
 * Increased from 50 to 1000 to show all tasks without pagination
 * @constant {number}
 */
export const BUDGET_TASKS_LOAD_LIMIT = 1000;

/* ===========================
   FIREBASE OPERATIONS
   =========================== */

/**
 * Load budget tasks from Firebase for a specific employee with server-side filtering
 * ✅ OPTIMIZED: Server-side filtering for better performance (20+ users, 100+ tasks)
 *
 * @param {string} employee - Employee email
 * @param {string} statusFilter - Filter type: 'active', 'completed', 'all'
 * @param {number} limit - Max results (default 1000)
 * @returns {Promise<Array>} Array of budget tasks
 */
export async function loadBudgetTasksFromFirebase(employee, statusFilter = 'active', limit = BUDGET_TASKS_LOAD_LIMIT) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error('Firebase לא מחובר');
    }

    let query = db.collection('budget_tasks').where('employee', '==', employee);
    let snapshot;
    let usedFallback = false;

    // ✅ Try server-side filtering first (optimal performance)
    // ⚠️ Falls back to client-side if index is not ready yet
    try {
      if (statusFilter === 'active') {
        // משימות פעילות - רק משימות עם סטטוס 'פעיל'
        query = query.where('status', '==', 'פעיל');
      } else if (statusFilter === 'completed') {
        // משימות מושלמות - ממוינות לפי תאריך השלמה (החדשות ראשון)
        query = query
          .where('status', '==', 'הושלם')
          .orderBy('completedAt', 'desc');
      }
      // 'all' - לא מוסיף סינון, טוען הכל

      query = query.limit(limit);
      snapshot = await query.get();

    } catch (indexError) {
      // ⚠️ Index not ready yet - fallback to client-side filtering
      // Silent fallback - no warnings to user
      if (indexError.code !== 'failed-precondition' && !indexError.message?.includes('index')) {
        console.warn('⚠️ Unexpected error, using fallback:', indexError.message);
      }
      usedFallback = true;

      // Load all tasks for this employee (no filtering)
      try {
        query = db.collection('budget_tasks')
          .where('employee', '==', employee)
          .limit(100); // Higher limit for fallback
        snapshot = await query.get();
      } catch (fallbackError) {
        // If fallback also fails, try without any complex queries
        console.error('Fallback also failed, loading basic query:', fallbackError);
        query = db.collection('budget_tasks')
          .where('employee', '==', employee);
        snapshot = await query.get();
      }
    }

    const tasks = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // ⚡ CRITICAL: Convert Firebase Timestamps to JavaScript Date objects
      // ✅ Use shared timestamp converter (Single Source of Truth)
      const taskWithFirebaseId = {
        ...window.DatesModule.convertTimestampFields(data, ['createdAt', 'updatedAt', 'completedAt', 'deadline']),
        firebaseDocId: doc.id, // ✅ Always save Firebase document ID
        // ✅ FIX: Map timeEntries to history for timeline display
        history: data.timeEntries || []
      };

      // Only set 'id' if it doesn't exist in the data
      if (!taskWithFirebaseId.id) {
        taskWithFirebaseId.id = doc.id;
      }

      tasks.push(taskWithFirebaseId);
    });

    // ✅ Client-side filtering if fallback was used
    let filteredTasks = tasks;
    if (usedFallback) {
      if (statusFilter === 'active') {
        filteredTasks = tasks.filter(task => task.status === 'פעיל');
      } else if (statusFilter === 'completed') {
        filteredTasks = tasks
          .filter(task => task.status === 'הושלם')
          .sort((a, b) => {
            const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
            const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
            return dateB - dateA; // newest first
          });
      }
      filteredTasks = filteredTasks.slice(0, limit);
    }

    // 🛡️ SAFETY NET: Always apply client-side filtering as a double-check
    // This prevents race conditions and Firebase cache inconsistencies
    // that can occur during page refresh or initial load
    let finalTasks = usedFallback ? filteredTasks : tasks;

    if (statusFilter === 'active') {
      finalTasks = finalTasks.filter(task => task.status === 'פעיל');
    } else if (statusFilter === 'completed') {
      finalTasks = finalTasks.filter(task => task.status === 'הושלם');
    }
    // 'all' filter - no additional filtering needed

    console.log(`✅ Loaded ${finalTasks.length} tasks (filter: ${statusFilter}, fallback: ${usedFallback})`);
    return finalTasks;

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
    return budgetTasks.filter(t => t.status === 'פעיל');
  } else if (filterValue === 'completed') {
    // Show completed tasks (last month)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return budgetTasks.filter(t => {
      if (t.status === 'פעיל' || t.status === 'בוטל') {
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
    return budgetTasks.filter(t => t.status === 'פעיל');
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
    history: task.history || task.timeEntries || [],
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
 * Get color based on progress percentage
 * @param {number} progress - Progress percentage
 * @returns {string} Color name ('blue', 'orange', or 'red')
 */
export function getProgressColor(progress) {
  if (progress >= 100) {
return 'red';
}
  if (progress >= 85) {
return 'orange';
}
  return 'blue';
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
    (task) => task && task.status === 'פעיל'
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
function renderSVGRingsSection(
  task, progress, actualHours, estimatedHours, originalEstimate,
  wasAdjusted, isOverOriginal, overageMinutes, daysUntilDeadline
) {
  if (!window.SVGRings) {
return '';
}

  const now = new Date();
  const deadline = new Date(task.deadline);
  const createdAt = task.createdAt ? new Date(task.createdAt) : now;

  // 🔧 FIX: Handle case where deadline is before createdAt (data inconsistency)
  // Use deadline as start point if it's earlier than createdAt
  const startDate = createdAt < deadline ? createdAt : deadline;
  const totalDays = Math.max(1, (deadline - startDate) / (1000 * 60 * 60 * 24));
  const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);
  // ✅ FIX: הסרת הגבלת 100% - מאפשר להראות איחור אמיתי (למשל 120% = איחור של 20%)
  const deadlineProgress = Math.max(0, Math.round((elapsedDays / totalDays) * 100));
  const isDeadlineOverdue = daysUntilDeadline < 0;
  const overdueDays = Math.abs(Math.min(0, daysUntilDeadline));

  // Budget Ring Config
  const budgetRingConfig = {
    progress, // ✅ No 100% cap - shows 150%+ for overage
    color: getProgressColor(progress), // שימוש בפונקציה המשותפת
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

  // ✅ FIX: צבע דינמי מתאים לאחוז התקדמות (כולל מעל 100%)
  let deadlineColor = 'blue'; // ברירת מחדל - כחול
  if (deadlineProgress >= 100) {
    deadlineColor = 'red'; // אדום - איחור
  } else if (deadlineProgress >= 85) {
    deadlineColor = 'orange'; // כתום - התקרבות ליעד
  }

  // 🐛 DEBUG: Log deadline progress for task with overdue
  if (deadlineProgress > 100) {
    console.log(`🔍 Task ${task.id.substring(0, 8)}: deadlineProgress = ${deadlineProgress}%`);
  }

  // ✅ NEW: Use createDeadlineDisplay instead of createSVGRing for deadline
  const budgetRingHTML = window.SVGRings.createSVGRing(budgetRingConfig);
  const deadlineRingHTML = window.SVGRings.createDeadlineDisplay({
    deadline: deadline,
    daysRemaining: daysUntilDeadline,
    size: 80,
    button: isDeadlineOverdue ? {
      text: wasExtended ? 'הארך שוב' : 'הארך יעד',
      onclick: `event.stopPropagation(); manager.showExtendDeadlineDialog('${task.id}')`,
      icon: 'fas fa-calendar-plus',
      cssClass: 'deadline-btn',
      show: true
    } : null
  });

  let ringsHTML = `
    <div class="svg-rings-dual-layout">
      ${budgetRingHTML}
      ${deadlineRingHTML}
    </div>
  `;

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
  const isPendingApproval = safeTask.status === 'pending_approval';

  const completedIndicator = isCompleted ? `
    <span class="completed-badge">
      <i class="fas fa-check-circle"></i>
    </span>
  ` : '';

  // ✅ REMOVED: pendingApprovalIndicator - not needed in UI

  // 🎯 Combined info badge (case + service + stage)
  // Pass serviceId directly - mapping will be done in the popup
  const combinedBadge = createCombinedInfoBadge(
    safeTask.caseNumber,
    safeTask.serviceName,
    safeTask.serviceType,
    safeTask.serviceId || ''
  );

  const badgesRow = combinedBadge ? `
    <div class="linear-card-badges">
      ${combinedBadge}
    </div>
  ` : '';

  return `
    <div class="linear-minimal-card ${isPendingApproval ? 'pending-approval' : ''}" data-task-id="${safeTask.id}">
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

  // 🎯 Combined info badge for table view (same as card view) + stage
  // Pass serviceId directly - mapping will be done in the popup
  const combinedBadge = createCombinedInfoBadge(
    safeTask.caseNumber,
    safeTask.serviceName,
    safeTask.serviceType,
    safeTask.serviceId || ''
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
    // ✅ FIX: הסרת הגבלת 100% - מאפשר להראות איחור אמיתי בטבלה
    // 🔧 FIX: Handle case where deadline is before createdAt
    const startDate = createdAt < deadline ? createdAt : deadline;
    const totalDays = Math.max(1, (deadline - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);
    const deadlineProgress = Math.max(0, Math.round((elapsedDays / totalDays) * 100));

    deadlineHtml = window.SVGRings.createCompactDeadlineRing({
      daysRemaining: daysUntilDeadline,
      progress: deadlineProgress,
      deadline: deadline,
      size: 52
    });
  } else {
    deadlineHtml = formatDate ? formatDate(safeTask.deadline) : safeTask.deadline;
  }

  // Check if task is pending approval
  const isPendingApproval = safeTask.status === 'pending_approval';
  const rowClass = isPendingApproval ? 'pending-approval-row' : '';

  return `
    <tr data-task-id="${safeTask.id}" class="${rowClass}">
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
 * @param {string} filterType - The current filter type ('active', 'completed', 'all')
 * @returns {string} HTML string
 */
export function createEmptyTableState(filterType = 'active') {
  // ✅ Special encouraging message for completed tasks
  if (filterType === 'completed') {
    return `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--success-500); margin-bottom: 1rem;"></i>
        <h4>עדיין אין משימות שהושלמו</h4>
        <p style="color: var(--gray-600); font-size: 1.1rem; margin-top: 0.5rem;">
          אבל אל תדאג, סומכים עליך שבקרוב זה יהיה מלא! 💪
        </p>
      </div>
    `;
  }

  // Default empty state for active tasks
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

  const container = document.getElementById('budgetContainer');
  const tableContainer = document.getElementById('budgetTableContainer');

  // ✅ Check for empty state first
  if (!tasks || tasks.length === 0) {
    if (container) {
      container.innerHTML = createEmptyTableState(currentTaskFilter || 'active');
      container.classList.remove('hidden');
    }
    if (tableContainer) {
      tableContainer.classList.add('hidden');
    }
    return;
  }

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

  const html = (!tasks || tasks.length === 0) ? createEmptyTableState(currentTaskFilter || 'active') : `
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
   LIST VIEW (Phase 0 — Grouped Priority List)
   =========================== */

/**
 * Group tasks by deadline urgency into 4 buckets:
 * - overdue   (past deadline)
 * - this-week (0-7 days)
 * - this-month (8-30 days)
 * - later     (>30 days or no deadline)
 *
 * @param {Array} tasks - Active tasks (already filtered)
 * @returns {Object} { overdue: [], 'this-week': [], 'this-month': [], later: [] }
 */
export function groupTasksByDeadline(tasks) {
  const groups = {
    'overdue': [],
    'this-week': [],
    'this-month': [],
    'later': []
  };

  if (!Array.isArray(tasks)) {
    return groups;
  }

  const now = Date.now();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  tasks.forEach((task) => {
    if (!task || !task.deadline) {
      groups['later'].push(task);
      return;
    }

    const deadlineTime = new Date(task.deadline).getTime();
    if (Number.isNaN(deadlineTime)) {
      groups['later'].push(task);
      return;
    }

    const daysUntil = Math.ceil((deadlineTime - now) / MS_PER_DAY);

    if (daysUntil < 0) {
      groups['overdue'].push(task);
    } else if (daysUntil <= 7) {
      groups['this-week'].push(task);
    } else if (daysUntil <= 30) {
      groups['this-month'].push(task);
    } else {
      groups['later'].push(task);
    }
  });

  return groups;
}

/**
 * Build interpretive meta line for a task row.
 * Example: "לקוח X · חרגת ב-5 ימים · חריגה (200%)"
 *
 * @param {Object} task - Sanitized task data
 * @param {number} progress - Calculated progress percentage
 * @returns {string} HTML string of the meta line
 */
function buildListRowMeta(task, progress) {
  const parts = [];

  // Part 1: Client name
  if (task.clientName) {
    parts.push(`<span class="list-row-meta-client">${escapeHtml(task.clientName)}</span>`);
  }

  // Part 2: Deadline interpretation
  if (task.deadline) {
    const now = Date.now();
    const deadlineTime = new Date(task.deadline).getTime();
    if (!Number.isNaN(deadlineTime)) {
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const daysUntil = Math.ceil((deadlineTime - now) / MS_PER_DAY);

      let deadlineText = '';
      let deadlineClass = '';

      if (daysUntil < 0) {
        const daysLate = Math.abs(daysUntil);
        deadlineText = daysLate === 1 ? 'חרגת ביום' : `חרגת ב-${daysLate} ימים`;
        deadlineClass = 'list-row-meta-emphasis--overdue';
      } else if (daysUntil === 0) {
        deadlineText = 'היום';
        deadlineClass = 'list-row-meta-emphasis--overdue';
      } else if (daysUntil === 1) {
        deadlineText = 'מחר';
      } else if (daysUntil <= 7) {
        deadlineText = `בעוד ${daysUntil} ימים`;
      } else {
        const date = new Date(task.deadline);
        deadlineText = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        deadlineClass = 'list-row-meta-emphasis--on-time';
      }

      parts.push(`<span class="${deadlineClass}">${deadlineText}</span>`);
    }
  }

  // Part 3: Budget interpretation
  const actualMinutes = Number(task.actualMinutes || 0);
  const estimatedMinutes = Number(task.estimatedMinutes || task.originalEstimate || 0);

  if (estimatedMinutes > 0) {
    const actualHours = (actualMinutes / 60).toFixed(1);
    const estimatedHours = (estimatedMinutes / 60).toFixed(1);

    if (progress > 100) {
      parts.push(`<span class="list-row-meta-emphasis--over-budget">חריגה (${progress}%)</span>`);
    } else {
      parts.push(`${actualHours}ש / ${estimatedHours}ש`);
    }
  }

  return parts.join('<span class="list-row-meta-separator">·</span>');
}

/**
 * Minimal HTML escape for values going into innerHTML.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  if (s === null || s === undefined) {
    return '';
  }
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create a single list row HTML for one task.
 *
 * @param {Object} task - Task data
 * @param {string} groupKey - 'overdue' | 'this-week' | 'this-month' | 'later' | 'completed'
 * @returns {string} HTML string
 */
export function createTaskListRow(task, groupKey) {
  const safeTask = sanitizeTaskData(task);
  const progress = calculateSimpleProgress(safeTask);
  const safeDescription = escapeHtml(safeTask.description || '');
  const safeClientName = escapeHtml(safeTask.clientName || '');
  const metaHtml = buildListRowMeta(safeTask, progress);

  return `
    <li class="list-row" data-task-id="${escapeHtml(safeTask.id)}">
      <span class="list-row-indicator list-row-indicator--${groupKey}" aria-hidden="true"></span>
      <div class="list-row-main">
        <h5 class="list-row-title" title="${safeDescription}">${safeDescription}</h5>
        <p class="list-row-meta" title="${safeClientName}">${metaHtml}</p>
      </div>
    </li>
  `;
}

/**
 * Group label metadata (title + CSS modifier).
 */
const GROUP_META = {
  'overdue':    { title: 'באיחור',  modifier: 'overdue',    expandedByDefault: true  },
  'this-week':  { title: 'השבוע',   modifier: 'this-week',  expandedByDefault: false },
  'this-month': { title: 'החודש',   modifier: 'this-month', expandedByDefault: false },
  'later':      { title: 'אחר כך',  modifier: 'later',      expandedByDefault: false }
};

/**
 * Build HTML for a single deadline-based group.
 */
function buildGroup(key, tasks) {
  const meta = GROUP_META[key];
  const count = tasks.length;
  const isExpanded = meta.expandedByDefault && count > 0;
  const expandedClass = isExpanded ? 'is-expanded' : '';

  const rowsHtml = count > 0
    ? tasks.map((task) => createTaskListRow(task, key)).join('')
    : '<li class="list-group-empty">אין משימות בקבוצה זו</li>';

  return `
    <section class="list-group ${expandedClass}" data-group="${key}">
      <button
        type="button"
        class="list-group-header"
        onclick="manager.toggleListGroup('${key}')"
        aria-expanded="${isExpanded ? 'true' : 'false'}"
      >
        <div class="list-group-header-left">
          <i class="fas fa-chevron-down list-group-chevron" aria-hidden="true"></i>
          <span class="list-group-dot list-group-dot--${meta.modifier}" aria-hidden="true"></span>
          <h4 class="list-group-title">${meta.title}</h4>
          <span class="list-group-count">${count}</span>
        </div>
      </button>
      <div class="list-group-items-wrapper">
        <ul class="list-group-items">
          ${rowsHtml}
        </ul>
      </div>
    </section>
  `;
}

/**
 * Render budget list view (Phase 0 — view-only).
 * Active filter: grouped by deadline urgency.
 * Completed filter: flat list sorted by completion date.
 *
 * @param {Array} tasks - Tasks to render (already filtered by status)
 * @param {Object} options - Rendering options (same shape as other render functions)
 */
export function renderBudgetList(tasks, options = {}) {
  const {
    stats,
    currentTaskFilter,
    paginationStatus,
    currentBudgetSort
  } = options;

  const container = document.getElementById('budgetContainer');
  const tableContainer = document.getElementById('budgetTableContainer');
  const listContainer = document.getElementById('budgetListContainer');

  // Empty state
  if (!tasks || tasks.length === 0) {
    if (listContainer) {
      listContainer.innerHTML = createEmptyTableState(currentTaskFilter || 'active');
      listContainer.classList.remove('hidden');
    }
    if (container) {
      container.classList.add('hidden');
    }
    if (tableContainer) {
      tableContainer.classList.add('hidden');
    }
    return;
  }

  // Build body based on filter
  let bodyHtml;
  if (currentTaskFilter === 'completed') {
    // Flat list, sorted newest first (already sorted by caller in most cases)
    const rowsHtml = tasks.map((task) => createTaskListRow(task, 'completed')).join('');
    bodyHtml = `<ul class="list-completed">${rowsHtml}</ul>`;
  } else {
    // Grouped view (default)
    const groups = groupTasksByDeadline(tasks);
    bodyHtml = `
      <div class="list-groups">
        ${buildGroup('overdue',    groups['overdue'])}
        ${buildGroup('this-week',  groups['this-week'])}
        ${buildGroup('this-month', groups['this-month'])}
        ${buildGroup('later',      groups['later'])}
      </div>
    `;
  }

  // Shared header + stats bar (reuse existing components)
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
    <div class="modern-list-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-list"></i>
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
            <option value="recent"   ${currentBudgetSort === 'recent'   ? 'selected' : ''}>עדכון אחרון</option>
            <option value="name"     ${currentBudgetSort === 'name'     ? 'selected' : ''}>שם (א-ת)</option>
            <option value="deadline" ${currentBudgetSort === 'deadline' ? 'selected' : ''}>תאריך יעד</option>
            <option value="progress" ${currentBudgetSort === 'progress' ? 'selected' : ''}>התקדמות</option>
          </select>
        </div>
      </div>
      ${bodyHtml}
      ${loadMoreButton}
    </div>
  `;

  if (listContainer) {
    listContainer.innerHTML = html;
    listContainer.classList.remove('hidden');

    if (window.DescriptionTooltips) {
      window.DescriptionTooltips.refresh(listContainer);
    }
  }
  if (container) {
    container.classList.add('hidden');
  }
  if (tableContainer) {
    tableContainer.classList.add('hidden');
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

  // List view (Phase 0)
  groupTasksByDeadline,
  createTaskListRow,
  renderBudgetList,

  // Form operations
  clearBudgetForm
};
