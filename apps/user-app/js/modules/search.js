/**
 * Search and Filter Module
 * Handles filtering and sorting operations for budget tasks and timesheet entries
 *
 * Created: 2025
 * Part of Law Office Management System
 */

/* === Budget Tasks Filter Functions === */

/**
 * Filter budget tasks based on status
 * @param {Array} budgetTasks - All budget tasks
 * @param {string} filterValue - Filter type: 'active', 'completed', 'all'
 * @returns {Array} Filtered tasks
 */
export function filterBudgetTasks(budgetTasks, filterValue) {
  if (!budgetTasks || budgetTasks.length === 0) {
return [];
}

  // Default: 'active' (no completed/cancelled tasks)
  if (filterValue === 'active' || !filterValue) {
    return budgetTasks.filter(t => t.status === 'פעיל');
  }

  if (filterValue === 'completed') {
    // Show completed tasks (last month only)
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
  }

  if (filterValue === 'all') {
    // Show all tasks
    return [...budgetTasks];
  }

  // Fallback to active
  return budgetTasks.filter(t => t.status === 'פעיל');
}

/**
 * Sort budget tasks
 * @param {Array} tasks - Tasks to sort
 * @param {string} sortValue - Sort type: 'recent', 'name', 'deadline', 'progress'
 * @returns {Array} Sorted tasks (modifies in place)
 */
export function sortBudgetTasks(tasks, sortValue) {
  if (!tasks || tasks.length === 0) {
return tasks;
}

  tasks.sort((a, b) => {
    switch (sortValue) {
      case 'recent':
        // Sort by last update - newest first
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

  return tasks;
}

/* === Timesheet Entries Filter Functions === */

/**
 * Filter timesheet entries based on date range
 * @param {Array} timesheetEntries - All timesheet entries
 * @param {string} filterValue - Filter type: 'today', 'month', 'all'
 * @returns {Array} Filtered entries
 */
export function filterTimesheetEntries(timesheetEntries, filterValue) {
  if (!timesheetEntries || timesheetEntries.length === 0) {
return [];
}

  const now = new Date();

  if (filterValue === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return timesheetEntries.filter(entry => {
      if (!entry.date) {
return false;
}
      const entryDate = new Date(entry.date);
      const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
      return entryDay.getTime() === today.getTime();
    });
  }

  if (filterValue === 'month') {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return timesheetEntries.filter(entry => {
      if (!entry.date) {
return true;
}
      const entryDate = new Date(entry.date);
      return entryDate >= oneMonthAgo;
    });
  }

  // Show all
  return [...timesheetEntries];
}

/**
 * Sort timesheet entries
 * @param {Array} entries - Entries to sort
 * @param {string} sortValue - Sort type: 'recent', 'client', 'hours'
 * @returns {Array} Sorted entries (modifies in place)
 */
export function sortTimesheetEntries(entries, sortValue) {
  if (!entries || entries.length === 0) {
return entries;
}

  entries.sort((a, b) => {
    switch (sortValue) {
      case 'recent':
        // Sort by date - most recent first
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;

      case 'client':
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

      case 'hours':
        // Sort by hours - highest first
        const minutesA = a.minutes || 0;
        const minutesB = b.minutes || 0;
        return minutesB - minutesA;

      default:
        return 0;
    }
  });

  return entries;
}

/* === Utility Functions === */

/**
 * Apply simple filter (no date logic)
 * Used as a fallback
 */
export function applySimpleFilter(items) {
  return items ? [...items] : [];
}
