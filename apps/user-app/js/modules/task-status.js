/**
 * Task Status Constants & Helpers
 * Single Source of Truth for task status values and checks
 *
 * This module ensures cancelled tasks are never treated as active
 * by providing strict status checks instead of "!= completed" logic.
 */

/**
 * Task status constants
 * @const {Object}
 */
export const TASK_STATUS = {
  ACTIVE: 'פעיל',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל'
};

/**
 * Check if task is active (strict check)
 * @param {Object} task - Task object
 * @returns {boolean} True only if status is exactly 'פעיל'
 */
export function isActiveTask(task) {
  return task?.status === TASK_STATUS.ACTIVE;
}

/**
 * Check if task is completed
 * @param {Object} task - Task object
 * @returns {boolean} True if status is 'הושלם'
 */
export function isCompletedTask(task) {
  return task?.status === TASK_STATUS.COMPLETED;
}

/**
 * Check if task is cancelled
 * @param {Object} task - Task object
 * @returns {boolean} True if status is 'בוטל'
 */
export function isCancelledTask(task) {
  return task?.status === TASK_STATUS.CANCELLED;
}

/**
 * Filter array to active tasks only
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Only active tasks
 */
export function filterActiveTasks(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
return [];
}
  return tasks.filter(isActiveTask);
}

/**
 * Filter array to completed tasks only
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Only completed tasks
 */
export function filterCompletedTasks(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
return [];
}
  return tasks.filter(isCompletedTask);
}
