// Timesheet Entry Form Component
// =================================
// טופס רישום שעות

import React, { useState, useEffect } from 'react';
import { Button, Input } from '@components/common';
import { useClients } from '@hooks/useClients';
import type { TimesheetFormData } from '../../types';
import './TimesheetEntryForm.css';

interface TimesheetEntryFormProps {
  onSubmit: (data: TimesheetFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<TimesheetFormData>;
  loading?: boolean;
}

export const TimesheetEntryForm: React.FC<TimesheetEntryFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  loading = false,
}) => {
  const { clients, loadClients } = useClients();

  const [formData, setFormData] = useState<TimesheetFormData>({
    clientId: initialData?.clientId || '',
    taskDescription: initialData?.taskDescription || '',
    hours: initialData?.hours || 0,
    minutes: initialData?.minutes || 0,
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
    budgetTaskId: initialData?.budgetTaskId || undefined,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof TimesheetFormData, string>>>({});

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        clientId: initialData.clientId || '',
        taskDescription: initialData.taskDescription || '',
        hours: initialData.hours || 0,
        minutes: initialData.minutes || 0,
        date: initialData.date || new Date().toISOString().split('T')[0],
        notes: initialData.notes || '',
        budgetTaskId: initialData.budgetTaskId || undefined,
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof TimesheetFormData, string>> = {};

    if (!formData.clientId.trim()) {
      newErrors.clientId = 'נא לבחור לקוח';
    }

    if (!formData.taskDescription.trim()) {
      newErrors.taskDescription = 'נא להזין תיאור משימה';
    }

    if (formData.hours === 0 && formData.minutes === 0) {
      newErrors.hours = 'נא להזין זמן (שעות או דקות)';
    }

    if (formData.minutes < 0 || formData.minutes >= 60) {
      newErrors.minutes = 'דקות חייבות להיות בין 0 ל-59';
    }

    if (formData.hours < 0) {
      newErrors.hours = 'שעות חייבות להיות חיוביות';
    }

    if (!formData.date) {
      newErrors.date = 'נא לבחור תאריך';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting timesheet entry:', error);
    }
  };

  const handleChange = (field: keyof TimesheetFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form className="timesheet-entry-form" onSubmit={handleSubmit}>
      {/* Client Selection */}
      <div className="form-group">
        <label className="form-label">
          לקוח <span className="required">*</span>
        </label>
        <select
          className="form-select"
          value={formData.clientId}
          onChange={(e) => handleChange('clientId', e.target.value)}
          disabled={loading}
        >
          <option value="">בחר לקוח...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.clientName} (תיק #{client.caseNumber})
            </option>
          ))}
        </select>
        {errors.clientId && <span className="error-text">{errors.clientId}</span>}
      </div>

      {/* Task Description */}
      <div className="form-group">
        <label className="form-label">
          תיאור משימה <span className="required">*</span>
        </label>
        <textarea
          className="form-textarea"
          value={formData.taskDescription}
          onChange={(e) => handleChange('taskDescription', e.target.value)}
          placeholder="תאר את העבודה שבוצעה..."
          disabled={loading}
          rows={3}
        />
        {errors.taskDescription && <span className="error-text">{errors.taskDescription}</span>}
      </div>

      {/* Date */}
      <div className="form-group">
        <label className="form-label">
          תאריך <span className="required">*</span>
        </label>
        <Input
          type="date"
          value={formData.date}
          onChange={(e) => handleChange('date', e.target.value)}
          disabled={loading}
        />
        {errors.date && <span className="error-text">{errors.date}</span>}
      </div>

      {/* Time - Hours and Minutes */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            שעות <span className="required">*</span>
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={formData.hours.toString()}
            onChange={(e) => handleChange('hours', parseInt(e.target.value) || 0)}
            placeholder="0"
            disabled={loading}
          />
          {errors.hours && <span className="error-text">{errors.hours}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">
            דקות <span className="required">*</span>
          </label>
          <Input
            type="number"
            min="0"
            max="59"
            step="1"
            value={formData.minutes.toString()}
            onChange={(e) => handleChange('minutes', parseInt(e.target.value) || 0)}
            placeholder="0"
            disabled={loading}
          />
          {errors.minutes && <span className="error-text">{errors.minutes}</span>}
        </div>
      </div>

      {/* Notes */}
      <div className="form-group">
        <label className="form-label">הערות</label>
        <textarea
          className="form-textarea"
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="הערות נוספות (אופציונלי)..."
          disabled={loading}
          rows={2}
        />
      </div>

      {/* Budget Task ID (Hidden field, can be set programmatically) */}
      {formData.budgetTaskId && (
        <input type="hidden" value={formData.budgetTaskId} />
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          {initialData ? 'עדכן רישום' : 'צור רישום'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading} fullWidth>
            ביטול
          </Button>
        )}
      </div>
    </form>
  );
};
