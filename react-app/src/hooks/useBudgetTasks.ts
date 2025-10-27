// useBudgetTasks Hook
// =====================
// Custom hook for accessing budget tasks context

import { useContext } from 'react';
import { BudgetTasksContext } from '@context/BudgetTasksContext';

/**
 * Custom hook to access BudgetTasksContext
 * @throws Error if used outside BudgetTasksProvider
 * @returns BudgetTasksContext value
 *
 * @example
 * const {
 *   tasks,
 *   loading,
 *   filteredTasks,
 *   filter,
 *   setFilter,
 *   loadTasks,
 *   createBudgetTask,
 *   updateBudgetTask,
 *   deleteBudgetTask,
 *   completeBudgetTask
 * } = useBudgetTasks();
 *
 * // Load tasks
 * useEffect(() => {
 *   loadTasks();
 * }, [loadTasks]);
 *
 * // Create new task
 * await createBudgetTask({
 *   clientId: '2025001',
 *   description: 'סקירת תיק',
 *   pricingType: 'hours',
 *   hours: 2,
 *   minutes: 0,
 * });
 *
 * // Filter tasks
 * setFilter('completed');
 */
export const useBudgetTasks = () => {
  const context = useContext(BudgetTasksContext);

  if (context === undefined) {
    throw new Error('useBudgetTasks must be used within a BudgetTasksProvider');
  }

  return context;
};
