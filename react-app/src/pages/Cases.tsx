// Cases Page
// ===========
// עמוד ניהול תיקים/לקוחות

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input } from '@components/common';
import { CasesList, CaseForm } from '@components/cases';
import { useClients } from '@hooks/useClients';
import type { Client, ClientFormData, CaseStatus } from '../types';
import './Cases.css';

export const Cases: React.FC = () => {
  const {
    filteredClients,
    loading,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    loadClients,
    createClient,
    updateClient,
    deleteClient,
  } = useClients();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreateClient = async (data: ClientFormData) => {
    setFormLoading(true);
    try {
      await createClient(data);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating client:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClient = async (data: ClientFormData) => {
    if (!editingClient) return;

    setFormLoading(true);
    try {
      // Convert ClientFormData to Partial<Client> for update
      const updateData: Partial<Client> = {
        clientName: data.clientName,
        phone: data.phone,
        email: data.email,
        description: data.description,
        procedureType: data.procedureType,
      };

      await updateClient(editingClient.id, updateData);
      setIsModalOpen(false);
      setEditingClient(null);
    } catch (error) {
      console.error('Error updating client:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק תיק זה? פעולה זו אינה ניתנת לביטול.')) {
      return;
    }

    try {
      await deleteClient(clientId);
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const openViewModal = (client: Client) => {
    setViewingClient(client);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const closeViewModal = () => {
    setViewingClient(null);
  };

  const handleFilterChange = (newFilter: CaseStatus | 'all') => {
    setFilter(newFilter);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const getStatusCounts = () => {
    return {
      all: filteredClients.length,
      active: filteredClients.filter(c => c.status === 'active').length,
      completed: filteredClients.filter(c => c.status === 'completed').length,
      on_hold: filteredClients.filter(c => c.status === 'on_hold').length,
    };
  };

  const counts = getStatusCounts();

  return (
    <div className="cases-page">
      <div className="cases-header">
        <div className="cases-title">
          <h1>
            <i className="fas fa-folder"></i>
            תיקים
          </h1>
          <p className="cases-subtitle">ניהול תיקים ולקוחות</p>
        </div>
        <Button
          variant="primary"
          icon={<i className="fas fa-plus"></i>}
          onClick={() => setIsModalOpen(true)}
        >
          תיק חדש
        </Button>
      </div>

      <div className="cases-controls">
        <div className="cases-search">
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon"></i>
            <Input
              type="text"
              placeholder="חיפוש לפי שם, מספר תיק, טלפון או אימייל..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="cases-filters">
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
            <i className="fas fa-folder-open"></i>
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

      <CasesList
        cases={filteredClients}
        loading={loading}
        onEdit={openEditModal}
        onDelete={handleDeleteClient}
        onView={openViewModal}
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingClient ? 'עריכת תיק' : 'תיק חדש'}
        size="large"
      >
        <CaseForm
          onSubmit={editingClient ? handleEditClient : handleCreateClient}
          onCancel={closeModal}
          initialData={editingClient || undefined}
          loading={formLoading}
        />
      </Modal>

      {/* View Modal */}
      {viewingClient && (
        <Modal
          isOpen={!!viewingClient}
          onClose={closeViewModal}
          title={`תיק #${viewingClient.caseNumber} - ${viewingClient.clientName}`}
          size="large"
        >
          <div className="case-view-details">
            <div className="view-section">
              <h3>פרטי לקוח</h3>
              <div className="view-info-grid">
                <div className="view-info-item">
                  <span className="view-label">שם:</span>
                  <span className="view-value">{viewingClient.clientName}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">מספר תיק:</span>
                  <span className="view-value">{viewingClient.caseNumber}</span>
                </div>
                {viewingClient.phone && (
                  <div className="view-info-item">
                    <span className="view-label">טלפון:</span>
                    <span className="view-value">{viewingClient.phone}</span>
                  </div>
                )}
                {viewingClient.email && (
                  <div className="view-info-item">
                    <span className="view-label">אימייל:</span>
                    <span className="view-value">{viewingClient.email}</span>
                  </div>
                )}
              </div>
            </div>

            {viewingClient.description && (
              <div className="view-section">
                <h3>תיאור</h3>
                <p>{viewingClient.description}</p>
              </div>
            )}

            <div className="view-section">
              <h3>סטטוס ופרטים</h3>
              <div className="view-info-grid">
                <div className="view-info-item">
                  <span className="view-label">סטטוס:</span>
                  <span className="view-value">{viewingClient.status}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">עדיפות:</span>
                  <span className="view-value">{viewingClient.priority}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">סוג הליך:</span>
                  <span className="view-value">{viewingClient.procedureType}</span>
                </div>
                <div className="view-info-item">
                  <span className="view-label">עו"ד מטפל:</span>
                  <span className="view-value">{viewingClient.mainAttorney}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
