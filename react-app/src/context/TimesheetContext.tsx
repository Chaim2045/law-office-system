// Timesheet Context
// ===================
// מערכת ניהול רישומי שעות

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import {
  createTimesheetEntry as createEntry,
  getTimesheetEntries as getEntries,
  updateTimesheetEntry as updateEntry,
  deleteTimesheetEntry as deleteEntry,
} from '@services/api/timesheetService';
import type { TimesheetEntry, TimesheetFormData } from '../types';
import { toast } from 'react-toastify';

// ===================================
// Context Types
// ===================================

type TimesheetFilter = 'today' | 'month' | 'all';

interface TimesheetContextType {
  entries: TimesheetEntry[];
  loading: boolean;
  error: string | null;
  filter: TimesheetFilter;
  setFilter: (filter: TimesheetFilter) => void;
  loadEntries: () => Promise<void>;
  createTimesheetEntry: (entryData: TimesheetFormData) => Promise<TimesheetEntry>;
  updateTimesheetEntry: (entryId: string, minutes: number, reason?: string) => Promise<void>;
  deleteTimesheetEntry: (entryId: string) => Promise<void>;
  filteredEntries: TimesheetEntry[];
}

// ===================================
// Create Context
// ===================================

export const TimesheetContext = createContext<TimesheetContextType | undefined>(
  undefined
);

// ===================================
// Timesheet Provider Component
// ===================================

interface TimesheetProviderProps {
  children: ReactNode;
}

export const TimesheetProvider: React.FC<TimesheetProviderProps> = ({ children }) => {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimesheetFilter>('month');

  /**
   * Load all timesheet entries
   */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedEntries = await getEntries();
      setEntries(loadedEntries);
      console.log(`✅ Loaded ${loadedEntries.length} timesheet entries`);
    } catch (err) {
      console.error('❌ Error loading timesheet entries:', err);
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת רישומי שעות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new timesheet entry
   */
  const createTimesheetEntry = useCallback(
    async (entryData: TimesheetFormData): Promise<TimesheetEntry> => {
      setLoading(true);
      setError(null);

      try {
        const newEntry = await createEntry(entryData);
        setEntries((prevEntries) => [newEntry, ...prevEntries]);
        toast.success('רישום שעות נוצר בהצלחה');
        console.log('✅ Created timesheet entry:', newEntry.id);
        return newEntry;
      } catch (err) {
        console.error('❌ Error creating timesheet entry:', err);
        const errorMessage = err instanceof Error ? err.message : 'שגיאה ביצירת רישום שעות';
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
   * Update an existing timesheet entry
   */
  const updateTimesheetEntry = useCallback(
    async (entryId: string, minutes: number, reason?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedEntry = await updateEntry(entryId, minutes, reason);
        setEntries((prevEntries) =>
          prevEntries.map((entry) => (entry.id === entryId ? updatedEntry : entry))
        );
        toast.success('רישום עודכן בהצלחה');
        console.log('✅ Updated timesheet entry:', entryId);
      } catch (err) {
        console.error('❌ Error updating timesheet entry:', err);
        const errorMessage = err instanceof Error ? err.message : 'שגיאה בעדכון רישום';
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
   * Delete a timesheet entry
   */
  const deleteTimesheetEntry = useCallback(async (entryId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await deleteEntry(entryId);
      setEntries((prevEntries) => prevEntries.filter((entry) => entry.id !== entryId));
      toast.success('רישום נמחק בהצלחה');
      console.log('✅ Deleted timesheet entry:', entryId);
    } catch (err) {
      console.error('❌ Error deleting timesheet entry:', err);
      const errorMessage = err instanceof Error ? err.message : 'שגיאה במחיקת רישום';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get filtered entries based on current filter
   */
  const filteredEntries = React.useMemo(() => {
    const now = new Date();

    if (filter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= today;
      });
    }

    if (filter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= monthStart;
      });
    }

    return entries;
  }, [entries, filter]);

  // ===================================
  // Context Value
  // ===================================

  const value: TimesheetContextType = {
    entries,
    loading,
    error,
    filter,
    setFilter,
    loadEntries,
    createTimesheetEntry,
    updateTimesheetEntry,
    deleteTimesheetEntry,
    filteredEntries,
  };

  return <TimesheetContext.Provider value={value}>{children}</TimesheetContext.Provider>;
};
