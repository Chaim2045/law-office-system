// Legal Procedures List Component
// ==================================
// רשימת הליכים משפטיים

import React from 'react';
import { LegalProcedureCard } from './LegalProcedureCard';
import { Spinner } from '@components/common';
import type { LegalProcedure, Stage } from '../../types';
import './LegalProceduresList.css';

interface LegalProceduresListProps {
  procedures: LegalProcedure[];
  loading?: boolean;
  emptyMessage?: string;
  onView?: (procedure: LegalProcedure) => void;
  onCompleteStage?: (procedureId: string, stageId: string) => void;
  onCancelStage?: (procedureId: string, stageId: string) => void;
  onEditStage?: (procedureId: string, stage: Stage) => void;
}

export const LegalProceduresList: React.FC<LegalProceduresListProps> = ({
  procedures,
  loading = false,
  emptyMessage = 'אין הליכים משפטיים להצגה',
  onView,
  onCompleteStage,
  onCancelStage,
  onEditStage,
}) => {
  if (loading) {
    return (
      <div className="legal-procedures-list-loading">
        <Spinner size="large" text="טוען הליכים משפטיים..." />
      </div>
    );
  }

  if (procedures.length === 0) {
    return (
      <div className="legal-procedures-list-empty">
        <i className="fas fa-gavel"></i>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="legal-procedures-list">
      {procedures.map((procedure) => (
        <LegalProcedureCard
          key={procedure.id}
          procedure={procedure}
          onView={onView}
          onCompleteStage={onCompleteStage}
          onCancelStage={onCancelStage}
          onEditStage={onEditStage}
        />
      ))}
    </div>
  );
};
