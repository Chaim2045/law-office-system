// useTimesheet Hook
// ==================
// Custom hook for accessing timesheet context

import { useContext } from 'react';
import { TimesheetContext } from '@context/TimesheetContext';

/**
 * Custom hook to access TimesheetContext
 * @throws Error if used outside TimesheetProvider
 * @returns TimesheetContext value
 *
 * @example
 * const {
 *   entries,
 *   loading,
 *   filteredEntries,
 *   filter,
 *   setFilter,
 *   loadEntries,
 *   createTimesheetEntry,
 *   updateTimesheetEntry,
 *   deleteTimesheetEntry
 * } = useTimesheet();
 *
 * // Load entries
 * useEffect(() => {
 *   loadEntries();
 * }, [loadEntries]);
 *
 * // Create new entry
 * await createTimesheetEntry({
 *   clientId: '2025001',
 *   taskDescription: 'ייעוץ טלפוני',
 *   hours: 1,
 *   minutes: 30,
 *   date: '2025-01-20',
 * });
 *
 * // Filter entries
 * setFilter('today');
 */
export const useTimesheet = () => {
  const context = useContext(TimesheetContext);

  if (context === undefined) {
    throw new Error('useTimesheet must be used within a TimesheetProvider');
  }

  return context;
};
