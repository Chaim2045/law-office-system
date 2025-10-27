// Case Card Component
// ====================
// כרטיס תיק/לקוח

import React from 'react';
import { Card, Button } from '@components/common';
import type { Client } from '../../types';
import './CaseCard.css';

interface CaseCardProps {
  client: Client;
  onEdit?: (client: Client) => void;
  onDelete?: (clientId: string) => void;
  onView?: (client: Client) => void;
}

export const CaseCard: React.FC<CaseCardProps> = ({
  client,
  onEdit,
  onDelete,
  onView,
}) => {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      active: { label: 'פעיל', className: 'status-active' },
      inactive: { label: 'לא פעיל', className: 'status-inactive' },
      completed: { label: 'הושלם', className: 'status-completed' },
      on_hold: { label: 'בהמתנה', className: 'status-hold' },
    };

    const statusInfo = statusMap[status] || { label: status, className: '' };

    return (
      <span className={`case-status-badge ${statusInfo.className}`}>
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
      <span className={`case-priority-badge ${priorityInfo.className}`}>
        <i className={`fas ${priorityInfo.icon}`}></i>
        {priorityInfo.label}
      </span>
    );
  };

  const getProcedureTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      hours: 'תוכנית שעות',
      fixed: 'מחיר פיקס',
      legal_procedure: 'הליך משפטי',
    };

    return typeMap[type] || type;
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

  return (
    <Card className="case-card">
      <div className="case-card-header">
        <div className="case-card-title">
          <h3>{client.clientName}</h3>
          <span className="case-number">תיק #{client.caseNumber}</span>
        </div>
        <div className="case-card-badges">
          {getStatusBadge(client.status)}
          {getPriorityBadge(client.priority)}
        </div>
      </div>

      <div className="case-card-body">
        {/* Contact Info */}
        <div className="case-info-section">
          {client.phone && (
            <div className="case-info-item">
              <i className="fas fa-phone"></i>
              <span>{client.phone}</span>
            </div>
          )}
          {client.email && (
            <div className="case-info-item">
              <i className="fas fa-envelope"></i>
              <span>{client.email}</span>
            </div>
          )}
        </div>

        {/* Procedure Type */}
        <div className="case-info-section">
          <div className="case-info-item">
            <i className="fas fa-gavel"></i>
            <span className="procedure-type">{getProcedureTypeLabel(client.procedureType)}</span>
          </div>
        </div>

        {/* Description */}
        {client.description && (
          <div className="case-description">
            <p>{client.description}</p>
          </div>
        )}

        {/* Hours Info (for 'hours' type) */}
        {client.procedureType === 'hours' && client.hoursRemaining !== undefined && (
          <div className="case-hours-info">
            <div className="hours-progress">
              <div className="hours-label">שעות נותרות</div>
              <div className="hours-value">{client.hoursRemaining.toFixed(1)} שעות</div>
            </div>
          </div>
        )}

        {/* Legal Procedure Info */}
        {client.procedureType === 'legal_procedure' && client.currentStage && (
          <div className="case-stage-info">
            <i className="fas fa-layer-group"></i>
            <span>שלב נוכחי: {client.currentStage}</span>
          </div>
        )}

        {/* Assigned Attorney */}
        <div className="case-info-section">
          <div className="case-info-item">
            <i className="fas fa-user-tie"></i>
            <span>עו"ד: {client.mainAttorney}</span>
          </div>
        </div>

        {/* Dates */}
        <div className="case-dates">
          <div className="case-date-item">
            <span className="date-label">נוצר:</span>
            <span className="date-value">{formatDate(client.createdAt)}</span>
          </div>
          <div className="case-date-item">
            <span className="date-label">עודכן:</span>
            <span className="date-value">{formatDate(client.lastModifiedAt)}</span>
          </div>
        </div>
      </div>

      <div className="case-card-actions">
        {onView && (
          <Button
            variant="primary"
            size="small"
            onClick={() => onView(client)}
            icon={<i className="fas fa-eye"></i>}
          >
            צפה
          </Button>
        )}
        {onEdit && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => onEdit(client)}
            icon={<i className="fas fa-edit"></i>}
          >
            ערוך
          </Button>
        )}
        {onDelete && (
          <Button
            variant="danger"
            size="small"
            onClick={() => onDelete(client.id)}
            icon={<i className="fas fa-trash"></i>}
          >
            מחק
          </Button>
        )}
      </div>
    </Card>
  );
};
