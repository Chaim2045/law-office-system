// Timesheet Entry Card Component
// ================================
// כרטיס רישום שעות בודד

import React from 'react';
import { Card, Button } from '@components/common';
import type { TimesheetEntry } from '../../types';
import './TimesheetEntryCard.css';

interface TimesheetEntryCardProps {
  entry: TimesheetEntry;
  onDelete?: (entryId: string) => void;
  onEdit?: (entry: TimesheetEntry) => void;
}

export const TimesheetEntryCard: React.FC<TimesheetEntryCardProps> = ({
  entry,
  onDelete,
  onEdit,
}) => {
  const formatTime = (hours: number, minutes: number): string => {
    const parts: string[] = [];
    if (hours) parts.push(`${hours} שעות`);
    if (minutes) parts.push(`${minutes} דקות`);
    return parts.join(' ו-') || '0 דקות';
  };

  const formatDate = (date: string | Date | { seconds: number }): string => {
    if (!date) return '';
    let dateObj: Date;
    if (typeof date === 'string') dateObj = new Date(date);
    else if (date instanceof Date) dateObj = date;
    else if ('seconds' in date) dateObj = new Date(date.seconds * 1000);
    else return '';
    return dateObj.toLocaleDateString('he-IL');
  };

  return (
    <Card className="timesheet-entry-card">
      <div className="entry-header">
        <div className="entry-client">
          <i className="fas fa-folder"></i>
          <span className="entry-client-name">{entry.clientName}</span>
        </div>
        <div className="entry-date">{formatDate(entry.date)}</div>
      </div>

      <div className="entry-body">
        <p className="entry-description">{entry.taskDescription}</p>
        <div className="entry-time">
          <i className="fas fa-clock"></i>
          <span>{formatTime(entry.hours, entry.minutes)}</span>
        </div>
        {entry.notes && <p className="entry-notes">{entry.notes}</p>}
      </div>

      <div className="entry-actions">
        {onEdit && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => onEdit(entry)}
            icon={<i className="fas fa-edit"></i>}
          >
            ערוך
          </Button>
        )}
        {onDelete && (
          <Button
            variant="danger"
            size="small"
            onClick={() => onDelete(entry.id)}
            icon={<i className="fas fa-trash"></i>}
          >
            מחק
          </Button>
        )}
      </div>
    </Card>
  );
};
