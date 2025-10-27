// Cases List Component
// =====================
// רשימת תיקים/לקוחות

import React from 'react';
import { CaseCard } from './CaseCard';
import { Spinner } from '@components/common';
import type { Client } from '../../types';
import './CasesList.css';

interface CasesListProps {
  cases: Client[];
  loading?: boolean;
  emptyMessage?: string;
  onEdit?: (client: Client) => void;
  onDelete?: (clientId: string) => void;
  onView?: (client: Client) => void;
}

export const CasesList: React.FC<CasesListProps> = ({
  cases,
  loading = false,
  emptyMessage = 'אין תיקים להצגה',
  onEdit,
  onDelete,
  onView,
}) => {
  if (loading) {
    return (
      <div className="cases-list-loading">
        <Spinner size="large" text="טוען תיקים..." />
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="cases-list-empty">
        <i className="fas fa-folder-open"></i>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="cases-list">
      {cases.map((caseItem) => (
        <CaseCard
          key={caseItem.id}
          client={caseItem}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  );
};
