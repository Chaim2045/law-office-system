// Budget Task List Component
// ===========================
// רשימת משימות תקציב

import React from 'react';
import { BudgetTaskCard } from './BudgetTaskCard';
import { Spinner } from '@components/common';
import type { BudgetTask } from '../../types';
import './BudgetTaskList.css';

interface BudgetTaskListProps {
  tasks: BudgetTask[];
  loading?: boolean;
  emptyMessage?: string;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onEdit?: (task: BudgetTask) => void;
}

export const BudgetTaskList: React.FC<BudgetTaskListProps> = ({
  tasks,
  loading = false,
  emptyMessage = 'אין משימות להצגה',
  onComplete,
  onDelete,
  onEdit,
}) => {
  if (loading) {
    return (
      <div className="budget-task-list-loading">
        <Spinner size="large" text="טוען משימות..." />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="budget-task-list-empty">
        <i className="fas fa-tasks"></i>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="budget-task-list">
      {tasks.map((task) => (
        <BudgetTaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};
