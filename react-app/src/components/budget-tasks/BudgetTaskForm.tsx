// Budget Task Form Component
// ===========================
// טופס יצירה/עריכה של משימת תקציב

import React, { useState, FormEvent } from 'react';
import { Button, Input } from '@components/common';
import type { BudgetTaskFormData } from '../../types';
import './BudgetTaskForm.css';

interface BudgetTaskFormProps {
  onSubmit: (data: BudgetTaskFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<BudgetTaskFormData>;
  loading?: boolean;
}

export const BudgetTaskForm: React.FC<BudgetTaskFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  loading = false,
}) => {
  const [formData, setFormData] = useState<BudgetTaskFormData>({
    clientId: initialData?.clientId || '',
    description: initialData?.description || '',
    pricingType: initialData?.pricingType || 'hours',
    hours: initialData?.hours,
    minutes: initialData?.minutes,
    fixedPrice: initialData?.fixedPrice,
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'hours' || name === 'minutes' || name === 'fixedPrice'
        ? value ? Number(value) : undefined
        : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientId || formData.clientId.trim().length === 0) {
      newErrors.clientId = 'חובה להזין מספר תיק';
    }

    if (!formData.description || formData.description.trim().length < 3) {
      newErrors.description = 'תיאור המשימה חייב להכיל לפחות 3 תווים';
    }

    if (formData.pricingType === 'hours') {
      const totalMinutes = (formData.hours || 0) * 60 + (formData.minutes || 0);
      if (totalMinutes <= 0) {
        newErrors.hours = 'יש להזין זמן משוער (שעות או דקות)';
      }
    } else if (formData.pricingType === 'fixed') {
      if (!formData.fixedPrice || formData.fixedPrice <= 0) {
        newErrors.fixedPrice = 'יש להזין מחיר פיקס';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  return (
    <form className="budget-task-form" onSubmit={handleSubmit}>
      <Input
        type="text"
        name="clientId"
        label="מספר תיק"
        placeholder="2025001"
        value={formData.clientId}
        onChange={handleChange}
        error={errors.clientId}
        required
        fullWidth
        disabled={loading}
      />

      <div className="form-group">
        <label className="form-label">
          תיאור המשימה <span className="required">*</span>
        </label>
        <textarea
          name="description"
          className="form-textarea"
          placeholder="תאר את המשימה..."
          value={formData.description}
          onChange={handleChange}
          rows={4}
          required
          disabled={loading}
        />
        {errors.description && <span className="error-text">{errors.description}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">
          סוג תמחור <span className="required">*</span>
        </label>
        <select
          name="pricingType"
          className="form-select"
          value={formData.pricingType}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="hours">שעתי</option>
          <option value="fixed">מחיר פיקס</option>
        </select>
      </div>

      {formData.pricingType === 'hours' && (
        <div className="form-row">
          <Input
            type="number"
            name="hours"
            label="שעות"
            placeholder="0"
            value={formData.hours || ''}
            onChange={handleChange}
            error={errors.hours}
            min={0}
            fullWidth
            disabled={loading}
          />
          <Input
            type="number"
            name="minutes"
            label="דקות"
            placeholder="0"
            value={formData.minutes || ''}
            onChange={handleChange}
            min={0}
            max={59}
            fullWidth
            disabled={loading}
          />
        </div>
      )}

      {formData.pricingType === 'fixed' && (
        <Input
          type="number"
          name="fixedPrice"
          label="מחיר פיקס (₪)"
          placeholder="0"
          value={formData.fixedPrice || ''}
          onChange={handleChange}
          error={errors.fixedPrice}
          min={0}
          step={0.01}
          fullWidth
          disabled={loading}
        />
      )}

      <div className="form-group">
        <label className="form-label">הערות</label>
        <textarea
          name="notes"
          className="form-textarea"
          placeholder="הערות נוספות..."
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          {initialData ? 'עדכן משימה' : 'צור משימה'}
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
