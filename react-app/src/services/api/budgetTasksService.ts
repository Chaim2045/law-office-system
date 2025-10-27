// Budget Tasks Service
// =====================
// שירות לניהול משימות תקציב דרך Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '@services/firebase/config';
import type { BudgetTask, BudgetTaskFormData, FirebaseFunctionResponse } from '../../types';

// ===================================
// Firebase Functions Helpers
// ===================================

/**
 * Create a new budget task
 * @param taskData Task data to create
 * @returns Created task with ID
 */
export const createBudgetTask = async (
  taskData: BudgetTaskFormData
): Promise<BudgetTask> => {
  try {
    const createTask = httpsCallable<BudgetTaskFormData, FirebaseFunctionResponse<{ task: BudgetTask }>>(
      functions,
      'createBudgetTask'
    );

    const result = await createTask(taskData);

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה ביצירת משימה');
    }

    return result.data.data.task;
  } catch (error) {
    console.error('❌ Error creating budget task:', error);
    throw error;
  }
};

/**
 * Get all budget tasks (filtered by employee automatically on backend)
 * @param filters Optional filters
 * @returns Array of budget tasks
 */
export const getBudgetTasks = async (filters?: {
  status?: string;
}): Promise<BudgetTask[]> => {
  try {
    const getTasks = httpsCallable<
      { status?: string },
      FirebaseFunctionResponse<{ tasks: BudgetTask[] }>
    >(functions, 'getBudgetTasks');

    const result = await getTasks(filters || {});

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה בטעינת משימות');
    }

    return result.data.data.tasks;
  } catch (error) {
    console.error('❌ Error getting budget tasks:', error);
    throw error;
  }
};

/**
 * Update a budget task
 * @param taskId Task ID
 * @param updates Partial task data to update
 * @returns Updated task
 */
export const updateBudgetTask = async (
  taskId: string,
  updates: Partial<BudgetTask>
): Promise<BudgetTask> => {
  try {
    const updateTask = httpsCallable<
      { taskId: string; updates: Partial<BudgetTask> },
      FirebaseFunctionResponse<{ task: BudgetTask }>
    >(functions, 'updateBudgetTask');

    const result = await updateTask({ taskId, updates });

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה בעדכון משימה');
    }

    return result.data.data.task;
  } catch (error) {
    console.error('❌ Error updating budget task:', error);
    throw error;
  }
};

/**
 * Delete a budget task
 * @param taskId Task ID
 */
export const deleteBudgetTask = async (taskId: string): Promise<void> => {
  try {
    const deleteTask = httpsCallable<
      { taskId: string },
      FirebaseFunctionResponse
    >(functions, 'deleteBudgetTask');

    const result = await deleteTask({ taskId });

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה במחיקת משימה');
    }
  } catch (error) {
    console.error('❌ Error deleting budget task:', error);
    throw error;
  }
};

/**
 * Mark task as completed
 * @param taskId Task ID
 * @returns Updated task
 */
export const completeBudgetTask = async (taskId: string): Promise<BudgetTask> => {
  try {
    const completeTask = httpsCallable<
      { taskId: string },
      FirebaseFunctionResponse<{ task: BudgetTask }>
    >(functions, 'completeBudgetTask');

    const result = await completeTask({ taskId });

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה בסימון משימה כהושלמה');
    }

    return result.data.data.task;
  } catch (error) {
    console.error('❌ Error completing budget task:', error);
    throw error;
  }
};
