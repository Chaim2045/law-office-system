/**
 * Integration Tests for Client Hours - Full Flow
 * Tests complete workflow from client creation to hours tracking
 *
 * This tests the REAL-WORLD scenario:
 * 1. Create client
 * 2. Add timesheet entries
 * 3. Calculate hours
 * 4. Update client name
 * 5. Verify calculations still work (with NEW caseNumber-based functions)
 *
 * @requires vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Client Hours - Full Integration Flow', () => {
  let mockFirebaseDB;
  let clientsData;
  let timesheetData;

  beforeEach(() => {
    // Simulate real Firebase data storage
    clientsData = new Map();
    timesheetData = [];

    // Create realistic Firebase mock
    mockFirebaseDB = {
      collection: (collectionName) => {
        if (collectionName === 'clients') {
          return {
            doc: (caseNumber) => ({
              get: async () => {
                const data = clientsData.get(caseNumber);
                return {
                  id: caseNumber,
                  exists: !!data,
                  data: () => data
                };
              },
              set: async (data) => {
                clientsData.set(caseNumber, { ...data, caseNumber });
              },
              update: async (updates) => {
                const existing = clientsData.get(caseNumber);
                if (existing) {
                  clientsData.set(caseNumber, { ...existing, ...updates });
                }
              }
            }),
            where: (field, op, value) => ({
              get: async () => {
                const results = [];
                for (const [id, data] of clientsData.entries()) {
                  if (data[field] === value) {
                    results.push({
                      id,
                      data: () => data
                    });
                  }
                }
                return {
                  docs: results,
                  size: results.length,
                  empty: results.length === 0
                };
              }
            })
          };
        } else if (collectionName === 'timesheet_entries') {
          return {
            add: async (data) => {
              const id = `entry_${Date.now()}_${Math.random()}`;
              timesheetData.push({ id, ...data });
              return { id };
            },
            where: (field, op, value) => ({
              get: async () => {
                const results = timesheetData
                  .filter(entry => entry[field] === value)
                  .map(entry => ({
                    id: entry.id,
                    data: () => entry
                  }));

                return {
                  docs: results,
                  size: results.length,
                  empty: results.length === 0,
                  forEach: (callback) => results.forEach(callback)
                };
              }
            })
          };
        }
      }
    };

    // Setup global window
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
        clients: [],
        clientValidation: {
          updateBlockedClients: vi.fn()
        }
      },
      DEBUG_MODE: false
    };

    global.performance = {
      now: () => Date.now()
    };

    // ✅ CRITICAL FIX: Make firebase available globally (not just on window)
    // The code uses `firebase.firestore.FieldValue` not `window.firebase.firestore.FieldValue`
    global.firebase = global.window.firebase;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Normal Flow - No Name Changes', () => {
    it('should handle complete client lifecycle with caseNumber', async () => {
      // STEP 1: Create client
      const caseNumber = '2025001';
      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'דוד לוי',
        fullName: 'דוד לוי',
        type: 'hours',
        totalHours: 50,
        hoursRemaining: 50,
        minutesRemaining: 3000
      });

      // Verify client created
      const clientDoc = await mockFirebaseDB.collection('clients').doc(caseNumber).get();
      expect(clientDoc.exists).toBe(true);
      expect(clientDoc.data().clientName).toBe('דוד לוי');

      // STEP 2: Add timesheet entries
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'דוד לוי',
        minutes: 120,
        employee: 'עו"ד כהן',
        action: 'ייעוץ ראשוני',
        date: '2025-01-10'
      });

      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'דוד לוי',
        minutes: 180,
        employee: 'עו"ד לוי',
        action: 'הכנת תביעה',
        date: '2025-01-11'
      });

      // Verify entries created
      const entriesSnapshot = await mockFirebaseDB
        .collection('timesheet_entries')
        .where('caseNumber', '==', caseNumber)
        .get();

      expect(entriesSnapshot.size).toBe(2);

      // STEP 3: Calculate hours using NEW function
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const hoursData = await calculateClientHoursByCaseNumber(caseNumber);

      expect(hoursData.totalMinutesUsed).toBe(300); // 120 + 180
      expect(hoursData.remainingMinutes).toBe(2700); // 3000 - 300
      expect(hoursData.remainingHours).toBe(45);
      expect(hoursData.entriesCount).toBe(2);
      expect(hoursData.isBlocked).toBe(false);
      expect(hoursData.isCritical).toBe(false);

      // STEP 4: Update client hours
      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const updateResult = await updateClientHoursImmediatelyByCaseNumber(caseNumber);

      expect(updateResult.success).toBe(true);
      expect(updateResult.hoursData.remainingHours).toBe(45);
    });
  });

  describe('Scenario 2: CRITICAL - Name Change After Entries', () => {
    it('should handle name changes WITHOUT breaking hours calculation (caseNumber-based)', async () => {
      const caseNumber = '2025002';

      // STEP 1: Create client with original name
      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'שרה כהן',
        fullName: 'שרה כהן',
        type: 'hours',
        totalHours: 100,
        hoursRemaining: 100,
        minutesRemaining: 6000
      });

      // STEP 2: Add timesheet entries with original name
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'שרה כהן', // Original name
        minutes: 240,
        employee: 'עו"ד דוד',
        action: 'פגישת ייעוץ',
        date: '2025-01-15'
      });

      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'שרה כהן', // Original name
        minutes: 360,
        employee: 'עו"ד משה',
        action: 'בית משפט',
        date: '2025-01-16'
      });

      // STEP 3: Calculate with original name - should work
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const beforeChange = await calculateClientHoursByCaseNumber(caseNumber);

      expect(beforeChange.totalMinutesUsed).toBe(600); // 240 + 360
      expect(beforeChange.remainingHours).toBe(90);

      // STEP 4: ⚠️ UPDATE CLIENT NAME (marriage, divorce, typo fix, etc.)
      await mockFirebaseDB.collection('clients').doc(caseNumber).update({
        clientName: 'שרה כהן-לוי', // NEW name
        fullName: 'שרה כהן-לוי'  // NEW name
      });

      // Verify name was updated
      const updatedClient = await mockFirebaseDB.collection('clients').doc(caseNumber).get();
      expect(updatedClient.data().fullName).toBe('שרה כהן-לוי');

      // STEP 5: ✅ Calculate AFTER name change - should STILL WORK!
      // This is the CRITICAL TEST - old functions would FAIL here
      const afterChange = await calculateClientHoursByCaseNumber(caseNumber);

      // Should find the same entries (queries by caseNumber, not name!)
      expect(afterChange.totalMinutesUsed).toBe(600);
      expect(afterChange.remainingHours).toBe(90);
      expect(afterChange.entriesCount).toBe(2);

      // ✅ VERIFICATION: Results are identical before and after name change
      expect(afterChange.totalMinutesUsed).toBe(beforeChange.totalMinutesUsed);
      expect(afterChange.remainingHours).toBe(beforeChange.remainingHours);
    });

    it('should FAIL with OLD function after name change (demonstrates the bug)', async () => {
      const caseNumber = '2025003';

      // Create client
      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'יוסי אברהם',
        fullName: 'יוסי אברהם',
        type: 'hours',
        totalHours: 50
      });

      // Add entries
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'יוסי אברהם',
        minutes: 120,
        employee: 'עו"ד א',
        action: 'פגישה',
        date: '2025-01-20'
      });

      // Calculate BEFORE name change with OLD function
      const { calculateClientHoursAccurate } = await import('../../apps/user-app/js/modules/client-hours.js');
      const beforeChange = await calculateClientHoursAccurate('יוסי אברהם');

      expect(beforeChange.totalMinutesUsed).toBe(120);

      // Change name
      await mockFirebaseDB.collection('clients').doc(caseNumber).update({
        clientName: 'יוסי אברהם', // Stays old (bug!)
        fullName: 'יוסף אברהם'   // Updated to new
      });

      // ❌ Try to calculate with OLD function using NEW name
      const afterChange = await calculateClientHoursAccurate('יוסף אברהם');

      // OLD function queries timesheet by clientName
      // But entries still have old clientName="יוסי אברהם"
      // So it finds 0 entries! ❌
      expect(afterChange.totalMinutesUsed).toBe(0); // WRONG!
      expect(afterChange.entriesCount).toBe(0);      // WRONG!

      // This demonstrates the BUG that the NEW function FIXES
    });
  });

  describe('Scenario 3: Client Blocked (Zero Hours)', () => {
    it('should correctly detect and block client when hours run out', async () => {
      const caseNumber = '2025004';

      // Create client with only 3 hours
      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'מיכל דוד',
        fullName: 'מיכל דוד',
        type: 'hours',
        totalHours: 3,
        hoursRemaining: 3,
        minutesRemaining: 180
      });

      // Add entries that consume all hours
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'מיכל דוד',
        minutes: 120,
        employee: 'עו"ד א',
        action: 'פגישה 1',
        date: '2025-01-20'
      });

      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'מיכל דוד',
        minutes: 60,
        employee: 'עו"ד ב',
        action: 'פגישה 2',
        date: '2025-01-21'
      });

      // Calculate hours
      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const hoursData = await calculateClientHoursByCaseNumber(caseNumber);

      expect(hoursData.totalMinutesUsed).toBe(180);
      expect(hoursData.remainingMinutes).toBe(0);
      expect(hoursData.remainingHours).toBe(0);
      expect(hoursData.isBlocked).toBe(true);
      expect(hoursData.status).toContain('חסום');
    });
  });

  describe('Scenario 4: Critical Hours Warning', () => {
    it('should warn when client has ≤5 hours remaining', async () => {
      const caseNumber = '2025005';

      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'אבי מזרחי',
        fullName: 'אבי מזרחי',
        type: 'hours',
        totalHours: 10,
        hoursRemaining: 10,
        minutesRemaining: 600
      });

      // Use 7 hours (leaving 3 hours = critical)
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'אבי מזרחי',
        minutes: 420, // 7 hours
        employee: 'עו"ד א',
        action: 'עבודה ארוכה',
        date: '2025-01-25'
      });

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const hoursData = await calculateClientHoursByCaseNumber(caseNumber);

      expect(hoursData.remainingHours).toBe(3);
      expect(hoursData.isCritical).toBe(true);
      expect(hoursData.isBlocked).toBe(false);
      expect(hoursData.status).toContain('קריטי');
    });
  });

  describe('Scenario 5: Fixed-Price Client', () => {
    it('should handle fixed-price clients (no hour tracking)', async () => {
      const caseNumber = '2025006';

      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'לקוח פיקס',
        fullName: 'לקוח פיקס',
        type: 'fixed',
        totalHours: 0
      });

      const { updateClientHoursImmediatelyByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const result = await updateClientHoursImmediatelyByCaseNumber(caseNumber, 60);

      expect(result.success).toBe(true);
      expect(result.message).toContain('פיקס');
    });
  });

  describe('Scenario 6: Multiple Lawyers on Same Case', () => {
    it('should correctly track hours by different lawyers', async () => {
      const caseNumber = '2025007';

      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'תיק משותף',
        fullName: 'תיק משותף',
        type: 'hours',
        totalHours: 100
      });

      // Multiple lawyers work on same case
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'תיק משותף',
        minutes: 60,
        employee: 'עו"ד אלי',
        action: 'ייעוץ',
        date: '2025-01-30'
      });

      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'תיק משותף',
        minutes: 90,
        employee: 'עו"ד רונה',
        action: 'כתיבה',
        date: '2025-01-30'
      });

      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'תיק משותף',
        minutes: 120,
        employee: 'עו"ד דני',
        action: 'בית משפט',
        date: '2025-01-31'
      });

      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'תיק משותף',
        minutes: 45,
        employee: 'עו"ד אלי',
        action: 'מעקב',
        date: '2025-01-31'
      });

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');
      const hoursData = await calculateClientHoursByCaseNumber(caseNumber);

      expect(hoursData.totalMinutesUsed).toBe(315); // 60+90+120+45
      expect(hoursData.entriesByLawyer['עו"ד אלי']).toBe(105); // 60+45
      expect(hoursData.entriesByLawyer['עו"ד רונה']).toBe(90);
      expect(hoursData.entriesByLawyer['עו"ד דני']).toBe(120);
      expect(hoursData.uniqueLawyers).toHaveLength(3);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of timesheet entries efficiently', async () => {
      const caseNumber = '2025008';

      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'תיק גדול',
        fullName: 'תיק גדול',
        type: 'hours',
        totalHours: 1000
      });

      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        await mockFirebaseDB.collection('timesheet_entries').add({
          caseNumber,
          clientName: 'תיק גדול',
          minutes: 30,
          employee: `עו"ד ${i % 5}`,
          action: `פעולה ${i}`,
          date: '2025-02-01'
        });
      }

      const { calculateClientHoursByCaseNumber } = await import('../../apps/user-app/js/modules/client-hours.js');

      const startTime = performance.now();
      const hoursData = await calculateClientHoursByCaseNumber(caseNumber);
      const duration = performance.now() - startTime;

      expect(hoursData.totalMinutesUsed).toBe(3000); // 100 * 30
      expect(hoursData.entriesCount).toBe(100);
      expect(duration).toBeLessThan(500); // Should complete in <500ms
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency across updates', async () => {
      const caseNumber = '2025009';

      // Create client
      await mockFirebaseDB.collection('clients').doc(caseNumber).set({
        caseNumber,
        clientId: caseNumber,
        clientName: 'בדיקת עקביות',
        fullName: 'בדיקת עקביות',
        type: 'hours',
        totalHours: 50
      });

      // Add entry
      await mockFirebaseDB.collection('timesheet_entries').add({
        caseNumber,
        clientName: 'בדיקת עקביות',
        minutes: 120,
        employee: 'עו"ד טסט',
        action: 'בדיקה',
        date: '2025-02-05'
      });

      const { calculateClientHoursByCaseNumber, updateClientHoursImmediatelyByCaseNumber } =
        await import('../../apps/user-app/js/modules/client-hours.js');

      // Calculate
      const calc1 = await calculateClientHoursByCaseNumber(caseNumber);

      // Update
      await updateClientHoursImmediatelyByCaseNumber(caseNumber);

      // Calculate again - should be same
      const calc2 = await calculateClientHoursByCaseNumber(caseNumber);

      expect(calc2.totalMinutesUsed).toBe(calc1.totalMinutesUsed);
      expect(calc2.remainingHours).toBe(calc1.remainingHours);
    });
  });
});
