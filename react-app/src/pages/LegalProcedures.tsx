// Legal Procedures Page
// ======================
// עמוד ניהול הליכים משפטיים

import React, { useState, useEffect } from 'react';
import { Input, Modal } from '@components/common';
import { LegalProceduresList } from '@components/legal-procedures';
import { useLegalProcedures } from '@hooks/useLegalProcedures';
import type { LegalProcedure, ProcedureStatus, Stage } from '../types';
import './LegalProcedures.css';

export const LegalProcedures: React.FC = () => {
  const {
    filteredProcedures,
    loading,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    loadProcedures,
    completeStage,
    cancelStage,
  } = useLegalProcedures();

  const [viewingProcedure, setViewingProcedure] = useState<LegalProcedure | null>(null);

  useEffect(() => {
    loadProcedures();
  }, [loadProcedures]);

  const handleCompleteStage = async (procedureId: string, stageId: string) => {
    if (!window.confirm('האם לסמן שלב זה כהושלם?')) {
      return;
    }

    try {
      await completeStage(procedureId, stageId);
    } catch (error) {
      console.error('Error completing stage:', error);
    }
  };

  const handleCancelStage = async (procedureId: string, stageId: string) => {
    if (!window.confirm('האם לבטל שלב זה?')) {
      return;
    }

    try {
      await cancelStage(procedureId, stageId);
    } catch (error) {
      console.error('Error cancelling stage:', error);
    }
  };

  const handleEditStage = (procedureId: string, stage: Stage) => {
    // TODO: Implement stage editing
    console.log('Edit stage:', procedureId, stage);
  };

  const handleViewProcedure = (procedure: LegalProcedure) => {
    setViewingProcedure(procedure);
  };

  const closeViewModal = () => {
    setViewingProcedure(null);
  };

  const handleFilterChange = (newFilter: ProcedureStatus | 'all') => {
    setFilter(newFilter);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const getStatusCounts = () => {
    return {
      all: filteredProcedures.length,
      active: filteredProcedures.filter(p => p.status === 'active').length,
      completed: filteredProcedures.filter(p => p.status === 'completed').length,
      on_hold: filteredProcedures.filter(p => p.status === 'on_hold').length,
    };
  };

  const counts = getStatusCounts();

  return (
    <div className="legal-procedures-page">
      <div className="legal-procedures-header">
        <div className="legal-procedures-title">
          <h1>
            <i className="fas fa-gavel"></i>
            הליכים משפטיים
          </h1>
          <p className="legal-procedures-subtitle">ניהול ומעקב אחר הליכים משפטיים</p>
        </div>
      </div>

      <div className="legal-procedures-controls">
        <div className="legal-procedures-search">
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon"></i>
            <Input
              type="text"
              placeholder="חיפוש לפי שם, מספר תיק, כותרת או תיאור..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="legal-procedures-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            <i className="fas fa-list"></i>
            הכל
            <span className="filter-count">{counts.all}</span>
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => handleFilterChange('active')}
          >
            <i className="fas fa-play-circle"></i>
            פעילים
            <span className="filter-count">{counts.active}</span>
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => handleFilterChange('completed')}
          >
            <i className="fas fa-check-circle"></i>
            הושלמו
            <span className="filter-count">{counts.completed}</span>
          </button>
          <button
            className={`filter-btn ${filter === 'on_hold' ? 'active' : ''}`}
            onClick={() => handleFilterChange('on_hold')}
          >
            <i className="fas fa-pause-circle"></i>
            בהמתנה
            <span className="filter-count">{counts.on_hold}</span>
          </button>
        </div>
      </div>

      <LegalProceduresList
        procedures={filteredProcedures}
        loading={loading}
        onView={handleViewProcedure}
        onCompleteStage={handleCompleteStage}
        onCancelStage={handleCancelStage}
        onEditStage={handleEditStage}
      />

      {/* View Modal */}
      {viewingProcedure && (
        <Modal
          isOpen={!!viewingProcedure}
          onClose={closeViewModal}
          title={`${viewingProcedure.title} - תיק #${viewingProcedure.caseNumber}`}
          size="large"
        >
          <div className="procedure-view-details">
            <div className="view-section">
              <h3>פרטי הליך</h3>
              <div className="view-info-grid">
                <div className="view-info-item">
                  <span className="view-label">לקוח:</span>
                  <span className="view-value">{viewingProcedure.clientName}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">מספר תיק:</span>
                  <span className="view-value">{viewingProcedure.caseNumber}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">סטטוס:</span>
                  <span className="view-value">{viewingProcedure.status}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">עדיפות:</span>
                  <span className="view-value">{viewingProcedure.priority}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">עו"ד מטפל:</span>
                  <span className="view-value">
                    {viewingProcedure.assignedTo[0] || 'לא משויך'}
                  </span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">שלב נוכחי:</span>
                  <span className="view-value">{viewingProcedure.currentStage}</span>
                </div>
              </div>
            </div>

            {viewingProcedure.description && (
              <div className="view-section">
                <h3>תיאור</h3>
                <p>{viewingProcedure.description}</p>
              </div>
            )}

            <div className="view-section">
              <h3>התקדמות</h3>
              <div className="view-info-grid">
                <div className="view-info-item">
                  <span className="view-label">סה"כ שלבים:</span>
                  <span className="view-value">{viewingProcedure.totalStages}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">שלבים שהושלמו:</span>
                  <span className="view-value">{viewingProcedure.completedStages}</span>
                </div>
              </div>
            </div>

            {viewingProcedure.stages && viewingProcedure.stages.length > 0 && (
              <div className="view-section">
                <h3>שלבים</h3>
                <div className="view-stages-list">
                  {viewingProcedure.stages.map((stage, index) => (
                    <div key={stage.id} className="view-stage-item">
                      <div className="view-stage-header">
                        <span className="view-stage-number">שלב {index + 1}</span>
                        <span className={`view-stage-status status-${stage.status}`}>
                          {stage.status}
                        </span>
                      </div>
                      <div className="view-stage-name">{stage.name}</div>
                      {stage.description && (
                        <div className="view-stage-description">{stage.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
