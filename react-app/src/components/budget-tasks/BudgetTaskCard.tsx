// Budget Task Card Component
// ===========================
// כרטיס משימה בודדת

import React from 'react';
import { Card, Button } from '@components/common';
import type { BudgetTask } from '../../types';
import './BudgetTaskCard.css';

interface BudgetTaskCardProps {
  task: BudgetTask;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onEdit?: (task: BudgetTask) => void;
}

export const BudgetTaskCard: React.FC<BudgetTaskCardProps> = ({
  task,
  onComplete,
  onDelete,
  onEdit,
}) => {
  const isCompleted = task.status === 'completed';

  const formatTime = (hours?: number, minutes?: number): string => {
    if (!hours && !minutes) return '0 דקות';

    const parts: string[] = [];
    if (hours) parts.push(`${hours} שעות`);
    if (minutes) parts.push(`${minutes} דקות`);

    return parts.join(' ו-');
  };

  const formatDate = (date: string | Date | { seconds: number }): string => {
    if (!date) return '';

    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if ('seconds' in date) {
      dateObj = new Date(date.seconds * 1000);
    } else {
      return '';
    }

    return dateObj.toLocaleDateString('he-IL');
  };

  return (
    <Card
      className={`budget-task-card ${isCompleted ? 'budget-task-card-completed' : ''}`}
    >
      <div className="budget-task-header">
        <div className="budget-task-client">
          <i className="fas fa-folder"></i>
          <span className="budget-task-client-name">{task.clientName}</span>
          {task.caseNumber && (
            <span className="budget-task-case-number">#{task.caseNumber}</span>
          )}
        </div>

        <div className="budget-task-status">
          {isCompleted ? (
            <span className="status-badge status-completed">
              <i className="fas fa-check-circle"></i>
              הושלם
            </span>
          ) : (
            <span className="status-badge status-active">
              <i className="fas fa-clock"></i>
              פעיל
            </span>
          )}
        </div>
      </div>

      <div className="budget-task-body">
        <p className="budget-task-description">{task.description}</p>

        {task.serviceName && (
          <div className="budget-task-service">
            <i className="fas fa-tag"></i>
            <span>{task.serviceName}</span>
          </div>
        )}

        <div className="budget-task-time">
          <div className="time-item">
            <span className="time-label">זמן משוער:</span>
            <span className="time-value">
              {formatTime(task.hours, task.minutes)}
            </span>
          </div>
        </div>

        {task.deadline && (
          <div className="budget-task-deadline">
            <i className="fas fa-calendar-alt"></i>
            <span>תאריך יעד: {formatDate(task.deadline)}</span>
          </div>
        )}

        {task.createdAt && (
          <div className="budget-task-meta">
            <span>נוצר ב-{formatDate(task.createdAt)}</span>
            {task.createdBy && <span> על ידי {task.createdBy}</span>}
          </div>
        )}
      </div>

      <div className="budget-task-actions">
        {!isCompleted && onComplete && (
          <Button
            variant="success"
            size="small"
            onClick={() => onComplete(task.id)}
            icon={<i className="fas fa-check"></i>}
          >
            סמן כהושלם
          </Button>
        )}

        {onEdit && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => onEdit(task)}
            icon={<i className="fas fa-edit"></i>}
          >
            ערוך
          </Button>
        )}

        {onDelete && (
          <Button
            variant="danger"
            size="small"
            onClick={() => onDelete(task.id)}
            icon={<i className="fas fa-trash"></i>}
          >
            מחק
          </Button>
        )}
      </div>
    </Card>
  );
};
