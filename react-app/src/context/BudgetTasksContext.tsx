// Budget Tasks Context
// =====================
// מערכת ניהול משימות תקציב

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import {
  createBudgetTask as createTask,
  getBudgetTasks as getTasks,
  updateBudgetTask as updateTask,
  deleteBudgetTask as deleteTask,
  completeBudgetTask as completeTask,
} from '@services/api/budgetTasksService';
import type { BudgetTask, BudgetTaskFormData, TaskStatus } from '../types';
import { toast } from 'react-toastify';

// ===================================
// Context Types
// ===================================

interface BudgetTasksContextType {
  tasks: BudgetTask[];
  loading: boolean;
  error: string | null;
  filter: TaskStatus | 'all';
  setFilter: (filter: TaskStatus | 'all') => void;
  loadTasks: () => Promise<void>;
  createBudgetTask: (taskData: BudgetTaskFormData) => Promise<BudgetTask>;
  updateBudgetTask: (taskId: string, updates: Partial<BudgetTask>) => Promise<void>;
  deleteBudgetTask: (taskId: string) => Promise<void>;
  completeBudgetTask: (taskId: string) => Promise<void>;
  filteredTasks: BudgetTask[];
}

// ===================================
// Create Context
// ===================================

export const BudgetTasksContext = createContext<BudgetTasksContextType | undefined>(
  undefined
);

// ===================================
// Budget Tasks Provider Component
// ===================================

interface BudgetTasksProviderProps {
  children: ReactNode;
}

export const BudgetTasksProvider: React.FC<BudgetTasksProviderProps> = ({ children }) => {
  const [tasks, setTasks] = useState<BudgetTask[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('active');

  /**
   * Load all budget tasks
   */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedTasks = await getTasks();
      setTasks(loadedTasks);
      console.log(`✅ Loaded ${loadedTasks.length} budget tasks`);
    } catch (err) {
      console.error('❌ Error loading budget tasks:', err);
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת משימות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new budget task
   */
  const createBudgetTask = useCallback(
    async (taskData: BudgetTaskFormData): Promise<BudgetTask> => {
      setLoading(true);
      setError(null);

      try {
        const newTask = await createTask(taskData);
        setTasks((prevTasks) => [newTask, ...prevTasks]);
        toast.success('משימה נוצרה בהצלחה');
        console.log('✅ Created budget task:', newTask.id);
        return newTask;
      } catch (err) {
        console.error('❌ Error creating budget task:', err);
        const errorMessage = err instanceof Error ? err.message : 'שגיאה ביצירת משימה';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Update an existing budget task
   */
  const updateBudgetTask = useCallback(
    async (taskId: string, updates: Partial<BudgetTask>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedTask = await updateTask(taskId, updates);
        setTasks((prevTasks) =>
          prevTasks.map((task) => (task.id === taskId ? updatedTask : task))
        );
        toast.success('משימה עודכנה בהצלחה');
        console.log('✅ Updated budget task:', taskId);
      } catch (err) {
        console.error('❌ Error updating budget task:', err);
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בעדכון משימה';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Delete a budget task
   */
  const deleteBudgetTask = useCallback(async (taskId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await deleteTask(taskId);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      toast.success('משימה נמחקה בהצלחה');
      console.log('✅ Deleted budget task:', taskId);
    } catch (err) {
      console.error('❌ Error deleting budget task:', err);
      const errorMessage = err instanceof Error ? err.message : 'שגיאה במחיקת משימה';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Mark task as completed
   */
  const completeBudgetTask = useCallback(async (taskId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const updatedTask = await completeTask(taskId);
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === taskId ? updatedTask : task))
      );
      toast.success('משימה הושלמה!');
      console.log('✅ Completed budget task:', taskId);
    } catch (err) {
      console.error('❌ Error completing budget task:', err);
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בסימון משימה כהושלמה';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get filtered tasks based on current filter
   */
  const filteredTasks = React.useMemo(() => {
    if (filter === 'all') {
      return tasks;
    }
    return tasks.filter((task) => task.status === filter);
  }, [tasks, filter]);

  // ===================================
  // Context Value
  // ===================================

  const value: BudgetTasksContextType = {
    tasks,
    loading,
    error,
    filter,
    setFilter,
    loadTasks,
    createBudgetTask,
    updateBudgetTask,
    deleteBudgetTask,
    completeBudgetTask,
    filteredTasks,
  };

  return (
    <BudgetTasksContext.Provider value={value}>{children}</BudgetTasksContext.Provider>
  );
};
