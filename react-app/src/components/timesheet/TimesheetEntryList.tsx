// Timesheet Entry List Component
// ================================
// רשימת רישומי שעות

import React from 'react';
import { TimesheetEntryCard } from './TimesheetEntryCard';
import { Spinner } from '@components/common';
import type { TimesheetEntry } from '../../types';
import './TimesheetEntryList.css';

interface TimesheetEntryListProps {
  entries: TimesheetEntry[];
  loading?: boolean;
  emptyMessage?: string;
  onDelete?: (entryId: string) => void;
  onEdit?: (entry: TimesheetEntry) => void;
}

export const TimesheetEntryList: React.FC<TimesheetEntryListProps> = ({
  entries,
  loading = false,
  emptyMessage = 'אין רישומי שעות להצגה',
  onDelete,
  onEdit,
}) => {
  if (loading) {
    return (
      <div className="timesheet-entry-list-loading">
        <Spinner size="large" text="טוען רישומי שעות..." />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="timesheet-entry-list-empty">
        <i className="fas fa-clock"></i>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="timesheet-entry-list">
      {entries.map((entry) => (
        <TimesheetEntryCard
          key={entry.id}
          entry={entry}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};
