// Stage Card Component
// =====================
// כרטיס שלב בהליך משפטי

import React from 'react';
import { Button } from '@components/common';
import type { Stage } from '../../types';
import './StageCard.css';

interface StageCardProps {
  stage: Stage;
  stageNumber: number;
  onComplete?: (stageId: string) => void;
  onCancel?: (stageId: string) => void;
  onEdit?: (stage: Stage) => void;
  disabled?: boolean;
}

export const StageCard: React.FC<StageCardProps> = ({
  stage,
  stageNumber,
  onComplete,
  onCancel,
  onEdit,
  disabled = false,
}) => {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string; icon: string }> = {
      pending: {
        label: 'ממתין',
        className: 'status-pending',
        icon: 'fa-hourglass-half',
      },
      active: {
        label: 'פעיל',
        className: 'status-active',
        icon: 'fa-play-circle',
      },
      completed: {
        label: 'הושלם',
        className: 'status-completed',
        icon: 'fa-check-circle',
      },
      cancelled: {
        label: 'בוטל',
        className: 'status-cancelled',
        icon: 'fa-times-circle',
      },
    };

    const statusInfo = statusMap[status] || { label: status, className: '', icon: 'fa-circle' };

    return (
      <span className={`stage-status-badge ${statusInfo.className}`}>
        <i className={`fas ${statusInfo.icon}`}></i>
        {statusInfo.label}
      </span>
    );
  };

  const formatDate = (date?: string): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('he-IL');
  };

  const canComplete = stage.status === 'active' && !disabled;
  const canCancel = (stage.status === 'active' || stage.status === 'pending') && !disabled;

  return (
    <div className={`stage-card stage-${stage.status}`}>
      <div className="stage-card-header">
        <div className="stage-number">שלב {stageNumber}</div>
        {getStatusBadge(stage.status)}
      </div>

      <div className="stage-card-body">
        <h3 className="stage-name">{stage.name}</h3>

        {stage.description && (
          <p className="stage-description">{stage.description}</p>
        )}

        <div className="stage-info">
          {/* Pricing Info */}
          {stage.pricingType === 'hourly' && (
            <div className="stage-info-item">
              <i className="fas fa-clock"></i>
              <div className="stage-info-content">
                <span className="info-label">שעות:</span>
                <span className="info-value">
                  {stage.hoursUsed || 0} / {stage.totalHours || 0}
                  {stage.hoursRemaining !== undefined && (
                    <span className="info-remaining"> (נותר: {stage.hoursRemaining})</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {stage.pricingType === 'fixed' && (
            <div className="stage-info-item">
              <i className="fas fa-shekel-sign"></i>
              <div className="stage-info-content">
                <span className="info-label">מחיר:</span>
                <span className="info-value">
                  ₪{stage.fixedPrice?.toLocaleString()}
                  {stage.paid && (
                    <span className="paid-badge">
                      <i className="fas fa-check"></i> שולם
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Dates */}
          {stage.startDate && (
            <div className="stage-info-item">
              <i className="fas fa-calendar-alt"></i>
              <div className="stage-info-content">
                <span className="info-label">תאריך התחלה:</span>
                <span className="info-value">{formatDate(stage.startDate)}</span>
              </div>
            </div>
          )}

          {stage.completionDate && (
            <div className="stage-info-item">
              <i className="fas fa-calendar-check"></i>
              <div className="stage-info-content">
                <span className="info-label">תאריך סיום:</span>
                <span className="info-value">{formatDate(stage.completionDate)}</span>
              </div>
            </div>
          )}

          {stage.paymentDate && stage.pricingType === 'fixed' && (
            <div className="stage-info-item">
              <i className="fas fa-money-check"></i>
              <div className="stage-info-content">
                <span className="info-label">תאריך תשלום:</span>
                <span className="info-value">{formatDate(stage.paymentDate)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {(canComplete || canCancel || onEdit) && (
        <div className="stage-card-actions">
          {canComplete && onComplete && (
            <Button
              variant="success"
              size="small"
              onClick={() => onComplete(stage.id)}
              icon={<i className="fas fa-check"></i>}
            >
              סיים שלב
            </Button>
          )}
          {onEdit && stage.status !== 'completed' && stage.status !== 'cancelled' && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => onEdit(stage)}
              icon={<i className="fas fa-edit"></i>}
              disabled={disabled}
            >
              ערוך
            </Button>
          )}
          {canCancel && onCancel && (
            <Button
              variant="danger"
              size="small"
              onClick={() => onCancel(stage.id)}
              icon={<i className="fas fa-times"></i>}
            >
              בטל
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
