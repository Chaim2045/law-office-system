// Legal Procedure Card Component
// ================================
// כרטיס הליך משפטי

import React, { useState } from 'react';
import { Card, Button, ProgressBar } from '@components/common';
import { StageCard } from './StageCard';
import type { LegalProcedure, Stage } from '../../types';
import './LegalProcedureCard.css';

interface LegalProcedureCardProps {
  procedure: LegalProcedure;
  onView?: (procedure: LegalProcedure) => void;
  onCompleteStage?: (procedureId: string, stageId: string) => void;
  onCancelStage?: (procedureId: string, stageId: string) => void;
  onEditStage?: (procedureId: string, stage: Stage) => void;
}

export const LegalProcedureCard: React.FC<LegalProcedureCardProps> = ({
  procedure,
  onView,
  onCompleteStage,
  onCancelStage,
  onEditStage,
}) => {
  const [showStages, setShowStages] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      active: { label: 'פעיל', className: 'status-active' },
      completed: { label: 'הושלם', className: 'status-completed' },
      cancelled: { label: 'בוטל', className: 'status-cancelled' },
      on_hold: { label: 'בהמתנה', className: 'status-hold' },
    };

    const statusInfo = statusMap[status] || { label: status, className: '' };

    return (
      <span className={`procedure-status-badge ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { label: string; className: string; icon: string }> = {
      low: { label: 'נמוכה', className: 'priority-low', icon: 'fa-arrow-down' },
      medium: { label: 'בינונית', className: 'priority-medium', icon: 'fa-minus' },
      high: { label: 'גבוהה', className: 'priority-high', icon: 'fa-arrow-up' },
      urgent: { label: 'דחוף', className: 'priority-urgent', icon: 'fa-exclamation' },
    };

    const priorityInfo = priorityMap[priority] || { label: priority, className: '', icon: 'fa-minus' };

    return (
      <span className={`procedure-priority-badge ${priorityInfo.className}`}>
        <i className={`fas ${priorityInfo.icon}`}></i>
        {priorityInfo.label}
      </span>
    );
  };

  const formatDate = (date: string | { seconds: number }): string => {
    if (!date) return '';

    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if ('seconds' in date) {
      dateObj = new Date(date.seconds * 1000);
    } else {
      return '';
    }

    return dateObj.toLocaleDateString('he-IL');
  };

  const progressColor =
    procedure.completedStages === procedure.totalStages ? 'success' :
    procedure.completedStages > procedure.totalStages / 2 ? 'primary' :
    'warning';

  return (
    <Card className="legal-procedure-card">
      <div className="procedure-card-header">
        <div className="procedure-card-title">
          <h3>{procedure.title}</h3>
          <span className="procedure-case-number">תיק #{procedure.caseNumber}</span>
        </div>
        <div className="procedure-card-badges">
          {getStatusBadge(procedure.status)}
          {getPriorityBadge(procedure.priority)}
        </div>
      </div>

      <div className="procedure-card-body">
        {/* Client Info */}
        <div className="procedure-info-section">
          <div className="procedure-info-item">
            <i className="fas fa-user"></i>
            <span>{procedure.clientName}</span>
          </div>
          <div className="procedure-info-item">
            <i className="fas fa-user-tie"></i>
            <span>עו"ד: {procedure.assignedTo[0] || 'לא משויך'}</span>
          </div>
        </div>

        {/* Description */}
        {procedure.description && (
          <div className="procedure-description">
            <p>{procedure.description}</p>
          </div>
        )}

        {/* Progress */}
        <div className="procedure-progress-section">
          <h4 className="progress-title">
            <i className="fas fa-tasks"></i>
            התקדמות שלבים
          </h4>
          <ProgressBar
            current={procedure.completedStages}
            total={procedure.totalStages}
            color={progressColor}
          />
          <div className="current-stage-info">
            <span className="current-stage-label">שלב נוכחי:</span>
            <span className="current-stage-value">{procedure.currentStage || 'לא הוגדר'}</span>
          </div>
        </div>

        {/* Dates */}
        <div className="procedure-dates">
          <div className="procedure-date-item">
            <span className="date-label">נוצר:</span>
            <span className="date-value">{formatDate(procedure.createdAt)}</span>
          </div>
          {procedure.dueDate && (
            <div className="procedure-date-item">
              <span className="date-label">תאריך יעד:</span>
              <span className="date-value">{formatDate(procedure.dueDate)}</span>
            </div>
          )}
        </div>

        {/* Stages Toggle */}
        {procedure.stages && procedure.stages.length > 0 && (
          <div className="stages-toggle-section">
            <Button
              variant="secondary"
              size="small"
              onClick={() => setShowStages(!showStages)}
              icon={<i className={`fas fa-chevron-${showStages ? 'up' : 'down'}`}></i>}
              fullWidth
            >
              {showStages ? 'הסתר שלבים' : `הצג שלבים (${procedure.stages.length})`}
            </Button>
          </div>
        )}

        {/* Stages List */}
        {showStages && procedure.stages && procedure.stages.length > 0 && (
          <div className="stages-list">
            {procedure.stages.map((stage, index) => (
              <StageCard
                key={stage.id}
                stage={stage}
                stageNumber={index + 1}
                onComplete={onCompleteStage ? () => onCompleteStage(procedure.id, stage.id) : undefined}
                onCancel={onCancelStage ? () => onCancelStage(procedure.id, stage.id) : undefined}
                onEdit={onEditStage ? () => onEditStage(procedure.id, stage) : undefined}
                disabled={procedure.status === 'completed' || procedure.status === 'cancelled'}
              />
            ))}
          </div>
        )}
      </div>

      <div className="procedure-card-actions">
        {onView && (
          <Button
            variant="primary"
            size="small"
            onClick={() => onView(procedure)}
            icon={<i className="fas fa-eye"></i>}
          >
            צפה בפרטים
          </Button>
        )}
      </div>
    </Card>
  );
};
