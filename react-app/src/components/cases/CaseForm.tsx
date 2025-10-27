// Case Form Component
// ====================
// טופס יצירה/עריכה של תיק לקוח

import React, { useState, useEffect } from 'react';
import { Button, Input } from '@components/common';
import type { ClientFormData, ProcedureType, PricingType } from '../../types';
import './CaseForm.css';

interface CaseFormProps {
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<ClientFormData>;
  loading?: boolean;
}

export const CaseForm: React.FC<CaseFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  loading = false,
}) => {
  const [formData, setFormData] = useState<ClientFormData>({
    clientName: initialData?.clientName || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    procedureType: initialData?.procedureType || 'hours',
    description: initialData?.description || '',
    totalHours: initialData?.totalHours || 10,
    serviceName: initialData?.serviceName || '',
    pricingType: initialData?.pricingType || 'hourly',
    stages: initialData?.stages || [
      { description: '', hours: 0, fixedPrice: 0 },
      { description: '', hours: 0, fixedPrice: 0 },
      { description: '', hours: 0, fixedPrice: 0 },
    ],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        clientName: initialData.clientName || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        procedureType: initialData.procedureType || 'hours',
        description: initialData.description || '',
        totalHours: initialData.totalHours || 10,
        serviceName: initialData.serviceName || '',
        pricingType: initialData.pricingType || 'hourly',
        stages: initialData.stages || [
          { description: '', hours: 0, fixedPrice: 0 },
          { description: '', hours: 0, fixedPrice: 0 },
          { description: '', hours: 0, fixedPrice: 0 },
        ],
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ClientFormData, string>> = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'נא להזין שם לקוח';
    }

    if (formData.procedureType === 'hours') {
      if (!formData.totalHours || formData.totalHours < 1) {
        newErrors.totalHours = 'נא להזין מספר שעות תקין';
      }
    }

    if (formData.procedureType === 'legal_procedure') {
      if (!formData.stages || formData.stages.length !== 3) {
        newErrors.stages = 'נדרשים 3 שלבים להליך משפטי';
      } else {
        const hasInvalidStage = formData.stages.some((stage, index) => {
          if (!stage.description || stage.description.trim().length < 2) {
            newErrors.stages = `שלב ${index + 1}: נא להזין תיאור שלב`;
            return true;
          }

          if (formData.pricingType === 'hourly') {
            if (!stage.hours || stage.hours <= 0) {
              newErrors.stages = `שלב ${index + 1}: נא להזין מספר שעות תקין`;
              return true;
            }
          } else if (formData.pricingType === 'fixed') {
            if (!stage.fixedPrice || stage.fixedPrice <= 0) {
              newErrors.stages = `שלב ${index + 1}: נא להזין מחיר תקין`;
              return true;
            }
          }

          return false;
        });

        if (hasInvalidStage) {
          // Error already set
        }
      }
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
      console.error('Error submitting case form:', error);
    }
  };

  const handleChange = (field: keyof ClientFormData, value: unknown) => {
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

  const handleProcedureTypeChange = (type: ProcedureType) => {
    setFormData((prev) => ({
      ...prev,
      procedureType: type,
    }));
  };

  const handleStageChange = (index: number, field: 'description' | 'hours' | 'fixedPrice', value: string | number) => {
    setFormData((prev) => {
      const newStages = [...(prev.stages || [])];
      newStages[index] = {
        ...newStages[index],
        [field]: value,
      };
      return {
        ...prev,
        stages: newStages,
      };
    });

    // Clear stages error
    if (errors.stages) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.stages;
        return newErrors;
      });
    }
  };

  return (
    <form className="case-form" onSubmit={handleSubmit}>
      {/* Client Information */}
      <div className="form-section">
        <h3 className="form-section-title">פרטי לקוח</h3>

        <div className="form-group">
          <label className="form-label">
            שם לקוח <span className="required">*</span>
          </label>
          <Input
            type="text"
            value={formData.clientName}
            onChange={(e) => handleChange('clientName', e.target.value)}
            placeholder="הזן שם מלא"
            disabled={loading}
          />
          {errors.clientName && <span className="error-text">{errors.clientName}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">טלפון</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="050-1234567"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">אימייל</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@example.com"
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">תיאור התיק</label>
          <textarea
            className="form-textarea"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="תיאור כללי של התיק..."
            disabled={loading}
            rows={3}
          />
        </div>
      </div>

      {/* Procedure Type Selection */}
      <div className="form-section">
        <h3 className="form-section-title">סוג הליך</h3>

        <div className="procedure-type-selector">
          <div
            className={`procedure-type-option ${formData.procedureType === 'hours' ? 'selected' : ''}`}
            onClick={() => !loading && handleProcedureTypeChange('hours')}
          >
            <input
              type="radio"
              name="procedureType"
              value="hours"
              checked={formData.procedureType === 'hours'}
              onChange={() => handleProcedureTypeChange('hours')}
              disabled={loading}
            />
            <div className="procedure-type-content">
              <i className="fas fa-clock"></i>
              <span className="procedure-type-label">תוכנית שעות</span>
              <p className="procedure-type-description">חבילת שעות לשירותים כלליים</p>
            </div>
          </div>

          <div
            className={`procedure-type-option ${formData.procedureType === 'fixed' ? 'selected' : ''}`}
            onClick={() => !loading && handleProcedureTypeChange('fixed')}
          >
            <input
              type="radio"
              name="procedureType"
              value="fixed"
              checked={formData.procedureType === 'fixed'}
              onChange={() => handleProcedureTypeChange('fixed')}
              disabled={loading}
            />
            <div className="procedure-type-content">
              <i className="fas fa-dollar-sign"></i>
              <span className="procedure-type-label">מחיר פיקס</span>
              <p className="procedure-type-description">מחיר קבוע לשירות מוגדר</p>
            </div>
          </div>

          <div
            className={`procedure-type-option ${formData.procedureType === 'legal_procedure' ? 'selected' : ''}`}
            onClick={() => !loading && handleProcedureTypeChange('legal_procedure')}
          >
            <input
              type="radio"
              name="procedureType"
              value="legal_procedure"
              checked={formData.procedureType === 'legal_procedure'}
              onChange={() => handleProcedureTypeChange('legal_procedure')}
              disabled={loading}
            />
            <div className="procedure-type-content">
              <i className="fas fa-gavel"></i>
              <span className="procedure-type-label">הליך משפטי</span>
              <p className="procedure-type-description">הליך משפטי מובנה עם שלבים</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hours Type Fields */}
      {formData.procedureType === 'hours' && (
        <div className="form-section">
          <h3 className="form-section-title">פרטי חבילת שעות</h3>

          <div className="form-group">
            <label className="form-label">שם השירות</label>
            <Input
              type="text"
              value={formData.serviceName || ''}
              onChange={(e) => handleChange('serviceName', e.target.value)}
              placeholder="תוכנית שעות ראשית"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              מספר שעות <span className="required">*</span>
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={formData.totalHours?.toString() || '10'}
              onChange={(e) => handleChange('totalHours', parseInt(e.target.value) || 0)}
              placeholder="10"
              disabled={loading}
            />
            {errors.totalHours && <span className="error-text">{errors.totalHours}</span>}
          </div>
        </div>
      )}

      {/* Legal Procedure Fields */}
      {formData.procedureType === 'legal_procedure' && (
        <div className="form-section">
          <h3 className="form-section-title">שלבי ההליך המשפטי</h3>

          <div className="form-group">
            <label className="form-label">סוג תמחור</label>
            <div className="pricing-type-selector">
              <label className="pricing-type-option">
                <input
                  type="radio"
                  name="pricingType"
                  value="hourly"
                  checked={formData.pricingType === 'hourly'}
                  onChange={(e) => handleChange('pricingType', e.target.value as PricingType)}
                  disabled={loading}
                />
                <span>שעתי</span>
              </label>
              <label className="pricing-type-option">
                <input
                  type="radio"
                  name="pricingType"
                  value="fixed"
                  checked={formData.pricingType === 'fixed'}
                  onChange={(e) => handleChange('pricingType', e.target.value as PricingType)}
                  disabled={loading}
                />
                <span>מחיר פיקס</span>
              </label>
            </div>
          </div>

          {formData.stages?.map((stage, index) => (
            <div key={index} className="stage-form-group">
              <h4 className="stage-title">שלב {index + 1}</h4>

              <div className="form-group">
                <label className="form-label">
                  תיאור השלב <span className="required">*</span>
                </label>
                <Input
                  type="text"
                  value={stage.description}
                  onChange={(e) => handleStageChange(index, 'description', e.target.value)}
                  placeholder={`תיאור שלב ${index + 1}`}
                  disabled={loading}
                />
              </div>

              {formData.pricingType === 'hourly' ? (
                <div className="form-group">
                  <label className="form-label">
                    מספר שעות <span className="required">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={stage.hours?.toString() || '0'}
                    onChange={(e) => handleStageChange(index, 'hours', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">
                    מחיר פיקס (₪) <span className="required">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={stage.fixedPrice?.toString() || '0'}
                    onChange={(e) => handleStageChange(index, 'fixedPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          ))}

          {errors.stages && <span className="error-text">{errors.stages}</span>}
        </div>
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          {initialData ? 'עדכן תיק' : 'צור תיק חדש'}
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
