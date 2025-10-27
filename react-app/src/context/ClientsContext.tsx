// Clients Context
// ================
// ניהול מצב גלובלי של לקוחות

import React, { createContext, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import * as clientsService from '@services/api/clientsService';
import type { Client, ClientFormData, CaseStatus } from '../types';

interface ClientsContextType {
  clients: Client[];
  loading: boolean;
  error: string | null;
  filter: CaseStatus | 'all';
  setFilter: (filter: CaseStatus | 'all') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  loadClients: () => Promise<void>;
  createClient: (clientData: ClientFormData) => Promise<Client>;
  updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  getClientById: (clientId: string) => Client | undefined;
  searchClients: (term: string) => Promise<void>;
  filteredClients: Client[];
}

export const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

interface ClientsProviderProps {
  children: React.ReactNode;
}

export const ClientsProvider: React.FC<ClientsProviderProps> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CaseStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * טעינת כל הלקוחות
   */
  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedClients = await clientsService.getClients();
      setClients(fetchedClients);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת לקוחות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * יצירת לקוח חדש
   */
  const createClient = useCallback(async (clientData: ClientFormData): Promise<Client> => {
    setLoading(true);
    setError(null);

    try {
      const newClient = await clientsService.createClient(clientData);
      setClients(prev => [...prev, newClient]);
      toast.success('לקוח נוצר בהצלחה');
      return newClient;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה ביצירת לקוח';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * עדכון לקוח קיים
   */
  const updateClient = useCallback(
    async (clientId: string, updates: Partial<Client>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedClient = await clientsService.updateClient(clientId, updates);

        setClients(prev =>
          prev.map(client => (client.id === clientId ? updatedClient : client))
        );

        toast.success('לקוח עודכן בהצלחה');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בעדכון לקוח';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * מחיקת לקוח
   */
  const deleteClient = useCallback(async (clientId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await clientsService.deleteClient(clientId);
      setClients(prev => prev.filter(client => client.id !== clientId));
      toast.success('לקוח נמחק בהצלחה');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה במחיקת לקוח';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * קבלת לקוח לפי ID (מתוך המטמון)
   */
  const getClientById = useCallback(
    (clientId: string): Client | undefined => {
      return clients.find(client => client.id === clientId);
    },
    [clients]
  );

  /**
   * חיפוש לקוחות
   */
  const searchClients = useCallback(async (term: string): Promise<void> => {
    setSearchTerm(term);

    if (!term.trim()) {
      await loadClients();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await clientsService.searchClients(term);
      setClients(results);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בחיפוש לקוחות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loadClients]);

  /**
   * לקוחות מסוננים
   */
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Filter by status
    if (filter !== 'all') {
      result = result.filter(client => client.status === filter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        client =>
          client.clientName.toLowerCase().includes(term) ||
          client.caseNumber.toLowerCase().includes(term) ||
          client.phone.includes(term) ||
          client.email.toLowerCase().includes(term)
      );
    }

    // Sort by last modified (most recent first)
    result.sort((a, b) => {
      const aDate = typeof a.lastModifiedAt === 'string'
        ? new Date(a.lastModifiedAt).getTime()
        : a.lastModifiedAt.seconds * 1000;
      const bDate = typeof b.lastModifiedAt === 'string'
        ? new Date(b.lastModifiedAt).getTime()
        : b.lastModifiedAt.seconds * 1000;
      return bDate - aDate;
    });

    return result;
  }, [clients, filter, searchTerm]);

  const value: ClientsContextType = {
    clients,
    loading,
    error,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    loadClients,
    createClient,
    updateClient,
    deleteClient,
    getClientById,
    searchClients,
    filteredClients,
  };

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
};
