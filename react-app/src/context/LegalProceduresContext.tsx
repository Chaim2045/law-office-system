// Legal Procedures Context
// =========================
// ניהול מצב גלובלי של הליכים משפטיים

import React, { createContext, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import * as legalProceduresService from '@services/api/legalProceduresService';
import type { LegalProcedure, ProcedureStatus, Stage } from '../types';

interface LegalProceduresContextType {
  procedures: LegalProcedure[];
  loading: boolean;
  error: string | null;
  filter: ProcedureStatus | 'all';
  setFilter: (filter: ProcedureStatus | 'all') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  loadProcedures: () => Promise<void>;
  updateProcedure: (procedureId: string, updates: Partial<LegalProcedure>) => Promise<void>;
  updateStage: (procedureId: string, stageId: string, updates: Partial<Stage>) => Promise<void>;
  completeStage: (procedureId: string, stageId: string) => Promise<void>;
  cancelStage: (procedureId: string, stageId: string, reason?: string) => Promise<void>;
  getProcedureById: (procedureId: string) => LegalProcedure | undefined;
  searchProcedures: (term: string) => Promise<void>;
  filteredProcedures: LegalProcedure[];
}

export const LegalProceduresContext = createContext<LegalProceduresContextType | undefined>(
  undefined
);

interface LegalProceduresProviderProps {
  children: React.ReactNode;
}

export const LegalProceduresProvider: React.FC<LegalProceduresProviderProps> = ({ children }) => {
  const [procedures, setProcedures] = useState<LegalProcedure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProcedureStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * טעינת כל ההליכים המשפטיים
   */
  const loadProcedures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedProcedures = await legalProceduresService.getLegalProcedures();
      setProcedures(fetchedProcedures);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת הליכים משפטיים';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * עדכון הליך משפטי
   */
  const updateProcedure = useCallback(
    async (procedureId: string, updates: Partial<LegalProcedure>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedProcedure = await legalProceduresService.updateLegalProcedure(
          procedureId,
          updates
        );

        setProcedures(prev =>
          prev.map(procedure =>
            procedure.id === procedureId ? updatedProcedure : procedure
          )
        );

        toast.success('הליך עודכן בהצלחה');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בעדכון הליך';
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
   * עדכון שלב בהליך
   */
  const updateStage = useCallback(
    async (procedureId: string, stageId: string, updates: Partial<Stage>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedProcedure = await legalProceduresService.updateStage(
          procedureId,
          stageId,
          updates
        );

        setProcedures(prev =>
          prev.map(procedure =>
            procedure.id === procedureId ? updatedProcedure : procedure
          )
        );

        toast.success('שלב עודכן בהצלחה');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בעדכון שלב';
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
   * השלמת שלב
   */
  const completeStage = useCallback(
    async (procedureId: string, stageId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedProcedure = await legalProceduresService.completeStage(
          procedureId,
          stageId
        );

        setProcedures(prev =>
          prev.map(procedure =>
            procedure.id === procedureId ? updatedProcedure : procedure
          )
        );

        toast.success('שלב הושלם בהצלחה');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בהשלמת שלב';
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
   * ביטול שלב
   */
  const cancelStage = useCallback(
    async (procedureId: string, stageId: string, reason?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedProcedure = await legalProceduresService.cancelStage(
          procedureId,
          stageId,
          reason
        );

        setProcedures(prev =>
          prev.map(procedure =>
            procedure.id === procedureId ? updatedProcedure : procedure
          )
        );

        toast.success('שלב בוטל');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בביטול שלב';
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
   * קבלת הליך לפי ID (מתוך המטמון)
   */
  const getProcedureById = useCallback(
    (procedureId: string): LegalProcedure | undefined => {
      return procedures.find(procedure => procedure.id === procedureId);
    },
    [procedures]
  );

  /**
   * חיפוש הליכים משפטיים
   */
  const searchProcedures = useCallback(
    async (term: string): Promise<void> => {
      setSearchTerm(term);

      if (!term.trim()) {
        await loadProcedures();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await legalProceduresService.searchLegalProcedures(term);
        setProcedures(results);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בחיפוש הליכים';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [loadProcedures]
  );

  /**
   * הליכים מסוננים
   */
  const filteredProcedures = useMemo(() => {
    let result = [...procedures];

    // Filter by status
    if (filter !== 'all') {
      result = result.filter(procedure => procedure.status === filter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        procedure =>
          procedure.clientName.toLowerCase().includes(term) ||
          procedure.caseNumber.toLowerCase().includes(term) ||
          procedure.title.toLowerCase().includes(term) ||
          procedure.description.toLowerCase().includes(term)
      );
    }

    // Sort by last modified (most recent first)
    result.sort((a, b) => {
      const aDate =
        typeof a.lastModifiedAt === 'string'
          ? new Date(a.lastModifiedAt).getTime()
          : a.lastModifiedAt.seconds * 1000;
      const bDate =
        typeof b.lastModifiedAt === 'string'
          ? new Date(b.lastModifiedAt).getTime()
          : b.lastModifiedAt.seconds * 1000;
      return bDate - aDate;
    });

    return result;
  }, [procedures, filter, searchTerm]);

  const value: LegalProceduresContextType = {
    procedures,
    loading,
    error,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    loadProcedures,
    updateProcedure,
    updateStage,
    completeStage,
    cancelStage,
    getProcedureById,
    searchProcedures,
    filteredProcedures,
  };

  return (
    <LegalProceduresContext.Provider value={value}>
      {children}
    </LegalProceduresContext.Provider>
  );
};
