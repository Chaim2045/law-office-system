// Timesheet Page
// ===============
// עמוד ניהול שעתון

import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@components/common';
import { TimesheetEntryList, TimesheetEntryForm } from '@components/timesheet';
import { useTimesheet } from '@hooks/useTimesheet';
import type { TimesheetEntry, TimesheetFormData } from '../types';
import './Timesheet.css';

type TimesheetFilter = 'today' | 'month' | 'all';

export const Timesheet: React.FC = () => {
  const {
    filteredEntries,
    loading,
    filter,
    setFilter,
    loadEntries,
    createTimesheetEntry,
    updateTimesheetEntry,
    deleteTimesheetEntry,
  } = useTimesheet();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleCreateEntry = async (data: TimesheetFormData) => {
    setFormLoading(true);
    try {
      await createTimesheetEntry(data);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating timesheet entry:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditEntry = async (data: TimesheetFormData) => {
    if (!editingEntry) return;

    setFormLoading(true);
    try {
      const totalMinutes = (data.hours * 60) + data.minutes;
      await updateTimesheetEntry(editingEntry.id, totalMinutes, data.notes);
      setIsModalOpen(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error updating timesheet entry:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק רישום זה?')) {
      return;
    }

    try {
      await deleteTimesheetEntry(entryId);
    } catch (error) {
      console.error('Error deleting timesheet entry:', error);
    }
  };

  const openEditModal = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const handleFilterChange = (newFilter: TimesheetFilter) => {
    setFilter(newFilter);
  };

  const totalHours = filteredEntries.reduce((sum, entry) => {
    return sum + (entry.hours || 0) + ((entry.minutes || 0) / 60);
  }, 0);

  return (
    <div className="timesheet-page">
      <div className="timesheet-header">
        <div className="timesheet-title">
          <h1>
            <i className="fas fa-clock"></i>
            שעתון
          </h1>
          <p className="timesheet-subtitle">ניהול רישומי שעות עבודה</p>
        </div>
        <Button
          variant="primary"
          icon={<i className="fas fa-plus"></i>}
          onClick={() => setIsModalOpen(true)}
        >
          רישום חדש
        </Button>
      </div>

      <div className="timesheet-controls">
        <div className="timesheet-filters">
          <button
            className={`filter-btn ${filter === 'today' ? 'active' : ''}`}
            onClick={() => handleFilterChange('today')}
          >
            <i className="fas fa-calendar-day"></i>
            היום
          </button>
          <button
            className={`filter-btn ${filter === 'month' ? 'active' : ''}`}
            onClick={() => handleFilterChange('month')}
          >
            <i className="fas fa-calendar-alt"></i>
            חודש נוכחי
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            <i className="fas fa-list"></i>
            הכל
          </button>
        </div>

        <div className="timesheet-summary">
          <div className="summary-item">
            <span className="summary-label">סה"כ רישומים:</span>
            <span className="summary-value">{filteredEntries.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">סה"כ שעות:</span>
            <span className="summary-value">{totalHours.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <TimesheetEntryList
        entries={filteredEntries}
        loading={loading}
        onDelete={handleDeleteEntry}
        onEdit={openEditModal}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEntry ? 'עריכת רישום שעות' : 'רישום שעות חדש'}
      >
        <TimesheetEntryForm
          onSubmit={editingEntry ? handleEditEntry : handleCreateEntry}
          onCancel={closeModal}
          initialData={editingEntry || undefined}
          loading={formLoading}
        />
      </Modal>
    </div>
  );
};
