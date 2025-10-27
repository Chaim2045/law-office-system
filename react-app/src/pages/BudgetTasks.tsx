// Budget Tasks Page
// ==================
// עמוד ניהול משימות תקציב

import React, { useEffect, useState } from 'react';
import { Button, Card } from '@components/common';
import { BudgetTaskList, BudgetTaskForm } from '@components/budget-tasks';
import { useBudgetTasks } from '@hooks/useBudgetTasks';
import type { BudgetTask, BudgetTaskFormData } from '../types';
import './BudgetTasks.css';

export const BudgetTasks: React.FC = () => {
  const {
    filteredTasks,
    loading,
    filter,
    setFilter,
    loadTasks,
    createBudgetTask,
    completeBudgetTask,
    deleteBudgetTask,
  } = useBudgetTasks();

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<BudgetTask | null>(null);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreate = async (data: BudgetTaskFormData) => {
    try {
      await createBudgetTask(data);
      setShowForm(false);
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleComplete = async (taskId: string) => {
    if (window.confirm('האם לסמן משימה זו כהושלמה?')) {
      try {
        await completeBudgetTask(taskId);
      } catch (err) {
        console.error('Error completing task:', err);
      }
    }
  };

  const handleDelete = async (taskId: string) => {
    if (window.confirm('האם למחוק משימה זו? פעולה זו לא ניתנת לביטול.')) {
      try {
        await deleteBudgetTask(taskId);
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  };

  const handleEdit = (task: BudgetTask) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  return (
    <div className="budget-tasks-page">
      <div className="budget-tasks-header">
        <div>
          <h2>משימות תקציב</h2>
          <p>ניהול ומעקב אחר משימות ועבודות</p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowForm(true)}
          icon={<i className="fas fa-plus"></i>}
        >
          משימה חדשה
        </Button>
      </div>

      {/* Filters */}
      <div className="budget-tasks-filters">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'active' ? 'filter-btn-active' : ''}`}
            onClick={() => setFilter('active')}
          >
            <i className="fas fa-clock"></i>
            פעילות
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'filter-btn-active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            <i className="fas fa-check-circle"></i>
            הושלמו
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'filter-btn-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <i className="fas fa-list"></i>
            הכל
          </button>
        </div>

        <div className="tasks-count">
          <span>{filteredTasks.length} משימות</span>
        </div>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="form-dialog-overlay" onClick={handleCancelForm}>
          <div className="form-dialog" onClick={(e) => e.stopPropagation()}>
            <Card
              title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
              headerAction={
                <button className="close-btn" onClick={handleCancelForm}>
                  <i className="fas fa-times"></i>
                </button>
              }
            >
              <BudgetTaskForm
                onSubmit={handleCreate}
                onCancel={handleCancelForm}
                initialData={editingTask || undefined}
                loading={loading}
              />
            </Card>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="budget-tasks-content">
        <BudgetTaskList
          tasks={filteredTasks}
          loading={loading}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onEdit={handleEdit}
          emptyMessage={
            filter === 'active'
              ? 'אין משימות פעילות'
              : filter === 'completed'
              ? 'אין משימות שהושלמו'
              : 'אין משימות'
          }
        />
      </div>
    </div>
  );
};
