/**
 * Workflow Enforcement Tests
 * בודק את הוולידציות הקריטיות שמבטיחות שלמות נתונים
 */

const admin = require('firebase-admin');
const test = require('firebase-functions-test')();

// Mock context for authenticated user
const mockContext = {
  auth: {
    uid: 'test-user-123',
    token: {
      email: 'test@example.com'
    }
  }
};

describe('Workflow Enforcement - createTimesheetEntry', () => {
  let createTimesheetEntry;
  let db;

  beforeAll(() => {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'test-project'
      });
    }
    db = admin.firestore();

    // Import the function
    const functions = require('../index');
    createTimesheetEntry = functions.createTimesheetEntry;
  });

  afterAll(async () => {
    // Cleanup
    test.cleanup();
    await admin.app().delete();
  });

  beforeEach(async () => {
    // Setup: Create test employee
    await db.collection('employees').doc('test@example.com').set({
      username: 'Test User',
      email: 'test@example.com',
      role: 'lawyer'
    });
  });

  afterEach(async () => {
    // Cleanup: Delete all test data
    const collections = ['employees', 'timesheet_entries', 'cases', 'clients', 'budget_tasks'];
    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  });

  describe('Validation: taskId required for client work', () => {
    test('should REJECT timesheet entry without taskId for client work', async () => {
      const data = {
        clientId: 'client-123',
        clientName: 'Test Client',
        caseId: 'case-123',
        caseTitle: 'Test Case',
        minutes: 60,
        date: new Date().toISOString(),
        action: 'עבודה על תיק',
        isInternal: false
        // ❌ Missing taskId
      };

      await expect(
        createTimesheetEntry(data, mockContext)
      ).rejects.toThrow('חובה לבחור משימה לרישום זמן על לקוח');
    });

    test('should ACCEPT timesheet entry with taskId for client work', async () => {
      // Setup: Create test data
      await db.collection('clients').doc('client-123').set({
        fullName: 'Test Client',
        createdAt: new Date()
      });

      await db.collection('cases').doc('case-123').set({
        clientId: 'client-123',
        title: 'Test Case',
        caseType: 'hours',
        status: 'active',
        hoursRemaining: 100,
        minutesRemaining: 6000
      });

      await db.collection('budget_tasks').doc('task-123').set({
        title: 'Test Task',
        caseId: 'case-123',
        status: 'active',
        budgetHours: 5,
        actualHours: 0
      });

      const data = {
        clientId: 'client-123',
        clientName: 'Test Client',
        caseId: 'case-123',
        caseTitle: 'Test Case',
        taskId: 'task-123', // ✅ Has taskId
        minutes: 60,
        date: new Date().toISOString(),
        action: 'עבודה על תיק',
        isInternal: false
      };

      const result = await createTimesheetEntry(data, mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.entryId).toBeDefined();
    });

    test('should ACCEPT internal work WITHOUT taskId', async () => {
      const data = {
        minutes: 60,
        date: new Date().toISOString(),
        action: 'עבודה פנימית',
        isInternal: true // ✅ Internal work doesn't need taskId
        // No taskId - OK for internal work
      };

      const result = await createTimesheetEntry(data, mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});

describe('Workflow Enforcement - completeTask', () => {
  let completeTask;
  let db;

  beforeAll(() => {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'test-project'
      });
    }
    db = admin.firestore();

    const functions = require('../index');
    completeTask = functions.completeTask;
  });

  afterAll(async () => {
    test.cleanup();
    if (admin.apps.length) {
      await admin.app().delete();
    }
  });

  beforeEach(async () => {
    await db.collection('employees').doc('test@example.com').set({
      username: 'Test User',
      email: 'test@example.com',
      role: 'lawyer'
    });
  });

  afterEach(async () => {
    const collections = ['employees', 'budget_tasks', 'cases'];
    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  });

  describe('Validation: actualHours > 0 required', () => {
    test('should REJECT completing task with zero hours', async () => {
      // Setup: Create task with 0 hours
      await db.collection('budget_tasks').doc('task-no-hours').set({
        title: 'Task Without Hours',
        status: 'active',
        budgetHours: 5,
        actualHours: 0 // ❌ No hours logged
      });

      const data = {
        taskId: 'task-no-hours'
      };

      await expect(
        completeTask(data, mockContext)
      ).rejects.toThrow('לא ניתן לסיים משימה ללא רישומי זמן');
    });

    test('should ACCEPT completing task with hours logged', async () => {
      // Setup: Create task with hours
      await db.collection('budget_tasks').doc('task-with-hours').set({
        title: 'Task With Hours',
        status: 'active',
        budgetHours: 5,
        actualHours: 3.5 // ✅ Has hours logged
      });

      const data = {
        taskId: 'task-with-hours'
      };

      const result = await completeTask(data, mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify task status changed
      const taskDoc = await db.collection('budget_tasks').doc('task-with-hours').get();
      expect(taskDoc.data().status).toBe('completed');
    });

    test('should REJECT completing task with undefined actualHours', async () => {
      // Setup: Create task without actualHours field
      await db.collection('budget_tasks').doc('task-no-field').set({
        title: 'Task Without Field',
        status: 'active',
        budgetHours: 5
        // actualHours field doesn't exist
      });

      const data = {
        taskId: 'task-no-field'
      };

      await expect(
        completeTask(data, mockContext)
      ).rejects.toThrow('לא ניתן לסיים משימה ללא רישומי זמן');
    });
  });
});

describe('Edge Cases', () => {
  let db;

  beforeAll(() => {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'test-project'
      });
    }
    db = admin.firestore();
  });

  afterAll(async () => {
    test.cleanup();
    if (admin.apps.length) {
      await admin.app().delete();
    }
  });

  test('should handle missing authentication context', async () => {
    const functions = require('../index');
    const createTimesheetEntry = functions.createTimesheetEntry;

    const data = {
      clientId: 'client-123',
      minutes: 60,
      action: 'test',
      isInternal: false
    };

    const unauthContext = {}; // No auth

    await expect(
      createTimesheetEntry(data, unauthContext)
    ).rejects.toThrow();
  });

  test('should handle invalid date format', async () => {
    const functions = require('../index');
    const createTimesheetEntry = functions.createTimesheetEntry;

    const data = {
      minutes: 60,
      date: 'invalid-date', // ❌ Invalid date
      action: 'test',
      isInternal: true
    };

    await expect(
      createTimesheetEntry(data, mockContext)
    ).rejects.toThrow();
  });
});
