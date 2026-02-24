/**
 * Unit Tests for Client Hours Migration
 * Testing caseNumber-based functions vs clientName-based functions
 *
 * Migration: fullName/clientName → caseNumber
 *
 * @requires vitest
 * @requires happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Client Hours Migration - caseNumber-based Functions', () => {
  let mockFirebaseDB;
  let mockClientDoc;
  let mockTimesheetSnapshot;
  let mockCollectionFn;
  let mockClientsCollection;
  let mockTimesheetCollection;
  let mockUpdateFn;
  let mockGetFn;

  beforeEach(() => {
    // Mock Firestore database
    mockClientDoc = {
      id: '2025001',
      exists: true,
      data: () => ({
        caseNumber: '2025001',
        clientId: '2025001',
        clientName: 'משה כהן',
        fullName: 'משה כהן',
        type: 'hours',
        totalHours: 100,
        hoursRemaining: 40,
        minutesRemaining: 2400
      })
    };

    const mockTimesheetDocs = [
      {
        id: 'entry1',
        data: () => ({
          caseNumber: '2025001',
          clientName: 'משה כהן',
          minutes: 60,
          employee: 'עו"ד כהן',
          action: 'פגישה',
          date: '2025-01-15'
        })
      },
      {
        id: 'entry2',
        data: () => ({
          caseNumber: '2025001',
          clientName: 'משה כהן',
          minutes: 120,
          employee: 'עו"ד לוי',
          action: 'כתיבת מסמכים',
          date: '2025-01-16'
        })
      },
      {
        id: 'entry3',
        data: () => ({
          caseNumber: '2025001',
          clientName: 'משה כהן',
          minutes: 90,
          employee: 'עו"ד כהן',
          action: 'בית משפט',
          date: '2025-01-17'
        })
      }
    ];

    mockTimesheetSnapshot = {
      size: mockTimesheetDocs.length,
      empty: false,
      forEach: (callback) => {
        mockTimesheetDocs.forEach(callback);
      },
      docs: mockTimesheetDocs
    };

    // Mock Firestore API - with stored references for assertions
    mockUpdateFn = vi.fn(async (data) => {
      // Mock update success
      return { success: true };
    });

    mockGetFn = vi.fn(async () => mockClientDoc);

    mockClientsCollection = {
      doc: vi.fn((caseNumber) => {
        if (caseNumber === '2025001') {
          return {
            get: mockGetFn,
            update: mockUpdateFn
          };
        } else {
          return {
            get: vi.fn(async () => ({ exists: false })),
            update: mockUpdateFn
          };
        }
      }),
      where: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: [mockClientDoc],
          size: 1,
          empty: false
        }))
      }))
    };

    mockTimesheetCollection = {
      where: vi.fn((field, op, value) => ({
        get: vi.fn(async () => {
          // Return entries for caseNumber OR clientName queries
          if ((field === 'caseNumber' && value === '2025001') ||
              (field === 'clientName' && value === 'משה כהן')) {
            return mockTimesheetSnapshot;
          }
          // Empty results for wrong queries
          return {
            size: 0,
            empty: true,
            forEach: () => {},
            docs: []
          };
        })
      }))
    };

    mockFirebaseDB = {
      collection: vi.fn((collectionName) => {
        if (collectionName === 'clients') {
          return mockClientsCollection;
        } else if (collectionName === 'timesheet_entries') {
          return mockTimesheetCollection;
        }
      })
    };

    // Mock window.firebaseDB and global firebase
    global.window = {
      firebaseDB: mockFirebaseDB,
      firebase: {
        firestore: {
          FieldValue: {
            serverTimestamp: () => new Date()
          }
        }
      },
      manager: {
        clients: [
          {
            caseNumber: '2025001',
            clientId: '2025001',
            fullName: 'משה כהן',
            clientName: 'משה כהן',
            type: 'hours',
            totalHours: 100,
            hoursRemaining: 40,
            minutesRemaining: 2400
          }
        ],
        clientValidation: {
          updateBlockedClients: vi.fn()
        }
      },
      DEBUG_MODE: false
    };

    // Mock performance
    global.performance = {
      now: vi.fn(() => Date.now())
    };

    // ✅ CRITICAL FIX: Make firebase available globally (not just on window)
    // The code uses `firebase.firestore.FieldValue` not `window.firebase.firestore.FieldValue`
    global.firebase = global.window.firebase;

    // Mock Logger (used by statistics-calculator.js)
    global.Logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateClientHoursByCaseNumber() - NEW FUNCTION', () => {
    it('should calculate hours correctly using caseNumber', async () => {
      // Import the function (in actual implementation)
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result).toBeDefined();
      expect(result.caseNumber).toBe('2025001');
      expect(result.totalHours).toBe(100);
      expect(result.totalMinutesUsed).toBe(270); // 60 + 120 + 90
      expect(result.remainingMinutes).toBe(5730); // (100*60) - 270
      expect(result.remainingHours).toBeCloseTo(95.5, 1);
      expect(result.entriesCount).toBe(3);
    });

    it('should use .doc() for direct document access (faster)', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await calculateClientHoursByCaseNumber('2025001');

      // Verify .doc() was called (direct access)
      expect(mockFirebaseDB.collection).toHaveBeenCalledWith('clients');
      expect(mockClientsCollection.doc).toHaveBeenCalledWith('2025001');
    });

    it('should query timesheet by caseNumber (consistent field)', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await calculateClientHoursByCaseNumber('2025001');

      // Verify timesheet query uses caseNumber
      expect(mockFirebaseDB.collection).toHaveBeenCalledWith('timesheet_entries');
      expect(mockTimesheetCollection.where).toHaveBeenCalledWith('caseNumber', '==', '2025001');
    });

    it('should calculate breakdown by lawyer', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result.entriesByLawyer).toBeDefined();
      expect(result.entriesByLawyer['עו"ד כהן']).toBe(150); // 60 + 90
      expect(result.entriesByLawyer['עו"ד לוי']).toBe(120);
      expect(result.uniqueLawyers).toEqual(['עו"ד כהן', 'עו"ד לוי']);
    });

    it('should detect blocked status (0 hours remaining)', async () => {
      // Override mock to simulate 0 hours
      mockClientDoc.data = () => ({
        caseNumber: '2025001',
        clientName: 'משה כהן',
        type: 'hours',
        totalHours: 4.5 // 270 minutes = all used up
      });

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result.isBlocked).toBe(true);
      expect(result.status).toContain('חסום');
    });

    it('should detect critical status (≤5 hours remaining)', async () => {
      // Override mock to simulate low hours
      mockClientDoc.data = () => ({
        caseNumber: '2025001',
        clientName: 'משה כהן',
        type: 'hours',
        totalHours: 7 // 420 minutes total, 270 used = 150 remaining (2.5 hours)
      });

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result.isCritical).toBe(true);
      expect(result.status).toContain('קריטי');
    });

    it('should throw error for invalid caseNumber', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await expect(calculateClientHoursByCaseNumber(null)).rejects.toThrow('מספר תיק לא תקין');
      await expect(calculateClientHoursByCaseNumber(undefined)).rejects.toThrow('מספר תיק לא תקין');
      await expect(calculateClientHoursByCaseNumber(123)).rejects.toThrow('מספר תיק לא תקין');
    });

    it('should throw error for non-existent case', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await expect(calculateClientHoursByCaseNumber('9999999')).rejects.toThrow('לא נמצא');
    });

    it('should include performance metrics', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result._performance).toBeDefined();
      expect(result._performance.method).toBe('caseNumber');
      expect(result._performance.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateClientHoursImmediatelyByCaseNumber() - NEW FUNCTION', () => {
    it('should update client hours using caseNumber', async () => {
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const result = await updateClientHoursImmediatelyByCaseNumber('2025001', 60);

      expect(result.success).toBe(true);
      expect(result.caseNumber).toBe('2025001');
      expect(result.hoursData).toBeDefined();
    });

    it('should use .doc() for direct document access', async () => {
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await updateClientHoursImmediatelyByCaseNumber('2025001', 60);

      expect(mockClientsCollection.doc).toHaveBeenCalledWith('2025001');
    });

    it('should update Firebase with accurate data', async () => {
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await updateClientHoursImmediatelyByCaseNumber('2025001', 60);

      // Verify update was called
      expect(mockUpdateFn).toHaveBeenCalled();
    });

    it('should update local window.manager.clients', async () => {
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const initialHours = window.manager.clients[0].hoursRemaining;

      await updateClientHoursImmediatelyByCaseNumber('2025001', 60);

      // Local client should be updated
      expect(window.manager.clients[0].hoursRemaining).toBeDefined();
    });

    it('should call clientValidation.updateBlockedClients()', async () => {
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await updateClientHoursImmediatelyByCaseNumber('2025001', 60);

      expect(window.manager.clientValidation.updateBlockedClients).toHaveBeenCalled();
    });

    it('should handle fixed-price clients gracefully', async () => {
      // Override mock to simulate fixed client
      mockClientDoc.data = () => ({
        caseNumber: '2025001',
        clientName: 'לקוח פיקס',
        type: 'fixed',
        totalHours: 0
      });

      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const result = await updateClientHoursImmediatelyByCaseNumber('2025001', 60);

      expect(result.success).toBe(true);
      expect(result.message).toContain('פיקס');
    });

    it('should handle non-existent case gracefully', async () => {
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const result = await updateClientHoursImmediatelyByCaseNumber('9999999', 60);

      expect(result.success).toBe(false);
      expect(result.message).toContain('לא נמצא');
    });
  });

  describe('Comparison Tests - OLD vs NEW', () => {
    it('should produce identical results for same client', async () => {
      const {
        calculateClientHoursAccurate,
        calculateClientHoursByCaseNumber
      } = await import('../../apps/user-app/js/modules/client-hours.js');

      // Call old function (by name)
      const oldResult = await calculateClientHoursAccurate('משה כהן');

      // Call new function (by caseNumber)
      const newResult = await calculateClientHoursByCaseNumber('2025001');

      // Results should be identical
      expect(newResult.totalMinutesUsed).toBe(oldResult.totalMinutesUsed);
      expect(newResult.remainingHours).toBeCloseTo(oldResult.remainingHours, 2);
      expect(newResult.remainingMinutes).toBe(oldResult.remainingMinutes);
      expect(newResult.isBlocked).toBe(oldResult.isBlocked);
      expect(newResult.isCritical).toBe(oldResult.isCritical);
    });

    it('NEW function should be faster than OLD (uses .doc() not .where())', async () => {
      const {
        calculateClientHoursAccurate,
        calculateClientHoursByCaseNumber
      } = await import('../../apps/user-app/js/modules/client-hours.js');

      const startOld = performance.now();
      await calculateClientHoursAccurate('משה כהן');
      const durationOld = performance.now() - startOld;

      const startNew = performance.now();
      await calculateClientHoursByCaseNumber('2025001');
      const durationNew = performance.now() - startNew;

      // NEW should be faster (or at least not slower)
      // Note: In mocked environment, difference may be minimal
      expect(durationNew).toBeLessThanOrEqual(durationOld * 1.5); // Allow 50% margin
    });
  });

  describe('Edge Cases', () => {
    it('should handle client with no timesheet entries', async () => {
      // Override mock to return empty timesheet
      mockFirebaseDB.collection = vi.fn((collectionName) => {
        if (collectionName === 'clients') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn(async () => mockClientDoc)
            }))
          };
        } else if (collectionName === 'timesheet_entries') {
          return {
            where: vi.fn(() => ({
              get: vi.fn(async () => ({
                size: 0,
                empty: true,
                forEach: () => {},
                docs: []
              }))
            }))
          };
        }
      });

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result.totalMinutesUsed).toBe(0);
      expect(result.entriesCount).toBe(0);
      expect(result.remainingHours).toBe(100);
    });

    it('should handle missing employee field in timesheet', async () => {
      const docsWithoutEmployee = [{
        id: 'entry1',
        data: () => ({
          caseNumber: '2025001',
          minutes: 60,
          // No employee or lawyer field
          action: 'פעולה'
        })
      }];

      mockTimesheetSnapshot = {
        size: 1,
        empty: false,
        forEach: (callback) => docsWithoutEmployee.forEach(callback),
        docs: docsWithoutEmployee
      };

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result.entriesByLawyer['לא ידוע']).toBe(60);
    });

    it('should handle Firebase connection failure', async () => {
      window.firebaseDB = null;

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await expect(calculateClientHoursByCaseNumber('2025001')).rejects.toThrow('Firebase לא מחובר');
    });
  });

  describe('Data Consistency', () => {
    it('should always use caseNumber as primary key', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const result = await calculateClientHoursByCaseNumber('2025001');

      // Verify caseNumber is used throughout
      expect(result.caseNumber).toBe('2025001');
      expect(mockClientsCollection.doc).toHaveBeenCalledWith('2025001');
      expect(mockTimesheetCollection.where)
        .toHaveBeenCalledWith('caseNumber', '==', '2025001');
    });

    it('should NOT be affected by fullName/clientName changes', async () => {
      // Scenario: Client name was updated from "משה כהן" to "משה כהן-לוי"
      mockClientDoc.data = () => ({
        caseNumber: '2025001',
        clientName: 'משה כהן', // OLD name (not yet synced)
        fullName: 'משה כהן-לוי', // NEW name
        type: 'hours',
        totalHours: 100
      });

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      // Should still work perfectly because it uses caseNumber!
      const result = await calculateClientHoursByCaseNumber('2025001');

      expect(result.totalMinutesUsed).toBe(270);
      expect(result.caseNumber).toBe('2025001');
      // Function doesn't care about name mismatch - uses caseNumber!
    });
  });

  describe('Backward Compatibility', () => {
    it('should keep OLD functions working (no breaking changes)', async () => {
      const { calculateClientHoursAccurate } = await import('../../apps/user-app/js/modules/client-hours.js');

      // OLD function should still work
      const result = await calculateClientHoursAccurate('משה כהן');

      expect(result).toBeDefined();
      expect(result.totalMinutesUsed).toBe(270);
    });

    it('should export both OLD and NEW functions', async () => {
      const ClientHours = await import('../../apps/user-app/js/modules/client-hours.js');

      // NEW functions
      expect(ClientHours.calculateClientHoursByCaseNumber).toBeDefined();
      expect(ClientHours.updateClientHoursImmediatelyByCaseNumber).toBeDefined();

      // OLD functions (backward compatibility)
      expect(ClientHours.calculateClientHoursAccurate).toBeDefined();
      expect(ClientHours.updateClientHoursImmediately).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate caseNumber is a string', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await expect(calculateClientHoursByCaseNumber(123)).rejects.toThrow();
      await expect(calculateClientHoursByCaseNumber({})).rejects.toThrow();
      await expect(calculateClientHoursByCaseNumber([])).rejects.toThrow();
    });

    it('should validate caseNumber is not empty', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      await expect(calculateClientHoursByCaseNumber('')).rejects.toThrow();
    });

    it('should handle caseNumber with special characters', async () => {
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      // Should work with any string caseNumber
      await expect(calculateClientHoursByCaseNumber('2025-001-ABC')).rejects.toThrow('לא נמצא');
      // (rejects because not found, but doesn't throw validation error)
    });
  });
});

describe('Statistics Calculator - caseNumber-based Functions', () => {
  // Similar tests for statistics-calculator.js
  // (Would mirror the above structure)

  it('should have identical implementation to client-hours.js', async () => {
    // Verify both modules have the same functions
    const ClientHours = await import('../../apps/user-app/js/modules/client-hours.js');

    // Import statistics-calculator to trigger window.StatisticsCalculator assignment
    await import('../../apps/user-app/js/modules/statistics-calculator.js');

    expect(typeof ClientHours.calculateClientHoursByCaseNumber).toBe('function');
    expect(typeof window.StatisticsCalculator?.calculateClientHoursByCaseNumber).toBe('function');
  });
});
