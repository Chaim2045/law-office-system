// Timesheet Service
// ==================
// שירות לניהול רישומי שעות דרך Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '@services/firebase/config';
import type { TimesheetEntry, TimesheetFormData, FirebaseFunctionResponse } from '../../types';

// ===================================
// Firebase Functions Helpers
// ===================================

/**
 * Create a new timesheet entry
 * @param entryData Entry data to create
 * @returns Created entry with ID
 */
export const createTimesheetEntry = async (
  entryData: TimesheetFormData
): Promise<TimesheetEntry> => {
  try {
    const createEntry = httpsCallable<TimesheetFormData, FirebaseFunctionResponse<{ entry: TimesheetEntry }>>(
      functions,
      'createTimesheetEntry'
    );

    const result = await createEntry(entryData);

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה ביצירת רישום שעות');
    }

    return result.data.data.entry;
  } catch (error) {
    console.error('❌ Error creating timesheet entry:', error);
    throw error;
  }
};

/**
 * Get all timesheet entries (filtered by employee automatically on backend)
 * @param filters Optional filters
 * @returns Array of timesheet entries
 */
export const getTimesheetEntries = async (filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<TimesheetEntry[]> => {
  try {
    const getEntries = httpsCallable<
      { status?: string; dateFrom?: string; dateTo?: string },
      FirebaseFunctionResponse<{ entries: TimesheetEntry[] }>
    >(functions, 'getTimesheetEntries');

    const result = await getEntries(filters || {});

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה בטעינת רישומי שעות');
    }

    return result.data.data.entries;
  } catch (error) {
    console.error('❌ Error getting timesheet entries:', error);
    throw error;
  }
};

/**
 * Update a timesheet entry
 * @param entryId Entry ID
 * @param minutes New minutes value
 * @param reason Edit reason
 * @returns Updated entry
 */
export const updateTimesheetEntry = async (
  entryId: string,
  minutes: number,
  reason?: string
): Promise<TimesheetEntry> => {
  try {
    const updateEntry = httpsCallable<
      { entryId: string; minutes: number; reason?: string },
      FirebaseFunctionResponse<{ entry: TimesheetEntry }>
    >(functions, 'updateTimesheetEntry');

    const result = await updateEntry({ entryId, minutes, reason });

    if (!result.data.success || !result.data.data) {
      throw new Error(result.data.message || 'שגיאה בעדכון רישום');
    }

    return result.data.data.entry;
  } catch (error) {
    console.error('❌ Error updating timesheet entry:', error);
    throw error;
  }
};

/**
 * Delete a timesheet entry
 * @param entryId Entry ID
 */
export const deleteTimesheetEntry = async (entryId: string): Promise<void> => {
  try {
    const deleteEntry = httpsCallable<
      { entryId: string },
      FirebaseFunctionResponse
    >(functions, 'deleteTimesheetEntry');

    const result = await deleteEntry({ entryId });

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה במחיקת רישום');
    }
  } catch (error) {
    console.error('❌ Error deleting timesheet entry:', error);
    throw error;
  }
};
